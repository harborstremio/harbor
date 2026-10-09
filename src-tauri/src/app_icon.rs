#[cfg(not(target_os = "macos"))]
use tauri::Manager;

#[cfg(target_os = "macos")]
fn set_macos_dock_icon(image_bytes: Option<Vec<u8>>) -> Result<(), String> {
    let _mtm = objc2_foundation::MainThreadMarker::new()
        .ok_or_else(|| "set_macos_dock_icon must run on main thread".to_string())?;

    unsafe {
        use objc2::class;
        use objc2::msg_send;
        use objc2::runtime::AnyObject;

        let ns_app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
        if ns_app.is_null() {
            return Err("NSApplication sharedApplication returned nil".into());
        }

        match image_bytes {
            Some(bytes) if !bytes.is_empty() => {
                let data: *mut AnyObject = msg_send![
                    class!(NSData),
                    dataWithBytes: bytes.as_ptr() as *const std::ffi::c_void,
                    length: bytes.len()
                ];
                if data.is_null() {
                    return Err("Failed to create NSData from icon bytes".into());
                }
                let alloc_img: *mut AnyObject = msg_send![class!(NSImage), alloc];
                let img: *mut AnyObject = msg_send![alloc_img, initWithData: data];
                if img.is_null() {
                    return Err("Failed to create NSImage from icon data".into());
                }
                let _: () = msg_send![ns_app, setApplicationIconImage: img];
                let _: () = msg_send![img, release];
            }
            _ => {
                let nil: *mut AnyObject = std::ptr::null_mut();
                let _: () = msg_send![ns_app, setApplicationIconImage: nil];
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn set_app_icon(
    app: tauri::AppHandle,
    image_bytes: Option<Vec<u8>>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = tokio::sync::oneshot::channel();
        app.run_on_main_thread(move || {
            let _ = tx.send(set_macos_dock_icon(image_bytes));
        })
        .map_err(|e| format!("run_on_main_thread failed: {e}"))?;
        rx.await
            .map_err(|e| format!("app icon result channel closed: {e}"))?
    }
    #[cfg(not(target_os = "macos"))]
    {
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| "main window is unavailable".to_string())?;
        let icon = if let Some(bytes) = image_bytes {
            tauri::image::Image::from_bytes(&bytes)
                .map_err(|e| format!("failed to decode app icon: {e}"))?
        } else {
            app.default_window_icon()
                .cloned()
                .ok_or_else(|| "default app icon is unavailable".to_string())?
        };
        window
            .set_icon(icon)
            .map_err(|e| format!("failed to set app icon: {e}"))?;
        Ok(())
    }
}
