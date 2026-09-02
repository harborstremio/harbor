#![allow(dead_code)]

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;

use crate::transcode::locate_ffmpeg;

use super::url_guard;

pub const SAMPLE_RATE: u32 = 11025;
pub const FRAME_SIZE: u32 = 4096;
pub const ITEM_SECONDS: f64 = (FRAME_SIZE as f64) / 3.0 / (SAMPLE_RATE as f64);

const FPCALC_TIMEOUT_SECS: u64 = 60;
const MIN_OVERLAP_ITEMS: usize = 100;
const BER_ACCEPT: f64 = 0.10;

#[derive(Clone, serde::Serialize)]
pub struct Fingerprint {
    pub duration: f64,
    pub raw: Vec<u32>,
    #[serde(rename = "itemSeconds")]
    pub item_seconds: f64,
}

#[derive(Clone, Copy, serde::Serialize)]
pub struct Alignment {
    #[serde(rename = "offsetSec")]
    pub offset_sec: f64,
    pub ber: f64,
    pub overlap: usize,
}

pub fn locate_fpcalc() -> Option<PathBuf> {
    if let Ok(p) = std::env::var("HARBOR_FPCALC") {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Some(pb);
        }
    }
    let names: &[&str] = if cfg!(windows) {
        &["fpcalc.exe"]
    } else {
        &["fpcalc"]
    };
    let sep = if cfg!(windows) { ';' } else { ':' };
    if let Ok(path) = std::env::var("PATH") {
        for dir in path.split(sep) {
            for n in names {
                let cand = Path::new(dir).join(n);
                if cand.exists() {
                    return Some(cand);
                }
            }
        }
    }
    None
}

pub fn fpcalc_present() -> bool {
    locate_fpcalc().is_some()
}

fn strip_file_host(rest: &str) -> String {
    let b = rest.as_bytes();
    if b.len() >= 2 && b[1] == b':' {
        return rest.to_string();
    }
    if rest.starts_with('/') {
        if b.len() >= 3 && b[2] == b':' {
            return rest[1..].to_string();
        }
        return rest.to_string();
    }
    match rest.find('/') {
        Some(i) => rest[i..].to_string(),
        None => rest.to_string(),
    }
}

fn local_file(url: &str) -> Option<PathBuf> {
    if let Some(rest) = url.strip_prefix("file://") {
        return Some(PathBuf::from(strip_file_host(rest)));
    }
    if url.starts_with("http://") || url.starts_with("https://") {
        return None;
    }
    let pb = PathBuf::from(url);
    if pb.is_absolute() {
        Some(pb)
    } else {
        None
    }
}

async fn decode_window_wav(
    url: &str,
    headers: &HashMap<String, String>,
    start_sec: f64,
    len_sec: f64,
    map_spec: &str,
) -> Result<PathBuf, String> {
    let ff = locate_ffmpeg().ok_or("ffmpeg not found")?;
    let mut out = std::env::temp_dir();
    out.push(format!(
        "harbor-fp-{}-{}.wav",
        std::process::id(),
        start_sec as u64
    ));

    let mut cmd = Command::new(&ff);
    cmd.arg("-hide_banner").arg("-nostats").arg("-y");
    cmd.arg("-user_agent")
        .arg(url_guard::user_agent(headers).unwrap_or_else(|| "Harbor".into()));
    let blob = url_guard::safe_header_blob(headers);
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
        .arg("-ac")
        .arg("1")
        .arg("-ar")
        .arg(SAMPLE_RATE.to_string())
        .arg("-c:a")
        .arg("pcm_s16le")
        .arg(&out);
    cmd.stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000 | 0x0000_4000);

    let status = tokio::time::timeout(Duration::from_secs(FPCALC_TIMEOUT_SECS), cmd.status())
        .await
        .map_err(|_| "ffmpeg timeout".to_string())?
        .map_err(|e| format!("ffmpeg: {}", e))?;
    if !status.success() {
        return Err("ffmpeg decode failed".into());
    }
    Ok(out)
}

fn parse_fpcalc_json(bytes: &[u8]) -> Result<Fingerprint, String> {
    let v: serde_json::Value = serde_json::from_slice(bytes).map_err(|e| format!("json: {}", e))?;
    let duration = v
        .get("duration")
        .and_then(|d| d.as_f64())
        .ok_or("no duration")?;
    let arr = v
        .get("fingerprint")
        .and_then(|f| f.as_array())
        .ok_or("no raw fingerprint")?;
    let raw: Vec<u32> = arr
        .iter()
        .filter_map(|n| n.as_i64().map(|x| x as u32))
        .collect();
    if raw.is_empty() {
        return Err("empty fingerprint".into());
    }
    Ok(Fingerprint {
        duration,
        raw,
        item_seconds: ITEM_SECONDS,
    })
}

async fn run_fpcalc(path: &Path, len_sec: f64) -> Result<Fingerprint, String> {
    let fp = locate_fpcalc().ok_or("fpcalc not found")?;
    let mut cmd = Command::new(&fp);
    cmd.arg("-json")
        .arg("-raw")
        .arg("-length")
        .arg(format!("{}", (len_sec.max(1.0)) as u64))
        .arg(path);
    cmd.stderr(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);

    let out = tokio::time::timeout(Duration::from_secs(FPCALC_TIMEOUT_SECS), cmd.output())
        .await
        .map_err(|_| "fpcalc timeout".to_string())?
        .map_err(|e| format!("fpcalc: {}", e))?;
    if !out.status.success() {
        return Err("fpcalc failed".into());
    }
    parse_fpcalc_json(&out.stdout)
}

pub async fn fingerprint_file(path: &str, len_sec: f64) -> Result<Fingerprint, String> {
    run_fpcalc(Path::new(path), len_sec).await
}

pub async fn fingerprint_window(
    url: &str,
    headers: &HashMap<String, String>,
    start_sec: f64,
    len_sec: f64,
    map_spec: &str,
) -> Result<Fingerprint, String> {
    let wav = decode_window_wav(url, headers, start_sec, len_sec, map_spec).await?;
    let res = run_fpcalc(&wav, len_sec + 5.0).await;
    let _ = std::fs::remove_file(&wav);
    res
}

fn ber_at(a: &[u32], b: &[u32], lag: isize) -> Option<(f64, usize)> {
    let mut bits: u64 = 0;
    let mut overlap: usize = 0;
    for (i, &av) in a.iter().enumerate() {
        let j = i as isize + lag;
        if j < 0 {
            continue;
        }
        let j = j as usize;
        if j >= b.len() {
            break;
        }
        bits += (av ^ b[j]).count_ones() as u64;
        overlap += 1;
    }
    if overlap < MIN_OVERLAP_ITEMS {
        return None;
    }
    Some((bits as f64 / (32.0 * overlap as f64), overlap))
}

pub fn best_alignment(a: &[u32], b: &[u32], max_lag_items: usize) -> Option<Alignment> {
    let mut best: Option<Alignment> = None;
    let mut lag = -(max_lag_items as isize);
    let hi = max_lag_items as isize;
    while lag <= hi {
        if let Some((ber, overlap)) = ber_at(a, b, lag) {
            if best.map(|x| ber < x.ber).unwrap_or(true) {
                best = Some(Alignment {
                    offset_sec: lag as f64 * ITEM_SECONDS,
                    ber,
                    overlap,
                });
            }
        }
        lag += 1;
    }
    best
}

pub fn identity_match(a: &[u32], b: &[u32], max_lag_items: usize) -> Option<Alignment> {
    let al = best_alignment(a, b, max_lag_items)?;
    if al.ber <= BER_ACCEPT {
        Some(al)
    } else {
        None
    }
}

pub async fn compressed_fingerprint(path: &str, len_sec: f64) -> Result<(f64, String), String> {
    let fp = locate_fpcalc().ok_or("fpcalc not found")?;
    let mut cmd = Command::new(&fp);
    cmd.arg("-json")
        .arg("-length")
        .arg(format!("{}", (len_sec.max(1.0)) as u64))
        .arg(path);
    cmd.stderr(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);
    let out = cmd.output().await.map_err(|e| format!("fpcalc: {}", e))?;
    if !out.status.success() {
        return Err("fpcalc failed".into());
    }
    let v: serde_json::Value =
        serde_json::from_slice(&out.stdout).map_err(|e| format!("json: {}", e))?;
    let dur = v
        .get("duration")
        .and_then(|d| d.as_f64())
        .ok_or("no duration")?;
    let s = v
        .get("fingerprint")
        .and_then(|f| f.as_str())
        .ok_or("no compressed fingerprint")?;
    Ok((dur, s.to_string()))
}

pub fn acoustid_lookup_url(client_key: &str, duration: f64, compressed: &str) -> String {
    format!(
        "https://api.acoustid.org/v2/lookup?client={}&meta=recordings&duration={}&fingerprint={}",
        client_key,
        duration.round() as i64,
        compressed
    )
}

#[tauri::command]
pub async fn compute_chromaprint(
    url: String,
    headers: Option<HashMap<String, String>>,
    start_sec: Option<f64>,
    len_sec: Option<f64>,
    map_spec: Option<String>,
) -> Result<Option<Fingerprint>, String> {
    #[cfg(not(feature = "chromaprint"))]
    return {
        let _ = (&url, &headers, start_sec, len_sec, &map_spec);
        Ok(None)
    };

    #[cfg(feature = "chromaprint")]
    {
        if !fpcalc_present() {
            return Ok(None);
        }
        url_guard::validate_media_url(&url, true)?;
        let hdrs = headers.unwrap_or_default();
        let start = start_sec.unwrap_or(60.0);
        let len = len_sec.unwrap_or(120.0);
        let ms = url_guard::safe_map_spec(map_spec.as_deref());
        if let Some(path) = local_file(&url) {
            let p = path.to_string_lossy().to_string();
            return fingerprint_file(&p, len).await.map(Some);
        }
        fingerprint_window(&url, &hdrs, start, len, &ms)
            .await
            .map(Some)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn item_seconds_is_chromaprint_default() {
        assert!((ITEM_SECONDS - 0.12384).abs() < 1e-4);
    }

    #[test]
    fn identical_fingerprint_zero_ber() {
        let a: Vec<u32> = (0..300u32)
            .map(|i| i.wrapping_mul(2654435761) ^ 0x9e37_79b9)
            .collect();
        let al = identity_match(&a, &a, 50).expect("identical must match");
        assert_eq!(al.ber, 0.0);
        assert!(al.offset_sec.abs() < 1e-9);
    }

    #[test]
    fn recovers_known_lag() {
        let base: Vec<u32> = (0..400u32)
            .map(|i| i.wrapping_mul(40503).wrapping_mul(2246822519))
            .collect();
        let a = base[10..].to_vec();
        let al = best_alignment(&a, &base, 30).expect("must align");
        assert_eq!((al.offset_sec / ITEM_SECONDS).round() as i64, 10);
        assert!(al.ber < 1e-9);
    }

    #[test]
    fn unrelated_fingerprints_declined() {
        let a: Vec<u32> = (0..300u32).map(|i| i.wrapping_mul(2654435761)).collect();
        let b: Vec<u32> = (0..300u32)
            .map(|i| !i.wrapping_mul(40503) ^ 0x5555_5555)
            .collect();
        assert!(identity_match(&a, &b, 20).is_none());
    }

    #[test]
    fn parse_json_ok() {
        let j = br#"{"duration":123.4,"fingerprint":[1,2,3,4294967295]}"#;
        let f = parse_fpcalc_json(j).expect("parse");
        assert_eq!(f.raw.len(), 4);
        assert_eq!(f.raw[3], 4294967295);
        assert!((f.duration - 123.4).abs() < 1e-6);
    }

    #[test]
    fn file_url_keeps_unix_absolute_and_strips_win_drive() {
        assert_eq!(
            local_file("file:///etc/movie.mkv").unwrap(),
            PathBuf::from("/etc/movie.mkv")
        );
        assert_eq!(
            local_file("file://localhost/etc/movie.mkv").unwrap(),
            PathBuf::from("/etc/movie.mkv")
        );
        assert_eq!(
            local_file("file:///C:/media/x.mkv").unwrap(),
            PathBuf::from("C:/media/x.mkv")
        );
        assert!(local_file("https://cdn/x.mkv").is_none());
    }
}
