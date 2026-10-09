use super::*;
#[path = "p2p_seed_storage.rs"]
mod storage;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedPolicy { pub ratio_milli: u32, pub seconds: u32, pub upload_bps: u32 }
impl SeedPolicy {
    pub fn validate(&self) -> Result<()> {
        if !(1000..=10_000).contains(&self.ratio_milli) || !(1..=86_400).contains(&self.seconds) || !(32*1024..=1024*1024*1024).contains(&self.upload_bps) {
            return Err("torrent_seed_limits");
        }
        Ok(())
    }
    fn reached(&self, total: u64, uploaded: u64, seconds: u64) -> bool {
        seconds >= self.seconds as u64 || uploaded as u128 * 1000 >= total as u128 * self.ratio_milli as u128
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SeedStatus { Checking, Seeding, Stopped, LimitReached, Failed }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedState {
    pub policy: SeedPolicy, pub status: SeedStatus, pub uploaded_bytes: u64, pub elapsed_seconds: u64,
    pub error: Option<String>,
}
impl SeedState { pub fn active(&self) -> bool { matches!(self.status, SeedStatus::Checking | SeedStatus::Seeding) } }
struct NoDownloads;
impl librqbit::limits::DownloadLimiter for NoDownloads {
    fn acquire(&self, _: NonZeroU32) -> std::pin::Pin<Box<dyn std::future::Future<Output=anyhow::Result<()>> + Send + '_>> {
        Box::pin(async { anyhow::bail!("torrent_seed_files") })
    }
}
impl Torrents {
    pub async fn seed(self: &Arc<Self>, profile: String, id: String, policy: SeedPolicy) -> Result<()> {
        let _serial = self.actions.lock().await;
        policy.validate()?;
        let record = self.list(&profile)?.into_iter().find(|r| r.id == id).ok_or("torrent_missing")?;
        self.start_seeding(record, Some(policy)).await
    }
    pub(super) async fn start_seeding(self: &Arc<Self>, record: TorrentRecord, policy: Option<SeedPolicy>) -> Result<()> {
        let source_use=super::super::game_file_use::using(&[PathBuf::from(&record.destination)],true).map_err(|_|"torrent_busy")?;
        if record.status != Status::Complete { return Err("torrent_seed_files"); }
        if self.jobs.lock().map_err(|_| "torrent_store")?.get(&record.id).is_some_and(|job| !job.task.is_finished()) {
            return Err("torrent_busy");
        }
        let slot = self.seed_slots.clone().try_acquire_owned().map_err(|_| "torrent_busy")?;
        let state = if let Some(policy) = policy {
            policy.validate()?;
            SeedState { policy, status: SeedStatus::Checking, uploaded_bytes: 0, elapsed_seconds: 0, error: None }
        } else {
            let mut state = record.sharing.clone().ok_or("torrent_request")?;
            if state.policy.reached(record.total_bytes, state.uploaded_bytes, state.elapsed_seconds) { return Err("torrent_seed_limits"); }
            state.status = SeedStatus::Checking; state.error = None; state
        };
        // Persist explicit intent before spawning any network work. Preserve the
        // last saved record on failure, including its completed-download state.
        {
            let mut held = self.records.lock().map_err(|_| "torrent_store")?;
            let mut next = held.clone();
            let target = next.iter_mut().find(|r| r.id == record.id).ok_or("torrent_missing")?;
            target.sharing = Some(state.clone()); target.completed_at.get_or_insert(target.updated_at);
            target.updated_at = now(); self.persist(&next)?; *held = next;
        }
        let token = CancellationToken::new(); let cancel = token.clone();
        let manager = self.clone(); let id = record.id.clone();
        let event = self.list(&record.profile)?.into_iter().find(|r| r.id == id).ok_or("torrent_missing")?;
        self.emit_record(event);
        let task = tokio::spawn(async move {
            let _source_use=source_use;
            let result = manager.run_seed(&record, &state, &cancel).await;
            let _ = manager.update_seed(&record.id, true, |r| {
                if let Some(seed) = &mut r.sharing {
                    seed.status = match &result { Ok(true) => SeedStatus::LimitReached, Ok(false) => SeedStatus::Stopped, Err(_) if cancel.is_cancelled() => SeedStatus::Stopped, Err(_) => SeedStatus::Failed };
                    seed.error = result.err().filter(|_| !cancel.is_cancelled()).map(str::to_owned);
                }
                r.upload_per_second = 0; r.peers = 0; r.seeders = Some(0);
            });
            #[cfg(test)] if let Ok(mut ports) = manager.seed_ports.lock() { ports.remove(&record.id); }
            drop(slot);
        });
        self.jobs.lock().map_err(|_| "torrent_store")?.insert(id, Job { cancel: token, task });
        Ok(())
    }
    fn update_seed(&self, id: &str, persist: bool, update: impl FnOnce(&mut TorrentRecord)) -> Result<()> {
        let mut records = self.records.lock().map_err(|_| "torrent_store")?;
        let mut next = records.clone();
        {
            let record = next.iter_mut().find(|r| r.id == id).ok_or("torrent_missing")?;
            update(record); record.updated_at = now();
        }
        let result = if persist { self.persist(&next) } else { Ok(()) };
        let record = next.iter_mut().find(|r| r.id == id).ok_or("torrent_missing")?;
        if result.is_err() {
            if let Some(seed) = &mut record.sharing { seed.status = SeedStatus::Failed; seed.error = Some("torrent_store".into()); }
            record.upload_per_second = 0; record.peers = 0;
        }
        let event = record.clone(); *records = next; drop(records); self.emit_record(event); result
    }
    async fn run_seed(&self, record: &TorrentRecord, seed: &SeedState, cancel: &CancellationToken) -> Result<bool> {
        let bytes = files::read(&self.root.join(format!("{}.torrent", record.id)), files::MAX_METADATA)?;
        if files::digest(&bytes) != record.metadata_sha { return Err("torrent_metadata"); }
        let (metadata, items, _) = files::metadata(&bytes)?;
        if metadata.info_hash.as_string() != record.info_hash || files::selected(&items, &record.selected)? != record.total_bytes { return Err("torrent_metadata"); }
        let held = storage::ReadOnlyFactory::open(record, &items, metadata.info.piece_length)?;
        let mut options = self.session_options(cancel.child_token(), limits(0, seed.policy.upload_bps)?);
        options.disable_dht |= metadata.info.private;
        options.listen_port_range = Some(49152..49252);
        options.download_limiter = Some(Arc::new(NoDownloads));
        options.default_storage_factory = Some(held.boxed());
        let session = Session::new_with_opts(PathBuf::from(&record.destination), options).await.map_err(|_| "torrent_network")?;
        let result = async {
            let handle = session.add_torrent(AddTorrent::from_bytes(bytes), Some(AddTorrentOptions {
                paused: true, output_folder: Some(record.destination.clone()), overwrite: true,
                only_files: Some(record.selected.clone()), disable_trackers: cfg!(test), ..Default::default()
            })).await.map_err(|_| "torrent_seed_files")?.into_handle().ok_or("torrent_seed_files")?;
            tokio::select! { _ = cancel.cancelled() => return Ok(false), result = handle.wait_until_initialized() => result.map_err(|_| "torrent_seed_files")? }
            if !handle.stats().finished { return Err("torrent_seed_files"); }
            session.unpause(&handle).await.map_err(|_| "torrent_network")?;
            #[cfg(test)] self.seed_ports.lock().unwrap().insert(record.id.clone(), session.tcp_listen_port().unwrap());
            let started = Instant::now(); let mut tick = tokio::time::interval(Duration::from_millis(250)); let mut saved = Instant::now();
            loop {
                let stopped = tokio::select! { biased; _ = cancel.cancelled() => true, _ = tick.tick() => false };
                let stats = handle.stats();
                if matches!(stats.state, TorrentStatsState::Error) { return Err("torrent_seed_files"); }
                let uploaded = seed.uploaded_bytes.saturating_add(stats.uploaded_bytes);
                let elapsed = seed.elapsed_seconds.saturating_add(started.elapsed().as_secs());
                let reached = seed.policy.reached(record.total_bytes, uploaded, elapsed);
                let persist = stopped || reached || saved.elapsed() >= Duration::from_secs(5);
                self.update_seed(&record.id, persist, |r| {
                    if let Some(seed) = &mut r.sharing { seed.status = SeedStatus::Seeding; seed.uploaded_bytes = uploaded; seed.elapsed_seconds = elapsed; }
                    r.upload_per_second = stats.live.as_ref().map_or(0, |s| (s.upload_speed.mbps * 1024.0 * 1024.0) as u64);
                    r.peers = stats.live.as_ref().map_or(0, |s| s.snapshot.peer_stats.live);
                    r.seeders = stats.live.as_ref().map(|s| s.snapshot.peer_stats.seeders);
                })?;
                if persist { saved = Instant::now(); }
                if stopped || reached { return Ok(reached); }
            }
        }.await;
        session.stop().await;
        result
    }
}

#[cfg(test)]
#[path = "p2p_seeding_tests.rs"]
mod tests;
