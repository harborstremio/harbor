use super::sims_package::{self as package, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Stamp {
    pub name: String,
    pub bytes: u64,
    pub hash: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub path: String,
    pub bytes: u64,
    pub kind: &'static str,
    pub script_too_deep: bool,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub path: String,
    pub game_version: String,
    pub mods_enabled: Option<bool>,
    pub scripts_enabled: Option<bool>,
    pub resource_ready: bool,
    pub files: Vec<Entry>,
    pub partial: bool,
    pub save_recovery: bool,
}
pub fn linked(meta: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    meta.file_type().is_symlink()
}
pub fn directory(path: &Path) -> Result<PathBuf> {
    if !path.is_absolute() {
        return Err("sims_folder");
    }
    let mut current = PathBuf::new();
    for part in path.components() {
        current.push(part);
        if matches!(part, Component::Prefix(_)) {
            continue;
        }
        if !matches!(part, Component::RootDir | Component::Normal(_)) {
            return Err("sims_folder");
        }
        let meta = fs::symlink_metadata(&current).map_err(|_| "sims_folder")?;
        if !meta.is_dir() || linked(&meta) {
            return Err("sims_link");
        }
    }
    path.canonicalize().map_err(|_| "sims_folder")
}
pub fn regular(path: &Path) -> Result<fs::Metadata> {
    directory(path.parent().ok_or("sims_path")?)?;
    let meta = fs::symlink_metadata(path).map_err(|_| "sims_read")?;
    if !meta.is_file() || linked(&meta) {
        return Err("sims_link");
    }
    Ok(meta)
}
pub fn read(path: &Path, limit: usize) -> Result<Vec<u8>> {
    read_checked(path, limit, &|| Ok(()))
}
pub fn read_checked(path: &Path, limit: usize, check: &dyn Fn() -> Result<()>) -> Result<Vec<u8>> {
    check()?;
    let meta = regular(path)?;
    if meta.len() > limit as u64 {
        return Err("sims_limit");
    }
    let mut bytes = Vec::new();
    package::copy_checked(
        &mut File::open(path)
            .map_err(|_| "sims_read")?
            .take(limit as u64 + 1),
        &mut bytes,
        "sims_read",
        check,
    )?;
    let after = regular(path)?;
    if after.len() != meta.len()
        || bytes.len() as u64 != meta.len()
        || after.modified().ok() != meta.modified().ok()
    {
        return Err("sims_changed");
    }
    Ok(bytes)
}
fn text(path: &Path, limit: usize) -> Result<String> {
    let bytes = read(path, limit)?;
    if bytes.starts_with(&[0xff, 0xfe]) || bytes.starts_with(&[0xfe, 0xff]) {
        if bytes.len() % 2 != 0 {
            return Err("sims_format");
        }
        let le = bytes[0] == 0xff;
        let chars: Vec<_> = bytes[2..]
            .chunks_exact(2)
            .map(|v| {
                if le {
                    u16::from_le_bytes([v[0], v[1]])
                } else {
                    u16::from_be_bytes([v[0], v[1]])
                }
            })
            .collect();
        return String::from_utf16(&chars).map_err(|_| "sims_format");
    }
    String::from_utf8(bytes)
        .map(|v| v.trim_start_matches('\u{feff}').to_owned())
        .map_err(|_| "sims_format")
}
pub fn options(input: &str) -> (Option<bool>, Option<bool>) {
    let mut section = false;
    let mut mods = None;
    let mut scripts = None;
    let mut seen = BTreeSet::new();
    for line in input.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            section = line.eq_ignore_ascii_case("[options]");
            continue;
        }
        if !section {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim().to_ascii_lowercase();
            if !["modsdisabled", "scriptmodsenabled"].contains(&key.as_str()) {
                continue;
            }
            let value = value.trim();
            let parsed = match value {
                "0" => Some(false),
                "1" => Some(true),
                _ => None,
            };
            if !seen.insert(key.clone()) {
                if key == "modsdisabled" {
                    mods = None;
                } else {
                    scripts = None;
                }
                continue;
            }
            if key == "modsdisabled" {
                mods = parsed.map(|v| !v);
            } else {
                scripts = parsed;
            }
        }
    }
    (mods, scripts)
}
pub fn validate(value: &str) -> Result<Folder> {
    let folder = inspect_folder(value)?;
    if folder.save_recovery {
        return Err("sims_save_recovery");
    }
    Ok(folder)
}
pub fn inspect_folder(value: &str) -> Result<Folder> {
    if value.len() > 4096 {
        return Err("sims_folder");
    }
    let root = directory(Path::new(value))?;
    let version = text(&root.join("GameVersion.txt"), 512)?;
    let version = version.trim();
    let parts: Vec<_> = version.split('.').collect();
    if parts.len() != 4
        || parts[0] != "1"
        || parts
            .iter()
            .any(|p| p.is_empty() || p.len() > 6 || !p.bytes().all(|b| b.is_ascii_digit()))
    {
        return Err("sims_folder");
    }
    let config = text(&root.join("Options.ini"), 128 * 1024)?;
    if !config
        .lines()
        .any(|v| v.trim().eq_ignore_ascii_case("[options]"))
    {
        return Err("sims_folder");
    }
    let save_recovery = super::save_restore::pending(&root.join("saves"))?;
    match fs::symlink_metadata(root.join("saves")) {
        Ok(_) => {
            directory(&root.join("saves"))?;
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound && save_recovery => {}
        Err(_) => return Err("sims_folder"),
    }
    directory(&root.join("Mods"))?;
    let (mods_enabled, scripts_enabled) = options(&config);
    let resource_ready =
        text(&root.join("Mods").join("Resource.cfg"), 128 * 1024).is_ok_and(|content| {
            content.lines().any(|line| {
                let parts: Vec<_> = line.split_whitespace().collect();
                parts.len() == 2
                    && parts[0].eq_ignore_ascii_case("PackedFile")
                    && parts[1].eq_ignore_ascii_case("*/*.package")
            })
        });
    Ok(Folder {
        path: root.to_string_lossy().into_owned(),
        game_version: version.into(),
        mods_enabled,
        scripts_enabled,
        resource_ready,
        files: Vec::new(),
        partial: false,
        save_recovery,
    })
}
pub fn inventory(value: &str) -> Result<Folder> {
    inventory_checked(value, &|| Ok(()))
}
pub fn inventory_checked(value: &str, check: &dyn Fn() -> Result<()>) -> Result<Folder> {
    check()?;
    let mut folder = inspect_folder(value)?;
    let mods = Path::new(&folder.path).join("Mods");
    fn walk(
        root: &Path,
        path: &Path,
        depth: usize,
        folder: &mut Folder,
        visited: &mut usize,
        check: &dyn Fn() -> Result<()>,
    ) -> Result<()> {
        check()?;
        if depth > 8 {
            folder.partial = true;
            return Ok(());
        }
        for item in fs::read_dir(path).map_err(|_| "sims_read")? {
            check()?;
            *visited += 1;
            if *visited > 30000 || folder.files.len() >= 15000 {
                folder.partial = true;
                break;
            }
            let entry = item.map_err(|_| "sims_read")?;
            let meta = fs::symlink_metadata(entry.path()).map_err(|_| "sims_read")?;
            if linked(&meta) {
                folder.partial = true;
                continue;
            }
            if meta.is_dir() {
                walk(root, &entry.path(), depth + 1, folder, visited, check)?;
                continue;
            }
            if !meta.is_file() {
                folder.partial = true;
                continue;
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            if depth == 0 && name.eq_ignore_ascii_case("Resource.cfg") {
                continue;
            }
            let kind = package::kind(&name);
            if kind == "other" {
                continue;
            }
            let path = entry
                .path()
                .strip_prefix(root)
                .map_err(|_| "sims_path")?
                .to_string_lossy()
                .replace('\\', "/");
            folder.files.push(Entry {
                path,
                bytes: meta.len(),
                kind,
                script_too_deep: kind == "script" && depth > 1,
            });
        }
        Ok(())
    }
    walk(&mods, &mods, 0, &mut folder, &mut 0, check)?;
    folder.files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(folder)
}
pub fn stamp(name: String, bytes: &[u8]) -> Stamp {
    Stamp {
        name,
        bytes: bytes.len() as u64,
        hash: format!("{:x}", Sha256::digest(bytes)),
    }
}
pub fn tree(path: &Path) -> Result<Vec<Stamp>> {
    tree_checked(path, &|| Ok(()))
}
// Managed mod payloads stay flat. Runtime data may live in creator subfolders.
pub fn relative_name(name: &str) -> Result<()> {
    if name.len() > 2048 || name.split('/').count() > 16 {
        return Err("sims_path");
    }
    for part in name.split('/') {
        package::filename(part)?;
    }
    Ok(())
}
pub fn staged_file(root: &Path, name: &str) -> Result<PathBuf> {
    relative_name(name)?;
    let mut parent = directory(root)?;
    let mut parts = name.split('/').peekable();
    while let Some(part) = parts.next() {
        if parts.peek().is_none() {
            return Ok(parent.join(part));
        }
        parent = ensure_child(&parent, part)?;
    }
    Err("sims_path")
}
pub fn tree_checked(path: &Path, check: &dyn Fn() -> Result<()>) -> Result<Vec<Stamp>> {
    check()?;
    directory(path)?;
    let mut files = Vec::new();
    let mut total = 0;
    fn walk(
        root: &Path,
        folder: &Path,
        files: &mut Vec<Stamp>,
        total: &mut usize,
        entries: &mut usize,
        check: &dyn Fn() -> Result<()>,
    ) -> Result<()> {
        directory(folder)?;
        for entry in fs::read_dir(folder).map_err(|_| "sims_read")? {
            check()?;
            *entries += 1;
            if *entries > 4000 {
                return Err("sims_limit");
            }
            let entry = entry.map_err(|_| "sims_read")?;
            package::filename(entry.file_name().to_str().ok_or("sims_path")?)?;
            let path = entry.path();
            let name = path
                .strip_prefix(root)
                .map_err(|_| "sims_path")?
                .to_str()
                .ok_or("sims_path")?
                .replace('\\', "/");
            relative_name(&name)?;
            let meta = fs::symlink_metadata(&path).map_err(|_| "sims_read")?;
            if linked(&meta) {
                return Err("sims_link");
            }
            if meta.is_dir() {
                walk(root, &path, files, total, entries, check)?;
            } else {
                let bytes = read_checked(&path, package::MAX_FILE, check)?;
                *total += bytes.len();
                if *total > package::MAX_IMPORT || files.len() >= 2000 {
                    return Err("sims_limit");
                }
                files.push(stamp(name, &bytes));
            }
        }
        Ok(())
    }
    walk(path, path, &mut files, &mut total, &mut 0, check)?;
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(files)
}
pub fn ensure_child(root: &Path, name: &str) -> Result<PathBuf> {
    package::filename(name)?;
    let root = directory(root)?;
    let path = root.join(name);
    if !path.try_exists().map_err(|_| "sims_read")? {
        fs::create_dir(&path).map_err(|_| "sims_write")?;
    }
    let canonical = directory(&path)?;
    if canonical.parent() != Some(root.as_path()) {
        return Err("sims_link");
    }
    Ok(canonical)
}
pub fn atomic(root: &Path, name: &str, bytes: &[u8]) -> Result<()> {
    directory(root)?;
    package::filename(name)?;
    let dest = root.join(name);
    if dest.try_exists().map_err(|_| "sims_read")? {
        regular(&dest)?;
    }
    let temp = root.join(format!("{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut f = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)
            .map_err(|_| "sims_write")?;
        f.write_all(bytes)
            .and_then(|_| f.sync_all())
            .map_err(|_| "sims_write")?;
        drop(f);
        fs::rename(&temp, &dest).map_err(|_| "sims_write")
    })();
    if result.is_err() {
        let _ = fs::remove_file(temp);
    }
    result
}
pub fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
pub fn space(path: &Path, needed: u64) -> Result<()> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::{core::PCWSTR, Win32::Storage::FileSystem::GetDiskFreeSpaceExW};
        let path = directory(path)?;
        let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        let mut free = 0;
        unsafe { GetDiskFreeSpaceExW(PCWSTR(wide.as_ptr()), Some(&mut free), None, None) }
            .map_err(|_| "sims_space")?;
        if free < needed.saturating_add(32 * 1024 * 1024) {
            return Err("sims_space");
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (path, needed);
        Err("sims_platform")
    }
}
#[cfg(windows)]
pub fn idle() -> Result<()> {
    use windows::{
        core::HRESULT,
        Win32::{
            Foundation::{CloseHandle, ERROR_NO_MORE_FILES, HANDLE},
            System::Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                TH32CS_SNAPPROCESS,
            },
        },
    };
    struct Snapshot(HANDLE);
    impl Drop for Snapshot {
        fn drop(&mut self) {
            unsafe {
                let _ = CloseHandle(self.0);
            }
        }
    }
    let snapshot = Snapshot(
        unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }.map_err(|_| "sims_process")?,
    );
    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    let mut result = unsafe { Process32FirstW(snapshot.0, &mut entry) };
    loop {
        match result {
            Ok(()) => {}
            Err(e) if e.code() == HRESULT::from_win32(ERROR_NO_MORE_FILES.0) => return Ok(()),
            Err(_) => return Err("sims_process"),
        }
        let len = entry
            .szExeFile
            .iter()
            .position(|c| *c == 0)
            .unwrap_or(entry.szExeFile.len());
        let name = String::from_utf16_lossy(&entry.szExeFile[..len]).to_ascii_lowercase();
        if ["ts4.exe", "ts4_x64.exe", "ts4_dx9_x64.exe"].contains(&name.as_str()) {
            return Err("sims_running");
        }
        result = unsafe { Process32NextW(snapshot.0, &mut entry) };
    }
}
#[cfg(not(windows))]
pub fn idle() -> Result<()> {
    Err("sims_platform")
}
