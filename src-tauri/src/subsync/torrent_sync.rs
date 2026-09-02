use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use librqbit::api::{Api, TorrentIdOrHash};
use librqbit::{ManagedTorrent, Session};

use super::analysis_windows::{
    self, AnalysisWindow, RequestedValidationWindow, TORRENT_EXPLICIT_HELD_OUT_PROVENANCE,
    TORRENT_HELD_OUT_PROVENANCE,
};
use super::correlate;
use super::scorer::{
    decode_speech, pack_intervals, requested_provenance, scored_quality, ScoredAlignmentQuality,
};

#[path = "url_guard.rs"]
mod url_guard;
#[path = "torrent_windows.rs"]
mod windows;

use windows::{
    center, downloaded_frac, endpoints_ready, select_windows, windows_available, Geometry, Window,
    MIN_LEVER_SEC,
};

const RATIO_UNIT_EPS: f32 = 0.0009;
const NATIVE_SCORING_TIMEOUT_SECS: u64 = 12;

#[allow(dead_code)]
pub enum SourceMode {
    RandomAccess,
    TorrentStream,
    RestrictedStream,
}

#[allow(dead_code)]
fn is_loopback_stream(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    let local = lower.contains("://127.0.0.1")
        || lower.contains("://localhost")
        || lower.contains("://[::1]");
    local && lower.contains("/stream/")
}

#[allow(dead_code)]
fn is_abs_path(url: &str) -> bool {
    let b = url.as_bytes();
    (b.len() > 2 && b[1] == b':' && (b[2] == b'/' || b[2] == b'\\')) || url.starts_with('/')
}

#[allow(dead_code)]
pub fn classify(url: &str, info_hash: Option<&str>) -> SourceMode {
    let has_hash = info_hash.map(|h| !h.is_empty()).unwrap_or(false);
    if is_loopback_stream(url) && has_hash {
        return SourceMode::TorrentStream;
    }
    if url.starts_with("file://") || is_abs_path(url) {
        return SourceMode::RandomAccess;
    }
    if url.to_ascii_lowercase().contains(".m3u8") {
        return SourceMode::RestrictedStream;
    }
    if url.starts_with("http://") || url.starts_with("https://") {
        return SourceMode::RandomAccess;
    }
    SourceMode::RestrictedStream
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentAvailability {
    pub windows: Vec<Window>,
    pub head_ready: bool,
    pub tail_ready: bool,
    pub downloaded_frac: f32,
    pub late_region_ready: bool,
    pub file_len: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentSyncOut {
    pub offset_sec: f32,
    pub ratio: f32,
    pub confidence: f32,
    pub lever_sec: f32,
    pub windows: usize,
    pub ratio_locked: bool,
    pub fit_window_ids: Vec<String>,
}

fn read_geometry(handle: &Arc<ManagedTorrent>, file_idx: usize) -> Option<Geometry> {
    handle
        .with_metadata(|m| {
            let fi = m.file_infos.get(file_idx)?;
            Some(Geometry {
                total_pieces: m.lengths.total_pieces(),
                piece_len: m.lengths.default_piece_length() as u64,
                total_len: m.lengths.total_length(),
                file_offset: fi.offset_in_torrent,
                file_len: fi.len,
            })
        })
        .ok()
        .flatten()
}

fn read_haves(session: Arc<Session>, id: TorrentIdOrHash, geo: &Geometry) -> Option<Vec<u8>> {
    let api = Api::new(session, None);
    let dump = api.api_dump_haves(id).ok()?;
    let bytes = windows::parse_have_bytes(&dump)?;
    let need = (geo.total_pieces as usize).div_ceil(8);
    if bytes.len() < need {
        return None;
    }
    Some(bytes)
}

fn lookup(info_hash: &str, file_idx: usize) -> Result<(Geometry, Vec<u8>), String> {
    let session = crate::torrent_engine::current_session().ok_or("engine not ready")?;
    let id = TorrentIdOrHash::parse(info_hash).map_err(|e| e.to_string())?;
    let handle = session.get(id).ok_or("no torrent")?;
    let geo = read_geometry(&handle, file_idx).ok_or("no metadata")?;
    let haves = read_haves(session, id, &geo).ok_or("availability unavailable")?;
    Ok((geo, haves))
}

type MaskCache = Mutex<HashMap<(String, usize), (String, Vec<(f32, f32)>)>>;

fn mask_cache() -> &'static MaskCache {
    static CACHE: OnceLock<MaskCache> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn window_sig(wins: &[Window]) -> String {
    let mut s = String::new();
    for w in wins {
        s.push_str(&format!(
            "{:08x}:{:08x};",
            w.start_sec.to_bits(),
            w.len_sec.to_bits()
        ));
    }
    s
}

fn torrent_fit_window_id(index: usize, window: &Window) -> String {
    format!(
        "torrent-fit-{index}-{:08x}-{:08x}",
        window.start_sec.to_bits(),
        window.len_sec.to_bits()
    )
}

fn parse_torrent_fit_window_id(id: &str) -> Option<AnalysisWindow> {
    let mut parts = id.split('-');
    if parts.next()? != "torrent" || parts.next()? != "fit" {
        return None;
    }
    let index = parts.next()?.parse::<usize>().ok()?;
    let start_sec = f32::from_bits(u32::from_str_radix(parts.next()?, 16).ok()?);
    let len_sec = f32::from_bits(u32::from_str_radix(parts.next()?, 16).ok()?);
    if parts.next().is_some()
        || index > 16
        || !start_sec.is_finite()
        || !len_sec.is_finite()
        || start_sec < 0.0
        || len_sec <= 0.0
    {
        return None;
    }
    Some(AnalysisWindow {
        id: id.to_string(),
        start_sec,
        len_sec,
    })
}

fn analysis_windows_from_torrent(prefix: &str, windows: &[Window]) -> Vec<AnalysisWindow> {
    windows
        .iter()
        .enumerate()
        .map(|(index, window)| AnalysisWindow {
            id: if prefix == "torrent-fit" {
                torrent_fit_window_id(index, window)
            } else {
                format!(
                    "{prefix}-{index}-{:08x}-{:08x}",
                    window.start_sec.to_bits(),
                    window.len_sec.to_bits()
                )
            },
            start_sec: window.start_sec,
            len_sec: window.len_sec,
        })
        .collect()
}

fn torrent_windows_from_analysis(windows: &[AnalysisWindow]) -> Vec<Window> {
    windows
        .iter()
        .map(|window| Window {
            start_sec: window.start_sec,
            len_sec: window.len_sec,
        })
        .collect()
}

fn cached_mask(info_hash: &str, file_idx: usize, sig: &str) -> Option<Vec<(f32, f32)>> {
    let cache = mask_cache().lock().unwrap();
    let (stored, mask) = cache.get(&(info_hash.to_string(), file_idx))?;
    if stored == sig {
        Some(mask.clone())
    } else {
        None
    }
}

fn store_mask(info_hash: &str, file_idx: usize, sig: String, mask: Vec<(f32, f32)>) {
    let mut cache = mask_cache().lock().unwrap();
    cache.insert((info_hash.to_string(), file_idx), (sig, mask));
}

#[tauri::command]
pub async fn torrent_sync_availability(
    info_hash: String,
    file_idx: usize,
    duration_sec: f32,
) -> Result<TorrentAvailability, String> {
    let (geo, haves) = lookup(&info_hash, file_idx)?;
    let wins = select_windows(&haves, &geo, duration_sec, true, -1.0);
    let (head_ready, tail_ready) = endpoints_ready(&haves, &geo);
    Ok(TorrentAvailability {
        late_region_ready: wins.len() == 2,
        windows: wins,
        head_ready,
        tail_ready,
        downloaded_frac: downloaded_frac(&haves, &geo),
        file_len: geo.file_len,
    })
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn torrent_sync_subtitle(
    info_hash: String,
    file_idx: usize,
    url: String,
    headers: Option<HashMap<String, String>>,
    cues: Vec<[f32; 2]>,
    duration_sec: f32,
    conf_min: Option<f32>,
    want_late: Option<bool>,
    position_sec: Option<f32>,
) -> Result<Option<TorrentSyncOut>, String> {
    if !crate::transcode::ffmpeg_present() {
        return Err("ffmpeg-unavailable".into());
    }
    url_guard::validate_media_url(&url, true)?;
    if cues.len() < 4 || duration_sec < 60.0 {
        return Ok(None);
    }
    let (geo, haves) = lookup(&info_hash, file_idx)?;
    let wins = select_windows(
        &haves,
        &geo,
        duration_sec,
        want_late.unwrap_or(true),
        position_sec.unwrap_or(-1.0),
    );
    if wins.is_empty() {
        return Ok(None);
    }

    let hdrs = headers.unwrap_or_default();
    let fit_analysis = analysis_windows_from_torrent("torrent-fit", &wins);
    let Ok(Ok((audio, used_windows))) = tokio::time::timeout(
        Duration::from_secs(NATIVE_SCORING_TIMEOUT_SECS),
        decode_speech(&url, &hdrs, &fit_analysis),
    )
    .await
    else {
        return Ok(None);
    };
    if audio.is_empty() || used_windows.len() != fit_analysis.len() {
        return Ok(None);
    }
    if audio.is_empty() {
        return Ok(None);
    }

    let cue_pairs: Vec<(f32, f32)> = cues.iter().map(|c| (c[0], c[1])).collect();
    let Some(res) = correlate::solve(&audio, &cue_pairs, duration_sec, conf_min.unwrap_or(0.55))
    else {
        return Ok(None);
    };

    let lever = if wins.len() == 2 {
        (center(&wins[1]) - center(&wins[0])).abs()
    } else {
        0.0
    };
    let short_lever = lever < MIN_LEVER_SEC;
    if short_lever && (res.ratio - 1.0).abs() > RATIO_UNIT_EPS {
        return Ok(None);
    }

    Ok(Some(TorrentSyncOut {
        offset_sec: res.offset_sec,
        ratio: res.ratio,
        confidence: res.confidence,
        lever_sec: lever,
        windows: wins.len(),
        ratio_locked: short_lever,
        fit_window_ids: wins
            .iter()
            .enumerate()
            .map(|(index, window)| torrent_fit_window_id(index, window))
            .collect(),
    }))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn torrent_score_transform(
    info_hash: String,
    file_idx: usize,
    url: String,
    headers: Option<HashMap<String, String>>,
    cues: Vec<[f32; 2]>,
    duration_sec: f32,
    offset_sec: f32,
    ratio: f32,
    position_sec: Option<f32>,
    validation: Option<bool>,
    exclude_window_ids: Option<Vec<String>>,
    validation_windows: Option<Vec<RequestedValidationWindow>>,
    validation_provenance: Option<String>,
) -> Result<Option<ScoredAlignmentQuality>, String> {
    if !crate::transcode::ffmpeg_present() {
        return Err("ffmpeg-unavailable".into());
    }
    url_guard::validate_media_url(&url, true)?;
    if cues.len() < 4 || duration_sec < 60.0 {
        return Ok(None);
    }
    let (geo, haves) = lookup(&info_hash, file_idx)?;
    let requested = validation_windows.unwrap_or_default();
    let held_out = validation.unwrap_or(false) || !requested.is_empty();
    let excluded_ids = exclude_window_ids.unwrap_or_default();
    let mut excluded = Vec::new();
    for id in &excluded_ids {
        let Some(window) = parse_torrent_fit_window_id(id) else {
            return Ok(None);
        };
        if !excluded
            .iter()
            .any(|existing: &AnalysisWindow| existing.id == window.id)
        {
            excluded.push(window);
        }
    }

    let (analysis, provenance) = if !requested.is_empty() {
        (
            analysis_windows::explicit_validation_windows(duration_sec, &requested, &excluded),
            TORRENT_EXPLICIT_HELD_OUT_PROVENANCE,
        )
    } else if held_out {
        let candidates = analysis_windows::default_validation_windows(duration_sec);
        if !analysis_windows::windows_are_disjoint(&candidates, &excluded) {
            return Ok(None);
        }
        (candidates, TORRENT_HELD_OUT_PROVENANCE)
    } else {
        let selected = select_windows(
            &haves,
            &geo,
            duration_sec,
            true,
            position_sec.unwrap_or(-1.0),
        );
        (
            analysis_windows_from_torrent("torrent-analysis", &selected),
            "torrent-analysis-windows-v1",
        )
    };
    if analysis.is_empty() {
        return Ok(None);
    }
    let torrent_windows = torrent_windows_from_analysis(&analysis);
    if held_out && !windows_available(&haves, &geo, duration_sec, &torrent_windows) {
        return Ok(None);
    }
    let sig = format!("{provenance}:{}", window_sig(&torrent_windows));

    let audio = match cached_mask(&info_hash, file_idx, &sig) {
        Some(mask) => mask,
        None => {
            let hdrs = headers.unwrap_or_default();
            let Ok(Ok((fresh, used_windows))) = tokio::time::timeout(
                Duration::from_secs(NATIVE_SCORING_TIMEOUT_SECS),
                decode_speech(&url, &hdrs, &analysis),
            )
            .await
            else {
                return Ok(None);
            };
            if fresh.is_empty() || used_windows.len() != analysis.len() {
                return Ok(None);
            }
            store_mask(&info_hash, file_idx, sig, fresh.clone());
            fresh
        }
    };

    let cue_pairs: Vec<(f32, f32)> = cues.iter().map(|c| (c[0], c[1])).collect();
    let corrected = cue_pairs
        .iter()
        .map(|&(start, end)| {
            let corrected_start = ratio * start + offset_sec;
            let corrected_end = ratio * end + offset_sec;
            (
                corrected_start.min(corrected_end),
                corrected_start.max(corrected_end),
            )
        })
        .collect::<Vec<_>>();
    let (packed_audio, packed_duration) = pack_intervals(&audio, &analysis);
    let (packed_cues, _) = pack_intervals(&corrected, &analysis);
    if packed_audio.is_empty() || packed_cues.len() < 2 || packed_duration <= 0.0 {
        return Ok(None);
    }
    let quality = correlate::score_affine(&packed_audio, &packed_cues, packed_duration, 0.0, 1.0);
    Ok(Some(scored_quality(
        quality,
        &analysis,
        provenance,
        if requested.is_empty() {
            None
        } else {
            requested_provenance(validation_provenance)
        },
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classify_distinguishes_torrent_from_debrid() {
        assert!(matches!(
            classify("http://127.0.0.1:5312/stream/abc/0", Some("abc")),
            SourceMode::TorrentStream
        ));
        assert!(matches!(
            classify("https://real-debrid.download/d/XYZ/file.mkv", Some("abc")),
            SourceMode::RandomAccess
        ));
        assert!(matches!(
            classify("file:///m/x.mkv", None),
            SourceMode::RandomAccess
        ));
        assert!(matches!(
            classify("https://cdn.example.com/master.m3u8", None),
            SourceMode::RestrictedStream
        ));
    }

    #[test]
    fn window_sig_changes_with_window_set() {
        let a = vec![Window {
            start_sec: 30.0,
            len_sec: 600.0,
        }];
        let b = vec![
            Window {
                start_sec: 30.0,
                len_sec: 600.0,
            },
            Window {
                start_sec: 5000.0,
                len_sec: 600.0,
            },
        ];
        assert_ne!(window_sig(&a), window_sig(&b));
        assert_eq!(window_sig(&a), window_sig(&a.clone()));

        let mut subsecond = a.clone();
        subsecond[0].start_sec += 0.125;
        assert_ne!(window_sig(&a), window_sig(&subsecond));
    }

    #[test]
    fn torrent_fit_window_ids_round_trip_exact_geometry() {
        let window = Window {
            start_sec: 123.456,
            len_sec: 78.9,
        };
        let id = torrent_fit_window_id(1, &window);
        let parsed = parse_torrent_fit_window_id(&id).expect("trusted fit id");
        assert_eq!(parsed.id, id);
        assert_eq!(parsed.start_sec.to_bits(), window.start_sec.to_bits());
        assert_eq!(parsed.len_sec.to_bits(), window.len_sec.to_bits());
        assert!(parse_torrent_fit_window_id("fit-early").is_none());
    }

    #[test]
    fn torrent_middle_validation_is_disjoint_from_encoded_fit_windows() {
        let fit = [
            Window {
                start_sec: 60.0,
                len_sec: 300.0,
            },
            Window {
                start_sec: 840.0,
                len_sec: 300.0,
            },
        ];
        let excluded = fit
            .iter()
            .enumerate()
            .map(|(index, window)| {
                parse_torrent_fit_window_id(&torrent_fit_window_id(index, window)).unwrap()
            })
            .collect::<Vec<_>>();
        let validation = analysis_windows::default_validation_windows(1_200.0);
        assert!(analysis_windows::windows_are_disjoint(
            &validation,
            &excluded
        ));
    }
}
