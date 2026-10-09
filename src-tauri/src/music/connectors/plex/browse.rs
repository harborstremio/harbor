use super::client;
use super::parse::{self, container, nodes, text};
use super::session::PlexConfig;
use crate::music::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogRow, MusicPlaylistRef,
    MusicSearchResults, MusicStationRef, MusicStream, MusicTrack,
};
use serde_json::Value;
use std::time::Duration;

const BROWSE_TIMEOUT: Duration = Duration::from_secs(8);
const ITEM_TIMEOUT: Duration = Duration::from_secs(12);
const MAX_ROWS: usize = 8;
const MAX_TRACKS: usize = 200;

async fn get(config: &PlexConfig, path: &str, timeout: Duration) -> Result<Value, String> {
    client::get_json(
        &config.origin,
        path,
        &config.client_id,
        Some(&config.token),
        timeout,
    )
    .await
}

fn track_key(track: &MusicTrack) -> Result<String, String> {
    let raw = track
        .source_id
        .as_deref()
        .or_else(|| track.id.strip_prefix("plex:"))
        .unwrap_or_default();
    client::safe_key(raw)
}

pub async fn hubs(config: &PlexConfig) -> Result<Vec<MusicCatalogRow>, String> {
    let section = client::safe_key(&config.section)?;
    let body = get(
        config,
        &format!("/hubs/sections/{section}?count=12&includeStations=1&excludeFields=summary"),
        BROWSE_TIMEOUT,
    )
    .await?;
    Ok(nodes(container(&body), "Hub")
        .iter()
        .filter_map(|hub| parse::hub_row(config, hub))
        .take(MAX_ROWS)
        .collect())
}

pub async fn search(
    config: &PlexConfig,
    query: &str,
    limit: usize,
) -> Result<MusicSearchResults, String> {
    let section = client::safe_key(&config.section)?;
    let body = get(
        config,
        &format!(
            "/hubs/search?query={}&limit={limit}&sectionId={section}&includeCollections=0&includeExternalMedia=0",
            client::encode(query)
        ),
        ITEM_TIMEOUT,
    )
    .await?;
    let mut results = MusicSearchResults::default();
    for hub in nodes(container(&body), "Hub") {
        let items = nodes(hub, "Metadata")
            .iter()
            .chain(nodes(hub, "Directory").iter())
            .take(limit);
        match text(hub, "type").unwrap_or_default().as_str() {
            "track" => results
                .tracks
                .extend(items.filter_map(|node| parse::track(config, node))),
            "album" => results
                .albums
                .extend(items.filter_map(|node| parse::album(config, node))),
            "artist" => results
                .artists
                .extend(items.filter_map(|node| parse::artist(config, node))),
            "playlist" => results
                .playlists
                .extend(items.filter_map(|node| parse::playlist(config, node))),
            _ => {}
        }
    }
    let top = top_result(&results);
    results.top = top;
    Ok(results)
}

fn top_result(results: &MusicSearchResults) -> Option<MusicCatalogItem> {
    results
        .artists
        .first()
        .cloned()
        .map(MusicCatalogItem::Artist)
        .or_else(|| results.tracks.first().cloned().map(MusicCatalogItem::Track))
        .or_else(|| results.albums.first().cloned().map(MusicCatalogItem::Album))
        .or_else(|| {
            results
                .playlists
                .first()
                .cloned()
                .map(MusicCatalogItem::Playlist)
        })
}

pub async fn album_tracks(
    config: &PlexConfig,
    album: &MusicAlbumRef,
) -> Result<Vec<MusicTrack>, String> {
    let key = client::safe_key(&album.id)?;
    let body = get(
        config,
        &format!("/library/metadata/{key}/children"),
        ITEM_TIMEOUT,
    )
    .await?;
    Ok(parse::tracks(config, &body))
}

pub async fn artist_top(
    config: &PlexConfig,
    artist: &MusicArtistRef,
) -> Result<Vec<MusicTrack>, String> {
    let key = client::safe_key(&artist.id)?;
    let section = client::safe_key(&config.section)?;
    let body = get(
        config,
        &format!(
            "/library/sections/{section}/all?type=10&artist.id={key}&sort=ratingCount:desc&group=title&limit=50"
        ),
        ITEM_TIMEOUT,
    )
    .await?;
    let popular = parse::tracks(config, &body);
    if !popular.is_empty() {
        return Ok(popular);
    }
    let body = get(
        config,
        &format!(
            "/library/metadata/{key}/allLeaves?X-Plex-Container-Start=0&X-Plex-Container-Size=50"
        ),
        ITEM_TIMEOUT,
    )
    .await?;
    Ok(parse::tracks(config, &body))
}

pub async fn playlist_tracks(
    config: &PlexConfig,
    playlist: &MusicPlaylistRef,
) -> Result<Vec<MusicTrack>, String> {
    let key = client::safe_key(&playlist.id)?;
    let body = get(
        config,
        &format!("/playlists/{key}/items?type=10&X-Plex-Container-Start=0&X-Plex-Container-Size={MAX_TRACKS}"),
        ITEM_TIMEOUT,
    )
    .await?;
    Ok(parse::tracks(config, &body))
}

pub async fn station_tracks(
    config: &PlexConfig,
    station: &MusicStationRef,
) -> Result<Vec<MusicTrack>, String> {
    let path = if station.id.starts_with('/') {
        client::safe_path(&station.id)?
    } else {
        format!(
            "/playlists/{}/items?type=10",
            client::safe_key(&station.id)?
        )
    };
    let body = get(config, &path, ITEM_TIMEOUT).await?;
    Ok(parse::tracks(config, &body))
}

pub async fn resolve(config: &PlexConfig, track: &MusicTrack) -> Result<MusicStream, String> {
    let key = track_key(track)?;
    let body = get(config, &format!("/library/metadata/{key}"), ITEM_TIMEOUT).await?;
    if let Some(part) = parse::part(&body) {
        if let Ok(url) = client::direct_stream_url(&config.origin, &config.token, &part.key) {
            return Ok(MusicStream {
                http_headers: Default::default(),
                url,
                mime_type: client::mime_for(part.container.as_deref(), part.codec.as_deref()),
                bitrate: part.bitrate,
            });
        }
    }
    Ok(MusicStream {
        http_headers: Default::default(),
        url: client::transcode_stream_url(&config.origin, &config.token, &config.client_id, &key),
        mime_type: "audio/mpeg".to_string(),
        bitrate: 320,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn track(id: &str, source: Option<&str>) -> MusicTrack {
        MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: id.to_string(),
            connector_id: Some("plex".to_string()),
            source_id: source.map(str::to_string),
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
    fn track_keys_prefer_the_source_id_then_the_prefixed_id() {
        assert_eq!(
            track_key(&track("plex:1", Some("46618"))),
            Ok("46618".to_string())
        );
        assert_eq!(track_key(&track("plex:9912", None)), Ok("9912".to_string()));
        assert!(track_key(&track("soundcloud:x", None)).is_err());
        assert!(track_key(&track("plex:1/2", None)).is_err());
    }

    #[test]
    fn the_top_result_prefers_an_artist_over_a_track() {
        let mut results = MusicSearchResults {
            tracks: vec![track("plex:1", Some("1"))],
            ..MusicSearchResults::default()
        };
        assert!(matches!(
            top_result(&results),
            Some(MusicCatalogItem::Track(_))
        ));
        results.artists.push(MusicArtistRef {
            id: "5".to_string(),
            connector_id: "plex".to_string(),
            name: "Muse".to_string(),
            artwork: None,
            subtitle: None,
        });
        assert!(matches!(
            top_result(&results),
            Some(MusicCatalogItem::Artist(_))
        ));
        assert!(top_result(&MusicSearchResults::default()).is_none());
    }

    #[test]
    fn station_paths_accept_server_keys_and_reject_traversal() {
        let station = |id: &str| MusicStationRef {
            id: id.to_string(),
            connector_id: "plex".to_string(),
            name: "Muse Radio".to_string(),
            artwork: String::new(),
            subtitle: None,
        };
        assert!(client::safe_path(&station("/library/metadata/5/station/2").id).is_ok());
        assert!(client::safe_path(&station("/library/../secrets").id).is_err());
        assert!(client::safe_key(&station("77").id).is_ok());
    }
}
