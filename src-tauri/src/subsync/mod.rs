pub(crate) mod correlate;
mod extract;
pub mod moviehash;

mod url_guard;
mod vad;
mod asr_match;
pub mod scorer;
pub mod torrent_sync;
pub mod audio_tracks;
pub mod subtitle_tracks;
pub mod asr;
pub mod fingerprint;

#[cfg(test)]
mod subtitle_tracks_tests;

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
}

static BUSY: AtomicBool = AtomicBool::new(false);

struct BusyGuard;
impl Drop for BusyGuard {
    fn drop(&mut self) {
        BUSY.store(false, Ordering::SeqCst);
    }
}

fn windows(dur: f32) -> Vec<(f32, f32)> {
    if dur < 900.0 {
        let start = (dur * 0.05).max(5.0);
        let len = (dur * 0.9 - start).max(30.0);
        return vec![(start, len)];
    }
    let early = (180.0f32, 600.0f32);
    let late_len = 600.0f32;
    let late_start = (dur - late_len - 120.0).max(early.0 + early.1);
    vec![early, (late_start, late_len)]
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
    for (start, len) in windows(duration_sec) {
        if let Ok(iv) = extract::speech_intervals_reference(&url, &hdrs, start, len).await {
            audio.extend(iv);
        }
    }
    if audio.is_empty() {
        return Err("no-audio-analyzed".into());
    }

    let cue_pairs: Vec<(f32, f32)> = cues.iter().map(|c| (c[0], c[1])).collect();
    let res = correlate::solve(&audio, &cue_pairs, duration_sec, conf_min.unwrap_or(0.55));
    Ok(res.map(|r| SyncOut {
        offset_sec: r.offset_sec,
        ratio: r.ratio,
        confidence: r.confidence,
    }))
}
