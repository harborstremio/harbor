//! Read-only local Steam discovery. No directory traversal, installer execution or network calls.

#[path = "vdf.rs"]
mod vdf;

use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone)]
pub struct InstalledApp {
    pub app_id: u32,
    pub name: String,
    pub install_path: String,
    pub library_path: String,
    pub size_bytes: u64,
    pub last_played: u64,
    pub state: &'static str,
    pub update: &'static str,
    pub bytes_to_download: u64,
    pub bytes_downloaded: u64,
    pub artwork: CachedArtwork,
}

/// Steam's EAppState bitfield. A fully installed app can still carry a pending update,
/// which is why the update lane is reported separately from the install state.
fn update_state(flags: u64) -> &'static str {
    const UPDATE_REQUIRED: u64 = 2;
    const FILES_MISSING: u64 = 32;
    const FILES_CORRUPT: u64 = 128;
    const UPDATE_RUNNING: u64 = 256;
    const UPDATE_PAUSED: u64 = 512;
    const UPDATE_STARTED: u64 = 1024;
    const UNINSTALLING: u64 = 2048;
    const VALIDATING: u64 = 131_072;
    const ADDING_FILES: u64 = 262_144;
    const PREALLOCATING: u64 = 524_288;
    const DOWNLOADING: u64 = 1_048_576;
    const STAGING: u64 = 2_097_152;
    const COMMITTING: u64 = 4_194_304;
    let active =
        DOWNLOADING | UPDATE_RUNNING | ADDING_FILES | PREALLOCATING | STAGING | COMMITTING;
    if flags & UNINSTALLING != 0 {
        "uninstalling"
    } else if flags & VALIDATING != 0 {
        "validating"
    } else if flags & active != 0 {
        "downloading"
    } else if flags & UPDATE_PAUSED != 0 {
        "paused"
    } else if flags & (FILES_CORRUPT | FILES_MISSING) != 0 {
        "repair"
    } else if flags & (UPDATE_REQUIRED | UPDATE_STARTED) != 0 {
        "queued"
    } else {
        "none"
    }
}

#[derive(Debug, Clone, Default)]
pub struct CachedArtwork {
    pub capsule: Option<String>,
    pub portrait: Option<String>,
    pub library_hero: Option<String>,
    pub logo: Option<String>,
}

#[derive(Debug)]
pub struct Library {
    pub path: String,
    pub available: bool,
    pub app_count: usize,
}

#[derive(Debug, Default)]
pub struct Scan {
    pub steam_root: Option<String>,
    pub libraries: Vec<Library>,
    pub apps: Vec<InstalledApp>,
    pub warnings: Vec<&'static str>,
}

fn read_manifest(path: &Path) -> Result<vdf::Value, &'static str> {
    let metadata = fs::metadata(path).map_err(|_| "manifest_unreadable")?;
    if metadata.len() > 4 * 1024 * 1024 {
        return Err("manifest_too_large");
    }
    let text = fs::read_to_string(path).map_err(|_| "manifest_unreadable")?;
    vdf::parse(&text)
}

fn path_key(path: &Path) -> String {
    let value = path.to_string_lossy().into_owned();
    if cfg!(windows) {
        value.to_lowercase()
    } else {
        value
    }
}

pub fn scan(root: &Path) -> Scan {
    let mut result = Scan {
        steam_root: Some(root.to_string_lossy().into_owned()),
        ..Scan::default()
    };
    let mut candidates = vec![root.to_path_buf()];
    let folder_file = root.join("steamapps/libraryfolders.vdf");
    if folder_file.exists() {
        match read_manifest(&folder_file) {
            Ok(value) => {
                if let Some(entries) = value.get("libraryfolders").and_then(vdf::Value::entries) {
                    for (index, library) in entries {
                        if index.parse::<u32>().is_err() {
                            continue;
                        }
                        if let Some(path) = library
                            .get("path")
                            .or(Some(library))
                            .and_then(vdf::Value::text)
                        {
                            let path = PathBuf::from(path);
                            if path.is_absolute() {
                                candidates.push(path);
                            }
                        }
                    }
                } else {
                    result.warnings.push("library_list_invalid");
                }
            }
            Err(_) => result.warnings.push("library_list_unreadable"),
        }
    }
    let mut visited = HashSet::new();
    let mut apps = BTreeMap::<u32, InstalledApp>::new();
    for library in candidates {
        // Canonicalize existing paths to deduplicate junctions without requiring offline drives.
        let library = fs::canonicalize(&library).unwrap_or(library);
        if !visited.insert(path_key(&library)) {
            continue;
        }
        let steamapps = library.join("steamapps");
        let mut count = 0;
        let entries = match fs::read_dir(&steamapps) {
            Ok(entries) => entries,
            Err(_) => {
                result.libraries.push(Library {
                    path: library.to_string_lossy().into_owned(),
                    available: false,
                    app_count: 0,
                });
                result.warnings.push("library_unavailable");
                continue;
            }
        };
        for (index, entry) in entries.enumerate() {
            if index >= 10_000 {
                result.warnings.push("library_scan_limit");
                break;
            }
            let entry = match entry {
                Ok(entry) => entry,
                Err(_) => {
                    result.warnings.push("manifest_skipped");
                    continue;
                }
            };
            let name = entry.file_name();
            let Some(id) = name
                .to_str()
                .and_then(|name| name.strip_prefix("appmanifest_"))
                .and_then(|name| name.strip_suffix(".acf"))
                .and_then(|id| id.parse::<u32>().ok())
                .filter(|id| *id > 0)
            else {
                continue;
            };
            match read_app(&entry.path(), &library, id) {
                Ok(Some(mut app)) => {
                    app.artwork = cached_artwork(root, app.app_id);
                    count += 1;
                    match apps.get(&id) {
                        Some(previous)
                            if previous.state == "installed"
                                || (app.state != "installed"
                                    && previous.last_played >= app.last_played) => {}
                        _ => {
                            apps.insert(id, app);
                        }
                    }
                }
                Ok(None) => {}
                Err(_) => result.warnings.push("manifest_skipped"),
            }
        }
        result.libraries.push(Library {
            path: library.to_string_lossy().into_owned(),
            available: true,
            app_count: count,
        });
    }
    result.apps = apps.into_values().collect();
    result.apps.sort_by(|a, b| {
        b.last_played
            .cmp(&a.last_played)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    result.warnings.sort_unstable();
    result.warnings.dedup();
    result
}

fn read_app(
    manifest: &Path,
    library: &Path,
    expected_id: u32,
) -> Result<Option<InstalledApp>, &'static str> {
    let value = read_manifest(manifest)?;
    let app = value.get("AppState").ok_or("missing_app_state")?;
    let field = |key| app.get(key).and_then(vdf::Value::text);
    let app_id = field("appid")
        .and_then(|value| value.parse::<u32>().ok())
        .ok_or("invalid_app_id")?;
    if app_id == 0 || app_id != expected_id {
        return Err("app_id_mismatch");
    }
    let name = field("name")
        .filter(|name| !name.trim().is_empty())
        .ok_or("missing_name")?;
    // Steam support tools are manifests too, but are not user-launchable games.
    if app_id == 228980
        || name.starts_with("Steamworks Common Redistributables")
        || name.starts_with("Steam Linux Runtime")
        || name.starts_with("Proton ")
    {
        return Ok(None);
    }
    let directory = Path::new(field("installdir").ok_or("missing_install_directory")?);
    let mut components = directory.components();
    if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
        return Err("invalid_install_directory");
    }
    let common = library.join("steamapps/common");
    let path = common.join(directory);
    let exists = path.is_dir();
    if exists {
        let canonical = fs::canonicalize(&path).map_err(|_| "install_unreadable")?;
        let base = fs::canonicalize(&common).map_err(|_| "library_unreadable")?;
        if !canonical.starts_with(base) {
            return Err("install_outside_library");
        }
    }
    let flags = field("StateFlags")
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0);
    let state = if !exists {
        "missing"
    } else if flags & 4 != 0 {
        "installed"
    } else {
        "updating"
    };
    Ok(Some(InstalledApp {
        app_id,
        name: name.to_owned(),
        install_path: path.to_string_lossy().into_owned(),
        library_path: library.to_string_lossy().into_owned(),
        size_bytes: field("SizeOnDisk")
            .and_then(|value| value.parse().ok())
            .unwrap_or(0),
        last_played: field("LastPlayed")
            .and_then(|value| value.parse().ok())
            .unwrap_or(0),
        state,
        update: update_state(flags),
        bytes_to_download: field("BytesToDownload")
            .and_then(|value| value.parse().ok())
            .unwrap_or(0),
        bytes_downloaded: field("BytesDownloaded")
            .and_then(|value| value.parse().ok())
            .unwrap_or(0),
        artwork: CachedArtwork::default(),
    }))
}

fn cached_artwork(root: &Path, id: u32) -> CachedArtwork {
    let cache = root.join("appcache/librarycache");
    let Ok(canonical_cache) = fs::canonicalize(&cache) else {
        return CachedArtwork::default();
    };
    let app = cache.join(id.to_string());
    let mut directories = vec![app.clone()];
    if let Ok(entries) = fs::read_dir(&app) {
        // Current Steam assets are nested under content hashes. Only inspect this one level.
        for entry in entries.flatten().take(64) {
            let name = entry.file_name();
            if name.to_str().is_some_and(|name| {
                name.len() == 40 && name.bytes().all(|byte| byte.is_ascii_hexdigit())
            }) && entry.path().is_dir()
            {
                directories.push(entry.path());
            }
        }
    }
    let find = |names: &[&str]| {
        let mut choices = Vec::new();
        for name in names {
            for path in directories
                .iter()
                .map(|directory| directory.join(name))
                .chain(Some(cache.join(format!("{id}_{name}"))))
            {
                let Ok(metadata) = fs::metadata(&path) else {
                    continue;
                };
                if !metadata.is_file() || metadata.len() == 0 || metadata.len() > 16 * 1024 * 1024 {
                    continue;
                }
                let Ok(canonical) = fs::canonicalize(&path) else {
                    continue;
                };
                if canonical.starts_with(&canonical_cache) {
                    choices.push((metadata.modified().ok(), canonical));
                }
            }
        }
        choices.sort_by(|a, b| b.0.cmp(&a.0));
        choices
            .into_iter()
            .next()
            .map(|(_, path)| path.to_string_lossy().into_owned())
    };
    CachedArtwork {
        capsule: find(&["header.jpg", "library_header.jpg"]),
        portrait: find(&["library_600x900.jpg", "library_capsule.jpg"]),
        library_hero: find(&["library_hero.jpg"]),
        logo: find(&["logo.png", "logo_2x.png"]),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let parent = std::env::var_os("HARBOR_GAME_TEST_ROOT")
                .map(PathBuf::from)
                .unwrap_or_else(std::env::temp_dir);
            let root = parent.join(format!(
                "harbor-steam-fixture-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir_all(root.join("steamapps/common")).unwrap();
            Self(root)
        }
        fn app(&self, id: u32, name: &str, directory: &str, flags: u32, exists: bool) {
            fs::write(self.0.join(format!("steamapps/appmanifest_{id}.acf")), format!(r#""AppState" {{ "appid" "{id}" "name" "{name}" "installdir" "{directory}" "StateFlags" "{flags}" "SizeOnDisk" "123456" "LastPlayed" "42" }}"#)).unwrap();
            if exists {
                fs::create_dir_all(self.0.join("steamapps/common").join(directory)).unwrap();
            }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn uses_local_art_for_delisted_games_without_network_requests() {
        let root = Fixture::new();
        root.app(10, "Delisted", "Delisted", 4, true);
        let art = root
            .0
            .join("appcache/librarycache/10/0123456789abcdef0123456789abcdef01234567");
        fs::create_dir_all(&art).unwrap();
        fs::write(art.join("library_hero.jpg"), [0xff, 0xd8, 0xff]).unwrap();
        fs::write(
            root.0.join("appcache/librarycache/10_library_600x900.jpg"),
            [0xff, 0xd8, 0xff],
        )
        .unwrap();
        let scan = scan(&root.0);
        assert!(scan.apps[0]
            .artwork
            .library_hero
            .as_ref()
            .is_some_and(|path| path.ends_with("library_hero.jpg")));
        assert!(scan.apps[0]
            .artwork
            .portrait
            .as_ref()
            .is_some_and(|path| path.ends_with("10_library_600x900.jpg")));
        assert!(scan.apps[0].artwork.logo.is_none());
    }

    #[test]
    fn reads_real_install_state_without_modifying_manifests() {
        let root = Fixture::new();
        root.app(10, "Ready game", "Ready", 4, true);
        root.app(20, "Updating game", "Updating", 1026, true);
        root.app(30, "Moved game", "Moved", 4, false);
        root.app(
            228980,
            "Steamworks Common Redistributables",
            "Steamworks Shared",
            4,
            true,
        );
        let result = scan(&root.0);
        assert_eq!(result.apps.len(), 3);
        assert_eq!(
            result
                .apps
                .iter()
                .find(|app| app.app_id == 10)
                .unwrap()
                .state,
            "installed"
        );
        assert_eq!(
            result
                .apps
                .iter()
                .find(|app| app.app_id == 20)
                .unwrap()
                .state,
            "updating"
        );
        assert_eq!(
            result
                .apps
                .iter()
                .find(|app| app.app_id == 30)
                .unwrap()
                .state,
            "missing"
        );
        assert!(result.warnings.is_empty());
        assert_eq!(result.apps[0].size_bytes, 123456);
    }

    #[test]
    fn detects_secondary_offline_and_duplicate_libraries() {
        let root = Fixture::new();
        let secondary = Fixture::new();
        root.app(10, "Old copy", "Old", 4, false);
        secondary.app(10, "Good copy", "Good", 4, true);
        secondary.app(20, "Other", "Other", 4, true);
        let escape = |path: &Path| path.to_string_lossy().replace('\\', "\\\\");
        fs::write(root.0.join("steamapps/libraryfolders.vdf"), format!(r#""libraryfolders" {{ "0" {{ "path" "{}" }} "1" {{ "path" "{}" }} "2" "{}" "3" "{}" }}"#, escape(&root.0), escape(&secondary.0), escape(&secondary.0), escape(&root.0.join("offline")))).unwrap();
        let result = scan(&root.0);
        assert_eq!(result.apps.len(), 2);
        assert_eq!(
            result
                .apps
                .iter()
                .find(|app| app.app_id == 10)
                .unwrap()
                .name,
            "Good copy"
        );
        assert_eq!(result.libraries.len(), 3);
        assert_eq!(
            result
                .libraries
                .iter()
                .filter(|library| !library.available)
                .count(),
            1
        );
        assert!(result.warnings.contains(&"library_unavailable"));
    }

    #[test]
    fn update_flags_separate_a_queued_update_from_an_active_download() {
        // A fully installed app that also needs an update is playable and queued at once.
        assert_eq!(update_state(4 | 2), "queued");
        assert_eq!(update_state(4), "none");
        assert_eq!(update_state(0), "none");
        assert_eq!(update_state(4 | 2 | 1_048_576), "downloading");
        assert_eq!(update_state(4 | 2 | 256), "downloading");
        assert_eq!(update_state(4 | 2 | 2_097_152), "downloading");
        assert_eq!(update_state(4 | 2 | 512), "paused");
        assert_eq!(update_state(4 | 131_072), "validating");
        assert_eq!(update_state(4 | 128), "repair");
        assert_eq!(update_state(4 | 32), "repair");
        assert_eq!(update_state(4 | 2_048), "uninstalling");
        // An active download outranks the queue flag that always accompanies it.
        assert_eq!(update_state(2 | 512 | 1_048_576), "downloading");
        // A running game is not an update lane.
        assert_eq!(update_state(4 | 64), "none");
    }

    #[test]
    fn skips_corrupt_identity_and_traversal_but_keeps_valid_games() {
        let root = Fixture::new();
        root.app(10, "Good", "Good", 4, true);
        root.app(20, "Escape", "../escape", 4, false);
        fs::write(
            root.0.join("steamapps/appmanifest_30.acf"),
            r#""AppState" { "appid" "999" "name" "Wrong" "installdir" "Wrong" }"#,
        )
        .unwrap();
        fs::write(
            root.0.join("steamapps/appmanifest_40.acf"),
            "AppState { truncated",
        )
        .unwrap();
        let result = scan(&root.0);
        assert_eq!(result.apps.len(), 1);
        assert_eq!(result.apps[0].app_id, 10);
        assert_eq!(result.warnings, vec!["manifest_skipped"]);
    }
}
