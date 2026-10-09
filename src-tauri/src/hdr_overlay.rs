use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
};

pub const HDR_OVERLAY_LABEL: &str = "harbor-hdr-overlay";

// Serialize creation with cleanup so stopping playback cannot leave a late overlay behind.
static HDR_OVERLAY_OPERATION: tokio::sync::Mutex<Option<String>> =
    tokio::sync::Mutex::const_new(None);

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

fn main_rect(app: &AppHandle) -> Result<(PhysicalPosition<i32>, PhysicalSize<u32>), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main missing".to_string())?;
    let size = main
        .inner_size()
        .map_err(|e| format!("inner_size: {}", e))?;
    let pos = main
        .inner_position()
        .map_err(|e| format!("inner_position: {}", e))?;
    Ok((pos, size))
}

#[tauri::command]
pub async fn hdr_overlay_open(app: AppHandle, stage_id: String) -> Result<(), String> {
    let mut operation = HDR_OVERLAY_OPERATION.lock().await;
    *operation = Some(stage_id.clone());
    crate::mpv::mpv_set_hdr_stage(app.clone(), false).await?;
    if let Some(w) = app.get_webview_window(HDR_OVERLAY_LABEL) {
        w.hide().map_err(|e| e.to_string())?;
        let mut url = w.url().map_err(|e| e.to_string())?;
        url.query_pairs_mut()
            .clear()
            .append_pair("harbor-overlay", "1")
            .append_pair("stageId", &stage_id);
        w.navigate(url).map_err(|e| e.to_string())?;
        return Ok(());
    }
    let app_clone = app.clone();
    // WebView2 creation must not run inside the UI event loop: it can deadlock
    // that loop, including the tray and every other Harbor window.
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let url = WebviewUrl::App(format!("index.html?harbor-overlay=1&stageId={stage_id}").into());
        let builder = WebviewWindowBuilder::new(&app_clone, HDR_OVERLAY_LABEL, url)
            .title("Harbor HDR")
            .resizable(false)
            .decorations(false)
            .skip_taskbar(true)
            .shadow(false)
            .visible(false)
            .focused(false);
        #[cfg(windows)]
        let builder = {
            let main = app_clone
                .get_webview_window("main")
                .ok_or_else(|| "main missing".to_string())?;
            // An owned window stays above Harbor, not above unrelated applications.
            builder
                .transparent(true)
                .parent(&main)
                .map_err(|e| e.to_string())?
        };
        let builder = crate::browser_args::match_main(&app_clone, builder);
        builder.build().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("overlay creation worker: {e}"))??;
    #[cfg(windows)]
    {
        set_no_activate(&app);
        crate::webview_helpers::apply_transparency(&app, HDR_OVERLAY_LABEL);
    }
    Ok(())
}

#[tauri::command]
pub async fn hdr_overlay_show(app: AppHandle, stage_id: String) -> Result<bool, String> {
    let operation = HDR_OVERLAY_OPERATION.lock().await;
    if operation.as_deref() != Some(stage_id.as_str()) {
        return Ok(false);
    }
    let window = app
        .get_webview_window(HDR_OVERLAY_LABEL)
        .ok_or("HDR overlay missing")?;
    // Physical client bounds avoid cross-monitor DPI conversion and frame offsets.
    // Sync at handoff, not at boot: the main window may have moved while loading.
    hdr_overlay_sync(app.clone()).await?;
    window.show().map_err(|e| e.to_string())?;
    crate::mpv::mpv_set_hdr_stage(app, true).await?;
    Ok(true)
}

#[tauri::command]
pub async fn hdr_overlay_close(app: AppHandle, stage_id: String) -> Result<(), String> {
    let mut operation = HDR_OVERLAY_OPERATION.lock().await;
    if operation.as_deref() != Some(stage_id.as_str()) {
        return Ok(());
    }
    *operation = None;
    crate::mpv::mpv_set_hdr_stage(app.clone(), false).await?;
    if let Some(w) = app.get_webview_window(HDR_OVERLAY_LABEL) {
        // Keep the hidden WebView for a later, explicitly navigated fresh boot.
        // Closing/recreating the same label races Windows' asynchronous teardown.
        w.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn hdr_overlay_hide(app: AppHandle) -> Result<(), String> {
    let mut operation = HDR_OVERLAY_OPERATION.lock().await;
    *operation = None;
    crate::mpv::mpv_set_hdr_stage(app.clone(), false).await?;
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
    let (pos, size) = main_rect(&app)?;
    overlay.set_position(pos).map_err(|e| e.to_string())?;
    overlay.set_size(size).map_err(|e| e.to_string())?;
    #[cfg(windows)]
    crate::webview_helpers::apply_transparency(&app, HDR_OVERLAY_LABEL);
    Ok(())
}

#[tauri::command]
pub async fn hdr_overlay_emit_props(
    app: AppHandle,
    mut payload: serde_json::Value,
) -> Result<(), String> {
    let operation = HDR_OVERLAY_OPERATION.lock().await;
    let Some(stage_id) = operation.as_ref() else {
        return Ok(());
    };
    payload["stageId"] = serde_json::Value::String(stage_id.clone());
    app.emit_to(HDR_OVERLAY_LABEL, "hdr-stage://props", payload)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn hdr_overlay_emit_action(
    app: AppHandle,
    event: String,
    payload: serde_json::Value,
    stage_id: Option<String>,
) -> Result<(), String> {
    let operation = HDR_OVERLAY_OPERATION.lock().await;
    if operation.is_none() || *operation != stage_id {
        return Ok(());
    }
    app.emit_to("main", &event, payload)
        .map_err(|e| e.to_string())
}
