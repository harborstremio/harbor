use super::{stardew, stardew_progress, stardew_updates};
use tauri::Emitter;

#[tauri::command]
pub async fn games_stardew_catalog(
    app: tauri::AppHandle,
    profile: String,
    operation_id: String,
    refresh: bool,
) -> Result<super::stardew_catalog::Catalog, String> {
    tauri::async_runtime::spawn_blocking(move || {
        tauri::async_runtime::block_on(super::stardew_catalog::load(
            &profile,
            &operation_id,
            refresh,
            &|p| {
                let _ = app.emit("games:stardew-progress", p);
            },
        ))
    })
    .await
    .map_err(|_| "stardew_catalog_network")?
    .map_err(String::from)
}
#[tauri::command]
pub async fn games_stardew_creator_review(
    app: tauri::AppHandle,
    profile: String,
    path: String,
    operation_id: String,
    project: String,
) -> Result<super::stardew_reviews::Review, String> {
    tauri::async_runtime::spawn_blocking(move || {
        tauri::async_runtime::block_on(super::stardew_creator::review(
            &profile,
            &path,
            &operation_id,
            &project,
            &|p| {
                let _ = app.emit("games:stardew-progress", p);
            },
        ))
    })
    .await
    .map_err(|_| "stardew_catalog_network")?
    .map_err(String::from)
}

#[tauri::command]
pub async fn games_stardew_folders() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        super::steam_paths::find_root()
            .map(|root| {
                super::steam_scan::scan(&root)
                    .apps
                    .into_iter()
                    .filter(|app| app.app_id == 413150)
                    .map(|app| app.install_path)
                    .collect()
            })
            .unwrap_or_default()
    })
    .await
    .map_err(|_| "stardew_read".into())
}

#[tauri::command]
pub async fn games_stardew_inspect(
    app: tauri::AppHandle,
    profile: String,
    path: String,
    operation_id: String,
) -> Result<stardew::Inventory, String> {
    tauri::async_runtime::spawn_blocking(move || {
        stardew::inspect(&profile, &path, &operation_id, &|p| {
            let _ = app.emit("games:stardew-progress", p);
        })
    })
    .await
    .map_err(|_| "stardew_read")?
    .map_err(String::from)
}

#[tauri::command]
pub async fn games_stardew_updates(
    app: tauri::AppHandle,
    profile: String,
    path: String,
    operation_id: String,
) -> Result<stardew_updates::Report, String> {
    tauri::async_runtime::spawn_blocking(move || {
        tauri::async_runtime::block_on(stardew_updates::check(
            &profile,
            &path,
            &operation_id,
            &|p| {
                let _ = app.emit("games:stardew-progress", p);
            },
        ))
    })
    .await
    .map_err(|_| "stardew_network")?
    .map_err(String::from)
}

#[tauri::command]
pub fn games_stardew_cancel(profile: String, operation_id: String) -> bool {
    stardew_progress::cancel(&profile, &operation_id)
}

#[tauri::command]
pub async fn games_stardew_workspace(
    path: String,
) -> Result<super::stardew_reviews::Workspace, String> {
    tauri::async_runtime::spawn_blocking(move || super::stardew_reviews::workspace(&path))
        .await
        .map_err(|_| "stardew_read")?
        .map_err(String::from)
}
#[tauri::command]
pub async fn games_stardew_review(
    app: tauri::AppHandle,
    profile: String,
    path: String,
    operation_id: String,
    action: super::stardew_reviews::Action,
) -> Result<super::stardew_reviews::Review, String> {
    tauri::async_runtime::spawn_blocking(move || {
        super::stardew_reviews::prepare(&profile, &path, &operation_id, action, &|p| {
            let _ = app.emit("games:stardew-progress", p);
        })
    })
    .await
    .map_err(|_| "stardew_read")?
    .map_err(String::from)
}
#[tauri::command]
pub async fn games_stardew_apply(
    app: tauri::AppHandle,
    profile: String,
    token: String,
    operation_id: String,
) -> Result<super::stardew_reviews::Workspace, String> {
    tauri::async_runtime::spawn_blocking(move || {
        super::stardew_reviews::apply(&profile, &token, &operation_id, &|p| {
            let _ = app.emit("games:stardew-progress", p);
        })
    })
    .await
    .map_err(|_| "stardew_write")?
    .map_err(String::from)
}
#[tauri::command]
pub async fn games_stardew_recover(
    app: tauri::AppHandle,
    profile: String,
    path: String,
    operation_id: String,
) -> Result<super::stardew_reviews::Workspace, String> {
    tauri::async_runtime::spawn_blocking(move || {
        super::stardew_reviews::recover(&profile, &path, &operation_id, &|p| {
            let _ = app.emit("games:stardew-progress", p);
        })
    })
    .await
    .map_err(|_| "stardew_recovery")?
    .map_err(String::from)
}
#[tauri::command]
pub fn games_stardew_discard(profile: String, token: String) -> bool {
    super::stardew_reviews::discard(&profile, &token)
}
