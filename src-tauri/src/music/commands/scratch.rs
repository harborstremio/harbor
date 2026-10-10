use super::super::{MusicState, ACTIVE_STREAM};

const MAX_SECONDS: f64 = 40.0;

#[tauri::command]
pub async fn music_scratch_window(
    state: tauri::State<'_, MusicState>,
    start: f64,
    seconds: f64,
    rate: u32,
) -> Result<tauri::ipc::Response, String> {
    if state.active_engine() != ACTIVE_STREAM {
        return Err("music.scratch.unsupported".to_string());
    }
    if !start.is_finite() || !seconds.is_finite() || seconds <= 0.0 {
        return Err("music.scratch.range".to_string());
    }
    let rate = rate.clamp(8000, 192_000);
    let span = seconds.min(MAX_SECONDS);
    let from = start.max(0.0);
    let Some(source) = state.engine.source_path().await else {
        return Err("music.scratch.noSource".to_string());
    };
    let Some(ffmpeg) = crate::transcode::locate_ffmpeg() else {
        return Err("music.download.noFfmpeg".to_string());
    };

    let mut command = tokio::process::Command::new(&ffmpeg);
    command
        .args(["-hide_banner", "-loglevel", "error", "-nostdin"])
        .arg("-ss")
        .arg(format!("{from:.3}"))
        .arg("-i")
        .arg(&source)
        .arg("-t")
        .arg(format!("{span:.3}"))
        .args(["-vn", "-ac", "2", "-ar"])
        .arg(rate.to_string())
        .args(["-f", "f32le", "-"])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        command.creation_flags(0x0800_0000);
    }

    let output = command
        .output()
        .await
        .map_err(|error| format!("ffmpeg: {error}"))?;
    if !output.status.success() || output.stdout.is_empty() {
        return Err("music.scratch.decodeFailed".to_string());
    }
    Ok(tauri::ipc::Response::new(output.stdout))
}

#[tauri::command]
pub async fn music_scratch_hold(
    state: tauri::State<'_, MusicState>,
    active: bool,
    position: Option<f64>,
) -> Result<(), String> {
    if state.active_engine() != ACTIVE_STREAM {
        return Ok(());
    }
    let mut landed = Ok(());
    if !active {
        if let Some(target) = position.filter(|value| value.is_finite()) {
            landed = state.engine.seek(target.max(0.0)).await;
        }
    }
    state.engine.set_muted(active).await?;
    landed
}
