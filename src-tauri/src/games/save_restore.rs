//! An immutable journal survives interruption between restore directory moves.
//! Recovery never replaces an existing target; hashes establish each endpoint.
use super::save_files::{self as files, SaveResult, SaveTree};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{atomic::AtomicBool, Arc},
};

const MAX_RECORD: u64 = 12 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub version: u8,
    pub target: String,
    pub profile_scope: String,
    pub game: String,
    pub stage: String,
    pub recovery: Option<String>,
    pub recovery_snapshot: Option<String>,
    pub before: Option<SaveTree>,
    pub after: SaveTree,
}
pub struct Transaction {
    target: PathBuf,
    journal: PathBuf,
    _lock: File,
}

fn target_path(target: &Path) -> SaveResult<PathBuf> {
    if !target.is_absolute() {
        return Err("save_folder");
    }
    let parent = files::plain_dir(target.parent().ok_or("save_folder")?)?;
    let name = target
        .file_name()
        .and_then(|v| v.to_str())
        .ok_or("save_name")?;
    if name.starts_with(".harbor-") || name.len() > 240 || name.contains(['/', '\\', ':']) {
        return Err("save_folder");
    }
    Ok(parent.join(name))
}
fn identity(target: &Path) -> SaveResult<String> {
    let name = target
        .file_name()
        .and_then(|v| v.to_str())
        .ok_or("save_folder")?;
    #[cfg(windows)]
    let name = name.to_lowercase();
    Ok(format!("{:x}", Sha256::digest(name.as_bytes())))
}
pub fn journal_path(target: &Path) -> SaveResult<PathBuf> {
    let target = target_path(target)?;
    Ok(target
        .parent()
        .ok_or("save_folder")?
        .join(format!(".harbor-save-restore-{}.json", identity(&target)?)))
}
pub fn pending(target: &Path) -> SaveResult<bool> {
    match fs::symlink_metadata(journal_path(target)?) {
        Ok(meta) if meta.is_file() && !files::reparse(&meta) => Ok(true),
        Ok(_) => Err("save_record"),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err("save_read"),
    }
}
fn valid_tree(tree: &SaveTree) -> SaveResult<()> {
    if tree.files.len() > files::MAX_FILES || tree.directories.len() > 15000 {
        return Err("save_record");
    }
    let mut names = HashSet::new();
    let mut bytes = 0u64;
    for file in &tree.files {
        files::relative(&file.path)?;
        if !names.insert(file.path.as_str())
            || file.sha256.len() != 64
            || !file.sha256.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err("save_record");
        }
        bytes = bytes.checked_add(file.bytes).ok_or("save_record")?;
    }
    for dir in &tree.directories {
        files::relative(dir)?;
        if !names.insert(dir) {
            return Err("save_record");
        }
    }
    if bytes > files::MAX_BYTES {
        return Err("save_record");
    }
    Ok(())
}
fn owned_name(name: &str, prefix: &str) -> SaveResult<()> {
    let id = name.strip_prefix(prefix).ok_or("save_record")?;
    uuid::Uuid::parse_str(id).map_err(|_| "save_record")?;
    if id.len() != 36 || name.contains(['/', '\\', ':']) {
        return Err("save_record");
    }
    Ok(())
}
fn same_target(a: &Path, b: &Path) -> bool {
    #[cfg(windows)]
    {
        a.to_string_lossy().to_lowercase() == b.to_string_lossy().to_lowercase()
    }
    #[cfg(not(windows))]
    {
        a == b
    }
}
fn tree(path: &Path, cancel: &Arc<AtomicBool>) -> SaveResult<Option<SaveTree>> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(Some(files::inventory(path, cancel)?)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("save_read"),
    }
}
impl Transaction {
    pub fn acquire(target: &Path) -> SaveResult<Self> {
        let target = target_path(target)?;
        let parent = target.parent().ok_or("save_folder")?;
        let lock = parent.join(format!(".harbor-save-lock-{}", identity(&target)?));
        if let Ok(meta) = fs::symlink_metadata(&lock) {
            if files::reparse(&meta) || !meta.is_file() {
                return Err("save_links");
            }
        }
        let mut options = OpenOptions::new();
        options.read(true).write(true).create(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(0);
        }
        let lock = options.open(&lock).map_err(|_| "save_busy")?;
        #[cfg(unix)]
        {
            use std::os::fd::AsRawFd;
            if unsafe { libc::flock(lock.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
                return Err("save_busy");
            }
        }
        Ok(Self {
            journal: journal_path(&target)?,
            target,
            _lock: lock,
        })
    }
    fn validate(&self, record: &Record) -> SaveResult<()> {
        if record.version != 1
            || !same_target(Path::new(&record.target), &self.target)
            || record.profile_scope.len() != 64
            || !record.profile_scope.bytes().all(|b| b.is_ascii_hexdigit())
            || record.game.len() > 100
            || record.recovery.is_some() != record.before.is_some()
            || record.recovery_snapshot.is_some() != record.before.is_some()
        {
            return Err("save_record");
        }
        owned_name(&record.stage, ".harbor-save-stage-")?;
        if let Some(name) = &record.recovery {
            owned_name(name, ".harbor-save-recovery-")?;
        }
        if let Some(id) = &record.recovery_snapshot {
            uuid::Uuid::parse_str(id).map_err(|_| "save_record")?;
        }
        if let Some(before) = &record.before {
            valid_tree(before)?;
        }
        valid_tree(&record.after)
    }
    pub fn publish(&self, record: &Record) -> SaveResult<()> {
        self.validate(record)?;
        if pending(&self.target)? {
            return Err("save_recovery");
        }
        let bytes = serde_json::to_vec(record).map_err(|_| "save_record")?;
        if bytes.len() as u64 > MAX_RECORD {
            return Err("save_limit");
        }
        let temp = self.journal.with_file_name(format!(
            ".harbor-save-journal-stage-{}",
            uuid::Uuid::new_v4()
        ));
        let result = (|| {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temp)
                .map_err(|_| "save_write")?;
            file.write_all(&bytes)
                .and_then(|_| file.sync_all())
                .map_err(|_| "save_write")?;
            drop(file);
            super::saves::move_new(&temp, &self.journal)?;
            #[cfg(unix)]
            File::open(self.journal.parent().ok_or("save_folder")?)
                .and_then(|f| f.sync_all())
                .map_err(|_| "save_write")?;
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temp);
        }
        result
    }
    pub fn read(&self, profile_scope: &str, game: &str) -> SaveResult<Record> {
        let meta = fs::symlink_metadata(&self.journal).map_err(|_| "save_read")?;
        if !meta.is_file() || files::reparse(&meta) || meta.len() > MAX_RECORD {
            return Err("save_record");
        }
        let mut bytes = Vec::new();
        File::open(&self.journal)
            .map_err(|_| "save_read")?
            .take(MAX_RECORD + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "save_read")?;
        if bytes.len() as u64 > MAX_RECORD {
            return Err("save_record");
        }
        let record: Record = serde_json::from_slice(&bytes).map_err(|_| "save_record")?;
        self.validate(&record)?;
        if record.profile_scope != profile_scope || record.game != game {
            return Err("save_recovery_scope");
        }
        Ok(record)
    }
    pub fn clear(&self) -> SaveResult<()> {
        fs::remove_file(&self.journal).map_err(|_| "save_write")
    }
    pub fn recover(
        &self,
        record: &Record,
        cancel: &Arc<AtomicBool>,
        guard: &super::saves::SaveGuard,
    ) -> SaveResult<super::saves::SaveRestoreReceipt> {
        self.validate(record)?;
        let parent = self.target.parent().ok_or("save_folder")?;
        let stage = parent.join(&record.stage);
        let recovery = record.recovery.as_ref().map(|name| parent.join(name));
        let staged = tree(&stage, cancel)?;
        if staged.as_ref().is_some_and(|t| t != &record.after) {
            return Err("save_changed");
        }
        let original = recovery
            .as_ref()
            .map(|p| tree(p, cancel))
            .transpose()?
            .flatten();
        if original.is_some() && original != record.before {
            return Err("save_changed");
        }
        let current = tree(&self.target, cancel)?;
        files::canceled(cancel)?;
        guard()?;
        let status;
        if current.is_some() && staged.is_none() && original == record.before {
            // The second rename finished. Later game edits stay in place too.
            status = if current.as_ref() == Some(&record.after) {
                "restored"
            } else {
                "keptCurrent"
            };
        } else if original.is_none() && current == record.before {
            // No rename started, or a previous recovery already put originals back.
            status = if current.is_some() {
                "rolledBack"
            } else {
                "notRestored"
            };
        } else if current.is_none() && original.is_some() {
            files::canceled(cancel)?;
            guard()?;
            super::saves::move_new(recovery.as_ref().ok_or("save_record")?, &self.target)?;
            #[cfg(test)]
            super::saves::interruption_checkpoint("recoveryMoved");
            status = "rolledBack";
        } else {
            return Err("save_changed");
        }
        // Never remove a recorded stage until a complete save set is in place,
        // or the reviewed target was originally absent. Re-entry is idempotent.
        if staged.is_some() {
            files::canceled(cancel)?;
            guard()?;
            files::cleanup_owned(&stage, parent);
        }
        self.clear()?;
        Ok(super::saves::SaveRestoreReceipt {
            status: status.into(),
            target: self.target.to_string_lossy().into_owned(),
            recovery_snapshot_id: record.recovery_snapshot.clone(),
            recovery_folder: recovery
                .filter(|p| p.exists())
                .map(|p| p.to_string_lossy().into_owned()),
            files: record.after.files.len(),
            bytes: record.after.files.iter().map(|f| f.bytes).sum(),
        })
    }
}
