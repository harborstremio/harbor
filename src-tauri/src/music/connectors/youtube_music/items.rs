use super::super::super::{
    duration_label, MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicPlaylistRef,
    MusicStationRef, MusicTrack,
};
use super::fields::{
    clean_title, count_from, details_from, primary, seconds_from_label, year_from, CONNECTOR,
};
use super::parse::{
    artwork_of, browse_id_of, fixed_duration, flex_columns, kind_of, nav, runs, text, video_id_of,
};
use serde_json::Value;

pub fn catalog_item(value: &Value) -> Option<MusicCatalogItem> {
    let title = nav(value, &["title"]).and_then(text)?;
    let cover = artwork_of(value).unwrap_or_default();
    let byline = nav(value, &["subtitle"]);
    let parts = byline.map(runs).unwrap_or_default();
    let subtitle = byline.and_then(text);
    if let Some(video_id) =
        nav(value, &["navigationEndpoint", "watchEndpoint", "videoId"]).and_then(Value::as_str)
    {
        let station = nav(
            value,
            &["navigationEndpoint", "watchEndpoint", "playlistId"],
        )
        .and_then(Value::as_str)
        .filter(|playlist| playlist.starts_with("RD"));
        if let Some(station) = station {
            return Some(MusicCatalogItem::Station(MusicStationRef {
                id: station.to_string(),
                connector_id: CONNECTOR.to_string(),
                name: title,
                artwork: cover,
                subtitle,
            }));
        }
        let song = details_from(parts);
        let mut built = track(
            video_id,
            title,
            song.artist,
            song.album,
            cover,
            song.duration,
        );
        built.explicit = explicit_badge(value);
        return Some(MusicCatalogItem::Track(built));
    }
    let id = browse_id_of(value)?;
    let kind = kind_of(value, &id);
    match kind {
        "album" => Some(MusicCatalogItem::Album(MusicAlbumRef {
            id,
            connector_id: CONNECTOR.to_string(),
            title,
            artist: primary(&parts).unwrap_or_else(|| "Unknown artist".to_string()),
            artwork: cover,
            year: year_from(&parts),
            track_count: count_from(&parts),
            explicit: None,
        })),
        "artist" => Some(MusicCatalogItem::Artist(MusicArtistRef {
            id,
            connector_id: CONNECTOR.to_string(),
            name: title,
            artwork: Some(cover).filter(|artwork| !artwork.is_empty()),
            subtitle,
        })),
        _ => Some(MusicCatalogItem::Playlist(MusicPlaylistRef {
            id,
            connector_id: CONNECTOR.to_string(),
            name: title,
            artwork: if cover.is_empty() {
                Vec::new()
            } else {
                vec![cover]
            },
            track_count: count_from(&parts),
            subtitle,
        })),
    }
}

pub fn explicit_badge(value: &Value) -> Option<bool> {
    fn scan(value: &Value) -> bool {
        match value {
            Value::String(text) => text.as_str() == "MUSIC_EXPLICIT_BADGE",
            Value::Array(items) => items.iter().any(scan),
            Value::Object(map) => map.values().any(scan),
            _ => false,
        }
    }
    value.get("badges").and_then(|badges| scan(badges).then_some(true))
}

pub fn track_from_list_item(value: &Value) -> Option<MusicTrack> {
    let video_id = video_id_of(value)?;
    let columns = flex_columns(value);
    let title = columns.first().and_then(|column| text(column))?;
    let parts = columns
        .get(1)
        .map(|column| runs(column))
        .unwrap_or_default();
    let details = details_from(parts);
    let seconds = if details.duration > 0 {
        details.duration
    } else {
        fixed_duration(value).unwrap_or_default()
    };
    let mut built = track(
        &video_id,
        title,
        details.artist,
        details.album,
        artwork_of(value).unwrap_or_default(),
        seconds,
    );
    built.explicit = explicit_badge(value);
    Some(built)
}

pub fn track_from_panel(value: &Value) -> Option<MusicTrack> {
    let video_id = value
        .get("videoId")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            nav(value, &["navigationEndpoint", "watchEndpoint", "videoId"])
                .and_then(Value::as_str)
                .map(str::to_string)
        })?;
    let title = value.get("title").and_then(text)?;
    let parts = value.get("longBylineText").map(runs).unwrap_or_default();
    let seconds = value
        .get("lengthText")
        .and_then(text)
        .and_then(|label| seconds_from_label(&label))
        .unwrap_or_default();
    let details = details_from(parts);
    let mut built = track(
        &video_id,
        title,
        details.artist,
        details.album,
        artwork_of(value).unwrap_or_default(),
        seconds,
    );
    built.explicit = explicit_badge(value);
    Some(built)
}

pub fn album_from_list_item(value: &Value) -> Option<MusicAlbumRef> {
    let id = browse_id_of(value).filter(|id| id.starts_with("MPRE"))?;
    let columns = flex_columns(value);
    let title = columns.first().and_then(|column| text(column))?;
    let parts = columns
        .get(1)
        .map(|column| runs(column))
        .unwrap_or_default();
    Some(MusicAlbumRef {
        id,
        connector_id: CONNECTOR.to_string(),
        title,
        artist: primary(&parts).unwrap_or_else(|| "Unknown artist".to_string()),
        artwork: artwork_of(value).unwrap_or_default(),
        year: year_from(&parts),
        track_count: count_from(&parts),
        explicit: None,
    })
}

pub fn artist_from_list_item(value: &Value) -> Option<MusicArtistRef> {
    let id = browse_id_of(value).filter(|id| id.starts_with("UC"))?;
    let columns = flex_columns(value);
    let name = columns.first().and_then(|column| text(column))?;
    Some(MusicArtistRef {
        id,
        connector_id: CONNECTOR.to_string(),
        name,
        artwork: artwork_of(value),
        subtitle: columns.get(1).and_then(|column| text(column)),
    })
}

pub fn playlist_from_list_item(value: &Value) -> Option<MusicPlaylistRef> {
    let id = browse_id_of(value).filter(|id| id.starts_with("VL") || id.starts_with("PL"))?;
    let columns = flex_columns(value);
    let name = columns.first().and_then(|column| text(column))?;
    let parts = columns
        .get(1)
        .map(|column| runs(column))
        .unwrap_or_default();
    Some(MusicPlaylistRef {
        id,
        connector_id: CONNECTOR.to_string(),
        name,
        artwork: artwork_of(value).into_iter().collect(),
        track_count: count_from(&parts),
        subtitle: columns.get(1).and_then(|column| text(column)),
    })
}

pub fn track(
    video_id: &str,
    title: String,
    artist: Option<String>,
    album: Option<String>,
    artwork: String,
    seconds: u64,
) -> MusicTrack {
    let artist = artist.unwrap_or_else(|| "Unknown artist".to_string());
    MusicTrack {
        explicit: None,
        version: None,
        media_kind: None,
        id: video_id.to_string(),
        connector_id: Some(CONNECTOR.to_string()),
        source_id: Some(video_id.to_string()),
        playback_url: None,
        title: clean_title(&title, &artist),
        artist,
        album,
        artwork,
        duration_seconds: seconds,
        duration_label: duration_label(seconds),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn song_row() -> Value {
        json!({
            "flexColumns": [
                {"musicResponsiveListItemFlexColumnRenderer": {"text": {"runs": [
                    {"text": "Hysteria", "navigationEndpoint": {"watchEndpoint": {"videoId": "MdVBSHOMWSY"}}}
                ]}}},
                {"musicResponsiveListItemFlexColumnRenderer": {"text": {"runs": [
                    {"text": "Song"}, {"text": " \u{2022} "}, {"text": "Muse"},
                    {"text": " \u{2022} "}, {"text": "Absolution"},
                    {"text": " \u{2022} "}, {"text": "3:47"}
                ]}}}
            ],
            "thumbnail": {"musicThumbnailRenderer": {"thumbnail": {"thumbnails": [
                {"url": "cover.jpg", "width": 544, "height": 544}
            ]}}},
            "playlistItemData": {"videoId": "MdVBSHOMWSY"}
        })
    }

    #[test]
    fn search_song_rows_become_playable_tracks() {
        let track = track_from_list_item(&song_row()).expect("track");
        assert_eq!(track.id, "MdVBSHOMWSY");
        assert_eq!(track.source_id.as_deref(), Some("MdVBSHOMWSY"));
        assert_eq!(track.connector_id.as_deref(), Some("youtube"));
        assert_eq!(track.title, "Hysteria");
        assert_eq!(track.artist, "Muse");
        assert_eq!(track.album.as_deref(), Some("Absolution"));
        assert_eq!(track.artwork, "cover.jpg");
        assert_eq!(track.duration_seconds, 227);
        assert_eq!(track.duration_label, "3:47");
    }

    #[test]
    fn rows_without_a_video_id_are_skipped() {
        let mut row = song_row();
        row["playlistItemData"] = json!({});
        row["flexColumns"][0]["musicResponsiveListItemFlexColumnRenderer"]["text"]["runs"][0]
            ["navigationEndpoint"] = json!({});
        assert!(track_from_list_item(&row).is_none());
    }

    #[test]
    fn album_rows_carry_the_year_and_the_artist() {
        let row = json!({
            "navigationEndpoint": {"browseEndpoint": {"browseId": "MPREb_absolution"}},
            "flexColumns": [
                {"musicResponsiveListItemFlexColumnRenderer": {"text": {"runs": [{"text": "Absolution"}]}}},
                {"musicResponsiveListItemFlexColumnRenderer": {"text": {"runs": [
                    {"text": "Album"}, {"text": " \u{2022} "}, {"text": "Muse"},
                    {"text": " \u{2022} "}, {"text": "2003"}
                ]}}}
            ]
        });
        let album = album_from_list_item(&row).expect("album");
        assert_eq!(album.id, "MPREb_absolution");
        assert_eq!(album.title, "Absolution");
        assert_eq!(album.artist, "Muse");
        assert_eq!(album.year, Some(2003));
        assert!(album_from_list_item(&song_row()).is_none());
    }

    #[test]
    fn artist_rows_need_a_channel_id() {
        let row = json!({
            "navigationEndpoint": {"browseEndpoint": {"browseId": "UCmuse"}},
            "flexColumns": [
                {"musicResponsiveListItemFlexColumnRenderer": {"text": {"runs": [{"text": "Muse"}]}}},
                {"musicResponsiveListItemFlexColumnRenderer": {"text": {"runs": [{"text": "8.1M subscribers"}]}}}
            ]
        });
        let artist = artist_from_list_item(&row).expect("artist");
        assert_eq!(artist.id, "UCmuse");
        assert_eq!(artist.name, "Muse");
        assert_eq!(artist.subtitle.as_deref(), Some("8.1M subscribers"));
    }

    #[test]
    fn playlist_rows_read_the_track_count() {
        let row = json!({
            "navigationEndpoint": {"browseEndpoint": {"browseId": "VLPLmix"}},
            "flexColumns": [
                {"musicResponsiveListItemFlexColumnRenderer": {"text": {"runs": [{"text": "Late night"}]}}},
                {"musicResponsiveListItemFlexColumnRenderer": {"text": {"runs": [
                    {"text": "Playlist"}, {"text": " \u{2022} "}, {"text": "50 songs"}
                ]}}}
            ]
        });
        let playlist = playlist_from_list_item(&row).expect("playlist");
        assert_eq!(playlist.id, "VLPLmix");
        assert_eq!(playlist.track_count, Some(50));
        assert!(playlist.artwork.is_empty());
    }

    #[test]
    fn two_row_items_become_albums_playlists_artists_and_stations() {
        let album = catalog_item(&json!({
            "title": {"runs": [{"text": "Absolution"}]},
            "subtitle": {"runs": [{"text": "Muse"}, {"text": " \u{2022} "}, {"text": "2003"}]},
            "navigationEndpoint": {"browseEndpoint": {
                "browseId": "MPREb_absolution",
                "browseEndpointContextSupportedConfigs": {
                    "browseEndpointContextMusicConfig": {"pageType": "MUSIC_PAGE_TYPE_ALBUM"}
                }
            }},
            "thumbnailRenderer": {"musicThumbnailRenderer": {"thumbnail": {"thumbnails": [
                {"url": "art.jpg", "width": 226, "height": 226}
            ]}}}
        }))
        .expect("album item");
        let MusicCatalogItem::Album(album) = album else {
            panic!("album variant");
        };
        assert_eq!(album.artwork, "art.jpg");
        assert_eq!(album.year, Some(2003));

        let artist = catalog_item(&json!({
            "title": {"runs": [{"text": "Muse"}]},
            "subtitle": {"runs": [{"text": "8.1M subscribers"}]},
            "navigationEndpoint": {"browseEndpoint": {"browseId": "UCmuse"}}
        }))
        .expect("artist item");
        assert!(matches!(artist, MusicCatalogItem::Artist(_)));

        let station = catalog_item(&json!({
            "title": {"runs": [{"text": "Muse radio"}]},
            "subtitle": {"runs": [{"text": "Start radio"}]},
            "navigationEndpoint": {"watchEndpoint": {
                "videoId": "MdVBSHOMWSY", "playlistId": "RDAMVMMdVBSHOMWSY"
            }}
        }))
        .expect("station item");
        let MusicCatalogItem::Station(station) = station else {
            panic!("station variant");
        };
        assert_eq!(station.id, "RDAMVMMdVBSHOMWSY");
    }

    #[test]
    fn queue_panels_become_tracks() {
        let track = track_from_panel(&json!({
            "videoId": "MdVBSHOMWSY",
            "title": {"runs": [{"text": "Hysteria"}]},
            "longBylineText": {"runs": [
                {"text": "Muse"}, {"text": " \u{2022} "}, {"text": "Absolution"}
            ]},
            "lengthText": {"runs": [{"text": "3:47"}]},
            "thumbnail": {"thumbnails": [{"url": "queue.jpg", "width": 120, "height": 120}]}
        }))
        .expect("panel track");
        assert_eq!(track.artist, "Muse");
        assert_eq!(track.duration_seconds, 227);
        assert_eq!(track.artwork, "queue.jpg");
    }
}
