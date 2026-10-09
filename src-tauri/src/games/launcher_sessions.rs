//! Battle.net sessions are observations of game processes, not launcher handoff receipts.
use super::launcher_scan::{Game, Launcher};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[path = "launcher_processes.rs"]
mod processes;
#[path = "launcher_session_store.rs"]
mod store;
type Result<T> = std::result::Result<T, &'static str>;
const START_TIMEOUT: u64 = 120_000;
const EXIT_GRACE: u64 = 6_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub profile: String,
    pub id: String,
    pub session_id: String,
    pub state: String,
    pub requested_at: u64,
    pub started_at: u64,
    pub updated_at: u64,
    pub elapsed_ms: u64,
    #[serde(default)]
    root: String,
    #[serde(default)]
    processes: Vec<processes::Process>,
}
impl Session {
    fn active(&self) -> bool {
        matches!(self.state.as_str(), "waiting" | "running" | "unconfirmed")
    }
    fn valid(&self) -> bool {
        profile(&self.profile).is_ok()
            && self.id.starts_with("battlenet:")
            && self.id.len() <= 140
            && uuid::Uuid::parse_str(&self.session_id).is_ok()
            && self.root.len() <= 32768
            && Path::new(&self.root).is_absolute()
            && self.processes.len() <= 128
            && self.elapsed_ms < i64::MAX as u64
            && self.started_at <= self.updated_at
    }
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: String,
    pub seconds: u64,
    pub last_played: u64,
}
#[derive(Serialize)]
pub struct Snapshot {
    pub sessions: Vec<Session>,
    pub activity: Vec<Activity>,
    pub error: bool,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn profile(value: &str) -> Result<()> {
    if value.is_empty() || value.len() > 160 || value.chars().any(char::is_control) {
        Err("launcher_session_profile")
    } else {
        Ok(())
    }
}
fn observation_root(game: &Game) -> Result<Option<String>> {
    if game.state != "installed" {
        return Err("launcher_game_missing");
    }
    if game.launcher != Launcher::Battlenet || game.launch_mode == "client" {
        return Ok(None);
    }
    let relative = match game.product_id.as_str() {
        "wow" => "_retail_",
        "wow_classic" => "_classic_",
        "wow_classic_era" => "_classic_era_",
        "wow_classic_anniversary" => "_anniversary_",
        "wowt" => "_ptr_",
        _ => "",
    };
    let path = std::fs::canonicalize(Path::new(&game.install_path).join(relative))
        .map_err(|_| "launcher_game_missing")?;
    if !path.is_dir() {
        return Err("launcher_game_missing");
    }
    Ok(Some(processes::path_key(&path)))
}
fn overlaps(a: &str, b: &str) -> bool {
    a == b || a.starts_with(&format!("{b}/")) || b.starts_with(&format!("{a}/"))
}
fn matches(root: &str, process: &processes::Process) -> bool {
    let Some(relative) = process.path.strip_prefix(&format!("{root}/")) else {
        return false;
    };
    let name = relative.rsplit('/').next().unwrap_or("");
    name.ends_with(".exe")
        && ![
            "launcher",
            "battle.net",
            "agent",
            "crash",
            "report",
            "error",
            "unins",
            "updat",
            "install",
            "cef",
            "browser",
        ]
        .iter()
        .any(|part| name.contains(part))
}

struct Watch {
    session: Session,
    last_tick: Instant,
    missing_ms: u64,
    waiting_ms: u64,
    restoring: bool,
}
impl Watch {
    fn observe(&mut self, sample: &processes::Sample, elapsed: u64, timestamp: u64) {
        self.waiting_ms = self.waiting_ms.saturating_add(elapsed);
        let observed: Vec<_> = sample
            .processes
            .iter()
            .filter(|p| matches(&self.session.root, p))
            .cloned()
            .collect();
        let continuous = self.session.processes.iter().any(|p| observed.contains(p));
        let inaccessible = self
            .session
            .processes
            .iter()
            .any(|p| sample.inaccessible.contains(&p.pid));
        if self.restoring {
            self.restoring = false;
            // No clock credit across an app shutdown. Only the same live process can resume.
            if !continuous && !inaccessible {
                self.session.state = "interrupted".into();
                return;
            }
        }
        self.session.updated_at = timestamp;
        if !observed.is_empty() {
            if self.session.started_at == 0 {
                self.session.started_at = timestamp;
            }
            if continuous && self.session.state == "running" && elapsed <= 5_000 {
                self.session.elapsed_ms = self.session.elapsed_ms.saturating_add(elapsed);
            }
            self.session.state = "running".into();
            self.session.processes = observed;
            self.missing_ms = 0;
        } else if inaccessible {
            self.session.state = "unconfirmed".into();
            self.missing_ms = 0;
        } else if self.session.started_at == 0 {
            if self.waiting_ms >= START_TIMEOUT {
                self.session.state = "notStarted".into();
            }
        } else {
            self.missing_ms = self.missing_ms.saturating_add(elapsed);
            // Keep identity during a short bootstrap/child transition, but credit no absent ticks.
            self.session.state = if self.missing_ms >= EXIT_GRACE {
                "ended"
            } else {
                "unconfirmed"
            }
            .into();
        }
    }
}
struct State {
    active: Vec<Watch>,
    worker: bool,
    error: bool,
}
struct Service {
    root: PathBuf,
    state: Mutex<State>,
}
fn services() -> &'static Mutex<HashMap<PathBuf, Arc<Service>>> {
    static VALUE: OnceLock<Mutex<HashMap<PathBuf, Arc<Service>>>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn service(root: &Path) -> Result<Arc<Service>> {
    let mut services = services()
        .lock()
        .map_err(|_| "launcher_observation_failed")?;
    if let Some(service) = services.get(root) {
        return Ok(service.clone());
    }
    let active = store::active(root)?
        .into_iter()
        .map(|session| Watch {
            session,
            last_tick: Instant::now(),
            missing_ms: 0,
            waiting_ms: 0,
            restoring: true,
        })
        .collect();
    let value = Arc::new(Service {
        root: root.into(),
        state: Mutex::new(State {
            active,
            worker: false,
            error: false,
        }),
    });
    services.insert(root.into(), value.clone());
    drop(services);
    start_worker(&value)?;
    Ok(value)
}
fn start_worker(service: &Arc<Service>) -> Result<()> {
    let mut state = service
        .state
        .lock()
        .map_err(|_| "launcher_observation_failed")?;
    if state.worker || state.active.is_empty() {
        return Ok(());
    }
    state.worker = true;
    let service = service.clone();
    if std::thread::Builder::new()
        .name("harbor-game-observation".into())
        .spawn(move || loop {
            let sample = processes::sample();
            let Ok(mut state) = service.state.lock() else {
                return;
            };
            let mut failed = false;
            for watch in &mut state.active {
                let elapsed = watch.last_tick.elapsed().as_millis() as u64;
                watch.last_tick = Instant::now();
                if watch.session.active() {
                    match &sample {
                        Ok(sample) => watch.observe(sample, elapsed, now()),
                        Err(_) => {
                            watch.session.state = "unconfirmed".into();
                            failed = true;
                        }
                    }
                }
                if store::save(&service.root, &watch.session).is_err() {
                    failed = true;
                }
            }
            state.error = failed;
            // Retain unsaved final receipts for retry; never silently lose their totals.
            if !failed {
                state.active.retain(|watch| watch.session.active());
            }
            if state.active.is_empty() {
                state.worker = false;
                return;
            }
            drop(state);
            std::thread::sleep(Duration::from_secs(2));
        })
        .is_err()
    {
        state.worker = false;
        return Err("launcher_observation_failed");
    }
    Ok(())
}

pub fn snapshot(root: &Path, owner: &str) -> Result<Snapshot> {
    profile(owner)?;
    let service = service(root)?;
    let state = service
        .state
        .lock()
        .map_err(|_| "launcher_observation_failed")?;
    let mut sessions = store::latest(root, owner)?;
    for watch in &state.active {
        if watch.session.profile == owner {
            sessions.retain(|s| s.session_id != watch.session.session_id);
            sessions.push(watch.session.clone());
        }
    }
    // Process paths/PIDs stay native; the UI needs only status and observed duration.
    for session in &mut sessions {
        session.root.clear();
        session.processes.clear();
    }
    Ok(Snapshot {
        sessions,
        activity: store::activity(root, owner)?,
        error: state.error,
    })
}

/// Dispatch runs only after the freshly scanned game and observation reservation agree.
pub fn launch(
    root: &Path,
    owner: &str,
    game: &Game,
    dispatch: impl FnOnce() -> Result<()>,
) -> Result<bool> {
    profile(owner)?;
    let Some(watch_root) = observation_root(game)? else {
        dispatch()?;
        return Ok(false);
    };
    let service = service(root)?;
    let mut state = service
        .state
        .lock()
        .map_err(|_| "launcher_observation_failed")?;
    if state
        .active
        .iter()
        .any(|watch| overlaps(&watch_root, &watch.session.root))
    {
        return Err("launcher_running");
    }
    if state.active.len() >= 16 {
        return Err("launcher_observation_limit");
    }
    let sample = processes::sample()?;
    // Do not claim a game already started outside this profile as a new Harbor session.
    if sample
        .processes
        .iter()
        .any(|process| matches(&watch_root, process))
    {
        return Err("launcher_running");
    }
    let timestamp = now();
    let mut session = Session {
        profile: owner.into(),
        id: game.id.clone(),
        session_id: uuid::Uuid::new_v4().to_string(),
        state: "waiting".into(),
        requested_at: timestamp,
        started_at: 0,
        updated_at: timestamp,
        elapsed_ms: 0,
        root: watch_root,
        processes: Vec::new(),
    };
    store::save(root, &session)?;
    if let Err(error) = dispatch() {
        session.state = "failed".into();
        store::save(root, &session)?;
        return Err(error);
    }
    state.active.push(Watch {
        session,
        last_tick: Instant::now(),
        missing_ms: 0,
        waiting_ms: 0,
        restoring: false,
    });
    drop(state);
    start_worker(&service)?;
    Ok(true)
}

#[cfg(test)]
#[path = "launcher_sessions_tests.rs"]
mod tests;
