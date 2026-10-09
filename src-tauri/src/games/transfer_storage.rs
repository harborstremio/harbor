use super::transfer_files;
use serde::Serialize;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex, OnceLock,
    },
};

pub const HEADROOM: u64 = 32 * 1024 * 1024;

/// Downloads and archive extraction share claims within this process.
pub fn shared() -> Arc<Storage> {
    static STORAGE: OnceLock<Arc<Storage>> = OnceLock::new();
    STORAGE.get_or_init(|| Arc::new(Storage::default())).clone()
}
#[derive(Clone, Debug)]
pub struct Volume {
    pub id: String,
    pub mount: String,
    pub available: u64,
}

/// Resolve the filesystem, rather than grouping by a drive letter or folder prefix.
pub fn volume(path: &Path) -> Option<Volume> {
    let path = std::fs::canonicalize(path).ok()?;
    let available = transfer_files::free_bytes(&path)?;
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        #[link(name = "kernel32")]
        extern "system" {
            fn GetVolumePathNameW(path: *const u16, mount: *mut u16, length: u32) -> i32;
            fn GetVolumeNameForVolumeMountPointW(
                mount: *const u16,
                name: *mut u16,
                length: u32,
            ) -> i32;
        }
        let name = path
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>();
        let mut mount = vec![0u16; 32768];
        if unsafe { GetVolumePathNameW(name.as_ptr(), mount.as_mut_ptr(), mount.len() as u32) } == 0
        {
            return None;
        }
        let end = mount.iter().position(|c| *c == 0)?;
        let mount_name = String::from_utf16(&mount[..end]).ok()?;
        let mut guid = [0u16; 64];
        let id = if unsafe {
            GetVolumeNameForVolumeMountPointW(mount.as_ptr(), guid.as_mut_ptr(), guid.len() as u32)
        } != 0
        {
            String::from_utf16(&guid[..guid.iter().position(|c| *c == 0)?]).ok()?
        } else {
            mount_name.clone()
        };
        let display = mount_name
            .strip_prefix(r"\\?\UNC\")
            .map(|p| format!(r"\\{p}"))
            .unwrap_or_else(|| {
                mount_name
                    .strip_prefix(r"\\?\")
                    .unwrap_or(&mount_name)
                    .to_owned()
            });
        Some(Volume {
            id: id.to_lowercase(),
            mount: display,
            available,
        })
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let device = std::fs::metadata(&path).ok()?.dev();
        let mut mount = path;
        while let Some(parent) = mount.parent() {
            if std::fs::metadata(parent).ok()?.dev() != device {
                break;
            }
            mount = parent.to_owned();
        }
        Some(Volume {
            id: format!("device:{device}"),
            mount: mount.to_string_lossy().into_owned(),
            available,
        })
    }
    #[cfg(not(any(unix, target_os = "windows")))]
    {
        let _ = available;
        None
    }
}

type Probe = dyn Fn(&Path) -> Option<Volume> + Send + Sync;
struct Claim {
    volume: String,
    remaining: u64,
}
pub struct Storage {
    claims: Mutex<HashMap<String, Claim>>,
    probe: Arc<Probe>,
}
impl Default for Storage {
    fn default() -> Self {
        Self {
            claims: Mutex::default(),
            probe: Arc::new(volume),
        }
    }
}
impl Storage {
    pub fn claim_remaining(&self, id: &str) -> Option<u64> {
        self.claims
            .lock()
            .ok()?
            .get(id)
            .map(|claim| claim.remaining)
    }
    pub fn forecast(&self, items: &[ForecastItem]) -> Vec<Forecast> {
        let own_ids: Vec<_> = items
            .iter()
            .filter(|item| item.remaining.is_some())
            .map(|item| item.id.as_str())
            .collect();
        let mut paths = HashMap::new();
        let mut drives: HashMap<String, Forecast> = HashMap::new();
        for item in items {
            let disk = paths
                .entry(item.path.clone())
                .or_insert_with(|| self.inspect(&item.path));
            let key = disk
                .as_ref()
                .map(|d| d.id.clone())
                .unwrap_or_else(|| item.path.to_string_lossy().into_owned());
            let forecast = drives.entry(key.clone()).or_insert_with(|| Forecast {
                volume: disk
                    .as_ref()
                    .map(|d| d.mount.clone())
                    .unwrap_or_else(|| item.path.to_string_lossy().into_owned()),
                available_bytes: disk.as_ref().map(|d| d.available),
                remaining_bytes: 0,
                unknown_files: 0,
                estimated_files: 0,
                file_count: 0,
                other_reserved_bytes: self.other_reserved(&key, &own_ids),
                shortfall_bytes: None,
            });
            if let (Some(available), Some(disk)) = (forecast.available_bytes, disk.as_ref()) {
                forecast.available_bytes = Some(available.min(disk.available));
            }
            forecast.file_count += item.file_count;
            forecast.remaining_bytes = forecast
                .remaining_bytes
                .saturating_add(item.remaining.unwrap_or(0));
            if item.remaining.is_none() {
                forecast.unknown_files += item.file_count;
            }
            forecast.estimated_files += item.estimated_files;
        }
        let mut result: Vec<_> = drives.into_values().collect();
        for forecast in &mut result {
            forecast.shortfall_bytes = forecast.available_bytes.map(|available| {
                forecast
                    .remaining_bytes
                    .saturating_add(forecast.other_reserved_bytes)
                    .saturating_add(HEADROOM)
                    .saturating_sub(available)
            });
        }
        result.sort_by(|a, b| a.volume.cmp(&b.volume));
        result
    }
    #[cfg(test)]
    pub fn with_probe(
        probe: impl Fn(&Path) -> Option<Volume> + Send + Sync + 'static,
    ) -> Arc<Self> {
        Arc::new(Self {
            claims: Mutex::default(),
            probe: Arc::new(probe),
        })
    }
    pub fn inspect(&self, path: &Path) -> Option<Volume> {
        (self.probe)(path)
    }
    pub fn reserve(
        self: &Arc<Self>,
        id: &str,
        path: &Path,
        remaining: u64,
    ) -> Result<Reservation, &'static str> {
        let mut claims = self.claims.lock().map_err(|_| "transfer_store")?;
        if let Some(disk) = self.inspect(path) {
            let other = claims
                .iter()
                .filter(|(key, claim)| key.as_str() != id && claim.volume == disk.id)
                .fold(0u64, |sum, (_, claim)| sum.saturating_add(claim.remaining));
            if remaining.saturating_add(other).saturating_add(HEADROOM) > disk.available {
                return Err("transfer_space");
            }
            claims.insert(
                id.into(),
                Claim {
                    volume: disk.id,
                    remaining,
                },
            );
        } else if transfer_files::free_bytes(path)
            .is_some_and(|free| remaining.saturating_add(HEADROOM) > free)
        {
            // Preserve the single-file check when volume identity is unavailable.
            return Err("transfer_space");
        }
        Ok(Reservation {
            storage: self.clone(),
            id: id.into(),
            path: path.into(),
            remaining: AtomicU64::new(remaining),
        })
    }
    pub fn other_reserved(&self, volume: &str, own_ids: &[&str]) -> u64 {
        self.claims
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .filter(|(id, claim)| claim.volume == volume && !own_ids.contains(&id.as_str()))
            .fold(0u64, |sum, (_, claim)| sum.saturating_add(claim.remaining))
    }
}
pub struct Reservation {
    storage: Arc<Storage>,
    id: String,
    path: PathBuf,
    remaining: AtomicU64,
}
impl Reservation {
    pub fn written(&self, bytes: u64) {
        let mut claims = self
            .storage
            .claims
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let _ = self
            .remaining
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |value| {
                Some(value.saturating_sub(bytes))
            });
        if let Some(claim) = claims.get_mut(&self.id) {
            claim.remaining = claim.remaining.saturating_sub(bytes);
        }
    }
    /// Reconcile actual file allocation, including sparse files and resumed downloads.
    /// Call check before further writes; an increased claim must not be ignored.
    pub fn set_remaining(&self, bytes: u64) {
        let mut claims = self
            .storage
            .claims
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        self.remaining.store(bytes, Ordering::Relaxed);
        if let Some(claim) = claims.get_mut(&self.id) {
            claim.remaining = bytes;
        }
    }
    pub fn check(&self) -> Result<(), &'static str> {
        let mut claims = self.storage.claims.lock().map_err(|_| "transfer_store")?;
        if let Some(disk) = self.storage.inspect(&self.path) {
            // A temporarily unavailable volume probe must not leave this active
            // transfer outside shared accounting once the filesystem is known.
            claims.insert(
                self.id.clone(),
                Claim {
                    volume: disk.id.clone(),
                    remaining: self.remaining.load(Ordering::Relaxed),
                },
            );
            let remaining = claims
                .values()
                .filter(|claim| claim.volume == disk.id)
                .fold(0u64, |sum, claim| sum.saturating_add(claim.remaining));
            if remaining.saturating_add(HEADROOM) > disk.available {
                return Err("transfer_space");
            }
        } else if transfer_files::free_bytes(&self.path).is_some_and(|free| {
            free < self
                .remaining
                .load(Ordering::Relaxed)
                .saturating_add(HEADROOM)
        }) {
            return Err("transfer_space");
        }
        Ok(())
    }
}
impl Drop for Reservation {
    fn drop(&mut self) {
        self.storage
            .claims
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&self.id);
    }
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Forecast {
    pub volume: String,
    pub available_bytes: Option<u64>,
    pub remaining_bytes: u64,
    pub unknown_files: usize,
    pub estimated_files: usize,
    pub file_count: usize,
    pub other_reserved_bytes: u64,
    pub shortfall_bytes: Option<u64>,
}

pub struct ForecastItem {
    pub id: String,
    pub path: PathBuf,
    pub remaining: Option<u64>,
    pub file_count: usize,
    pub estimated_files: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    #[test]
    fn mixed_forecast_groups_volumes_and_preserves_unknown_capacity_and_private_claims() {
        let storage = Storage::with_probe(|path| {
            if path.starts_with("offline") {
                None
            } else {
                Some(Volume {
                    id: "volume".into(),
                    mount: "Games".into(),
                    available: HEADROOM + 100,
                })
            }
        });
        let direct = storage.reserve("direct", Path::new("first"), 20).unwrap();
        let torrent = storage
            .reserve("torrent:one", Path::new("second"), 30)
            .unwrap();
        let other = storage
            .reserve("private-extraction", Path::new("second"), 40)
            .unwrap();
        let item = |id: &str, path: &str, remaining| ForecastItem {
            id: id.into(),
            path: path.into(),
            remaining,
            file_count: 1,
            estimated_files: 0,
        };
        let items = vec![
            item("direct", "first", Some(20)),
            item("torrent:one", "second", Some(30)),
            item("unknown", "second", None),
            item("offline", "offline", Some(50)),
        ];
        let result = storage.forecast(&items);
        let volume = result.iter().find(|r| r.volume == "Games").unwrap();
        assert_eq!(
            (
                volume.remaining_bytes,
                volume.other_reserved_bytes,
                volume.file_count,
                volume.unknown_files
            ),
            (50, 40, 3, 1)
        );
        assert_eq!(volume.shortfall_bytes, Some(0));
        let missing = result.iter().find(|r| r.volume == "offline").unwrap();
        assert_eq!(missing.available_bytes, None);
        assert_eq!(missing.shortfall_bytes, None);
        let text = serde_json::to_string(&result).unwrap();
        assert!(!text.contains("private-extraction") && !text.contains("torrent:one"));
        drop((direct, torrent, other));
    }
    #[test]
    fn concurrent_claims_share_one_drive_and_release_after_stop() {
        let free = Arc::new(AtomicU64::new(HEADROOM + 100));
        let current = free.clone();
        let storage = Storage::with_probe(move |path| {
            Some(Volume {
                id: if path.starts_with("other") { "b" } else { "a" }.into(),
                mount: "drive".into(),
                available: current.load(Ordering::SeqCst),
            })
        });
        let a = storage
            .reserve("profile-a", Path::new("first/folder"), 60)
            .unwrap();
        assert!(matches!(
            storage.reserve("profile-b", Path::new("alias/folder"), 60),
            Err("transfer_space")
        ));
        let b = storage
            .reserve("second-disk", Path::new("other"), 60)
            .unwrap();
        a.written(40);
        free.store(HEADROOM + 60, Ordering::SeqCst);
        assert!(a.check().is_ok());
        assert_eq!(storage.other_reserved("a", &[]), 20);
        assert_eq!(storage.other_reserved("a", &["profile-a"]), 0);
        drop(a);
        drop(b);
        assert!(storage.reserve("profile-b", Path::new("alias"), 60).is_ok());
        assert!(matches!(
            storage.reserve("overflow", Path::new("first"), u64::MAX),
            Err("transfer_space")
        ));
    }
    #[test]
    fn unknown_length_and_external_writes_still_protect_the_free_space_floor() {
        let free = Arc::new(AtomicU64::new(HEADROOM + 1));
        let current = free.clone();
        let storage = Storage::with_probe(move |_| {
            Some(Volume {
                id: "a".into(),
                mount: "drive".into(),
                available: current.load(Ordering::SeqCst),
            })
        });
        let unknown = storage.reserve("stream", Path::new("a"), 0).unwrap();
        free.store(HEADROOM - 1, Ordering::SeqCst);
        assert_eq!(unknown.check(), Err("transfer_space"));
        let unavailable = Storage::with_probe(|_| None);
        assert!(unavailable.inspect(Path::new("missing")).is_none());
        assert!(unavailable
            .reserve("remote", Path::new("remote"), 10)
            .unwrap()
            .check()
            .is_ok());
    }
    #[test]
    fn recovered_volume_identity_restores_the_active_claim_and_checks_its_size() {
        let available = Arc::new(AtomicU64::new(0));
        let probe = available.clone();
        let storage = Storage::with_probe(move |_| {
            let free = probe.load(Ordering::Relaxed);
            (free != 0).then(|| Volume {
                id: "recovered".into(),
                mount: "drive".into(),
                available: free,
            })
        });
        let claim = storage
            .reserve("active", Path::new("probe-unavailable"), 128)
            .unwrap();
        assert_eq!(storage.other_reserved("recovered", &[]), 0);
        available.store(HEADROOM + 127, Ordering::Relaxed);
        assert_eq!(claim.check(), Err("transfer_space"));
        assert_eq!(storage.other_reserved("recovered", &[]), 128);
        claim.written(64);
        claim.set_remaining(80);
        available.store(HEADROOM + 100, Ordering::Relaxed);
        claim.check().unwrap();
        assert!(matches!(
            storage.reserve("another", Path::new("same-volume"), 21),
            Err("transfer_space")
        ));
        assert_eq!(storage.other_reserved("recovered", &[]), 80);
        drop(claim);
        assert_eq!(storage.other_reserved("recovered", &[]), 0);
    }
}
