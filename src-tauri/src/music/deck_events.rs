use super::spectrum;
use crate::music::MusicTrack;
use libmpv2::events::{Event, EventContext, PropertyData};
use libmpv2::Mpv;
use serde::Serialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub(super) struct EventLoop {
    pub(super) app: AppHandle,
    pub(super) mpv: Arc<Mpv>,
    pub(super) context: EventContext,
    pub(super) active_generation: Arc<AtomicU64>,
    pub(super) generation: u64,
    pub(super) track: MusicTrack,
    pub(super) started_at: u64,
    pub(super) local_path: Option<PathBuf>,
    pub(super) spectrum: Arc<std::sync::Mutex<spectrum::Spectrum>>,
}

pub(super) fn spawn_event_loop(loop_state: EventLoop) {
    let EventLoop {
        app,
        mpv,
        mut context,
        active_generation,
        generation,
        track,
        started_at,
        local_path,
        spectrum,
    } = loop_state;
    std::thread::spawn(move || {
        let mut last_position_event = Instant::now() - Duration::from_secs(1);
        let mut previous_position = None;
        let mut listened_seconds = 0.0;
        let mut duration_seconds = track.duration_seconds as f64;
        let mut scrobble_started = false;
        let mut quality_started = false;
        let mut eof_signaled = false;
        loop {
            if active_generation.load(Ordering::SeqCst) != generation {
                break;
            }
            match context.wait_event(0.25) {
                Some(Ok(event)) => {
                    if let Event::LogMessage { prefix, text, .. } = &event {
                        if *prefix == "ffmpeg" {
                            if let Ok(mut spectrum) = spectrum.lock() {
                                spectrum.ingest(text);
                            }
                        }
                        continue;
                    }
                    if matches!(event, Event::Seek) {
                        if let Ok(mut spectrum) = spectrum.lock() {
                            spectrum.clear();
                        }
                    }
                    if matches!(event, Event::FileLoaded) && !quality_started {
                        quality_started = true;
                        let quality_app = app.clone();
                        let quality_mpv = mpv.clone();
                        let quality_generation = active_generation.clone();
                        let quality_track = track.clone();
                        let quality_path = local_path.clone();
                        // File properties are read once, away from both UI and mpv event delivery.
                        std::thread::spawn(move || {
                            let quality = audio_quality(&quality_mpv, quality_path.as_deref());
                            if quality_generation.load(Ordering::SeqCst) == generation {
                                let _ = quality_app.emit(
                                    "music://event",
                                    json!({
                                        "event": "audio-quality",
                                        "trackId": quality_track.id,
                                        "connectorId": quality_track.connector_id,
                                        "quality": quality,
                                    }),
                                );
                            }
                        });
                    }
                    let mut natural_eof = false;
                    if let Event::PropertyChange { name, change, .. } = &event {
                        if *name == "time-pos" {
                            if let PropertyData::Double(position) = change {
                                listened_seconds +=
                                    listened_increment(previous_position, *position);
                                previous_position = Some(*position);
                            }
                            if last_position_event.elapsed() < Duration::from_millis(200) {
                                continue;
                            }
                            last_position_event = Instant::now();
                        } else if *name == "duration" {
                            if let PropertyData::Double(duration) = change {
                                if duration.is_finite() && *duration > 0.0 {
                                    duration_seconds = *duration;
                                }
                            }
                        } else if *name == "eof-reached" {
                            if let PropertyData::Flag(reached) = change {
                                if *reached && !eof_signaled {
                                    eof_signaled = true;
                                    natural_eof = true;
                                } else if !*reached {
                                    eof_signaled = false;
                                }
                            }
                        }
                    }
                    if (matches!(event, Event::EndFile(_)) || natural_eof)
                        && !scrobble_started
                        && should_scrobble(listened_seconds, duration_seconds)
                    {
                        scrobble_started = true;
                        let scrobble_app = app.clone();
                        let scrobble_track = track.clone();
                        tauri::async_runtime::spawn(async move {
                            match crate::music::commands::scrobble_track(
                                &scrobble_app,
                                &scrobble_track,
                                started_at,
                            )
                            .await
                            {
                                Ok(true) => {
                                    let _ = scrobble_app
                                        .emit("music://lastfm", json!({ "status": "scrobbled" }));
                                }
                                Ok(false) => {}
                                Err(error) => {
                                    eprintln!("[harbor::music] Last.fm scrobble failed: {error}");
                                    let _ = scrobble_app.emit(
                                        "music://lastfm",
                                        json!({ "status": "error", "message": error }),
                                    );
                                }
                            }
                        });
                    }
                    let shutdown = matches!(event, Event::Shutdown);
                    if let Some(mut payload) = event_payload(event) {
                        payload["trackId"] = json!(track.id);
                        payload["connectorId"] = json!(track.connector_id);
                        let _ = app.emit("music://event", payload);
                    }
                    if natural_eof {
                        let _ = app.emit(
                            "music://event",
                            json!({ "event": "end-file", "reason": "eof", "trackId": track.id, "connectorId": track.connector_id }),
                        );
                    }
                    if shutdown {
                        break;
                    }
                }
                Some(Err(error)) => {
                    let _ = app.emit(
                        "music://event",
                        json!({ "event": "player-failure", "reason": error.to_string(), "trackId": track.id, "connectorId": track.connector_id }),
                    );
                    break;
                }
                None => {}
            }
        }
        drop(mpv);
    });
}

pub(super) fn spawn_drain_loop(
    mpv: Arc<Mpv>,
    mut context: EventContext,
    active_generation: Arc<AtomicU64>,
    generation: u64,
) {
    std::thread::spawn(move || {
        loop {
            if active_generation.load(Ordering::SeqCst) != generation {
                break;
            }
            if matches!(context.wait_event(0.25), Some(Ok(Event::Shutdown))) {
                break;
            }
        }
        drop(mpv);
    });
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct AudioQuality {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) codec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) sample_rate_hz: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) bit_depth: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) bitrate_kbps: Option<f64>,
}

pub(super) fn audio_quality(mpv: &Mpv, local_path: Option<&Path>) -> AudioQuality {
    let mut quality = AudioQuality {
        codec: mpv
            .get_property::<String>("current-tracks/audio/codec")
            .ok()
            .filter(|value| !value.is_empty() && value.len() <= 80),
        sample_rate_hz: mpv
            .get_property::<i64>("audio-params/samplerate")
            .ok()
            .and_then(|value| u32::try_from(value).ok())
            .filter(|value| *value > 0 && *value <= 3_072_000),
        bitrate_kbps: mpv
            .get_property::<f64>("audio-bitrate")
            .ok()
            .filter(|value| value.is_finite() && *value > 0.0 && *value <= 100_000_000.0)
            .map(|value| value / 1000.0),
        ..AudioQuality::default()
    };
    if let Some(path) = local_path {
        if let Some(properties) = local_audio_properties(path) {
            // audio-params/format describes decoder packing (e.g. s32 for 24-bit
            // FLAC), so only file properties may supply the source bit depth.
            quality.bit_depth = properties
                .bit_depth()
                .filter(|value| *value > 0 && *value <= 64);
            quality.sample_rate_hz = quality.sample_rate_hz.or(properties
                .sample_rate()
                .filter(|value| *value > 0 && *value <= 3_072_000));
            quality.bitrate_kbps = quality.bitrate_kbps.or(properties
                .audio_bitrate()
                .filter(|value| *value > 0 && *value <= 100_000)
                .map(f64::from));
        }
    }
    quality
}

fn local_audio_properties(path: &Path) -> Option<lofty::properties::FileProperties> {
    use lofty::file::AudioFile;
    let tagged = lofty::probe::Probe::open(path)
        .ok()?
        .guess_file_type()
        .ok()?
        .options(
            lofty::config::ParseOptions::new()
                .read_tags(false)
                .read_cover_art(false),
        )
        .read()
        .ok()?;
    Some(tagged.properties().clone())
}

fn event_payload(event: Event) -> Option<Value> {
    match event {
        Event::PropertyChange { name, change, .. } => {
            let data = match change {
                PropertyData::Str(value) => Value::String(value.to_string()),
                PropertyData::OsdStr(value) => Value::String(value.to_string()),
                PropertyData::Flag(value) => Value::Bool(value),
                PropertyData::Int64(value) => json!(value),
                PropertyData::Double(value) => json!(value),
                PropertyData::Node(_) => return None,
            };
            Some(json!({ "event": "property-change", "name": name, "data": data }))
        }
        Event::EndFile(reason) => Some(json!({
            "event": "end-file",
            "reason": match reason {
                0 => "eof",
                2 => "stop",
                3 => "quit",
                4 => "error",
                5 => "redirect",
                _ => "other",
            }
        })),
        Event::FileLoaded => Some(json!({ "event": "file-loaded" })),
        Event::PlaybackRestart => Some(json!({ "event": "playback-restart" })),
        Event::Seek => Some(json!({ "event": "seek" })),
        Event::Shutdown => Some(json!({ "event": "shutdown" })),
        _ => None,
    }
}

pub(in crate::music) fn listened_increment(previous: Option<f64>, current: f64) -> f64 {
    let Some(previous) = previous else {
        return 0.0;
    };
    let delta = current - previous;
    if current.is_finite() && delta.is_finite() && delta > 0.0 && delta <= 2.0 {
        delta
    } else {
        0.0
    }
}

pub(in crate::music) fn should_scrobble(listened_seconds: f64, duration_seconds: f64) -> bool {
    let threshold = if duration_seconds.is_finite() && duration_seconds > 0.0 {
        (duration_seconds * 0.5).min(240.0)
    } else {
        240.0
    };
    listened_seconds >= threshold
}
