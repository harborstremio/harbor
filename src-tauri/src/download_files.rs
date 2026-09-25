use crate::download_file_policy::{inspect_download_file, remove_download_file, same_file_path};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadFileInfo {
    exists: bool,
    is_file: bool,
    canonical_path: Option<String>,
}

#[tauri::command]
pub fn download_file_info(path: String) -> Result<DownloadFileInfo, String> {
    let path = Path::new(&path);
    let result = inspect_download_file(path)?;
    Ok(match result {
        Some((canonical, is_file)) => DownloadFileInfo {
            exists: true,
            is_file,
            canonical_path: Some(canonical.to_string_lossy().into_owned()),
        },
        None => DownloadFileInfo {
            exists: false,
            is_file: false,
            canonical_path: None,
        },
    })
}

#[tauri::command]
pub async fn download_delete_file(
    app: tauri::AppHandle,
    path: String,
    expected_canonical_path: Option<String>,
    protected_paths: Option<Vec<String>>,
) -> Result<(), String> {
    let path = Path::new(&path);
    let Some((canonical, is_file)) = inspect_download_file(path)? else {
        return Ok(());
    };
    if !is_file {
        return Err("Only a regular downloaded file can be deleted.".into());
    }
    if let Some(expected) = expected_canonical_path {
        if !same_file_path(&canonical, Path::new(&expected)) {
            return Err("The downloaded file changed. Open its menu again.".into());
        }
    }
    for protected in protected_paths.unwrap_or_default() {
        if let Ok(protected) = Path::new(&protected).canonicalize() {
            if same_file_path(&canonical, &protected) {
                return Err("This file is used by playback or another download.".into());
            }
        }
    }
    #[cfg(desktop)]
    let playing = if let Some(state) = app.try_state::<crate::mpv::MpvState>() {
        state.active_file_path().await?.map(PathBuf::from)
    } else {
        None
    };
    #[cfg(not(desktop))]
    let playing: Option<PathBuf> = None;
    remove_download_file(path, playing.as_deref())
}

#[tauri::command]
pub fn harbor_download_dir(app: tauri::AppHandle) -> Result<String, String> {
    let directory = app
        .path()
        .download_dir()
        .map_err(|error| error.to_string())?;
    Ok(directory.to_string_lossy().into_owned())
}
