use std::path::{Path, PathBuf};

pub(crate) fn cache_dir(default_base: &Path, custom_base: Option<&str>) -> Result<PathBuf, String> {
    match custom_base.map(str::trim).filter(|s| !s.is_empty()) {
        Some(custom) => {
            let base = Path::new(custom);
            if !base.is_absolute() {
                return Err("Playback cache folder must be an absolute path".into());
            }
            Ok(base.join("harbor-playback-cache"))
        }
        None => Ok(default_base.join("mpv-cache")),
    }
}

pub(crate) fn prepare_dir(dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("Cannot create playback cache folder: {e}"))?;
    // An unavailable custom drive must not silently send a large remux back to
    // the system drive. Probe before creating the native playback surface.
    let probe = dir.join(format!(".harbor-write-check-{}", uuid::Uuid::new_v4()));
    let file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
        .map_err(|e| format!("Cannot write to playback cache folder: {e}"))?;
    drop(file);
    std::fs::remove_file(probe)
        .map_err(|e| format!("Cannot clean up playback cache write check: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_preserves_existing_cache_location() {
        let base = std::env::temp_dir();
        for custom in [None, Some(""), Some("   ")] {
            assert_eq!(cache_dir(&base, custom).unwrap(), base.join("mpv-cache"));
        }
    }

    #[test]
    fn custom_folder_is_isolated_from_p2p_and_other_files() {
        let custom = std::env::temp_dir().join("custom-cache-root");
        assert_eq!(
            cache_dir(Path::new("unused"), custom.to_str()).unwrap(),
            custom.join("harbor-playback-cache")
        );
        assert!(cache_dir(Path::new("unused"), Some("relative-folder")).is_err());
    }

    #[test]
    fn an_unusable_custom_folder_fails_without_falling_back() {
        let file = std::env::temp_dir().join(format!("harbor-cache-test-{}", uuid::Uuid::new_v4()));
        std::fs::write(&file, "keep").unwrap();
        let dir = cache_dir(Path::new("unused"), file.to_str()).unwrap();
        assert!(prepare_dir(&dir).is_err());
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "keep");
        std::fs::remove_file(file).unwrap();
    }
}
