mod analysis_windows;
pub(crate) mod correlate;
mod extract;
pub mod moviehash;

pub mod asr;
mod asr_match;
pub mod audio_tracks;
pub mod fingerprint;
pub mod scorer;
pub mod torrent_sync;
mod url_guard;
mod vad;

#[cfg(feature = "asr-whisper")]
mod asr_whisper;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(serde::Serialize)]
pub struct SyncOut {
    #[serde(rename = "offsetSec")]
    pub offset_sec: f32,
    pub ratio: f32,
    pub confidence: f32,
    #[serde(rename = "fitWindowIds")]
    pub fit_window_ids: Vec<String>,
}

static BUSY: AtomicBool = AtomicBool::new(false);

struct BusyGuard;
impl Drop for BusyGuard {
    fn drop(&mut self) {
        BUSY.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
pub async fn sync_subtitle(
    url: String,
    headers: Option<HashMap<String, String>>,
    cues: Vec<[f32; 2]>,
    duration_sec: f32,
    info_hash: Option<String>,
    conf_min: Option<f32>,
) -> Result<Option<SyncOut>, String> {
    if info_hash.as_deref().map(|h| !h.is_empty()).unwrap_or(false) {
        return Ok(None);
    }
    if !crate::transcode::ffmpeg_present() {
        return Err("ffmpeg-unavailable".into());
    }
    if cues.len() < 4 || duration_sec < 60.0 {
        return Ok(None);
    }
    if BUSY.swap(true, Ordering::SeqCst) {
        return Ok(None);
    }
    let _guard = BusyGuard;

    let hdrs = headers.unwrap_or_default();
    let mut audio: Vec<(f32, f32)> = Vec::new();
    let planned_fit_windows = analysis_windows::fit_windows(duration_sec);
    let mut used_fit_windows = Vec::new();
    for window in &planned_fit_windows {
        if let Ok(iv) =
            extract::speech_intervals_reference(&url, &hdrs, window.start_sec, window.len_sec).await
        {
            if !iv.is_empty() {
                audio.extend(iv);
                used_fit_windows.push(window.clone());
            }
        }
    }
    if audio.is_empty() {
        return Err("no-audio-analyzed".into());
    }
    if used_fit_windows.len() != planned_fit_windows.len() {
        return Ok(None);
    }

    let cue_pairs: Vec<(f32, f32)> = cues.iter().map(|c| (c[0], c[1])).collect();
    let res = correlate::solve(&audio, &cue_pairs, duration_sec, conf_min.unwrap_or(0.55));
    Ok(res.map(|r| SyncOut {
        offset_sec: r.offset_sec,
        ratio: r.ratio,
        confidence: r.confidence,
        fit_window_ids: used_fit_windows
            .iter()
            .map(|window| window.id.to_string())
            .collect(),
    }))
}
