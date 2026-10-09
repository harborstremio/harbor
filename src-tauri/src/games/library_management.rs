//! Launcher-owned management. Never execute registry uninstall strings or delete game folders.
use super::steam_scan::InstalledApp;
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum SteamAction { Browse, Properties, Uninstall }

#[derive(Debug, PartialEq, Eq)]
enum SteamPlan { Folder(PathBuf), Url(String) }

fn steam_plan(app_id: u32, action: SteamAction, games: &[InstalledApp]) -> Result<SteamPlan, &'static str> {
    let game = games.iter().find(|game| app_id > 0 && game.app_id == app_id).ok_or("game_not_installed")?;
    match action {
        SteamAction::Browse => {
            if game.state == "missing" { return Err("game_not_installed"); }
            Ok(SteamPlan::Folder(PathBuf::from(&game.install_path)))
        }
        SteamAction::Properties => Ok(SteamPlan::Url(format!("steam://gameproperties/{app_id}"))),
        SteamAction::Uninstall => {
            if game.update == "uninstalling" { return Err("game_management_busy"); }
            Ok(SteamPlan::Url(format!("steam://uninstall/{app_id}")))
        }
    }
}

#[tauri::command]
pub async fn games_manage_steam(app_id: u32, action: SteamAction) -> Result<(), String> {
    // Fresh observed identity, not a frontend path, catalog alias or executable.
    tauri::async_runtime::spawn_blocking(move || {
        match steam_plan(app_id, action, &super::scan().apps)? {
            SteamPlan::Url(url) => tauri_plugin_opener::open_url(url, None::<&str>).map_err(|_| "game_management_failed"),
            SteamPlan::Folder(path) => open_folder(path),
        }
    }).await.map_err(|_| "game_management_failed")?.map_err(String::from)
}

fn open_folder(path: PathBuf) -> Result<(), &'static str> {
    if !path.is_absolute() || !path.is_dir() { return Err("game_not_installed"); }
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|_| "game_management_failed")
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LauncherAction { Browse, Client }

#[tauri::command]
pub async fn games_manage_launcher(id: String, action: LauncherAction) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (game, client) = super::launcher_scan::prepare_management(&id)?;
        match action {
            LauncherAction::Browse => open_folder(PathBuf::from(game.install_path)),
            LauncherAction::Client => {
                let executable = client.ok_or("launcher_client_missing")?;
                let mut command = std::process::Command::new(&executable);
                command.current_dir(executable.parent().ok_or("launcher_client_missing")?);
                #[cfg(windows)]
                { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
                command.spawn().map(|_| ()).map_err(|_| "game_management_failed")
            }
        }
    }).await.map_err(|_| "game_management_failed")?.map_err(String::from)
}

#[tauri::command]
pub fn games_open_installed_apps() -> Result<(), String> {
    #[cfg(windows)]
    { tauri_plugin_opener::open_url("ms-settings:appsfeatures", None::<&str>).map_err(|_| "game_management_failed".into()) }
    #[cfg(not(windows))]
    { Err("game_management_unsupported".into()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn app(id: u32) -> InstalledApp {
        InstalledApp { app_id: id, name: "Not an identity".into(), install_path: "/games/example".into(), library_path: "/games".into(), size_bytes: 1, last_played: 0, state: "installed", update: "none", bytes_to_download: 0, bytes_downloaded: 0, artwork: Default::default() }
    }
    #[test]
    fn exact_identity_only() {
        assert!(steam_plan(0, SteamAction::Uninstall, &[app(0)]).is_err());
        assert!(steam_plan(11, SteamAction::Uninstall, &[app(10)]).is_err());
        assert!(steam_plan(10, SteamAction::Uninstall, &[]).is_err());
        assert_eq!(steam_plan(10, SteamAction::Uninstall, &[app(10)]), Ok(SteamPlan::Url("steam://uninstall/10".into())));
    }
    #[test]
    fn actions_never_become_launch_or_delete_commands() {
        assert_eq!(steam_plan(10, SteamAction::Properties, &[app(10)]), Ok(SteamPlan::Url("steam://gameproperties/10".into())));
        assert_eq!(steam_plan(10, SteamAction::Browse, &[app(10)]), Ok(SteamPlan::Folder(PathBuf::from("/games/example"))));
    }
    #[test]
    fn stale_folder_and_duplicate_uninstall_are_rejected() {
        let mut game = app(10); game.state = "missing";
        assert!(steam_plan(10, SteamAction::Browse, &[game.clone()]).is_err());
        game.update = "uninstalling";
        assert_eq!(steam_plan(10, SteamAction::Uninstall, &[game]), Err("game_management_busy"));
    }
}
