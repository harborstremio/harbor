use super::{minecraft_instances::{self as instances, Instance, Result, Staging}, minecraft_lifecycle_files::local_relative, minecraft_pack, minecraft_pack_state, save_files, transfer_files};
use serde::{Deserialize, Serialize};
use std::{fs, io::{Read, Write}, path::{Path, PathBuf}, sync::{atomic::AtomicBool, Mutex, OnceLock}, time::SystemTime};

pub const PREVIOUS: &str = "pack-previous.json";
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Previous { pub directory: String, pub record: String, pub created_at: u64, pub manifest: minecraft_pack_state::Manifest }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Journal { schema: u8, owner: String, id: String, staging: String, backup: String, before: String, after: String }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CopyFile { pub path: String, pub bytes: u64, modified: SystemTime }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Tree { pub files: Vec<CopyFile>, pub directories: Vec<String>, pub bytes: u64 }
fn lock() -> &'static Mutex<()> { static VALUE: OnceLock<Mutex<()>> = OnceLock::new(); VALUE.get_or_init(|| Mutex::new(())) }
fn internal(name: &str, prefix: &str) -> bool { name.strip_prefix(prefix).is_some_and(instances::identifier) }
fn journal_name(id: &str) -> String { format!(".pack-change-{id}.json") }
fn record(root: &Path, profile: &str, id: &str) -> Result<String> {
    instances::directory(root)?; let value: Instance = instances::read(&root.join(instances::RECORD))?; instances::validate(&value, profile, id)?;
    let input = instances::plain_file(&root.join(instances::RECORD), 4 * 1024 * 1024)?; let bytes = input.metadata().map_err(|_| "instance_read")?.len();
    minecraft_pack_state::hash(input, bytes, &AtomicBool::new(false))
}
pub fn fingerprint(folder: &Path, profile: &str, id: &str) -> Result<String> { record(folder, profile, id) }
fn digest(value: &str) -> bool { value.len() == 128 && value.bytes().all(|b| b.is_ascii_hexdigit()) }
fn validate(journal: &Journal, profile: &str, id: &str) -> Result<()> {
    if journal.schema != 1 || journal.id != id || !instances::identifier(id) || journal.owner != instances::owner(profile)? || !internal(&journal.staging, ".install-") || !internal(&journal.backup, ".pack-backup-") || !digest(&journal.before) || !digest(&journal.after) { return Err("instance_update_recovery"); } Ok(())
}
fn recover_locked(root: &Path, profile: &str, id: &str) -> Result<()> {
    if !instances::identifier(id) { return Err("instance_record"); }
    let journal_path = root.join(journal_name(id));
    if !journal_path.try_exists().map_err(|_| "instance_update_recovery")? { return Ok(()); }
    let journal: Journal = instances::read(&journal_path).map_err(|_| "instance_update_recovery")?; validate(&journal, profile, id)?;
    let current = root.join(id); let backup = root.join(".pack-backups").join(&journal.backup);
    let current_hash = match fs::symlink_metadata(&current) { Ok(_) => Some(record(&current, profile, id)?), Err(e) if e.kind() == std::io::ErrorKind::NotFound => None, Err(_) => return Err("instance_update_recovery") };
    if current_hash.as_deref() == Some(&journal.after) && backup.try_exists().map_err(|_| "instance_update_recovery")? {
        if record(&backup, profile, id)? != journal.before { return Err("instance_update_recovery"); }
    } else if current_hash.as_deref() == Some(&journal.before) {
        // A reviewed staging copy can be retained after an interruption. Never
        // recursively delete a directory solely because a journal names it.
        if backup.try_exists().map_err(|_| "instance_update_recovery")? { return Err("instance_update_recovery"); }
    } else if current_hash.is_none() && record(&backup, profile, id)? == journal.before {
        fs::rename(&backup, &current).map_err(|_| "instance_update_recovery")?;
    } else { return Err("instance_update_recovery"); }
    fs::remove_file(journal_path).map_err(|_| "instance_update_recovery")
}
pub fn recover(root: &Path, profile: &str, id: &str) -> Result<()> { let _held = lock().lock().map_err(|_| "instance_busy")?; recover_locked(root, profile, id) }
pub fn recover_all(root: &Path, profile: &str) -> Result<()> {
    let _held = lock().lock().map_err(|_| "instance_busy")?;
    for (index, entry) in fs::read_dir(root).map_err(|_| "instance_read")?.take(2001).enumerate() {
        if index == 2000 { return Err("instance_limit"); }
        let name = entry.map_err(|_| "instance_read")?.file_name().to_string_lossy().into_owned();
        if let Some(id) = name.strip_prefix(".pack-change-").and_then(|v| v.strip_suffix(".json")) { recover_locked(root, profile, id)?; }
    } Ok(())
}
pub fn previous(root: &Path, folder: &Path, profile: &str, id: &str) -> Result<Option<(PathBuf, Instance, minecraft_pack_state::Manifest)>> {
    if !folder.join(PREVIOUS).try_exists().map_err(|_| "instance_read")? { return Ok(None); }
    let previous: Previous = instances::read(&folder.join(PREVIOUS))?;
    if !internal(&previous.directory, ".pack-backup-") || !digest(&previous.record) { return Err("instance_update_recovery"); }
    minecraft_pack_state::validate(&previous.manifest)?;
    // Keep a missing copy's pointer so restoring it from the OS trash also restores history.
    let backups = instances::directory(&root.join(".pack-backups"))?;
    let candidate = backups.join(previous.directory);
    match candidate.symlink_metadata() { Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None), Err(_) => return Err("instance_read"), Ok(_) => () }
    let backup = instances::directory(&candidate)?;
    if backup.parent() != Some(backups.as_path()) || record(&backup, profile, id)? != previous.record { return Err("instance_update_recovery"); }
    Ok(Some((backup.clone(), instances::read(&backup.join(instances::RECORD))?, previous.manifest)))
}
pub fn commit(profile: &str, folder: &Path, mut staging: Staging, before: &str, value: &Instance, baseline: &minecraft_pack_state::Manifest) -> Result<()> {
    let _held = lock().lock().map_err(|_| "instance_busy")?;
    instances::validate(value, profile, &value.id)?; minecraft_pack_state::validate(baseline)?; let root = instances::directory(&staging.root)?;
    if folder != root.join(&value.id) || staging.path.parent() != Some(root.as_path()) || !staging.path.file_name().and_then(|v| v.to_str()).is_some_and(|v| internal(v, ".install-")) { return Err("instance_folder"); }
    recover_locked(&root, profile, &value.id)?;
    if record(folder, profile, &value.id)? != before { return Err("instance_changed"); }
    let backup = format!(".pack-backup-{}", uuid::Uuid::new_v4());
    let backups = super::minecraft_runtime::directory(&root, ".pack-backups")?;
    instances::write(&staging.path, instances::RECORD, value)?;
    instances::write(&staging.path, PREVIOUS, &Previous { directory: backup.clone(), record: before.into(), created_at: instances::now(), manifest: baseline.clone() })?;
    let after = record(&staging.path, profile, &value.id)?;
    let journal = Journal { schema: 1, owner: instances::owner(profile)?, id: value.id.clone(), staging: staging.path.file_name().unwrap().to_string_lossy().into_owned(), backup: backup.clone(), before: before.into(), after };
    validate(&journal, profile, &value.id)?; instances::write(&root, &journal_name(&value.id), &journal)?;
    if fs::rename(folder, backups.join(&backup)).is_err() { recover_locked(&root, profile, &value.id)?; return Err("instance_write"); }
    if fs::rename(&staging.path, folder).is_err() { recover_locked(&root, profile, &value.id)?; return Err("instance_write"); }
    staging.committed = true; recover_locked(&root, profile, &value.id)?; Ok(())
}
fn omitted(path: &str) -> bool { path == "session.json" || path == PREVIOUS || path == ".runtime/launch" || path.starts_with(".runtime/launch/") }
pub fn scan(root: &Path, cancel: &AtomicBool) -> Result<Tree> {
    fn visit(root: &Path, prefix: &str, tree: &mut Tree, cancel: &AtomicBool) -> Result<()> {
        minecraft_pack::canceled(cancel)?; let directory = instances::directory(&root.join(prefix))?;
        for entry in fs::read_dir(directory).map_err(|_| "instance_read")? {
            minecraft_pack::canceled(cancel)?; let entry = entry.map_err(|_| "instance_read")?; let name = entry.file_name().to_str().ok_or("instance_pack_path")?.to_owned(); local_relative(&name)?;
            let path = if prefix.is_empty() { name } else { format!("{prefix}/{name}") }; if omitted(&path) { continue; } local_relative(&path)?;
            let meta = fs::symlink_metadata(entry.path()).map_err(|_| "instance_read")?;
            if save_files::reparse(&meta) { return Err("instance_folder"); }
            if meta.is_dir() { tree.directories.push(path.clone()); visit(root, &path, tree, cancel)?; }
            else if meta.is_file() { tree.bytes = tree.bytes.checked_add(meta.len()).ok_or("instance_limit")?; tree.files.push(CopyFile { path, bytes: meta.len(), modified: meta.modified().map_err(|_| "instance_read")? }); }
            else { return Err("instance_folder"); }
            if tree.files.len() + tree.directories.len() > 200_000 || tree.bytes > 256 * 1024 * 1024 * 1024 { return Err("instance_limit"); }
        } Ok(())
    }
    let mut tree = Tree { files: vec![], directories: vec![], bytes: 0 }; visit(root, "", &mut tree, cancel)?; tree.files.sort_by(|a, b| a.path.cmp(&b.path)); tree.directories.sort(); Ok(tree)
}
pub fn copy(root: &Path, target: &Path, tree: &Tree, additional: u64, cancel: &AtomicBool, mut progress: impl FnMut(u64)) -> Result<()> {
    let required = tree.bytes.checked_add(additional).and_then(|v| v.checked_add(32 * 1024 * 1024)).ok_or("instance_limit")?;
    if transfer_files::free_bytes(target).is_none_or(|bytes| bytes < required) { return Err("instance_update_space"); }
    for directory in &tree.directories { minecraft_pack::canceled(cancel)?; let path = target.join(local_relative(directory)?); match fs::create_dir(&path) { Ok(()) => (), Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => { instances::directory(&path)?; }, Err(_) => return Err("instance_write") } }
    let mut bytes = 0_u64; let mut buffer = [0_u8; 65_536];
    for file in &tree.files {
        minecraft_pack::canceled(cancel)?; let relative = local_relative(&file.path)?; let mut source = instances::plain_file(&root.join(&relative), u64::MAX)?;
        let metadata = source.metadata().map_err(|_| "instance_read")?; if metadata.len() != file.bytes || metadata.modified().ok() != Some(file.modified) { return Err("instance_changed"); }
        let destination = target.join(relative); let parent = instances::directory(destination.parent().ok_or("instance_pack_path")?)?;
        if !parent.starts_with(instances::directory(target)?) { return Err("instance_folder"); }
        let mut destination = fs::OpenOptions::new().write(true).create_new(true).open(destination).map_err(|_| "instance_write")?; let mut copied = 0_u64;
        loop { minecraft_pack::canceled(cancel)?; let n = source.read(&mut buffer).map_err(|_| "instance_read")?; if n == 0 { break; } copied += n as u64; if copied > file.bytes { return Err("instance_changed"); } destination.write_all(&buffer[..n]).map_err(|_| "instance_write")?; bytes += n as u64; progress(bytes); }
        if copied != file.bytes || source.metadata().map_err(|_| "instance_read")?.modified().ok() != Some(file.modified) { return Err("instance_changed"); }
        destination.sync_all().map_err(|_| "instance_write")?;
    }
    if &scan(root, cancel)? != tree { return Err("instance_changed"); } Ok(())
}

#[cfg(test)]
#[path = "minecraft_pack_transaction_tests.rs"]
mod tests;
