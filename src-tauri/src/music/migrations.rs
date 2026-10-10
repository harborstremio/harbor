use rusqlite::Connection;

pub const LATEST_VERSION: i64 = 6;

const CREATE_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS music_tracks (
  id TEXT PRIMARY KEY,
  connector TEXT NOT NULL DEFAULT 'youtube',
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  artwork TEXT,
  duration_seconds INTEGER,
  resolved_url TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS music_liked (
  track_id TEXT PRIMARY KEY,
  liked_at TEXT
);
CREATE TABLE IF NOT EXISTS music_recents (
  track_id TEXT PRIMARY KEY,
  played_at TEXT
);
CREATE TABLE IF NOT EXISTS music_queue (
  position INTEGER PRIMARY KEY,
  track_id TEXT NOT NULL,
  FOREIGN KEY(track_id) REFERENCES music_tracks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE
);
CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL COLLATE NOCASE,
  artist_id INTEGER NOT NULL,
  artwork TEXT,
  UNIQUE(title, artist_id),
  FOREIGN KEY(artist_id) REFERENCES artists(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  track_id TEXT NOT NULL,
  PRIMARY KEY(playlist_id, position),
  UNIQUE(playlist_id, track_id),
  FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY(track_id) REFERENCES music_tracks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS playlist_tracks_track_idx ON playlist_tracks(track_id);
"#;

const CREATE_CATALOG: &str = r#"
ALTER TABLE music_tracks ADD COLUMN album_id INTEGER;
ALTER TABLE music_tracks ADD COLUMN artist_id INTEGER;
CREATE INDEX IF NOT EXISTS music_tracks_artist_idx ON music_tracks(artist);
CREATE INDEX IF NOT EXISTS music_tracks_album_idx ON music_tracks(album);
CREATE TABLE IF NOT EXISTS catalog_rows (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_literal INTEGER NOT NULL DEFAULT 0,
  subtitle TEXT,
  layout TEXT NOT NULL,
  source TEXT NOT NULL,
  position INTEGER NOT NULL,
  fetched_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_row_items (
  row_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(row_id, position),
  FOREIGN KEY(row_id) REFERENCES catalog_rows(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS catalog_rows_source_idx ON catalog_rows(source);
UPDATE music_tracks SET artist_id = (
  SELECT id FROM artists WHERE name = music_tracks.artist COLLATE NOCASE
) WHERE artist_id IS NULL;
UPDATE music_tracks SET album_id = (
  SELECT al.id FROM albums al
  JOIN artists ar ON ar.id = al.artist_id
  WHERE al.title = music_tracks.album COLLATE NOCASE
    AND ar.name = music_tracks.artist COLLATE NOCASE
) WHERE album_id IS NULL AND album IS NOT NULL AND album <> '';
"#;

const STREAM_METADATA: &str = "ALTER TABLE music_tracks ADD COLUMN resolved_metadata TEXT;";

const MEDIA_KIND: &str = "ALTER TABLE music_tracks ADD COLUMN media_kind TEXT CHECK(media_kind IN ('audio', 'video'));";

const TRACK_LABELS: &str = "ALTER TABLE music_tracks ADD COLUMN explicit INTEGER; ALTER TABLE music_tracks ADD COLUMN version TEXT;";
// Separate membership dates survive playlist reordering (which rebuilds positions).
const PLAYLIST_DATES: &str = "CREATE TABLE playlist_track_dates (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);";
const STEPS: [(i64, &str); 6] = [
    (1, CREATE_SCHEMA),
    (2, CREATE_CATALOG),
    (3, STREAM_METADATA),
    (4, MEDIA_KIND),
    (5, TRACK_LABELS),
    (6, PLAYLIST_DATES),
];

pub fn run(connection: &mut Connection) -> Result<(), String> {
    let mut version = user_version(connection)?;
    if version >= LATEST_VERSION {
        return Ok(());
    }
    if version == 0 && has_table(connection, "music_tracks")? {
        set_user_version(connection, 1)?;
        version = 1;
    }
    for (target, statements) in STEPS {
        if version >= target {
            continue;
        }
        let transaction = connection
            .transaction()
            .map_err(|error| error.to_string())?;
        transaction
            .execute_batch(statements)
            .map_err(|error| format!("Music database migration {target} failed: {error}"))?;
        transaction
            .execute_batch(&format!("PRAGMA user_version = {target}"))
            .map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())?;
        version = target;
    }
    Ok(())
}

fn user_version(connection: &Connection) -> Result<i64, String> {
    connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| error.to_string())
}

fn set_user_version(connection: &Connection, version: i64) -> Result<(), String> {
    connection
        .execute_batch(&format!("PRAGMA user_version = {version}"))
        .map_err(|error| error.to_string())
}

fn has_table(connection: &Connection, name: &str) -> Result<bool, String> {
    connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
            [name],
            |row| row.get::<_, i64>(0),
        )
        .map(|count| count > 0)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn columns(connection: &Connection, table: &str) -> Vec<String> {
        let mut statement = connection
            .prepare(&format!("PRAGMA table_info({table})"))
            .expect("table info");
        let names = statement
            .query_map([], |row| row.get::<_, String>(1))
            .expect("column names")
            .collect::<Result<Vec<_>, _>>()
            .expect("column names");
        names
    }

    #[test]
    fn a_fresh_database_lands_on_the_latest_version() {
        let mut connection = Connection::open_in_memory().expect("open database");
        run(&mut connection).expect("migrate");
        assert_eq!(user_version(&connection).expect("version"), LATEST_VERSION);
        let track_columns = columns(&connection, "music_tracks");
        assert!(track_columns.iter().any(|name| name == "album_id"));
        assert!(track_columns.iter().any(|name| name == "artist_id"));
        assert!(track_columns.iter().any(|name| name == "resolved_metadata"));
        assert!(track_columns.iter().any(|name| name == "media_kind"));
        assert!(has_table(&connection, "catalog_rows").expect("catalog rows"));
        assert!(has_table(&connection, "catalog_row_items").expect("catalog row items"));
    }

    #[test]
    fn migrations_are_idempotent_across_restarts() {
        let mut connection = Connection::open_in_memory().expect("open database");
        run(&mut connection).expect("first migrate");
        run(&mut connection).expect("second migrate");
        assert_eq!(user_version(&connection).expect("version"), LATEST_VERSION);
    }

    #[test]
    fn an_existing_install_is_adopted_and_backfilled() {
        let mut connection = Connection::open_in_memory().expect("open database");
        connection
            .execute_batch(CREATE_SCHEMA)
            .expect("legacy schema");
        connection
            .execute_batch(
                r#"
INSERT INTO artists (id, name) VALUES (7, 'Muse');
INSERT INTO albums (id, title, artist_id, artwork) VALUES (9, 'Absolution', 7, '');
INSERT INTO music_tracks (id, connector, source_id, title, artist, album)
VALUES ('one', 'youtube', 'one', 'Hysteria', 'muse', 'absolution');
"#,
            )
            .expect("legacy rows");
        assert_eq!(user_version(&connection).expect("version"), 0);

        run(&mut connection).expect("migrate legacy database");

        assert_eq!(user_version(&connection).expect("version"), LATEST_VERSION);
        let (album_id, artist_id) = connection
            .query_row(
                "SELECT album_id, artist_id FROM music_tracks WHERE id = 'one'",
                [],
                |row| Ok((row.get::<_, Option<i64>>(0)?, row.get::<_, Option<i64>>(1)?)),
            )
            .expect("backfilled ids");
        assert_eq!(album_id, Some(9));
        assert_eq!(artist_id, Some(7));
    }
}
