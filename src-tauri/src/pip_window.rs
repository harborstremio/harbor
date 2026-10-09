use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// Distinct from pip.rs's `harbor-pip`, which is an HTML5 element that re-opens the
/// URL. This one hosts the live mpv surface instead.
pub const PIP_LABEL: &str = "harbor-video-pip";

#[derive(Default)]
pub struct PipWindowState {
    pub active: AtomicBool,
}

#[cfg(windows)]
mod win {
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM, RECT};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, GetClassNameW, GetClientRect, GetWindowTextW, SetParent, SetWindowPos,
        HWND_BOTTOM, SWP_NOACTIVATE, SWP_SHOWWINDOW,
    };

    unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let mut class_buf = [0u16; 256];
        let class_len = GetClassNameW(hwnd, &mut class_buf);
        let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
        let mut title_buf = [0u16; 256];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);
        let is_mpv = class_name == "mpv"
            || class_name.starts_with("mpv ")
            || (class_name.is_empty() && title.starts_with("Harbor"));
        if is_mpv {
            (*(lparam.0 as *mut Vec<isize>)).push(hwnd.0 as isize);
        }
        BOOL(1)
    }

    /// mpv can recreate its surface on a vo reinit, so it is looked up each time.
    pub fn mpv_children(parent: HWND) -> Vec<isize> {
        let mut found: Vec<isize> = Vec::new();
        let ptr = &mut found as *mut Vec<isize>;
        unsafe {
            let _ = EnumChildWindows(Some(parent), Some(collect), LPARAM(ptr as isize));
        }
        found
    }

    fn client_size(hwnd: HWND) -> (i32, i32) {
        let mut rc = RECT::default();
        let ok = unsafe { GetClientRect(hwnd, &mut rc).is_ok() };
        if ok && rc.right > 0 && rc.bottom > 0 {
            (rc.right, rc.bottom)
        } else {
            (1, 1)
        }
    }

    pub fn fill(children: &[isize], host: HWND) {
        let (w, h) = client_size(host);
        for child in children {
            unsafe {
                let _ = SetWindowPos(
                    HWND(*child as *mut _),
                    Some(HWND_BOTTOM),
                    0,
                    0,
                    w,
                    h,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
            }
        }
    }

    /// Moves the surface to another host. mpv keeps decoding throughout, which is the
    /// whole point: a second instance would re-open the stream and seek.
    pub fn reparent(children: &[isize], host: HWND) -> Result<(), String> {
        for child in children {
            unsafe {
                SetParent(HWND(*child as *mut _), Some(host))
                    .map_err(|e| format!("SetParent: {e}"))?;
            }
        }
        fill(children, host);
        Ok(())
    }
}

/// Moves the render target to `label`'s window without touching the mpv core, so the
/// decoder, the buffers and the position all survive the move.
#[cfg(any(target_os = "macos", target_os = "linux"))]
async fn retarget_render(app: &AppHandle, label: &str) -> Result<(), String> {
    let mpv_state = app.state::<crate::mpv::MpvState>();
    let ctx_addr = mpv_state
        .ctx_addr()
        .await
        .ok_or_else(|| "no running mpv session".to_string())?;
    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("{label} window missing"))?;

    #[cfg(target_os = "macos")]
    {
        let ns_window_ptr = window
            .ns_window()
            .map_err(|e| format!("ns_window: {e:?}"))? as i64;
        let edr = crate::mpv::mac_edr_active();
        let (tx, rx) = std::sync::mpsc::sync_channel::<Result<(), String>>(1);
        let _ = app.run_on_main_thread(move || {
            let res = match std::ptr::NonNull::new(ctx_addr as *mut libmpv2_sys::mpv_handle) {
                // install replaces any stale embed itself, so the old host is released here.
                Some(p) => crate::mpv_render_mac::install(p, ns_window_ptr, edr),
                None => Err("null mpv ctx".into()),
            };
            let _ = tx.send(res);
        });
        return match rx.recv_timeout(std::time::Duration::from_millis(3000)) {
            Ok(result) => result,
            Err(e) => Err(format!("mac render retarget timeout: {e:?}")),
        };
    }

    #[cfg(target_os = "linux")]
    {
        let (tx, rx) = std::sync::mpsc::sync_channel::<Result<(), String>>(1);
        let _ = app.run_on_main_thread(move || {
            let res = (|| {
                let p = std::ptr::NonNull::new(ctx_addr as *mut libmpv2_sys::mpv_handle)
                    .ok_or_else(|| "null mpv ctx".to_string())?;
                // The GL area lives where the webview was, so the old host is restored
                // before the new one takes it over.
                crate::mpv_render_linux::uninstall()?;
                crate::mpv_render_linux::prepare(p)?;
                let gtk_window = window
                    .gtk_window()
                    .map_err(|e| format!("gtk_window: {e:?}"))?;
                let vbox = window
                    .default_vbox()
                    .map_err(|e| format!("default_vbox: {e:?}"))?;
                crate::mpv_render_linux::install(&gtk_window, &vbox)
            })();
            let _ = tx.send(res);
        });
        return match rx.recv_timeout(std::time::Duration::from_millis(3000)) {
            Ok(result) => result,
            Err(e) => Err(format!("linux render retarget timeout: {e:?}")),
        };
    }
}

async fn ensure_pip_window(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window(PIP_LABEL).is_some() {
        return Ok(());
    }
    let app_clone = app.clone();
    // WebView2 creation must not run inside the UI event loop: it can deadlock that loop,
    // including the tray and every other Harbor window.
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let url = WebviewUrl::App("index.html?harbor-video-pip=1".into());
        let builder = WebviewWindowBuilder::new(&app_clone, PIP_LABEL, url)
            .title("Harbor")
            .inner_size(480.0, 270.0)
            .min_inner_size(240.0, 135.0)
            .resizable(true)
            .decorations(false)
            .skip_taskbar(true)
            .shadow(false)
            .visible(false)
            // Deliberately unowned. An owned window only floats above Harbor, and this
            // has to stay above whatever the viewer switches to.
            .always_on_top(true);
        // transparent() needs macos-private-api, so only Windows sets it here. The mac
        // and GTK render paths make their own webview see-through.
        #[cfg(windows)]
        let builder = builder.transparent(true);
        let builder = crate::browser_args::match_main(&app_clone, builder);
        builder.build().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("pip window worker: {e}"))??;
    #[cfg(windows)]
    crate::webview_helpers::apply_transparency(app, PIP_LABEL);
    Ok(())
}

fn place_bottom_right(pip: &tauri::WebviewWindow) -> Result<(), String> {
    use tauri::{LogicalPosition, LogicalSize};

    let scale = pip.scale_factor().unwrap_or(1.0);
    let size = LogicalSize::new(480.0_f64, 270.0_f64);
    let (mon_x, mon_y, mon_w, mon_h) = match pip.current_monitor().ok().flatten() {
        Some(m) => {
            let p = m.position().to_logical::<f64>(scale);
            let s = m.size().to_logical::<f64>(scale);
            (p.x, p.y, s.width, s.height)
        }
        None => (0.0, 0.0, 1920.0, 1080.0),
    };
    let x = (mon_x + mon_w - size.width - 24.0).clamp(mon_x, mon_x + mon_w);
    let y = (mon_y + mon_h - size.height - 56.0).clamp(mon_y, mon_y + mon_h);
    pip.set_size(size).map_err(|e| format!("set_size: {e}"))?;
    pip.set_position(LogicalPosition::new(x, y))
        .map_err(|e| format!("set_position: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn pip_window_enter(
    app: AppHandle,
    state: tauri::State<'_, PipWindowState>,
) -> Result<(), String> {
    if state.active.load(Ordering::SeqCst) {
        return Ok(());
    }

    #[cfg(windows)]
    let children = {
        use windows::Win32::Foundation::HWND;
        let main = app
            .get_webview_window("main")
            .ok_or_else(|| "main window missing".to_string())?;
        let main_hwnd = main.hwnd().map_err(|e| format!("hwnd: {e}"))?;
        let found = win::mpv_children(HWND(main_hwnd.0 as *mut _));
        if found.is_empty() {
            return Err("no video surface to detach".to_string());
        }
        found
    };

    ensure_pip_window(&app).await?;
    let pip = app
        .get_webview_window(PIP_LABEL)
        .ok_or_else(|| "pip window missing".to_string())?;
    place_bottom_right(&pip)?;
    pip.show().map_err(|e| format!("show: {e}"))?;

    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        let pip_hwnd = pip.hwnd().map_err(|e| format!("pip hwnd: {e}"))?;
        win::reparent(&children, HWND(pip_hwnd.0 as *mut _))?;
    }
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        if let Err(error) = retarget_render(&app, PIP_LABEL).await {
            let _ = pip.hide();
            return Err(error);
        }
    }

    state.active.store(true, Ordering::SeqCst);
    let _ = app.emit_to("main", "pip://detached-entered", ());
    let _ = app.emit_to(PIP_LABEL, "pip://detached-entered", ());
    Ok(())
}

#[tauri::command]
pub async fn pip_window_exit(
    app: AppHandle,
    state: tauri::State<'_, PipWindowState>,
) -> Result<(), String> {
    if !state.active.swap(false, Ordering::SeqCst) {
        return Ok(());
    }

    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        let main = app
            .get_webview_window("main")
            .ok_or_else(|| "main window missing".to_string())?;
        let main_hwnd = main.hwnd().map_err(|e| format!("hwnd: {e}"))?;
        if let Some(pip) = app.get_webview_window(PIP_LABEL) {
            if let Ok(pip_hwnd) = pip.hwnd() {
                let children = win::mpv_children(HWND(pip_hwnd.0 as *mut _));
                win::reparent(&children, HWND(main_hwnd.0 as *mut _))?;
            }
        }
    }
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    retarget_render(&app, "main").await?;

    if let Some(pip) = app.get_webview_window(PIP_LABEL) {
        let _ = pip.hide();
    }
    let _ = app.emit_to("main", "pip://detached-exited", ());
    // The player owns the video rect, so it re-asserts the geometry it wants.
    let _ = app.emit_to("main", "harbor:mpv-refresh-geom", ());
    Ok(())
}

/// Restore floating playback to Harbor and reveal its existing main window.
#[tauri::command]
pub async fn pip_window_restore(app: AppHandle, state: tauri::State<'_, PipWindowState>) -> Result<(), String> {
    pip_window_exit(app.clone(), state).await?;
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| format!("show: {e}"))?;
        main.unminimize().map_err(|e| format!("unminimize: {e}"))?;
        main.set_focus().map_err(|e| format!("focus: {e}"))?;
    }
    Ok(())
}

/// Keeps the surface filling the frame while the viewer drags or resizes it.
#[tauri::command]
pub async fn pip_window_fit(
    app: AppHandle,
    state: tauri::State<'_, PipWindowState>,
) -> Result<(), String> {
    if !state.active.load(Ordering::SeqCst) {
        return Ok(());
    }
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::HWND;
        let Some(pip) = app.get_webview_window(PIP_LABEL) else {
            return Ok(());
        };
        let pip_hwnd = pip.hwnd().map_err(|e| format!("pip hwnd: {e}"))?;
        let host = HWND(pip_hwnd.0 as *mut _);
        win::fill(&win::mpv_children(host), host);
    }
    #[cfg(not(windows))]
    {
        // The GL area and the mac view both follow their window's own resize.
        let _ = &app;
    }
    Ok(())
}

#[tauri::command]
pub fn pip_window_active(state: tauri::State<'_, PipWindowState>) -> bool {
    state.active.load(Ordering::SeqCst)
}
