use super::catalog::{self, Match};
use super::endpoints::{self, Endpoint, Format, Side};
use std::sync::Mutex;

#[derive(Debug, Clone, Default)]
pub struct Chosen {
    pub device: String,
    pub render_label: String,
    pub mic_id: String,
    pub mic_label: String,
    pub format: Option<Format>,
}

#[derive(Debug, Clone, Default)]
pub struct Reading {
    pub installed: bool,
    pub cable: Option<Chosen>,
    pub requested_rate: Option<u32>,
}

#[derive(Default)]
struct Held {
    id: Option<String>,
    requested: Option<u32>,
    released: bool,
}

static HELD: Mutex<Held> = Mutex::new(Held {
    id: None,
    requested: None,
    released: false,
});

fn held() -> std::sync::MutexGuard<'static, Held> {
    HELD.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn scan() -> (Vec<Endpoint>, Vec<Endpoint>, Vec<Match>) {
    let render = endpoints::list(Side::Render);
    let capture = endpoints::list(Side::Capture);
    let render_names: Vec<String> = render.iter().map(|entry| entry.name.clone()).collect();
    let capture_names: Vec<String> = capture.iter().map(|entry| entry.name.clone()).collect();
    let found = catalog::installed(&render_names, &capture_names);
    (render, capture, found)
}

fn preferred(found: &[Match], render: &[Endpoint], rate: Option<u32>) -> Option<usize> {
    let rate = rate?;
    found.iter().position(|entry| {
        endpoints::format(Side::Render, &render[entry.render].id)
            .is_some_and(|format| format.rate == rate)
    })
}

fn settle(
    found: &[Match],
    render: &[Endpoint],
    wanted: Option<usize>,
    adopting: bool,
) -> Option<usize> {
    let mut state = held();
    if adopting {
        state.released = false;
        state.id = None;
    }
    if let Some(id) = state.id.clone() {
        if let Some(index) = found.iter().position(|entry| render[entry.render].id == id) {
            return Some(index);
        }
        state.id = None;
    }
    if state.released {
        return None;
    }
    let index = wanted.unwrap_or(0);
    let entry = found.get(index)?;
    state.id = Some(render[entry.render].id.clone());
    Some(index)
}

fn chosen(entry: &Match, render: &[Endpoint], capture: &[Endpoint]) -> Chosen {
    let sink = &render[entry.render];
    let mic = &capture[entry.capture];
    Chosen {
        device: endpoints::mpv_device(&sink.id),
        render_label: sink.name.clone(),
        mic_id: mic.id.clone(),
        mic_label: mic.name.clone(),
        format: endpoints::format(Side::Render, &sink.id),
    }
}

fn read(rate: Option<u32>, adopting: bool) -> Reading {
    let (render, capture, found) = scan();
    if found.is_empty() {
        return Reading::default();
    }
    let wanted = preferred(&found, &render, rate);
    let index = settle(&found, &render, wanted, adopting);
    Reading {
        installed: true,
        cable: index.map(|index| chosen(&found[index], &render, &capture)),
        requested_rate: held().requested,
    }
}

pub fn status() -> Reading {
    read(None, false)
}

pub fn adopt(rate: Option<u32>) -> Reading {
    let reading = read(rate, true);
    if reading.cable.is_some() {
        held().requested = rate;
    }
    Reading {
        requested_rate: rate,
        ..reading
    }
}

pub fn release() -> Reading {
    {
        let mut state = held();
        state.released = true;
        state.id = None;
        state.requested = None;
    }
    read(None, false)
}
