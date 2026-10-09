use super::{check, Result};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{Instant, SystemTime},
};
use tokio_util::sync::CancellationToken;
const MAX_BYTES: u64 = 128 * 1024 * 1024;
const MAX_FILES: usize = 2048;
#[derive(Clone, PartialEq, Eq)]
struct Entry {
    bytes: u64,
    modified: SystemTime,
}
pub(super) struct Snapshot {
    pub path: PathBuf,
    pub original: String,
    pub bytes: u64,
    pub fingerprint: String,
}
impl Drop for Snapshot {
    fn drop(&mut self) {
        // This exact leaf was created here with a fresh UUID, never supplied by a caller.
        if fs::symlink_metadata(&self.path).is_ok_and(|m| m.is_dir() && !linked(&m)) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}
pub(super) fn linked(metadata: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    metadata.file_type().is_symlink()
}
fn accepted(name: &str) -> bool {
    if name == "CURRENT" {
        return true;
    }
    if let Some(number) = name.strip_prefix("MANIFEST-") {
        return !number.is_empty() && number.bytes().all(|b| b.is_ascii_digit());
    }
    name.rsplit_once('.').is_some_and(|(number, extension)| {
        !number.is_empty()
            && number.bytes().all(|b| b.is_ascii_digit())
            && matches!(extension, "log" | "ldb" | "sst")
    })
}
fn inventory(path: &Path) -> Result<BTreeMap<String, Entry>> {
    let mut files = BTreeMap::new();
    let mut total = 0u64;
    for (index, entry) in fs::read_dir(path).map_err(|_| "hydra_read")?.enumerate() {
        if index > MAX_FILES * 2 {
            return Err("hydra_limit");
        }
        let entry = entry.map_err(|_| "hydra_read")?;
        let Some(name) = entry.file_name().to_str().map(String::from) else {
            continue;
        };
        if !accepted(&name) {
            continue;
        }
        let meta = fs::symlink_metadata(entry.path()).map_err(|_| "hydra_read")?;
        if linked(&meta) || !meta.is_file() {
            return Err("hydra_links");
        }
        total = total.checked_add(meta.len()).ok_or("hydra_limit")?;
        if total > MAX_BYTES || files.len() >= MAX_FILES {
            return Err("hydra_limit");
        }
        files.insert(
            name,
            Entry {
                bytes: meta.len(),
                modified: meta.modified().map_err(|_| "hydra_read")?,
            },
        );
    }
    if !files
        .get("CURRENT")
        .is_some_and(|v| v.bytes > 0 && v.bytes <= 256)
    {
        return Err("hydra_format");
    }
    let mut current = String::new();
    File::open(path.join("CURRENT"))
        .map_err(|_| "hydra_read")?
        .take(257)
        .read_to_string(&mut current)
        .map_err(|_| "hydra_format")?;
    if current.len() > 256 {
        return Err("hydra_changed");
    }
    let manifest = current.trim_end_matches('\n');
    if !manifest.starts_with("MANIFEST-") || !accepted(manifest) || !files.contains_key(manifest) {
        return Err("hydra_format");
    }
    Ok(files)
}
fn copy_hash(
    source: &Path,
    expected: u64,
    mut output: Option<&mut File>,
    cancel: &CancellationToken,
    deadline: Instant,
) -> Result<String> {
    let mut input = File::open(source)
        .map_err(|_| "hydra_read")?
        .take(expected + 1);
    let mut hasher = Sha256::new();
    let mut buffer = [0; 64 * 1024];
    let mut count = 0u64;
    loop {
        check(cancel, deadline)?;
        let length = input.read(&mut buffer).map_err(|_| "hydra_read")?;
        if length == 0 {
            break;
        }
        count += length as u64;
        if count > expected {
            return Err("hydra_changed");
        }
        if let Some(file) = output.as_mut() {
            file.write_all(&buffer[..length])
                .map_err(|_| "hydra_space")?;
        }
        hasher.update(&buffer[..length]);
    }
    if count != expected {
        return Err("hydra_changed");
    }
    Ok(format!("{:x}", hasher.finalize()))
}
fn destination(path: &Path) -> Result<PathBuf> {
    if !path.is_absolute() {
        return Err("hydra_path");
    }
    let mut existing = path;
    let mut missing = Vec::new();
    loop {
        match fs::symlink_metadata(existing) {
            Ok(_) => break,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                missing.push(existing.file_name().ok_or("hydra_path")?);
                existing = existing.parent().ok_or("hydra_path")?;
            }
            Err(_) => return Err("hydra_space"),
        }
    }
    let mut resolved = dunce::canonicalize(existing).map_err(|_| "hydra_space")?;
    for name in missing.into_iter().rev() {
        resolved.push(name);
    }
    Ok(resolved)
}
pub(super) fn prepare(
    source: &Path,
    scratch: &Path,
    cancel: &CancellationToken,
    deadline: Instant,
) -> Result<Snapshot> {
    prepare_inner(source, scratch, cancel, deadline, || {})
}
fn prepare_inner(
    source: &Path,
    scratch: &Path,
    cancel: &CancellationToken,
    deadline: Instant,
    copied: impl FnOnce(),
) -> Result<Snapshot> {
    check(cancel, deadline)?;
    if !source.is_absolute()
        || source
            .to_str()
            .is_none_or(|v| v.len() > 8192 || v.chars().any(char::is_control))
    {
        return Err("hydra_path");
    }
    let source = dunce::canonicalize(source).map_err(|_| "hydra_read")?;
    let before = inventory(&source)?;
    let bytes: u64 = before.values().map(|v| v.bytes).sum();
    // Reject overlap before creating anything: even an empty directory would
    // mutate the user's database folder.
    let planned = destination(scratch)?;
    if planned.starts_with(&source) || source.starts_with(&planned) {
        return Err("hydra_path");
    }
    fs::create_dir_all(&planned).map_err(|_| "hydra_space")?;
    let scratch = dunce::canonicalize(scratch).map_err(|_| "hydra_space")?;
    if scratch.starts_with(&source) || source.starts_with(&scratch) {
        return Err("hydra_path");
    }
    super::cleanup::expired(&scratch);
    if super::super::transfer_files::free_bytes(&scratch)
        .is_some_and(|free| free < bytes.saturating_mul(3) + 32 * 1024 * 1024)
    {
        return Err("hydra_space");
    }
    let path = scratch.join(uuid::Uuid::new_v4().to_string());
    fs::create_dir(&path).map_err(|_| "hydra_space")?;
    let mut snapshot = Snapshot {
        path,
        original: source.to_str().ok_or("hydra_path")?.into(),
        bytes,
        fingerprint: String::new(),
    };
    super::cleanup::mark(&snapshot.path)?;
    let mut hashes = BTreeMap::new();
    for (name, metadata) in &before {
        check(cancel, deadline)?;
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(snapshot.path.join(name))
            .map_err(|_| "hydra_space")?;
        hashes.insert(
            name.clone(),
            copy_hash(
                &source.join(name),
                metadata.bytes,
                Some(&mut output),
                cancel,
                deadline,
            )?,
        );
    }
    copied();
    if inventory(&source)? != before {
        return Err("hydra_changed");
    }
    // A stable filename/size alone does not prove an in-place log was unchanged.
    for (name, metadata) in &before {
        if copy_hash(&source.join(name), metadata.bytes, None, cancel, deadline)? != hashes[name] {
            return Err("hydra_changed");
        }
    }
    if inventory(&source)? != before {
        return Err("hydra_changed");
    }
    let mut fingerprint = Sha256::new();
    for (name, hash) in hashes {
        fingerprint.update(name);
        fingerprint.update([0]);
        fingerprint.update(hash);
    }
    snapshot.fingerprint = format!("{:x}", fingerprint.finalize());
    Ok(snapshot)
}

#[cfg(test)]
#[path = "hydra_import_snapshot_tests.rs"]
mod tests;
