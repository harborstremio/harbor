use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::Mutex;

/// Window state captured before entering fullscreen.
///
/// `was_maximized` is kept separately from the normal bounds because a
/// maximized window's reported bounds describe the monitor rather than the
/// user's restored window geometry.
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

    let mut saved = state.saved.lock().await;
    let already_fs = main.is_fullscreen().unwrap_or(false);
    if !already_fs && saved.is_none() {
        let was_maximized = main.is_maximized().unwrap_or(false);
        if was_maximized {
            let _ = main.unmaximize();
        }
        let bounds = if let (Ok(pos), Ok(sz)) = (main.outer_position(), main.inner_size()) {
            Some((pos.x, pos.y, sz.width, sz.height))
        } else {
            None
        };
        *saved = Some(SavedWindowState {
            bounds,
            was_maximized,
        });
        if let Err(e) = main.set_fullscreen(true) {
            saved.take();
            return Err(format!("set_fullscreen(true): {}", e));
        }
        let _ = main.set_focus();
    }
    drop(saved);

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

    // Hold the async state lock through the native transition and restoration
    // delay. This serializes reasserted enter calls with exit and prevents a
    // second transition from overwriting the active saved snapshot.
    let mut saved_state = state.saved.lock().await;
    let is_fs = main.is_fullscreen().unwrap_or(false);
    let saved = saved_state.take();
    if is_fs || saved.is_some() {
        if is_fs {
            if let Err(e) = main.set_fullscreen(false) {
                *saved_state = saved;
                return Err(format!("set_fullscreen(false): {}", e));
            }
        }

        // On Windows the DWM fullscreen transition finishes asynchronously;
        // restoring geometry immediately gets overridden by the tail end of
        // the transition, leaving the window oversized/borderless (#1253).
        #[cfg(target_os = "windows")]
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;

        match saved {
            Some(saved) if saved.was_maximized && restore_position.unwrap_or(true) => {
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
    drop(saved_state);

    let _ = app.emit_to("main", "fs://exited", ());
    Ok(())
}
