//! Managed Sims4 folders use a durable rename journal. Existing user mods are
//! read-only until explicitly adopted. Settings created by the game travel with their managed folder.
use super::{
    sims_files as files,
    sims_package::{self as package, Payload, Result},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeSet,
    fs::{self, File, OpenOptions},
    path::{Path, PathBuf},
};
pub(super) const STORE: &str = "HarborSimsMods";
#[path = "sims_adopt.rs"]
pub mod adopt;
#[path = "sims_preparation.rs"]
pub mod preparation;
#[path = "sims_progress.rs"]
pub mod progress;
#[path = "sims_metadata.rs"]
pub mod metadata;
#[path = "sims_sets.rs"]
pub mod sets;
#[cfg(test)]
#[path = "sims_tests.rs"]
mod tests;
#[path = "sims_tray.rs"]
pub mod tray;
#[path = "sims_troubleshoot.rs"]
pub mod trouble;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<CreatorSource>,
    pub id: String,
    pub title: String,
    pub enabled: bool,
    pub files: Vec<files::Stamp>,
    pub installed_at: u64,
    pub game_version: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreatorSource {
    pub provider: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required_core: Option<String>,
    pub version: String,
    pub game_patch: String,
    pub archive_hash: String,
}
impl CreatorSource {
    pub fn validate(&self) -> Result<()> {
        let numeric = |value: &str, count: usize| {
            value.split('.').count() == count
                && value
                    .split('.')
                    .all(|v| !v.is_empty() && v.len() <= 6 && v.bytes().all(|b| b.is_ascii_digit()))
        };
        let valid = match self.provider.as_str() {
            "mccc" => {
                self.project.is_none()
                    && self.required_core.is_none()
                    && numeric(&self.version, 3)
                    && numeric(&self.game_patch, 4)
            }
            "lot51" => {
                self.project.as_deref().is_some_and(creator_slug)
                    && creator_version(&self.version).is_some()
                    && self.game_patch.is_empty()
                    && self
                        .required_core
                        .as_deref()
                        .is_none_or(|v| creator_version(v).is_some())
                    && !(self.project.as_deref() == Some("core-library")
                        && self.required_core.is_some())
            }
            "mts" => {
                self.project.as_deref().is_some_and(super::sims_mts::number)
                    && super::sims_mts::version(&self.version)
                    && self.required_core.is_none()
                    && self.game_patch.is_empty()
            }
            _ => false,
        };
        if !valid
            || self.archive_hash.len() != 64
            || !self.archive_hash.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err("sims_record");
        }
        Ok(())
    }
}
pub(super) fn creator_slug(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}
pub(super) fn creator_version(value: &str) -> Option<[u32; 4]> {
    let mut version = [0; 4];
    let parts = value.split('.').collect::<Vec<_>>();
    if parts.is_empty() || parts.len() > 4 {
        return None;
    }
    for (i, p) in parts.into_iter().enumerate() {
        if p.is_empty() || p.len() > 6 || !p.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        version[i] = p.parse().ok()?;
    }
    Some(version)
}
/// Only a verified, enabled creator install can satisfy a declared dependency.
pub(super) fn core_group(state: &State, minimum: &str) -> Result<Option<Group>> {
    let groups = state
        .groups
        .iter()
        .filter(|g| {
            g.enabled
                && g.source.as_ref().is_some_and(|s| {
                    s.provider == "lot51" && s.project.as_deref() == Some("core-library")
                })
        })
        .collect::<Vec<_>>();
    let minimum = creator_version(minimum).ok_or("sims_record")?;
    Ok(match groups.as_slice() {
        [g] if g
            .source
            .as_ref()
            .and_then(|s| creator_version(&s.version))
            .is_some_and(|v| v >= minimum) =>
        {
            Some((*g).clone())
        }
        _ => None,
    })
}
pub(super) fn verified_core(
    state: &State,
    minimum: &str,
    check: &dyn Fn() -> Result<()>,
) -> Result<Group> {
    let group = core_group(state, minimum)?.ok_or("sims_creator_dependency")?;
    let root = Path::new(&state.root);
    let path = area_path(root, &root.join(STORE), &location(&group))?;
    verify_owned(&group, &files::tree_checked(&path, check)?)?;
    Ok(group)
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    pub id: String,
    pub group: Group,
    pub created_at: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct State {
    pub schema: u8,
    pub root: String,
    pub revision: String,
    pub groups: Vec<Group>,
    pub backups: Vec<Backup>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub troubleshoot: Option<trouble::Session>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
enum Area {
    Live(String),
    Disabled(String),
    Stage(String),
    Vault(String),
}
#[derive(Clone, Debug, Serialize, Deserialize)]
struct Movement {
    from: Area,
    to: Area,
    files: Vec<files::Stamp>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
struct Journal {
    before: State,
    after: State,
    moves: Vec<Movement>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    adoption: Option<adopt::Record>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum Action {
    TrayImport {
        title: String,
    },
    TrayRemove {
        id: String,
    },
    TrayRestore {
        id: String,
    },
    StartTest {
        groups: Vec<String>,
        #[serde(default, rename = "backupFolder")]
        backup_folder: Option<String>,
    },
    AnswerTest {
        id: String,
        round: usize,
        present: bool,
    },
    RestoreTest {
        id: String,
    },
    Adopt {
        title: String,
    },
    Install {
        title: String,
    },
    Update {
        id: String,
    },
    Enable {
        id: String,
    },
    Disable {
        id: String,
    },
    Remove {
        id: String,
    },
    Restore {
        backup: String,
    },
    ApplySet {
        id: String,
        #[serde(default, rename = "backupFolder")]
        backup_folder: Option<String>,
    },
}
pub struct Plan {
    pub source: Option<CreatorSource>,
    pub tray: Option<tray::Selection>,
    pub before: State,
    pub action: Action,
    pub version: String,
    pub payload: Vec<Payload>,
    pub skipped: Vec<String>,
    pub existing: Vec<files::Stamp>,
    pub restore_files: Vec<files::Stamp>,
    pub target_id: String,
    pub set: Option<sets::SetPlan>,
    pub adoption: Option<adopt::Selection>,
    pub trial: Option<trouble::TrialPlan>,
}
pub struct Store {
    root: PathBuf,
    base: PathBuf,
    _lock: File,
}
fn uuid(v: &str) -> Result<()> {
    if uuid::Uuid::parse_str(v).is_err() {
        return Err("sims_record");
    }
    Ok(())
}
fn validate_group(group: &Group) -> Result<()> {
    if let Some(source) = &group.source {
        source.validate()?;
    }
    uuid(&group.id)?;
    if group.title.trim().is_empty()
        || group.title.len() > 200
        || group.title.chars().any(char::is_control)
        || group.files.len() > 2000
        || !group
            .files
            .iter()
            .any(|f| matches!(package::kind(&f.name), "package" | "script"))
    {
        return Err("sims_record");
    }
    let mut names = BTreeSet::new();
    for f in &group.files {
        package::filename(&f.name)?;
        if package::kind(&f.name) == "other"
            || f.hash.len() != 64
            || !f.hash.bytes().all(|c| c.is_ascii_hexdigit())
            || f.bytes > package::MAX_FILE as u64
            || !names.insert(f.name.to_ascii_lowercase())
        {
            return Err("sims_record");
        }
    }
    Ok(())
}
fn validate_state(state: &State, root: &Path) -> Result<()> {
    trouble::validate_state(state)?;
    if state.schema != 1
        || Path::new(&state.root) != root
        || state.groups.len() > 500
        || state.backups.len() > 1000
    {
        return Err("sims_record");
    }
    if state.revision != "initial" {
        uuid(&state.revision)?;
    }
    let mut ids = BTreeSet::new();
    for g in &state.groups {
        validate_group(g)?;
        if !ids.insert(&g.id) {
            return Err("sims_record");
        }
    }
    let mut backups = BTreeSet::new();
    for b in &state.backups {
        uuid(&b.id)?;
        validate_group(&b.group)?;
        if !backups.insert(&b.id) {
            return Err("sims_record");
        }
    }
    Ok(())
}
fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    serde_json::from_slice(&files::read(path, 8 * 1024 * 1024)?).map_err(|_| "sims_record")
}
fn initial(root: &Path) -> State {
    State {
        schema: 1,
        root: root.to_string_lossy().into_owned(),
        revision: "initial".into(),
        groups: vec![],
        backups: vec![],
        troubleshoot: None,
    }
}
pub fn snapshot(value: &str) -> Result<(State, bool)> {
    let data = files::inspect_folder(value)?;
    let root = Path::new(&data.path);
    let base = root.join(STORE);
    if !base.try_exists().map_err(|_| "sims_read")? {
        return Ok((initial(root), false));
    }
    files::directory(&base)?;
    let state = if base
        .join("state.json")
        .try_exists()
        .map_err(|_| "sims_read")?
    {
        read_json(&base.join("state.json"))?
    } else {
        initial(root)
    };
    validate_state(&state, root)?;
    Ok((
        state,
        base.join("journal.json")
            .try_exists()
            .map_err(|_| "sims_read")?
            || base
                .join("tray-journal.json")
                .try_exists()
                .map_err(|_| "sims_read")?
            || preparation::pending(&base)?,
    ))
}
fn area_path(root: &Path, base: &Path, area: &Area) -> Result<PathBuf> {
    let (parent, name) = match area {
        Area::Live(id) => {
            uuid(id)?;
            (
                files::directory(&root.join("Mods"))?,
                format!("Harbor-{id}"),
            )
        }
        Area::Disabled(id) => (files::directory(&base.join("disabled"))?, id.clone()),
        Area::Stage(id) => (files::directory(&base.join("stage"))?, id.clone()),
        Area::Vault(id) => (files::directory(&base.join("vault"))?, id.clone()),
    };
    if !matches!(area, Area::Live(_)) {
        uuid(&name)?;
    }
    Ok(parent.join(name))
}
fn location(g: &Group) -> Area {
    if g.enabled {
        Area::Live(g.id.clone())
    } else {
        Area::Disabled(g.id.clone())
    }
}
fn unchanged(path: &Path, expected: &[files::Stamp]) -> Result<()> {
    unchanged_checked(path, expected, &|| Ok(()))
}
fn unchanged_checked(
    path: &Path,
    expected: &[files::Stamp],
    check: &dyn Fn() -> Result<()>,
) -> Result<()> {
    if files::tree_checked(path, check)? != expected {
        return Err("sims_changed");
    }
    Ok(())
}
fn verify_owned(group: &Group, tree: &[files::Stamp]) -> Result<()> {
    for f in group
        .files
        .iter()
        .filter(|f| matches!(package::kind(&f.name), "package" | "script"))
    {
        if !tree.contains(f) {
            return Err("sims_changed");
        }
    }
    // A manually added package has not been reviewed as part of this group.
    if tree
        .iter()
        .filter(|f| matches!(package::kind(&f.name), "package" | "script"))
        .any(|f| !group.files.contains(f))
    {
        return Err("sims_changed");
    }
    Ok(())
}
fn validate_tree(tree: &[files::Stamp]) -> Result<()> {
    let mut names = BTreeSet::new();
    let mut total = 0u64;
    if tree.is_empty() || tree.len() > 2000 {
        return Err("sims_record");
    }
    for f in tree {
        files::relative_name(&f.name)?;
        total = total.checked_add(f.bytes).ok_or("sims_record")?;
        if f.bytes > package::MAX_FILE as u64
            || total > package::MAX_IMPORT as u64
            || f.hash.len() != 64
            || !f.hash.bytes().all(|c| c.is_ascii_hexdigit())
            || !names.insert(f.name.to_ascii_lowercase())
        {
            return Err("sims_record");
        }
    }
    for name in &names {
        for (index, _) in name.match_indices('/') {
            if names.contains(&name[..index]) {
                return Err("sims_record");
            }
        }
    }
    Ok(())
}
fn validate_journal(j: &Journal, root: &Path) -> Result<()> {
    validate_state(&j.before, root)?;
    validate_state(&j.after, root)?;
    if j.before.revision == j.after.revision || j.after.revision == "initial" {
        return Err("sims_record");
    }
    if j.adoption.is_some() {
        return adopt::validate(j, root);
    }
    trouble::validate_transition(&j.before, &j.after)?;
    let testing = j.before.troubleshoot != j.after.troubleshoot;
    let toggles = j.moves.iter().all(|m| matches!((&m.from, &m.to), (Area::Live(a), Area::Disabled(b)) | (Area::Disabled(a), Area::Live(b)) if a == b));
    if j.before.revision == j.after.revision
        || j.after.revision == "initial"
        || (j.moves.is_empty() && !testing)
        || j.moves.len() > if toggles { 500 } else { 2 }
    {
        return Err("sims_record");
    }
    if !toggles
        && j.moves.len() == 2
        && (!matches!(j.moves[0].to, Area::Vault(_)) || !matches!(j.moves[1].from, Area::Stage(_)))
    {
        return Err("sims_record");
    }
    let mut changed = BTreeSet::new();
    let mut enabling = false;
    for m in &j.moves {
        validate_tree(&m.files)?;
        if toggles {
            let (Area::Live(id) | Area::Disabled(id)) = &m.from else {
                return Err("sims_record");
            };
            if !changed.insert(id) || (enabling && matches!(m.to, Area::Disabled(_))) {
                return Err("sims_record");
            }
            enabling |= matches!(m.to, Area::Live(_));
        }
    }
    let mut expected = j.before.clone();
    expected.revision = j.after.revision.clone();
    expected.troubleshoot = j.after.troubleshoot.clone();
    for m in &j.moves {
        match (&m.from, &m.to) {
            (Area::Live(id), Area::Disabled(to)) | (Area::Disabled(id), Area::Live(to))
                if id == to && toggles =>
            {
                let g = expected
                    .groups
                    .iter_mut()
                    .find(|g| g.id == *id)
                    .ok_or("sims_record")?;
                if location(g) != m.from {
                    return Err("sims_record");
                }
                verify_owned(g, &m.files)?;
                g.enabled = !g.enabled;
            }
            (Area::Live(id), Area::Vault(backup)) | (Area::Disabled(id), Area::Vault(backup)) => {
                let index = expected
                    .groups
                    .iter()
                    .position(|g| g.id == *id)
                    .ok_or("sims_record")?;
                let g = expected.groups.remove(index);
                if location(&g) != m.from || expected.backups.iter().any(|b| b.id == *backup) {
                    return Err("sims_record");
                }
                verify_owned(&g, &m.files)?;
                let b = j
                    .after
                    .backups
                    .iter()
                    .find(|b| b.id == *backup && b.group == g)
                    .ok_or("sims_record")?;
                expected.backups.push(b.clone());
            }
            (Area::Stage(stage), Area::Live(id)) | (Area::Stage(stage), Area::Disabled(id)) => {
                uuid(stage)?;
                if expected.groups.iter().any(|g| g.id == *id) {
                    return Err("sims_record");
                }
                if j.moves.len() == 2
                    && !matches!(&j.moves[0].from,Area::Live(old)|Area::Disabled(old) if old==id)
                {
                    return Err("sims_record");
                }
                let g = j
                    .after
                    .groups
                    .iter()
                    .find(|g| g.id == *id)
                    .ok_or("sims_record")?;
                if location(g) != m.to {
                    return Err("sims_record");
                }
                verify_owned(g, &m.files)?;
                expected.groups.push(g.clone());
            }
            _ => return Err("sims_record"),
        }
    }
    if expected != j.after {
        return Err("sims_record");
    }
    Ok(())
}
impl Plan {
    fn check_duplicate_names(&self) -> Result<()> {
        if self.trial.is_some() {
            return trouble::check(self);
        }
        if self.set.is_some() {
            return sets::check(self);
        }
        if !matches!(
            self.action,
            Action::Install { .. }
                | Action::Update { .. }
                | Action::Restore { .. }
                | Action::Enable { .. }
        ) {
            return Ok(());
        }
        let names: BTreeSet<_> = self
            .reviewed_files()
            .iter()
            .filter(|f| matches!(package::kind(&f.name), "package" | "script"))
            .map(|f| f.name.to_ascii_lowercase())
            .collect();
        let own = format!("harbor-{}/", self.target_id);
        for file in files::inventory(&self.before.root)?.files {
            let path = file.path.to_ascii_lowercase();
            if !path.starts_with(&own) && names.contains(path.rsplit('/').next().unwrap_or("")) {
                return Err("sims_duplicate");
            }
        }
        Ok(())
    }
    pub fn changes(&self) -> Vec<sets::Change> {
        self.trial
            .as_ref()
            .map(|t| t.changes.clone())
            .or_else(|| self.set.as_ref().map(|s| s.changes.clone()))
            .unwrap_or_default()
    }
    pub fn backup_folder(&self) -> Option<String> {
        self.trial
            .as_ref()
            .and_then(|t| t.backup_folder.clone())
            .or_else(|| self.set.as_ref().and_then(|s| s.backup_folder.clone()))
    }
    pub fn reviewed_files(&self) -> Vec<files::Stamp> {
        if self.tray.is_some() {
            return tray::reviewed_files(self);
        }
        if let Some(adoption) = &self.adoption {
            return adoption.sources.iter().map(|s| s.file.clone()).collect();
        }
        let incoming = if matches!(self.action, Action::Restore { .. }) {
            self.restore_files.clone()
        } else {
            self.payload
                .iter()
                .map(|f| files::stamp(f.name.clone(), &f.bytes))
                .collect()
        };
        if !matches!(
            self.action,
            Action::Install { .. } | Action::Update { .. } | Action::Restore { .. }
        ) {
            return self.existing.clone();
        }
        let mut result: Vec<_> = self
            .existing
            .iter()
            .filter(|f| !matches!(package::kind(&f.name), "package" | "script"))
            .cloned()
            .collect();
        for f in incoming {
            if !result.iter().any(|v| v.name.eq_ignore_ascii_case(&f.name)) {
                result.push(f);
            }
        }
        result.sort_by(|a, b| a.name.cmp(&b.name));
        result
    }
}
#[cfg(test)]
pub fn plan(
    value: &str,
    action: Action,
    payload: Vec<Payload>,
    skipped: Vec<String>,
) -> Result<Plan> {
    plan_checked(value, action, payload, skipped, &|| Ok(()))
}
pub fn plan_checked(
    value: &str,
    action: Action,
    payload: Vec<Payload>,
    skipped: Vec<String>,
    check: &dyn Fn() -> Result<()>,
) -> Result<Plan> {
    check()?;
    let data = files::validate(value)?;
    let (state, pending) = snapshot(value)?;
    if pending {
        return Err("sims_recovery");
    }
    trouble::unlocked(&state)?;
    let (target_id, existing) = match &action {
        Action::TrayImport { .. }
        | Action::TrayRemove { .. }
        | Action::TrayRestore { .. }
        | Action::ApplySet { .. }
        | Action::Adopt { .. }
        | Action::StartTest { .. }
        | Action::AnswerTest { .. }
        | Action::RestoreTest { .. } => return Err("sims_request"),
        Action::Install { title } => {
            if title.trim().is_empty() || title.len() > 200 || title.chars().any(char::is_control) {
                return Err("sims_title");
            }
            (uuid::Uuid::new_v4().to_string(), vec![])
        }
        Action::Restore { backup } => {
            let b = state
                .backups
                .iter()
                .find(|v| v.id == *backup)
                .ok_or("sims_missing")?;
            let old = state.groups.iter().find(|g| g.id == b.group.id);
            let tree = if let Some(g) = old {
                files::tree_checked(
                    &area_path(
                        Path::new(&state.root),
                        &Path::new(&state.root).join(STORE),
                        &location(g),
                    )?,
                    check,
                )?
            } else {
                vec![]
            };
            if let Some(g) = old {
                verify_owned(g, &tree)?;
            }
            (b.group.id.clone(), tree)
        }
        Action::Update { id }
        | Action::Enable { id }
        | Action::Disable { id }
        | Action::Remove { id } => {
            let g = state
                .groups
                .iter()
                .find(|g| g.id == *id)
                .ok_or("sims_missing")?;
            if matches!(&action, Action::Enable { .. }) && g.enabled
                || matches!(&action, Action::Disable { .. }) && !g.enabled
            {
                return Err("sims_changed");
            }
            let tree = files::tree_checked(
                &area_path(
                    Path::new(&state.root),
                    &Path::new(&state.root).join(STORE),
                    &location(g),
                )?,
                check,
            )?;
            verify_owned(g, &tree)?;
            (id.clone(), tree)
        }
    };
    if matches!(&action, Action::Install { .. } | Action::Update { .. }) {
        let mut total = 0;
        let mut names = BTreeSet::new();
        for f in &payload {
            total += f.bytes.len();
            package::validate_payload_checked(&f.name, &f.bytes, check)?;
            if !names.insert(f.name.to_ascii_lowercase()) {
                return Err("sims_archive_layout");
            }
        }
        if total > package::MAX_IMPORT
            || payload.len() > 2000
            || !payload
                .iter()
                .any(|f| matches!(package::kind(&f.name), "package" | "script"))
        {
            return Err("sims_limit");
        }
    } else if !payload.is_empty() {
        return Err("sims_request");
    }
    let restore_files = if let Action::Restore { backup } = &action {
        let b = state
            .backups
            .iter()
            .find(|b| b.id == *backup)
            .ok_or("sims_missing")?;
        let tree = files::tree_checked(
            &area_path(
                Path::new(&state.root),
                &Path::new(&state.root).join(STORE),
                &Area::Vault(backup.clone()),
            )?,
            check,
        )?;
        verify_owned(&b.group, &tree)?;
        tree
    } else {
        vec![]
    };
    let plan = Plan {
        source: None,
        tray: None,
        trial: None,
        before: state,
        action,
        version: data.game_version,
        payload,
        skipped,
        existing,
        restore_files,
        target_id,
        set: None,
        adoption: None,
    };
    validate_tree(&plan.reviewed_files())?;
    plan.check_duplicate_names()?;
    Ok(plan)
}
impl Store {
    pub fn connect(value: &str) -> Result<Self> {
        files::idle()?;
        let data = files::validate(value)?;
        let root = PathBuf::from(data.path);
        let base = files::ensure_child(&root, STORE)?;
        let lock_path = base.join("lock");
        if lock_path.try_exists().map_err(|_| "sims_read")? {
            if files::regular(&lock_path)?.len() != 0 {
                return Err("sims_record");
            }
        }
        let mut options = OpenOptions::new();
        options.read(true).write(true).create(true).truncate(false);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(0).custom_flags(0x00200000);
        }
        let lock = options.open(lock_path).map_err(|_| "sims_busy")?;
        if files::linked(&lock.metadata().map_err(|_| "sims_read")?) {
            return Err("sims_link");
        }
        for name in ["stage", "disabled", "vault"] {
            files::ensure_child(&base, name)?;
        }
        Ok(Self {
            root,
            base,
            _lock: lock,
        })
    }
    fn path(&self, area: &Area) -> Result<PathBuf> {
        area_path(&self.root, &self.base, area)
    }
    fn write_state(&self, s: &State) -> Result<()> {
        validate_state(s, &self.root)?;
        self.write_record("state.json", s)
    }
    fn write_journal(&self, j: &Journal) -> Result<()> {
        self.write_record("journal.json", j)
    }
    fn write_record(&self, name: &str, value: &impl Serialize) -> Result<()> {
        let bytes = serde_json::to_vec(value).map_err(|_| "sims_record")?;
        if bytes.len() > 8 * 1024 * 1024 {
            return Err("sims_limit");
        }
        files::atomic(&self.base, name, &bytes)
    }
    fn move_folder(&self, m: &Movement) -> Result<()> {
        let from = self.path(&m.from)?;
        let to = self.path(&m.to)?;
        unchanged(&from, &m.files)?;
        if to.try_exists().map_err(|_| "sims_read")? {
            return Err("sims_exists");
        }
        fs::rename(from, to).map_err(|_| "sims_write")
    }
    fn rollback(&self, j: &Journal) -> Result<()> {
        // Infer completed moves from both endpoints after a crash; never trust a cursor.
        for (_index, m) in j.moves.iter().rev().enumerate() {
            let from = self.path(&m.from)?;
            let to = self.path(&m.to)?;
            let a = from.try_exists().map_err(|_| "sims_read")?;
            let b = to.try_exists().map_err(|_| "sims_read")?;
            match (a, b) {
                (true, false) => unchanged(&from, &m.files)?,
                (false, true) => {
                    unchanged(&to, &m.files)?;
                    fs::rename(to, from).map_err(|_| "sims_write")?;
                    #[cfg(test)]
                    super::saves::interruption_checkpoint(&format!("modsRollback{}", _index + 1));
                }
                (true, true) => {
                    // A swap may not have started: the second move's destination is
                    // still occupied by the first move's original folder.
                    unchanged(&from, &m.files)?;
                    let prior = j
                        .moves
                        .iter()
                        .find(|other| self.path(&other.from).ok().as_ref() == Some(&to))
                        .ok_or("sims_recovery")?;
                    unchanged(&to, &prior.files)?;
                }
                _ => return Err("sims_recovery"),
            }
        }
        self.write_state(&j.before)?;
        fs::remove_file(self.base.join("journal.json")).map_err(|_| "sims_write")?;
        Ok(())
    }
    pub fn recover(&self) -> Result<State> {
        files::idle()?;
        let result = self.recover_inner();
        self.finish_unpublished_preparation()?;
        result
    }
    fn recover_inner(&self) -> Result<State> {
        if !adopt::exists(&self.base.join("journal.json"))?
            && !adopt::exists(&self.base.join("tray-journal.json"))?
            && preparation::pending(&self.base)?
        {
            return snapshot(self.root.to_str().ok_or("sims_path")?).map(|(state, _)| state);
        }
        if self
            .base
            .join("tray-journal.json")
            .try_exists()
            .map_err(|_| "sims_read")?
        {
            return self.recover_tray();
        }
        let j: Journal = read_json(&self.base.join("journal.json"))?;
        validate_journal(&j, &self.root)?;
        let (current, _) = snapshot(self.root.to_str().ok_or("sims_path")?)?;
        if current != j.before && current != j.after {
            return Err("sims_changed");
        }
        if j.adoption.is_some() {
            return self.recover_adoption(&j);
        }
        self.rollback(&j)?;
        for m in &j.moves {
            if matches!(m.from, Area::Stage(_)) {
                self.clean_stage(&self.path(&m.from)?);
            }
        }
        Ok(j.before)
    }
    pub fn check_set(&self, plan: &Plan) -> Result<()> {
        files::idle()?;
        let (current, pending) = snapshot(self.root.to_str().ok_or("sims_path")?)?;
        if pending {
            return Err("sims_recovery");
        }
        if current != plan.before || files::validate(&current.root)?.game_version != plan.version {
            return Err("sims_changed");
        }
        if plan.trial.is_some() {
            trouble::check(plan)
        } else {
            sets::check(plan)
        }
    }
    #[cfg(test)]
    pub fn apply(&self, plan: Plan) -> Result<State> {
        self.apply_controlled(plan, &mut progress::Work::silent())
    }
    pub fn apply_controlled(&self, plan: Plan, work: &mut progress::Work<'_>) -> Result<State> {
        if preparation::pending(&self.base)? {
            return Err("sims_recovery");
        }
        let result = self.apply_inner(plan, work);
        #[cfg(test)]
        if result.is_ok() {
            super::saves::interruption_checkpoint("simsPreparationCommitted");
        }
        self.finish_unpublished_preparation()?;
        result
    }
    fn apply_inner(&self, plan: Plan, work: &mut progress::Work<'_>) -> Result<State> {
        work.check()?;
        if plan.tray.is_some() {
            return self.apply_tray(plan, work);
        }
        if plan.adoption.is_some() {
            return self.apply_adoption(plan, work);
        }
        files::idle()?;
        let (current, pending) = snapshot(self.root.to_str().ok_or("sims_path")?)?;
        if pending {
            return Err("sims_recovery");
        }
        if current != plan.before || files::validate(&current.root)?.game_version != plan.version {
            return Err("sims_changed");
        }
        plan.check_duplicate_names()?;
        if plan.trial.is_none() {
            trouble::unlocked(&current)?;
        }
        let mut after = current.clone();
        after.revision = uuid::Uuid::new_v4().to_string();
        if let Some(trial) = &plan.trial {
            after.troubleshoot = trial.next.clone();
        }
        let old = current
            .groups
            .iter()
            .find(|g| g.id == plan.target_id)
            .cloned();
        if let Some(g) = &old {
            unchanged(&self.path(&location(g))?, &plan.existing)?;
        }
        let mut moves = Vec::new();
        let mut stage = None;
        if matches!(
            plan.action,
            Action::Install { .. } | Action::Update { .. } | Action::Restore { .. }
        ) {
            files::space(
                &self.base,
                plan.reviewed_files().iter().map(|f| f.bytes).sum(),
            )?;
        }
        match &plan.action {
            Action::TrayImport { .. }
            | Action::TrayRemove { .. }
            | Action::TrayRestore { .. }
            | Action::Adopt { .. } => return Err("sims_request"),
            Action::ApplySet { .. }
            | Action::StartTest { .. }
            | Action::AnswerTest { .. }
            | Action::RestoreTest { .. } => {
                for change in plan.changes() {
                    let group = after
                        .groups
                        .iter_mut()
                        .find(|g| g.id == change.id)
                        .ok_or("sims_missing")?;
                    let from = location(group);
                    if group.enabled == change.enabled {
                        return Err("sims_changed");
                    }
                    group.enabled = change.enabled;
                    moves.push(Movement {
                        from,
                        to: location(group),
                        files: change.files.clone(),
                    });
                }
            }
            Action::Enable { .. } | Action::Disable { .. } => {
                let group = after
                    .groups
                    .iter_mut()
                    .find(|g| g.id == plan.target_id)
                    .ok_or("sims_missing")?;
                let from = location(group);
                group.enabled = !group.enabled;
                moves.push(Movement {
                    from,
                    to: location(group),
                    files: plan.existing.clone(),
                });
            }
            Action::Remove { .. } => {
                let group = old.ok_or("sims_missing")?;
                let id = uuid::Uuid::new_v4().to_string();
                moves.push(Movement {
                    from: location(&group),
                    to: Area::Vault(id.clone()),
                    files: plan.existing,
                });
                after.groups.retain(|g| g.id != group.id);
                after.backups.push(Backup {
                    id,
                    group,
                    created_at: files::now(),
                });
            }
            Action::Install { .. } | Action::Update { .. } | Action::Restore { .. } => {
                let restore = if let Action::Restore { backup } = &plan.action {
                    Some(
                        current
                            .backups
                            .iter()
                            .find(|b| b.id == *backup)
                            .ok_or("sims_missing")?
                            .clone(),
                    )
                } else {
                    None
                };
                let mut group = if let Some(b) = &restore {
                    b.group.clone()
                } else if let Some(g) = &old {
                    g.clone()
                } else {
                    Group {
                        source: None,
                        id: plan.target_id.clone(),
                        title: if let Action::Install { title } = &plan.action {
                            title.trim().into()
                        } else {
                            return Err("sims_request");
                        },
                        enabled: true,
                        files: vec![],
                        installed_at: files::now(),
                        game_version: plan.version.clone(),
                    }
                };
                if restore.is_none() {
                    group.source = plan.source.clone();
                }
                if let Some(g) = &old {
                    group.enabled = g.enabled;
                }
                let id = uuid::Uuid::new_v4().to_string();
                let area = Area::Stage(id.clone());
                let path = self.path(&area)?;
                self.begin_preparation(
                    preparation::Kind::Mods,
                    &id,
                    &group.title,
                    plan.reviewed_files()
                        .into_iter()
                        .map(|file| preparation::Entry { folder: None, file })
                        .collect(),
                )?;
                fs::create_dir(&path).map_err(|_| "sims_write")?;
                stage = Some(path.clone());
                let staged =
                    (|| {
                        // Preserve all current non-mod files (including creator settings/logs).
                        let kept: BTreeSet<_> = if old.is_some() {
                            plan.existing
                                .iter()
                                .filter(|f| !matches!(package::kind(&f.name), "package" | "script"))
                                .map(|f| f.name.to_ascii_lowercase())
                                .collect()
                        } else {
                            BTreeSet::new()
                        };
                        let incoming = if restore.is_some() {
                            plan.restore_files
                                .iter()
                                .filter(|f| !kept.contains(&f.name.to_ascii_lowercase()))
                                .map(|f| f.bytes)
                                .sum::<u64>()
                        } else {
                            plan.payload
                                .iter()
                                .filter(|f| !kept.contains(&f.name.to_ascii_lowercase()))
                                .map(|f| f.bytes.len() as u64)
                                .sum()
                        };
                        let retained: u64 = plan
                            .existing
                            .iter()
                            .filter(|f| kept.contains(&f.name.to_ascii_lowercase()))
                            .map(|f| f.bytes)
                            .sum();
                        work.staging(incoming + retained)?;
                        let mut preserve = BTreeSet::new();
                        if let Some(g) = &old {
                            for item in plan
                                .existing
                                .iter()
                                .filter(|f| !matches!(package::kind(&f.name), "package" | "script"))
                            {
                                work.check()?;
                                let data = files::read(
                                    &self.path(&location(g))?.join(&item.name),
                                    package::MAX_FILE,
                                )?;
                                if files::stamp(item.name.clone(), &data) != *item {
                                    return Err("sims_changed");
                                }
                                work.write(&files::staged_file(&path, &item.name)?, &data)?;
                                preserve.insert(item.name.to_ascii_lowercase());
                            }
                        }
                        let payload = if let Some(b) = &restore {
                            let previous = self.path(&Area::Vault(b.id.clone()))?;
                            unchanged(&previous, &plan.restore_files)?;
                            plan.restore_files
                                .iter()
                                .map(|f| {
                                    work.check()?;
                                    let bytes =
                                        files::read(&previous.join(&f.name), package::MAX_FILE)?;
                                    if files::stamp(f.name.clone(), &bytes) != *f {
                                        return Err("sims_changed");
                                    }
                                    Ok(Payload {
                                        name: f.name.clone(),
                                        bytes,
                                    })
                                })
                                .collect::<Result<Vec<_>>>()?
                        } else {
                            plan.payload
                        };
                        let mut tracked = Vec::new();
                        for f in payload {
                            if preserve.contains(&f.name.to_ascii_lowercase()) {
                                continue;
                            }
                            work.write(&files::staged_file(&path, &f.name)?, &f.bytes)?;
                            if !f.name.contains('/') && package::kind(&f.name) != "other" {
                                tracked.push(files::stamp(f.name, &f.bytes));
                            }
                        }
                        // Retain settings in the record when an updated archive also supplies them.
                        for item in plan.existing.iter().filter(|f| {
                            !f.name.contains('/') && package::kind(&f.name) == "settings"
                        }) {
                            if !tracked
                                .iter()
                                .any(|t| t.name.eq_ignore_ascii_case(&item.name))
                            {
                                tracked.push(item.clone());
                            }
                        }
                        group.files = tracked;
                        group.game_version = plan.version;
                        group.installed_at = files::now();
                        let contents = files::tree(&path)?;
                        if let Some(g) = old {
                            let backup = uuid::Uuid::new_v4().to_string();
                            moves.push(Movement {
                                from: location(&g),
                                to: Area::Vault(backup.clone()),
                                files: plan.existing,
                            });
                            after.backups.push(Backup {
                                id: backup,
                                group: g,
                                created_at: files::now(),
                            });
                        }
                        moves.push(Movement {
                            from: area,
                            to: location(&group),
                            files: contents,
                        });
                        after.groups.retain(|g| g.id != group.id);
                        after.groups.push(group);
                        Ok(())
                    })();
                if let Err(error) = staged {
                    self.clean_stage(&path);
                    return Err(error);
                }
            }
        }
        let journal = Journal {
            adoption: None,
            before: current,
            after: after.clone(),
            moves,
        };
        // Destination checks happen before publication, then again for each rename.
        let prepared = (|| {
            validate_journal(&journal, &self.root)?;
            files::idle()?;
            for dependent in journal.after.groups.iter().filter(|g| g.enabled) {
                if let Some(minimum) = dependent
                    .source
                    .as_ref()
                    .and_then(|s| s.required_core.as_deref())
                {
                    let core =
                        core_group(&journal.after, minimum)?.ok_or("sims_creator_dependency")?;
                    // A Core update/toggle in this transaction is verified through its movement;
                    // otherwise reread the unchanged live dependency before publication.
                    if let Some(m) = journal.moves.iter().find(|m| m.to == location(&core)) {
                        verify_owned(&core, &m.files)?;
                    } else {
                        verified_core(&journal.after, minimum, &work.cancellation_check())?;
                    }
                }
            }
            for m in &journal.moves {
                unchanged(&self.path(&m.from)?, &m.files)?;
                let to = self.path(&m.to)?;
                if to.try_exists().map_err(|_| "sims_read")?
                    && !journal
                        .moves
                        .iter()
                        .any(|other| self.path(&other.from).ok().as_ref() == Some(&to))
                {
                    return Err("sims_exists");
                }
            }
            work.publish()?;
            self.write_journal(&journal)
        })();
        if let Err(error) = prepared {
            if let Some(path) = &stage {
                self.clean_stage(path);
            }
            return Err(error);
        }
        #[cfg(test)]
        super::saves::interruption_checkpoint("modsJournal");
        let applied = (|| {
            for (_index, m) in journal.moves.iter().enumerate() {
                self.move_folder(m)?;
                #[cfg(test)]
                super::saves::interruption_checkpoint(&format!("modsMove{}", _index + 1));
            }
            self.write_state(&after)?;
            #[cfg(test)]
            super::saves::interruption_checkpoint("modsState");
            fs::remove_file(self.base.join("journal.json")).map_err(|_| "sims_write")?;
            Ok(())
        })();
        if let Err(error) = applied {
            if self.rollback(&journal).is_err() {
                return Err("sims_recovery");
            }
            if let Some(path) = &stage {
                self.clean_stage(path);
            }
            return Err(error);
        }
        Ok(after)
    }
    fn clean_stage(&self, path: &Path) {
        if preparation::pending(&self.base) != Ok(false) {
            return;
        }
        let parent = self.base.join("stage");
        if path.parent() != Some(parent.as_path())
            || path
                .file_name()
                .and_then(|v| v.to_str())
                .is_none_or(|v| uuid(v).is_err())
        {
            return;
        }
        if files::directory(path).is_ok_and(|p| p.parent() == Some(parent.as_path()))
            && files::tree(path).is_ok()
        {
            let _ = fs::remove_dir_all(path);
        }
    }
}
