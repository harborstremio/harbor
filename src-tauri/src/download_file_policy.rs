use std::path::{Path, PathBuf};

pub fn inspect_download_file(path: &Path) -> Result<Option<(PathBuf, bool)>, String> {
    if !path.is_absolute() {
        return Err("Download paths must be absolute.".into());
    }
    let metadata = match std::fs::symlink_metadata(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not inspect the downloaded file: {error}")),
    };
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Could not resolve the downloaded file: {error}"))?;
    Ok(Some((
        canonical,
        metadata.is_file() && !metadata.file_type().is_symlink(),
    )))
}

pub fn same_file_path(left: &Path, right: &Path) -> bool {
    #[cfg(windows)]
    {
        left.to_string_lossy()
            .eq_ignore_ascii_case(&right.to_string_lossy())
    }
    #[cfg(not(windows))]
    {
        left == right
    }
}

pub fn remove_download_file(path: &Path, playing: Option<&Path>) -> Result<(), String> {
    let Some((canonical, is_file)) = inspect_download_file(path)? else {
        return Ok(());
    };
    if !is_file {
        return Err(
            "Only a regular downloaded file can be deleted. Folders and links are not deleted."
                .into(),
        );
    }
    if let Some(playing) = playing {
        if let Ok(active) = playing.canonicalize() {
            if same_file_path(&canonical, &active) {
                return Err("Stop playback before deleting this file.".into());
            }
        }
    }
    match std::fs::remove_file(&canonical) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not delete the downloaded file: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    static NEXT: AtomicUsize = AtomicUsize::new(0);

    struct Fixture(std::path::PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "harbor-context-file-test-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            std::fs::create_dir(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            std::fs::remove_dir_all(&self.0).unwrap();
        }
    }

    #[test]
    fn removes_only_the_explicit_regular_file_and_missing_is_idempotent() {
        let fixture = Fixture::new();
        let file = fixture.0.join("selected.mp4");
        let other = fixture.0.join("other.mp4");
        std::fs::write(&file, b"selected").unwrap();
        std::fs::write(&other, b"keep").unwrap();
        remove_download_file(&file, None).unwrap();
        remove_download_file(&file, None).unwrap();
        assert!(!file.exists());
        assert_eq!(std::fs::read(other).unwrap(), b"keep");
    }

    #[test]
    fn rejects_directory_and_current_playback_file() {
        let fixture = Fixture::new();
        let file = fixture.0.join("playing.mp4");
        std::fs::write(&file, b"keep").unwrap();
        assert!(remove_download_file(&fixture.0, None).is_err());
        assert!(remove_download_file(&file, Some(&file)).is_err());
        assert_eq!(std::fs::read(file).unwrap(), b"keep");
    }

    #[test]
    fn refuses_relative_paths_without_resolving_them_against_the_working_directory() {
        assert!(inspect_download_file(std::path::Path::new("movie.mp4")).is_err());
        assert!(remove_download_file(std::path::Path::new("movie.mp4"), None).is_err());
    }
}
