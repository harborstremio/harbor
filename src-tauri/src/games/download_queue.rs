use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::PathBuf,
    sync::{Arc, Mutex, OnceLock},
};
use tauri::{Emitter, Manager};
use tokio::sync::Notify;
use tokio_util::sync::CancellationToken;

type Result<T> = std::result::Result<T, &'static str>;
const LIMIT: usize = 1024;
const ACTIVE_LIMIT: usize = 2;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Direct,
    Torrent,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct Entry {
    pub kind: Kind,
    pub id: String,
    pub profile: String,
}
impl Entry {
    pub fn new(kind: Kind, id: &str, profile: &str) -> Self {
        Self {
            kind,
            id: id.into(),
            profile: profile.into(),
        }
    }
    fn key(&self) -> String {
        key(self.kind, &self.id)
    }
    fn valid(&self) -> bool {
        uuid::Uuid::parse_str(&self.id).is_ok()
            && !self.profile.is_empty()
            && self.profile.len() <= 256
            && !self.profile.contains('\0')
    }
}
fn key(kind: Kind, id: &str) -> String {
    format!(
        "{}:{id}",
        if kind == Kind::Direct {
            "direct"
        } else {
            "torrent"
        }
    )
}
fn changed_profiles(before: &[Entry], after: &[Entry]) -> HashSet<String> {
    before
        .iter()
        .chain(after)
        .filter(|entry| {
            before
                .iter()
                .position(|e| e.kind == entry.kind && e.id == entry.id)
                != after
                    .iter()
                    .position(|e| e.kind == entry.kind && e.id == entry.id)
        })
        .map(|entry| entry.profile.clone())
        .collect()
}
#[derive(Deserialize, Serialize)]
struct Store {
    version: u8,
    entries: Vec<Entry>,
}
struct State {
    entries: Vec<Entry>,
    eligible: HashSet<String>,
    // A ticket exists before its task is spawned, so executor wake order cannot
    // make a later download jump ahead of an already queued one.
    tickets: HashMap<String, bool>,
}
pub struct Queue {
    root: PathBuf,
    state: Mutex<State>,
    changed: Notify,
    emit: Arc<dyn Fn(&str) + Send + Sync>,
}
pub struct Ticket {
    queue: Arc<Queue>,
    key: String,
}
impl Queue {
    pub fn load(
        root: PathBuf,
        seed: Vec<Entry>,
        emit: impl Fn(&str) + Send + Sync + 'static,
    ) -> Result<Arc<Self>> {
        fs::create_dir_all(&root).map_err(|_| "transfer_store")?;
        let path = root.join("order.json");
        let entries = if path.exists() {
            let bytes = super::p2p_files::read(&path, 512 * 1024).map_err(|_| "transfer_store")?;
            let store: Store = serde_json::from_slice(&bytes).map_err(|_| "transfer_store")?;
            if store.version != 1 {
                return Err("transfer_store");
            }
            store.entries
        } else {
            seed
        };
        let mut keys = HashSet::new();
        if entries.len() > LIMIT
            || entries
                .iter()
                .any(|entry| !entry.valid() || !keys.insert(entry.key()))
        {
            return Err("transfer_store");
        }
        let queue = Arc::new(Self {
            root,
            state: Mutex::new(State {
                entries,
                eligible: HashSet::new(),
                tickets: HashMap::new(),
            }),
            changed: Notify::new(),
            emit: Arc::new(emit),
        });
        queue.persist(&*queue.state.lock().map_err(|_| "transfer_store")?)?;
        Ok(queue)
    }
    fn persist(&self, state: &State) -> Result<()> {
        let bytes = serde_json::to_vec(&Store {
            version: 1,
            entries: state.entries.clone(),
        })
        .map_err(|_| "transfer_store")?;
        if bytes.len() > 512 * 1024 {
            return Err("transfer_limit");
        }
        super::p2p_files::atomic(&self.root, "order.json", &bytes).map_err(|_| "transfer_store")
    }
    pub fn register(&self, entries: &[Entry]) -> Result<()> {
        if entries.iter().any(|entry| !entry.valid()) {
            return Err("transfer_store");
        }
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        let old = state.entries.len();
        for entry in entries {
            if let Some(existing) = state
                .entries
                .iter()
                .find(|item| item.kind == entry.kind && item.id == entry.id)
            {
                if existing.profile != entry.profile {
                    state.entries.truncate(old);
                    return Err("transfer_store");
                }
            } else {
                state.entries.push(entry.clone());
            }
        }
        if state.entries.len() > LIMIT {
            state.entries.truncate(old);
            return Err("transfer_limit");
        }
        if old != state.entries.len() {
            if let Err(error) = self.persist(&state) {
                state.entries.truncate(old);
                return Err(error);
            }
        }
        Ok(())
    }
    pub fn eligible(&self, kind: Kind, id: &str, value: bool) {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        let changed = if value {
            state.eligible.insert(key(kind, id))
        } else {
            state.eligible.remove(&key(kind, id))
        };
        drop(state);
        if changed {
            self.changed.notify_waiters();
        }
    }
    pub fn reconcile(&self, kind: Kind, entries: &[Entry]) -> Result<()> {
        if entries.len() > 200 || entries.iter().any(|e| e.kind != kind || !e.valid()) {
            return Err("transfer_store");
        }
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        let known: HashSet<_> = entries.iter().map(Entry::key).collect();
        if known.len() != entries.len() {
            return Err("transfer_store");
        }
        for old in state.entries.iter().filter(|e| e.kind == kind) {
            if let Some(current) = entries.iter().find(|e| e.id == old.id) {
                if current.profile != old.profile {
                    return Err("transfer_store");
                }
            } else if state.tickets.contains_key(&old.key()) {
                return Err("transfer_state");
            }
        }
        let previous = state.entries.clone();
        state
            .entries
            .retain(|e| e.kind != kind || known.contains(&e.key()));
        for entry in entries {
            if !state
                .entries
                .iter()
                .any(|e| e.kind == kind && e.id == entry.id)
            {
                state.entries.push(entry.clone());
            }
        }
        if state.entries.len() > LIMIT {
            state.entries = previous;
            return Err("transfer_limit");
        }
        let profiles = changed_profiles(&previous, &state.entries);
        if state.entries != previous {
            if let Err(error) = self.persist(&state) {
                state.entries = previous;
                return Err(error);
            }
            let retained: HashSet<_> = state.entries.iter().map(Entry::key).collect();
            state.eligible.retain(|key| retained.contains(key));
        }
        drop(state);
        for profile in profiles {
            (self.emit)(&profile);
        }
        Ok(())
    }
    pub fn order(&self, kind: Kind, id: &str) -> u64 {
        self.state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .entries
            .iter()
            .position(|entry| entry.kind == kind && entry.id == id)
            .map_or(u64::MAX, |index| index as u64 + 1)
    }
    pub fn reorder(&self, kind: Kind, profile: &str, id: &str, earlier: bool) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        let index = state
            .entries
            .iter()
            .position(|e| e.kind == kind && e.id == id && e.profile == profile)
            .ok_or("transfer_unknown")?;
        let candidates: Vec<usize> = state
            .entries
            .iter()
            .enumerate()
            .filter(|(_, entry)| {
                entry.profile == profile
                    && state.eligible.contains(&entry.key())
                    && state.tickets.get(&entry.key()) != Some(&true)
            })
            .map(|(i, _)| i)
            .collect();
        let position = candidates
            .iter()
            .position(|i| *i == index)
            .ok_or("transfer_state")?;
        let neighbor = if earlier {
            position.checked_sub(1)
        } else {
            position.checked_add(1)
        }
        .and_then(|p| candidates.get(p).copied());
        let Some(other) = neighbor else {
            return Ok(());
        };
        state.entries.swap(index, other);
        if let Err(error) = self.persist(&state) {
            state.entries.swap(index, other);
            return Err(error);
        }
        drop(state);
        self.changed.notify_waiters();
        (self.emit)(profile);
        Ok(())
    }
    pub fn ticket(self: &Arc<Self>, kind: Kind, profile: &str, id: &str) -> Result<Ticket> {
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        if !state
            .entries
            .iter()
            .any(|entry| entry.kind == kind && entry.id == id && entry.profile == profile)
        {
            return Err("transfer_unknown");
        }
        let key = key(kind, id);
        if state.tickets.contains_key(&key) {
            return Err("transfer_state");
        }
        state.eligible.insert(key.clone());
        state.tickets.insert(key.clone(), false);
        drop(state);
        self.changed.notify_waiters();
        Ok(Ticket {
            queue: self.clone(),
            key,
        })
    }
    pub fn forget(&self, kind: Kind, id: &str) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        let key = key(kind, id);
        if state.tickets.contains_key(&key) {
            return Err("transfer_state");
        }
        let Some(index) = state.entries.iter().position(|entry| entry.key() == key) else {
            return Ok(());
        };
        state.eligible.remove(&key);
        let previous = state.entries.clone();
        let old = state.entries.remove(index);
        if let Err(error) = self.persist(&state) {
            state.entries.insert(index, old);
            return Err(error);
        }
        let profiles = changed_profiles(&previous, &state.entries);
        drop(state);
        for profile in profiles {
            (self.emit)(&profile);
        }
        Ok(())
    }
}
impl Ticket {
    pub async fn acquire(&self, cancel: &CancellationToken) -> Result<()> {
        loop {
            let notified = self.queue.changed.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            if cancel.is_cancelled() {
                return Err("transfer_stopped");
            }
            {
                let mut state = self.queue.state.lock().map_err(|_| "transfer_store")?;
                let active = state.tickets.values().filter(|value| **value).count();
                let first = state
                    .entries
                    .iter()
                    .find(|entry| {
                        state.tickets.get(&entry.key()) == Some(&false)
                            && state.eligible.contains(&entry.key())
                    })
                    .map(Entry::key);
                if active < ACTIVE_LIMIT && first.as_deref() == Some(self.key.as_str()) {
                    state.tickets.insert(self.key.clone(), true);
                    drop(state);
                    self.queue.changed.notify_waiters();
                    return Ok(());
                }
            }
            tokio::select! { _ = cancel.cancelled() => return Err("transfer_stopped"), _ = &mut notified => {} }
        }
    }
}
impl Drop for Ticket {
    fn drop(&mut self) {
        self.queue
            .state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .tickets
            .remove(&self.key);
        self.queue.changed.notify_waiters();
    }
}

// Merge the existing engine orders without depending on which native manager is
// initialized first. Neither migration nor reload starts any download.
fn legacy(root: &std::path::Path) -> Vec<Entry> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Record {
        id: String,
        profile: String,
        created_at: u64,
    }
    #[derive(Deserialize)]
    struct Legacy {
        records: Vec<Record>,
    }
    let read = |folder: &str, kind| -> Vec<(u64, Entry)> {
        let Some(records) =
            super::p2p_files::read(&root.join(folder).join("transfers.json"), 4 * 1024 * 1024)
                .ok()
                .and_then(|bytes| serde_json::from_slice::<Legacy>(&bytes).ok())
                .map(|s| s.records)
        else {
            return Vec::new();
        };
        if records.len() > 200 {
            return Vec::new();
        }
        records
            .into_iter()
            .filter_map(|r| {
                let entry = Entry::new(kind, &r.id, &r.profile);
                entry.valid().then_some((r.created_at, entry))
            })
            .collect()
    };
    let mut direct = read("games", Kind::Direct).into_iter().peekable();
    let mut torrents = read("game-torrents", Kind::Torrent).into_iter().peekable();
    let mut entries = Vec::new();
    while direct.peek().is_some() || torrents.peek().is_some() {
        let from_direct = match (direct.peek(), torrents.peek()) {
            (Some(a), Some(b)) => a.0 <= b.0,
            (Some(_), None) => true,
            _ => false,
        };
        entries.push(if from_direct {
            direct.next().unwrap().1
        } else {
            torrents.next().unwrap().1
        });
    }
    entries
}
pub fn manager(app: &tauri::AppHandle) -> Result<Arc<Queue>> {
    static INSTANCE: OnceLock<Mutex<Option<Arc<Queue>>>> = OnceLock::new();
    let mut held = INSTANCE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|_| "transfer_store")?;
    if let Some(queue) = held.as_ref() {
        return Ok(queue.clone());
    }
    let root = app.path().app_data_dir().map_err(|_| "transfer_store")?;
    let emitter = app.clone();
    let queue = Queue::load(
        root.join("game-download-queue"),
        legacy(&root),
        move |profile| {
            let _ = emitter.emit("games:download-queue", profile);
        },
    )?;
    *held = Some(queue.clone());
    Ok(queue)
}

#[cfg(test)]
#[path = "download_queue_tests.rs"]
mod tests;
