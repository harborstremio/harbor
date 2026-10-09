use super::client;
use super::session::PlexConfig;
use crate::music::{
    duration_label, MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogRow,
    MusicPlaylistRef, MusicRowLayout, MusicStationRef, MusicTrack,
};
use serde_json::Value;

const MAX_ROW_ITEMS: usize = 24;

pub struct PlexPart {
    pub key: String,
    pub container: Option<String>,
    pub codec: Option<String>,
    pub bitrate: u64,
}

static NOTHING: Value = Value::Null;

pub fn container(body: &Value) -> &Value {
    body.get("MediaContainer").unwrap_or(&NOTHING)
}

pub fn nodes<'a>(value: &'a Value, key: &str) -> &'a [Value] {
    value
        .get(key)
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

pub fn text(node: &Value, key: &str) -> Option<String> {
    let value = match node.get(key)? {
        Value::String(value) => value.trim().to_string(),
        Value::Number(value) => value.to_string(),
        _ => return None,
    };
    (!value.is_empty()).then_some(value)
}

pub fn count(node: &Value, key: &str) -> Option<u64> {
    match node.get(key)? {
        Value::Number(value) => value.as_u64(),
        Value::String(value) => value.trim().parse().ok(),
        _ => None,
    }
}

fn artwork(config: &PlexConfig, node: &Value, keys: &[&str], size: u32) -> String {
    keys.iter()
        .find_map(|key| text(node, key))
        .map(|thumb| client::artwork_url(&config.origin, &config.token, &thumb, size))
        .unwrap_or_default()
}

pub fn slug(raw: &str) -> String {
    let mut out = String::new();
    for character in raw.trim().to_ascii_lowercase().chars() {
        if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
            out.push(character);
        } else if !out.ends_with('-') {
            out.push('-');
        }
    }
    out.trim_matches('-').chars().take(60).collect()
}

pub fn track(config: &PlexConfig, node: &Value) -> Option<MusicTrack> {
    let key = text(node, "ratingKey")?;
    let title = text(node, "title")?;
    let artist = text(node, "grandparentTitle")
        .or_else(|| text(node, "originalTitle"))
        .or_else(|| text(node, "parentTitle"))
        .unwrap_or_else(|| "Unknown artist".to_string());
    let duration_seconds = count(node, "duration").unwrap_or(0) / 1000;
    Some(MusicTrack {
        explicit: None,
        version: None,
        media_kind: None,
        id: format!("plex:{key}"),
        connector_id: Some("plex".to_string()),
        source_id: Some(key),
        playback_url: None,
        title,
        artist,
        album: text(node, "parentTitle"),
        artwork: artwork(
            config,
            node,
            &["thumb", "parentThumb", "grandparentThumb"],
            client::COVER_SIZE,
        ),
        duration_seconds,
        duration_label: duration_label(duration_seconds),
    })
}

pub fn album(config: &PlexConfig, node: &Value) -> Option<MusicAlbumRef> {
    let id = text(node, "ratingKey")?;
    Some(MusicAlbumRef {
        id,
        connector_id: "plex".to_string(),
        title: text(node, "title")?,
        artist: text(node, "parentTitle")
            .or_else(|| text(node, "grandparentTitle"))
            .unwrap_or_else(|| "Unknown artist".to_string()),
        artwork: artwork(config, node, &["thumb", "parentThumb"], client::COVER_SIZE),
        year: count(node, "year").map(|year| year as u32),
        track_count: count(node, "leafCount").map(|value| value as u32),
        explicit: None,
    })
}

pub fn artist(config: &PlexConfig, node: &Value) -> Option<MusicArtistRef> {
    let id = text(node, "ratingKey")?;
    let art = artwork(config, node, &["thumb", "art"], client::CIRCLE_SIZE);
    Some(MusicArtistRef {
        id,
        connector_id: "plex".to_string(),
        name: text(node, "title")?,
        artwork: (!art.is_empty()).then_some(art),
        subtitle: None,
    })
}

pub fn playlist(config: &PlexConfig, node: &Value) -> Option<MusicPlaylistRef> {
    let id = text(node, "ratingKey")?;
    let art = artwork(config, node, &["composite", "thumb"], client::COVER_SIZE);
    Some(MusicPlaylistRef {
        id,
        connector_id: "plex".to_string(),
        name: text(node, "title")?,
        artwork: if art.is_empty() {
            Vec::new()
        } else {
            vec![art]
        },
        track_count: count(node, "leafCount").map(|value| value as u32),
        subtitle: None,
    })
}

pub fn station(config: &PlexConfig, node: &Value) -> Option<MusicStationRef> {
    let id = text(node, "key")
        .filter(|key| key.starts_with('/'))
        .or_else(|| text(node, "ratingKey"))?;
    Some(MusicStationRef {
        id,
        connector_id: "plex".to_string(),
        name: text(node, "title")?,
        artwork: artwork(
            config,
            node,
            &["composite", "thumb", "parentThumb"],
            client::COVER_SIZE,
        ),
        subtitle: None,
    })
}

pub fn tracks(config: &PlexConfig, body: &Value) -> Vec<MusicTrack> {
    nodes(container(body), "Metadata")
        .iter()
        .filter(|node| text(node, "type").unwrap_or_default() != "album")
        .filter_map(|node| track(config, node))
        .collect()
}

pub fn part(body: &Value) -> Option<PlexPart> {
    let metadata = nodes(container(body), "Metadata").first()?.clone();
    let media = nodes(&metadata, "Media").first()?.clone();
    let file = nodes(&media, "Part").first()?.clone();
    Some(PlexPart {
        key: text(&file, "key")?,
        container: text(&file, "container").or_else(|| text(&media, "container")),
        codec: text(&media, "audioCodec").or_else(|| text(&file, "audioProfile")),
        bitrate: count(&media, "bitrate").unwrap_or(0),
    })
}

fn item(config: &PlexConfig, node: &Value, stations: bool) -> Option<MusicCatalogItem> {
    match text(node, "type").unwrap_or_default().as_str() {
        "track" => track(config, node).map(MusicCatalogItem::Track),
        "album" => album(config, node).map(MusicCatalogItem::Album),
        "artist" => artist(config, node).map(MusicCatalogItem::Artist),
        "playlist" if stations => station(config, node).map(MusicCatalogItem::Station),
        "playlist" => playlist(config, node).map(MusicCatalogItem::Playlist),
        _ => None,
    }
}

fn layout(hub: &Value, stations: bool) -> MusicRowLayout {
    match text(hub, "type").unwrap_or_default().as_str() {
        "artist" => MusicRowLayout::Circles,
        "track" if !stations => MusicRowLayout::TrackGrid,
        _ => MusicRowLayout::Covers,
    }
}

pub fn hub_row(config: &PlexConfig, hub: &Value) -> Option<MusicCatalogRow> {
    let context = text(hub, "context").unwrap_or_default();
    let identifier = text(hub, "hubIdentifier")
        .or_else(|| text(hub, "title"))
        .map(|value| slug(&value))
        .filter(|value| !value.is_empty())?;
    let stations = context.contains("station") || context.contains("mix");
    let items = nodes(hub, "Metadata")
        .iter()
        .chain(nodes(hub, "Directory").iter())
        .filter_map(|node| item(config, node, stations))
        .take(MAX_ROW_ITEMS)
        .collect::<Vec<_>>();
    if items.is_empty() {
        return None;
    }
    Some(MusicCatalogRow {
        id: format!("plex:hub:{identifier}"),
        title: text(hub, "title")?,
        title_literal: true,
        subtitle: config.server.clone(),
        layout: layout(hub, stations),
        source: "plex".to_string(),
        items,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> PlexConfig {
        PlexConfig {
            origin: "https://plex.local:32400".to_string(),
            token: "tok".to_string(),
            client_id: "cid".to_string(),
            section: "3".to_string(),
            section_uuid: None,
            server: Some("Attic".to_string()),
        }
    }

    const TRACK: &str = r#"{
        "ratingKey": "46618", "type": "track", "title": "Hysteria",
        "grandparentTitle": "Muse", "parentTitle": "Absolution",
        "duration": 227000, "index": 8, "parentIndex": 1,
        "thumb": "/library/metadata/46617/thumb/1715112705",
        "Media": [{
            "bitrate": 993, "audioCodec": "flac", "container": "flac",
            "Part": [{ "key": "/library/parts/46618/1389985872/file.flac", "container": "flac" }]
        }]
    }"#;

    #[test]
    fn tracks_carry_plex_ids_artwork_and_a_duration_label() {
        let node = serde_json::from_str::<Value>(TRACK).expect("track fixture");
        let parsed = track(&config(), &node).expect("track");
        assert_eq!(parsed.id, "plex:46618");
        assert_eq!(parsed.source_id.as_deref(), Some("46618"));
        assert_eq!(parsed.connector_id.as_deref(), Some("plex"));
        assert!(parsed.playback_url.is_none());
        assert_eq!(parsed.artist, "Muse");
        assert_eq!(parsed.album.as_deref(), Some("Absolution"));
        assert_eq!(parsed.duration_seconds, 227);
        assert_eq!(parsed.duration_label, "3:47");
        assert!(parsed.artwork.contains("/photo/:/transcode?url="));
    }

    #[test]
    fn numeric_rating_keys_and_string_counts_both_parse() {
        let node = serde_json::json!({
            "ratingKey": 9912, "type": "album", "title": "Origin of Symmetry",
            "parentTitle": "Muse", "year": "2001", "leafCount": 12,
            "thumb": "/library/metadata/9912/thumb/1"
        });
        let parsed = album(&config(), &node).expect("album");
        assert_eq!(parsed.id, "9912");
        assert_eq!(parsed.year, Some(2001));
        assert_eq!(parsed.track_count, Some(12));
        assert_eq!(parsed.artist, "Muse");
        assert_eq!(parsed.connector_id, "plex");
    }

    #[test]
    fn artists_without_art_degrade_to_none_rather_than_an_empty_string() {
        let bare = serde_json::json!({ "ratingKey": "5", "type": "artist", "title": "Muse" });
        let parsed = artist(&config(), &bare).expect("artist");
        assert!(parsed.artwork.is_none());
        assert!(parsed.subtitle.is_none());
        assert!(artist(&config(), &serde_json::json!({ "title": "Muse" })).is_none());
    }

    #[test]
    fn playlists_and_stations_split_on_the_hub_context() {
        let node = serde_json::json!({
            "ratingKey": "77", "type": "playlist", "title": "Late night",
            "key": "/library/metadata/5/station/2", "leafCount": 40,
            "composite": "/playlists/77/composite/1"
        });
        let list = playlist(&config(), &node).expect("playlist");
        assert_eq!(list.id, "77");
        assert_eq!(list.track_count, Some(40));
        assert_eq!(list.artwork.len(), 1);
        let radio = station(&config(), &node).expect("station");
        assert_eq!(radio.id, "/library/metadata/5/station/2");
    }

    #[test]
    fn parts_expose_the_direct_file_key_container_and_bitrate() {
        let node = serde_json::from_str::<Value>(TRACK).expect("track fixture");
        let body = serde_json::json!({ "MediaContainer": { "Metadata": [node] } });
        let parsed = part(&body).expect("part");
        assert_eq!(parsed.key, "/library/parts/46618/1389985872/file.flac");
        assert_eq!(parsed.container.as_deref(), Some("flac"));
        assert_eq!(parsed.codec.as_deref(), Some("flac"));
        assert_eq!(parsed.bitrate, 993);
        assert!(part(&serde_json::json!({ "MediaContainer": {} })).is_none());
    }

    #[test]
    fn hubs_become_rows_with_namespaced_ids_and_a_matching_layout() {
        let hub = serde_json::json!({
            "hubIdentifier": "home.music.recent.artists", "context": "hub.music.recentlyadded",
            "title": "Recently Added", "type": "artist",
            "Metadata": [{ "ratingKey": "5", "type": "artist", "title": "Muse" }]
        });
        let row = hub_row(&config(), &hub).expect("row");
        assert_eq!(row.id, "plex:hub:home.music.recent.artists");
        assert_eq!(row.title, "Recently Added");
        assert!(row.title_literal);
        assert_eq!(row.subtitle.as_deref(), Some("Attic"));
        assert_eq!(row.layout, MusicRowLayout::Circles);
        assert_eq!(row.source, "plex");
        assert_eq!(row.items.len(), 1);
    }

    #[test]
    fn station_hubs_emit_stations_and_empty_hubs_emit_nothing() {
        let hub = serde_json::json!({
            "hubIdentifier": "music.stations", "context": "hub.music.stations",
            "title": "Stations", "type": "playlist",
            "Directory": [{
                "ratingKey": "9", "type": "playlist", "title": "Muse Radio",
                "key": "/library/metadata/5/station/2"
            }]
        });
        let row = hub_row(&config(), &hub).expect("row");
        assert_eq!(row.layout, MusicRowLayout::Covers);
        assert!(matches!(row.items[0], MusicCatalogItem::Station(_)));
        let empty = serde_json::json!({
            "hubIdentifier": "music.empty", "title": "Nothing", "type": "album"
        });
        assert!(hub_row(&config(), &empty).is_none());
    }

    #[test]
    fn slugs_stay_stable_and_free_of_separators() {
        assert_eq!(
            slug("home.music.recent.artists"),
            "home.music.recent.artists"
        );
        assert_eq!(slug("Top Artists / 2026"), "top-artists-2026");
        assert_eq!(slug("  "), "");
    }

    #[test]
    fn track_lists_skip_album_rows_returned_by_mixed_containers() {
        let node = serde_json::from_str::<Value>(TRACK).expect("track fixture");
        let album = serde_json::json!({ "ratingKey": "1", "type": "album", "title": "Absolution" });
        let body = serde_json::json!({ "MediaContainer": { "Metadata": [node, album] } });
        assert_eq!(tracks(&config(), &body).len(), 1);
    }
}
