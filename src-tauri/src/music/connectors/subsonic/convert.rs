use super::super::super::connector::ConnectorHealth;
use super::super::super::{
    duration_label, MusicAlbumRef, MusicArtistRef, MusicPlaylistRef, MusicTrack,
};
use super::client::SubsonicClient;
use super::model;
use super::CONNECTOR_ID;
use std::collections::HashMap;

const MAX_ID_LENGTH: usize = 128;

pub fn track_ref(client: &SubsonicClient, song: model::Child) -> MusicTrack {
    let duration_seconds = song.duration.unwrap_or(0);
    MusicTrack {
        explicit: None,
        version: None,
        media_kind: None,
        id: format!("{CONNECTOR_ID}:{}", song.id),
        connector_id: Some(CONNECTOR_ID.to_string()),
        source_id: Some(song.id),
        playback_url: None,
        title: song.title,
        artist: song.artist.unwrap_or_default(),
        album: song.album,
        artwork: artwork(client, song.cover_art),
        duration_seconds,
        duration_label: duration_label(duration_seconds),
    }
}

pub fn album_ref(client: &SubsonicClient, album: model::AlbumId3) -> MusicAlbumRef {
    MusicAlbumRef {
        id: album.id,
        connector_id: CONNECTOR_ID.to_string(),
        title: album.name,
        artist: album.artist.unwrap_or_default(),
        artwork: artwork(client, album.cover_art),
        year: album.year,
        track_count: album.song_count,
        explicit: None,
    }
}

pub fn artist_ref(client: &SubsonicClient, artist: model::ArtistId3) -> MusicArtistRef {
    let artwork = artist
        .cover_art
        .filter(|cover| !cover.is_empty())
        .map(|cover| client.cover_art_url(&cover))
        .or(artist.artist_image_url)
        .filter(|value| !value.is_empty());
    MusicArtistRef {
        id: artist.id,
        connector_id: CONNECTOR_ID.to_string(),
        name: artist.name,
        artwork,
        subtitle: None,
    }
}

pub fn playlist_ref(client: &SubsonicClient, playlist: model::PlaylistSummary) -> MusicPlaylistRef {
    MusicPlaylistRef {
        id: playlist.id,
        connector_id: CONNECTOR_ID.to_string(),
        name: playlist.name,
        artwork: playlist
            .cover_art
            .filter(|cover| !cover.is_empty())
            .map(|cover| vec![client.cover_art_url(&cover)])
            .unwrap_or_default(),
        track_count: playlist.song_count,
        subtitle: playlist
            .comment
            .map(|comment| comment.trim().to_string())
            .filter(|comment| !comment.is_empty()),
    }
}

fn artwork(client: &SubsonicClient, cover_art: Option<String>) -> String {
    cover_art
        .filter(|cover| !cover.is_empty())
        .map(|cover| client.cover_art_url(&cover))
        .unwrap_or_default()
}

pub fn field(fields: &HashMap<String, String>, key: &str, label: &str) -> Result<String, String> {
    fields
        .get(key)
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .ok_or_else(|| format!("Enter your music server {label}"))
}

pub fn safe_id(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    let trimmed = trimmed
        .strip_prefix(&format!("{CONNECTOR_ID}:"))
        .unwrap_or(trimmed);
    if trimmed.is_empty()
        || trimmed.len() > MAX_ID_LENGTH
        || !trimmed.chars().all(|value| value.is_ascii_graphic())
    {
        return Err("That music server item is not available".to_string());
    }
    Ok(trimmed.to_string())
}

pub fn classify_error(error: &str) -> ConnectorHealth {
    let lower = error.to_ascii_lowercase();
    if [
        "timed out",
        "timeout",
        "network",
        "connection",
        "dns",
        "resolve host",
        "offline",
        "could not reach",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
    {
        ConnectorHealth::Offline
    } else {
        ConnectorHealth::Degraded
    }
}

#[cfg(test)]
mod tests {
    use super::super::pairing::Pairing;
    use super::*;

    fn client() -> SubsonicClient {
        SubsonicClient::new(
            reqwest::Client::new(),
            Pairing {
                base_url: "https://music.example.test".to_string(),
                username: "alice".to_string(),
                salt: "c19b2d".to_string(),
                token: "26719a1196d2a940705a59634eb18eab".to_string(),
            },
        )
    }

    fn song(raw: &str) -> model::Child {
        serde_json::from_str(raw).expect("song")
    }

    #[test]
    fn songs_become_namespaced_playable_tracks() {
        let track = track_ref(
            &client(),
            song(
                r#"{"id":"mf-1","title":"Hysteria","album":"Absolution","artist":"Muse","coverArt":"mf-1_9f","duration":227}"#,
            ),
        );
        assert_eq!(track.id, "subsonic:mf-1");
        assert_eq!(track.source_id.as_deref(), Some("mf-1"));
        assert_eq!(track.connector_id.as_deref(), Some("subsonic"));
        assert_eq!(track.duration_label, "3:47");
        assert!(track.artwork.contains("getCoverArt"));
        assert!(track.artwork.contains("id=mf-1_9f"));
    }

    #[test]
    fn songs_without_artwork_degrade_to_an_empty_string() {
        let track = track_ref(&client(), song(r#"{"id":"mf-2","title":"Untitled"}"#));
        assert!(track.artwork.is_empty());
        assert_eq!(track.duration_seconds, 0);
        assert!(track.album.is_none());
    }

    #[test]
    fn albums_and_playlists_carry_only_what_the_server_supplied() {
        let album = album_ref(
            &client(),
            serde_json::from_str(r#"{"id":"al-1","name":"Absolution","artist":"Muse"}"#)
                .expect("album"),
        );
        assert_eq!(album.connector_id, "subsonic");
        assert!(album.year.is_none());
        assert!(album.track_count.is_none());
        assert!(album.artwork.is_empty());

        let playlist = playlist_ref(
            &client(),
            serde_json::from_str(r#"{"id":"pl-1","name":"Drive","comment":"  "}"#)
                .expect("playlist"),
        );
        assert!(playlist.subtitle.is_none());
        assert!(playlist.artwork.is_empty());
    }

    #[test]
    fn artists_fall_back_to_the_servers_own_image_url() {
        let artist = artist_ref(
            &client(),
            serde_json::from_str(
                r#"{"id":"ar-1","name":"Muse","artistImageUrl":"https://example.test/m.jpg"}"#,
            )
            .expect("artist"),
        );
        assert_eq!(
            artist.artwork.as_deref(),
            Some("https://example.test/m.jpg")
        );
        assert!(artist.subtitle.is_none());
    }

    #[test]
    fn ids_drop_the_harbor_prefix_and_reject_junk() {
        assert_eq!(safe_id("subsonic:mf-1").expect("id"), "mf-1");
        assert_eq!(safe_id("  al-9f3c ").expect("id"), "al-9f3c");
        assert!(safe_id("subsonic:").is_err());
        assert!(safe_id("mf 1").is_err());
        assert!(safe_id(&"a".repeat(MAX_ID_LENGTH + 1)).is_err());
    }

    #[test]
    fn missing_sign_in_fields_name_what_is_missing() {
        let mut fields = HashMap::new();
        fields.insert(
            "url".to_string(),
            " https://music.example.test ".to_string(),
        );
        fields.insert("password".to_string(), "  ".to_string());
        assert_eq!(
            field(&fields, "url", "address").expect("address").trim(),
            "https://music.example.test"
        );
        assert_eq!(
            field(&fields, "username", "username"),
            Err("Enter your music server username".to_string())
        );
        assert!(field(&fields, "password", "password").is_err());
    }

    #[test]
    fn unreachable_servers_read_as_offline_and_rejections_as_degraded() {
        assert_eq!(
            classify_error("Music server request failed: dns error"),
            ConnectorHealth::Offline
        );
        assert_eq!(
            classify_error("Music server error 70"),
            ConnectorHealth::Degraded
        );
    }
}
