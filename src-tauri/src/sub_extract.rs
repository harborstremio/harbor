use std::collections::HashMap;
use std::time::Duration;

const EXTRACT_TIMEOUT: Duration = Duration::from_secs(90);
const MAX_SRT_BYTES: usize = 4 * 1024 * 1024;

#[tauri::command]
pub async fn subtitle_extract(
    source: String,
    stream_index: Option<u32>,
    headers: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let ffmpeg = crate::transcode::locate_ffmpeg().ok_or_else(|| "ffmpeg not found".to_string())?;
    let map = format!("0:s:{}", stream_index.unwrap_or(0));
    let mut cmd = tokio::process::Command::new(&ffmpeg);
    cmd.arg("-nostdin").arg("-loglevel").arg("error");
    if let Some(h) = &headers {
        if let Some(ua) = h.get("User-Agent").or_else(|| h.get("user-agent")) {
            cmd.arg("-user_agent").arg(ua);
        }
    }
    cmd.arg("-i")
        .arg(&source)
        .arg("-map")
        .arg(&map)
        .arg("-f")
        .arg("srt")
        .arg("-");
    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    let output = match tokio::time::timeout(EXTRACT_TIMEOUT, cmd.output()).await {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => return Err(format!("ffmpeg spawn: {}", e)),
        Err(_) => return Err("subtitle extraction timed out".to_string()),
    };
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "ffmpeg failed: {}",
            err.chars().take(200).collect::<String>()
        ));
    }
    let mut bytes = output.stdout;
    if bytes.len() > MAX_SRT_BYTES {
        bytes.truncate(MAX_SRT_BYTES);
    }
    let text = String::from_utf8_lossy(&bytes).to_string();
    if text.trim().is_empty() {
        return Err("no subtitle content extracted".to_string());
    }
    Ok(text)
}

const ASS_HEADER_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_ASS_BYTES: usize = 2 * 1024 * 1024;

#[tauri::command]
pub async fn subtitle_extract_ass(
    source: String,
    stream_index: Option<u32>,
    headers: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let ffmpeg = crate::transcode::locate_ffmpeg().ok_or_else(|| "ffmpeg not found".to_string())?;
    let map = format!("0:s:{}", stream_index.unwrap_or(0));
    let mut cmd = tokio::process::Command::new(&ffmpeg);
    cmd.arg("-nostdin").arg("-loglevel").arg("error");
    if let Some(h) = &headers {
        if let Some(ua) = h.get("User-Agent").or_else(|| h.get("user-agent")) {
            cmd.arg("-user_agent").arg(ua);
        }
    }
    cmd.arg("-i")
        .arg(&source)
        .arg("-map")
        .arg(&map)
        .arg("-c:s")
        .arg("copy")
        .arg("-f")
        .arg("ass")
        .arg("-");
    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    let output = match tokio::time::timeout(ASS_HEADER_TIMEOUT, cmd.output()).await {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => return Err(format!("ffmpeg spawn: {}", e)),
        Err(_) => return Err("ass header extraction timed out".to_string()),
    };
    let mut bytes = output.stdout;
    if bytes.len() > MAX_ASS_BYTES {
        bytes.truncate(MAX_ASS_BYTES);
    }
    let text = String::from_utf8_lossy(&bytes).to_string();
    if text.contains("[V4+ Styles]") || text.contains("[V4 Styles]") {
        return Ok(text);
    }
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "ffmpeg failed: {}",
            err.chars().take(200).collect::<String>()
        ));
    }
    Err("no ass header extracted".to_string())
}
