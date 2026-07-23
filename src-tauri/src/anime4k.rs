use std::path::PathBuf;
use tauri::Manager;

const BASE: &str = "https://raw.githubusercontent.com/bloc97/Anime4K/master/glsl";

const FILES: &[(&str, &str)] = &[
    ("Restore/Anime4K_Clamp_Highlights.glsl", "Anime4K_Clamp_Highlights.glsl"),
    ("Restore/Anime4K_Restore_CNN_VL.glsl", "Anime4K_Restore_CNN_VL.glsl"),
    ("Restore/Anime4K_Restore_CNN_M.glsl", "Anime4K_Restore_CNN_M.glsl"),
    ("Restore/Anime4K_Restore_CNN_Soft_VL.glsl", "Anime4K_Restore_CNN_Soft_VL.glsl"),
    ("Restore/Anime4K_Restore_CNN_Soft_M.glsl", "Anime4K_Restore_CNN_Soft_M.glsl"),
    ("Upscale/Anime4K_Upscale_CNN_x2_VL.glsl", "Anime4K_Upscale_CNN_x2_VL.glsl"),
    ("Upscale/Anime4K_Upscale_CNN_x2_M.glsl", "Anime4K_Upscale_CNN_x2_M.glsl"),
    (
        "Upscale%2BDenoise/Anime4K_Upscale_Denoise_CNN_x2_VL.glsl",
        "Anime4K_Upscale_Denoise_CNN_x2_VL.glsl",
    ),
    (
        "Upscale%2BDenoise/Anime4K_Upscale_Denoise_CNN_x2_M.glsl",
        "Anime4K_Upscale_Denoise_CNN_x2_M.glsl",
    ),
    ("Upscale/Anime4K_AutoDownscalePre_x2.glsl", "Anime4K_AutoDownscalePre_x2.glsl"),
    ("Upscale/Anime4K_AutoDownscalePre_x4.glsl", "Anime4K_AutoDownscalePre_x4.glsl"),
];

fn shaders_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(base.join("anime4k"))
}

#[tauri::command]
pub fn anime4k_dir(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = shaders_dir(&app)?;
    let complete = FILES.iter().all(|(_, local)| {
        std::fs::metadata(dir.join(local))
            .map(|metadata| metadata.len() > 0)
            .unwrap_or(false)
    });
    if complete {
        Ok(Some(dir.to_string_lossy().into_owned()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn anime4k_download(app: tauri::AppHandle, force: bool) -> Result<String, String> {
    let dir = shaders_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("create dir: {}", e))?;
    let client = reqwest::Client::builder()
        .user_agent("Harbor")
        .build()
        .map_err(|e| e.to_string())?;
    for (remote, local) in FILES {
        let dest = dir.join(local);
        if !force {
            if let Ok(meta) = std::fs::metadata(&dest) {
                if meta.len() > 0 {
                    continue;
                }
            }
        }
        let url = format!("{}/{}", BASE, remote);
        let resp = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("download {}: {}", local, e))?;
        if !resp.status().is_success() {
            return Err(format!("download {}: HTTP {}", local, resp.status()));
        }
        let bytes = resp.bytes().await.map_err(|e| format!("read {}: {}", local, e))?;
        if bytes.is_empty() {
            return Err(format!("{} was empty", local));
        }
        std::fs::write(&dest, &bytes).map_err(|e| format!("write {}: {}", local, e))?;
    }
    Ok(dir.to_string_lossy().into_owned())
}
