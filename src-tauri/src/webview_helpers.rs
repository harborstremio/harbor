#[cfg(windows)]
fn set_default_background(app: &tauri::AppHandle, label: &str, alpha: u8, r: u8, g: u8, b: u8) {
    use tauri::Manager;
    let Some(window) = app.get_webview_window(label) else {
        eprintln!("[harbor::webview-bg] window {} missing", label);
        return;
    };
    let res = window.with_webview(move |webview| unsafe {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2Controller2, COREWEBVIEW2_COLOR,
        };
        use windows::core::Interface;
        let controller = webview.controller();
        match controller.cast::<ICoreWebView2Controller2>() {
            Ok(controller2) => {
                let color = COREWEBVIEW2_COLOR {
                    A: alpha,
                    R: r,
                    G: g,
                    B: b,
                };
                match controller2.SetDefaultBackgroundColor(color) {
                    Ok(()) => eprintln!(
                        "[harbor::webview-bg] SetDefaultBackgroundColor OK (a={} r={} g={} b={})",
                        alpha, r, g, b
                    ),
                    Err(e) => eprintln!(
                        "[harbor::webview-bg] SetDefaultBackgroundColor FAILED: {:?}",
                        e
                    ),
                }
            }
            Err(e) => eprintln!("[harbor::webview-bg] cast to Controller2 FAILED: {:?}", e),
        }
    });
    if let Err(e) = res {
        eprintln!("[harbor::webview-bg] with_webview FAILED: {:?}", e);
    }
}

/// Transparent WebView2 background so embedded mpv can show through the UI.
#[cfg(windows)]
pub fn apply_transparency(app: &tauri::AppHandle, label: &str) {
    set_default_background(app, label, 0, 0, 0, 0);
}

/// Opaque dark background for normal browsing — avoids stuck black when WebView
/// composition fails (alpha=0 + black HWND looks like a frozen black window).
#[cfg(windows)]
pub fn apply_opaque(app: &tauri::AppHandle, label: &str) {
    // Match Harbor's default canvas (#0a0a0a).
    set_default_background(app, label, 255, 10, 10, 10);
}

#[cfg(not(windows))]
pub fn apply_transparency(_app: &tauri::AppHandle, _label: &str) {}

#[cfg(not(windows))]
pub fn apply_opaque(_app: &tauri::AppHandle, _label: &str) {}

/// Reload WebView2 in place when its render process dies or hangs. A dead
/// renderer paints nothing and swallows every JS-level recovery (error
/// boundary, ErrorView, Reload button), so without this the window stays
/// blank until the whole app restarts — with no crash ever reaching the
/// Rust panic handler.
#[cfg(windows)]
pub fn install_process_failure_watchdog(app: &tauri::AppHandle, label: &str) {
    use tauri::Manager;
    let Some(window) = app.get_webview_window(label) else {
        eprintln!("[harbor::webview] watchdog: window {} missing", label);
        return;
    };
    let res = window.with_webview(|webview| unsafe {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_PROCESS_FAILED_KIND, COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED,
            COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE,
        };
        use webview2_com::ProcessFailedEventHandler;
        let controller = webview.controller();
        let core = match controller.CoreWebView2() {
            Ok(core) => core,
            Err(e) => {
                eprintln!("[harbor::webview] watchdog: CoreWebView2 FAILED: {:?}", e);
                return;
            }
        };
        let handler = ProcessFailedEventHandler::create(Box::new(move |sender, args| {
            let kind = args.and_then(|a| {
                let mut k = COREWEBVIEW2_PROCESS_FAILED_KIND(0);
                if a.ProcessFailedKind(&mut k).is_ok() {
                    Some(k)
                } else {
                    None
                }
            });
            eprintln!("[harbor::webview] ProcessFailed: {:?}", kind);
            if kind == Some(COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED)
                || kind == Some(COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE)
            {
                if let Some(core) = sender {
                    let _ = core.Reload();
                }
            }
            // BROWSER_PROCESS_EXITED cannot be reloaded — only logged here;
            // the fail-open show and crash marker cover the next launch.
            Ok(())
        }));
        let mut token: i64 = 0;
        match core.add_ProcessFailed(&handler, &mut token) {
            Ok(()) => {
                eprintln!("[harbor::webview] ProcessFailed watchdog installed");
            }
            Err(e) => eprintln!("[harbor::webview] add_ProcessFailed FAILED: {:?}", e),
        }
    });
    if let Err(e) = res {
        eprintln!("[harbor::webview] watchdog with_webview FAILED: {:?}", e);
    }
}

#[cfg(not(windows))]
pub fn install_process_failure_watchdog(_app: &tauri::AppHandle, _label: &str) {}

#[tauri::command]
pub fn webview_reapply_transparency(_app: tauri::AppHandle) -> Result<(), String> {
    apply_transparency(&_app, "main");
    Ok(())
}

#[tauri::command]
pub fn webview_set_opaque(_app: tauri::AppHandle) -> Result<(), String> {
    apply_opaque(&_app, "main");
    Ok(())
}
