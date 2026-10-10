use super::{
    download_queue::{self, Entry as QueueEntry, Kind as QueueKind, Queue},
    download_metadata::{self, DownloadGame},
    transfer_bandwidth::{self, Bandwidth},
    transfer_files as files, transfer_protocol as protocol,
    transfer_retry::Failure,
    transfer_storage::{self, Storage},
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio_util::sync::CancellationToken;

type Result<T> = std::result::Result<T, &'static str>;
const LIMIT: usize = 200;
const STORE_BYTES: usize = 4 * 1024 * 1024;
#[path = "transfer_batch.rs"]
mod batch;
pub use batch::NewBatch;
#[path = "transfer_relink.rs"]
mod relink;
pub use relink::Relink;
#[derive(Clone, Serialize, Deserialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Queued,
    Connecting,
    Retrying,
    Downloading,
    Checking,
    Pausing,
    Paused,
    Canceling,
    Canceled,
    Complete,
    Failed,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transfer {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub batch_id: Option<String>,
    /// Some while a replacement URL must prove the saved prefix before appending.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub checking_partial: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preparation: Option<super::download_preparation::Choice>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_link: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_page: Option<String>,
    pub id: String,
    pub profile: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub game: Option<DownloadGame>,
    pub url: String,
    pub destination: String,
    pub status: Status,
    pub received: u64,
    pub total: Option<u64>,
    pub expected_bytes: Option<u64>,
    pub expected_sha256: Option<String>,
    pub sha256: Option<String>,
    pub validator: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub error: Option<String>,
    #[serde(default)]
    pub bytes_per_second: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub disk_bytes_per_second: Option<u64>,
    #[serde(default)]
    pub queue_order: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTransfer {
    #[serde(default)]
    pub source_link: Option<String>,
    #[serde(default)]
    pub browser_ticket: Option<String>,
    pub profile: String,
    pub name: String,
    #[serde(default)]
    pub game: Option<DownloadGame>,
    pub url: String,
    pub destination: String,
    pub expected_bytes: Option<u64>,
    pub expected_sha256: Option<String>,
}
#[derive(Default, Serialize, Deserialize)]
struct Store {
    #[serde(default)]
    version: u8,
    records: Vec<Transfer>,
    #[serde(default)]
    bandwidth_limits: HashMap<String, u64>,
}
struct State {
    records: Vec<Transfer>,
    active: HashMap<String, CancellationToken>,
    bandwidth_limits: HashMap<String, u64>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferSettings {
    pub profile: String,
    pub bytes_per_second_limit: u64,
}
pub struct Transfers {
    root: PathBuf,
    state: Mutex<State>,
    client: reqwest::Client,
    emit: Arc<dyn Fn(Transfer) + Send + Sync>,
    bandwidth: Arc<Bandwidth>,
    storage: Arc<Storage>,
    queue: Arc<Queue>,
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn profile_valid(profile: &str) -> bool {
    !profile.is_empty() && profile.len() <= 256 && !profile.contains('\0')
}
impl Transfers {
    pub(crate) fn cleanup_usage(&self,profile:&str,id:&str)->Result<Vec<super::archive_cleanup::Usage>>{
        use super::archive_cleanup::{Usage,Blocker};
        let state=self.state.lock().map_err(|_|"archive_store")?;
        Ok(state.records.iter().filter_map(|record|{
            let reason=if record.profile!=profile{Blocker::AnotherProfile}
                else if record.preparation.as_ref().is_some_and(|choice|choice.id!=id){Blocker::PendingPreparation}
                else if record.status!=Status::Complete||state.active.contains_key(&record.id){Blocker::ActiveDownload}
                else{return None};
            Some(Usage{path:record.destination.clone(),tree:false,family:false,reason})
        }).collect())
    }
    #[cfg(test)]
    pub fn load(
        root: PathBuf,
        emit: impl Fn(Transfer) + Send + Sync + 'static,
    ) -> Result<Arc<Self>> {
        let queue = Queue::load(root.join("queue"), Vec::new(), |_| {})?;
        Self::load_with_queue(root, emit, queue)
    }
    pub(crate) fn load_with_queue(root: PathBuf, emit: impl Fn(Transfer) + Send + Sync + 'static, queue: Arc<Queue>) -> Result<Arc<Self>> {
        fs::create_dir_all(&root).map_err(|_| "transfer_store")?;
        let path = root.join("transfers.json");
        let store = if path.exists() {
            if fs::metadata(&path).map_err(|_| "transfer_store")?.len() > STORE_BYTES as u64 {
                return Err("transfer_store");
            }
            let store: Store =
                serde_json::from_slice(&fs::read(&path).map_err(|_| "transfer_store")?)
                    .map_err(|_| "transfer_store")?;
            if store.version != 1
                || store.records.len() > LIMIT
                || store.bandwidth_limits.len() > LIMIT
                || store.bandwidth_limits.iter().any(|(profile, rate)| {
                    !profile_valid(profile) || !transfer_bandwidth::valid_rate(*rate)
                })
            {
                return Err("transfer_store");
            }
            store
        } else {
            Store::default()
        };
        let mut records = store.records;
        for (index, item) in records.iter_mut().enumerate() {
            // Persisted vector order is authoritative, including stores predating this field.
            item.queue_order = index as u64 + 1;
            if !profile_valid(&item.profile)
                || uuid::Uuid::parse_str(&item.id).is_err()
                || protocol::validate_url(&item.url).is_err()
                || !Path::new(&item.destination).is_absolute()
                || item.preparation.as_ref().is_some_and(|choice| !super::preparation_intake::belongs_to(choice, super::download_preparation::Engine::Direct, &item.profile, &item.id) || choice.target.archive != item.destination)
            {
                return Err("transfer_store");
            }
            if let Some(page) = &item.source_page {
                super::source_browser_policy::browser_pair(page, &item.url).map_err(|_| "transfer_store")?;
            }
            item.bytes_per_second = 0;
            item.disk_bytes_per_second = Some(0);
            item.game = download_metadata::sanitize(item.game.take());
            item.source_link = download_metadata::source_link(item.source_link.take());
            if matches!(
                item.status,
                Status::Queued
                    | Status::Connecting
                    | Status::Retrying
                    | Status::Downloading
                    | Status::Checking
                    | Status::Pausing
            ) {
                item.status = Status::Paused;
                item.error = Some("transfer_interrupted".into());
            }
            if item.status == Status::Canceling {
                let _ = files::partial(Path::new(&item.destination), &item.id)
                    .and_then(|p| remove_partial(&p));
                item.status = Status::Canceled;
            }
        }
        let client = reqwest::Client::builder()
            .user_agent("Harbor/0.9 Games")
            .connect_timeout(Duration::from_secs(15))
            .no_gzip()
            .no_brotli()
            .no_deflate()
            .no_zstd()
            .redirect(reqwest::redirect::Policy::limited(8))
            .build()
            .map_err(|_| "transfer_network")?;
        let bandwidth = Arc::new(Bandwidth::default());
        for (profile, rate) in &store.bandwidth_limits {
            bandwidth.set(profile, *rate);
        }
        let value = Arc::new(Self {
            root,
            state: Mutex::new(State {
                records,
                active: HashMap::new(),
                bandwidth_limits: store.bandwidth_limits,
            }),
            client,
            emit: Arc::new(emit),
            bandwidth,
            storage: transfer_storage::shared(),
            queue,
        });
        {
            let state = value.state.lock().map_err(|_| "transfer_store")?;
            value.persist(&state)?;
            value.queue.reconcile(QueueKind::Direct, &state.records.iter().map(|r| QueueEntry::new(QueueKind::Direct, &r.id, &r.profile)).collect::<Vec<_>>())?;
            value.register_queue(&state.records)?;
        }
        Ok(value)
    }
    fn persist(&self, state: &State) -> Result<()> {
        let bytes = serde_json::to_vec(&Store {
            version: 1,
            records: state.records.clone(),
            bandwidth_limits: state.bandwidth_limits.clone(),
        })
        .map_err(|_| "transfer_store")?;
        // Never accept metadata that makes the next startup unable to read its queue.
        if bytes.len() > STORE_BYTES { return Err("transfer_limit"); }
        let temporary = self
            .root
            .join(format!("transfers-{}.tmp", uuid::Uuid::new_v4()));
        let write = || -> std::io::Result<()> {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)?;
            file.write_all(&bytes)?;
            file.sync_all()?;
            fs::rename(&temporary, self.root.join("transfers.json"))?;
            Ok(())
        };
        if write().is_err() {
            let _ = fs::remove_file(temporary);
            return Err("transfer_store");
        }
        Ok(())
    }
    pub fn list(&self, profile: &str) -> Result<Vec<Transfer>> {
        if !profile_valid(profile) {
            return Err("transfer_profile");
        }
        let mut records: Vec<_> = self
            .state
            .lock()
            .map_err(|_| "transfer_store")?
            .records
            .iter()
            .filter(|r| r.profile == profile)
            .cloned()
            .map(|mut record| { record.queue_order = self.queue.order(QueueKind::Direct, &record.id); record })
            .collect();
        records.sort_by_key(|r| r.queue_order);
        Ok(records)
    }
    pub(super) fn preparation_record(&self,profile:&str,id:&str)->Result<Transfer>{
        self.state.lock().map_err(|_|"transfer_store")?.records.iter().find(|record|record.profile==profile&&record.id==id).cloned().ok_or("transfer_missing")
    }
    pub(super) fn preparation_intents(&self) -> Result<Vec<super::download_preparation::Choice>> {
        Ok(self.state.lock().map_err(|_| "transfer_store")?.records.iter().filter_map(|record| record.preparation.clone()).collect())
    }
    pub(super) fn ack_preparation(&self, profile: &str, id: &str, choice_id: &str) -> Result<()> {
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        let Some(index) = state.records.iter().position(|record| record.profile == profile && record.id == id && record.preparation.as_ref().is_some_and(|choice| choice.id == choice_id)) else { return Ok(()); };
        let intake = state.records[index].preparation.take();
        if let Err(error) = self.persist(&state) { state.records[index].preparation = intake; return Err(error); }
        let event = state.records[index].clone();
        drop(state);
        self.emit_record(event);
        Ok(())
    }
    fn register_queue(&self, records: &[Transfer]) -> Result<()> {
        self.queue.register(&records.iter().map(|r| QueueEntry::new(QueueKind::Direct, &r.id, &r.profile)).collect::<Vec<_>>())?;
        for record in records { self.queue.eligible(QueueKind::Direct, &record.id, matches!(record.status, Status::Queued | Status::Paused | Status::Failed)); }
        Ok(())
    }
    fn emit_record(&self, mut record: Transfer) {
        record.queue_order = self.queue.order(QueueKind::Direct, &record.id);
        self.queue.eligible(QueueKind::Direct, &record.id, matches!(record.status, Status::Queued | Status::Paused | Status::Failed));
        (self.emit)(record);
    }
    pub fn settings(&self, profile: &str) -> Result<TransferSettings> {
        if !profile_valid(profile) {
            return Err("transfer_profile");
        }
        let state = self.state.lock().map_err(|_| "transfer_store")?;
        Ok(TransferSettings {
            profile: profile.into(),
            bytes_per_second_limit: state.bandwidth_limits.get(profile).copied().unwrap_or(0),
        })
    }
    #[cfg(test)]
    pub fn storage_forecast(&self, profile: &str) -> Result<Vec<transfer_storage::Forecast>> {
        Ok(self.storage.forecast(&self.storage_items(profile)?))
    }
    pub fn storage_items(&self, profile: &str) -> Result<Vec<transfer_storage::ForecastItem>> {
        Ok(self.list(profile)?.into_iter().filter(|record| !matches!(record.status, Status::Complete | Status::Canceled)).filter_map(|record| {
            let destination = Path::new(&record.destination);
            let parent = destination.parent()?.to_owned();
            let remaining = record.total.or(record.expected_bytes).map(|total| {
                let written = files::partial(destination, &record.id).ok().and_then(|path| files::ensure_regular(&path).ok().flatten()).unwrap_or(0);
                total.saturating_sub(written)
            });
            Some(transfer_storage::ForecastItem { id: record.id, path: parent, remaining, file_count: 1, estimated_files: 0 })
        }).collect())
    }
    pub(crate) fn bandwidth(&self) -> Arc<Bandwidth> {
        self.bandwidth.clone()
    }

    pub fn set_bandwidth(&self, profile: &str, rate: u64) -> Result<TransferSettings> {
        if !profile_valid(profile) {
            return Err("transfer_profile");
        }
        if !transfer_bandwidth::valid_rate(rate) {
            return Err("transfer_bandwidth");
        }
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        let old = state.bandwidth_limits.get(profile).copied();
        if old.unwrap_or(0) != rate {
            if rate != 0 && old.is_none() && state.bandwidth_limits.len() >= LIMIT {
                return Err("transfer_limit");
            }
            if rate == 0 {
                state.bandwidth_limits.remove(profile);
            } else {
                state.bandwidth_limits.insert(profile.into(), rate);
            }
            if let Err(error) = self.persist(&state) {
                if let Some(value) = old {
                    state.bandwidth_limits.insert(profile.into(), value);
                } else {
                    state.bandwidth_limits.remove(profile);
                }
                return Err(error);
            }
            // Keep the store lock until the running limiter has the same durable setting.
            self.bandwidth.set(profile, rate);
        }
        Ok(TransferSettings {
            profile: profile.into(),
            bytes_per_second_limit: rate,
        })
    }
    pub fn add(self: &Arc<Self>, args: NewTransfer) -> Result<Transfer> {
        self.add_prepared(args, None)
    }
    pub fn add_prepared(self: &Arc<Self>, args: NewTransfer, preparation: Option<super::preparation_intake::Draft>) -> Result<Transfer> {
        self.add_records(vec![args], preparation)?.pop().ok_or("transfer_invalid_record")
    }
    pub fn action(self: &Arc<Self>, profile: &str, id: &str, action: &str) -> Result<()> {
        if matches!(action, "earlier" | "later") {
            return self.reorder(profile, id, action == "earlier");
        }
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        let index = state
            .records
            .iter()
            .position(|r| r.id == id && r.profile == profile)
            .ok_or("transfer_unknown")?;
        let old = state.records[index].clone();
        let active = state.active.get(id).cloned();
        let item = &mut state.records[index];
        match action {
            "pause"
                if matches!(
                    item.status,
                    Status::Queued
                        | Status::Connecting
                        | Status::Retrying
                        | Status::Downloading
                        | Status::Checking
                ) =>
            {
                item.status = if active.is_some() {
                    Status::Pausing
                } else {
                    Status::Paused
                };
                item.bytes_per_second = 0;
                item.disk_bytes_per_second = Some(0);
            }
            "resume" if matches!(item.status, Status::Paused | Status::Failed) => {
                item.status = Status::Queued;
                item.error = None;
            }
            "cancel"
                if !matches!(
                    item.status,
                    Status::Complete | Status::Canceled | Status::Canceling
                ) =>
            {
                item.status = if active.is_some() {
                    Status::Canceling
                } else {
                    Status::Canceled
                };
                item.bytes_per_second = 0;
                item.disk_bytes_per_second = Some(0);
            }
            "remove"
                if active.is_none()
                    && matches!(
                        item.status,
                        Status::Complete | Status::Canceled | Status::Failed | Status::Paused
                    ) =>
            {
                if old.status != Status::Complete {
                    remove_partial(&files::partial(Path::new(&old.destination), id)?)?;
                }
                state.records.remove(index);
                if let Err(error) = self.persist(&state) {
                    state.records.insert(index, old);
                    return Err(error);
                }
                let _ = self.queue.forget(QueueKind::Direct, id);
                return Ok(());
            }
            _ => return Err("transfer_state"),
        }
        item.updated_at = now();
        let changed = item.clone();
        if active.is_none() && changed.status == Status::Canceled {
            if let Err(error) =
                remove_partial(&files::partial(Path::new(&changed.destination), id)?)
            {
                state.records[index] = old;
                return Err(error);
            }
        }
        if let Err(error) = self.persist(&state) {
            state.records[index] = old;
            return Err(error);
        }
        drop(state);
        if let Some(token) = active {
            token.cancel();
        }
        self.emit_record(changed);
        self.kick();
        Ok(())
    }
    fn reorder(&self, profile: &str, id: &str, earlier: bool) -> Result<()> {
        let state = self.state.lock().map_err(|_| "transfer_store")?;
        let record = state.records.iter().find(|r| r.id == id && r.profile == profile).ok_or("transfer_unknown")?;
        if !matches!(record.status, Status::Queued | Status::Paused | Status::Failed) { return Err("transfer_state"); }
        self.register_queue(&state.records)?;
        drop(state);
        self.queue.reorder(QueueKind::Direct, profile, id, earlier)
    }
    fn update(
        &self,
        id: &str,
        change: impl FnOnce(&mut Transfer),
        durable: bool,
    ) -> Result<Transfer> {
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        let item = state
            .records
            .iter_mut()
            .find(|r| r.id == id)
            .ok_or("transfer_unknown")?;
        if matches!(item.status, Status::Pausing | Status::Canceling) {
            return Err("transfer_stopped");
        }
        change(item);
        item.updated_at = now();
        let changed = item.clone();
        if durable {
            self.persist(&state)?;
        }
        drop(state);
        self.emit_record(changed.clone());
        Ok(changed)
    }
    fn kick(self: &Arc<Self>) {
        let Ok(mut state) = self.state.lock() else { return; };
        if self.register_queue(&state.records).is_err() { return; }
        let records: Vec<_> = state.records.iter().filter(|r| r.status == Status::Queued && !state.active.contains_key(&r.id)).cloned().collect();
        let mut jobs = Vec::new();
        for record in records {
            let ticket = match self.queue.ticket(QueueKind::Direct, &record.profile, &record.id) { Ok(ticket) => ticket, Err(_) => continue };
            let token = CancellationToken::new();
            state.active.insert(record.id.clone(), token.clone());
            jobs.push((record, token, ticket));
        }
        drop(state);
        for (record, token, ticket) in jobs {
            let manager = Arc::clone(self);
            tauri::async_runtime::spawn(async move {
                let result = async {
                    ticket.acquire(&token).await?;
                    manager.update(&record.id, |r| { r.status = Status::Connecting; }, true)?;
                    manager.run(&record, token).await
                }.await;
                manager.finished(&record.id, result);
                drop(ticket);
                manager.kick();
            });
        }
    }
    fn finished(&self, id: &str, result: Result<()>) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        state.active.remove(id);
        let Some(item) = state.records.iter_mut().find(|r| r.id == id) else {
            return;
        };
        if item.status == Status::Canceling {
            match files::partial(Path::new(&item.destination), id).and_then(|p| remove_partial(&p))
            {
                Ok(()) => {
                    item.status = Status::Canceled;
                    item.received = 0;
                    item.error = None;
                }
                Err(error) => {
                    item.status = Status::Failed;
                    item.error = Some(error.into());
                }
            }
        } else if item.status == Status::Pausing {
            item.status = Status::Paused;
            item.error = None;
        } else if let Err(error) = result {
            item.status = Status::Failed;
            item.error = Some(error.into());
        }
        if matches!(item.status, Status::Paused | Status::Failed) {
            if let Ok(path) = files::partial(Path::new(&item.destination), id) {
                if let Ok(Some(size)) = files::ensure_regular(&path) {
                    item.received = size;
                }
            }
        }
        item.bytes_per_second = 0;
        item.disk_bytes_per_second = Some(0);
        item.updated_at = now();
        let changed = item.clone();
        let _ = self.persist(&state);
        drop(state);
        self.emit_record(changed);
    }
    async fn run(&self, record: &Transfer, cancel: CancellationToken) -> Result<()> {
        let _source_use=super::game_file_use::using(&[PathBuf::from(&record.destination)],false).map_err(|_|"transfer_destination")?;
        let mut current = record.clone();
        let mut retries = 0;
        loop {
            if cancel.is_cancelled() {
                return Err("transfer_stopped");
            }
            match self.run_attempt(&current, cancel.clone()).await {
                Ok(()) => return Ok(()),
                Err(error) => {
                    if cancel.is_cancelled() {
                        return Err("transfer_stopped");
                    }
                    let delay = error.delay(retries).ok_or(error.code)?;
                    retries += 1;
                    let part = files::partial(Path::new(&current.destination), &current.id)?;
                    let received = files::ensure_regular(&part)?.unwrap_or(0);
                    current = self.update(
                        &current.id,
                        |item| {
                            item.status = Status::Retrying;
                            item.received = received;
                            item.bytes_per_second = 0;
                            item.disk_bytes_per_second = Some(0);
                            item.error = None;
                        },
                        true,
                    )?;
                    tokio::select! {
                        _ = cancel.cancelled() => return Err("transfer_stopped"),
                        _ = tokio::time::sleep(delay) => {}
                    }
                    current =
                        self.update(&current.id, |item| item.status = Status::Connecting, true)?;
                }
            }
        }
    }
    async fn run_attempt(
        &self,
        record: &Transfer,
        cancel: CancellationToken,
    ) -> std::result::Result<(), Failure> {
        let dest = PathBuf::from(&record.destination);
        let part = files::partial(&dest, &record.id)?;
        // Recover a crash between publishing a verified file and saving its Complete state.
        if files::ensure_regular(&part)?.is_none() && files::ensure_regular(&dest)?.is_some() {
            let expected = record.sha256.as_ref().ok_or("transfer_exists")?;
            let hash = hash_async(dest.clone(), cancel.clone()).await?;
            if &hash != expected {
                return Err("transfer_exists".into());
            }
            self.update(
                &record.id,
                |r| {
                    r.status = Status::Complete;
                    r.error = None;
                },
                true,
            )?;
            return Ok(());
        }
        if dest.symlink_metadata().is_ok() {
            return Err("transfer_exists".into());
        }
        let saved = files::ensure_regular(&part)?.unwrap_or(0);
        let verify_partial = record.checking_partial.is_some() && saved > 0;
        let mut offset = saved;
        if verify_partial || record.validator.is_none() {
            offset = 0;
        }
        let mut response = None;
        for attempt in 0..2 {
            let mut request = if let Some(page) = &record.source_page {
                tokio::select! {
                    _ = cancel.cancelled() => return Err("transfer_stopped".into()),
                    result = super::source_browser::request(record.profile.clone(), page.clone(), record.url.clone()) => result?,
                }
            } else { self.client.get(protocol::validate_url(&record.url)?) };
            request = request.header(reqwest::header::ACCEPT_ENCODING, "identity");
            if offset > 0 {
                request = request
                    .header(reqwest::header::RANGE, format!("bytes={offset}-"))
                    .header(
                        reqwest::header::IF_RANGE,
                        record.validator.as_deref().unwrap_or_default(),
                    );
            }
            let incoming = tokio::select! {_ = cancel.cancelled()=>return Err("transfer_stopped".into()),result=tokio::time::timeout(Duration::from_secs(30),request.send())=>result.map_err(|_|"transfer_timeout")?.map_err(|_|"transfer_network")?};
            if let Some(error) = Failure::from_http(incoming.status().as_u16(), incoming.headers())
            {
                return Err(error);
            }
            if incoming.status().as_u16() == 416 && offset > 0 && attempt == 0 {
                offset = 0;
                continue;
            }
            let plan = protocol::response_plan(
                incoming.status().as_u16(),
                incoming.headers(),
                offset,
                record.expected_bytes,
            )?;
            if offset > 0 && plan.offset > 0 && plan.validator.as_ref() != record.validator.as_ref()
            {
                return Err("transfer_changed".into());
            }
            offset = plan.offset;
            response = Some((incoming, plan));
            break;
        }
        let (response, plan) = response.ok_or("transfer_range")?;
        if verify_partial {
            if plan.total.is_some_and(|total| total < saved) { return Err("transfer_changed".into()); }
            offset = saved;
        }
        let storage = self.storage.reserve(
            &record.id,
            dest.parent().ok_or("transfer_destination")?,
            plan.total.unwrap_or(0).saturating_sub(offset),
        )?;
        let mut file = tokio::fs::OpenOptions::new()
            .read(verify_partial)
            .write(true)
            .create(true)
            .truncate(offset == 0 && !verify_partial)
            .open(&part)
            .await
            .map_err(|_| "transfer_write")?;
        if offset > 0 && !verify_partial {
            file.seek(std::io::SeekFrom::Start(offset))
                .await
                .map_err(|_| "transfer_write")?;
        }
        self.update(
            &record.id,
            |r| {
                r.status = if verify_partial { Status::Checking } else { Status::Downloading };
                r.checking_partial = verify_partial.then_some(0);
                r.received = offset;
                r.total = plan.total;
                // Until the prefix is proven, even an older reader that does not
                // understand checking_partial must not resume with this validator.
                r.validator = if verify_partial { None } else { plan.validator.clone() };
                r.error = None;
                r.sha256 = None;
            },
            true,
        )?;
        let mut stream = response.bytes_stream();
        let mut received = offset;
        let mut prefix_left = if verify_partial { saved } else { 0 };
        let mut prefix_buffer = [0u8; transfer_bandwidth::CHUNK_BYTES];
        let mut last = Instant::now();
        let written = super::write_metrics::WriteCounter::default();
        let mut write_rate = super::write_metrics::WriteRate::new(&written);
        let mut flushed = offset;
        let mut network_bytes = 0u64;
        let mut last_network_bytes = 0u64;
        let mut durable = Instant::now();
        let mut space_check = Instant::now();
        let mut space_bytes = received;
        let mut pulse = tokio::time::interval(Duration::from_millis(250));
        pulse.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        pulse.tick().await;
        let mut network_deadline = tokio::time::Instant::now() + Duration::from_secs(45);
        let transfer_result: Result<()> = async {
            loop {
                let chunk = tokio::select! {
                    _ = cancel.cancelled() => return Err("transfer_stopped"),
                    _ = tokio::time::sleep_until(network_deadline) => return Err("transfer_timeout"),
                    _ = pulse.tick() => {
                        file.flush().await.map_err(|_| "transfer_write")?;
                        written.add((received - flushed) as usize); flushed = received;
                        let disk_speed = write_rate.sample(&written);
                        let speed = ((network_bytes - last_network_bytes) as f64 / last.elapsed().as_secs_f64()) as u64;
                        let save = durable.elapsed() >= Duration::from_secs(2);
                        // Idle network periods must emit zero, rather than freezing the last busy sample.
                        self.update(&record.id, |r| { r.received = received; r.checking_partial = (prefix_left > 0).then_some(saved - prefix_left); r.bytes_per_second = speed; r.disk_bytes_per_second = Some(disk_speed); }, save)?;
                        last = Instant::now(); last_network_bytes = network_bytes;
                        if save { durable = Instant::now(); }
                        continue;
                    },
                    value = stream.next() => value,
                };
                let Some(chunk) = chunk else { break; };
                let chunk = chunk.map_err(|_| "transfer_network")?;
                network_bytes = network_bytes.saturating_add(chunk.len() as u64);
                let append_bytes = (chunk.len() as u64).saturating_sub(prefix_left);
                let next_received = received.checked_add(append_bytes).ok_or("transfer_length")?;
                if plan.total.is_some_and(|total| next_received > total) { return Err("transfer_size_mismatch"); }
                for part in chunk.chunks(transfer_bandwidth::CHUNK_BYTES) {
                    self.bandwidth.acquire(&record.profile, part.len(), &cancel).await?;
                    let prefix = prefix_left.min(part.len() as u64) as usize;
                    if prefix > 0 {
                        tokio::select! {
                            _ = cancel.cancelled() => return Err("transfer_stopped"),
                            result = file.read_exact(&mut prefix_buffer[..prefix]) => { result.map_err(|_| "transfer_changed")?; }
                        }
                        if prefix_buffer[..prefix] != part[..prefix] { return Err("transfer_changed"); }
                        prefix_left -= prefix as u64;
                        if prefix_left == 0 {
                            // Persist proof before writing any bytes from the replacement tail.
                            self.update(&record.id, |r| { r.checking_partial = None; r.validator = plan.validator.clone(); r.status = Status::Downloading; }, true)?;
                        }
                    }
                    let part = &part[prefix..];
                    file.write_all(part).await.map_err(|_| "transfer_write")?;
                    received += part.len() as u64;
                    storage.written(part.len() as u64);
                    if received - space_bytes >= 8 * 1024 * 1024 || space_check.elapsed() >= Duration::from_secs(1) {
                        storage.check()?;
                        space_check = Instant::now();
                        space_bytes = received;
                    }
                    if last.elapsed() >= Duration::from_millis(250) {
                        // Tokio writes may still be buffered; count only bytes whose write job finished.
                        file.flush().await.map_err(|_| "transfer_write")?;
                        written.add((received - flushed) as usize);
                        flushed = received;
                        let disk_speed = write_rate.sample(&written);
                        let speed = ((network_bytes - last_network_bytes) as f64 / last.elapsed().as_secs_f64()) as u64;
                        let save = durable.elapsed() >= Duration::from_secs(2);
                        self.update(&record.id, |r| { r.received = received; r.checking_partial = (prefix_left > 0).then_some(saved - prefix_left); r.bytes_per_second = speed; r.disk_bytes_per_second = Some(disk_speed); }, save)?;
                        last = Instant::now();
                        last_network_bytes = network_bytes;
                        if save { durable = Instant::now(); }
                    }
                }
                // Time spent honoring the local bandwidth limit is not a stalled server.
                network_deadline = tokio::time::Instant::now() + Duration::from_secs(45);
            }
            if prefix_left > 0 { return Err("transfer_size_mismatch"); }
            Ok(())
        }.await;
        // Finish pending filesystem writes before a retry measures and resumes the partial file.
        file.flush().await.map_err(|_| "transfer_write")?;
        file.sync_all().await.map_err(|_| "transfer_write")?;
        drop(file);
        transfer_result?;
        storage.check()?;
        if received == 0 || plan.total.is_some_and(|total| received != total) {
            return Err("transfer_size_mismatch".into());
        }
        self.update(
            &record.id,
            |r| {
                r.status = Status::Checking;
                r.received = received;
                r.bytes_per_second = 0;
                r.disk_bytes_per_second = Some(0);
            },
            true,
        )?;
        let hash = hash_async(part.clone(), cancel.clone()).await?;
        if record
            .expected_sha256
            .as_ref()
            .is_some_and(|expected| expected != &hash)
        {
            return Err("transfer_checksum".into());
        }
        self.update(
            &record.id,
            |r| {
                r.sha256 = Some(hash);
            },
            true,
        )?;
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        let item = state
            .records
            .iter_mut()
            .find(|r| r.id == record.id)
            .ok_or("transfer_unknown")?;
        if cancel.is_cancelled() || item.status != Status::Checking {
            return Err("transfer_stopped".into());
        }
        files::publish(&part, &dest)?;
        item.status = Status::Complete;
        item.updated_at = now();
        let changed = item.clone();
        self.persist(&state)?;
        drop(state);
        (self.emit)(changed);
        Ok(())
    }
}
fn remove_partial(path: &Path) -> Result<()> {
    if files::ensure_regular(path)?.is_some() {
        fs::remove_file(path).map_err(|_| "transfer_write")?;
    }
    Ok(())
}
async fn hash_async(path: PathBuf, cancel: CancellationToken) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || files::hash_file(&path, &cancel))
        .await
        .map_err(|_| "transfer_read")?
}
pub fn manager(app: &tauri::AppHandle) -> Result<Arc<Transfers>> {
    super::source_browser::configure(app);
    static INSTANCE: OnceLock<Mutex<Option<Arc<Transfers>>>> = OnceLock::new();
    let mut held = INSTANCE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|_| "transfer_store")?;
    if let Some(value) = held.as_ref() {
        return Ok(Arc::clone(value));
    }
    let root = app
        .path()
        .app_data_dir()
        .map_err(|_| "transfer_store")?
        .join("games");
    let emit_app = app.clone();
    let value = Transfers::load_with_queue(root, move |event| {
        let _ = emit_app.emit("games:transfer", event);
    }, download_queue::manager(app)?)?;
    *held = Some(Arc::clone(&value));
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    include!("transfer_batch_tests.rs");
    include!("transfer_metadata_tests.rs");
    include!("transfer_browser_tests.rs");
    include!("transfer_relink_tests.rs");
    use sha2::{Digest, Sha256};
    use std::io::Read;
    use std::net::{TcpListener, TcpStream};
    use std::sync::atomic::{AtomicBool, Ordering};
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
                .map(PathBuf::from)
                .unwrap_or_else(std::env::temp_dir)
                .join(format!("transfer-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&root).unwrap();
            Self(root)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    struct Server {
        url: String,
        stop: Arc<AtomicBool>,
        requests: Arc<Mutex<Vec<String>>>,
        data: Arc<Vec<u8>>,
    }
    impl Server {
        fn start() -> Self {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            listener.set_nonblocking(true).unwrap();
            let stop = Arc::new(AtomicBool::new(false));
            let requests = Arc::new(Mutex::new(vec![]));
            let data = Arc::new(
                (0..4 * 1024 * 1024)
                    .map(|i| (i % 251) as u8)
                    .collect::<Vec<_>>(),
            );
            let (done, seen, bytes) = (stop.clone(), requests.clone(), data.clone());
            std::thread::spawn(move || {
                while !done.load(Ordering::Relaxed) {
                    match listener.accept() {
                        Ok((mut socket, _)) => {
                            let data = bytes.clone();
                            let seen = seen.clone();
                            std::thread::spawn(move || {
                                socket.set_nonblocking(false).unwrap();
                                socket
                                    .set_read_timeout(Some(Duration::from_secs(2)))
                                    .unwrap();
                                let mut request = vec![];
                                let mut byte = [0; 1];
                                while request.len() < 16384 && !request.ends_with(b"\r\n\r\n") {
                                    if socket.read_exact(&mut byte).is_err() {
                                        return;
                                    }
                                    request.push(byte[0]);
                                }
                                let request = String::from_utf8_lossy(&request).into_owned();
                                let attempt = {
                                    let mut requests = seen.lock().unwrap();
                                    requests.push(request.clone());
                                    requests
                                        .iter()
                                        .filter(|previous| {
                                            previous.lines().next() == request.lines().next()
                                        })
                                        .count()
                                };
                                if request.starts_with("GET /busy ")
                                    || (request.starts_with("GET /busy-once ") && attempt == 1)
                                {
                                    let wait = if request.starts_with("GET /busy ") {
                                        90
                                    } else {
                                        2
                                    };
                                    let _ = socket.write_all(format!("HTTP/1.1 503 Service Unavailable\r\nRetry-After: {wait}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").as_bytes());
                                    return;
                                }
                                if request.starts_with("GET /forbidden ") {
                                    let _ = socket.write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                                    return;
                                }
                                if request.starts_with("GET /html") {
                                    let _=socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 5\r\nConnection: close\r\n\r\nerror");
                                    return;
                                }
                                let requested =
                                    request.to_ascii_lowercase().lines().find_map(|line| {
                                        line.strip_prefix("range: bytes=")
                                            .and_then(|v| v.split('-').next())
                                            .and_then(|v| v.parse::<usize>().ok())
                                    });
                                let offset = if request.starts_with("GET /ignore") {
                                    0
                                } else {
                                    requested.unwrap_or(0)
                                };
                                if offset >= data.len() {
                                    let _=socket.write_all(format!("HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */{}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",data.len()).as_bytes());
                                    return;
                                }
                                let status = if offset > 0 {
                                    "206 Partial Content"
                                } else {
                                    "200 OK"
                                };
                                let range = if offset > 0 {
                                    format!(
                                        "Content-Range: bytes {}-{}/{}\r\n",
                                        offset,
                                        data.len() - 1,
                                        data.len()
                                    )
                                } else {
                                    String::new()
                                };
                                let validator = if request.starts_with("GET /drop-unvalidated ") {
                                    ""
                                } else if request.starts_with("GET /drop-changed ") && attempt > 1 {
                                    "ETag: \"fixture-v2\"\r\n"
                                } else {
                                    "ETag: \"fixture-v1\"\r\n"
                                };
                                let length = if request.starts_with("GET /unknown ") {
                                    String::new()
                                } else {
                                    format!("Content-Length: {}\r\n", data.len() - offset)
                                };
                                if socket.write_all(format!("HTTP/1.1 {status}\r\nContent-Type: application/octet-stream\r\n{length}{validator}{range}Connection: close\r\n\r\n").as_bytes()).is_err(){return;}
                                let end = if request.starts_with("GET /short")
                                    || (request.starts_with("GET /drop") && attempt == 1)
                                {
                                    data.len() / 2
                                } else {
                                    data.len()
                                };
                                for (index, chunk) in data[offset..end].chunks(32768).enumerate() {
                                    if socket.write_all(chunk).is_err() {
                                        return;
                                    }
                                    if index == 0 && request.starts_with("GET /idle ") {
                                        std::thread::sleep(Duration::from_secs(1));
                                    }
                                    if !request.starts_with("GET /fast") {
                                        std::thread::sleep(Duration::from_millis(10));
                                    }
                                }
                            });
                        }
                        Err(_) => std::thread::sleep(Duration::from_millis(5)),
                    }
                }
            });
            Self {
                url: format!("http://{address}"),
                stop,
                requests,
                data,
            }
        }
        fn hash(&self) -> String {
            format!("{:x}", Sha256::digest(&*self.data))
        }
    }
    impl Drop for Server {
        fn drop(&mut self) {
            self.stop.store(true, Ordering::Relaxed);
            let _ = TcpStream::connect(self.url.trim_start_matches("http://"));
        }
    }
    fn args(f: &Fixture, s: &Server, route: &str, name: &str) -> NewTransfer {
        NewTransfer {
            source_link: None,
            browser_ticket: None,
            profile: "one".into(),
            name: name.into(),
            game: None,
            url: format!("{}{route}", s.url),
            destination: f.0.join(name).to_string_lossy().into_owned(),
            expected_bytes: Some(s.data.len() as u64),
            expected_sha256: Some(s.hash()),
        }
    }
    async fn until(
        manager: &Transfers,
        id: &str,
        predicate: impl Fn(&Transfer) -> bool,
    ) -> Transfer {
        let start = Instant::now();
        loop {
            let record = manager
                .list("one")
                .unwrap()
                .into_iter()
                .find(|r| r.id == id)
                .unwrap();
            let terminal = matches!(
                record.status,
                Status::Complete | Status::Failed | Status::Paused | Status::Canceled
            );
            if predicate(&record)
                && (!terminal || !manager.state.lock().unwrap().active.contains_key(id))
            {
                return record;
            }
            assert!(
                start.elapsed() < Duration::from_secs(60),
                "status {:?}, error {:?}",
                record.status,
                record.error
            );
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    }
    #[tokio::test]
    async fn storage_guard_blocks_competing_files_then_releases_space_on_pause() {
        let f = Fixture::new();
        let s = Server::start();
        let mut manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
        Arc::get_mut(&mut manager).unwrap().storage = Storage::with_probe(|_| {
            Some(transfer_storage::Volume {
                id: "disk".into(),
                mount: "fixture".into(),
                available: transfer_storage::HEADROOM + 6 * 1024 * 1024,
            })
        });
        manager.set_bandwidth("one", 64 * 1024).unwrap();
        let first = manager.add(args(&f, &s, "/slow", "first.zip")).unwrap();
        until(&manager, &first.id, |r| r.status == Status::Downloading).await;
        let second = manager.add(args(&f, &s, "/fast", "second.zip")).unwrap();
        let failed = until(&manager, &second.id, |r| r.status == Status::Failed).await;
        assert_eq!(failed.error.as_deref(), Some("transfer_space"));
        assert_eq!(
            files::ensure_regular(
                &files::partial(Path::new(&second.destination), &second.id).unwrap()
            )
            .unwrap(),
            Some(0)
        );
        assert!(!Path::new(&second.destination).exists());
        manager.action("one", &first.id, "pause").unwrap();
        until(&manager, &first.id, |r| r.status == Status::Paused).await;
        manager.set_bandwidth("one", 0).unwrap();
        manager.action("one", &second.id, "resume").unwrap();
        let done = until(&manager, &second.id, |r| {
            matches!(r.status, Status::Complete | Status::Failed)
        })
        .await;
        assert_eq!(done.status, Status::Complete);
        assert_eq!(fs::read(&done.destination).unwrap(), *s.data);
        assert_eq!(manager.storage.other_reserved("disk", &[]), 0);
    }
    #[tokio::test]
    async fn unknown_length_download_stops_when_other_writes_consume_disk_space() {
        use std::sync::atomic::AtomicU64;
        let f = Fixture::new();
        let s = Server::start();
        let free = Arc::new(AtomicU64::new(
            transfer_storage::HEADROOM + 10 * 1024 * 1024,
        ));
        let observed = free.clone();
        let mut manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
        Arc::get_mut(&mut manager).unwrap().storage = Storage::with_probe(move |_| {
            Some(transfer_storage::Volume {
                id: "disk".into(),
                mount: "fixture".into(),
                available: observed.load(Ordering::SeqCst),
            })
        });
        manager.set_bandwidth("one", 512 * 1024).unwrap();
        let mut input = args(&f, &s, "/unknown", "unknown.zip");
        input.expected_bytes = None;
        let item = manager.add(input).unwrap();
        let active = until(&manager, &item.id, |r| r.received > 0).await;
        assert_eq!(active.total, None);
        free.store(transfer_storage::HEADROOM - 1, Ordering::SeqCst);
        let stopped = until(&manager, &item.id, |r| r.status == Status::Failed).await;
        assert_eq!(stopped.error.as_deref(), Some("transfer_space"));
        assert!(!Path::new(&stopped.destination).exists());
        let part = files::partial(Path::new(&stopped.destination), &stopped.id).unwrap();
        assert!(files::ensure_regular(&part).unwrap().unwrap() > 0);
        assert_eq!(s.requests.lock().unwrap().len(), 1);
        assert_eq!(manager.storage.other_reserved("disk", &[]), 0);
        free.store(
            transfer_storage::HEADROOM + 10 * 1024 * 1024,
            Ordering::SeqCst,
        );
        manager.set_bandwidth("one", 0).unwrap();
        manager.action("one", &item.id, "resume").unwrap();
        let done = until(&manager, &item.id, |r| {
            matches!(r.status, Status::Complete | Status::Failed)
        })
        .await;
        assert_eq!(done.status, Status::Complete);
        assert_eq!(fs::read(&done.destination).unwrap(), *s.data);
    }
    #[tokio::test]
    async fn downloads_exact_bytes_and_never_replaces_a_file() {
        let f = Fixture::new();
        let s = Server::start();
        let manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
        let item = manager
            .add(args(&f, &s, "/fast", "日本 & game.zip"))
            .unwrap();
        let complete = until(&manager, &item.id, |r| {
            matches!(r.status, Status::Complete | Status::Failed)
        })
        .await;
        assert_eq!(complete.status, Status::Complete);
        assert_eq!(complete.sha256, Some(s.hash()));
        assert_eq!(fs::read(&item.destination).unwrap(), *s.data);
        assert!(manager.list("two").unwrap().is_empty());
        assert_eq!(
            manager.action("two", &item.id, "remove").err(),
            Some("transfer_unknown")
        );
        assert_eq!(
            manager.add(args(&f, &s, "/fast", "日本 & game.zip")).err(),
            Some("transfer_exists")
        );
        manager.action("one", &item.id, "remove").unwrap();
        assert!(Path::new(&item.destination).is_file());
    }

    #[tokio::test]
    async fn dropped_connections_resume_current_validators_and_restart_unvalidated_files() {
        let fixture = Fixture::new();
        let server = Server::start();
        let manager = Transfers::load(fixture.0.join("state"), |_| {}).unwrap();
        for (route, file, range) in [
            ("/drop", "resume.zip", true),
            ("/drop-unvalidated", "restart.zip", false),
        ] {
            let record = manager.add(args(&fixture, &server, route, file)).unwrap();
            let waiting = until(&manager, &record.id, |r| r.status == Status::Retrying).await;
            assert_eq!(waiting.received, (server.data.len() / 2) as u64);
            assert_eq!(waiting.bytes_per_second, 0);
            assert!(waiting.error.is_none());
            let done = until(&manager, &record.id, |r| {
                matches!(r.status, Status::Complete | Status::Failed)
            })
            .await;
            assert_eq!(done.status, Status::Complete);
            assert_eq!(fs::read(&done.destination).unwrap(), *server.data);
            assert_eq!(done.sha256.as_deref(), Some(server.hash().as_str()));
            let requests = server.requests.lock().unwrap();
            let attempts = requests
                .iter()
                .filter(|request| request.starts_with(&format!("GET {route} ")))
                .collect::<Vec<_>>();
            assert_eq!(attempts.len(), 2);
            assert_eq!(
                attempts[1]
                    .to_ascii_lowercase()
                    .contains("range: bytes=2097152-"),
                range
            );
            assert_eq!(
                attempts[1]
                    .to_ascii_lowercase()
                    .contains("if-range: \"fixture-v1\""),
                range
            );
        }
    }

    #[tokio::test]
    async fn temporary_http_failure_recovers_but_access_and_changed_content_do_not_retry() {
        let fixture = Fixture::new();
        let server = Server::start();
        let manager = Transfers::load(fixture.0.join("state"), |_| {}).unwrap();
        let start = Instant::now();
        let record = manager
            .add(args(&fixture, &server, "/busy-once", "recover.zip"))
            .unwrap();
        until(&manager, &record.id, |r| r.status == Status::Retrying).await;
        let done = until(&manager, &record.id, |r| {
            matches!(r.status, Status::Complete | Status::Failed)
        })
        .await;
        assert_eq!(done.status, Status::Complete);
        assert!(start.elapsed() >= Duration::from_secs(2));
        assert_eq!(fs::read(&done.destination).unwrap(), *server.data);
        for (route, file, error, count) in [
            ("/forbidden", "denied.zip", "transfer_access", 1),
            ("/drop-changed", "changed.zip", "transfer_changed", 2),
        ] {
            let record = manager.add(args(&fixture, &server, route, file)).unwrap();
            let failed = until(&manager, &record.id, |r| r.status == Status::Failed).await;
            assert_eq!(failed.error.as_deref(), Some(error));
            assert!(!Path::new(&failed.destination).exists());
            assert_eq!(
                server
                    .requests
                    .lock()
                    .unwrap()
                    .iter()
                    .filter(|request| request.starts_with(&format!("GET {route} ")))
                    .count(),
                count
            );
        }
    }

    #[tokio::test]
    async fn pause_cancel_and_restart_do_not_resume_a_waiting_retry() {
        let fixture = Fixture::new();
        let server = Server::start();
        let manager = Transfers::load(fixture.0.join("state"), |_| {}).unwrap();
        for (action, status) in [("pause", Status::Paused), ("cancel", Status::Canceled)] {
            let record = manager
                .add(args(&fixture, &server, "/busy", &format!("{action}.zip")))
                .unwrap();
            until(&manager, &record.id, |r| r.status == Status::Retrying).await;
            let start = Instant::now();
            manager.action("one", &record.id, action).unwrap();
            until(&manager, &record.id, |r| r.status == status).await;
            assert!(
                start.elapsed() < Duration::from_secs(2),
                "controls must interrupt the90second Retry-After wait"
            );
        }
        let path = fixture.0.join("state/transfers.json");
        let mut store: Store = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        store.records[0].status = Status::Retrying;
        fs::write(&path, serde_json::to_vec(&store).unwrap()).unwrap();
        let restarted = Transfers::load(fixture.0.join("state"), |_| {}).unwrap();
        assert_eq!(restarted.list("one").unwrap()[0].status, Status::Paused);
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert_eq!(server.requests.lock().unwrap().len(), 2);
    }
    #[tokio::test]
    async fn pauses_persists_and_resumes_only_with_a_validated_range() {
        let f = Fixture::new();
        let s = Server::start();
        let root = f.0.join("state");
        let manager = Transfers::load(root.clone(), |_| {}).unwrap();
        let item = manager.add(args(&f, &s, "/slow", "game.zip")).unwrap();
        until(&manager, &item.id, |r| r.received > 0).await;
        manager.action("one", &item.id, "pause").unwrap();
        until(&manager, &item.id, |r| r.status == Status::Paused).await;
        let partial = files::partial(Path::new(&item.destination), &item.id).unwrap();
        let size = fs::metadata(&partial).unwrap().len();
        assert!(size > 0 && size < s.data.len() as u64);
        assert!(!Path::new(&item.destination).exists());
        let resumed = Transfers::load(root, |_| {}).unwrap();
        assert_eq!(resumed.list("one").unwrap()[0].status, Status::Paused);
        resumed.action("one", &item.id, "resume").unwrap();
        assert_eq!(
            until(&resumed, &item.id, |r| matches!(
                r.status,
                Status::Complete | Status::Failed
            ))
            .await
            .status,
            Status::Complete
        );
        assert_eq!(fs::read(&item.destination).unwrap(), *s.data);
        assert!(s.requests.lock().unwrap().iter().any(|r| r
            .to_ascii_lowercase()
            .contains(&format!("range: bytes={size}-"))
            && r.contains("\"fixture-v1\"")));
    }
    #[tokio::test]
    async fn ignored_ranges_restart_without_appending_duplicate_bytes() {
        let f = Fixture::new();
        let s = Server::start();
        let manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
        let item = manager.add(args(&f, &s, "/ignore", "game.zip")).unwrap();
        until(&manager, &item.id, |r| r.received > 0).await;
        manager.action("one", &item.id, "pause").unwrap();
        until(&manager, &item.id, |r| r.status == Status::Paused).await;
        manager.action("one", &item.id, "resume").unwrap();
        assert_eq!(
            until(&manager, &item.id, |r| matches!(
                r.status,
                Status::Complete | Status::Failed
            ))
            .await
            .status,
            Status::Complete
        );
        assert_eq!(fs::read(&item.destination).unwrap(), *s.data);
    }
    #[tokio::test]
    async fn checksum_html_and_incomplete_downloads_never_look_complete() {
        let f = Fixture::new();
        let s = Server::start();
        let manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
        for (route, name, error) in [
            ("/fast", "hash.zip", "transfer_checksum"),
            ("/html", "html.zip", "transfer_not_file"),
            ("/short", "short.zip", "transfer_network"),
        ] {
            let mut input = args(&f, &s, route, name);
            if route == "/fast" {
                input.expected_sha256 = Some("0".repeat(64));
            }
            let item = manager.add(input).unwrap();
            let record = until(&manager, &item.id, |r| {
                matches!(r.status, Status::Failed | Status::Complete)
            })
            .await;
            assert_eq!(record.status, Status::Failed);
            assert_eq!(record.error.as_deref(), Some(error));
            assert!(!Path::new(&item.destination).exists());
            assert_eq!(
                s.requests
                    .lock()
                    .unwrap()
                    .iter()
                    .filter(|request| request.starts_with(&format!("GET {route} ")))
                    .count(),
                if route == "/short" { 4 } else { 1 },
                "transient failures exhaust exactly three retries; integrity errors never retry"
            );
        }
    }
    #[tokio::test]
    async fn cancel_removes_only_its_partial_and_queue_advances() {
        let f = Fixture::new();
        let s = Server::start();
        let manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
        let one = manager.add(args(&f, &s, "/slow", "one.zip")).unwrap();
        let two = manager.add(args(&f, &s, "/slow", "two.zip")).unwrap();
        let three = manager.add(args(&f, &s, "/fast", "three.zip")).unwrap();
        assert_eq!(
            manager
                .list("one")
                .unwrap()
                .iter()
                .find(|r| r.id == three.id)
                .unwrap()
                .status,
            Status::Queued
        );
        until(&manager, &one.id, |r| r.received > 0).await;
        manager.action("one", &one.id, "cancel").unwrap();
        until(&manager, &one.id, |r| r.status == Status::Canceled).await;
        assert!(!files::partial(Path::new(&one.destination), &one.id)
            .unwrap()
            .exists());
        assert!(!Path::new(&one.destination).exists());
        assert_eq!(
            until(&manager, &three.id, |r| matches!(
                r.status,
                Status::Complete | Status::Failed
            ))
            .await
            .status,
            Status::Complete
        );
        until(&manager, &two.id, |r| r.status == Status::Complete).await;
    }
    #[tokio::test]
    async fn unsatisfied_range_restarts_and_completed_publication_recovers() {
        let f = Fixture::new();
        let s = Server::start();
        let root = f.0.join("state");
        let manager = Transfers::load(root.clone(), |_| {}).unwrap();
        let item = manager.add(args(&f, &s, "/slow", "resume.zip")).unwrap();
        until(&manager, &item.id, |r| r.received > 0).await;
        manager.action("one", &item.id, "pause").unwrap();
        until(&manager, &item.id, |r| r.status == Status::Paused).await;
        // A complete-length partial still needs verification; a 416 is never accepted as success.
        fs::write(
            files::partial(Path::new(&item.destination), &item.id).unwrap(),
            &*s.data,
        )
        .unwrap();
        manager.action("one", &item.id, "resume").unwrap();
        assert_eq!(
            until(&manager, &item.id, |r| matches!(
                r.status,
                Status::Complete | Status::Failed
            ))
            .await
            .status,
            Status::Complete
        );
        assert_eq!(fs::read(&item.destination).unwrap(), *s.data);
        let requests = s.requests.lock().unwrap().len();
        let mut stored: Store =
            serde_json::from_slice(&fs::read(root.join("transfers.json")).unwrap()).unwrap();
        stored.records[0].status = Status::Checking;
        fs::write(
            root.join("transfers.json"),
            serde_json::to_vec(&stored).unwrap(),
        )
        .unwrap();
        let recovered = Transfers::load(root, |_| {}).unwrap();
        assert_eq!(recovered.list("one").unwrap()[0].status, Status::Paused);
        recovered.action("one", &item.id, "resume").unwrap();
        assert_eq!(
            until(&recovered, &item.id, |r| matches!(
                r.status,
                Status::Complete | Status::Failed
            ))
            .await
            .status,
            Status::Complete
        );
        assert_eq!(s.requests.lock().unwrap().len(), requests);
    }
    #[tokio::test]
    async fn a_destination_created_while_paused_is_preserved() {
        let f = Fixture::new();
        let s = Server::start();
        let manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
        let item = manager.add(args(&f, &s, "/slow", "game.zip")).unwrap();
        until(&manager, &item.id, |r| r.received > 0).await;
        manager.action("one", &item.id, "pause").unwrap();
        until(&manager, &item.id, |r| r.status == Status::Paused).await;
        fs::write(&item.destination, b"user file").unwrap();
        manager.action("one", &item.id, "resume").unwrap();
        let failed = until(&manager, &item.id, |r| r.status == Status::Failed).await;
        assert_eq!(failed.error.as_deref(), Some("transfer_exists"));
        assert_eq!(fs::read(&item.destination).unwrap(), b"user file");
        manager.action("one", &item.id, "remove").unwrap();
        assert_eq!(fs::read(&item.destination).unwrap(), b"user file");
        assert!(files::free_bytes(&f.0).unwrap() > 0);
    }
    fn queued_fixture(f: &Fixture, s: &Server, name: &str, profile: &str, order: u64) -> Transfer {
        Transfer {
            batch_id: None,
            checking_partial: None,
            preparation: None,
            source_link: None,
            source_page: None,
            id: uuid::Uuid::new_v4().to_string(),
            profile: profile.into(),
            name: name.into(),
            game: None,
            url: format!("{}/slow", s.url),
            destination: f.0.join(name).to_string_lossy().into_owned(),
            status: Status::Paused,
            received: 0,
            total: Some(s.data.len() as u64),
            expected_bytes: Some(s.data.len() as u64),
            expected_sha256: Some(s.hash()),
            sha256: None,
            validator: None,
            created_at: now(),
            updated_at: now(),
            error: None,
            bytes_per_second: 0,
            disk_bytes_per_second: Some(0),
            queue_order: order,
        }
    }
    #[test]
    fn queue_order_persists_migrates_and_keeps_profiles_and_running_jobs_separate() {
        let f = Fixture::new();
        let s = Server::start();
        let root = f.0.join("state");
        let manager = Transfers::load(root.clone(), |_| {}).unwrap();
        let a = queued_fixture(&f, &s, "a", "one", 1);
        let b = queued_fixture(&f, &s, "b", "two", 2);
        let c = queued_fixture(&f, &s, "c", "one", 3);
        let mut d = queued_fixture(&f, &s, "d", "one", 4);
        d.status = Status::Downloading;
        {
            let mut state = manager.state.lock().unwrap();
            state.records = vec![a.clone(), b.clone(), c.clone(), d.clone()];
            manager.persist(&state).unwrap();
        }
        assert_eq!(
            manager.action("two", &c.id, "earlier"),
            Err("transfer_unknown")
        );
        assert_eq!(
            manager.action("one", &d.id, "earlier"),
            Err("transfer_state")
        );
        manager.action("one", &c.id, "earlier").unwrap();
        assert_eq!(
            manager
                .list("one")
                .unwrap()
                .iter()
                .map(|r| r.name.as_str())
                .collect::<Vec<_>>(),
            vec!["c", "a", "d"]
        );
        assert_eq!(manager.list("two").unwrap()[0].queue_order, 2);
        let loaded = Transfers::load(root.clone(), |_| {}).unwrap();
        assert_eq!(loaded.list("one").unwrap()[0].id, c.id);
        assert!(loaded
            .list("one")
            .unwrap()
            .iter()
            .all(|r| r.status == Status::Paused));
        assert!(loaded.state.lock().unwrap().active.is_empty());
        // Older persisted records have no queueOrder property; their actual scheduler order survives.
        let mut legacy: serde_json::Value =
            serde_json::from_slice(&fs::read(root.join("transfers.json")).unwrap()).unwrap();
        for record in legacy["records"].as_array_mut().unwrap() {
            record.as_object_mut().unwrap().remove("queueOrder");
        }
        fs::write(
            root.join("transfers.json"),
            serde_json::to_vec(&legacy).unwrap(),
        )
        .unwrap();
        let migrated = Transfers::load(root, |_| {}).unwrap();
        assert_eq!(
            migrated
                .list("one")
                .unwrap()
                .iter()
                .map(|r| (r.name.clone(), r.queue_order))
                .collect::<Vec<_>>(),
            vec![("c".into(), 1), ("a".into(), 3), ("d".into(), 4)]
        );
    }
    #[test]
    fn storage_forecast_uses_actual_partials_and_never_exposes_other_profile_files() {
        let f = Fixture::new();
        let s = Server::start();
        let mut manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
        Arc::get_mut(&mut manager).unwrap().storage = Storage::with_probe(|path| {
            if path.ends_with("unavailable") {
                None
            } else {
                Some(transfer_storage::Volume {
                    id: "same-disk".into(),
                    mount: "W:\\".into(),
                    available: transfer_storage::HEADROOM + 100,
                })
            }
        });
        let mut a = queued_fixture(&f, &s, "a", "one", 1);
        a.total = Some(100);
        a.received = 90;
        fs::write(
            files::partial(Path::new(&a.destination), &a.id).unwrap(),
            [0u8; 40],
        )
        .unwrap();
        let mut b = queued_fixture(&f, &s, "b", "one", 2);
        b.total = None;
        b.expected_bytes = None;
        let mut finished = queued_fixture(&f, &s, "done", "one", 3);
        finished.status = Status::Complete;
        let mut hidden = queued_fixture(&f, &s, "private-name", "two", 4);
        hidden.total = Some(900);
        let mut offline = queued_fixture(&f, &s, "offline", "one", 5);
        offline.destination =
            f.0.join("unavailable/file.zip")
                .to_string_lossy()
                .into_owned();
        manager.state.lock().unwrap().records = vec![a, b, finished, hidden.clone(), offline];
        let claim = manager.storage.reserve(&hidden.id, &f.0, 80).unwrap();
        let values = manager.storage_forecast("one").unwrap();
        let drive = values.iter().find(|r| r.volume == "W:\\").unwrap();
        assert_eq!(
            (
                drive.file_count,
                drive.unknown_files,
                drive.remaining_bytes,
                drive.other_reserved_bytes
            ),
            (2, 1, 60, 80)
        );
        assert_eq!(drive.shortfall_bytes, Some(40));
        let offline = values
            .iter()
            .find(|r| r.volume.contains("unavailable"))
            .unwrap();
        assert_eq!(offline.available_bytes, None);
        assert_eq!(offline.shortfall_bytes, None);
        let serialized = serde_json::to_string(&values).unwrap();
        assert!(!serialized.contains("private-name") && !serialized.contains(&hidden.id));
        drop(claim);
        assert_eq!(
            manager
                .storage_forecast("one")
                .unwrap()
                .iter()
                .find(|r| r.volume == "W:\\")
                .unwrap()
                .shortfall_bytes,
            Some(0)
        );
        assert!(manager.storage_forecast("").is_err());
        assert!(manager.storage_forecast("no-files").unwrap().is_empty());
        let real = transfer_storage::volume(&f.0).unwrap();
        let nested = f.0.join("nested");
        fs::create_dir(&nested).unwrap();
        assert_eq!(real.id, transfer_storage::volume(&nested).unwrap().id);
        assert!(real.available > 0 && !real.mount.is_empty());
    }
    #[test]
    fn failed_queue_save_rolls_back_without_emitting_or_starting() {
        let f = Fixture::new();
        let s = Server::start();
        let root = f.0.join("state");
        let emitted = Arc::new(Mutex::new(Vec::new()));
        let received = emitted.clone();
        let manager =
            Transfers::load(root.clone(), move |r| received.lock().unwrap().push(r)).unwrap();
        let a = queued_fixture(&f, &s, "a", "one", 1);
        let b = queued_fixture(&f, &s, "b", "one", 2);
        {
            let mut state = manager.state.lock().unwrap();
            state.records = vec![a.clone(), b.clone()];
            manager.persist(&state).unwrap();
        }
        fs::rename(root.join("queue/order.json"), root.join("saved.json")).unwrap();
        fs::create_dir(root.join("queue/order.json")).unwrap();
        assert_eq!(
            manager.action("one", &b.id, "earlier"),
            Err("transfer_store")
        );
        assert_eq!(manager.list("one").unwrap()[0].id, a.id);
        assert!(emitted.lock().unwrap().is_empty());
        assert!(manager.state.lock().unwrap().active.is_empty());
        fs::remove_dir(root.join("queue/order.json")).unwrap();
        fs::rename(root.join("saved.json"), root.join("queue/order.json")).unwrap();
    }
    #[tokio::test]
    async fn reordered_queue_drives_real_scheduler_and_verified_files() {
        let f = Fixture::new();
        let s = Server::start();
        let emitted = Arc::new(Mutex::new(Vec::new()));
        let received = emitted.clone();
        let manager =
            Transfers::load(f.0.join("state"), move |r| received.lock().unwrap().push(r)).unwrap();
        let mut records = (1..=4)
            .map(|n| queued_fixture(&f, &s, &format!("{n}.zip"), "one", n))
            .collect::<Vec<_>>();
        for record in &mut records {
            record.status = Status::Queued;
        }
        {
            let mut state = manager.state.lock().unwrap();
            state.records = records.clone();
            manager.persist(&state).unwrap();
        }
        for _ in 0..3 {
            manager.action("one", &records[3].id, "earlier").unwrap();
        }
        assert!(manager.state.lock().unwrap().active.is_empty());
        manager.kick();
        tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                if emitted.lock().unwrap().iter().filter(|r| r.status == Status::Connecting).count() >= 2 { break; }
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        }).await.unwrap();
        let started = emitted
            .lock()
            .unwrap()
            .iter()
            .filter(|r| r.status == Status::Connecting)
            .map(|r| r.id.clone())
            .collect::<Vec<_>>();
        assert_eq!(started, vec![records[3].id.clone(), records[0].id.clone()]);
        assert_eq!(
            manager.action("one", &records[3].id, "later"),
            Err("transfer_state")
        );
        for record in records {
            let done = until(&manager, &record.id, |r| {
                matches!(r.status, Status::Complete | Status::Failed)
            })
            .await;
            assert_eq!(done.status, Status::Complete);
            assert_eq!(done.sha256, Some(s.hash()));
            assert_eq!(fs::read(&done.destination).unwrap(), *s.data);
        }
    }
    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn direct_and_torrent_managers_share_slots_and_durable_priority() {
        use super::super::p2p::{Torrents, StartTorrent, Status as TorrentStatus};
        let f=Fixture::new(); let server=Server::start();
        let queue_root=f.0.join("shared-queue");
        let queue=Queue::load(queue_root.clone(),Vec::new(),|_|{}).unwrap();
        let manager=Transfers::load_with_queue(f.0.join("direct"),|_|{},queue.clone()).unwrap();
        let torrents=Torrents::new_with_queue(f.0.join("torrent-state"),Arc::new(|_|{}),queue.clone(),manager.bandwidth()).unwrap();
        manager.set_bandwidth("one",64*1024).unwrap();
        let first=manager.add(args(&f,&server,"/slow","first.zip")).unwrap();
        let second=manager.add(args(&f,&server,"/slow","second.zip")).unwrap();
        until(&manager,&first.id,|r|r.status==Status::Downloading).await;
        until(&manager,&second.id,|r|r.status==Status::Downloading).await;
        let metadata=f.0.join("fixture.torrent");
        let mut bytes=b"d4:infod6:lengthi32768e4:name11:content.bin12:piece lengthi32768e6:pieces20:".to_vec();
        bytes.extend([0u8;20]); bytes.extend(b"ee"); fs::write(&metadata,bytes).unwrap();
        let plan=torrents.inspect("one".into(),metadata.to_string_lossy().into_owned(),uuid::Uuid::new_v4().to_string()).await.unwrap();
        let torrent=torrents.start(StartTorrent { profile:"one".into(),token:plan.token,parent:f.0.to_string_lossy().into_owned(),name:"torrent-output".into(),game:None,selected:vec![0],download_bps:0,upload_bps:32768 }).await.unwrap();
        let third=manager.add(args(&f,&server,"/fast","third.zip")).unwrap();
        let mut forecast_items=manager.storage_items("one").unwrap();
        forecast_items.extend(torrents.storage_items("one").unwrap());
        let forecast=manager.storage.forecast(&forecast_items);
        assert_eq!(forecast.iter().map(|drive|drive.file_count).sum::<usize>(),4);
        assert!(forecast.iter().all(|drive|drive.other_reserved_bytes==0));
        assert!(forecast.iter().map(|drive|drive.remaining_bytes).sum::<u64>()>=transfer_storage::HEADROOM);
        assert_eq!(torrents.list("one").unwrap()[0].status,TorrentStatus::Queued);
        assert!(!Path::new(&torrent.destination).join("content.bin").exists());
        manager.action("one",&third.id,"earlier").unwrap();
        assert!(queue.order(QueueKind::Direct,&third.id)<queue.order(QueueKind::Torrent,&torrent.id));
        manager.action("one",&first.id,"pause").unwrap();
        until(&manager,&first.id,|r|r.status==Status::Paused).await;
        until(&manager,&third.id,|r|r.status==Status::Downloading).await;
        assert_eq!(torrents.list("one").unwrap()[0].status,TorrentStatus::Queued);
        assert!(!Path::new(&torrent.destination).join("content.bin").exists());
        manager.action("one",&third.id,"pause").unwrap();
        until(&manager,&third.id,|r|r.status==Status::Paused).await;
        tokio::time::timeout(Duration::from_secs(8),async {
            loop { let row=&torrents.list("one").unwrap()[0]; assert_ne!(row.status,TorrentStatus::Failed,"{:?}",row.error); if row.status==TorrentStatus::Downloading {break;} tokio::time::sleep(Duration::from_millis(20)).await; }
        }).await.unwrap();
        torrents.action("one".into(),torrent.id.clone(),"pause".into()).await.unwrap();
        manager.set_bandwidth("one",0).unwrap();
        manager.action("one",&third.id,"resume").unwrap();
        for id in [&second.id,&third.id] { let done=until(&manager,id,|r|matches!(r.status,Status::Complete|Status::Failed)).await; assert_eq!(done.status,Status::Complete); assert_eq!(fs::read(&done.destination).unwrap(),*server.data); }
        let reloaded=Queue::load(queue_root,Vec::new(),|_|{}).unwrap();
        let resumed_direct=Transfers::load_with_queue(f.0.join("direct"),|_|{},reloaded.clone()).unwrap();
        let resumed_torrent=Torrents::new_with_queue(f.0.join("torrent-state"),Arc::new(|_|{}),reloaded.clone(),resumed_direct.bandwidth()).unwrap();
        assert!(reloaded.order(QueueKind::Direct,&third.id)<reloaded.order(QueueKind::Torrent,&torrent.id));
        assert_eq!(resumed_torrent.list("one").unwrap()[0].status,TorrentStatus::Paused);
        assert!(resumed_direct.state.lock().unwrap().active.is_empty());
    }
    #[test]
    fn bandwidth_settings_persist_are_profile_scoped_and_roll_back_on_save_failure() {
        let fixture = Fixture::new();
        let root = fixture.0.join("state");
        let manager = Transfers::load(root.clone(), |_| {}).unwrap();
        assert_eq!(manager.settings("one").unwrap().bytes_per_second_limit, 0);
        assert!(manager.set_bandwidth("", 0).is_err());
        assert!(manager.set_bandwidth("one", 1).is_err());
        manager.set_bandwidth("one", 512 * 1024).unwrap();
        assert_eq!(manager.settings("two").unwrap().bytes_per_second_limit, 0);
        let loaded = Transfers::load(root.clone(), |_| {}).unwrap();
        assert_eq!(
            loaded.settings("one").unwrap().bytes_per_second_limit,
            512 * 1024
        );
        fs::rename(root.join("transfers.json"), root.join("saved.json")).unwrap();
        fs::create_dir(root.join("transfers.json")).unwrap();
        assert!(manager.set_bandwidth("one", 0).is_err());
        assert_eq!(
            manager.settings("one").unwrap().bytes_per_second_limit,
            512 * 1024
        );
        fs::remove_dir(root.join("transfers.json")).unwrap();
        fs::rename(root.join("saved.json"), root.join("transfers.json")).unwrap();
        manager.set_bandwidth("one", 0).unwrap();
        assert_eq!(
            Transfers::load(root, |_| {})
                .unwrap()
                .settings("one")
                .unwrap()
                .bytes_per_second_limit,
            0
        );
    }
    #[tokio::test]
    async fn concurrent_files_share_one_limit_and_keep_exact_verified_bytes() {
        let fixture = Fixture::new();
        let server = Server::start();
        let manager = Transfers::load(fixture.0.join("state"), |_| {}).unwrap();
        // Two 4MiB files together must take at least two seconds at 4MiB/s.
        manager.set_bandwidth("one", 4 * 1024 * 1024).unwrap();
        let start = Instant::now();
        let first = manager
            .add(args(&fixture, &server, "/file", "one.zip"))
            .unwrap();
        let second = manager
            .add(args(&fixture, &server, "/file", "two.zip"))
            .unwrap();
        for record in [first, second] {
            let done = until(&manager, &record.id, |r| {
                matches!(r.status, Status::Complete | Status::Failed)
            })
            .await;
            assert_eq!(done.status, Status::Complete);
            assert_eq!(done.sha256, Some(server.hash()));
            assert_eq!(fs::read(&done.destination).unwrap(), *server.data);
        }
        assert!(start.elapsed() >= Duration::from_secs(2));
    }
    #[tokio::test]
    async fn active_file_limit_can_change_and_pause_without_waiting_for_full_chunk() {
        let fixture = Fixture::new();
        let server = Server::start();
        let manager = Transfers::load(fixture.0.join("state"), |_| {}).unwrap();
        manager
            .set_bandwidth("one", transfer_bandwidth::MIN_RATE)
            .unwrap();
        let record = manager
            .add(args(&fixture, &server, "/file", "game.zip"))
            .unwrap();
        until(&manager, &record.id, |r| r.status == Status::Downloading).await;
        manager.action("one", &record.id, "pause").unwrap();
        tokio::time::timeout(
            Duration::from_millis(500),
            until(&manager, &record.id, |r| r.status == Status::Paused),
        )
        .await
        .unwrap();
        manager.action("one", &record.id, "resume").unwrap();
        until(&manager, &record.id, |r| r.status == Status::Downloading).await;
        manager.set_bandwidth("one", 0).unwrap();
        let done = until(&manager, &record.id, |r| {
            matches!(r.status, Status::Complete | Status::Failed)
        })
        .await;
        assert_eq!(done.status, Status::Complete);
        assert_eq!(fs::read(&done.destination).unwrap(), *server.data);
    }
}
