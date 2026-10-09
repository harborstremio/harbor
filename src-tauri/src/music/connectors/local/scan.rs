use super::store::{self, LocalFile};
use super::tags;
use crate::music::MusicState;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::fs::Metadata;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

const MAX_DEPTH: usize = 12;
const MAX_FILES: usize = 100_000;
const BATCH: usize = 64;
const PROGRESS_INTERVAL: Duration = Duration::from_millis(250);

pub async fn run(app: &AppHandle, folder: &str) -> Result<u32, String> {
    let root = PathBuf::from(folder);
    if !root.is_dir() {
        return Err(format!("{folder} is not a folder"));
    }
    let handle = app.clone();
    let result = tokio::task::spawn_blocking(move || index(&handle, &root))
        .await
        .map_err(|error| error.to_string())?;
    if let Err(error) = &result {
        emit(
            app,
            json!({ "event": "local-scan", "status": "failed", "reason": error }),
        );
    }
    result
}

fn index(app: &AppHandle, root: &Path) -> Result<u32, String> {
    let state = app.state::<MusicState>();
    let database = &state.db;
    store::ensure_schema(database)?;
    let covers = store::covers_dir(app)?;
    std::fs::create_dir_all(&covers).map_err(|error| error.to_string())?;

    let known = store::indexed(database)?;
    let files = collect(root);
    let total = files.len();
    emit(
        app,
        json!({ "event": "local-scan", "status": "started", "total": total }),
    );

    let mut seen = HashSet::with_capacity(total);
    let mut pending = Vec::with_capacity(BATCH);
    let mut scanned = 0usize;
    let mut indexed = 0usize;
    let mut reported = Instant::now();
    for file in files {
        scanned += 1;
        seen.insert(file.path.clone());
        let unchanged = known
            .get(&file.path)
            .map(|entry| entry.size == file.size && entry.mtime == file.mtime)
            .unwrap_or(false);
        if !unchanged {
            if let Ok(track) = tags::read(Path::new(&file.path), &covers) {
                pending.push((file, track));
                indexed += 1;
            }
        }
        if pending.len() >= BATCH {
            store::write(database, &pending)?;
            pending.clear();
        }
        if reported.elapsed() >= PROGRESS_INTERVAL {
            reported = Instant::now();
            emit(
                app,
                json!({
                    "event": "local-scan",
                    "status": "progress",
                    "scanned": scanned,
                    "indexed": indexed,
                    "total": total,
                }),
            );
        }
    }
    if !pending.is_empty() {
        store::write(database, &pending)?;
    }

    let removed = store::prune(database, &seen)?;
    let tracks = store::track_count(database)?;
    emit(
        app,
        json!({
            "event": "local-scan",
            "status": "finished",
            "scanned": scanned,
            "indexed": indexed,
            "removed": removed,
            "total": total,
            "tracks": tracks,
        }),
    );
    Ok(tracks)
}

fn collect(root: &Path) -> Vec<LocalFile> {
    let mut files = Vec::new();
    for entry in WalkDir::new(root)
        .max_depth(MAX_DEPTH)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
    {
        if files.len() >= MAX_FILES {
            break;
        }
        if !entry.file_type().is_file() || !tags::is_audio(entry.path()) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        files.push(LocalFile {
            path: entry.path().to_string_lossy().to_string(),
            size: metadata.len(),
            mtime: modified_seconds(&metadata),
        });
    }
    files
}

fn modified_seconds(metadata: &Metadata) -> i64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_secs().min(i64::MAX as u64) as i64)
        .unwrap_or_default()
}

fn emit(app: &AppHandle, payload: Value) {
    let _ = app.emit("music://event", payload);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_file(path: &Path, bytes: &[u8]) {
        std::fs::create_dir_all(path.parent().expect("parent")).expect("create parent");
        std::fs::write(path, bytes).expect("write file");
    }

    fn temporary_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("harbor-local-scan-{name}"));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("create root");
        root
    }

    #[test]
    fn collect_finds_audio_files_and_ignores_everything_else() {
        let root = temporary_root("collect");
        write_file(&root.join("Muse/01 Hysteria.flac"), b"flac");
        write_file(&root.join("Muse/cover.jpg"), b"jpeg");
        write_file(&root.join("Muse/notes.txt"), b"text");
        write_file(&root.join("Nina/Sinnerman.MP3"), b"mp3");

        let mut found = collect(&root)
            .into_iter()
            .map(|file| file.path.replace('\\', "/"))
            .collect::<Vec<_>>();
        found.sort();
        assert_eq!(found.len(), 2);
        assert!(found[0].ends_with("Muse/01 Hysteria.flac"));
        assert!(found[1].ends_with("Nina/Sinnerman.MP3"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn collect_records_the_size_and_modified_time_a_rescan_compares() {
        let root = temporary_root("stat");
        let track = root.join("one.flac");
        write_file(&track, b"twelve bytes");

        let first = collect(&root);
        assert_eq!(first.len(), 1);
        assert_eq!(first[0].size, 12);
        assert!(first[0].mtime > 0);

        write_file(&track, b"a much longer body than before");
        let second = collect(&root);
        assert_eq!(second[0].size, 30);
        assert_eq!(first[0].path, second[0].path);
        let _ = std::fs::remove_dir_all(&root);
    }
}
