//! Durable extraction ownership. Closing a webview never owns cancellation.
use super::{archives::{self, ArchiveProgress, ArchiveReceipt, ExtractionBoundary}, download_metadata::{self, DownloadGame}};
use serde::{Deserialize, Serialize};
use std::{fs::{self, File, OpenOptions}, io::{Read, Write}, path::PathBuf, sync::{Arc, Mutex, OnceLock}, time::{Duration, Instant, SystemTime, UNIX_EPOCH}};
use tauri::{Emitter, Manager};

type Result<T> = std::result::Result<T, &'static str>;
const MAX_JOBS: usize = 200;
const MAX_STORE: usize = 4 * 1024 * 1024;
fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64 }
fn valid(value: &str, max: usize) -> bool { !value.is_empty() && value.len() <= max && !value.chars().any(char::is_control) }
fn valid_expected_parts(parts:&[archives::ArchivePart])->bool{
    let mut names=std::collections::HashSet::new();
    !parts.is_empty()&&parts.len()<=1024&&parts.iter().all(|part|
        valid(&part.name,255)&&!part.name.contains(['/', '\\'])&&part.bytes>0&&
        part.sha256.len()==64&&part.sha256.bytes().all(|byte|byte.is_ascii_hexdigit())&&
        names.insert(if cfg!(windows){part.name.to_lowercase()}else{part.name.clone()}))
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Status { Running, Complete, Failed, Canceled, Interrupted }

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveJob {
    pub id: String,
    pub profile: String,
    pub source: String,
    pub origin_source: String,
    pub name: String,
    pub game: Option<DownloadGame>,
    pub destination: String,
    pub stage: Option<String>,
    pub status: Status,
    pub progress: Option<ArchiveProgress>,
    pub receipt: Option<ArchiveReceipt>,
    pub error: Option<String>,
    pub started_at: u64,
    pub updated_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_sha256: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allowed_parts: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_parts: Option<Vec<archives::ArchivePart>>,
}
#[derive(Serialize, Deserialize)]
struct Store { version: u32, jobs: Vec<ArchiveJob> }

pub struct Archives {
    root: PathBuf,
    pub(super) jobs: Mutex<Vec<ArchiveJob>>,
    emit: Arc<dyn Fn(ArchiveJob) + Send + Sync>,
}
impl Archives {
    pub(super) fn cleanup_root(&self)->PathBuf{self.root.join("source-cleanup")}
    pub(super) fn contains_job(&self,profile:&str,id:&str)->Result<bool>{
        Ok(self.jobs.lock().map_err(|_|"archive_store")?.iter().any(|job|job.profile==profile&&job.id==id))
    }
    pub fn load(root: PathBuf, emit: impl Fn(ArchiveJob) + Send + Sync + 'static) -> Result<Arc<Self>> {
        fs::create_dir_all(&root).map_err(|_| "archive_store")?;
        let path = root.join("jobs.json");
        let mut jobs = if path.exists() {
            let mut bytes = Vec::new();
            File::open(&path).map_err(|_| "archive_store")?.take(MAX_STORE as u64 + 1).read_to_end(&mut bytes).map_err(|_| "archive_store")?;
            if bytes.len() > MAX_STORE { return Err("archive_store"); }
            let store: Store = serde_json::from_slice(&bytes).map_err(|_| "archive_store")?;
            let mut ids = std::collections::HashSet::new();
            if store.version != 1 || store.jobs.len() > MAX_JOBS || store.jobs.iter().any(|job|
                !valid(&job.profile,160) || uuid::Uuid::parse_str(&job.id).is_err() || !ids.insert(job.id.clone()) ||
                !valid(&job.source,8192) || !valid(&job.destination,8192) || !valid(&job.origin_source,8192) || !valid(&job.name,500) ||
                job.expected_sha256.as_ref().is_some_and(|value| value.len()!=64 || !value.bytes().all(|c|c.is_ascii_hexdigit())) ||
                job.allowed_parts.as_ref().is_some_and(|parts|parts.is_empty()||parts.len()>1024||parts.iter().any(|part|part.len()>8192||!PathBuf::from(part).is_absolute()))||
                job.expected_parts.as_ref().is_some_and(|parts|!valid_expected_parts(parts))) { return Err("archive_store"); }
            store.jobs
        } else { Vec::new() };
        let mut changed = false;
        for job in &mut jobs {
            if job.status == Status::Running {
                // An interrupted publication is not proof of success. Keep both recorded paths
                // for review; never remove an unverified partial folder during startup.
                job.status = Status::Interrupted;
                job.error = Some("archive_interrupted".into());
                job.updated_at = now().max(job.updated_at.saturating_add(1));
                changed = true;
            }
        }
        let value = Arc::new(Self { root, jobs: Mutex::new(jobs), emit: Arc::new(emit) });
        if changed { value.persist(&value.jobs.lock().map_err(|_| "archive_store")?)?; }
        Ok(value)
    }
    fn persist(&self, jobs: &[ArchiveJob]) -> Result<()> {
        let bytes = serde_json::to_vec(&Store {version:1,jobs:jobs.to_vec()}).map_err(|_| "archive_store")?;
        if bytes.len() > MAX_STORE { return Err("archive_store"); }
        let temporary = self.root.join(format!("jobs-{}.tmp",uuid::Uuid::new_v4()));
        let write = || -> std::io::Result<()> {
            let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary)?;
            file.write_all(&bytes)?; file.sync_all()?;
            fs::rename(&temporary,self.root.join("jobs.json"))
        };
        if write().is_err() { let _ = fs::remove_file(&temporary); return Err("archive_store"); }
        Ok(())
    }
    pub fn list(&self, profile: &str) -> Result<Vec<ArchiveJob>> {
        if !valid(profile,160) { return Err("archive_profile"); }
        Ok(self.jobs.lock().map_err(|_| "archive_store")?.iter().filter(|job| job.profile == profile).cloned().collect())
    }
    fn update(&self, id: &str, durable: bool, edit: impl FnOnce(&mut ArchiveJob)) -> Result<()> {
        let mut held = self.jobs.lock().map_err(|_| "archive_store")?;
        let mut next = held.clone();
        let job = next.iter_mut().find(|job| job.id == id).ok_or("archive_expired")?;
        edit(job); job.updated_at = now().max(job.updated_at.saturating_add(1));
        let event = job.clone();
        if durable { self.persist(&next)?; }
        *held = next; drop(held); (self.emit)(event); Ok(())
    }
    pub fn start(self: &Arc<Self>, profile: String, token: String, parent: String, name: String, origin_source: Option<String>, game: Option<DownloadGame>) -> Result<ArchiveJob> {
        if !valid(&profile,160) { return Err("archive_profile"); }
        let (plan,destination) = archives::extraction_destination(&profile,&token,&parent,&name)?;
        let origin = origin_source.unwrap_or_else(|| plan.source.clone());
        if !valid(&origin,8192) || !PathBuf::from(&origin).is_absolute() { return Err("archive_path"); }
        let id = uuid::Uuid::new_v4().to_string();
        // Claim the engine before accepting the job so immediate cancellation cannot race startup.
        let work = archives::start(&profile,&id)?;
        let stamp = now();
        let job = ArchiveJob {id:id.clone(), profile:profile.clone(),source:plan.source.clone(),origin_source:origin,
            name:name.clone(),game:download_metadata::sanitize(game),destination:destination.to_string_lossy().into(),stage:None,
            status:Status::Running, progress:None,receipt:None,error:None,started_at:stamp,updated_at:stamp,expected_sha256:None,allowed_parts:None,expected_parts:None};
        {
            let mut held = self.jobs.lock().map_err(|_| "archive_store")?;
            let mut next = held.clone();
            if next.len() >= MAX_JOBS { return Err("archive_history"); }
            next.insert(0,job.clone());
            // Reserve the multipart receipt before accepting work, so completed
            // files cannot outgrow their final history record.
            let receipt = ArchiveReceipt { destination:job.destination.clone(),source:plan.source.clone(),sha256:plan.sha256.clone(),
                files:plan.file_count,bytes:plan.expanded_bytes,parts:plan.parts.clone() };
            let current_bytes = serde_json::to_vec(&Store {version:1,jobs:next.clone()}).map_err(|_| "archive_store")?.len();
            let receipt_bytes = serde_json::to_vec(&receipt).map_err(|_| "archive_store")?.len();
            // Covers the staging path, current filename and terminal error fields.
            if current_bytes.saturating_add(receipt_bytes).saturating_add(32*1024) > MAX_STORE { return Err("archive_history"); }
            self.persist(&next)?; *held = next;
        }
        self.launch(job, work, Some(token), parent, name)
    }
    pub fn remove(&self, profile: &str, id: &str) -> Result<()> {
        let mut held=self.jobs.lock().map_err(|_| "archive_store")?;
        let job=held.iter().find(|job| job.profile==profile&&job.id==id).ok_or("archive_expired")?;
        if job.status==Status::Running {return Err("archive_busy");}
        let next=held.iter().filter(|job| job.id!=id).cloned().collect::<Vec<_>>();
        self.persist(&next)?; *held=next; Ok(())
    }
}

#[path = "archive_preparation.rs"]
mod preparation;
pub use preparation::PrepareArchive;
pub fn manager(app: &tauri::AppHandle) -> Result<Arc<Archives>> {
    static INSTANCE: OnceLock<Mutex<Option<Arc<Archives>>>>=OnceLock::new();
    let mut held=INSTANCE.get_or_init(||Mutex::new(None)).lock().map_err(|_|"archive_store")?;
    if let Some(value)=held.as_ref(){return Ok(Arc::clone(value));}
    let root=app.path().app_data_dir().map_err(|_|"archive_store")?.join("game-archives");
    let app=app.clone();
    let value=Archives::load(root,move|event|{let _=app.emit("games:archive-job",event);})?;
    *held=Some(Arc::clone(&value)); Ok(value)
}

#[cfg(test)]
#[path = "archive_jobs_tests.rs"]
mod tests;
