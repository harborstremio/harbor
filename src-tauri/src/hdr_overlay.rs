use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder,
};

pub const HDR_OVERLAY_LABEL: &str = "harbor-hdr-overlay";

#[cfg(windows)]
fn set_no_activate(app: &AppHandle) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongW, SetWindowLongW, GWL_EXSTYLE, WS_EX_NOACTIVATE,
    };
    let Some(window) = app.get_webview_window(HDR_OVERLAY_LABEL) else {
        return;
    };
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let target = HWND(hwnd.0 as *mut _);
    unsafe {
        let cur = GetWindowLongW(target, GWL_EXSTYLE);
        let want = cur | WS_EX_NOACTIVATE.0 as i32;
        if cur != want {
            SetWindowLongW(target, GWL_EXSTYLE, want);
        }
    }
}

fn main_rect(app: &AppHandle) -> Result<((f64, f64), (f64, f64)), String> {
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
    Ok(((pos.x, pos.y), (size.width, size.height)))
}

#[tauri::command]
pub async fn hdr_overlay_open(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(HDR_OVERLAY_LABEL) {
        let _ = w.show();
        return hdr_overlay_sync(app).await;
    }
    let ((px, py), (sw, sh)) = main_rect(&app)?;
    let app_clone = app.clone();
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    app.run_on_main_thread(move || {
        let url = WebviewUrl::App("index.html?harbor-overlay=1".into());
        let builder = WebviewWindowBuilder::new(&app_clone, HDR_OVERLAY_LABEL, url)
            .title("Harbor HDR")
            .inner_size(sw, sh)
            .position(px, py)
            .resizable(false)
            .always_on_top(true)
            .decorations(false)
            .skip_taskbar(true)
            .shadow(false)
            .visible(true)
            .focused(false);
        #[cfg(windows)]
        let builder = builder.transparent(true);
        let result = builder.build();
        match result {
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
        Ok(Ok(())) => {
            #[cfg(windows)]
            {
                set_no_activate(&app);
                crate::webview_helpers::apply_transparency(&app, HDR_OVERLAY_LABEL);
            }
            Ok(())
        }
        Ok(Err(e)) => Err(e),
        Err(e) => Err(format!("channel: {}", e)),
    }
}

#[tauri::command]
pub async fn hdr_overlay_close(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(HDR_OVERLAY_LABEL) {
        let _ = w.close();
    }
    Ok(())
}

#[tauri::command]
pub async fn hdr_overlay_hide(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(HDR_OVERLAY_LABEL) {
        let _ = w.hide();
    }
    Ok(())
}

#[tauri::command]
pub async fn hdr_overlay_sync(app: AppHandle) -> Result<(), String> {
    let overlay = match app.get_webview_window(HDR_OVERLAY_LABEL) {
        Some(w) => w,
        None => return Ok(()),
    };
    let ((px, py), (sw, sh)) = main_rect(&app)?;
    let _ = overlay.set_position(LogicalPosition::new(px, py));
    let _ = overlay.set_size(LogicalSize::new(sw, sh));
    #[cfg(windows)]
    crate::webview_helpers::apply_transparency(&app, HDR_OVERLAY_LABEL);
    Ok(())
}

#[tauri::command]
pub async fn hdr_overlay_emit_props(
    app: AppHandle,
    payload: serde_json::Value,
) -> Result<(), String> {
    let _ = app.emit_to(HDR_OVERLAY_LABEL, "hdr-stage://props", payload);
    Ok(())
}

#[tauri::command]
pub async fn hdr_overlay_emit_action(
    app: AppHandle,
    event: String,
    payload: serde_json::Value,
) -> Result<(), String> {
    let _ = app.emit_to("main", &event, payload);
    Ok(())
}
