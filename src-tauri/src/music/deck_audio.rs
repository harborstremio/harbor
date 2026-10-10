use super::deck::MusicDeck;
use super::telemetry::{self, MusicMeterSnapshot};
use super::{core_setup, NativeFlag};
use crate::music::audio::MusicAudioSettings;
use serde::Serialize;

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicDeckState {
    pub deck: u8,
    pub live: bool,
    pub paused: bool,
    pub track_id: Option<String>,
    pub connector_id: Option<String>,
    pub position_seconds: Option<f64>,
    pub duration_seconds: Option<f64>,
    pub volume: f64,
    pub gain: f64,
}

impl MusicDeck {
    pub(super) async fn audio_devices(
        &self,
    ) -> Option<Result<Vec<crate::mpv::AudioDevice>, String>> {
        let slot = self.inner.lock().await;
        slot.as_ref()
            .map(|session| core_setup::read_music_audio_devices(&session.mpv))
    }

    pub(super) async fn apply_audio(
        &self,
        settings: &MusicAudioSettings,
        device: &str,
        device_changed: bool,
        meter: bool,
    ) -> Result<(), String> {
        let slot = self.inner.lock().await;
        let Some(session) = slot.as_ref() else {
            return Ok(());
        };
        // A higher ceiling never turns the volume up. A new device starts at unity or below.
        let current = session.mpv.get_property::<f64>("volume").unwrap_or(82.0);
        let ceiling = if device_changed {
            100.0
        } else {
            settings.volume_limit * 100.0
        };
        if current > ceiling {
            session
                .mpv
                .set_property("volume", ceiling)
                .map_err(|error| error.to_string())?;
        }
        core_setup::apply_music_audio(&session.mpv, settings, device, meter)
    }

    pub(super) async fn push_audio(
        &self,
        settings: &MusicAudioSettings,
        device: &str,
        meter: bool,
    ) {
        let slot = self.inner.lock().await;
        if let Some(session) = slot.as_ref() {
            let _ = core_setup::apply_music_audio(&session.mpv, settings, device, meter);
        }
    }

    pub(super) async fn ensure_meter(&self) -> Result<(), String> {
        let slot = self.inner.lock().await;
        let Some(session) = slot.as_ref() else {
            return Ok(());
        };
        if telemetry::ensure_enabled(&session.mpv)? {
            if let Ok(mut spectrum) = session.spectrum.lock() {
                spectrum.clear();
            }
        }
        Ok(())
    }

    pub(super) async fn set_meter(&self, enabled: bool) -> Result<(), String> {
        let slot = self.inner.lock().await;
        let Some(session) = slot.as_ref() else {
            return Ok(());
        };
        telemetry::set_enabled(&session.mpv, enabled)?;
        if let Ok(mut spectrum) = session.spectrum.lock() {
            spectrum.clear();
        }
        Ok(())
    }

    pub(super) async fn meter_snapshot(&self) -> Option<MusicMeterSnapshot> {
        let slot = self.inner.lock().await;
        slot.as_ref().map(|session| {
            let mut snapshot = telemetry::snapshot(
                &session.mpv,
                &session.track_id,
                session.connector_id.as_deref(),
            );
            if snapshot.active {
                if let (Ok(spectrum), Ok(position)) = (
                    session.spectrum.lock(),
                    session.mpv.get_property::<f64>("time-pos"),
                ) {
                    snapshot.spectrum_db = spectrum.at(position);
                }
            }
            snapshot
        })
    }

    pub(super) async fn state(&self) -> MusicDeckState {
        let volume = self.volume.lock().map(|value| *value).unwrap_or(0.82);
        let gain = self.gain.lock().map(|value| *value).unwrap_or(1.0);
        let slot = self.inner.lock().await;
        let Some(session) = slot.as_ref() else {
            return MusicDeckState {
                deck: self.index as u8,
                volume,
                gain,
                ..MusicDeckState::default()
            };
        };
        MusicDeckState {
            deck: self.index as u8,
            live: true,
            paused: session
                .mpv
                .get_property::<NativeFlag>("pause")
                .is_ok_and(|value| value.0 != 0),
            track_id: Some(session.track_id.clone()),
            connector_id: session.connector_id.clone(),
            position_seconds: finite(session.mpv.get_property::<f64>("time-pos").ok()),
            duration_seconds: finite(session.mpv.get_property::<f64>("duration").ok()),
            volume,
            gain,
        }
    }
}

fn finite(value: Option<f64>) -> Option<f64> {
    value.filter(|value| value.is_finite())
}
