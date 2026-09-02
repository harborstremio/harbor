use futures_util::StreamExt;
use std::io::Write;
use std::path::PathBuf;
use tauri::{Emitter, Manager};

const MODEL_URL: &str = "https://harbor.site/models/ggml-tiny.bin";
const MODEL_FILE: &str = "ggml-tiny.bin";
const MIN_VALID_BYTES: u64 = 1_000_000;

fn model_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(base.join("asr"))
}

fn existing(app: &tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    let dest = model_dir(app)?.join(MODEL_FILE);
    match std::fs::metadata(&dest) {
        Ok(m) if m.len() >= MIN_VALID_BYTES => Ok(Some(dest)),
        _ => Ok(None),
    }
}

#[tauri::command]
pub fn asr_model_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(existing(&app)?.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub async fn asr_ensure_model(app: tauri::AppHandle) -> Result<String, String> {
    if let Some(p) = existing(&app)? {
        return Ok(p.to_string_lossy().into_owned());
    }
    let dir = model_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("create dir: {}", e))?;
    let dest = dir.join(MODEL_FILE);
    let tmp = dir.join("ggml-tiny.bin.part");

    let client = reqwest::Client::builder()
        .user_agent("Harbor")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(MODEL_URL)
        .send()
        .await
        .map_err(|e| format!("download model: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("download model: HTTP {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(0);
    let mut file = std::fs::File::create(&tmp).map_err(|e| format!("create part: {}", e))?;
    let mut received: u64 = 0;
    let mut last_emit: u64 = 0;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("read: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("write: {}", e))?;
        received += chunk.len() as u64;
        if received - last_emit >= 1_048_576 {
            last_emit = received;
            let _ = app.emit("asr-model://progress", (received, total));
        }
    }
    file.flush().map_err(|e| format!("flush: {}", e))?;
    drop(file);
    if received < MIN_VALID_BYTES {
        let _ = std::fs::remove_file(&tmp);
        return Err("download truncated".into());
    }
    std::fs::rename(&tmp, &dest).map_err(|e| format!("finalize: {}", e))?;
    let _ = app.emit("asr-model://progress", (received, received));
    Ok(dest.to_string_lossy().into_owned())
}
