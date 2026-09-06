use tauri::{LogicalSize, Manager, PhysicalPosition, WebviewWindow};
use tauri_plugin_window_state::AppHandleExt;

const CONFIG_MIN_W: f64 = 960.0;
const CONFIG_MIN_H: f64 = 600.0;
const FLOOR_W: f64 = 480.0;
const FLOOR_H: f64 = 400.0;
const MARGIN: f64 = 0.94;

fn clamp_origin(current: f64, visible_start: f64, visible_len: f64, window_len: f64) -> f64 {
    let max = visible_start + (visible_len - window_len).max(0.0);
    current.clamp(visible_start, max)
}

/// True when the window-state plugin has a non-default saved geometry for the
/// `main` window. `tauri-plugin-window-state` restores that saved geometry
/// while the window is being created (before our `setup` code runs) and only
/// ever persists a state that differs from `WindowState::default()`, so when
/// this returns true the restore already happened and fitting must not run.
fn has_saved_window_state(app: &tauri::AppHandle) -> bool {
    let Ok(dir) = app.path().app_config_dir() else {
        return false;
    };
    let Ok(text) = std::fs::read_to_string(dir.join(app.filename())) else {
        return false;
    };
    let Ok(states) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&text) else {
        return false;
    };
    let Some(state) = states.get("main") else {
        return false;
    };
    let number = |key: &str| state.get(key).and_then(serde_json::Value::as_f64).unwrap_or(0.0);
    let flag = |key: &str| state.get(key).and_then(serde_json::Value::as_bool).unwrap_or(false);
    number("width") > 0.0
        || number("height") > 0.0
        || number("x") != 0.0
        || number("y") != 0.0
        || flag("maximized")
}

#[cfg(target_os = "macos")]
fn macos_screen_insets(window: &WebviewWindow) -> Option<(f64, f64, f64, f64)> {
    let _mtm = objc2_foundation::MainThreadMarker::new()?;
    let ns_window_ptr = window.ns_window().ok()? as i64;
    if ns_window_ptr == 0 {
        return None;
    }
    unsafe {
        use objc2_app_kit::NSWindow;
        let raw: *mut objc2::runtime::AnyObject = ns_window_ptr as *mut objc2::runtime::AnyObject;
        let ns_win: &NSWindow = &*(raw as *const NSWindow);
        let screen = ns_win.screen()?;
        let screen_frame = screen.frame();
        let visible_frame = screen.visibleFrame();

        let top_inset = (screen_frame.origin.y + screen_frame.size.height)
            - (visible_frame.origin.y + visible_frame.size.height);
        let bottom_inset = visible_frame.origin.y - screen_frame.origin.y;
        let left_inset = visible_frame.origin.x - screen_frame.origin.x;
        let right_inset = (screen_frame.origin.x + screen_frame.size.width)
            - (visible_frame.origin.x + visible_frame.size.width);

        Some((
            top_inset.max(0.0),
            bottom_inset.max(0.0),
            left_inset.max(0.0),
            right_inset.max(0.0),
        ))
    }
}

#[cfg(target_os = "windows")]
fn windows_work_area_insets(window: &WebviewWindow) -> (f64, f64, f64, f64) {
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    let Ok(hwnd) = window.hwnd() else {
        return (0.0, 0.0, 0.0, 0.0);
    };
    let scale = window.current_monitor().ok().flatten().map(|m| m.scale_factor()).unwrap_or(1.0);
    if !(scale > 0.0) {
        return (0.0, 0.0, 0.0, 0.0);
    }
    let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
    let mut mi = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };
    if !unsafe { GetMonitorInfoW(monitor, &mut mi) }.as_bool() {
        return (0.0, 0.0, 0.0, 0.0);
    }
    // rcWork excludes the taskbar and other reserved screen areas; rcMonitor
    // is the full rect. Both are physical pixels, so divide by scale to report
    // logical insets like macos_screen_insets does.
    (
        ((mi.rcWork.top - mi.rcMonitor.top).max(0) as f64) / scale,
        ((mi.rcMonitor.bottom - mi.rcWork.bottom).max(0) as f64) / scale,
        ((mi.rcWork.left - mi.rcMonitor.left).max(0) as f64) / scale,
        ((mi.rcMonitor.right - mi.rcWork.right).max(0) as f64) / scale,
    )
}

fn logical_monitor(window: &WebviewWindow) -> Option<(f64, f64, PhysicalPosition<i32>, f64)> {
    let monitor = window.current_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    if !(scale > 0.0) {
        return None;
    }
    let size = monitor.size();
    if size.width == 0 || size.height == 0 {
        return None;
    }
    Some((
        size.width as f64 / scale,
        size.height as f64 / scale,
        *monitor.position(),
        scale,
    ))
}

pub fn fit_to_monitor(window: &WebviewWindow) {
    // A maximized window already fills the work area; the size/position calls
    // below would un-maximize it, which is what overwrites a restored state.
    if let Ok(true) = window.is_maximized() {
        return;
    }
    let Some((mon_w, mon_h, mon_pos, scale)) = logical_monitor(window) else {
        return;
    };

    #[cfg(target_os = "macos")]
    let (top_inset, bottom_inset, left_inset, right_inset) =
        macos_screen_insets(window).unwrap_or((0.0, 0.0, 0.0, 0.0));
    #[cfg(target_os = "windows")]
    let (top_inset, bottom_inset, left_inset, right_inset) = windows_work_area_insets(window);
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let (top_inset, bottom_inset, left_inset, right_inset) = (0.0, 0.0, 0.0, 0.0);

    let vis_w = (mon_w - left_inset - right_inset).max(FLOOR_W);
    let vis_h = (mon_h - top_inset - bottom_inset).max(FLOOR_H);

    let usable_w = (vis_w * MARGIN).max(FLOOR_W);
    let usable_h = (vis_h * MARGIN).max(FLOOR_H);
    let min_w = CONFIG_MIN_W.min(usable_w).max(FLOOR_W);
    let min_h = CONFIG_MIN_H.min(usable_h).max(FLOOR_H);

    if min_w < CONFIG_MIN_W || min_h < CONFIG_MIN_H {
        let _ = window.set_min_size(Some(LogicalSize::new(min_w, min_h)));
    }

    let Ok(inner) = window.inner_size() else {
        return;
    };
    let cur_w = inner.width as f64 / scale;
    let cur_h = inner.height as f64 / scale;
    let want_w = cur_w.min(usable_w).max(min_w);
    let want_h = cur_h.min(usable_h).max(min_h);
    let resized = (want_w - cur_w).abs() >= 1.0 || (want_h - cur_h).abs() >= 1.0;
    if resized {
        let _ = window.set_size(LogicalSize::new(want_w, want_h));
    }

    let visible_left = mon_pos.x as f64 + left_inset * scale;
    let visible_top = mon_pos.y as f64 + top_inset * scale;
    let visible_width = vis_w * scale;
    let visible_height = vis_h * scale;
    let window_width = want_w * scale;
    let window_height = want_h * scale;
    let (left, top) = if resized {
        (
            visible_left + ((visible_width - window_width).max(0.0) / 2.0),
            visible_top + ((visible_height - window_height).max(0.0) / 2.0),
        )
    } else {
        let Ok(position) = window.outer_position() else {
            return;
        };
        (
            clamp_origin(position.x as f64, visible_left, visible_width, window_width),
            clamp_origin(
                position.y as f64,
                visible_top,
                visible_height,
                window_height,
            ),
        )
    };
    let target = PhysicalPosition::new(left.round() as i32, top.round() as i32);
    if resized || window.outer_position().ok() != Some(target) {
        let _ = window.set_position(target);
    }
}

pub fn install(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    // Only fit on the very first launch, when there is no saved geometry yet.
    // Once the user has a saved position/size, the plugin's restore already
    // ran during window creation and fitting would clobber it.
    if has_saved_window_state(app) {
        return;
    }
    #[cfg(target_os = "macos")]
    {
        let win = window.clone();
        let _ = app.run_on_main_thread(move || {
            fit_to_monitor(&win);
        });
    }
    #[cfg(not(target_os = "macos"))]
    {
        fit_to_monitor(&window);
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn portrait_1080p_at_125_percent_relaxes_min_width() {
        let mon_w = 1080.0 / 1.25;
        let usable = (mon_w * super::MARGIN).max(super::FLOOR_W);
        let min_w = super::CONFIG_MIN_W.min(usable).max(super::FLOOR_W);
        assert!(min_w < super::CONFIG_MIN_W);
        assert!(min_w <= mon_w);
    }

    #[test]
    fn landscape_1440p_keeps_configured_minimum() {
        let mon_w = 2560.0;
        let usable = (mon_w * super::MARGIN).max(super::FLOOR_W);
        let min_w = super::CONFIG_MIN_W.min(usable).max(super::FLOOR_W);
        assert_eq!(min_w, super::CONFIG_MIN_W);
    }

    #[test]
    fn never_below_absolute_floor() {
        let mon_w = 320.0;
        let usable = (mon_w * super::MARGIN).max(super::FLOOR_W);
        let min_w = super::CONFIG_MIN_W.min(usable).max(super::FLOOR_W);
        assert_eq!(min_w, super::FLOOR_W);
    }

    #[test]
    fn clamps_an_existing_window_inside_the_visible_frame() {
        assert_eq!(super::clamp_origin(-20.0, 24.0, 1000.0, 900.0), 24.0);
        assert_eq!(super::clamp_origin(300.0, 24.0, 1000.0, 900.0), 124.0);
        assert_eq!(super::clamp_origin(80.0, 24.0, 1000.0, 900.0), 80.0);
    }
}
