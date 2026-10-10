use super::deck::{DeckPlay, MusicDeck};
use crate::mpv::AudioDevice;
use crate::music::audio::MusicAudioSettings;
use crate::music::{MusicStream, MusicTrack};
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;

const SUPERVISOR_INTERVAL: Duration = Duration::from_millis(250);
const SYNC_TOLERANCE: f64 = 0.15;

const SIGNATURES: [(&str, &str, &str); 12] = [
    ("voicemeeter", "voicemeeter", "VoiceMeeter"),
    ("cable input", "vb-cable", "VB-Audio Virtual Cable"),
    ("virtual audio cable", "virtual-audio-cable", "Virtual Audio Cable"),
    ("vb-audio", "vb-cable", "VB-Audio Virtual Cable"),
    ("blackhole", "blackhole", "BlackHole"),
    ("loopback audio", "loopback", "Loopback"),
    ("soundflower", "soundflower", "Soundflower"),
    ("null output", "null-sink", "Null sink"),
    ("null-sink", "null-sink", "Null sink"),
    ("null_sink", "null-sink", "Null sink"),
    ("virtual sink", "null-sink", "Virtual sink"),
    ("virtual-sink", "null-sink", "Virtual sink"),
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VirtualAudioDevice {
    pub name: String,
    pub description: String,
    pub kind: String,
    pub product: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastTargets {
    pub devices: Vec<VirtualAudioDevice>,
    pub install_product: String,
    pub install_url: String,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastStatus {
    pub active: bool,
    pub device: Option<String>,
    pub product: Option<String>,
    pub track_id: Option<String>,
    pub drift_ms: Option<f64>,
}

#[derive(Debug, Clone, Default)]
struct BroadcastConfig {
    active: bool,
    device: String,
    product: String,
}

pub(super) struct BroadcastStart<'a> {
    pub(super) app: AppHandle,
    pub(super) device: Option<String>,
    pub(super) available: Vec<AudioDevice>,
    pub(super) settings: &'a MusicAudioSettings,
    pub(super) source: Option<(MusicStream, MusicTrack)>,
    pub(super) position: Option<f64>,
    pub(super) paused: bool,
}

pub(super) struct BroadcastController {
    decks: [Arc<MusicDeck>; 2],
    config: std::sync::Mutex<BroadcastConfig>,
    generation: Arc<AtomicU64>,
}

impl BroadcastController {
    pub(super) fn new(decks: [Arc<MusicDeck>; 2]) -> Self {
        Self {
            decks,
            config: std::sync::Mutex::new(BroadcastConfig::default()),
            generation: Arc::new(AtomicU64::new(0)),
        }
    }

    pub(super) fn is_active(&self) -> bool {
        self.config
            .lock()
            .map(|config| config.active)
            .unwrap_or(false)
    }

    pub(super) fn device(&self) -> String {
        self.settings().device
    }

    pub(super) fn halt(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut config) = self.config.lock() {
            *config = BroadcastConfig::default();
        }
    }

    fn settings(&self) -> BroadcastConfig {
        self.config
            .lock()
            .map(|config| config.clone())
            .unwrap_or_default()
    }

    pub(super) async fn status(&self) -> BroadcastStatus {
        let config = self.settings();
        if !config.active {
            return BroadcastStatus::default();
        }
        let source = self.decks[0].state().await;
        let mirror = self.decks[1].state().await;
        BroadcastStatus {
            active: true,
            device: Some(config.device),
            product: Some(config.product),
            track_id: mirror.track_id,
            drift_ms: match (source.position_seconds, mirror.position_seconds) {
                (Some(source), Some(mirror)) => Some((mirror - source) * 1000.0),
                _ => None,
            },
        }
    }

    pub(super) async fn start(
        &self,
        request: BroadcastStart<'_>,
    ) -> Result<BroadcastStatus, String> {
        let BroadcastStart {
            app,
            device,
            available,
            settings,
            source,
            position,
            paused,
        } = request;
        let virtuals = classify(&available);
        let target = match device {
            Some(device) => virtuals
                .iter()
                .find(|entry| entry.name == device)
                .cloned()
                .or_else(|| {
                    available
                        .iter()
                        .find(|entry| entry.name == device)
                        .map(|entry| VirtualAudioDevice {
                            name: entry.name.clone(),
                            description: entry.description.clone(),
                            kind: "other".to_string(),
                            product: entry.description.clone(),
                        })
                })
                .ok_or_else(|| "That broadcast output is no longer available".to_string())?,
            None => virtuals.into_iter().next().ok_or_else(|| {
                let (product, url) = install_hint();
                format!(
                    "No virtual audio device was found. Install {product} from {url}, then choose it here."
                )
            })?,
        };
        if let Ok(mut config) = self.config.lock() {
            config.active = true;
            config.device = target.name.clone();
            config.product = target.product.clone();
        }
        if let Some(source) = source {
            if let Err(error) = self.mirror(app, settings, source, position, paused).await {
                self.halt();
                let _ = self.decks[1].stop(false).await;
                return Err(error);
            }
        }
        let token = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        spawn_supervisor(self.decks.clone(), self.generation.clone(), token);
        Ok(self.status().await)
    }

    pub(super) async fn stop(&self) -> Result<(), String> {
        self.generation.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut config) = self.config.lock() {
            *config = BroadcastConfig::default();
        }
        self.decks[1].stop(false).await
    }

    pub(super) async fn mirror_track(
        &self,
        app: AppHandle,
        settings: &MusicAudioSettings,
        source: Option<(MusicStream, MusicTrack)>,
        paused: bool,
    ) {
        if !self.is_active() {
            return;
        }
        let Some(source) = source else {
            let _ = self.decks[1].stop(false).await;
            return;
        };
        if let Err(error) = self.mirror(app, settings, source, None, paused).await {
            eprintln!("[harbor::music] broadcast mirror failed: {error}");
        }
    }

    pub(super) async fn mirror_paused(&self, paused: bool) {
        if self.is_active() {
            let _ = self.decks[1].set_paused(paused).await;
        }
    }

    pub(super) async fn mirror_seek(&self, position: f64) {
        if self.is_active() {
            let _ = self.decks[1].seek_exact(position).await;
        }
    }

    pub(super) async fn mirror_stop(&self) {
        if self.is_active() {
            let _ = self.decks[1].stop(false).await;
        }
    }

    async fn mirror(
        &self,
        app: AppHandle,
        settings: &MusicAudioSettings,
        source: (MusicStream, MusicTrack),
        position: Option<f64>,
        paused: bool,
    ) -> Result<(), String> {
        let device = self.settings().device;
        if device.is_empty() {
            return Ok(());
        }
        let mut settings = settings.clone();
        settings.exclusive = false;
        let (stream, track) = source;
        let _ = self.decks[1].set_gain(1.0).await;
        self.decks[1]
            .play(DeckPlay {
                app,
                stream,
                track,
                volume: 1.0,
                settings: &settings,
                device: Some(device.as_str()),
                meter: false,
            })
            .await?;
        if let Some(position) = position.filter(|value| *value > 0.05) {
            let _ = self.decks[1].seek_exact(position).await;
        }
        if paused {
            let _ = self.decks[1].set_paused(true).await;
        }
        Ok(())
    }
}

fn spawn_supervisor(decks: [Arc<MusicDeck>; 2], generation: Arc<AtomicU64>, token: u64) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(SUPERVISOR_INTERVAL).await;
            if generation.load(Ordering::SeqCst) != token {
                break;
            }
            let source = decks[0].state().await;
            let mirror = decks[1].state().await;
            if !mirror.live {
                continue;
            }
            if !source.live {
                let _ = decks[1].set_paused(true).await;
                continue;
            }
            if mirror.paused != source.paused {
                let _ = decks[1].set_paused(source.paused).await;
            }
            let (Some(here), Some(there)) = (source.position_seconds, mirror.position_seconds)
            else {
                continue;
            };
            if (here - there).abs() > SYNC_TOLERANCE {
                let _ = decks[1].seek_exact(here).await;
            }
        }
    });
}

pub(super) fn classify(devices: &[AudioDevice]) -> Vec<VirtualAudioDevice> {
    let mut found = Vec::new();
    for device in devices {
        if device.name == "null" || device.name.starts_with("null/") {
            continue;
        }
        let haystack = format!("{} {}", device.name, device.description).to_lowercase();
        let Some((_, kind, product)) = SIGNATURES
            .iter()
            .find(|(needle, _, _)| haystack.contains(needle))
        else {
            continue;
        };
        found.push(VirtualAudioDevice {
            name: device.name.clone(),
            description: device.description.clone(),
            kind: (*kind).to_string(),
            product: (*product).to_string(),
        });
    }
    found
}

pub(super) fn install_hint() -> (&'static str, &'static str) {
    #[cfg(target_os = "windows")]
    {
        ("VB-Audio Virtual Cable", "https://vb-audio.com/Cable/")
    }
    #[cfg(target_os = "macos")]
    {
        ("BlackHole", "https://existential.audio/blackhole/")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        (
            "a PulseAudio or PipeWire null sink",
            "https://wiki.archlinux.org/title/PipeWire",
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn device(name: &str, description: &str) -> AudioDevice {
        AudioDevice {
            name: name.to_string(),
            description: description.to_string(),
        }
    }

    #[test]
    fn known_cables_are_recognized_by_their_shipped_names() {
        let found = classify(&[
            device("wasapi/{0.0.0.1}", "Speakers (Realtek(R) Audio)"),
            device("wasapi/{0.0.0.2}", "CABLE Input (VB-Audio Virtual Cable)"),
            device(
                "wasapi/{0.0.0.3}",
                "VoiceMeeter Aux Input (VB-Audio VoiceMeeter AUX VAIO)",
            ),
            device("wasapi/{0.0.0.4}", "Line 1 (Virtual Audio Cable)"),
            device("coreaudio/BlackHole2ch_UID", "BlackHole 2ch"),
            device("pulse/harbor_null_sink", "Null Output"),
            device("null", "Null audio output"),
        ]);
        let kinds: Vec<&str> = found.iter().map(|entry| entry.kind.as_str()).collect();
        assert_eq!(
            kinds,
            vec![
                "vb-cable",
                "voicemeeter",
                "virtual-audio-cable",
                "blackhole",
                "null-sink"
            ]
        );
        assert_eq!(found[1].product, "VoiceMeeter");
    }

    #[test]
    fn ordinary_outputs_are_never_offered_as_cables() {
        assert!(classify(&[
            device("wasapi/{0.0.0.1}", "Speakers (Realtek(R) Audio)"),
            device("coreaudio/BuiltInSpeakerDevice", "MacBook Pro Speakers"),
            device("pulse/alsa_output.pci-0000_00_1f.3", "Built-in Audio"),
        ])
        .is_empty());
        let (product, url) = install_hint();
        assert!(!product.is_empty() && url.starts_with("https://"));
    }
}
