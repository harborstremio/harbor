use super::db::{now_millis, track_from_row, upsert_track_in_transaction, MusicDb};
use super::{MusicMigration, MusicTrack};
use rusqlite::params;

const TRACK_COLUMNS: &str =
    "t.id, t.connector, t.source_id, t.title, t.artist, t.album, t.artwork, t.duration_seconds, t.resolved_url, t.media_kind, t.explicit, t.version";

pub fn migrate(database: &MusicDb, migration: &MusicMigration) -> Result<(), String> {
    database.with_connection(|connection| {
        let transaction = connection.transaction().map_err(|error| error.to_string())?;
        if let Some(recents) = &migration.recents {
            transaction
                .execute("DELETE FROM music_recents", [])
                .map_err(|error| error.to_string())?;
            let base = now_millis();
            for (index, track) in recents.iter().enumerate() {
                upsert_track_in_transaction(&transaction, track)?;
                transaction
                    .execute(
                        "INSERT INTO music_recents (track_id, played_at) VALUES (?1, ?2) ON CONFLICT(track_id) DO UPDATE SET played_at = excluded.played_at",
                        params![track.id, base.saturating_sub(index as i64)],
                    )
                    .map_err(|error| error.to_string())?;
            }
        }
        if let Some(queue) = &migration.queue {
            transaction
                .execute("DELETE FROM music_queue", [])
                .map_err(|error| error.to_string())?;
            for (position, track) in queue.iter().enumerate() {
                upsert_track_in_transaction(&transaction, track)?;
                transaction
                    .execute(
                        "INSERT INTO music_queue (position, track_id) VALUES (?1, ?2)",
                        params![position as i64, track.id],
                    )
                    .map_err(|error| error.to_string())?;
            }
        }
        if let Some(liked_ids) = &migration.liked_ids {
            transaction
                .execute("DELETE FROM music_liked", [])
                .map_err(|error| error.to_string())?;
            let base = now_millis();
            for (index, track_id) in liked_ids.iter().enumerate() {
                transaction
                    .execute(
                        "INSERT OR REPLACE INTO music_liked (track_id, liked_at) VALUES (?1, ?2)",
                        params![track_id, base.saturating_sub(index as i64)],
                    )
                    .map_err(|error| error.to_string())?;
            }
        }
        transaction.commit().map_err(|error| error.to_string())
    })
}

pub fn liked_ids(database: &MusicDb) -> Result<Vec<String>, String> {
    database.with_connection(|connection| {
        let mut statement = connection
            .prepare("SELECT track_id FROM music_liked ORDER BY CAST(liked_at AS INTEGER) DESC")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| error.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())
    })
}

pub fn liked_tracks(database: &MusicDb) -> Result<Vec<MusicTrack>, String> {
    database.with_connection(|connection| {
        let sql = format!(
            "SELECT {TRACK_COLUMNS} FROM music_liked l JOIN music_tracks t ON t.id = l.track_id ORDER BY CAST(l.liked_at AS INTEGER) DESC"
        );
        let mut statement = connection.prepare(&sql).map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], track_from_row)
            .map_err(|error| error.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())
    })
}

pub fn set_liked(database: &MusicDb, track: &MusicTrack, liked: bool) -> Result<(), String> {
    database.with_connection(|connection| {
        let transaction = connection.transaction().map_err(|error| error.to_string())?;
        upsert_track_in_transaction(&transaction, track)?;
        if liked {
            transaction
                .execute(
                    "INSERT INTO music_liked (track_id, liked_at) VALUES (?1, ?2) ON CONFLICT(track_id) DO UPDATE SET liked_at = excluded.liked_at",
                    params![track.id, now_millis()],
                )
                .map_err(|error| error.to_string())?;
        } else {
            transaction
                .execute("DELETE FROM music_liked WHERE track_id = ?1", params![track.id])
                .map_err(|error| error.to_string())?;
        }
        transaction.commit().map_err(|error| error.to_string())
    })
}

pub fn recents(database: &MusicDb) -> Result<Vec<MusicTrack>, String> {
    database.with_connection(|connection| {
        let sql = format!(
            "SELECT {TRACK_COLUMNS} FROM music_recents r JOIN music_tracks t ON t.id = r.track_id ORDER BY CAST(r.played_at AS INTEGER) DESC LIMIT 50"
        );
        let mut statement = connection.prepare(&sql).map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], track_from_row)
            .map_err(|error| error.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())
    })
}

pub fn add_recent(database: &MusicDb, track: &MusicTrack) -> Result<(), String> {
    database.with_connection(|connection| {
        let transaction = connection.transaction().map_err(|error| error.to_string())?;
        upsert_track_in_transaction(&transaction, track)?;
        let latest = transaction
            .query_row(
                "SELECT MAX(CAST(played_at AS INTEGER)) FROM music_recents",
                [],
                |row| row.get::<_, Option<i64>>(0),
            )
            .map_err(|error| error.to_string())?
            .unwrap_or(0);
        let played_at = now_millis().max(latest.saturating_add(1));
        transaction
            .execute(
                "INSERT INTO music_recents (track_id, played_at) VALUES (?1, ?2) ON CONFLICT(track_id) DO UPDATE SET played_at = excluded.played_at",
                params![track.id, played_at],
            )
            .map_err(|error| error.to_string())?;
        transaction
            .execute(
                "DELETE FROM music_recents WHERE track_id NOT IN (SELECT track_id FROM music_recents ORDER BY CAST(played_at AS INTEGER) DESC LIMIT 50)",
                [],
            )
            .map_err(|error| error.to_string())?;
        transaction.commit().map_err(|error| error.to_string())
    })
}

pub fn queue(database: &MusicDb) -> Result<Vec<MusicTrack>, String> {
    database.with_connection(|connection| {
        let sql = format!(
            "SELECT {TRACK_COLUMNS} FROM music_queue q JOIN music_tracks t ON t.id = q.track_id ORDER BY q.position ASC"
        );
        let mut statement = connection.prepare(&sql).map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], track_from_row)
            .map_err(|error| error.to_string())?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(|error| error.to_string())
    })
}

pub fn set_queue(database: &MusicDb, tracks: &[MusicTrack]) -> Result<(), String> {
    database.with_connection(|connection| {
        let transaction = connection
            .transaction()
            .map_err(|error| error.to_string())?;
        transaction
            .execute("DELETE FROM music_queue", [])
            .map_err(|error| error.to_string())?;
        for (position, track) in tracks.iter().enumerate() {
            upsert_track_in_transaction(&transaction, track)?;
            transaction
                .execute(
                    "INSERT INTO music_queue (position, track_id) VALUES (?1, ?2)",
                    params![position as i64, track.id],
                )
                .map_err(|error| error.to_string())?;
        }
        transaction.commit().map_err(|error| error.to_string())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(id: &str, title: &str) -> MusicTrack {
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
            album: None,
            artwork: String::new(),
            duration_seconds: 180,
            duration_label: "3:00".to_string(),
        }
    }

    #[test]
    fn video_kind_survives_collections_and_metadata_refresh() {
        let database = MusicDb::in_memory();
        let mut video = track("video-one", "One");
        video.media_kind = Some("video".into());
        add_recent(&database, &video).unwrap();
        set_queue(&database, &[video.clone()]).unwrap();
        set_liked(&database, &video, true).unwrap();
        let legacy_refresh = track("video-one", "Updated title");
        add_recent(&database, &legacy_refresh).unwrap();
        assert_eq!(recents(&database).unwrap()[0].media_kind.as_deref(), Some("video"));
        assert_eq!(queue(&database).unwrap()[0].media_kind.as_deref(), Some("video"));
        assert_eq!(liked_tracks(&database).unwrap()[0].media_kind.as_deref(), Some("video"));
        assert_eq!(queue(&database).unwrap()[0].title, "Updated title");
    }

    #[test]
    fn migration_and_updates_preserve_native_collections() {
        let database = MusicDb::in_memory();
        let first = track("one", "One");
        let second = track("two", "Two");
        migrate(
            &database,
            &MusicMigration {
                liked_ids: Some(vec![second.id.clone()]),
                recents: Some(vec![second.clone(), first.clone()]),
                queue: Some(vec![first.clone(), second.clone()]),
            },
        )
        .expect("migrate state");

        assert_eq!(liked_ids(&database).expect("liked ids"), vec!["two"]);
        assert_eq!(queue(&database).expect("queue")[0].id, "one");
        assert_eq!(recents(&database).expect("recents")[0].id, "two");

        set_liked(&database, &second, false).expect("unlike track");
        add_recent(&database, &first).expect("move recent");
        assert!(liked_ids(&database).expect("liked ids").is_empty());
        assert_eq!(recents(&database).expect("recents")[0].id, "one");
    }
}
