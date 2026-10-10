use super::{innertube::Client, items, parse};
use crate::music::{
    MusicArtistRef, MusicCatalogItem, MusicCatalogKind, MusicCatalogPage, MusicCatalogScope,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum Request {
    Browse { id: String, params: Option<String> },
    Continuation { token: String },
}

#[derive(Debug, Deserialize, Serialize)]
struct Cursor {
    artist: String,
    kind: MusicCatalogKind,
    pending: Vec<Request>,
}

pub async fn catalog(
    client: &Client,
    app: &tauri::AppHandle,
    artist: &MusicArtistRef,
    kind: MusicCatalogKind,
    cursor: Option<&str>,
) -> Result<MusicCatalogPage, String> {
    if !valid_id(&artist.id) || !artist.id.starts_with("UC") {
        return Err("Invalid YouTube Music artist identity".into());
    }
    let mut state = if let Some(cursor) = cursor {
        read_cursor(cursor, artist, kind)?
    } else {
        let response = client.browse(app, &artist.id).await?;
        let pending = collection_links(&response, kind);
        if pending.len() > 8 {
            return Err("YouTube Music returned too many artist collections to browse".into());
        }
        if pending.is_empty() {
            return Ok(MusicCatalogPage {
                items: artist_excerpt(&response, kind, &artist.name),
                next_cursor: None,
                total: None,
                scope: MusicCatalogScope::Limited,
            });
        }
        Cursor {
            artist: artist.id.clone(),
            kind,
            pending,
        }
    };
    let request = state.pending.remove(0);
    let response = match &request {
        Request::Browse { id, params } => {
            client.browse_collection(app, id, params.as_deref()).await?
        }
        Request::Continuation { token } => client.browse_continuation(app, token).await?,
    };
    let (items, continuation) = collection_page(&response, kind, &artist.name)?;
    if let Some(token) = continuation {
        let next = Request::Continuation { token };
        if next == request {
            return Err("YouTube Music repeated an artist catalog page. Please try again.".into());
        }
        state.pending.insert(0, next);
    }
    let next_cursor = if state.pending.is_empty() {
        None
    } else {
        let cursor = serde_json::to_string(&state)
            .map_err(|_| "Could not save artist catalog continuation")?;
        if cursor.len() > 32_768 {
            return Err("YouTube Music returned an oversized artist catalog continuation".into());
        }
        Some(cursor)
    };
    Ok(MusicCatalogPage {
        items,
        next_cursor,
        total: None,
        scope: match kind {
            MusicCatalogKind::Tracks => MusicCatalogScope::Top,
            MusicCatalogKind::Albums => MusicCatalogScope::Catalog,
        },
    })
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 100
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

fn valid_parameter(value: &str) -> bool {
    !value.is_empty() && value.len() <= 8192 && !value.chars().any(char::is_control)
}

fn read_cursor(
    raw: &str,
    artist: &MusicArtistRef,
    kind: MusicCatalogKind,
) -> Result<Cursor, String> {
    let invalid = || {
        "This YouTube Music cursor belongs to another artist or collection, or is invalid"
            .to_string()
    };
    if raw.len() > 32_768 {
        return Err(invalid());
    }
    let state: Cursor = serde_json::from_str(raw).map_err(|_| invalid())?;
    if state.artist != artist.id
        || state.kind != kind
        || state.pending.is_empty()
        || state.pending.len() > 8
        || !state.pending.iter().all(|request| match request {
            Request::Browse { id, params } => {
                valid_id(id) && params.as_ref().is_none_or(|value| valid_parameter(value))
            }
            Request::Continuation { token } => valid_parameter(token),
        })
    {
        return Err(invalid());
    }
    Ok(state)
}

fn browse_link(value: &Value) -> Option<Request> {
    let id = value["browseId"].as_str().filter(|id| valid_id(id))?;
    let params = value["params"].as_str().map(str::to_string);
    if params.as_ref().is_some_and(|value| !valid_parameter(value)) {
        return None;
    }
    Some(Request::Browse {
        id: id.into(),
        params,
    })
}

fn collection_links(response: &Value, kind: MusicCatalogKind) -> Vec<Request> {
    let mut shelves = Vec::new();
    let mut links = Vec::new();
    match kind {
        MusicCatalogKind::Tracks => {
            parse::collect(response, "musicShelfRenderer", &mut shelves);
            for shelf in shelves {
                if !shelf["contents"].as_array().is_some_and(|entries| {
                    entries.iter().any(|entry| {
                        entry
                            .get("musicResponsiveListItemRenderer")
                            .and_then(items::track_from_list_item)
                            .is_some()
                    })
                }) {
                    continue;
                }
                if let Some(link) = shelf
                    .pointer("/bottomEndpoint/browseEndpoint")
                    .and_then(browse_link)
                {
                    links.push(link);
                    break;
                }
            }
        }
        MusicCatalogKind::Albums => {
            parse::collect(response, "musicCarouselShelfRenderer", &mut shelves);
            for shelf in shelves {
                let Some(header) = shelf.pointer("/header/musicCarouselShelfBasicHeaderRenderer")
                else {
                    continue;
                };
                let endpoint = header
                    .pointer("/moreContentButton/buttonRenderer/navigationEndpoint/browseEndpoint")
                    .or_else(|| header.pointer("/title/runs/0/navigationEndpoint/browseEndpoint"));
                let Some(endpoint) = endpoint else { continue };
                if endpoint.pointer("/browseEndpointContextSupportedConfigs/browseEndpointContextMusicConfig/pageType")
                    .and_then(Value::as_str) != Some("MUSIC_PAGE_TYPE_ARTIST_DISCOGRAPHY") {
                    continue;
                }
                if let Some(link) = browse_link(endpoint) {
                    if !links.contains(&link) {
                        links.push(link);
                    }
                }
            }
        }
    }
    links
}

fn artist_excerpt(response: &Value, kind: MusicCatalogKind, artist: &str) -> Vec<MusicCatalogItem> {
    if kind == MusicCatalogKind::Tracks {
        return collection_page(response, kind, artist)
            .map(|page| page.0)
            .unwrap_or_default();
    }
    let mut shelves = Vec::new();
    parse::collect(response, "musicCarouselShelfRenderer", &mut shelves);
    let mut result = Vec::new();
    for shelf in shelves {
        let title = shelf
            .pointer("/header/musicCarouselShelfBasicHeaderRenderer/title")
            .and_then(parse::text);
        if !matches!(title.as_deref(), Some("Albums" | "Singles & EPs")) {
            continue;
        }
        for entry in shelf["contents"].as_array().into_iter().flatten() {
            if let Some(item) = parse_entry(entry, kind, artist) {
                result.push(item);
            }
        }
    }
    result
}

fn parse_entry(entry: &Value, kind: MusicCatalogKind, artist: &str) -> Option<MusicCatalogItem> {
    match kind {
        MusicCatalogKind::Tracks => entry
            .get("musicResponsiveListItemRenderer")
            .and_then(items::track_from_list_item)
            .map(MusicCatalogItem::Track),
        MusicCatalogKind::Albums => entry
            .get("musicTwoRowItemRenderer")
            .and_then(items::catalog_item)
            .and_then(|item| match item {
                MusicCatalogItem::Album(mut album) => {
                    if album.artist == "Unknown artist" {
                        album.artist = artist.into();
                    }
                    Some(MusicCatalogItem::Album(album))
                }
                _ => None,
            }),
    }
}

/// Parse only the collection's entries, excluding menus and recommendations elsewhere.
pub(super) fn collection_page(
    response: &Value,
    kind: MusicCatalogKind,
    artist: &str,
) -> Result<(Vec<MusicCatalogItem>, Option<String>), String> {
    let keys: &[(&str, &str)] = match kind {
        MusicCatalogKind::Tracks => &[
            ("musicPlaylistShelfRenderer", "contents"),
            ("musicShelfRenderer", "contents"),
            ("musicPlaylistShelfContinuation", "contents"),
            ("musicShelfContinuation", "contents"),
        ],
        MusicCatalogKind::Albums => &[("gridRenderer", "items"), ("gridContinuation", "items")],
    };
    let mut containers = Vec::new();
    for (key, entries_key) in keys {
        let mut found = Vec::new();
        parse::collect(response, key, &mut found);
        containers.extend(found.into_iter().map(|value| (value, *entries_key)));
    }
    for action in response["onResponseReceivedActions"]
        .as_array()
        .into_iter()
        .flatten()
    {
        if let Some(value) = action.get("appendContinuationItemsAction") {
            containers.push((value, "continuationItems"));
        }
    }
    if containers.is_empty() {
        return Err(
            "YouTube Music did not return this artist collection. Please try again.".into(),
        );
    }
    let mut result = Vec::new();
    let mut next = None;
    let mut seen = HashSet::new();
    for (container, key) in containers {
        if let Some(token) = container
            .pointer("/continuations/0/nextContinuationData/continuation")
            .and_then(Value::as_str)
        {
            next = Some(token.to_string());
        }
        for entry in container[key].as_array().into_iter().flatten() {
            if let Some(token) = entry
                .pointer("/continuationItemRenderer/continuationEndpoint/continuationCommand/token")
                .and_then(Value::as_str)
            {
                next = Some(token.to_string());
                continue;
            }
            if let Some(item) = parse_entry(entry, kind, artist) {
                let id = match &item {
                    MusicCatalogItem::Track(track) => &track.id,
                    MusicCatalogItem::Album(album) => &album.id,
                    _ => unreachable!(),
                };
                if seen.insert(id.clone()) {
                    result.push(item);
                }
            }
        }
    }
    if next.as_ref().is_some_and(|value| !valid_parameter(value)) {
        return Err("YouTube Music returned an invalid catalog continuation".into());
    }
    Ok((result, next))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn future() -> MusicArtistRef {
        MusicArtistRef {
            id: "UC1_liDR4fRFJgH4HoJeV8cw".into(),
            connector_id: "youtube".into(),
            name: "Future".into(),
            artwork: None,
            subtitle: None,
        }
    }

    fn song(index: usize) -> Value {
        json!({"musicResponsiveListItemRenderer": {
            "playlistItemData":{"videoId":format!("song_{index}")},
            "flexColumns":[{"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":format!("Song {index}")} ]}}},
                {"musicResponsiveListItemFlexColumnRenderer":{"text":{"runs":[{"text":"Future"}]}}}],
            "fixedColumns":[{"musicResponsiveListItemFixedColumnRenderer":{"text":{"runs":[{"text":"3:00"}]}}}]
        }})
    }

    fn album(index: usize) -> Value {
        json!({"musicTwoRowItemRenderer": {
            "title":{"runs":[{"text":format!("Release {index}")}]},
            "subtitle":{"runs":[{"text":"Album"},{"text":" • "},{"text":"2026"}]},
            "navigationEndpoint":{"browseEndpoint":{"browseId":format!("MPREb_release_{index}"),
                "browseEndpointContextSupportedConfigs":{"browseEndpointContextMusicConfig":{"pageType":"MUSIC_PAGE_TYPE_ALBUM"}}}}
        }})
    }

    fn discography_shelf(params: &str) -> Value {
        json!({"musicCarouselShelfRenderer": {
            "header":{"musicCarouselShelfBasicHeaderRenderer":{"moreContentButton":{"buttonRenderer":{
                "navigationEndpoint":{"browseEndpoint":{"browseId":"MPADUC1_liDR4fRFJgH4HoJeV8cw","params":params,
                    "browseEndpointContextSupportedConfigs":{"browseEndpointContextMusicConfig":{"pageType":"MUSIC_PAGE_TYPE_ARTIST_DISCOGRAPHY"}}}}
            }}}},"contents":[album(0)]
        }})
    }

    #[test]
    fn future_artist_preview_links_to_full_songs_albums_and_singles() {
        // Renderer shape and endpoints verified from Future's public artist page.
        let response = json!({"contents":[
            {"musicShelfRenderer":{"contents":(0..5).map(song).collect::<Vec<_>>(),
                "bottomEndpoint":{"browseEndpoint":{"browseId":"VLOLAK5uy_moM-aHZhmdVNw8mXuIS0wnznLvo6MM2os","params":"ggMCCAI%3D"}}}},
            discography_shelf("ggMIegYIARoCAQI%3D"), discography_shelf("ggMIegYIAhoCAQI%3D"),
            {"musicCarouselShelfRenderer":{"header":{"musicCarouselShelfBasicHeaderRenderer":{"title":{"runs":[{"text":"Featured on"}]}}},"contents":[album(99)]}}
        ]});
        let songs = collection_links(&response, MusicCatalogKind::Tracks);
        assert_eq!(songs.len(), 1);
        assert!(
            matches!(&songs[0], Request::Browse {id,params} if id.starts_with("VL") && params.as_deref()==Some("ggMCCAI%3D"))
        );
        let releases = collection_links(&response, MusicCatalogKind::Albums);
        assert_eq!(releases.len(), 2);
        assert_ne!(releases[0], releases[1]);
    }

    #[test]
    fn full_song_pages_keep_100_plus_50_and_provider_continuation() {
        let mut entries: Vec<_> = (0..100).map(song).collect();
        entries.push(json!({"continuationItemRenderer":{"continuationEndpoint":{"continuationCommand":{"token":"page-two"}}}}));
        let initial = json!({"contents":{"musicPlaylistShelfRenderer":{"contents":entries}}});
        let (first, next) = collection_page(&initial, MusicCatalogKind::Tracks, "Future").unwrap();
        assert_eq!(first.len(), 100);
        assert_eq!(next.as_deref(), Some("page-two"));
        let following = json!({"onResponseReceivedActions":[{"appendContinuationItemsAction":{
            "continuationItems":(100..150).map(song).collect::<Vec<_>>()}}]});
        let (last, next) = collection_page(&following, MusicCatalogKind::Tracks, "Future").unwrap();
        assert_eq!(last.len(), 50);
        assert!(next.is_none());
        let MusicCatalogItem::Track(track) = &last[49] else {
            panic!("track")
        };
        assert_eq!(track.id, "song_149");
        assert_eq!(track.connector_id.as_deref(), Some("youtube"));
        assert!(track.playback_url.is_none());
    }

    #[test]
    fn full_discography_pages_keep_more_than_twenty_releases_with_artist_identity() {
        let response =
            json!({"contents":{"gridRenderer":{"items":(0..92).map(album).collect::<Vec<_>>()}}});
        let (items, next) = collection_page(&response, MusicCatalogKind::Albums, "Future").unwrap();
        assert_eq!(items.len(), 92);
        assert!(next.is_none());
        for item in items {
            let MusicCatalogItem::Album(album) = item else {
                panic!("album")
            };
            assert_eq!(album.artist, "Future");
            assert_eq!(album.connector_id, "youtube");
        }
    }

    #[test]
    fn continuation_cursor_keeps_pending_release_collections_and_rejects_stale_artist() {
        let artist = future();
        let state = Cursor {
            artist: artist.id.clone(),
            kind: MusicCatalogKind::Albums,
            pending: vec![
                Request::Continuation {
                    token: "next-album-page".into(),
                },
                Request::Browse {
                    id: format!("MPAD{}", artist.id),
                    params: Some("singles-provider-params".into()),
                },
            ],
        };
        let cursor = serde_json::to_string(&state).unwrap();
        assert_eq!(
            read_cursor(&cursor, &artist, MusicCatalogKind::Albums)
                .unwrap()
                .pending,
            state.pending
        );
        let other = MusicArtistRef {
            id: "UCOtherArtist".into(),
            ..artist.clone()
        };
        assert!(read_cursor(&cursor, &other, MusicCatalogKind::Albums).is_err());
        assert!(read_cursor(&cursor, &artist, MusicCatalogKind::Tracks).is_err());
        let bad = cursor.replace("next-album-page", &"x".repeat(8193));
        assert!(read_cursor(&bad, &artist, MusicCatalogKind::Albums).is_err());
    }

    #[test]
    fn missing_collection_is_an_error_but_an_empty_provider_collection_is_valid() {
        assert!(collection_page(
            &json!({"error":{"code":400}}),
            MusicCatalogKind::Albums,
            "Future"
        )
        .is_err());
        let (items, next) = collection_page(
            &json!({"contents":{"gridRenderer":{"items":[]}}}),
            MusicCatalogKind::Albums,
            "Future",
        )
        .unwrap();
        assert!(items.is_empty());
        assert!(next.is_none());
    }
}
