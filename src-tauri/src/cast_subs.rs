use futures_util::StreamExt;
use serde::Deserialize;
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;
use uuid::Uuid;

const SUBTITLE_FFMPEG_TIMEOUT: Duration = Duration::from_secs(90);
const MAX_SUBTITLE_BYTES: usize = 8 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize)]
pub struct CastSub {
    pub kind: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub src_index: Option<u32>,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub off: bool,
}

#[derive(Clone, Debug, Deserialize)]
pub struct CastSubStyle {
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    #[serde(default = "default_white")]
    pub font_color: String,
    #[serde(default = "default_black")]
    pub border_color: String,
    #[serde(default)]
    pub border_size: u32,
    #[serde(default = "default_margin")]
    pub margin_y: u32,
    #[serde(default = "default_align")]
    pub align_x: String,
}

fn default_font_size() -> u32 {
    28
}

fn default_white() -> String {
    "#FFFFFF".to_string()
}

fn default_black() -> String {
    "#000000".to_string()
}

fn default_margin() -> u32 {
    12
}

fn default_align() -> String {
    "center".to_string()
}

impl Default for CastSubStyle {
    fn default() -> Self {
        CastSubStyle {
            font_size: default_font_size(),
            font_color: default_white(),
            border_color: default_black(),
            border_size: 0,
            margin_y: default_margin(),
            align_x: default_align(),
        }
    }
}

pub struct PreparedSub {
    pub path: PathBuf,
    pub force_style: String,
}

fn hex_to_ass_bgr(hex: &str) -> String {
    let clean = hex.trim().trim_start_matches('#');
    let parsed = if clean.len() == 6 {
        u32::from_str_radix(clean, 16).ok()
    } else if clean.len() == 3 {
        let r = &clean[0..1];
        let g = &clean[1..2];
        let b = &clean[2..3];
        u32::from_str_radix(&format!("{r}{r}{g}{g}{b}{b}"), 16).ok()
    } else {
        None
    };
    match parsed {
        Some(rgb) => {
            let r = (rgb >> 16) & 0xFF;
            let g = (rgb >> 8) & 0xFF;
            let b = rgb & 0xFF;
            format!("&H00{:02X}{:02X}{:02X}", b, g, r)
        }
        None => "&H00FFFFFF".to_string(),
    }
}

fn ass_alignment(align_x: &str) -> u32 {
    match align_x.to_lowercase().as_str() {
        "left" => 1,
        "right" => 3,
        _ => 2,
    }
}

pub fn build_force_style(style: &CastSubStyle) -> String {
    let primary = hex_to_ass_bgr(&style.font_color);
    let outline_color = hex_to_ass_bgr(&style.border_color);
    let outline = if style.border_size == 0 {
        2
    } else {
        style.border_size
    };
    let alignment = ass_alignment(&style.align_x);
    format!(
        "Fontsize={},PrimaryColour={},OutlineColour={},BorderStyle=1,Outline={},Shadow=0,Alignment={},MarginV={}",
        style.font_size, primary, outline_color, outline, alignment, style.margin_y,
    )
}

pub fn burn_filter(path: &str, force_style: &str) -> String {
    let escaped = escape_subtitles_path(Path::new(path));
    format!("subtitles={}:force_style='{}'", escaped, force_style)
}

pub fn escape_subtitles_path(path: &Path) -> String {
    let raw = path.to_string_lossy().replace('\\', "/");
    let drive_fixed = if raw.len() >= 2 && raw.as_bytes()[1] == b':' {
        let (drive, rest) = raw.split_at(1);
        format!("{}\\:{}", drive, &rest[1..])
    } else {
        raw
    };
    drive_fixed.replace('\'', "\\'")
}

fn castsubs_dir() -> PathBuf {
    let dir = std::env::temp_dir().join("harbor-castsubs");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn sniff_format(url: &str, content_type: Option<&str>, declared: Option<&str>) -> String {
    if let Some(fmt) = declared {
        let f = fmt.to_lowercase();
        if f == "srt" || f == "ass" || f == "ssa" || f == "vtt" {
            return f;
        }
    }
    let lower = url.to_lowercase();
    if lower.ends_with(".vtt") || content_type.is_some_and(|c| c.contains("vtt")) {
        return "vtt".to_string();
    }
    if lower.ends_with(".ass") || lower.ends_with(".ssa") {
        return "ass".to_string();
    }
    "srt".to_string()
}

async fn download_remote(
    url: &str,
    declared_format: Option<&str>,
    dir: &Path,
    cancellation: &tokio_util::sync::CancellationToken,
) -> Option<PathBuf> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .gzip(true)
        .build()
        .ok()?;
    let request = client
        .get(url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        )
        .header("Accept", "*/*")
        .send();
    let res = tokio::select! {
        result = request => result.ok()?,
        _ = cancellation.cancelled() => return None,
    };
    if !res.status().is_success() {
        return None;
    }
    let ct = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_lowercase());
    let fmt = sniff_format(url, ct.as_deref(), declared_format);
    let mut raw = Vec::new();
    let mut stream = res.bytes_stream();
    loop {
        let next = tokio::select! {
            chunk = stream.next() => chunk,
            _ = cancellation.cancelled() => return None,
        };
        let Some(chunk) = next else { break };
        let chunk = chunk.ok()?;
        if raw.len().saturating_add(chunk.len()) > MAX_SUBTITLE_BYTES {
            return None;
        }
        raw.extend_from_slice(&chunk);
    }
    let bytes: Vec<u8> = if raw.len() >= 2 && raw[0] == 0x1f && raw[1] == 0x8b {
        let decoder = flate2::read::GzDecoder::new(&raw[..]);
        let mut decoded = Vec::with_capacity(raw.len() * 4);
        decoder
            .take((MAX_SUBTITLE_BYTES + 1) as u64)
            .read_to_end(&mut decoded)
            .ok()?;
        if decoded.len() > MAX_SUBTITLE_BYTES {
            return None;
        }
        decoded
    } else {
        raw.to_vec()
    };
    let raw_path = dir.join(format!("{}.{}", Uuid::new_v4(), fmt));
    std::fs::write(&raw_path, &bytes).ok()?;
    if fmt == "vtt" {
        convert_to_srt(&raw_path, dir, cancellation).await
    } else {
        Some(raw_path)
    }
}

fn is_http_url(s: &str) -> bool {
    let lower = s.to_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://")
}

async fn prepare_local(
    path: &str,
    declared_format: Option<&str>,
    dir: &Path,
    cancellation: &tokio_util::sync::CancellationToken,
) -> Option<PathBuf> {
    let src = PathBuf::from(path);
    if !src.is_file() {
        return None;
    }
    let fmt = sniff_format(path, None, declared_format);
    if fmt == "vtt" {
        convert_to_srt(&src, dir, cancellation).await
    } else {
        Some(src)
    }
}

async fn convert_to_srt(
    input: &Path,
    dir: &Path,
    cancellation: &tokio_util::sync::CancellationToken,
) -> Option<PathBuf> {
    let ffmpeg = crate::transcode::locate_ffmpeg()?;
    let out = dir.join(format!("{}.srt", Uuid::new_v4()));
    let mut cmd = tokio::process::Command::new(&ffmpeg);
    cmd.arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-y")
        .arg("-i")
        .arg(input)
        .arg(&out);
    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    let output = crate::process::output_with_timeout_or_cancel(
        &mut cmd,
        SUBTITLE_FFMPEG_TIMEOUT,
        cancellation,
    )
    .await
    .ok()?;
    if output.status.success() && out.is_file() {
        Some(out)
    } else {
        None
    }
}

async fn extract_embedded(
    source_url: &str,
    src_index: u32,
    headers: &HashMap<String, String>,
    dir: &Path,
    cancellation: &tokio_util::sync::CancellationToken,
) -> Option<PathBuf> {
    let ffmpeg = crate::transcode::locate_ffmpeg()?;
    let out = dir.join(format!("{}.srt", Uuid::new_v4()));
    let mut cmd = tokio::process::Command::new(&ffmpeg);
    cmd.arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-y");
    apply_ffmpeg_headers(&mut cmd, headers);
    cmd.arg("-i")
        .arg(source_url)
        .arg("-map")
        .arg(format!("0:s:{}", src_index))
        .arg("-c:s")
        .arg("srt")
        .arg(&out);
    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    let output = crate::process::output_with_timeout_or_cancel(
        &mut cmd,
        SUBTITLE_FFMPEG_TIMEOUT,
        cancellation,
    )
    .await
    .ok()?;
    if output.status.success() && out.is_file() {
        Some(out)
    } else {
        None
    }
}

fn apply_ffmpeg_headers(cmd: &mut tokio::process::Command, headers: &HashMap<String, String>) {
    for (k, v) in headers {
        if k.to_lowercase() == "user-agent" {
            cmd.arg("-user_agent").arg(v);
        }
    }
    let mut blob = String::new();
    for (k, v) in headers {
        if k.to_lowercase() == "user-agent" {
            continue;
        }
        blob.push_str(&format!("{}: {}\r\n", k, v));
    }
    if !blob.is_empty() {
        cmd.arg("-headers").arg(blob);
    }
}

pub async fn prepare(
    sub: &CastSub,
    style: &CastSubStyle,
    source_url: &str,
    headers: &HashMap<String, String>,
    seek_start: f64,
    cancellation: &tokio_util::sync::CancellationToken,
) -> Option<PreparedSub> {
    if sub.off {
        return None;
    }
    let dir = castsubs_dir();
    let base = match sub.kind.as_str() {
        "external" => {
            let url = sub.url.as_deref()?;
            if is_http_url(url) {
                download_remote(url, sub.format.as_deref(), &dir, cancellation).await?
            } else {
                prepare_local(url, sub.format.as_deref(), &dir, cancellation).await?
            }
        }
        "embedded" => {
            let idx = sub.src_index?;
            extract_embedded(source_url, idx, headers, &dir, cancellation).await?
        }
        _ => return None,
    };
    let path = if seek_start > 1.0 {
        let shifted = shift_subtitle(&base, seek_start, &dir, cancellation).await;
        shifted.unwrap_or(base)
    } else {
        base
    };
    Some(PreparedSub {
        path,
        force_style: build_force_style(style),
    })
}

async fn shift_subtitle(
    input: &Path,
    seek_start: f64,
    dir: &Path,
    cancellation: &tokio_util::sync::CancellationToken,
) -> Option<PathBuf> {
    let ffmpeg = crate::transcode::locate_ffmpeg()?;
    let out = dir.join(format!("{}.srt", Uuid::new_v4()));
    let mut cmd = tokio::process::Command::new(&ffmpeg);
    cmd.arg("-hide_banner")
        .arg("-loglevel")
        .arg("error")
        .arg("-y")
        .arg("-ss")
        .arg(format!("{:.3}", seek_start))
        .arg("-i")
        .arg(input)
        .arg("-c:s")
        .arg("srt")
        .arg(&out);
    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    let output = crate::process::output_with_timeout_or_cancel(
        &mut cmd,
        SUBTITLE_FFMPEG_TIMEOUT,
        cancellation,
    )
    .await
    .ok()?;
    if output.status.success() && out.is_file() {
        Some(out)
    } else {
        None
    }
}

pub fn cleanup() {
    let _ = std::fs::remove_dir_all(castsubs_dir());
}
