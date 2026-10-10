use std::collections::HashMap;
use std::time::Duration;
use tokio::process::Command;

use crate::transcode::locate_ffmpeg;

use super::vad;

const NOISE_DB: &str = "-30dB";
const MIN_SILENCE: &str = "0.35";
const SPEECH_FILTER: &str = "aformat=channel_layouts=mono,highpass=f=200,lowpass=f=3000";
const HARD_TIMEOUT_SECS: u64 = 90;

fn header_blob(headers: &HashMap<String, String>) -> String {
    let mut blob = String::new();
    for (k, v) in headers {
        if k.to_lowercase() == "user-agent" {
            continue;
        }
        blob.push_str(&format!("{}: {}\r\n", k, v));
    }
    blob
}

fn parse_after(line: &str, tag: &str) -> Option<f32> {
    let idx = line.find(tag)?;
    let rest = &line[idx + tag.len()..];
    rest.split_whitespace().next()?.parse::<f32>().ok()
}

fn complement(silences: &mut [(f32, f32)], len: f32, offset: f32) -> Vec<(f32, f32)> {
    silences.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    let mut speech = Vec::new();
    let mut cursor = 0.0f32;
    for &(s, e) in silences.iter() {
        if s > cursor {
            speech.push((cursor + offset, s + offset));
        }
        cursor = cursor.max(e);
    }
    if cursor < len {
        speech.push((cursor + offset, len + offset));
    }
    speech
}

pub async fn speech_intervals(
    url: &str,
    headers: &HashMap<String, String>,
    start_sec: f32,
    len_sec: f32,
) -> Result<Vec<(f32, f32)>, String> {
    let Some(ff) = locate_ffmpeg() else {
        return Err("ffmpeg not found".into());
    };
    let mut cmd = Command::new(&ff);
    cmd.arg("-hide_banner").arg("-nostats");
    let ua = headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "user-agent")
        .map(|(_, v)| v.clone());
    cmd.arg("-user_agent")
        .arg(ua.unwrap_or_else(|| "Harbor".into()));
    let blob = header_blob(headers);
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
        .arg("0:a:0")
        .arg("-af")
        .arg(format!(
            "{},silencedetect=noise={}:d={}",
            SPEECH_FILTER, NOISE_DB, MIN_SILENCE
        ))
        .arg("-f")
        .arg("null")
        .arg("-");
    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::piped());
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
    let mut silences: Vec<(f32, f32)> = Vec::new();
    let mut open_start: Option<f32> = None;
    for line in String::from_utf8_lossy(&output.stderr).lines() {
        if let Some(value) = parse_after(line, "silence_start:") {
            open_start = Some(value);
        } else if let Some(value) = parse_after(line, "silence_end:") {
            if let Some(start) = open_start.take() {
                silences.push((start, value));
            }
        }
    }
    if let Some(start) = open_start {
        silences.push((start, len_sec));
    }

    Ok(complement(&mut silences, len_sec, start_sec))
}

pub async fn speech_intervals_reference(
    url: &str,
    headers: &HashMap<String, String>,
    start_sec: f32,
    len_sec: f32,
) -> Result<Vec<(f32, f32)>, String> {
    match vad::speech_intervals_ml(
        url,
        headers,
        start_sec,
        len_sec,
        &vad::VadConfig::default(),
        vad::Backend::Heuristic,
        "0:a:0",
    )
    .await
    {
        Ok(iv) => Ok(iv),
        Err(_) => speech_intervals(url, headers, start_sec, len_sec).await,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn complement_inverts_silence() {
        let mut sil = vec![(2.0f32, 4.0f32), (7.0f32, 8.0f32)];
        let speech = complement(&mut sil, 10.0, 100.0);
        assert_eq!(speech, vec![(100.0, 102.0), (104.0, 107.0), (108.0, 110.0)]);
    }

    #[test]
    fn parse_after_reads_value() {
        assert_eq!(
            parse_after(
                "[silencedetect @ 0x1] silence_start: 12.34",
                "silence_start:"
            ),
            Some(12.34)
        );
    }
}
