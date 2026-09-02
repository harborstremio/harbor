use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const CAPTIONS_LABEL: &str = "harbor-captions";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptionsCue {
    pub text: String,
    pub lang: Option<String>,
    pub paused: bool,
}

pub fn captions_is_open(app: &AppHandle) -> bool {
    app.get_webview_window(CAPTIONS_LABEL).is_some()
}

#[tauri::command]
pub async fn captions_window_is_open(app: AppHandle) -> Result<bool, String> {
    Ok(captions_is_open(&app))
}

#[tauri::command]
pub async fn captions_open(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(CAPTIONS_LABEL) {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }

    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main missing".to_string())?;
    let scale = main.scale_factor().unwrap_or(1.0);
    let size = main
        .outer_size()
        .map_err(|e| format!("outer_size: {}", e))?
        .to_logical::<f64>(scale);
    let pos = main
        .outer_position()
        .map_err(|e| format!("outer_position: {}", e))?
        .to_logical::<f64>(scale);

    let width = 468.0_f64;
    let height = 168.0_f64;
    let x = pos.x + (size.width - width) / 2.0;
    let y = pos.y + size.height + 12.0;

    let app_clone = app.clone();
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    app.run_on_main_thread(move || {
        let url = WebviewUrl::App("index.html?harbor-captions=1".into());
        let builder = WebviewWindowBuilder::new(&app_clone, CAPTIONS_LABEL, url)
            .title("Harbor Subtitles")
            .inner_size(width, height)
            .min_inner_size(280.0, 108.0)
            .position(x, y)
            .resizable(true)
            .always_on_top(true)
            .decorations(false)
            .skip_taskbar(true)
            .shadow(false)
            .visible(true)
            .focused(false);
        #[cfg(windows)]
        let builder = builder.transparent(true);
        match builder.build() {
            Ok(_) => {
                let _ = tx.send(Ok(()));
            }
            Err(e) => {
                let _ = tx.send(Err(e.to_string()));
            }
        }
    })
    .map_err(|e| format!("run_on_main_thread: {}", e))?;

    match rx.recv() {
        Ok(Ok(())) => Ok(()),
        Ok(Err(e)) => Err(e),
        Err(e) => Err(format!("channel: {}", e)),
    }
}

#[tauri::command]
pub async fn captions_close(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(CAPTIONS_LABEL) {
        let _ = w.close();
    }
    let _ = app.emit_to("main", "captions://closed", ());
    Ok(())
}

#[tauri::command]
pub async fn captions_push(app: AppHandle, cue: CaptionsCue) -> Result<(), String> {
    if !captions_is_open(&app) {
        return Ok(());
    }
    let _ = app.emit_to(CAPTIONS_LABEL, "captions://cue", cue);
    Ok(())
}

#[tauri::command]
pub async fn captions_request_state(app: AppHandle) -> Result<(), String> {
    let _ = app.emit_to("main", "captions://ready", ());
    Ok(())
}
