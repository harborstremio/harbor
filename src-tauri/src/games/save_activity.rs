//! In-process ownership shared by the embedded player and reviewed save writers.
use std::{collections::HashSet, path::Path, sync::{Mutex, OnceLock}};

fn held() -> &'static Mutex<HashSet<String>> {
    static PATHS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    PATHS.get_or_init(|| Mutex::new(HashSet::new()))
}
pub struct Lease(String);
impl Drop for Lease {
    fn drop(&mut self) {
        if let Ok(mut paths) = held().lock() { paths.remove(&self.0); }
    }
}
pub fn acquire(path: &Path) -> Result<Lease, ()> {
    // A game's first save may not exist yet. Resolve its existing parent so a
    // junction and its physical path still refer to the same reserved file.
    let resolved = if path.exists() { path.canonicalize().map_err(|_| ())? } else {
        path.parent().ok_or(())?.canonicalize().map_err(|_| ())?.join(path.file_name().ok_or(())?)
    };
    let key = resolved.to_string_lossy().into_owned();
    #[cfg(windows)]
    let key = key.to_lowercase();
    if !held().lock().map_err(|_| ())?.insert(key.clone()) { return Err(()); }
    Ok(Lease(key))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn save_owner_excludes_other_writers_and_releases_on_drop() {
        let dir = std::env::temp_dir();
        let path = dir.join(format!("harbor-save-lease-{}", uuid::Uuid::new_v4()));
        let game = acquire(&path).unwrap();
        assert!(acquire(&path).is_err());
        let other = acquire(&dir.join(format!("harbor-save-lease-{}", uuid::Uuid::new_v4()))).unwrap();
        drop(game);
        assert!(acquire(&path).is_ok());
        drop(other);
    }
}
