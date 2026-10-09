use super::super::{audio::MusicAudioSettings, MusicState};

#[tauri::command]
pub async fn music_audio_devices(
    state: tauri::State<'_, MusicState>,
) -> Result<Vec<crate::mpv::AudioDevice>, String> {
    state.engine.audio_devices().await
}

#[tauri::command]
pub fn music_audio_settings_get(
    state: tauri::State<'_, MusicState>,
) -> Result<MusicAudioSettings, String> {
    state.engine.audio_settings()
}

#[tauri::command]
pub async fn music_audio_settings_set(
    state: tauri::State<'_, MusicState>,
    settings: MusicAudioSettings,
) -> Result<MusicAudioSettings, String> {
    state.engine.set_audio_settings(settings).await
}

#[tauri::command]
pub async fn music_audio_meter_set_enabled(
    state: tauri::State<'_, MusicState>,
    enabled: bool,
) -> Result<(), String> {
    state.engine.set_meter_enabled(enabled).await
}

#[tauri::command]
pub async fn music_audio_meter_snapshot(
    state: tauri::State<'_, MusicState>,
) -> Result<Option<super::super::engine::MusicMeterSnapshot>, String> {
    Ok(state.engine.meter_snapshot().await)
}

#[tauri::command]
pub async fn music_broadcast_targets(
    state: tauri::State<'_, MusicState>,
) -> Result<super::super::engine::BroadcastTargets, String> {
    state.engine.broadcast_targets().await
}

#[tauri::command]
pub async fn music_broadcast_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    device: Option<String>,
) -> Result<super::super::engine::BroadcastStatus, String> {
    state.engine.start_broadcast(app, device).await
}

#[tauri::command]
pub async fn music_broadcast_stop(
    state: tauri::State<'_, MusicState>,
) -> Result<super::super::engine::BroadcastStatus, String> {
    state.engine.stop_broadcast().await
}

#[tauri::command]
pub async fn music_broadcast_status(
    state: tauri::State<'_, MusicState>,
) -> Result<super::super::engine::BroadcastStatus, String> {
    Ok(state.engine.broadcast_status().await)
}

#[tauri::command]
pub async fn music_export_filtered(
    state: tauri::State<'_, MusicState>,
    path: String,
) -> Result<bool, String> {
    let settings = state.engine.audio_settings()?;
    let chain = super::super::audio::export_filter_chain(&settings);
    if chain.is_empty() {
        return Ok(false);
    }
    let Some(ffmpeg) = crate::transcode::locate_ffmpeg() else {
        return Err("music.download.noFfmpeg".to_string());
    };
    let source = std::path::PathBuf::from(&path);
    if !source.is_file() {
        return Err("music.download.missing".to_string());
    }
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("m4a")
        .to_string();
    let target = source.with_extension(format!("filtered.{extension}"));
    let status = tokio::process::Command::new(&ffmpeg)
        .args(["-hide_banner", "-loglevel", "error", "-y", "-i"])
        .arg(&source)
        .args(["-af", &chain, "-vn", "-map_metadata", "0"])
        .arg(&target)
        .status()
        .await
        .map_err(|error| format!("ffmpeg: {error}"))?;
    if !status.success() {
        let _ = std::fs::remove_file(&target);
        return Err("music.download.filterFailed".to_string());
    }
    std::fs::rename(&target, &source).map_err(|error| format!("replace: {error}"))?;
    Ok(true)
}
