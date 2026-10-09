//! Durable opt-in policies. One native worker observes only these transfers;
//! catalog size and the lifetime of a Downloads view do not affect dispatch.
use super::{
    archive_jobs::{Archives, PrepareArchive},
    archives,
    download_metadata::DownloadGame,
};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Condvar, Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
type Result<T> = std::result::Result<T, &'static str>;
const MAX_CHOICES: usize = 400;
const MAX_STORE: usize = 2 * 1024 * 1024;
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Engine {
    Direct,
    Torrent,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Target {
    pub profile: String,
    pub engine: Engine,
    pub download_id: String,
    pub archive: String,
    /// Other direct-file records explicitly selected with this archive. A file
    /// appearing next to it later cannot silently become part of the choice.
    #[serde(default)]
    pub members: Vec<String>,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Waiting,
    Queued,
    Dispatching,
    Started,
    Failed,
    Disabled,
}
impl Status {
    fn pending(self) -> bool {
        matches!(self, Self::Waiting | Self::Queued | Self::Dispatching)
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Choice {
    pub id: String,
    pub target: Target,
    pub identity: String,
    pub parent: String,
    pub name: String,
    pub status: Status,
    pub error: Option<String>,
    pub updated_at: u64,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Configure {
    pub target: Target,
    pub parent: String,
    pub name: String,
}
pub struct Snapshot {
    pub identity: String,
    pub source: String,
    pub origin_source: String,
    pub game: Option<DownloadGame>,
    pub ready: bool,
    pub sha256: Option<String>,
    pub allowed_parts: Vec<String>,
    pub expected_parts: Option<Vec<archives::ArchivePart>>,
}
type Resolve = Arc<dyn Fn(&Target) -> Result<Snapshot> + Send + Sync>;
type Intake = Arc<dyn Fn(&Preparations) -> Result<bool> + Send + Sync>;
#[derive(Serialize, Deserialize)]
struct Store {
    version: u32,
    choices: Vec<Choice>,
}
pub struct Preparations {
    root: PathBuf,
    choices: Mutex<Vec<Choice>>,
    serial: Mutex<()>,
    wake: Condvar,
    signal: Mutex<u64>,
    stopped: AtomicBool,
    worker: Mutex<Option<std::thread::JoinHandle<()>>>,
    archives: Arc<Archives>,
    resolve: Resolve,
    intake: Mutex<Option<Intake>>,
    intake_pending: AtomicBool,
    emit: Arc<dyn Fn(Choice) + Send + Sync>,
}
pub(super) fn valid_target(target: &Target) -> bool {
    !target.profile.is_empty()
        && target.profile.len() <= 160
        && !target.profile.chars().any(char::is_control)
        && uuid::Uuid::parse_str(&target.download_id).is_ok()
        && !target.archive.is_empty()
        && target.archive.len() <= 8192
        && !target.archive.chars().any(char::is_control)
        && target.members.len() < 200
        && target
            .members
            .iter()
            .all(|id| id != &target.download_id && uuid::Uuid::parse_str(id).is_ok())
        && target
            .members
            .iter()
            .collect::<std::collections::HashSet<_>>()
            .len()
            == target.members.len()
        && (target.engine == Engine::Direct || target.members.is_empty())
}
pub(super) fn valid_choice(choice: &Choice) -> bool {
    uuid::Uuid::parse_str(&choice.id).is_ok()
        && valid_target(&choice.target)
        && choice.identity.len() == 64
        && choice.identity.bytes().all(|byte| byte.is_ascii_hexdigit())
        && choice.parent.len() <= 8192
        && PathBuf::from(&choice.parent).is_absolute()
        && !choice.name.is_empty()
        && choice.name.len() <= 180
}
pub(super) fn acquisition_choice(
    target: Target,
    parent: String,
    name: String,
    identity: String,
) -> Result<Choice> {
    let destination = archives::planned_destination(&parent, &name)?;
    let choice = Choice {
        id: uuid::Uuid::new_v4().to_string(),
        target,
        identity,
        parent: destination
            .parent()
            .ok_or("archive_destination")?
            .to_string_lossy()
            .into(),
        name,
        status: Status::Waiting,
        error: None,
        updated_at: now(),
    };
    if !valid_choice(&choice) {
        return Err("archive_profile");
    }
    Ok(choice)
}
impl Preparations {
    pub(crate) fn cleanup_usage(&self,id:&str)->Result<Vec<super::archive_cleanup::Usage>>{
        use super::archive_cleanup::{Usage,Blocker};
        Ok(self.choices.lock().map_err(|_|"archive_store")?.iter()
            .filter(|choice|choice.id!=id&&!matches!(choice.status,Status::Started|Status::Disabled))
            .map(|choice|Usage{path:choice.target.archive.clone(),tree:false,family:true,reason:Blocker::PendingPreparation}).collect())
    }
    pub fn load(
        root: PathBuf,
        archives: Arc<Archives>,
        resolve: impl Fn(&Target) -> Result<Snapshot> + Send + Sync + 'static,
        emit: impl Fn(Choice) + Send + Sync + 'static,
    ) -> Result<Arc<Self>> {
        fs::create_dir_all(&root).map_err(|_| "archive_store")?;
        let root = archives::plain_dir(&root)?;
        let path = root.join("choices.json");
        let choices = if path.exists() {
            let mut bytes = Vec::new();
            File::open(path)
                .map_err(|_| "archive_store")?
                .take(MAX_STORE as u64 + 1)
                .read_to_end(&mut bytes)
                .map_err(|_| "archive_store")?;
            if bytes.len() > MAX_STORE {
                return Err("archive_store");
            }
            let store: Store = serde_json::from_slice(&bytes).map_err(|_| "archive_store")?;
            let mut ids = std::collections::HashSet::new();
            let mut targets = std::collections::HashSet::new();
            if store.version != 1
                || store.choices.len() > MAX_CHOICES
                || store.choices.iter().any(|choice| {
                    uuid::Uuid::parse_str(&choice.id).is_err()
                        || !ids.insert(choice.id.clone())
                        || !valid_target(&choice.target)
                        || !targets.insert((
                            choice.target.profile.clone(),
                            format!("{:?}", choice.target.engine),
                            choice.target.download_id.clone(),
                        ))
                        || choice.identity.len() != 64
                        || !choice.identity.bytes().all(|b| b.is_ascii_hexdigit())
                        || choice.parent.len() > 8192
                        || !PathBuf::from(&choice.parent).is_absolute()
                        || choice.name.is_empty()
                        || choice.name.len() > 180
                })
            {
                return Err("archive_store");
            }
            store.choices
        } else {
            Vec::new()
        };
        Ok(Arc::new(Self {
            root,
            choices: Mutex::new(choices),
            serial: Mutex::new(()),
            wake: Condvar::new(),
            signal: Mutex::new(0),
            stopped: AtomicBool::new(false),
            worker: Mutex::new(None),
            archives,
            resolve: Arc::new(resolve),
            intake: Mutex::new(None),
            intake_pending: AtomicBool::new(false),
            emit: Arc::new(emit),
        }))
    }
    pub(super) fn set_intake(
        &self,
        intake: impl Fn(&Preparations) -> Result<bool> + Send + Sync + 'static,
    ) -> Result<()> {
        *self.intake.lock().map_err(|_| "archive_store")? = Some(Arc::new(intake));
        self.notify();
        Ok(())
    }
    /// The engine owns the durable intake until this write succeeds. Replaying
    /// an intake cannot replace an edited, disabled, or consumed choice.
    pub(super) fn adopt(&self, choice: Choice) -> Result<()> {
        let _serial = self.serial.lock().map_err(|_| "archive_store")?;
        if !valid_choice(&choice) || choice.status != Status::Waiting {
            return Err("archive_store");
        }
        let mut held = self.choices.lock().map_err(|_| "archive_store")?;
        if held.iter().any(|old| {
            old.target.profile == choice.target.profile
                && old.target.engine == choice.target.engine
                && old.target.download_id == choice.target.download_id
        }) {
            return Ok(());
        }
        if held.iter().any(|old| old.id == choice.id) {
            return Err("archive_store");
        }
        let mut next = held.clone();
        self.make_room(&mut next)?;
        next.push(choice.clone());
        self.persist(&next)?;
        *held = next;
        drop(held);
        (self.emit)(choice);
        Ok(())
    }
    fn make_room(&self, choices: &mut Vec<Choice>) -> Result<()> {
        if choices.len() < MAX_CHOICES {
            return Ok(());
        }
        // Only a deleted acquisition is safe to evict: an engine may still own
        // an unacknowledged intent for an existing disabled/consumed choice.
        let index = choices
            .iter()
            .enumerate()
            .filter(|(_, choice)| {
                // A missing multipart sibling does not mean the acquisition
                // owning this choice was removed. Its old intake can still exist.
                let root = Target {
                    members: Vec::new(),
                    ..choice.target.clone()
                };
                !choice.status.pending()
                    && matches!(
                        (self.resolve)(&root),
                        Err("transfer_missing" | "torrent_missing")
                    )
            })
            .min_by_key(|(_, choice)| choice.updated_at)
            .map(|(index, _)| index)
            .ok_or("archive_history")?;
        choices.remove(index);
        Ok(())
    }
    fn persist(&self, choices: &[Choice]) -> Result<()> {
        let bytes = serde_json::to_vec(&Store {
            version: 1,
            choices: choices.to_vec(),
        })
        .map_err(|_| "archive_store")?;
        if bytes.len() > MAX_STORE {
            return Err("archive_history");
        }
        let temporary = self
            .root
            .join(format!("choices-{}.tmp", uuid::Uuid::new_v4()));
        let write = || -> std::io::Result<()> {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)?;
            file.write_all(&bytes)?;
            file.sync_all()?;
            fs::rename(&temporary, self.root.join("choices.json"))
        };
        if write().is_err() {
            let _ = fs::remove_file(temporary);
            return Err("archive_store");
        }
        Ok(())
    }
    pub fn list(&self, profile: &str) -> Result<Vec<Choice>> {
        Ok(self
            .choices
            .lock()
            .map_err(|_| "archive_store")?
            .iter()
            .filter(|choice| choice.target.profile == profile)
            .cloned()
            .collect())
    }
    pub fn configure(&self, request: Configure) -> Result<Choice> {
        let _serial = self.serial.lock().map_err(|_| "archive_store")?;
        if !valid_target(&request.target) {
            return Err("archive_profile");
        }
        let snapshot = (self.resolve)(&request.target)?;
        if snapshot.identity.len() != 64
            || !snapshot.identity.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err("archive_changed");
        }
        let destination = archives::planned_destination(&request.parent, &request.name)?;
        let mut held = self.choices.lock().map_err(|_| "archive_store")?;
        let mut next = held.clone();
        if let Some(old) = next.iter().find(|choice| {
            choice.target.profile == request.target.profile
                && choice.target.engine == request.target.engine
                && choice.target.download_id == request.target.download_id
        }) {
            if old.status == Status::Dispatching
                || self.archives.list(&old.target.profile)?.iter().any(|job| {
                    job.id == old.id && job.status == super::archive_jobs::Status::Running
                })
            {
                return Err("archive_busy");
            }
        }
        next.retain(|choice| {
            !(choice.target.profile == request.target.profile
                && choice.target.engine == request.target.engine
                && choice.target.download_id == request.target.download_id)
        });
        self.make_room(&mut next)?;
        let choice = Choice {
            id: uuid::Uuid::new_v4().to_string(),
            target: request.target,
            identity: snapshot.identity,
            parent: destination
                .parent()
                .ok_or("archive_destination")?
                .to_string_lossy()
                .into_owned(),
            name: request.name,
            status: if snapshot.ready {
                Status::Queued
            } else {
                Status::Waiting
            },
            error: None,
            updated_at: now(),
        };
        next.push(choice.clone());
        self.persist(&next)?;
        *held = next;
        drop(held);
        (self.emit)(choice.clone());
        self.notify();
        Ok(choice)
    }
    pub fn disable(&self, profile: &str, id: &str) -> Result<()> {
        let _serial = self.serial.lock().map_err(|_| "archive_store")?;
        let choice = self
            .list(profile)?
            .into_iter()
            .find(|choice| choice.id == id)
            .ok_or("archive_expired")?;
        if choice.status == Status::Dispatching
            || self
                .archives
                .list(profile)?
                .iter()
                .any(|job| job.id == id && job.status == super::archive_jobs::Status::Running)
        {
            return Err("archive_busy");
        }
        self.transition(id, Status::Disabled, None)
    }
    fn transition(&self, id: &str, status: Status, error: Option<&str>) -> Result<()> {
        let mut held = self.choices.lock().map_err(|_| "archive_store")?;
        let mut next = held.clone();
        let choice = next
            .iter_mut()
            .find(|choice| choice.id == id)
            .ok_or("archive_expired")?;
        if choice.status == status && choice.error.as_deref() == error {
            return Ok(());
        }
        choice.status = status;
        choice.error = error.map(str::to_owned);
        choice.updated_at = now().max(choice.updated_at.saturating_add(1));
        let event = choice.clone();
        self.persist(&next)?;
        *held = next;
        drop(held);
        (self.emit)(event);
        Ok(())
    }
    pub(super) fn notify(&self) {
        if let Ok(mut signal) = self.signal.lock() {
            *signal = signal.wrapping_add(1);
            self.wake.notify_all();
        }
    }
    pub fn start(self: &Arc<Self>) -> Result<()> {
        let mut held = self.worker.lock().map_err(|_| "archive_store")?;
        if held.is_some() {
            return Ok(());
        }
        let weak = Arc::downgrade(self);
        *held = Some(
            std::thread::Builder::new()
                .name("harbor-unpack-queue".into())
                .spawn(move || {
                    while let Some(manager) = weak.upgrade() {
                        if manager.stopped.load(Ordering::Relaxed) {
                            break;
                        }
                        let observed = manager.signal.lock().map(|signal| *signal).unwrap_or(0);
                        manager.tick();
                        if let Ok(signal) = manager.signal.lock() {
                            if *signal == observed && !manager.stopped.load(Ordering::Relaxed) {
                                if manager.intake_pending.load(Ordering::Relaxed)
                                    || manager.choices.lock().is_ok_and(|choices| {
                                        choices.iter().any(|choice| choice.status.pending())
                                    })
                                {
                                    let _ =
                                        manager.wake.wait_timeout(signal, Duration::from_secs(2));
                                } else {
                                    drop(manager.wake.wait(signal));
                                }
                            }
                        };
                    }
                })
                .map_err(|_| "archive_start")?,
        );
        Ok(())
    }
    pub(crate) fn tick(&self) {
        if let Some(intake) = self.intake.lock().ok().and_then(|value| value.clone()) {
            match intake(self) {
                Ok(pending) => self.intake_pending.store(pending, Ordering::Relaxed),
                Err(_) => {
                    self.intake_pending.store(true, Ordering::Relaxed);
                    return;
                }
            }
        }
        let choices = match self.choices.lock() {
            Ok(held) => held
                .iter()
                .filter(|choice| choice.status.pending())
                .cloned()
                .collect::<Vec<_>>(),
            Err(_) => return,
        };
        for choice in choices {
            if self.stopped.load(Ordering::Relaxed) {
                break;
            }
            let Ok(_serial) = self.serial.lock() else {
                return;
            };
            if !self.choices.lock().is_ok_and(|items| {
                items
                    .iter()
                    .any(|current| current.id == choice.id && current.status.pending())
            }) {
                continue;
            }
            // A saved dispatch boundary is reconciled before touching the source.
            match self
                .archives
                .contains_job(&choice.target.profile, &choice.id)
            {
                Ok(true) => {
                    let _ = self.transition(&choice.id, Status::Started, None);
                    continue;
                }
                Err(_) => continue,
                _ => {}
            }
            if archives::is_busy() {
                return;
            }
            let snapshot = match (self.resolve)(&choice.target) {
                Ok(snapshot) => snapshot,
                Err("archive_canceled") => {
                    let _ = self.transition(&choice.id, Status::Disabled, None);
                    continue;
                }
                Err(error) => {
                    let _ = self.transition(&choice.id, Status::Failed, Some(error));
                    continue;
                }
            };
            if snapshot.identity != choice.identity {
                let _ = self.transition(&choice.id, Status::Failed, Some("archive_changed"));
                continue;
            }
            if !snapshot.ready {
                let _ = self.transition(&choice.id, Status::Waiting, None);
                continue;
            }
            if self
                .transition(&choice.id, Status::Dispatching, None)
                .is_err()
            {
                continue;
            }
            let result = self.archives.prepare(PrepareArchive {
                id: choice.id.clone(),
                profile: choice.target.profile.clone(),
                source: snapshot.source,
                parent: choice.parent.clone(),
                name: choice.name.clone(),
                origin_source: Some(snapshot.origin_source),
                game: snapshot.game,
                expected_sha256: snapshot.sha256,
                allowed_parts: Some(snapshot.allowed_parts),
                expected_parts: snapshot.expected_parts,
            });
            match result {
                Ok(_) => {
                    let _ = self.transition(&choice.id, Status::Started, None);
                }
                Err("archive_busy") => {
                    let _ = self.transition(&choice.id, Status::Queued, None);
                }
                Err(error) => {
                    let _ = self.transition(&choice.id, Status::Failed, Some(error));
                }
            }
        }
    }
    #[cfg(test)]
    pub fn stop(&self) {
        self.stopped.store(true, Ordering::Relaxed);
        self.notify();
        if let Ok(mut handle) = self.worker.lock() {
            if let Some(handle) = handle.take() {
                let _ = handle.join();
            }
        }
    }
}

#[cfg(test)]
#[path = "download_preparation_tests.rs"]
mod tests;
