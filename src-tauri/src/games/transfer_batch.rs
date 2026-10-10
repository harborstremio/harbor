use super::*;
use std::collections::HashSet;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFile {
    #[serde(default)]
    pub source_link: Option<String>,
    #[serde(default)]
    pub browser_ticket: Option<String>,
    pub filename: String,
    pub name: String,
    #[serde(default)]
    pub game: Option<DownloadGame>,
    pub url: String,
    pub expected_bytes: Option<u64>,
    pub expected_sha256: Option<String>,
}

#[derive(Deserialize)]
pub struct NewBatch {
    pub profile: String,
    pub directory: String,
    pub files: Vec<BatchFile>,
}

fn filename_valid(value: &str) -> bool {
    let stem = value.split('.').next().unwrap_or("").to_ascii_lowercase();
    !value.is_empty() && value.encode_utf16().count() <= 255 && value.len() <= 255
        && !value.chars().any(|ch| ch.is_control() || "<>:\"/\\|?*".contains(ch))
        && value.trim() == value && !value.ends_with('.') && !value.starts_with(".harbor-")
        && !matches!(stem.as_str(), "con" | "prn" | "aux" | "nul")
        && !(stem.len() == 4 && (stem.starts_with("com") || stem.starts_with("lpt"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
}

fn destination_key(path: &Path) -> String {
    // Older records may predate canonical Windows extended paths or use a folder alias.
    let normalized = files::destination(&path.to_string_lossy()).unwrap_or_else(|_| path.into());
    let key = normalized.to_string_lossy().into_owned();
    if cfg!(target_os = "windows") { key.to_lowercase() } else { key }
}

impl Transfers {
    pub fn add_batch(self: &Arc<Self>, args: NewBatch) -> Result<Vec<Transfer>> {
        self.add_batch_prepared(args, None)
    }
    pub fn add_batch_prepared(self: &Arc<Self>, args: NewBatch, preparation: Option<super::super::preparation_intake::Draft>) -> Result<Vec<Transfer>> {
        if !profile_valid(&args.profile) { return Err("transfer_profile"); }
        if args.files.is_empty() || args.files.len() > LIMIT { return Err("transfer_limit"); }
        let directory = Path::new(&args.directory);
        if !directory.is_absolute() || args.directory.len() > 4096 { return Err("transfer_destination"); }
        let directory = fs::canonicalize(directory).map_err(|_| "transfer_destination")?;
        if !directory.is_dir() { return Err("transfer_destination"); }
        let mut names = HashSet::new();
        let mut requests = Vec::with_capacity(args.files.len());
        for file in args.files {
            // Preserve archive-part names exactly; changing a collision can break extraction.
            if !filename_valid(&file.filename) || !names.insert(file.filename.to_lowercase()) {
                return Err("transfer_batch_names");
            }
            requests.push(NewTransfer {
                source_link: file.source_link,
                browser_ticket: file.browser_ticket,
                profile: args.profile.clone(), name: file.name, game: file.game, url: file.url,
                destination: directory.join(file.filename).to_string_lossy().into_owned(),
                expected_bytes: file.expected_bytes, expected_sha256: file.expected_sha256,
            });
        }
        self.add_records(requests, preparation)
    }

    pub(super) fn add_records(self: &Arc<Self>, requests: Vec<NewTransfer>, preparation: Option<super::super::preparation_intake::Draft>) -> Result<Vec<Transfer>> {
        if requests.is_empty() || requests.len() > LIMIT { return Err("transfer_limit"); }
        let mut items = Vec::with_capacity(requests.len());
        let batch_id = (requests.len() > 1).then(|| uuid::Uuid::new_v4().to_string());
        let mut destinations = HashSet::new();
        for args in requests {
            if !profile_valid(&args.profile) { return Err("transfer_profile"); }
            protocol::validate_url(&args.url)?;
            if args.name.trim().is_empty() || args.name.len() > 500 || args.expected_bytes == Some(0) {
                return Err("transfer_invalid_record");
            }
            let source_page = args.browser_ticket.as_deref().map(|ticket| super::super::source_browser::receipt(ticket, &args.profile, &args.url)).transpose()?;
            let source_link = match args.source_link {
                Some(value) => Some(download_metadata::source_link(Some(value)).ok_or("transfer_invalid_record")?),
                None => None,
            };
            let expected_sha256 = protocol::normalized_hash(args.expected_sha256)?;
            let dest = files::destination(&args.destination)?;
            if dest.symlink_metadata().is_ok() { return Err("transfer_exists"); }
            if !destinations.insert(destination_key(&dest)) { return Err("transfer_duplicate"); }
            items.push(Transfer {
                batch_id: batch_id.clone(),
                checking_partial: None,
                preparation: None,
                source_link,
                source_page,
                id: uuid::Uuid::new_v4().to_string(), profile: args.profile, name: args.name.trim().into(),
                game: download_metadata::sanitize(args.game),
                url: args.url, destination: dest.to_string_lossy().into_owned(), status: Status::Queued,
                received: 0, total: args.expected_bytes, expected_bytes: args.expected_bytes,
                expected_sha256, sha256: None, validator: None, created_at: now(), updated_at: now(),
                error: None, bytes_per_second: 0, disk_bytes_per_second: Some(0), queue_order: 0,
            });
        }
        if let Some(draft) = preparation { super::super::preparation_intake::direct(&mut items, draft)?; }
        let _source_use=super::super::game_file_use::using(&items.iter().map(|item|PathBuf::from(&item.destination)).collect::<Vec<_>>(),false).map_err(|_|"transfer_destination")?;
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        if state.records.len() + items.len() > LIMIT { return Err("transfer_limit"); }
        if state.records.iter().any(|record| record.status != Status::Canceled
            && destinations.contains(&destination_key(Path::new(&record.destination)))) {
            return Err("transfer_duplicate");
        }
        let mut order = state.records.iter().map(|r| r.queue_order).max().unwrap_or(0);
        for item in &mut items {
            order = order.checked_add(1).ok_or("transfer_limit")?;
            item.queue_order = order;
        }
        let mut partials = Vec::new();
        let previous_len = state.records.len();
        let result = (|| {
            for item in &items {
                let part = files::partial(Path::new(&item.destination), &item.id)?;
                fs::OpenOptions::new().write(true).create_new(true).open(&part).map_err(|_| "transfer_write")?;
                partials.push(part);
            }
            state.records.extend(items.iter().cloned());
            self.register_queue(&items)?;
            self.persist(&state)
        })();
        if let Err(error) = result {
            state.records.truncate(previous_len);
            for item in &items { let _ = self.queue.forget(QueueKind::Direct, &item.id); }
            for part in partials { let _ = fs::remove_file(part); }
            return Err(error);
        }
        drop(state);
        for item in &mut items { item.queue_order = self.queue.order(QueueKind::Direct, &item.id); self.emit_record(item.clone()); }
        // All records are durable before any download starts. Reuse the normal scheduler,
        // per-volume reservations, bandwidth limits and individual retry/cancel behavior.
        self.kick();
        Ok(items)
    }
}
