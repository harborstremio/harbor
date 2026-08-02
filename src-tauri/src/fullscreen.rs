use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

pub struct FullscreenState {
    saved: Arc<Mutex<Option<(i32, i32, u32, u32)>>>,
}

impl FullscreenState {
    pub fn new() -> Self {
        Self {
            saved: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub async fn window_fullscreen_enter(
    app: AppHandle,
    state: State<'_, FullscreenState>,
) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;

    let already_fs = main.is_fullscreen().unwrap_or(false);
    if !already_fs {
        if main.is_maximized().unwrap_or(false) {
            let _ = main.unmaximize();
        }
        let saved = if main.is_maximized().unwrap_or(false) {
            None
        } else if let (Ok(pos), Ok(sz)) = (main.outer_position(), main.inner_size()) {
            Some((pos.x, pos.y, sz.width, sz.height))
        } else {
            None
        };
        *state.saved.lock().unwrap() = saved;
        main.set_fullscreen(true)
            .map_err(|e| format!("set_fullscreen(true): {}", e))?;
        let _ = main.set_focus();
    }
    let _ = app.emit_to("main", "fs://entered", ());
    Ok(())
}

#[tauri::command]
pub async fn window_fullscreen_exit(
    app: AppHandle,
    state: State<'_, FullscreenState>,
    restore_position: Option<bool>,
) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;

    let is_fs = main.is_fullscreen().unwrap_or(false);
    if is_fs {
        main.set_fullscreen(false)
            .map_err(|e| format!("set_fullscreen(false): {}", e))?;
        let saved = state.saved.lock().unwrap().take();
        if let Some((x, y, w, h)) = saved {
            let _ = main.set_size(tauri::PhysicalSize { width: w, height: h });
            if restore_position.unwrap_or(true) {
                let _ = main.set_position(tauri::PhysicalPosition { x, y });
            } else {
                let _ = main.center();
            }
        } else {
            let _ = main.center();
        }
        let _ = main.set_focus();
    }
    let _ = app.emit_to("main", "fs://exited", ());
    Ok(())
}
