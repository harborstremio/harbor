mod coverart;
mod deezer;
mod http;
mod itunes;
mod listenbrainz;
mod musicbrainz;

use super::super::connector::{ConnectorHealth, HealthCell, MusicConnector};
use super::super::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogKind, MusicCatalogPage,
    MusicCatalogRow, MusicConnection, MusicPlaylistRef, MusicRowLayout, MusicSearchResults,
    MusicStream, MusicTrack,
};
use async_trait::async_trait;
use std::future::Future;
use std::time::Duration;

const PROVIDER_TIMEOUT: Duration = Duration::from_secs(10);
const ROW_LIMIT: usize = 20;

pub struct CatalogConnector {
    health: HealthCell,
}

impl CatalogConnector {
    pub fn new() -> Self {
        Self {
            health: HealthCell::new(),
        }
    }

    fn record<T>(&self, result: &Result<T, String>) {
        self.health.set(match result {
            Ok(_) => ConnectorHealth::Healthy,
            Err(error) => classify_error(error),
        });
    }
}

impl Default for CatalogConnector {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MusicConnector for CatalogConnector {
    fn id(&self) -> &str {
        "catalog"
    }

    fn name(&self) -> &str {
        "Open catalog"
    }

    async fn search(
        &self,
        _app: &tauri::AppHandle,
        _query: &str,
        _limit: usize,
    ) -> Result<Vec<MusicTrack>, String> {
        Ok(Vec::new())
    }

    async fn resolve(
        &self,
        _app: &tauri::AppHandle,
        _track: &MusicTrack,
    ) -> Result<MusicStream, String> {
        Err(self.unsupported("playback"))
    }

    async fn browse_home(&self, _app: &tauri::AppHandle) -> Result<Vec<MusicCatalogRow>, String> {
        let result = home_rows().await;
        self.record(&result);
        result
    }

    async fn search_typed(
        &self,
        _app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<MusicSearchResults, String> {
        let result = search_catalog(query, limit).await;
        self.record(&result);
        result
    }

    async fn album_tracks(
        &self,
        _app: &tauri::AppHandle,
        album: &MusicAlbumRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = if album.id.starts_with("deezer:album:") {
            settle("Deezer", deezer::album_tracks(&album.id)).await
        } else if album.id.starts_with("itunes:album:") {
            settle("iTunes", itunes::tracks(&album.id, "itunes:album:")).await
        } else if album.id.starts_with("musicbrainz:") {
            settle("MusicBrainz", musicbrainz::album_tracks(album)).await
        } else {
            Err("This catalog has not supplied a track list for this release".into())
        };
        self.record(&result);
        result
    }

    async fn artist_top(
        &self,
        _app: &tauri::AppHandle,
        artist: &MusicArtistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = if artist.id.starts_with("deezer:artist:") {
            settle("Deezer", deezer::artist_top(&artist.id)).await
        } else if artist.id.starts_with("itunes:artist:") {
            settle("iTunes", itunes::tracks(&artist.id, "itunes:artist:")).await
        } else if artist.id.starts_with("musicbrainz:artist:") {
            settle("MusicBrainz", musicbrainz::artist_tracks(artist)).await
        } else {
            Err("This catalog has not supplied tracks for this artist".into())
        };
        self.record(&result);
        result
    }

    async fn playlist_tracks(
        &self,
        _app: &tauri::AppHandle,
        playlist: &MusicPlaylistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        if !playlist.id.starts_with("deezer:playlist:") {
            return Err(self.unsupported("playlists"));
        }
        let result = tokio::time::timeout(
            Duration::from_secs(25),
            deezer::playlist_tracks(&playlist.id),
        )
        .await
        .map_err(|_| "Deezer playlist timed out".to_string())?;
        self.record(&result);
        result
    }

    async fn artist_rows(
        &self,
        _app: &tauri::AppHandle,
        artist: &MusicArtistRef,
    ) -> Result<Vec<MusicCatalogRow>, String> {
        let mut rows = Vec::new();
        if artist.id.starts_with("deezer:artist:") {
            let (albums, related) = tokio::join!(
                settle("Deezer", deezer::artist_albums(artist)),
                settle("Deezer", deezer::related_artists(&artist.id)),
            );
            if albums.is_err() && related.is_err() {
                return Err("Artist discovery could not load from Deezer".into());
            }
            if let Ok(albums) = albums {
                if !albums.is_empty() {
                    rows.push(covers(
                        "artist:albums",
                        "music.search.albums",
                        false,
                        "Deezer",
                        albums,
                    ));
                }
            }
            if let Ok(artists) = related {
                if !artists.is_empty() {
                    let mut row = circles("artist:related", "Deezer", artists);
                    row.title = "music.detail.relatedArtists".into();
                    row.title_literal = false;
                    rows.push(row);
                }
            }
        } else if artist.id.starts_with("itunes:artist:") {
            let albums = settle("iTunes", itunes::artist_albums(&artist.id)).await?;
            if !albums.is_empty() {
                rows.push(covers(
                    "artist:albums",
                    "music.search.albums",
                    false,
                    "Apple Music",
                    albums,
                ));
            }
        }
        if artist.id.starts_with("musicbrainz:artist:") {
            let albums = settle("MusicBrainz", musicbrainz::artist_albums(artist)).await?;
            if !albums.is_empty() {
                rows.push(covers(
                    "artist:albums",
                    "music.search.albums",
                    false,
                    "MusicBrainz",
                    albums,
                ));
            }
        }
        Ok(rows)
    }

    async fn artist_catalog(
        &self,
        app: &tauri::AppHandle,
        artist: &MusicArtistRef,
        kind: MusicCatalogKind,
        cursor: Option<&str>,
    ) -> Result<MusicCatalogPage, String> {
        let result = if artist.id.starts_with("deezer:artist:") {
            settle("Deezer", deezer::artist_catalog(artist, kind, cursor)).await
        } else if artist.id.starts_with("musicbrainz:artist:") {
            settle(
                "MusicBrainz",
                musicbrainz::artist_catalog(artist, kind, cursor),
            )
            .await
        } else {
            if cursor.is_some() {
                return Err(self.unsupported("artist pagination"));
            }
            let items = match kind {
                MusicCatalogKind::Tracks => self
                    .artist_top(app, artist)
                    .await?
                    .into_iter()
                    .map(MusicCatalogItem::Track)
                    .collect(),
                MusicCatalogKind::Albums => self
                    .artist_rows(app, artist)
                    .await?
                    .into_iter()
                    .flat_map(|row| row.items)
                    .collect(),
            };
            Ok(MusicCatalogPage {
                items,
                next_cursor: None,
                total: None,
                scope: crate::music::MusicCatalogScope::Limited,
            })
        };
        self.record(&result);
        result
    }

    fn set_health(&self, health: ConnectorHealth) {
        self.health.set(health);
    }

    fn health(&self) -> ConnectorHealth {
        self.health.get()
    }

    fn playable(&self) -> bool {
        false
    }

    fn browsable(&self) -> bool {
        true
    }

    fn connection(&self) -> MusicConnection {
        let status = match self.health() {
            ConnectorHealth::Offline => "error",
            _ => "connected",
        };
        MusicConnection::new(
            "catalog",
            "Open catalog",
            "catalog",
            status,
            &["search", "browse"],
        )
        .anonymous()
    }
}

async fn home_rows() -> Result<Vec<MusicCatalogRow>, String> {
    let (releases, chart_tracks, chart_albums, chart_artists, editorial, popular) = tokio::join!(
        settle("ListenBrainz", listenbrainz::fresh_releases(ROW_LIMIT)),
        settle("Deezer", deezer::chart_tracks(ROW_LIMIT)),
        settle("Deezer", deezer::chart_albums(ROW_LIMIT)),
        settle("Deezer", deezer::chart_artists(ROW_LIMIT)),
        settle("Deezer", deezer::editorial_selection(ROW_LIMIT)),
        settle("ListenBrainz", listenbrainz::top_artists(ROW_LIMIT)),
    );

    let mut rows = Vec::new();
    let mut failures = Vec::new();

    match releases {
        Ok(albums) if !albums.is_empty() => rows.push(covers(
            "catalog:new-releases",
            "music.row.newReleases",
            false,
            "Fresh releases from ListenBrainz",
            albums,
        )),
        Ok(_) => {}
        Err(error) => failures.push(error),
    }

    match chart_tracks {
        Ok(tracks) if !tracks.is_empty() => rows.push(track_grid(
            "catalog:charts:tracks",
            "Track chart from Deezer",
            tracks,
        )),
        Ok(_) => {}
        Err(error) => failures.push(error),
    }

    match chart_albums {
        Ok(albums) if !albums.is_empty() => rows.push(covers(
            "catalog:charts",
            "music.row.charts",
            false,
            "Album chart from Deezer",
            albums,
        )),
        Ok(_) => {}
        Err(error) => failures.push(error),
    }

    match chart_artists {
        Ok(artists) if !artists.is_empty() => rows.push(circles(
            "catalog:charting-artists",
            "Artist chart from Deezer",
            artists,
        )),
        chart => {
            if let Err(error) = chart {
                failures.push(error);
            }
            match popular {
                Ok(artists) if !artists.is_empty() => rows.push(circles(
                    "catalog:charting-artists",
                    "Most played on ListenBrainz this month",
                    artists,
                )),
                Ok(_) => {}
                Err(error) => failures.push(error),
            }
        }
    }

    match editorial {
        Ok(albums) if !albums.is_empty() => rows.push(covers(
            "catalog:editorial",
            "Editorial selection",
            true,
            "Selected by the Deezer editors",
            albums,
        )),
        Ok(_) => {}
        Err(error) => failures.push(error),
    }

    if rows.is_empty() {
        failures.sort();
        failures.dedup();
        return Err(if failures.is_empty() {
            "The open catalog has nothing to show right now".to_string()
        } else {
            failures.join("; ")
        });
    }
    Ok(rows)
}

async fn search_catalog(query: &str, limit: usize) -> Result<MusicSearchResults, String> {
    let (albums, artists, tracks) = tokio::join!(
        settle("iTunes", itunes::albums(query, limit)),
        settle("Deezer", deezer::search_artists(query, limit)),
        settle("iTunes", itunes::songs(query, limit)),
    );
    let artists = match artists {
        Ok(artists) if !artists.is_empty() => Ok(artists),
        _ => settle("iTunes", itunes::artists(query, limit)).await,
    };
    if let (Err(albums), Err(artists), Err(tracks)) = (&albums, &artists, &tracks) {
        return Err(format!("{albums}; {artists}; {tracks}"));
    }
    Ok(MusicSearchResults {
        tracks: tracks.unwrap_or_default(),
        albums: albums.unwrap_or_default(),
        artists: artists.unwrap_or_default(),
        ..MusicSearchResults::default()
    })
}

async fn settle<T>(
    provider: &str,
    request: impl Future<Output = Result<T, String>>,
) -> Result<T, String> {
    match tokio::time::timeout(PROVIDER_TIMEOUT, request).await {
        Ok(result) => result,
        Err(_) => Err(format!("{provider} timed out")),
    }
}

fn covers(
    id: &str,
    title: &str,
    title_literal: bool,
    subtitle: &str,
    albums: Vec<MusicAlbumRef>,
) -> MusicCatalogRow {
    MusicCatalogRow {
        id: id.to_string(),
        title: title.to_string(),
        title_literal,
        subtitle: Some(subtitle.to_string()),
        layout: MusicRowLayout::Covers,
        source: "catalog".to_string(),
        items: albums.into_iter().map(MusicCatalogItem::Album).collect(),
    }
}

fn track_grid(id: &str, subtitle: &str, tracks: Vec<MusicTrack>) -> MusicCatalogRow {
    MusicCatalogRow {
        id: id.to_string(),
        title: "Top tracks".to_string(),
        title_literal: true,
        subtitle: Some(subtitle.to_string()),
        layout: MusicRowLayout::TrackGrid,
        source: "catalog".to_string(),
        items: tracks.into_iter().map(MusicCatalogItem::Track).collect(),
    }
}

fn circles(id: &str, subtitle: &str, artists: Vec<MusicArtistRef>) -> MusicCatalogRow {
    MusicCatalogRow {
        id: id.to_string(),
        title: "Charting artists".to_string(),
        title_literal: true,
        subtitle: Some(subtitle.to_string()),
        layout: MusicRowLayout::Circles,
        source: "catalog".to_string(),
        items: artists.into_iter().map(MusicCatalogItem::Artist).collect(),
    }
}

fn non_empty(value: Option<String>) -> Option<String> {
    let trimmed = value?.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn page_cursor(artist: &MusicArtistRef, kind: MusicCatalogKind, offset: u64) -> String {
    let kind = match kind {
        MusicCatalogKind::Tracks => "tracks",
        MusicCatalogKind::Albums => "albums",
    };
    format!("{}|{}|{kind}|{offset}", artist.connector_id, artist.id)
}

fn page_offset(
    artist: &MusicArtistRef,
    kind: MusicCatalogKind,
    cursor: Option<&str>,
) -> Result<u64, String> {
    let Some(cursor) = cursor else { return Ok(0) };
    let prefix = page_cursor(artist, kind, 0);
    cursor
        .strip_prefix(&prefix[..prefix.len() - 1])
        .filter(|raw| !raw.is_empty() && raw.bytes().all(|byte| byte.is_ascii_digit()))
        .and_then(|raw| raw.parse::<u64>().ok())
        .filter(|offset| *offset <= 1_000_000)
        .ok_or_else(|| {
            "This artist catalog cursor belongs to another collection or is invalid".into()
        })
}

fn numeric_id(value: &str, prefix: &str) -> Result<u64, String> {
    value
        .strip_prefix(prefix)
        .filter(|id| !id.is_empty() && id.bytes().all(|b| b.is_ascii_digit()))
        .and_then(|id| id.parse::<u64>().ok())
        .filter(|id| *id > 0)
        .ok_or_else(|| "Invalid catalog identity".to_string())
}

#[cfg(test)]
mod detail_identity_tests {
    #[test]
    fn artist_cursors_are_bound_to_the_provider_identity_and_collection() {
        let artist = super::MusicArtistRef {
            id: "deezer:artist:165930".into(),
            connector_id: "catalog".into(),
            name: "Future".into(),
            artwork: None,
            subtitle: None,
        };
        let cursor = super::page_cursor(&artist, super::MusicCatalogKind::Albums, 100);
        assert_eq!(
            super::page_offset(&artist, super::MusicCatalogKind::Albums, Some(&cursor)).unwrap(),
            100
        );
        assert!(
            super::page_offset(&artist, super::MusicCatalogKind::Tracks, Some(&cursor)).is_err()
        );
        let other = super::MusicArtistRef {
            id: "deezer:artist:12488330".into(),
            ..artist.clone()
        };
        assert!(
            super::page_offset(&other, super::MusicCatalogKind::Albums, Some(&cursor)).is_err()
        );
        assert!(super::page_offset(
            &artist,
            super::MusicCatalogKind::Albums,
            Some("https://example.test")
        )
        .is_err());
    }

    #[test]
    fn catalog_ids_cannot_change_the_requested_endpoint() {
        assert_eq!(
            super::numeric_id("deezer:album:302127", "deezer:album:").unwrap(),
            302127
        );
        for id in [
            "deezer:artist:27",
            "deezer:album:0",
            "deezer:album:../27",
            "deezer:album:27?limit=1",
            "deezer:album:",
        ] {
            assert!(super::numeric_id(id, "deezer:album:").is_err());
        }
    }
}

fn release_year(value: &str) -> Option<u32> {
    let head = value.trim().get(0..4)?;
    let year = head.parse::<u32>().ok()?;
    if (1000..=3000).contains(&year) {
        Some(year)
    } else {
        None
    }
}

fn classify_error(error: &str) -> ConnectorHealth {
    let lower = error.to_ascii_lowercase();
    if [
        "timed out",
        "timeout",
        "network",
        "connection",
        "dns",
        "resolve host",
        "offline",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
    {
        ConnectorHealth::Offline
    } else {
        ConnectorHealth::Degraded
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn album() -> MusicAlbumRef {
        MusicAlbumRef {
            id: "deezer:album:1".to_string(),
            connector_id: "catalog".to_string(),
            title: "Fragments".to_string(),
            artist: "Bonobo".to_string(),
            artwork: String::new(),
            year: Some(2022),
            track_count: None,
            explicit: None,
        }
    }

    #[test]
    fn rows_name_the_provider_that_produced_them() {
        let row = covers(
            "catalog:charts",
            "music.row.charts",
            false,
            "Album chart from Deezer",
            vec![album()],
        );
        assert_eq!(row.source, "catalog");
        assert!(!row.title_literal);
        assert_eq!(row.subtitle.as_deref(), Some("Album chart from Deezer"));
        assert_eq!(row.layout, MusicRowLayout::Covers);
        assert_eq!(row.items.len(), 1);

        let artists = circles(
            "catalog:charting-artists",
            "Most played on ListenBrainz this month",
            Vec::new(),
        );
        assert!(artists.title_literal);
        assert_eq!(artists.layout, MusicRowLayout::Circles);

        let tracks = track_grid(
            "catalog:charts:tracks",
            "Track chart from Deezer",
            Vec::new(),
        );
        assert_eq!(tracks.id, "catalog:charts:tracks");
        assert_eq!(tracks.title, "Top tracks");
        assert!(tracks.title_literal);
        assert_eq!(tracks.subtitle.as_deref(), Some("Track chart from Deezer"));
        assert_eq!(tracks.layout, MusicRowLayout::TrackGrid);
        assert_eq!(tracks.source, "catalog");
    }

    #[test]
    fn release_years_come_from_the_head_of_a_date() {
        assert_eq!(release_year("1997-05-28T07:00:00Z"), Some(1997));
        assert_eq!(release_year("2026-09-02"), Some(2026));
        assert_eq!(release_year("0000-01-01"), None);
        assert_eq!(release_year(""), None);
        assert_eq!(release_year("soon"), None);
    }

    #[test]
    fn blank_provider_strings_do_not_become_titles() {
        assert_eq!(
            non_empty(Some("  Muse ".to_string())).as_deref(),
            Some("Muse")
        );
        assert_eq!(non_empty(Some("   ".to_string())), None);
        assert_eq!(non_empty(None), None);
    }

    #[test]
    fn transport_failures_take_the_catalog_offline_and_others_degrade_it() {
        assert_eq!(classify_error("Deezer timed out"), ConnectorHealth::Offline);
        assert_eq!(
            classify_error("Deezer error 4: Quota limit exceeded"),
            ConnectorHealth::Degraded
        );
    }
}
