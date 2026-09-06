use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use std::{
    hash::{Hash, Hasher},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::Duration,
};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioChapter {
    title: String,
    start: f64,
    end: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ZipAudioEntry {
    name: String,
    title: String,
}

fn audio_extension(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "m4b" | "m4a" | "mp3" | "aac" | "ogg" | "opus" | "flac" | "wav"
            )
        })
}

fn supported(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "m4b" | "m4a" | "mp3" | "aac" | "ogg" | "opus" | "flac" | "wav"
            )
        })
}

fn open_zip(path: &str) -> Result<(PathBuf, zip::ZipArchive<std::fs::File>), String> {
    let source = std::fs::canonicalize(path).map_err(|_| "audiobook ZIP not found".to_string())?;
    if !source.is_file()
        || !source
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case("zip"))
    {
        return Err("unsupported audiobook archive".into());
    }
    let file =
        std::fs::File::open(&source).map_err(|error| format!("open audiobook ZIP: {error}"))?;
    let archive =
        zip::ZipArchive::new(file).map_err(|error| format!("read audiobook ZIP: {error}"))?;
    Ok((source, archive))
}

#[tauri::command]
pub async fn ebook_audio_zip_entries(path: String) -> Result<Vec<ZipAudioEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || zip_entries(&path))
        .await
        .map_err(|error| error.to_string())?
}

fn zip_entries(path: &str) -> Result<Vec<ZipAudioEntry>, String> {
    let (_, mut archive) = open_zip(path)?;
    let mut entries = Vec::new();
    for index in 0..archive.len().min(10_000) {
        let file = archive.by_index(index).map_err(|error| error.to_string())?;
        if !file.is_file() || file.enclosed_name().is_none() || !audio_extension(file.name()) {
            continue;
        }
        let name = file.name().to_string();
        let title = Path::new(&name)
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("Chapter")
            .replace('_', " ")
            .replace('-', " ");
        entries.push(ZipAudioEntry { name, title });
    }
    Ok(entries)
}

fn cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| error.to_string())?
        .join("ebook-audio");
    std::fs::create_dir_all(&dir).map_err(|error| format!("create audiobook cache: {error}"))?;
    let cutoff = std::time::SystemTime::now() - Duration::from_secs(30 * 24 * 60 * 60);
    if let Ok(files) = std::fs::read_dir(&dir) {
        for file in files.flatten() {
            if file
                .metadata()
                .and_then(|value| value.modified())
                .is_ok_and(|value| value < cutoff)
            {
                let _ = std::fs::remove_file(file.path());
            }
        }
    }
    Ok(dir)
}

fn extract_zip_entry(app: &tauri::AppHandle, path: &str, entry: &str) -> Result<PathBuf, String> {
    const MAX_AUDIO_SIZE: u64 = 2 * 1024 * 1024 * 1024;
    let (source, mut archive) = open_zip(path)?;
    let metadata = std::fs::metadata(&source).map_err(|error| error.to_string())?;
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    source.hash(&mut hash);
    metadata.len().hash(&mut hash);
    metadata.modified().ok().hash(&mut hash);
    entry.hash(&mut hash);
    let extension = Path::new(entry)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("audio");
    let destination = cache_dir(app)?.join(format!("{:016x}.{extension}", hash.finish()));
    if destination.is_file() {
        return Ok(destination);
    }
    let input = archive
        .by_name(entry)
        .map_err(|_| "audio entry not found".to_string())?;
    if !input.is_file()
        || input.enclosed_name().is_none()
        || !audio_extension(input.name())
        || input.size() > MAX_AUDIO_SIZE
    {
        return Err("unsafe or unsupported audio entry".into());
    }
    let temporary =
        destination.with_extension(format!("{extension}.{}.part", uuid::Uuid::new_v4()));
    let mut output = std::fs::File::create(&temporary)
        .map_err(|error| format!("create cached audio: {error}"))?;
    let copied = std::io::copy(&mut input.take(MAX_AUDIO_SIZE + 1), &mut output)
        .map_err(|error| format!("extract audio: {error}"))?;
    if copied > MAX_AUDIO_SIZE {
        let _ = std::fs::remove_file(temporary);
        return Err("audio entry is too large".into());
    }
    output.flush().map_err(|error| error.to_string())?;
    std::fs::rename(&temporary, &destination)
        .map_err(|error| format!("finish cached audio: {error}"))?;
    Ok(destination)
}

#[tauri::command]
pub async fn ebook_audio_zip_extract(
    app: tauri::AppHandle,
    path: String,
    entry: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        extract_zip_entry(&app, &path, &entry).map(|value| value.to_string_lossy().into_owned())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn ebook_audio_zip_cover(path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (_, mut archive) = open_zip(&path)?;
        let mut fallback = None;
        for index in 0..archive.len().min(10_000) {
            let mut file = archive.by_index(index).map_err(|error| error.to_string())?;
            if !file.is_file() || file.enclosed_name().is_none() || file.size() > 5 * 1024 * 1024 {
                continue;
            }
            let basename = Path::new(file.name())
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            let mime = if basename.ends_with(".png") {
                "image/png"
            } else if basename.ends_with(".jpg") || basename.ends_with(".jpeg") {
                "image/jpeg"
            } else {
                continue;
            };
            let preferred = basename == "cover.jpg"
                || basename == "cover.jpeg"
                || basename == "cover.png"
                || basename == "folder.jpg"
                || basename == "folder.jpeg"
                || basename == "folder.png";
            let mut bytes = Vec::with_capacity(file.size() as usize);
            file.read_to_end(&mut bytes)
                .map_err(|error| format!("read ZIP cover: {error}"))?;
            let cover = format!("data:{mime};base64,{}", BASE64.encode(bytes));
            if preferred {
                return Ok(Some(cover));
            }
            fallback.get_or_insert(cover);
        }
        Ok(fallback)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn ebook_audio_cover(path: String) -> Result<Option<String>, String> {
    let source = std::fs::canonicalize(path).map_err(|_| "audiobook file not found".to_string())?;
    if !source.is_file() || !supported(&source) {
        return Err("unsupported audiobook file".into());
    }
    let ffmpeg = crate::transcode::locate_ffmpeg().ok_or_else(|| "ffmpeg not found".to_string())?;
    let mut command = tokio::process::Command::new(ffmpeg);
    command
        .args(["-nostdin", "-loglevel", "error", "-i"])
        .arg(source)
        .args([
            "-map",
            "0:v:0?",
            "-frames:v",
            "1",
            "-c:v",
            "mjpeg",
            "-q:v",
            "3",
            "-f",
            "image2pipe",
            "pipe:1",
        ])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);
    let output = tokio::time::timeout(Duration::from_secs(15), command.output())
        .await
        .map_err(|_| "cover extraction timed out".to_string())?
        .map_err(|error| format!("ffmpeg spawn: {error}"))?;
    if !output.status.success() || output.stdout.is_empty() {
        return Ok(None);
    }
    if output.stdout.len() > 5 * 1024 * 1024 {
        return Err("embedded cover is too large".into());
    }
    Ok(Some(format!(
        "data:image/jpeg;base64,{}",
        BASE64.encode(output.stdout)
    )))
}

#[tauri::command]
pub async fn ebook_audio_chapters(path: String) -> Result<Vec<AudioChapter>, String> {
    let source = std::fs::canonicalize(path).map_err(|_| "audiobook file not found".to_string())?;
    if !source.is_file() || !supported(&source) {
        return Err("unsupported audiobook file".into());
    }
    let ffprobe =
        crate::transcode::locate_ffprobe().ok_or_else(|| "ffprobe not found".to_string())?;
    let mut command = tokio::process::Command::new(ffprobe);
    command
        .args(["-v", "error", "-show_chapters", "-of", "json"])
        .arg(source)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);
    let output = tokio::time::timeout(Duration::from_secs(15), command.output())
        .await
        .map_err(|_| "chapter scan timed out".to_string())?
        .map_err(|error| format!("ffprobe spawn: {error}"))?;
    if !output.status.success() {
        return Err("chapter scan failed".into());
    }
    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("chapter metadata: {error}"))?;
    Ok(value["chapters"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|chapter| {
            let start = chapter["start_time"].as_str()?.parse().ok()?;
            let end = chapter["end_time"].as_str()?.parse().ok()?;
            Some(AudioChapter {
                title: chapter["tags"]["title"]
                    .as_str()
                    .unwrap_or("Chapter")
                    .to_string(),
                start,
                end,
            })
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restricts_cover_extraction_to_audio() {
        assert!(supported(Path::new("book.M4B")));
        assert!(audio_extension("disc/02 Chapter.mp3"));
        assert!(!audio_extension("disc/cover.jpg"));
        assert!(!supported(Path::new("book.exe")));
    }

    #[test]
    fn lists_only_safe_audio_entries_from_zip() {
        let path = std::env::temp_dir().join(format!("harbor-audio-{}.zip", uuid::Uuid::new_v4()));
        let file = std::fs::File::create(&path).unwrap();
        let mut archive = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();
        for name in ["Book 1/01_intro.mp3", "cover.jpg", "../outside.mp3"] {
            archive.start_file(name, options).unwrap();
            archive.write_all(b"test").unwrap();
        }
        archive.finish().unwrap();
        let entries = zip_entries(path.to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "Book 1/01_intro.mp3");
        assert_eq!(entries[0].title, "01 intro");
        std::fs::remove_file(path).unwrap();
    }
}
