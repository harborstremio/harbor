use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use discord_rich_presence::activity::{
    Activity, ActivityType, Assets, Button, Party, StatusDisplayType, Timestamps,
};
use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use serde::Deserialize;
use tauri::{AppHandle, Manager};

const APP_ID: &str = "1510339683215736892";
const SMALL_IMAGE_KEY: &str = "harbor_logo";

#[derive(Default, Clone)]
struct Desired {
    active: bool,
    paused: bool,
    details: Option<String>,
    state: Option<String>,
    large_image: Option<String>,
    large_text: Option<String>,
    small_image: Option<String>,
    small_text: Option<String>,
    start_ts: Option<i64>,
    end_ts: Option<i64>,
    party_id: Option<String>,
    party_size: Option<[i32; 2]>,
    buttons: Vec<(String, String)>,
}

pub struct DiscordState {
    desired: Mutex<Desired>,
    enabled: AtomicBool,
    generation: AtomicU64,
}

impl DiscordState {
    pub fn new() -> Self {
        Self {
            desired: Mutex::new(Desired::default()),
            enabled: AtomicBool::new(false),
            generation: AtomicU64::new(0),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceInput {
    pub details: Option<String>,
    pub state: Option<String>,
    pub poster_url: Option<String>,
    pub large_text: Option<String>,
    pub small_image_url: Option<String>,
    pub small_text: Option<String>,
    pub start_ts: Option<i64>,
    pub end_ts: Option<i64>,
    #[serde(default)]
    pub paused: bool,
    pub party_id: Option<String>,
    pub party_size: Option<[i32; 2]>,
    #[serde(default)]
    pub buttons: Vec<ButtonInput>,
}

#[derive(Debug, Deserialize)]
pub struct ButtonInput {
    pub label: String,
    pub url: String,
}

fn clean(s: Option<String>) -> Option<String> {
    s.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

fn safe_image(url: Option<String>) -> Option<String> {
    let u = url?;
    if u.starts_with("https://") && u.len() <= 256 {
        Some(u)
    } else {
        None
    }
}

fn safe_button_url(url: &str) -> bool {
    url.starts_with("https://") && url.len() <= 512
}

fn safe_buttons(buttons: Vec<ButtonInput>) -> Vec<(String, String)> {
    buttons
        .into_iter()
        .filter(|b| !b.label.trim().is_empty() && safe_button_url(&b.url))
        .take(2)
        .map(|b| (b.label.trim().to_string(), b.url))
        .collect()
}

#[tauri::command]
pub fn discord_set_presence(state: tauri::State<'_, DiscordState>, p: PresenceInput) {
    {
        let mut d = state.desired.lock().unwrap();
        d.active = true;
        d.paused = p.paused;
        d.details = clean(p.details);
        d.state = clean(p.state);
        d.large_image = safe_image(p.poster_url);
        d.large_text = clean(p.large_text);
        d.small_image = safe_image(p.small_image_url);
        d.small_text = clean(p.small_text);
        d.start_ts = if p.paused { None } else { p.start_ts };
        d.end_ts = if p.paused { None } else { p.end_ts };
        d.party_id = clean(p.party_id);
        d.party_size = p.party_size;
        d.buttons = safe_buttons(p.buttons);
    }
    state.generation.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
pub fn discord_clear(state: tauri::State<'_, DiscordState>) {
    {
        let mut d = state.desired.lock().unwrap();
        *d = Desired::default();
    }
    state.generation.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
pub fn discord_set_enabled(state: tauri::State<'_, DiscordState>, on: bool) {
    state.enabled.store(on, Ordering::SeqCst);
    state.generation.fetch_add(1, Ordering::SeqCst);
}

pub fn shutdown(app: &AppHandle) {
    let state = app.state::<DiscordState>();
    state.enabled.store(false, Ordering::SeqCst);
    if let Ok(mut d) = state.desired.lock() {
        *d = Desired::default();
    };
}

pub fn run_loop(app: AppHandle) {
    if APP_ID.starts_with("REPLACE_WITH") {
        eprintln!("[harbor::discord] APP_ID not configured, rich presence disabled");
        return;
    }
    let mut client: Option<DiscordIpcClient> = None;
    let mut last_gen: u64 = u64::MAX;
    let mut backoff_ms: u64 = 1000;

    loop {
        std::thread::sleep(Duration::from_secs(1));
        let state = app.state::<DiscordState>();

        if !state.enabled.load(Ordering::SeqCst) {
            if let Some(c) = client.as_mut() {
                let _ = c.clear_activity();
                let _ = c.close();
            }
            client = None;
            last_gen = u64::MAX;
            continue;
        }

        if client.is_none() {
            let mut c = DiscordIpcClient::new(APP_ID);
            if c.connect().is_err() {
                continue;
            }
            client = Some(c);
            last_gen = u64::MAX;
            backoff_ms = 1000;
        }

        let gen = state.generation.load(Ordering::SeqCst);
        if gen == last_gen {
            continue;
        }
        let desired = state.desired.lock().unwrap().clone();
        let Some(c) = client.as_mut() else { continue };

        let result = if desired.active {
            let mut assets = match desired.small_image.as_deref() {
                Some(s) => Assets::new()
                    .small_image(s)
                    .small_text(desired.small_text.as_deref().unwrap_or("Harbor")),
                None => Assets::new().small_image(SMALL_IMAGE_KEY).small_text("Harbor"),
            };
            if let Some(img) = desired.large_image.as_deref() {
                assets = assets.large_image(img);
            }
            if let Some(t) = desired.large_text.as_deref() {
                assets = assets.large_text(t);
            }
            let mut act = Activity::new()
                .activity_type(ActivityType::Watching)
                .status_display_type(StatusDisplayType::Details)
                .assets(assets);
            if let Some(d) = desired.details.as_deref() {
                act = act.details(d);
            }
            if let Some(s) = desired.state.as_deref() {
                act = act.state(s);
            }
            match (desired.start_ts, desired.end_ts) {
                (Some(start), Some(end)) => {
                    act = act.timestamps(Timestamps::new().start(start).end(end));
                }
                (Some(start), None) => {
                    act = act.timestamps(Timestamps::new().start(start));
                }
                _ => {}
            }
            if let Some(size) = desired.party_size {
                let mut party = Party::new().size(size);
                if let Some(id) = desired.party_id.as_deref() {
                    party = party.id(id);
                }
                act = act.party(party);
            }
            if !desired.buttons.is_empty() {
                let buttons: Vec<Button> = desired
                    .buttons
                    .iter()
                    .map(|(label, url)| Button::new(label, url))
                    .collect();
                act = act.buttons(buttons);
            }
            c.set_activity(act)
        } else {
            c.clear_activity()
        };

        if result.is_ok() {
            last_gen = gen;
            backoff_ms = 1000;
        } else {
            let _ = c.reconnect();
            std::thread::sleep(Duration::from_millis(backoff_ms));
            backoff_ms = (backoff_ms.saturating_mul(2)).min(60_000);
        }
    }
}
