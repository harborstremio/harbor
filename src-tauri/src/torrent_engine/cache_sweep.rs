use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime};

const KEEP: &[&str] = &["dht.json", "engine.json"];

#[derive(Debug, Default)]
pub struct SweepStats {
    pub scanned: u64,
    pub deleted: u64,
    pub reclaimed_bytes: u64,
    pub errors: u64,
    pub cancelled: bool,
}

pub fn run_with_cancel(
    dir: &Path,
    retention_hours: u64,
    max_gb: u64,
    cancelled: &AtomicBool,
) -> SweepStats {
    let mut stats = SweepStats::default();
    let Ok(entries) = fs::read_dir(dir) else {
        stats.errors = 1;
        return stats;
    };
    let now = SystemTime::now();
    let max_age = Duration::from_secs(retention_hours.saturating_mul(3600));
    let mut kept: Vec<(PathBuf, SystemTime, u64)> = Vec::new();
    for entry in entries {
        if cancelled.load(Ordering::Acquire) {
            stats.cancelled = true;
            return stats;
        }
        let Ok(entry) = entry else {
            stats.errors += 1;
            continue;
        };
        stats.scanned += 1;
        let path = entry.path();
        let keep_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .map(|n| KEEP.contains(&n))
            .unwrap_or(false);
        if keep_name {
            continue;
        }
        let modified = entry.metadata().and_then(|m| m.modified()).ok();
        let expired = if retention_hours == 0 {
            true
        } else {
            match modified {
                Some(m) => now
                    .duration_since(m)
                    .map(|age| age >= max_age)
                    .unwrap_or(true),
                None => true,
            }
        };
        if expired {
            let Some(size) = entry_size(&path, cancelled) else {
                stats.cancelled = true;
                return stats;
            };
            record_remove(&path, size, &mut stats);
            continue;
        }
        if max_gb > 0 {
            let Some(size) = entry_size(&path, cancelled) else {
                stats.cancelled = true;
                return stats;
            };
            kept.push((path, modified.unwrap_or(now), size));
        }
    }
    enforce_size_cap(kept, max_gb, cancelled, &mut stats);
    stats
}

fn enforce_size_cap(
    mut kept: Vec<(PathBuf, SystemTime, u64)>,
    max_gb: u64,
    cancelled: &AtomicBool,
    stats: &mut SweepStats,
) {
    if max_gb == 0 {
        return;
    }
    let cap = max_gb.saturating_mul(1024 * 1024 * 1024);
    let mut total: u64 = kept.iter().map(|(_, _, s)| *s).sum();
    if total <= cap {
        return;
    }
    kept.sort_by_key(|(_, m, _)| *m);
    for (path, _, size) in kept {
        if cancelled.load(Ordering::Acquire) {
            stats.cancelled = true;
            return;
        }
        if total <= cap {
            break;
        }
        if record_remove(&path, size, stats) {
            total = total.saturating_sub(size);
        }
    }
}

fn entry_size(path: &Path, cancelled: &AtomicBool) -> Option<u64> {
    if cancelled.load(Ordering::Acquire) {
        return None;
    }
    if path.is_dir() {
        match fs::read_dir(path) {
            Ok(entries) => {
                let mut total = 0_u64;
                for entry in entries.flatten() {
                    total = total.saturating_add(entry_size(&entry.path(), cancelled)?);
                }
                Some(total)
            }
            Err(_) => Some(0),
        }
    } else {
        Some(fs::metadata(path).map(|m| m.len()).unwrap_or(0))
    }
}

fn record_remove(path: &Path, size: u64, stats: &mut SweepStats) -> bool {
    let result = if path.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    };
    if result.is_ok() {
        stats.deleted += 1;
        stats.reclaimed_bytes = stats.reclaimed_bytes.saturating_add(size);
        true
    } else {
        stats.errors += 1;
        false
    }
}

#[cfg(test)]
mod tests {
    use super::run_with_cancel;
    use std::fs;
    use std::sync::atomic::AtomicBool;

    #[test]
    fn sweep_reports_deleted_bytes_and_preserves_engine_files() {
        let dir = std::env::temp_dir().join(format!(
            "harbor-cache-sweep-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("engine.json"), b"keep").unwrap();
        fs::write(dir.join("old.bin"), b"12345678").unwrap();

        let cancelled = AtomicBool::new(false);
        let stats = run_with_cancel(&dir, 0, 0, &cancelled);

        assert_eq!(stats.scanned, 2);
        assert_eq!(stats.deleted, 1);
        assert_eq!(stats.reclaimed_bytes, 8);
        assert_eq!(stats.errors, 0);
        assert!(dir.join("engine.json").exists());
        assert!(!dir.join("old.bin").exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn sweep_stops_before_deleting_when_cancelled() {
        let dir = std::env::temp_dir().join(format!(
            "harbor-cache-sweep-cancel-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("old.bin"), b"keep until next sweep").unwrap();
        let cancelled = AtomicBool::new(true);

        let stats = run_with_cancel(&dir, 0, 0, &cancelled);

        assert!(stats.cancelled);
        assert!(dir.join("old.bin").exists());
        fs::remove_dir_all(dir).unwrap();
    }
}
