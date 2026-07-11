use std::path::PathBuf;
use tauri::Manager;

// Latest FSRCNNX 8-0-4-1 release from igv/FSRCNN-TensorFlow
const FSRCNNX_URL: &str =
    "https://github.com/igv/FSRCNN-TensorFlow/releases/download/1.1/FSRCNNX_x2_8-0-4-1.glsl";
const FSRCNNX_FILE: &str = "FSRCNNX_x2_8-0-4-1.glsl";

fn shaders_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(base.join("fsrcnnx"))
}

/// Returns the fsrcnnx shaders directory path if the shader file is present, else None.
#[tauri::command]
pub fn fsrcnnx_dir(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = shaders_dir(&app)?;
    let shader = dir.join(FSRCNNX_FILE);
    if shader.exists() {
        Ok(Some(dir.to_string_lossy().into_owned()))
    } else {
        Ok(None)
    }
}

/// Downloads FSRCNNX shader file into app_data/fsrcnnx/.
/// Set force=true to re-download even if already present.
#[tauri::command]
pub async fn fsrcnnx_download(app: tauri::AppHandle, force: bool) -> Result<String, String> {
    let dir = shaders_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("create dir: {}", e))?;
    let dest = dir.join(FSRCNNX_FILE);
    if !force {
        if let Ok(meta) = std::fs::metadata(&dest) {
            if meta.len() > 0 {
                return Ok(dir.to_string_lossy().into_owned());
            }
        }
    }
    let client = reqwest::Client::builder()
        .user_agent("Harbor")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(FSRCNNX_URL)
        .send()
        .await
        .map_err(|e| format!("download FSRCNNX: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("download FSRCNNX: HTTP {}", resp.status()));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("read FSRCNNX: {}", e))?;
    if bytes.is_empty() {
        return Err("FSRCNNX shader file was empty".into());
    }
    std::fs::write(&dest, &bytes).map_err(|e| format!("write FSRCNNX: {}", e))?;
    Ok(dir.to_string_lossy().into_owned())
}

/// Applies FSRCNNX shader to the running mpv instance via glsl-shaders and
/// enforces rgba16f fbo-format which FSRCNNX requires for correct operation.
#[tauri::command]
pub fn fsrcnnx_set(app: tauri::AppHandle, mpv: tauri::State<crate::MpvHandle>) -> Result<(), String> {
    let dir = shaders_dir(&app)?;
    let shader_path = dir.join(FSRCNNX_FILE);
    if !shader_path.exists() {
        return Err("FSRCNNX shader not downloaded yet. Call fsrcnnx_download first.".into());
    }
    let path_str = shader_path.to_string_lossy().into_owned();
    // FSRCNNX requires a float FBO; set it before loading the shader.
    crate::mpv_set_property_raw(&mpv, "fbo-format", "rgba16f")?;
    crate::mpv_set_property_raw(&mpv, "glsl-shaders", &path_str)?;
    Ok(())
}

/// Clears FSRCNNX shader and resets fbo-format to the mpv default.
#[tauri::command]
pub fn fsrcnnx_clear(mpv: tauri::State<crate::MpvHandle>) -> Result<(), String> {
    crate::mpv_set_property_raw(&mpv, "glsl-shaders", "")?;
    crate::mpv_set_property_raw(&mpv, "fbo-format", "auto")?;
    Ok(())
}
