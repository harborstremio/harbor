#![allow(dead_code)]

use std::collections::HashMap;
use std::time::Duration;
use tokio::process::Command;

use super::asr_match::{cue_tokens, score_window};
use super::url_guard;

pub const ASR_SAMPLE_RATE: u32 = 16000;
const PCM_TIMEOUT_SECS: u64 = 60;

#[derive(Clone, serde::Serialize)]
pub struct AsrToken {
    pub text: String,
    pub t0: f32,
    pub t1: f32,
    pub p: f32,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrSegment {
    pub text: String,
    pub t0: f32,
    pub t1: f32,
    pub no_speech: f32,
    pub tokens: Vec<AsrToken>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AsrWindow {
    pub start_sec: f32,
    pub len_sec: f32,
    pub lang: String,
    pub tokens: Vec<AsrToken>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowEvidence {
    pub start_sec: f32,
    pub len_sec: f32,
    pub lang: String,
    pub speech_tokens: u32,
    pub eligible: u32,
    pub matched: u32,
    pub residual_sec: f32,
    pub word_offset_sec: f32,
    pub word_ratio: f32,
    pub anchors: u32,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyReport {
    pub windows: Vec<WindowEvidence>,
    pub model: String,
    pub sub_lang: String,
    pub offset_sec: f32,
    pub ratio: f32,
}

pub trait AsrEngine: Send + Sync {
    fn transcribe(
        &self,
        pcm: &[f32],
        lang: Option<&str>,
        translate: bool,
    ) -> Result<Vec<AsrSegment>, String>;
}

pub struct NullEngine;
impl AsrEngine for NullEngine {
    fn transcribe(&self, _: &[f32], _: Option<&str>, _: bool) -> Result<Vec<AsrSegment>, String> {
        Err("asr-engine-unavailable".into())
    }
}

pub async fn pcm_window(
    url: &str,
    headers: &HashMap<String, String>,
    start_sec: f32,
    len_sec: f32,
    map_spec: &str,
) -> Result<Vec<f32>, String> {
    let ff = crate::transcode::locate_ffmpeg().ok_or("ffmpeg not found")?;
    let mut cmd = Command::new(&ff);
    cmd.arg("-hide_banner")
        .arg("-nostats")
        .arg("-loglevel")
        .arg("error");
    cmd.arg("-user_agent")
        .arg(url_guard::user_agent(headers).unwrap_or_else(|| "Harbor".into()));
    let blob = url_guard::safe_header_blob(headers);
    if !blob.is_empty() {
        cmd.arg("-headers").arg(blob);
    }
    cmd.arg("-ss")
        .arg(start_sec.to_string())
        .arg("-t")
        .arg(len_sec.to_string())
        .arg("-i")
        .arg(url)
        .arg("-vn")
        .arg("-map")
        .arg(map_spec)
        .arg("-ac")
        .arg("1")
        .arg("-ar")
        .arg(ASR_SAMPLE_RATE.to_string())
        .arg("-f")
        .arg("f32le")
        .arg("-acodec")
        .arg("pcm_f32le")
        .arg("-");
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::null());
    cmd.kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000 | 0x0000_4000);

    let output = tokio::time::timeout(Duration::from_secs(PCM_TIMEOUT_SECS), cmd.output())
        .await
        .map_err(|_| "ffmpeg-timeout".to_string())?
        .map_err(|error| format!("run ffmpeg: {}", error))?;
    if !output.status.success() {
        return Err(format!("ffmpeg-exit-status: {}", output.status));
    }
    let buf = output.stdout;

    let mut pcm = Vec::with_capacity(buf.len() / 4);
    let mut i = 0;
    while i + 4 <= buf.len() {
        pcm.push(f32::from_le_bytes([
            buf[i],
            buf[i + 1],
            buf[i + 2],
            buf[i + 3],
        ]));
        i += 4;
    }
    Ok(pcm)
}

pub fn probe_windows(dur: f32, n: usize, len: f32) -> Vec<(f32, f32)> {
    let n = n.max(1);
    let lo = (dur * 0.08).max(5.0);
    let hi = (dur * 0.92 - len).max(lo);
    if hi <= lo || n == 1 {
        return vec![((lo + hi) * 0.5, len.min(dur))];
    }
    let step = (hi - lo) / (n as f32 - 1.0);
    (0..n).map(|k| (lo + step * k as f32, len)).collect()
}

pub async fn transcribe_windows(
    engine: &dyn AsrEngine,
    url: &str,
    headers: &HashMap<String, String>,
    probes: &[(f32, f32)],
    lang: Option<&str>,
    map_spec: &str,
) -> Vec<AsrWindow> {
    let mut out = Vec::new();
    for &(start, len) in probes {
        let pcm = match pcm_window(url, headers, start, len, map_spec).await {
            Ok(p) if p.len() > ASR_SAMPLE_RATE as usize => p,
            _ => continue,
        };
        let segs = match engine.transcribe(&pcm, lang, false) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let mut tokens = Vec::new();
        for seg in segs {
            for mut tk in seg.tokens {
                tk.t0 += start;
                tk.t1 += start;
                tokens.push(tk);
            }
        }
        out.push(AsrWindow {
            start_sec: start,
            len_sec: len,
            lang: lang.unwrap_or("auto").into(),
            tokens,
        });
    }
    out
}

#[allow(clippy::too_many_arguments)]
pub async fn verify(
    engine: &dyn AsrEngine,
    url: &str,
    headers: &HashMap<String, String>,
    cues: &[(f32, f32, String)],
    offset_sec: f32,
    ratio: f32,
    sub_lang: &str,
    probes: &[(f32, f32)],
    model_name: &str,
    map_spec: &str,
) -> Result<VerifyReport, String> {
    let asr = transcribe_windows(engine, url, headers, probes, Some(sub_lang), map_spec).await;
    if asr.is_empty() {
        return Err("no-audio-transcribed".into());
    }
    let mut windows = Vec::new();
    for w in asr {
        let subs = cue_tokens(
            cues,
            w.start_sec,
            w.start_sec + w.len_sec,
            offset_sec,
            ratio,
        );
        windows.push(score_window(
            &w.tokens,
            &subs,
            w.lang,
            w.start_sec,
            w.len_sec,
        ));
    }
    Ok(VerifyReport {
        windows,
        model: model_name.into(),
        sub_lang: sub_lang.into(),
        offset_sec,
        ratio,
    })
}

pub async fn generate(
    engine: &dyn AsrEngine,
    url: &str,
    headers: &HashMap<String, String>,
    dur: f32,
    lang: Option<&str>,
    translate: bool,
    map_spec: &str,
) -> Result<Vec<AsrSegment>, String> {
    let chunk = 30.0f32;
    let overlap = 1.0f32;
    let mut out: Vec<AsrSegment> = Vec::new();
    let mut start = 0.0f32;
    while start < dur {
        let len = chunk.min(dur - start);
        if len < 1.0 {
            break;
        }
        let pcm = pcm_window(url, headers, start, len + overlap, map_spec).await?;
        if pcm.len() <= ASR_SAMPLE_RATE as usize {
            start += chunk;
            continue;
        }
        for mut seg in engine.transcribe(&pcm, lang, translate)? {
            seg.t0 += start;
            seg.t1 += start;
            if out.last().map(|p| seg.t0 >= p.t1 - 0.05).unwrap_or(true) {
                for tk in seg.tokens.iter_mut() {
                    tk.t0 += start;
                    tk.t1 += start;
                }
                out.push(seg);
            }
        }
        start += chunk;
    }
    Ok(out)
}

#[cfg(feature = "asr-whisper")]
fn load_engine(model_path: &str) -> Result<Box<dyn AsrEngine>, String> {
    Ok(Box::new(super::asr_whisper::WhisperEngine::load(
        model_path,
    )?))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn asr_transcribe_windows(
    url: String,
    headers: Option<HashMap<String, String>>,
    duration_sec: f32,
    sub_lang: Option<String>,
    probe_count: Option<usize>,
    window_sec: Option<f32>,
    model_path: Option<String>,
    map_spec: Option<String>,
) -> Result<Vec<AsrWindow>, String> {
    #[cfg(not(feature = "asr-whisper"))]
    return {
        let _ = (
            &url,
            &headers,
            duration_sec,
            &sub_lang,
            probe_count,
            window_sec,
            &model_path,
            &map_spec,
        );
        Ok(Vec::new())
    };

    #[cfg(feature = "asr-whisper")]
    {
        url_guard::validate_media_url(&url, true)?;
        let Some(model) = model_path else {
            return Ok(Vec::new());
        };
        let engine = match load_engine(&model) {
            Ok(e) => e,
            Err(_) => return Ok(Vec::new()),
        };
        let hdrs = headers.unwrap_or_default();
        let ms = url_guard::safe_map_spec(map_spec.as_deref());
        let win = window_sec.unwrap_or(30.0).max(5.0);
        let probes = probe_windows(duration_sec, probe_count.unwrap_or(3), win);
        let lang = sub_lang.as_deref().filter(|s| !s.is_empty());
        Ok(transcribe_windows(engine.as_ref(), &url, &hdrs, &probes, lang, &ms).await)
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn asr_verify(
    url: String,
    headers: Option<HashMap<String, String>>,
    cues: Vec<(f32, f32, String)>,
    offset_sec: f32,
    ratio: f32,
    sub_lang: String,
    duration_sec: f32,
    probe_count: Option<usize>,
    window_sec: Option<f32>,
    model_path: Option<String>,
    map_spec: Option<String>,
) -> Result<Option<VerifyReport>, String> {
    #[cfg(not(feature = "asr-whisper"))]
    return {
        let _ = (
            &url,
            &headers,
            &cues,
            offset_sec,
            ratio,
            &sub_lang,
            duration_sec,
            probe_count,
            window_sec,
            &model_path,
            &map_spec,
        );
        Ok(None)
    };

    #[cfg(feature = "asr-whisper")]
    {
        url_guard::validate_media_url(&url, true)?;
        let Some(model) = model_path else {
            return Ok(None);
        };
        let engine = match load_engine(&model) {
            Ok(e) => e,
            Err(_) => return Ok(None),
        };
        let hdrs = headers.unwrap_or_default();
        let ms = url_guard::safe_map_spec(map_spec.as_deref());
        let win = window_sec.unwrap_or(30.0).max(5.0);
        let probes = probe_windows(duration_sec, probe_count.unwrap_or(3), win);
        let lang = if sub_lang.is_empty() {
            "auto"
        } else {
            sub_lang.as_str()
        };
        match verify(
            engine.as_ref(),
            &url,
            &hdrs,
            &cues,
            offset_sec,
            ratio,
            lang,
            &probes,
            &model,
            &ms,
        )
        .await
        {
            Ok(rep) => Ok(Some(rep)),
            Err(_) => Ok(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_windows_spread_across_middle() {
        let w = probe_windows(3600.0, 3, 20.0);
        assert_eq!(w.len(), 3);
        assert!(w[0].0 >= 5.0 && w[2].0 < 3600.0 * 0.92);
        assert!(w[1].0 > w[0].0 && w[2].0 > w[1].0);
    }

    #[test]
    fn probe_windows_single_centered() {
        let w = probe_windows(120.0, 1, 60.0);
        assert_eq!(w.len(), 1);
    }
}
