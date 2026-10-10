use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};
use zeroize::Zeroizing;
use zip::{CompressionMethod, ZipArchive};

type Result<T> = std::result::Result<T, &'static str>;
const MAX_ARCHIVE: u64 = 64 * 1024 * 1024 * 1024;
const MAX_EXPANDED: u64 = 256 * 1024 * 1024 * 1024;
const MAX_ENTRIES: usize = 100_000;
const PLAN_TTL: Duration = Duration::from_secs(15 * 60);
const SPACE_HEADROOM: u64 = 64 * 1024 * 1024;
#[path = "archive_parts.rs"]
mod parts;
pub use parts::ArchivePart;
pub(super) use parts::split_archive;
pub(super) use parts::{candidate as preparation_candidate,same_family as preparation_family};

#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    pub path: String,
    pub bytes: u64,
    pub directory: bool,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchivePlan {
    pub token: String,
    pub source: String,
    pub archive_bytes: u64,
    pub expanded_bytes: u64,
    pub file_count: usize,
    pub directory_count: usize,
    pub sha256: String,
    pub entries: Vec<ArchiveEntry>,
    pub executable_count: usize,
    pub parts: Vec<ArchivePart>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveProgress {
    pub profile: String,
    pub operation_id: String,
    pub phase: String,
    pub bytes: u64,
    pub total_bytes: u64,
    pub files: usize,
    pub total_files: usize,
    #[serde(default)]
    pub current_file: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveReceipt {
    pub destination: String,
    pub source: String,
    pub sha256: String,
    pub files: usize,
    pub bytes: u64,
    #[serde(default)]
    pub parts: Vec<ArchivePart>,
}
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveSpace {
    pub volume: Option<String>,
    pub available_bytes: Option<u64>,
    pub expanded_bytes: u64,
    pub reserved_bytes: u64,
    pub after_bytes: Option<u64>,
    pub shortfall_bytes: Option<u64>,
}
#[derive(Clone)]
struct Prepared {
    profile: String,
    created: Instant,
    path: PathBuf,
    paths: Vec<PathBuf>,
    plan: ArchivePlan,
    // Kept only for this reviewed operation, never in a plan, event or job receipt.
    password: Option<Arc<Zeroizing<String>>>,
}
struct Job {
    profile: String,
    id: String,
    cancel: Arc<AtomicBool>,
}
pub(super) struct Work(Job);
fn plans() -> &'static Mutex<HashMap<String, Prepared>> {
    static VALUE: OnceLock<Mutex<HashMap<String, Prepared>>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(HashMap::new()))
}
fn job() -> &'static Mutex<Option<Job>> {
    static VALUE: OnceLock<Mutex<Option<Job>>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(None))
}
impl Drop for Work {
    fn drop(&mut self) {
        if let Ok(mut active) = job().lock() {
            if active
                .as_ref()
                .is_some_and(|work| work.id == self.0.id && work.profile == self.0.profile)
            {
                *active = None;
            }
        }
    }
}
pub(super) fn start(profile: &str, id: &str) -> Result<Work> {
    if profile.is_empty() || profile.len() > 160 || profile.chars().any(char::is_control) {
        return Err("archive_profile");
    }
    uuid::Uuid::parse_str(id).map_err(|_| "archive_profile")?;
    let mut active = job().lock().map_err(|_| "archive_busy")?;
    if active.is_some() {
        return Err("archive_busy");
    }
    let cancel = Arc::new(AtomicBool::new(false));
    *active = Some(Job {
        profile: profile.into(),
        id: id.into(),
        cancel: cancel.clone(),
    });
    Ok(Work(Job {
        profile: profile.into(),
        id: id.into(),
        cancel,
    }))
}
pub(super) fn is_busy()->bool{job().lock().map(|active|active.is_some()).unwrap_or(true)}
pub fn cancel(profile: String, operation_id: String) {
    if let Ok(active) = job().lock() {
        if let Some(active) = active
            .as_ref()
            .filter(|v| v.profile == profile && v.id == operation_id)
        {
            active.cancel.store(true, Ordering::Relaxed);
        }
    }
}
pub fn discard(profile: String, token: String) {
    if let Ok(mut held) = plans().lock() {
        if held.get(&token).is_some_and(|v| v.profile == profile) {
            held.remove(&token);
        }
    }
}
pub(super) fn canceled(work: &Work) -> Result<()> {
    if work.0.cancel.load(Ordering::Relaxed) {
        Err("archive_canceled")
    } else {
        Ok(())
    }
}
fn announce(
    work: &Work,
    phase: &str,
    bytes: u64,
    total: u64,
    files: usize,
    count: usize,
    emit: &impl Fn(ArchiveProgress),
) {
    emit(ArchiveProgress {
        profile: work.0.profile.clone(),
        operation_id: work.0.id.clone(),
        phase: phase.into(),
        bytes,
        total_bytes: total,
        files,
        total_files: count,
        current_file: None,
    });
}
fn metadata(path: &Path) -> Result<fs::Metadata> {
    let data = fs::symlink_metadata(path).map_err(|_| "archive_read")?;
    if !data.is_file() || super::save_files::reparse(&data) {
        return Err("archive_links");
    }
    if data.len() > MAX_ARCHIVE {
        return Err("archive_limit");
    }
    Ok(data)
}
fn unchanged(path: &Path, before: &fs::Metadata) -> Result<()> {
    let after = metadata(path)?;
    if after.len() != before.len() || after.modified().ok() != before.modified().ok() {
        return Err("archive_changed");
    }
    Ok(())
}
pub(super) fn cleanup_fingerprint(path:&Path,work:&Work,emit:&impl Fn(ArchiveProgress))->Result<ArchivePart>{
    let before=metadata(path)?;
    let mut options=fs::OpenOptions::new(); options.read(true);
    #[cfg(windows)] {use std::os::windows::fs::OpenOptionsExt;options.share_mode(1);}
    let mut file=options.open(path).map_err(|_|"archive_read")?;
    let sha256=hash(&mut file,work,before.len(),emit)?;
    unchanged(path,&before)?;
    Ok(ArchivePart{name:path.file_name().and_then(|v|v.to_str()).ok_or("archive_path")?.into(),bytes:before.len(),sha256})
}
fn hash(
    file: &mut File,
    work: &Work,
    total: u64,
    emit: &impl Fn(ArchiveProgress),
) -> Result<String> {
    file.seek(SeekFrom::Start(0)).map_err(|_| "archive_read")?;
    let mut sha = Sha256::new();
    let mut buffer = vec![0; 1024 * 1024];
    let mut count = 0;
    let mut last = Instant::now();
    announce(work, "checking", 0, total, 0, 0, emit);
    loop {
        canceled(work)?;
        let n = file.read(&mut buffer).map_err(|_| "archive_read")?;
        if n == 0 {
            break;
        }
        count += n as u64;
        if count > MAX_ARCHIVE {
            return Err("archive_limit");
        }
        sha.update(&buffer[..n]);
        if last.elapsed() > Duration::from_millis(100) {
            announce(work, "checking", count, total, 0, 0, emit);
            last = Instant::now();
        }
    }
    if count != total {
        return Err("archive_changed");
    }
    file.seek(SeekFrom::Start(0)).map_err(|_| "archive_read")?;
    Ok(format!("{:x}", sha.finalize()))
}
fn relative(name: &str, directory: bool) -> Result<String> {
    let clean = if directory {
        name.trim_end_matches('/')
    } else {
        name
    };
    if clean.is_empty()
        || clean.len() > 2048
        || clean.starts_with('/')
        || clean.contains(['\\', ':', '\0', '<', '>', '"', '|', '?', '*'])
        || clean.chars().any(char::is_control)
    {
        return Err("archive_path");
    }
    let parts: Vec<_> = clean.split('/').collect();
    if parts.len() > 32 {
        return Err("archive_limit");
    }
    for part in &parts {
        let upper = part.split('.').next().unwrap_or("").to_ascii_uppercase();
        if part.is_empty()
            || *part == "."
            || *part == ".."
            || part.ends_with(['.', ' '])
            || part.len() > 240
            || ["CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$"].contains(&upper.as_str())
            || ((upper.starts_with("COM") || upper.starts_with("LPT"))
                && upper.len() == 4
                && upper.as_bytes()[3].is_ascii_digit())
        {
            return Err("archive_path");
        }
    }
    Ok(clean.into())
}
// Bound central-directory allocations before handing the archive to the ZIP reader.
pub(super) fn preflight(file: &mut (impl Read + Seek)) -> Result<usize> {
    preflight_zip(file, false)
}
fn preflight_zip(file: &mut (impl Read + Seek), split: bool) -> Result<usize> {
    let length = file.seek(SeekFrom::End(0)).map_err(|_| "archive_read")?;
    let tail_len = length.min(65_557) as usize;
    let mut tail = vec![0; tail_len];
    file.seek(SeekFrom::End(-(tail_len as i64)))
        .map_err(|_| "archive_read")?;
    file.read_exact(&mut tail).map_err(|_| "archive_read")?;
    let u16at = |bytes: &[u8], i: usize| u16::from_le_bytes([bytes[i], bytes[i + 1]]) as u64;
    let u32at =
        |bytes: &[u8], i: usize| u32::from_le_bytes(bytes[i..i + 4].try_into().unwrap()) as u64;
    let u64at = |bytes: &[u8], i: usize| u64::from_le_bytes(bytes[i..i + 8].try_into().unwrap());
    let end = (0..tail_len.saturating_sub(21))
        .rev()
        .find(|i| {
            tail[*i..].starts_with(b"PK\x05\x06")
                && *i + 22 + u16at(&tail, *i + 20) as usize == tail_len
        })
        .ok_or_else(|| {
            if !split { return "archive_format"; }
            let earlier_end = (0..tail_len.saturating_sub(21)).any(|i| {
                tail[i..].starts_with(b"PK\x05\x06") && i + 22 + (u16at(&tail, i + 20) as usize) < tail_len
            });
            if earlier_end { "archive_parts" } else { "archive_missing_part" }
        })?;
    let footer = &tail[end..];
    if u16at(footer, 4) != 0 || u16at(footer, 6) != 0 {
        return Err("archive_multipart");
    }
    let footer_pos = length - tail_len as u64 + end as u64;
    let mut directory_end = footer_pos;
    let (mut count, mut size, mut offset) =
        (u16at(footer, 10), u32at(footer, 12), u32at(footer, 16));
    if u16at(footer, 8) != count {
        return Err("archive_format");
    }
    let requires_zip64 = count == 65_535 || size == u32::MAX as u64 || offset == u32::MAX as u64;
    let mut locator = [0; 20];
    if footer_pos >= 20 {
        file.seek(SeekFrom::Start(footer_pos - 20))
            .map_err(|_| "archive_read")?;
        file.read_exact(&mut locator).map_err(|_| "archive_read")?;
    }
    if locator.starts_with(b"PK\x06\x07") {
        if u32at(&locator, 4) != 0 || u32at(&locator, 16) != 1 { return Err("archive_multipart"); }
        let pos = u64at(&locator, 8);
        directory_end = pos;
        if pos
            .checked_add(56)
            .is_none_or(|value| value > footer_pos - 20)
        {
            return Err("archive_format");
        }
        file.seek(SeekFrom::Start(pos))
            .map_err(|_| "archive_read")?;
        let mut record = [0; 56];
        file.read_exact(&mut record).map_err(|_| "archive_read")?;
        if !record.starts_with(b"PK\x06\x06")
            || u64at(&record, 4) < 44
            || u32at(&record, 16) != 0
            || u32at(&record, 20) != 0
            || u64at(&record, 24) != u64at(&record, 32)
        {
            return Err("archive_format");
        }
        let record_size = u64at(&record, 4);
        if record_size > 64 * 1024 * 1024 { return Err("archive_limit"); }
        if split && pos.checked_add(12).and_then(|v| v.checked_add(record_size)) != Some(footer_pos - 20) {
            return Err("archive_parts");
        }
        count = u64at(&record, 32);
        size = u64at(&record, 40);
        offset = u64at(&record, 48);
    } else if requires_zip64 {
        return Err("archive_format");
    }
    if count > MAX_ENTRIES as u64 || size > 64 * 1024 * 1024 {
        return Err("archive_limit");
    }
    if offset
        .checked_add(size)
        .is_none_or(|value| value > footer_pos)
    {
        return Err("archive_format");
    }
    // Numbered volumes describe one continuous archive. ZIP offset recovery
    // must not choose just one ZIP from concatenated or unrelated parts.
    if split && offset.checked_add(size) != Some(directory_end) {
        return Err("archive_parts");
    }
    file.seek(SeekFrom::Start(0)).map_err(|_| "archive_read")?;
    Ok(count as usize)
}
fn zip_error(error: zip::result::ZipError) -> &'static str {
    match error {
        zip::result::ZipError::InvalidPassword => "archive_password",
        zip::result::ZipError::UnsupportedArchive(zip::result::ZipError::PASSWORD_REQUIRED) => {
            "archive_encrypted"
        }
        _ => "archive_format",
    }
}
fn zip_inventory(
    mut file: decoder::SplitReader,
    work: &Work,
    password: Option<&str>,
    split: bool,
) -> Result<(ZipArchive<decoder::SplitReader>, Vec<ArchiveEntry>)> {
    let count = if split { preflight_zip(&mut file, true)? } else { preflight(&mut file)? };
    let mut archive = ZipArchive::new(file).map_err(|_| "archive_format")?;
    // Numbered volumes must be exactly one stream, not concatenated ZIPs where
    // automatic offset detection would silently ignore an earlier archive.
    if split && archive.offset() != 0 { return Err("archive_parts"); }
    if archive.len() != count {
        return Err("archive_collision");
    }
    let mut entries = Vec::with_capacity(archive.len());
    let mut identities = HashMap::new();
    let mut parents = HashSet::new();
    let mut expanded = 0u64;
    for index in 0..archive.len() {
        canceled(work)?;
        let item = archive.by_index_raw(index).map_err(|_| "archive_format")?;
        let encrypted = item.encrypted();
        if encrypted && password.is_none() {
            return Err("archive_encrypted");
        }
        if ![CompressionMethod::Stored, CompressionMethod::Deflated].contains(&item.compression()) {
            return Err("archive_compression");
        }
        let mode = item.unix_mode().unwrap_or(0) & 0o170000;
        if item.is_symlink() || ![0, 0o100000, 0o040000].contains(&mode) {
            return Err("archive_links");
        }
        let directory = item.is_dir();
        let path = relative(item.name(), directory)?;
        if item.enclosed_name().is_none() {
            return Err("archive_path");
        }
        let identity = path.to_lowercase();
        if identities.insert(identity.clone(), directory).is_some() {
            return Err("archive_collision");
        }
        let mut parent = identity.as_str();
        while let Some((next, _)) = parent.rsplit_once('/') {
            parents.insert(next.to_string());
            parent = next;
        }
        expanded = expanded.checked_add(item.size()).ok_or("archive_limit")?;
        if expanded > MAX_EXPANDED || (directory && item.size() != 0) {
            return Err("archive_limit");
        }
        entries.push(ArchiveEntry {
            path,
            bytes: item.size(),
            directory,
        });
        drop(item);
        if encrypted {
            // Validate the encryption header without reading the payload. Full CRC/AES
            // authentication still runs during extraction before publication.
            archive
                .by_index_decrypt(index, password.unwrap().as_bytes())
                .map_err(zip_error)?;
        }
    }
    if identities
        .iter()
        .any(|(name, directory)| !*directory && parents.contains(name))
    {
        return Err("archive_collision");
    }
    Ok((archive, entries))
}
#[path = "archive_decoder.rs"]
mod decoder;
#[path = "archives_tar.rs"]
mod tar_reader;

pub fn try_run_worker() -> bool {
    decoder::try_run_worker()
}

enum ArchiveReader {
    Zip(ZipArchive<decoder::SplitReader>),
    Tar {
        file: File,
        gzip: bool,
    },
    Isolated {
        _file: File,
        path: PathBuf,
        parts: Vec<PathBuf>,
    },
}
impl ArchiveReader {
    fn visit(
        &mut self,
        entries: &[ArchiveEntry],
        work: &Work,
        password: Option<&str>,
        mut visit: impl FnMut(&ArchiveEntry, &mut dyn Read, u32) -> Result<()>,
    ) -> Result<()> {
        match self {
            Self::Zip(archive) => {
                for (index, entry) in entries.iter().enumerate() {
                    canceled(work)?;
                    let mut input = match password {
                        Some(password) => archive.by_index_decrypt(index, password.as_bytes()),
                        None => archive.by_index(index),
                    }
                    .map_err(zip_error)?;
                    let mode = input.unix_mode().unwrap_or(0);
                    visit(entry, &mut input, mode)?;
                }
                Ok(())
            }
            Self::Tar { file, gzip } => tar_reader::visit(file, *gzip, work, visit),
            Self::Isolated { path, parts, .. } => {
                decoder::visit(path, parts, password, entries, work, visit)
            }
        }
    }
}
fn inventory(
    mut file: File,
    path: &Path,
    parts: &[PathBuf],
    work: &Work,
    password: Option<&str>,
) -> Result<(ArchiveReader, Vec<ArchiveEntry>)> {
    if path.file_name().and_then(|v| v.to_str()).is_some_and(parts::split_zip) {
        let input = decoder::SplitReader::zip(parts)?;
        return zip_inventory(input, work, password, true)
            .map(|(archive, entries)| (ArchiveReader::Zip(archive), entries));
    }
    file.seek(SeekFrom::Start(0)).map_err(|_| "archive_read")?;
    let mut magic = [0; 4];
    if path.file_name().and_then(|v| v.to_str()).is_some_and(parts::split_sevenzip) {
        // Even the signature may cross very small volumes. The isolated reader
        // validates the actual signature and complete start header across parts.
        magic = *b"7z\xbc\xaf";
    } else {
        file.read_exact(&mut magic).map_err(|_| "archive_format")?;
    }
    file.seek(SeekFrom::Start(0)).map_err(|_| "archive_read")?;
    if parts.len() > 1 && magic != *b"Rar!" && magic != *b"7z\xbc\xaf" {
        return Err("archive_parts");
    }
    if magic.starts_with(b"PK") {
        return zip_inventory(decoder::SplitReader::single(file)?, work, password, false)
            .map(|(archive, entries)| (ArchiveReader::Zip(archive), entries));
    }
    if magic == *b"7z\xbc\xaf" || magic == *b"Rar!" || decoder::is_disc(&mut file)? {
        let entries = decoder::inventory(path, parts, password, work)?;
        return Ok((
            ArchiveReader::Isolated {
                _file: file,
                path: path.to_owned(),
                parts: parts.to_vec(),
            },
            entries,
        ));
    }
    file.seek(SeekFrom::Start(0)).map_err(|_| "archive_read")?;
    let gzip = magic.starts_with(&[0x1f, 0x8b]);
    let mut entries = Vec::new();
    tar_reader::visit(&mut file, gzip, work, |entry, _, _| {
        entries.push(entry.clone());
        Ok(())
    })?;
    if entries.is_empty() {
        return Err("archive_format");
    }
    Ok((ArchiveReader::Tar { file, gzip }, entries))
}
pub fn inspect(
    profile: String,
    source: String,
    operation_id: String,
    password: Option<String>,
    emit: impl Fn(ArchiveProgress),
) -> Result<ArchivePlan> {
    let work = start(&profile, &operation_id)?;
    inspect_reserved(&work, source, password, true, None, emit)
}

pub(super) fn inspect_reserved(
    work: &Work,
    source: String,
    password: Option<String>,
    replace_profile: bool,
    allowed_parts: Option<&[String]>,
    emit: impl Fn(ArchiveProgress),
) -> Result<ArchivePlan> {
    let profile = work.0.profile.clone();
    let password = password.map(Zeroizing::new).map(Arc::new);
    if password.as_ref().is_some_and(|value| value.len() > 4096) {
        return Err("archive_password");
    }
    let input = Path::new(&source);
    if !input.is_absolute() {
        return Err("archive_path");
    }
    let mut opened = parts::OpenParts::open(input, &work)?;
    if let Some(allowed)=allowed_parts {
        let allowed:HashSet<PathBuf>=allowed.iter().map(PathBuf::from).collect();
        if opened.paths.iter().any(|path|!allowed.contains(path)){return Err("archive_missing_part");}
    }
    let path = opened.paths[0].clone();
    // Ask for missing/incorrect passwords before hashing a multi-gigabyte package.
    let (_, entries) = inventory(
        opened.files[0].try_clone().map_err(|_| "archive_read")?,
        &path,
        &opened.paths,
        &work,
        password.as_ref().map(|value| value.as_str()),
    )?;
    let source_parts = opened.hashes(&work, &emit)?;
    let sha256 = parts::digest(&source_parts);
    canceled(&work)?;
    let file_count = entries.iter().filter(|v| !v.directory).count();
    let directory_count = entries.len() - file_count;
    let executable_count = entries
        .iter()
        .filter(|v| {
            !v.directory
                && ["exe", "msi", "bat", "cmd", "sh", "appimage"].contains(
                    &v.path
                        .rsplit('.')
                        .next()
                        .unwrap_or("")
                        .to_ascii_lowercase()
                        .as_str(),
                )
        })
        .count();
    let plan = ArchivePlan {
        token: uuid::Uuid::new_v4().to_string(),
        source: path.to_string_lossy().into_owned(),
        archive_bytes: opened.bytes,
        expanded_bytes: entries.iter().map(|v| v.bytes).sum(),
        file_count,
        directory_count,
        sha256,
        entries: entries.into_iter().take(500).collect(),
        executable_count,
        parts: source_parts,
    };
    let mut held = plans().lock().map_err(|_| "archive_busy")?;
    held.retain(|_, v| v.created.elapsed() < PLAN_TTL && (!replace_profile || v.profile != profile));
    if held.len() >= 8 {
        return Err("archive_busy");
    }
    held.insert(
        plan.token.clone(),
        Prepared {
            profile,
            created: Instant::now(),
            path,
            paths: opened.paths.clone(),
            plan: plan.clone(),
            password,
        },
    );
    Ok(plan)
}
pub(super) fn plain_dir(path: &Path) -> Result<PathBuf> {
    if !path.is_absolute() {
        return Err("archive_destination");
    }
    let meta = fs::symlink_metadata(path).map_err(|_| "archive_destination")?;
    if !meta.is_dir() || super::save_files::reparse(&meta) {
        return Err("archive_destination");
    }
    path.canonicalize().map_err(|_| "archive_destination")
}
fn subdirs(stage: &Path, relative: Option<&Path>) -> Result<()> {
    let mut current = stage.to_path_buf();
    if let Some(relative) = relative {
        for component in relative.components() {
            current.push(component);
            match fs::create_dir(&current) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(_) => return Err("archive_write"),
            };
            let canonical = plain_dir(&current)?;
            if !canonical.starts_with(stage) {
                return Err("archive_path");
            }
        }
    }
    Ok(())
}
pub(super) fn publish(from: &Path, to: &Path) -> Result<()> {
    if fs::symlink_metadata(to).is_ok() {
        return Err("archive_exists");
    }
    #[cfg(windows)]
    {
        super::transfer_files::publish(from, to).map_err(|error| {
            if error == "transfer_exists" {
                "archive_exists"
            } else {
                "archive_write"
            }
        })
    }
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        use std::os::unix::ffi::OsStrExt;
        let source =
            std::ffi::CString::new(from.as_os_str().as_bytes()).map_err(|_| "archive_path")?;
        let destination =
            std::ffi::CString::new(to.as_os_str().as_bytes()).map_err(|_| "archive_path")?;
        #[cfg(target_os = "linux")]
        let result = unsafe {
            libc::renameat2(
                libc::AT_FDCWD,
                source.as_ptr(),
                libc::AT_FDCWD,
                destination.as_ptr(),
                libc::RENAME_NOREPLACE,
            )
        };
        #[cfg(target_os = "macos")]
        let result =
            unsafe { libc::renamex_np(source.as_ptr(), destination.as_ptr(), libc::RENAME_EXCL) };
        if result == 0 {
            Ok(())
        } else if fs::symlink_metadata(to).is_ok() {
            Err("archive_exists")
        } else {
            Err("archive_write")
        }
    }
    #[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
    {
        let _ = (from, to);
        Err("archive_platform")
    }
}
fn prepared(profile: &str, token: &str) -> Result<Prepared> {
    let mut held = plans().lock().map_err(|_| "archive_busy")?;
    let item = held
        .get(token)
        .filter(|v| v.profile == profile)
        .ok_or("archive_expired")?;
    if item.created.elapsed() > PLAN_TTL {
        held.remove(token);
        return Err("archive_expired");
    }
    Ok(item.clone())
}
pub fn space(profile: String, token: String, parent: String) -> Result<ArchiveSpace> {
    space_with_storage(
        &profile,
        &token,
        &parent,
        &super::transfer_storage::shared(),
    )
}
fn space_with_storage(
    profile: &str,
    token: &str,
    parent: &str,
    storage: &super::transfer_storage::Storage,
) -> Result<ArchiveSpace> {
    let plan = prepared(profile, token)?.plan;
    let parent = plain_dir(Path::new(parent))?;
    let disk = storage.inspect(&parent);
    let reserved = disk
        .as_ref()
        .map(|disk| storage.other_reserved(&disk.id, &[]))
        .unwrap_or(0);
    let needed = plan
        .expanded_bytes
        .saturating_add(reserved)
        .saturating_add(SPACE_HEADROOM);
    Ok(ArchiveSpace {
        volume: disk.as_ref().map(|disk| disk.mount.clone()),
        available_bytes: disk.as_ref().map(|disk| disk.available),
        expanded_bytes: plan.expanded_bytes,
        reserved_bytes: reserved,
        after_bytes: disk
            .as_ref()
            .map(|disk| disk.available.saturating_sub(needed)),
        shortfall_bytes: disk
            .as_ref()
            .map(|disk| needed.saturating_sub(disk.available)),
    })
}
pub fn extract(
    profile: String,
    token: String,
    parent: String,
    name: String,
    operation_id: String,
    emit: impl Fn(ArchiveProgress),
) -> Result<ArchiveReceipt> {
    extract_with_storage(
        profile,
        token,
        parent,
        name,
        operation_id,
        emit,
        super::transfer_storage::shared(),
    )
}
fn extract_with_storage(
    profile: String,
    token: String,
    parent: String,
    name: String,
    operation_id: String,
    emit: impl Fn(ArchiveProgress),
    storage: Arc<super::transfer_storage::Storage>,
) -> Result<ArchiveReceipt> {
    let work = start(&profile, &operation_id)?;
    extract_reserved(
        work,
        profile,
        token,
        parent,
        name,
        emit,
        storage,
        |_| Ok(()),
    )
}

pub(super) enum ExtractionBoundary<'a> {
    Staging(&'a Path),
    Publishing,
}

// Fault injection must not depend on the UI's progress interval. This test-only
// pause runs after an actual write and is absent from normal builds.
#[cfg(test)]
pub(super) static FIRST_WRITE_CHECKPOINT: OnceLock<fn(&Path)> = OnceLock::new();

pub(super) fn extraction_destination(
    profile: &str,
    token: &str,
    parent: &str,
    name: &str,
) -> Result<(ArchivePlan, PathBuf)> {
    let plan = prepared(profile, token)?.plan;
    Ok((plan, planned_destination(parent, name)?))
}

pub(super) fn planned_destination(parent: &str, name: &str) -> Result<PathBuf> {
    let clean = relative(name, false).map_err(|_| "archive_destination")?;
    if clean.contains('/') || clean.starts_with(".harbor-") {
        return Err("archive_destination");
    }
    let parent = plain_dir(Path::new(parent))?;
    let destination = parent.join(clean);
    if fs::symlink_metadata(&destination).is_ok() {
        return Err("archive_exists");
    }
    Ok(destination)
}

pub(super) fn extract_reserved(
    work: Work,
    profile: String,
    token: String,
    parent: String,
    name: String,
    emit: impl Fn(ArchiveProgress),
    storage: Arc<super::transfer_storage::Storage>,
    boundary: impl Fn(ExtractionBoundary<'_>) -> Result<()>,
) -> Result<ArchiveReceipt> {
    let prepared = prepared(&profile, &token)?;
    let clean = relative(&name, false).map_err(|_| "archive_destination")?;
    if clean.contains('/') || clean.starts_with(".harbor-") {
        return Err("archive_destination");
    }
    let parent = plain_dir(Path::new(&parent))?;
    let destination = parent.join(clean);
    if fs::symlink_metadata(&destination).is_ok() {
        return Err("archive_exists");
    }
    // Retain the archive's 64 MiB margin on top of the allocator's 32 MiB floor.
    let reservation = storage
        .reserve(
            &format!("archive:{}", work.0.id),
            &parent,
            prepared
                .plan
                .expanded_bytes
                .saturating_add(SPACE_HEADROOM - super::transfer_storage::HEADROOM),
        )
        .map_err(|error| {
            if error == "transfer_space" {
                "archive_space"
            } else {
                "archive_busy"
            }
        })?;
    plans()
        .lock()
        .map_err(|_| "archive_busy")?
        .remove(&token)
        .ok_or("archive_expired")?;
    let mut opened = parts::OpenParts::open(&prepared.path, &work)?;
    if opened.paths != prepared.paths || opened.hashes(&work, &emit)? != prepared.plan.parts {
        return Err("archive_changed");
    }
    let password = prepared.password.as_ref().map(|value| value.as_str());
    let (mut archive, entries) = inventory(
        opened.files[0].try_clone().map_err(|_| "archive_read")?,
        &prepared.path,
        &opened.paths,
        &work,
        password,
    )?;
    let stage = parent.join(format!(".harbor-extract-{}", uuid::Uuid::new_v4()));
    // Record ownership before creating any partial files; restart recovery keeps this path.
    boundary(ExtractionBoundary::Staging(&stage))?;
    fs::create_dir(&stage).map_err(|_| "archive_write")?;
    let stage = plain_dir(&stage)?;
    let result = (|| {
        reservation.check().map_err(|_| "archive_space")?;
        let mut bytes = 0u64;
        let mut files = 0usize;
        let mut buffer = vec![0; 256 * 1024];
        let mut last = Instant::now();
        let mut space_check = Instant::now();
        let mut space_bytes = 0u64;
        announce(
            &work,
            "extracting",
            0,
            prepared.plan.expanded_bytes,
            0,
            prepared.plan.file_count,
            &emit,
        );
        archive.visit(&entries, &work, password, |entry, input, _mode| {
            canceled(&work)?;
            let rel = Path::new(&entry.path);
            if entry.directory {
                subdirs(&stage, Some(rel))?;
                return Ok(());
            }
            subdirs(&stage, rel.parent())?;
            let output = stage.join(rel);
            let mut options = OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut output = options.open(&output).map_err(|_| "archive_write")?;
            let mut count = 0u64;
            // Report the first file even when a small archive finishes inside the
            // normal progress interval. Later updates remain capped at 10 Hz.
            if files == 0 {
                announce(
                    &work,
                    "extracting",
                    bytes,
                    prepared.plan.expanded_bytes,
                    files,
                    prepared.plan.file_count,
                    &|mut progress: ArchiveProgress| {
                        progress.current_file = Some(entry.path.clone());
                        emit(progress);
                    },
                );
                last = Instant::now();
            }
            loop {
                canceled(&work)?;
                let n = input.read(&mut buffer).map_err(|_| "archive_checksum")?;
                if n == 0 {
                    break;
                }
                count += n as u64;
                bytes += n as u64;
                if count > entry.bytes || bytes > prepared.plan.expanded_bytes {
                    return Err("archive_limit");
                }
                output
                    .write_all(&buffer[..n])
                    .map_err(|_| "archive_write")?;
                #[cfg(test)]
                if files == 0 && count == n as u64 {
                    if let Some(checkpoint) = FIRST_WRITE_CHECKPOINT.get() {
                        checkpoint(&stage);
                    }
                }
                reservation.written(n as u64);
                if bytes - space_bytes >= 8 * 1024 * 1024
                    || space_check.elapsed() >= Duration::from_secs(1)
                {
                    reservation.check().map_err(|_| "archive_space")?;
                    space_check = Instant::now();
                    space_bytes = bytes;
                }
                if last.elapsed() > Duration::from_millis(100) {
                    announce(
                        &work,
                        "extracting",
                        bytes,
                        prepared.plan.expanded_bytes,
                        files,
                        prepared.plan.file_count,
                        &|mut progress: ArchiveProgress| {
                            progress.current_file = Some(entry.path.clone());
                            emit(progress);
                        },
                    );
                    last = Instant::now();
                }
            }
            if count != entry.bytes {
                return Err("archive_checksum");
            }
            output.sync_all().map_err(|_| "archive_write")?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mode = if _mode & 0o111 != 0 { 0o700 } else { 0o600 };
                output
                    .set_permissions(fs::Permissions::from_mode(mode))
                    .map_err(|_| "archive_write")?;
            }
            files += 1;
            Ok(())
        })?;
        opened.unchanged()?;
        canceled(&work)?;
        reservation.check().map_err(|_| "archive_space")?;
        if plain_dir(&parent)? != parent {
            return Err("archive_destination");
        }
        drop(archive);
        boundary(ExtractionBoundary::Publishing)?;
        publish(&stage, &destination)?;
        announce(&work, "complete", bytes, bytes, files, files, &emit);
        Ok(ArchiveReceipt {
            destination: destination.to_string_lossy().into_owned(),
            source: prepared.plan.source.clone(),
            sha256: prepared.plan.sha256.clone(),
            files,
            bytes,
            parts: prepared.plan.parts.clone(),
        })
    })();
    if result.is_err() {
        if matches!(result, Err("archive_exists" | "archive_space"))
            && prepared.created.elapsed() < PLAN_TTL
        {
            if let Ok(mut held) = plans().lock() {
                held.insert(token, prepared);
            }
        }
        if stage.parent() == Some(parent.as_path())
            && stage
                .file_name()
                .is_some_and(|name| name.to_string_lossy().starts_with(".harbor-extract-"))
            && plain_dir(&stage).ok().as_ref() == Some(&stage)
        {
            let _ = fs::remove_dir_all(&stage);
        }
    }
    result
}

#[cfg(test)]
#[path = "archives_tests.rs"]
mod tests;
