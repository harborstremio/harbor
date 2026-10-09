mod api;
mod browse;
mod config;
mod http;
mod items;
mod rows;
mod stream;

use super::super::connector::{ConnectorHealth, HealthCell, MusicConnector};
use super::super::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogRow, MusicConnection, MusicConnectionField,
    MusicPlaylistRef, MusicSearchResults, MusicStationRef, MusicStream, MusicTrack,
};
use api::PlaybackSession;
use async_trait::async_trait;
use config::JellyfinConfig;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Mutex;
use stream::TRANSCODE_BITRATE;

const LOAD_UNKNOWN: u8 = 0;
const LOAD_READY: u8 = 1;
const LOAD_ABSENT: u8 = 2;

pub struct JellyfinConnector {
    health: HealthCell,
    state: AtomicU8,
    config: Mutex<Option<JellyfinConfig>>,
    session: Mutex<Option<PlaybackSession>>,
}

impl JellyfinConnector {
    pub fn new() -> Self {
        Self {
            health: HealthCell::new(),
            state: AtomicU8::new(LOAD_UNKNOWN),
            config: Mutex::new(None),
            session: Mutex::new(None),
        }
    }

    fn snapshot(&self) -> Option<JellyfinConfig> {
        let slot = self.config.lock().ok()?;
        slot.clone()
    }

    fn remember(&self, config: Option<JellyfinConfig>) {
        let state = if config.is_some() {
            LOAD_READY
        } else {
            LOAD_ABSENT
        };
        self.state.store(state, Ordering::Relaxed);
        if let Ok(mut slot) = self.config.lock() {
            *slot = config;
        }
    }

    fn settings(&self, app: &tauri::AppHandle) -> Result<JellyfinConfig, String> {
        if let Some(config) = self.snapshot() {
            return Ok(config);
        }
        if self.state.load(Ordering::Relaxed) == LOAD_ABSENT {
            return Err(api::NOT_CONNECTED.to_string());
        }
        self.remember(config::load(app));
        match self.snapshot() {
            Some(config) => Ok(config),
            None => Err(api::NOT_CONNECTED.to_string()),
        }
    }

    fn ready(&self) -> bool {
        self.state.load(Ordering::Relaxed) != LOAD_ABSENT
    }

    fn record<T>(&self, result: &Result<T, String>) {
        self.health.set(match result {
            Ok(_) => ConnectorHealth::Healthy,
            Err(error) => http::classify(error),
        });
    }

    fn remember_library(&self, config: &JellyfinConfig, library: Option<String>) {
        if library.is_none() || config.library_id == library {
            return;
        }
        let mut updated = config.clone();
        updated.library_id = library;
        self.remember(Some(updated));
    }

    fn take_session(&self) -> Option<PlaybackSession> {
        let mut slot = self.session.lock().ok()?;
        slot.take()
    }

    fn keep_session(&self, session: PlaybackSession) {
        if let Ok(mut slot) = self.session.lock() {
            *slot = Some(session);
        }
    }

    async fn resolve_stream(
        &self,
        config: &JellyfinConfig,
        track: &MusicTrack,
    ) -> Result<MusicStream, String> {
        let item_id = items::safe_item_id(stream::source_of(track))?;
        let info = api::playback_info(config, &item_id, TRANSCODE_BITRATE).await?;
        let source = info.media_sources.into_iter().next().unwrap_or_default();
        let direct = stream::direct_play(&source);
        let play_session_id = info.play_session_id.unwrap_or_else(|| item_id.clone());
        let session = PlaybackSession {
            item_id: item_id.clone(),
            play_session_id,
            media_source_id: source.id.clone(),
        };
        let resolved = MusicStream {
            http_headers: Default::default(),
            url: stream::universal(config, &item_id, &session)?,
            mime_type: stream::mime_for(&source, direct).to_string(),
            bitrate: stream::bitrate_for(&source, direct),
        };
        self.report(config, session, direct).await;
        Ok(resolved)
    }

    async fn report(&self, config: &JellyfinConfig, session: PlaybackSession, direct: bool) {
        if let Some(previous) = self.take_session() {
            if let Err(error) = api::report_stopped(config, &previous).await {
                eprintln!("[harbor::music] Jellyfin stop report failed: {error}");
            }
        }
        if let Err(error) = api::report_started(config, &session, direct).await {
            eprintln!("[harbor::music] Jellyfin start report failed: {error}");
        }
        self.keep_session(session);
    }
}

impl Default for JellyfinConnector {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MusicConnector for JellyfinConnector {
    fn id(&self) -> &str {
        "jellyfin"
    }

    fn name(&self) -> &str {
        "Jellyfin"
    }

    async fn search(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<MusicTrack>, String> {
        let Ok(config) = self.settings(app) else {
            return Ok(Vec::new());
        };
        let found = browse::search(&config, query, limit, "Audio").await;
        self.record(&found);
        Ok(browse::tracks(&config, &found?))
    }

    async fn search_typed(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<MusicSearchResults, String> {
        let Ok(config) = self.settings(app) else {
            return Ok(MusicSearchResults::default());
        };
        let result = browse::search_typed(&config, query, limit).await;
        self.record(&result);
        result
    }

    async fn resolve(
        &self,
        app: &tauri::AppHandle,
        track: &MusicTrack,
    ) -> Result<MusicStream, String> {
        let config = self.settings(app)?;
        let result = self.resolve_stream(&config, track).await;
        self.record(&result);
        result
    }

    async fn browse_home(&self, app: &tauri::AppHandle) -> Result<Vec<MusicCatalogRow>, String> {
        let Ok(config) = self.settings(app) else {
            return Ok(Vec::new());
        };
        let library = browse::library_id(&config).await;
        let result = rows::home(&config, library.as_deref()).await;
        self.record(&result);
        self.remember_library(&config, library);
        result
    }

    async fn album_tracks(
        &self,
        app: &tauri::AppHandle,
        album: &MusicAlbumRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let config = self.settings(app)?;
        let result = browse::album_tracks(&config, &album.id).await;
        self.record(&result);
        result
    }

    async fn artist_top(
        &self,
        app: &tauri::AppHandle,
        artist: &MusicArtistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let config = self.settings(app)?;
        let result = browse::artist_top(&config, &artist.id).await;
        self.record(&result);
        result
    }

    async fn playlist_tracks(
        &self,
        app: &tauri::AppHandle,
        playlist: &MusicPlaylistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let config = self.settings(app)?;
        let result = browse::playlist_tracks(&config, &playlist.id).await;
        self.record(&result);
        result
    }

    async fn station_tracks(
        &self,
        app: &tauri::AppHandle,
        station: &MusicStationRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let config = self.settings(app)?;
        let result = browse::station_tracks(&config, &station.id).await;
        self.record(&result);
        result
    }

    async fn connect(
        &self,
        app: &tauri::AppHandle,
        fields: &HashMap<String, String>,
    ) -> Result<MusicConnection, String> {
        let config = api::sign_in(app, fields).await?;
        config::save(app, &config)?;
        self.remember(Some(config));
        self.health.set(ConnectorHealth::Healthy);
        Ok(self.connection())
    }

    async fn disconnect(&self, app: &tauri::AppHandle) -> Result<(), String> {
        config::clear(app)?;
        self.remember(None);
        self.health.set(ConnectorHealth::Unknown);
        let _ = self.take_session();
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
        let config = self.snapshot();
        let status = connection_status(config.is_some(), self.health());
        let mut connection = MusicConnection::new(
            "jellyfin",
            "Jellyfin",
            "server",
            status,
            &["search", "browse", "play", "library"],
        )
        .needs(vec![
            MusicConnectionField::new("url", "Server URL", "url", true)
                .placeholder("https://jellyfin.local"),
            MusicConnectionField::new("username", "Username", "text", true),
            MusicConnectionField::new("password", "Password", "password", true),
        ]);
        if let Some(config) = config {
            if !config.user_name.is_empty() {
                connection.account = Some(config.user_name);
            }
            if !config.server_name.is_empty() {
                connection.detail = Some(config.server_name);
            }
        }
        connection
    }
}

fn connection_status(configured: bool, health: ConnectorHealth) -> &'static str {
    if !configured {
        return "disconnected";
    }
    match health {
        ConnectorHealth::Offline => "error",
        _ => "connected",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> JellyfinConfig {
        JellyfinConfig {
            origin: "https://media.example.test".to_string(),
            user_id: "u1".to_string(),
            user_name: "josiah".to_string(),
            token: "tok".to_string(),
            device_id: "harbor-music-1".to_string(),
            server_name: "Basement".to_string(),
            library_id: None,
        }
    }

    #[test]
    fn a_connector_reports_disconnected_until_a_server_is_loaded() {
        let connector = JellyfinConnector::new();
        let connection = connector.connection();
        assert_eq!(connection.status, "disconnected");
        assert_eq!(connection.needs.len(), 3);
        assert_eq!(connection.kind, "server");
        assert!(connector.ready());

        connector.remember(Some(config()));
        let connection = connector.connection();
        assert_eq!(connection.status, "connected");
        assert_eq!(connection.account.as_deref(), Some("josiah"));
        assert_eq!(connection.detail.as_deref(), Some("Basement"));

        connector.set_health(ConnectorHealth::Offline);
        assert_eq!(connector.connection().status, "error");

        connector.remember(None);
        assert!(!connector.ready());
        assert_eq!(connector.connection().status, "disconnected");
    }

    #[test]
    fn the_music_library_id_is_kept_once_a_browse_has_resolved_it() {
        let connector = JellyfinConnector::new();
        connector.remember(Some(config()));
        let current = connector.snapshot().expect("config");
        connector.remember_library(&current, Some("lib1".to_string()));
        let updated = connector.snapshot().expect("config");
        assert_eq!(updated.library_id.as_deref(), Some("lib1"));

        connector.remember_library(&updated, None);
        let unchanged = connector.snapshot().expect("config");
        assert_eq!(unchanged.library_id.as_deref(), Some("lib1"));
    }
}
