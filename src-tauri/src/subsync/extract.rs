use std::collections::HashMap;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::transcode::locate_ffmpeg;

const NOISE_DB: &str = "-30dB";
const MIN_SILENCE: &str = "0.35";
const SPEECH_FILTER: &str = "aformat=channel_layouts=mono,highpass=f=200,lowpass=f=3000";
const HARD_TIMEOUT_SECS: u64 = 90;

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
    cmd.arg("-user_agent").arg(ua.unwrap_or_else(|| "Harbor".into()));
    let blob = crate::transcode::header_blob(headers);
    if !blob.is_empty() {
        cmd.arg("-headers").arg(blob);
    }
    cmd.arg("-protocol_whitelist")
        .arg(crate::transcode::input_protocol_whitelist(url))
        .arg("-ss")
        .arg(format!("{}", start_sec))
        .arg("-t")
        .arg(format!("{}", len_sec))
        .arg("-i")
        .arg(url)
        .arg("-vn")
        .arg("-map")
        .arg("0:a:0")
        .arg("-af")
        .arg(format!("{},silencedetect=noise={}:d={}", SPEECH_FILTER, NOISE_DB, MIN_SILENCE))
        .arg("-f")
        .arg("null")
        .arg("-");
    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000 | 0x0000_4000);

    let mut child = cmd.spawn().map_err(|e| format!("spawn ffmpeg: {}", e))?;
    let stderr = child.stderr.take().ok_or("no stderr")?;
    let mut lines = BufReader::new(stderr).lines();

    let mut silences: Vec<(f32, f32)> = Vec::new();
    let mut open_start: Option<f32> = None;
    let collect = async {
        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(v) = parse_after(&line, "silence_start:") {
                open_start = Some(v);
            } else if let Some(v) = parse_after(&line, "silence_end:") {
                if let Some(s) = open_start.take() {
                    silences.push((s, v));
                }
            }
        }
    };
    let _ = tokio::time::timeout(Duration::from_secs(HARD_TIMEOUT_SECS), collect).await;
    let _ = child.kill().await;

    Ok(complement(&mut silences, len_sec, start_sec))
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
            parse_after("[silencedetect @ 0x1] silence_start: 12.34", "silence_start:"),
            Some(12.34)
        );
    }
}
