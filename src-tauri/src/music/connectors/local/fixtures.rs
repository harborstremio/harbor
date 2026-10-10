use super::store::{self, LocalFile};
use super::tags::{self, ScannedTrack, TrackFields};
use crate::music::db::MusicDb;
use crate::music::MusicTrack;
use rusqlite::params;

pub const ARTWORK: &str = "http://asset.localhost/art.jpg";

pub fn entry(
    path: &str,
    title: &str,
    artist: &str,
    album_artist: Option<&str>,
    album: &str,
    track_no: u32,
) -> (LocalFile, ScannedTrack) {
    let fields = TrackFields {
        title: title.to_string(),
        artist: artist.to_string(),
        album: Some(album.to_string()),
        album_artist: album_artist.map(str::to_string),
        track_no: Some(track_no),
        disc_no: Some(1),
        year: Some(2003),
    };
    let track = MusicTrack {
        explicit: None,
        version: None,
        media_kind: None,
        id: tags::track_id(path),
        connector_id: Some("local".to_string()),
        source_id: Some(path.to_string()),
        playback_url: Some(path.to_string()),
        title: fields.title.clone(),
        artist: fields.artist.clone(),
        album: fields.album.clone(),
        artwork: ARTWORK.to_string(),
        duration_seconds: 227,
        duration_label: "3:47".to_string(),
    };
    (
        LocalFile {
            path: path.to_string(),
            size: 1024,
            mtime: 1_700_000_000,
        },
        ScannedTrack { track, fields },
    )
}

pub fn database() -> MusicDb {
    let database = MusicDb::in_memory();
    store::create_schema(&database).expect("local schema");
    database
}

pub fn library() -> MusicDb {
    let database = database();
    let entries = vec![
        entry("/m/2.flac", "Hysteria", "Muse", None, "Absolution", 2),
        entry(
            "/m/1.flac",
            "Apocalypse Please",
            "Muse",
            None,
            "Absolution",
            1,
        ),
        entry(
            "/m/3.flac",
            "Sinnerman",
            "Nina Simone",
            Some("Various Artists"),
            "Verve Remixed",
            1,
        ),
    ];
    store::write(&database, &entries).expect("write library");
    database
}

pub fn like(database: &MusicDb, path: &str, liked_at: i64) {
    let id = tags::track_id(path);
    database
        .with_connection(|connection| {
            connection
                .execute(
                    "INSERT INTO music_liked (track_id, liked_at) VALUES (?1, ?2)",
                    params![id, liked_at.to_string()],
                )
                .map(|_| ())
                .map_err(|error| error.to_string())
        })
        .expect("like track");
}
