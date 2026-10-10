use std::collections::HashMap;
use super::db::{now_millis, track_from_row, upsert_track_in_transaction, MusicDb};
use super::MusicTrack;
use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use uuid::Uuid;

const TRACK_COLUMNS: &str =
    "t.id, t.connector, t.source_id, t.title, t.artist, t.album, t.artwork, t.duration_seconds, t.resolved_url, t.media_kind, t.explicit, t.version";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicAlbum {
    id: i64,
    title: String,
    artist: String,
    artwork: String,
    track_count: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicArtist {
    id: i64,
    name: String,
    track_count: u64,
    album_count: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicPlaylist {
    id: String,
    name: String,
    created_at: String,
    updated_at: String,
    tracks: Vec<MusicTrack>,
    track_added_at: HashMap<String, String>,
}

pub fn list_albums(database: &MusicDb) -> Result<Vec<MusicAlbum>, String> {
    database.with_connection(|connection| {
        let mut statement = connection
            .prepare(
                r#"
SELECT al.id, al.title, ar.name,
       COALESCE(NULLIF(al.artwork, ''), MAX(t.artwork), ''),
       COUNT(t.id)
FROM albums al
JOIN artists ar ON ar.id = al.artist_id
LEFT JOIN music_tracks t
  ON t.album = al.title COLLATE NOCASE AND t.artist = ar.name COLLATE NOCASE
GROUP BY al.id, al.title, ar.name, al.artwork
ORDER BY al.title COLLATE NOCASE, ar.name COLLATE NOCASE
"#,
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok(MusicAlbum {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    artist: row.get(2)?,
                    artwork: row.get(3)?,
                    track_count: row.get::<_, i64>(4)?.max(0) as u64,
                })
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())
    })
}

pub fn list_artists(database: &MusicDb) -> Result<Vec<MusicArtist>, String> {
    database.with_connection(|connection| {
        let mut statement = connection
            .prepare(
                r#"
SELECT ar.id, ar.name, COUNT(DISTINCT t.id), COUNT(DISTINCT al.id)
FROM artists ar
LEFT JOIN music_tracks t ON t.artist = ar.name COLLATE NOCASE
LEFT JOIN albums al ON al.artist_id = ar.id
GROUP BY ar.id, ar.name
ORDER BY ar.name COLLATE NOCASE
"#,
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok(MusicArtist {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    track_count: row.get::<_, i64>(2)?.max(0) as u64,
                    album_count: row.get::<_, i64>(3)?.max(0) as u64,
                })
            })
            .map_err(|error| error.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())
    })
}

pub fn list_playlists(database: &MusicDb) -> Result<Vec<MusicPlaylist>, String> {
    database.with_connection(|connection| {
        let mut statement = connection
            .prepare(
                "SELECT id, name, created_at, updated_at FROM playlists ORDER BY CAST(updated_at AS INTEGER) DESC, name COLLATE NOCASE",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            })
            .map_err(|error| error.to_string())?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())?;
        drop(statement);

        rows.into_iter()
            .map(|(id, name, created_at, updated_at)| {
                let tracks = playlist_tracks(connection, &id)?;
                let track_added_at = playlist_dates(connection, &id)?;
                Ok(MusicPlaylist {
                    track_added_at,
                    id,
                    name,
                    created_at,

                    updated_at,
                    tracks,
                })
            })
            .collect()
    })
}

pub fn tracks_for_playlist(
    database: &MusicDb,
    playlist_id: &str,
) -> Result<Vec<MusicTrack>, String> {
    database.with_connection(|connection| {
        require_playlist(connection, playlist_id)?;
        playlist_tracks(connection, playlist_id)
    })
}

pub fn create_playlist(database: &MusicDb, name: &str) -> Result<MusicPlaylist, String> {
    let name = valid_playlist_name(name)?;
    let id = Uuid::new_v4().to_string();
    let timestamp = now_millis().to_string();
    database.with_connection(|connection| {
        connection
            .execute(
                "INSERT INTO playlists (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
                params![id, name, timestamp],
            )
            .map_err(|error| error.to_string())?;
        Ok(MusicPlaylist {
            id,
            name,
            created_at: timestamp.clone(),
            updated_at: timestamp,
            tracks: Vec::new(),
            track_added_at: HashMap::new(),
        })
    })
}

pub fn rename_playlist(
    database: &MusicDb,
    playlist_id: &str,
    name: &str,
) -> Result<MusicPlaylist, String> {
    let name = valid_playlist_name(name)?;
    let timestamp = now_millis().to_string();
    database.with_connection(|connection| {
        let transaction = connection
            .transaction()
            .map_err(|error| error.to_string())?;
        require_playlist(&transaction, playlist_id)?;
        transaction
            .execute(
                "UPDATE playlists SET name = ?2, updated_at = ?3 WHERE id = ?1",
                params![playlist_id, name, timestamp],
            )
            .map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())?;
        get_playlist(connection, playlist_id)
    })
}

pub fn delete_playlist(database: &MusicDb, playlist_id: &str) -> Result<(), String> {
    database.with_connection(|connection| {
        let transaction = connection
            .transaction()
            .map_err(|error| error.to_string())?;
        require_playlist(&transaction, playlist_id)?;
        // The membership rows are removed explicitly rather than relying on a cascade, which
        // this schema does not declare.
        transaction
            .execute(
                "DELETE FROM playlist_tracks WHERE playlist_id = ?1",
                params![playlist_id],
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute("DELETE FROM playlists WHERE id = ?1", params![playlist_id])
            .map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())?;
        Ok(())
    })
}

pub fn add_to_playlist(
    database: &MusicDb,
    playlist_id: &str,
    track: &MusicTrack,
) -> Result<MusicPlaylist, String> {
    add_tracks_to_playlist(database, playlist_id, std::slice::from_ref(track))
}

pub fn add_tracks_to_playlist(
    database: &MusicDb,
    playlist_id: &str,
    tracks: &[MusicTrack],
) -> Result<MusicPlaylist, String> {
    database.with_connection(|connection| {
        let transaction = connection.transaction().map_err(|error| error.to_string())?;
        require_playlist(&transaction, playlist_id)?;
        let mut position = transaction
            .query_row(
                "SELECT COALESCE(MAX(position) + 1, 0) FROM playlist_tracks WHERE playlist_id = ?1",
                params![playlist_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| error.to_string())?;
        for track in tracks {
            upsert_track_in_transaction(&transaction, track)?;
            let inserted = transaction
                .execute(
                    "INSERT OR IGNORE INTO playlist_tracks (playlist_id, position, track_id) VALUES (?1, ?2, ?3)",
                    params![playlist_id, position, track.id],
                )
                .map_err(|error| error.to_string())?;
            if inserted > 0 {
                transaction.execute(
                    "INSERT INTO playlist_track_dates (playlist_id, track_id, added_at) VALUES (?1, ?2, ?3)",
                    params![playlist_id, track.id, now_millis().to_string()],
                ).map_err(|error| error.to_string())?;
                position = position.saturating_add(1);
            }
        }
        transaction
            .execute(
                "UPDATE playlists SET updated_at = ?2 WHERE id = ?1",
                params![playlist_id, now_millis().to_string()],
            )
            .map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())?;
        get_playlist(connection, playlist_id)
    })
}

/// The order after moving one track to a new index. Pulled out of the database work so the
/// index arithmetic, which is the part that is easy to get wrong, can be tested on its own.
pub fn reordered(mut ids: Vec<String>, track_id: &str, to_index: usize) -> Vec<String> {
    let Some(from) = ids.iter().position(|id| id == track_id) else {
        return ids;
    };
    let track = ids.remove(from);
    let to = to_index.min(ids.len());
    ids.insert(to, track);
    ids
}

pub fn reorder_playlist(
    database: &MusicDb,
    playlist_id: &str,
    track_id: &str,
    to_index: usize,
) -> Result<MusicPlaylist, String> {
    database.with_connection(|connection| {
        let transaction = connection.transaction().map_err(|error| error.to_string())?;
        require_playlist(&transaction, playlist_id)?;
        let current = {
            let mut statement = transaction
                .prepare(
                    "SELECT track_id FROM playlist_tracks WHERE playlist_id = ?1 ORDER BY position",
                )
                .map_err(|error| error.to_string())?;
            let ids = statement
                .query_map(params![playlist_id], |row| row.get::<_, String>(0))
                .map_err(|error| error.to_string())?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(|error| error.to_string())?;
            ids
        };
        let next = reordered(current, track_id, to_index);
        transaction
            .execute(
                "DELETE FROM playlist_tracks WHERE playlist_id = ?1",
                params![playlist_id],
            )
            .map_err(|error| error.to_string())?;
        for (position, id) in next.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO playlist_tracks (playlist_id, position, track_id) VALUES (?1, ?2, ?3)",
                    params![playlist_id, position as i64, id],
                )
                .map_err(|error| error.to_string())?;
        }
        transaction
            .execute(
                "UPDATE playlists SET updated_at = ?2 WHERE id = ?1",
                params![playlist_id, now_millis().to_string()],
            )
            .map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())?;
        get_playlist(connection, playlist_id)
    })
}

pub fn remove_from_playlist(
    database: &MusicDb,
    playlist_id: &str,
    track_id: &str,
) -> Result<MusicPlaylist, String> {
    database.with_connection(|connection| {
        let transaction = connection.transaction().map_err(|error| error.to_string())?;
        require_playlist(&transaction, playlist_id)?;
        transaction.execute(
            "DELETE FROM playlist_track_dates WHERE playlist_id = ?1 AND track_id = ?2",
            params![playlist_id, track_id],
        ).map_err(|error| error.to_string())?;
        let track_ids = {
            let mut statement = transaction
                .prepare(
                    "SELECT track_id FROM playlist_tracks WHERE playlist_id = ?1 AND track_id <> ?2 ORDER BY position",
                )
                .map_err(|error| error.to_string())?;
            let tracks = statement
                .query_map(params![playlist_id, track_id], |row| row.get::<_, String>(0))
                .map_err(|error| error.to_string())?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(|error| error.to_string())?;
            tracks
        };
        transaction
            .execute(
                "DELETE FROM playlist_tracks WHERE playlist_id = ?1",
                params![playlist_id],
            )
            .map_err(|error| error.to_string())?;
        for (position, remaining_id) in track_ids.iter().enumerate() {
            transaction
                .execute(
                    "INSERT INTO playlist_tracks (playlist_id, position, track_id) VALUES (?1, ?2, ?3)",
                    params![playlist_id, position as i64, remaining_id],
                )
                .map_err(|error| error.to_string())?;
        }
        transaction
            .execute(
                "UPDATE playlists SET updated_at = ?2 WHERE id = ?1",
                params![playlist_id, now_millis().to_string()],
            )
            .map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())?;
        get_playlist(connection, playlist_id)
    })
}

fn get_playlist(
    connection: &rusqlite::Connection,
    playlist_id: &str,
) -> Result<MusicPlaylist, String> {
    let row = connection
        .query_row(
            "SELECT id, name, created_at, updated_at FROM playlists WHERE id = ?1",
            params![playlist_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Music playlist was not found".to_string())?;
    Ok(MusicPlaylist {
        id: row.0,
        name: row.1,
        created_at: row.2,
        updated_at: row.3,
        tracks: playlist_tracks(connection, playlist_id)?,
        track_added_at: playlist_dates(connection, playlist_id)?,
    })
}

fn playlist_dates(connection: &rusqlite::Connection, playlist_id: &str) -> Result<HashMap<String, String>, String> {
    let mut statement = connection.prepare("SELECT track_id, added_at FROM playlist_track_dates WHERE playlist_id = ?1")
        .map_err(|error| error.to_string())?;
    let rows = statement.query_map(params![playlist_id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| error.to_string())?;
    rows.collect::<rusqlite::Result<HashMap<_, _>>>().map_err(|error| error.to_string())
}

fn playlist_tracks(
    connection: &rusqlite::Connection,
    playlist_id: &str,
) -> Result<Vec<MusicTrack>, String> {
    let sql = format!(
        "SELECT {TRACK_COLUMNS} FROM playlist_tracks p JOIN music_tracks t ON t.id = p.track_id WHERE p.playlist_id = ?1 ORDER BY p.position"
    );
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![playlist_id], track_from_row)
        .map_err(|error| error.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| error.to_string())
}

fn require_playlist(connection: &rusqlite::Connection, playlist_id: &str) -> Result<(), String> {
    let exists = connection
        .query_row(
            "SELECT 1 FROM playlists WHERE id = ?1",
            params![playlist_id],
            |_| Ok(()),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    exists.ok_or_else(|| "Music playlist was not found".to_string())
}

fn valid_playlist_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 100 {
        return Err("Playlist name must be between 1 and 100 characters".to_string());
    }
    Ok(name.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(id: &str, title: &str, album: Option<&str>) -> MusicTrack {
        MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: id.to_string(),
            connector_id: Some("youtube".to_string()),
            source_id: Some(id.to_string()),
            playback_url: None,
            title: title.to_string(),
            artist: "Muse".to_string(),
            album: album.map(str::to_string),
            artwork: "cover.jpg".to_string(),
            duration_seconds: 180,
            duration_label: "3:00".to_string(),
        }
    }

    #[test]
    fn membership_dates_survive_reordering_and_remove_only_with_membership() {
        let database = MusicDb::in_memory();
        let songs = [track("one", "One", None), track("two", "Two", None)];
        let playlist = create_playlist(&database, "Dates").unwrap();
        let added = add_tracks_to_playlist(&database, &playlist.id, &songs).unwrap();
        assert_eq!(added.track_added_at.len(), 2);
        let duplicate = add_to_playlist(&database, &playlist.id, &songs[0]).unwrap();
        assert_eq!(duplicate.track_added_at, added.track_added_at);
        let moved = reorder_playlist(&database, &playlist.id, "two", 0).unwrap();
        assert_eq!(moved.track_added_at, added.track_added_at);
        let removed = remove_from_playlist(&database, &playlist.id, "one").unwrap();
        assert_eq!(removed.track_added_at.len(), 1);
        assert_eq!(removed.track_added_at.get("two"), added.track_added_at.get("two"));
        let reread = list_playlists(&database).unwrap();
        assert_eq!(reread[0].track_added_at, removed.track_added_at);
        delete_playlist(&database, &playlist.id).unwrap();
        database.with_connection(|connection| {
            assert!(playlist_dates(connection, &playlist.id)?.is_empty());
            Ok(())
        }).unwrap();
    }

    #[test]
    fn reordering_moves_one_track_and_leaves_the_rest_in_order() {
        let ids = || {
            vec![
                "a".to_string(),
                "b".to_string(),
                "c".to_string(),
                "d".to_string(),
            ]
        };
        assert_eq!(reordered(ids(), "a", 2), vec!["b", "c", "a", "d"]);
        assert_eq!(reordered(ids(), "d", 0), vec!["d", "a", "b", "c"]);
        assert_eq!(
            reordered(ids(), "b", 1),
            ids(),
            "moving to its own index is a no-op"
        );
        assert_eq!(
            reordered(ids(), "a", 99),
            vec!["b", "c", "d", "a"],
            "past the end clamps"
        );
        assert_eq!(
            reordered(ids(), "missing", 0),
            ids(),
            "an unknown track changes nothing"
        );
        assert_eq!(reordered(Vec::new(), "a", 0), Vec::<String>::new());
    }

    #[test]
    fn reordering_a_playlist_persists_the_new_order() {
        let database = MusicDb::in_memory();
        let songs = [
            track("one", "One", Some("Absolution")),
            track("two", "Two", Some("Absolution")),
            track("three", "Three", Some("Absolution")),
        ];
        for song in &songs {
            database.upsert_track(song).expect("store track");
        }
        let playlist = create_playlist(&database, "Evening").expect("create playlist");
        add_tracks_to_playlist(&database, &playlist.id, &songs).expect("add tracks");

        let moved = reorder_playlist(&database, &playlist.id, "three", 0).expect("reorder");
        let order: Vec<_> = moved.tracks.iter().map(|t| t.id.as_str()).collect();
        assert_eq!(order, vec!["three", "one", "two"]);

        let reread = list_playlists(&database).expect("list");
        let stored: Vec<_> = reread[0].tracks.iter().map(|t| t.id.as_str()).collect();
        assert_eq!(
            stored,
            vec!["three", "one", "two"],
            "the order survives a reread"
        );
    }

    #[test]
    fn reordering_an_unknown_playlist_is_an_error() {
        let database = MusicDb::in_memory();
        assert!(reorder_playlist(&database, "missing", "a", 0).is_err());
    }

    #[test]
    fn a_playlist_can_be_renamed_and_deleted() {
        let database = MusicDb::in_memory();
        let song = track("one", "One", Some("Absolution"));
        database.upsert_track(&song).expect("store track");
        let playlist = create_playlist(&database, "Evening").expect("create playlist");
        add_to_playlist(&database, &playlist.id, &song).expect("add track");

        let renamed = rename_playlist(&database, &playlist.id, "  Late night  ")
            .expect("rename the playlist");
        assert_eq!(renamed.name, "Late night", "the stored name is trimmed");
        assert_eq!(renamed.tracks.len(), 1, "renaming leaves the tracks alone");

        delete_playlist(&database, &playlist.id).expect("delete the playlist");
        assert!(
            list_playlists(&database)
                .expect("list playlists")
                .is_empty(),
            "the playlist is gone"
        );
        assert!(
            database.get_track("one").expect("read track").is_some(),
            "deleting a playlist must not take the tracks with it"
        );
    }

    #[test]
    fn renaming_rejects_an_empty_name_and_an_unknown_playlist() {
        let database = MusicDb::in_memory();
        let playlist = create_playlist(&database, "Evening").expect("create playlist");
        assert!(rename_playlist(&database, &playlist.id, "   ").is_err());
        assert!(rename_playlist(&database, "missing", "Anything").is_err());
        assert!(delete_playlist(&database, "missing").is_err());
    }

    #[test]
    fn native_library_derives_metadata_and_persists_playlists() {
        let database = MusicDb::in_memory();
        let first = track("one", "One", Some("Absolution"));
        let second = track("two", "Two", Some("Absolution"));
        database.upsert_track(&first).expect("store first track");
        database.upsert_track(&second).expect("store second track");

        let albums = list_albums(&database).expect("list albums");
        let artists = list_artists(&database).expect("list artists");
        assert_eq!(albums.len(), 1);
        assert_eq!(albums[0].track_count, 2);
        assert_eq!(artists[0].track_count, 2);

        let playlist = create_playlist(&database, "Drive").expect("create playlist");
        add_to_playlist(&database, &playlist.id, &first).expect("add first track");
        add_to_playlist(&database, &playlist.id, &second).expect("add second track");
        let playlists = list_playlists(&database).expect("list playlists");
        assert_eq!(playlists[0].tracks.len(), 2);

        let updated =
            remove_from_playlist(&database, &playlist.id, &first.id).expect("remove first track");
        assert_eq!(updated.tracks.len(), 1);
        assert_eq!(updated.tracks[0].id, second.id);
    }
}
