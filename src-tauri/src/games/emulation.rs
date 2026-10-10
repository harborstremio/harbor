use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Mutex, OnceLock},
    time::{Instant, SystemTime, UNIX_EPOCH},
};

type Result<T> = std::result::Result<T, &'static str>;
pub fn extensions(system: u32) -> &'static [&'static str] {
    match system {
        24 => &["gba"],
        33 => &["gb"],
        22 => &["gbc", "gb"],
        18 => &["nes", "fds"],
        19 => &["sfc", "smc"],
        4 => &["n64", "z64", "v64"],
        29 => &["gen", "md", "smd"],
        35 => &["gg"],
        64 => &["sms"],
        20 => &["nds"],
        38 => &["iso", "cso", "pbp"],
        21 => &["iso", "gcm", "rvz", "gcz", "ciso"],
        5 => &["iso", "wbfs", "rvz", "gcz", "ciso"],
        7 | 32 => &["cue", "chd", "pbp", "m3u"],
        23 => &["cdi", "gdi", "chd", "m3u"],
        _ => &[],
    }
}
fn ext(path: &Path) -> String {
    path.extension()
        .and_then(|v| v.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}
fn file_name(path: &Path) -> String {
    path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned()
}
fn canonical(path: &Path) -> Result<PathBuf> {
    path.canonicalize().map_err(|_| "emulation_missing_file")
}
fn text(path: &Path) -> Result<String> {
    let mut bytes = Vec::new();
    File::open(path)
        .map_err(|_| "emulation_read_failed")?
        .take(262_145)
        .read_to_end(&mut bytes)
        .map_err(|_| "emulation_read_failed")?;
    if bytes.len() > 262_144 {
        return Err("emulation_bad_manifest");
    }
    String::from_utf8(bytes).map_err(|_| "emulation_bad_manifest")
}
fn child_file(parent: &Path, value: &str, root: &Path) -> Result<PathBuf> {
    let path = Path::new(value.trim().trim_start_matches('\u{feff}'));
    if path.is_absolute() || value.contains("://") {
        return Err("emulation_bad_manifest");
    }
    let path = canonical(&parent.join(path))?;
    if !path.starts_with(root) || !path.is_file() {
        return Err("emulation_bad_manifest");
    }
    Ok(path)
}
fn references(
    path: &Path,
    root: &Path,
    depth: usize,
    visited: &mut HashSet<PathBuf>,
) -> Result<Vec<PathBuf>> {
    let kind = ext(path);
    if !["m3u", "cue", "gdi"].contains(&kind.as_str()) {
        return Ok(vec![]);
    }
    if depth > 4 || !visited.insert(path.to_path_buf()) {
        return Err("emulation_bad_manifest");
    }
    let content = text(path)?;
    let parent = path.parent().ok_or("emulation_bad_manifest")?;
    let mut files = Vec::new();
    for (index, line) in content.lines().enumerate() {
        let line = line.trim().trim_start_matches('\u{feff}');
        if line.is_empty() || line.starts_with('#') || (kind == "gdi" && index == 0) {
            continue;
        }
        let value = if kind == "m3u" {
            Some(line)
        } else if kind == "cue"
            && line
                .get(..5)
                .is_some_and(|v| v.eq_ignore_ascii_case("FILE "))
        {
            let rest = line[5..].trim_start();
            if let Some(rest) = rest.strip_prefix('"') {
                Some(rest.split_once('"').ok_or("emulation_bad_manifest")?.0)
            } else {
                rest.split_whitespace().next()
            }
        } else if kind == "gdi" {
            // GDI: track, LBA, type, sector size, filename, offset. Filenames may be quoted.
            let mut rest = line;
            for _ in 0..4 {
                rest = rest
                    .split_once(char::is_whitespace)
                    .ok_or("emulation_bad_manifest")?
                    .1
                    .trim_start();
            }
            if let Some(rest) = rest.strip_prefix('"') {
                Some(rest.split_once('"').ok_or("emulation_bad_manifest")?.0)
            } else {
                rest.split_whitespace().next()
            }
        } else {
            None
        };
        if let Some(value) = value {
            if files.len() >= 100 {
                return Err("emulation_bad_manifest");
            }
            let child = child_file(parent, value, root)?;
            if kind == "m3u" {
                files.extend(references(&child, root, depth + 1, visited)?);
            }
            files.push(child);
        }
    }
    if files.is_empty() {
        return Err("emulation_bad_manifest");
    }
    visited.remove(path);
    Ok(files)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalGame {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub system: u32,
    pub format: String,
    pub available: bool,
    pub issue: Option<&'static str>,
    pub discs: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RomScan {
    pub root: String,
    pub games: Vec<LocalGame>,
    pub skipped: usize,
    pub limited: bool,
}
pub fn scan_roms(root: String, system: u32) -> Result<RomScan> {
    if extensions(system).is_empty() {
        return Err("emulation_system");
    }
    let root = canonical(Path::new(&root))?;
    if !root.is_dir() {
        return Err("emulation_folder");
    }
    let mut folders = vec![(root.clone(), 0usize)];
    let mut files = Vec::new();
    let mut count = 0;
    let mut skipped = 0;
    let mut limited = false;
    while let Some((folder, depth)) = folders.pop() {
        if count >= 20_000 || files.len() >= 5000 {
            limited = true;
            break;
        }
        let entries = match fs::read_dir(&folder) {
            Ok(v) => v,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        for entry in entries {
            count += 1;
            if count > 20_000 || files.len() >= 5000 {
                limited = true;
                break;
            }
            let entry = match entry {
                Ok(v) => v,
                Err(_) => {
                    skipped += 1;
                    continue;
                }
            };
            let path = entry.path();
            let kind = match entry.file_type() {
                Ok(v) => v,
                Err(_) => {
                    skipped += 1;
                    continue;
                }
            };
            if kind.is_symlink() {
                continue;
            }
            if kind.is_dir() {
                if depth < 6 {
                    folders.push((path, depth + 1));
                } else {
                    limited = true;
                }
            } else if kind.is_file() && extensions(system).contains(&ext(&path).as_str()) {
                if let Ok(path) = path.canonicalize() {
                    if path.starts_with(&root) {
                        files.push(path);
                    }
                }
            }
        }
    }
    files.sort();
    files.dedup();
    let mut children = HashSet::new();
    let mut games = Vec::new();
    for path in &files {
        let related = references(path, &root, 0, &mut HashSet::new());
        let issue = related.as_ref().err().copied();
        let related = related.unwrap_or_default();
        if ext(path) == "m3u" {
            children.extend(related.iter().cloned());
        }
        let size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        games.push(LocalGame {
            path: path.to_string_lossy().into_owned(),
            name: path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .replace('_', " "),
            size_bytes: size,
            system,
            format: ext(path).to_uppercase(),
            available: issue.is_none() && size > 0,
            issue: issue.or((size == 0).then_some("emulation_empty_file")),
            discs: if ext(path) == "m3u" {
                related
                    .iter()
                    .filter(|p| extensions(system).contains(&ext(p).as_str()) && ext(p) != "m3u")
                    .count()
            } else {
                1
            },
        });
    }
    games.retain(|g| !children.contains(Path::new(&g.path)));
    Ok(RomScan {
        root: root.to_string_lossy().into_owned(),
        games,
        skipped,
        limited,
    })
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Emulator {
    pub kind: String,
    pub path: String,
    pub core_path: Option<String>,
}
fn names(kind: &str) -> &'static [&'static str] {
    match kind {
        "mgba" => &["mgba", "mgba-qt", "mgba-sdl"],
        "dolphin" => &["dolphin", "dolphin-emu"],
        "ppsspp" => &[
            "ppssppwindows64",
            "ppssppwindows",
            "ppssppsdl",
            "ppssppqt",
            "ppsspp",
        ],
        "retroarch" => &["retroarch"],
        _ => &[],
    }
}
fn supports(kind: &str, system: u32) -> bool {
    match kind {
        "mgba" => [24, 33, 22].contains(&system),
        "dolphin" => [21, 5].contains(&system),
        "ppsspp" => system == 38,
        "retroarch" => !extensions(system).is_empty(),
        _ => false,
    }
}
fn executable(input: &Path, kind: &str) -> Result<PathBuf> {
    if !input.is_absolute() {
        return Err("emulation_app_path");
    }
    let input = input.to_path_buf();
    #[cfg(target_os = "macos")]
    let input = if ext(&input) == "app" {
        let binary = match kind {
            "mgba" => "mGBA",
            "dolphin" => "Dolphin",
            "ppsspp" => "PPSSPPSDL",
            "retroarch" => "RetroArch",
            _ => return Err("emulation_app_type"),
        };
        input.join("Contents/MacOS").join(binary)
    } else {
        input
    };
    // Validate selected name before canonicalization so installed symlinks can resolve to versioned binaries.
    let stem = input
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_ascii_lowercase();
    if !names(kind).contains(&stem.as_str()) {
        return Err("emulation_app_type");
    }
    #[cfg(target_os = "windows")]
    if ext(&input) != "exe" {
        return Err("emulation_app_type");
    }
    let path = canonical(&input)?;
    if !path.is_file() {
        return Err("emulation_app_path");
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if fs::metadata(&path)
            .map_err(|_| "emulation_app_path")?
            .permissions()
            .mode()
            & 0o111
            == 0
        {
            return Err("emulation_app_path");
        }
    }
    Ok(input)
}
pub fn validate_emulator(value: Emulator) -> Result<Emulator> {
    let path = executable(Path::new(&value.path), &value.kind)?;
    let core_path = if value.kind == "retroarch" {
        value
            .core_path
            .map(|path| {
                let path = canonical(Path::new(&path))?;
                let expected = if cfg!(target_os = "windows") {
                    "dll"
                } else if cfg!(target_os = "macos") {
                    "dylib"
                } else {
                    "so"
                };
                if ext(&path) != expected
                    || !file_name(&path).to_ascii_lowercase().contains("_libretro.")
                    || !path.is_file()
                {
                    return Err("emulation_core_type");
                }
                Ok(path.to_string_lossy().into_owned())
            })
            .transpose()?
    } else {
        None
    };
    Ok(Emulator {
        kind: value.kind,
        path: path.to_string_lossy().into_owned(),
        core_path,
    })
}
pub fn discover() -> Vec<Emulator> {
    let mut folders = std::env::var_os("PATH")
        .map(|v| std::env::split_paths(&v).take(150).collect::<Vec<_>>())
        .unwrap_or_default();
    #[cfg(target_os = "windows")]
    for var in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
        if let Some(root) = std::env::var_os(var) {
            for folder in [
                "mGBA",
                "Dolphin",
                "Dolphin Emulator",
                "PPSSPP",
                "RetroArch",
                "Programs/mGBA",
                "Programs/RetroArch",
            ] {
                folders.push(PathBuf::from(&root).join(folder));
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        folders.push(PathBuf::from("/Applications"));
        if let Some(home) = std::env::var_os("HOME") {
            folders.push(PathBuf::from(home).join("Applications"));
        }
    }
    #[cfg(target_os = "linux")]
    {
        for folder in ["/usr/bin", "/usr/local/bin", "/opt/retroarch", "/opt/mgba"] {
            folders.push(PathBuf::from(folder));
        }
    }
    if let Some(root) = super::steam_paths::find_root() {
        for game in super::steam_scan::scan(&root).apps {
            if [1118310, 1941680].contains(&game.app_id) {
                folders.push(PathBuf::from(game.install_path));
            }
        }
    }
    let mut found = Vec::new();
    let mut seen = HashSet::new();
    for kind in ["mgba", "dolphin", "ppsspp", "retroarch"] {
        for folder in &folders {
            for name in names(kind) {
                let name = if cfg!(target_os = "windows") {
                    format!("{name}.exe")
                } else {
                    name.to_string()
                };
                #[cfg(target_os = "macos")]
                let candidates = vec![
                    folder.join(name),
                    folder.join(match kind {
                        "mgba" => "mGBA.app",
                        "dolphin" => "Dolphin.app",
                        "ppsspp" => "PPSSPP.app",
                        _ => "RetroArch.app",
                    }),
                ];
                #[cfg(not(target_os = "macos"))]
                let candidates = vec![folder.join(name)];
                for candidate in candidates {
                    if let Ok(path) = executable(&candidate, kind) {
                        if seen.insert(path.clone()) {
                            found.push(Emulator {
                                kind: kind.into(),
                                path: path.to_string_lossy().into_owned(),
                                core_path: None,
                            });
                        }
                    }
                }
            }
        }
    }
    found
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningGame {
    pub path: String,
    pub pid: u32,
    pub started_at: u64,
    pub system: u32,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameExit {
    pub path: String,
    pub pid: u32,
    pub seconds: u64,
    pub success: bool,
}
fn processes() -> &'static Mutex<HashMap<PathBuf, RunningGame>> {
    static VALUE: OnceLock<Mutex<HashMap<PathBuf, RunningGame>>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(HashMap::new()))
}
pub fn running() -> Vec<RunningGame> {
    processes()
        .lock()
        .map(|m| m.values().cloned().collect())
        .unwrap_or_default()
}
fn launch_args(emulator: &Emulator, game: &Path, system: u32) -> Result<Vec<String>> {
    if !supports(&emulator.kind, system) {
        return Err("emulation_incompatible");
    }
    let mut args = match emulator.kind.as_str() {
        "dolphin" => vec!["--batch".into(), "--exec".into()],
        "retroarch" => vec![
            "-L".into(),
            emulator.core_path.clone().ok_or("emulation_core_missing")?,
        ],
        _ => vec![],
    };
    // mGBA's Windows SDL frontend stalls on canonical backslash paths. Translate
    // only its argument; filesystem validation and process identity stay canonical.
    let game_arg = if cfg!(target_os = "windows")
        && emulator.kind == "mgba"
        && Path::new(&emulator.path)
            .file_stem()
            .is_some_and(|name| name.to_string_lossy().eq_ignore_ascii_case("mgba-sdl"))
    {
        let path = dunce::simplified(game).to_string_lossy();
        if path.starts_with(r"\\?\") {
            path.into_owned()
        } else {
            path.replace('\\', "/")
        }
    } else {
        game.to_string_lossy().into_owned()
    };
    args.push(game_arg);
    Ok(args)
}
pub fn launch(
    value: Emulator,
    game_path: String,
    root: String,
    system: u32,
    finished: impl FnOnce(GameExit) + Send + 'static,
) -> Result<RunningGame> {
    let game = canonical(Path::new(&game_path))?;
    let root = canonical(Path::new(&root))?;
    if !root.is_dir()
        || !game.starts_with(&root)
        || !game.is_file()
        || !extensions(system).contains(&ext(&game).as_str())
    {
        return Err("emulation_game_type");
    }
    if fs::metadata(&game)
        .map_err(|_| "emulation_read_failed")?
        .len()
        == 0
    {
        return Err("emulation_empty_file");
    }
    references(&game, &root, 0, &mut HashSet::new())?;
    let emulator = validate_emulator(value)?;
    let args = launch_args(&emulator, &game, system)?;
    let mut held = processes().lock().map_err(|_| "emulation_busy")?;
    if held.contains_key(&game) {
        return Err("emulation_already_running");
    }
    let mut command = Command::new(&emulator.path);
    command
        .args(args)
        .current_dir(
            Path::new(&emulator.path)
                .parent()
                .ok_or("emulation_app_path")?,
        )
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|_| "emulation_launch_failed")?;
    let record = RunningGame {
        path: game.to_string_lossy().into_owned(),
        pid: child.id(),
        started_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        system,
    };
    held.insert(game.clone(), record.clone());
    drop(held);
    let pid = record.pid;
    std::thread::spawn(move || {
        let start = Instant::now();
        let success = child.wait().is_ok_and(|s| s.success());
        if let Ok(mut held) = processes().lock() {
            held.remove(&game);
        }
        finished(GameExit {
            path: game.to_string_lossy().into_owned(),
            pid,
            seconds: start.elapsed().as_secs(),
            success,
        });
    });
    Ok(record)
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
                .map(PathBuf::from)
                .unwrap_or_else(std::env::temp_dir)
                .join(format!("roms-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&root).unwrap();
            Self(root)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    #[test]
    fn scans_recursive_games_without_patches_or_empty_files() {
        let f = Fixture::new();
        fs::create_dir(f.0.join("sub")).unwrap();
        fs::write(f.0.join("sub/My_game.gba"), b"game").unwrap();
        fs::write(f.0.join("patch.ips"), b"PATCH").unwrap();
        fs::write(f.0.join("empty.gba"), b"").unwrap();
        let result = scan_roms(f.0.to_string_lossy().into_owned(), 24).unwrap();
        assert_eq!(result.games.len(), 2);
        assert!(result
            .games
            .iter()
            .any(|g| g.name == "My game" && g.available));
        assert!(result
            .games
            .iter()
            .any(|g| !g.available && g.issue == Some("emulation_empty_file")));
    }
    #[test]
    fn multidisc_manifest_groups_children_and_validates_tracks() {
        let f = Fixture::new();
        fs::write(f.0.join("disc 1.bin"), b"track").unwrap();
        fs::write(
            f.0.join("disc 1.cue"),
            b"FILE \"disc 1.bin\" BINARY\n TRACK 01 MODE2/2352",
        )
        .unwrap();
        fs::write(f.0.join("disc 2.chd"), b"data").unwrap();
        fs::write(
            f.0.join("Adventure.m3u"),
            b"# discs\ndisc 1.cue\ndisc 2.chd",
        )
        .unwrap();
        let result = scan_roms(f.0.to_string_lossy().into_owned(), 7).unwrap();
        assert_eq!(result.games.len(), 1);
        assert_eq!(result.games[0].discs, 2);
        assert!(result.games[0].available);
        fs::remove_file(f.0.join("disc 1.bin")).unwrap();
        let broken = scan_roms(f.0.to_string_lossy().into_owned(), 7).unwrap();
        assert!(broken
            .games
            .iter()
            .any(|g| g.name == "Adventure" && !g.available));
    }
    #[test]
    fn rejects_remote_recursive_or_outside_manifests() {
        let f = Fixture::new();
        for value in ["https://example.org/game.chd", "loop.m3u", "../outside.chd"] {
            fs::write(f.0.join("loop.m3u"), value).unwrap();
            assert!(references(&f.0.join("loop.m3u"), &f.0, 0, &mut HashSet::new()).is_err());
        }
    }
    #[test]
    fn arguments_preserve_paths_and_require_core_or_matching_system() {
        let app = Emulator {
            kind: "dolphin".into(),
            path: "Dolphin.exe".into(),
            core_path: None,
        };
        let path = Path::new("C:/ROMs/name & more.iso");
        assert_eq!(
            launch_args(&app, path, 21).unwrap(),
            vec!["--batch", "--exec", "C:/ROMs/name & more.iso"]
        );
        assert_eq!(
            launch_args(&app, path, 24).err(),
            Some("emulation_incompatible")
        );
        let app = Emulator {
            kind: "retroarch".into(),
            path: "retroarch.exe".into(),
            core_path: None,
        };
        assert_eq!(
            launch_args(&app, path, 7).err(),
            Some("emulation_core_missing")
        );
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn mgba_sdl_receives_compatible_windows_paths_without_changing_other_players() {
        let mut app = Emulator {
            kind: "mgba".into(),
            path: "W:/Emulators/mgba-sdl.exe".into(),
            core_path: None,
        };
        let game = Path::new(r"\\?\W:\ROMs\Pocket & 日本.gba");
        assert_eq!(launch_args(&app, game, 24).unwrap(), vec!["W:/ROMs/Pocket & 日本.gba"]);
        app.path = "W:/Emulators/mGBA.exe".into();
        assert_eq!(launch_args(&app, game, 24).unwrap(), vec![game.to_string_lossy()]);
    }
}
