use axum::body::Body;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Clone, Debug, Deserialize)]
pub struct TranscodeProfile {
    #[serde(default = "default_max_height")]
    pub max_height: u32,
    #[serde(default)]
    pub force_h264: bool,
    #[serde(default)]
    pub force_aac: bool,
    #[serde(default)]
    pub force_stereo: bool,
    #[serde(default)]
    pub max_video_kbps: Option<u32>,
}

impl Default for TranscodeProfile {
    fn default() -> Self {
        TranscodeProfile {
            max_height: 1080,
            force_h264: true,
            force_aac: true,
            force_stereo: true,
            max_video_kbps: Some(6000),
        }
    }
}

fn default_max_height() -> u32 {
    1080
}

pub fn locate_ffmpeg() -> Option<std::path::PathBuf> {
    let mut owned: Vec<String> = Vec::new();
    if cfg!(windows) {
        owned.push("ffmpeg.exe".into());
        owned.push("ffmpeg".into());
        // Bundled / dev tree relative to harbor.exe
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                owned.push(dir.join("ffmpeg.exe").to_string_lossy().to_string());
                owned.push(
                    dir.join(r"..\binaries\ffmpeg.exe")
                        .to_string_lossy()
                        .to_string(),
                );
                owned.push(
                    dir.join(r"..\..\binaries\ffmpeg.exe")
                        .to_string_lossy()
                        .to_string(),
                );
                owned.push(
                    dir.join(r"..\..\..\binaries\ffmpeg.exe")
                        .to_string_lossy()
                        .to_string(),
                );
            }
        }
        // Dev tree relative to cwd
        owned.push(r"src-tauri\binaries\ffmpeg.exe".into());
        owned.push(r"binaries\ffmpeg.exe".into());
        // Common manual installs
        for base in [
            r"C:\ffmpeg\bin",
            r"C:\Program Files\ffmpeg\bin",
            r"C:\Program Files (x86)\ffmpeg\bin",
        ] {
            owned.push(format!(r"{base}\ffmpeg.exe"));
        }
        // Chocolatey
        owned.push(r"C:\ProgramData\chocolatey\bin\ffmpeg.exe".into());
        // Scoop (per-user)
        if let Some(home) = std::env::var_os("USERPROFILE") {
            let h = std::path::PathBuf::from(home);
            owned.push(
                h.join(r"scoop\shims\ffmpeg.exe")
                    .to_string_lossy()
                    .to_string(),
            );
            owned.push(
                h.join(r"scoop\apps\ffmpeg\current\bin\ffmpeg.exe")
                    .to_string_lossy()
                    .to_string(),
            );
        }
        // WinGet — installs under %LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\ffmpeg-*-essentials_build\bin
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            let winget = std::path::PathBuf::from(&local).join(r"Microsoft\WinGet\Packages");
            if let Ok(entries) = std::fs::read_dir(&winget) {
                for e in entries.flatten() {
                    if e.file_name()
                        .to_string_lossy()
                        .to_lowercase()
                        .contains("ffmpeg")
                    {
                        if let Ok(subs) = std::fs::read_dir(e.path()) {
                            for s in subs.flatten() {
                                let candidate = s.path().join(r"bin\ffmpeg.exe");
                                if candidate.is_file() {
                                    owned.push(candidate.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    } else if cfg!(target_os = "macos") {
        for p in [
            "/opt/homebrew/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
            "/opt/local/bin/ffmpeg",
            "ffmpeg",
        ] {
            owned.push(p.into());
        }
    } else {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                owned.push(dir.join("ffmpeg").to_string_lossy().to_string());
                owned.push(
                    dir.join("ffmpeg-x86_64-unknown-linux-gnu")
                        .to_string_lossy()
                        .to_string(),
                );
            }
        }
        for path in crate::binary_lookup::linux_binary_candidates("ffmpeg") {
            owned.push(path.to_string_lossy().into_owned());
        }
    }
    let candidates: Vec<&str> = owned.iter().map(|s| s.as_str()).collect();
    // First pass: try to execute and parse `-version`. Works when PATH+exec
    // permissions are normal.
    for c in &candidates {
        let p = std::path::PathBuf::from(*c);
        let mut cmd = std::process::Command::new(&p);
        cmd.arg("-version");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000);
        }
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                return Some(p);
            }
        }
    }
    // Fallback: if the binary exists at a known absolute path and is executable,
    // trust it. Mac apps launched via `open` don't inherit a shell PATH and
    // sometimes can't exec arbitrary binaries to probe them, but ffmpeg will
    // still run fine when actually invoked by the proxy.
    for c in &candidates {
        if !c.starts_with('/') {
            continue;
        }
        let p = std::path::PathBuf::from(*c);
        if !p.exists() {
            continue;
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(meta) = std::fs::metadata(&p) {
                if meta.permissions().mode() & 0o111 != 0 {
                    eprintln!("[harbor::transcode] ffmpeg execution probe failed but file exists at {p:?} — trusting it");
                    return Some(p);
                }
            }
        }
        #[cfg(not(unix))]
        {
            return Some(p);
        }
    }
    None
}

pub fn ffmpeg_present() -> bool {
    locate_ffmpeg().is_some()
}

pub fn locate_ffprobe() -> Option<std::path::PathBuf> {
    let name = if cfg!(windows) {
        "ffprobe.exe"
    } else {
        "ffprobe"
    };
    if let Some(ffmpeg) = locate_ffmpeg() {
        if let Some(parent) = ffmpeg.parent() {
            let candidate = parent.join(name);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    let mut cmd = std::process::Command::new(name);
    cmd.arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    if matches!(cmd.status(), Ok(s) if s.success()) {
        return Some(std::path::PathBuf::from(name));
    }
    None
}

#[derive(Default, Debug, Clone)]
pub struct ProbedCodecs {
    pub video: Option<String>,
    pub audio: Option<String>,
}

pub async fn probe_codecs(url: &str, headers: &HashMap<String, String>) -> ProbedCodecs {
    let Some(ffprobe) = locate_ffprobe() else {
        eprintln!("[harbor::transcode] ffprobe not found, skipping codec probe");
        return ProbedCodecs::default();
    };
    let mut cmd = tokio::process::Command::new(&ffprobe);
    cmd.arg("-v").arg("error");
    let mut has_ua = false;
    if let Some((_, ua)) = headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "user-agent")
    {
        cmd.arg("-user_agent").arg(ua);
        has_ua = true;
    }
    if !has_ua {
        cmd.arg("-user_agent").arg(default_ua());
    }
    let mut header_blob = String::new();
    for (k, v) in headers {
        if k.to_lowercase() == "user-agent" {
            continue;
        }
        header_blob.push_str(&format!("{}: {}\r\n", k, v));
    }
    if !header_blob.is_empty() {
        cmd.arg("-headers").arg(header_blob);
    }
    cmd.arg("-analyzeduration")
        .arg("8M")
        .arg("-probesize")
        .arg("8M")
        .arg("-show_entries")
        .arg("stream=codec_name,codec_type")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=0")
        .arg(url);
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);

    let fut = async {
        let output =
            crate::process::output_with_timeout(&mut cmd, std::time::Duration::from_secs(12))
                .await
                .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.trim().is_empty() {
            eprintln!("[harbor::transcode][ffprobe] {}", stderr.trim());
        }
        let mut result = ProbedCodecs::default();
        let mut cur_type: Option<String> = None;
        let mut cur_codec: Option<String> = None;
        for line in stdout.lines() {
            if let Some(v) = line.strip_prefix("codec_name=") {
                cur_codec = Some(v.trim().to_lowercase());
            } else if let Some(t) = line.strip_prefix("codec_type=") {
                cur_type = Some(t.trim().to_lowercase());
            }
            if let (Some(t), Some(c)) = (&cur_type, &cur_codec) {
                match t.as_str() {
                    "video" if result.video.is_none() => result.video = Some(c.clone()),
                    "audio" if result.audio.is_none() => result.audio = Some(c.clone()),
                    _ => {}
                }
                cur_type = None;
                cur_codec = None;
            }
        }
        Some(result)
    };

    fut.await.unwrap_or_default()
}

fn default_ua() -> &'static str {
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

fn relay_child_stdout(
    mut child: tokio::process::Child,
    mut stdout: tokio::process::ChildStdout,
) -> tokio::sync::mpsc::Receiver<Result<axum::body::Bytes, std::io::Error>> {
    let (body_tx, body_rx) = tokio::sync::mpsc::channel(8);
    tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut buffer = vec![0_u8; 64 * 1024];
        loop {
            let read_result = tokio::select! {
                biased;
                _ = body_tx.closed() => {
                    let _ = child.kill().await;
                    let _ = child.wait().await;
                    eprintln!("[harbor::transcode] client disconnected; ffmpeg stopped");
                    return;
                }
                result = stdout.read(&mut buffer) => result,
            };
            match read_result {
                Ok(0) => break,
                Ok(read) => {
                    let bytes = axum::body::Bytes::copy_from_slice(&buffer[..read]);
                    if body_tx.send(Ok(bytes)).await.is_err() {
                        let _ = child.kill().await;
                        eprintln!("[harbor::transcode] client disconnected; ffmpeg stopped");
                        return;
                    }
                }
                Err(error) => {
                    let _ = body_tx.send(Err(error)).await;
                    let _ = child.kill().await;
                    return;
                }
            }
        }
        match child.wait().await {
            Ok(status) => eprintln!("[harbor::transcode] ffmpeg exited: {status}"),
            Err(error) => eprintln!("[harbor::transcode] ffmpeg wait err: {error}"),
        }
    });
    body_rx
}

#[cfg(test)]
mod relay_tests {
    use super::*;

    #[cfg(unix)]
    #[tokio::test]
    async fn dropping_response_stops_stalled_transcoder() {
        let mut command = tokio::process::Command::new("sh");
        command
            .arg("-c")
            .arg("sleep 30")
            .stdout(std::process::Stdio::piped());
        let mut child = command.spawn().expect("spawn stalled child");
        let pid = child.id().expect("child pid") as i32;
        let stdout = child.stdout.take().expect("child stdout");
        let response = relay_child_stdout(child, stdout);
        drop(response);

        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            loop {
                let alive = unsafe { libc::kill(pid, 0) } == 0;
                if !alive {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("stalled child should be killed when response is dropped");
    }
}

fn scale_filter(max_height: u32) -> String {
    let target_w = match max_height {
        720 => 1280,
        2160 => 3840,
        _ => 1920,
    };
    let target_h = max_height;
    format!(
        "scale='if(gt(ih,{h}),min({w},iw),iw)':'if(gt(ih,{h}),{h},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
        w = target_w,
        h = target_h,
    )
}

pub async fn handle_transcode(
    url: &str,
    headers: &HashMap<String, String>,
    profile: &TranscodeProfile,
    burn_sub: Option<&(String, String)>,
) -> Response {
    let ffmpeg = match locate_ffmpeg() {
        Some(p) => p,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "ffmpeg not found. Install ffmpeg to transcode for this device.",
            )
                .into_response();
        }
    };

    let probed = probe_codecs(url, headers).await;
    eprintln!(
        "[harbor::transcode] probed: video={:?} audio={:?}",
        probed.video, probed.audio
    );

    let video_is_h264 = probed.video.as_deref() == Some("h264");
    let audio_is_aac = probed.audio.as_deref() == Some("aac");
    let reencode_video = profile.force_h264 || !video_is_h264 || burn_sub.is_some();
    let reencode_audio = profile.force_aac || !audio_is_aac;
    eprintln!(
        "[harbor::transcode] plan: reencode_video={} reencode_audio={}",
        reencode_video, reencode_audio
    );

    let mut cmd = tokio::process::Command::new(&ffmpeg);
    cmd.arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-fflags")
        .arg("+genpts+nobuffer+discardcorrupt")
        .arg("-flags")
        .arg("low_delay")
        .arg("-reconnect")
        .arg("1")
        .arg("-reconnect_streamed")
        .arg("1")
        .arg("-reconnect_on_network_error")
        .arg("1")
        .arg("-reconnect_on_http_error")
        .arg("5xx,4xx")
        .arg("-reconnect_delay_max")
        .arg("8");

    let mut has_ua = false;
    if let Some((_, ua)) = headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "user-agent")
    {
        cmd.arg("-user_agent").arg(ua);
        has_ua = true;
    }
    if !has_ua {
        cmd.arg("-user_agent").arg(default_ua());
    }
    let mut header_blob = String::new();
    for (k, v) in headers {
        if k.to_lowercase() == "user-agent" {
            continue;
        }
        header_blob.push_str(&format!("{}: {}\r\n", k, v));
    }
    if !header_blob.is_empty() {
        cmd.arg("-headers").arg(header_blob);
    }

    cmd.arg("-analyzeduration")
        .arg("8M")
        .arg("-probesize")
        .arg("8M")
        .arg("-i")
        .arg(url)
        .arg("-map")
        .arg("0:v?")
        .arg("-map")
        .arg("0:a?");

    if reencode_video {
        let mut vf = scale_filter(profile.max_height);
        if let Some((path, force_style)) = burn_sub {
            vf.push(',');
            vf.push_str(&crate::cast_subs::burn_filter(path, force_style));
            eprintln!("[harbor::transcode] subtitle burn-in filter: {}", vf);
        }
        cmd.arg("-c:v")
            .arg("libx264")
            .arg("-preset")
            .arg("veryfast")
            .arg("-crf")
            .arg("22")
            .arg("-profile:v")
            .arg("high")
            .arg("-level")
            .arg("4.1")
            .arg("-pix_fmt")
            .arg("yuv420p")
            .arg("-g")
            .arg("60")
            .arg("-sc_threshold")
            .arg("0")
            .arg("-vf")
            .arg(&vf);
        if let Some(kbps) = profile.max_video_kbps {
            cmd.arg("-maxrate")
                .arg(format!("{}k", kbps))
                .arg("-bufsize")
                .arg(format!("{}k", kbps * 2));
        }
    } else {
        cmd.arg("-c:v")
            .arg("copy")
            .arg("-bsf:v")
            .arg("h264_mp4toannexb");
    }

    if reencode_audio {
        cmd.arg("-c:a").arg("aac").arg("-b:a").arg("192k");
        if profile.force_stereo {
            cmd.arg("-ac").arg("2");
        }
    } else {
        cmd.arg("-c:a").arg("copy");
    }

    cmd.arg("-f")
        .arg("mpegts")
        .arg("-mpegts_flags")
        .arg("+resend_headers+initial_discontinuity")
        .arg("-mpegts_copyts")
        .arg("1")
        .arg("pipe:1");

    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);

    // Log the full command so we can debug what ffmpeg is being asked to do.
    let args_dbg: Vec<String> = cmd
        .as_std()
        .get_args()
        .map(|a| a.to_string_lossy().to_string())
        .collect();
    eprintln!(
        "[harbor::transcode] spawning: {:?} {}",
        ffmpeg,
        args_dbg.join(" ")
    );

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[harbor::transcode] spawn failed: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("ffmpeg spawn failed: {}", e),
            )
                .into_response();
        }
    };

    let stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            let _ = child.kill().await;
            return (StatusCode::INTERNAL_SERVER_ERROR, "ffmpeg stdout missing").into_response();
        }
    };

    // Drain ffmpeg's stderr line-by-line so users see what's happening / what
    // went wrong. Crucial for diagnosing "video doesn't appear" on the cast device.
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                eprintln!("[harbor::transcode][ffmpeg] {line}");
            }
        });
    }

    let body_rx = relay_child_stdout(child, stdout);

    let body_stream = futures_util::stream::unfold(body_rx, |mut receiver| async move {
        receiver.recv().await.map(|item| (item, receiver))
    });
    let body = Body::from_stream(body_stream);

    let mut hmap = HeaderMap::new();
    hmap.insert("Content-Type", HeaderValue::from_static("video/mp2t"));
    hmap.insert("Cache-Control", HeaderValue::from_static("no-cache"));
    hmap.insert("Connection", HeaderValue::from_static("close"));
    hmap.insert(
        "transferMode.dlna.org",
        HeaderValue::from_static("Streaming"),
    );
    hmap.insert(
        "contentFeatures.dlna.org",
        HeaderValue::from_static(
            "DLNA.ORG_PN=MPEG_TS;DLNA.ORG_OP=00;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000",
        ),
    );

    let mut resp = Response::builder().status(StatusCode::OK);
    if let Some(h) = resp.headers_mut() {
        h.extend(hmap);
    }
    resp.body(body).unwrap_or_else(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, "response build failed").into_response()
    })
}

#[cfg(test)]
mod tests {
    #[cfg(unix)]
    #[tokio::test]
    async fn dropping_stream_receiver_stops_and_reaps_child() {
        use super::relay_child_stdout;
        use std::process::Stdio;

        let mut command = tokio::process::Command::new("sh");
        command
            .arg("-c")
            .arg("while :; do printf xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx; done")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        let mut child = command.spawn().expect("spawn producer");
        let pid = child.id().expect("child pid") as i32;
        let stdout = child.stdout.take().expect("child stdout");
        let mut receiver = relay_child_stdout(child, stdout);
        receiver
            .recv()
            .await
            .expect("first output")
            .expect("read output");
        drop(receiver);

        tokio::time::timeout(std::time::Duration::from_secs(2), async {
            loop {
                if unsafe { libc::kill(pid, 0) } == -1 {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("child must be killed and reaped");
    }
}

#[tauri::command]
pub fn cast_ffmpeg_present() -> bool {
    ffmpeg_present()
}
