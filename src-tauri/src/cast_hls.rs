use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::process::Child;
use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

const PROBE_TIMEOUT: Duration = Duration::from_secs(15);
const SEGMENT_WAIT_MAX: Duration = Duration::from_secs(20);
const SEGMENT_POLL_INTERVAL: Duration = Duration::from_millis(150);

#[derive(Clone, Debug)]
struct Probe {
    duration_sec: f64,
    video_codec: String,
    audio_codec: String,
    width: u32,
    height: u32,
    fps: f64,
    video_bitrate: u64,
}

struct HlsSession {
    probe: Probe,
    temp_dir: PathBuf,
    last_access: std::sync::Mutex<Instant>,
    process: Mutex<Option<Child>>,
}

fn touch(session: &HlsSession) {
    if let Ok(mut t) = session.last_access.lock() {
        *t = Instant::now();
    }
}

async fn stop_session_resources(session: Arc<HlsSession>) {
    let child = { session.process.lock().await.take() };
    if let Some(mut child) = child {
        if let Err(error) = child.start_kill() {
            eprintln!("[cast-hls] ffmpeg termination request failed: {error}");
        }
        if let Err(error) = child.wait().await {
            eprintln!("[cast-hls] ffmpeg reap failed: {error}");
        }
    }
    if let Err(error) = tokio::fs::remove_dir_all(&session.temp_dir).await {
        if error.kind() != std::io::ErrorKind::NotFound {
            eprintln!("[cast-hls] temporary session cleanup failed: {error}");
        }
    }
}

#[derive(Clone)]
pub struct HlsState {
    sessions: Arc<RwLock<HashMap<String, Arc<HlsSession>>>>,
}

impl HlsState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register_with_seek(
        &self,
        media_url: String,
        headers: HashMap<String, String>,
        seek_start_sec: f64,
        burn_sub: Option<(String, String)>,
    ) -> Result<String, String> {
        let probe = probe_source(&media_url, &headers).await?;
        let id = Uuid::new_v4().to_string();
        let temp_dir = std::env::temp_dir().join(format!("harbor-hls-{}", id));
        std::fs::create_dir_all(&temp_dir).map_err(|e| format!("mkdir: {}", e))?;
        let child = match spawn_continuous_ffmpeg(
            &media_url,
            &headers,
            seek_start_sec,
            probe.duration_sec,
            &temp_dir,
            burn_sub,
        )
        .await
        {
            Ok(child) => child,
            Err(error) => {
                let _ = tokio::fs::remove_dir_all(&temp_dir).await;
                return Err(error);
            }
        };
        let session = Arc::new(HlsSession {
            probe,
            temp_dir,
            last_access: std::sync::Mutex::new(Instant::now()),
            process: Mutex::new(Some(child)),
        });
        self.sessions.write().await.insert(id.clone(), session);
        eprintln!(
            "[cast-hls] session {} registered, seek={:.1}s",
            id, seek_start_sec
        );
        Ok(id)
    }

    pub async fn stop_session(&self, id: &str) -> bool {
        let session = { self.sessions.write().await.remove(id) };
        let Some(session) = session else {
            return false;
        };
        stop_session_resources(session).await;
        true
    }

    pub async fn stop_all(&self) -> usize {
        let sessions: Vec<Arc<HlsSession>> = {
            let mut map = self.sessions.write().await;
            map.drain().map(|(_, session)| session).collect()
        };
        for session in &sessions {
            stop_session_resources(session.clone()).await;
        }
        sessions.len()
    }

    pub async fn evict_idle(&self, idle: Duration) -> usize {
        let now = Instant::now();
        let stale: Vec<Arc<HlsSession>> = {
            let mut map = self.sessions.write().await;
            let stale_ids: Vec<String> = map
                .iter()
                .filter(|(_, s)| {
                    s.last_access
                        .lock()
                        .map(|t| now.duration_since(*t) > idle)
                        .unwrap_or(false)
                })
                .map(|(k, _)| k.clone())
                .collect();
            stale_ids
                .into_iter()
                .filter_map(|id| map.remove(&id))
                .collect()
        };
        for session in &stale {
            stop_session_resources(session.clone()).await;
        }
        stale.len()
    }
}

pub fn router(state: HlsState) -> axum::Router {
    use axum::routing::get;
    axum::Router::new()
        .route(
            "/cast/hls/{id}/master.m3u8",
            get(handle_master).options(handle_preflight),
        )
        .route(
            "/cast/hls/{id}/variant.m3u8",
            get(handle_variant).options(handle_preflight),
        )
        .route(
            "/cast/hls/{id}/{filename}",
            get(handle_segment).options(handle_preflight),
        )
        .with_state(state)
}

async fn handle_preflight() -> Response {
    let mut resp = Response::builder().status(StatusCode::NO_CONTENT);
    if let Some(h) = resp.headers_mut() {
        h.insert(
            HeaderName::from_static("access-control-allow-origin"),
            HeaderValue::from_static("*"),
        );
        h.insert(
            HeaderName::from_static("access-control-allow-methods"),
            HeaderValue::from_static("GET, HEAD, OPTIONS"),
        );
        h.insert(
            HeaderName::from_static("access-control-allow-headers"),
            HeaderValue::from_static("Content-Type, Accept-Encoding, Range, Origin"),
        );
        h.insert(
            HeaderName::from_static("access-control-max-age"),
            HeaderValue::from_static("86400"),
        );
    }
    resp.body(Body::empty())
        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "preflight").into_response())
}

async fn handle_master(
    State(state): State<HlsState>,
    Path(id): Path<String>,
    headers: axum::http::HeaderMap,
) -> Response {
    let origin = headers
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("(no-origin)");
    eprintln!("[cast-hls] MASTER hit id={} origin={}", id, origin);
    let session = match state.sessions.read().await.get(&id).cloned() {
        Some(s) => s,
        None => return (StatusCode::NOT_FOUND, "session not found").into_response(),
    };
    touch(&session);
    let codecs = "avc1.640029,mp4a.40.2";
    let bandwidth = session
        .probe
        .video_bitrate
        .saturating_add(192_000)
        .max(2_500_000);
    let (w, h) = clamp_resolution(session.probe.width, session.probe.height);
    let body = format!(
        "#EXTM3U\n\
         #EXT-X-VERSION:3\n\
         #EXT-X-INDEPENDENT-SEGMENTS\n\
         #EXT-X-STREAM-INF:BANDWIDTH={bw},AVERAGE-BANDWIDTH={bw},CODECS=\"{codecs}\",RESOLUTION={w}x{h},FRAME-RATE={fps:.3}\n\
         variant.m3u8\n",
        bw = bandwidth, codecs = codecs, w = w, h = h, fps = session.probe.fps,
    );
    playlist_response(body)
}

async fn handle_variant(State(state): State<HlsState>, Path(id): Path<String>) -> Response {
    eprintln!("[cast-hls] VARIANT hit id={}", id);
    let session = match state.sessions.read().await.get(&id).cloned() {
        Some(s) => s,
        None => return (StatusCode::NOT_FOUND, "session not found").into_response(),
    };
    touch(&session);
    let playlist_path = session.temp_dir.join("playlist.m3u8");
    let deadline = std::time::Instant::now() + SEGMENT_WAIT_MAX;
    loop {
        if let Ok(content) = tokio::fs::read_to_string(&playlist_path).await {
            if content.contains("#EXTINF") {
                return playlist_response(content);
            }
        }
        if std::time::Instant::now() >= deadline {
            return (StatusCode::SERVICE_UNAVAILABLE, "playlist not ready").into_response();
        }
        tokio::time::sleep(SEGMENT_POLL_INTERVAL).await;
    }
}

async fn handle_segment(
    State(state): State<HlsState>,
    Path((id, filename)): Path<(String, String)>,
) -> Response {
    if !filename.ends_with(".ts") {
        return (StatusCode::NOT_FOUND, "not a segment").into_response();
    }
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return (StatusCode::BAD_REQUEST, "bad name").into_response();
    }
    let session = match state.sessions.read().await.get(&id).cloned() {
        Some(s) => s,
        None => return (StatusCode::NOT_FOUND, "session not found").into_response(),
    };
    touch(&session);
    let path = session.temp_dir.join(&filename);
    let deadline = std::time::Instant::now() + SEGMENT_WAIT_MAX;
    loop {
        if path.is_file() {
            tokio::time::sleep(Duration::from_millis(80)).await;
            if let Ok(bytes) = tokio::fs::read(&path).await {
                if !bytes.is_empty() && bytes[0] == 0x47 {
                    eprintln!(
                        "[cast-hls] SEGMENT hit id={} filename={} bytes={}",
                        id,
                        filename,
                        bytes.len()
                    );
                    return binary_response(bytes, "video/mp2t");
                }
            }
        }
        if std::time::Instant::now() >= deadline {
            eprintln!("[cast-hls] SEGMENT timeout id={} filename={}", id, filename);
            return (StatusCode::SERVICE_UNAVAILABLE, "segment not ready").into_response();
        }
        tokio::time::sleep(SEGMENT_POLL_INTERVAL).await;
    }
}

fn playlist_response(body: String) -> Response {
    let bytes = body.into_bytes();
    let mut resp = Response::builder().status(StatusCode::OK);
    if let Some(h) = resp.headers_mut() {
        h.insert(
            HeaderName::from_static("content-type"),
            HeaderValue::from_static("application/vnd.apple.mpegurl"),
        );
        h.insert(
            HeaderName::from_static("cache-control"),
            HeaderValue::from_static("no-cache"),
        );
        h.insert(
            HeaderName::from_static("access-control-allow-origin"),
            HeaderValue::from_static("*"),
        );
        h.insert(
            HeaderName::from_static("access-control-expose-headers"),
            HeaderValue::from_static("Content-Length, Content-Range"),
        );
        h.insert(
            HeaderName::from_static("content-length"),
            HeaderValue::from_str(&bytes.len().to_string()).unwrap(),
        );
    }
    resp.body(Body::from(bytes))
        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "build").into_response())
}

fn binary_response(bytes: Vec<u8>, content_type: &'static str) -> Response {
    let mut resp = Response::builder().status(StatusCode::OK);
    if let Some(h) = resp.headers_mut() {
        h.insert(
            HeaderName::from_static("content-type"),
            HeaderValue::from_static(content_type),
        );
        h.insert(
            HeaderName::from_static("access-control-allow-origin"),
            HeaderValue::from_static("*"),
        );
        h.insert(
            HeaderName::from_static("access-control-expose-headers"),
            HeaderValue::from_static("Content-Length, Content-Range"),
        );
        h.insert(
            HeaderName::from_static("accept-ranges"),
            HeaderValue::from_static("bytes"),
        );
        h.insert(
            HeaderName::from_static("content-length"),
            HeaderValue::from_str(&bytes.len().to_string()).unwrap(),
        );
    }
    resp.body(Body::from(bytes))
        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "build").into_response())
}

fn clamp_resolution(w: u32, h: u32) -> (u32, u32) {
    if h <= 1080 {
        return (w, h);
    }
    let target_h = 1080u32;
    let target_w = ((w as f64) * (target_h as f64 / h as f64)).round() as u32 / 2 * 2;
    (target_w, target_h)
}

async fn probe_source(url: &str, headers: &HashMap<String, String>) -> Result<Probe, String> {
    let ffprobe =
        crate::transcode::locate_ffprobe().ok_or_else(|| "ffprobe not found".to_string())?;
    let mut cmd = tokio::process::Command::new(&ffprobe);
    cmd.arg("-v").arg("error");
    for (k, v) in headers {
        if k.to_lowercase() == "user-agent" {
            cmd.arg("-user_agent").arg(v);
        }
    }
    cmd.arg("-show_entries")
        .arg("stream=codec_name,codec_type,width,height,r_frame_rate,bit_rate:format=duration,bit_rate")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=0")
        .arg(url);
    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    cmd.kill_on_drop(true);
    let output = match tokio::time::timeout(PROBE_TIMEOUT, cmd.output()).await {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => return Err(format!("ffprobe spawn: {}", e)),
        Err(_) => return Err("ffprobe timed out".to_string()),
    };
    parse_probe_output(&String::from_utf8_lossy(&output.stdout))
}

fn parse_probe_output(stdout: &str) -> Result<Probe, String> {
    let mut probe = Probe {
        duration_sec: 0.0,
        video_codec: String::new(),
        audio_codec: String::new(),
        width: 1920,
        height: 1080,
        fps: 24.0,
        video_bitrate: 4_000_000,
    };
    let mut current_type: Option<String> = None;
    let mut pending_codec_name: Option<String> = None;
    for line in stdout.lines() {
        if let Some(v) = line.strip_prefix("codec_type=") {
            current_type = Some(v.trim().to_string());
            if let Some(name) = pending_codec_name.take() {
                match current_type.as_deref() {
                    Some("video") if probe.video_codec.is_empty() => probe.video_codec = name,
                    Some("audio") if probe.audio_codec.is_empty() => probe.audio_codec = name,
                    _ => {}
                }
            }
        } else if let Some(v) = line.strip_prefix("codec_name=") {
            let name = v.trim().to_lowercase();
            match current_type.as_deref() {
                Some("video") if probe.video_codec.is_empty() => probe.video_codec = name,
                Some("audio") if probe.audio_codec.is_empty() => probe.audio_codec = name,
                _ => pending_codec_name = Some(name),
            }
        } else if let Some(v) = line.strip_prefix("width=") {
            if current_type.as_deref() == Some("video") {
                if let Ok(n) = v.trim().parse::<u32>() {
                    probe.width = n;
                }
            }
        } else if let Some(v) = line.strip_prefix("height=") {
            if current_type.as_deref() == Some("video") {
                if let Ok(n) = v.trim().parse::<u32>() {
                    probe.height = n;
                }
            }
        } else if let Some(v) = line.strip_prefix("r_frame_rate=") {
            if current_type.as_deref() == Some("video") {
                if let Some((num, den)) = v.trim().split_once('/') {
                    if let (Ok(n), Ok(d)) = (num.parse::<f64>(), den.parse::<f64>()) {
                        if d > 0.0 {
                            probe.fps = n / d;
                        }
                    }
                }
            }
        } else if let Some(v) = line.strip_prefix("bit_rate=") {
            if current_type.as_deref() == Some("video") {
                if let Ok(n) = v.trim().parse::<u64>() {
                    if n > 0 {
                        probe.video_bitrate = n;
                    }
                }
            }
        } else if let Some(v) = line.strip_prefix("duration=") {
            if let Ok(n) = v.trim().parse::<f64>() {
                probe.duration_sec = n;
            }
        }
    }
    if probe.video_codec.is_empty() {
        return Err("no video stream found".to_string());
    }
    if probe.duration_sec <= 0.0 {
        return Err("no duration".to_string());
    }
    Ok(probe)
}

async fn spawn_continuous_ffmpeg(
    media_url: &str,
    headers: &HashMap<String, String>,
    seek_start: f64,
    _total_duration: f64,
    temp_dir: &std::path::Path,
    burn_sub: Option<(String, String)>,
) -> Result<Child, String> {
    let ffmpeg = crate::transcode::locate_ffmpeg().ok_or_else(|| "ffmpeg not found".to_string())?;
    let segment_pattern = temp_dir.join("seg%05d.ts");
    let playlist_path = temp_dir.join("playlist.m3u8");
    let mut vf = String::from(
        "scale='if(gt(ih,1080),min(1920,iw),iw)':'if(gt(ih,1080),1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
    );
    if let Some((path, force_style)) = burn_sub.as_ref() {
        vf.push(',');
        vf.push_str(&crate::cast_subs::burn_filter(path, force_style));
        eprintln!("[cast-hls] subtitle burn-in filter: {}", vf);
    }
    let mut cmd = tokio::process::Command::new(&ffmpeg);
    cmd.arg("-hide_banner")
        .arg("-loglevel")
        .arg("warning")
        .arg("-fflags")
        .arg("+genpts+discardcorrupt");
    apply_headers(&mut cmd, headers);
    cmd.arg("-ss")
        .arg(format!("{:.6}", seek_start))
        .arg("-i")
        .arg(media_url)
        .arg("-map")
        .arg("0:v:0")
        .arg("-map")
        .arg("0:a:0?")
        .arg("-map_metadata")
        .arg("-1")
        .arg("-map_chapters")
        .arg("-1")
        .arg("-c:v")
        .arg("libx264")
        .arg("-profile:v")
        .arg("high")
        .arg("-level")
        .arg("4.1")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-preset")
        .arg("veryfast")
        .arg("-crf")
        .arg("23")
        .arg("-g")
        .arg("144")
        .arg("-keyint_min")
        .arg("144")
        .arg("-sc_threshold")
        .arg("0")
        .arg("-x264-params")
        .arg("scenecut=0:open_gop=0")
        .arg("-c:a")
        .arg("aac")
        .arg("-ac")
        .arg("2")
        .arg("-b:a")
        .arg("192k")
        .arg("-vf")
        .arg(&vf)
        .arg("-f")
        .arg("hls")
        .arg("-hls_time")
        .arg("6")
        .arg("-hls_segment_type")
        .arg("mpegts")
        .arg("-hls_list_size")
        .arg("8")
        .arg("-hls_delete_threshold")
        .arg("2")
        .arg("-hls_flags")
        // A sliding playlist prevents long casts from retaining every segment.
        // Receivers may occasionally request a segment that has just expired.
        .arg("delete_segments+independent_segments+temp_file")
        .arg("-hls_segment_filename")
        .arg(&segment_pattern)
        .arg(&playlist_path);

    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }
    cmd.kill_on_drop(true)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("ffmpeg spawn: {}", e))?;
    eprintln!("[cast-hls] ffmpeg spawned for seek={seek_start:.1}");

    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if line.contains("error") || line.contains("Error") || line.contains("failed") {
                    eprintln!("[cast-hls][ffmpeg] {}", line);
                }
            }
        });
    }
    Ok(child)
}

fn apply_headers(cmd: &mut tokio::process::Command, headers: &HashMap<String, String>) {
    let mut has_ua = false;
    for (k, v) in headers {
        if k.to_lowercase() == "user-agent" {
            cmd.arg("-user_agent").arg(v);
            has_ua = true;
        }
    }
    if !has_ua {
        cmd.arg("-user_agent")
            .arg("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Harbor/0.8");
    }
    let mut blob = String::new();
    for (k, v) in headers {
        if k.to_lowercase() == "user-agent" {
            continue;
        }
        blob.push_str(&format!("{}: {}\r\n", k, v));
    }
    if !blob.is_empty() {
        cmd.arg("-headers").arg(blob);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ffprobe_fields_emitted_before_stream_type() {
        let output = "codec_name=h264\n\
codec_type=video\n\
width=1920\n\
height=1080\n\
r_frame_rate=24000/1001\n\
bit_rate=4000000\n\
codec_name=aac\n\
codec_type=audio\n\
bit_rate=192000\n\
duration=120.5\n";

        let probe = parse_probe_output(output).expect("parse ffprobe output");

        assert_eq!(probe.video_codec, "h264");
        assert_eq!(probe.audio_codec, "aac");
        assert_eq!(probe.width, 1920);
        assert_eq!(probe.height, 1080);
        assert!((probe.fps - (24_000.0 / 1_001.0)).abs() < f64::EPSILON);
        assert_eq!(probe.video_bitrate, 4_000_000);
        assert_eq!(probe.duration_sec, 120.5);
    }

    #[test]
    fn parses_ffprobe_stream_type_emitted_before_fields() {
        let output = "codec_type=video\n\
codec_name=h264\n\
width=1920\n\
height=1080\n\
r_frame_rate=24/1\n\
bit_rate=4000000\n\
codec_type=audio\n\
codec_name=aac\n\
duration=120.5\n";

        let probe = parse_probe_output(output).expect("parse ffprobe output");

        assert_eq!(probe.video_codec, "h264");
        assert_eq!(probe.audio_codec, "aac");
    }

    #[tokio::test]
    async fn stop_session_removes_the_session_and_its_temp_dir() {
        let state = HlsState::new();
        let id = Uuid::new_v4().to_string();
        let temp_dir = std::env::temp_dir().join(format!("harbor-hls-test-{id}"));
        std::fs::create_dir_all(&temp_dir).expect("create test HLS directory");
        std::fs::write(temp_dir.join("segment.ts"), b"segment").expect("write test segment");
        let session = Arc::new(HlsSession {
            probe: Probe {
                duration_sec: 1.0,
                video_codec: "h264".into(),
                audio_codec: "aac".into(),
                width: 1,
                height: 1,
                fps: 1.0,
                video_bitrate: 1,
            },
            temp_dir: temp_dir.clone(),
            last_access: std::sync::Mutex::new(Instant::now()),
            process: tokio::sync::Mutex::new(None),
        });
        state.sessions.write().await.insert(id.clone(), session);

        assert!(state.stop_session(&id).await);
        assert!(!temp_dir.exists());
        assert!(!state.stop_session(&id).await);
    }

    #[tokio::test]
    async fn stop_all_removes_every_session_and_is_idempotent() {
        let state = HlsState::new();
        let mut temp_dirs = Vec::new();
        for _ in 0..2 {
            let id = Uuid::new_v4().to_string();
            let temp_dir = std::env::temp_dir().join(format!("harbor-hls-test-{id}"));
            std::fs::create_dir_all(&temp_dir).expect("create test HLS directory");
            let session = Arc::new(HlsSession {
                probe: Probe {
                    duration_sec: 1.0,
                    video_codec: "h264".into(),
                    audio_codec: "aac".into(),
                    width: 1,
                    height: 1,
                    fps: 1.0,
                    video_bitrate: 1,
                },
                temp_dir: temp_dir.clone(),
                last_access: std::sync::Mutex::new(Instant::now()),
                process: tokio::sync::Mutex::new(None),
            });
            state.sessions.write().await.insert(id, session);
            temp_dirs.push(temp_dir);
        }

        assert_eq!(state.stop_all().await, 2);
        assert!(temp_dirs.iter().all(|path| !path.exists()));
        assert_eq!(state.stop_all().await, 0);
    }
}
