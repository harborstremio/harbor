//! Native-owned, expiring addon reviews. The renderer receives a summary and an
//! opaque token; it cannot change the pinned package or deployment paths.
use super::{
    p2p_files,
    wow_addon_guard::Guard,
    wow_addon_package::{self as package, Result},
    wow_addon_store::{Group, Plan, State, Store},
    wow_addons,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeSet, HashMap},
    path::PathBuf,
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::Emitter;
use tokio_util::sync::CancellationToken;

const TTL: Duration = Duration::from_secs(15 * 60);
const MAX_REVIEWS: usize = 4;
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    profile: String,
    operation_id: String,
    phase: &'static str,
}
fn emit(app: &Option<tauri::AppHandle>, profile: &str, operation: &str, phase: &'static str) {
    if let Some(app) = app {
        let _ = app.emit(
            "games:wow-addon-progress",
            Progress {
                profile: profile.into(),
                operation_id: operation.into(),
                phase,
            },
        );
    }
}

#[derive(Clone, Deserialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Request {
    Install { addon_id: u32 },
    Adopt { addon_id: u32 },
    Remove { addon_id: u32 },
    Restore { backup: String },
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Action {
    Add,
    Keep,
    Replace,
    Remove,
}
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct Folder {
    pub name: String,
    pub action: Action,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub token: String,
    pub id: String,
    pub addon_id: u32,
    pub title: String,
    pub client_version: String,
    pub from_version: Option<String>,
    pub version: Option<String>,
    pub restore: bool,
    pub adopt: bool,
    pub folders: Vec<Folder>,
    pub files: usize,
    pub bytes: u64,
    pub backup_bytes: u64,
    pub dependencies: Vec<String>,
    pub expires_at: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Addon {
    pub id: u32,
    pub title: String,
    pub version: String,
    pub folders: Vec<String>,
    pub files: usize,
    pub bytes: u64,
}
impl From<&Group> for Addon {
    fn from(group: &Group) -> Self {
        Self {
            id: group.id,
            title: group.title.clone(),
            version: group.version.clone(),
            folders: group.folders.clone(),
            files: group.files.len(),
            bytes: group.files.iter().map(|f| f.bytes).sum(),
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    pub token: String,
    pub created_at: u64,
    pub addon: Addon,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub client_version: String,
    pub revision: Option<String>,
    pub addons: Vec<Addon>,
    pub backups: Vec<Backup>,
    pub recovery_pending: bool,
    pub can_adopt: bool,
}
impl Workspace {
    fn from_state(id: String, version: String, state: Option<State>, pending: bool) -> Self {
        Self {
            id,
            client_version: version,
            revision: state.as_ref().map(|s| s.revision.clone()),
            recovery_pending: pending,
            can_adopt: true,
            addons: state
                .as_ref()
                .map(|s| s.packages.iter().map(Addon::from).collect())
                .unwrap_or_default(),
            backups: state
                .as_ref()
                .map(|s| {
                    s.backups
                        .iter()
                        .map(|b| Backup {
                            token: b.token.clone(),
                            created_at: b.created_at,
                            addon: Addon::from(&b.group),
                        })
                        .collect()
                })
                .unwrap_or_default(),
        }
    }
}
pub async fn workspace(id: String) -> Result<Workspace> {
    tokio::task::spawn_blocking(move || {
        let (root, version) = wow_addons::target(&id)?;
        let (state, pending) = Store::snapshot(&root, &id)?;
        Ok(Workspace::from_state(id, version, state, pending))
    })
    .await
    .map_err(|_| "wow_addons_failed")?
}

pub struct Prepared {
    profile: String,
    id: String,
    root: PathBuf,
    version: String,
    created: Instant,
    store: Store,
    plan: Plan,
    review: Review,
}
impl Drop for Prepared {
    fn drop(&mut self) {
        // A recovery journal blocks discard; preserve its stage if apply failed.
        let _ = self.store.discard(&self.plan);
    }
}
impl Prepared {
    fn new(
        profile: String,
        id: String,
        root: PathBuf,
        version: String,
        store: Store,
        plan: Plan,
        restore: bool,
    ) -> Result<Self> {
        let item = plan
            .next
            .as_ref()
            .or(plan.previous.as_ref())
            .ok_or("wow_addons_record")?;
        let previous = plan
            .previous
            .as_ref()
            .map(|v| v.folders.as_slice())
            .unwrap_or_default();
        let next = plan
            .next
            .as_ref()
            .map(|v| v.folders.as_slice())
            .unwrap_or_default();
        let names: BTreeSet<_> = previous.iter().chain(next).cloned().collect();
        let folders = names
            .into_iter()
            .map(|name| {
                let action = if plan.is_adoption() {
                    Action::Keep
                } else {
                    match (previous.contains(&name), next.contains(&name)) {
                        (true, true) => Action::Replace,
                        (false, true) => Action::Add,
                        _ => Action::Remove,
                    }
                };
                Folder { name, action }
            })
            .collect();
        let bytes = |group: &Group| group.files.iter().map(|file| file.bytes).sum();
        let review = Review {
            token: plan.token.clone(),
            id: id.clone(),
            addon_id: item.id,
            title: item.title.clone(),
            client_version: version.clone(),
            from_version: plan.previous.as_ref().map(|v| v.version.clone()),
            version: plan.next.as_ref().map(|v| v.version.clone()),
            restore,
            adopt: plan.is_adoption(),
            folders,
            files: plan.next.as_ref().map_or(0, |v| v.files.len()),
            bytes: plan.next.as_ref().map_or(0, bytes),
            backup_bytes: plan.previous.as_ref().map_or(0, bytes),
            dependencies: plan
                .next
                .as_ref()
                .map(|v| v.dependencies.clone())
                .unwrap_or_default(),
            expires_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64
                + TTL.as_millis() as u64,
        };
        Ok(Self {
            profile,
            id,
            root,
            version,
            created: Instant::now(),
            store,
            plan,
            review,
        })
    }
    fn validate(&self, profile: &str) -> Result<()> {
        if self.profile != profile {
            return Err("wow_addons_review");
        }
        if self.created.elapsed() >= TTL {
            return Err("wow_addons_expired");
        }
        Ok(())
    }
    fn commit(&self, guard: &Guard, cancel: &CancellationToken) -> Result<State> {
        guard.matches(&self.root, &self.version)?;
        self.store.apply(&self.plan, &guard.version, cancel)
    }
}

#[derive(Default)]
struct Book {
    plans: HashMap<String, Prepared>,
}
impl Book {
    fn take(&mut self, profile: &str, token: &str) -> Result<Prepared> {
        if !self.plans.get(token).is_some_and(|p| p.profile == profile) {
            return Err("wow_addons_review");
        }
        self.plans.remove(token).ok_or("wow_addons_review")
    }
    fn expired(&mut self) -> Vec<Prepared> {
        let keys: Vec<_> = self
            .plans
            .iter()
            .filter(|(_, p)| p.created.elapsed() >= TTL)
            .map(|(key, _)| key.clone())
            .collect();
        keys.into_iter()
            .filter_map(|key| self.plans.remove(&key))
            .collect()
    }
}
fn book() -> &'static Mutex<Book> {
    static BOOK: OnceLock<Mutex<Book>> = OnceLock::new();
    BOOK.get_or_init(Default::default)
}
#[derive(Default)]
struct Jobs {
    active: HashMap<(String, String), CancellationToken>,
}
struct Work {
    jobs: Arc<Mutex<Jobs>>,
    key: (String, String),
    cancel: CancellationToken,
    deadline: Option<tokio::task::JoinHandle<()>>,
}
impl Work {
    fn start(jobs: Arc<Mutex<Jobs>>, profile: &str, operation: &str) -> Result<Self> {
        p2p_files::profile(profile).map_err(|_| "wow_addons_profile")?;
        let parsed = uuid::Uuid::parse_str(operation).map_err(|_| "wow_addons_request")?;
        if parsed.to_string() != operation {
            return Err("wow_addons_request");
        }
        let key = (profile.into(), operation.into());
        let cancel = CancellationToken::new();
        {
            let mut held = jobs.lock().map_err(|_| "wow_addons_busy")?;
            if held.active.len() >= 2 || held.active.contains_key(&key) {
                return Err("wow_addons_busy");
            }
            held.active.insert(key.clone(), cancel.clone());
        }
        Ok(Self {
            jobs,
            key,
            cancel,
            deadline: None,
        })
    }
    fn deadline(&mut self) {
        let cancel = self.cancel.clone();
        self.deadline = Some(tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(90)).await;
            cancel.cancel();
        }));
    }
}
impl Drop for Work {
    fn drop(&mut self) {
        if let Some(deadline) = self.deadline.take() {
            deadline.abort();
        }
        self.cancel.cancel();
        if let Ok(mut held) = self.jobs.lock() {
            held.active.remove(&self.key);
        }
    }
}
fn jobs() -> Arc<Mutex<Jobs>> {
    static JOBS: OnceLock<Arc<Mutex<Jobs>>> = OnceLock::new();
    JOBS.get_or_init(Default::default).clone()
}
pub fn cancel(profile: &str, operation: &str) {
    if let Ok(held) = jobs().lock() {
        if let Some(cancel) = held.active.get(&(profile.into(), operation.into())) {
            cancel.cancel();
        }
    }
}
fn housekeeping() {
    static STARTED: OnceLock<()> = OnceLock::new();
    STARTED.get_or_init(|| {
        tokio::spawn(async {
            loop {
                tokio::time::sleep(Duration::from_secs(30)).await;
                let expired = book()
                    .lock()
                    .map(|mut book| book.expired())
                    .unwrap_or_default();
                if !expired.is_empty() {
                    let _ = tokio::task::spawn_blocking(move || drop(expired)).await;
                }
            }
        });
    });
}
fn remember(prepared: Prepared) -> Result<Review> {
    let mut held = book().lock().map_err(|_| "wow_addons_busy")?;
    let expired = held.expired();
    let accepted =
        held.plans.len() < MAX_REVIEWS && !held.plans.contains_key(&prepared.review.token);
    let review = prepared.review.clone();
    if accepted {
        held.plans.insert(review.token.clone(), prepared);
    }
    drop(held);
    drop(expired);
    if accepted {
        Ok(review)
    } else {
        Err("wow_addons_busy")
    }
}

/// Called by the UI's explicit review action; downloads before holding the game
/// executable, then validates the installation again before any store mutation.
pub async fn review(
    app: Option<tauri::AppHandle>,
    profile: String,
    id: String,
    request: Request,
    operation: String,
) -> Result<Review> {
    let mut work = Work::start(jobs(), &profile, &operation)?;
    housekeeping();
    work.deadline();
    let target_id = id.clone();
    let (root, version) = tokio::task::spawn_blocking(move || wow_addons::target(&target_id))
        .await
        .map_err(|_| "wow_addons_failed")??;
    emit(&app, &profile, &operation, "checking");
    let downloaded = if let Request::Install { addon_id } | Request::Adopt { addon_id } = &request {
        emit(&app, &profile, &operation, "download");
        Some(package::latest(*addon_id, &work.cancel).await?)
    } else {
        None
    };
    tokio::task::spawn_blocking(move || {
        package::check_cancel(&work.cancel)?;
        let guard = Guard::acquire(&id)?;
        guard.matches(&root, &version)?;
        let store = Store::connect(&root, &id)?;
        store.cleanup_stages()?;
        let restore = matches!(&request, Request::Restore { .. });
        let plan = match request {
            Request::Adopt { .. } => {
                let (release, bytes) = downloaded.ok_or("wow_addons_record")?;
                emit(&app, &profile, &operation, "inspect");
                let layout = package::layout(release, &bytes, &id, &version, &work.cancel)?;
                store.adopt(layout, &version, &work.cancel)?
            }
            Request::Install { .. } => {
                let (release, bytes) = downloaded.ok_or("wow_addons_record")?;
                emit(&app, &profile, &operation, "inspect");
                let package = package::unpack(release, &bytes, &id, &version, &work.cancel)?;
                emit(&app, &profile, &operation, "stage");
                store.stage(package, &work.cancel)?
            }
            Request::Remove { addon_id } => store.removal(addon_id)?,
            Request::Restore { backup } => store.restore(&backup, &version)?,
        };
        emit(&app, &profile, &operation, "compare");
        let prepared = Prepared::new(profile.clone(), id, root, version, store, plan, restore)?;
        prepared
            .store
            .preview(&prepared.plan, &prepared.version, &work.cancel)?;
        package::check_cancel(&work.cancel)?;
        let review = remember(prepared)?;
        emit(&app, &profile, &operation, "ready");
        Ok(review)
    })
    .await
    .map_err(|_| "wow_addons_failed")?
}
pub async fn apply(
    app: Option<tauri::AppHandle>,
    profile: String,
    token: String,
    operation: String,
) -> Result<Workspace> {
    let mut work = Work::start(jobs(), &profile, &operation)?;
    work.deadline();
    let prepared = book()
        .lock()
        .map_err(|_| "wow_addons_busy")?
        .take(&profile, &token)?;
    tokio::task::spawn_blocking(move || {
        prepared.validate(&profile)?;
        package::check_cancel(&work.cancel)?;
        emit(&app, &profile, &operation, "checking");
        let guard = Guard::acquire(&prepared.id)?;
        emit(&app, &profile, &operation, "apply");
        let state = prepared.commit(&guard, &work.cancel)?;
        emit(&app, &profile, &operation, "complete");
        Ok(Workspace::from_state(
            prepared.id.clone(),
            prepared.version.clone(),
            Some(state),
            false,
        ))
    })
    .await
    .map_err(|_| "wow_addons_failed")?
}
pub async fn recover(
    app: Option<tauri::AppHandle>,
    profile: String,
    id: String,
    operation: String,
) -> Result<Workspace> {
    let mut work = Work::start(jobs(), &profile, &operation)?;
    work.deadline();
    tokio::task::spawn_blocking(move || {
        package::check_cancel(&work.cancel)?;
        let guard = Guard::acquire(&id)?;
        emit(&app, &profile, &operation, "recover");
        if !Store::exists(&guard.root)? {
            return Ok(Workspace::from_state(
                id,
                guard.version.clone(),
                None,
                false,
            ));
        }
        let store = Store::connect(&guard.root, &id)?;
        store.cleanup_stages()?;
        let state = store.load()?;
        emit(&app, &profile, &operation, "complete");
        Ok(Workspace::from_state(
            id,
            guard.version.clone(),
            Some(state),
            false,
        ))
    })
    .await
    .map_err(|_| "wow_addons_failed")?
}
pub async fn discard(profile: String, token: String) -> Result<()> {
    let prepared = book()
        .lock()
        .map_err(|_| "wow_addons_busy")?
        .take(&profile, &token)?;
    tokio::task::spawn_blocking(move || prepared.store.discard(&prepared.plan))
        .await
        .map_err(|_| "wow_addons_failed")?
}

#[cfg(all(test, windows))]
#[path = "wow_addon_reviews_tests.rs"]
mod tests;
