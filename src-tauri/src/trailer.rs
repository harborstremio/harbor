use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

const METADATA_TIMEOUT: Duration = Duration::from_secs(15);
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(120);
const CACHE_MAX_BYTES: u64 = 1_500_000_000;
const CACHE_MAX_AGE: Duration = Duration::from_secs(14 * 24 * 60 * 60);

const FORMAT_LOW: &str =
    "18/best[height<=360][ext=mp4][vcodec!=none][acodec!=none]/worst[ext=mp4][vcodec!=none][acodec!=none]";
const FORMAT_HIGH: &str =
    "22/18/best[ext=mp4][vcodec!=none][acodec!=none][height<=720]/best[vcodec!=none][acodec!=none]";
const FORMAT_1080: &str =
    "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]/best";
const FORMAT_BEST: &str = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best";

fn cache_dir() -> PathBuf {
    std::env::temp_dir().join("harbor-trailers")
}

fn sanitize_id(id: &str) -> Result<String, String> {
    let safe: String = id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    if safe.is_empty() {
        return Err("invalid video id".to_string());
    }
    Ok(safe)
}

fn normalize_quality(q: Option<String>) -> &'static str {
    match q.as_deref() {
        Some("low") | Some("360p") => "360p",
        Some("1080p") => "1080p",
        Some("best") => "best",
        _ => "720p",
    }
}

fn quality_path(id: &str, quality: &str) -> PathBuf {
    cache_dir().join(format!("{}-{}.mp4", id, quality))
}

fn format_for(quality: &str) -> &'static str {
    match quality {
        "360p" => FORMAT_LOW,
        "1080p" => FORMAT_1080,
        "best" => FORMAT_BEST,
        _ => FORMAT_HIGH,
    }
}

fn needs_merge(quality: &str) -> bool {
    matches!(quality, "1080p" | "best")
}

fn cached_info(path: &Path, quality: &str, size: u64) -> TrailerInfo {
    TrailerInfo {
        file_path: path.to_string_lossy().to_string(),
        quality: quality.to_string(),
        duration_seconds: 0,
        title: String::new(),
        size_bytes: size,
    }
}

struct YtDlpOutput {
    success: bool,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

async fn collect_sidecar_output(
    cmd: tauri_plugin_shell::process::Command,
    args: Vec<String>,
    timeout: Duration,
    label: &str,
) -> Result<YtDlpOutput, String> {
    let (mut events, child) = cmd
        .args(args)
        .spawn()
        .map_err(|error| format!("yt-dlp {label}: {error}"))?;
    let collect = async {
        let mut success = false;
        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => stdout.extend(bytes),
                CommandEvent::Stderr(bytes) => stderr.extend(bytes),
                CommandEvent::Terminated(payload) => success = payload.code == Some(0),
                CommandEvent::Error(error) => stderr.extend_from_slice(error.as_bytes()),
                _ => {}
            }
        }
        YtDlpOutput {
            success,
            stdout,
            stderr,
        }
    };
    match tokio::time::timeout(timeout, collect).await {
        Ok(output) => Ok(output),
        Err(_) => {
            crate::process::terminate_descendants(child.pid()).await;
            let _ = child.kill();
            while events.recv().await.is_some() {}
            Err(format!("yt-dlp {label} timed out"))
        }
    }
}

async fn run_yt_dlp(
    app: &tauri::AppHandle,
    args: Vec<String>,
    timeout: Duration,
    label: &str,
) -> Result<YtDlpOutput, String> {
    let bundled = match app.shell().sidecar("yt-dlp") {
        Ok(cmd) => collect_sidecar_output(cmd, args.clone(), timeout, label).await,
        Err(error) => Err(format!("sidecar init: {error}")),
    };

    #[cfg(not(target_os = "linux"))]
    return bundled;

    #[cfg(target_os = "linux")]
    match bundled {
        Ok(output) => return Ok(output),
        Err(error) if error.contains("timed out") => return Err(error),
        Err(error) => {
            eprintln!("[harbor::trailer] bundled yt-dlp unavailable: {error}; trying system yt-dlp")
        }
    }

    #[cfg(target_os = "linux")]
    {
        let mut command = tokio::process::Command::new("yt-dlp");
        command.args(args);
        let output = crate::process::output_with_timeout(&mut command, timeout)
            .await
            .map_err(|e| format!("yt-dlp {label}: {e}"))?;

        return Ok(YtDlpOutput {
            success: output.status.success(),
            stdout: output.stdout,
            stderr: output.stderr,
        });
    }
}

pub fn sweep_cache() {
    let dir = cache_dir();
    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    let now = SystemTime::now();
    let mut keep: Vec<(PathBuf, SystemTime, u64)> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !meta.is_file() {
            continue;
        }
        let mtime = meta.modified().unwrap_or(now);
        let age = now.duration_since(mtime).unwrap_or_default();
        if age > CACHE_MAX_AGE {
            let _ = std::fs::remove_file(&path);
            continue;
        }
        keep.push((path, mtime, meta.len()));
    }
    let total: u64 = keep.iter().map(|(_, _, s)| s).sum();
    if total <= CACHE_MAX_BYTES {
        return;
    }
    keep.sort_by_key(|(_, m, _)| *m);
    let mut to_evict = total - CACHE_MAX_BYTES;
    for (path, _, size) in keep {
        if to_evict == 0 {
            break;
        }
        let _ = std::fs::remove_file(&path);
        to_evict = to_evict.saturating_sub(size);
    }
}

#[derive(Serialize)]
pub struct TrailerInfo {
    pub file_path: String,
    pub quality: String,
    pub duration_seconds: u64,
    pub title: String,
    pub size_bytes: u64,
}

#[tauri::command]
pub async fn fetch_trailer(
    video_id: String,
    quality: Option<String>,
    app: tauri::AppHandle,
) -> Result<TrailerInfo, String> {
    let quality = normalize_quality(quality);
    let safe_id = sanitize_id(&video_id)?;
    let dir = cache_dir();
    let file_path = quality_path(&safe_id, quality);

    if let Ok(meta) = std::fs::metadata(&file_path) {
        if meta.len() > 1024 {
            return Ok(cached_info(&file_path, quality, meta.len()));
        }
    }

    std::fs::create_dir_all(&dir).map_err(|e| format!("cache dir: {}", e))?;
    let url = format!("https://www.youtube.com/watch?v={}", video_id);

    let meta_output = run_yt_dlp(
        &app,
        vec![
            "-j".into(),
            "--no-playlist".into(),
            "--no-warnings".into(),
            "--skip-download".into(),
            url.clone(),
        ],
        METADATA_TIMEOUT,
        "metadata",
    )
    .await?;

    if !meta_output.success {
        let stderr = String::from_utf8_lossy(&meta_output.stderr);
        return Err(format!("yt-dlp failed: {}", stderr));
    }

    let meta: serde_json::Value = serde_json::from_slice(&meta_output.stdout)
        .map_err(|e| format!("metadata parse: {}", e))?;

    let title = meta["title"].as_str().unwrap_or("").to_string();
    let duration_seconds = meta["duration"].as_f64().unwrap_or(0.0) as u64;

    let file_path_str = file_path.to_string_lossy().to_string();
    let ffmpeg = crate::transcode::locate_ffmpeg();
    let wants_merge = needs_merge(quality) && ffmpeg.is_some();
    let effective_format = if needs_merge(quality) && ffmpeg.is_none() {
        FORMAT_HIGH
    } else {
        format_for(quality)
    };
    let mut dl_args: Vec<String> = vec![
        "-f".into(),
        effective_format.into(),
        "-o".into(),
        file_path_str.clone(),
        "--no-playlist".into(),
        "--no-warnings".into(),
        "--quiet".into(),
        "--force-overwrites".into(),
    ];
    if wants_merge {
        if let Some(ff) = &ffmpeg {
            dl_args.push("--ffmpeg-location".into());
            dl_args.push(ff.to_string_lossy().to_string());
        }
        dl_args.push("--merge-output-format".into());
        dl_args.push("mp4".into());
    }
    dl_args.push(url.clone());
    let dl_timeout = if wants_merge {
        Duration::from_secs(240)
    } else {
        DOWNLOAD_TIMEOUT
    };
    let download_output = run_yt_dlp(&app, dl_args, dl_timeout, "download").await?;

    if !download_output.success {
        let stderr = String::from_utf8_lossy(&download_output.stderr);
        return Err(format!("yt-dlp download failed: {}", stderr));
    }

    let file_meta = std::fs::metadata(&file_path).map_err(|e| format!("file check: {}", e))?;
    let size_bytes = file_meta.len();

    if size_bytes < 1024 {
        let _ = std::fs::remove_file(&file_path);
        return Err("downloaded file is too small".to_string());
    }

    sweep_cache();

    Ok(TrailerInfo {
        file_path: file_path_str,
        quality: quality.to_string(),
        duration_seconds,
        title,
        size_bytes,
    })
}
