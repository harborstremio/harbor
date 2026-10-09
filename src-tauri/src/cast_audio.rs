//! Bounded audio-only cast streams. Decoding stays local; the renderer receives a supported codec.
use axum::{
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use futures_util::stream;
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    io::AsyncReadExt,
    process::{Child, ChildStdout},
    sync::{watch, Mutex, RwLock, Semaphore},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum AudioCastFormat {
    Mp3,
}
impl AudioCastFormat {
    pub fn mime(self) -> &'static str {
        match self {
            Self::Mp3 => "audio/mpeg",
        }
    }
}

#[derive(Clone)]
pub(crate) struct AudioCastInput {
    pub url: String,
    pub headers: HashMap<String, String>,
    pub audio_ordinal: u32,
    pub start_seconds: f64,
    pub format: AudioCastFormat,
    pub title: Option<String>,
    pub target_host: String,
}

struct Prepared {
    child: Child,
    stdout: ChildStdout,
    prefix: Vec<u8>,
}
struct AudioSession {
    input: AudioCastInput,
    prepared: Mutex<Option<Prepared>>,
    cancel: watch::Sender<bool>,
    created: Instant,
    readers: Arc<Semaphore>,
}

#[derive(Clone, Default)]
pub(crate) struct AudioCastState {
    sessions: Arc<RwLock<HashMap<String, Arc<AudioSession>>>>,
}
impl AudioCastState {
    pub async fn register(&self, input: AudioCastInput) -> Result<String, String> {
        if !input.start_seconds.is_finite()
            || input.start_seconds < 0.0
            || input.audio_ordinal > 127
        {
            return Err("Invalid audio cast position or track".into());
        }
        let prepared = prepare(&input).await?;
        let id = format!("audio-{}", uuid::Uuid::new_v4());
        let (cancel, _) = watch::channel(false);
        let mut sessions = self.sessions.write().await;
        // Keep at most four routes, including an in-flight replacement. Drop kills prepared children.
        if sessions.len() >= 4 {
            if let Some(oldest) = sessions
                .iter()
                .min_by_key(|(_, value)| value.created)
                .map(|(id, _)| id.clone())
            {
                if let Some(old) = sessions.remove(&oldest) {
                    old.cancel.send_replace(true);
                }
            }
        }
        sessions.insert(
            id.clone(),
            Arc::new(AudioSession {
                input,
                prepared: Mutex::new(Some(prepared)),
                cancel,
                created: Instant::now(),
                readers: Arc::new(Semaphore::new(2)),
            }),
        );
        Ok(id)
    }

    pub async fn input(&self, id: &str) -> Option<AudioCastInput> {
        self.sessions
            .read()
            .await
            .get(id)
            .map(|session| session.input.clone())
    }
    pub async fn stop(&self, id: &str) -> bool {
        if let Some(session) = self.sessions.write().await.remove(id) {
            session.cancel.send_replace(true);
            session.prepared.lock().await.take();
            true
        } else {
            false
        }
    }
    pub async fn stop_all(&self) {
        let ids: Vec<String> = self.sessions.read().await.keys().cloned().collect();
        for id in ids {
            self.stop(&id).await;
        }
    }
    pub async fn gc(&self) -> usize {
        let ids: Vec<String> = self
            .sessions
            .read()
            .await
            .iter()
            .filter(|(_, s)| s.created.elapsed() > Duration::from_secs(6 * 60 * 60) && s.readers.available_permits() == 2)
            .map(|(id, _)| id.clone())
            .collect();
        for id in &ids {
            self.stop(id).await;
        }
        ids.len()
    }
    pub fn router(self) -> Router {
        Router::new()
            .route("/cast/audio/{id}", get(handle).head(handle))
            .with_state(self)
    }
}

fn encoder_args(input: &AudioCastInput) -> Result<Vec<String>, String> {
    if input.url.is_empty() || input.url.contains('\0') {
        return Err("Invalid audio cast source".into());
    }
    let mut args: Vec<String> = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-rw_timeout",
        "10000000",
    ]
    .into_iter()
    .map(str::to_string)
    .collect();
    let mut headers = String::new();
    if input.headers.len() > 64
        || input
            .headers
            .iter()
            .map(|(key, value)| key.len() + value.len())
            .sum::<usize>()
            > 32 * 1024
    {
        return Err("Audio cast request headers are too large".into());
    }
    for (name, value) in &input.headers {
        if name.is_empty()
            || !name
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"!#$%&'*+-.^_`|~".contains(&b))
            || value.contains(['\r', '\n', '\0'])
        {
            return Err("Invalid audio cast request headers".into());
        }
        if name.eq_ignore_ascii_case("accept-encoding") {
            continue;
        }
        if name.eq_ignore_ascii_case("user-agent") {
            args.extend(["-user_agent".into(), value.clone()]);
        } else {
            headers.push_str(&format!("{name}: {value}\r\n"));
        }
    }
    if !headers.is_empty() {
        args.extend(["-headers".into(), headers]);
    }
    if input.start_seconds > 0.0 {
        args.extend(["-ss".into(), input.start_seconds.to_string()]);
    }
    args.extend([
        "-i".into(),
        input.url.clone(),
        "-map".into(),
        format!("0:a:{}", input.audio_ordinal),
    ]);
    args.extend(
        ["-vn", "-sn", "-dn", "-ac", "2", "-ar", "48000"]
            .into_iter()
            .map(str::to_string),
    );
    match input.format {
        AudioCastFormat::Mp3 => args.extend(
            [
                "-c:a",
                "libmp3lame",
                "-b:a",
                "320k",
                "-write_xing",
                "0",
                "-f",
                "mp3",
            ]
            .into_iter()
            .map(str::to_string),
        ),
    }
    args.push("pipe:1".into());
    Ok(args)
}

async fn prepare(input: &AudioCastInput) -> Result<Prepared, String> {
    let ffmpeg = tokio::task::spawn_blocking(crate::transcode::locate_ffmpeg)
        .await
        .map_err(|_| "Audio conversion is unavailable")?
        .ok_or("Audio conversion requires FFmpeg")?;
    let mut command = tokio::process::Command::new(ffmpeg);
    command
        .args(encoder_args(input)?)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        command.creation_flags(0x0800_0000);
    }
    let mut child = command
        .spawn()
        .map_err(|_| "Could not start speaker audio conversion")?;
    let mut stdout = child
        .stdout
        .take()
        .ok_or("Speaker audio stream is unavailable")?;
    // Prewarm decoded frames, not just a container header, before the receiver's short startup deadline.
    let mut prefix = vec![0; 64 * 1024];
    let length = tokio::time::timeout(Duration::from_secs(20), async {
        let mut length = 0;
        while length < prefix.len() {
            let read = stdout.read(&mut prefix[length..]).await?;
            if read == 0 {
                break;
            }
            length += read;
        }
        Ok::<usize, std::io::Error>(length)
    })
    .await
    .map_err(|_| "Speaker audio conversion timed out")?
    .map_err(|_| "Speaker audio stream could not be read")?;
    if length == 0 {
        return Err("Speaker audio could not be decoded from this source".into());
    }
    prefix.truncate(length);
    Ok(Prepared {
        child,
        stdout,
        prefix,
    })
}

async fn handle(
    State(state): State<AudioCastState>,
    Path(id): Path<String>,
    method: Method,
    headers: HeaderMap,
) -> Response {
    let Some(session) = state.sessions.read().await.get(&id).cloned() else {
        return (StatusCode::NOT_FOUND, "Audio route ended").into_response();
    };
    if *session.cancel.borrow() {
        return StatusCode::GONE.into_response();
    }
    // Source-time seek creates a fresh route. Byte offsets have no meaning for a live encoder.
    if headers
        .get("range")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value != "bytes=0-")
    {
        return StatusCode::RANGE_NOT_SATISFIABLE.into_response();
    }
    let response_headers = [
        ("Content-Type", session.input.format.mime()),
        ("Cache-Control", "no-store"),
        ("Accept-Ranges", "none"),
        ("transferMode.dlna.org", "Streaming"),
    ];
    if method == Method::HEAD {
        return (response_headers, Body::empty()).into_response();
    }
    let Ok(permit) = session.readers.clone().try_acquire_owned() else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    let cached = session.prepared.lock().await.take();
    let prepared = match cached {
        Some(value) => Ok(value),
        None => prepare(&session.input).await,
    };
    let prepared = match prepared {
        Ok(value) => value,
        Err(error) => return (StatusCode::BAD_GATEWAY, error).into_response(),
    };
    let cancel = session.cancel.subscribe();
    let body = stream::unfold(
        (prepared, cancel, false, permit),
        |(mut prepared, mut cancel, started, permit)| async move {
            if *cancel.borrow() {
                return None;
            }
            if !started {
                let prefix = std::mem::take(&mut prepared.prefix);
                return Some((
                    Ok::<Vec<u8>, std::io::Error>(prefix),
                    (prepared, cancel, true, permit),
                ));
            }
            let mut bytes = vec![0; 32 * 1024];
            let read = tokio::select! { _ = cancel.changed() => return None, read = prepared.stdout.read(&mut bytes) => read };
            match read {
                Ok(0) => {
                    let _ = prepared.child.wait().await;
                    None
                }
                Ok(length) => {
                    bytes.truncate(length);
                    Some((Ok(bytes), (prepared, cancel, true, permit)))
                }
                Err(_) => None,
            }
        },
    );
    (response_headers, Body::from_stream(body)).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn audio_encoder_preserves_headers_maps_selected_audio_and_never_builds_video() {
        let input = AudioCastInput {
            url: "https://example.test/movie".into(),
            headers: HashMap::from([
                ("User-Agent".into(), "Actual source agent".into()),
                ("Referer".into(), "https://example.test/".into()),
            ]),
            audio_ordinal: 2,
            start_seconds: 123.5,
            format: AudioCastFormat::Mp3,
            title: None,
            target_host: "192.0.2.1".into(),
        };
        let args = encoder_args(&input).unwrap();
        assert!(args.windows(2).any(|pair| pair == ["-map", "0:a:2"]));
        assert!(args.windows(2).any(|pair| pair == ["-ss", "123.5"]));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["-user_agent", "Actual source agent"]));
        assert!(args
            .iter()
            .any(|arg| arg == "Referer: https://example.test/\r\n"));
        assert!(args.contains(&"-vn".into()));
        assert!(!args.contains(&"mpegts".into()));
        assert!(args.windows(2).any(|pair| pair == ["-c:a", "libmp3lame"]));
        assert!(args.windows(2).any(|pair| pair == ["-b:a", "320k"]));
        let mut invalid = input;
        invalid
            .headers
            .insert("X-Test".into(), "value\r\nInjected: bad".into());
        assert!(encoder_args(&invalid).is_err());
    }
}
