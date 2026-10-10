use super::{api, SpotifyState};
use serde::Serialize;
use serde_json::{json, Value};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const NO_ACTIVE_DEVICE: &str =
    "That Spotify device is not reachable. Open Spotify on it, then try again.";
pub const PREMIUM_REQUIRED: &str =
    "Spotify only lets a Premium account drive its other devices.";

const POLL: Duration = Duration::from_millis(1500);
const IDLE_POLL: Duration = Duration::from_secs(5);
const END_WINDOW_MS: u64 = 4_000;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyDevice {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub active: bool,
    pub restricted: bool,
    pub volume_percent: Option<u64>,
}

fn parse(entry: &Value) -> Option<SpotifyDevice> {
    let id = entry.get("id").and_then(Value::as_str)?.trim().to_string();
    if id.is_empty() {
        return None;
    }
    Some(SpotifyDevice {
        name: entry
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("Spotify")
            .to_string(),
        kind: entry
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or("Unknown")
            .to_string(),
        active: entry
            .get("is_active")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        restricted: entry
            .get("is_restricted")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        volume_percent: entry.get("volume_percent").and_then(Value::as_u64),
        id,
    })
}

fn describe(error: api::ApiError) -> String {
    match error.status {
        Some(404) => NO_ACTIVE_DEVICE.to_string(),
        Some(403) => PREMIUM_REQUIRED.to_string(),
        _ => error.message,
    }
}

pub async fn list(state: &SpotifyState) -> Result<Vec<SpotifyDevice>, String> {
    let token = state.web_token().await?;
    let body = api::devices(state.http(), &token).await.map_err(describe)?;
    Ok(body
        .get("devices")
        .and_then(Value::as_array)
        .map(|rows| rows.iter().filter_map(parse).collect())
        .unwrap_or_default())
}

async fn command(
    state: &SpotifyState,
    path: &str,
    device: &str,
    extra: &[(&str, String)],
    body: Option<Value>,
) -> Result<(), String> {
    let token = state.web_token().await?;
    let mut query = vec![("device_id", device.to_string())];
    query.extend(extra.iter().map(|(key, value)| (*key, value.clone())));
    api::player_command(state.http(), &token, path, &query, body)
        .await
        .map_err(describe)
}

pub async fn start(state: &SpotifyState, device: &str, uri: &str) -> Result<(), String> {
    command(
        state,
        "/me/player/play",
        device,
        &[],
        Some(json!({ "uris": [uri] })),
    )
    .await
}

pub async fn set_paused(state: &SpotifyState, device: &str, paused: bool) -> Result<(), String> {
    let path = if paused {
        "/me/player/pause"
    } else {
        "/me/player/play"
    };
    command(state, path, device, &[], None).await
}

pub async fn seek(state: &SpotifyState, device: &str, position_ms: u64) -> Result<(), String> {
    command(
        state,
        "/me/player/seek",
        device,
        &[("position_ms", position_ms.to_string())],
        None,
    )
    .await
}

pub async fn set_volume(state: &SpotifyState, device: &str, percent: u64) -> Result<(), String> {
    command(
        state,
        "/me/player/volume",
        device,
        &[("volume_percent", percent.min(100).to_string())],
        None,
    )
    .await
}

fn emit(app: &AppHandle, payload: Value) {
    let _ = app.emit("music://event", payload);
}

/// The remote device reports nothing on its own, so its progress is polled back into the same
/// events the local player raises and the dock stays in sync without knowing the difference.
pub fn watch(state: &Arc<SpotifyState>, app: AppHandle, uri: String) {
    let generation = state.remote_watch.fetch_add(1, Ordering::SeqCst) + 1;
    let state = state.clone();
    tauri::async_runtime::spawn(async move {
        let mut loaded = false;
        let mut furthest_ms = 0_u64;
        let mut duration_ms = 0_u64;
        let mut delay = POLL;
        loop {
            tokio::time::sleep(delay).await;
            if state.remote_watch.load(Ordering::SeqCst) != generation {
                return;
            }
            let Ok(token) = state.web_token().await else {
                return;
            };
            let body = match api::player_state(state.http(), &token).await {
                Ok(Some(body)) => body,
                Ok(None) => continue,
                Err(_) => continue,
            };
            let playing = body
                .get("is_playing")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let position = body.get("progress_ms").and_then(Value::as_u64).unwrap_or(0);
            let current = body
                .pointer("/item/uri")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if let Some(length) = body.pointer("/item/duration_ms").and_then(Value::as_u64) {
                duration_ms = length;
            }
            if !current.is_empty() && current != uri {
                return;
            }
            if position > furthest_ms {
                furthest_ms = position;
            }
            delay = if playing { POLL } else { IDLE_POLL };
            if !loaded && playing {
                loaded = true;
                emit(&app, json!({ "event": "file-loaded" }));
            }
            emit(
                &app,
                json!({
                    "event": "property-change",
                    "name": "time-pos",
                    "data": position as f64 / 1000.0,
                }),
            );
            emit(
                &app,
                json!({
                    "event": "property-change",
                    "name": "pause",
                    "data": !playing,
                }),
            );
            let finished = duration_ms > 0 && furthest_ms + END_WINDOW_MS >= duration_ms;
            if loaded && !playing && finished {
                emit(&app, json!({ "event": "end-file", "reason": "eof" }));
                return;
            }
        }
    });
}

pub fn stop_watching(state: &SpotifyState) {
    state.remote_watch.fetch_add(1, Ordering::SeqCst);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_device_without_an_id_cannot_be_targeted() {
        assert!(parse(&json!({ "name": "Phone" })).is_none());
        assert!(parse(&json!({ "id": "   ", "name": "Phone" })).is_none());
    }

    #[test]
    fn a_device_keeps_the_fields_the_picker_shows() {
        let device = parse(&json!({
            "id": "abc",
            "name": "Kitchen",
            "type": "Speaker",
            "is_active": true,
            "is_restricted": false,
            "volume_percent": 40
        }))
        .expect("device");
        assert_eq!(device.id, "abc");
        assert_eq!(device.name, "Kitchen");
        assert_eq!(device.kind, "Speaker");
        assert!(device.active);
        assert_eq!(device.volume_percent, Some(40));
    }

    #[test]
    fn spotify_status_codes_become_the_advice_that_fits_them() {
        let missing = api::ApiError {
            status: Some(404),
            message: "x".to_string(),
        };
        assert_eq!(describe(missing), NO_ACTIVE_DEVICE);
        let refused = api::ApiError {
            status: Some(403),
            message: "x".to_string(),
        };
        assert_eq!(describe(refused), PREMIUM_REQUIRED);
    }
}
