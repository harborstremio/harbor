use super::{CableStatus, CABLE_MIC_LABEL, CABLE_RATE, CABLE_RATE_MAX, CABLE_RATE_MIN};
use crate::music::MusicState;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

mod coreaudio;
mod install;

const BACKEND: &str = "coreaudio";
const DEVICE_UID: &str = "HarborVirtualMic:0";
const SUPPORTED_RATES: [u32; 6] = [44_100, 48_000, 88_200, 96_000, 176_400, 192_000];
const RESTART_POLL: Duration = Duration::from_millis(250);
const RESTART_TRIES: u32 = 24;

static REQUESTED: OnceLock<Mutex<Option<u32>>> = OnceLock::new();

fn requested() -> &'static Mutex<Option<u32>> {
    REQUESTED.get_or_init(|| Mutex::new(None))
}

fn snap(rate: u32) -> u32 {
    SUPPORTED_RATES
        .iter()
        .copied()
        .min_by_key(|candidate| candidate.abs_diff(rate))
        .unwrap_or(CABLE_RATE)
}

fn choose_rate(rate: Option<u32>) -> u32 {
    rate.filter(|value| (CABLE_RATE_MIN..=CABLE_RATE_MAX).contains(value))
        .map(snap)
        .unwrap_or(CABLE_RATE)
}

fn base() -> CableStatus {
    let mut out = CableStatus::idle(true, BACKEND, None);
    out.sink_name = DEVICE_UID.to_string();
    out.monitor_name = DEVICE_UID.to_string();
    out.monitor_label = CABLE_MIC_LABEL.to_string();
    out.mic_name = DEVICE_UID.to_string();
    out.mic_label = CABLE_MIC_LABEL.to_string();
    out
}

async fn probe() -> Option<coreaudio::LiveDevice> {
    tokio::task::spawn_blocking(|| coreaudio::probe(DEVICE_UID))
        .await
        .ok()
        .flatten()
}

async fn wait_for_device() -> Option<coreaudio::LiveDevice> {
    for _ in 0..RESTART_TRIES {
        if let Some(device) = probe().await {
            return Some(device);
        }
        tokio::time::sleep(RESTART_POLL).await;
    }
    None
}

async fn resolve_output(state: &MusicState) -> Option<String> {
    let devices = state.engine.audio_devices().await.ok()?;
    devices
        .iter()
        .find(|device| {
            device.name.ends_with(DEVICE_UID) || device.description.contains(CABLE_MIC_LABEL)
        })
        .map(|device| device.name.clone())
}

fn missing_detail() -> String {
    if install::installed_version().is_some() {
        return "music.cable.mac.restartNeeded".to_string();
    }
    if install::bundled().is_some() {
        return "music.cable.mac.installNeeded".to_string();
    }
    "music.cable.mac.installMissing".to_string()
}

fn describe(out: &mut CableStatus, device: &coreaudio::LiveDevice) {
    let format = device.format_label();
    out.active = true;
    out.mic_ready = device.inputs > 0;
    out.monitor_ready = device.outputs > 0;
    out.rate = (device.rate > 0).then_some(device.rate);
    out.graph_rate = out.rate;
    out.channels = (device.channels > 0).then_some(device.channels);
    out.bit_perfect = device.bit_perfect();
    if !out.bit_perfect {
        out.resampled_by = Some("server".to_string());
    }
    out.spec = out
        .rate
        .map(|rate| format!("{format} {}ch {rate}Hz", device.channels));
    out.format = Some(format);
}

pub(super) async fn status(state: &MusicState) -> CableStatus {
    let mut out = base();
    let Some(device) = probe().await else {
        out.detail = Some(missing_detail());
        return out;
    };
    describe(&mut out, &device);
    out.requested_rate = requested().lock().ok().and_then(|slot| *slot);
    out.output_device = resolve_output(state).await;
    if out.rate.is_none() {
        out.detail = Some("music.cable.unknownSpec".to_string());
        return out;
    }
    let installed = install::installed_version();
    let shipped = install::bundled_version();
    if shipped.is_some() && installed.is_some() && installed != shipped {
        out.detail = Some("music.cable.mac.updateAvailable".to_string());
    }
    out
}

pub(super) async fn create(state: &MusicState, rate: Option<u32>) -> Result<CableStatus, String> {
    let chosen = choose_rate(rate);
    let shipped = install::bundled_version();
    let installed = install::installed_version();
    let stale = shipped.is_some() && installed.is_some() && installed != shipped;
    if installed.is_none() || stale {
        install::install().await?;
    }
    let device = match probe().await {
        Some(device) => Some(device),
        None => wait_for_device().await,
    };
    let Some(device) = device else {
        return Err("music.cable.mac.restartNeeded".to_string());
    };
    if device.rate != chosen {
        let id = device.id;
        tokio::task::spawn_blocking(move || coreaudio::set_rate(id, chosen))
            .await
            .map_err(|error| error.to_string())??;
    }
    if let Ok(mut slot) = requested().lock() {
        *slot = Some(chosen);
    }
    Ok(status(state).await)
}

pub(super) async fn destroy(state: &MusicState) -> Result<CableStatus, String> {
    if install::installed_version().is_some() {
        install::uninstall().await?;
    }
    if let Ok(mut slot) = requested().lock() {
        *slot = None;
    }
    Ok(status(state).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_requested_rate_snaps_to_the_nearest_rate_the_driver_advertises() {
        assert_eq!(snap(44_100), 44_100);
        assert_eq!(snap(192_000), 192_000);
        assert_eq!(snap(47_000), 48_000);
        assert_eq!(snap(160_000), 176_400);
    }

    #[test]
    fn an_absent_or_out_of_range_rate_falls_back_to_the_shared_default() {
        assert_eq!(choose_rate(None), CABLE_RATE);
        assert_eq!(choose_rate(Some(CABLE_RATE_MAX + 1)), CABLE_RATE);
        assert_eq!(choose_rate(Some(CABLE_RATE_MIN - 1)), CABLE_RATE);
        assert_eq!(choose_rate(Some(96_000)), 96_000);
    }
}
