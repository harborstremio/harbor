mod browse;
mod client;
mod parse;
mod session;

use super::super::connector::{ConnectorHealth, HealthCell, MusicConnector};
use super::super::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogRow, MusicConnection, MusicConnectionField,
    MusicPlaylistRef, MusicSearchResults, MusicStationRef, MusicStream, MusicTrack,
};
use async_trait::async_trait;
use client::{classify_error, now};
use session::{PlexConfig, Stored, NOT_CONNECTED};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const DISCOVERY_BUDGET: Duration = Duration::from_secs(10);
const RETRY_AFTER: i64 = 600;

pub struct PlexConnector {
    health: HealthCell,
    configured: AtomicBool,
    config: Mutex<Option<Arc<PlexConfig>>>,
    detail: Mutex<Option<String>>,
    attempted_at: AtomicI64,
    gate: tokio::sync::Mutex<()>,
}

impl PlexConnector {
    pub fn new() -> Self {
        Self {
            health: HealthCell::new(),
            configured: AtomicBool::new(false),
            config: Mutex::new(None),
            detail: Mutex::new(None),
            attempted_at: AtomicI64::new(0),
            gate: tokio::sync::Mutex::new(()),
        }
    }

    pub fn configured(&self) -> bool {
        self.configured.load(Ordering::Relaxed)
    }

    fn ready(&self) -> bool {
        self.configured() || self.retry_due()
    }

    fn retry_due(&self) -> bool {
        now() - self.attempted_at.load(Ordering::Relaxed) >= RETRY_AFTER
    }

    fn cached(&self) -> Option<Arc<PlexConfig>> {
        self.config.lock().ok()?.clone()
    }

    fn adopt(&self, config: PlexConfig) -> Arc<PlexConfig> {
        let config = Arc::new(config);
        if let Ok(mut slot) = self.config.lock() {
            *slot = Some(config.clone());
        }
        if let Ok(mut slot) = self.detail.lock() {
            *slot = Some(config.detail());
        }
        self.configured.store(true, Ordering::Relaxed);
        config
    }

    fn forget(&self) {
        if let Ok(mut slot) = self.config.lock() {
            *slot = None;
        }
        if let Ok(mut slot) = self.detail.lock() {
            *slot = None;
        }
        self.configured.store(false, Ordering::Relaxed);
        self.health.set(ConnectorHealth::Unknown);
    }

    async fn ensure(&self, app: &tauri::AppHandle) -> Result<Arc<PlexConfig>, String> {
        if let Some(config) = self.cached() {
            return Ok(config);
        }
        let _gate = self.gate.lock().await;
        if let Some(config) = self.cached() {
            return Ok(config);
        }
        if !self.retry_due() {
            return Err(NOT_CONNECTED.to_string());
        }
        self.attempted_at.store(now(), Ordering::Relaxed);
        match session::load(app) {
            Stored::Ready(config) => Ok(self.adopt(config)),
            Stored::Dismissed => Err(NOT_CONNECTED.to_string()),
            Stored::Absent => Ok(self.adopt(self.discover(app).await?)),
        }
    }

    async fn discover(&self, app: &tauri::AppHandle) -> Result<PlexConfig, String> {
        tokio::time::timeout(DISCOVERY_BUDGET, session::discover(app))
            .await
            .map_err(|_| "Plex servers did not answer in time".to_string())?
    }

    fn record<T>(&self, result: &Result<T, String>) {
        self.health.set(match result {
            Ok(_) => ConnectorHealth::Healthy,
            Err(error) => classify_error(error),
        });
    }
}

impl Default for PlexConnector {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MusicConnector for PlexConnector {
    fn id(&self) -> &str {
        "plex"
    }

    fn name(&self) -> &str {
        "Plex"
    }

    async fn search(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<MusicTrack>, String> {
        Ok(self.search_typed(app, query, limit).await?.tracks)
    }

    async fn search_typed(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<MusicSearchResults, String> {
        let Ok(config) = self.ensure(app).await else {
            return Ok(MusicSearchResults::default());
        };
        let result = browse::search(&config, query, limit).await;
        self.record(&result);
        result
    }

    async fn browse_home(&self, app: &tauri::AppHandle) -> Result<Vec<MusicCatalogRow>, String> {
        let Ok(config) = self.ensure(app).await else {
            return Ok(Vec::new());
        };
        let result = browse::hubs(&config).await;
        self.record(&result);
        result
    }

    async fn album_tracks(
        &self,
        app: &tauri::AppHandle,
        album: &MusicAlbumRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let config = self.ensure(app).await?;
        let result = browse::album_tracks(&config, album).await;
        self.record(&result);
        result
    }

    async fn artist_top(
        &self,
        app: &tauri::AppHandle,
        artist: &MusicArtistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let config = self.ensure(app).await?;
        let result = browse::artist_top(&config, artist).await;
        self.record(&result);
        result
    }

    async fn playlist_tracks(
        &self,
        app: &tauri::AppHandle,
        playlist: &MusicPlaylistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let config = self.ensure(app).await?;
        let result = browse::playlist_tracks(&config, playlist).await;
        self.record(&result);
        result
    }

    async fn station_tracks(
        &self,
        app: &tauri::AppHandle,
        station: &MusicStationRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let config = self.ensure(app).await?;
        let result = browse::station_tracks(&config, station).await;
        self.record(&result);
        result
    }

    async fn resolve(
        &self,
        app: &tauri::AppHandle,
        track: &MusicTrack,
    ) -> Result<MusicStream, String> {
        let config = self.ensure(app).await?;
        let result = browse::resolve(&config, track).await;
        self.record(&result);
        result
    }

    async fn connect(
        &self,
        app: &tauri::AppHandle,
        fields: &HashMap<String, String>,
    ) -> Result<MusicConnection, String> {
        let url = fields
            .get("url")
            .map(String::as_str)
            .unwrap_or_default()
            .trim();
        let token = fields
            .get("token")
            .map(String::as_str)
            .unwrap_or_default()
            .trim();
        if url.is_empty() && token.is_empty() {
            self.forget();
            self.attempted_at.store(now(), Ordering::Relaxed);
            self.adopt(self.discover(app).await?);
            self.health.set(ConnectorHealth::Healthy);
            return Ok(self.connection());
        }
        let origin = client::normalized_origin(url)?;
        if token.is_empty() {
            return Err("Paste the Plex access token for this server".to_string());
        }
        let client_id =
            session::client_identifier(app).unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let (section, section_uuid) = session::music_section(&origin, token, &client_id).await?;
        let config = PlexConfig {
            origin,
            token: token.to_string(),
            client_id,
            section,
            section_uuid,
            server: None,
        };
        session::store(app, &config)?;
        self.adopt(config);
        self.health.set(ConnectorHealth::Healthy);
        Ok(self.connection())
    }

    async fn disconnect(&self, app: &tauri::AppHandle) -> Result<(), String> {
        session::dismiss(app)?;
        self.forget();
        self.attempted_at.store(now(), Ordering::Relaxed);
        Ok(())
    }

    fn set_health(&self, health: ConnectorHealth) {
        self.health.set(health);
    }

    fn health(&self) -> ConnectorHealth {
        self.health.get()
    }

    fn searchable(&self) -> bool {
        self.ready()
    }

    fn playable(&self) -> bool {
        self.ready()
    }

    fn browsable(&self) -> bool {
        self.ready()
    }

    fn connection(&self) -> MusicConnection {
        let status = if self.configured() {
            match self.health() {
                ConnectorHealth::Offline => "error",
                _ => "connected",
            }
        } else {
            "disconnected"
        };
        let mut connection = MusicConnection::new(
            "plex",
            "Plex",
            "server",
            status,
            &["search", "browse", "play", "library"],
        )
        .needs(vec![
            MusicConnectionField::new("url", "Server URL", "url", true)
                .placeholder("https://plex.local:32400"),
            MusicConnectionField::new("token", "Access token", "password", true),
        ]);
        connection.detail = self.detail.lock().ok().and_then(|slot| slot.clone());
        connection
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_unconfigured_connector_reads_as_disconnected_but_stays_eligible() {
        let connector = PlexConnector::new();
        assert!(!connector.configured());
        assert!(connector.ready());
        let connection = connector.connection();
        assert_eq!(connection.status, "disconnected");
        assert_eq!(connection.kind, "server");
        assert_eq!(connection.needs.len(), 2);
        assert!(connection.detail.is_none());
    }

    #[test]
    fn adopting_a_config_reports_the_server_name_and_a_connected_status() {
        let connector = PlexConnector::new();
        connector.adopt(PlexConfig {
            origin: "https://plex.local:32400".to_string(),
            token: "tok".to_string(),
            client_id: "cid".to_string(),
            section: "3".to_string(),
            section_uuid: None,
            server: Some("Attic".to_string()),
        });
        let connection = connector.connection();
        assert_eq!(connection.status, "connected");
        assert_eq!(connection.detail.as_deref(), Some("Attic"));
        connector.forget();
        assert_eq!(connector.connection().status, "disconnected");
        assert!(connector.connection().detail.is_none());
    }

    #[test]
    fn a_failed_attempt_holds_discovery_back_until_the_retry_window_passes() {
        let connector = PlexConnector::new();
        assert!(connector.retry_due());
        connector.attempted_at.store(now(), Ordering::Relaxed);
        assert!(!connector.retry_due());
        assert!(!connector.ready());
        connector
            .attempted_at
            .store(now() - RETRY_AFTER, Ordering::Relaxed);
        assert!(connector.retry_due());
    }
}
