use super::tags::ScannedTrack;
use crate::music::db::{now_seconds, upsert_track_in_transaction, MusicDb};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

const CONFIG_FILE: &str = "music-local.json";

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS music_local_files (
  path TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  size INTEGER NOT NULL,
  mtime INTEGER NOT NULL,
  track_no INTEGER,
  disc_no INTEGER,
  year INTEGER,
  album_key TEXT,
  album_artist TEXT,
  artist_key TEXT,
  scanned_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS music_local_files_track_idx ON music_local_files(track_id);
CREATE INDEX IF NOT EXISTS music_local_files_album_idx ON music_local_files(album_key);
CREATE INDEX IF NOT EXISTS music_local_files_artist_idx ON music_local_files(artist_key);
"#;

static SCHEMA_READY: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone)]
pub struct LocalFile {
    pub path: String,
    pub size: u64,
    pub mtime: i64,
}

#[derive(Deserialize, Serialize)]
struct LocalConfig {
    folder: Option<String>,
}

pub fn ensure_schema(database: &MusicDb) -> Result<(), String> {
    if SCHEMA_READY.load(Ordering::Acquire) {
        return Ok(());
    }
    create_schema(database)?;
    SCHEMA_READY.store(true, Ordering::Release);
    Ok(())
}

pub fn create_schema(database: &MusicDb) -> Result<(), String> {
    database.with_connection(|connection| {
        connection
            .execute_batch(SCHEMA)
            .map_err(|error| error.to_string())
    })
}

pub fn load_folder(app: &tauri::AppHandle) -> Option<String> {
    let content = std::fs::read_to_string(config_path(app).ok()?).ok()?;
    serde_json::from_str::<LocalConfig>(&content)
        .ok()?
        .folder
        .map(|folder| folder.trim().to_string())
        .filter(|folder| !folder.is_empty())
}

pub fn save_folder(app: &tauri::AppHandle, folder: Option<&str>) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let content = serde_json::to_string(&LocalConfig {
        folder: folder.map(str::to_string),
    })
    .map_err(|error| error.to_string())?;
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, content.as_bytes()).map_err(|error| error.to_string())?;
    std::fs::rename(&temporary, &path).map_err(|error| error.to_string())
}

pub fn covers_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("music")
        .join("covers"))
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join(CONFIG_FILE))
}

pub fn indexed(database: &MusicDb) -> Result<HashMap<String, LocalFile>, String> {
    database.with_connection(|connection| {
        let mut statement = connection
            .prepare("SELECT path, size, mtime FROM music_local_files")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok(LocalFile {
                    path: row.get(0)?,
                    size: row.get::<_, i64>(1)?.max(0) as u64,
                    mtime: row.get(2)?,
                })
            })
            .map_err(|error| error.to_string())?;
        let mut files = HashMap::new();
        for file in rows {
            let file = file.map_err(|error| error.to_string())?;
            files.insert(file.path.clone(), file);
        }
        Ok(files)
    })
}

pub fn write(database: &MusicDb, entries: &[(LocalFile, ScannedTrack)]) -> Result<(), String> {
    let scanned_at = now_seconds().to_string();
    database.with_connection(|connection| {
        let transaction = connection
            .transaction()
            .map_err(|error| error.to_string())?;
        for (file, scanned) in entries {
            upsert_track_in_transaction(&transaction, &scanned.track)?;
            transaction
                .execute(
                    r#"
INSERT INTO music_local_files (
  path, track_id, size, mtime, track_no, disc_no, year, album_key, album_artist, artist_key,
  scanned_at
) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
ON CONFLICT(path) DO UPDATE SET
  track_id = excluded.track_id,
  size = excluded.size,
  mtime = excluded.mtime,
  track_no = excluded.track_no,
  disc_no = excluded.disc_no,
  year = excluded.year,
  album_key = excluded.album_key,
  album_artist = excluded.album_artist,
  artist_key = excluded.artist_key,
  scanned_at = excluded.scanned_at
"#,
                    params![
                        file.path,
                        scanned.track.id,
                        file.size as i64,
                        file.mtime,
                        scanned.fields.track_no.map(i64::from),
                        scanned.fields.disc_no.map(i64::from),
                        scanned.fields.year.map(i64::from),
                        scanned.fields.album_key(),
                        scanned.fields.credited_artist(),
                        scanned.fields.artist_key(),
                        scanned_at,
                    ],
                )
                .map_err(|error| error.to_string())?;
        }
        transaction.commit().map_err(|error| error.to_string())
    })
}

pub fn prune(database: &MusicDb, keep: &HashSet<String>) -> Result<u32, String> {
    let stale = database.with_connection(|connection| {
        let mut statement = connection
            .prepare("SELECT path, track_id FROM music_local_files")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())
    })?;
    let stale = stale
        .into_iter()
        .filter(|(path, _)| !keep.contains(path))
        .collect::<Vec<_>>();
    if stale.is_empty() {
        return Ok(0);
    }
    database.with_connection(|connection| {
        let transaction = connection
            .transaction()
            .map_err(|error| error.to_string())?;
        for (path, track_id) in &stale {
            transaction
                .execute(
                    "DELETE FROM music_local_files WHERE path = ?1",
                    params![path],
                )
                .map_err(|error| error.to_string())?;
            transaction
                .execute(
                    "DELETE FROM music_tracks WHERE id = ?1 AND connector = 'local'",
                    params![track_id],
                )
                .map_err(|error| error.to_string())?;
        }
        transaction.commit().map_err(|error| error.to_string())
    })?;
    Ok(stale.len() as u32)
}

pub fn track_count(database: &MusicDb) -> Result<u32, String> {
    database.with_connection(|connection| {
        connection
            .query_row("SELECT COUNT(*) FROM music_local_files", [], |row| {
                row.get::<_, i64>(0)
            })
            .map(|count| count.max(0) as u32)
            .map_err(|error| error.to_string())
    })
}

#[cfg(test)]
mod tests {
    use super::super::fixtures;
    use super::super::tags;
    use super::*;

    fn entry(path: &str, title: &str, track_no: u32) -> (LocalFile, ScannedTrack) {
        fixtures::entry(path, title, "Muse", None, "Absolution", track_no)
    }

    #[test]
    fn writing_a_file_indexes_the_track_and_its_scan_state() {
        let database = fixtures::database();
        write(&database, &[entry("C:/Music/one.flac", "Hysteria", 1)]).expect("write entries");

        let files = indexed(&database).expect("indexed files");
        let file = files.get("C:/Music/one.flac").expect("indexed file");
        assert_eq!(file.size, 1024);
        assert_eq!(file.mtime, 1_700_000_000);
        assert_eq!(track_count(&database).expect("count"), 1);

        let stored = database
            .get_track(&tags::track_id("C:/Music/one.flac"))
            .expect("read track")
            .expect("stored track");
        assert_eq!(stored.title, "Hysteria");
        assert_eq!(stored.playback_url.as_deref(), Some("C:/Music/one.flac"));
    }

    #[test]
    fn rewriting_the_same_path_updates_rather_than_duplicates() {
        let database = fixtures::database();
        write(&database, &[entry("C:/Music/one.flac", "Hysteria", 1)]).expect("first write");
        let mut second = entry("C:/Music/one.flac", "Hysteria", 4);
        second.0.size = 2048;
        write(&database, &[second]).expect("second write");

        assert_eq!(track_count(&database).expect("count"), 1);
        let files = indexed(&database).expect("indexed files");
        assert_eq!(files["C:/Music/one.flac"].size, 2048);
    }

    #[test]
    fn pruning_drops_files_that_are_no_longer_on_disk() {
        let database = fixtures::database();
        write(
            &database,
            &[
                entry("C:/Music/one.flac", "Hysteria", 1),
                entry("C:/Music/two.flac", "Butterflies", 2),
            ],
        )
        .expect("write entries");

        let keep = HashSet::from(["C:/Music/one.flac".to_string()]);
        assert_eq!(prune(&database, &keep).expect("prune"), 1);
        assert_eq!(track_count(&database).expect("count"), 1);
        assert!(database
            .get_track(&tags::track_id("C:/Music/two.flac"))
            .expect("read removed track")
            .is_none());
        assert_eq!(prune(&database, &keep).expect("second prune"), 0);
    }
}
