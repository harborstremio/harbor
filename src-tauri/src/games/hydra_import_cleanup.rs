//! Remove only marked, expired snapshots in the application's dedicated cache.
use super::{snapshot::linked, Result};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};
const MARKER: &str = ".harbor-hydra-review";
const MAX_AGE: u64 = 120;

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
pub(super) fn mark(path: &Path) -> Result<()> {
    let id = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("hydra_path")?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path.join(MARKER))
        .map_err(|_| "hydra_space")?;
    write!(file, "HARBOR-HYDRA-SNAPSHOT-1\n{id}\n{}", now()).map_err(|_| "hydra_space")?;
    file.sync_all().map_err(|_| "hydra_space")
}
pub(super) fn expired(cache: &Path) {
    expire_at(cache, now());
}
fn expire_at(cache: &Path, now: u64) {
    let Ok(entries) = fs::read_dir(cache) else {
        return;
    };
    // One review runs at a time. Bound housekeeping even if the cache was modified.
    for entry in entries.take(64).flatten() {
        let name = entry.file_name();
        let Some(id) = name.to_str().filter(|s| uuid::Uuid::parse_str(s).is_ok()) else {
            continue;
        };
        let path = entry.path();
        if !fs::symlink_metadata(&path).is_ok_and(|m| m.is_dir() && !linked(&m)) {
            continue;
        }
        let marker = path.join(MARKER);
        if !fs::symlink_metadata(&marker)
            .is_ok_and(|m| m.is_file() && !linked(&m) && m.len() <= 128)
        {
            continue;
        }
        let Ok(file) = File::open(marker) else {
            continue;
        };
        let mut text = String::new();
        if file.take(129).read_to_string(&mut text).is_err() || text.len() > 128 {
            continue;
        }
        let mut lines = text.lines();
        if lines.next() != Some("HARBOR-HYDRA-SNAPSHOT-1") || lines.next() != Some(id) {
            continue;
        }
        let Some(created) = lines.next().and_then(|v| v.parse::<u64>().ok()) else {
            continue;
        };
        if lines.next().is_some() || created == 0 || now.saturating_sub(created) < MAX_AGE {
            continue;
        }
        let _ = fs::remove_dir_all(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn abandoned_snapshots_are_removed_but_recent_and_unowned_folders_survive() {
        let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("hydra-expiry-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let old = root.join(uuid::Uuid::new_v4().to_string());
        let recent = root.join(uuid::Uuid::new_v4().to_string());
        let unowned = root.join(uuid::Uuid::new_v4().to_string());
        for path in [&old, &recent, &unowned] {
            fs::create_dir(path).unwrap();
            fs::write(path.join("data"), b"keep").unwrap();
        }
        mark(&old).unwrap();
        mark(&recent).unwrap();
        fs::write(
            old.join(MARKER),
            format!(
                "HARBOR-HYDRA-SNAPSHOT-1\n{}\n1",
                old.file_name().unwrap().to_str().unwrap()
            ),
        )
        .unwrap();
        expire_at(&root, now());
        assert!(!old.exists());
        assert_eq!(fs::read(recent.join("data")).unwrap(), b"keep");
        assert_eq!(fs::read(unowned.join("data")).unwrap(), b"keep");
        // A copied marker does not establish ownership of another UUID folder.
        fs::copy(recent.join(MARKER), unowned.join(MARKER)).unwrap();
        expire_at(&root, now() + MAX_AGE);
        assert!(!recent.exists());
        assert!(unowned.exists());
        fs::remove_dir_all(root).unwrap();
    }
}
