use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::{Component, Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager};

type Result<T> = std::result::Result<T, &'static str>;
const MAX_DEPTH: usize = 6;
const MAX_VISITED: usize = 10_000;
const MAX_CANDIDATES: usize = 256;
const MAX_PLANS: usize = 32;
const MAX_JOBS: usize = 200;
const MAX_RUNNING: usize = 8;
const MAX_GAME_CANDIDATES: usize = 32;
const MAX_STORE_BYTES: usize = 4 * 1024 * 1024;
const PLAN_TTL: Duration = Duration::from_secs(15 * 60);
const ENGINE_FILE_LIMIT: u64 = 8 * 1024 * 1024;
const ENGINE_PLAN_LIMIT: u64 = 64 * 1024 * 1024;
const ACTIVITY_INTERVAL: Duration = Duration::from_secs(2);
const FILE_ACTIVITY_INTERVAL: Duration = Duration::from_secs(10);

#[cfg(windows)]
#[path = "setup_audio.rs"]
mod audio;
#[path = "setup_icon.rs"]
mod icon;
#[cfg(windows)]
#[path = "setup_ocr.rs"]
mod ocr;
#[cfg(windows)]
#[path = "setup_progress.rs"]
mod progress;
#[path = "setup_resume.rs"]
mod resume;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SetupEngine {
    Inno,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SetupKind {
    Installer,
    Archive,
    Torrent,
    Game,
    ExternalArchive,
    Rom,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupEntry {
    pub id: String,
    pub path: String,
    pub relative_path: String,
    pub bytes: u64,
    pub kind: SetupKind,
    pub engine: Option<SetupEngine>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupPlan {
    pub token: String,
    pub root: String,
    pub entries: Vec<SetupEntry>,
    pub truncated: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SetupStatus {
    Running,
    Finished,
    Failed,
    Interrupted,
    External,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupJob {
    pub id: String,
    pub profile: String,
    pub source: String,
    pub installer: String,
    pub started_at: u64,
    pub updated_at: u64,
    pub status: SetupStatus,
    pub exit_code: Option<u32>,
    pub error: Option<String>,
    #[serde(default)]
    pub engine: Option<SetupEngine>,
    #[serde(default)]
    pub destination: Option<String>,
    #[serde(default)]
    pub activity: Option<SetupActivity>,
    #[serde(default)]
    pub progress: Option<SetupProgress>,
    #[serde(default)]
    pub game_candidates: Vec<String>,
    #[serde(default)]
    pub scan_truncated: bool,
    #[serde(default)]
    pub root_game_candidates: Vec<String>,
    #[serde(default)]
    pub root_candidates_complete: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reconnected_at: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    recovery: Option<resume::State>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupActivity {
    pub bytes: u64,
    pub files: u64,
    pub truncated: bool,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupProgress {
    #[serde(default)]
    pub stage: SetupStage,
    #[serde(default)]
    pub verification: Option<SetupVerification>,
    pub percent: Option<f64>,
    pub phase: Option<String>,
    pub current_file: Option<String>,
    pub elapsed_seconds: Option<u64>,
    pub remaining_seconds: Option<u64>,
    pub io_bytes_per_second: Option<f64>,
    pub observed_at: u64,
    #[serde(default)]
    pub can_reveal: bool,
    #[serde(default)]
    pub can_observe: bool,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SetupStage {
    #[default]
    Installing,
    Checking,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupVerification {
    pub checked_files: u64,
    pub total_files: u64,
    pub bad_files: u64,
    pub missing_files: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct Fingerprint {
    bytes: u64,
    modified: SystemTime,
    identity: (u64, u64),
}

#[derive(Clone, Debug)]
struct Candidate {
    entry: SetupEntry,
    fingerprint: Fingerprint,
}

#[derive(Clone, Debug)]
struct Prepared {
    profile: String,
    source: PathBuf,
    root: PathBuf,
    created: Instant,
    candidates: Vec<Candidate>,
}

#[derive(Serialize, Deserialize)]
struct Store {
    version: u8,
    jobs: Vec<SetupJob>,
}

pub struct Setups {
    root: PathBuf,
    jobs: Mutex<Vec<SetupJob>>,
    plans: Mutex<HashMap<String, Prepared>>,
    emit: Arc<dyn Fn(SetupJob) + Send + Sync>,
    #[cfg(windows)]
    monitors: Mutex<HashMap<String, Arc<Mutex<progress::Monitor>>>>,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn profile_valid(profile: &str) -> Result<()> {
    if profile.is_empty() || profile.len() > 200 || profile.chars().any(char::is_control) {
        Err("setup_profile")
    } else {
        Ok(())
    }
}

fn linked(meta: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        meta.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    {
        meta.file_type().is_symlink()
    }
}

// Inspect every ancestor: canonicalizing first would silently follow a junction.
fn plain_path(path: &Path) -> Result<PathBuf> {
    if !path.is_absolute()
        || path.as_os_str().len() > 8192
        || path.as_os_str().to_string_lossy().contains('\0')
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir))
    {
        return Err("setup_path");
    }
    let mut current = PathBuf::new();
    for component in path.components() {
        current.push(component);
        if matches!(component, Component::Prefix(_)) {
            continue;
        }
        let metadata = fs::symlink_metadata(&current).map_err(|_| "setup_read")?;
        if linked(&metadata) {
            return Err("setup_path");
        }
    }
    dunce::canonicalize(path).map_err(|_| "setup_read")
}

fn within(path: &Path, root: &Path) -> bool {
    #[cfg(windows)]
    {
        // Win32 path identity is case-insensitive, including the drive prefix.
        let path = path.to_string_lossy().replace('/', "\\").to_lowercase();
        let root = root.to_string_lossy().replace('/', "\\").to_lowercase();
        path == root || path.starts_with(&format!("{}\\", root.trim_end_matches('\\')))
    }
    #[cfg(not(windows))]
    {
        path.starts_with(root)
    }
}

#[cfg(windows)]
fn file_identity(file: &File, _: &fs::Metadata) -> Result<(u64, u64)> {
    use std::os::windows::io::AsRawHandle;
    use windows::Win32::{
        Foundation::HANDLE,
        Storage::FileSystem::{GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION},
    };
    let mut information = BY_HANDLE_FILE_INFORMATION::default();
    unsafe { GetFileInformationByHandle(HANDLE(file.as_raw_handle()), &mut information) }
        .map_err(|_| "setup_read")?;
    Ok((
        u64::from(information.dwVolumeSerialNumber),
        (u64::from(information.nFileIndexHigh) << 32) | u64::from(information.nFileIndexLow),
    ))
}

#[cfg(unix)]
fn file_identity(_: &File, metadata: &fs::Metadata) -> Result<(u64, u64)> {
    use std::os::unix::fs::MetadataExt;
    Ok((metadata.dev(), metadata.ino()))
}

#[cfg(not(any(unix, windows)))]
fn file_identity(_: &File, _: &fs::Metadata) -> Result<(u64, u64)> {
    Err("setup_platform")
}

fn fingerprint(file: &File) -> Result<Fingerprint> {
    let metadata = file.metadata().map_err(|_| "setup_read")?;
    if !metadata.is_file() || linked(&metadata) {
        return Err("setup_path");
    }
    Ok(Fingerprint {
        bytes: metadata.len(),
        modified: metadata.modified().map_err(|_| "setup_read")?,
        identity: file_identity(file, &metadata)?,
    })
}

/// Read a declared local application's artwork without running it or loading its code.
pub(super) fn application_icon(path: &Path, index: i32) -> Option<String> {
    let path = plain_path(path).ok()?;
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.share_mode(1);
    }
    let mut file = options.open(&path).ok()?;
    let stamp = fingerprint(&file).ok()?;
    if stamp.bytes == 0 || stamp.bytes > 512 * 1024 * 1024 {
        return None;
    }
    let mut header = [0; 2];
    file.read_exact(&mut header).ok()?;
    if index != 0 && header != *b"MZ" { return None; }
    if header == *b"MZ" && !valid_pe(&mut file) {
        return None;
    }
    let result = icon::read_index(&path, &stamp, index);
    if fingerprint(&file).ok()? != stamp || plain_path(&path).ok()? != path
        || fingerprint(&File::open(&path).ok()?).ok()? != stamp {
        return None;
    }
    result
}

// This verifies the executable container, not the publisher or safety of its code.
fn valid_pe(file: &mut File) -> bool {
    let mut read = || -> std::io::Result<bool> {
        let length = file.metadata()?.len();
        let mut dos = [0u8; 64];
        file.seek(SeekFrom::Start(0))?;
        file.read_exact(&mut dos)?;
        if &dos[..2] != b"MZ" {
            return Ok(false);
        }
        let offset = u32::from_le_bytes(dos[60..64].try_into().unwrap()) as u64;
        if !(64..=1024 * 1024).contains(&offset) || offset + 24 > length {
            return Ok(false);
        }
        file.seek(SeekFrom::Start(offset))?;
        let mut coff = [0u8; 24];
        file.read_exact(&mut coff)?;
        let machine = u16::from_le_bytes(coff[4..6].try_into().unwrap());
        let sections = u16::from_le_bytes(coff[6..8].try_into().unwrap()) as u64;
        let optional_size = u16::from_le_bytes(coff[20..22].try_into().unwrap()) as u64;
        let characteristics = u16::from_le_bytes(coff[22..24].try_into().unwrap());
        if &coff[..4] != b"PE\0\0"
            || ![0x14c, 0x8664, 0xaa64, 0x1c4].contains(&machine)
            || !(1..=96).contains(&sections)
            || !(96..=4096).contains(&optional_size)
            || characteristics & 0x0002 == 0
            || characteristics & 0x2000 != 0
            || offset + 24 + optional_size + sections * 40 > length
        {
            return Ok(false);
        }
        let mut magic = [0u8; 2];
        file.read_exact(&mut magic)?;
        if ![0x10b, 0x20b].contains(&u16::from_le_bytes(magic)) {
            return Ok(false);
        }
        file.seek(SeekFrom::Start(offset + 24 + optional_size))?;
        for _ in 0..sections {
            let mut section = [0u8; 40];
            file.read_exact(&mut section)?;
            let bytes = u32::from_le_bytes(section[16..20].try_into().unwrap()) as u64;
            let start = u32::from_le_bytes(section[20..24].try_into().unwrap()) as u64;
            if bytes > 0 && (start == 0 || start + bytes > length) {
                return Ok(false);
            }
        }
        Ok(true)
    };
    read().unwrap_or(false)
}

fn inno_marker(bytes: &[u8]) -> bool {
    const PREFIX: &[u8] = b"Inno Setup Setup Data (";
    bytes
        .windows(PREFIX.len())
        .enumerate()
        .any(|(index, value)| {
            if value != PREFIX {
                return false;
            }
            let version = &bytes[index + PREFIX.len()..];
            let end = version.iter().take(32).position(|byte| *byte == b')');
            end.is_some_and(|end| {
                end >= 3
                    && version[0].is_ascii_digit()
                    && version[..end].contains(&b'.')
                    && version[..end]
                        .iter()
                        .all(|byte| byte.is_ascii_alphanumeric() || b".- ".contains(byte))
            })
        })
}

fn installer_engine(file: &mut File, budget: &mut u64) -> Option<SetupEngine> {
    if !valid_pe(file) {
        return None;
    }
    let length = file.metadata().ok()?.len();
    let amount = length.min(ENGINE_FILE_LIMIT).min(*budget);
    if amount == 0 {
        return None;
    }
    *budget -= amount;
    let mut bytes = vec![0; amount as usize];
    // Most setup loaders store their data marker near the front. Also inspect the tail
    // of large single-file packages without reading their multi-gigabyte payloads.
    let first = if amount < length { amount / 2 } else { amount } as usize;
    file.seek(SeekFrom::Start(0)).ok()?;
    file.read_exact(&mut bytes[..first]).ok()?;
    if inno_marker(&bytes[..first]) {
        return Some(SetupEngine::Inno);
    }
    if first < bytes.len() {
        file.seek(SeekFrom::Start(length - (amount - first as u64)))
            .ok()?;
        file.read_exact(&mut bytes[first..]).ok()?;
        if inno_marker(&bytes[first..]) {
            return Some(SetupEngine::Inno);
        }
    }
    None
}

fn candidate_kind(path: &Path, metadata: &fs::Metadata) -> Option<SetupKind> {
    if metadata.len() == 0 || !metadata.is_file() || linked(metadata) {
        return None;
    }
    let name = path.file_name()?.to_string_lossy().to_ascii_lowercase();
    let extension = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_ascii_lowercase();
    let part = extension.as_bytes();
    let legacy_rar = part.len() == 3 && (b'r'..=b'z').contains(&part[0]) && part[1..].iter().all(u8::is_ascii_digit);
    if ["zip", "7z", "rar", "tar", "tgz", "iso"].contains(&extension.as_str()) || name.ends_with(".tar.gz") || legacy_rar || super::archives::split_archive(&name) {
        return Some(SetupKind::Archive);
    }
    if ["xz", "bz2"].contains(&extension.as_str()) {
        return Some(SetupKind::ExternalArchive);
    }
    if extension == "torrent" {
        return Some(SetupKind::Torrent);
    }
    // .md is also Markdown; do not turn a PC game's README into a ROM.
    if extension == "md" {
        let mut signature = [0u8; 4];
        let mut file = File::open(path).ok()?;
        file.seek(SeekFrom::Start(0x100)).ok()?;
        file.read_exact(&mut signature).ok()?;
        if &signature != b"SEGA" { return None; }
    }
    if [24, 33, 22, 18, 19, 4, 29, 35, 64, 20, 38, 21, 5, 7, 32, 23]
        .iter()
        .any(|system| super::emulation::extensions(*system).contains(&extension.as_str()))
    {
        return Some(SetupKind::Rom);
    }
    if [
        "unins",
        "vcredist",
        "vc_redist",
        "dxsetup",
        "dxwebsetup",
        "quicksfv",
        "dotnet",
        "ueprereq",
        "easyanticheat",
        "battleye",
        "redist",
        "crashreport",
        "unitycrashhandler",
    ]
    .iter()
    .any(|prefix| name.starts_with(prefix))
    {
        return None;
    }
    if super::native_package::external_installer(path, std::env::consts::OS) {
        return Some(SetupKind::Installer);
    }
    let installer_name = name.starts_with("setup") || name.starts_with("install");
    if extension == "msi" || (extension == "exe" && installer_name) {
        return Some(SetupKind::Installer);
    }
    if extension == "exe" || (cfg!(target_os = "linux") && extension == "appimage") {
        return Some(SetupKind::Game);
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if metadata.permissions().mode() & 0o111 != 0 {
            return Some(if installer_name {
                SetupKind::Installer
            } else {
                SetupKind::Game
            });
        }
    }
    None
}

fn inspect(profile: &str, source: &str) -> Result<(SetupPlan, Prepared)> {
    inspect_tree(profile, source, true)
}

fn inspect_tree(profile: &str, source: &str, recursive: bool) -> Result<(SetupPlan, Prepared)> {
    profile_valid(profile)?;
    let source = plain_path(Path::new(source))?;
    let source_meta = fs::symlink_metadata(&source).map_err(|_| "setup_read")?;
    if source.parent().is_none() || (!source_meta.is_dir() && !source_meta.is_file()) {
        return Err("setup_path");
    }
    let root = if source_meta.is_dir()
        && !source
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("app"))
    {
        source.clone()
    } else {
        source.parent().ok_or("setup_path")?.to_path_buf()
    };
    let mut stack = vec![(source.clone(), 0)];
    let mut visited = 0;
    let mut truncated = false;
    let mut candidates = Vec::new();
    let mut engine_budget = ENGINE_PLAN_LIMIT;
    while let Some((path, depth)) = stack.pop() {
        if visited >= MAX_VISITED || candidates.len() >= MAX_CANDIDATES {
            truncated = true;
            break;
        }
        visited += 1;
        let Ok(metadata) = fs::symlink_metadata(&path) else {
            truncated = true;
            continue;
        };
        if linked(&metadata) {
            continue;
        }
        if metadata.is_dir() {
            if depth > 0 && !recursive {
                continue;
            }
            // Redistributables and integrity tools are not playable game candidates.
            if depth > 0 && path.file_name().is_some_and(|name| {
                matches!(name.to_string_lossy().to_ascii_lowercase().as_str(),
                    "_redist" | "redist" | "__redist" | "_commonredist" |
                    "redistributables" | "__installer" | "directx")
            }) {
                continue;
            }
            // Treat a macOS app as one game; its helper processes are not separate library entries.
            if path
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("app"))
            {
                #[cfg(target_os = "macos")]
                if let Ok(executable) = super::native_package::bundle_executable(&path) {
                    if let Ok(stamp) = File::open(executable)
                        .and_then(|file| fingerprint(&file).map_err(std::io::Error::other))
                    {
                        candidates.push(Candidate {
                            entry: SetupEntry {
                                id: uuid::Uuid::new_v4().to_string(),
                                path: path.to_string_lossy().into_owned(),
                                relative_path: path
                                    .strip_prefix(&root)
                                    .map_err(|_| "setup_path")?
                                    .to_string_lossy()
                                    .into_owned(),
                                bytes: 0,
                                kind: SetupKind::Game,
                                engine: None,
                            },
                            fingerprint: stamp,
                        });
                    }
                }
                continue;
            }
            if depth >= MAX_DEPTH {
                truncated = true;
                continue;
            }
            // Recheck directories immediately before enumeration in case the tree changed.
            if plain_path(&path).is_err() {
                truncated = true;
                continue;
            }
            let Ok(directory) = fs::read_dir(&path) else {
                truncated = true;
                continue;
            };
            let remaining = MAX_VISITED.saturating_sub(visited + stack.len());
            let mut children = Vec::new();
            for child in directory.take(remaining + 1) {
                match child {
                    Ok(child) => children.push(child.path()),
                    Err(_) => truncated = true,
                }
            }
            if children.len() > remaining {
                children.truncate(remaining);
                truncated = true;
            }
            children.sort_by_cached_key(|path| path.to_string_lossy().to_ascii_lowercase());
            stack.extend(children.into_iter().rev().map(|child| (child, depth + 1)));
            continue;
        }
        let Some(mut kind) = candidate_kind(&path, &metadata) else {
            continue;
        };
        let Ok(canonical) = plain_path(&path) else {
            truncated = true;
            continue;
        };
        if !canonical.starts_with(&root) {
            truncated = true;
            continue;
        }
        let Ok(mut file) = File::open(&canonical) else {
            truncated = true;
            continue;
        };
        let Ok(stamp) = fingerprint(&file) else {
            truncated = true;
            continue;
        };
        let engine = if matches!(kind, SetupKind::Installer | SetupKind::Game) {
            installer_engine(&mut file, &mut engine_budget)
        } else {
            None
        };
        if engine.is_some() {
            kind = SetupKind::Installer;
        }
        candidates.push(Candidate {
            entry: SetupEntry {
                id: uuid::Uuid::new_v4().to_string(),
                path: canonical.to_string_lossy().into_owned(),
                relative_path: canonical
                    .strip_prefix(&root)
                    .map_err(|_| "setup_path")?
                    .to_string_lossy()
                    .into_owned(),
                bytes: stamp.bytes,
                kind,
                engine,
            },
            fingerprint: stamp,
        });
    }
    candidates.sort_by_cached_key(|candidate| candidate.entry.relative_path.to_ascii_lowercase());
    let plan = SetupPlan {
        token: uuid::Uuid::new_v4().to_string(),
        root: root.to_string_lossy().into_owned(),
        entries: candidates
            .iter()
            .map(|candidate| candidate.entry.clone())
            .collect(),
        truncated,
    };
    Ok((
        plan,
        Prepared {
            profile: profile.into(),
            source,
            root,
            created: Instant::now(),
            candidates,
        },
    ))
}

fn validate_candidate(prepared: &Prepared, candidate: &Candidate) -> Result<File> {
    let path = Path::new(&candidate.entry.path);
    let canonical = plain_path(path).map_err(|_| "setup_changed")?;
    if canonical != path || !canonical.starts_with(&prepared.root) {
        return Err("setup_changed");
    }
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        // Keep replacement/writes blocked through ShellExecute, while allowing the installer to read.
        options.share_mode(1);
    }
    let file = options.open(&canonical).map_err(|_| "setup_changed")?;
    if fingerprint(&file).map_err(|_| "setup_changed")? != candidate.fingerprint
        || plain_path(path).map_err(|_| "setup_changed")? != canonical
    {
        return Err("setup_changed");
    }
    Ok(file)
}

#[derive(Debug)]
struct ManagedDestination {
    path: PathBuf,
    file: File,
    identity: (u64, u64),
    cleanup_empty: bool,
}

impl ManagedDestination {
    fn prepare(value: &str, source_root: &Path) -> Result<Self> {
        let requested = Path::new(value);
        if !requested.is_absolute()
            || value.len() > 8192
            || value
                .chars()
                .any(|character| character.is_control() || character == '"')
            || requested
                .components()
                .any(|part| matches!(part, Component::ParentDir))
            || requested.file_name().is_none()
        {
            return Err("setup_destination");
        }
        let parent = plain_path(requested.parent().ok_or("setup_destination")?)
            .map_err(|_| "setup_destination")?;
        let path = parent.join(requested.file_name().ok_or("setup_destination")?);
        if within(&path, source_root) || within(source_root, &path) {
            return Err("setup_destination");
        }
        let created = match fs::symlink_metadata(&path) {
            Ok(metadata) if !linked(&metadata) && metadata.is_dir() => false,
            Ok(_) => return Err("setup_destination"),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                fs::create_dir(&path).map_err(|_| "setup_destination")?;
                true
            }
            Err(_) => return Err("setup_destination"),
        };
        let open = || -> Result<Self> {
            let canonical = plain_path(&path).map_err(|_| "setup_destination")?;
            if canonical != path
                || fs::read_dir(&path)
                    .map_err(|_| "setup_destination")?
                    .next()
                    .is_some()
            {
                return Err("setup_destination");
            }
            let mut options = OpenOptions::new();
            options.read(true);
            #[cfg(windows)]
            {
                use std::os::windows::fs::OpenOptionsExt;
                // Permit children to be installed, but keep the reviewed directory from
                // being deleted/renamed underneath the tracked installer.
                options.share_mode(1 | 2).custom_flags(0x02000000);
            }
            let file = options.open(&path).map_err(|_| "setup_destination")?;
            let metadata = file.metadata().map_err(|_| "setup_destination")?;
            let identity = file_identity(&file, &metadata).map_err(|_| "setup_destination")?;
            let value = Self {
                path: path.clone(),
                file,
                identity,
                cleanup_empty: created,
            };
            value.validate()?;
            Ok(value)
        };
        let result = open();
        if result.is_err() && created {
            let _ = fs::remove_dir(&path);
        }
        result
    }

    fn validate(&self) -> Result<()> {
        if plain_path(&self.path).map_err(|_| "setup_destination")? != self.path {
            return Err("setup_destination");
        }
        let metadata = self.file.metadata().map_err(|_| "setup_destination")?;
        if !metadata.is_dir()
            || linked(&metadata)
            || file_identity(&self.file, &metadata).map_err(|_| "setup_destination")?
                != self.identity
        {
            return Err("setup_destination");
        }
        let mut options = OpenOptions::new();
        options.read(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(1 | 2).custom_flags(0x02000000);
        }
        let current = options.open(&self.path).map_err(|_| "setup_destination")?;
        let current_metadata = current.metadata().map_err(|_| "setup_destination")?;
        if linked(&current_metadata)
            || file_identity(&current, &current_metadata).map_err(|_| "setup_destination")?
                != self.identity
        {
            return Err("setup_destination");
        }
        Ok(())
    }
}

impl Drop for ManagedDestination {
    fn drop(&mut self) {
        if self.cleanup_empty {
            // Only a directory created by this failed reservation, and only when still empty.
            // Windows may keep it open until this handle is dropped; retaining an empty
            // directory in that case is preferable to recursive cleanup.
            let _ = fs::remove_dir(&self.path);
        }
    }
}

fn destination_activity(root: &Path) -> Result<SetupActivity> {
    let root = plain_path(root).map_err(|_| "setup_destination")?;
    let mut activity = SetupActivity::default();
    let mut stack = vec![(root, 0)];
    let mut visited = 0;
    while let Some((path, depth)) = stack.pop() {
        if visited >= MAX_VISITED {
            activity.truncated = true;
            break;
        }
        visited += 1;
        let Ok(metadata) = fs::symlink_metadata(&path) else {
            activity.truncated = true;
            continue;
        };
        if linked(&metadata) {
            activity.truncated = true;
            continue;
        }
        if metadata.is_file() {
            activity.bytes = activity.bytes.saturating_add(metadata.len());
            activity.files += 1;
        } else if metadata.is_dir() {
            if depth >= MAX_DEPTH || plain_path(&path).is_err() {
                activity.truncated = true;
                continue;
            }
            let Ok(children) = fs::read_dir(&path) else {
                activity.truncated = true;
                continue;
            };
            let remaining = MAX_VISITED.saturating_sub(visited + stack.len());
            for (index, child) in children.take(remaining + 1).enumerate() {
                if index == remaining {
                    activity.truncated = true;
                    break;
                }
                match child {
                    Ok(child) => stack.push((child.path(), depth + 1)),
                    Err(_) => activity.truncated = true,
                }
            }
        }
    }
    Ok(activity)
}

fn installed_candidates(profile: &str, destination: &Path) -> Result<(Vec<String>, bool)> {
    installed_candidates_in(profile, destination, true)
}

fn installed_candidates_in(profile: &str, destination: &Path, recursive: bool) -> Result<(Vec<String>, bool)> {
    let (plan, prepared) =
        inspect_tree(profile, &destination.to_string_lossy(), recursive).map_err(|_| "setup_candidates")?;
    let mut paths = Vec::new();
    let mut truncated = plan.truncated;
    for candidate in &prepared.candidates {
        if candidate.entry.kind != SetupKind::Game {
            continue;
        }
        let Ok(mut file) = validate_candidate(&prepared, candidate) else {
            truncated = true;
            continue;
        };
        if cfg!(windows) && !valid_pe(&mut file) {
            continue;
        }
        let config = super::custom_launch::LaunchConfig {
            executable: candidate.entry.path.clone(),
            working_directory: None,
            arguments: Vec::new(),
            mode: "native".into(),
            runner: None,
            prefix: None,
            steam_directory: None,
        };
        if let Ok(config) = super::custom_launch::validate(config) {
            if plain_path(Path::new(&config.executable))
                .is_ok_and(|path| path.starts_with(destination))
            {
                if paths.len() == MAX_GAME_CANDIDATES {
                    truncated = true;
                    break;
                }
                paths.push(config.executable);
            } else {
                truncated = true;
            }
        } else {
            truncated = true;
        }
    }
    Ok((paths, truncated))
}

fn managed_arguments(destination: &Path) -> Result<String> {
    let value = destination.to_str().ok_or("setup_destination")?;
    if value
        .chars()
        .any(|character| character.is_control() || character == '"')
    {
        return Err("setup_destination");
    }
    // Custom Inno scripts may stop drawing progress labels under /VERYSILENT.
    // Retain their progress surface for monitoring and cancellation; quiet audio
    // is handled separately for the exact tracked installer process.
    Ok(format!(
        "/DIR=\"{value}\" /SILENT /NORESTART /NOCLOSEAPPLICATIONS /NOFORCECLOSEAPPLICATIONS"
    ))
}

impl Setups {
    fn load(root: PathBuf, emit: impl Fn(SetupJob) + Send + Sync + 'static) -> Result<Arc<Self>> {
        fs::create_dir_all(&root).map_err(|_| "setup_store")?;
        let root = plain_path(&root).map_err(|_| "setup_store")?;
        let path = root.join("jobs.json");
        let mut jobs = if path.exists() {
            let metadata = fs::symlink_metadata(&path).map_err(|_| "setup_store")?;
            if linked(&metadata) || !metadata.is_file() || metadata.len() > MAX_STORE_BYTES as u64 {
                return Err("setup_store");
            }
            let mut bytes = Vec::new();
            File::open(&path)
                .map_err(|_| "setup_store")?
                .take(MAX_STORE_BYTES as u64 + 1)
                .read_to_end(&mut bytes)
                .map_err(|_| "setup_store")?;
            let store: Store = serde_json::from_slice(&bytes).map_err(|_| "setup_store")?;
            let mut ids = HashSet::new();
            if store.version != 1
                || store.jobs.len() > MAX_JOBS
                || store.jobs.iter().any(|job| {
                    profile_valid(&job.profile).is_err()
                        || uuid::Uuid::parse_str(&job.id).is_err()
                        || !ids.insert(job.id.clone())
                })
            {
                return Err("setup_store");
            }
            store.jobs
        } else {
            Vec::new()
        };
        let mut changed = false;
        #[cfg(windows)]
        let mut reconnect = Vec::new();
        for job in &mut jobs {
            #[cfg(windows)]
            if matches!(job.status, SetupStatus::Running | SetupStatus::Interrupted) && job.recovery.is_some() {
                reconnect.push(job.id.clone());
            }
            if job.status == SetupStatus::Running {
                job.status = SetupStatus::Interrupted;
                if let Some(progress) = job.progress.as_mut() {
                    progress.can_reveal = false;
                    progress.can_observe = false;
                    progress.io_bytes_per_second = None;
                }
                job.updated_at = now().max(job.updated_at.saturating_add(1));
                changed = true;
            }
        }
        let value = Arc::new(Self {
            root,
            jobs: Mutex::new(jobs),
            plans: Mutex::new(HashMap::new()),
            emit: Arc::new(emit),
            #[cfg(windows)]
            monitors: Mutex::new(HashMap::new()),
        });
        if changed {
            value.persist(&value.jobs.lock().map_err(|_| "setup_store")?)?;
        }
        #[cfg(windows)]
        {
            let mut running = 0;
            for id in reconnect {
                running += usize::from(value.reconnect(&id)?);
                if running == MAX_RUNNING {
                    break;
                }
            }
        }
        Ok(value)
    }

    fn persist(&self, jobs: &[SetupJob]) -> Result<()> {
        let temporary = self.root.join(format!("jobs-{}.tmp", uuid::Uuid::new_v4()));
        let bytes = serde_json::to_vec(&Store {
            version: 1,
            jobs: jobs.to_vec(),
        })
        .map_err(|_| "setup_store")?;
        if bytes.len() > MAX_STORE_BYTES {
            return Err("setup_store");
        }
        let write = || -> std::io::Result<()> {
            let mut file = OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(&temporary)?;
            file.write_all(&bytes)?;
            file.sync_all()?;
            fs::rename(&temporary, self.root.join("jobs.json"))
        };
        if write().is_err() {
            let _ = fs::remove_file(&temporary);
            return Err("setup_store");
        }
        Ok(())
    }

    pub fn inspect(&self, profile: &str, source: &str) -> Result<SetupPlan> {
        let (plan, prepared) = inspect(profile, source)?;
        let mut plans = self.plans.lock().map_err(|_| "setup_busy")?;
        plans.retain(|_, prepared| prepared.created.elapsed() < PLAN_TTL);
        if plans.len() >= MAX_PLANS {
            if let Some(oldest) = plans
                .iter()
                .min_by_key(|(_, prepared)| prepared.created)
                .map(|(token, _)| token.clone())
            {
                plans.remove(&oldest);
            }
        }
        plans.insert(plan.token.clone(), prepared);
        Ok(plan)
    }

    pub fn list(&self, profile: &str) -> Result<Vec<SetupJob>> {
        profile_valid(profile)?;
        let mut jobs: Vec<_> = self
            .jobs
            .lock()
            .map_err(|_| "setup_store")?
            .iter()
            .filter(|job| job.profile == profile)
            .cloned()
            .collect();
        jobs.sort_by(|left, right| {
            right
                .started_at
                .cmp(&left.started_at)
                .then_with(|| right.id.cmp(&left.id))
        });
        Ok(jobs)
    }

    pub fn icon(&self, profile: &str, token: &str, candidate_id: &str) -> Result<Option<String>> {
        profile_valid(profile)?;
        let prepared = self.plans.lock().map_err(|_| "setup_busy")?
            .get(token).cloned().ok_or("setup_expired")?;
        if prepared.profile != profile { return Err("setup_selection"); }
        if prepared.created.elapsed() >= PLAN_TTL { return Err("setup_expired"); }
        let candidate = prepared.candidates.iter()
            .find(|candidate| candidate.entry.id == candidate_id && candidate.entry.kind == SetupKind::Game)
            .ok_or("setup_selection")?;
        let path = Path::new(&candidate.entry.path);
        #[cfg(target_os = "macos")]
        if path.is_dir() && path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("app")) {
            if plain_path(path).map_err(|_| "setup_changed")? != path || !path.starts_with(&prepared.root) { return Err("setup_changed"); }
            let executable = super::native_package::bundle_executable(path).map_err(|_| "setup_changed")?;
            let executable = plain_path(&executable).map_err(|_| "setup_changed")?;
            let held = File::open(&executable).map_err(|_| "setup_changed")?;
            if fingerprint(&held).map_err(|_| "setup_changed")? != candidate.fingerprint { return Err("setup_changed"); }
            let image = icon::read(path, &candidate.fingerprint);
            let current = File::open(&executable).map_err(|_| "setup_changed")?;
            if super::native_package::bundle_executable(path).map_err(|_| "setup_changed")? != executable
                || fingerprint(&held).map_err(|_| "setup_changed")? != candidate.fingerprint
                || fingerprint(&current).map_err(|_| "setup_changed")? != candidate.fingerprint { return Err("setup_changed"); }
            return Ok(image);
        }
        let mut held = validate_candidate(&prepared, candidate)?;
        let mut header = [0u8; 2];
        if held.read_exact(&mut header).is_err() { return Ok(None); }
        if header == *b"MZ" && (candidate.fingerprint.bytes > 512 * 1024 * 1024 || !valid_pe(&mut held)) { return Ok(None); }
        let image = icon::read(path, &candidate.fingerprint);
        // Keep the reviewed executable held while reading its icon, then recheck identity.
        let _verified = validate_candidate(&prepared, candidate)?;
        Ok(image)
    }

    /// Rediscover an existing installation without launching or changing its verification result.
    pub fn recover(&self, profile: &str, id: &str, destination: Option<&str>) -> Result<SetupJob> {
        profile_valid(profile)?;
        let previous = self.jobs.lock().map_err(|_| "setup_store")?
            .iter().find(|job| job.id == id && job.profile == profile)
            .cloned().ok_or("setup_plan")?;
        if previous.status == SetupStatus::Running {
            return Err("setup_busy");
        }
        let destination = plain_path(Path::new(destination.or(previous.destination.as_deref())
            .ok_or("setup_destination")?)).map_err(|_| "setup_destination")?;
        let source = Path::new(&previous.source);
        let source_root = if previous.source == previous.installer
            || fs::symlink_metadata(source).is_ok_and(|meta| meta.is_file())
        {
            source.parent().ok_or("setup_destination")?
        } else {
            source
        };
        if destination.parent().is_none()
            || !fs::symlink_metadata(&destination).is_ok_and(|meta| meta.is_dir())
            || within(&destination, source_root)
            || within(source_root, &destination)
        {
            return Err("setup_destination");
        }
        let (paths, truncated) = installed_candidates(profile, &destination)?;
        let (root_paths, root_truncated) = installed_candidates_in(profile, &destination, false)?;
        if paths.is_empty() && root_paths.is_empty() {
            return Err("setup_candidates");
        }
        let mut jobs = self.jobs.lock().map_err(|_| "setup_store")?;
        let index = jobs.iter().position(|job| job.id == id && job.profile == profile)
            .ok_or("setup_plan")?;
        if jobs[index].status == SetupStatus::Running || jobs[index].updated_at != previous.updated_at {
            return Err("setup_busy");
        }
        // Persist first so a failed store write cannot report a successful recovery in memory.
        let mut next = jobs.clone();
        let job = &mut next[index];
        job.destination = Some(destination.to_string_lossy().into_owned());
        job.game_candidates = paths;
        job.scan_truncated = truncated;
        job.root_game_candidates = root_paths;
        job.root_candidates_complete = !root_truncated;
        job.updated_at = now().max(previous.updated_at.saturating_add(1));
        let event = job.clone();
        self.persist(&next)?;
        *jobs = next;
        drop(jobs);
        (self.emit)(event.clone());
        Ok(event)
    }

    #[cfg(test)]
    fn reserve(&self, profile: &str, token: &str, candidate_id: &str) -> Result<(SetupJob, File)> {
        self.reserve_destination(profile, token, candidate_id, None)
            .map(|(job, file, _)| (job, file))
    }

    fn reserve_destination(
        &self,
        profile: &str,
        token: &str,
        candidate_id: &str,
        destination: Option<&str>,
    ) -> Result<(SetupJob, File, Option<ManagedDestination>)> {
        profile_valid(profile)?;
        let mut plans = self.plans.lock().map_err(|_| "setup_busy")?;
        let prepared = plans.get(token).ok_or("setup_expired")?;
        if prepared.profile != profile {
            return Err("setup_selection");
        }
        if prepared.created.elapsed() >= PLAN_TTL {
            plans.remove(token);
            return Err("setup_expired");
        }
        let candidate = prepared
            .candidates
            .iter()
            .find(|candidate| candidate.entry.id == candidate_id)
            .ok_or("setup_selection")?;
        if candidate.entry.kind != SetupKind::Installer {
            return Err("setup_selection");
        }
        let mut file = validate_candidate(prepared, candidate)?;
        if destination.is_some() {
            if !cfg!(windows) {
                return Err("setup_platform");
            }
            let mut engine_budget = ENGINE_FILE_LIMIT;
            if candidate.entry.engine != Some(SetupEngine::Inno)
                || installer_engine(&mut file, &mut engine_budget) != Some(SetupEngine::Inno)
            {
                return Err("setup_engine");
            }
        }
        let mut held = self.jobs.lock().map_err(|_| "setup_store")?;
        if held
            .iter()
            .filter(|job| job.status == SetupStatus::Running)
            .count()
            >= MAX_RUNNING
            || held.iter().any(|job| {
                job.status == SetupStatus::Running && job.installer == candidate.entry.path
            })
        {
            return Err("setup_busy");
        }
        let mut managed = destination
            .map(|value| ManagedDestination::prepare(value, &prepared.root))
            .transpose()?;
        if managed.as_ref().is_some_and(|destination| {
            held.iter().any(|job| {
                job.status == SetupStatus::Running
                    && job.destination.as_deref().is_some_and(|value| {
                        let path = Path::new(value);
                        within(path, &destination.path) || within(&destination.path, path)
                    })
            })
        }) {
            return Err("setup_busy");
        }
        let timestamp = now();
        let job = SetupJob {
            id: uuid::Uuid::new_v4().to_string(),
            profile: profile.into(),
            source: prepared.source.to_string_lossy().into_owned(),
            installer: candidate.entry.path.clone(),
            started_at: timestamp,
            updated_at: timestamp,
            status: SetupStatus::Running,
            exit_code: None,
            error: None,
            engine: candidate.entry.engine.clone(),
            destination: managed
                .as_ref()
                .map(|value| value.path.to_string_lossy().into_owned()),
            activity: managed.as_ref().map(|_| SetupActivity::default()),
            progress: None,
            game_candidates: Vec::new(),
            scan_truncated: false,
            root_game_candidates: Vec::new(),
            root_candidates_complete: false,
            reconnected_at: None,
            recovery: None,
        };
        let mut jobs = held.clone();
        jobs.sort_by_key(|job| job.started_at);
        while jobs.len() >= MAX_JOBS {
            let index = jobs
                .iter()
                .position(|job| job.status != SetupStatus::Running)
                .ok_or("setup_busy")?;
            jobs.remove(index);
        }
        jobs.push(job.clone());
        self.persist(&jobs)?;
        *held = jobs;
        plans.remove(token);
        if let Some(destination) = managed.as_mut() {
            destination.cleanup_empty = false;
        }
        Ok((job, file, managed))
    }

    fn record_activity(&self, id: &str, activity: SetupActivity) -> Result<()> {
        let mut jobs = self.jobs.lock().map_err(|_| "setup_store")?;
        let job = jobs
            .iter_mut()
            .find(|job| job.id == id)
            .ok_or("setup_store")?;
        if job.status != SetupStatus::Running || job.activity.as_ref() == Some(&activity) {
            return Ok(());
        }
        job.activity = Some(activity);
        job.updated_at = now().max(job.updated_at.saturating_add(1));
        let event = job.clone();
        // Activity is transient; durable transitions below persist the final snapshot.
        // Avoid syncing the entire job history on every directory sample.
        drop(jobs);
        (self.emit)(event);
        Ok(())
    }

    #[cfg(windows)]
    fn record_progress(&self, id: &str, progress: SetupProgress) -> Result<()> {
        let mut jobs = self.jobs.lock().map_err(|_| "setup_store")?;
        let job = jobs
            .iter_mut()
            .find(|job| job.id == id)
            .ok_or("setup_store")?;
        if job.status != SetupStatus::Running {
            return Ok(());
        }
        job.progress = Some(progress);
        job.updated_at = now().max(job.updated_at.saturating_add(1));
        let event = job.clone();
        drop(jobs);
        (self.emit)(event);
        Ok(())
    }

    pub fn reveal(&self, profile: &str, id: &str) -> Result<()> {
        profile_valid(profile)?;
        let running = self
            .jobs
            .lock()
            .map_err(|_| "setup_store")?
            .iter()
            .any(|job| {
                job.profile == profile && job.id == id && job.status == SetupStatus::Running
            });
        if !running {
            return Err("setup_window");
        }
        #[cfg(windows)]
        {
            let monitor = self
                .monitors
                .lock()
                .map_err(|_| "setup_store")?
                .get(id)
                .cloned()
                .ok_or("setup_window")?;
            if monitor.lock().map_err(|_| "setup_window")?.reveal() {
                return Ok(());
            }
        }
        Err("setup_window")
    }

    fn record_candidates(&self, id: &str, paths: Vec<String>, truncated: bool, root_paths: Vec<String>, root_complete: bool) -> Result<()> {
        let mut jobs = self.jobs.lock().map_err(|_| "setup_store")?;
        let job = jobs
            .iter_mut()
            .find(|job| job.id == id)
            .ok_or("setup_store")?;
        job.game_candidates = paths;
        job.scan_truncated = truncated;
        job.root_game_candidates = root_paths;
        job.root_candidates_complete = root_complete;
        Ok(())
    }

    pub fn observe(&self, profile: &str, id: &str) -> Result<()> {
        profile_valid(profile)?;
        let running = self
            .jobs
            .lock()
            .map_err(|_| "setup_store")?
            .iter()
            .any(|job| {
                job.profile == profile && job.id == id && job.status == SetupStatus::Running
            });
        if !running {
            return Err("setup_window");
        }
        #[cfg(windows)]
        {
            let monitor = self
                .monitors
                .lock()
                .map_err(|_| "setup_store")?
                .get(id)
                .cloned()
                .ok_or("setup_window")?;
            monitor.lock().map_err(|_| "setup_window")?.observe();
            return Ok(());
        }
        #[cfg(not(windows))]
        Err("setup_window")
    }

    fn finish(
        &self,
        id: &str,
        status: SetupStatus,
        exit_code: Option<u32>,
        error: Option<&str>,
    ) -> Result<SetupJob> {
        let mut jobs = self.jobs.lock().map_err(|_| "setup_store")?;
        let job = jobs
            .iter_mut()
            .find(|job| job.id == id)
            .ok_or("setup_store")?;
        job.status = status;
        job.recovery = None;
        if let Some(progress) = job.progress.as_mut() {
            progress.can_reveal = false;
            progress.can_observe = false;
            progress.io_bytes_per_second = None;
        }
        job.exit_code = exit_code;
        job.error = error.map(String::from);
        job.updated_at = now().max(job.updated_at.saturating_add(1));
        let mut event = job.clone();
        if self.persist(&jobs).is_err() {
            event.error = Some("setup_store".into());
            if let Some(job) = jobs.iter_mut().find(|job| job.id == id) {
                job.error = event.error.clone();
            }
        }
        drop(jobs);
        #[cfg(windows)]
        if let Ok(mut monitors) = self.monitors.lock() {
            monitors.remove(id);
        }
        (self.emit)(event.clone());
        Ok(event)
    }

    pub fn start(
        self: &Arc<Self>,
        profile: &str,
        token: &str,
        candidate_id: &str,
        destination: Option<&str>,
    ) -> Result<SetupJob> {
        let (job, reviewed_file, managed) =
            self.reserve_destination(profile, token, candidate_id, destination)?;
        (self.emit)(job.clone());
        let launched = (|| {
            if let Some(destination) = managed.as_ref() {
                destination.validate()?;
                if fs::read_dir(&destination.path)
                    .map_err(|_| "setup_destination")?
                    .next()
                    .is_some()
                {
                    return Err("setup_destination");
                }
            }
            let arguments = managed
                .as_ref()
                .map(|value| managed_arguments(&value.path))
                .transpose()?;
            launch(Path::new(&job.installer), arguments.as_deref())
        })();
        drop(reviewed_file);
        match launched {
            Err(error) => self.finish(&job.id, SetupStatus::Failed, None, Some(error)),
            Ok(None) => self.finish(&job.id, SetupStatus::External, None, None),
            Ok(Some(mut process)) => {
                #[cfg(windows)]
                let monitor = progress::Monitor::new(
                    process.0,
                    Path::new(&job.installer),
                    managed.as_ref().map(|value| value.path.as_path())
                        .unwrap_or_else(|| Path::new(&job.installer).parent().unwrap_or(Path::new(&job.source))),
                ).map(|monitor| Arc::new(Mutex::new(monitor)));
                #[cfg(windows)]
                if let Some(monitor) = monitor.as_ref() {
                    let snapshot = monitor.lock().map_err(|_| "setup_read")?
                        .checkpoint(managed.as_ref().map(|value| value.identity));
                    if self.record_recovery(&job.id, snapshot).is_err() {
                        return self.finish(&job.id, SetupStatus::External, None, Some("setup_store"));
                    }
                    if let Ok(mut monitors) = self.monitors.lock() {
                        monitors.insert(job.id.clone(), Arc::clone(monitor));
                    }
                }
                let value = Arc::clone(self);
                let id = job.id.clone();
                let profile = job.profile.clone();
                if std::thread::Builder::new()
                    .name("harbor-game-setup".into())
                    .spawn(move || {
                        let mut last_activity = Instant::now() - FILE_ACTIVITY_INTERVAL;
                        #[cfg(windows)]
                        let mut last_progress = Instant::now() - ACTIVITY_INTERVAL;
                        #[cfg(windows)]
                        let mut installer_audio = audio::Sessions::default();
                        let mut scan_error = None;
                        loop {
                            #[cfg(windows)]
                            if last_progress.elapsed() >= ACTIVITY_INTERVAL {
                                if let Some(monitor) = monitor.as_ref() {
                                    if let Ok(mut monitor) = monitor.lock() {
                                        let _ = value.record_progress(&id, monitor.sample(now()));
                                        let _ = value.record_recovery(&id, monitor.checkpoint(managed.as_ref().map(|value| value.identity)));
                                        if managed.is_some() {
                                            installer_audio.quiet(&monitor.audio_targets());
                                        }
                                    }
                                }
                                last_progress = Instant::now();
                            }
                            if let Some(destination) = managed.as_ref() {
                                if last_activity.elapsed() >= FILE_ACTIVITY_INTERVAL {
                                    match destination
                                        .validate()
                                        .and_then(|_| destination_activity(&destination.path))
                                    {
                                        Ok(activity) => {
                                            let _ = value.record_activity(&id, activity);
                                        }
                                        Err(error) => scan_error = Some(error),
                                    }
                                    last_activity = Instant::now();
                                }
                            }
                            let code = match process.poll() {
                                Ok(Some(code)) => code,
                                Ok(None) => {
                                    std::thread::sleep(Duration::from_millis(200));
                                    continue;
                                }
                                Err(error) => {
                                    let _ = value.finish(
                                        &id,
                                        SetupStatus::Interrupted,
                                        None,
                                        Some(error),
                                    );
                                    break;
                                }
                            };
                            // Bootstrap exit is not installation completion: keep tracking
                            // its held, identity-checked descendants (including file checkers).
                            #[cfg(windows)]
                            if managed.is_some() && monitor.is_none() {
                                let _ = value.finish(
                                    &id,
                                    SetupStatus::External,
                                    Some(code),
                                    Some("setup_read"),
                                );
                                break;
                            }
                            #[cfg(windows)]
                            if let Some(monitor) = monitor.as_ref() {
                                let state = monitor.lock().map(|mut monitor| {
                                    (monitor.children_running(), monitor.verification_result())
                                });
                                match state {
                                    Ok((true, _)) => {
                                        std::thread::sleep(Duration::from_millis(200));
                                        continue;
                                    }
                                    Ok((false, Some(error))) => {
                                        let _ = value.finish(
                                            &id,
                                            if error == "setup_verification" {
                                                SetupStatus::Failed
                                            } else {
                                                SetupStatus::External
                                            },
                                            Some(code),
                                            Some(error),
                                        );
                                        break;
                                    }
                                    Err(_) => {
                                        let _ = value.finish(
                                            &id,
                                            SetupStatus::Interrupted,
                                            Some(code),
                                            Some("setup_read"),
                                        );
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                            if let Some(destination) = managed.as_ref() {
                                match destination
                                    .validate()
                                    .and_then(|_| destination_activity(&destination.path))
                                {
                                    Ok(activity) => {
                                        let _ = value.record_activity(&id, activity);
                                    }
                                    Err(error) => scan_error = Some(error),
                                }
                                if code == 0 && scan_error.is_none() {
                                    match installed_candidates(&profile, &destination.path) {
                                        Ok((paths, truncated)) => {
                                            let (root_paths, root_complete) = match installed_candidates_in(&profile, &destination.path, false) {
                                                Ok((paths, truncated)) => (paths, !truncated),
                                                Err(_) => (Vec::new(), false),
                                            };
                                            let _ = value.record_candidates(&id, paths, truncated, root_paths, root_complete);
                                        }
                                        Err(error) => scan_error = Some(error),
                                    }
                                }
                            }
                            let _ = value.finish(
                                &id,
                                if code == 0 {
                                    SetupStatus::Finished
                                } else {
                                    SetupStatus::Failed
                                },
                                Some(code),
                                scan_error,
                            );
                            break;
                        }
                        #[cfg(windows)]
                        installer_audio.restore();
                    })
                    .is_err()
                {
                    return self.finish(&job.id, SetupStatus::External, None, Some("setup_read"));
                }
                Ok(job)
            }
        }
    }
}

#[cfg(windows)]
struct Process(usize);

#[cfg(windows)]
impl Process {
    fn poll(&mut self) -> Result<Option<u32>> {
        use windows::Win32::{
            Foundation::{HANDLE, WAIT_OBJECT_0, WAIT_TIMEOUT},
            System::Threading::{GetExitCodeProcess, WaitForSingleObject},
        };
        let handle = HANDLE(self.0 as *mut std::ffi::c_void);
        let result = unsafe { WaitForSingleObject(handle, 0) };
        if result == WAIT_TIMEOUT {
            return Ok(None);
        }
        if result != WAIT_OBJECT_0 {
            return Err("setup_read");
        }
        let mut code = 0;
        unsafe { GetExitCodeProcess(handle, &mut code) }.map_err(|_| "setup_read")?;
        Ok(Some(code))
    }
}

#[cfg(windows)]
impl Drop for Process {
    fn drop(&mut self) {
        // Closing our handle never terminates the installer, including on window/app exit.
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(windows::Win32::Foundation::HANDLE(
                self.0 as *mut std::ffi::c_void,
            ));
        }
    }
}

#[cfg(windows)]
fn launch(path: &Path, arguments: Option<&str>) -> Result<Option<Process>> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{
        core::PCWSTR,
        Win32::UI::{
            Shell::{
                ShellExecuteExW, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
            },
            WindowsAndMessaging::SW_SHOWNORMAL,
        },
    };
    // Shell extensions may require an STA, even when the target itself is a normal executable.
    // Keep COM local to this blocking call; no new app thread/apartment policy is imposed.
    #[link(name = "ole32")]
    unsafe extern "system" {
        fn CoInitializeEx(reserved: *mut std::ffi::c_void, flags: u32) -> i32;
        fn CoUninitialize();
    }
    struct Apartment(bool);
    impl Drop for Apartment {
        fn drop(&mut self) {
            if self.0 {
                unsafe {
                    CoUninitialize();
                }
            }
        }
    }
    let initialized = unsafe { CoInitializeEx(std::ptr::null_mut(), 2 | 4) };
    if initialized < 0 && initialized as u32 != 0x80010106 {
        return Err("setup_start");
    }
    let _apartment = Apartment(initialized >= 0);
    let verb: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
    let file: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let parameters: Vec<u16> = arguments
        .unwrap_or("")
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let directory: Vec<u16> = path
        .parent()
        .ok_or("setup_path")?
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC,
        lpVerb: PCWSTR(verb.as_ptr()),
        lpFile: PCWSTR(file.as_ptr()),
        lpParameters: if arguments.is_some() {
            PCWSTR(parameters.as_ptr())
        } else {
            PCWSTR::null()
        },
        lpDirectory: PCWSTR(directory.as_ptr()),
        nShow: SW_SHOWNORMAL.0,
        ..Default::default()
    };
    // Managed Inno uses a fixed documented argument set. Manual starts have no arguments.
    // The OS still handles the installer manifest/UAC, and installer errors/cancellation stay visible.
    unsafe { ShellExecuteExW(&mut info) }.map_err(|error| {
        if error.code().0 as u32 == 0x800704c7 {
            "setup_canceled"
        } else {
            "setup_start"
        }
    })?;
    Ok(if info.hProcess.is_invalid() {
        None
    } else {
        Some(Process(info.hProcess.0 as usize))
    })
}

#[cfg(not(windows))]
struct Process(std::process::Child);

#[cfg(not(windows))]
impl Process {
    fn poll(&mut self) -> Result<Option<u32>> {
        self.0
            .try_wait()
            .map_err(|_| "setup_read")?
            .map(|status| status.code().map(|code| code as u32).ok_or("setup_read"))
            .transpose()
    }
}

#[cfg(not(windows))]
fn launch(path: &Path, arguments: Option<&str>) -> Result<Option<Process>> {
    let extension = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_ascii_lowercase();
    if extension == "exe" || extension == "msi" || arguments.is_some() {
        return Err("setup_platform");
    }
    if super::native_package::external_installer(path, std::env::consts::OS) {
        let opener = if cfg!(target_os = "macos") {
            "/usr/bin/open"
        } else {
            "xdg-open"
        };
        let status = std::process::Command::new(opener)
            .arg(path)
            .status()
            .map_err(|_| "setup_start")?;
        return if status.success() {
            Ok(None)
        } else {
            Err("setup_start")
        };
    }
    std::process::Command::new(path)
        .current_dir(path.parent().ok_or("setup_path")?)
        .spawn()
        .map(|process| Some(Process(process)))
        .map_err(|_| "setup_start")
}

pub fn manager(app: &tauri::AppHandle) -> Result<Arc<Setups>> {
    static INSTANCE: OnceLock<Mutex<Option<Arc<Setups>>>> = OnceLock::new();
    let mut held = INSTANCE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|_| "setup_store")?;
    if let Some(value) = held.as_ref() {
        return Ok(Arc::clone(value));
    }
    let root = app
        .path()
        .app_data_dir()
        .map_err(|_| "setup_store")?
        .join("game-setup");
    let app = app.clone();
    let value = Setups::load(root, move |event| {
        let _ = app.emit("games:setup-job", event);
    })?;
    *held = Some(Arc::clone(&value));
    Ok(value)
}

#[cfg(test)]
#[path = "setup_tests.rs"]
mod tests;
