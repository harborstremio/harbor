use std::collections::HashMap;
use std::time::Duration;
use tokio::process::Command;

use crate::transcode::locate_ffmpeg;

#[path = "vad_dsp.rs"]
mod dsp;
#[cfg(feature = "silero-vad")]
#[path = "vad_silero.rs"]
mod silero;

pub const SR: u32 = 16000;
pub const HOP: usize = 160;
pub const WIN: usize = 512;
pub const ENV_HZ: f32 = 100.0;
const HARD_TIMEOUT_SECS: u64 = 90;

const HOP_BY_HOP: &[&str] = &[
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
];

#[derive(Clone)]
pub struct VadConfig {
    pub speech_threshold: f32,
    pub min_speech_ms: u32,
    pub min_silence_ms: u32,
    pub speech_pad_ms: u32,
    pub energy_floor_db: f32,
    pub flatness_lo: f32,
    pub flatness_hi: f32,
    pub harmonicity_lo: f32,
    pub harmonicity_hi: f32,
    pub mod_ratio_lo: f32,
    pub mod_ratio_hi: f32,
    pub mod_floor: f32,
    pub band_lo_hz: f32,
    pub band_hi_hz: f32,
    pub f0_lo_hz: f32,
    pub f0_hi_hz: f32,
    pub mod_win_ms: u32,
}

impl Default for VadConfig {
    fn default() -> Self {
        VadConfig {
            speech_threshold: 0.55,
            min_speech_ms: 180,
            min_silence_ms: 220,
            speech_pad_ms: 120,
            energy_floor_db: -45.0,
            flatness_lo: 0.05,
            flatness_hi: 0.45,
            harmonicity_lo: 0.30,
            harmonicity_hi: 0.75,
            mod_ratio_lo: 0.18,
            mod_ratio_hi: 0.55,
            mod_floor: 0.15,
            band_lo_hz: 200.0,
            band_hi_hz: 3400.0,
            f0_lo_hz: 80.0,
            f0_hi_hz: 350.0,
            mod_win_ms: 2000,
        }
    }
}

pub enum Backend {
    Heuristic,
    #[cfg(feature = "silero-vad")]
    Silero,
}

#[allow(dead_code)]
pub struct VadReport {
    pub intervals: Vec<(f32, f32)>,
    pub speech_frac: f32,
    pub gated_frac: f32,
}

pub async fn speech_intervals_ml(
    url: &str,
    headers: &HashMap<String, String>,
    start_sec: f32,
    len_sec: f32,
    cfg: &VadConfig,
    backend: Backend,
    map_spec: &str,
) -> Result<Vec<(f32, f32)>, String> {
    Ok(
        speech_report_ml(url, headers, start_sec, len_sec, cfg, backend, map_spec)
            .await?
            .intervals,
    )
}

pub async fn speech_report_ml(
    url: &str,
    headers: &HashMap<String, String>,
    start_sec: f32,
    len_sec: f32,
    cfg: &VadConfig,
    backend: Backend,
    map_spec: &str,
) -> Result<VadReport, String> {
    let pcm = decode_pcm(url, headers, start_sec, len_sec, map_spec).await?;
    if pcm.len() < WIN {
        return Err("pcm-decode-insufficient".into());
    }
    let (probs, frame_ms, gated_frac) = match backend {
        Backend::Heuristic => {
            let (p, g) = dsp::heuristic_probs(&pcm, cfg);
            (p, HOP as f32 * 1000.0 / SR as f32, g)
        }
        #[cfg(feature = "silero-vad")]
        Backend::Silero => (silero::probs(&pcm)?, WIN as f32 * 1000.0 / SR as f32, 0.0),
    };
    let speech_frac = if probs.is_empty() {
        0.0
    } else {
        probs.iter().filter(|&&p| p >= cfg.speech_threshold).count() as f32 / probs.len() as f32
    };
    let intervals = hysteresis(&probs, frame_ms, cfg, start_sec, start_sec + len_sec);
    Ok(VadReport {
        intervals,
        speech_frac,
        gated_frac,
    })
}

fn has_ctl(s: &str) -> bool {
    s.chars().any(|c| c.is_control())
}

fn safe_header_blob(headers: &HashMap<String, String>) -> String {
    let mut blob = String::new();
    for (k, v) in headers {
        let lk = k.to_ascii_lowercase();
        if lk == "user-agent" || HOP_BY_HOP.contains(&lk.as_str()) || has_ctl(k) || has_ctl(v) {
            continue;
        }
        blob.push_str(&format!("{}: {}\r\n", k, v));
    }
    blob
}

fn user_agent(headers: &HashMap<String, String>) -> Option<String> {
    headers
        .iter()
        .find(|(k, _)| k.eq_ignore_ascii_case("user-agent"))
        .map(|(_, v)| v.clone())
}

async fn decode_pcm(
    url: &str,
    headers: &HashMap<String, String>,
    start_sec: f32,
    len_sec: f32,
    map_spec: &str,
) -> Result<Vec<f32>, String> {
    let Some(ff) = locate_ffmpeg() else {
        return Err("ffmpeg not found".into());
    };
    let mut cmd = Command::new(&ff);
    cmd.arg("-hide_banner")
        .arg("-nostats")
        .arg("-loglevel")
        .arg("error");
    cmd.arg("-user_agent")
        .arg(user_agent(headers).unwrap_or_else(|| "Harbor".into()));
    let blob = safe_header_blob(headers);
    if !blob.is_empty() {
        cmd.arg("-headers").arg(blob);
    }
    cmd.arg("-ss")
        .arg(format!("{}", start_sec))
        .arg("-t")
        .arg(format!("{}", len_sec))
        .arg("-i")
        .arg(url)
        .arg("-vn")
        .arg("-map")
        .arg(map_spec)
        .arg("-af")
        .arg("aformat=channel_layouts=mono,highpass=f=40")
        .arg("-ar")
        .arg(format!("{}", SR))
        .arg("-ac")
        .arg("1")
        .arg("-f")
        .arg("f32le")
        .arg("-");
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::null());
    cmd.kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000 | 0x0000_4000);

    let output = tokio::time::timeout(Duration::from_secs(HARD_TIMEOUT_SECS), cmd.output())
        .await
        .map_err(|_| "ffmpeg-timeout".to_string())?
        .map_err(|error| format!("run ffmpeg: {}", error))?;
    if !output.status.success() {
        return Err(format!("ffmpeg-exit-status: {}", output.status));
    }
    let raw = output.stdout;

    let mut pcm = Vec::with_capacity(raw.len() / 4);
    let mut i = 0;
    while i + 4 <= raw.len() {
        pcm.push(f32::from_le_bytes([
            raw[i],
            raw[i + 1],
            raw[i + 2],
            raw[i + 3],
        ]));
        i += 4;
    }
    Ok(pcm)
}

pub fn hysteresis(
    probs: &[f32],
    frame_ms: f32,
    cfg: &VadConfig,
    origin_sec: f32,
    end_sec: f32,
) -> Vec<(f32, f32)> {
    if probs.is_empty() {
        return Vec::new();
    }
    let to_frames = |ms: u32| ((ms as f32 / frame_ms).round() as usize).max(1);
    let min_speech = to_frames(cfg.min_speech_ms);
    let min_sil = to_frames(cfg.min_silence_ms);
    let pad = to_frames(cfg.speech_pad_ms);
    let dt = frame_ms / 1000.0;

    let mut raw: Vec<(usize, usize)> = Vec::new();
    let mut in_speech = false;
    let mut seg_start = 0usize;
    let mut sil_run = 0usize;
    for (i, &p) in probs.iter().enumerate() {
        if p >= cfg.speech_threshold {
            if !in_speech {
                in_speech = true;
                seg_start = i;
            }
            sil_run = 0;
        } else if in_speech {
            sil_run += 1;
            if sil_run >= min_sil {
                let seg_end = i - sil_run + 1;
                if seg_end > seg_start + min_speech {
                    raw.push((seg_start, seg_end));
                }
                in_speech = false;
            }
        }
    }
    if in_speech && probs.len() > seg_start + min_speech {
        raw.push((seg_start, probs.len()));
    }

    let mut out: Vec<(f32, f32)> = Vec::new();
    for (s, e) in raw {
        let a = origin_sec + s.saturating_sub(pad) as f32 * dt;
        let b = (origin_sec + (e + pad).min(probs.len()) as f32 * dt).min(end_sec);
        if let Some(last) = out.last_mut() {
            if a <= last.1 {
                if b > last.1 {
                    last.1 = b;
                }
                continue;
            }
        }
        out.push((a, b));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hysteresis_merges_padded_neighbors() {
        let cfg = VadConfig {
            speech_pad_ms: 200,
            min_silence_ms: 100,
            ..Default::default()
        };
        let mut probs = vec![0.0f32; 200];
        for p in probs.iter_mut().take(40).skip(20) {
            *p = 0.9;
        }
        for p in probs.iter_mut().take(80).skip(60) {
            *p = 0.9;
        }
        let iv = hysteresis(&probs, 10.0, &cfg, 0.0, 2.0);
        assert_eq!(iv.len(), 1, "padded neighbors should merge: {:?}", iv);
    }

    #[test]
    fn hysteresis_drops_short_blips() {
        let cfg = VadConfig::default();
        let mut probs = vec![0.0f32; 200];
        probs[50] = 0.9;
        probs[51] = 0.9;
        let iv = hysteresis(&probs, 10.0, &cfg, 0.0, 2.0);
        assert!(iv.is_empty(), "20ms blip should be dropped: {:?}", iv);
    }

    #[test]
    fn hysteresis_offsets_to_absolute_time() {
        let cfg = VadConfig {
            speech_pad_ms: 0,
            min_speech_ms: 50,
            ..Default::default()
        };
        let mut probs = vec![0.0f32; 300];
        for p in probs.iter_mut().take(200).skip(100) {
            *p = 0.9;
        }
        let iv = hysteresis(&probs, 10.0, &cfg, 180.0, 183.0);
        assert_eq!(iv.len(), 1);
        assert!((iv[0].0 - 181.0).abs() < 0.05, "start {}", iv[0].0);
    }
}
