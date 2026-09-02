use serde::Serialize;
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Serialize)]
pub struct ScannedFile {
    path: String,
    filename: String,
    size: u64,
    #[serde(rename = "subtitlePaths")]
    subtitle_paths: Vec<String>,
}

const VIDEO_EXTS: &[&str] = &[
    "mkv", "mp4", "m4v", "mov", "avi", "wmv", "webm", "ts", "m2ts", "mpg", "mpeg", "flv", "ogv",
];

const SUBTITLE_EXTS: &[&str] = &["srt", "ass", "ssa", "vtt"];

pub(crate) fn adjacent_subtitles(video: &std::path::Path) -> Vec<String> {
    let Some(parent) = video.parent() else {
        return Vec::new();
    };
    let Some(video_stem) = video.file_stem().and_then(|s| s.to_str()) else {
        return Vec::new();
    };
    let Ok(entries) = std::fs::read_dir(parent) else {
        return Vec::new();
    };
    let video_stem_lower = video_stem.to_ascii_lowercase();
    let sibling_paths = entries
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .file_type()
                .map(|kind| kind.is_file())
                .unwrap_or(false)
        })
        .map(|entry| entry.path())
        .collect::<Vec<_>>();
    let video_count = sibling_paths
        .iter()
        .filter(|path| {
            path.extension()
                .and_then(|extension| extension.to_str())
                .map(|extension| VIDEO_EXTS.contains(&extension.to_ascii_lowercase().as_str()))
                .unwrap_or(false)
        })
        .count();
    let mut subtitles = sibling_paths
        .into_iter()
        .filter_map(|path| {
            let extension = path.extension()?.to_str()?.to_ascii_lowercase();
            if !SUBTITLE_EXTS.contains(&extension.as_str()) {
                return None;
            }
            // A conventional movie folder contains one video. In that case
            // every subtitle beside it belongs to that movie even when the
            // release filenames differ (a common layout after upgrades).
            if video_count == 1 {
                return Some(path.to_string_lossy().to_string());
            }
            let stem = path.file_stem()?.to_str()?.to_ascii_lowercase();
            let suffix = stem.strip_prefix(&video_stem_lower)?;
            if !suffix.is_empty()
                && !suffix.starts_with('.')
                && !suffix.starts_with('-')
                && !suffix.starts_with('_')
            {
                return None;
            }
            Some(path.to_string_lossy().to_string())
        })
        .collect::<Vec<_>>();
    subtitles.sort();
    subtitles
}

#[tauri::command]
pub async fn harbor_scan_folder(
    folder: String,
    min_size_mb: Option<u64>,
) -> Result<Vec<ScannedFile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = PathBuf::from(&folder);
        if !root.exists() {
            return Err(format!("folder does not exist: {}", folder));
        }
        let min_bytes = min_size_mb.unwrap_or(50).saturating_mul(1024 * 1024);
        let mut out = Vec::new();
        for entry in WalkDir::new(&root)
            .max_depth(8)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }
            let p = entry.path();
            let ext = p
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s.to_ascii_lowercase());
            if !ext
                .as_deref()
                .map(|e| VIDEO_EXTS.contains(&e))
                .unwrap_or(false)
            {
                continue;
            }
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            if meta.len() < min_bytes {
                continue;
            }
            let filename = p
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or_default()
                .to_string();
            let path = p.to_string_lossy().to_string();
            out.push(ScannedFile {
                path,
                filename,
                size: meta.len(),
                subtitle_paths: adjacent_subtitles(p),
            });
        }
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
}
