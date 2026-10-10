use super::{CableStatus, CABLE_RATE, CABLE_SINK, CABLE_SINK_LABEL, CABLE_SOURCE};
use crate::music::MusicState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const DETECT_TTL: Duration = Duration::from_secs(15);

#[path = "cable_shell.rs"]
mod shell;

use shell::{on_path, pactl_has, pactl_row, parse_spec, run, sane_rate};

#[path = "cable_pipewire.rs"]
mod pipewire;
#[path = "cable_pulse.rs"]
mod pulse;

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Server {
    Absent,
    Pulse,
    PipeWire,
}

impl Server {
    fn label(self) -> &'static str {
        match self {
            Server::Absent => "none",
            Server::Pulse => "pulseaudio",
            Server::PipeWire => "pipewire",
        }
    }
}

const RESOLVE_TRIES: u8 = 3;

#[derive(Default)]
struct Wanted {
    rate: Option<u32>,
    device: Option<String>,
    tries: u8,
}

static WANTED: OnceLock<Mutex<Wanted>> = OnceLock::new();
static SEEN: OnceLock<Mutex<Option<(Server, Instant)>>> = OnceLock::new();
static REAPED: AtomicBool = AtomicBool::new(false);

fn wanted() -> &'static Mutex<Wanted> {
    WANTED.get_or_init(|| Mutex::new(Wanted::default()))
}

async fn server() -> Server {
    if let Ok(slot) = SEEN.get_or_init(|| Mutex::new(None)).lock() {
        if let Some((kind, at)) = *slot {
            if at.elapsed() < DETECT_TTL {
                return kind;
            }
        }
    }
    let kind = detect().await;
    if let Ok(mut slot) = SEEN.get_or_init(|| Mutex::new(None)).lock() {
        *slot = Some((kind, Instant::now()));
    }
    kind
}

fn verdict(
    format: Option<&str>,
    rate: Option<u32>,
    requested: Option<u32>,
    graph: Option<u32>,
) -> (bool, Option<String>) {
    let Some(rate) = rate else {
        return (false, None);
    };
    let floating = format.is_some_and(|value| {
        let lower = value.to_ascii_lowercase();
        lower.starts_with("float32") || lower.starts_with("f32")
    });
    if !floating {
        return (false, Some("format".to_string()));
    }
    if graph.is_some_and(|value| value != rate) {
        return (false, Some("graph".to_string()));
    }
    if requested.is_some_and(|value| value != rate) {
        return (false, Some("server".to_string()));
    }
    (true, None)
}
async fn detect() -> Server {
    if !cfg!(target_os = "linux") {
        return Server::Absent;
    }
    let info = run("pactl", &["info"]).await.ok();
    let says_pipewire = info.as_deref().is_some_and(|text| {
        text.lines().any(|line| {
            let lower = line.to_ascii_lowercase();
            lower.starts_with("server name:") && lower.contains("pipewire")
        })
    });
    let running = says_pipewire || pipewire::running().await;
    if running && pipewire::usable() {
        return Server::PipeWire;
    }
    if info.is_some() {
        return Server::Pulse;
    }
    Server::Absent
}

async fn reap_once() {
    if REAPED.swap(true, Ordering::SeqCst) {
        return;
    }
    if !cfg!(target_os = "linux") {
        return;
    }
    pipewire::reap_orphans();
    pulse::destroy().await;
}

async fn teardown() {
    pipewire::destroy().await;
    pulse::destroy().await;
}

async fn choose_rate(
    state: &MusicState,
    explicit: Option<u32>,
    graph: Option<u32>,
    allowed: &[u32],
) -> u32 {
    if let Some(rate) = explicit.and_then(sane_rate) {
        return rate;
    }
    let preferred = state
        .engine
        .audio_settings()
        .ok()
        .and_then(|settings| sane_rate(settings.sample_rate));
    if let Some(rate) = preferred {
        return rate;
    }
    let playing = state
        .engine
        .meter_snapshot()
        .await
        .and_then(|snapshot| snapshot.output_sample_rate_hz)
        .and_then(sane_rate);
    if let Some(rate) = playing {
        if allowed.is_empty() || allowed.contains(&rate) {
            return rate;
        }
    }
    graph.and_then(sane_rate).unwrap_or(CABLE_RATE)
}

async fn resolve_output(state: &MusicState) -> Option<String> {
    let devices = state.engine.audio_devices().await.ok()?;
    let suffix = format!("/{CABLE_SINK}");
    devices
        .iter()
        .find(|device| {
            device.name == CABLE_SINK
                || device.name.ends_with(&suffix)
                || device.description.contains(CABLE_SINK_LABEL)
        })
        .map(|device| device.name.clone())
}

async fn keep_output(state: &MusicState) -> Option<String> {
    let known = wanted().lock().ok().and_then(|slot| slot.device.clone());
    if known.is_some() {
        return known;
    }
    let allowed = match wanted().lock() {
        Ok(mut slot) if slot.tries < RESOLVE_TRIES => {
            slot.tries += 1;
            true
        }
        _ => false,
    };
    if !allowed {
        return None;
    }
    let found = resolve_output(state).await;
    if let Ok(mut slot) = wanted().lock() {
        slot.device.clone_from(&found);
    }
    found
}

pub(super) async fn status(state: &MusicState) -> CableStatus {
    reap_once().await;
    let server = server().await;
    if server == Server::Absent {
        let detail = if cfg!(target_os = "linux") {
            "music.cable.noServer"
        } else {
            "music.cable.driverNeeded"
        };
        return CableStatus::idle(false, "none", Some(detail.to_string()));
    }
    let mut out = CableStatus::idle(true, server.label(), None);
    out.active = pipewire::alive().await || !pulse::ours().await.is_empty();
    if !out.active {
        return out;
    }
    let seen = on_path("pactl");
    out.mic_ready = !seen || pactl_has("sources", CABLE_SOURCE).await;
    out.monitor_ready = !seen || pactl_has("sources", &out.monitor_name).await;
    let spec = pactl_row("sinks", CABLE_SINK)
        .await
        .filter(|value| !value.is_empty());
    let (format, channels, rate) = spec
        .as_deref()
        .map(parse_spec)
        .unwrap_or((None, None, None));
    if server == Server::PipeWire {
        out.graph_rate = pipewire::graph().await.0;
    }
    out.requested_rate = wanted().lock().ok().and_then(|slot| slot.rate);
    out.output_device = keep_output(state).await;
    let (perfect, resampled) = verdict(format.as_deref(), rate, out.requested_rate, out.graph_rate);
    out.spec = spec;
    out.format = format;
    out.channels = channels;
    out.rate = rate;
    out.bit_perfect = perfect;
    out.resampled_by = resampled;
    if out.rate.is_none() {
        out.detail = Some("music.cable.unknownSpec".to_string());
    }
    out
}

pub(super) async fn create(state: &MusicState, rate: Option<u32>) -> Result<CableStatus, String> {
    reap_once().await;
    let server = server().await;
    if server == Server::Absent {
        return Err(if cfg!(target_os = "linux") {
            "music.cable.noServer".to_string()
        } else {
            "music.cable.driverNeeded".to_string()
        });
    }
    let current = status(state).await;
    if current.active && (rate.is_none() || rate == current.rate) {
        return Ok(current);
    }
    if current.active {
        teardown().await;
    }
    let (graph, allowed) = if server == Server::PipeWire {
        pipewire::graph().await
    } else {
        (None, Vec::new())
    };
    let chosen = choose_rate(state, rate, graph, &allowed).await;
    let mut failure: Option<String> = None;
    let mut built = false;
    if server == Server::PipeWire {
        match pipewire::create(chosen).await {
            Ok(()) => built = true,
            Err(error) => failure = Some(error),
        }
    }
    if !built && on_path("pactl") {
        match pulse::create(chosen).await {
            Ok(()) => built = true,
            Err(error) => failure = Some(error),
        }
    }
    if !built {
        teardown().await;
        return Err(failure.unwrap_or_else(|| "music.cable.createFailed".to_string()));
    }
    if let Ok(mut slot) = wanted().lock() {
        slot.rate = Some(chosen);
        slot.device = None;
        slot.tries = 0;
    }
    Ok(status(state).await)
}

pub(super) async fn destroy(state: &MusicState) -> Result<CableStatus, String> {
    reap_once().await;
    teardown().await;
    if let Ok(mut slot) = wanted().lock() {
        slot.rate = None;
        slot.device = None;
        slot.tries = 0;
    }
    Ok(status(state).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_graph_running_at_another_rate_is_never_reported_as_bit_perfect() {
        assert_eq!(
            verdict(Some("float32le"), Some(48_000), Some(48_000), Some(48_000)),
            (true, None)
        );
        assert_eq!(
            verdict(Some("float32le"), Some(48_000), Some(48_000), Some(44_100)),
            (false, Some("graph".to_string()))
        );
        assert_eq!(
            verdict(Some("float32le"), Some(48_000), Some(96_000), None),
            (false, Some("server".to_string()))
        );
        assert_eq!(
            verdict(Some("s16le"), Some(48_000), Some(48_000), Some(48_000)),
            (false, Some("format".to_string()))
        );
        assert_eq!(verdict(None, None, Some(48_000), None), (false, None));
    }
}
