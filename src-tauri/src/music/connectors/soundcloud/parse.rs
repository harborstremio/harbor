use super::super::super::{duration_label, MusicArtistRef, MusicPlaylistRef, MusicTrack};
use serde::Deserialize;

pub const CONNECTOR: &str = "soundcloud";
pub const SYSTEM_PLAYLIST_PREFIX: &str = "soundcloud:system-playlists:";

const MOSAIC_TILES: usize = 4;

#[derive(Debug, Deserialize)]
#[serde(bound(deserialize = "T: serde::de::DeserializeOwned"))]
pub struct ApiCollection<T> {
    #[serde(default)]
    pub collection: Vec<T>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct ApiUser {
    pub id: Option<u64>,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct ApiPublisher {
    pub artist: Option<String>,
    pub album_title: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct ApiFormat {
    pub protocol: Option<String>,
    pub mime_type: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct ApiTranscoding {
    pub url: Option<String>,
    pub preset: Option<String>,
    pub snipped: Option<bool>,
    pub format: Option<ApiFormat>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct ApiMedia {
    pub transcodings: Vec<ApiTranscoding>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct ApiTrack {
    pub id: Option<u64>,
    pub title: Option<String>,
    pub duration: Option<u64>,
    pub full_duration: Option<u64>,
    pub artwork_url: Option<String>,
    pub policy: Option<String>,
    pub streamable: Option<bool>,
    pub track_authorization: Option<String>,
    pub user: Option<ApiUser>,
    pub publisher_metadata: Option<ApiPublisher>,
    pub media: Option<ApiMedia>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct ApiPlaylist {
    pub id: Option<u64>,
    pub urn: Option<String>,
    pub title: Option<String>,
    pub artwork_url: Option<String>,
    pub calculated_artwork_url: Option<String>,
    pub track_count: Option<u32>,
    pub user: Option<ApiUser>,
    pub tracks: Option<Vec<ApiTrack>>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct ApiSelection {
    pub urn: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub items: Option<ApiCollection<ApiPlaylist>>,
}

pub fn playable(track: &ApiTrack) -> bool {
    let policy = track
        .policy
        .as_deref()
        .unwrap_or("ALLOW")
        .to_ascii_uppercase();
    track.streamable.unwrap_or(true) && (policy == "ALLOW" || policy == "MONETIZE")
}

pub fn to_music_track(track: &ApiTrack) -> Option<MusicTrack> {
    let source_id = track.id?;
    let title = text(track.title.as_deref())?;
    let user = track.user.as_ref();
    let publisher = track.publisher_metadata.as_ref();
    let artist = publisher
        .and_then(|publisher| text(publisher.artist.as_deref()))
        .or_else(|| user.and_then(|user| text(user.username.as_deref())))
        .unwrap_or_else(|| "Unknown artist".to_string());
    let duration_seconds = track.full_duration.or(track.duration).unwrap_or(0) / 1000;
    let artwork = track
        .artwork_url
        .as_deref()
        .or_else(|| user.and_then(|user| user.avatar_url.as_deref()));
    Some(MusicTrack {
        explicit: None,
        version: None,
        media_kind: None,
        id: format!("soundcloud:{source_id}"),
        connector_id: Some(CONNECTOR.to_string()),
        source_id: Some(source_id.to_string()),
        playback_url: None,
        title,
        artist,
        album: publisher.and_then(|publisher| text(publisher.album_title.as_deref())),
        artwork: artwork.map(upgrade_artwork).unwrap_or_default(),
        duration_seconds,
        duration_label: duration_label(duration_seconds),
    })
}

pub fn to_music_tracks(tracks: &[ApiTrack]) -> Vec<MusicTrack> {
    tracks
        .iter()
        .filter(|track| playable(track))
        .filter_map(to_music_track)
        .collect()
}

pub fn to_artist_ref(user: &ApiUser) -> Option<MusicArtistRef> {
    Some(MusicArtistRef {
        id: user.id?.to_string(),
        connector_id: CONNECTOR.to_string(),
        name: text(user.username.as_deref())?,
        artwork: text(user.avatar_url.as_deref()).map(|url| upgrade_artwork(&url)),
        subtitle: None,
    })
}

pub fn to_playlist_ref(playlist: &ApiPlaylist) -> Option<MusicPlaylistRef> {
    let id = playlist_id(playlist)?;
    let name = text(playlist.title.as_deref())?;
    let mut artwork = Vec::new();
    let covers = [
        playlist.artwork_url.as_deref(),
        playlist.calculated_artwork_url.as_deref(),
    ];
    for cover in covers.into_iter().flatten() {
        add_cover(&mut artwork, cover);
    }
    for track in playlist.tracks.iter().flatten() {
        if let Some(cover) = track.artwork_url.as_deref() {
            add_cover(&mut artwork, cover);
        }
    }
    Some(MusicPlaylistRef {
        id,
        connector_id: CONNECTOR.to_string(),
        name,
        artwork,
        track_count: playlist.track_count,
        subtitle: playlist
            .user
            .as_ref()
            .and_then(|user| text(user.username.as_deref())),
    })
}

pub fn playlist_id(playlist: &ApiPlaylist) -> Option<String> {
    if let Some(urn) = playlist.urn.as_deref() {
        if urn.starts_with(SYSTEM_PLAYLIST_PREFIX) {
            return Some(urn.to_string());
        }
    }
    playlist.id.map(|id| id.to_string())
}

pub fn numeric_id(raw: &str) -> Option<u64> {
    let trimmed = raw.trim();
    let tail = trimmed.rsplit(':').next().unwrap_or(trimmed);
    tail.parse::<u64>().ok()
}

pub fn upgrade_artwork(url: &str) -> String {
    url.replace("-large.jpg", "-t500x500.jpg")
}

fn add_cover(artwork: &mut Vec<String>, url: &str) {
    if artwork.len() >= MOSAIC_TILES {
        return;
    }
    let Some(url) = text(Some(url)).map(|url| upgrade_artwork(&url)) else {
        return;
    };
    if !artwork.contains(&url) {
        artwork.push(url);
    }
}

fn text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    const TRACK: &str = r#"{
        "id": 286017854,
        "title": "  Windowlicker  ",
        "duration": 30000,
        "full_duration": 197000,
        "artwork_url": "https://i1.sndcdn.com/artworks-000123-large.jpg",
        "policy": "ALLOW",
        "streamable": true,
        "track_authorization": "eyJ0eXAiOiJKV1QifQ",
        "genre": "Electronic",
        "user": { "id": 948745750, "username": "Aphex Twin", "avatar_url": "https://i1.sndcdn.com/avatars-000999-large.jpg" },
        "publisher_metadata": { "artist": "Aphex Twin", "album_title": "Windowlicker" },
        "media": { "transcodings": [] }
    }"#;

    fn track() -> ApiTrack {
        serde_json::from_str::<ApiTrack>(TRACK).expect("track fixture")
    }

    #[test]
    fn tracks_map_to_the_harbor_shape() {
        let mapped = to_music_track(&track()).expect("mapped track");
        assert_eq!(mapped.id, "soundcloud:286017854");
        assert_eq!(mapped.source_id.as_deref(), Some("286017854"));
        assert_eq!(mapped.connector_id.as_deref(), Some("soundcloud"));
        assert_eq!(mapped.title, "Windowlicker");
        assert_eq!(mapped.artist, "Aphex Twin");
        assert_eq!(mapped.album.as_deref(), Some("Windowlicker"));
        assert_eq!(mapped.duration_seconds, 197);
        assert_eq!(mapped.duration_label, "3:17");
        assert_eq!(
            mapped.artwork,
            "https://i1.sndcdn.com/artworks-000123-t500x500.jpg"
        );
    }

    #[test]
    fn shallow_tracks_are_dropped_until_they_are_hydrated() {
        let shallow = serde_json::from_str::<ApiTrack>(r#"{ "id": 42 }"#).expect("shallow track");
        assert!(to_music_track(&shallow).is_none());
        assert!(playable(&shallow));
    }

    #[test]
    fn blocked_and_preview_tracks_are_not_offered() {
        for policy in ["BLOCK", "SNIP"] {
            let value = format!(r#"{{ "id": 1, "title": "x", "policy": "{policy}" }}"#);
            let track = serde_json::from_str::<ApiTrack>(&value).expect("policy track");
            assert!(!playable(&track));
        }
        let allowed =
            serde_json::from_str::<ApiTrack>(r#"{ "id": 1, "title": "x", "policy": "MONETIZE" }"#)
                .expect("monetized track");
        assert!(playable(&allowed));
        let unpublished =
            serde_json::from_str::<ApiTrack>(r#"{ "id": 1, "title": "x", "streamable": false }"#)
                .expect("unpublished track");
        assert!(!playable(&unpublished));
    }

    #[test]
    fn uploader_name_stands_in_when_publisher_metadata_is_absent() {
        let track = serde_json::from_str::<ApiTrack>(
            r#"{ "id": 7, "title": "Demo", "publisher_metadata": null, "user": { "id": 3, "username": "bedroom" } }"#,
        )
        .expect("uploader track");
        let mapped = to_music_track(&track).expect("mapped track");
        assert_eq!(mapped.artist, "bedroom");
        assert_eq!(mapped.album, None);
    }

    #[test]
    fn playlists_prefer_the_system_urn_and_build_a_cover_mosaic() {
        let playlist = serde_json::from_str::<ApiPlaylist>(
            r#"{
                "id": 11,
                "urn": "soundcloud:system-playlists:trending-by-genre:trap",
                "title": "Trending Trap",
                "artwork_url": "https://i1.sndcdn.com/artworks-a-large.jpg",
                "track_count": 50,
                "user": { "id": 1, "username": "SoundCloud" },
                "tracks": [
                    { "id": 1, "artwork_url": "https://i1.sndcdn.com/artworks-a-large.jpg" },
                    { "id": 2, "artwork_url": "https://i1.sndcdn.com/artworks-b-large.jpg" },
                    { "id": 3, "artwork_url": "https://i1.sndcdn.com/artworks-c-large.jpg" },
                    { "id": 4, "artwork_url": "https://i1.sndcdn.com/artworks-d-large.jpg" },
                    { "id": 5, "artwork_url": "https://i1.sndcdn.com/artworks-e-large.jpg" }
                ]
            }"#,
        )
        .expect("playlist fixture");
        let mapped = to_playlist_ref(&playlist).expect("mapped playlist");
        assert_eq!(
            mapped.id,
            "soundcloud:system-playlists:trending-by-genre:trap"
        );
        assert_eq!(mapped.track_count, Some(50));
        assert_eq!(mapped.subtitle.as_deref(), Some("SoundCloud"));
        assert_eq!(mapped.artwork.len(), 4);
        assert_eq!(
            mapped.artwork[0],
            "https://i1.sndcdn.com/artworks-a-t500x500.jpg"
        );
        assert_eq!(
            mapped.artwork[3],
            "https://i1.sndcdn.com/artworks-d-t500x500.jpg"
        );
    }

    #[test]
    fn plain_playlists_fall_back_to_the_numeric_id() {
        let playlist =
            serde_json::from_str::<ApiPlaylist>(r#"{ "id": 998, "title": "Late night" }"#)
                .expect("plain playlist");
        assert_eq!(playlist_id(&playlist).as_deref(), Some("998"));
        assert!(to_playlist_ref(&playlist)
            .expect("mapped playlist")
            .artwork
            .is_empty());
    }

    #[test]
    fn users_map_to_artist_references() {
        let user = serde_json::from_str::<ApiUser>(
            r#"{ "id": 948745750, "username": "Aphex Twin", "avatar_url": "https://i1.sndcdn.com/avatars-000999-large.jpg" }"#,
        )
        .expect("user fixture");
        let mapped = to_artist_ref(&user).expect("mapped artist");
        assert_eq!(mapped.id, "948745750");
        assert_eq!(mapped.connector_id, "soundcloud");
        assert_eq!(
            mapped.artwork.as_deref(),
            Some("https://i1.sndcdn.com/avatars-000999-t500x500.jpg")
        );
        assert_eq!(mapped.subtitle, None);
    }

    #[test]
    fn numeric_ids_are_read_from_plain_ids_and_urns() {
        assert_eq!(numeric_id("286017854"), Some(286017854));
        assert_eq!(numeric_id("soundcloud:users:948745750"), Some(948745750));
        assert_eq!(numeric_id("soundcloud:286017854"), Some(286017854));
        assert_eq!(numeric_id("https://soundcloud.com/muse/hysteria"), None);
        assert_eq!(numeric_id("../../etc"), None);
    }

    #[test]
    fn collections_tolerate_a_missing_collection_key() {
        let empty = serde_json::from_str::<ApiCollection<ApiTrack>>(r#"{ "total_results": 0 }"#)
            .expect("empty collection");
        assert!(empty.collection.is_empty());
    }
}
