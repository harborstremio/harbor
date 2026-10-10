use super::{minecraft_instances::{self as instances, Instance, Result}, minecraft_lifecycle_files as files, minecraft_pack, minecraft_pack_transaction as transaction, minecraft_runtime as runtime, minecraft_launch_process};
use serde::Serialize;
use std::{collections::HashMap, fs, path::{Path, PathBuf}, sync::{atomic::AtomicBool, Mutex, OnceLock}, time::{Duration, Instant}};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Backup { pub key: String, pub name: String, pub version: String, pub game_version: String, pub loader: String, pub latest: bool, pub saved_at: Option<u64> }
#[derive(Serialize)]
pub struct State { pub backups: Vec<Backup>, pub unreadable: usize }
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan { pub token: String, pub name: String, pub version: String, pub files: usize, pub bytes: u64, pub worlds: usize, pub backup: bool, pub latest: bool, pub recovery_copies: usize, pub unreadable: usize }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Removed { pub instance_removed: bool }
struct CopyTarget { path: PathBuf, fingerprint: String, tree: files::Tree }
struct Prepared { profile: String, library: PathBuf, active: PathBuf, target: PathBuf, instance: Instance, fingerprint: String, target_fingerprint: String, tree: files::Tree, copies: Vec<CopyTarget>, plan: Plan, created: Instant }
fn plans() -> &'static Mutex<HashMap<String, Prepared>> { static VALUE: OnceLock<Mutex<HashMap<String, Prepared>>> = OnceLock::new(); VALUE.get_or_init(|| Mutex::new(HashMap::new())) }
pub fn discard(profile: &str, token: &str) { if let Ok(mut held) = plans().lock() { if held.get(token).is_some_and(|p| p.profile == profile) { held.remove(token); } } }
fn take(profile: &str, token: &str) -> Result<Prepared> {
    let mut held = plans().lock().map_err(|_| "instance_busy")?;
    if !held.get(token).is_some_and(|p| p.profile == profile) { return Err("instance_plan"); }
    let value = held.remove(token).ok_or("instance_plan")?;
    if value.created.elapsed() > Duration::from_secs(900) { return Err("instance_plan"); } Ok(value)
}
fn key(value: &str) -> bool { value.strip_prefix(".pack-backup-").is_some_and(instances::identifier) }
fn previous(folder: &Path) -> Option<transaction::Previous> { instances::read(&folder.join(transaction::PREVIOUS)).ok() }
fn idle(folder: &Path) -> Result<()> { minecraft_launch_process::idle(folder).map_err(|e| if e == "launch_running" { "instance_update_running" } else { "instance_update_recovery" }) }
fn target(root: &Path, profile: &str, id: &str, name: &str) -> Result<(PathBuf, Instance)> {
    if !key(name) { return Err("instance_record"); }
    let backups = instances::directory(&root.join(".pack-backups"))?;
    if backups.parent() != Some(root) { return Err("instance_folder"); }
    let folder = instances::directory(&backups.join(name))?;
    if folder.parent() != Some(backups.as_path()) { return Err("instance_folder"); }
    let value: Instance = instances::read(&folder.join(instances::RECORD))?;
    instances::validate(&value, profile, id)?; instances::directory(&folder.join("game"))?; Ok((folder, value))
}
fn listing(profile: &str, path: &str, id: &str) -> Result<State> {
    let root = instances::library(profile, path)?; let (folder, _) = instances::load(&root, profile, id)?;
    let mut state = State { backups: vec![], unreadable: 0 };
    let backup_root = root.join(".pack-backups"); if !backup_root.try_exists().map_err(|_| "instance_read")? { return Ok(state); }
    instances::directory(&backup_root)?;
    let current = previous(&folder); let mut dates = HashMap::new();
    if let Some(p) = &current { dates.insert(p.directory.clone(), (p.created_at, p.record.clone())); }
    let mut records = vec![];
    for (n, entry) in fs::read_dir(&backup_root).map_err(|_| "instance_read")?.take(2001).enumerate() {
        if n == 2000 { return Err("instance_limit"); }
        let name = entry.map_err(|_| "instance_read")?.file_name().to_string_lossy().into_owned();
        if !key(&name) { continue; }
        // Only expose this instance's copies; another profile/UUID cannot be selected.
        let record: Instance = match instances::read(&backup_root.join(&name).join(instances::RECORD)) { Ok(value) => value, Err(_) => { state.unreadable += 1; continue; } };
        if record.id != id { continue; }
        let (backup, value) = match target(&root, profile, id, &name) { Ok(value) => value, Err(_) => { state.unreadable += 1; continue; } };
        let fingerprint = transaction::fingerprint(&backup, profile, id)?;
        if let Some(p) = previous(&backup) { dates.insert(p.directory, (p.created_at, p.record)); }
        records.push((name, value, fingerprint));
    }
    for (name, value, hash) in records {
        let saved = dates.get(&name).filter(|(date, record)| *date <= instances::now() + 60 && record == &hash).map(|(date, _)| *date);
        state.backups.push(Backup { latest: current.as_ref().is_some_and(|p| p.directory == name && p.record == hash), key: name, name: value.name, version: value.pack.map(|p| p.version).unwrap_or_default(), game_version: value.game_version, loader: value.loader, saved_at: saved });
    }
    state.backups.sort_by(|a, b| b.latest.cmp(&a.latest).then(b.saved_at.cmp(&a.saved_at)).then(a.key.cmp(&b.key))); Ok(state)
}
pub async fn state(profile: String, path: String, id: String) -> Result<State> {
    tokio::task::spawn_blocking(move || listing(&profile, &path, &id)).await.map_err(|_| "instance_read")?
}
fn prepare(profile: &str, path: &str, id: &str, backup: Option<&str>, cancel: &AtomicBool) -> Result<Prepared> {
    let library = instances::library(profile, path)?; let (active, instance) = instances::load(&library, profile, id)?; idle(&active)?;
    let (target, value) = if let Some(key) = backup { target(&library, profile, id, key)? } else { (active.clone(), instance.clone()) };
    let fingerprint = transaction::fingerprint(&active, profile, id)?; let target_fingerprint = transaction::fingerprint(&target, profile, id)?;
    let tree = files::scan(&target, cancel)?;
    let worlds = tree.directories.iter().filter(|p| p.starts_with("game/saves/") && p.split('/').count() == 3).count();
    let latest = backup.is_some_and(|key| previous(&active).is_some_and(|p| p.directory == key && p.record == target_fingerprint));
    let mut copies = vec![]; let mut unreadable = 0;
    if backup.is_none() {
        let all = listing(profile, path, id)?; unreadable = all.unreadable;
        // Unreadable copies are retained; never infer ownership from a directory name.
        for copy in all.backups { let (path, _) = self::target(&library, profile, id, &copy.key)?; copies.push(CopyTarget { fingerprint: transaction::fingerprint(&path, profile, id)?, tree: files::scan(&path, cancel)?, path }); }
    }
    let plan = Plan { token: uuid::Uuid::new_v4().to_string(), name: value.name.clone(), version: value.pack.as_ref().map(|p| p.version.clone()).unwrap_or_default(), files: tree.files.len() + copies.iter().map(|c| c.tree.files.len()).sum::<usize>(), bytes: tree.bytes + copies.iter().map(|c| c.tree.bytes).sum::<u64>(), worlds, backup: backup.is_some(), latest, recovery_copies: copies.len(), unreadable };
    Ok(Prepared { profile: profile.into(), library, active, target, instance, fingerprint, target_fingerprint, tree, copies, plan, created: Instant::now() })
}
pub async fn review(profile: String, path: String, id: String, backup: Option<String>, operation: String) -> Result<Plan> {
    let work = runtime::start(&profile, &operation)?;
    let prepared = tokio::task::spawn_blocking(move || { let _work = work; prepare(&profile, &path, &id, backup.as_deref(), &_work.cancellation()) }).await.map_err(|_| "instance_read")??;
    let plan = prepared.plan.clone(); let mut held = plans().lock().map_err(|_| "instance_busy")?; held.retain(|_, p| p.created.elapsed() < Duration::from_secs(900));
    if held.len() >= 4 { return Err("instance_busy"); } held.insert(plan.token.clone(), prepared); Ok(plan)
}
fn remove(prepared: Prepared, cancel: &AtomicBool, mut recycle: impl FnMut(&Path) -> Result<()>) -> Result<Removed> {
    idle(&prepared.active)?; minecraft_pack::canceled(cancel)?;
    let allowed = if prepared.plan.backup { instances::directory(&prepared.library.join(".pack-backups"))? } else { instances::directory(&prepared.library)? };
    let target = instances::directory(&prepared.target)?;
    if target.parent() != Some(allowed.as_path()) || !target.file_name().and_then(|v| v.to_str()).is_some_and(|v| if prepared.plan.backup { key(v) } else { v == prepared.instance.id }) { return Err("instance_folder"); }
    if transaction::fingerprint(&prepared.active, &prepared.profile, &prepared.instance.id)? != prepared.fingerprint
        || transaction::fingerprint(&target, &prepared.profile, &prepared.instance.id)? != prepared.target_fingerprint
        || files::scan(&target, cancel)? != prepared.tree { return Err("instance_changed"); }
    for copy in &prepared.copies {
        let copies = instances::directory(&prepared.library.join(".pack-backups"))?;
        let path = instances::directory(&copy.path)?;
        if path.parent() != Some(copies.as_path()) || !path.file_name().and_then(|v| v.to_str()).is_some_and(key) { return Err("instance_folder"); }
        if transaction::fingerprint(&path, &prepared.profile, &prepared.instance.id)? != copy.fingerprint || files::scan(&path, cancel)? != copy.tree { return Err("instance_changed"); }
    }
    minecraft_pack::canceled(cancel)?;
    // Move recovery copies first so a partial OS failure leaves the active instance usable.
    for copy in &prepared.copies { recycle(&copy.path)?; if copy.path.try_exists().map_err(|_| "instance_read")? { return Err("instance_trash"); } }
    // The OS moves a single validated folder. Never fall back to permanent deletion.
    recycle(&target)?;
    if target.try_exists().map_err(|_| "instance_read")? { return Err("instance_trash"); }
    // Keep the restore pointer: undoing the OS trash operation restores its validity.
    Ok(Removed { instance_removed: !prepared.plan.backup })
}
pub async fn apply(profile: String, token: String, operation: String) -> Result<Removed> {
    let work = runtime::start(&profile, &operation)?; let prepared = take(&profile, &token)?;
    tokio::task::spawn_blocking(move || {
        let _work = work;
        remove(prepared, &_work.cancellation(), super::minecraft_recycle::recycle)
    }).await.map_err(|_| "instance_write")?
}

#[cfg(test)]
#[path = "minecraft_instance_storage_tests.rs"]
mod tests;
