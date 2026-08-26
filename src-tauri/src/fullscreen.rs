use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

pub struct FullscreenState {
    saved: Arc<Mutex<Option<SavedWindow>>>,
}

struct SavedWindow {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
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
        let maximized = main.is_maximized().unwrap_or(false);
        let saved = if let (Ok(pos), Ok(sz)) = (main.outer_position(), main.inner_size()) {
            Some(SavedWindow {
                x: pos.x,
                y: pos.y,
                width: sz.width,
                height: sz.height,
                maximized,
            })
        } else {
            None
        };
        if maximized {
            let _ = main.unmaximize();
        }
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
        // Windows applies its fullscreen transition asynchronously. Restoring
        // geometry in the same turn is frequently overwritten by DWM.
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        let saved = state.saved.lock().unwrap().take();
        if let Some(saved) = saved {
            if saved.maximized {
                let _ = main.maximize();
            } else {
                let _ = main.set_size(tauri::PhysicalSize { width: saved.width, height: saved.height });
            }
            if restore_position.unwrap_or(true) {
                let _ = main.set_position(tauri::PhysicalPosition { x: saved.x, y: saved.y });
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
