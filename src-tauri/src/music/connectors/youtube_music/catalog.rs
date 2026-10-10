use super::super::super::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogKind, MusicCatalogRow,
    MusicPlaylistRef, MusicStationRef, MusicStream, MusicTrack, MusicVideoStream,
};
use super::innertube::{self, Client};
use super::{items, parse, rows};
use serde_json::Value;

const HOME_SHELVES: usize = 6;
const CHART_SHELVES: usize = 1;
const ROW_ITEMS: usize = 20;
const LIST_TRACKS: usize = 100;
const STATION_TRACKS: usize = 50;
const LIST_ITEM: &str = "musicResponsiveListItemRenderer";
const QUEUE_ITEM: &str = "playlistPanelVideoRenderer";

pub async fn songs(
    client: &Client,
    app: &tauri::AppHandle,
    query: &str,
    limit: usize,
) -> Result<Vec<MusicTrack>, String> {
    let response = client.search(app, query, innertube::SONGS_FILTER).await?;
    Ok(gather(
        &response,
        LIST_ITEM,
        items::track_from_list_item,
        limit,
    ))
}

pub async fn videos(
    client: &Client,
    app: &tauri::AppHandle,
    query: &str,
    limit: usize,
    interviews: bool,
) -> Result<Vec<MusicTrack>, String> {
    let response = client.search(app, query, innertube::VIDEOS_FILTER).await?;
    Ok(video_results_kind(&response, limit, interviews))
}

#[cfg(test)]
fn video_results(response: &Value, limit: usize) -> Vec<MusicTrack> {
    video_results_kind(response, limit, false)
}

pub(super) fn video_results_kind(response: &Value, limit: usize, interviews: bool) -> Vec<MusicTrack> {
    let mut found = Vec::new();
    parse::collect(response, LIST_ITEM, &mut found);
    let mut seen = std::collections::HashSet::new();
    found.into_iter().filter_map(|item| {
        // Keep provider-declared official music videos. UGC search also contains
        // tutorials, covers and static audio uploads; those are not music-video discovery.
        let kind = item.pointer("/overlay/musicItemThumbnailOverlayRenderer/content/musicPlayButtonRenderer/playNavigationEndpoint/watchEndpoint/watchEndpointMusicSupportedConfigs/watchEndpointMusicConfig/musicVideoType").and_then(Value::as_str)?;
        if interviews {
            if kind != "MUSIC_VIDEO_TYPE_UGC" { return None; }
        } else if kind != "MUSIC_VIDEO_TYPE_OMV" { return None; }
        let mut track = items::track_from_list_item(item)?;
        if interviews && !track.title.to_lowercase().contains("interview") { return None; }
        track.media_kind = Some("video".to_string());
        let id = track.source_id.as_deref()?;
        if id.len() != 11 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') || !seen.insert(id.to_string()) { return None; }
        Some(track)
    }).take(limit).collect()
}

pub async fn albums(
    client: &Client,
    app: &tauri::AppHandle,
    query: &str,
    limit: usize,
) -> Result<Vec<MusicAlbumRef>, String> {
    let response = client.search(app, query, innertube::ALBUMS_FILTER).await?;
    Ok(gather(
        &response,
        LIST_ITEM,
        items::album_from_list_item,
        limit,
    ))
}

pub async fn artists(
    client: &Client,
    app: &tauri::AppHandle,
    query: &str,
    limit: usize,
) -> Result<Vec<MusicArtistRef>, String> {
    let response = client.search(app, query, innertube::ARTISTS_FILTER).await?;
    Ok(gather(
        &response,
        LIST_ITEM,
        items::artist_from_list_item,
        limit,
    ))
}

pub async fn playlists(
    client: &Client,
    app: &tauri::AppHandle,
    query: &str,
    limit: usize,
) -> Result<Vec<MusicPlaylistRef>, String> {
    let response = client
        .search(app, query, innertube::PLAYLISTS_FILTER)
        .await?;
    Ok(gather(
        &response,
        LIST_ITEM,
        items::playlist_from_list_item,
        limit,
    ))
}

pub async fn home_rows(
    client: &Client,
    app: &tauri::AppHandle,
) -> Result<Vec<MusicCatalogRow>, String> {
    let response = client.browse(app, "FEmusic_home").await?;
    Ok(rows::browse_rows(
        &response,
        "ytm:home",
        HOME_SHELVES,
        ROW_ITEMS,
    ))
}

pub async fn chart_rows(
    client: &Client,
    app: &tauri::AppHandle,
) -> Result<Vec<MusicCatalogRow>, String> {
    let response = client.browse(app, "FEmusic_charts").await?;
    Ok(rows::browse_rows(
        &response,
        "ytm:charts",
        CHART_SHELVES,
        ROW_ITEMS,
    ))
}

pub async fn album_tracks(
    client: &Client,
    app: &tauri::AppHandle,
    album: &MusicAlbumRef,
) -> Result<Vec<MusicTrack>, String> {
    let id = safe_browse_id(&album.id)?;
    tokio::time::timeout(std::time::Duration::from_secs(25), async {
        let mut response = client.browse(app, &id).await?;
        let mut tracks = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for _ in 0..100 {
            let (entries, continuation) =
                super::artist::collection_page(&response, MusicCatalogKind::Tracks, &album.artist)?;
            tracks.extend(entries.into_iter().filter_map(|entry| match entry {
                MusicCatalogItem::Track(track) => Some(adopt(track, album)),
                _ => None,
            }));
            let Some(token) = continuation else {
                return Ok(tracks);
            };
            if !seen.insert(token.clone()) {
                return Err("YouTube Music repeated an album page. Please try again.".into());
            }
            response = client.browse_continuation(app, &token).await?;
        }
        Err("YouTube Music album exceeded the supported page count".into())
    })
    .await
    .map_err(|_| "YouTube Music album timed out".to_string())?
}

pub async fn artist_top(
    client: &Client,
    app: &tauri::AppHandle,
    artist: &MusicArtistRef,
) -> Result<Vec<MusicTrack>, String> {
    let page = super::artist::catalog(client, app, artist, MusicCatalogKind::Tracks, None).await?;
    Ok(page
        .items
        .into_iter()
        .filter_map(|item| match item {
            MusicCatalogItem::Track(track) => Some(track),
            _ => None,
        })
        .collect())
}

pub async fn playlist_tracks(
    client: &Client,
    app: &tauri::AppHandle,
    playlist: &MusicPlaylistRef,
) -> Result<Vec<MusicTrack>, String> {
    let id = safe_browse_id(&playlist.id)?;
    let browse_id = if id.starts_with("VL") {
        id
    } else {
        format!("VL{id}")
    };
    let response = client.browse(app, &browse_id).await?;
    Ok(gather(
        &response,
        LIST_ITEM,
        items::track_from_list_item,
        LIST_TRACKS,
    ))
}

pub async fn station_tracks(
    client: &Client,
    app: &tauri::AppHandle,
    station: &MusicStationRef,
) -> Result<Vec<MusicTrack>, String> {
    let playlist_id = safe_browse_id(&station.id)?;
    let video_id = playlist_id
        .strip_prefix("RDAMVM")
        .map(safe_video_id)
        .transpose()?;
    let response = client
        .watch_queue(app, video_id.as_deref(), &playlist_id)
        .await?;
    Ok(gather(
        &response,
        QUEUE_ITEM,
        items::track_from_panel,
        STATION_TRACKS,
    ))
}

pub async fn stream(app: &tauri::AppHandle, track: &MusicTrack) -> Result<MusicStream, String> {
    let video_id = safe_video_id(track.source_id.as_deref().unwrap_or(&track.id))?;
    // A raw Innertube URL can pass a one-byte probe but fail mpv's full-range read.
    // Keep resolver failures actionable instead of caching an unusable fallback.
    super::ytdlp::stream(app, &video_id).await.map_err(|error| {
        format!("YouTube Music could not resolve this song. Try again or choose another source. {error}")
    })
}

pub async fn video_stream(
    app: &tauri::AppHandle,
    track: &MusicTrack,
) -> Result<MusicVideoStream, String> {
    let video_id = safe_video_id(track.source_id.as_deref().unwrap_or(&track.id))?;
    super::ytdlp::video_stream(app, &video_id).await
}

fn gather<T>(response: &Value, key: &str, build: fn(&Value) -> Option<T>, limit: usize) -> Vec<T> {
    let mut found = Vec::new();
    parse::collect(response, key, &mut found);
    found.into_iter().filter_map(build).take(limit).collect()
}

fn adopt(mut track: MusicTrack, album: &MusicAlbumRef) -> MusicTrack {
    if track.album.is_none() {
        track.album = Some(album.title.clone());
    }
    if track.artwork.is_empty() {
        track.artwork = album.artwork.clone();
    }
    if track.artist == "Unknown artist" {
        track.artist = album.artist.clone();
    }
    track
}

fn safe_video_id(raw: &str) -> Result<String, String> {
    safe_id(raw, 24).ok_or_else(|| "Invalid music video id".to_string())
}

fn safe_browse_id(raw: &str) -> Result<String, String> {
    safe_id(raw, 80).ok_or_else(|| "Invalid music catalog id".to_string())
}

fn safe_id(raw: &str, ceiling: usize) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty()
        || trimmed.len() > ceiling
        || !trimmed.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
    {
        return None;
    }
    Some(trimmed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn video_ids_reject_urls_and_shell_input() {
        assert_eq!(safe_video_id("abc_123-Z").expect("valid id"), "abc_123-Z");
        assert!(safe_video_id("https://youtube.com/watch?v=abc").is_err());
        assert!(safe_video_id("abc; rm file").is_err());
        assert!(safe_video_id("  ").is_err());
    }

    #[test]
    fn browse_ids_allow_the_longer_catalog_prefixes() {
        assert_eq!(
            safe_browse_id("MPREb_wYRcCbSMkPI").expect("album id"),
            "MPREb_wYRcCbSMkPI"
        );
        assert_eq!(
            safe_browse_id("VLOLAK5uy_kShaSSQrHWMi").expect("playlist id"),
            "VLOLAK5uy_kShaSSQrHWMi"
        );
        assert!(safe_browse_id("VL../../etc").is_err());
    }

    #[test]
    fn gather_walks_the_response_and_honors_the_limit() {
        let response = json!({"contents": [
            {"musicResponsiveListItemRenderer": {
                "playlistItemData": {"videoId": "one"},
                "flexColumns": [{"musicResponsiveListItemFlexColumnRenderer": {
                    "text": {"runs": [{"text": "First"}]}
                }}]
            }},
            {"musicResponsiveListItemRenderer": {
                "playlistItemData": {"videoId": "two"},
                "flexColumns": [{"musicResponsiveListItemFlexColumnRenderer": {
                    "text": {"runs": [{"text": "Second"}]}
                }}]
            }}
        ]});
        let tracks = gather(&response, LIST_ITEM, items::track_from_list_item, 1);
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].title, "First");
    }

    #[test]
    fn album_tracks_inherit_the_album_cover_and_artist() {
        let album = MusicAlbumRef {
            id: "MPREb_one".to_string(),
            connector_id: "youtube".to_string(),
            title: "Absolution".to_string(),
            artist: "Muse".to_string(),
            artwork: "cover.jpg".to_string(),
            year: Some(2003),
            track_count: Some(14),
            explicit: None,
        };
        let bare = items::track(
            "MdVBSHOMWSY",
            "Hysteria".to_string(),
            None,
            None,
            String::new(),
            227,
        );
        let filled = adopt(bare, &album);
        assert_eq!(filled.artist, "Muse");
        assert_eq!(filled.album.as_deref(), Some("Absolution"));
        assert_eq!(filled.artwork, "cover.jpg");
    }

    #[test]
    fn video_search_preserves_actual_provider_ids_and_excludes_audio_art_tracks() {
        // Reduced public YouTube Music video-search response captured 2026-09-14.
        let mut response: Value =
            serde_json::from_str(include_str!("video-search-fixture.json")).unwrap();
        let tracks = video_results(&response, 12);
        assert_eq!(tracks.len(), 2);
        assert_eq!(tracks[0].source_id.as_deref(), Some("FGBhQbmPwH8"));
        assert_eq!(tracks[0].title, "One More Time");
        assert_eq!(tracks[0].artist, "Daft Punk");
        assert!(tracks[0].artwork.starts_with("https://"));
        assert_eq!(tracks[1].source_id.as_deref(), Some("a5uQMwRMHcs"));
        assert_eq!(tracks[0].media_kind.as_deref(), Some("video"));
        assert_eq!(video_results(&response, 1).len(), 1);
        let pointer = "/contents/0/musicResponsiveListItemRenderer/overlay/musicItemThumbnailOverlayRenderer/content/musicPlayButtonRenderer/playNavigationEndpoint/watchEndpoint/watchEndpointMusicSupportedConfigs/watchEndpointMusicConfig/musicVideoType";
        *response.pointer_mut(pointer).unwrap() = json!("MUSIC_VIDEO_TYPE_ATV");
        assert_eq!(video_results(&response, 12).len(), 1);
        let duplicate = response["contents"][2].clone();
        response["contents"].as_array_mut().unwrap().push(duplicate);
        assert_eq!(video_results(&response, 12).len(), 1);
    }
    #[test]
    fn interviews_do_not_mix_official_videos_or_audio() {
        let mut response: Value = serde_json::from_str(include_str!("video-search-fixture.json")).unwrap();
        assert!(video_results_kind(&response, 12, true).is_empty());
        let item = &mut response["contents"][0]["musicResponsiveListItemRenderer"];
        item["flexColumns"][0]["musicResponsiveListItemFlexColumnRenderer"]["text"]["runs"][0]["text"] = json!("Daft Punk Interview");
        let pointer = "/overlay/musicItemThumbnailOverlayRenderer/content/musicPlayButtonRenderer/playNavigationEndpoint/watchEndpoint/watchEndpointMusicSupportedConfigs/watchEndpointMusicConfig/musicVideoType";
        *item.pointer_mut(pointer).unwrap() = json!("MUSIC_VIDEO_TYPE_UGC");
        assert_eq!(video_results_kind(&response, 12, true).len(), 1);
        assert_eq!(video_results_kind(&response, 12, false).len(), 1);
    }

}
