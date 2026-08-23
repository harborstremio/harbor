use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

/// Window state captured before entering fullscreen.
///
/// `bounds` is `None` when the window was maximized: its position/size are
/// owned by the WM in that case, so exit must re-maximize instead of writing
/// raw pixel values (which would be full-monitor dimensions).
struct SavedWindowState {
    bounds: Option<(i32, i32, u32, u32)>,
    was_maximized: bool,
}

pub struct FullscreenState {
    saved: Arc<Mutex<Option<SavedWindowState>>>,
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
        let was_maximized = main.is_maximized().unwrap_or(false);
        // Read bounds before unmaximizing; when maximized they describe the
        // monitor, not the user's preferred window geometry.
        let bounds = if was_maximized {
            None
        } else if let (Ok(pos), Ok(sz)) = (main.outer_position(), main.inner_size()) {
            Some((pos.x, pos.y, sz.width, sz.height))
        } else {
            None
        };
        *state.saved.lock().unwrap() = Some(SavedWindowState {
            bounds,
            was_maximized,
        });
        if was_maximized {
            let _ = main.unmaximize();
        }
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

        // On Windows the DWM fullscreen transition finishes asynchronously;
        // restoring geometry immediately gets overridden by the tail end of
        // the transition, leaving the window oversized/borderless (#1253).
        #[cfg(target_os = "windows")]
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;

        match saved {
            Some(saved) if saved.was_maximized => {
                let _ = main.maximize();
            }
            Some(saved) => {
                if let Some((x, y, w, h)) = saved.bounds {
                    let _ = main.set_size(tauri::PhysicalSize {
                        width: w,
                        height: h,
                    });
                    if restore_position.unwrap_or(true) {
                        let _ = main.set_position(tauri::PhysicalPosition { x, y });
                    } else {
                        let _ = main.center();
                    }
                } else {
                    let _ = main.center();
                }
            }
            None => {
                let _ = main.center();
            }
        }
        let _ = main.set_focus();
    }
    let _ = app.emit_to("main", "fs://exited", ());
    Ok(())
}
