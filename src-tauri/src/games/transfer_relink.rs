//! Explicit replacement of an expired direct URL, preserving its exact transfer.
use super::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Relink {
    pub profile: String,
    pub id: String,
    pub previous_url: String,
    pub url: String,
    pub filename: String,
    pub source_link: Option<String>,
    pub browser_ticket: Option<String>,
    pub expected_bytes: Option<u64>,
    pub expected_sha256: Option<String>,
}

impl Transfers {
    pub fn relink(self: &Arc<Self>, request: Relink) -> Result<Transfer> {
        if !profile_valid(&request.profile) {
            return Err("transfer_profile");
        }
        protocol::validate_url(&request.url)?;
        let hash = protocol::normalized_hash(request.expected_sha256)?;
        let source_page = request
            .browser_ticket
            .as_deref()
            .map(|ticket| {
                super::super::source_browser::receipt(ticket, &request.profile, &request.url)
            })
            .transpose()?;
        let mut state = self.state.lock().map_err(|_| "transfer_store")?;
        let index = state
            .records
            .iter()
            .position(|r| r.id == request.id && r.profile == request.profile)
            .ok_or("transfer_unknown")?;
        let old = state.records[index].clone();
        if state.active.contains_key(&old.id)
            || !matches!(old.status, Status::Paused | Status::Failed)
            || old.url != request.previous_url
        {
            return Err("transfer_state");
        }
        let filename = Path::new(&old.destination)
            .file_name()
            .and_then(|v| v.to_str())
            .ok_or("transfer_destination")?;
        let same_name = if cfg!(target_os = "windows") {
            filename.eq_ignore_ascii_case(&request.filename)
        } else {
            filename == request.filename
        };
        if !same_name || old.source_link != request.source_link {
            return Err("transfer_relink_mismatch");
        }
        if request.expected_bytes == Some(0)
            || old
                .expected_bytes
                .or(old.total)
                .zip(request.expected_bytes)
                .is_some_and(|(a, b)| a != b)
            || old
                .expected_sha256
                .as_ref()
                .zip(hash.as_ref())
                .is_some_and(|(a, b)| a != b)
        {
            return Err("transfer_relink_mismatch");
        }
        let dest = Path::new(&old.destination);
        let _lease = super::super::game_file_use::using(&[dest.to_path_buf()], false)
            .map_err(|_| "transfer_destination")?;
        if dest.symlink_metadata().is_ok() {
            return Err("transfer_exists");
        }
        let part = files::partial(dest, &old.id)?;
        let saved = files::ensure_regular(&part)?.unwrap_or(0);
        let expected = old.expected_bytes.or(old.total).or(request.expected_bytes);
        if expected.is_some_and(|size| saved > size) {
            return Err("transfer_size_mismatch");
        }
        let record = &mut state.records[index];
        // Legacy direct transfers matched source rows by URL. Keep that identity
        // before replacing it, independently of the new browser authorization.
        record.source_link = old.source_link.clone().or_else(|| {
            download_metadata::source_link(Some(
                old.source_page.clone().unwrap_or_else(|| old.url.clone()),
            ))
        });
        record.url = request.url;
        record.source_page = source_page;
        record.expected_bytes = expected;
        record.expected_sha256 = old.expected_sha256.clone().or(hash);
        record.checking_partial = (saved > 0).then_some(0);
        record.validator = None; // Entity tags are scoped to a URL; never trust one across replacement.
        record.sha256 = None;
        record.received = saved;
        record.bytes_per_second = 0;
        record.disk_bytes_per_second = Some(0);
        record.status = Status::Queued;
        record.error = None;
        record.updated_at = now();
        let changed = record.clone();
        if let Err(error) = self.persist(&state) {
            state.records[index] = old;
            return Err(error);
        }
        drop(state);
        drop(_lease);
        self.emit_record(changed.clone());
        self.kick();
        Ok(changed)
    }
}
