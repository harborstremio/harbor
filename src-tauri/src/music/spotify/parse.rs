use super::super::{duration_label, MusicAlbumRef, MusicArtistRef, MusicPlaylistRef, MusicTrack};
use serde_json::Value;

pub const CONNECTOR: &str = "spotify";

pub fn track(item: &Value) -> Option<MusicTrack> {
    let uri = non_empty(item.get("uri")?)?.to_string();
    let title = non_empty(item.get("name")?)?.to_string();
    let duration_seconds = item
        .get("duration_ms")
        .and_then(Value::as_u64)
        .unwrap_or_default()
        / 1000;
    Some(MusicTrack {
        explicit: item.get("explicit").and_then(Value::as_bool),
        version: None,
        media_kind: None,
        id: uri.clone(),
        connector_id: Some(CONNECTOR.to_string()),
        source_id: Some(uri),
        playback_url: None,
        title,
        artist: artist_names(item.get("artists")),
        album: item
            .pointer("/album/name")
            .and_then(non_empty)
            .map(str::to_string),
        artwork: best_image(item.pointer("/album/images")),
        duration_seconds,
        duration_label: duration_label(duration_seconds),
    })
}

pub fn album_track(item: &Value, album: &MusicAlbumRef) -> Option<MusicTrack> {
    let mut track = track(item)?;
    if track.artist.is_empty() {
        track.artist = album.artist.clone();
    }
    if track.album.is_none() {
        track.album = Some(album.title.clone());
    }
    if track.artwork.is_empty() {
        track.artwork = album.artwork.clone();
    }
    Some(track)
}

pub fn album(item: &Value) -> Option<MusicAlbumRef> {
    Some(MusicAlbumRef {
        id: non_empty(item.get("uri")?)?.to_string(),
        connector_id: CONNECTOR.to_string(),
        title: non_empty(item.get("name")?)?.to_string(),
        artist: artist_names(item.get("artists")),
        artwork: best_image(item.get("images")),
        year: item
            .get("release_date")
            .and_then(Value::as_str)
            .and_then(|date| date.get(0..4))
            .and_then(|year| year.parse::<u32>().ok()),
        track_count: item
            .get("total_tracks")
            .and_then(Value::as_u64)
            .map(|total| total as u32),
        explicit: None,
    })
}

pub fn artist(item: &Value) -> Option<MusicArtistRef> {
    let artwork = best_image(item.get("images"));
    Some(MusicArtistRef {
        id: non_empty(item.get("uri")?)?.to_string(),
        connector_id: CONNECTOR.to_string(),
        name: non_empty(item.get("name")?)?.to_string(),
        artwork: (!artwork.is_empty()).then_some(artwork),
        subtitle: item
            .pointer("/genres/0")
            .and_then(non_empty)
            .map(str::to_string),
    })
}

pub fn playlist(item: &Value) -> Option<MusicPlaylistRef> {
    let artwork = best_image(item.get("images"));
    Some(MusicPlaylistRef {
        id: non_empty(item.get("uri")?)?.to_string(),
        connector_id: CONNECTOR.to_string(),
        name: non_empty(item.get("name")?)?.to_string(),
        artwork: if artwork.is_empty() {
            Vec::new()
        } else {
            vec![artwork]
        },
        track_count: item
            .pointer("/items/total")
            .or_else(|| item.pointer("/tracks/total"))
            .and_then(Value::as_u64)
            .map(|total| total as u32),
        subtitle: item
            .pointer("/owner/display_name")
            .and_then(non_empty)
            .map(str::to_string),
    })
}

pub fn entry(container: &Value) -> Option<&Value> {
    for key in ["item", "track"] {
        if let Some(value) = container.get(key) {
            if value.is_object() {
                return Some(value);
            }
        }
    }
    container.is_object().then_some(container)
}

pub fn list<'a>(body: &'a Value, pointer: &str) -> Vec<&'a Value> {
    body.pointer(pointer)
        .and_then(Value::as_array)
        .map(|items| items.iter().collect())
        .unwrap_or_default()
}

pub fn base62(uri: &str) -> Option<&str> {
    let candidate = uri.rsplit(':').next()?.trim();
    let valid = !candidate.is_empty()
        && candidate.len() <= 40
        && candidate.chars().all(|value| value.is_ascii_alphanumeric());
    valid.then_some(candidate)
}

pub fn best_image(images: Option<&Value>) -> String {
    images
        .and_then(Value::as_array)
        .and_then(|images| {
            images.iter().max_by_key(|image| {
                image
                    .get("width")
                    .and_then(Value::as_u64)
                    .unwrap_or_default()
                    * image
                        .get("height")
                        .and_then(Value::as_u64)
                        .unwrap_or_default()
            })
        })
        .and_then(|image| image.get("url"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn artist_names(artists: Option<&Value>) -> String {
    artists
        .and_then(Value::as_array)
        .map(|artists| {
            artists
                .iter()
                .filter_map(|artist| artist.get("name").and_then(non_empty))
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default()
}

fn non_empty(value: &Value) -> Option<&str> {
    value
        .as_str()
        .map(str::trim)
        .filter(|text| !text.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn track_fixture() -> Value {
        json!({
            "uri": "spotify:track:abc123",
            "name": "Hysteria",
            "duration_ms": 227_000,
            "artists": [{ "name": "Muse" }, { "name": "Guest" }],
            "album": {
                "name": "Absolution",
                "images": [
                    { "url": "https://example.test/small.jpg", "width": 64, "height": 64 },
                    { "url": "https://example.test/large.jpg", "width": 640, "height": 640 }
                ]
            }
        })
    }

    #[test]
    fn tracks_carry_the_spotify_uri_and_the_largest_cover() {
        let parsed = track(&track_fixture()).expect("track");
        assert_eq!(parsed.id, "spotify:track:abc123");
        assert_eq!(parsed.source_id.as_deref(), Some("spotify:track:abc123"));
        assert_eq!(parsed.connector_id.as_deref(), Some("spotify"));
        assert_eq!(parsed.artist, "Muse, Guest");
        assert_eq!(parsed.album.as_deref(), Some("Absolution"));
        assert_eq!(parsed.artwork, "https://example.test/large.jpg");
        assert_eq!(parsed.duration_seconds, 227);
        assert_eq!(parsed.duration_label, "3:47");
    }

    #[test]
    fn tracks_without_a_uri_or_name_are_dropped() {
        assert!(track(&json!({ "name": "Hysteria" })).is_none());
        assert!(track(&json!({ "uri": "spotify:track:abc", "name": "  " })).is_none());
    }

    #[test]
    fn album_tracks_inherit_the_album_cover_and_artist() {
        let reference = MusicAlbumRef {
            id: "spotify:album:one".to_string(),
            connector_id: "spotify".to_string(),
            title: "Absolution".to_string(),
            artist: "Muse".to_string(),
            artwork: "https://example.test/album.jpg".to_string(),
            year: Some(2003),
            track_count: Some(14),
            explicit: None,
        };
        let parsed = album_track(
            &json!({ "uri": "spotify:track:one", "name": "Apocalypse Please", "duration_ms": 137_000 }),
            &reference,
        )
        .expect("album track");
        assert_eq!(parsed.artist, "Muse");
        assert_eq!(parsed.album.as_deref(), Some("Absolution"));
        assert_eq!(parsed.artwork, "https://example.test/album.jpg");
    }

    #[test]
    fn albums_read_the_release_year_and_total() {
        let parsed = album(&json!({
            "uri": "spotify:album:one",
            "name": "Absolution",
            "release_date": "2003-09-15",
            "total_tracks": 14,
            "artists": [{ "name": "Muse" }],
            "images": [{ "url": "https://example.test/a.jpg", "width": 300, "height": 300 }]
        }))
        .expect("album");
        assert_eq!(parsed.year, Some(2003));
        assert_eq!(parsed.track_count, Some(14));
        assert_eq!(parsed.artist, "Muse");
    }

    #[test]
    fn artists_report_no_artwork_rather_than_an_empty_string() {
        let parsed =
            artist(&json!({ "uri": "spotify:artist:one", "name": "Muse" })).expect("artist");
        assert!(parsed.artwork.is_none());
        assert!(parsed.subtitle.is_none());
    }

    #[test]
    fn playlists_accept_both_the_items_and_tracks_totals() {
        let renamed = playlist(&json!({
            "uri": "spotify:playlist:one",
            "name": "Late night",
            "items": { "total": 42 },
            "owner": { "display_name": "Josiah" }
        }))
        .expect("playlist");
        assert_eq!(renamed.track_count, Some(42));
        assert_eq!(renamed.subtitle.as_deref(), Some("Josiah"));
        assert!(renamed.artwork.is_empty());

        let legacy = playlist(&json!({
            "uri": "spotify:playlist:two",
            "name": "Older",
            "tracks": { "total": 7 }
        }))
        .expect("legacy playlist");
        assert_eq!(legacy.track_count, Some(7));
    }

    #[test]
    fn entries_unwrap_item_then_track_then_themselves() {
        let renamed =
            json!({ "added_at": "now", "item": { "uri": "spotify:track:one", "name": "One" } });
        assert_eq!(
            entry(&renamed).and_then(track).map(|t| t.title),
            Some("One".to_string())
        );

        let legacy =
            json!({ "added_at": "now", "track": { "uri": "spotify:track:two", "name": "Two" } });
        assert_eq!(
            entry(&legacy).and_then(track).map(|t| t.title),
            Some("Two".to_string())
        );

        let bare = json!({ "uri": "spotify:track:three", "name": "Three" });
        assert_eq!(
            entry(&bare).and_then(track).map(|t| t.title),
            Some("Three".to_string())
        );
    }

    #[test]
    fn base62_ids_reject_path_injection() {
        assert_eq!(
            base62("spotify:album:4aawyAB9vmqN3uQ7FjRGTy"),
            Some("4aawyAB9vmqN3uQ7FjRGTy")
        );
        assert_eq!(
            base62("4aawyAB9vmqN3uQ7FjRGTy"),
            Some("4aawyAB9vmqN3uQ7FjRGTy")
        );
        assert_eq!(base62("spotify:album:../../me"), None);
        assert_eq!(base62("spotify:album:"), None);
        assert_eq!(base62("spotify:album:one two"), None);
    }

    #[test]
    fn lists_of_missing_pointers_are_empty_rather_than_an_error() {
        let body = json!({ "items": [{ "uri": "spotify:track:one", "name": "One" }] });
        assert_eq!(list(&body, "/items").len(), 1);
        assert!(list(&body, "/tracks/items").is_empty());
    }
}
