use std::path::PathBuf;
use std::time::{Duration, SystemTime};

use tauri::Manager;

const THUMB_DIR_NAME: &str = "harbor-thumb-cache";
const MAX_AGE: Duration = Duration::from_secs(30 * 24 * 3600);
const MAX_BYTES: u64 = 256 * 1024 * 1024;
const MAX_FILES: usize = 1000;

fn dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().cache_dir().ok().map(|d| d.join(THUMB_DIR_NAME))
}

fn file_stem(url: &str, width: u32) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(width.to_le_bytes());
    hasher.update([0u8]);
    hasher.update(url.as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>()
}

fn extension_for(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        "png"
    } else if bytes.starts_with(b"\xFF\xD8\xFF") {
        "jpg"
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "webp"
    } else {
        "jpg"
    }
}

fn is_fresh(mtime: SystemTime) -> bool {
    mtime.elapsed().map(|age| age <= MAX_AGE).unwrap_or(false)
}

pub fn read_thumb(app: &tauri::AppHandle, url: &str, width: u32) -> Option<Vec<u8>> {
    let dir = dir(app)?;
    // Width is part of the stem: one source URL can be cached at several sizes.
    for ext in ["jpg", "png", "webp"] {
        let path = dir.join(format!("{}.{ext}", file_stem(url, width)));
        let meta = std::fs::metadata(&path).ok()?;
        let modified = meta.modified().ok()?;
        if !is_fresh(modified) {
            let _ = std::fs::remove_file(&path);
            continue;
        }
        if let Ok(bytes) = std::fs::read(&path) {
            if !bytes.is_empty() {
                return Some(bytes);
            }
        }
    }
    None
}

pub fn write_thumb(app: &tauri::AppHandle, url: &str, width: u32, bytes: &[u8]) {
    let Some(dir) = dir(app) else {
        return;
    };
    if bytes.is_empty() {
        return;
    }
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    let ext = extension_for(bytes);
    let path = dir.join(format!("{}.{ext}", file_stem(url, width)));
    if std::fs::write(&path, bytes).is_err() {
        return;
    }
    enforce_caps(&dir);
}

fn enforce_caps(dir: &PathBuf) {
    let mut listed = list_files(dir);
    let total: u64 = listed.iter().map(|(_, len, _)| len).sum();
    if listed.len() <= MAX_FILES && total <= MAX_BYTES {
        return;
    }
    listed.sort_by_key(|(_, _, mtime)| *mtime);
    let mut bytes = total;
    let mut count = listed.len();
    for (path, len, _) in listed {
        if count <= MAX_FILES && bytes <= MAX_BYTES {
            break;
        }
        if std::fs::remove_file(&path).is_ok() {
            bytes = bytes.saturating_sub(len);
            count = count.saturating_sub(1);
        }
    }
}

fn list_files(dir: &PathBuf) -> Vec<(PathBuf, u64, SystemTime)> {
    std::fs::read_dir(dir)
        .map(|rd| {
            rd.filter_map(|entry| {
                let e = entry.ok()?;
                let meta = e.metadata().ok()?;
                if !meta.is_file() {
                    return None;
                }
                Some((e.path(), meta.len(), meta.modified().ok()?))
            })
            .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

pub fn thumb_cache_size(app: &tauri::AppHandle) -> (u64, usize) {
    let Some(dir) = dir(app) else {
        return (0, 0);
    };
    let listed = list_files(&dir);
    let bytes = listed.iter().map(|(_, len, _)| len).sum();
    (bytes, listed.len())
}

pub fn clear_thumb_dir(app: &tauri::AppHandle) {
    if let Some(dir) = dir(app) {
        let _ = std::fs::remove_dir_all(&dir);
        let _ = std::fs::create_dir_all(&dir);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thumb_key_is_stable_and_hex() {
        let a = file_stem("https://example.com/cover.jpg", 400);
        let b = file_stem("https://example.com/cover.jpg", 400);
        assert_eq!(a, b);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, file_stem("https://example.com/cover.jpg", 600));
        assert_ne!(a, file_stem("https://example.com/other.jpg", 400));
    }

    #[test]
    fn thumb_extension_sniffs_magic_bytes() {
        assert_eq!(extension_for(b"\x89PNG\r\n\x1a\nrest"), "png");
        assert_eq!(extension_for(b"\xFF\xD8\xFF rest"), "jpg");
        assert_eq!(extension_for(b"RIFF\x00\x00\x00\x00WEBP rest"), "webp");
        assert_eq!(extension_for(b"nonsense"), "jpg");
    }
}
