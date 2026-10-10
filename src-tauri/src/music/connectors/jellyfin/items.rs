use crate::music::{
    duration_label, MusicAlbumRef, MusicArtistRef, MusicPlaylistRef, MusicStationRef, MusicTrack,
};
use serde::Deserialize;
use std::collections::HashMap;

pub const CONNECTOR: &str = "jellyfin";
const UNKNOWN_ARTIST: &str = "Unknown artist";
const ART_SIZE: &str = "400";
const TICKS_PER_SECOND: i64 = 10_000_000;

#[derive(Debug, Default, Clone, Deserialize)]
#[serde(default)]
pub struct Item {
    #[serde(rename = "Id")]
    pub id: String,
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Type")]
    pub kind: String,
    #[serde(rename = "CollectionType")]
    pub collection_type: String,
    #[serde(rename = "Album")]
    pub album: Option<String>,
    #[serde(rename = "AlbumId")]
    pub album_id: Option<String>,
    #[serde(rename = "AlbumArtist")]
    pub album_artist: Option<String>,
    #[serde(rename = "Artists")]
    pub artists: Vec<String>,
    #[serde(rename = "AlbumPrimaryImageTag")]
    pub album_image_tag: Option<String>,
    #[serde(rename = "ParentPrimaryImageItemId")]
    pub parent_image_item: Option<String>,
    #[serde(rename = "ParentPrimaryImageTag")]
    pub parent_image_tag: Option<String>,
    #[serde(rename = "ImageTags")]
    pub image_tags: HashMap<String, String>,
    #[serde(rename = "ImageBlurHashes")]
    pub blur_hashes: HashMap<String, HashMap<String, String>>,
    #[serde(rename = "RunTimeTicks")]
    pub ticks: Option<i64>,
    #[serde(rename = "ProductionYear")]
    pub year: Option<i64>,
    #[serde(rename = "ChildCount")]
    pub child_count: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct ItemPage {
    #[serde(rename = "Items")]
    pub items: Vec<Item>,
}

impl Item {
    pub fn artist(&self) -> String {
        for value in &self.artists {
            if !value.trim().is_empty() {
                return value.trim().to_string();
            }
        }
        credited(self.album_artist.as_deref())
    }

    pub fn album_artist(&self) -> String {
        let named = credited(self.album_artist.as_deref());
        if named != UNKNOWN_ARTIST {
            return named;
        }
        self.artist()
    }

    pub fn seconds(&self) -> u64 {
        let ticks = self.ticks.unwrap_or(0).max(0) / TICKS_PER_SECOND;
        u64::try_from(ticks).unwrap_or(0)
    }

    fn count(&self) -> Option<u32> {
        let value = self.child_count.unwrap_or(0);
        if value <= 0 {
            return None;
        }
        u32::try_from(value).ok()
    }

    fn named(&self) -> Option<String> {
        if self.id.is_empty() || self.name.trim().is_empty() {
            return None;
        }
        Some(self.name.trim().to_string())
    }
}

fn credited(value: Option<&str>) -> String {
    match value.map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => value.to_string(),
        None => UNKNOWN_ARTIST.to_string(),
    }
}

pub fn safe_item_id(value: &str) -> Result<String, String> {
    let stripped = value.strip_prefix("jellyfin:").unwrap_or(value);
    let trimmed = stripped.trim();
    let addressable = trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-');
    if trimmed.is_empty() || trimmed.len() > 64 || !addressable {
        return Err("Jellyfin item is not addressable".to_string());
    }
    Ok(trimmed.to_string())
}

fn primary_image(item: &Item) -> Option<(&str, &str)> {
    if let Some(tag) = item.image_tags.get("Primary") {
        return Some((item.id.as_str(), tag.as_str()));
    }
    let album = item.album_id.as_deref();
    let album_tag = item.album_image_tag.as_deref();
    if let (Some(id), Some(tag)) = (album, album_tag) {
        return Some((id, tag));
    }
    let parent = item.parent_image_item.as_deref();
    let parent_tag = item.parent_image_tag.as_deref();
    if let (Some(id), Some(tag)) = (parent, parent_tag) {
        return Some((id, tag));
    }
    None
}

pub fn artwork(origin: &str, item: &Item) -> String {
    let Some((id, tag)) = primary_image(item) else {
        return String::new();
    };
    let hashes = item.blur_hashes.get("Primary");
    let blur = hashes.and_then(|hashes| hashes.get(tag));
    image_url(origin, id, tag, blur.map(String::as_str))
}

fn image_url(origin: &str, id: &str, tag: &str, blur: Option<&str>) -> String {
    let address = format!("{origin}/Items/{id}/Images/Primary");
    let Ok(mut url) = reqwest::Url::parse(&address) else {
        return String::new();
    };
    url.query_pairs_mut()
        .append_pair("fillHeight", ART_SIZE)
        .append_pair("fillWidth", ART_SIZE)
        .append_pair("quality", "90")
        .append_pair("format", "Webp")
        .append_pair("tag", tag);
    match blur.filter(|value| !value.is_empty()) {
        Some(blur) => format!("{url}#bh={}", escaped(blur)),
        None => url.to_string(),
    }
}

fn escaped(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        let plain = matches!(byte, b'-' | b'.' | b'_' | b'~');
        if byte.is_ascii_alphanumeric() || plain {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

pub fn track(origin: &str, item: &Item) -> Option<MusicTrack> {
    let title = item.named()?;
    let seconds = item.seconds();
    let album = named_album(item);
    Some(MusicTrack {
        explicit: None,
        version: None,
        media_kind: None,
        id: format!("{CONNECTOR}:{}", item.id),
        connector_id: Some(CONNECTOR.to_string()),
        source_id: Some(item.id.clone()),
        playback_url: None,
        title,
        artist: item.artist(),
        album,
        artwork: artwork(origin, item),
        duration_seconds: seconds,
        duration_label: duration_label(seconds),
    })
}

fn named_album(item: &Item) -> Option<String> {
    let album = item.album.as_deref()?.trim();
    if album.is_empty() {
        return None;
    }
    Some(album.to_string())
}

pub fn album(origin: &str, item: &Item) -> Option<MusicAlbumRef> {
    let title = item.named()?;
    let year = item.year.and_then(|value| u32::try_from(value).ok());
    Some(MusicAlbumRef {
        id: item.id.clone(),
        connector_id: CONNECTOR.to_string(),
        title,
        artist: item.album_artist(),
        artwork: artwork(origin, item),
        year,
        track_count: item.count(),
        explicit: None,
    })
}

pub fn artist(origin: &str, item: &Item) -> Option<MusicArtistRef> {
    let name = item.named()?;
    let art = artwork(origin, item);
    Some(MusicArtistRef {
        id: item.id.clone(),
        connector_id: CONNECTOR.to_string(),
        name,
        artwork: (!art.is_empty()).then_some(art),
        subtitle: None,
    })
}

pub fn playlist(origin: &str, item: &Item) -> Option<MusicPlaylistRef> {
    let name = item.named()?;
    let art = artwork(origin, item);
    let artwork = if art.is_empty() {
        Vec::new()
    } else {
        vec![art]
    };
    Some(MusicPlaylistRef {
        id: item.id.clone(),
        connector_id: CONNECTOR.to_string(),
        name,
        artwork,
        track_count: item.count(),
        subtitle: None,
    })
}

pub fn station(origin: &str, item: &Item) -> Option<MusicStationRef> {
    let name = item.named()?;
    Some(MusicStationRef {
        id: item.id.clone(),
        connector_id: CONNECTOR.to_string(),
        name,
        artwork: artwork(origin, item),
        subtitle: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const ORIGIN: &str = "https://media.example.test";

    fn page(body: &str) -> Vec<Item> {
        let page = serde_json::from_str::<ItemPage>(body);
        page.expect("item page").items
    }

    #[test]
    fn audio_items_become_tracks_with_ticks_converted_to_seconds() {
        let items = page(
            r#"{"Items":[{"Id":"a1","Name":"Hysteria","Type":"Audio","Album":"Absolution",
                "AlbumId":"b1","AlbumArtist":"Muse","Artists":["Muse"],"RunTimeTicks":2270000000,
                "AlbumPrimaryImageTag":"tag1"}],"TotalRecordCount":1}"#,
        );
        let track = track(ORIGIN, &items[0]).expect("track");
        assert_eq!(track.id, "jellyfin:a1");
        assert_eq!(track.source_id.as_deref(), Some("a1"));
        assert_eq!(track.connector_id.as_deref(), Some("jellyfin"));
        assert_eq!(track.title, "Hysteria");
        assert_eq!(track.artist, "Muse");
        assert_eq!(track.album.as_deref(), Some("Absolution"));
        assert_eq!(track.duration_seconds, 227);
        assert_eq!(track.duration_label, "3:47");
    }

    #[test]
    fn tracks_without_artists_fall_back_and_never_lose_the_row() {
        let items = page(r#"{"Items":[{"Id":"a2","Name":"Untitled","Type":"Audio"}]}"#);
        let track = track(ORIGIN, &items[0]).expect("track");
        assert_eq!(track.artist, "Unknown artist");
        assert_eq!(track.album, None);
        assert_eq!(track.artwork, "");
        assert_eq!(track.duration_seconds, 0);
    }

    #[test]
    fn nameless_items_are_dropped_rather_than_rendered_blank() {
        let items = page(r#"{"Items":[{"Id":"a3","Name":"   ","Type":"Audio"},{"Name":"No id"}]}"#);
        assert!(track(ORIGIN, &items[0]).is_none());
        assert!(album(ORIGIN, &items[1]).is_none());
    }

    #[test]
    fn artwork_prefers_the_item_then_the_album_then_the_parent() {
        let items = page(
            r#"{"Items":[
                {"Id":"a1","Name":"One","ImageTags":{"Primary":"own"},
                 "AlbumId":"b1","AlbumPrimaryImageTag":"alb"},
                {"Id":"a2","Name":"Two","AlbumId":"b1","AlbumPrimaryImageTag":"alb"},
                {"Id":"a3","Name":"Three","ParentPrimaryImageItemId":"p1",
                 "ParentPrimaryImageTag":"par"},
                {"Id":"a4","Name":"Four"}]}"#,
        );
        let own = artwork(ORIGIN, &items[0]);
        assert!(own.starts_with(&format!("{ORIGIN}/Items/a1/Images/Primary?")));
        assert!(own.contains("tag=own"));
        assert!(artwork(ORIGIN, &items[1]).contains("/Items/b1/Images/Primary?"));
        assert!(artwork(ORIGIN, &items[1]).contains("tag=alb"));
        assert!(artwork(ORIGIN, &items[2]).contains("/Items/p1/Images/Primary?"));
        assert_eq!(artwork(ORIGIN, &items[3]), "");
    }

    #[test]
    fn artwork_carries_the_blurhash_for_the_tag_it_used() {
        let items = page(
            r#"{"Items":[{"Id":"a1","Name":"One","ImageTags":{"Primary":"own"},
                "ImageBlurHashes":{"Primary":{"own":"L#KO2?~q0K"}}}]}"#,
        );
        let url = artwork(ORIGIN, &items[0]);
        assert!(url.contains("#bh=L%23KO2%3F~q0K"), "{url}");
        assert!(reqwest::Url::parse(&url).is_ok());
    }

    #[test]
    fn album_and_artist_and_playlist_refs_carry_their_counts() {
        let items = page(
            r#"{"Items":[
                {"Id":"b1","Name":"Absolution","AlbumArtist":"Muse","ProductionYear":2003,
                 "ChildCount":14,"ImageTags":{"Primary":"t"}},
                {"Id":"r1","Name":"Muse"},
                {"Id":"p1","Name":"Late night","ChildCount":0,"ImageTags":{"Primary":"t"}}]}"#,
        );
        let album = album(ORIGIN, &items[0]).expect("album");
        assert_eq!(album.connector_id, "jellyfin");
        assert_eq!(album.artist, "Muse");
        assert_eq!(album.year, Some(2003));
        assert_eq!(album.track_count, Some(14));

        let artist = artist(ORIGIN, &items[1]).expect("artist");
        assert_eq!(artist.artwork, None);

        let playlist = playlist(ORIGIN, &items[2]).expect("playlist");
        assert_eq!(playlist.track_count, None);
        assert_eq!(playlist.artwork.len(), 1);
    }

    #[test]
    fn stations_keep_the_seed_item_id_so_instant_mix_can_be_replayed() {
        let items = page(r#"{"Items":[{"Id":"r1","Name":"Muse","Type":"MusicArtist"}]}"#);
        let station = station(ORIGIN, &items[0]).expect("station");
        assert_eq!(station.id, "r1");
        assert_eq!(station.connector_id, "jellyfin");
    }

    #[test]
    fn item_ids_reject_paths_and_accept_the_prefixed_track_id() {
        assert_eq!(safe_item_id("jellyfin:a1b2").expect("prefixed"), "a1b2");
        assert_eq!(
            safe_item_id("6f2b1c0d-1111-2222-3333-444455556666").expect("guid"),
            "6f2b1c0d-1111-2222-3333-444455556666"
        );
        assert!(safe_item_id("../System/Info").is_err());
        assert!(safe_item_id("a1/Images").is_err());
        assert!(safe_item_id("").is_err());
        assert!(safe_item_id("jellyfin:").is_err());
    }
}
