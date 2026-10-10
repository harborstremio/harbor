//! Whole-addon-folder transactions. A journal is durable before any live folder
//! moves; recovery uses hashes and a move cursor, never the apparent filename.
use super::{
    p2p_files, save_files, transfer_files,
    wow_addon_package::{self as package, FileStamp, Package, Result},
    wow_addons,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};
use tokio_util::sync::CancellationToken;

const STORE: &str = ".harbor-wow-addons";
const RECORD_LIMIT: usize = 32 * 1024 * 1024;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: u32,
    pub title: String,
    pub version: String,
    pub folders: Vec<String>,
    pub files: Vec<FileStamp>,
    pub dependencies: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    pub token: String,
    pub created_at: u64,
    pub group: Group,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct State {
    pub schema: u8,
    pub id: String,
    pub revision: String,
    pub packages: Vec<Group>,
    pub backups: Vec<Backup>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
enum Area {
    Live,
    Stage(String),
    Vault(String),
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
struct Movement {
    from: Area,
    to: Area,
    folder: String,
    files: Vec<FileStamp>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
struct Journal {
    plan: Plan,
    after: State,
    created_at: u64,
    moves: Vec<Movement>,
    completed: usize,
    reversing: bool,
}
pub struct Store {
    base: PathBuf,
    records: PathBuf,
    id: String,
    _lock: fs::File,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Plan {
    pub token: String,
    pub before: State,
    pub previous: Option<Group>,
    pub next: Option<Group>,
    source: Option<Area>,
    restored: Option<String>,
}
impl Plan {
    pub fn is_adoption(&self) -> bool {
        self.source == Some(Area::Live)
    }
}
fn uuid(value: &str) -> Result<()> {
    let parsed = uuid::Uuid::parse_str(value).map_err(|_| "wow_addons_record")?;
    if parsed.to_string() != value {
        return Err("wow_addons_record");
    }
    Ok(())
}
fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn exists(path: &Path) -> Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err("wow_addons_read"),
    }
}
fn directory(path: &Path) -> Result<PathBuf> {
    p2p_files::plain_dir(path).map_err(|_| "wow_addons_linked")
}
fn create_directory(parent: &Path, name: &str) -> Result<PathBuf> {
    directory(parent)?;
    let path = parent.join(name);
    if !exists(&path)? {
        fs::create_dir(&path).map_err(|_| "wow_addons_write")?;
    }
    let path = directory(&path)?;
    if path.parent() != Some(parent) {
        return Err("wow_addons_linked");
    }
    Ok(path)
}
fn read(path: &Path, limit: usize) -> Result<Vec<u8>> {
    directory(path.parent().ok_or("wow_addons_read")?)?;
    let meta = fs::symlink_metadata(path).map_err(|_| "wow_addons_read")?;
    if !meta.is_file() || save_files::reparse(&meta) || meta.len() > limit as u64 {
        return Err("wow_addons_record");
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|_| "wow_addons_read")?
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "wow_addons_read")?;
    if bytes.len() > limit {
        return Err("wow_addons_limit");
    }
    Ok(bytes)
}
fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    serde_json::from_slice(&read(path, RECORD_LIMIT)?).map_err(|_| "wow_addons_record")
}
fn write_json<T: Serialize>(root: &Path, name: &str, value: &T) -> Result<()> {
    directory(root)?;
    if exists(&root.join(name))? {
        let meta = fs::symlink_metadata(root.join(name)).map_err(|_| "wow_addons_read")?;
        if !meta.is_file() || save_files::reparse(&meta) {
            return Err("wow_addons_record");
        }
    }
    let bytes = serde_json::to_vec(value).map_err(|_| "wow_addons_record")?;
    if bytes.len() > RECORD_LIMIT {
        return Err("wow_addons_limit");
    }
    p2p_files::atomic(root, name, &bytes).map_err(|_| "wow_addons_write")
}
fn valid_folder(name: &str) -> Result<()> {
    p2p_files::component(name).map_err(|_| "wow_addons_record")?;
    if name.to_ascii_lowercase().starts_with("blizzard_") {
        return Err("wow_addons_record");
    }
    Ok(())
}
fn validate_group(group: &Group) -> Result<()> {
    if group.id == 0
        || group.title.is_empty()
        || group.title.len() > 180
        || group.version.is_empty()
        || group.version.len() > 100
        || group.folders.is_empty()
        || group.folders.len() > 64
        || group.files.is_empty()
        || group.files.len() > package::MAX_FILES
        || group.dependencies.len() > 256
    {
        return Err("wow_addons_record");
    }
    if group
        .files
        .windows(2)
        .any(|pair| pair[0].path >= pair[1].path)
    {
        return Err("wow_addons_record");
    }
    let mut folders = BTreeSet::new();
    let mut found = BTreeSet::new();
    for name in &group.folders {
        valid_folder(name)?;
        if !folders.insert(name.to_ascii_lowercase()) {
            return Err("wow_addons_record");
        }
    }
    let mut paths = BTreeMap::new();
    let mut exact = BTreeSet::new();
    let mut total = 0u64;
    for file in &group.files {
        if package::relative(&file.path)? != file.path
            || file.sha256.len() != 64
            || !file.sha256.bytes().all(|c| c.is_ascii_hexdigit())
            || file.bytes > 16 * 1024 * 1024
        {
            return Err("wow_addons_record");
        }
        let (folder, _) = file.path.split_once('/').ok_or("wow_addons_record")?;
        if !group.folders.iter().any(|name| name == folder)
            || !exact.insert(file.path.to_ascii_lowercase())
        {
            return Err("wow_addons_record");
        }
        found.insert(folder.to_ascii_lowercase());
        total = total.checked_add(file.bytes).ok_or("wow_addons_limit")?;
        let mut prefix = String::new();
        for part in file.path.split('/') {
            if !prefix.is_empty() {
                prefix.push('/');
            }
            prefix.push_str(part);
            if let Some(previous) = paths.insert(prefix.to_ascii_lowercase(), prefix.clone()) {
                if previous != prefix {
                    return Err("wow_addons_record");
                }
            }
        }
    }
    if total > package::MAX_CONTENT as u64 || folders != found {
        return Err("wow_addons_limit");
    }
    for path in exact.iter() {
        let mut parent = path.as_str();
        while let Some((prefix, _)) = parent.rsplit_once('/') {
            if exact.contains(prefix) {
                return Err("wow_addons_record");
            }
            parent = prefix;
        }
    }
    for name in &group.dependencies {
        valid_folder(name)?;
    }
    Ok(())
}
fn validate(state: &State, id: &str) -> Result<()> {
    if state.schema != 1
        || state.id != id
        || state.packages.len() > 128
        || state.backups.len() > 128
    {
        return Err("wow_addons_record");
    }
    uuid(&state.revision)?;
    let mut ids = BTreeSet::new();
    let mut folders = BTreeSet::new();
    let mut slots = BTreeSet::new();
    let mut files = 0;
    for group in &state.packages {
        validate_group(group)?;
        files += group.files.len();
        if !ids.insert(group.id) {
            return Err("wow_addons_record");
        }
        for folder in &group.folders {
            if !folders.insert(folder.to_ascii_lowercase()) {
                return Err("wow_addons_record");
            }
        }
    }
    for backup in &state.backups {
        uuid(&backup.token)?;
        validate_group(&backup.group)?;
        files += backup.group.files.len();
        if !slots.insert(&backup.token) {
            return Err("wow_addons_record");
        }
    }
    if files > 50000 {
        return Err("wow_addons_limit");
    }
    Ok(())
}
fn tree(root: &Path, folders: &[String], cancel: &CancellationToken) -> Result<Vec<FileStamp>> {
    directory(root)?;
    let mut result = Vec::new();
    let mut total = 0usize;
    let mut visited = 0;
    let mut pending = Vec::new();
    for folder in folders {
        valid_folder(folder)?;
        directory(&root.join(folder))?;
        pending.push(folder.clone());
    }
    while let Some(relative) = pending.pop() {
        package::check_cancel(cancel)?;
        let path = root.join(&relative);
        directory(&path)?;
        for item in fs::read_dir(&path).map_err(|_| "wow_addons_read")? {
            package::check_cancel(cancel)?;
            visited += 1;
            if visited > 16000 {
                return Err("wow_addons_limit");
            }
            let item = item.map_err(|_| "wow_addons_read")?;
            let name = item
                .file_name()
                .into_string()
                .map_err(|_| "wow_addons_record")?;
            let relative = package::relative(&format!("{relative}/{name}"))?;
            let meta = fs::symlink_metadata(item.path()).map_err(|_| "wow_addons_read")?;
            if save_files::reparse(&meta) {
                return Err("wow_addons_linked");
            }
            if meta.is_dir() {
                pending.push(relative);
                continue;
            }
            if !meta.is_file()
                || meta.len() > 16 * 1024 * 1024
                || result.len() >= package::MAX_FILES
            {
                return Err("wow_addons_limit");
            }
            let bytes = read(&item.path(), 16 * 1024 * 1024)?;
            total += bytes.len();
            if total > package::MAX_CONTENT {
                return Err("wow_addons_limit");
            }
            result.push(FileStamp {
                path: relative,
                bytes: bytes.len() as u64,
                sha256: package::digest(&bytes),
            });
        }
    }
    result.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(result)
}
fn matches(root: &Path, folders: &[String], files: &[FileStamp]) -> Result<()> {
    verify(root, folders, files, &CancellationToken::new())
}
fn verify(
    root: &Path,
    folders: &[String],
    files: &[FileStamp],
    cancel: &CancellationToken,
) -> Result<()> {
    if tree(root, folders, cancel)? != files {
        return Err("wow_addons_changed");
    }
    Ok(())
}
fn lock(root: &Path) -> Result<fs::File> {
    directory(root)?;
    let path = root.join("lock");
    if exists(&path)? {
        let meta = fs::symlink_metadata(&path).map_err(|_| "wow_addons_read")?;
        if !meta.is_file() || save_files::reparse(&meta) || meta.len() != 0 {
            return Err("wow_addons_record");
        }
    }
    let mut options = fs::OpenOptions::new();
    options.read(true).write(true).create(true).truncate(false);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.share_mode(0).custom_flags(0x00200000);
    }
    let file = options.open(path).map_err(|_| "wow_addons_busy")?;
    if save_files::reparse(&file.metadata().map_err(|_| "wow_addons_read")?) {
        return Err("wow_addons_linked");
    }
    Ok(file)
}
impl Store {
    /// A page read must not create directories, acquire the executable, or run
    /// recovery while the user may be playing. Recovery is an explicit action.
    pub fn snapshot(client: &Path, id: &str) -> Result<(Option<State>, bool)> {
        let client = directory(client)?;
        let interface = client.join("Interface");
        if !exists(&interface)? {
            return Ok((None, false));
        }
        let records = directory(&interface)?.join(STORE);
        if !exists(&records)? {
            return Ok((None, false));
        }
        let records = directory(&records)?;
        let state: State = read_json(&records.join("state.json"))?;
        validate(&state, id)?;
        Ok((Some(state), exists(&records.join("journal.json"))?))
    }
    pub fn exists(client: &Path) -> Result<bool> {
        let client = directory(client)?;
        let interface = client.join("Interface");
        if !exists(&interface)? {
            return Ok(false);
        }
        exists(&directory(&interface)?.join(STORE))
    }
    pub fn connect(client: &Path, id: &str) -> Result<Self> {
        if ![
            "battlenet:wow",
            "battlenet:wow_classic",
            "battlenet:wow_classic_era",
            "battlenet:wow_classic_anniversary",
        ]
        .contains(&id)
        {
            return Err("wow_addons_edition");
        }
        let client = directory(client)?;
        let base = create_directory(&client, "Interface")?;
        create_directory(&base, "AddOns")?;
        let records = base.join(STORE);
        let fresh = !exists(&records)?;
        if fresh {
            fs::create_dir(&records).map_err(|_| "wow_addons_write")?;
        }
        let records = directory(&records)?;
        let held = lock(&records)?;
        if fresh {
            let state = State {
                schema: 1,
                id: id.into(),
                revision: uuid::Uuid::new_v4().to_string(),
                packages: vec![],
                backups: vec![],
            };
            write_json(&records, "state.json", &state)?;
        }
        let store = Self {
            base,
            records,
            id: id.into(),
            _lock: held,
        };
        store.load()?;
        Ok(store)
    }
    fn area(&self, area: &Area, create: bool) -> Result<PathBuf> {
        directory(&self.base)?;
        directory(&self.records)?;
        match area {
            Area::Live => directory(&self.base.join("AddOns")),
            Area::Stage(token) | Area::Vault(token) => {
                uuid(token)?;
                let name = if matches!(area, Area::Stage(_)) {
                    "stage"
                } else {
                    "vault"
                };
                if create {
                    let root = create_directory(&self.records, name)?;
                    create_directory(&root, token)
                } else {
                    directory(&self.records.join(name).join(token))
                }
            }
        }
    }
    pub fn load(&self) -> Result<State> {
        let state: State = read_json(&self.records.join("state.json"))?;
        validate(&state, &self.id)?;
        if exists(&self.records.join("journal.json"))? {
            self.recover(&state)?;
        }
        Ok(state)
    }
    fn check_owned(&self, state: &State) -> Result<()> {
        self.check_owned_with(state, &CancellationToken::new())
    }
    fn check_owned_with(&self, state: &State, cancel: &CancellationToken) -> Result<()> {
        let root = self.area(&Area::Live, false)?;
        for group in &state.packages {
            verify(&root, &group.folders, &group.files, cancel)?;
        }
        Ok(())
    }
    pub fn compatible(&self, group: &Group, source: &Plan, version: &str) -> Result<()> {
        let area = source.source.as_ref().ok_or("wow_addons_record")?;
        self.check_compatibility(group, area, version)
    }
    fn check_compatibility(&self, group: &Group, area: &Area, version: &str) -> Result<()> {
        let root = self.area(area, false)?;
        let target = package::interface(version)?;
        for folder in &group.folders {
            let mut choices = Vec::new();
            for file in &group.files {
                let Some(inner) = file.path.strip_prefix(&format!("{folder}/")) else {
                    continue;
                };
                if inner.contains('/') || !inner.to_ascii_lowercase().ends_with(".toc") {
                    continue;
                }
                let bytes = read(&root.join(&file.path), 128 * 1024)?;
                let raw = std::str::from_utf8(&bytes).map_err(|_| "wow_addons_manifest")?;
                choices.push(wow_addons::manifest(inner, raw));
            }
            let toc = wow_addons::select_manifest(
                folder,
                &choices,
                wow_addons::suffixes(&self.id, Some(target / 10000)),
            )
            .map_err(|_| "wow_addons_manifest")?
            .ok_or("wow_addons_manifest")?;
            if !toc.interfaces.contains(&target) {
                return Err("wow_addons_incompatible");
            }
        }
        Ok(())
    }
    pub fn stage(&self, package: Package, cancel: &CancellationToken) -> Result<Plan> {
        package::check_cancel(cancel)?;
        let before = self.load()?;
        self.check_owned_with(&before, cancel)?;
        let previous = before
            .packages
            .iter()
            .find(|group| group.id == package.release.id)
            .cloned();
        let next = Group {
            id: package.release.id,
            title: package.release.title,
            version: package.release.version,
            folders: package.folders,
            files: package
                .files
                .iter()
                .map(|file| file.stamp.clone())
                .collect(),
            dependencies: package.dependencies,
        };
        validate_group(&next)?;
        self.collisions(&before, previous.as_ref(), Some(&next))?;
        let bytes = next.files.iter().map(|file| file.bytes).sum::<u64>();
        if transfer_files::free_bytes(&self.records)
            .is_some_and(|available| available < bytes.saturating_add(16 * 1024 * 1024))
        {
            return Err("wow_addons_space");
        }
        let token = uuid::Uuid::new_v4().to_string();
        let area = Area::Stage(token.clone());
        let root = self.area(&area, true)?;
        self.mark_stage(&root, &token, &next)?;
        let plan = Plan {
            token,
            before,
            previous,
            next: Some(next),
            source: Some(area),
            restored: None,
        };
        let result = (|| {
            for file in package.files {
                package::check_cancel(cancel)?;
                let parts: Vec<_> = file.stamp.path.split('/').collect();
                let mut parent = root.clone();
                for part in &parts[..parts.len() - 1] {
                    parent = create_directory(&parent, part)?;
                }
                let mut output = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(root.join(stages::PARTIAL))
                    .map_err(|_| "wow_addons_write")?;
                output
                    .write_all(&file.data)
                    .and_then(|_| output.sync_all())
                    .map_err(|_| "wow_addons_write")?;
                drop(output);
                transfer_files::publish(
                    &root.join(stages::PARTIAL),
                    &parent.join(parts.last().unwrap()),
                )
                .map_err(|_| "wow_addons_write")?;
            }
            let next = plan.next.as_ref().ok_or("wow_addons_record")?;
            verify(&root, &next.folders, &next.files, cancel)
        })();
        if let Err(error) = result {
            let _ = self.discard(&plan);
            return Err(error);
        }
        Ok(plan)
    }
    pub fn removal(&self, id: u32) -> Result<Plan> {
        let before = self.load()?;
        self.check_owned(&before)?;
        let previous = before
            .packages
            .iter()
            .find(|group| group.id == id)
            .cloned()
            .ok_or("wow_addons_unmanaged")?;
        Ok(Plan {
            token: uuid::Uuid::new_v4().to_string(),
            before,
            previous: Some(previous),
            next: None,
            source: None,
            restored: None,
        })
    }
    pub fn restore(&self, token: &str, version: &str) -> Result<Plan> {
        uuid(token)?;
        let before = self.load()?;
        self.check_owned(&before)?;
        let backup = before
            .backups
            .iter()
            .find(|backup| backup.token == token)
            .ok_or("wow_addons_backup")?
            .clone();
        let source = Area::Vault(token.into());
        matches(
            &self.area(&source, false)?,
            &backup.group.folders,
            &backup.group.files,
        )?;
        self.check_compatibility(&backup.group, &source, version)?;
        let previous = before
            .packages
            .iter()
            .find(|group| group.id == backup.group.id)
            .cloned();
        self.collisions(&before, previous.as_ref(), Some(&backup.group))?;
        Ok(Plan {
            token: uuid::Uuid::new_v4().to_string(),
            before,
            previous,
            next: Some(backup.group),
            source: Some(source),
            restored: Some(token.into()),
        })
    }
    fn collisions(
        &self,
        state: &State,
        previous: Option<&Group>,
        next: Option<&Group>,
    ) -> Result<()> {
        let Some(next) = next else {
            return Ok(());
        };
        let root = self.area(&Area::Live, false)?;
        let replaced: BTreeSet<_> = previous
            .into_iter()
            .flat_map(|group| group.folders.iter().map(|name| name.to_ascii_lowercase()))
            .collect();
        for folder in &next.folders {
            let key = folder.to_ascii_lowercase();
            if state.packages.iter().any(|group| {
                group.id != next.id
                    && group
                        .folders
                        .iter()
                        .any(|name| name.eq_ignore_ascii_case(folder))
            }) {
                return Err("wow_addons_collision");
            }
            if exists(&root.join(folder))? && !replaced.contains(&key) {
                return Err("wow_addons_unmanaged");
            }
        }
        Ok(())
    }
    fn journal(&self, plan: &Plan) -> Result<Journal> {
        self.journal_at(plan, uuid::Uuid::new_v4().to_string(), now())
    }
    fn journal_at(&self, plan: &Plan, revision: String, created_at: u64) -> Result<Journal> {
        uuid(&plan.token)?;
        validate(&plan.before, &self.id)?;
        uuid(&revision)?;
        if revision == plan.before.revision
            || created_at == 0
            || plan
                .before
                .backups
                .iter()
                .any(|backup| backup.token == plan.token)
        {
            return Err("wow_addons_record");
        }
        let id = plan
            .next
            .as_ref()
            .or(plan.previous.as_ref())
            .ok_or("wow_addons_record")?
            .id;
        if plan.previous.as_ref().is_some_and(|group| group.id != id) {
            return Err("wow_addons_identity");
        }
        if plan.before.packages.iter().find(|group| group.id == id) != plan.previous.as_ref() {
            return Err("wow_addons_record");
        }
        match (&plan.next, &plan.source, &plan.restored) {
            (Some(_), Some(Area::Live), None) if plan.previous.is_none() => {}
            (Some(_), Some(Area::Stage(token)), None) if token == &plan.token => {}
            (Some(next), Some(Area::Vault(token)), Some(restored))
                if token == restored && token != &plan.token =>
            {
                if !plan
                    .before
                    .backups
                    .iter()
                    .any(|backup| &backup.token == token && &backup.group == next)
                {
                    return Err("wow_addons_record");
                }
            }
            (None, None, None) => {}
            _ => return Err("wow_addons_record"),
        }
        let mut after = plan.before.clone();
        after.revision = revision;
        after.packages.retain(|group| group.id != id);
        if let Some(token) = &plan.restored {
            after.backups.retain(|backup| &backup.token != token);
        }
        if let Some(next) = &plan.next {
            after.packages.push(next.clone());
        }
        if let Some(previous) = &plan.previous {
            after.backups.push(Backup {
                token: plan.token.clone(),
                created_at,
                group: previous.clone(),
            });
        }
        validate(&after, &self.id)?;
        let mut moves = Vec::new();
        for (group, from, to) in [
            (
                plan.previous.as_ref(),
                Area::Live,
                Area::Vault(plan.token.clone()),
            ),
            (
                plan.next.as_ref(),
                plan.source.clone().unwrap_or(Area::Live),
                Area::Live,
            ),
        ] {
            if let Some(group) = group {
                // Adoption records ownership of the already-reviewed live tree.
                // It neither moves nor rewrites the user's existing files.
                if from == to {
                    continue;
                }
                for folder in &group.folders {
                    moves.push(Movement {
                        from: from.clone(),
                        to: to.clone(),
                        folder: folder.clone(),
                        files: group
                            .files
                            .iter()
                            .filter(|file| file.path.starts_with(&format!("{folder}/")))
                            .cloned()
                            .collect(),
                    });
                }
            }
        }
        Ok(Journal {
            plan: plan.clone(),
            after,
            created_at,
            moves,
            completed: 0,
            reversing: false,
        })
    }
    fn prepare(&self, plan: &Plan, version: &str, cancel: &CancellationToken) -> Result<Journal> {
        package::check_cancel(cancel)?;
        let observed = self.load()?;
        if observed != plan.before {
            return Err("wow_addons_changed");
        }
        self.check_owned_with(&observed, cancel)?;
        self.collisions(
            &observed,
            if plan.is_adoption() {
                plan.next.as_ref()
            } else {
                plan.previous.as_ref()
            },
            plan.next.as_ref(),
        )?;
        if let Some(next) = &plan.next {
            self.compatible(next, plan, version)?;
            verify(
                &self.area(plan.source.as_ref().unwrap(), false)?,
                &next.folders,
                &next.files,
                cancel,
            )?;
        }
        let journal = self.journal(plan)?;
        self.dependencies(&journal.after, version)?;
        Ok(journal)
    }
    pub fn preview(&self, plan: &Plan, version: &str, cancel: &CancellationToken) -> Result<()> {
        self.prepare(plan, version, cancel).map(|_| ())
    }
    pub fn apply(&self, plan: &Plan, version: &str, cancel: &CancellationToken) -> Result<State> {
        let mut journal = self.prepare(plan, version, cancel)?;
        for movement in &journal.moves {
            self.area(&movement.to, true)?;
        }
        package::check_cancel(cancel)?;
        write_json(&self.records, "journal.json", &journal)?;
        let result = (|| {
            for movement in &journal.moves {
                package::check_cancel(cancel)?;
                self.move_folder(movement, false)?;
                journal.completed += 1;
                write_json(&self.records, "journal.json", &journal)?;
            }
            self.check_owned_with(&journal.after, cancel)?;
            package::check_cancel(cancel)?;
            write_json(&self.records, "state.json", &journal.after)
        })();
        if let Err(error) = result {
            self.recover(&self.read_state()?)?;
            return Err(error);
        }
        self.recover(&journal.after)?;
        Ok(journal.after)
    }
    fn read_state(&self) -> Result<State> {
        let state: State = read_json(&self.records.join("state.json"))?;
        validate(&state, &self.id)?;
        Ok(state)
    }
    fn dependencies(&self, after: &State, version: &str) -> Result<()> {
        let current = self.read_state()?;
        let owned: BTreeSet<_> = current
            .packages
            .iter()
            .flat_map(|group| group.folders.iter().map(|s| s.to_ascii_lowercase()))
            .collect();
        let active: BTreeSet<_> = after
            .packages
            .iter()
            .flat_map(|group| group.folders.iter().map(|s| s.to_ascii_lowercase()))
            .collect();
        let root = self.area(&Area::Live, false)?;
        let removed: BTreeSet<_> = owned.difference(&active).cloned().collect();
        let target = package::interface(version)?;
        let mut budget = 8 * 1024 * 1024;
        for group in &after.packages {
            for name in &group.dependencies {
                let key = name.to_ascii_lowercase();
                if active.contains(&key) {
                    continue;
                }
                if removed.contains(&key) || !exists(&root.join(name))? {
                    return Err("wow_addons_dependency");
                }
                let toc = self
                    .external_manifest(&root, name, target, &mut budget)?
                    .ok_or("wow_addons_dependency")?;
                if !toc.interfaces.contains(&target) {
                    return Err("wow_addons_dependency");
                }
            }
        }
        // Removing a managed library must also respect addons installed elsewhere.
        if !removed.is_empty() {
            for (index, item) in fs::read_dir(&root)
                .map_err(|_| "wow_addons_read")?
                .enumerate()
            {
                if index >= 2000 {
                    return Err("wow_addons_limit");
                }
                let item = item.map_err(|_| "wow_addons_read")?;
                let name = item
                    .file_name()
                    .into_string()
                    .map_err(|_| "wow_addons_record")?;
                if owned.contains(&name.to_ascii_lowercase())
                    || name.to_ascii_lowercase().starts_with("blizzard_")
                {
                    continue;
                }
                let meta = fs::symlink_metadata(item.path()).map_err(|_| "wow_addons_read")?;
                if save_files::reparse(&meta) {
                    return Err("wow_addons_linked");
                }
                if !meta.is_dir() {
                    continue;
                }
                if let Some(toc) = self.external_manifest(&root, &name, target, &mut budget)? {
                    if toc
                        .dependencies
                        .iter()
                        .any(|name| removed.contains(&name.to_ascii_lowercase()))
                    {
                        return Err("wow_addons_dependency");
                    }
                }
            }
        }
        Ok(())
    }
    fn external_manifest(
        &self,
        root: &Path,
        folder: &str,
        target: u32,
        budget: &mut usize,
    ) -> Result<Option<wow_addons::Manifest>> {
        valid_folder(folder)?;
        let path = directory(&root.join(folder))?;
        let mut choices = Vec::new();
        for (index, item) in fs::read_dir(path)
            .map_err(|_| "wow_addons_read")?
            .enumerate()
        {
            if index >= 2000 {
                return Err("wow_addons_limit");
            }
            let item = item.map_err(|_| "wow_addons_read")?;
            let name = item
                .file_name()
                .into_string()
                .map_err(|_| "wow_addons_record")?;
            if !name.to_ascii_lowercase().ends_with(".toc") {
                continue;
            }
            let bytes = read(&item.path(), 128 * 1024)?;
            *budget = budget.checked_sub(bytes.len()).ok_or("wow_addons_limit")?;
            choices.push(wow_addons::manifest(
                &name,
                std::str::from_utf8(&bytes).map_err(|_| "wow_addons_manifest")?,
            ));
        }
        wow_addons::select_manifest(
            folder,
            &choices,
            wow_addons::suffixes(&self.id, Some(target / 10000)),
        )
        .map_err(|_| "wow_addons_manifest")
    }
    fn move_folder(&self, movement: &Movement, reverse: bool) -> Result<()> {
        valid_folder(&movement.folder)?;
        let from = self.area(
            if reverse {
                &movement.to
            } else {
                &movement.from
            },
            false,
        )?;
        let to = self.area(
            if reverse {
                &movement.from
            } else {
                &movement.to
            },
            false,
        )?;
        matches(&from, &[movement.folder.clone()], &movement.files)?;
        if exists(&to.join(&movement.folder))? {
            return Err("wow_addons_changed");
        }
        #[cfg(windows)]
        {
            transfer_files::publish(&from.join(&movement.folder), &to.join(&movement.folder))
                .map_err(|_| "wow_addons_write")?;
            Ok(())
        }
        #[cfg(not(windows))]
        {
            Err("wow_addons_platform")
        }
    }
    fn validate_journal(&self, journal: &Journal, state: &State) -> Result<()> {
        let expected = self.journal_at(
            &journal.plan,
            journal.after.revision.clone(),
            journal.created_at,
        )?;
        if ![&journal.plan.before, &journal.after].contains(&state)
            || journal.after != expected.after
            || journal.moves != expected.moves
            || journal.moves.len() > 128
            || journal.completed > journal.moves.len()
        {
            return Err("wow_addons_record");
        }
        if state == &journal.after
            && (journal.completed != journal.moves.len() || journal.reversing)
        {
            return Err("wow_addons_record");
        }
        Ok(())
    }
    fn recover(&self, state: &State) -> Result<()> {
        let mut journal: Journal = read_json(&self.records.join("journal.json"))?;
        self.validate_journal(&journal, state)?;
        if state == &journal.after {
            self.check_owned(state)?;
            for movement in &journal.moves {
                if let Area::Vault(_) = &movement.to {
                    matches(
                        &self.area(&movement.to, false)?,
                        &[movement.folder.clone()],
                        &movement.files,
                    )?;
                }
            }
        } else {
            if !journal.reversing {
                if let Some(movement) = journal.moves.get(journal.completed) {
                    let from = self.area(&movement.from, false)?;
                    let to = self.area(&movement.to, false)?;
                    if !exists(&from.join(&movement.folder))? {
                        matches(&to, &[movement.folder.clone()], &movement.files)?;
                        journal.completed += 1;
                    } else {
                        matches(&from, &[movement.folder.clone()], &movement.files)?;
                    }
                }
                journal.reversing = true;
                write_json(&self.records, "journal.json", &journal)?;
            }
            while journal.completed > 0 {
                let movement = &journal.moves[journal.completed - 1];
                let from = self.area(&movement.from, false)?;
                let to = self.area(&movement.to, false)?;
                if exists(&from.join(&movement.folder))? {
                    matches(&from, &[movement.folder.clone()], &movement.files)?;
                    if exists(&to.join(&movement.folder))? {
                        return Err("wow_addons_changed");
                    }
                } else {
                    self.move_folder(movement, true)?;
                }
                journal.completed -= 1;
                write_json(&self.records, "journal.json", &journal)?;
            }
            self.check_owned(&journal.plan.before)?;
        }
        fs::remove_file(self.records.join("journal.json")).map_err(|_| "wow_addons_write")
    }
}

#[path = "wow_addon_stages.rs"]
mod stages;

#[path = "wow_addon_adoption.rs"]
mod adoption;

#[cfg(all(test, windows))]
#[path = "wow_addon_store_tests.rs"]
mod tests;
