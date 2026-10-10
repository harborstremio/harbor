use crate::music::db::{track_from_row, MusicDb};
use crate::music::{MusicAlbumRef, MusicArtistRef, MusicTrack};
use rusqlite::{params, OptionalExtension};

pub(super) const TRACK_COLUMNS: &str =
    "t.id, t.connector, t.source_id, t.title, t.artist, t.album, t.artwork, t.duration_seconds, t.resolved_url, t.media_kind, t.explicit, t.version";

pub(super) const ALBUM_COLUMNS: &str = r#"
lf.album_key,
MAX(COALESCE(NULLIF(lf.album_artist, ''), t.artist)),
MAX(t.album),
COALESCE(MAX(NULLIF(t.artwork, '')), ''),
MIN(lf.year),
COUNT(*)
"#;

pub(super) const ARTIST_COLUMNS: &str = r#"
lf.artist_key,
MAX(COALESCE(NULLIF(lf.album_artist, ''), t.artist)),
COUNT(*)
"#;

pub fn recent_albums(database: &MusicDb, limit: usize) -> Result<Vec<MusicAlbumRef>, String> {
    albums(
        database,
        &format!(
            r#"
SELECT {ALBUM_COLUMNS}
FROM music_local_files lf
JOIN music_tracks t ON t.id = lf.track_id
WHERE lf.album_key IS NOT NULL
GROUP BY lf.album_key
ORDER BY MAX(t.created_at) DESC, MAX(t.album) COLLATE NOCASE
LIMIT ?1
"#
        ),
        params![limit as i64],
    )
}

pub fn artist_albums(database: &MusicDb, artist_key: &str) -> Result<Vec<MusicAlbumRef>, String> {
    albums(
        database,
        &format!(
            r#"
SELECT {ALBUM_COLUMNS}
FROM music_local_files lf
JOIN music_tracks t ON t.id = lf.track_id
WHERE lf.artist_key = ?1 AND lf.album_key IS NOT NULL
GROUP BY lf.album_key
ORDER BY MIN(lf.year), MAX(t.album) COLLATE NOCASE
"#
        ),
        params![artist_key],
    )
}

pub fn artists(database: &MusicDb, limit: usize) -> Result<Vec<MusicArtistRef>, String> {
    artist_refs(
        database,
        &format!(
            r#"
SELECT {ARTIST_COLUMNS}
FROM music_local_files lf
JOIN music_tracks t ON t.id = lf.track_id
WHERE lf.artist_key IS NOT NULL
GROUP BY lf.artist_key
ORDER BY COUNT(*) DESC, MAX(t.artist) COLLATE NOCASE
LIMIT ?1
"#
        ),
        params![limit as i64],
    )
}

pub fn album_tracks(database: &MusicDb, album_key: &str) -> Result<Vec<MusicTrack>, String> {
    tracks(
        database,
        &format!(
            r#"
SELECT {TRACK_COLUMNS}
FROM music_local_files lf
JOIN music_tracks t ON t.id = lf.track_id
WHERE lf.album_key = ?1
ORDER BY COALESCE(lf.disc_no, 1), COALESCE(lf.track_no, 0), t.title COLLATE NOCASE
"#
        ),
        params![album_key],
    )
}

pub fn artist_tracks(
    database: &MusicDb,
    artist_key: &str,
    limit: usize,
) -> Result<Vec<MusicTrack>, String> {
    tracks(
        database,
        &format!(
            r#"
SELECT {TRACK_COLUMNS}
FROM music_local_files lf
JOIN music_tracks t ON t.id = lf.track_id
WHERE lf.artist_key = ?1
ORDER BY t.album COLLATE NOCASE, COALESCE(lf.disc_no, 1), COALESCE(lf.track_no, 0)
LIMIT ?2
"#
        ),
        params![artist_key, limit as i64],
    )
}

pub fn liked_tracks(database: &MusicDb, limit: usize) -> Result<Vec<MusicTrack>, String> {
    tracks(
        database,
        &format!(
            r#"
SELECT {TRACK_COLUMNS}
FROM music_liked l
JOIN music_tracks t ON t.id = l.track_id
WHERE t.connector = 'local'
ORDER BY CAST(l.liked_at AS INTEGER) DESC
LIMIT ?1
"#
        ),
        params![limit as i64],
    )
}

pub fn path_for(database: &MusicDb, track_id: &str) -> Result<Option<String>, String> {
    database.with_connection(|connection| {
        connection
            .query_row(
                "SELECT path FROM music_local_files WHERE track_id = ?1",
                params![track_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| error.to_string())
    })
}

pub(super) fn tracks(
    database: &MusicDb,
    statement: &str,
    arguments: &[&dyn rusqlite::ToSql],
) -> Result<Vec<MusicTrack>, String> {
    database.with_connection(|connection| {
        let mut prepared = connection
            .prepare(statement)
            .map_err(|error| error.to_string())?;
        let rows = prepared
            .query_map(arguments, track_from_row)
            .map_err(|error| error.to_string())?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())?;
        Ok(rows)
    })
}

pub(super) fn albums(
    database: &MusicDb,
    statement: &str,
    arguments: &[&dyn rusqlite::ToSql],
) -> Result<Vec<MusicAlbumRef>, String> {
    database.with_connection(|connection| {
        let mut prepared = connection
            .prepare(statement)
            .map_err(|error| error.to_string())?;
        let rows = prepared
            .query_map(arguments, |row| {
                Ok(MusicAlbumRef {
                    id: row.get(0)?,
                    connector_id: "local".to_string(),
                    artist: row.get(1)?,
                    title: row.get(2)?,
                    artwork: row.get(3)?,
                    year: row.get::<_, Option<i64>>(4)?.map(|year| year.max(0) as u32),
                    track_count: Some(row.get::<_, i64>(5)?.max(0) as u32),
                    explicit: None,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())?;
        Ok(rows)
    })
}

pub(super) fn artist_refs(
    database: &MusicDb,
    statement: &str,
    arguments: &[&dyn rusqlite::ToSql],
) -> Result<Vec<MusicArtistRef>, String> {
    database.with_connection(|connection| {
        let mut prepared = connection
            .prepare(statement)
            .map_err(|error| error.to_string())?;
        let rows = prepared
            .query_map(arguments, |row| {
                Ok(MusicArtistRef {
                    id: row.get(0)?,
                    connector_id: "local".to_string(),
                    name: row.get(1)?,
                    artwork: None,
                    subtitle: None,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())?;
        Ok(rows)
    })
}

#[cfg(test)]
mod tests {
    use super::super::{fixtures, tags};
    use super::*;

    #[test]
    fn albums_are_grouped_by_credited_artist_with_a_track_count() {
        let database = fixtures::library();
        let albums = recent_albums(&database, 20).expect("albums");
        assert_eq!(albums.len(), 2);
        let absolution = albums
            .iter()
            .find(|album| album.title == "Absolution")
            .expect("absolution");
        assert_eq!(absolution.artist, "Muse");
        assert_eq!(absolution.track_count, Some(2));
        assert_eq!(absolution.year, Some(2003));
        assert_eq!(absolution.connector_id, "local");
        assert_eq!(absolution.artwork, fixtures::ARTWORK);
        let compilation = albums
            .iter()
            .find(|album| album.title == "Verve Remixed")
            .expect("compilation");
        assert_eq!(compilation.artist, "Various Artists");
    }

    #[test]
    fn album_tracks_come_back_in_disc_and_track_order() {
        let database = fixtures::library();
        let albums = recent_albums(&database, 20).expect("albums");
        let absolution = albums
            .iter()
            .find(|album| album.title == "Absolution")
            .expect("absolution");
        let tracks = album_tracks(&database, &absolution.id).expect("album tracks");
        assert_eq!(
            tracks
                .iter()
                .map(|track| track.title.as_str())
                .collect::<Vec<_>>(),
            vec!["Apocalypse Please", "Hysteria"]
        );
    }

    #[test]
    fn artists_are_ranked_by_track_count() {
        let database = fixtures::library();
        let found = artists(&database, 20).expect("artists");
        assert_eq!(found.len(), 2);
        assert_eq!(found[0].name, "Muse");
        assert_eq!(found[0].connector_id, "local");
        assert!(found[0].artwork.is_none());
        assert!(found[0].subtitle.is_none());
        let tracks = artist_tracks(&database, &found[0].id, 10).expect("artist tracks");
        assert_eq!(tracks.len(), 2);
    }

    #[test]
    fn liked_local_tracks_come_back_newest_first() {
        let database = fixtures::library();
        assert!(liked_tracks(&database, 9).expect("no likes yet").is_empty());
        fixtures::like(&database, "/m/2.flac", 200);
        fixtures::like(&database, "/m/1.flac", 100);
        let liked = liked_tracks(&database, 9).expect("liked tracks");
        assert_eq!(
            liked
                .iter()
                .map(|track| track.title.as_str())
                .collect::<Vec<_>>(),
            vec!["Hysteria", "Apocalypse Please"]
        );
    }

    #[test]
    fn a_track_id_resolves_back_to_its_file() {
        let database = fixtures::library();
        let id = tags::track_id("/m/1.flac");
        assert_eq!(
            path_for(&database, &id).expect("path"),
            Some("/m/1.flac".to_string())
        );
        assert!(path_for(&database, "local:missing")
            .expect("missing path")
            .is_none());
    }
}
