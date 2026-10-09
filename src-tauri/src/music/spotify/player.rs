use super::super::MusicTrack;
use librespot_core::session::Session;
use librespot_core::SpotifyUri;
use librespot_playback::audio_backend;
use librespot_playback::config::{AudioFormat, Bitrate, PlayerConfig};
use librespot_playback::mixer::softmixer::SoftMixer;
use librespot_playback::mixer::{Mixer, MixerConfig};
use librespot_playback::player::{Player, PlayerEvent};
use parking_lot::RwLock;
use serde_json::json;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

pub struct PlaybackContext {
    pub track: MusicTrack,
    pub started_at: u64,
    listened_seconds: f64,
    request_id: Option<u64>,
    previous_position: Option<f64>,
}

pub struct SpotifyPlayer {
    pub player: Arc<Player>,
    pub mixer: Arc<dyn Mixer>,
    pub current: Arc<RwLock<Option<PlaybackContext>>>,
}

pub fn start(app: AppHandle, session: Session) -> Result<SpotifyPlayer, String> {
    let mixer: Arc<dyn Mixer> = Arc::new(
        SoftMixer::open(MixerConfig::default())
            .map_err(|error| format!("open Spotify volume mixer: {error}"))?,
    );
    let sink_builder = audio_backend::find(None)
        .ok_or_else(|| "No Spotify audio output backend is available".to_string())?;
    let config = PlayerConfig {
        bitrate: Bitrate::Bitrate320,
        gapless: true,
        position_update_interval: Some(Duration::from_millis(250)),
        ..Default::default()
    };
    let player = Player::new(config, session, mixer.get_soft_volume(), move || {
        sink_builder(None, AudioFormat::F32)
    });
    let current = Arc::new(RwLock::new(None));
    spawn_events(app, player.clone(), current.clone());
    Ok(SpotifyPlayer {
        player,
        mixer,
        current,
    })
}

pub fn play(runtime: &SpotifyPlayer, track: MusicTrack) -> Result<(), String> {
    let source_id = track
        .source_id
        .as_deref()
        .ok_or_else(|| "Spotify track is missing its URI".to_string())?;
    let uri = SpotifyUri::from_uri(source_id)
        .map_err(|error| format!("Invalid Spotify track URI: {error}"))?;
    *runtime.current.write() = Some(PlaybackContext {
        listened_seconds: 0.0,
        previous_position: None,
        request_id: None,
        track,
        started_at: unix_seconds(),
    });
    runtime.player.load(uri, true, 0);
    Ok(())
}

fn spawn_events(
    app: AppHandle,
    player: Arc<Player>,
    current: Arc<RwLock<Option<PlaybackContext>>>,
) {
    let mut events = player.get_player_event_channel();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                PlayerEvent::Loading {
                    play_request_id,
                    track_id,
                    ..
                } => {
                    bind_request(&current, play_request_id, &track_id);
                }
                PlayerEvent::Playing {
                    play_request_id,
                    position_ms,
                    ..
                } => {
                    if !record_position(&current, play_request_id, position_ms) {
                        continue;
                    }
                    let _ = app.emit(
                        "music://event",
                        json!({ "event": "property-change", "name": "time-pos", "data": position_ms as f64 / 1000.0 }),
                    );
                    let _ = app.emit(
                        "music://event",
                        json!({ "event": "property-change", "name": "pause", "data": false }),
                    );
                    let _ = app.emit("music://event", json!({ "event": "file-loaded" }));
                }
                PlayerEvent::Paused {
                    play_request_id,
                    position_ms,
                    ..
                } => {
                    if !record_position(&current, play_request_id, position_ms) {
                        continue;
                    }
                    let _ = app.emit(
                        "music://event",
                        json!({ "event": "property-change", "name": "time-pos", "data": position_ms as f64 / 1000.0 }),
                    );
                    let _ = app.emit(
                        "music://event",
                        json!({ "event": "property-change", "name": "pause", "data": true }),
                    );
                }
                PlayerEvent::PositionChanged {
                    play_request_id,
                    position_ms,
                    ..
                }
                | PlayerEvent::PositionCorrection {
                    play_request_id,
                    position_ms,
                    ..
                }
                | PlayerEvent::Seeked {
                    play_request_id,
                    position_ms,
                    ..
                } => {
                    if !record_position(&current, play_request_id, position_ms) {
                        continue;
                    }
                    let _ = app.emit(
                        "music://event",
                        json!({ "event": "property-change", "name": "time-pos", "data": position_ms as f64 / 1000.0 }),
                    );
                }
                PlayerEvent::VolumeChanged { volume } => {
                    let _ = app.emit(
                        "music://event",
                        json!({ "event": "property-change", "name": "volume", "data": volume as f64 * 100.0 / 65535.0 }),
                    );
                }
                PlayerEvent::EndOfTrack {
                    play_request_id, ..
                } => {
                    let Some(context) = finish_context(&current, play_request_id) else {
                        continue;
                    };
                    scrobble_current(&app, context);
                    let _ = app.emit(
                        "music://event",
                        json!({ "event": "end-file", "reason": "eof" }),
                    );
                }
                PlayerEvent::Unavailable {
                    play_request_id, ..
                } => {
                    if finish_context(&current, play_request_id).is_none() {
                        continue;
                    }
                    let _ = app.emit(
                        "music://event",
                        json!({ "event": "player-failure", "reason": "Spotify track is unavailable" }),
                    );
                }
                _ => {}
            }
        }
    });
}

fn scrobble_current(app: &AppHandle, context: PlaybackContext) {
    if !super::super::engine::should_scrobble(
        context.listened_seconds,
        context.track.duration_seconds as f64,
    ) {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match super::super::commands::scrobble_track(&app, &context.track, context.started_at).await
        {
            Ok(true) => {
                let _ = app.emit("music://lastfm", json!({ "status": "scrobbled" }));
            }
            Ok(false) => {}
            Err(error) => {
                let _ = app.emit(
                    "music://lastfm",
                    json!({ "status": "error", "message": error }),
                );
            }
        }
    });
}

fn bind_request(
    current: &Arc<RwLock<Option<PlaybackContext>>>,
    request_id: u64,
    track_id: &SpotifyUri,
) -> bool {
    let Ok(track_uri) = track_id.to_uri() else {
        return false;
    };
    let mut slot = current.write();
    let Some(context) = slot.as_mut() else {
        return false;
    };
    if context.track.source_id.as_deref() != Some(track_uri.as_str()) {
        return false;
    }
    context.request_id = Some(request_id);
    true
}

fn record_position(
    current: &Arc<RwLock<Option<PlaybackContext>>>,
    request_id: u64,
    position_ms: u32,
) -> bool {
    let mut slot = current.write();
    let Some(context) = slot.as_mut() else {
        return false;
    };
    if context.request_id != Some(request_id) {
        return false;
    }
    let position = position_ms as f64 / 1000.0;
    context.listened_seconds +=
        super::super::engine::listened_increment(context.previous_position, position);
    context.previous_position = Some(position);
    true
}

fn finish_context(
    current: &Arc<RwLock<Option<PlaybackContext>>>,
    request_id: u64,
) -> Option<PlaybackContext> {
    let mut slot = current.write();
    if slot.as_ref()?.request_id != Some(request_id) {
        return None;
    }
    slot.take()
}

fn unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context(duration_seconds: u64) -> Arc<RwLock<Option<PlaybackContext>>> {
        Arc::new(RwLock::new(Some(PlaybackContext {
            track: MusicTrack {
                explicit: None,
                version: None,
                media_kind: None,
                id: "spotify:track:test".to_string(),
                connector_id: Some("spotify".to_string()),
                source_id: Some("spotify:track:test".to_string()),
                playback_url: None,
                title: "Hysteria".to_string(),
                artist: "Muse".to_string(),
                album: None,
                artwork: String::new(),
                duration_seconds,
                duration_label: "3:47".to_string(),
            },
            started_at: 1,
            listened_seconds: 0.0,
            previous_position: None,
            request_id: Some(1),
        })))
    }

    #[test]
    fn spotify_scrobble_tracking_ignores_seek_jumps() {
        let current = context(300);
        record_position(&current, 1, 10_000);
        record_position(&current, 1, 120_000);
        let listened = current.read().as_ref().unwrap().listened_seconds;
        assert_eq!(listened, 0.0);
        let context = finish_context(&current, 1).expect("matching request");
        assert!(!super::super::super::engine::should_scrobble(
            context.listened_seconds,
            context.track.duration_seconds as f64,
        ));
    }

    #[test]
    fn duplicate_end_events_cannot_scrobble_twice() {
        let current = context(100);
        {
            let mut slot = current.write();
            slot.as_mut().unwrap().listened_seconds = 50.0;
        }
        assert!(finish_context(&current, 1).is_some());
        assert!(finish_context(&current, 1).is_none());
    }

    #[test]
    fn old_end_event_cannot_finish_new_request() {
        let current = context(100);
        {
            let mut slot = current.write();
            slot.as_mut().unwrap().request_id = Some(2);
        }
        assert!(finish_context(&current, 1).is_none());
        assert!(current.read().is_some());
        assert!(finish_context(&current, 2).is_some());
    }
}
