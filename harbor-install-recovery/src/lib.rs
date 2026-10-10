//! Opt-in installer transactions. Never reads, restores or deletes AppData.
//! Failed/new and previous application trees are retained, not recursively deleted.
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}

fn plain_path(path: &Path) -> io::Result<()> {
    for ancestor in path.ancestors() {
        match fs::symlink_metadata(ancestor) {
            Ok(meta) => {
                #[cfg(windows)]
                {
                    use std::os::windows::fs::MetadataExt;
                    if meta.file_attributes() & 0x400 != 0 {
                        return Err(invalid("reparse points are not supported for recovery"));
                    }
                }
                if meta.file_type().is_symlink() {
                    return Err(invalid("symlinks are not supported for recovery"));
                }
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
    }
    Ok(())
}

fn write_new(path: &Path, content: &[u8]) -> io::Result<()> {
    let mut file = OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(content)?;
    file.sync_all()
}

fn valid_version(version: &str) -> bool {
    let parts: Vec<_> = version.split('.').collect();
    parts.len() == 3
        && parts
            .iter()
            .all(|part| !part.is_empty() && part.bytes().all(|c| c.is_ascii_digit()))
}

pub struct Transaction {
    dest: PathBuf,
    root: PathBuf,
}

impl Transaction {
    pub fn at(dest: &Path) -> io::Result<Self> {
        if !dest.is_absolute()
            || dest
                .components()
                .any(|c| matches!(c, Component::ParentDir | Component::CurDir))
        {
            return Err(invalid("an absolute install directory is required"));
        }
        let name = dest
            .file_name()
            .ok_or_else(|| invalid("refusing a filesystem root"))?;
        let parent = dest
            .parent()
            .ok_or_else(|| invalid("missing install parent"))?;
        if parent.parent().is_none() {
            return Err(invalid("refusing a root-level installation"));
        }
        plain_path(dest)?;
        let root = parent.join(format!(".{}.harbor-transition", name.to_string_lossy()));
        plain_path(&root)?;
        Ok(Self {
            dest: dest.to_owned(),
            root,
        })
    }

    pub fn begin(dest: &Path, version: &str) -> io::Result<Self> {
        if !valid_version(version) {
            return Err(invalid("invalid target version"));
        }
        let tx = Self::at(dest)?;
        if !dest.join("harbor.exe").is_file() || !dest.join("harbor-install.json").is_file() {
            return Err(invalid(
                "recovery requires an existing managed Harbor installation",
            ));
        }
        // create_dir is the single-install lock. Never reuse or erase an
        // interrupted transaction: the retained recovery installer can resume it.
        fs::create_dir(&tx.root)?;
        write_new(&tx.root.join("target-version"), version.as_bytes())?;
        fs::create_dir(tx.stage())?;
        Ok(tx)
    }

    pub fn root(&self) -> &Path {
        &self.root
    }
    pub fn stage(&self) -> PathBuf {
        self.root.join("next")
    }
    fn previous(&self) -> PathBuf {
        self.root.join("previous")
    }

    pub fn commit(&self) -> io::Result<()> {
        plain_path(&self.stage())?;
        plain_path(&self.previous())?;
        if !self.stage().join("harbor.exe").is_file()
            || !self.stage().join("harbor-install.json").is_file()
        {
            return Err(invalid("staged application is incomplete"));
        }
        fs::rename(&self.dest, self.previous())?;
        if let Err(error) = fs::rename(self.stage(), &self.dest) {
            // A failed second rename must put the intact previous tree back.
            fs::rename(self.previous(), &self.dest)?;
            return Err(error);
        }
        Ok(())
    }

    pub fn restore(&self) -> io::Result<()> {
        plain_path(&self.previous())?;
        plain_path(&self.dest)?;
        if !self.previous().join("harbor.exe").is_file() {
            return Err(invalid("no previous installation to restore"));
        }
        if self.dest.exists() {
            let failed = self.root.join("failed");
            plain_path(&failed)?;
            if failed.exists() {
                return Err(invalid(
                    "a failed tree already exists; recovery requires inspection",
                ));
            }
            fs::rename(&self.dest, failed)?;
        }
        fs::rename(self.previous(), &self.dest)
    }

    pub fn acknowledged(&self) -> bool {
        let expected = fs::read_to_string(self.root.join("target-version"));
        let actual = fs::read_to_string(self.root.join("acknowledged-version"));
        matches!((expected, actual), (Ok(a), Ok(b)) if valid_version(&a) && a == b)
    }

    pub fn retain(&self) -> io::Result<PathBuf> {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| invalid("invalid system clock"))?
            .as_nanos();
        let name = self
            .root
            .file_name()
            .ok_or_else(|| invalid("missing recovery name"))?
            .to_string_lossy();
        let retained = self.root.with_file_name(format!("{name}-retained-{stamp}"));
        fs::rename(&self.root, &retained)?;
        Ok(retained)
    }
}

/// Called only after the target application's main UI has mounted. Old builds
/// without this protocol cannot acknowledge and are automatically rolled back.
pub fn acknowledge(dest: &Path, installed: &str) -> io::Result<()> {
    let tx = Transaction::at(dest)?;
    let target = tx.root.join("target-version");
    if !target.exists() {
        return Ok(());
    }
    if fs::read_to_string(target)? != installed || !valid_version(installed) {
        return Err(invalid(
            "launched version does not match the recovery target",
        ));
    }
    let ack = tx.root.join("acknowledged-version");
    plain_path(&ack)?;
    if fs::read_to_string(&ack).ok().as_deref() == Some(installed) {
        return Ok(());
    }
    write_new(&ack, installed.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> PathBuf {
        let id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root =
            std::env::temp_dir().join(format!("harbor-recovery-test-{}-{id}", std::process::id()));
        let dest = root.join("Harbor");
        fs::create_dir_all(&dest).unwrap();
        fs::write(dest.join("harbor.exe"), b"old").unwrap();
        fs::write(dest.join("harbor-install.json"), b"old-marker").unwrap();
        dest
    }
    fn stage(tx: &Transaction) {
        fs::write(tx.stage().join("harbor.exe"), b"new").unwrap();
        fs::write(tx.stage().join("harbor-install.json"), b"new-marker").unwrap();
    }
    #[test]
    fn commits_and_retains_previous_until_exact_launch_ack() {
        let dest = fixture();
        let tx = Transaction::begin(&dest, "0.9.122").unwrap();
        stage(&tx);
        tx.commit().unwrap();
        assert_eq!(fs::read(dest.join("harbor.exe")).unwrap(), b"new");
        assert!(!tx.acknowledged());
        assert!(acknowledge(&dest, "0.9.123").is_err());
        acknowledge(&dest, "0.9.122").unwrap();
        assert!(tx.acknowledged());
        let retained = tx.retain().unwrap();
        assert_eq!(
            fs::read(retained.join("previous/harbor.exe")).unwrap(),
            b"old"
        );
    }
    #[test]
    fn failed_or_crashed_launch_restores_previous_without_erasing_new_tree() {
        let dest = fixture();
        let tx = Transaction::begin(&dest, "0.9.122").unwrap();
        stage(&tx);
        tx.commit().unwrap();
        tx.restore().unwrap();
        assert_eq!(fs::read(dest.join("harbor.exe")).unwrap(), b"old");
        assert_eq!(fs::read(tx.root.join("failed/harbor.exe")).unwrap(), b"new");
    }
    #[test]
    fn incomplete_extract_and_concurrent_install_leave_current_untouched() {
        let dest = fixture();
        let tx = Transaction::begin(&dest, "0.9.122").unwrap();
        assert!(tx.commit().is_err());
        assert!(Transaction::begin(&dest, "0.9.122").is_err());
        assert_eq!(fs::read(dest.join("harbor.exe")).unwrap(), b"old");
    }
    #[test]
    fn interrupted_between_directory_renames_is_recoverable() {
        let dest = fixture();
        let tx = Transaction::begin(&dest, "0.9.122").unwrap();
        stage(&tx);
        fs::rename(&dest, tx.previous()).unwrap();
        Transaction::at(&dest).unwrap().restore().unwrap();
        assert_eq!(fs::read(dest.join("harbor.exe")).unwrap(), b"old");
    }
    #[test]
    fn rejects_unmanaged_relative_and_root_targets() {
        assert!(Transaction::at(Path::new("Harbor")).is_err());
        let dest = fixture();
        assert!(Transaction::begin(dest.parent().unwrap(), "0.9.122").is_err());
        assert!(Transaction::begin(&dest, "../bad").is_err());
    }
}
