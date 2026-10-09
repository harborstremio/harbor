use super::{non_empty, release_year};
use crate::music::{
    duration_label, MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogKind,
    MusicCatalogPage, MusicCatalogScope, MusicTrack,
};
use serde::Deserialize;

const CHART_ALBUMS: &str = "https://api.deezer.com/chart/0/albums?limit=25&index=0";
const CHART_ARTISTS: &str = "https://api.deezer.com/chart/0/artists?limit=25&index=0";
const CHART_TRACKS: &str = "https://api.deezer.com/chart/0/tracks?limit=25&index=0";
const EDITORIAL_SELECTION: &str = "https://api.deezer.com/editorial/0/selection?limit=25";

#[derive(Debug, Deserialize)]
struct Envelope<T> {
    data: Option<Vec<T>>,
    error: Option<Failure>,
    total: Option<u64>,
    next: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Failure {
    code: Option<i64>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Album {
    id: Option<u64>,
    title: Option<String>,
    cover_big: Option<String>,
    cover_medium: Option<String>,
    release_date: Option<String>,
    nb_tracks: Option<u32>,
    explicit_lyrics: Option<bool>,
    artist: Option<Artist>,
}

#[derive(Debug, Deserialize)]
struct Artist {
    id: Option<u64>,
    name: Option<String>,
    picture_big: Option<String>,
    picture_medium: Option<String>,
    position: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct Track {
    explicit_lyrics: Option<bool>,
    title_version: Option<String>,
    id: Option<u64>,
    title: Option<String>,
    duration: Option<u64>,
    artist: Option<Artist>,
    album: Option<TrackAlbum>,
}

#[derive(Debug, Deserialize)]
struct TrackAlbum {
    title: Option<String>,
    cover_xl: Option<String>,
    cover_big: Option<String>,
    cover_medium: Option<String>,
}

pub async fn chart_albums(limit: usize) -> Result<Vec<MusicAlbumRef>, String> {
    parse_albums(&fetch(CHART_ALBUMS).await?, limit)
}

pub async fn chart_tracks(limit: usize) -> Result<Vec<MusicTrack>, String> {
    parse_tracks(&fetch(CHART_TRACKS).await?, limit)
}

pub async fn editorial_selection(limit: usize) -> Result<Vec<MusicAlbumRef>, String> {
    parse_albums(&fetch(EDITORIAL_SELECTION).await?, limit)
}

pub async fn chart_artists(limit: usize) -> Result<Vec<MusicArtistRef>, String> {
    parse_artists(&fetch(CHART_ARTISTS).await?, limit)
}

pub async fn search_artists(query: &str, limit: usize) -> Result<Vec<MusicArtistRef>, String> {
    let mut url = url::Url::parse("https://api.deezer.com/search/artist")
        .map_err(|error| format!("Deezer search URL was invalid: {error}"))?;
    url.query_pairs_mut()
        .append_pair("q", query.trim())
        .append_pair("limit", &limit.clamp(1, 50).to_string());
    parse_artists(&fetch(url.as_str()).await?, limit.clamp(1, 50))
}

pub async fn album_tracks(id: &str) -> Result<Vec<MusicTrack>, String> {
    let id = super::numeric_id(id, "deezer:album:")?;
    let raw = fetch(&format!("https://api.deezer.com/album/{id}")).await?;
    complete_album_tracks(id, &raw, |url| async move { fetch(&url).await }).await
}

pub async fn playlist_tracks(id: &str) -> Result<Vec<MusicTrack>, String> {
    let id = super::numeric_id(id, "deezer:playlist:")?;
    complete_playlist_tracks(id, |url| async move { fetch(&url).await }).await
}

async fn complete_playlist_tracks<F, Fut>(
    id: u64,
    mut fetch_page: F,
) -> Result<Vec<MusicTrack>, String>
where
    F: FnMut(String) -> Fut,
    Fut: std::future::Future<Output = Result<String, String>>,
{
    let mut tracks = Vec::new();
    let mut expected = None;
    for _ in 0..100 {
        let raw = fetch_page(format!(
            "https://api.deezer.com/playlist/{id}/tracks?limit=100&index={}",
            tracks.len()
        ))
        .await?;
        let page: Envelope<Track> = serde_json::from_str(&raw)
            .map_err(|error| format!("Deezer playlist was unreadable: {error}"))?;
        if let Some(failure) = page.error {
            return Err(failure_message(failure));
        }
        if expected.is_some() && page.total.is_some() && expected != page.total {
            return Err("This Deezer playlist changed while loading. Please open it again.".into());
        }
        expected = expected.or(page.total);
        let entries = page.data.ok_or("Deezer returned no playlist tracks")?;
        let consumed = entries.len();
        for entry in entries {
            tracks.push(
                track(entry).ok_or(
                    "Deezer returned a playlist track without its identity, title or artist",
                )?,
            );
        }
        let has_more = expected.is_some_and(|count| (tracks.len() as u64) < count)
            || page.next.as_ref().is_some_and(|next| !next.is_empty());
        if !has_more {
            return Ok(tracks);
        }
        if consumed == 0 {
            return Err("Deezer returned an incomplete playlist. Please try again.".into());
        }
    }
    Err("Deezer playlist exceeded the supported track count".into())
}

async fn complete_album_tracks<F, Fut>(
    id: u64,
    raw: &str,
    mut fetch_page: F,
) -> Result<Vec<MusicTrack>, String>
where
    F: FnMut(String) -> Fut,
    Fut: std::future::Future<Output = Result<String, String>>,
{
    let value: serde_json::Value = serde_json::from_str(raw)
        .map_err(|error| format!("Deezer album was unreadable: {error}"))?;
    if value.get("error").is_some() {
        return parse_tracks(raw, usize::MAX);
    }
    let album: Album = serde_json::from_value(value.clone())
        .map_err(|error| format!("Deezer album was unreadable: {error}"))?;
    if album.id != Some(id) {
        return Err("Deezer returned a different album identity".into());
    }
    let embedded = value
        .get("tracks")
        .ok_or("Deezer returned no album tracks")?;
    let mut entries = unwrap_envelope::<Track>(&embedded.to_string())?;
    let expected = album.nb_tracks.map(|count| count as usize);
    // Album metadata can silently truncate at 25 tracks without a `next` link.
    // Use the dedicated endpoint when the advertised count exceeds that excerpt.
    if expected.is_some_and(|count| count > entries.len()) {
        entries.clear();
        for _ in 0..100 {
            let page = fetch_page(format!(
                "https://api.deezer.com/album/{id}/tracks?limit=100&index={}",
                entries.len()
            ))
            .await?;
            let batch = unwrap_envelope::<Track>(&page)?;
            if batch.is_empty() {
                return Err("Deezer returned an incomplete album. Please try again.".into());
            }
            entries.extend(batch);
            if expected.is_some_and(|count| entries.len() >= count) {
                break;
            }
        }
        if expected.is_some_and(|count| entries.len() < count) {
            return Err("Deezer album exceeded the supported track count".into());
        }
    }
    let mut tracks = Vec::with_capacity(entries.len());
    for entry in entries {
        let mut parsed =
            track(entry).ok_or("Deezer returned an album track without its title or artist")?;
        if parsed.album.is_none() {
            parsed.album = album.title.clone();
        }
        if parsed.artwork.is_empty() {
            parsed.artwork = album
                .cover_big
                .clone()
                .or_else(|| album.cover_medium.clone())
                .unwrap_or_default();
        }
        tracks.push(parsed);
    }
    Ok(tracks)
}

pub async fn artist_top(id: &str) -> Result<Vec<MusicTrack>, String> {
    let id = super::numeric_id(id, "deezer:artist:")?;
    parse_tracks(
        &fetch(&format!("https://api.deezer.com/artist/{id}/top?limit=50")).await?,
        50,
    )
}

pub async fn artist_catalog(
    artist: &MusicArtistRef,
    kind: MusicCatalogKind,
    cursor: Option<&str>,
) -> Result<MusicCatalogPage, String> {
    let id = super::numeric_id(&artist.id, "deezer:artist:")?;
    let offset = super::page_offset(artist, kind, cursor)?;
    let path = match kind {
        MusicCatalogKind::Tracks => "top",
        MusicCatalogKind::Albums => "albums",
    };
    let raw = fetch(&format!(
        "https://api.deezer.com/artist/{id}/{path}?limit=50&index={offset}"
    ))
    .await?;
    parse_artist_page(&raw, artist, kind, offset)
}

fn parse_artist_page(
    raw: &str,
    artist: &MusicArtistRef,
    kind: MusicCatalogKind,
    offset: u64,
) -> Result<MusicCatalogPage, String> {
    let id = super::numeric_id(&artist.id, "deezer:artist:")?;
    let page = serde_json::from_str::<Envelope<serde_json::Value>>(raw)
        .map_err(|error| format!("Deezer artist catalog was unreadable: {error}"))?;
    if let Some(error) = page.error {
        return Err(failure_message(error));
    }
    let entries = page.data.ok_or("Deezer returned no artist catalog data")?;
    let consumed = entries.len() as u64;
    let mut items = Vec::with_capacity(entries.len());
    for entry in entries {
        let item = match kind {
            MusicCatalogKind::Tracks => serde_json::from_value::<Track>(entry)
                .ok()
                .and_then(track)
                .map(MusicCatalogItem::Track),
            MusicCatalogKind::Albums => serde_json::from_value::<Album>(entry)
                .ok()
                .and_then(|mut entry| {
                    // The provider's ID-scoped album endpoint omits this credit.
                    entry.artist = entry.artist.or_else(|| {
                        Some(Artist {
                            id: Some(id),
                            name: Some(artist.name.clone()),
                            picture_big: None,
                            picture_medium: None,
                            position: None,
                        })
                    });
                    album(entry)
                })
                .map(MusicCatalogItem::Album),
        };
        items.push(
            item.ok_or("Deezer returned an artist catalog item without its identity or title")?,
        );
    }
    let next_offset = offset.saturating_add(consumed);
    let has_more = page.total.is_some_and(|total| next_offset < total)
        || page.next.as_ref().is_some_and(|next| !next.is_empty());
    if has_more && consumed == 0 {
        return Err("Deezer returned an incomplete artist catalog page. Please try again.".into());
    }
    Ok(MusicCatalogPage {
        items,
        // Rebuild our fixed provider endpoint instead of requesting a remote `next` URL.
        next_cursor: has_more.then(|| super::page_cursor(artist, kind, next_offset)),
        total: page.total,
        scope: match kind {
            MusicCatalogKind::Tracks => MusicCatalogScope::Top,
            MusicCatalogKind::Albums => MusicCatalogScope::Catalog,
        },
    })
}

pub async fn artist_albums(credit: &MusicArtistRef) -> Result<Vec<MusicAlbumRef>, String> {
    let id = super::numeric_id(&credit.id, "deezer:artist:")?;
    let raw = fetch(&format!(
        "https://api.deezer.com/artist/{id}/albums?limit=50"
    ))
    .await?;
    Ok(unwrap_envelope::<Album>(&raw)?
        .into_iter()
        .filter_map(|mut entry| {
            // This artist-scoped endpoint omits the artist field that chart albums include.
            entry.artist = entry.artist.or_else(|| {
                Some(Artist {
                    id: Some(id),
                    name: Some(credit.name.clone()),
                    picture_big: None,
                    picture_medium: None,
                    position: None,
                })
            });
            album(entry)
        })
        .take(50)
        .collect())
}

pub async fn related_artists(id: &str) -> Result<Vec<MusicArtistRef>, String> {
    let id = super::numeric_id(id, "deezer:artist:")?;
    parse_artists(
        &fetch(&format!(
            "https://api.deezer.com/artist/{id}/related?limit=12"
        ))
        .await?,
        12,
    )
}

async fn fetch(url: &str) -> Result<String, String> {
    Ok(super::http::get(url, "Deezer").await?.text)
}

fn unwrap_envelope<T: serde::de::DeserializeOwned>(body: &str) -> Result<Vec<T>, String> {
    let envelope = serde_json::from_str::<Envelope<T>>(body)
        .map_err(|error| format!("Deezer response was unreadable: {error}"))?;
    if let Some(failure) = envelope.error {
        return Err(failure_message(failure));
    }
    Ok(envelope.data.unwrap_or_default())
}

fn failure_message(failure: Failure) -> String {
    let message = failure
        .message
        .unwrap_or_else(|| "Deezer rejected the request".to_string());
    let code = failure.code.unwrap_or_default();
    format!("Deezer error {code}: {message}")
}

fn parse_albums(body: &str, limit: usize) -> Result<Vec<MusicAlbumRef>, String> {
    Ok(unwrap_envelope::<Album>(body)?
        .into_iter()
        .filter_map(album)
        .take(limit)
        .collect::<Vec<_>>())
}

fn album(entry: Album) -> Option<MusicAlbumRef> {
    let id = entry.id?;
    let title = non_empty(entry.title)?;
    let credit = entry.artist?;
    let artist = non_empty(credit.name)?;
    Some(MusicAlbumRef {
        id: format!("deezer:album:{id}"),
        connector_id: "catalog".to_string(),
        title,
        artist,
        artwork: entry.cover_big.or(entry.cover_medium).unwrap_or_default(),
        year: entry.release_date.as_deref().and_then(release_year),
        track_count: entry.nb_tracks,
        explicit: entry.explicit_lyrics,
    })
}

fn parse_tracks(body: &str, limit: usize) -> Result<Vec<MusicTrack>, String> {
    Ok(unwrap_envelope::<Track>(body)?
        .into_iter()
        .filter_map(track)
        .take(limit)
        .collect::<Vec<_>>())
}

fn track(entry: Track) -> Option<MusicTrack> {
    let id = entry.id?;
    let title = non_empty(entry.title)?;
    let artist = non_empty(entry.artist?.name)?;
    let (album, artwork) = match entry.album {
        Some(release) => (
            non_empty(release.title),
            release
                .cover_xl
                .or(release.cover_big)
                .or(release.cover_medium),
        ),
        None => (None, None),
    };
    let duration_seconds = entry.duration.unwrap_or_default();
    Some(MusicTrack {
        explicit: entry.explicit_lyrics,
        version: entry.title_version,
        media_kind: None,
        id: format!("deezer:track:{id}"),
        connector_id: Some("catalog".to_string()),
        source_id: Some(id.to_string()),
        playback_url: None,
        title,
        artist,
        album,
        artwork: artwork.unwrap_or_default(),
        duration_seconds,
        duration_label: duration_label(duration_seconds),
    })
}

fn parse_artists(body: &str, limit: usize) -> Result<Vec<MusicArtistRef>, String> {
    Ok(unwrap_envelope::<Artist>(body)?
        .into_iter()
        .filter_map(artist)
        .take(limit)
        .collect::<Vec<_>>())
}

fn artist(entry: Artist) -> Option<MusicArtistRef> {
    let id = entry.id?;
    let name = non_empty(entry.name)?;
    Some(MusicArtistRef {
        id: format!("deezer:artist:{id}"),
        connector_id: "catalog".to_string(),
        name,
        artwork: entry.picture_big.or(entry.picture_medium),
        subtitle: entry.position.map(|position| format!("#{position}")),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn future() -> MusicArtistRef {
        MusicArtistRef {
            id: "deezer:artist:165930".into(),
            connector_id: "catalog".into(),
            name: "Future".into(),
            artwork: None,
            subtitle: None,
        }
    }

    #[tokio::test]
    async fn playlist_tracks_follow_every_page_past_the_400_track_embedded_excerpt() {
        let mut urls = Vec::new();
        let tracks = complete_playlist_tracks(6399367984, |url| {
            let start = urls.len() * 100;
            let count = (476 - start).min(100);
            let mut page: serde_json::Value =
                serde_json::from_str(&track_page(start, count)).unwrap();
            page["total"] = serde_json::json!(476);
            urls.push(url);
            std::future::ready(Ok(page.to_string()))
        })
        .await
        .unwrap();
        assert_eq!(tracks.len(), 476);
        assert_eq!(urls.len(), 5);
        assert_eq!(
            urls[4],
            "https://api.deezer.com/playlist/6399367984/tracks?limit=100&index=400"
        );
        assert_eq!(tracks[475].title, "Movement 475");
        assert!(tracks.iter().all(|track| track.playback_url.is_none()));
    }

    #[tokio::test]
    async fn failed_playlist_continuation_does_not_return_partial_tracks() {
        let mut calls = 0;
        let result = complete_playlist_tracks(42, |_| {
            calls += 1;
            std::future::ready(if calls == 1 {
                let mut page: serde_json::Value =
                    serde_json::from_str(&track_page(0, 100)).unwrap();
                page["total"] = serde_json::json!(476);
                Ok(page.to_string())
            } else {
                Err("offline".into())
            })
        })
        .await;
        assert!(result.is_err());
        assert_eq!(calls, 2);
    }

    #[test]
    fn artist_release_pages_preserve_all_133_provider_releases_and_finish() {
        let artist = future();
        let mut cursor = None;
        let mut ids = Vec::new();
        for (offset, count) in [(0, 50), (50, 50), (100, 33)] {
            assert_eq!(
                super::super::page_offset(&artist, MusicCatalogKind::Albums, cursor.as_deref())
                    .unwrap(),
                offset
            );
            let raw = serde_json::json!({"total":133,"data":(offset..offset+count).map(|id|
                serde_json::json!({"id":id+1,"title":format!("Release {id}"),"release_date":"2026-01-01"})
            ).collect::<Vec<_>>()});
            let page =
                parse_artist_page(&raw.to_string(), &artist, MusicCatalogKind::Albums, offset)
                    .unwrap();
            assert_eq!(page.items.len(), count as usize);
            assert_eq!(page.total, Some(133));
            assert_eq!(page.scope, MusicCatalogScope::Catalog);
            for item in page.items {
                let MusicCatalogItem::Album(album) = item else {
                    panic!("album")
                };
                assert_eq!(album.artist, "Future");
                ids.push(album.id);
            }
            cursor = page.next_cursor;
        }
        assert!(cursor.is_none());
        assert_eq!(ids.len(), 133);
        assert_eq!(ids[132], "deezer:album:133");
    }

    #[test]
    fn popular_tracks_are_not_mislabeled_as_a_complete_catalog() {
        let mut raw: serde_json::Value = serde_json::from_str(&track_page(50, 50)).unwrap();
        raw["total"] = serde_json::json!(100);
        let page =
            parse_artist_page(&raw.to_string(), &future(), MusicCatalogKind::Tracks, 50).unwrap();
        assert_eq!(page.items.len(), 50);
        assert_eq!(page.scope, MusicCatalogScope::Top);
        assert!(page.next_cursor.is_none());
    }

    #[test]
    fn empty_or_malformed_catalog_pages_do_not_claim_completion() {
        for raw in [
            r#"{"data":[],"total":133}"#,
            r#"{"data":[{"id":42}],"total":1}"#,
            "{}",
        ] {
            assert!(parse_artist_page(raw, &future(), MusicCatalogKind::Albums, 0).is_err());
        }
        let page = parse_artist_page(
            r#"{"data":[],"total":0}"#,
            &future(),
            MusicCatalogKind::Albums,
            0,
        )
        .unwrap();
        assert!(page.next_cursor.is_none());
    }

    fn album_fixture(count: usize) -> String {
        serde_json::json!({"id": 42, "title": "Complete Works", "nb_tracks": count,
            "cover_big": "https://cdn.test/album.jpg", "tracks": {"data": []}})
        .to_string()
    }

    fn track_page(start: usize, count: usize) -> String {
        serde_json::json!({"data": (start..start + count).map(|index|
            serde_json::json!({"id": index + 1, "title": format!("Movement {index}"),
                "duration": 120, "artist": {"name": "Orchestra"}})
        ).collect::<Vec<_>>()})
        .to_string()
    }

    #[tokio::test]
    async fn long_albums_load_every_page_in_order_with_album_artwork() {
        let mut urls = Vec::new();
        let tracks = complete_album_tracks(42, &album_fixture(191), |url| {
            let body = if urls.is_empty() {
                track_page(0, 100)
            } else {
                track_page(100, 91)
            };
            urls.push(url);
            std::future::ready(Ok(body))
        })
        .await
        .expect("complete album");
        assert_eq!(
            urls,
            vec![
                "https://api.deezer.com/album/42/tracks?limit=100&index=0",
                "https://api.deezer.com/album/42/tracks?limit=100&index=100"
            ]
        );
        assert_eq!(tracks.len(), 191);
        assert_eq!(tracks[190].title, "Movement 190");
        assert!(tracks
            .iter()
            .all(|track| track.album.as_deref() == Some("Complete Works")
                && track.artwork == "https://cdn.test/album.jpg"
                && track.playback_url.is_none()));
    }

    #[tokio::test]
    async fn failed_or_empty_later_pages_do_not_publish_partial_albums() {
        for failure in [Ok("{\"data\":[]}".to_string()), Err("offline".to_string())] {
            let mut calls = 0;
            let result = complete_album_tracks(42, &album_fixture(191), |_| {
                calls += 1;
                std::future::ready(if calls == 1 {
                    Ok(track_page(0, 100))
                } else {
                    failure.clone()
                })
            })
            .await;
            assert!(result.is_err());
            assert_eq!(calls, 2);
        }
    }

    #[tokio::test]
    async fn complete_embedded_albums_need_no_additional_requests() {
        let mut value: serde_json::Value = serde_json::from_str(&album_fixture(2)).unwrap();
        value["tracks"] = serde_json::from_str(&track_page(0, 2)).unwrap();
        let tracks = complete_album_tracks(42, &value.to_string(), |_| {
            panic!("a complete album must not refetch tracks");
            #[allow(unreachable_code)]
            std::future::ready(Err("unexpected request".to_string()))
        })
        .await
        .unwrap();
        assert_eq!(tracks.len(), 2);
    }

    #[test]
    fn chart_albums_keep_the_cover_and_the_credited_artist() {
        let body = r#"{
          "data": [
            {
              "id": 764207481,
              "title": "Un Verano Sin Ti",
              "cover_medium": "https://cdn.test/250.jpg",
              "cover_big": "https://cdn.test/500.jpg",
              "release_date": "2022-05-06",
              "nb_tracks": 23,
              "position": 1,
              "artist": { "id": 1287205, "name": "Bad Bunny" }
            },
            { "id": 2, "title": "No Artist" }
          ],
          "total": 2
        }"#;
        let albums = parse_albums(body, 10).expect("albums");
        assert_eq!(albums.len(), 1);
        assert_eq!(albums[0].id, "deezer:album:764207481");
        assert_eq!(albums[0].artist, "Bad Bunny");
        assert_eq!(albums[0].artwork, "https://cdn.test/500.jpg");
        assert_eq!(albums[0].year, Some(2022));
        assert_eq!(albums[0].track_count, Some(23));
    }

    #[test]
    fn chart_artists_carry_their_chart_position() {
        let body = r#"{
          "data": [
            {
              "id": 2056,
              "name": "Radiohead",
              "picture_medium": "https://cdn.test/250.jpg",
              "picture_big": "https://cdn.test/500.jpg",
              "position": 3
            }
          ]
        }"#;
        let artists = parse_artists(body, 10).expect("artists");
        assert_eq!(artists[0].id, "deezer:artist:2056");
        assert_eq!(artists[0].subtitle.as_deref(), Some("#3"));
        assert_eq!(
            artists[0].artwork.as_deref(),
            Some("https://cdn.test/500.jpg")
        );
    }

    const CHART_TRACK_BODY: &str = r#"{
      "data": [
        {
          "id": 3325742781,
          "title": "Dracula (with JENNIE)",
          "title_short": "Dracula",
          "duration": 209,
          "rank": 968871,
          "explicit_lyrics": false,
          "preview": "https://cdnt-preview.dzcdn.net/api/1/1/expiring.mp3?hdnea=exp=1756900000",
          "position": 1,
          "artist": { "id": 585536, "name": "Tame Impala" },
          "album": {
            "id": 799140901,
            "title": "Deadbeat",
            "cover_medium": "https://cdn.test/250.jpg",
            "cover_big": "https://cdn.test/500.jpg",
            "cover_xl": "https://cdn.test/1000.jpg"
          }
        },
        {
          "id": 2450967,
          "title": "Coverless",
          "duration": 65,
          "artist": { "id": 27, "name": "Daft Punk" },
          "album": { "id": 302127, "title": "Discovery" }
        },
        { "id": 9, "title": "No Artist", "duration": 100 }
      ],
      "total": 3
    }"#;

    #[test]
    fn chart_tracks_map_the_credit_the_album_and_the_duration() {
        let tracks = parse_tracks(CHART_TRACK_BODY, 10).expect("tracks");
        assert_eq!(tracks.len(), 2);
        assert_eq!(tracks[0].id, "deezer:track:3325742781");
        assert_eq!(tracks[0].connector_id.as_deref(), Some("catalog"));
        assert_eq!(tracks[0].source_id.as_deref(), Some("3325742781"));
        assert_eq!(tracks[0].title, "Dracula (with JENNIE)");
        assert_eq!(tracks[0].artist, "Tame Impala");
        assert_eq!(tracks[0].album.as_deref(), Some("Deadbeat"));
        assert_eq!(tracks[0].artwork, "https://cdn.test/1000.jpg");
        assert_eq!(tracks[0].duration_seconds, 209);
        assert_eq!(tracks[0].duration_label, "3:29");
    }

    #[test]
    fn a_track_without_album_artwork_still_reaches_the_row() {
        let tracks = parse_tracks(CHART_TRACK_BODY, 10).expect("tracks");
        assert_eq!(tracks[1].id, "deezer:track:2450967");
        assert_eq!(tracks[1].album.as_deref(), Some("Discovery"));
        assert!(tracks[1].artwork.is_empty());
        assert_eq!(tracks[1].duration_label, "1:05");
    }

    #[test]
    fn a_deezer_preview_clip_never_becomes_a_playback_url() {
        let tracks = parse_tracks(CHART_TRACK_BODY, 10).expect("tracks");
        assert!(tracks.iter().all(|track| track.playback_url.is_none()));
    }

    #[test]
    fn an_error_body_arriving_with_http_200_is_still_an_error() {
        let body = r#"{"error":{"type":"Exception","code":4,"message":"Quota limit exceeded"}}"#;
        let error = parse_albums(body, 10).expect_err("quota error");
        assert_eq!(error, "Deezer error 4: Quota limit exceeded");
    }

    #[test]
    fn a_missing_data_array_reads_as_an_empty_row() {
        assert!(parse_artists("{}", 10).expect("empty").is_empty());
        assert!(parse_albums("not json", 10).is_err());
    }
}
