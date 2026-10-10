use super::save_files::{self as files, SaveFile, SaveResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[cfg(test)]
#[path = "saves_tests.rs"]
mod tests;
#[cfg(test)]
pub(super) fn interruption_checkpoint(phase: &str) {
    tests::interruption_checkpoint(phase);
}

const MANIFEST_MAX: u64 = 4 * 1024 * 1024;
const MAX_SNAPSHOTS: usize = 300;
// A companion can retain native checks with the reviewed plan. Re-run them at
// publication, since the game may have started while files were being copied.
pub type SaveGuard = Arc<dyn Fn() -> SaveResult<()> + Send + Sync>;
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSnapshot {
    pub version: u8,
    pub id: String,
    pub profile_scope: String,
    pub game_id: String,
    pub game_name: String,
    pub label: String,
    pub created_at: u64,
    pub source_path: String,
    pub kind: String,
    pub files: Vec<SaveFile>,
    #[serde(default)]
    pub directories: Vec<String>,
    pub bytes: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSnapshotInfo {
    pub id: String,
    pub game_name: String,
    pub label: String,
    pub created_at: u64,
    pub source_path: String,
    pub kind: String,
    pub file_count: usize,
    pub bytes: u64,
}
impl From<&SaveSnapshot> for SaveSnapshotInfo {
    fn from(s: &SaveSnapshot) -> Self {
        Self {
            id: s.id.clone(),
            game_name: s.game_name.clone(),
            label: s.label.clone(),
            created_at: s.created_at,
            source_path: s.source_path.clone(),
            kind: s.kind.clone(),
            file_count: s.files.len(),
            bytes: s.bytes,
        }
    }
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRequest {
    pub profile: String,
    pub game_id: String,
    pub game_name: String,
    pub source: String,
    pub vault: String,
    pub label: String,
    pub operation_id: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProgress {
    pub profile: String,
    pub operation_id: String,
    pub phase: String,
    pub files: usize,
    pub total_files: usize,
    pub bytes: u64,
    pub total_bytes: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRestoreChange {
    pub path: String,
    pub status: String,
    pub directory: bool,
    pub current_bytes: Option<u64>,
    pub snapshot_bytes: Option<u64>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRestorePlan {
    pub token: String,
    pub snapshot: SaveSnapshotInfo,
    pub target: String,
    pub changes: Vec<SaveRestoreChange>,
    pub unchanged: usize,
    pub added: usize,
    pub replaced: usize,
    pub removed: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRestoreReceipt {
    pub status: String,
    pub target: String,
    pub recovery_snapshot_id: Option<String>,
    pub recovery_folder: Option<String>,
    pub files: usize,
    pub bytes: u64,
}
struct Prepared {
    guard: SaveGuard,
    plan: SaveRestorePlan,
    snapshot: SaveSnapshot,
    root: PathBuf,
    target: PathBuf,
    current: files::SaveTree,
    target_existed: bool,
    profile: String,
    at: Instant,
}
fn plans() -> &'static Mutex<HashMap<String, Prepared>> {
    static PLANS: OnceLock<Mutex<HashMap<String, Prepared>>> = OnceLock::new();
    PLANS.get_or_init(|| Mutex::new(HashMap::new()))
}
struct Job {
    profile: String,
    id: String,
    cancel: Arc<AtomicBool>,
}
fn jobs() -> &'static Mutex<Option<Job>> {
    static JOB: OnceLock<Mutex<Option<Job>>> = OnceLock::new();
    JOB.get_or_init(|| Mutex::new(None))
}
struct Work {
    profile: String,
    id: String,
    cancel: Arc<AtomicBool>,
}
impl Drop for Work {
    fn drop(&mut self) {
        if let Ok(mut jobs) = jobs().lock() {
            if jobs
                .as_ref()
                .is_some_and(|j| j.id == self.id && j.profile == self.profile)
            {
                *jobs = None;
            }
        }
    }
}
fn start(profile: &str, id: &str) -> SaveResult<Work> {
    scope(profile)?;
    uuid::Uuid::parse_str(id).map_err(|_| "save_record")?;
    let mut job = jobs().lock().map_err(|_| "save_busy")?;
    if job.is_some() {
        return Err("save_busy");
    }
    let cancel = Arc::new(AtomicBool::new(false));
    *job = Some(Job {
        profile: profile.into(),
        id: id.into(),
        cancel: cancel.clone(),
    });
    Ok(Work {
        profile: profile.into(),
        id: id.into(),
        cancel,
    })
}
pub fn cancel(profile: String, id: String) {
    if let Ok(job) = jobs().lock() {
        if let Some(job) = job.as_ref().filter(|j| j.profile == profile && j.id == id) {
            job.cancel.store(true, Ordering::Relaxed);
        }
    }
}
fn scope(value: &str) -> SaveResult<String> {
    if value.is_empty() || value.len() > 160 || value.chars().any(char::is_control) {
        return Err("save_record");
    }
    Ok(format!("{:x}", Sha256::digest(value.as_bytes())))
}
fn valid_game(value: &str) -> SaveResult<()> {
    let Some((kind, id)) = value.split_once(':') else {
        return Err("save_record");
    };
    if kind == "local" {
        return uuid::Uuid::parse_str(id)
            .map(|_| ())
            .map_err(|_| "save_record");
    }
    if !["steam", "igdb"].contains(&kind)
        || id.is_empty()
        || id.len() > 16
        || !id.bytes().all(|b| b.is_ascii_digit())
        || id.parse::<u64>().unwrap_or(0) == 0
    {
        return Err("save_record");
    }
    Ok(())
}
fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn root(vault: &str, profile: &str, game: &str, create: bool) -> SaveResult<Option<PathBuf>> {
    valid_game(game)?;
    let base = files::plain_dir(Path::new(vault))?;
    let names = [
        "Harbor game saves".to_string(),
        scope(profile)?,
        scope(game)?,
    ];
    let mut path = base;
    for name in names {
        if create {
            path = files::child_dir(&path, &name)?;
        } else {
            let child = path.join(&name);
            match fs::symlink_metadata(&child) {
                Ok(_) => {
                    let next = files::plain_dir(&child)?;
                    if next.parent() != Some(path.as_path()) {
                        return Err("save_folder");
                    }
                    path = next;
                }
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
                Err(_) => return Err("save_read"),
            }
        }
    }
    Ok(Some(path))
}
fn read_snapshot(root: &Path, id: &str, profile: &str, game: &str) -> SaveResult<SaveSnapshot> {
    uuid::Uuid::parse_str(id).map_err(|_| "save_record")?;
    let folder = files::plain_dir(&root.join(id))?;
    if folder.parent() != Some(root) {
        return Err("save_record");
    }
    let path = folder.join("manifest.json");
    let meta = fs::symlink_metadata(&path).map_err(|_| "save_read")?;
    if files::reparse(&meta) || !meta.is_file() || meta.len() > MANIFEST_MAX {
        return Err("save_record");
    }
    let mut bytes = Vec::new();
    File::open(path)
        .map_err(|_| "save_read")?
        .take(MANIFEST_MAX + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "save_read")?;
    if bytes.len() as u64 > MANIFEST_MAX {
        return Err("save_record");
    }
    let s: SaveSnapshot = serde_json::from_slice(&bytes).map_err(|_| "save_record")?;
    if s.version != 1
        || s.id != id
        || s.profile_scope != scope(profile)?
        || s.game_id != game
        || s.game_name.chars().count() > 500
        || s.label.chars().count() > 240
        || s.files.len() > files::MAX_FILES
        || s.directories.len() > 15000
        || s.bytes > files::MAX_BYTES
        || !["manual", "beforeRestore"].contains(&s.kind.as_str())
    {
        return Err("save_record");
    }
    let mut total = 0u64;
    let mut names = std::collections::HashSet::new();
    for f in &s.files {
        files::relative(&f.path)?;
        if !names.insert(&f.path)
            || f.sha256.len() != 64
            || !f.sha256.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err("save_record");
        }
        total = total.checked_add(f.bytes).ok_or("save_record")?;
    }
    if total != s.bytes {
        return Err("save_record");
    }
    for dir in &s.directories {
        files::relative(dir)?;
        if !names.insert(dir) {
            return Err("save_record");
        }
    }
    Ok(s)
}
fn snapshot_tree(snapshot: &SaveSnapshot) -> files::SaveTree {
    files::SaveTree {
        files: snapshot.files.clone(),
        directories: snapshot.directories.clone(),
    }
}
fn capacity(root: &Path) -> SaveResult<()> {
    let mut count = 0;
    for (index, entry) in fs::read_dir(root).map_err(|_| "save_read")?.enumerate() {
        if index >= 1000 {
            return Err("save_limit");
        }
        let entry = entry.map_err(|_| "save_read")?;
        if uuid::Uuid::parse_str(&entry.file_name().to_string_lossy()).is_ok() {
            count += 1;
        }
        if count >= MAX_SNAPSHOTS {
            return Err("save_limit");
        }
    }
    Ok(())
}
pub fn list(vault: String, profile: String, game: String) -> SaveResult<Vec<SaveSnapshotInfo>> {
    let Some(root) = root(&vault, &profile, &game, false)? else {
        return Ok(Vec::new());
    };
    let mut result = Vec::new();
    let mut entries = 0;
    for entry in fs::read_dir(&root).map_err(|_| "save_read")? {
        entries += 1;
        if entries > 1000 {
            return Err("save_limit");
        }
        let entry = entry.map_err(|_| "save_read")?;
        let id = entry.file_name().to_string_lossy().into_owned();
        if uuid::Uuid::parse_str(&id).is_err() {
            continue;
        }
        let record = read_snapshot(&root, &id, &profile, &game)?;
        result.push(SaveSnapshotInfo::from(&record));
        if result.len() > MAX_SNAPSHOTS {
            return Err("save_limit");
        }
    }
    result.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(result)
}
fn announce(
    work: &Work,
    phase: &str,
    done: usize,
    total: usize,
    bytes: u64,
    total_bytes: u64,
    emit: &impl Fn(SaveProgress),
) {
    emit(SaveProgress {
        profile: work.profile.clone(),
        operation_id: work.id.clone(),
        phase: phase.into(),
        files: done,
        total_files: total,
        bytes,
        total_bytes,
    });
}
pub(super) fn move_new(from: &Path, to: &Path) -> SaveResult<()> {
    if fs::symlink_metadata(to).is_ok() {
        return Err("save_changed");
    }
    #[cfg(windows)]
    {
        super::transfer_files::publish(from, to).map_err(|_| "save_write")
    }
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::ffi::OsStrExt;
        let from = std::ffi::CString::new(from.as_os_str().as_bytes()).map_err(|_| "save_name")?;
        let to = std::ffi::CString::new(to.as_os_str().as_bytes()).map_err(|_| "save_name")?;
        if unsafe {
            libc::renameat2(
                libc::AT_FDCWD,
                from.as_ptr(),
                libc::AT_FDCWD,
                to.as_ptr(),
                libc::RENAME_NOREPLACE,
            )
        } != 0
        {
            return Err("save_write");
        }
        Ok(())
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        fs::rename(from, to).map_err(|_| "save_write")
    }
}
fn snapshot_at(
    args: &SaveRequest,
    source: &Path,
    root: &Path,
    kind: &str,
    work: &Work,
    emit: &impl Fn(SaveProgress),
    guard: &SaveGuard,
) -> SaveResult<SaveSnapshot> {
    guard()?;
    capacity(root)?;
    announce(work, "scanning", 0, 0, 0, 0, emit);
    let tree = files::inventory(source, &work.cancel)?;
    if tree.files.is_empty() && kind == "manual" {
        return Err("save_empty");
    }
    let bytes = tree.files.iter().map(|f| f.bytes).sum();
    files::space(root, bytes)?;
    let id = uuid::Uuid::new_v4().to_string();
    let staging = root.join(format!(".harbor-save-stage-{id}"));
    fs::create_dir(&staging).map_err(|_| "save_write")?;
    let result = (|| {
        let entries = &tree.files;
        let content = files::child_dir(&staging, "files")?;
        files::copy_directories(&content, &tree.directories, &work.cancel)?;
        files::copy_files(
            source,
            &content,
            &entries,
            &work.cancel,
            &|done, bytes_done| {
                announce(
                    work,
                    "copying",
                    done,
                    entries.len(),
                    bytes_done,
                    bytes,
                    emit,
                )
            },
        )?;
        announce(
            work,
            "verifying",
            entries.len(),
            entries.len(),
            bytes,
            bytes,
            emit,
        );
        if files::inventory(source, &work.cancel)? != tree
            || files::inventory(&content, &work.cancel)? != tree
        {
            return Err("save_changed");
        }
        let record = SaveSnapshot {
            version: 1,
            id: id.clone(),
            profile_scope: scope(&args.profile)?,
            game_id: args.game_id.clone(),
            game_name: args.game_name.trim().chars().take(500).collect(),
            label: args.label.trim().chars().take(240).collect(),
            created_at: timestamp(),
            source_path: source.to_string_lossy().into_owned(),
            kind: kind.into(),
            files: tree.files,
            directories: tree.directories,
            bytes,
        };
        let data = serde_json::to_vec(&record).map_err(|_| "save_record")?;
        if data.len() as u64 > MANIFEST_MAX {
            return Err("save_limit");
        }
        let mut manifest = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(staging.join("manifest.json"))
            .map_err(|_| "save_write")?;
        manifest
            .write_all(&data)
            .and_then(|_| manifest.sync_all())
            .map_err(|_| "save_write")?;
        drop(manifest);
        files::canceled(&work.cancel)?;
        guard()?;
        move_new(&staging, &root.join(&id))?;
        Ok(record)
    })();
    if result.is_err() {
        files::cleanup_owned(&staging, root);
    }
    result
}
pub fn snapshot(args: SaveRequest, emit: impl Fn(SaveProgress)) -> SaveResult<SaveSnapshotInfo> {
    snapshot_guarded(args, Arc::new(|| Ok(())), emit)
}
pub fn snapshot_guarded(
    args: SaveRequest,
    guard: SaveGuard,
    emit: impl Fn(SaveProgress),
) -> SaveResult<SaveSnapshotInfo> {
    guard()?;
    let work = start(&args.profile, &args.operation_id)?;
    let source = files::plain_dir(Path::new(&args.source))?;
    let _source_lock = super::save_restore::Transaction::acquire(&source)?;
    if super::save_restore::pending(&source)? {
        return Err("save_recovery");
    }
    let vault = files::plain_dir(Path::new(&args.vault))?;
    if source.starts_with(&vault) || vault.starts_with(&source) {
        return Err("save_nested");
    }
    if list(
        args.vault.clone(),
        args.profile.clone(),
        args.game_id.clone(),
    )?
    .len()
        >= MAX_SNAPSHOTS
    {
        return Err("save_limit");
    }
    let root = root(&args.vault, &args.profile, &args.game_id, true)?.ok_or("save_folder")?;
    let record = snapshot_at(&args, &source, &root, "manual", &work, &emit, &guard)?;
    Ok(SaveSnapshotInfo::from(&record))
}
fn target_path(value: &str) -> SaveResult<(PathBuf, bool)> {
    let path = Path::new(value);
    if !path.is_absolute() {
        return Err("save_folder");
    }
    match fs::symlink_metadata(path) {
        Ok(_) => Ok((files::plain_dir(path)?, true)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            let parent = files::plain_dir(path.parent().ok_or("save_folder")?)?;
            let name = path.file_name().ok_or("save_folder")?;
            Ok((parent.join(name), false))
        }
        Err(_) => Err("save_folder"),
    }
}
pub fn prepare_restore(
    vault: String,
    profile: String,
    game: String,
    snapshot_id: String,
    target: String,
    operation_id: String,
    emit: impl Fn(SaveProgress),
) -> SaveResult<SaveRestorePlan> {
    prepare_restore_guarded(
        vault,
        profile,
        game,
        snapshot_id,
        target,
        operation_id,
        Arc::new(|| Ok(())),
        emit,
    )
}
pub fn prepare_restore_guarded(
    vault: String,
    profile: String,
    game: String,
    snapshot_id: String,
    target: String,
    operation_id: String,
    guard: SaveGuard,
    emit: impl Fn(SaveProgress),
) -> SaveResult<SaveRestorePlan> {
    guard()?;
    let work = start(&profile, &operation_id)?;
    let root = root(&vault, &profile, &game, false)?.ok_or("save_folder")?;
    let (snapshot_target, existed) = target_path(&target)?;
    if super::save_restore::pending(&snapshot_target)? {
        return Err("save_recovery");
    }
    let vault_path = files::plain_dir(Path::new(&vault))?;
    if snapshot_target.starts_with(&vault_path) || vault_path.starts_with(&snapshot_target) {
        return Err("save_nested");
    }
    let snapshot = read_snapshot(&root, &snapshot_id, &profile, &game)?;
    announce(
        &work,
        "verifying",
        0,
        snapshot.files.len(),
        0,
        snapshot.bytes,
        &emit,
    );
    if files::inventory(&root.join(&snapshot_id).join("files"), &work.cancel)?
        != snapshot_tree(&snapshot)
    {
        return Err("save_integrity");
    }
    let current = if existed {
        files::inventory(&snapshot_target, &work.cancel)?
    } else {
        files::SaveTree {
            files: Vec::new(),
            directories: Vec::new(),
        }
    };
    let mut changes = Vec::new();
    let (mut unchanged, mut added, mut replaced, mut removed) = (0, 0, 0, 0);
    for file in &snapshot.files {
        let old = current.files.iter().find(|v| v.path == file.path);
        let status = match old {
            Some(old) if old.sha256 == file.sha256 => {
                unchanged += 1;
                continue;
            }
            Some(_) => {
                replaced += 1;
                "replace"
            }
            None => {
                added += 1;
                "add"
            }
        };
        changes.push(SaveRestoreChange {
            path: file.path.clone(),
            status: status.into(),
            directory: false,
            current_bytes: old.map(|f| f.bytes),
            snapshot_bytes: Some(file.bytes),
        });
    }
    for old in &current.files {
        if !snapshot.files.iter().any(|f| f.path == old.path) {
            removed += 1;
            changes.push(SaveRestoreChange {
                path: old.path.clone(),
                status: "remove".into(),
                directory: false,
                current_bytes: Some(old.bytes),
                snapshot_bytes: None,
            });
        }
    }
    for (directories, other, status) in [
        (&snapshot.directories, &current.directories, "add"),
        (&current.directories, &snapshot.directories, "remove"),
    ] {
        for path in directories.iter().filter(|path| !other.contains(path)) {
            changes.push(SaveRestoreChange {
                path: path.clone(),
                status: status.into(),
                directory: true,
                current_bytes: None,
                snapshot_bytes: None,
            });
        }
    }
    let token = uuid::Uuid::new_v4().to_string();
    let plan = SaveRestorePlan {
        token: token.clone(),
        snapshot: SaveSnapshotInfo::from(&snapshot),
        target: snapshot_target.to_string_lossy().into_owned(),
        changes,
        unchanged,
        added,
        replaced,
        removed,
    };
    let mut plans = plans().lock().map_err(|_| "save_busy")?;
    plans.retain(|_, p| p.at.elapsed() < Duration::from_secs(600));
    if plans.len() >= 8 {
        plans.clear();
    }
    plans.insert(
        token,
        Prepared {
            guard,
            plan: plan.clone(),
            snapshot,
            root,
            target: snapshot_target,
            current,
            target_existed: existed,
            profile,
            at: Instant::now(),
        },
    );
    Ok(plan)
}
pub fn restore(
    profile: String,
    token: String,
    operation_id: String,
    emit: impl Fn(SaveProgress),
) -> SaveResult<SaveRestoreReceipt> {
    let work = start(&profile, &operation_id)?;
    let prepared = {
        let mut plans = plans().lock().map_err(|_| "save_busy")?;
        if plans.get(&token).is_none_or(|p| p.profile != profile) {
            return Err("save_expired");
        }
        plans.remove(&token).ok_or("save_expired")?
    };
    if prepared.at.elapsed() > Duration::from_secs(600) {
        return Err("save_expired");
    }
    (prepared.guard)()?;
    let (target, existed) = target_path(&prepared.plan.target)?;
    let transaction = super::save_restore::Transaction::acquire(&target)?;
    if super::save_restore::pending(&target)? {
        return Err("save_recovery");
    }
    if target != prepared.target || existed != prepared.target_existed {
        return Err("save_changed");
    }
    let current = if existed {
        files::inventory(&target, &work.cancel)?
    } else {
        files::SaveTree {
            files: Vec::new(),
            directories: Vec::new(),
        }
    };
    if current != prepared.current {
        return Err("save_changed");
    }
    let source = prepared.root.join(&prepared.snapshot.id).join("files");
    if files::inventory(&source, &work.cancel)? != snapshot_tree(&prepared.snapshot) {
        return Err("save_integrity");
    }
    let parent = files::plain_dir(target.parent().ok_or("save_folder")?)?;
    files::space(&parent, prepared.snapshot.bytes)?;
    let stage = parent.join(format!(".harbor-save-stage-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&stage).map_err(|_| "save_write")?;
    let result = (|| {
        files::copy_directories(&stage, &prepared.snapshot.directories, &work.cancel)?;
        files::copy_files(
            &source,
            &stage,
            &prepared.snapshot.files,
            &work.cancel,
            &|done, bytes| {
                announce(
                    &work,
                    "restoring",
                    done,
                    prepared.snapshot.files.len(),
                    bytes,
                    prepared.snapshot.bytes,
                    &emit,
                )
            },
        )?;
        if files::inventory(&stage, &work.cancel)? != snapshot_tree(&prepared.snapshot) {
            return Err("save_integrity");
        }
        let recovery_id = if existed {
            let args = SaveRequest {
                profile: profile.clone(),
                game_id: prepared.snapshot.game_id.clone(),
                game_name: prepared.snapshot.game_name.clone(),
                source: prepared.plan.target.clone(),
                vault: String::new(),
                label: String::new(),
                operation_id: operation_id.clone(),
            };
            Some(
                snapshot_at(
                    &args,
                    &target,
                    &prepared.root,
                    "beforeRestore",
                    &work,
                    &emit,
                    &prepared.guard,
                )?
                .id,
            )
        } else {
            None
        };
        if existed && files::inventory(&target, &work.cancel)? != prepared.current {
            return Err("save_changed");
        }
        files::canceled(&work.cancel)?;
        (prepared.guard)()?;
        let recovery =
            existed.then(|| parent.join(format!(".harbor-save-recovery-{}", uuid::Uuid::new_v4())));
        transaction.publish(&super::save_restore::Record {
            version: 1,
            target: target.to_string_lossy().into_owned(),
            profile_scope: scope(&profile)?,
            game: prepared.snapshot.game_id.clone(),
            stage: stage
                .file_name()
                .and_then(|v| v.to_str())
                .ok_or("save_record")?
                .into(),
            recovery: recovery
                .as_ref()
                .map(|p| {
                    p.file_name()
                        .and_then(|v| v.to_str())
                        .ok_or("save_record")
                        .map(String::from)
                })
                .transpose()?,
            recovery_snapshot: recovery_id.clone(),
            before: existed.then(|| prepared.current.clone()),
            after: snapshot_tree(&prepared.snapshot),
        })?;
        #[cfg(test)]
        interruption_checkpoint("journal");
        (prepared.guard)()?;
        if let Some(path) = &recovery {
            move_new(&target, path)?;
        }
        #[cfg(test)]
        interruption_checkpoint("oldMoved");
        // Once the directory handoff begins, finish or roll back even if Cancel arrives.
        let status = if move_new(&stage, &target).is_ok() {
            "restored"
        } else if let Some(old) = &recovery {
            if move_new(old, &target).is_ok() {
                "rolledBack"
            } else {
                "recoveryNeeded"
            }
        } else {
            "notRestored"
        };
        #[cfg(test)]
        interruption_checkpoint("newMoved");
        if status != "recoveryNeeded" {
            transaction.clear()?;
        }
        Ok(SaveRestoreReceipt {
            status: status.into(),
            target: target.to_string_lossy().into_owned(),
            recovery_snapshot_id: recovery_id,
            recovery_folder: recovery
                .filter(|p| p.exists())
                .map(|p| p.to_string_lossy().into_owned()),
            files: prepared.snapshot.files.len(),
            bytes: prepared.snapshot.bytes,
        })
    })();
    // A durable journal may still refer to the staged copy after interruption.
    if !super::save_restore::pending(&target).unwrap_or(true) {
        files::cleanup_owned(&stage, &parent);
    }
    result
}

pub fn recover_pending(
    profile: String,
    game: String,
    target: String,
    operation_id: String,
    guard: SaveGuard,
    emit: impl Fn(SaveProgress),
) -> SaveResult<SaveRestoreReceipt> {
    let work = start(&profile, &operation_id)?;
    valid_game(&game)?;
    guard()?;
    let transaction = super::save_restore::Transaction::acquire(Path::new(&target))?;
    let record = transaction.read(&scope(&profile)?, &game)?;
    announce(&work, "verifying", 0, 0, 0, 0, &emit);
    transaction.recover(&record, &work.cancel, &guard)
}
pub fn discard(profile: String, token: String) {
    if let Ok(mut plans) = plans().lock() {
        if plans.get(&token).is_some_and(|p| p.profile == profile) {
            plans.remove(&token);
        }
    }
}
