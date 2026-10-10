use super::{CableStatus, CABLE_RATE_MAX, CABLE_RATE_MIN};
use crate::music::MusicState;

mod catalog;
mod endpoints;
mod select;

const BACKEND: &str = "wasapi";

fn sane_rate(value: u32) -> Option<u32> {
    (CABLE_RATE_MIN..=CABLE_RATE_MAX)
        .contains(&value)
        .then_some(value)
}

async fn wanted_rate(state: &MusicState, explicit: Option<u32>) -> Option<u32> {
    if let Some(rate) = explicit.and_then(sane_rate) {
        return Some(rate);
    }
    state
        .engine
        .audio_settings()
        .ok()
        .and_then(|settings| sane_rate(settings.sample_rate))
}

fn missing() -> CableStatus {
    CableStatus::idle(false, "none", Some("music.cable.driverNeeded".to_string()))
}

fn shape(reading: select::Reading) -> CableStatus {
    if !reading.installed {
        return missing();
    }
    let mut out = CableStatus::idle(true, BACKEND, None);
    let Some(cable) = reading.cable else {
        return out;
    };
    out.active = true;
    out.sink_name = cable.device.clone();
    out.output_device = Some(cable.device);
    out.monitor_label = cable.render_label;
    out.monitor_name = cable.mic_id.clone();
    out.mic_name = cable.mic_id;
    out.mic_label = cable.mic_label;
    out.mic_ready = true;
    out.monitor_ready = true;
    out.requested_rate = reading.requested_rate;
    let Some(format) = cable.format else {
        out.detail = Some("music.cable.unknownSpec".to_string());
        return out;
    };
    out.spec = Some(format.spec());
    out.format = Some(format.tag());
    out.channels = Some(u32::from(format.channels));
    out.rate = Some(format.rate);
    out.bit_perfect = false;
    out.resampled_by = Some(if format.float { "server" } else { "format" }.to_string());
    out
}

async fn offload<T, F>(work: F) -> Option<T>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(work).await.ok()
}

pub(super) async fn status(_state: &MusicState) -> CableStatus {
    match offload(select::status).await {
        Some(reading) => shape(reading),
        None => missing(),
    }
}

pub(super) async fn create(state: &MusicState, rate: Option<u32>) -> Result<CableStatus, String> {
    let rate = wanted_rate(state, rate).await;
    let Some(reading) = offload(move || select::adopt(rate)).await else {
        return Err("music.cable.driverNeeded".to_string());
    };
    if reading.cable.is_none() {
        return Err("music.cable.driverNeeded".to_string());
    }
    Ok(shape(reading))
}

pub(super) async fn destroy(_state: &MusicState) -> Result<CableStatus, String> {
    match offload(select::release).await {
        Some(reading) => Ok(shape(reading)),
        None => Ok(missing()),
    }
}
