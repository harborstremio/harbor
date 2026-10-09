use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

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

fn captions_placement(anchor: &WebviewWindow, width: f64, height: f64) -> Result<(f64, f64), String> {
    let gap = 12.0_f64;
    let scale = anchor.scale_factor().unwrap_or(1.0);
    let size = anchor
        .outer_size()
        .map_err(|e| format!("outer_size: {}", e))?
        .to_logical::<f64>(scale);
    let pos = anchor
        .outer_position()
        .map_err(|e| format!("outer_position: {}", e))?
        .to_logical::<f64>(scale);
    let mut x = pos.x + (size.width - width) / 2.0;
    let mut y = pos.y + size.height + gap;
    if let Ok(Some(monitor)) = anchor.current_monitor() {
        let mscale = monitor.scale_factor();
        let area = monitor.work_area();
        let ax = area.position.x as f64 / mscale;
        let ay = area.position.y as f64 / mscale;
        let aw = area.size.width as f64 / mscale;
        let ah = area.size.height as f64 / mscale;
        if y + height > ay + ah {
            let above = pos.y - height - gap;
            y = if above >= ay {
                above
            } else {
                (pos.y + size.height - height - gap).max(ay)
            };
        }
        x = x.max(ax).min((ax + aw - width).max(ax));
        y = y.max(ay).min((ay + ah - height).max(ay));
    }
    Ok((x, y))
}

#[tauri::command]
pub async fn captions_open(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(CAPTIONS_LABEL) {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }

    let anchor = if window.label() == CAPTIONS_LABEL {
        app.get_webview_window("main")
    } else {
        Some(window)
    }
    .ok_or_else(|| "anchor window missing".to_string())?;

    let width = 468.0_f64;
    let height = 168.0_f64;
    let (x, y) = captions_placement(&anchor, width, height)?;

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
        let builder = crate::browser_args::match_main(&app_clone, builder);
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
    let _ = app.emit("captions://closed", ());
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
    let _ = app.emit("captions://ready", ());
    Ok(())
}
