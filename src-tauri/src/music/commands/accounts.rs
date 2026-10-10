use super::super::connectors::subsonic;
use super::super::{
    connector, lastfm, spotify, worker, MusicSourceCandidate, MusicState, MusicTrack, ACTIVE_NONE,
    ACTIVE_SPOTIFY,
};
use tauri::Manager;

#[tauri::command]
pub fn music_health(state: tauri::State<'_, MusicState>) -> Vec<connector::ConnectorHealthInfo> {
    state.registry.health()
}

#[tauri::command]
pub async fn music_source_candidates(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    track: MusicTrack,
) -> Result<Vec<MusicSourceCandidate>, String> {
    let candidates = state.registry.candidates(&app, &track).await;
    for candidate in &candidates {
        state.db.upsert_track(&candidate.track)?;
    }
    Ok(candidates)
}

#[tauri::command]
pub async fn music_spotify_status(
    state: tauri::State<'_, MusicState>,
) -> Result<spotify::SpotifyStatus, String> {
    let status = state.spotify.status().await?;
    if let Some(connector) = state.registry.get("spotify") {
        connector.set_health(if status.connected {
            connector::ConnectorHealth::Healthy
        } else {
            connector::ConnectorHealth::Unknown
        });
    }
    Ok(status)
}

#[tauri::command]
pub async fn music_spotify_connect(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
) -> Result<spotify::SpotifyStatus, String> {
    let result = state.spotify.connect_interactive(app).await;
    if let Some(connector) = state.registry.get("spotify") {
        connector.set_health(match &result {
            Ok(_) => connector::ConnectorHealth::Healthy,
            Err(error) if error.to_ascii_lowercase().contains("network") => {
                connector::ConnectorHealth::Offline
            }
            Err(_) => connector::ConnectorHealth::Degraded,
        });
    }
    result
}

#[tauri::command]
pub async fn music_spotify_devices(
    state: tauri::State<'_, MusicState>,
) -> Result<Vec<spotify::devices::SpotifyDevice>, String> {
    state.spotify.devices().await
}

#[tauri::command]
pub async fn music_spotify_set_device(
    state: tauri::State<'_, MusicState>,
    device: Option<String>,
) -> Result<(), String> {
    state.spotify.set_remote_device(device).await
}

#[tauri::command]
pub fn music_spotify_device(state: tauri::State<'_, MusicState>) -> Option<String> {
    state.spotify.remote_device()
}

#[tauri::command]
pub async fn music_spotify_disconnect(state: tauri::State<'_, MusicState>) -> Result<(), String> {
    state.spotify.disconnect().await?;
    if state.active_engine() == ACTIVE_SPOTIFY {
        state.set_active_engine(ACTIVE_NONE);
    }
    if let Some(connector) = state.registry.get("spotify") {
        connector.set_health(connector::ConnectorHealth::Unknown);
    }
    Ok(())
}

#[tauri::command]
pub async fn music_lastfm_auth(
    state: tauri::State<'_, MusicState>,
    api_key: String,
    api_secret: String,
) -> Result<lastfm::LastFmAuthStart, String> {
    let result = lastfm::begin_auth(&api_key, &api_secret).await;
    record_lastfm_health(state.inner(), &result);
    result
}

#[tauri::command]
pub async fn music_lastfm_complete_auth(
    state: tauri::State<'_, MusicState>,
    api_key: String,
    api_secret: String,
    token: String,
) -> Result<lastfm::LastFmSession, String> {
    let result = lastfm::complete_auth(&api_key, &api_secret, &token).await;
    record_lastfm_health(state.inner(), &result);
    result
}

#[tauri::command]
pub fn music_lastfm_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
) -> Result<lastfm::LastFmStatus, String> {
    let result = lastfm::status(&app);
    if let Ok(status) = &result {
        if let Some(connector) = state.registry.get("lastfm") {
            connector.set_health(if status.connected {
                connector::ConnectorHealth::Healthy
            } else {
                connector::ConnectorHealth::Unknown
            });
        }
    }
    result
}

fn record_lastfm_health<T>(state: &MusicState, result: &Result<T, String>) {
    if let Some(connector) = state.registry.get("lastfm") {
        connector.set_health(match result {
            Ok(_) => connector::ConnectorHealth::Healthy,
            Err(error) => lastfm::classify_error(error),
        });
    }
}

pub(crate) async fn scrobble_track(
    app: &tauri::AppHandle,
    track: &MusicTrack,
    started_at: u64,
) -> Result<bool, String> {
    if let Err(error) = subsonic::scrobble(app, track, started_at).await {
        eprintln!("[harbor::music] Subsonic scrobble failed: {error}");
    }
    let result = lastfm::scrobble(app, track, started_at).await;
    record_lastfm_health(app.state::<MusicState>().inner(), &result);
    result
}

#[tauri::command]
pub async fn run_connector_worker(
    app: tauri::AppHandle,
    connector_id: String,
    request: worker::ConnectorWorkerRequest,
) -> Result<worker::ConnectorWorkerResponse, String> {
    worker::run(&app, &connector_id, request).await
}
