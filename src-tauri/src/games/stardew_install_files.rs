use super::{
    save_files,
    stardew_manifest::Result,
    stardew_package::{self as package, Stamp},
};
use serde::{de::DeserializeOwned, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
};

pub fn exists(path: &Path) -> Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err("stardew_read"),
    }
}
pub fn directory(path: &Path) -> Result<PathBuf> {
    save_files::plain_dir(path).map_err(|_| "stardew_link")
}
pub fn regular(path: &Path) -> Result<fs::Metadata> {
    let m = fs::symlink_metadata(path).map_err(|_| "stardew_read")?;
    if !m.is_file() || save_files::reparse(&m) {
        return Err("stardew_link");
    };
    Ok(m)
}
pub fn child(root: &Path, relative: &str, parents: bool) -> Result<PathBuf> {
    if !package::relative(relative) {
        return Err("stardew_record");
    }
    directory(root)?;
    let mut path = root.to_path_buf();
    let parts = relative.split('/').collect::<Vec<_>>();
    for (i, part) in parts.iter().enumerate() {
        path.push(part);
        if i + 1 < parts.len() {
            if parents && !exists(&path)? {
                fs::create_dir(&path).map_err(|_| "stardew_write")?;
            }
            directory(&path)?;
        } else if exists(&path)? {
            regular(&path)?;
        }
    }
    Ok(path)
}
pub fn mkdir(root: &Path, name: &str) -> Result<PathBuf> {
    if !package::component(name) {
        return Err("stardew_record");
    };
    directory(root)?;
    let path = root.join(name);
    if !exists(&path)? {
        fs::create_dir(&path).map_err(|_| "stardew_write")?;
    }
    directory(&path)
}
pub fn read(path: &Path, limit: usize, check: &dyn Fn() -> Result<()>) -> Result<Vec<u8>> {
    check()?;
    let before = regular(path)?;
    if before.len() > limit as u64 {
        return Err("stardew_limit");
    }
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.share_mode(1).custom_flags(0x00200000);
    }
    let mut file = options.open(path).map_err(|_| "stardew_read")?;
    let mut bytes = Vec::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        check()?;
        let n = file.read(&mut buf).map_err(|_| "stardew_read")?;
        if n == 0 {
            break;
        };
        if bytes.len() + n > limit {
            return Err("stardew_limit");
        };
        bytes.extend_from_slice(&buf[..n]);
    }
    let after = regular(path)?;
    if after.len() != before.len()
        || before.modified().ok() != after.modified().ok()
        || bytes.len() as u64 != after.len()
    {
        return Err("stardew_changed");
    };
    Ok(bytes)
}
pub fn tree(root: &Path, check: &dyn Fn() -> Result<()>) -> Result<Vec<Stamp>> {
    directory(root)?;
    let mut pending = vec![root.to_path_buf()];
    let mut files = Vec::new();
    let mut names = BTreeSet::new();
    let mut total = 0usize;
    let mut entries = 0;
    while let Some(folder) = pending.pop() {
        check()?;
        directory(&folder)?;
        for entry in fs::read_dir(&folder).map_err(|_| "stardew_read")? {
            check()?;
            entries += 1;
            if entries > package::MAX_FILES * 2 {
                return Err("stardew_limit");
            };
            let entry = entry.map_err(|_| "stardew_read")?;
            let path = entry.path();
            let name = path
                .strip_prefix(root)
                .map_err(|_| "stardew_link")?
                .to_string_lossy()
                .replace('\\', "/");
            if !package::relative(&name) || !names.insert(name.to_ascii_lowercase()) {
                return Err("stardew_record");
            };
            let meta = fs::symlink_metadata(&path).map_err(|_| "stardew_read")?;
            if save_files::reparse(&meta) {
                return Err("stardew_link");
            };
            if meta.is_dir() {
                pending.push(path);
                continue;
            }
            if !meta.is_file() {
                return Err("stardew_link");
            }
            total = total
                .checked_add(usize::try_from(meta.len()).map_err(|_| "stardew_limit")?)
                .filter(|v| *v <= package::MAX_CONTENT)
                .ok_or("stardew_limit")?;
            if files.len() >= package::MAX_FILES {
                return Err("stardew_limit");
            };
            let bytes = read(&path, package::MAX_CONTENT, check)?;
            files.push(package::stamp(&name, &bytes));
        }
    }
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(files)
}
pub fn same(root: &Path, expected: &[Stamp]) -> Result<()> {
    if tree(root, &|| Ok(()))? != expected {
        return Err("stardew_changed");
    };
    Ok(())
}
pub fn json<T: DeserializeOwned>(path: &Path) -> Result<T> {
    serde_json::from_slice(&read(path, 32 * 1024 * 1024, &|| Ok(()))?).map_err(|_| "stardew_record")
}
pub fn atomic<T: Serialize>(root: &Path, name: &str, value: &T) -> Result<()> {
    if !package::component(name) {
        return Err("stardew_record");
    };
    directory(root)?;
    let target = root.join(name);
    if exists(&target)? {
        regular(&target)?;
    }
    let bytes = serde_json::to_vec(value).map_err(|_| "stardew_record")?;
    if bytes.len() > 32 * 1024 * 1024 {
        return Err("stardew_limit");
    };
    let temp = root.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temp)
        .map_err(|_| "stardew_write")?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "stardew_write")?;
    drop(file);
    fs::rename(&temp, target).map_err(|_| "stardew_write")?;
    sync_dir(root);
    Ok(())
}
pub fn sync_dir(path: &Path) {
    #[cfg(unix)]
    if let Ok(file) = File::open(path) {
        let _ = file.sync_all();
    }
    #[cfg(not(unix))]
    let _ = path;
}
pub fn write_new(
    root: &Path,
    name: &str,
    bytes: &[u8],
    check: &dyn Fn() -> Result<()>,
) -> Result<()> {
    let path = child(root, name, true)?;
    if exists(&path)? {
        return Err("stardew_exists");
    };
    let mut f = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&path)
        .map_err(|_| "stardew_write")?;
    for chunk in bytes.chunks(64 * 1024) {
        check()?;
        f.write_all(chunk).map_err(|_| "stardew_write")?;
    }
    f.sync_all().map_err(|_| "stardew_write")
}
pub fn lock(root: &Path) -> Result<File> {
    directory(root)?;
    let path = root.join("lock");
    if exists(&path)? {
        let m = regular(&path)?;
        if m.len() != 0 {
            return Err("stardew_record");
        }
    }
    let mut options = OpenOptions::new();
    options.read(true).write(true).create(true).truncate(false);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.share_mode(0).custom_flags(0x00200000);
    }
    let file = options.open(path).map_err(|_| "stardew_busy")?;
    if save_files::reparse(&file.metadata().map_err(|_| "stardew_read")?) {
        return Err("stardew_link");
    };
    file.try_lock().map_err(|_| "stardew_busy")?;
    Ok(file)
}
pub fn identity(root: &Path) -> String {
    format!("{:x}", Sha256::digest(root.to_string_lossy().as_bytes()))
}
