use super::deck_events::{self, EventLoop};
use super::telemetry;
use super::{core_setup, spectrum, NativeFlag};
use crate::music::audio::MusicAudioSettings;
use crate::music::{MusicStream, MusicTrack};
use libmpv2::events::EventContext;
use libmpv2::{Format, Mpv};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tokio::sync::Mutex;

pub(super) const DECK_LABELS: [&str; 2] = ["Harbor Music", "Harbor Music B"];

pub(super) struct MusicSession {
    pub(super) mpv: Arc<Mpv>,
    pub(super) track_id: String,
    pub(super) connector_id: Option<String>,
    pub(super) spectrum: Arc<std::sync::Mutex<spectrum::Spectrum>>,
}

pub(super) struct DeckPlay<'a> {
    pub(super) app: AppHandle,
    pub(super) stream: MusicStream,
    pub(super) track: MusicTrack,
    pub(super) volume: f64,
    pub(super) settings: &'a MusicAudioSettings,
    pub(super) device: Option<&'a str>,
    pub(super) meter: bool,
}

pub(super) struct MusicDeck {
    pub(super) inner: Arc<Mutex<Option<MusicSession>>>,
    pub(super) generation: Arc<AtomicU64>,
    paused_for_video: AtomicBool,
    pub(super) volume: std::sync::Mutex<f64>,
    pub(super) gain: std::sync::Mutex<f64>,
    pub(super) index: usize,
}

impl MusicDeck {
    pub(super) fn new(index: usize) -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
            generation: Arc::new(AtomicU64::new(0)),
            paused_for_video: AtomicBool::new(false),
            volume: std::sync::Mutex::new(0.82),
            gain: std::sync::Mutex::new(if index == 0 { 1.0 } else { 0.0 }),
            index,
        }
    }

    pub(super) async fn play(&self, request: DeckPlay<'_>) -> Result<(), String> {
        request.stream.request_headers()?;
        let url = request.stream.url.clone();
        if url.trim().is_empty() {
            return Err("Music stream URL is empty".to_string());
        }
        let mut slot = self.inner.lock().await;
        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        self.paused_for_video.store(false, Ordering::SeqCst);
        retire_session(&mut slot).await?;

        let mpv = core_setup::create_core(DECK_LABELS[self.index])?;
        core_setup::apply_stream_headers(&mpv, &request.stream)?;
        core_setup::apply_network_cache(&mpv);
        let settings = request.settings;
        let wanted = request.device.unwrap_or(settings.device.as_str());
        let available = core_setup::read_music_audio_devices(&mpv).unwrap_or_default();
        let device_available =
            wanted == "auto" || available.iter().any(|device| device.name == wanted);
        core_setup::apply_music_audio(
            &mpv,
            settings,
            if device_available { wanted } else { "auto" },
            request.meter,
        )?;
        let clamped = settings.clamp_volume(request.volume);
        let volume = if device_available {
            clamped
        } else {
            clamped.min(1.0)
        };
        if let Ok(mut current) = self.volume.lock() {
            *current = volume;
        }
        let _ = mpv.set_property("volume", self.level() * 100.0);

        let mpv = Arc::new(mpv);
        let spectrum = Arc::new(std::sync::Mutex::new(spectrum::Spectrum::default()));
        telemetry::request_logs(&mpv, request.meter);
        let event_context = EventContext::new(mpv.ctx);
        for (name, format, id) in [
            ("time-pos", Format::Double, 1),
            ("duration", Format::Double, 2),
            ("pause", Format::Flag, 3),
            ("volume", Format::Double, 4),
            ("eof-reached", Format::Flag, 5),
        ] {
            event_context
                .observe_property(name, format, id)
                .map_err(|error| format!("observe music property {name}: {error}"))?;
        }
        // The string-command wrapper splits paths containing spaces. Share the
        // argument-vector command used by the main player instead.
        crate::mpv::mpv_argv_command(&mpv, &["loadfile", url.as_str(), "replace"])
            .map_err(|error| format!("music loadfile: {error}"))?;
        let local_path = (request.track.connector_id.as_deref() == Some("local")
            && Path::new(url.as_str()).is_absolute())
        .then(|| PathBuf::from(url.as_str()));
        let track_id = request.track.id.clone();
        let connector_id = request.track.connector_id.clone();
        if self.index == 0 {
            deck_events::spawn_event_loop(EventLoop {
                app: request.app,
                mpv: mpv.clone(),
                context: event_context,
                active_generation: self.generation.clone(),
                generation,
                track: request.track,
                started_at: unix_seconds(),
                local_path,
                spectrum: spectrum.clone(),
            });
        } else {
            deck_events::spawn_drain_loop(
                mpv.clone(),
                event_context,
                self.generation.clone(),
                generation,
            );
        }
        *slot = Some(MusicSession {
            mpv,
            track_id,
            connector_id,
            spectrum,
        });
        Ok(())
    }

    /// Whether this deck is silent only because a video took over, which is the one case
    /// where offering to start it again is meaningful.
    pub(super) fn paused_for_video(&self) -> bool {
        self.paused_for_video.load(Ordering::SeqCst)
    }

    pub(super) async fn pause_for_video(&self) -> Result<bool, String> {
        let slot = self.inner.lock().await;
        let Some(session) = slot.as_ref() else {
            return Ok(false);
        };
        let paused = session
            .mpv
            .get_property::<NativeFlag>("pause")
            .map_err(|error| format!("read music pause state: {error}"))?;
        if paused.0 != 0 {
            self.paused_for_video.store(false, Ordering::SeqCst);
            return Ok(false);
        }
        session
            .mpv
            .set_property("pause", true)
            .map_err(|error| format!("pause music for video: {error}"))?;
        self.paused_for_video.store(true, Ordering::SeqCst);
        Ok(true)
    }

    pub(super) async fn set_paused(&self, paused: bool) -> Result<(), String> {
        self.paused_for_video.store(false, Ordering::SeqCst);
        let slot = self.inner.lock().await;
        let Some(session) = slot.as_ref() else {
            return Ok(());
        };
        if !paused
            && session
                .mpv
                .get_property::<NativeFlag>("eof-reached")
                .is_ok_and(|value| value.0 != 0)
            && !session
                .mpv
                .get_property::<NativeFlag>("seeking")
                .is_ok_and(|value| value.0 != 0)
        {
            // keep-open holds a finished file in a paused EOF state. Unpausing
            // alone cannot restart it; an explicit Play begins the track again.
            session
                .mpv
                .command("seek", &["0", "absolute+exact"])
                .map_err(|error| format!("music restart after end: {error}"))?;
        }
        session
            .mpv
            .set_property("pause", paused)
            .map_err(|error| format!("music pause: {error}"))
    }

    pub(super) async fn seek(&self, position: f64) -> Result<(), String> {
        self.seek_with(position, "absolute").await
    }

    pub(super) async fn seek_exact(&self, position: f64) -> Result<(), String> {
        self.seek_with(position, "absolute+exact").await
    }

    async fn seek_with(&self, position: f64, mode: &str) -> Result<(), String> {
        if !position.is_finite() {
            return Err("Music seek position is invalid".to_string());
        }
        let slot = self.inner.lock().await;
        let Some(session) = slot.as_ref() else {
            return Ok(());
        };
        let position = position.max(0.0).to_string();
        session
            .mpv
            .command("seek", &[position.as_str(), mode])
            .map_err(|error| format!("music seek: {error}"))
    }

    pub(super) async fn set_loop(&self, start: Option<f64>, end: Option<f64>) -> Result<(), String> {
        let slot = self.inner.lock().await;
        let Some(session) = slot.as_ref() else {
            return Ok(());
        };
        let point = |value: Option<f64>| match value {
            Some(value) if value.is_finite() && value >= 0.0 => format!("{value:.3}"),
            _ => "no".to_string(),
        };
        session
            .mpv
            .set_property("ab-loop-a", point(start).as_str())
            .map_err(|error| format!("music loop in: {error}"))?;
        session
            .mpv
            .set_property("ab-loop-b", point(end).as_str())
            .map_err(|error| format!("music loop out: {error}"))
    }

    pub(super) async fn scratch(
        &self,
        position: f64,
        rate: f64,
        holding: bool,
        settings: &MusicAudioSettings,
    ) -> Result<f64, String> {
        if !position.is_finite() || !rate.is_finite() {
            return Err("Music scratch input is invalid".to_string());
        }
        let slot = self.inner.lock().await;
        let Some(session) = slot.as_ref() else {
            return Ok(position.max(0.0));
        };
        let mpv = &session.mpv;
        let position = position.max(0.0);
        if !holding {
            let _ = mpv.set_property(
                "audio-pitch-correction",
                if settings.keep_pitch { "yes" } else { "no" },
            );
            let _ = mpv.set_property("speed", settings.speed);
            let target = format!("{position:.3}");
            let _ = mpv.command("seek", &[target.as_str(), "absolute+exact"]);
            return Ok(position);
        }
        let _ = mpv.set_property("audio-pitch-correction", "no");
        if rate > 0.04 {
            let _ = mpv.set_property("speed", rate.min(4.0));
        } else {
            let _ = mpv.set_property("speed", rate.abs().clamp(0.25, 4.0));
            let target = format!("{position:.3}");
            let _ = mpv.command("seek", &[target.as_str(), "absolute+exact"]);
        }
        Ok(mpv.get_property::<f64>("time-pos").unwrap_or(position))
    }

    pub(super) async fn set_volume(&self, volume: f64) -> Result<(), String> {
        if let Ok(mut current) = self.volume.lock() {
            *current = volume;
        }
        self.push_volume().await
    }

    pub(super) async fn set_gain(&self, gain: f64) -> Result<(), String> {
        if let Ok(mut current) = self.gain.lock() {
            *current = if gain.is_finite() {
                gain.clamp(0.0, 1.0)
            } else {
                1.0
            };
        }
        self.push_volume().await
    }

    async fn push_volume(&self) -> Result<(), String> {
        let level = self.level();
        let slot = self.inner.lock().await;
        let Some(session) = slot.as_ref() else {
            return Ok(());
        };
        session
            .mpv
            .set_property("volume", level * 100.0)
            .map_err(|error| format!("music volume: {error}"))
    }

    fn level(&self) -> f64 {
        let volume = self.volume.lock().map(|value| *value).unwrap_or(0.82);
        let gain = self.gain.lock().map(|value| *value).unwrap_or(1.0);
        volume * gain
    }

    pub(super) async fn set_muted(&self, muted: bool) -> Result<(), String> {
        let slot = self.inner.lock().await;
        let Some(session) = slot.as_ref() else {
            return Ok(());
        };
        session
            .mpv
            .set_property("mute", if muted { "yes" } else { "no" })
            .map_err(|error| format!("music mute: {error}"))
    }

    pub(super) async fn source_path(&self) -> Option<String> {
        let slot = self.inner.lock().await;
        let session = slot.as_ref()?;
        session
            .mpv
            .get_property::<String>("path")
            .ok()
            .filter(|value| !value.is_empty())
    }

    pub(super) async fn is_live(&self) -> bool {
        self.inner.lock().await.is_some()
    }

    pub(super) async fn stop(&self, unpause: bool) -> Result<(), String> {
        if unpause {
            if !self.paused_for_video.swap(false, Ordering::SeqCst) {
                return Ok(());
            }
            let slot = self.inner.lock().await;
            let Some(session) = slot.as_ref() else {
                return Ok(());
            };
            return session
                .mpv
                .set_property("pause", false)
                .map_err(|error| format!("resume music: {error}"));
        }
        self.paused_for_video.store(false, Ordering::SeqCst);
        self.generation.fetch_add(1, Ordering::SeqCst);
        let mut slot = self.inner.lock().await;
        retire_session(&mut slot).await
    }

    pub(super) fn shutdown(&self) {
        self.paused_for_video.store(false, Ordering::SeqCst);
        self.generation.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut slot) = self.inner.try_lock() {
            if let Some(session) = slot.take() {
                let _ = session.mpv.command("quit", &[]);
            }
        }
    }
}

fn unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// libmpv teardown resets FFmpeg's process-wide log callback. Every owner of the
/// outgoing context must drain before the next context initializes that callback.
pub(super) async fn retire_session(slot: &mut Option<MusicSession>) -> Result<(), String> {
    let Some(mut previous) = slot.take() else {
        return Ok(());
    };
    let _ = previous.mpv.command("quit", &[]);
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        match Arc::try_unwrap(previous.mpv) {
            Ok(mpv) => {
                tokio::task::spawn_blocking(move || drop(mpv))
                    .await
                    .map_err(|error| format!("music player teardown: {error}"))?;
                return Ok(());
            }
            Err(mpv) => {
                previous.mpv = mpv;
                if Instant::now() >= deadline {
                    // Keep ownership: another play attempt must finish this teardown,
                    // never initialize a successor while old worker references remain.
                    *slot = Some(previous);
                    return Err("Music player is still shutting down. Try again.".to_string());
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        }
    }
}
