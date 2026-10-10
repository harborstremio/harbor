mod audio;
mod catalog_commands;
mod commands;
mod connector;
mod connectors;
mod db;
mod engine;
mod lastfm;
mod library;
mod m3u;
mod matching;
mod migrations;
mod model;
mod registry;
mod rows;
mod spotify;
mod store;
mod worker;
mod worker_policy;

pub use catalog_commands::*;
pub use commands::*;
pub use model::*;
pub use spotify::library::*;

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, AtomicU8, Ordering};
use std::sync::Arc;
use tauri::Manager;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicTrack {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    explicit: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    media_kind: Option<String>,
    id: String,
    connector_id: Option<String>,
    source_id: Option<String>,
    playback_url: Option<String>,
    title: String,
    artist: String,
    album: Option<String>,
    artwork: String,
    duration_seconds: u64,
    duration_label: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicStream {
    url: String,
    mime_type: String,
    bitrate: u64,
    #[serde(default, skip_serializing_if = "std::collections::BTreeMap::is_empty")]
    http_headers: std::collections::BTreeMap<String, String>,
}

impl MusicStream {
    fn request_headers(&self) -> Result<reqwest::header::HeaderMap, String> {
        let invalid = || "Music source returned invalid request headers".to_string();
        if self.http_headers.len() > 16 {
            return Err(invalid());
        }
        let mut headers = reqwest::header::HeaderMap::new();
        for (name, value) in &self.http_headers {
            if name.len() > 128 || value.len() > 8192 {
                return Err(invalid());
            }
            let name =
                reqwest::header::HeaderName::from_bytes(name.as_bytes()).map_err(|_| invalid())?;
            let value = reqwest::header::HeaderValue::from_str(value).map_err(|_| invalid())?;
            headers.insert(name, value);
        }
        Ok(headers)
    }
}

/// The video rendition of a track. `audio_url` is separate because YouTube only muxes audio
/// into video up to 720p; above that mpv plays the video and is handed the audio alongside it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicVideoStream {
    url: String,
    audio_url: Option<String>,
    #[serde(skip_serializing_if = "std::collections::BTreeMap::is_empty")]
    http_headers: std::collections::BTreeMap<String, String>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicSourceCandidate {
    connector_id: String,
    connector_name: String,
    health: connector::ConnectorHealth,
    track: MusicTrack,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicMigration {
    liked_ids: Option<Vec<String>>,
    recents: Option<Vec<MusicTrack>>,
    queue: Option<Vec<MusicTrack>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicBootstrap {
    liked_ids: Vec<String>,
    liked_tracks: Vec<MusicTrack>,
    recents: Vec<MusicTrack>,
    queue: Vec<MusicTrack>,
}

fn bootstrap(database: &db::MusicDb) -> Result<MusicBootstrap, String> {
    Ok(MusicBootstrap {
        liked_ids: store::liked_ids(database)?,
        liked_tracks: store::liked_tracks(database)?,
        recents: store::recents(database)?,
        queue: store::queue(database)?,
    })
}

const ACTIVE_NONE: u8 = 0;
const ACTIVE_STREAM: u8 = 1;
const ACTIVE_SPOTIFY: u8 = 2;

pub struct MusicState {
    db: db::MusicDb,
    registry: registry::ConnectorRegistry,
    engine: engine::MusicEngine,
    spotify: Arc<spotify::SpotifyState>,
    active_engine: AtomicU8,
    play_request: AtomicU64,
    play_commit: tokio::sync::Mutex<()>,
}

impl MusicState {
    pub fn new() -> Self {
        let registry = registry::ConnectorRegistry::new();
        let spotify = Arc::new(spotify::SpotifyState::new());
        connectors::register(&registry).expect("register music connectors");
        registry
            .register(Box::new(spotify::connector::SpotifyConnector::new(
                spotify.clone(),
            )))
            .expect("register Spotify connector");
        registry
            .register(Box::new(lastfm::LastFmConnector::new()))
            .expect("register Last.fm connector");
        Self {
            db: db::MusicDb::new(),
            engine: engine::MusicEngine::new(),
            registry,
            spotify,
            active_engine: AtomicU8::new(ACTIVE_NONE),
            play_request: AtomicU64::new(0),
            play_commit: tokio::sync::Mutex::new(()),
        }
    }

    fn set_active_engine(&self, engine: u8) {
        self.active_engine.store(engine, Ordering::SeqCst);
    }

    fn active_engine(&self) -> u8 {
        self.active_engine.load(Ordering::SeqCst)
    }

    fn begin_play_request(&self) -> u64 {
        self.play_request.fetch_add(1, Ordering::SeqCst) + 1
    }

    fn is_current_play_request(&self, request: u64) -> bool {
        self.play_request.load(Ordering::SeqCst) == request
    }
}

pub fn initialize(app: &tauri::AppHandle) -> Result<(), String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let state = app.state::<MusicState>();
    state.db.initialize(&directory.join("music.db"))?;
    state
        .engine
        .initialize_audio(directory.join("music-audio.json"));
    state.spotify.initialize(app, directory.join("spotify"));
    worker::initialize(app)
}

pub fn shutdown(app: &tauri::AppHandle) {
    let state = app.state::<MusicState>();
    state.engine.shutdown();
    state.spotify.shutdown();
}

pub fn try_run_connector_worker() -> bool {
    worker::try_run_from_args()
}

pub async fn pause_for_video(app: &tauri::AppHandle) -> Result<bool, String> {
    let state = app.state::<MusicState>();
    match state.active_engine() {
        ACTIVE_SPOTIFY => state.spotify.pause_for_video().await,
        ACTIVE_STREAM => state.engine.pause_for_video().await,
        _ => Ok(false),
    }
}

fn duration_label(seconds: u64) -> String {
    format!("{}:{:02}", seconds / 60, seconds % 60)
}
