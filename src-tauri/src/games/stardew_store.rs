//! Reviewed whole-folder deployment for SMAPI mods. Each connection holds
//! the game-idle guard during planning, deployment or explicit recovery.
use super::{
    stardew_install_files as files,
    stardew_manifest::{self, Result},
    stardew_package::{self as package, File, Package, Stamp},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

const STORE: &str = ".harbor-stardew";
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Group {
    pub id: String,
    pub title: String,
    pub version: String,
    pub folder: String,
    pub enabled: bool,
    pub files: Vec<Stamp>,
    pub archive_hash: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<package::Origin>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Backup {
    pub token: String,
    pub created_at: u64,
    pub group: Group,
    pub files: Vec<Stamp>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct State {
    pub schema: u8,
    pub root: String,
    pub revision: String,
    pub groups: Vec<Group>,
    pub backups: Vec<Backup>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum Mode {
    Install,
    Update,
    Remove,
    Toggle,
    Restore,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Journal {
    token: String,
    mode: Mode,
    before: State,
    after: State,
    previous: Option<Group>,
    next: Option<Group>,
    old_tree: Vec<Stamp>,
    new_tree: Vec<Stamp>,
    ready: bool,
    cursor: usize,
    reversing: bool,
}
pub struct Plan {
    journal: Journal,
    payload: Vec<File>,
}
impl Plan {
    pub fn previous(&self) -> Option<&Group> {
        self.journal.previous.as_ref()
    }
    pub fn next(&self) -> Option<&Group> {
        self.journal.next.as_ref()
    }
    pub fn action(&self) -> &'static str {
        match self.journal.mode {
            Mode::Install => "install",
            Mode::Update => "update",
            Mode::Remove => "remove",
            Mode::Restore => "restore",
            Mode::Toggle => {
                if self.next().is_some_and(|g| g.enabled) {
                    "enable"
                } else {
                    "disable"
                }
            }
        }
    }
    pub fn bytes(&self) -> u64 {
        self.payload.iter().map(|f| f.stamp.bytes).sum()
    }
    pub fn files(&self) -> &[Stamp] {
        if self.next().is_some() {
            &self.journal.new_tree
        } else {
            &self.journal.old_tree
        }
    }
}
pub struct Store {
    game: PathBuf,
    mods: PathBuf,
    base: PathBuf,
    _lock: fs::File,
    guard: super::stardew_guard::Guard,
}
#[derive(Clone)]
enum Area {
    Live(String),
    Stage(String),
    Vault(String),
}
struct Movement {
    from: Area,
    to: Area,
    files: Vec<Stamp>,
}
fn token(value: &str) -> bool {
    uuid::Uuid::parse_str(value).is_ok_and(|u| u.to_string() == value)
}
fn hex(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}
fn text(value: &str, max: usize) -> bool {
    !value.trim().is_empty() && value.len() <= max && !value.chars().any(char::is_control)
}
fn stamps(value: &[Stamp]) -> Result<()> {
    let mut names = BTreeSet::new();
    let mut total = 0u64;
    if value.len() > package::MAX_FILES || value.windows(2).any(|p| p[0].name >= p[1].name) {
        return Err("stardew_record");
    }
    for f in value {
        if !package::relative(&f.name)
            || !names.insert(f.name.to_ascii_lowercase())
            || !hex(&f.hash)
        {
            return Err("stardew_record");
        };
        total = total
            .checked_add(f.bytes)
            .filter(|v| *v <= package::MAX_CONTENT as u64)
            .ok_or("stardew_limit")?;
    }
    for name in &names {
        let mut p = name.as_str();
        while let Some((parent, _)) = p.rsplit_once('/') {
            if names.contains(parent) {
                return Err("stardew_record");
            };
            p = parent;
        }
    }
    Ok(())
}
fn group(value: &Group) -> Result<()> {
    if !text(&value.id, 256)
        || !text(&value.title, 300)
        || !text(&value.version, 80)
        || !package::component(&value.folder)
        || value.folder.starts_with('.')
        || value.folder.starts_with("__")
        || value.files.is_empty()
        || !hex(&value.archive_hash)
        || value
            .origin
            .as_ref()
            .is_some_and(|source| !source.valid(&value.id, &value.version, &value.archive_hash))
        || !value.files.iter().any(|f| f.name == "manifest.json")
    {
        return Err("stardew_record");
    };
    stamps(&value.files)
}
fn validate(state: &State, root: &str) -> Result<()> {
    if state.schema != 1
        || state.root != root
        || !token(&state.revision)
        || state.groups.len() > 512
        || state.backups.len() > 512
    {
        return Err("stardew_record");
    }
    let mut ids = BTreeSet::new();
    let mut folders = BTreeSet::new();
    let mut backups = BTreeSet::new();
    for g in &state.groups {
        group(g)?;
        if !ids.insert(g.id.to_ascii_lowercase()) || !folders.insert(g.folder.to_ascii_lowercase())
        {
            return Err("stardew_record");
        }
    }
    for b in &state.backups {
        if !token(&b.token) || !backups.insert(&b.token) {
            return Err("stardew_record");
        };
        group(&b.group)?;
        stamps(&b.files)?;
        if b.files.is_empty() {
            return Err("stardew_record");
        }
    }
    Ok(())
}
fn location(group: &Group) -> Area {
    Area::Live(if group.enabled {
        group.folder.clone()
    } else {
        format!(
            ".harbor-disabled-{}",
            package::hash(group.id.to_ascii_lowercase().as_bytes())
        )
    })
}
fn owned(group: &Group, tree: &[Stamp]) -> Result<()> {
    for expected in &group.files {
        if expected.name.eq_ignore_ascii_case("config.json") {
            continue;
        }
        if !tree.contains(expected) {
            return Err("stardew_changed");
        }
    }
    Ok(())
}
fn movements(j: &Journal) -> Vec<Movement> {
    if j.mode == Mode::Toggle {
        return vec![Movement {
            from: location(j.previous.as_ref().unwrap()),
            to: location(j.next.as_ref().unwrap()),
            files: j.old_tree.clone(),
        }];
    }
    let mut moves = Vec::new();
    if let Some(old) = &j.previous {
        moves.push(Movement {
            from: location(old),
            to: Area::Vault(j.token.clone()),
            files: j.old_tree.clone(),
        })
    }
    if let Some(next) = &j.next {
        moves.push(Movement {
            from: Area::Stage(j.token.clone()),
            to: location(next),
            files: j.new_tree.clone(),
        })
    }
    moves
}
fn next_state(j: &Journal) -> State {
    let mut after = j.before.clone();
    after.revision = j.after.revision.clone();
    if let Some(old) = &j.previous {
        after.groups.retain(|g| g.id != old.id);
        if j.mode != Mode::Toggle {
            after.backups.push(Backup {
                token: j.token.clone(),
                created_at: j.after.backups.last().map_or(0, |b| b.created_at),
                group: old.clone(),
                files: j.old_tree.clone(),
            })
        }
    }
    if let Some(next) = &j.next {
        after.groups.push(next.clone())
    }
    after.groups.sort_by(|a, b| a.id.cmp(&b.id));
    after
}
fn validate_journal(j: &Journal, root: &str) -> Result<()> {
    validate(&j.before, root)?;
    validate(&j.after, root)?;
    stamps(&j.old_tree)?;
    stamps(&j.new_tree)?;
    if !token(&j.token)
        || j.before.revision == j.after.revision
        || j.cursor > 2
        || (!j.ready && (j.cursor != 0 || j.reversing))
    {
        return Err("stardew_record");
    }
    if let Some(old) = &j.previous {
        group(old)?;
        if !j.before.groups.contains(old) || j.old_tree.is_empty() {
            return Err("stardew_record");
        }
    } else if !j.old_tree.is_empty() {
        return Err("stardew_record");
    }
    if let Some(next) = &j.next {
        group(next)?;
        owned(next, &j.new_tree)?;
        if j.new_tree.is_empty() {
            return Err("stardew_record");
        }
    } else if !j.new_tree.is_empty() {
        return Err("stardew_record");
    }
    match (&j.mode, &j.previous, &j.next) {
        (Mode::Install, None, Some(_)) => {}
        (Mode::Remove, Some(_), None) => {}
        (Mode::Update | Mode::Restore, Some(old), Some(next))
            if old.id.eq_ignore_ascii_case(&next.id)
                && old.folder == next.folder
                && old.enabled == next.enabled => {}
        (Mode::Restore, None, Some(_)) => {}
        (Mode::Toggle, Some(old), Some(next))
            if old.id == next.id
                && old.folder == next.folder
                && old.enabled != next.enabled
                && old.files == next.files
                && old.archive_hash == next.archive_hash
                && old.version == next.version
                && old.title == next.title
                && j.old_tree == j.new_tree => {}
        _ => return Err("stardew_record"),
    }
    if j.after != next_state(j) || j.cursor > movements(j).len() {
        return Err("stardew_record");
    };
    Ok(())
}

pub fn snapshot(game: &str) -> Result<(Option<State>, bool, Vec<String>)> {
    if !std::path::Path::new(game).is_absolute() {
        return Err("stardew_folder");
    }
    let root = files::directory(std::path::Path::new(game))?;
    if ![
        "Stardew Valley.dll",
        "Stardew Valley.exe",
        "StardewValley.exe",
    ]
    .iter()
    .any(|name| files::regular(&root.join(name)).is_ok())
    {
        return Err("stardew_folder");
    }
    let base = root.join(STORE);
    if !files::exists(&base)? {
        return Ok((None, false, vec![]));
    }
    files::directory(&base)?;
    let _lock = files::lock(&base)?;
    let state: State = files::json(&base.join("state.json"))?;
    validate(&state, &files::identity(&root))?;
    let pending = files::exists(&base.join("journal.json"))?;
    let mut kept = Vec::new();
    for (i, entry) in fs::read_dir(&base).map_err(|_| "stardew_read")?.enumerate() {
        if i > 4096 {
            return Err("stardew_limit");
        }
        let entry = entry.map_err(|_| "stardew_read")?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.strip_prefix("kept-").is_some_and(token) {
            files::directory(&entry.path())?;
            kept.push(name);
        }
    }
    kept.sort();
    Ok((Some(state), pending, kept))
}

impl Store {
    pub fn connect(game: &str) -> Result<Self> {
        let guard = super::stardew_guard::Guard::acquire(game)?;
        let game = guard.root.clone();
        let mods = files::directory(&game.join("Mods"))?;
        let base = files::mkdir(&game, STORE)?;
        let lock = files::lock(&base)?;
        let store = Self {
            game,
            mods,
            base,
            _lock: lock,
            guard,
        };
        let path = store.base.join("state.json");
        if !files::exists(&path)? {
            if files::exists(&store.base.join("journal.json"))? {
                return Err("stardew_record");
            };
            let state = State {
                schema: 1,
                root: files::identity(&store.game),
                revision: uuid::Uuid::new_v4().to_string(),
                groups: vec![],
                backups: vec![],
            };
            files::atomic(&store.base, "state.json", &state)?;
        }
        store.load()?;
        Ok(store)
    }
    pub fn load(&self) -> Result<State> {
        let state: State = files::json(&self.base.join("state.json"))?;
        validate(&state, &files::identity(&self.game))?;
        Ok(state)
    }
    pub fn pending(&self) -> Result<bool> {
        files::exists(&self.base.join("journal.json"))
    }
    fn available(&self) -> Result<State> {
        if self.pending()? {
            return Err("stardew_recovery");
        };
        self.load()
    }
    fn path(&self, area: &Area) -> Result<PathBuf> {
        match area {
            Area::Live(name) => {
                if !package::component(name) {
                    return Err("stardew_record");
                };
                files::directory(&self.mods)?;
                Ok(self.mods.join(name))
            }
            Area::Stage(id) | Area::Vault(id) => {
                if !token(id) {
                    return Err("stardew_record");
                };
                files::directory(&self.base)?;
                Ok(self.base.join(format!(
                    "{}-{id}",
                    if matches!(area, Area::Stage(_)) {
                        "stage"
                    } else {
                        "vault"
                    }
                )))
            }
        }
    }
    fn target_empty(&self, area: &Area) -> Result<()> {
        let path = self.path(area)?;
        let parent = path.parent().ok_or("stardew_record")?;
        let name = path.file_name().ok_or("stardew_record")?.to_string_lossy();
        for entry in fs::read_dir(parent).map_err(|_| "stardew_read")? {
            if entry
                .map_err(|_| "stardew_read")?
                .file_name()
                .to_string_lossy()
                .eq_ignore_ascii_case(&name)
            {
                return Err("stardew_exists");
            }
        }
        Ok(())
    }
    fn input(&self, group: &Group, check: &dyn Fn() -> Result<()>) -> Result<Vec<Stamp>> {
        let tree = files::tree(&self.path(&location(group))?, check)?;
        owned(group, &tree)?;
        Ok(tree)
    }
    fn plan(
        &self,
        before: State,
        previous: Option<Group>,
        next: Option<Group>,
        payload: Vec<File>,
        old_tree: Vec<Stamp>,
        mode: Mode,
    ) -> Result<Plan> {
        let new_tree = if mode == Mode::Toggle {
            old_tree.clone()
        } else {
            payload.iter().map(|f| f.stamp.clone()).collect()
        };
        let mut after = before.clone();
        after.revision = uuid::Uuid::new_v4().to_string();
        let id = uuid::Uuid::new_v4().to_string();
        if previous.is_some() && mode != Mode::Toggle {
            after.backups.push(Backup {
                token: id.clone(),
                created_at: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
                group: previous.clone().unwrap(),
                files: old_tree.clone(),
            })
        }
        let mut journal = Journal {
            token: id,
            mode,
            before,
            after,
            previous,
            next,
            old_tree,
            new_tree,
            ready: false,
            cursor: 0,
            reversing: false,
        };
        journal.after = next_state(&journal);
        validate_journal(&journal, &files::identity(&self.game))?;
        Ok(Plan { journal, payload })
    }
    pub fn prepare(&self, package: Package, check: &dyn Fn() -> Result<()>) -> Result<Plan> {
        let before = self.available()?;
        let old = before
            .groups
            .iter()
            .find(|g| g.id.eq_ignore_ascii_case(&package.manifest.id))
            .cloned();
        let current =
            super::stardew::scan(self.game.to_str().ok_or("stardew_folder")?, check, &|_| {
                Ok(())
            })?;
        if current.partial {
            return Err("stardew_partial");
        }
        if current.mods.iter().any(|m| {
            m.manifest.id.eq_ignore_ascii_case(&package.manifest.id)
                && old
                    .as_ref()
                    .is_none_or(|g| !g.enabled || m.folder != g.folder)
        }) {
            return Err("stardew_unmanaged");
        }
        let old_tree = old
            .as_ref()
            .map(|g| self.input(g, check))
            .transpose()?
            .unwrap_or_default();
        let folder = old
            .as_ref()
            .map_or_else(|| package.folder.clone(), |g| g.folder.clone());
        let (payload, owned) = self.merge(&package.files, old.as_ref(), &old_tree, check)?;
        let next = Group {
            id: package.manifest.id,
            title: package.manifest.name,
            version: package.manifest.version,
            folder,
            enabled: old.as_ref().is_none_or(|g| g.enabled),
            files: owned,
            archive_hash: package.archive_hash,
            origin: package.origin,
        };
        if old.is_none() {
            self.target_empty(&location(&next))?
        }
        self.plan(
            before,
            old.clone(),
            Some(next),
            payload,
            old_tree,
            if old.is_some() {
                Mode::Update
            } else {
                Mode::Install
            },
        )
    }
    // Preserve generated files and the latest config.json. A changed owned
    // asset, or an unowned file colliding with a new release, needs review by
    // the user instead of being overwritten or silently carried forward.
    fn merge(
        &self,
        incoming: &[File],
        old: Option<&Group>,
        tree: &[Stamp],
        check: &dyn Fn() -> Result<()>,
    ) -> Result<(Vec<File>, Vec<Stamp>)> {
        let owned_names = incoming
            .iter()
            .map(|f| f.stamp.name.to_ascii_lowercase())
            .collect::<BTreeSet<_>>();
        let mut map = incoming
            .iter()
            .map(|f| {
                (
                    f.stamp.name.to_ascii_lowercase(),
                    File {
                        stamp: f.stamp.clone(),
                        bytes: f.bytes.clone(),
                    },
                )
            })
            .collect::<BTreeMap<_, _>>();
        if let Some(old) = old {
            let root = self.path(&location(old))?;
            for file in tree {
                let key = file.name.to_ascii_lowercase();
                let config = key == "config.json";
                let tracked = old
                    .files
                    .iter()
                    .any(|f| f.name.eq_ignore_ascii_case(&file.name));
                if tracked && !config {
                    continue;
                }
                if !config && map.contains_key(&key) {
                    return Err("stardew_conflict");
                }
                let bytes = files::read(
                    &files::child(&root, &file.name, false)?,
                    package::MAX_CONTENT,
                    check,
                )?;
                if package::stamp(&file.name, &bytes) != *file {
                    return Err("stardew_changed");
                }
                let name = map
                    .get(&key)
                    .map_or_else(|| file.name.clone(), |f| f.stamp.name.clone());
                map.insert(
                    key,
                    File {
                        stamp: package::stamp(&name, &bytes),
                        bytes,
                    },
                );
            }
        }
        let mut payload = map.into_values().collect::<Vec<_>>();
        payload.sort_by(|a, b| a.stamp.name.cmp(&b.stamp.name));
        stamps(&payload.iter().map(|f| f.stamp.clone()).collect::<Vec<_>>())?;
        let owned = payload
            .iter()
            .filter(|f| owned_names.contains(&f.stamp.name.to_ascii_lowercase()))
            .map(|f| f.stamp.clone())
            .collect();
        Ok((payload, owned))
    }
    pub fn removal(&self, id: &str, check: &dyn Fn() -> Result<()>) -> Result<Plan> {
        let before = self.available()?;
        let old = before
            .groups
            .iter()
            .find(|g| g.id == id)
            .cloned()
            .ok_or("stardew_missing")?;
        let tree = self.input(&old, check)?;
        self.plan(before, Some(old), None, vec![], tree, Mode::Remove)
    }
    pub fn toggle(&self, id: &str, check: &dyn Fn() -> Result<()>) -> Result<Plan> {
        let before = self.available()?;
        let old = before
            .groups
            .iter()
            .find(|g| g.id == id)
            .cloned()
            .ok_or("stardew_missing")?;
        let tree = self.input(&old, check)?;
        let mut next = old.clone();
        next.enabled = !next.enabled;
        self.target_empty(&location(&next))?;
        self.plan(before, Some(old), Some(next), vec![], tree, Mode::Toggle)
    }
    pub fn restore(&self, id: &str, check: &dyn Fn() -> Result<()>) -> Result<Plan> {
        let before = self.available()?;
        let backup = before
            .backups
            .iter()
            .find(|b| b.token == id)
            .cloned()
            .ok_or("stardew_missing")?;
        let root = self.path(&Area::Vault(id.into()))?;
        files::same(&root, &backup.files)?;
        let old = before
            .groups
            .iter()
            .find(|g| g.id.eq_ignore_ascii_case(&backup.group.id))
            .cloned();
        let old_tree = old
            .as_ref()
            .map(|g| self.input(g, check))
            .transpose()?
            .unwrap_or_default();
        let input = if old.is_some() {
            &backup.group.files
        } else {
            &backup.files
        };
        let mut incoming = Vec::new();
        for f in input {
            check()?;
            let bytes = files::read(
                &files::child(&root, &f.name, false)?,
                package::MAX_CONTENT,
                check,
            )?;
            incoming.push(File {
                stamp: package::stamp(&f.name, &bytes),
                bytes,
            });
        }
        let (payload, _) = self.merge(&incoming, old.as_ref(), &old_tree, check)?;
        let mut next = backup.group.clone();
        if let Some(old) = &old {
            next.enabled = old.enabled;
            next.folder = old.folder.clone();
        }
        next.files = payload
            .iter()
            .filter(|f| {
                backup
                    .group
                    .files
                    .iter()
                    .any(|p| p.name.eq_ignore_ascii_case(&f.stamp.name))
            })
            .map(|f| f.stamp.clone())
            .collect();
        if old.is_none() {
            self.target_empty(&location(&next))?
        }
        self.plan(before, old, Some(next), payload, old_tree, Mode::Restore)
    }
    fn verify_plan(&self, j: &Journal) -> Result<()> {
        validate_journal(j, &files::identity(&self.game))?;
        if self.load()? != j.before {
            return Err("stardew_changed");
        }
        if let Some(old) = &j.previous {
            files::same(&self.path(&location(old))?, &j.old_tree)?
        }
        if let Some(next) = &j.next {
            if j.previous.as_ref().is_none_or(|old| {
                std::mem::discriminant(&location(old)) != std::mem::discriminant(&location(next))
                    || old.enabled != next.enabled
            }) {
                self.target_empty(&location(next))?
            }
        }
        self.requirements(j, None)?;
        Ok(())
    }
    pub fn review_requirements(&self, plan: &Plan) -> Result<Vec<super::stardew::Requirement>> {
        self.requirements(&plan.journal, Some(&plan.payload))
    }
    fn requirements(
        &self,
        j: &Journal,
        prepared: Option<&[File]>,
    ) -> Result<Vec<super::stardew::Requirement>> {
        let mut current = super::stardew::scan(
            self.game.to_str().ok_or("stardew_folder")?,
            &|| Ok(()),
            &|_| Ok(()),
        )?;
        if current.partial {
            return Err("stardew_partial");
        }
        current.game_version = self.guard.game_version.clone();
        current.smapi_version = self.guard.smapi_version.clone();
        let subject = j
            .next
            .as_ref()
            .or(j.previous.as_ref())
            .ok_or("stardew_record")?;
        let subject_id = subject.id.to_ascii_lowercase();
        if current
            .mods
            .iter()
            .filter(|m| m.manifest.id.to_ascii_lowercase() == subject_id)
            .any(|m| {
                j.previous
                    .as_ref()
                    .is_none_or(|p| !p.enabled || m.folder != p.folder)
            })
        {
            return Err("stardew_unmanaged");
        }
        current
            .mods
            .retain(|m| m.manifest.id.to_ascii_lowercase() != subject_id);
        if let Some(next) = j.next.as_ref().filter(|g| g.enabled) {
            let bytes = if let Some(file) = prepared.and_then(|p| {
                p.iter()
                    .find(|f| f.stamp.name.eq_ignore_ascii_case("manifest.json"))
            }) {
                file.bytes.clone()
            } else {
                let root = if j.mode == Mode::Toggle {
                    self.path(&location(j.previous.as_ref().unwrap()))?
                } else {
                    self.path(&Area::Stage(j.token.clone()))?
                };
                if !files::exists(&root)? {
                    return Ok(vec![]);
                }
                files::read(
                    &files::child(&root, "manifest.json", false)?,
                    256 * 1024,
                    &|| Ok(()),
                )?
            };
            let manifest = stardew_manifest::parse(&bytes)?;
            if manifest.id != next.id || manifest.version != next.version {
                return Err("stardew_record");
            }
            current.mods.push(super::stardew::Mod {
                folder: next.folder.clone(),
                manifest,
                missing_dll: false,
                duplicate: false,
                requirements: vec![],
            });
        }
        super::stardew::requirements(&mut current);
        for entry in &current.mods {
            let own = entry.manifest.id.to_ascii_lowercase() == subject_id;
            for r in &entry.requirements {
                if r.required
                    && (own || r.id.to_ascii_lowercase() == subject_id)
                    && ["older", "missing", "duplicate", "unusable"].contains(&r.status)
                {
                    return Err(if own {
                        "stardew_requirements"
                    } else {
                        "stardew_dependents"
                    });
                }
            }
        }
        Ok(current
            .mods
            .into_iter()
            .find(|m| m.manifest.id.to_ascii_lowercase() == subject_id)
            .map_or_else(Vec::new, |m| m.requirements))
    }
    pub fn apply(
        &self,
        mut plan: Plan,
        check: &dyn Fn() -> Result<()>,
        event: &dyn Fn(&str) -> Result<()>,
    ) -> Result<State> {
        check()?;
        if self.pending()? {
            return Err("stardew_recovery");
        };
        self.verify_plan(&plan.journal)?;
        if plan.journal.next.is_some() && plan.journal.mode != Mode::Toggle {
            self.target_empty(&Area::Stage(plan.journal.token.clone()))?;
        }
        if plan.journal.previous.is_some() && plan.journal.mode != Mode::Toggle {
            self.target_empty(&Area::Vault(plan.journal.token.clone()))?;
        }
        if super::transfer_files::free_bytes(&self.base)
            .is_some_and(|n| n < plan.bytes() + 32 * 1024 * 1024)
        {
            return Err("stardew_space");
        }
        let journal = &mut plan.journal;
        files::atomic(&self.base, "journal.json", journal)?;
        let result = (|| {
            if journal.next.is_some() && journal.mode != Mode::Toggle {
                let stage = files::mkdir(&self.base, &format!("stage-{}", journal.token))?;
                for file in &plan.payload {
                    check()?;
                    files::write_new(&stage, &file.stamp.name, &file.bytes, check)?;
                    event("staging")?;
                }
                files::same(&stage, &journal.new_tree)?;
            }
            self.verify_plan(journal)?;
            check()?;
            journal.ready = true;
            files::atomic(&self.base, "journal.json", journal)?;
            let moves = movements(journal);
            for movement in &moves {
                let from = self.path(&movement.from)?;
                let to = self.path(&movement.to)?;
                files::same(&from, &movement.files)?;
                self.target_empty(&movement.to)?;
                fs::rename(&from, &to).map_err(|_| "stardew_write")?;
                files::sync_dir(from.parent().unwrap());
                files::sync_dir(to.parent().unwrap());
                event("moved")?;
                journal.cursor += 1;
                files::atomic(&self.base, "journal.json", journal)?;
            }
            files::atomic(&self.base, "state.json", &journal.after)?;
            event("committed")?;
            fs::remove_file(self.base.join("journal.json")).map_err(|_| "stardew_write")?;
            Ok(journal.after.clone())
        })();
        match result {
            Ok(state) => Ok(state),
            Err(error) => {
                let recovered = self.recover().map_err(|_| "stardew_recovery")?;
                if recovered == journal.after {
                    Ok(recovered)
                } else {
                    Err(error)
                }
            }
        }
    }
    pub fn recover(&self) -> Result<State> {
        if !self.pending()? {
            return self.load();
        };
        let mut j: Journal = files::json(&self.base.join("journal.json"))?;
        validate_journal(&j, &files::identity(&self.game))?;
        let state = self.load()?;
        let moves = movements(&j);
        if state == j.after {
            for movement in &moves {
                files::same(&self.path(&movement.to)?, &movement.files)?
            }
            fs::remove_file(self.base.join("journal.json")).map_err(|_| "stardew_write")?;
            return Ok(state);
        }
        if state != j.before {
            return Err("stardew_record");
        }
        if j.ready {
            if !j.reversing && j.cursor < moves.len() {
                let m = &moves[j.cursor];
                let from = self.path(&m.from)?;
                let to = self.path(&m.to)?;
                match (files::exists(&from)?, files::exists(&to)?) {
                    (false, true) => {
                        files::same(&to, &m.files)?;
                        j.cursor += 1
                    }
                    (true, false) => files::same(&from, &m.files)?,
                    _ => return Err("stardew_changed"),
                }
            }
            j.reversing = true;
            files::atomic(&self.base, "journal.json", &j)?;
            while j.cursor > 0 {
                let m = &moves[j.cursor - 1];
                let from = self.path(&m.from)?;
                let to = self.path(&m.to)?;
                match (files::exists(&from)?, files::exists(&to)?) {
                    (false, true) => {
                        files::same(&to, &m.files)?;
                        fs::rename(&to, &from).map_err(|_| "stardew_write")?;
                        files::sync_dir(from.parent().unwrap());
                        files::sync_dir(to.parent().unwrap());
                    }
                    (true, false) => files::same(&from, &m.files)?,
                    _ => return Err("stardew_changed"),
                }
                j.cursor -= 1;
                files::atomic(&self.base, "journal.json", &j)?;
            }
        }
        if let Some(old) = &j.previous {
            files::same(&self.path(&location(old))?, &j.old_tree)?
        }
        let stage = self.path(&Area::Stage(j.token.clone()))?;
        if files::exists(&stage)? {
            files::directory(&stage)?;
            let kept = self.base.join(format!("kept-{}", j.token));
            if files::exists(&kept)? {
                return Err("stardew_changed");
            };
            fs::rename(stage, kept).map_err(|_| "stardew_write")?;
            files::sync_dir(&self.base);
        }
        fs::remove_file(self.base.join("journal.json")).map_err(|_| "stardew_write")?;
        Ok(state)
    }
}

#[cfg(test)]
#[path = "stardew_store_tests.rs"]
mod tests;
