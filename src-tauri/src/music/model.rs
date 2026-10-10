use super::MusicTrack;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicVideoPage {
    pub tracks: Vec<MusicTrack>,
    pub next: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicAlbumRef {
    pub id: String,
    pub connector_id: String,
    pub title: String,
    pub artist: String,
    pub artwork: String,
    pub year: Option<u32>,
    pub track_count: Option<u32>,
    #[serde(default)]
    pub explicit: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicArtistRef {
    pub id: String,
    pub connector_id: String,
    pub name: String,
    pub artwork: Option<String>,
    pub subtitle: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicPlaylistRef {
    pub id: String,
    pub connector_id: String,
    pub name: String,
    pub artwork: Vec<String>,
    pub track_count: Option<u32>,
    pub subtitle: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicStationRef {
    pub id: String,
    pub connector_id: String,
    pub name: String,
    pub artwork: String,
    pub subtitle: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MusicCatalogItem {
    Track(MusicTrack),
    Album(MusicAlbumRef),
    Artist(MusicArtistRef),
    Playlist(MusicPlaylistRef),
    Station(MusicStationRef),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MusicCatalogKind {
    Tracks,
    Albums,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MusicCatalogScope {
    Catalog,
    Top,
    Limited,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicCatalogPage {
    pub items: Vec<MusicCatalogItem>,
    pub next_cursor: Option<String>,
    pub total: Option<u64>,
    pub scope: MusicCatalogScope,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MusicRowLayout {
    Covers,
    Circles,
    TrackGrid,
    Wide,
}

impl MusicRowLayout {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Covers => "covers",
            Self::Circles => "circles",
            Self::TrackGrid => "trackGrid",
            Self::Wide => "wide",
        }
    }

    pub fn from_str(value: &str) -> Self {
        match value {
            "circles" => Self::Circles,
            "trackGrid" => Self::TrackGrid,
            "wide" => Self::Wide,
            _ => Self::Covers,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicCatalogRow {
    pub id: String,
    pub title: String,
    pub title_literal: bool,
    pub subtitle: Option<String>,
    pub layout: MusicRowLayout,
    pub source: String,
    pub items: Vec<MusicCatalogItem>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicSearchResults {
    pub top: Option<MusicCatalogItem>,
    pub tracks: Vec<MusicTrack>,
    pub albums: Vec<MusicAlbumRef>,
    pub artists: Vec<MusicArtistRef>,
    pub playlists: Vec<MusicPlaylistRef>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicConnectionField {
    pub key: String,
    pub label: String,
    pub kind: String,
    pub placeholder: Option<String>,
    pub required: bool,
}

impl MusicConnectionField {
    pub fn new(key: &str, label: &str, kind: &str, required: bool) -> Self {
        Self {
            key: key.to_string(),
            label: label.to_string(),
            kind: kind.to_string(),
            placeholder: None,
            required,
        }
    }

    pub fn placeholder(mut self, placeholder: &str) -> Self {
        self.placeholder = Some(placeholder.to_string());
        self
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicConnection {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub status: String,
    pub account: Option<String>,
    pub detail: Option<String>,
    pub error: Option<String>,
    pub capabilities: Vec<String>,
    pub needs: Vec<MusicConnectionField>,
    /// A source needing no account is always usable, so it is never signed in or out of.
    pub anonymous: bool,
}

impl MusicConnection {
    pub fn new(id: &str, name: &str, kind: &str, status: &str, capabilities: &[&str]) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            kind: kind.to_string(),
            status: status.to_string(),
            account: None,
            detail: None,
            error: None,
            capabilities: capabilities.iter().map(|value| value.to_string()).collect(),
            needs: Vec::new(),
            anonymous: false,
        }
    }

    pub fn anonymous(mut self) -> Self {
        self.anonymous = true;
        self
    }

    pub fn needs(mut self, needs: Vec<MusicConnectionField>) -> Self {
        self.needs = needs;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track() -> MusicTrack {
        MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: "youtube:one".to_string(),
            connector_id: Some("youtube".to_string()),
            source_id: Some("one".to_string()),
            playback_url: None,
            title: "Hysteria".to_string(),
            artist: "Muse".to_string(),
            album: None,
            artwork: String::new(),
            duration_seconds: 227,
            duration_label: "3:47".to_string(),
        }
    }

    #[test]
    fn catalog_items_serialize_as_a_flat_discriminated_union() {
        let value = serde_json::to_value(MusicCatalogItem::Track(track())).expect("track item");
        assert_eq!(value["kind"], "track");
        assert_eq!(value["durationLabel"], "3:47");
        assert_eq!(value["connectorId"], "youtube");

        let album = MusicCatalogItem::Album(MusicAlbumRef {
            id: "spotify:album:one".to_string(),
            connector_id: "spotify".to_string(),
            title: "Absolution".to_string(),
            artist: "Muse".to_string(),
            artwork: "https://example.test/art.jpg".to_string(),
            year: Some(2003),
            track_count: Some(14),
            explicit: None,
        });
        let value = serde_json::to_value(&album).expect("album item");
        assert_eq!(value["kind"], "album");
        assert_eq!(value["trackCount"], 14);
    }

    #[test]
    fn catalog_items_round_trip_through_json() {
        let station = MusicCatalogItem::Station(MusicStationRef {
            id: "ytm:station:one".to_string(),
            connector_id: "youtube".to_string(),
            name: "Late night".to_string(),
            artwork: String::new(),
            subtitle: None,
        });
        let encoded = serde_json::to_string(&station).expect("encode station");
        let decoded: MusicCatalogItem = serde_json::from_str(&encoded).expect("decode station");
        let MusicCatalogItem::Station(decoded) = decoded else {
            panic!("station variant");
        };
        assert_eq!(decoded.name, "Late night");
    }

    #[test]
    fn row_layout_matches_the_frontend_union() {
        for (layout, expected) in [
            (MusicRowLayout::Covers, "covers"),
            (MusicRowLayout::Circles, "circles"),
            (MusicRowLayout::TrackGrid, "trackGrid"),
            (MusicRowLayout::Wide, "wide"),
        ] {
            assert_eq!(serde_json::to_value(layout).expect("layout"), expected);
            assert_eq!(layout.as_str(), expected);
            assert_eq!(MusicRowLayout::from_str(expected), layout);
        }
    }

    #[test]
    fn connections_carry_capabilities_and_needed_fields() {
        let connection = MusicConnection::new(
            "jellyfin",
            "Jellyfin",
            "server",
            "disconnected",
            &["search", "browse", "play", "library"],
        )
        .needs(vec![
            MusicConnectionField::new("url", "Server URL", "url", true)
                .placeholder("https://jellyfin.local"),
            MusicConnectionField::new("password", "Password", "password", true),
        ]);
        let value = serde_json::to_value(&connection).expect("connection");
        assert_eq!(value["capabilities"][1], "browse");
        assert_eq!(value["needs"][0]["kind"], "url");
        assert_eq!(value["needs"][0]["placeholder"], "https://jellyfin.local");
        assert_eq!(value["needs"][1]["required"], true);
    }
}
