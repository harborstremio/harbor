//! Journaled, explicit recycling of exact receipted source files. Holding folders
//! are siblings of the source, so staging never copies a large archive tree.
use super::{
    archive_cleanup::{self, CleanupFile, Usage},
    archive_cleanup_io as io, archive_cleanup_plans as plans,
    archive_jobs::{Archives, Status},
    archives::{self, ArchiveProgress},
    game_file_use,
};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    sync::{Mutex, OnceLock},
};
type Result<T> = std::result::Result<T, &'static str>;
const MAX_STORE: usize = 4 * 1024 * 1024;
const MARKER: &str = ".harbor-source-cleanup";
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Staging,
    Held,
    Recycling,
    Complete,
    Restored,
    Unconfirmed,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Record {
    pub id: String,
    pub profile: String,
    pub job_id: String,
    pub revision: u64,
    pub destination: String,
    pub destination_identity: String,
    pub parent: String,
    pub parent_identity: String,
    pub stage: String,
    pub stage_identity: Option<String>,
    pub files: Vec<CleanupFile>,
    pub phase: Phase,
    pub restoring: bool,
    pub error: Option<String>,
    pub updated_at: u64,
}
#[derive(Serialize, Deserialize)]
struct Data {
    version: u32,
    records: Vec<Record>,
}
pub(super) struct Store {
    root: PathBuf,
    records: Vec<Record>,
}
fn serial() -> &'static Mutex<()> {
    static VALUE: OnceLock<Mutex<()>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(()))
}
fn stamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn absolute(path: &str) -> bool {
    path.len() <= 8192
        && Path::new(path).is_absolute()
        && !Path::new(path)
            .components()
            .any(|v| matches!(v, Component::ParentDir | Component::CurDir))
}
fn valid(record: &Record) -> bool {
    let mut names = std::collections::HashSet::new();
    uuid::Uuid::parse_str(&record.id).is_ok()
        && uuid::Uuid::parse_str(&record.job_id).is_ok()
        && !record.profile.is_empty()
        && record.profile.len() <= 160
        && !record.profile.chars().any(char::is_control)
        && absolute(&record.parent)
        && absolute(&record.destination)
        && absolute(&record.stage)
        && Path::new(&record.stage)
            == Path::new(&record.parent).join(format!(".harbor-archive-cleanup-{}", record.id))
        && !record.files.is_empty()
        && record.files.len() <= 1024
        && record.files.iter().all(|file| {
            !file.name.is_empty()
                && file.name.len() <= 255
                && !file.name.contains(['/', '\\', ':'])
                && !file.name.chars().any(char::is_control)
                && file.name != "."
                && file.name != ".."
                && !file.name.ends_with(['.', ' '])
                && names.insert(if cfg!(windows) {
                    file.name.to_lowercase()
                } else {
                    file.name.clone()
                })
                && file.sha256.len() == 64
                && file.sha256.bytes().all(|v| v.is_ascii_hexdigit())
                && file.bytes > 0
                && file.identity.len() <= 128
                && !file.identity.is_empty()
                && Path::new(&file.path) == Path::new(&record.parent).join(&file.name)
        })
        && record
            .files
            .iter()
            .try_fold(0u64, |sum, file| sum.checked_add(file.bytes))
            .is_some_and(|n| n <= 64 * 1024 * 1024 * 1024)
}
impl Store {
    pub(super) fn load(archives: &Archives) -> Result<Self> {
        let root = archives.cleanup_root();
        fs::create_dir_all(&root).map_err(|_| "archive_store")?;
        let root = super::save_files::plain_dir(&root).map_err(|_| "archive_store")?;
        let path = root.join("operations.json");
        let records = if path.try_exists().map_err(|_| "archive_store")? {
            let mut bytes = Vec::new();
            File::open(&path)
                .map_err(|_| "archive_store")?
                .take(MAX_STORE as u64 + 1)
                .read_to_end(&mut bytes)
                .map_err(|_| "archive_store")?;
            if bytes.len() > MAX_STORE {
                return Err("archive_store");
            }
            let data: Data = serde_json::from_slice(&bytes).map_err(|_| "archive_store")?;
            let mut ids = std::collections::HashSet::new();
            if data.version != 1
                || data.records.len() > 200
                || data
                    .records
                    .iter()
                    .any(|r| !valid(r) || !ids.insert(r.id.clone()))
            {
                return Err("archive_store");
            }
            data.records
        } else {
            vec![]
        };
        Ok(Self { root, records })
    }
    fn save(&mut self, record: &Record) -> Result<()> {
        if !valid(record) {
            return Err("archive_store");
        }
        let mut next = self.records.clone();
        if let Some(old) = next.iter_mut().find(|r| r.id == record.id) {
            *old = record.clone();
        } else {
            if next.len() >= 200 {
                return Err("archive_history");
            }
            next.push(record.clone());
        }
        self.persist(next)
    }
    fn persist(&mut self, next: Vec<Record>) -> Result<()> {
        let bytes = serde_json::to_vec(&Data {
            version: 1,
            records: next.clone(),
        })
        .map_err(|_| "archive_store")?;
        if bytes.len() > MAX_STORE {
            return Err("archive_history");
        }
        let temp = self.root.join(format!("{}.tmp", uuid::Uuid::new_v4()));
        let result = (|| -> std::io::Result<()> {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temp)?;
            file.write_all(&bytes)?;
            file.sync_all()?;
            fs::rename(&temp, self.root.join("operations.json"))
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temp);
            return Err("archive_store");
        }
        self.records = next;
        Ok(())
    }
    fn get(&self, profile: &str, id: &str) -> Result<Record> {
        self.records
            .iter()
            .find(|r| r.id == id && r.profile == profile)
            .cloned()
            .ok_or("archive_expired")
    }
    pub(super) fn begin(
        &mut self,
        archives: &Archives,
        profile: &str,
        token: &str,
        id: &str,
    ) -> Result<Record> {
        uuid::Uuid::parse_str(id).map_err(|_| "archive_profile")?;
        if let Some(old) = self.records.iter().find(|r| r.id == id) {
            return if old.profile == profile {
                Ok(old.clone())
            } else {
                Err("archive_expired")
            };
        }
        let review = plans::get(archives, profile, token)?;
        if self.records.iter().any(|r| {
            r.job_id == review.job_id && !matches!(r.phase, Phase::Complete | Phase::Restored)
        }) {
            return Err("archive_cleanup_recovery");
        }
        let parent = Path::new(&review.files[0].path)
            .parent()
            .ok_or("archive_path")?
            .to_path_buf();
        let parent = archive_cleanup::plain(&parent, true)?;
        let record = Record {
            id: id.into(),
            profile: profile.into(),
            job_id: review.job_id,
            revision: review.revision,
            destination_identity: io::identity(Path::new(&review.destination))?,
            destination: review.destination,
            parent_identity: io::identity(&parent)?,
            stage: parent
                .join(format!(".harbor-archive-cleanup-{id}"))
                .to_string_lossy()
                .into_owned(),
            parent: parent.to_string_lossy().into_owned(),
            stage_identity: None,
            files: review.files,
            phase: Phase::Staging,
            restoring: false,
            error: None,
            updated_at: stamp(),
        };
        // Persist exact consent before the first directory or file move. The
        // renderer cannot extend this file set in a retry or after restart.
        self.save(&record)?;
        plans::discard(profile, token);
        Ok(record)
    }
    fn update(&mut self, record: &mut Record, phase: Phase) -> Result<()> {
        record.phase = phase;
        record.updated_at = stamp().max(record.updated_at.saturating_add(1));
        record.error = None;
        self.save(record)
    }
    fn execute(
        &mut self,
        archives: &Archives,
        mut record: Record,
        restore: bool,
        usage: &impl Fn() -> Result<Vec<Usage>>,
        emit: &impl Fn(ArchiveProgress),
        recycle: &impl Fn(&Path) -> Result<()>,
        boundary: &impl Fn(&str, &Record),
    ) -> Result<Record> {
        if matches!(
            record.phase,
            Phase::Complete | Phase::Restored | Phase::Unconfirmed
        ) {
            return Ok(record);
        }
        let paths = record
            .files
            .iter()
            .map(|f| PathBuf::from(&f.path))
            .collect::<Vec<_>>();
        let _lease = game_file_use::cleanup(&paths)?;
        let _holding_lease = game_file_use::cleanup_tree(Path::new(&record.stage))?;
        let work = archives::start(&record.profile, &record.id)?;
        let result = self.perform(
            archives,
            &mut record,
            restore,
            &work,
            usage,
            emit,
            recycle,
            boundary,
        );
        if let Err(error) = result {
            record.error = Some(error.into());
            record.updated_at = stamp().max(record.updated_at.saturating_add(1));
            self.save(&record)?;
            return Err(error);
        }
        Ok(record)
    }
    fn perform(
        &mut self,
        archives: &Archives,
        record: &mut Record,
        restore: bool,
        work: &archives::Work,
        usage: &impl Fn() -> Result<Vec<Usage>>,
        emit: &impl Fn(ArchiveProgress),
        recycle: &impl Fn(&Path) -> Result<()>,
        boundary: &impl Fn(&str, &Record),
    ) -> Result<()> {
        let restore = restore || record.restoring;
        parent(record)?;
        if record.phase == Phase::Recycling
            && !Path::new(&record.stage)
                .try_exists()
                .map_err(|_| "archive_read")?
        {
            // The OS may have recycled it before the last durable write. Never
            // recycle newly appearing source paths to manufacture certainty.
            return self.update(record, Phase::Unconfirmed);
        }
        if !restore {
            current(archives, record)?;
            idle(archives, record, usage)?;
        }
        if record.stage_identity.is_none() {
            if Path::new(&record.stage)
                .try_exists()
                .map_err(|_| "archive_read")?
            {
                return Err("archive_cleanup_recovery");
            }
            // Verify every current source identity before moving any part.
            for file in &record.files {
                same(Path::new(&file.path), file)?;
            }
            archives::canceled(work)?;
            fs::create_dir(&record.stage).map_err(|_| "archive_write")?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&record.stage, fs::Permissions::from_mode(0o700))
                    .map_err(|_| "archive_write")?;
            }
            let mut marker = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(Path::new(&record.stage).join(MARKER))
                .map_err(|_| "archive_write")?;
            marker
                .write_all(record.id.as_bytes())
                .map_err(|_| "archive_write")?;
            marker.sync_all().map_err(|_| "archive_write")?;
            record.stage_identity = Some(io::identity(Path::new(&record.stage))?);
            self.save(record)?;
            boundary("holding-folder", record);
        }
        stage(record)?;
        if restore {
            record.restoring = true;
            self.save(record)?;
            return self.restore(record, work, emit, boundary);
        }
        if record.phase == Phase::Recycling
            && record
                .files
                .iter()
                .any(|file| !Path::new(&record.stage).join(&file.name).exists())
        {
            return self.update(record, Phase::Unconfirmed);
        }
        for file in &record.files {
            archives::canceled(work)?;
            parent(record)?;
            stage(record)?;
            let held = Path::new(&record.stage).join(&file.name);
            if held.try_exists().map_err(|_| "archive_read")? {
                same(&held, file)?;
                continue;
            }
            same(Path::new(&file.path), file)?;
            archives::publish(Path::new(&file.path), &held)?;
            same(&held, file)?;
            boundary("part-moved", record);
        }
        self.update(record, Phase::Held)?;
        boundary("held", record);
        let fingerprints = verify(record, work, emit)?;
        current(archives, record)?;
        idle(archives, record, usage)?;
        archives::canceled(work)?;
        self.update(record, Phase::Recycling)?;
        boundary("recycling", record);
        checked(record, &fingerprints)?;
        recycle(Path::new(&record.stage))?;
        if Path::new(&record.stage)
            .try_exists()
            .map_err(|_| "archive_read")?
        {
            return Err("archive_cleanup_recycle");
        }
        boundary("recycled", record);
        self.update(record, Phase::Complete)?;
        boundary("complete", record);
        Ok(())
    }
    fn restore(
        &mut self,
        record: &mut Record,
        work: &archives::Work,
        _emit: &impl Fn(ArchiveProgress),
        boundary: &impl Fn(&str, &Record),
    ) -> Result<()> {
        stage(record)?;
        // Preflight the whole restore before the first move; an unrelated
        // replacement at an original path is never overwritten.
        for file in &record.files {
            let held = Path::new(&record.stage).join(&file.name);
            if held.try_exists().map_err(|_| "archive_read")? {
                if Path::new(&file.path)
                    .try_exists()
                    .map_err(|_| "archive_read")?
                {
                    return Err("archive_exists");
                }
                same_identity(&held, file)?;
            } else {
                same_identity(Path::new(&file.path), file)?;
            }
        }
        for file in &record.files {
            archives::canceled(work)?;
            parent(record)?;
            stage(record)?;
            let held = Path::new(&record.stage).join(&file.name);
            if held.try_exists().map_err(|_| "archive_read")? {
                same_identity(&held, file)?;
                archives::publish(&held, Path::new(&file.path))?;
                boundary("part-restored", record);
            }
        }
        // Persist restoration before removing only our now-empty holding area.
        self.update(record, Phase::Restored)?;
        stage(record)?;
        if fs::read_dir(&record.stage)
            .map_err(|_| "archive_read")?
            .count()
            != 1
        {
            return Err("archive_cleanup_recovery");
        }
        fs::remove_file(Path::new(&record.stage).join(MARKER)).map_err(|_| "archive_write")?;
        fs::remove_dir(&record.stage).map_err(|_| "archive_write")?;
        Ok(())
    }
}
fn parent(record: &Record) -> Result<()> {
    let path = Path::new(&record.parent);
    if archive_cleanup::plain(path, true)? != path || io::identity(path)? != record.parent_identity
    {
        return Err("archive_changed");
    }
    Ok(())
}
fn stage(record: &Record) -> Result<()> {
    let path = Path::new(&record.stage);
    if archive_cleanup::plain(path, true)? != path
        || Some(io::identity(path)?) != record.stage_identity
    {
        return Err("archive_cleanup_recovery");
    }
    let marker = path.join(MARKER);
    archive_cleanup::plain(&marker, false)?;
    if fs::metadata(&marker).map_err(|_| "archive_read")?.len() != record.id.len() as u64
        || fs::read(&marker).map_err(|_| "archive_read")? != record.id.as_bytes()
    {
        return Err("archive_cleanup_recovery");
    }
    Ok(())
}
fn same(path: &Path, file: &CleanupFile) -> Result<()> {
    if archive_cleanup::plain(path, false)? != path
        || io::identity(path)? != file.identity
        || fs::metadata(path).map_err(|_| "archive_read")?.len() != file.bytes
    {
        return Err("archive_changed");
    }
    Ok(())
}
fn same_identity(path: &Path, file: &CleanupFile) -> Result<()> {
    if archive_cleanup::plain(path, false)? != path || io::identity(path)? != file.identity {
        return Err("archive_changed");
    }
    Ok(())
}
fn current(archives: &Archives, record: &Record) -> Result<()> {
    let job = archives
        .list(&record.profile)?
        .into_iter()
        .find(|job| job.id == record.job_id)
        .ok_or("archive_expired")?;
    let receipt = job.receipt.ok_or("archive_cleanup_receipt")?;
    if job.status != Status::Complete
        || job.updated_at != record.revision
        || receipt.destination != record.destination
        || receipt.parts.len() != record.files.len()
        || receipt
            .parts
            .iter()
            .zip(&record.files)
            .any(|(a, b)| a.name != b.name || a.bytes != b.bytes || a.sha256 != b.sha256)
        || io::identity(Path::new(&record.destination))? != record.destination_identity
    {
        return Err("archive_changed");
    }
    Ok(())
}
fn idle(
    archives: &Archives,
    record: &Record,
    usage: &impl Fn() -> Result<Vec<Usage>>,
) -> Result<()> {
    let mut refs = usage()?;
    refs.extend(archives.cleanup_usage(&record.job_id)?);
    if refs.iter().any(|reference| {
        record
            .files
            .iter()
            .any(|file| archive_cleanup::matches(reference, Path::new(&file.path)))
    }) {
        return Err("archive_cleanup_in_use");
    }
    Ok(())
}
fn verify(
    record: &Record,
    work: &archives::Work,
    emit: &impl Fn(ArchiveProgress),
) -> Result<Vec<std::time::SystemTime>> {
    contents(record)?;
    let before = record
        .files
        .iter()
        .map(|file| {
            fs::metadata(Path::new(&record.stage).join(&file.name))
                .and_then(|m| m.modified())
                .map_err(|_| "archive_read")
        })
        .collect::<Result<Vec<_>>>()?;
    let total = record.files.iter().map(|f| f.bytes).sum();
    let mut offset = 0;
    for (index, file) in record.files.iter().enumerate() {
        let path = Path::new(&record.stage).join(&file.name);
        same(&path, file)?;
        let found = archives::cleanup_fingerprint(&path, work, &|mut p| {
            p.bytes += offset;
            p.total_bytes = total;
            p.files = index;
            p.total_files = record.files.len();
            p.current_file = Some(file.name.clone());
            emit(p);
        })?;
        if found.bytes != file.bytes || found.sha256 != file.sha256 {
            return Err("archive_changed");
        }
        offset += file.bytes;
    }
    // Every name and file identity must still be ours after the read pass.
    checked(record, &before)?;
    Ok(before)
}
fn checked(record: &Record, before: &[std::time::SystemTime]) -> Result<()> {
    contents(record)?;
    for (file, modified) in record.files.iter().zip(before) {
        let path = Path::new(&record.stage).join(&file.name);
        same(&path, file)?;
        if fs::metadata(&path)
            .and_then(|m| m.modified())
            .map_err(|_| "archive_read")?
            != *modified
        {
            return Err("archive_changed");
        }
    }
    Ok(())
}
fn contents(record: &Record) -> Result<()> {
    stage(record)?;
    let allowed = record
        .files
        .iter()
        .map(|f| f.name.as_str())
        .chain(std::iter::once(MARKER))
        .collect::<std::collections::HashSet<_>>();
    let mut count = 0;
    for entry in fs::read_dir(&record.stage).map_err(|_| "archive_read")? {
        let name = entry.map_err(|_| "archive_read")?.file_name();
        if !name.to_str().is_some_and(|v| allowed.contains(v)) {
            return Err("archive_cleanup_recovery");
        }
        count += 1;
    }
    if count != allowed.len() {
        return Err("archive_cleanup_recovery");
    }
    Ok(())
}
pub fn list(archives: &Archives, profile: &str) -> Result<Vec<Record>> {
    Ok(Store::load(archives)?
        .records
        .into_iter()
        .filter(|r| r.profile == profile)
        .collect())
}
pub fn dismiss(archives: &Archives, profile: &str, id: &str) -> Result<Record> {
    let _serial = serial().try_lock().map_err(|_| "archive_busy")?;
    let mut store = Store::load(archives)?;
    let record = store.get(profile, id)?;
    if !matches!(record.phase, Phase::Complete | Phase::Restored) {
        return Err("archive_cleanup_recovery");
    }
    let next = store
        .records
        .iter()
        .filter(|r| r.id != id)
        .cloned()
        .collect();
    store.persist(next)?;
    Ok(record)
}
pub fn run(
    app: &tauri::AppHandle,
    profile: &str,
    token: Option<&str>,
    id: &str,
    restore: bool,
) -> Result<Record> {
    use tauri::Emitter;
    let _serial = serial().try_lock().map_err(|_| "archive_busy")?;
    let archives = super::archive_jobs::manager(app)?;
    let direct = super::transfers::manager(app)?;
    let torrents = super::p2p::manager(app)?;
    let preparations = super::preparation_runtime::manager(app)?;
    let mut store = Store::load(&archives)?;
    let record = if let Some(token) = token {
        store.begin(&archives, profile, token, id)?
    } else {
        store.get(profile, id)?
    };
    let job_id = record.job_id.clone();
    store.execute(
        &archives,
        record,
        restore,
        &|| {
            let mut refs = direct.cleanup_usage(profile, &job_id)?;
            refs.extend(torrents.cleanup_usage(profile, &job_id)?);
            refs.extend(preparations.cleanup_usage(&job_id)?);
            Ok(refs)
        },
        &|p| {
            let _ = app.emit("games:archive-progress", p);
        },
        &io::recycle,
        &|_, _| {},
    )
}

#[cfg(test)]
#[path = "archive_cleanup_store_tests.rs"]
mod tests;
