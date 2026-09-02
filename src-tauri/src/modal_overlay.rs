use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tokio::sync::Mutex;

const OVERLAY_LABEL: &str = "harbor-modal-overlay";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModalPayload {
    pub kind: String,
    pub state: Value,
}

pub struct ModalOverlayState {
    open: Arc<Mutex<bool>>,
    pending: Arc<Mutex<Option<ModalPayload>>>,
}

impl ModalOverlayState {
    pub fn new() -> Self {
        Self {
            open: Arc::new(Mutex::new(false)),
            pending: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub async fn modal_overlay_open(
    app: AppHandle,
    state: tauri::State<'_, ModalOverlayState>,
    payload: ModalPayload,
) -> Result<(), String> {
    {
        let mut g = state.pending.lock().await;
        *g = Some(payload.clone());
    }

    {
        let mut g = state.open.lock().await;
        if *g {
            let _ = app.emit_to(OVERLAY_LABEL, "modal://show", payload);
            return Ok(());
        }
        *g = true;
    }

    if app.get_webview_window(OVERLAY_LABEL).is_some() {
        let _ = app.emit_to(OVERLAY_LABEL, "modal://show", payload);
        return Ok(());
    }

    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main missing".to_string())?;
    let scale = main.scale_factor().unwrap_or(1.0);
    let size = main
        .inner_size()
        .map_err(|e| format!("inner_size: {}", e))?
        .to_logical::<f64>(scale);
    let pos = main
        .outer_position()
        .map_err(|e| format!("outer_position: {}", e))?
        .to_logical::<f64>(scale);

    let app_clone = app.clone();
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    let popup_size = (size.width, size.height);
    app.run_on_main_thread(move || {
        let url = WebviewUrl::App("index.html?harbor-modal=1".into());
        let result = WebviewWindowBuilder::new(&app_clone, OVERLAY_LABEL, url)
            .title("Harbor Modal")
            .inner_size(popup_size.0, popup_size.1)
            .position(pos.x, pos.y)
            .resizable(false)
            .always_on_top(true)
            .decorations(false)
            .skip_taskbar(true)
            .shadow(false)
            .visible(true)
            .focused(true)
            .build();
        match result {
            Ok(window) => {
                let _ = window.set_focus();
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
        Ok(Err(e)) => {
            let mut g = state.open.lock().await;
            *g = false;
            Err(e)
        }
        Err(e) => {
            let mut g = state.open.lock().await;
            *g = false;
            Err(format!("channel: {}", e))
        }
    }
}

#[tauri::command]
pub async fn modal_overlay_close(
    app: AppHandle,
    state: tauri::State<'_, ModalOverlayState>,
) -> Result<(), String> {
    {
        let mut g = state.open.lock().await;
        *g = false;
    }
    {
        let mut g = state.pending.lock().await;
        *g = None;
    }
    if let Some(w) = app.get_webview_window(OVERLAY_LABEL) {
        let _ = w.close();
    }
    let _ = app.emit_to("main", "modal://closed", ());
    Ok(())
}

#[tauri::command]
pub async fn modal_overlay_emit_state(app: AppHandle, payload: ModalPayload) -> Result<(), String> {
    let _ = app.emit_to(OVERLAY_LABEL, "modal://state", payload);
    Ok(())
}

#[tauri::command]
pub async fn modal_overlay_emit_action(
    app: AppHandle,
    event: String,
    payload: Value,
) -> Result<(), String> {
    let _ = app.emit_to("main", &event, payload);
    Ok(())
}

#[tauri::command]
pub async fn modal_overlay_emit_result(
    app: AppHandle,
    event: String,
    payload: Value,
) -> Result<(), String> {
    let _ = app.emit_to(OVERLAY_LABEL, &event, payload);
    Ok(())
}

#[tauri::command]
pub async fn modal_overlay_sync(app: AppHandle) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main missing".to_string())?;
    let overlay = match app.get_webview_window(OVERLAY_LABEL) {
        Some(w) => w,
        None => return Ok(()),
    };
    let scale = main.scale_factor().unwrap_or(1.0);
    let size = main
        .inner_size()
        .map_err(|e| format!("inner_size: {}", e))?
        .to_logical::<f64>(scale);
    let pos = main
        .outer_position()
        .map_err(|e| format!("outer_position: {}", e))?
        .to_logical::<f64>(scale);
    let _ = overlay.set_position(LogicalPosition::new(pos.x, pos.y));
    let _ = overlay.set_size(LogicalSize::new(size.width, size.height));
    Ok(())
}

#[tauri::command]
pub async fn modal_overlay_get_pending(
    state: tauri::State<'_, ModalOverlayState>,
) -> Result<Option<ModalPayload>, String> {
    let g = state.pending.lock().await;
    Ok(g.clone())
}
