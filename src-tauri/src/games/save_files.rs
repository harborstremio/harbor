use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant, UNIX_EPOCH},
};

pub type SaveResult<T> = Result<T, &'static str>;
pub const MAX_FILES: usize = 5000;
pub const MAX_BYTES: u64 = 2 * 1024 * 1024 * 1024;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveFile {
    pub path: String,
    pub bytes: u64,
    pub sha256: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SaveTree {
    pub files: Vec<SaveFile>,
    pub directories: Vec<String>,
}
pub fn canceled(cancel: &Arc<AtomicBool>) -> SaveResult<()> {
    if cancel.load(Ordering::Relaxed) {
        Err("save_canceled")
    } else {
        Ok(())
    }
}
pub fn reparse(meta: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    meta.file_type().is_symlink()
}
pub fn plain_dir(path: &Path) -> SaveResult<PathBuf> {
    let meta = fs::symlink_metadata(path).map_err(|_| "save_folder")?;
    if !meta.is_dir() || reparse(&meta) {
        return Err("save_folder");
    }
    let canonical = path.canonicalize().map_err(|_| "save_folder")?;
    if canonical.parent().is_none() || canonical.file_name().is_none() {
        return Err("save_folder");
    }
    Ok(canonical)
}
pub fn relative(value: &str) -> SaveResult<PathBuf> {
    let path = Path::new(value);
    if value.is_empty()
        || value.len() > 2048
        || value.contains('\\')
        || value.contains(':')
        || value.contains('\0')
        || path.is_absolute()
        || path
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err("save_record");
    }
    Ok(path.to_path_buf())
}
pub fn child_dir(root: &Path, name: &str) -> SaveResult<PathBuf> {
    if name.is_empty() || name.contains(['/', '\\', ':']) || name == "." || name == ".." {
        return Err("save_folder");
    }
    let path = root.join(name);
    if !path.try_exists().map_err(|_| "save_folder")? {
        fs::create_dir(&path).map_err(|_| "save_write")?;
    }
    let canonical = plain_dir(&path)?;
    if canonical.parent() != Some(root) {
        return Err("save_folder");
    }
    Ok(canonical)
}
fn file_info(path: &Path) -> SaveResult<fs::Metadata> {
    let info = fs::symlink_metadata(path).map_err(|_| "save_read")?;
    if reparse(&info) || !info.is_file() {
        return Err("save_links");
    }
    Ok(info)
}
fn modified(info: &fs::Metadata) -> Option<u128> {
    info.modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| d.as_nanos())
}
pub fn fingerprint(path: &Path, cancel: &Arc<AtomicBool>) -> SaveResult<(u64, String)> {
    let before = file_info(path)?;
    if before.len() > MAX_BYTES {
        return Err("save_limit");
    }
    let mut input = File::open(path).map_err(|_| "save_read")?;
    let mut hash = Sha256::new();
    let mut buffer = vec![0; 256 * 1024];
    let mut size = 0;
    loop {
        canceled(cancel)?;
        let count = input.read(&mut buffer).map_err(|_| "save_read")?;
        if count == 0 {
            break;
        }
        size += count as u64;
        if size > MAX_BYTES {
            return Err("save_limit");
        }
        hash.update(&buffer[..count]);
    }
    let after = file_info(path)?;
    if size != before.len() || after.len() != before.len() || modified(&after) != modified(&before)
    {
        return Err("save_changed");
    }
    Ok((size, format!("{:x}", hash.finalize())))
}
pub fn inventory(root: &Path, cancel: &Arc<AtomicBool>) -> SaveResult<SaveTree> {
    let root = plain_dir(root)?;
    fn walk(
        root: &Path,
        path: &Path,
        depth: usize,
        files: &mut Vec<SaveFile>,
        directories: &mut Vec<String>,
        bytes: &mut u64,
        entries: &mut usize,
        cancel: &Arc<AtomicBool>,
    ) -> SaveResult<()> {
        if depth > 12 {
            return Err("save_limit");
        }
        canceled(cancel)?;
        let mut children = fs::read_dir(path)
            .map_err(|_| "save_read")?
            .take(15001)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| "save_read")?;
        if children.len() + *entries > 15000 {
            return Err("save_limit");
        }
        children.sort_by_key(|v| v.file_name());
        for entry in children {
            *entries += 1;
            if *entries > 15000 {
                return Err("save_limit");
            }
            let path = entry.path();
            let meta = fs::symlink_metadata(&path).map_err(|_| "save_read")?;
            if reparse(&meta) {
                return Err("save_links");
            }
            if meta.is_dir() {
                let name = path
                    .strip_prefix(root)
                    .map_err(|_| "save_links")?
                    .components()
                    .map(|c| c.as_os_str().to_str().ok_or("save_name"))
                    .collect::<SaveResult<Vec<_>>>()?
                    .join("/");
                relative(&name)?;
                directories.push(name);
                walk(
                    root,
                    &path,
                    depth + 1,
                    files,
                    directories,
                    bytes,
                    entries,
                    cancel,
                )?;
            } else if meta.is_file() {
                if files.len() >= MAX_FILES {
                    return Err("save_limit");
                }
                *bytes = bytes.checked_add(meta.len()).ok_or("save_limit")?;
                if *bytes > MAX_BYTES {
                    return Err("save_limit");
                }
                let name = path
                    .strip_prefix(root)
                    .map_err(|_| "save_folder")?
                    .components()
                    .map(|c| c.as_os_str().to_str().ok_or("save_name"))
                    .collect::<SaveResult<Vec<_>>>()?
                    .join("/");
                relative(&name)?;
                let (size, sha256) = fingerprint(&path, cancel)?;
                files.push(SaveFile {
                    path: name,
                    bytes: size,
                    sha256,
                });
            } else {
                return Err("save_links");
            }
        }
        Ok(())
    }
    let mut files = Vec::new();
    let mut directories = Vec::new();
    walk(
        &root,
        &root,
        0,
        &mut files,
        &mut directories,
        &mut 0,
        &mut 0,
        cancel,
    )?;
    files.sort_by(|a, b| a.path.cmp(&b.path));
    directories.sort();
    Ok(SaveTree { files, directories })
}
pub fn copy_directories(
    target: &Path,
    directories: &[String],
    cancel: &Arc<AtomicBool>,
) -> SaveResult<()> {
    for name in directories {
        canceled(cancel)?;
        let mut parent = target.to_path_buf();
        for component in relative(name)?.components() {
            parent = child_dir(&parent, component.as_os_str().to_str().ok_or("save_name")?)?;
        }
    }
    Ok(())
}
pub fn safe_child(root: &Path, value: &str) -> SaveResult<PathBuf> {
    let relative = relative(value)?;
    let mut path = root.to_path_buf();
    let mut parts = relative.components().peekable();
    while let Some(part) = parts.next() {
        path.push(part);
        if parts.peek().is_some() {
            let canonical = plain_dir(&path)?;
            if !canonical.starts_with(root) {
                return Err("save_links");
            }
        }
    }
    Ok(path)
}
pub fn copy_files(
    source: &Path,
    target: &Path,
    files: &[SaveFile],
    cancel: &Arc<AtomicBool>,
    progress: &impl Fn(usize, u64),
) -> SaveResult<()> {
    let mut copied = 0;
    let mut last_progress = Instant::now();
    progress(0, 0);
    for (index, entry) in files.iter().enumerate() {
        canceled(cancel)?;
        let from = safe_child(source, &entry.path)?;
        file_info(&from)?;
        let rel = relative(&entry.path)?;
        let mut parent = target.to_path_buf();
        if let Some(dirs) = rel.parent() {
            for component in dirs.components() {
                parent = child_dir(&parent, component.as_os_str().to_str().ok_or("save_name")?)?;
            }
        }
        let dest = parent.join(rel.file_name().ok_or("save_record")?);
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&dest)
            .map_err(|_| "save_write")?;
        let mut input = File::open(&from).map_err(|_| "save_read")?;
        let mut buffer = vec![0; 256 * 1024];
        let mut hash = Sha256::new();
        let mut bytes = 0;
        loop {
            canceled(cancel)?;
            let count = input.read(&mut buffer).map_err(|_| "save_read")?;
            if count == 0 {
                break;
            }
            bytes += count as u64;
            if bytes > entry.bytes {
                return Err("save_changed");
            }
            hash.update(&buffer[..count]);
            output
                .write_all(&buffer[..count])
                .map_err(|_| "save_write")?;
            if last_progress.elapsed() >= Duration::from_millis(150) {
                progress(index, copied + bytes);
                last_progress = Instant::now();
            }
        }
        if bytes != entry.bytes || format!("{:x}", hash.finalize()) != entry.sha256 {
            return Err("save_changed");
        }
        if let Ok(modified) = input.metadata().and_then(|m| m.modified()) {
            output
                .set_times(fs::FileTimes::new().set_modified(modified))
                .map_err(|_| "save_write")?;
        }
        output.sync_all().map_err(|_| "save_write")?;
        copied += bytes;
        progress(index + 1, copied);
    }
    Ok(())
}
pub fn space(path: &Path, bytes: u64) -> SaveResult<()> {
    if let Some(available) = super::transfer_files::free_bytes(path) {
        if available < bytes.saturating_add(32 * 1024 * 1024) {
            return Err("save_space");
        }
    }
    Ok(())
}
pub fn cleanup_owned(path: &Path, parent: &Path) {
    // Only incomplete UUID staging directories created by this operation; never a selected save folder.
    if path.parent() != Some(parent)
        || !path
            .file_name()
            .and_then(|s| s.to_str())
            .is_some_and(|s| s.starts_with(".harbor-save-stage-"))
    {
        return;
    }
    if fs::symlink_metadata(path).is_ok_and(|m| m.is_dir() && !reparse(&m))
        && path
            .canonicalize()
            .is_ok_and(|p| p.parent() == Some(parent))
    {
        let _ = fs::remove_dir_all(path);
    }
}
