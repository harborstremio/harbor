use super::{download_metadata::{self, DownloadGame}, p2p_files as files, p2p_space::TorrentSpace, transfer_storage::{self, Storage}, write_metrics::{WriteCounter, WriteRate}};
use super::download_queue::{self, Entry as QueueEntry, Kind as QueueKind, Queue};
use super::transfer_bandwidth::{Bandwidth, CHUNK_BYTES};
use librqbit::{
    AddTorrent, AddTorrentOptions, AddTorrentResponse, Session, SessionOptions, TorrentStatsState,
    storage::StorageFactoryExt,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    net::SocketAddr,
    num::NonZeroU32,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager};
use tokio::{
    sync::Mutex as AsyncMutex,
    task::JoinHandle,
};
use tokio_util::sync::CancellationToken;
#[cfg(test)]
use tokio::sync::Semaphore;

pub type Result<T> = std::result::Result<T, &'static str>;
type Emit = Arc<dyn Fn(TorrentRecord) + Send + Sync>;
const TTL: Duration = Duration::from_secs(15 * 60);

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentFile {
    pub index: usize,
    pub path: String,
    pub bytes: u64,
    pub padding: bool,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentPlan {
    pub token: String,
    pub name: String,
    pub info_hash: String,
    pub total_bytes: u64,
    pub piece_length: u32,
    pub files: Vec<TorrentFile>,
    pub private: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Queued,
    Checking,
    Downloading,
    Paused,
    Complete,
    Failed,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentRecord {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preparation: Option<super::download_preparation::Choice>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sharing: Option<seeding::SeedState>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub storage_bytes: Option<u64>,
    #[serde(default)]
    pub queue_order: u64,
    pub id: String,
    pub profile: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub game: Option<DownloadGame>,
    pub info_hash: String,
    pub metadata_sha: String,
    pub destination: String,
    pub selected: Vec<usize>,
    pub total_bytes: u64,
    pub received: u64,
    pub status: Status,
    pub download_bps: u32,
    pub upload_bps: u32,
    pub created_at: u64,
    pub updated_at: u64,
    pub error: Option<String>,
    #[serde(default)]
    pub bytes_per_second: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disk_bytes_per_second: Option<u64>,
    #[serde(default)]
    pub upload_per_second: u64,
    #[serde(default)]
    pub peers: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seeders: Option<usize>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartTorrent {
    pub profile: String,
    pub token: String,
    pub parent: String,
    pub name: String,
    #[serde(default)]
    pub game: Option<DownloadGame>,
    pub selected: Vec<usize>,
    pub download_bps: u32,
    pub upload_bps: u32,
}
struct Prepared {
    profile: String,
    created: Instant,
    plan: TorrentPlan,
    bytes: Vec<u8>,
    peers: Vec<SocketAddr>,
}
struct Job {
    cancel: CancellationToken,
    task: JoinHandle<()>,
}
#[derive(Serialize, Deserialize)]
struct Store {
    version: u8,
    records: Vec<TorrentRecord>,
}
pub struct Torrents {
    seed_slots: Arc<tokio::sync::Semaphore>,
    #[cfg(test)]
    seed_ports: Mutex<HashMap<String, u16>>,
    forecast: Mutex<forecast::Cache>,
    root: PathBuf,
    records: Mutex<Vec<TorrentRecord>>,
    plans: Mutex<HashMap<String, Prepared>>,
    jobs: Mutex<HashMap<String, Job>>,
    inspections: Mutex<HashMap<String, (String, CancellationToken)>>,
    actions: AsyncMutex<()>,
    #[cfg(test)]
    slots: Arc<Semaphore>,
    emit: Emit,
    known_peers: Mutex<HashMap<String, Vec<SocketAddr>>>,
    storage: Arc<Storage>,
    queue: Arc<Queue>,
    bandwidth: Arc<Bandwidth>,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

impl Torrents {
    pub(crate) fn cleanup_usage(&self,profile:&str,id:&str)->Result<Vec<super::archive_cleanup::Usage>>{
        use super::archive_cleanup::{Usage,Blocker};
        let active:std::collections::HashSet<String>=self.jobs.lock().map_err(|_|"archive_store")?.iter()
            .filter(|(_,job)|!job.task.is_finished()).map(|(id,_)|id.clone()).collect();
        let records=self.records.lock().map_err(|_|"archive_store")?;
        Ok(records.iter().filter_map(|record|{
            let reason=if record.profile!=profile{Blocker::AnotherProfile}
                else if record.sharing.as_ref().is_some_and(|state|state.active()){Blocker::Sharing}
                else if record.preparation.as_ref().is_some_and(|choice|choice.id!=id){Blocker::PendingPreparation}
                else if record.status!=Status::Complete||active.contains(&record.id){Blocker::ActiveDownload}
                else{return None};
            Some(Usage{path:record.destination.clone(),tree:true,family:false,reason})
        }).collect())
    }
}

struct TorrentBandwidth {
    bandwidth: Arc<Bandwidth>,
    profile: String,
    cancel: CancellationToken,
}
impl librqbit::limits::DownloadLimiter for TorrentBandwidth {
    fn acquire(&self, bytes: NonZeroU32) -> std::pin::Pin<Box<dyn std::future::Future<Output = anyhow::Result<()>> + Send + '_>> {
        Box::pin(async move {
            let mut remaining = bytes.get() as usize;
            while remaining > 0 {
                let chunk = remaining.min(CHUNK_BYTES);
                self.bandwidth.acquire(&self.profile, chunk, &self.cancel).await.map_err(anyhow::Error::msg)?;
                remaining -= chunk;
            }
            Ok(())
        })
    }
}
fn limits(download: u32, upload: u32) -> Result<librqbit::limits::LimitsConfig> {
    if (download != 0 && download < 32 * 1024) || upload < 32 * 1024 {
        return Err("torrent_bandwidth");
    }
    Ok(librqbit::limits::LimitsConfig {
        download_bps: NonZeroU32::new(download),
        upload_bps: NonZeroU32::new(upload),
    })
}
pub fn manager(app: &tauri::AppHandle) -> Result<Arc<Torrents>> {
    static MANAGER: OnceLock<Mutex<Option<Arc<Torrents>>>> = OnceLock::new();
    let mut held = MANAGER
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|_| "torrent_store")?;
    if let Some(manager) = &*held {
        return Ok(manager.clone());
    }
    let root = app
        .path()
        .app_data_dir()
        .map_err(|_| "torrent_store")?
        .join("game-torrents");
    let emitter = app.clone();
    let manager = Torrents::new_with_queue(
        root,
        Arc::new(move |record| {
            let _ = emitter.emit("games:torrent", record);
        }),
        download_queue::manager(app).map_err(|_| "torrent_store")?,
        super::transfers::manager(app).map_err(|_| "torrent_store")?.bandwidth(),
    )?;
    *held = Some(manager.clone());
    Ok(manager)
}
impl Torrents {
    #[cfg(test)]
    pub(crate) fn new(root: PathBuf, emit: Emit) -> Result<Arc<Self>> {
        let queue = Queue::load(root.join("queue"), Vec::new(), |_| {}).map_err(|_| "torrent_store")?;
        Self::new_with_queue(root, emit, queue, Arc::new(Bandwidth::default()))
    }
    pub(crate) fn new_with_queue(root: PathBuf, emit: Emit, queue: Arc<Queue>, bandwidth: Arc<Bandwidth>) -> Result<Arc<Self>> {
        fs::create_dir_all(&root).map_err(|_| "torrent_store")?;
        let root = files::plain_dir(&root)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&root, fs::Permissions::from_mode(0o700))
                .map_err(|_| "torrent_store")?;
        }
        let path = root.join("transfers.json");
        let mut records = if path.symlink_metadata().is_ok() {
            let store: Store = serde_json::from_slice(&files::read(&path, 4 * 1024 * 1024)?)
                .map_err(|_| "torrent_store")?;
            if store.version != 1 || store.records.len() > 200 {
                return Err("torrent_store");
            }
            store.records
        } else {
            Vec::new()
        };
        let mut ids = std::collections::HashSet::new();
        for record in &mut records {
            // Older native torrent records used seconds; the shared UI uses ms.
            if record.created_at < 100_000_000_000 {
                record.created_at = record.created_at.saturating_mul(1000);
                record.updated_at = record.updated_at.saturating_mul(1000);
            }
            if record.status == Status::Complete && record.completed_at.is_none() {
                record.completed_at = Some(record.updated_at);
            }
            if let Some(sharing) = &mut record.sharing {
                sharing.policy.validate()?;
                if sharing.active() { sharing.status = seeding::SeedStatus::Stopped; }
            }
            files::profile(&record.profile)?;
            uuid::Uuid::parse_str(&record.id).map_err(|_| "torrent_store")?;
            if !ids.insert(record.id.clone())
                || record.name.len() > 240
                || record.selected.len() > files::MAX_FILES
                || record.selected.is_empty()
                || record.total_bytes > files::MAX_BYTES
                || !Path::new(&record.destination).is_absolute()
                || record.destination.len() > 4096
                || record.info_hash.len() != 40
                || !record.info_hash.bytes().all(|c| c.is_ascii_hexdigit())
                || record.metadata_sha.len() != 64
                || !record.metadata_sha.bytes().all(|c| c.is_ascii_hexdigit())
                || record.preparation.as_ref().is_some_and(|choice| !super::preparation_intake::belongs_to(choice, super::download_preparation::Engine::Torrent, &record.profile, &record.id))
            {
                return Err("torrent_store");
            }
            limits(record.download_bps, record.upload_bps)?;
            if matches!(
                record.status,
                Status::Queued | Status::Checking | Status::Downloading
            ) {
                record.status = Status::Paused;
            }
            record.bytes_per_second = 0;
            record.disk_bytes_per_second = Some(0);
            record.game = download_metadata::sanitize(record.game.take());
            record.upload_per_second = 0;
            record.peers = 0;
            record.seeders = None;
        }
        queue.reconcile(QueueKind::Torrent, &records.iter().map(|r| QueueEntry::new(QueueKind::Torrent, &r.id, &r.profile)).collect::<Vec<_>>()).map_err(|_| "torrent_store")?;
        for record in &records { queue.eligible(QueueKind::Torrent, &record.id, matches!(record.status, Status::Queued | Status::Paused | Status::Failed)); }
        Ok(Arc::new(Self {
            seed_slots: Arc::new(tokio::sync::Semaphore::new(2)),
            #[cfg(test)]
            seed_ports: Mutex::new(HashMap::new()),
            forecast: Mutex::new(forecast::Cache::default()),
            root,
            records: Mutex::new(records),
            plans: Mutex::new(HashMap::new()),
            jobs: Mutex::new(HashMap::new()),
            inspections: Mutex::new(HashMap::new()),
            actions: AsyncMutex::new(()),
            #[cfg(test)]
            slots: Arc::new(Semaphore::new(2)),
            emit,
            known_peers: Mutex::new(HashMap::new()),
            bandwidth,
            storage: transfer_storage::shared(),
            queue,
        }))
    }
    fn persist(&self, records: &[TorrentRecord]) -> Result<()> {
        let bytes = serde_json::to_vec(&Store {
            version: 1,
            records: records.to_vec(),
        })
        .map_err(|_| "torrent_store")?;
        if bytes.len() > 4 * 1024 * 1024 {
            return Err("torrent_limit");
        }
        files::atomic(&self.root, "transfers.json", &bytes)
    }
    pub fn list(&self, profile: &str) -> Result<Vec<TorrentRecord>> {
        files::profile(profile)?;
        let mut records: Vec<_> = self
            .records
            .lock()
            .map_err(|_| "torrent_store")?
            .iter()
            .filter(|r| r.profile == profile)
            .cloned()
            .map(|mut record| { record.queue_order = self.queue.order(QueueKind::Torrent, &record.id); record })
            .collect();
        records.sort_by_key(|r| r.queue_order);
        Ok(records)
    }
    pub(super) fn preparation_record(&self,profile:&str,id:&str)->Result<TorrentRecord>{
        self.records.lock().map_err(|_|"torrent_store")?.iter().find(|record|record.profile==profile&&record.id==id).cloned().ok_or("torrent_missing")
    }
    pub(super) fn preparation_intents(&self) -> Result<Vec<super::download_preparation::Choice>> {
        Ok(self.records.lock().map_err(|_| "torrent_store")?.iter().filter_map(|record| record.preparation.clone()).collect())
    }
    pub(super) fn ack_preparation(&self, profile: &str, id: &str, choice_id: &str) -> Result<()> {
        let mut records = self.records.lock().map_err(|_| "torrent_store")?;
        let Some(index) = records.iter().position(|record| record.profile == profile && record.id == id && record.preparation.as_ref().is_some_and(|choice| choice.id == choice_id)) else { return Ok(()); };
        let mut next = records.clone();
        next[index].preparation = None;
        self.persist(&next)?;
        let event = next[index].clone();
        *records = next;
        drop(records);
        self.emit_record(event);
        Ok(())
    }
    pub(super) fn preparation_files(&self,record:&TorrentRecord)->Result<Vec<TorrentFile>>{
        let bytes=files::read(&self.root.join(format!("{}.torrent",record.id)),files::MAX_METADATA)?;
        if files::digest(&bytes)!=record.metadata_sha{return Err("torrent_metadata");}
        let (metadata,items,_)=files::metadata(&bytes)?;
        if metadata.info_hash.as_string()!=record.info_hash{return Err("torrent_metadata");}
        files::verify_destination(record,&items)?;
        let selected:std::collections::HashSet<_>=record.selected.iter().copied().collect();
        Ok(items.into_iter().filter(|item|!item.padding&&selected.contains(&item.index)).collect())
    }
    fn emit_record(&self, mut record: TorrentRecord) {
        record.queue_order = self.queue.order(QueueKind::Torrent, &record.id);
        self.queue.eligible(QueueKind::Torrent, &record.id, matches!(record.status, Status::Queued | Status::Paused | Status::Failed));
        (self.emit)(record);
    }
    fn update(
        &self,
        id: &str,
        persist: bool,
        change: impl FnOnce(&mut TorrentRecord),
    ) -> Result<()> {
        let mut records = self.records.lock().map_err(|_| "torrent_store")?;
        let item = records
            .iter_mut()
            .find(|r| r.id == id)
            .ok_or("torrent_missing")?;
        change(item);
        item.updated_at = now();
        let result = if persist {
            self.persist(&records)
        } else {
            Ok(())
        };
        let item = records
            .iter_mut()
            .find(|r| r.id == id)
            .ok_or("torrent_missing")?;
        if result.is_err() {
            item.status = Status::Failed;
            item.error = Some("torrent_store".into());
            item.bytes_per_second = 0;
            item.disk_bytes_per_second = Some(0);
            item.upload_per_second = 0;
            item.peers = 0;
            item.seeders = None;
        }
        let event = item.clone();
        drop(records);
        self.emit_record(event);
        result
    }
    pub fn cancel_inspection(&self, profile: &str, operation: &str) {
        if let Ok(jobs) = self.inspections.lock() {
            if let Some((id, token)) = jobs.get(profile) {
                if id == operation {
                    token.cancel();
                }
            }
        }
    }
    pub fn discard(&self, profile: &str, token: &str) {
        if let Ok(mut plans) = self.plans.lock() {
            if plans.get(token).is_some_and(|plan| plan.profile == profile) {
                plans.remove(token);
            }
        }
    }
    fn prepare(
        &self,
        profile: &str,
        bytes: Vec<u8>,
        peers: Vec<SocketAddr>,
    ) -> Result<TorrentPlan> {
        let (metadata, items, total) = files::metadata(&bytes)?;
        let token = uuid::Uuid::new_v4().to_string();
        let name = metadata
            .info
            .name
            .as_ref()
            .and_then(|n| std::str::from_utf8(n.as_ref()).ok())
            .unwrap_or("Game files")
            .chars()
            .take(200)
            .collect::<String>();
        let plan = TorrentPlan {
            token: token.clone(),
            name,
            info_hash: metadata.info_hash.as_string(),
            total_bytes: total,
            piece_length: metadata.info.piece_length,
            files: items,
            private: metadata.info.private,
        };
        let mut plans = self.plans.lock().map_err(|_| "torrent_store")?;
        plans.retain(|_, plan| plan.created.elapsed() < TTL);
        if plans.len() >= 8 {
            return Err("torrent_busy");
        }
        plans.insert(
            token,
            Prepared {
                profile: profile.into(),
                created: Instant::now(),
                plan: plan.clone(),
                bytes,
                peers: peers.into_iter().take(200).collect(),
            },
        );
        Ok(plan)
    }
    fn session_options(
        &self,
        cancel: CancellationToken,
        rates: librqbit::limits::LimitsConfig,
    ) -> SessionOptions {
        SessionOptions {
            disable_dht: cfg!(test),
            disable_dht_persistence: true,
            persistence: None,
            fastresume: false,
            listen_port_range: None,
            enable_upnp_port_forwarding: false,
            cancellation_token: Some(cancel),
            ratelimits: rates,
            concurrent_init_limit: Some(1),
            ..Default::default()
        }
    }
    pub async fn inspect(
        self: &Arc<Self>,
        profile: String,
        source: String,
        operation: String,
    ) -> Result<TorrentPlan> {
        files::profile(&profile)?;
        uuid::Uuid::parse_str(&operation).map_err(|_| "torrent_request")?;
        let cancel = CancellationToken::new();
        {
            let mut jobs = self.inspections.lock().map_err(|_| "torrent_store")?;
            if jobs.contains_key(&profile) || jobs.len() >= 2 {
                return Err("torrent_busy");
            }
            jobs.insert(profile.clone(), (operation.clone(), cancel.clone()));
        }
        let result = self.inspect_inner(&profile, &source, &cancel).await;
        self.inspections
            .lock()
            .map_err(|_| "torrent_store")?
            .remove(&profile);
        if cancel.is_cancelled() {
            if let Ok(plan) = &result {
                self.discard(&profile, &plan.token);
            }
            return Err("torrent_canceled");
        }
        result
    }
    async fn inspect_inner(
        &self,
        profile: &str,
        source: &str,
        cancel: &CancellationToken,
    ) -> Result<TorrentPlan> {
        if source.starts_with("magnet:") {
            let source = files::magnet(source)?;
            let session = Session::new_with_opts(
                self.root.clone(),
                self.session_options(cancel.child_token(), Default::default()),
            )
            .await
            .map_err(|_| "torrent_network")?;
            let result = tokio::select! {
                _ = cancel.cancelled() => Err("torrent_canceled"),
                result = tokio::time::timeout(Duration::from_secs(60), session.add_torrent(AddTorrent::from_url(source), Some(AddTorrentOptions { list_only: true, ..Default::default() }))) => match result { Ok(Ok(AddTorrentResponse::ListOnly(info))) => self.prepare(profile, info.torrent_bytes.to_vec(), info.seen_peers), Ok(_) => Err("torrent_metadata"), Err(_) => Err("torrent_timeout") }
            };
            session.stop().await;
            result
        } else {
            let path = Path::new(source);
            if !path.is_absolute()
                || source.len() > 4096
                || !path
                    .extension()
                    .is_some_and(|s| s.eq_ignore_ascii_case("torrent"))
            {
                return Err("torrent_request");
            }
            self.prepare(profile, files::read(path, files::MAX_METADATA)?, Vec::new())
        }
    }
    pub async fn start(self: &Arc<Self>, request: StartTorrent) -> Result<TorrentRecord> {
        self.start_prepared(request, None).await
    }
    pub async fn start_prepared(self: &Arc<Self>, request: StartTorrent, preparation: Option<super::preparation_intake::Draft>) -> Result<TorrentRecord> {
        let _serial = self.actions.lock().await;
        files::profile(&request.profile)?;
        files::component(&request.name)?;
        limits(request.download_bps, request.upload_bps)?;
        let parent = files::plain_dir(Path::new(&request.parent))?;
        let dest = parent.join(&request.name);
        let _source_use=super::game_file_use::using(&[dest.clone()],true).map_err(|_|"torrent_busy")?;
        if dest.symlink_metadata().is_ok() {
            return Err("torrent_exists");
        }
        let (bytes, peers, plan) = {
            let plans = self.plans.lock().map_err(|_| "torrent_store")?;
            let plan = plans
                .get(&request.token)
                .filter(|p| p.profile == request.profile && p.created.elapsed() < TTL)
                .ok_or("torrent_expired")?;
            (plan.bytes.clone(), plan.peers.clone(), plan.plan.clone())
        };
        let total = files::selected(&plan.files, &request.selected)?;
        let space = files::required_storage(&plan.files, &request.selected, plan.piece_length);
        // Admission is a fresh feasibility check; active work takes its durable
        // in-process claim after a queue slot is available, before engine init.
        drop(self.storage.reserve(&format!("torrent-review:{}", request.token), &parent, space.saturating_add(transfer_storage::HEADROOM))
            .map_err(|error| if error == "transfer_space" { "torrent_space" } else { "torrent_store" })?);
        {
            let records = self.records.lock().map_err(|_| "torrent_store")?;
            if records.len() >= 200 {
                return Err("torrent_limit");
            }
            if records
                .iter()
                .any(|r| r.profile == request.profile && r.info_hash == plan.info_hash)
            {
                return Err("torrent_duplicate");
            }
        }
        let mut record = TorrentRecord {
            preparation: None,
            completed_at: None,
            sharing: None,
            storage_bytes: Some(space),
            queue_order: 0,
            id: uuid::Uuid::new_v4().to_string(),
            profile: request.profile,
            name: request.name,
            game: download_metadata::sanitize(request.game),
            info_hash: plan.info_hash,
            metadata_sha: files::digest(&bytes),
            destination: dest.to_string_lossy().into_owned(),
            selected: request.selected,
            total_bytes: total,
            received: 0,
            status: Status::Queued,
            download_bps: request.download_bps,
            upload_bps: request.upload_bps,
            created_at: now(),
            updated_at: now(),
            error: None,
            bytes_per_second: 0,
            disk_bytes_per_second: Some(0),
            upload_per_second: 0,
            peers: 0,
            seeders: None,
        };
        if let Some(draft) = preparation { super::preparation_intake::torrent(&mut record, &plan.files, draft)?; }
        files::atomic(&self.root, &format!("{}.torrent", record.id), &bytes)?;
        fs::create_dir(&dest).map_err(|_| "torrent_exists")?;
        let marker = format!(
            "{}\n{}\n{}",
            record.id,
            files::digest(record.profile.as_bytes()),
            record.info_hash
        );
        let result = (|| {
            files::atomic(&dest, ".harbor-torrent", marker.as_bytes())?;
            let mut records = self.records.lock().map_err(|_| "torrent_store")?;
            let mut next = records.clone();
            next.push(record.clone());
            self.queue.register(&[QueueEntry::new(QueueKind::Torrent, &record.id, &record.profile)]).map_err(|_| "torrent_store")?;
            self.persist(&next)?;
            *records = next;
            Ok(())
        })();
        if result.is_err() {
            let _ = self.queue.forget(QueueKind::Torrent, &record.id);
            let _ = fs::remove_file(dest.join(".harbor-torrent"));
            let _ = fs::remove_dir(&dest);
            let _ = fs::remove_file(self.root.join(format!("{}.torrent", record.id)));
            return result.map(|_| record);
        }
        self.discard(&record.profile, &request.token);
        record.queue_order = self.queue.order(QueueKind::Torrent, &record.id);
        self.emit_record(record.clone());
        self.enqueue(record.clone(), peers, false)?;
        Ok(record)
    }
    fn enqueue(
        self: &Arc<Self>,
        record: TorrentRecord,
        peers: Vec<SocketAddr>,
        resume: bool,
    ) -> Result<()> {
        let peers = {
            let mut known = self.known_peers.lock().map_err(|_| "torrent_store")?;
            if !peers.is_empty() {
                known.insert(record.id.clone(), peers);
            }
            known.get(&record.id).cloned().unwrap_or_default()
        };
        let cancel = CancellationToken::new();
        let token = cancel.clone();
        let manager = self.clone();
        let id = record.id.clone();
        let ticket = self.queue.ticket(QueueKind::Torrent, &record.profile, &record.id).map_err(|_| "torrent_store")?;
        let task = tokio::spawn(async move {
            #[cfg(test)]
            let permit = tokio::select! { _ = token.cancelled() => return, permit = manager.slots.clone().acquire_owned() => match permit { Ok(permit) => permit, Err(_) => return } };
            let result = async {
                ticket.acquire(&token).await.map_err(|error| if error == "transfer_stopped" { "torrent_canceled" } else { "torrent_store" })?;
                manager.run(&record, peers, resume, &token).await
            }.await;
            if let Err(error) = result {
                let _ = manager.update(&record.id, true, |r| {
                    r.status = if token.is_cancelled() {
                        Status::Paused
                    } else {
                        Status::Failed
                    };
                    r.error = (!token.is_cancelled()).then(|| error.into());
                    r.bytes_per_second = 0;
                    r.disk_bytes_per_second = Some(0);
                    r.upload_per_second = 0;
                    r.peers = 0;
                    r.seeders = Some(0);
                });
            }
            drop(ticket);
            #[cfg(test)]
            drop(permit);
        });
        self.jobs
            .lock()
            .map_err(|_| "torrent_store")?
            .insert(id, Job { cancel, task });
        Ok(())
    }
    async fn run(
        &self,
        record: &TorrentRecord,
        peers: Vec<SocketAddr>,
        resume: bool,
        cancel: &CancellationToken,
    ) -> Result<()> {
        let _source_use=super::game_file_use::using(&[PathBuf::from(&record.destination)],true).map_err(|_|"torrent_busy")?;
        let bytes = files::read(
            &self.root.join(format!("{}.torrent", record.id)),
            files::MAX_METADATA,
        )?;
        if files::digest(&bytes) != record.metadata_sha {
            return Err("torrent_metadata");
        }
        let (metadata, items, _) = files::metadata(&bytes)?;
        if metadata.info_hash.as_string() != record.info_hash
            || files::selected(&items, &record.selected)? != record.total_bytes
        {
            return Err("torrent_metadata");
        }
        files::verify_destination(record, &items)?;
        let space = TorrentSpace::new(&self.storage, &record.id, Path::new(&record.destination), &items, &record.selected, metadata.info.piece_length)?;
        let _space_lease = space.lease();
        self.update(&record.id, true, |r| {
            r.status = Status::Checking;
            r.error = None;
        })?;
        let mut options = self.session_options(
            cancel.child_token(),
            limits(record.download_bps, record.upload_bps)?,
        );
        options.disable_dht |= metadata.info.private;
        options.download_limiter = Some(Arc::new(TorrentBandwidth {
            bandwidth: self.bandwidth.clone(),
            profile: record.profile.clone(),
            cancel: cancel.child_token(),
        }));
        let written = WriteCounter::default();
        let mut write_rate = WriteRate::new(&written);
        options.default_storage_factory = Some(super::p2p_storage::MeasuredStorageFactory { written: written.clone(), space: space.clone() }.boxed());
        let session = Session::new_with_opts(PathBuf::from(&record.destination), options)
            .await
            .map_err(|_| "torrent_network")?;
        let result = async {
            let handle = session.add_torrent(AddTorrent::from_bytes(bytes), Some(AddTorrentOptions { output_folder: Some(record.destination.clone()), overwrite: resume, only_files: Some(record.selected.clone()), initial_peers: Some(peers), disable_trackers: cfg!(test), ..Default::default() })).await.map_err(|_| space.failure().unwrap_or("torrent_start"))?.into_handle().ok_or("torrent_start")?;
            let mut tick = tokio::time::interval(Duration::from_secs(1)); let mut last_save = Instant::now();
            loop {
                tokio::select! { _ = cancel.cancelled() => return Err("torrent_canceled"), _ = tick.tick() => {} }
                space.check()?;
                let stats = handle.stats();
                if matches!(stats.state, TorrentStatsState::Error) { return Err("torrent_engine"); }
                let received: u64 = record.selected.iter().map(|i| stats.file_progress.get(*i).copied().unwrap_or(0).min(items[*i].bytes)).sum();
                let complete = stats.finished && !matches!(stats.state, TorrentStatsState::Initializing);
                let save = complete || last_save.elapsed() >= Duration::from_secs(5);
                let disk_speed = write_rate.sample(&written);
                if save { last_save = Instant::now(); }
                self.update(&record.id, save, |r| {
                    r.received = if complete { r.total_bytes } else { received.min(r.total_bytes) };
                    r.status = if complete { Status::Complete } else if matches!(stats.state, TorrentStatsState::Initializing) { Status::Checking } else { Status::Downloading };
                    r.bytes_per_second = stats.live.as_ref().map_or(0, |s| (s.download_speed.mbps * 1024.0 * 1024.0) as u64);
                    r.upload_per_second = stats.live.as_ref().map_or(0, |s| (s.upload_speed.mbps * 1024.0 * 1024.0) as u64);
                    r.peers = stats.live.as_ref().map_or(0, |s| s.snapshot.peer_stats.live);
                    r.seeders = stats.live.as_ref().map(|s| s.snapshot.peer_stats.seeders);
                    r.disk_bytes_per_second = Some(if complete { 0 } else { disk_speed });
                    if complete { r.completed_at.get_or_insert_with(now); r.bytes_per_second = 0; r.upload_per_second = 0; r.peers = 0; r.seeders = Some(0); }
                })?;
                if complete { break; }
            }
            Ok(())
        }.await;
        // Each game owns its session. Stop sharing as soon as its selected pieces are verified.
        session.stop().await;
        result
    }
    pub async fn action(
        self: &Arc<Self>,
        profile: String,
        id: String,
        action: String,
    ) -> Result<()> {
        let _serial = self.actions.lock().await;
        files::profile(&profile)?;
        self.list(&profile)?
            .into_iter()
            .find(|r| r.id == id)
            .ok_or("torrent_missing")?;
        if matches!(action.as_str(), "earlier" | "later") {
            return self.queue.reorder(QueueKind::Torrent, &profile, &id, action == "earlier").map_err(|error| if error == "transfer_store" { "torrent_store" } else { "torrent_request" });
        }
        if !["pause", "resume", "remove"].contains(&action.as_str()) {
            return Err("torrent_request");
        }
        let job = self.jobs.lock().map_err(|_| "torrent_store")?.remove(&id);
        if let Some(job) = job {
            job.cancel.cancel();
            let _ = job.task.await;
        }
        if action == "remove" {
            let mut records = self.records.lock().map_err(|_| "torrent_store")?;
            let next = records
                .iter()
                .filter(|r| r.id != id)
                .cloned()
                .collect::<Vec<_>>();
            self.persist(&next)?;
            *records = next;
            let _ = self.queue.forget(QueueKind::Torrent, &id);
            // User files always remain. Only Harbor's private metadata is removed.
            let _ = fs::remove_file(self.root.join(format!("{id}.torrent")));
            if let Ok(mut peers) = self.known_peers.lock() {
                peers.remove(&id);
            }
            return Ok(());
        }
        let record = self
            .list(&profile)?
            .into_iter()
            .find(|r| r.id == id)
            .ok_or("torrent_missing")?;
        if record.status == Status::Complete {
            if action == "resume" && record.sharing.is_some() {
                return self.start_seeding(record, None).await;
            }
            return Ok(());
        }
        if action == "pause" {
            self.update(&id, true, |r| {
                r.status = Status::Paused;
                r.error = None;
                r.bytes_per_second = 0;
                r.disk_bytes_per_second = Some(0);
                r.upload_per_second = 0;
                r.peers = 0;
                r.seeders = Some(0);
            })
        } else {
            self.update(&id, true, |r| {
                r.status = Status::Queued;
                r.error = None;
            })?;
            self.enqueue(record, Vec::new(), true)
        }
    }
}

#[cfg(test)]
#[path = "p2p_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "preparation_engine_tests.rs"]
mod preparation_tests;

#[path = "p2p_forecast.rs"]
mod forecast;

#[path = "p2p_seeding.rs"]
pub mod seeding;
