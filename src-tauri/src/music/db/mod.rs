mod stream_cache;

use super::migrations;
use super::{duration_label, MusicStream, MusicTrack};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use stream_cache::{is_fresh, stream_ttl};

pub struct MusicDb {
    connection: Mutex<Option<Connection>>,
    opened: Mutex<Option<std::path::PathBuf>>,
}

impl MusicDb {
    pub fn new() -> Self {
        Self {
            connection: Mutex::new(None),
            opened: Mutex::new(None),
        }
    }

    pub fn initialize(&self, path: &Path) -> Result<(), String> {
        let mut slot = self
            .connection
            .lock()
            .map_err(|_| "Music database lock is unavailable".to_string())?;
        let mut opened = self
            .opened
            .lock()
            .map_err(|_| "Music database lock is unavailable".to_string())?;
        if slot.is_some() && opened.as_deref() == Some(path) {
            return Ok(());
        }
        if slot.is_some() {
            *slot = None;
        }
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut connection = Connection::open(path).map_err(|error| error.to_string())?;
        Self::configure(&mut connection)?;
        *slot = Some(connection);
        *opened = Some(path.to_path_buf());
        Ok(())
    }

    fn configure(connection: &mut Connection) -> Result<(), String> {
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(|error| error.to_string())?;
        connection
            .execute_batch(
                "PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;",
            )
            .map_err(|error| error.to_string())?;
        migrations::run(connection)
    }

    pub(super) fn with_connection<T>(
        &self,
        operation: impl FnOnce(&mut Connection) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut slot = self
            .connection
            .lock()
            .map_err(|_| "Music database lock is unavailable".to_string())?;
        let connection = slot
            .as_mut()
            .ok_or_else(|| "Music database is not initialized".to_string())?;
        operation(connection)
    }

    pub fn upsert_track(&self, track: &MusicTrack) -> Result<(), String> {
        self.with_connection(|connection| {
            upsert_track(connection, track)
                .map(|_| ())
                .map_err(|error| error.to_string())
        })
    }

    pub fn get_track(&self, id: &str) -> Result<Option<MusicTrack>, String> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    "SELECT id, connector, source_id, title, artist, album, artwork, duration_seconds, resolved_url, media_kind, explicit, version FROM music_tracks WHERE id = ?1",
                    params![id],
                    track_from_row,
                )
                .optional()
                .map_err(|error| error.to_string())
        })
    }

    pub fn cached_stream(&self, id: &str) -> Result<Option<MusicStream>, String> {
        let now = now_seconds();
        self.with_connection(|connection| {
            let entry = connection
                .query_row(
                    "SELECT connector, resolved_url, CAST(resolved_at AS INTEGER), resolved_metadata FROM music_tracks WHERE id = ?1 AND resolved_url IS NOT NULL AND resolved_at IS NOT NULL",
                    params![id],
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, i64>(2)?,
                            row.get::<_, Option<String>>(3)?,
                        ))
                    },
                )
                .optional()
                .map_err(|error| error.to_string())?;
            let Some((connector, url, resolved_at, metadata)) = entry else {
                return Ok(None);
            };
            if !is_fresh(now, resolved_at, stream_ttl(&connector)) {
                return Ok(None);
            }
            if let Some(metadata) = metadata {
                if let Ok(stream) = serde_json::from_str::<MusicStream>(&metadata) {
                    if stream.url == url && stream.request_headers().is_ok() {
                        return Ok(Some(stream));
                    }
                }
                return Ok(None);
            }
            // Legacy YouTube URLs omit the resolver's headers and cannot be trusted
            // to represent the request that the provider authorized.
            if connector == "youtube" {
                return Ok(None);
            }
            Ok(Some(MusicStream {
                http_headers: Default::default(),
                url,
                mime_type: "audio/webm".to_string(),
                bitrate: 0,
            }))
        })
    }

    pub fn cache_stream(&self, id: &str, stream: &MusicStream) -> Result<(), String> {
        self.with_connection(|connection| {
            let changed = connection
                .execute(
                    "UPDATE music_tracks SET resolved_url = ?2, resolved_at = ?3, resolved_metadata = ?4 WHERE id = ?1",
                    params![id, stream.url, now_seconds().to_string(), serde_json::to_string(stream).map_err(|error| error.to_string())?],
                )
                .map_err(|error| error.to_string())?;
            if changed == 0 {
                return Err(format!("Music track {id} is not stored"));
            }
            Ok(())
        })
    }

    pub fn invalidate_stream(&self, id: &str) -> Result<(), String> {
        self.with_connection(|connection| {
            connection
                .execute(
                    "UPDATE music_tracks SET resolved_url = NULL, resolved_at = NULL, resolved_metadata = NULL WHERE id = ?1",
                    params![id],
                )
                .map(|_| ())
                .map_err(|error| error.to_string())
        })
    }

    #[cfg(test)]
    pub(super) fn in_memory() -> Self {
        let mut connection = Connection::open_in_memory().expect("open in-memory music database");
        Self::configure(&mut connection).expect("configure in-memory music database");
        Self {
            connection: Mutex::new(Some(connection)),
            opened: Mutex::new(None),
        }
    }
}

pub(super) fn upsert_track(connection: &Connection, track: &MusicTrack) -> rusqlite::Result<usize> {
    let connector = track.connector_id.as_deref().unwrap_or("youtube");
    let source_id = track.source_id.as_deref().unwrap_or(&track.id);
    let changed = connection.execute(
        r#"
INSERT INTO music_tracks (
  id, connector, source_id, title, artist, album, artwork, duration_seconds, media_kind, explicit, version
) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
ON CONFLICT(id) DO UPDATE SET
  connector = excluded.connector,
  source_id = excluded.source_id,
  title = excluded.title,
  artist = excluded.artist,
  album = excluded.album,
  artwork = excluded.artwork,
  duration_seconds = excluded.duration_seconds,
  media_kind = COALESCE(excluded.media_kind, music_tracks.media_kind),
  explicit = COALESCE(excluded.explicit, music_tracks.explicit),
  version = COALESCE(excluded.version, music_tracks.version)
"#,
        params![
            track.id,
            connector,
            source_id,
            track.title,
            track.artist,
            track.album,
            track.artwork,
            track.duration_seconds as i64,
            track.media_kind.as_deref().filter(|kind| matches!(*kind, "audio" | "video")),
            track.explicit,
            track.version,
        ],
    )?;
    if let Some(url) = track
        .playback_url
        .as_deref()
        .map(str::trim)
        .filter(|url| !url.is_empty())
    {
        connection.execute(
            "UPDATE music_tracks SET resolved_url = ?2, resolved_at = ?3 WHERE id = ?1",
            params![track.id, url, now_seconds().to_string()],
        )?;
    }
    let artist = track.artist.trim();
    if !artist.is_empty() {
        connection.execute(
            "INSERT INTO artists (name) VALUES (?1) ON CONFLICT(name) DO NOTHING",
            params![artist],
        )?;
        if let Some(album) = track
            .album
            .as_deref()
            .map(str::trim)
            .filter(|album| !album.is_empty())
        {
            connection.execute(
                r#"
INSERT INTO albums (title, artist_id, artwork)
SELECT ?1, id, ?2 FROM artists WHERE name = ?3 COLLATE NOCASE
ON CONFLICT(title, artist_id) DO UPDATE SET
  artwork = CASE WHEN excluded.artwork <> '' THEN excluded.artwork ELSE albums.artwork END
"#,
                params![album, track.artwork, artist],
            )?;
        }
        connection.execute(
            r#"
UPDATE music_tracks SET
  artist_id = (SELECT id FROM artists WHERE name = ?2 COLLATE NOCASE),
  album_id = (
    SELECT al.id FROM albums al
    WHERE al.title = ?3 COLLATE NOCASE
      AND al.artist_id = (SELECT id FROM artists WHERE name = ?2 COLLATE NOCASE)
  )
WHERE id = ?1
"#,
            params![track.id, artist, track.album],
        )?;
    }
    Ok(changed)
}

pub(super) fn upsert_track_in_transaction(
    transaction: &Transaction<'_>,
    track: &MusicTrack,
) -> Result<(), String> {
    upsert_track(transaction, track)
        .map(|_| ())
        .map_err(|error| error.to_string())
}

pub(super) fn track_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<MusicTrack> {
    let connector_id = row.get::<_, String>(1)?;
    let duration_seconds = row.get::<_, Option<i64>>(7)?.unwrap_or(0).max(0) as u64;
    let resolved_url = row.get::<_, Option<String>>(8)?;
    let playback_url = if matches!(connector_id.as_str(), "local" | "direct") {
        resolved_url
    } else {
        None
    };
    Ok(MusicTrack {
        explicit: row.get(10)?,
        version: row.get(11)?,
        media_kind: row.get(9)?,
        id: row.get(0)?,
        connector_id: Some(connector_id),
        source_id: Some(row.get(2)?),
        playback_url,
        title: row.get(3)?,
        artist: row.get(4)?,
        album: row.get(5)?,
        artwork: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
        duration_seconds,
        duration_label: duration_label(duration_seconds),
    })
}

pub(super) fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(i64::MAX as u128) as i64
}

pub(super) fn now_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .min(i64::MAX as u64) as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track() -> MusicTrack {
        MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: "video-1".to_string(),
            connector_id: Some("youtube".to_string()),
            source_id: Some("video-1".to_string()),
            playback_url: None,
            title: "Hysteria".to_string(),
            artist: "Muse".to_string(),
            album: Some("Absolution".to_string()),
            artwork: "https://example.test/art.jpg".to_string(),
            duration_seconds: 227,
            duration_label: "3:47".to_string(),
        }
    }

    #[test]
    fn track_round_trip_preserves_connector_metadata() {
        let database = MusicDb::in_memory();
        database.upsert_track(&track()).expect("store track");

        let stored = database
            .get_track("video-1")
            .expect("read track")
            .expect("stored track");

        assert_eq!(stored.connector_id.as_deref(), Some("youtube"));
        assert_eq!(stored.source_id.as_deref(), Some("video-1"));
        assert_eq!(stored.title, "Hysteria");
        assert_eq!(stored.duration_seconds, 227);
    }

    #[test]
    fn known_content_labels_survive_missing_metadata_and_false_round_trips() {
        let database = MusicDb::in_memory();
        let mut value = track();
        value.explicit = Some(false);
        value.version = Some("Radio Edit".to_string());
        database.upsert_track(&value).unwrap();
        database.upsert_track(&track()).unwrap();
        let stored = database.get_track(&value.id).unwrap().unwrap();
        assert_eq!(stored.explicit, Some(false));
        assert_eq!(stored.version.as_deref(), Some("Radio Edit"));
    }

    #[test]
    fn missing_track_has_no_cached_stream() {
        let database = MusicDb::in_memory();
        assert!(database
            .cached_stream("missing")
            .expect("read cache")
            .is_none());
    }

    #[test]
    fn a_freshly_cached_stream_reads_back() {
        let database = MusicDb::in_memory();
        database.upsert_track(&track()).expect("store track");
        let stream = MusicStream {
            http_headers: Default::default(),
            url: "https://example.test/audio".to_string(),
            mime_type: "audio/webm".to_string(),
            bitrate: 0,
        };
        database
            .cache_stream("video-1", &stream)
            .expect("cache stream");
        assert_eq!(
            database
                .cached_stream("video-1")
                .expect("read fresh cache")
                .expect("fresh stream")
                .url,
            stream.url
        );
    }

    #[test]
    fn caching_a_stream_for_an_unknown_track_is_rejected() {
        let database = MusicDb::in_memory();
        let stream = MusicStream {
            http_headers: Default::default(),
            url: "https://example.test/audio".to_string(),
            mime_type: "audio/webm".to_string(),
            bitrate: 0,
        };
        assert!(database.cache_stream("missing", &stream).is_err());
    }

    #[test]
    fn durable_sources_restore_playback_urls() {
        for connector in ["local", "direct"] {
            let database = MusicDb::in_memory();
            let mut value = track();
            value.id = format!("{connector}-track");
            value.connector_id = Some(connector.to_string());
            value.playback_url = Some(if connector == "local" {
                "C:/Music/Hysteria.flac".to_string()
            } else {
                "https://example.test/hysteria.flac".to_string()
            });
            database.upsert_track(&value).expect("store durable track");
            let stored = database
                .get_track(&value.id)
                .expect("read durable track")
                .expect("durable track");
            assert_eq!(stored.playback_url, value.playback_url);
        }
    }
}
