use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
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
    "bestvideo[height<=1080][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/bestvideo[height<=1080]+bestaudio/best[height<=1080]";
const FORMAT_BEST: &str =
    "bestvideo[ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/bestvideo+bestaudio/best";
const FORMAT_LOW_MERGED: &str =
    "bestvideo[height<=360][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=360]+bestaudio";
const FORMAT_HIGH_MERGED: &str =
    "bestvideo[height<=720][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio";

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

fn format_for(quality: &str, can_merge: bool) -> &'static str {
    match (quality, can_merge) {
        ("1080p", true) => FORMAT_1080,
        ("best", true) => FORMAT_BEST,
        ("360p", _) => FORMAT_LOW,
        _ => FORMAT_HIGH,
    }
}

fn should_merge(quality: &str, ffmpeg_available: bool) -> bool {
    ffmpeg_available && matches!(quality, "1080p" | "best")
}

fn fallback_format(
    quality: &str,
    primary_merged: bool,
    ffmpeg_available: bool,
) -> Option<(&'static str, bool)> {
    if primary_merged {
        return Some((FORMAT_HIGH, false));
    }
    if !ffmpeg_available {
        return None;
    }
    match quality {
        "360p" => Some((FORMAT_LOW_MERGED, true)),
        "720p" => Some((FORMAT_HIGH_MERGED, true)),
        _ => None,
    }
}

fn cached_info(path: &Path, quality: &str, size: u64, stream_url: Option<String>) -> TrailerInfo {
    TrailerInfo {
        file_path: path.to_string_lossy().to_string(),
        stream_url,
        quality: quality.to_string(),
        duration_seconds: 0,
        title: String::new(),
        size_bytes: size,
    }
}

struct YtDlpOutput {
    success: bool,
    exit_code: Option<i32>,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

fn yt_dlp_failure(source: &str, label: &str, output: &YtDlpOutput) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let detail = if stderr.trim().is_empty() {
        stdout.trim()
    } else {
        stderr.trim()
    };
    let status = output
        .exit_code
        .map(|code| code.to_string())
        .unwrap_or_else(|| "signal".to_string());
    if detail.is_empty() {
        format!("{source} yt-dlp {label} exited with status {status}")
    } else {
        format!("{source} yt-dlp {label} exited with status {status}: {detail}")
    }
}

async fn run_yt_dlp(
    app: &tauri::AppHandle,
    args: Vec<String>,
    timeout: Duration,
    label: &str,
) -> Result<YtDlpOutput, String> {
    #[cfg(target_os = "linux")]
    {
        let run = async {
            let system_failure = match tokio::process::Command::new("yt-dlp")
                .args(&args)
                .output()
                .await
            {
                Ok(output) => {
                    let output = YtDlpOutput {
                        success: output.status.success(),
                        exit_code: output.status.code(),
                        stdout: output.stdout,
                        stderr: output.stderr,
                    };
                    if output.success {
                        eprintln!("[harbor::trailer] system yt-dlp completed {label}");
                        return Ok(output);
                    }
                    yt_dlp_failure("system", label, &output)
                }
                Err(error) => format!("system yt-dlp {label} could not start: {error}"),
            };
            eprintln!("[harbor::trailer] {system_failure}; trying bundled yt-dlp");

            let bundled =
                match app.shell().sidecar("yt-dlp") {
                    Ok(command) => command.args(args).output().await.map_err(|error| {
                        format!("bundled yt-dlp {label} could not start: {error}")
                    }),
                    Err(error) => Err(format!("bundled yt-dlp {label} unavailable: {error}")),
                };
            match bundled {
                Ok(output) => {
                    let output = YtDlpOutput {
                        success: output.status.success(),
                        exit_code: output.status.code(),
                        stdout: output.stdout,
                        stderr: output.stderr,
                    };
                    if output.success {
                        eprintln!("[harbor::trailer] bundled yt-dlp completed {label}");
                        Ok(output)
                    } else {
                        Err(format!(
                            "{system_failure}; {}",
                            yt_dlp_failure("bundled", label, &output)
                        ))
                    }
                }
                Err(bundled_failure) => Err(format!("{system_failure}; {bundled_failure}")),
            }
        };
        return tokio::time::timeout(timeout, run)
            .await
            .map_err(|_| format!("yt-dlp {label} timed out after {}s", timeout.as_secs()))?;
    }

    #[cfg(not(target_os = "linux"))]
    {
        let command = app
            .shell()
            .sidecar("yt-dlp")
            .map_err(|error| format!("sidecar init: {error}"))?;
        let output = tokio::time::timeout(timeout, command.args(args).output())
            .await
            .map_err(|_| format!("yt-dlp {label} timed out"))?
            .map_err(|error| format!("yt-dlp {label}: {error}"))?;
        Ok(YtDlpOutput {
            success: output.status.success(),
            exit_code: output.status.code(),
            stdout: output.stdout,
            stderr: output.stderr,
        })
    }
}

fn download_args(format: &str, output: &str, url: &str, ffmpeg: Option<&Path>) -> Vec<String> {
    let mut args = vec![
        "-f".into(),
        format.into(),
        "-o".into(),
        output.into(),
        "--no-playlist".into(),
        "--no-warnings".into(),
        "--quiet".into(),
        "--force-overwrites".into(),
        "--no-mtime".into(),
    ];
    if let Some(path) = ffmpeg {
        args.push("--ffmpeg-location".into());
        args.push(path.to_string_lossy().to_string());
        args.push("--merge-output-format".into());
        args.push("mp4".into());
    }
    args.push(url.into());
    args
}

fn completed_download(output: Result<YtDlpOutput, String>, label: &str) -> Result<(), String> {
    match output {
        Ok(output) if output.success => Ok(()),
        Ok(output) => Err(yt_dlp_failure("bundled", label, &output)),
        Err(error) => Err(error),
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
    pub stream_url: Option<String>,
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
    proxy_state: tauri::State<'_, crate::stream_proxy::ProxyState>,
) -> Result<TrailerInfo, String> {
    let quality = normalize_quality(quality);
    let safe_id = sanitize_id(&video_id)?;
    let dir = cache_dir();
    let file_path = quality_path(&safe_id, quality);

    if let Ok(meta) = std::fs::metadata(&file_path) {
        if meta.len() > 1024 {
            let stream_url = trailer_stream_url(&proxy_state, &file_path).await?;
            return Ok(cached_info(&file_path, quality, meta.len(), stream_url));
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
    let wants_merge = should_merge(quality, ffmpeg.is_some());
    let effective_format = format_for(quality, wants_merge);
    let merge_ffmpeg = if wants_merge { ffmpeg.as_deref() } else { None };
    let dl_args = download_args(effective_format, &file_path_str, &url, merge_ffmpeg);
    let dl_timeout = if wants_merge {
        Duration::from_secs(240)
    } else {
        DOWNLOAD_TIMEOUT
    };
    let primary = completed_download(
        run_yt_dlp(&app, dl_args, dl_timeout, "download").await,
        "download",
    );

    if let Err(primary_error) = primary {
        let Some((fallback_format, fallback_merges)) =
            fallback_format(quality, wants_merge, ffmpeg.is_some())
        else {
            eprintln!("[harbor::trailer] download failed quality={quality}: {primary_error}");
            return Err(primary_error);
        };
        let fallback_label = if fallback_merges {
            "adaptive fallback"
        } else {
            "progressive fallback"
        };
        eprintln!(
            "[harbor::trailer] primary download failed quality={quality}: {primary_error}; retrying {fallback_label}"
        );
        let _ = std::fs::remove_file(&file_path);
        let fallback_ffmpeg = if fallback_merges {
            ffmpeg.as_deref()
        } else {
            None
        };
        let fallback_args = download_args(fallback_format, &file_path_str, &url, fallback_ffmpeg);
        let fallback_timeout = if fallback_merges {
            Duration::from_secs(240)
        } else {
            DOWNLOAD_TIMEOUT
        };
        completed_download(
            run_yt_dlp(&app, fallback_args, fallback_timeout, fallback_label).await,
            fallback_label,
        )
        .map_err(|fallback_error| {
            eprintln!(
                "[harbor::trailer] {fallback_label} failed quality={quality}: {fallback_error}"
            );
            format!(
                "primary trailer download failed: {primary_error}; {fallback_label} failed: {fallback_error}"
            )
        })?;
        eprintln!("[harbor::trailer] {fallback_label} completed quality={quality}");
    }

    let file_meta = std::fs::metadata(&file_path).map_err(|e| format!("file check: {}", e))?;
    let size_bytes = file_meta.len();

    if size_bytes < 1024 {
        let _ = std::fs::remove_file(&file_path);
        return Err("downloaded file is too small".to_string());
    }

    eprintln!("[harbor::trailer] verified download bytes={size_bytes} quality={quality}");

    sweep_cache();
    let stream_url = trailer_stream_url(&proxy_state, &file_path).await?;

    Ok(TrailerInfo {
        file_path: file_path_str,
        stream_url,
        quality: quality.to_string(),
        duration_seconds,
        title,
        size_bytes,
    })
}

#[cfg(target_os = "linux")]
async fn trailer_stream_url(
    proxy_state: &crate::stream_proxy::ProxyState,
    path: &Path,
) -> Result<Option<String>, String> {
    proxy_state
        .register_local_file(path.to_path_buf())
        .await
        .map(Some)
}

#[cfg(not(target_os = "linux"))]
async fn trailer_stream_url(
    _proxy_state: &crate::stream_proxy::ProxyState,
    _path: &Path,
) -> Result<Option<String>, String> {
    Ok(None)
}
