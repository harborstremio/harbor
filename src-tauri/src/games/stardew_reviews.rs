//! Native-owned immutable reviews. The renderer receives an expiring token,
//! never deployment paths or editable file manifests.
use super::{
    stardew, stardew_install_files as files,
    stardew_manifest::Result,
    stardew_package as package,
    stardew_progress::{Progress, Work},
    stardew_store::{self as store, Group, Plan, Store},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::Path,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum Action {
    Import { archive: String },
    Toggle { id: String },
    Remove { id: String },
    Restore { id: String },
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub title: String,
    pub version: String,
    pub folder: String,
    pub enabled: bool,
    pub file_count: usize,
    pub origin: Option<package::Origin>,
}
impl From<&Group> for Item {
    fn from(g: &Group) -> Self {
        Self {
            id: g.id.clone(),
            title: g.title.clone(),
            version: g.version.clone(),
            folder: g.folder.clone(),
            enabled: g.enabled,
            file_count: g.files.len(),
            origin: g.origin.clone(),
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    pub token: String,
    pub created_at: u64,
    pub item: Item,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub supported: bool,
    pub pending: bool,
    pub groups: Vec<Item>,
    pub backups: Vec<Backup>,
    pub kept: Vec<String>,
}
pub fn workspace(path: &str) -> Result<Workspace> {
    let (state, pending, kept) = store::snapshot(path)?;
    Ok(Workspace {
        supported: cfg!(windows),
        pending,
        groups: state
            .as_ref()
            .map_or_else(Vec::new, |s| s.groups.iter().map(Item::from).collect()),
        backups: state.as_ref().map_or_else(Vec::new, |s| {
            s.backups
                .iter()
                .rev()
                .map(|b| Backup {
                    token: b.token.clone(),
                    created_at: b.created_at,
                    item: Item::from(&b.group),
                })
                .collect()
        }),
        kept,
    })
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub token: String,
    pub action: &'static str,
    pub before: Option<Item>,
    pub after: Option<Item>,
    pub bytes: u64,
    pub files: Vec<String>,
    pub file_count: usize,
    pub requirements: Vec<stardew::Requirement>,
}
struct Held {
    profile: String,
    path: String,
    since: Instant,
    plan: Plan,
}
fn reviews() -> &'static Mutex<HashMap<String, Held>> {
    static HELD: OnceLock<Mutex<HashMap<String, Held>>> = OnceLock::new();
    HELD.get_or_init(|| Mutex::new(HashMap::new()))
}
fn prune(pool: &mut HashMap<String, Held>) {
    pool.retain(|_, h| h.since.elapsed() < Duration::from_secs(600));
}
pub fn discard(profile: &str, token: &str) -> bool {
    let Ok(mut pool) = reviews().lock() else {
        return false;
    };
    prune(&mut pool);
    if pool.get(token).is_some_and(|h| h.profile == profile) {
        pool.remove(token);
        true
    } else {
        false
    }
}
pub fn prepare(
    profile: &str,
    path: &str,
    operation: &str,
    action: Action,
    emit: &dyn Fn(Progress),
) -> Result<Review> {
    let work = Work::start(profile, operation, emit)?;
    {
        let mut pool = reviews().lock().map_err(|_| "stardew_busy")?;
        prune(&mut pool);
        if pool.len() >= 2 {
            return Err("stardew_busy");
        }
    }
    work.progress("preparing", 0, 0)?;
    let store = Store::connect(path)?;
    let plan = match action {
        Action::Import { archive } => {
            let archive = Path::new(&archive);
            if !archive.is_absolute()
                || !archive
                    .extension()
                    .is_some_and(|e| e.eq_ignore_ascii_case("zip"))
            {
                return Err("stardew_archive");
            }
            let bytes = files::read(archive, package::MAX_ARCHIVE, &|| work.check())?;
            store.prepare(package::unpack(&bytes, &|| work.check())?, &|| work.check())?
        }
        Action::Toggle { id } => store.toggle(&id, &|| work.check())?,
        Action::Remove { id } => store.removal(&id, &|| work.check())?,
        Action::Restore { id } => store.restore(&id, &|| work.check())?,
    };
    hold(profile, path, plan, &store, &work)
}
pub fn prepare_package(
    profile: &str,
    path: &str,
    package: package::Package,
    work: &Work<'_>,
) -> Result<Review> {
    work.progress("preparing", 0, 0)?;
    let store = Store::connect(path)?;
    let plan = store.prepare(package, &|| work.check())?;
    hold(profile, path, plan, &store, work)
}
fn hold(profile: &str, path: &str, plan: Plan, store: &Store, work: &Work<'_>) -> Result<Review> {
    let requirements = store.review_requirements(&plan)?;
    work.check()?;
    let token = uuid::Uuid::new_v4().to_string();
    let file_count = plan.files().len();
    let review = Review {
        token: token.clone(),
        action: plan.action(),
        before: plan.previous().map(Item::from),
        after: plan.next().map(Item::from),
        bytes: plan.bytes(),
        files: plan
            .files()
            .iter()
            .take(40)
            .map(|f| f.name.clone())
            .collect(),
        file_count,
        requirements,
    };
    let mut pool = reviews().lock().map_err(|_| "stardew_busy")?;
    prune(&mut pool);
    if pool.len() >= 2
        || pool.values().map(|h| h.plan.bytes()).sum::<u64>() + plan.bytes() > 256 * 1024 * 1024
    {
        return Err("stardew_busy");
    }
    work.check()?;
    pool.insert(
        token,
        Held {
            profile: profile.into(),
            path: path.into(),
            since: Instant::now(),
            plan,
        },
    );
    Ok(review)
}
pub fn apply(
    profile: &str,
    token: &str,
    operation: &str,
    emit: &dyn Fn(Progress),
) -> Result<Workspace> {
    let work = Work::start(profile, operation, emit)?;
    let held = {
        let mut pool = reviews().lock().map_err(|_| "stardew_busy")?;
        prune(&mut pool);
        if !pool.get(token).is_some_and(|h| h.profile == profile) {
            return Err("stardew_expired");
        }
        pool.remove(token).ok_or("stardew_expired")?
    };
    work.progress("applying", 0, 0)?;
    let store = Store::connect(&held.path)?;
    // Cancellation remains cooperative while preparing. Once a folder moves,
    // the durable transaction finishes or rolls back before returning.
    store.apply(held.plan, &|| work.check(), &|phase| {
        if phase == "staging" {
            work.progress("applying", 0, 0)?
        }
        Ok(())
    })?;
    drop(store);
    workspace(&held.path)
}
pub fn recover(
    profile: &str,
    path: &str,
    operation: &str,
    emit: &dyn Fn(Progress),
) -> Result<Workspace> {
    let work = Work::start(profile, operation, emit)?;
    work.progress("recovering", 0, 0)?;
    let store = Store::connect(path)?;
    store.recover()?;
    drop(store);
    workspace(path)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::{fs, path::PathBuf};
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = PathBuf::from(std::env::var("HARBOR_TEST_ROOT").unwrap())
                .join(format!("stardew-review-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(root.join("Mods")).unwrap();
            fs::write(root.join("Stardew Valley.exe"), b"fixture; never executed").unwrap();
            fs::copy(
                std::env::var("HARBOR_TEST_SMAPI_DLL").unwrap(),
                root.join("StardewModdingAPI.dll"),
            )
            .unwrap();
            Self(root)
        }
        fn path(&self) -> &str {
            self.0.to_str().unwrap()
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).unwrap()
        }
    }
    fn op() -> String {
        uuid::Uuid::new_v4().to_string()
    }
    fn import() -> Action {
        Action::Import {
            archive: std::env::var("HARBOR_TEST_STARDEW_ZIP").unwrap(),
        }
    }
    #[test]
    fn reviews_are_profile_bound_single_use_and_keep_held_bytes() {
        let f = Fixture::new();
        let profile = op();
        let r = prepare(&profile, f.path(), &op(), import(), &|_| {}).unwrap();
        assert_eq!(r.action, "install");
        assert_eq!(r.after.as_ref().unwrap().version, "2.3.7");
        assert!(!discard("another-profile", &r.token));
        assert_eq!(
            apply("another-profile", &r.token, &op(), &|_| {}).err(),
            Some("stardew_expired")
        );
        let result = apply(&profile, &r.token, &op(), &|_| {}).unwrap();
        assert_eq!(result.groups.len(), 1);
        fs::write(f.0.join("Mods/UIInfoSuite2/farm-data.json"), b"generated").unwrap();
        let removal = prepare(
            &profile,
            f.path(),
            &op(),
            Action::Remove {
                id: result.groups[0].id.clone(),
            },
            &|_| {},
        )
        .unwrap();
        assert_eq!(removal.file_count, result.groups[0].file_count + 1);
        assert!(removal.files.contains(&"farm-data.json".to_string()));
        assert!(discard(&profile, &removal.token));

        assert_eq!(
            apply(&profile, &r.token, &op(), &|_| {}).err(),
            Some("stardew_expired")
        );
        let r = prepare(
            &profile,
            f.path(),
            &op(),
            Action::Toggle {
                id: result.groups[0].id.clone(),
            },
            &|_| {},
        )
        .unwrap();
        assert!(discard(&profile, &r.token));
        assert_eq!(
            apply(&profile, &r.token, &op(), &|_| {}).err(),
            Some("stardew_expired")
        );
        assert!(workspace(f.path()).unwrap().groups[0].enabled);
    }
    #[test]
    fn expired_or_canceled_reviews_never_publish_and_reading_creates_no_store() {
        let f = Fixture::new();
        let profile = op();
        assert!(workspace(f.path()).unwrap().groups.is_empty());
        assert!(!f.0.join(".harbor-stardew").exists());
        let operation = op();
        assert_eq!(
            prepare(&profile, f.path(), &operation, import(), &|p| {
                if p.phase == "preparing" {
                    super::super::stardew_progress::cancel(&profile, &operation);
                }
            })
            .err()
            .unwrap(),
            "stardew_canceled"
        );
        let r = prepare(&profile, f.path(), &op(), import(), &|_| {}).unwrap();
        reviews().lock().unwrap().get_mut(&r.token).unwrap().since =
            Instant::now() - Duration::from_secs(601);
        assert_eq!(
            apply(&profile, &r.token, &op(), &|_| {}).err(),
            Some("stardew_expired")
        );
        assert_eq!(fs::read_dir(f.0.join("Mods")).unwrap().count(), 0);
    }
}
