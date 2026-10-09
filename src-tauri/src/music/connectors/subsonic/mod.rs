mod catalog;
mod client;
mod convert;
mod model;
mod pairing;

use self::catalog::{album_songs, artist_songs, home_rows, playlist_songs, search3};
use self::client::{base_candidates, http_client, pair, SubsonicClient};
use self::convert::{album_ref, artist_ref, classify_error, field, safe_id, track_ref};
use self::pairing::Pairing;
use super::super::connector::{ConnectorHealth, HealthCell, MusicConnector};
use super::super::{
    MusicAlbumRef, MusicArtistRef, MusicCatalogItem, MusicCatalogRow, MusicConnection,
    MusicConnectionField, MusicPlaylistRef, MusicSearchResults, MusicStream, MusicTrack,
};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;

const CONNECTOR_ID: &str = "subsonic";
const CONNECTOR_NAME: &str = "Navidrome";

pub struct SubsonicConnector {
    health: HealthCell,
    configured: AtomicBool,
    hydrated: AtomicBool,
    paired: RwLock<Option<Pairing>>,
    http: reqwest::Client,
}

impl SubsonicConnector {
    pub fn new() -> Self {
        Self {
            health: HealthCell::new(),
            configured: AtomicBool::new(false),
            hydrated: AtomicBool::new(false),
            paired: RwLock::new(None),
            http: http_client(),
        }
    }

    pub fn configured(&self) -> bool {
        self.configured.load(Ordering::Relaxed)
    }

    fn adopt(&self, paired: Option<Pairing>) {
        self.configured.store(paired.is_some(), Ordering::Relaxed);
        if let Ok(mut slot) = self.paired.write() {
            *slot = paired;
        }
        self.hydrated.store(true, Ordering::Relaxed);
    }

    fn client(&self, app: &tauri::AppHandle) -> Option<SubsonicClient> {
        if !self.hydrated.load(Ordering::Relaxed) {
            self.adopt(pairing::load(app).ok().flatten());
        }
        let paired = self.paired.read().ok()?.clone()?;
        Some(SubsonicClient::new(self.http.clone(), paired))
    }

    fn require(&self, app: &tauri::AppHandle) -> Result<SubsonicClient, String> {
        self.client(app)
            .ok_or_else(|| "Connect your music server first".to_string())
    }

    fn record<T>(&self, result: &Result<T, String>) {
        self.health.set(match result {
            Ok(_) => ConnectorHealth::Healthy,
            Err(error) => classify_error(error),
        });
    }

    async fn songs(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<MusicTrack>, String> {
        let client = self.require(app)?;
        let results = search3(&client, query, 0, 0, limit).await?;
        Ok(results
            .song
            .into_iter()
            .map(|song| track_ref(&client, song))
            .collect())
    }

    async fn everything(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<MusicSearchResults, String> {
        let client = self.require(app)?;
        let results = search3(&client, query, limit, limit, limit).await?;
        let tracks = results
            .song
            .into_iter()
            .map(|song| track_ref(&client, song))
            .collect::<Vec<_>>();
        let albums = results
            .album
            .into_iter()
            .map(|album| album_ref(&client, album))
            .collect::<Vec<_>>();
        let artists = results
            .artist
            .into_iter()
            .map(|artist| artist_ref(&client, artist))
            .collect::<Vec<_>>();
        let top = tracks
            .first()
            .cloned()
            .map(MusicCatalogItem::Track)
            .or_else(|| albums.first().cloned().map(MusicCatalogItem::Album));
        Ok(MusicSearchResults {
            top,
            tracks,
            albums,
            artists,
            ..MusicSearchResults::default()
        })
    }

    async fn stream(
        &self,
        app: &tauri::AppHandle,
        track: &MusicTrack,
    ) -> Result<MusicStream, String> {
        let client = self.require(app)?;
        let song_id = safe_id(track.source_id.as_deref().unwrap_or(&track.id))?;
        let url = client.stream_url(&song_id)?;
        tokio::spawn(async move {
            let _ = client.scrobble(&song_id, None).await;
        });
        Ok(MusicStream {
            http_headers: Default::default(),
            url,
            mime_type: "audio/*".to_string(),
            bitrate: 0,
        })
    }

    async fn sign_in(
        &self,
        app: &tauri::AppHandle,
        fields: &HashMap<String, String>,
    ) -> Result<MusicConnection, String> {
        let address = field(fields, "url", "address")?;
        let username = field(fields, "username", "username")?;
        let password = field(fields, "password", "password")?;
        let mut failure = None;
        for base in base_candidates(&address)? {
            match pair(&self.http, &base, username.trim(), &password).await {
                Ok(client) => {
                    pairing::save(app, client.pairing())?;
                    self.adopt(Some(client.pairing().clone()));
                    return Ok(self.connection());
                }
                Err(error) => failure = Some(error),
            }
        }
        Err(failure.unwrap_or_else(|| "Harbor could not reach that music server".to_string()))
    }
}

impl Default for SubsonicConnector {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MusicConnector for SubsonicConnector {
    fn id(&self) -> &str {
        CONNECTOR_ID
    }

    fn name(&self) -> &str {
        CONNECTOR_NAME
    }

    async fn search(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<Vec<MusicTrack>, String> {
        let result = self.songs(app, query, limit).await;
        self.record(&result);
        result
    }

    async fn search_typed(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        limit: usize,
    ) -> Result<MusicSearchResults, String> {
        let result = self.everything(app, query, limit).await;
        self.record(&result);
        result
    }

    async fn resolve(
        &self,
        app: &tauri::AppHandle,
        track: &MusicTrack,
    ) -> Result<MusicStream, String> {
        let result = self.stream(app, track).await;
        self.record(&result);
        result
    }

    async fn browse_home(&self, app: &tauri::AppHandle) -> Result<Vec<MusicCatalogRow>, String> {
        let Some(client) = self.client(app) else {
            return Ok(Vec::new());
        };
        let result = home_rows(&client).await;
        self.record(&result);
        result
    }

    async fn album_tracks(
        &self,
        app: &tauri::AppHandle,
        album: &MusicAlbumRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let client = self.require(app)?;
        let result = album_songs(&client, &safe_id(&album.id)?).await;
        self.record(&result);
        result
    }

    async fn artist_top(
        &self,
        app: &tauri::AppHandle,
        artist: &MusicArtistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let client = self.require(app)?;
        let result = artist_songs(&client, &safe_id(&artist.id)?).await;
        self.record(&result);
        result
    }

    async fn playlist_tracks(
        &self,
        app: &tauri::AppHandle,
        playlist: &MusicPlaylistRef,
    ) -> Result<Vec<MusicTrack>, String> {
        let client = self.require(app)?;
        let result = playlist_songs(&client, &safe_id(&playlist.id)?).await;
        self.record(&result);
        result
    }

    async fn connect(
        &self,
        app: &tauri::AppHandle,
        fields: &HashMap<String, String>,
    ) -> Result<MusicConnection, String> {
        let result = self.sign_in(app, fields).await;
        self.record(&result);
        result
    }

    async fn disconnect(&self, app: &tauri::AppHandle) -> Result<(), String> {
        pairing::clear(app)?;
        self.adopt(None);
        self.health.set(ConnectorHealth::Unknown);
        Ok(())
    }

    fn set_health(&self, health: ConnectorHealth) {
        self.health.set(health);
    }

    fn health(&self) -> ConnectorHealth {
        self.health.get()
    }

    fn searchable(&self) -> bool {
        self.configured()
    }

    fn playable(&self) -> bool {
        self.configured()
    }

    fn browsable(&self) -> bool {
        true
    }

    fn connection(&self) -> MusicConnection {
        let paired = self.paired.read().ok().and_then(|slot| slot.clone());
        let status = match (paired.is_some(), self.health()) {
            (false, _) => "disconnected",
            (true, ConnectorHealth::Offline) => "error",
            (true, _) => "connected",
        };
        let mut connection = MusicConnection::new(
            CONNECTOR_ID,
            CONNECTOR_NAME,
            "server",
            status,
            &["search", "browse", "play", "library"],
        )
        .needs(vec![
            MusicConnectionField::new("url", "Server URL", "url", true)
                .placeholder("https://navidrome.local"),
            MusicConnectionField::new("username", "Username", "text", true),
            MusicConnectionField::new("password", "Password", "password", true),
        ]);
        if let Some(paired) = paired {
            connection.account = Some(paired.username);
            connection.detail = Some(paired.base_url);
        }
        connection
    }
}

pub async fn scrobble(
    app: &tauri::AppHandle,
    track: &MusicTrack,
    started_at: u64,
) -> Result<bool, String> {
    if track.connector_id.as_deref() != Some(CONNECTOR_ID) {
        return Ok(false);
    }
    let Some(paired) = pairing::load(app)? else {
        return Ok(false);
    };
    let song_id = safe_id(track.source_id.as_deref().unwrap_or(&track.id))?;
    SubsonicClient::new(http_client(), paired)
        .scrobble(&song_id, Some(started_at.saturating_mul(1000)))
        .await?;
    Ok(true)
}
