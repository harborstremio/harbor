use super::{
    p2p::{Result, TorrentFile},
    p2p_files,
    transfer_storage::{Reservation, Storage, HEADROOM},
};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU8, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

const CHECK_BYTES: u64 = 4 * 1024 * 1024;
const CHECK_INTERVAL: Duration = Duration::from_millis(250);

struct FileSpace {
    path: PathBuf,
    extent: u64,
    allocated: u64,
}
struct State {
    reservation: Option<Reservation>,
    files: Vec<FileSpace>,
    unchecked_bytes: u64,
    checked_at: Instant,
    remaining: u64,
}

/// Counts allocation, not received bytes: retransmits and sparse lengths must not
/// release capacity that another download or extraction still needs.
pub struct TorrentSpace {
    state: Mutex<State>,
    failure: AtomicU8,
}
pub struct SpaceLease(Arc<TorrentSpace>);
impl Drop for SpaceLease {
    fn drop(&mut self) {
        self.0.close();
    }
}

pub(super) fn allocated(path: &Path, extent: u64) -> Result<u64> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(value) if value.is_file() && !p2p_files::linked(&value) => value,
        Ok(_) => return Err("torrent_destination"),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(0),
        Err(_) => return Err("torrent_destination"),
    };
    // An extended, unselected file may have allocation outside the needed prefix.
    // Without an extent map it cannot contribute credit to that prefix.
    if metadata.len() > extent {
        return Ok(0);
    }
    #[cfg(windows)]
    let bytes = {
        use std::os::windows::ffi::OsStrExt;
        #[link(name = "kernel32")]
        extern "system" {
            fn GetCompressedFileSizeW(path: *const u16, high: *mut u32) -> u32;
            fn GetLastError() -> u32;
            fn SetLastError(error: u32);
        }
        let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        let mut high = 0;
        unsafe {
            SetLastError(0);
            let low = GetCompressedFileSizeW(wide.as_ptr(), &mut high);
            if low == u32::MAX && GetLastError() != 0 {
                0
            } else {
                ((high as u64) << 32) | low as u64
            }
        }
    };
    #[cfg(unix)]
    let bytes = {
        use std::os::unix::fs::MetadataExt;
        metadata.blocks().saturating_mul(512)
    };
    #[cfg(not(any(windows, unix)))]
    let bytes = 0;
    Ok(bytes.min(extent))
}

fn storage_error(error: &'static str) -> &'static str {
    if error == "transfer_space" {
        "torrent_space"
    } else {
        "torrent_store"
    }
}
impl TorrentSpace {
    pub fn new(
        storage: &Arc<Storage>,
        id: &str,
        root: &Path,
        files: &[TorrentFile],
        selected: &[usize],
        piece: u32,
    ) -> Result<Arc<Self>> {
        let extents = p2p_files::storage_extents(files, selected, piece);
        let files: Vec<_> = files
            .iter()
            .zip(extents)
            .map(|(file, extent)| {
                let path = root.join(&file.path);
                let allocated = if extent == 0 {
                    0
                } else {
                    allocated(&path, extent)?
                };
                Ok(FileSpace {
                    path,
                    extent,
                    allocated,
                })
            })
            .collect::<Result<_>>()?;
        // Retain the torrent engine's existing 64 MiB initial margin: half is
        // the common floor, half belongs to this active torrent's metadata/I/O.
        let remaining = files.iter().fold(HEADROOM, |sum, file| {
            sum.saturating_add(file.extent.saturating_sub(file.allocated))
        });
        let reservation = storage
            .reserve(&format!("torrent:{id}"), root, remaining)
            .map_err(storage_error)?;
        Ok(Arc::new(Self {
            state: Mutex::new(State {
                reservation: Some(reservation),
                files,
                unchecked_bytes: 0,
                checked_at: Instant::now(),
                remaining,
            }),
            failure: AtomicU8::new(0),
        }))
    }
    pub fn lease(self: &Arc<Self>) -> SpaceLease {
        SpaceLease(self.clone())
    }
    pub fn failure(&self) -> Option<&'static str> {
        match self.failure.load(Ordering::Relaxed) {
            1 => Some("torrent_space"),
            2 => Some("torrent_destination"),
            3 => Some("torrent_store"),
            _ => None,
        }
    }
    fn record(&self, error: &'static str) -> &'static str {
        let code = match error {
            "torrent_space" => 1,
            "torrent_destination" => 2,
            _ => 3,
        };
        let _ = self
            .failure
            .compare_exchange(0, code, Ordering::Relaxed, Ordering::Relaxed);
        error
    }
    fn refresh(&self, state: &mut State) -> Result<()> {
        let reservation = state.reservation.as_ref().ok_or("torrent_canceled")?;
        reservation
            .check()
            .map_err(|error| self.record(storage_error(error)))?;
        state.unchecked_bytes = 0;
        state.checked_at = Instant::now();
        Ok(())
    }
    pub fn check(&self) -> Result<()> {
        if let Some(error) = self.failure() {
            return Err(error);
        }
        let mut state = self.state.lock().map_err(|_| "torrent_store")?;
        self.refresh(&mut state)
    }
    pub fn operation(
        &self,
        file: usize,
        end: u64,
        bytes: u64,
        resize: bool,
        operation: impl FnOnce() -> anyhow::Result<()>,
    ) -> anyhow::Result<()> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| anyhow::anyhow!("torrent_store"))?;
        if state.reservation.is_none() {
            anyhow::bail!("torrent_canceled");
        }
        if let Some(error) = self.failure() {
            anyhow::bail!(error);
        }
        if state.files.get(file).is_none_or(|file| end > file.extent) {
            anyhow::bail!(self.record("torrent_destination"));
        }
        if resize
            || state.unchecked_bytes >= CHECK_BYTES
            || state.checked_at.elapsed() >= CHECK_INTERVAL
        {
            self.refresh(&mut state).map_err(anyhow::Error::msg)?;
        }
        // Closing the lease waits for in-flight writes, then rejects any late
        // engine callbacks before releasing the capacity to another transfer.
        let result = operation();
        // Publish allocation credit immediately. Delaying it until the next
        // progress tick would double-count these bytes for another engine's
        // space check and could falsely fail a concurrent download near capacity.
        let tracked = &mut state.files[file];
        let previous = tracked.extent.saturating_sub(tracked.allocated);
        tracked.allocated = allocated(&tracked.path, tracked.extent)
            .map_err(|error| anyhow::anyhow!(self.record(error)))?;
        let remaining = tracked.extent.saturating_sub(tracked.allocated);
        state.remaining = state
            .remaining
            .saturating_sub(previous)
            .saturating_add(remaining);
        state
            .reservation
            .as_ref()
            .unwrap()
            .set_remaining(state.remaining);
        state.unchecked_bytes = state.unchecked_bytes.saturating_add(bytes);
        if let Err(error) = &result {
            if error
                .chain()
                .filter_map(|e| e.downcast_ref::<std::io::Error>())
                .any(|e| {
                    #[cfg(windows)]
                    {
                        matches!(e.raw_os_error(), Some(39 | 112))
                    }
                    #[cfg(not(windows))]
                    {
                        e.raw_os_error() == Some(28)
                    }
                })
            {
                self.record("torrent_space");
            }
        }
        if resize {
            self.refresh(&mut state).map_err(anyhow::Error::msg)?;
        }
        result
    }
    fn close(&self) {
        self.state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .reservation
            .take();
    }
}

#[cfg(test)]
#[path = "p2p_space_tests.rs"]
mod tests;
