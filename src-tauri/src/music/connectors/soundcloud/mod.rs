mod browse;
mod client;
mod fetch;
mod identity;
mod parse;
mod stream;

use super::super::connector::{ConnectorHealth, HealthCell, MusicConnector};
use super::super::{
    MusicArtistRef, MusicCatalogItem, MusicCatalogRow, MusicConnection, MusicPlaylistRef,
    MusicSearchResults, MusicStream, MusicTrack,
};
use async_trait::async_trait;

const PLAYLIST_LIMIT: usize = 100;
const TOP_TRACKS: usize = 20;
const TYPED_LIMIT: usize = 12;

pub struct SoundCloudConnector {
    health: HealthCell,
}

impl SoundCloudConnector {
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

impl Default for SoundCloudConnector {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MusicConnector for SoundCloudConnector {
    fn id(&self) -> &str {
        "soundcloud"
    }

    fn name(&self) -> &str {
        "SoundCloud"
    }

    async fn search(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<MusicTrack>, String> {
        identity::attach(app).await;
        let result = tracks_matching(query, limit).await;
        self.record(&result);
        result
    }

    async fn search_typed(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<MusicSearchResults, String> {
        identity::attach(app).await;
        let result = typed_search(query, limit).await;
        self.record(&result);
        result
    }

    async fn browse_home(&self, app: &tauri::AppHandle) -> Result<Vec<MusicCatalogRow>, String> {
        if identity::attach(app).await.is_none() {
            identity::warm();
            return Ok(Vec::new());
        }
        let result = browse::home().await;
        self.record(&result);
        result
    }

    async fn playlist_tracks(
        &self,
        app: &tauri::AppHandle,
        playlist: &MusicPlaylistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        identity::attach(app).await;
        let result = tracks_in_playlist(&playlist.id).await;
        self.record(&result);
        result
    }

    async fn artist_top(
        &self,
        app: &tauri::AppHandle,
        artist: &MusicArtistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        identity::attach(app).await;
        let result = tracks_by_artist(&artist.id).await;
        self.record(&result);
        result
    }

    async fn resolve(
        &self,
        app: &tauri::AppHandle,
        track: &MusicTrack,
    ) -> Result<MusicStream, String> {
        identity::attach(app).await;
        let result = stream::resolve(track).await;
        self.record(&result);
        result
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
            self.id(),
            self.name(),
            "streaming",
            status,
            &["search", "browse", "play"],
        )
        .anonymous()
    }
}

async fn tracks_matching(query: &str, limit: usize) -> Result<Vec<MusicTrack>, String> {
    let found = fetch::search_tracks(query, limit).await?;
    let mut tracks = parse::to_music_tracks(&found);
    tracks.truncate(limit);
    Ok(tracks)
}

async fn typed_search(query: &str, limit: usize) -> Result<MusicSearchResults, String> {
    let side = limit.min(TYPED_LIMIT);
    let (found, users, playlists) = tokio::join!(
        fetch::search_tracks(query, limit),
        fetch::search_users(query, side),
        fetch::search_playlists(query, side),
    );
    let mut tracks = parse::to_music_tracks(&found?);
    tracks.truncate(limit);
    Ok(MusicSearchResults {
        top: tracks.first().cloned().map(MusicCatalogItem::Track),
        tracks,
        artists: users
            .unwrap_or_default()
            .iter()
            .filter_map(parse::to_artist_ref)
            .collect(),
        playlists: playlists
            .unwrap_or_default()
            .iter()
            .filter_map(parse::to_playlist_ref)
            .collect(),
        ..MusicSearchResults::default()
    })
}

async fn tracks_in_playlist(id: &str) -> Result<Vec<MusicTrack>, String> {
    let playlist = fetch::playlist_by_id(id).await?;
    fetch::hydrate(playlist.tracks.unwrap_or_default(), PLAYLIST_LIMIT).await
}

async fn tracks_by_artist(id: &str) -> Result<Vec<MusicTrack>, String> {
    let user =
        parse::numeric_id(id).ok_or_else(|| "SoundCloud artist id is invalid".to_string())?;
    let found = fetch::user_tracks(user, TOP_TRACKS).await?;
    Ok(parse::to_music_tracks(&found))
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
        "request failed",
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
    fn transport_failures_report_offline_and_the_rest_report_degraded() {
        assert_eq!(
            classify_error("SoundCloud request failed: error sending request"),
            ConnectorHealth::Offline
        );
        assert_eq!(
            classify_error("SoundCloud request failed: operation timed out"),
            ConnectorHealth::Offline
        );
        assert_eq!(
            classify_error("SoundCloud returned HTTP 500 Internal Server Error"),
            ConnectorHealth::Degraded
        );
        assert_eq!(
            classify_error("SoundCloud only offers a preview of this track"),
            ConnectorHealth::Degraded
        );
    }

    #[test]
    fn the_connector_advertises_search_browse_and_playback() {
        let connector = SoundCloudConnector::new();
        assert!(connector.searchable());
        assert!(connector.browsable());
        assert!(connector.playable());
        assert!(!connector.scrobbler());
        let connection = connector.connection();
        assert_eq!(connection.id, "soundcloud");
        assert_eq!(connection.kind, "streaming");
        assert_eq!(connection.status, "connected");
        assert_eq!(connection.capabilities, vec!["search", "browse", "play"]);
        assert!(connection.needs.is_empty());
        connector.set_health(ConnectorHealth::Offline);
        assert_eq!(connector.connection().status, "error");
    }
}
