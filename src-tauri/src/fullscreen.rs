use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

struct SavedGeometry {
    x: i32,
    y: i32,
    w: u32,
    h: u32,
}

struct SavedWindowState {
    // Whether the window was maximized before fullscreen. When true the window
    // is restored by re-maximizing; the normal (restored) bounds of a maximized
    // window are owned by the OS and cannot be read via the window API.
    maximized: bool,
    geometry: Option<SavedGeometry>,
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
    run_window_transition(&app, Arc::clone(&state.saved), enter_fullscreen).await
}

// Tauri setters called from an async command only enqueue window messages.
// Keep the bounds reads and writes in one window-thread operation: otherwise a
// simultaneous player reassert can save fullscreen dimensions as restore bounds.
async fn run_window_transition(
    app: &AppHandle,
    saved: Arc<Mutex<Option<SavedWindowState>>>,
    transition: impl FnOnce(&tauri::WebviewWindow, &Mutex<Option<SavedWindowState>>) -> Result<(), String>
        + Send
        + 'static,
) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(transition(&main, &saved));
    })
    .map_err(|e| format!("fullscreen transition dispatch: {}", e))?;
    rx.await
        .map_err(|e| format!("fullscreen transition result: {}", e))?
}

fn enter_fullscreen(
    main: &tauri::WebviewWindow,
    saved: &Mutex<Option<SavedWindowState>>,
) -> Result<(), String> {
    let already_fs = main.is_fullscreen().unwrap_or(false);
    if !already_fs {
        // The OS owns a maximized window's restored bounds. Save its mode before
        // unmaximizing instead of capturing the maximized dimensions.
        let maximized = main.is_maximized().unwrap_or(false);
        if maximized {
            let _ = main.unmaximize();
        }
        let geometry = if maximized {
            None
        } else if let (Ok(pos), Ok(sz)) = (main.outer_position(), main.inner_size()) {
            Some(SavedGeometry {
                x: pos.x,
                y: pos.y,
                w: sz.width,
                h: sz.height,
            })
        } else {
            None
        };
        let mut saved = saved.lock().unwrap();
        // Preserve the original snapshot if the OS temporarily drops fullscreen
        // and the player reasserts it before the user has actually exited.
        saved.get_or_insert(SavedWindowState { maximized, geometry });
        main.set_fullscreen(true)
            .map_err(|e| format!("set_fullscreen(true): {}", e))?;
        let _ = main.set_focus();
    }
    let _ = main.app_handle().emit_to("main", "fs://entered", ());
    Ok(())
}

#[tauri::command]
pub async fn window_fullscreen_exit(
    app: AppHandle,
    state: State<'_, FullscreenState>,
    restore_position: Option<bool>,
) -> Result<(), String> {
    run_window_transition(&app, Arc::clone(&state.saved), move |main, saved| {
        exit_fullscreen(main, saved, restore_position.unwrap_or(true))
    })
    .await
}

fn exit_fullscreen(
    main: &tauri::WebviewWindow,
    saved: &Mutex<Option<SavedWindowState>>,
    restore_position: bool,
) -> Result<(), String> {
    let is_fs = main.is_fullscreen().unwrap_or(false);
    if is_fs {
        main.set_fullscreen(false)
            .map_err(|e| format!("set_fullscreen(false): {}", e))?;
    }

    // Restore even when the window is already unfullscreen'd: frontend paths
    // like exitAnyFullscreen call setFullscreen(false) directly before this
    // command runs, and the saved geometry must still be applied.
    let saved = saved.lock().unwrap().take();
    if let Some(saved) = saved {
        if saved.maximized {
            let _ = main.maximize();
        } else if let Some(geo) = saved.geometry {
            let _ = main.set_size(tauri::PhysicalSize {
                width: geo.w,
                height: geo.h,
            });
            if restore_position {
                let _ = main.set_position(tauri::PhysicalPosition { x: geo.x, y: geo.y });
            } else {
                let _ = main.center();
            }
        } else if is_fs {
            let _ = main.set_size(tauri::LogicalSize { width: 1280.0, height: 800.0 });
            let _ = main.center();
        }
        let _ = main.set_focus();
    }
    let _ = main.app_handle().emit_to("main", "fs://exited", ());
    Ok(())
}
