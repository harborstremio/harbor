use super::audio::MusicAudioSettings;
use super::{MusicStream, MusicTrack};
use broadcast::{BroadcastController, BroadcastStart};
use deck::{DeckPlay, MusicDeck};
use libmpv2::Format;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::AppHandle;

#[path = "telemetry.rs"]
mod telemetry;
#[path = "spectrum.rs"]
mod spectrum;
#[path = "core_setup.rs"]
mod core_setup;
#[path = "deck_events.rs"]
mod deck_events;
#[path = "deck.rs"]
mod deck;
#[path = "deck_audio.rs"]
mod deck_audio;
#[path = "broadcast.rs"]
mod broadcast;
pub use broadcast::{BroadcastStatus, BroadcastTargets};
pub use deck_audio::MusicDeckState;
pub use telemetry::MusicMeterSnapshot;
pub(super) use deck_events::{listened_increment, should_scrobble};

// MPV_FORMAT_FLAG writes a C int. libmpv2 4.1's GetData for bool uses
// a one-byte Rust bool buffer, so read into an i32-backed value instead.
#[repr(transparent)]
struct NativeFlag(i32);

unsafe impl libmpv2::GetData for NativeFlag {
    fn get_format() -> Format {
        Format::Flag
    }
}

const PRIMARY_EDGE: f64 = 0.35;

pub struct MusicEngine {
    decks: [Arc<MusicDeck>; 2],
    primary: AtomicUsize,
    audio: std::sync::Mutex<MusicAudioSettings>,
    audio_path: std::sync::Mutex<Option<PathBuf>>,
    meter_enabled: AtomicBool,
    crossfade: std::sync::Mutex<f64>,
    broadcast: BroadcastController,
    source: std::sync::Mutex<Option<(MusicStream, MusicTrack)>>,
}

impl MusicEngine {
    pub fn new() -> Self {
        let decks = [Arc::new(MusicDeck::new(0)), Arc::new(MusicDeck::new(1))];
        Self {
            broadcast: BroadcastController::new([decks[0].clone(), decks[1].clone()]),
            decks,
            primary: AtomicUsize::new(0),
            audio: std::sync::Mutex::new(MusicAudioSettings::default()),
            audio_path: std::sync::Mutex::new(None),
            meter_enabled: AtomicBool::new(false),
            crossfade: std::sync::Mutex::new(-1.0),
            source: std::sync::Mutex::new(None),
        }
    }

    pub async fn play(
        &self,
        app: AppHandle,
        stream: MusicStream,
        track: MusicTrack,
        volume: f64,
    ) -> Result<(), String> {
        let settings = self.deck_settings().await?;
        let meter = self.meter_enabled.load(Ordering::SeqCst);
        self.deck()
            .play(DeckPlay {
                app: app.clone(),
                stream: stream.clone(),
                track: track.clone(),
                volume,
                settings: &settings,
                device: None,
                meter,
            })
            .await?;
        if let Ok(mut source) = self.source.lock() {
            *source = Some((stream.clone(), track.clone()));
        }
        self.broadcast
            .mirror_track(app, &settings, Some((stream, track)), false)
            .await;
        Ok(())
    }

    pub async fn pause_for_video(&self) -> Result<bool, String> {
        let paused = self.deck().pause_for_video().await?;
        if paused {
            self.broadcast.mirror_paused(true).await;
        }
        Ok(paused)
    }

    pub fn paused_for_video(&self) -> bool {
        self.deck().paused_for_video()
    }

    /// Starts the music again after a video paused it, for the viewer who wants both.
    pub async fn resume_after_video(&self) -> Result<(), String> {
        if !self.paused_for_video() {
            return Ok(());
        }
        self.set_paused(false).await
    }

    pub async fn set_paused(&self, paused: bool) -> Result<(), String> {
        self.deck().set_paused(paused).await?;
        self.broadcast.mirror_paused(paused).await;
        Ok(())
    }

    pub async fn seek(&self, position: f64) -> Result<(), String> {
        self.deck().seek(position).await?;
        self.broadcast.mirror_seek(position).await;
        Ok(())
    }

    fn deck(&self) -> &Arc<MusicDeck> {
        &self.decks[self.primary_deck()]
    }

    pub fn primary_deck(&self) -> usize {
        self.primary.load(Ordering::Relaxed).min(1)
    }

    pub async fn set_primary_deck(&self, deck: usize) -> bool {
        let deck = deck.min(1);
        if deck == self.primary_deck() {
            return false;
        }
        if deck == 1 && (self.broadcast.is_active() || !self.decks[1].is_live().await) {
            return false;
        }
        if deck == 0 && !self.decks[0].is_live().await && self.decks[1].is_live().await {
            return false;
        }
        let previous = self.primary_deck();
        self.primary.store(deck, Ordering::Relaxed);
        self.move_meter_to_primary(previous).await;
        true
    }

    async fn follow_crossfade(&self, position: f64) {
        let wanted = if position >= PRIMARY_EDGE {
            1
        } else if position <= -PRIMARY_EDGE {
            0
        } else {
            return;
        };
        self.set_primary_deck(wanted).await;
    }

    pub async fn set_loop(&self, start: Option<f64>, end: Option<f64>) -> Result<(), String> {
        self.deck().set_loop(start, end).await
    }

    pub async fn scratch(&self, position: f64, rate: f64, holding: bool) -> Result<f64, String> {
        let settings = self.audio_settings()?;
        self.deck()
            .scratch(position, rate, holding, &settings)
            .await
    }

    pub async fn set_muted(&self, muted: bool) -> Result<(), String> {
        self.deck().set_muted(muted).await
    }

    pub async fn source_path(&self) -> Option<String> {
        self.deck().source_path().await
    }

    pub async fn set_volume(&self, volume: f64) -> Result<(), String> {
        let volume = self.audio_settings()?.clamp_volume(volume);
        self.deck().set_volume(volume).await
    }

    pub fn initialize_audio(&self, path: PathBuf) {
        let settings = std::fs::read(&path)
            .ok()
            .filter(|data| data.len() <= 8192)
            .and_then(|data| serde_json::from_slice::<MusicAudioSettings>(&data).ok())
            .unwrap_or_default()
            .normalized();
        if let Ok(mut current) = self.audio.lock() {
            *current = settings;
        }
        if let Ok(mut current) = self.audio_path.lock() {
            *current = Some(path);
        }
    }

    pub fn audio_settings(&self) -> Result<MusicAudioSettings, String> {
        self.audio
            .lock()
            .map(|settings| settings.clone())
            .map_err(|_| "Music audio settings are unavailable".into())
    }

    pub async fn audio_devices(&self) -> Result<Vec<crate::mpv::AudioDevice>, String> {
        for deck in &self.decks {
            if let Some(devices) = deck.audio_devices().await {
                return devices;
            }
        }
        core_setup::read_music_audio_devices(&core_setup::probe_core()?)
    }

    pub async fn set_audio_settings(
        &self,
        settings: MusicAudioSettings,
    ) -> Result<MusicAudioSettings, String> {
        let mut settings = settings.normalized();
        if settings.device != "auto"
            && !self
                .audio_devices()
                .await?
                .iter()
                .any(|device| device.name == settings.device)
        {
            return Err("Selected music output is unavailable".into());
        }
        let previous = self.audio_settings()?;
        settings.broadcast_enabled = previous.broadcast_enabled;
        settings.broadcast_device = previous.broadcast_device.clone();
        let meter_enabled = self.meter_enabled.load(Ordering::SeqCst);
        let device_changed = settings.device != previous.device;
        let mut applied = settings.clone();
        if self.decks[1].is_live().await {
            applied.exclusive = false;
        }
        if let Err(error) = self.decks[0]
            .apply_audio(&applied, &applied.device, device_changed, meter_enabled)
            .await
        {
            self.decks[0]
                .push_audio(&previous, &previous.device, meter_enabled)
                .await;
            return Err(error);
        }
        if let Err(error) = self.write_settings(&settings) {
            self.decks[0]
                .push_audio(&previous, &previous.device, meter_enabled)
                .await;
            return Err(error);
        }
        if self.broadcast.is_active() {
            let device = self.broadcast.device();
            self.decks[1]
                .push_audio(&applied, device.as_str(), false)
                .await;
        }
        *self
            .audio
            .lock()
            .map_err(|_| "Music audio settings are unavailable")? = settings.clone();
        Ok(settings)
    }

    pub async fn set_meter_enabled(&self, enabled: bool) -> Result<(), String> {
        if self.meter_enabled.load(Ordering::SeqCst) == enabled {
            if enabled {
                self.deck().ensure_meter().await?;
            }
            return Ok(());
        }
        self.deck().set_meter(enabled).await?;
        self.meter_enabled.store(enabled, Ordering::SeqCst);
        Ok(())
    }

    async fn move_meter_to_primary(&self, previous: usize) {
        if !self.meter_enabled.load(Ordering::SeqCst) {
            return;
        }
        let now = self.primary_deck();
        if now == previous {
            return;
        }
        let _ = self.decks[previous].set_meter(false).await;
        let _ = self.decks[now].set_meter(true).await;
        let _ = self.decks[now].ensure_meter().await;
    }

    pub async fn meter_snapshot(&self) -> Option<MusicMeterSnapshot> {
        if !self.meter_enabled.load(Ordering::SeqCst) {
            return None;
        }
        self.deck().meter_snapshot().await
    }

    pub async fn stop(&self, unpause: bool) -> Result<(), String> {
        self.deck().stop(unpause).await?;
        if unpause {
            let paused = self.deck().state().await.paused;
            self.broadcast.mirror_paused(paused).await;
            return Ok(());
        }
        if let Ok(mut source) = self.source.lock() {
            *source = None;
        }
        self.broadcast.mirror_stop().await;
        Ok(())
    }

    pub fn shutdown(&self) {
        self.broadcast.halt();
        for deck in &self.decks {
            deck.shutdown();
        }
    }

    pub async fn deck_play(
        &self,
        app: AppHandle,
        index: usize,
        stream: MusicStream,
        track: MusicTrack,
        volume: f64,
    ) -> Result<(), String> {
        if index == self.primary_deck() {
            return self.play(app, stream, track, volume).await;
        }
        let target = self.free_deck(index)?;
        let settings = self.release_exclusive().await?;
        target
            .play(DeckPlay {
                app,
                stream,
                track,
                volume,
                settings: &settings,
                device: None,
                meter: false,
            })
            .await
    }

    pub async fn deck_pause(&self, index: usize, paused: bool) -> Result<(), String> {
        if index == self.primary_deck() {
            return self.set_paused(paused).await;
        }
        self.free_deck(index)?.set_paused(paused).await
    }

    pub async fn deck_seek(&self, index: usize, position: f64) -> Result<(), String> {
        if index == self.primary_deck() {
            return self.seek(position).await;
        }
        self.free_deck(index)?.seek(position).await
    }

    pub async fn deck_volume(&self, index: usize, volume: f64) -> Result<(), String> {
        let volume = self.audio_settings()?.clamp_volume(volume);
        if index == 0 {
            return self.decks[0].set_volume(volume).await;
        }
        self.free_deck(index)?.set_volume(volume).await
    }

    pub async fn deck_stop(&self, index: usize) -> Result<(), String> {
        if index == self.primary_deck() {
            return self.stop(false).await;
        }
        self.free_deck(index)?.stop(false).await?;
        if self.primary_deck() == index {
            self.primary.store(0, Ordering::Relaxed);
        }
        self.heal_crossfade().await;
        self.restore_exclusive().await;
        self.refresh_meter().await;
        Ok(())
    }

    pub async fn deck_states(&self) -> Vec<MusicDeckState> {
        self.heal_crossfade().await;
        let mut states = Vec::with_capacity(self.decks.len());
        for deck in &self.decks {
            states.push(deck.state().await);
        }
        states
    }

    pub fn crossfade(&self) -> f64 {
        self.crossfade.lock().map(|value| *value).unwrap_or(-1.0)
    }

    async fn apply_crossfade(&self, position: f64) -> Result<(), String> {
        let angle = (position + 1.0) * 0.5 * std::f64::consts::FRAC_PI_2;
        self.decks[0].set_gain(angle.cos()).await?;
        if self.broadcast.is_active() {
            return Ok(());
        }
        self.decks[1].set_gain(angle.sin()).await
    }

    async fn audible_crossfade(&self, position: f64) -> f64 {
        if position > -1.0 && !self.broadcast.is_active() && !self.decks[1].is_live().await {
            return -1.0;
        }
        position
    }

    pub async fn heal_crossfade(&self) {
        let stored = self.crossfade();
        let wanted = self.audible_crossfade(stored).await;
        if wanted == stored {
            return;
        }
        if let Ok(mut current) = self.crossfade.lock() {
            *current = wanted;
        }
        let _ = self.apply_crossfade(wanted).await;
    }

    pub async fn set_crossfade(&self, position: f64) -> Result<(), String> {
        if !position.is_finite() {
            return Err("Crossfader position is invalid".to_string());
        }
        let position = self.audible_crossfade(position.clamp(-1.0, 1.0)).await;
        if let Ok(mut current) = self.crossfade.lock() {
            *current = position;
        }
        self.apply_crossfade(position).await?;
        self.follow_crossfade(position).await;
        Ok(())
    }

    pub async fn broadcast_targets(&self) -> Result<BroadcastTargets, String> {
        let devices = self.audio_devices().await?;
        let (product, url) = broadcast::install_hint();
        Ok(BroadcastTargets {
            devices: broadcast::classify(&devices),
            install_product: product.to_string(),
            install_url: url.to_string(),
        })
    }

    pub async fn broadcast_status(&self) -> BroadcastStatus {
        self.broadcast.status().await
    }

    pub async fn start_broadcast(
        &self,
        app: AppHandle,
        device: Option<String>,
    ) -> Result<BroadcastStatus, String> {
        if self.broadcast.is_active() {
            self.broadcast.stop().await?;
        } else if self.decks[1].is_live().await {
            return Err("Deck B is already playing. Stop it before broadcasting.".to_string());
        }
        let available = self.audio_devices().await?;
        let settings = self.release_exclusive().await?;
        let state = self.decks[0].state().await;
        let source = self
            .source
            .lock()
            .ok()
            .and_then(|source| source.as_ref().cloned());
        match self
            .broadcast
            .start(BroadcastStart {
                app,
                device,
                available,
                settings: &settings,
                source,
                position: state.position_seconds,
                paused: state.paused,
            })
            .await
        {
            Ok(status) => {
                let _ = self.persist_broadcast(true, status.device.clone());
                Ok(status)
            }
            Err(error) => {
                self.restore_exclusive().await;
                Err(error)
            }
        }
    }

    pub async fn stop_broadcast(&self) -> Result<BroadcastStatus, String> {
        self.broadcast.stop().await?;
        let _ = self.set_crossfade(self.crossfade()).await;
        self.restore_exclusive().await;
        self.refresh_meter().await;
        let _ = self.persist_broadcast(false, None);
        Ok(BroadcastStatus::default())
    }

    fn free_deck(&self, index: usize) -> Result<&Arc<MusicDeck>, String> {
        if index == 1 && self.broadcast.is_active() {
            return Err("Deck B is carrying the broadcast".to_string());
        }
        self.decks
            .get(index)
            .ok_or_else(|| "Unknown music deck".to_string())
    }

    async fn deck_settings(&self) -> Result<MusicAudioSettings, String> {
        let mut settings = self.audio_settings()?;
        if self.decks[1].is_live().await {
            settings.exclusive = false;
        }
        Ok(settings)
    }

    async fn release_exclusive(&self) -> Result<MusicAudioSettings, String> {
        let mut settings = self.audio_settings()?;
        if !settings.exclusive {
            return Ok(settings);
        }
        settings.exclusive = false;
        let meter = self.meter_enabled.load(Ordering::SeqCst);
        self.decks[0]
            .apply_audio(&settings, &settings.device, false, meter)
            .await?;
        Ok(settings)
    }

    async fn refresh_meter(&self) {
        if self.meter_enabled.load(Ordering::SeqCst) {
            let _ = self.deck().ensure_meter().await;
        }
    }

    async fn restore_exclusive(&self) {
        let Ok(settings) = self.audio_settings() else {
            return;
        };
        if !settings.exclusive || self.decks[1].is_live().await {
            return;
        }
        let meter = self.meter_enabled.load(Ordering::SeqCst);
        let _ = self.decks[0]
            .apply_audio(&settings, &settings.device, false, meter)
            .await;
    }

    fn persist_broadcast(&self, enabled: bool, device: Option<String>) -> Result<(), String> {
        let mut settings = self.audio_settings()?;
        settings.broadcast_enabled = enabled;
        if let Some(device) = device {
            settings.broadcast_device = device;
        }
        self.write_settings(&settings)?;
        *self
            .audio
            .lock()
            .map_err(|_| "Music audio settings are unavailable")? = settings;
        Ok(())
    }

    fn write_settings(&self, settings: &MusicAudioSettings) -> Result<(), String> {
        let path = self
            .audio_path
            .lock()
            .map_err(|_| "Music audio settings are unavailable")?
            .clone()
            .ok_or("Music storage is not ready")?;
        let data = serde_json::to_vec(settings).map_err(|error| error.to_string())?;
        let temporary = path.with_extension("json.tmp");
        std::fs::write(&temporary, data)
            .map_err(|error| format!("Save music audio settings: {error}"))?;
        std::fs::rename(&temporary, &path)
            .map_err(|error| format!("Save music audio settings: {error}"))?;
        Ok(())
    }
}

#[cfg(test)]
#[path = "engine_tests.rs"]
mod tests;
