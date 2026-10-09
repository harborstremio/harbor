use super::super::connector::{ConnectorHealth, HealthCell, MusicConnector};
use super::super::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogKind, MusicCatalogPage, MusicCatalogRow,
    MusicConnection, MusicPlaylistRef, MusicSearchResults, MusicStream, MusicTrack,
};
use super::{browse, keystore, SpotifyState};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;

pub struct SpotifyConnector {
    state: Arc<SpotifyState>,
    health: HealthCell,
}

impl SpotifyConnector {
    pub fn new(state: Arc<SpotifyState>) -> Self {
        Self {
            state,
            health: HealthCell::new(),
        }
    }

    fn record<T>(&self, result: &Result<T, String>) {
        self.health.set(match result {
            Ok(_) => ConnectorHealth::Healthy,
            Err(error) if error.contains("Connect Spotify Premium") => ConnectorHealth::Unknown,
            Err(error) if is_offline(error) => ConnectorHealth::Offline,
            Err(_) => ConnectorHealth::Degraded,
        });
    }
}

#[async_trait]
impl MusicConnector for SpotifyConnector {
    fn id(&self) -> &str {
        "spotify"
    }

    fn name(&self) -> &str {
        "Spotify"
    }

    async fn search(
        &self,
        _app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = browse::tracks(&self.state, query, limit).await;
        self.record(&result);
        result
    }

    async fn search_typed(
        &self,
        _app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<MusicSearchResults, String> {
        let result = browse::search(&self.state, query, limit).await;
        self.record(&result);
        result
    }

    async fn resolve(
        &self,
        _app: &tauri::AppHandle,
        _track: &MusicTrack,
    ) -> Result<MusicStream, String> {
        Err("Spotify playback uses Harbor's native Premium session".to_string())
    }

    async fn browse_home(&self, _app: &tauri::AppHandle) -> Result<Vec<MusicCatalogRow>, String> {
        let result = browse::home(&self.state).await;
        self.record(&result);
        result
    }

    async fn album_tracks(
        &self,
        _app: &tauri::AppHandle,
        album: &MusicAlbumRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = browse::album_tracks(&self.state, album).await;
        self.record(&result);
        result
    }

    async fn artist_top(
        &self,
        _app: &tauri::AppHandle,
        artist: &MusicArtistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = browse::artist_top(&self.state, artist).await;
        self.record(&result);
        result
    }

    async fn artist_catalog(
        &self,
        _app: &tauri::AppHandle,
        artist: &MusicArtistRef,
        kind: MusicCatalogKind,
        cursor: Option<&str>,
    ) -> Result<MusicCatalogPage, String> {
        let result = super::artist_catalog::load(&self.state, artist, kind, cursor).await;
        self.record(&result);
        result
    }

    async fn playlist_tracks(
        &self,
        _app: &tauri::AppHandle,
        playlist: &MusicPlaylistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = browse::playlist_tracks(&self.state, playlist).await;
        self.record(&result);
        result
    }

    async fn connect(
        &self,
        app: &tauri::AppHandle,
        fields: &HashMap<String, String>,
    ) -> Result<MusicConnection, String> {
        if let Some(client_id) = fields
            .get("clientId")
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            keystore::write(app, keystore::CLIENT_ID_KEY, Some(client_id))?;
        }
        let result = self.state.connect_interactive(app.clone()).await;
        self.record(&result);
        result.map(|_| self.state.connection())
    }

    async fn disconnect(&self, _app: &tauri::AppHandle) -> Result<(), String> {
        let result = self.state.disconnect().await;
        if result.is_ok() {
            self.health.set(ConnectorHealth::Unknown);
        }
        result
    }

    fn browsable(&self) -> bool {
        self.state.connected()
    }

    fn connection(&self) -> MusicConnection {
        self.state.connection()
    }

    fn set_health(&self, health: ConnectorHealth) {
        self.health.set(health);
    }

    fn health(&self) -> ConnectorHealth {
        self.health.get()
    }
}

fn is_offline(error: &str) -> bool {
    let marker = error.to_ascii_lowercase();
    ["timed out", "network", "connection", "dns", "offline"]
        .iter()
        .any(|needle| marker.contains(needle))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connector() -> SpotifyConnector {
        SpotifyConnector::new(Arc::new(SpotifyState::new()))
    }

    #[test]
    fn a_disconnected_spotify_is_not_browsable() {
        let connector = connector();
        assert!(!connector.browsable());
        assert!(connector.searchable());
        assert_eq!(connector.connection().status, "disconnected");
    }

    #[test]
    fn the_connect_prompt_never_marks_spotify_offline() {
        let connector = connector();
        connector.record::<()>(&Err("Connect Spotify Premium to use Spotify".to_string()));
        assert_eq!(connector.health(), ConnectorHealth::Unknown);
        connector.record::<()>(&Err("Spotify request failed: dns error".to_string()));
        assert_eq!(connector.health(), ConnectorHealth::Offline);
        connector.record::<()>(&Err("Spotify returned 500".to_string()));
        assert_eq!(connector.health(), ConnectorHealth::Degraded);
        connector.record(&Ok(()));
        assert_eq!(connector.health(), ConnectorHealth::Healthy);
    }

    #[test]
    fn offline_markers_do_not_match_ordinary_messages() {
        assert!(is_offline("Spotify request failed: connection refused"));
        assert!(is_offline("Spotify sign in timed out after 90 seconds"));
        assert!(!is_offline(
            "Spotify refused this request for the connected account."
        ));
    }
}
