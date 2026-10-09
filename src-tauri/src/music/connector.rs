use super::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogKind, MusicCatalogPage,
    MusicCatalogRow, MusicCatalogScope, MusicConnection, MusicPlaylistRef, MusicSearchResults,
    MusicStationRef, MusicStream, MusicTrack, MusicVideoStream,
};
use async_trait::async_trait;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU8, Ordering};

pub const NO_VIDEO: &str = "This source has no music video";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectorHealth {
    Unknown,
    Healthy,
    Degraded,
    Offline,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectorHealthInfo {
    pub id: String,
    pub name: String,
    pub health: ConnectorHealth,
    pub searchable: bool,
    pub playable: bool,
    pub scrobbler: bool,
}

pub struct HealthCell(AtomicU8);

impl HealthCell {
    pub fn new() -> Self {
        Self(AtomicU8::new(0))
    }

    pub fn get(&self) -> ConnectorHealth {
        match self.0.load(Ordering::Relaxed) {
            1 => ConnectorHealth::Healthy,
            2 => ConnectorHealth::Degraded,
            3 => ConnectorHealth::Offline,
            _ => ConnectorHealth::Unknown,
        }
    }

    pub fn set(&self, health: ConnectorHealth) {
        self.0.store(
            match health {
                ConnectorHealth::Unknown => 0,
                ConnectorHealth::Healthy => 1,
                ConnectorHealth::Degraded => 2,
                ConnectorHealth::Offline => 3,
            },
            Ordering::Relaxed,
        );
    }
}

impl Default for HealthCell {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
pub trait MusicConnector: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;

    async fn search(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<MusicTrack>, String>;

    async fn resolve(
        &self,
        app: &tauri::AppHandle,
        track: &MusicTrack,
    ) -> Result<MusicStream, String>;

    /// The track's music video, where the source has one. Most sources carry audio only, so
    /// the default answer is no video rather than every connector restating it.
    async fn resolve_video(
        &self,
        _app: &tauri::AppHandle,
        _track: &MusicTrack,
    ) -> Result<MusicVideoStream, String> {
        Err(NO_VIDEO.to_string())
    }

    fn set_health(&self, _health: ConnectorHealth) {}
    fn health(&self) -> ConnectorHealth;

    fn searchable(&self) -> bool {
        true
    }

    fn playable(&self) -> bool {
        true
    }

    fn scrobbler(&self) -> bool {
        false
    }

    fn browsable(&self) -> bool {
        false
    }

    fn unsupported(&self, request: &str) -> String {
        format!("Music connector {} does not support {request}", self.id())
    }

    async fn browse_home(&self, _app: &tauri::AppHandle) -> Result<Vec<MusicCatalogRow>, String> {
        Ok(Vec::new())
    }

    async fn artist_rows(
        &self,
        _app: &tauri::AppHandle,
        _artist: &MusicArtistRef,
    ) -> Result<Vec<MusicCatalogRow>, String> {
        Ok(Vec::new())
    }

    async fn artist_catalog(
        &self,
        app: &tauri::AppHandle,
        artist: &MusicArtistRef,
        kind: MusicCatalogKind,
        cursor: Option<&str>,
    ) -> Result<MusicCatalogPage, String> {
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
                .filter(|item| matches!(item, MusicCatalogItem::Album(_)))
                .collect(),
        };
        Ok(MusicCatalogPage {
            items,
            next_cursor: None,
            total: None,
            scope: MusicCatalogScope::Limited,
        })
    }

    async fn album_tracks(
        &self,
        _app: &tauri::AppHandle,
        _album: &MusicAlbumRef,
    ) -> Result<Vec<MusicTrack>, String> {
        Err(self.unsupported("albums"))
    }

    async fn artist_top(
        &self,
        _app: &tauri::AppHandle,
        _artist: &MusicArtistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        Err(self.unsupported("artists"))
    }

    async fn playlist_tracks(
        &self,
        _app: &tauri::AppHandle,
        _playlist: &MusicPlaylistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        Err(self.unsupported("playlists"))
    }

    async fn station_tracks(
        &self,
        _app: &tauri::AppHandle,
        _station: &MusicStationRef,
    ) -> Result<Vec<MusicTrack>, String> {
        Err(self.unsupported("stations"))
    }

    /// Video-only discovery; audio search results must not be relabeled as videos.
    async fn search_video_page(
        &self,
        _app: &tauri::AppHandle,
        _query: &str,
        _regular: bool,
        _cursor: Option<&str>,
    ) -> Result<super::MusicVideoPage, String> {
        Err(self.unsupported("music video search"))
    }

    /// Video-only discovery; audio search results must not be relabeled as videos.
    async fn search_videos(
        &self,
        _app: &tauri::AppHandle,
        _query: &str,
        _limit: usize,
        _interviews: bool,
    ) -> Result<Vec<MusicTrack>, String> {
        Err(self.unsupported("music video search"))
    }

    async fn search_typed(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<MusicSearchResults, String> {
        let tracks = self.search(app, query, limit).await?;
        Ok(MusicSearchResults {
            top: tracks.first().cloned().map(MusicCatalogItem::Track),
            tracks,
            albums: Vec::new(),
            artists: Vec::new(),
            playlists: Vec::new(),
        })
    }

    async fn connect(
        &self,
        _app: &tauri::AppHandle,
        _fields: &HashMap<String, String>,
    ) -> Result<MusicConnection, String> {
        Err(self.unsupported("sign in"))
    }

    async fn disconnect(&self, _app: &tauri::AppHandle) -> Result<(), String> {
        Err(self.unsupported("sign out"))
    }

    async fn scan(&self, _app: &tauri::AppHandle, _folder: &str) -> Result<u32, String> {
        Err(self.unsupported("folder scans"))
    }

    fn connection(&self) -> MusicConnection {
        let mut capabilities = Vec::new();
        if self.searchable() {
            capabilities.push("search");
        }
        if self.browsable() {
            capabilities.push("browse");
        }
        if self.playable() {
            capabilities.push("play");
        }
        if self.scrobbler() {
            capabilities.push("scrobble");
        }
        let status = match self.health() {
            ConnectorHealth::Offline => "error",
            ConnectorHealth::Unknown => "disconnected",
            _ => "connected",
        };
        let kind = if self.scrobbler() {
            "scrobbler"
        } else {
            "streaming"
        };
        MusicConnection::new(self.id(), self.name(), kind, status, &capabilities)
    }

    fn health_info(&self) -> ConnectorHealthInfo {
        ConnectorHealthInfo {
            id: self.id().to_string(),
            name: self.name().to_string(),
            health: self.health(),
            searchable: self.searchable(),
            playable: self.playable(),
            scrobbler: self.scrobbler(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct SilentConnector;

    #[async_trait]
    impl MusicConnector for SilentConnector {
        fn id(&self) -> &str {
            "silent"
        }

        fn name(&self) -> &str {
            "Silent"
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
            Err("not available".to_string())
        }

        fn health(&self) -> ConnectorHealth {
            ConnectorHealth::Healthy
        }
    }

    #[test]
    fn health_cell_round_trips_every_state() {
        let cell = HealthCell::new();
        assert_eq!(cell.get(), ConnectorHealth::Unknown);
        for health in [
            ConnectorHealth::Healthy,
            ConnectorHealth::Degraded,
            ConnectorHealth::Offline,
            ConnectorHealth::Unknown,
        ] {
            cell.set(health);
            assert_eq!(cell.get(), health);
        }
    }

    #[test]
    fn default_connection_reports_the_capabilities_the_connector_declares() {
        let connection = SilentConnector.connection();
        assert_eq!(connection.id, "silent");
        assert_eq!(connection.status, "connected");
        assert_eq!(connection.capabilities, vec!["search", "play"]);
        assert!(connection.needs.is_empty());
    }

    #[test]
    fn unsupported_requests_name_the_connector() {
        assert_eq!(
            SilentConnector.unsupported("albums"),
            "Music connector silent does not support albums"
        );
    }
}
