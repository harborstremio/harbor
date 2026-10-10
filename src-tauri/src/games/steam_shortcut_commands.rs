use super::{
    custom_launch, setup, steam_paths, steam_shortcut_art::Grid, steam_shortcut_icons,
    steam_shortcut_launch, steam_shortcuts,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::PathBuf};
use tauri::Emitter;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    id: String,
    account_id: u32,
    app_id: Option<u32>,
    run_game_id: Option<String>,
    name: String,
    executable: String,
    start_directory: String,
    launch_options: String,
    last_played: u32,
    hidden: bool,
    tags: Vec<String>,
    state: &'static str,
    artwork: Artwork,
    icon_key: Option<String>,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Artwork {
    capsule: Option<String>,
    portrait: Option<String>,
    hero: Option<String>,
    icon: Option<String>,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    steam_found: bool,
    active_account_id: Option<u32>,
    accounts: Vec<u32>,
    games: Vec<Game>,
    warnings: Vec<&'static str>,
    direct_launch: bool,
}

fn location(configured: Option<&str>) -> Result<Option<PathBuf>, &'static str> {
    let Some(value) = configured.filter(|v| !v.is_empty()) else {
        return Ok(steam_paths::find_root());
    };
    let path = PathBuf::from(value);
    if value.len() > 4096
        || value.chars().any(char::is_control)
        || !path.is_absolute()
        || !path.is_dir()
    {
        return Err("shortcut_location");
    }
    // The picker accepts either the Steam folder or its userdata folder.
    let root = if path.file_name().is_some_and(|name| name == "userdata") {
        path.parent().ok_or("shortcut_location")?.to_path_buf()
    } else {
        path
    };
    if !root.join("userdata").is_dir() {
        return Err("shortcut_location");
    }
    Ok(Some(root))
}

fn image(path: PathBuf) -> Option<String> {
    custom_launch::artwork(path.to_string_lossy().into_owned()).ok()
}

fn artwork(grid: &Grid, game: &steam_shortcuts::Shortcut) -> Artwork {
    let candidate = |suffix: &str| {
        grid.candidates(game.steam_app_id()?, game.run_game_id()?, suffix)
            .into_iter()
            .find_map(image)
    };
    let icon = game.icon.trim().trim_matches('"');
    let icon = icon
        .rsplit_once(',')
        .filter(|(_, index)| index.parse::<i32>().is_ok())
        .map_or(icon, |(path, _)| path)
        .trim_matches('"');
    Artwork {
        capsule: candidate(""),
        portrait: candidate("p"),
        hero: candidate("_hero"),
        icon: image(PathBuf::from(icon)).or_else(|| candidate("_icon")),
    }
}

pub fn active_account() -> Option<u32> {
    #[cfg(windows)]
    {
        use windows::{
            core::PCWSTR,
            Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD},
        };
        let key: Vec<u16> = "Software\\Valve\\Steam\\ActiveProcess\0"
            .encode_utf16()
            .collect();
        let name: Vec<u16> = "ActiveUser\0".encode_utf16().collect();
        let mut account = 0_u32;
        let mut size = 4_u32;
        if unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                PCWSTR(key.as_ptr()),
                PCWSTR(name.as_ptr()),
                RRF_RT_REG_DWORD,
                None,
                Some((&mut account as *mut u32).cast()),
                Some(&mut size),
            )
        }
        .is_ok()
            && account != 0
        {
            return Some(account);
        }
    }
    None
}

pub fn snapshot(configured: Option<String>) -> Result<Snapshot, &'static str> {
    let Some(root) = location(configured.as_deref())? else {
        return Ok(Snapshot::default());
    };
    let scan = steam_shortcuts::scan(&root);
    let active = active_account();
    let default_root = steam_paths::find_root().and_then(|path| path.canonicalize().ok());
    let same_root = default_root.is_some() && default_root == root.canonicalize().ok();
    let mut accounts: Vec<u32> = scan.shortcuts.iter().map(|game| game.account_id).collect();
    accounts.sort_unstable();
    accounts.dedup();
    let mut grids = HashMap::new();
    let games = scan
        .shortcuts
        .into_iter()
        .map(|game| {
            let found = game.executable_path().is_some_and(|path| {
                path.is_file()
                    || cfg!(target_os = "macos")
                        && path.extension().is_some_and(|ext| ext == "app")
                        && path.is_dir()
            });
            let grid = grids
                .entry(game.account_id)
                .or_insert_with(|| Grid::read(&root, game.account_id));
            let artwork = artwork(grid, &game);
            let icon_key = artwork
                .icon
                .is_none()
                .then(|| steam_shortcut_icons::key(&game));
            Game {
                id: game.id(),
                run_game_id: game.run_game_id().map(|id| id.to_string()),
                account_id: game.account_id,
                app_id: game.steam_app_id(),
                state: if !found {
                    "missing"
                } else if game.steam_app_id().is_none() {
                    "local"
                } else if !same_root || active != Some(game.account_id) {
                    "account"
                } else {
                    "ready"
                },
                name: game.name,
                executable: game.executable,
                start_directory: game.start_directory,
                launch_options: game.launch_options,
                hidden: game.hidden,
                last_played: game.last_played,
                tags: game.tags,
                artwork,
                icon_key,
            }
        })
        .collect();
    Ok(Snapshot {
        direct_launch: true,
        steam_found: true,
        active_account_id: active,
        accounts,
        games,
        warnings: scan.warnings.into_iter().collect(),
    })
}

#[tauri::command]
pub async fn games_launch_steam_shortcut_direct(
    app: tauri::AppHandle,
    profile: String,
    root: Option<String>,
    account_id: u32,
    app_id: Option<u32>,
    shortcut_id: Option<String>,
    reviewed: steam_shortcut_launch::Review,
) -> Result<steam_shortcut_launch::Process, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = location(root.as_deref())?.ok_or("shortcut_location")?;
        let id = steam_shortcuts::request_id(account_id, app_id, shortcut_id.as_deref())?;
        steam_shortcut_launch::launch(profile, &root, account_id, &id, reviewed, move |event| {
            let _ = app.emit("games:shortcut-exit", event);
        })
    })
    .await
    .map_err(|_| "launch_failed")?
    .map_err(String::from)
}

#[tauri::command]
pub async fn games_steam_shortcut_running(
    profile: String,
    root: Option<String>,
) -> Result<Vec<steam_shortcut_launch::Process>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(root) = location(root.as_deref())? else {
            return Ok(Vec::new());
        };
        steam_shortcut_launch::running(&profile, &root)
    })
    .await
    .map_err(|_| "launch_failed")?
    .map_err(String::from)
}

pub fn prepare_launch(
    configured: Option<&str>,
    account_id: u32,
    app_id: u32,
) -> Result<String, &'static str> {
    let root = location(configured)?.ok_or("shortcut_location")?;
    let current = steam_paths::find_root().ok_or("shortcut_location")?;
    let actual = fs::canonicalize(&current).map_err(|_| "shortcut_location")?;
    let selected = fs::canonicalize(&root).map_err(|_| "shortcut_location")?;
    if active_account() != Some(account_id) || selected != actual {
        return Err("shortcut_account");
    }
    steam_shortcuts::launch_uri(&root, account_id, app_id)
}

#[tauri::command]
pub async fn games_scan_steam_shortcuts(root: Option<String>) -> Result<Snapshot, String> {
    tauri::async_runtime::spawn_blocking(move || snapshot(root))
        .await
        .map_err(|_| "shortcut_read")?
        .map_err(String::from)
}

#[tauri::command]
pub async fn games_launch_steam_shortcut(
    root: Option<String>,
    account_id: u32,
    app_id: u32,
) -> Result<(), String> {
    let uri = tauri::async_runtime::spawn_blocking(move || {
        prepare_launch(root.as_deref(), account_id, app_id)
    })
    .await
    .map_err(|_| "shortcut_read")?
    .map_err(String::from)?;
    tauri_plugin_opener::open_url(uri, None::<&str>).map_err(|_| "shortcut_launch".into())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IconRequest {
    app_id: Option<u32>,
    shortcut_id: Option<String>,
    key: String,
}

#[tauri::command]
pub async fn games_steam_shortcut_icons(
    root: Option<String>,
    account_id: u32,
    requests: Vec<IconRequest>,
) -> Result<HashMap<String, String>, String> {
    if requests.len() > 24 || requests.iter().any(|request| request.key.len() != 16) {
        return Err("shortcut_read".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let root = location(root.as_deref())?.ok_or("shortcut_location")?;
        let games = steam_shortcuts::read_account(&root, account_id)?;
        let games: HashMap<_, _> = games.iter().map(|game| (game.id(), game)).collect();
        let mut result = HashMap::new();
        for request in requests {
            let Ok(id) = steam_shortcuts::request_id(
                account_id,
                request.app_id,
                request.shortcut_id.as_deref(),
            ) else {
                continue;
            };
            let Some(game) = games.get(&id) else {
                continue;
            };
            if steam_shortcut_icons::key(game) != request.key {
                continue;
            }
            let image = steam_shortcut_icons::candidates(game)
                .into_iter()
                .find_map(|(path, index)| setup::application_icon(&path, index));
            if let Some(image) = image.filter(|_| steam_shortcut_icons::key(game) == request.key) {
                result.insert(game.id(), image);
            }
        }
        Ok::<_, &'static str>(result)
    })
    .await
    .map_err(|_| "shortcut_read")?
    .map_err(String::from)
}
