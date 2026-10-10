use super::super::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogRow, MusicPlaylistRef,
    MusicRowLayout, MusicSearchResults, MusicTrack,
};
use super::{api, parse, SpotifyState};
use serde_json::Value;

const ROW_LIMIT: usize = 20;
const DETAIL_LIMIT: usize = 50;
const SEARCH_KINDS: &str = "track,album,artist,playlist";
const SOURCE_LABEL: &str = "Spotify";

pub async fn home(state: &SpotifyState) -> Result<Vec<MusicCatalogRow>, String> {
    let token = state.web_token().await?;
    let market = state.market();
    let http = state.http();
    let (recent, top_tracks, top_artists, playlists, albums, liked) = tokio::join!(
        api::recently_played(http, &token, ROW_LIMIT),
        api::top(http, &token, "tracks", ROW_LIMIT),
        api::top(http, &token, "artists", ROW_LIMIT),
        api::my_playlists(http, &token, ROW_LIMIT),
        api::saved_albums(http, &token, ROW_LIMIT, &market),
        api::saved_tracks(http, &token, ROW_LIMIT, &market),
    );

    let mut rows = Vec::new();
    let mut failure = None;
    let mut collect = |outcome: Result<Value, api::ApiError>,
                       id: &str,
                       title: &str,
                       layout: MusicRowLayout,
                       items: fn(&Value) -> Vec<MusicCatalogItem>| {
        match outcome {
            Ok(body) => {
                if let Some(built) = row(id, title, layout, items(&body)) {
                    rows.push(built);
                }
            }
            Err(error) => {
                if failure.is_none() {
                    failure = Some(String::from(error));
                }
            }
        }
    };

    collect(
        recent,
        "spotify:home:recently-played",
        "Recently played on Spotify",
        MusicRowLayout::Covers,
        track_items,
    );
    collect(
        top_tracks,
        "spotify:home:top-tracks",
        "Your top tracks",
        MusicRowLayout::TrackGrid,
        track_items,
    );
    collect(
        top_artists,
        "spotify:home:top-artists",
        "Your top artists",
        MusicRowLayout::Circles,
        artist_items,
    );
    collect(
        playlists,
        "spotify:home:playlists",
        "Your Spotify playlists",
        MusicRowLayout::Covers,
        playlist_items,
    );
    collect(
        albums,
        "spotify:home:saved-albums",
        "Albums in your library",
        MusicRowLayout::Covers,
        album_items,
    );
    collect(
        liked,
        "spotify:home:saved-tracks",
        "Liked on Spotify",
        MusicRowLayout::TrackGrid,
        track_items,
    );

    match failure {
        Some(error) if rows.is_empty() => Err(error),
        _ => Ok(rows),
    }
}

pub async fn tracks(
    state: &SpotifyState,
    query: &str,
    limit: usize,
) -> Result<Vec<MusicTrack>, String> {
    let token = state.web_token().await?;
    let body = api::search(state.http(), &token, query, "track", limit, &state.market()).await?;
    Ok(parse::list(&body, "/tracks/items")
        .into_iter()
        .filter_map(parse::track)
        .take(limit)
        .collect())
}

pub async fn search(
    state: &SpotifyState,
    query: &str,
    limit: usize,
) -> Result<MusicSearchResults, String> {
    let token = state.web_token().await?;
    let body = api::search(
        state.http(),
        &token,
        query,
        SEARCH_KINDS,
        limit,
        &state.market(),
    )
    .await?;
    let tracks = parse::list(&body, "/tracks/items")
        .into_iter()
        .filter_map(parse::track)
        .take(limit)
        .collect::<Vec<_>>();
    let albums = parse::list(&body, "/albums/items")
        .into_iter()
        .filter_map(parse::album)
        .take(limit)
        .collect::<Vec<_>>();
    let artists = parse::list(&body, "/artists/items")
        .into_iter()
        .filter_map(parse::artist)
        .take(limit)
        .collect::<Vec<_>>();
    let playlists = parse::list(&body, "/playlists/items")
        .into_iter()
        .filter_map(parse::playlist)
        .take(limit)
        .collect::<Vec<_>>();
    Ok(MusicSearchResults {
        top: top_result(query, &tracks, &artists, &albums),
        tracks,
        albums,
        artists,
        playlists,
    })
}

pub async fn album_tracks(
    state: &SpotifyState,
    album: &MusicAlbumRef,
) -> Result<Vec<MusicTrack>, String> {
    let id = parse::base62(&album.id).ok_or_else(|| "Spotify album id is invalid".to_string())?;
    let token = state.web_token().await?;
    let body = api::album_tracks(state.http(), &token, id, DETAIL_LIMIT, &state.market()).await?;
    Ok(parse::list(&body, "/items")
        .into_iter()
        .filter_map(|item| parse::album_track(item, album))
        .collect())
}

pub async fn artist_top(
    state: &SpotifyState,
    artist: &MusicArtistRef,
) -> Result<Vec<MusicTrack>, String> {
    let id = parse::base62(&artist.id).ok_or_else(|| "Spotify artist id is invalid".to_string())?;
    let token = state.web_token().await?;
    let market = state.market();
    match api::artist_top_tracks(state.http(), &token, id, &market).await {
        Ok(body) => Ok(parse::list(&body, "/tracks")
            .into_iter()
            .filter_map(parse::track)
            .collect()),
        Err(error) if error.missing() => tracks(state, &artist_filter(&artist.name), 10).await,
        Err(error) => Err(error.into()),
    }
}

pub async fn playlist_tracks(
    state: &SpotifyState,
    playlist: &MusicPlaylistRef,
) -> Result<Vec<MusicTrack>, String> {
    let id =
        parse::base62(&playlist.id).ok_or_else(|| "Spotify playlist id is invalid".to_string())?;
    let token = state.web_token().await?;
    let market = state.market();
    load_playlist_tracks(id, |offset| {
        api::playlist_items(state.http(), &token, id, DETAIL_LIMIT, offset, &market)
    })
    .await
}

async fn load_playlist_tracks<F, Fut>(id: &str, mut fetch_page: F) -> Result<Vec<MusicTrack>, String>
where
    F: FnMut(usize) -> Fut,
    Fut: std::future::Future<Output = Result<Value, api::ApiError>>,
{
    let paths = [format!("/playlists/{id}/items"), format!("/playlists/{id}/tracks")];
    let mut offset = 0;
    let mut tracks = Vec::new();
    loop {
        let body = fetch_page(offset).await?;
        let items = body.get("items").and_then(Value::as_array)
            .ok_or_else(|| "Spotify returned an invalid playlist page".to_string())?;
        // Advance using the raw page, including removed tracks, rather than the
        // parsed track count. Never silently return a partial playlist on error.
        let next = super::library::next_offset(&body, offset, items.len(), &[&paths[0], &paths[1]])?;
        tracks.extend(items.iter().filter_map(parse::entry).filter_map(parse::track));
        match next {
            Some(next) => offset = next,
            None => return Ok(tracks),
        }
    }
}

fn row(
    id: &str,
    title: &str,
    layout: MusicRowLayout,
    items: Vec<MusicCatalogItem>,
) -> Option<MusicCatalogRow> {
    (!items.is_empty()).then(|| MusicCatalogRow {
        id: id.to_string(),
        title: title.to_string(),
        title_literal: true,
        subtitle: Some(SOURCE_LABEL.to_string()),
        layout,
        source: parse::CONNECTOR.to_string(),
        items,
    })
}

fn track_items(body: &Value) -> Vec<MusicCatalogItem> {
    parse::list(body, "/items")
        .into_iter()
        .filter_map(parse::entry)
        .filter_map(parse::track)
        .map(MusicCatalogItem::Track)
        .collect()
}

fn artist_items(body: &Value) -> Vec<MusicCatalogItem> {
    parse::list(body, "/items")
        .into_iter()
        .filter_map(parse::artist)
        .map(MusicCatalogItem::Artist)
        .collect()
}

fn album_items(body: &Value) -> Vec<MusicCatalogItem> {
    parse::list(body, "/items")
        .into_iter()
        .map(|entry| field(entry, "album"))
        .filter_map(parse::album)
        .map(MusicCatalogItem::Album)
        .collect()
}

fn playlist_items(body: &Value) -> Vec<MusicCatalogItem> {
    parse::list(body, "/items")
        .into_iter()
        .filter_map(parse::playlist)
        .map(MusicCatalogItem::Playlist)
        .collect()
}

fn field<'a>(value: &'a Value, key: &str) -> &'a Value {
    match value.get(key) {
        Some(nested) if nested.is_object() => nested,
        _ => value,
    }
}

fn artist_filter(name: &str) -> String {
    format!("artist:\"{}\"", name.replace('"', " "))
}

fn top_result(
    query: &str,
    tracks: &[MusicTrack],
    artists: &[MusicArtistRef],
    albums: &[MusicAlbumRef],
) -> Option<MusicCatalogItem> {
    let wanted = query.trim().to_ascii_lowercase();
    if let Some(artist) = artists
        .iter()
        .find(|artist| artist.name.to_ascii_lowercase() == wanted)
    {
        return Some(MusicCatalogItem::Artist(artist.clone()));
    }
    if let Some(track) = tracks.first() {
        return Some(MusicCatalogItem::Track(track.clone()));
    }
    albums
        .first()
        .cloned()
        .map(MusicCatalogItem::Album)
        .or_else(|| artists.first().cloned().map(MusicCatalogItem::Artist))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn playlist_detail_loads_beyond_fifty_and_keeps_order_and_duplicates() {
        let mut offsets = Vec::new();
        let tracks = load_playlist_tracks("playlist", |offset| {
            offsets.push(offset);
            let end = (offset + 50).min(107);
            let items: Vec<Value> = (offset..end).map(|n| {
                // Removed entries must not shorten the pagination offset.
                if n == 12 { return json!({"track": null}); }
                // Repeated tracks are intentional playlist entries.
                let n = if n == 106 { 1 } else { n };
                json!({"track": {"uri": format!("spotify:track:{n}"), "name": format!("Song {n}")}})
            }).collect();
            let next = if end < 107 {
                json!(format!("https://api.spotify.com/v1/playlists/playlist/items?offset={end}&limit=50"))
            } else { Value::Null };
            std::future::ready(Ok(json!({"items": items, "next": next})))
        }).await.unwrap();
        assert_eq!(offsets, vec![0, 50, 100]);
        assert_eq!(tracks.len(), 106);
        assert_eq!(tracks[49].title, "Song 50");
        assert_eq!(tracks[104].title, "Song 105");
        assert_eq!(tracks[105].title, "Song 1");
    }

    #[tokio::test]
    async fn playlist_detail_rejects_failed_or_invalid_later_pages() {
        for failure in ["network", "repeated", "wrong-playlist", "empty", "malformed"] {
            let result = load_playlist_tracks("playlist", |offset| {
                let next = "https://api.spotify.com/v1/playlists/playlist/tracks?offset=50";
                let item = json!({"item": {"uri": "spotify:track:one", "name": "One"}});
                std::future::ready(if offset == 0 {
                    Ok(json!({"items": [item], "next": next}))
                } else {
                    match failure {
                        "network" => Err(api::ApiError { status: None, message: "Network failed".into() }),
                        "repeated" => Ok(json!({"items": [item], "next": next})),
                        "wrong-playlist" => Ok(json!({"items": [item], "next": "https://api.spotify.com/v1/playlists/other/items?offset=100"})),
                        "empty" => Ok(json!({"items": [], "next": "https://api.spotify.com/v1/playlists/playlist/items?offset=100"})),
                        _ => Ok(json!({"next": null})),
                    }
                })
            }).await;
            assert!(result.is_err(), "{failure} must not return a truncated playlist");
        }
    }

    #[tokio::test]
    async fn playlist_detail_stops_at_the_final_page_including_empty_playlists() {
        for items in [json!([]), json!([{"item": {"uri": "spotify:track:one", "name": "One"}}])] {
            let mut calls = 0;
            let expected = items.as_array().unwrap().len();
            let result = load_playlist_tracks("playlist", |_| {
                calls += 1;
                std::future::ready(Ok(json!({"items": items, "next": null})))
            }).await.unwrap();
            assert_eq!(calls, 1);
            assert_eq!(result.len(), expected);
        }
    }

    #[test]
    fn track_rows_accept_every_wrapper_spotify_uses() {
        let recently_played = json!({ "items": [{ "played_at": "now", "track": { "uri": "spotify:track:one", "name": "One" } }] });
        let saved = json!({ "items": [{ "added_at": "now", "track": { "uri": "spotify:track:two", "name": "Two" } }] });
        let top = json!({ "items": [{ "uri": "spotify:track:three", "name": "Three" }] });
        assert_eq!(track_items(&recently_played).len(), 1);
        assert_eq!(track_items(&saved).len(), 1);
        assert_eq!(track_items(&top).len(), 1);
    }

    #[test]
    fn saved_album_rows_unwrap_the_album_field() {
        let body = json!({
            "items": [{
                "added_at": "now",
                "album": {
                    "uri": "spotify:album:one",
                    "name": "Absolution",
                    "artists": [{ "name": "Muse" }],
                    "images": [{ "url": "https://example.test/a.jpg", "width": 640, "height": 640 }]
                }
            }]
        });
        let items = album_items(&body);
        assert_eq!(items.len(), 1);
        let MusicCatalogItem::Album(album) = &items[0] else {
            panic!("album item");
        };
        assert_eq!(album.title, "Absolution");
        assert_eq!(album.connector_id, "spotify");
    }

    #[test]
    fn empty_rows_are_dropped_rather_than_rendered_blank() {
        assert!(row(
            "spotify:home:empty",
            "Nothing",
            MusicRowLayout::Covers,
            Vec::new()
        )
        .is_none());
        let built = row(
            "spotify:home:one",
            "One",
            MusicRowLayout::Circles,
            artist_items(&json!({ "items": [{ "uri": "spotify:artist:one", "name": "Muse" }] })),
        )
        .expect("row");
        assert_eq!(built.source, "spotify");
        assert!(built.title_literal);
        assert_eq!(built.subtitle.as_deref(), Some("Spotify"));
        assert_eq!(built.layout, MusicRowLayout::Circles);
    }

    #[test]
    fn an_exact_artist_match_wins_the_top_result() {
        let artists = vec![MusicArtistRef {
            id: "spotify:artist:one".to_string(),
            connector_id: "spotify".to_string(),
            name: "Muse".to_string(),
            artwork: None,
            subtitle: None,
        }];
        let tracks = vec![
            parse::track(&json!({ "uri": "spotify:track:one", "name": "Hysteria" }))
                .expect("track"),
        ];
        let top = top_result("  muse ", &tracks, &artists, &[]).expect("top");
        assert!(matches!(top, MusicCatalogItem::Artist(_)));
        let top = top_result("hysteria", &tracks, &artists, &[]).expect("top");
        assert!(matches!(top, MusicCatalogItem::Track(_)));
        assert!(top_result("nothing", &[], &[], &[]).is_none());
    }

    #[test]
    fn artist_filters_cannot_break_out_of_the_quoted_term() {
        assert_eq!(artist_filter("Muse"), "artist:\"Muse\"");
        assert_eq!(artist_filter("Sun\"O)))"), "artist:\"Sun O)))\"");
    }
}
