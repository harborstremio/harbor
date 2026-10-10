use super::{minecraft_instances::{self as instances, Result}, minecraft_pack::{self as pack, Parsed}};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha512};
use std::{collections::{BTreeMap, HashSet}, fs, io::Read, path::Path, sync::atomic::AtomicBool};

pub const RECORD: &str = "pack-files.json";
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct File { pub path: String, pub bytes: u64, pub sha512: String }
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest { pub schema: u8, pub archive: String, pub files: Vec<File> }
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Action { Add, Replace, Remove, Preserve, Unchanged, Conflict }
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Change { pub path: String, pub action: Action, pub before: Option<File>, pub after: Option<File>, pub current: Option<File> }
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Review { pub changes: Vec<Change>, pub bytes: u64, pub conflicts: usize, pub preserved: usize }

fn digest(value: &str) -> bool { value.len() == 128 && value.bytes().all(|v| v.is_ascii_hexdigit()) }
fn identity(value: &str) -> String { value.to_lowercase() }
pub fn relative(value: &str) -> Result<std::path::PathBuf> {
    let path = instances::relative(value)?;
    // A pack must never acquire ownership of Harbor's own mod journal/backups.
    if value.split('/').any(|part| part.to_ascii_lowercase().starts_with(".harbor-")) { return Err("instance_pack_path"); }
    Ok(path)
}
pub fn validate(manifest: &Manifest) -> Result<()> {
    if manifest.schema != 1 || !digest(&manifest.archive) || manifest.files.len() > 20_000 { return Err("instance_record"); }
    let mut paths = HashSet::new(); let mut bytes = 0_u64;
    for file in &manifest.files {
        relative(&file.path)?;
        if file.bytes > pack::MAX_FILE || !digest(&file.sha512) || !paths.insert(identity(&file.path)) { return Err("instance_record"); }
        bytes = bytes.checked_add(file.bytes).ok_or("instance_limit")?;
    }
    for file in &manifest.files {
        let mut path = Path::new(&file.path).parent();
        while let Some(parent) = path { if paths.contains(&identity(&parent.to_string_lossy().replace('\\', "/"))) { return Err("instance_pack_path"); } path = parent.parent(); }
    }
    if bytes > pack::MAX_TOTAL { return Err("instance_limit"); } Ok(())
}
pub fn hash(mut input: impl Read, bytes: u64, cancel: &AtomicBool) -> Result<String> {
    if bytes > pack::MAX_FILE { return Err("instance_limit"); }
    let mut hash = Sha512::new(); let mut buffer = [0_u8; 65_536]; let mut total = 0_u64;
    loop { pack::canceled(cancel)?; let n = input.read(&mut buffer).map_err(|_| "instance_read")?; if n == 0 { break; } total += n as u64; if total > bytes { return Err("instance_changed"); } hash.update(&buffer[..n]); }
    if total != bytes { return Err("instance_changed"); } Ok(format!("{:x}", hash.finalize()))
}
pub fn observed(root: &Path, path: &str, cancel: &AtomicBool) -> Result<Option<File>> {
    let relative = relative(path)?; let target = root.join(&relative); let mut parent = instances::directory(root)?;
    if let Some(parts) = relative.parent() { for part in parts.components() { parent.push(part); match fs::symlink_metadata(&parent) { Ok(_) => { instances::directory(&parent)?; }, Err(e) if e.kind() == std::io::ErrorKind::NotFound => break, Err(_) => return Err("instance_read") } } }
    match fs::symlink_metadata(&target) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("instance_read"), Ok(_) => (),
    }
    let input = instances::plain_file(&target, pack::MAX_FILE)?;
    let bytes = input.metadata().map_err(|_| "instance_read")?.len();
    let sha512 = hash(input, bytes, cancel)?; Ok(Some(File { path: path.into(), bytes, sha512 }))
}
pub fn manifest(parsed: &Parsed, archive: &Path, optional: &HashSet<String>, cancel: &AtomicBool) -> Result<Manifest> {
    if optional.len() > 10_000 || optional.iter().any(|path| !parsed.files.iter().any(|f| &f.path == path && f.env.get("client").is_some_and(|v| v == "optional"))) { return Err("instance_request"); }
    let mut files: Vec<_> = parsed.files.iter().filter(|f| f.env.get("client").is_none_or(|v| v != "optional") || optional.contains(&f.path))
        .map(|f| File { path: f.path.clone(), bytes: f.file_size, sha512: f.hashes["sha512"].to_ascii_lowercase() }).collect();
    let mut zip = zip::ZipArchive::new(instances::plain_file(archive, pack::MAX_ARCHIVE)?).map_err(|_| "instance_pack_format")?;
    for entry in &parsed.overrides {
        let source = zip.by_name(&entry.archive_name).map_err(|_| "instance_pack_format")?;
        if source.size() != entry.bytes { return Err("instance_changed"); }
        files.push(File { path: entry.path.clone(), bytes: entry.bytes, sha512: hash(source, entry.bytes, cancel)? });
    }
    files.sort_by_key(|f| identity(&f.path));
    let value = Manifest { schema: 1, archive: parsed.sha512.clone(), files }; validate(&value)?; Ok(value)
}
fn matches(a: &File, b: &File) -> bool { a.bytes == b.bytes && a.sha512.eq_ignore_ascii_case(&b.sha512) }
fn world(path: &str) -> bool { let path = identity(path); ["saves/", "screenshots/", "logs/", "crash-reports/"].iter().any(|p| path.starts_with(p)) || ["servers.dat", "servers.dat_old", "options.txt", "optionsof.txt", "usercache.json"].contains(&path.as_str()) }
fn code(path: &str) -> bool {
    let path = identity(path);
    ["mods/", "coremods/", "plugins/", "libraries/", "scripts/", "kubejs/"].iter().any(|p| path.starts_with(p)) || ["jar", "class", "exe", "dll", "so", "dylib", "js", "lua", "zs"].iter().any(|e| path.ends_with(&format!(".{e}")))
}
pub fn review(root: &Path, before: &Manifest, after: &Manifest, cancel: &AtomicBool) -> Result<Review> {
    instances::directory(root)?; validate(before)?; validate(after)?;
    let old: BTreeMap<_, _> = before.files.iter().map(|f| (identity(&f.path), f)).collect();
    let new: BTreeMap<_, _> = after.files.iter().map(|f| (identity(&f.path), f)).collect();
    let paths: std::collections::BTreeSet<_> = old.keys().chain(new.keys()).collect();
    let mut changes = Vec::new(); let mut bytes = 0_u64; let mut conflicts = 0; let mut preserved = 0;
    for key in paths {
        pack::canceled(cancel)?; let a = old.get(key).copied(); let b = new.get(key).copied(); let path = b.or(a).ok_or("instance_record")?.path.clone();
        let current = match a { Some(a) => observed(root, &a.path, cancel)?, None => None };
        let current = match current { Some(v) => Some(v), None => observed(root, &path, cancel)? };
        #[cfg(not(windows))]
        let case_collision = match (a, b) { (Some(a), Some(b)) if a.path != b.path && current.is_some() => observed(root, &b.path, cancel)?.is_some(), _ => false };
        #[cfg(windows)]
        let case_collision = false;
        let action = if case_collision { Action::Conflict } else { match (&current, a, b) {
            (Some(_), _, _) if world(&path) => Action::Preserve,
            (None, _, Some(_)) => Action::Add,
            (None, _, None) => Action::Unchanged,
            (Some(c), _, Some(b)) if matches(c, b) && c.path == b.path => Action::Unchanged,
            (Some(c), Some(a), Some(_)) if matches(c, a) => Action::Replace,
            (Some(c), Some(a), None) if matches(c, a) => Action::Remove,
            (Some(_), _, _) if code(&path) => Action::Conflict,
            _ => Action::Preserve,
        }};
        if matches!(action, Action::Add | Action::Replace) { bytes = bytes.checked_add(b.ok_or("instance_record")?.bytes).ok_or("instance_limit")?; }
        if action == Action::Conflict { conflicts += 1; } if action == Action::Preserve { preserved += 1; }
        changes.push(Change { path, action, before: a.cloned(), after: b.cloned(), current });
    }
    Ok(Review { changes, bytes, conflicts, preserved })
}

#[cfg(test)]
#[path = "minecraft_pack_state_tests.rs"]
mod tests;
