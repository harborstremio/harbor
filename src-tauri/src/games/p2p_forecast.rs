use super::super::{p2p_space, transfer_storage::ForecastItem};
use super::*;

// These limits apply to the whole refresh, not to each torrent. Unvisited files
// receive no allocation credit, so a large queue stays a conservative estimate.
const MAX_PROBES: usize = 512;
const MAX_REVIEWS: usize = 8;
const MAX_REFRESH: Duration = Duration::from_millis(100);

#[derive(Default)]
pub(super) struct Cache {
    requirements: HashMap<String, (String, Option<u64>)>,
    cursor: usize,
}

impl Torrents {
    pub fn storage_items(&self, profile: &str) -> Result<Vec<ForecastItem>> {
        self.storage_items_bounded(profile, MAX_PROBES, MAX_REFRESH)
    }
    fn storage_items_bounded(
        &self,
        profile: &str,
        max_probes: usize,
        max_refresh: Duration,
    ) -> Result<Vec<ForecastItem>> {
        let records: Vec<_> = self
            .list(profile)?
            .into_iter()
            .filter(|r| r.status != Status::Complete)
            .collect();
        let all_ids: std::collections::HashSet<_> = self
            .records
            .lock()
            .map_err(|_| "torrent_store")?
            .iter()
            .map(|r| r.id.clone())
            .collect();
        let mut cache = self.forecast.lock().map_err(|_| "torrent_store")?;
        cache.requirements.retain(|id, _| all_ids.contains(id));
        let mut items: Vec<_> = records
            .iter()
            .map(|record| {
                let id = format!("torrent:{}", record.id);
                let claim = self.storage.claim_remaining(&id);
                let cached = cache
                    .requirements
                    .get(&record.id)
                    .filter(|(sha, _)| sha == &record.metadata_sha)
                    .map(|(_, bytes)| *bytes);
                let required = cached
                    .unwrap_or(record.storage_bytes)
                    .filter(|size| *size >= record.total_bytes && *size <= files::MAX_BYTES);
                ForecastItem {
                    id,
                    path: PathBuf::from(&record.destination),
                    remaining: claim
                        .or_else(|| required.map(|n| n.saturating_add(transfer_storage::HEADROOM))),
                    file_count: record.selected.len(),
                    estimated_files: if claim.is_some() {
                        0
                    } else {
                        record.selected.len()
                    },
                }
            })
            .collect();
        if records.is_empty() {
            return Ok(items);
        }
        let start = cache.cursor % records.len();
        let began = Instant::now();
        let mut probes = 0usize;
        let mut reviews = 0usize;
        let mut metadata_bytes = 0usize;
        for offset in 0..records.len() {
            if began.elapsed() >= max_refresh || reviews >= MAX_REVIEWS {
                break;
            }
            let index = (start + offset) % records.len();
            cache.cursor = (index + 1) % records.len();
            let record = &records[index];
            if let Some(remaining) = self.storage.claim_remaining(&items[index].id) {
                items[index].remaining = Some(remaining);
                items[index].estimated_files = 0;
                continue;
            }
            let path = self.root.join(format!("{}.torrent", record.id));
            let length = fs::symlink_metadata(&path)
                .ok()
                .filter(|m| m.is_file() && !files::linked(m))
                .map(|m| m.len() as usize);
            if length.is_some_and(|len| {
                len <= files::MAX_METADATA
                    && len > files::MAX_METADATA.saturating_sub(metadata_bytes)
            }) {
                // Resume with this record next time. Skipping it and wrapping
                // the cursor would let an earlier large record starve it.
                cache.cursor = index;
                break;
            }
            reviews += 1;
            let review = (|| {
                let bytes = files::read(&path, files::MAX_METADATA.saturating_sub(metadata_bytes))?;
                metadata_bytes += bytes.len();
                if files::digest(&bytes) != record.metadata_sha {
                    return Err("torrent_metadata");
                }
                let (meta, entries, _) = files::metadata(&bytes)?;
                if meta.info_hash.as_string() != record.info_hash
                    || files::selected(&entries, &record.selected)? != record.total_bytes
                {
                    return Err("torrent_metadata");
                }
                let extents =
                    files::storage_extents(&entries, &record.selected, meta.info.piece_length);
                let required = extents.iter().copied().sum::<u64>();
                cache.requirements.insert(
                    record.id.clone(),
                    (record.metadata_sha.clone(), Some(required)),
                );
                let mut remaining = required.saturating_add(transfer_storage::HEADROOM);
                let mut unchecked = 0;
                for (file, extent) in entries.iter().zip(extents) {
                    if extent == 0 {
                        continue;
                    }
                    if probes >= max_probes || began.elapsed() >= max_refresh {
                        unchecked += 1;
                        continue;
                    }
                    probes += 1;
                    // Validate ancestors and Harbor's destination marker before
                    // inspecting allocation; never follow a replaced directory.
                    match files::verify_destination(record, std::slice::from_ref(file)).and_then(
                        |_| {
                            p2p_space::allocated(
                                &Path::new(&record.destination).join(&file.path),
                                extent,
                            )
                        },
                    ) {
                        Ok(allocated) => remaining = remaining.saturating_sub(allocated),
                        Err(_) => unchecked += 1,
                    }
                }
                Ok((remaining, unchecked))
            })();
            match review {
                Ok((remaining, unchecked)) => {
                    items[index].remaining = Some(remaining);
                    items[index].estimated_files = unchecked;
                }
                Err(_) => {
                    items[index].remaining = None;
                    items[index].estimated_files = 0;
                    cache
                        .requirements
                        .insert(record.id.clone(), (record.metadata_sha.clone(), None));
                }
            }
        }
        Ok(items)
    }
}

#[cfg(test)]
#[path = "p2p_forecast_tests.rs"]
mod tests;
