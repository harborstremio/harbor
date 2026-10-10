//! Desktop paths are resolved here; save operations run in the independently testable workspace.
use super::pokemon_files::digest;
use serde_json::Value;
use std::path::PathBuf;
use tauri::Manager;
async fn root(app: &tauri::AppHandle, profile: &str) -> Result<PathBuf, String> {
    if profile.is_empty() || profile.len() > 512 {
        return Err("pokemon_profile".into());
    }
    let root = app
        .path()
        .app_data_dir()
        .map_err(|_| "pokemon_storage")?
        .join("pokemon")
        .join(digest(profile.as_bytes()));
    tokio::fs::create_dir_all(&root)
        .await
        .map_err(|_| "pokemon_storage")?;
    let root = tokio::fs::canonicalize(root)
        .await
        .map_err(|_| "pokemon_storage")?;
    for name in ["bank", "backups", "trash", "drafts"] {
        let path = root.join(name);
        tokio::fs::create_dir_all(&path)
            .await
            .map_err(|_| "pokemon_storage")?;
        if super::save_files::reparse(
            &tokio::fs::symlink_metadata(path)
                .await
                .map_err(|_| "pokemon_storage")?,
        ) {
            return Err("pokemon_storage".into());
        }
    }
    Ok(root)
}
fn engine_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let name = if cfg!(windows) {
        "Harbor.PokemonEngine.exe"
    } else {
        "Harbor.PokemonEngine"
    };
    #[cfg(debug_assertions)]
    {
        let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources/pokemon-engine")
            .join(name);
        if dev.is_file() {
            return Ok(dev);
        }
    }
    let path = app
        .path()
        .resource_dir()
        .map_err(|_| "pokemon_engine_missing")?
        .join("resources/pokemon-engine")
        .join(name);
    if path.is_file() {
        Ok(path)
    } else {
        Err("pokemon_engine_missing".into())
    }
}
pub async fn dispatch(
    app: tauri::AppHandle,
    profile: String,
    request: Value,
) -> Result<Value, String> {
    if request["op"] == "discover" {
        let saves = app
            .path()
            .app_data_dir()
            .map_err(|_| "pokemon_storage")?
            .join("games/retro-saves");
        let roms = serde_json::from_value(request["roms"].clone()).map_err(|_| "pokemon_file")?;
        return Ok(
            serde_json::json!({"saves":super::pokemon_save_discovery::discover(&saves, &profile, roms).await?}),
        );
    }
    let root = root(&app, &profile).await?;
    // Status must still load the bank when this platform has no engine installed.
    let engine = engine_path(&app).unwrap_or_else(|_| root.join("engine-not-installed"));
    super::pokemon_workspace::dispatch(root, engine, profile, request).await
}
