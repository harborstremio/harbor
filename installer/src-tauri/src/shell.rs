use tauri::{Builder, Wry};

#[cfg(windows)]
fn lock_window_size(window: &tauri::WebviewWindow) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_STYLE, WS_THICKFRAME,
    };
    let handle = match window.hwnd() {
        Ok(h) => h.0 as isize,
        Err(_) => return,
    };
    unsafe {
        let style = GetWindowLongPtrW(handle as _, GWL_STYLE);
        SetWindowLongPtrW(handle as _, GWL_STYLE, style & !(WS_THICKFRAME as isize));
    }
}

#[cfg(not(windows))]
fn lock_window_size(_window: &tauri::WebviewWindow) {}

pub fn builder() -> Builder<Wry> {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                lock_window_size(&window);
            }
            Ok(())
        })
}
