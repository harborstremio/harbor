#[cfg(windows)]
pub fn apply_transparency(app: &tauri::AppHandle, label: &str) {
    use tauri::Manager;
    let Some(window) = app.get_webview_window(label) else {
        eprintln!("[harbor::transparent] window {} missing", label);
        return;
    };
    let res = window.with_webview(|webview| unsafe {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2Controller2, COREWEBVIEW2_COLOR,
        };
        use windows::core::Interface;
        let controller = webview.controller();
        match controller.cast::<ICoreWebView2Controller2>() {
            Ok(controller2) => {
                let color = COREWEBVIEW2_COLOR {
                    A: 0,
                    R: 0,
                    G: 0,
                    B: 0,
                };
                match controller2.SetDefaultBackgroundColor(color) {
                    Ok(()) => eprintln!("[harbor::transparent] re-applied (alpha=0)"),
                    Err(e) => eprintln!("[harbor::transparent] re-apply FAILED: {:?}", e),
                }
            }
            Err(e) => eprintln!("[harbor::transparent] cast to Controller2 FAILED: {:?}", e),
        }
    });
    if let Err(e) = res {
        eprintln!("[harbor::transparent] with_webview FAILED: {:?}", e);
    }
}

#[tauri::command]
pub fn webview_reapply_transparency(_app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(windows)]
    {
        apply_transparency(&_app, "main");
    }
    Ok(())
}
