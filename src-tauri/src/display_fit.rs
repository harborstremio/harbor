use tauri::{LogicalSize, Manager, PhysicalPosition, WebviewWindow};

const CONFIG_MIN_W: f64 = 960.0;
const CONFIG_MIN_H: f64 = 600.0;
const FLOOR_W: f64 = 480.0;
const FLOOR_H: f64 = 400.0;
const MARGIN: f64 = 0.94;

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
    let Some((mon_w, mon_h, mon_pos, scale)) = logical_monitor(window) else {
        return;
    };

    let usable_w = (mon_w * MARGIN).max(FLOOR_W);
    let usable_h = (mon_h * MARGIN).max(FLOOR_H);
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
    if (want_w - cur_w).abs() < 1.0 && (want_h - cur_h).abs() < 1.0 {
        return;
    }
    let _ = window.set_size(LogicalSize::new(want_w, want_h));

    let left = mon_pos.x as f64 + ((mon_w - want_w) / 2.0) * scale;
    let top = mon_pos.y as f64 + ((mon_h - want_h) / 2.0) * scale;
    let _ = window.set_position(PhysicalPosition::new(left.round() as i32, top.round() as i32));
}

pub fn install(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    fit_to_monitor(&window);
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
}
