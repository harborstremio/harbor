mod artist;
mod catalog;
#[cfg(test)]
mod clients;
mod fields;
mod innertube;
mod items;
mod parse;
#[cfg(test)]
mod player;
mod rows;
mod ytdlp;
mod ytdlp_update;
mod video_page;

use super::super::connector::{ConnectorHealth, HealthCell, MusicConnector};
use super::super::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogKind, MusicCatalogPage,
    MusicCatalogRow, MusicConnection, MusicPlaylistRef, MusicSearchResults, MusicStationRef,
    MusicStream, MusicTrack, MusicVideoStream,
};
use async_trait::async_trait;

pub struct YouTubeMusicConnector {
    health: HealthCell,
    client: innertube::Client,
}

impl YouTubeMusicConnector {
    pub fn new() -> Self {
        Self {
            health: HealthCell::new(),
            client: innertube::Client::new(),
        }
    }

    fn record<T>(&self, result: &Result<T, String>) {
        self.health.set(match result {
            Ok(_) => ConnectorHealth::Healthy,
            Err(error) => classify_error(error),
        });
    }
}

#[async_trait]
impl MusicConnector for YouTubeMusicConnector {
    fn id(&self) -> &str {
        "youtube"
    }

    fn name(&self) -> &str {
        "YouTube Music"
    }

    async fn search(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = catalog::songs(&self.client, app, query, limit).await;
        self.record(&result);
        result
    }

    async fn search_videos(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
        interviews: bool,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = if interviews { ytdlp::search_interviews(app, query, limit).await } else { catalog::videos(&self.client, app, query, limit, false).await };
        self.record(&result);
        result
    }

    async fn search_video_page(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        regular: bool,
        cursor: Option<&str>,
    ) -> Result<crate::music::MusicVideoPage, String> {
        let result = video_page::search(&self.client, app, query, regular, cursor).await;
        self.record(&result);
        result
    }

    async fn search_typed(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<MusicSearchResults, String> {
        let (tracks, albums, artists, playlists) = tokio::join!(
            catalog::songs(&self.client, app, query, limit),
            catalog::albums(&self.client, app, query, limit),
            catalog::artists(&self.client, app, query, limit),
            catalog::playlists(&self.client, app, query, limit)
        );
        self.record(&tracks);
        let tracks = tracks?;
        let albums = albums.unwrap_or_default();
        let artists = artists.unwrap_or_default();
        let playlists = playlists.unwrap_or_default();
        let top = tracks
            .first()
            .cloned()
            .map(MusicCatalogItem::Track)
            .or_else(|| albums.first().cloned().map(MusicCatalogItem::Album))
            .or_else(|| artists.first().cloned().map(MusicCatalogItem::Artist));
        Ok(MusicSearchResults {
            top,
            tracks,
            albums,
            artists,
            playlists,
        })
    }

    async fn browse_home(&self, app: &tauri::AppHandle) -> Result<Vec<MusicCatalogRow>, String> {
        let (home, charts) = tokio::join!(
            catalog::home_rows(&self.client, app),
            catalog::chart_rows(&self.client, app)
        );
        self.record(&home);
        let mut rows = home?;
        if let Ok(charts) = charts {
            rows.extend(charts);
        }
        Ok(rows)
    }

    async fn album_tracks(
        &self,
        app: &tauri::AppHandle,
        album: &MusicAlbumRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = catalog::album_tracks(&self.client, app, album).await;
        self.record(&result);
        result
    }

    async fn artist_top(
        &self,
        app: &tauri::AppHandle,
        artist: &MusicArtistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = catalog::artist_top(&self.client, app, artist).await;
        self.record(&result);
        result
    }

    async fn artist_catalog(
        &self,
        app: &tauri::AppHandle,
        artist: &MusicArtistRef,
        kind: MusicCatalogKind,
        cursor: Option<&str>,
    ) -> Result<MusicCatalogPage, String> {
        let result = artist::catalog(&self.client, app, artist, kind, cursor).await;
        self.record(&result);
        result
    }

    async fn playlist_tracks(
        &self,
        app: &tauri::AppHandle,
        playlist: &MusicPlaylistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = catalog::playlist_tracks(&self.client, app, playlist).await;
        self.record(&result);
        result
    }

    async fn station_tracks(
        &self,
        app: &tauri::AppHandle,
        station: &MusicStationRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = catalog::station_tracks(&self.client, app, station).await;
        self.record(&result);
        result
    }

    async fn resolve(
        &self,
        app: &tauri::AppHandle,
        track: &MusicTrack,
    ) -> Result<MusicStream, String> {
        let result = catalog::stream(app, track).await;
        self.record(&result);
        result
    }

    async fn resolve_video(
        &self,
        app: &tauri::AppHandle,
        track: &MusicTrack,
    ) -> Result<MusicVideoStream, String> {
        catalog::video_stream(app, track).await
    }

    fn set_health(&self, health: ConnectorHealth) {
        self.health.set(health);
    }

    fn health(&self) -> ConnectorHealth {
        self.health.get()
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
            "youtube",
            "YouTube Music",
            "streaming",
            status,
            &["search", "browse", "play"],
        )
        .anonymous()
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

    #[test]
    fn network_failures_take_the_connector_offline_and_others_degrade_it() {
        assert_eq!(
            classify_error("YouTube Music request failed: operation timed out"),
            ConnectorHealth::Offline
        );
        assert_eq!(
            classify_error("YouTube Music returned HTTP 400"),
            ConnectorHealth::Degraded
        );
    }

    #[test]
    fn the_connector_reports_browsing_alongside_search_and_playback() {
        let connection = YouTubeMusicConnector::new().connection();
        assert_eq!(connection.id, "youtube");
        assert_eq!(connection.kind, "streaming");
        assert_eq!(connection.status, "connected");
        assert_eq!(connection.capabilities, vec!["search", "browse", "play"]);
        assert!(connection.needs.is_empty());
    }
}
