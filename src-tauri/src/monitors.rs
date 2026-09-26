//! Monitor enumeration and targeting for per-mode display selection.
//!
//! Windows-only in practice: the settings that drive it are gated to Windows in
//! the UI, and `mpv`'s separate-window `screen` option (the thing the resolved
//! ordinal feeds) only exists on the win32 VO. On other platforms the commands
//! return empty / are inert so the frontend simply hides the pickers.
//!
//! Identity note: there is no perfectly stable monitor key on Windows. We store a
//! full snapshot and resolve with a fallback chain (PnP DeviceID -> GDI device
//! name -> position+size -> Automatic), which is the honest ceiling when two
//! identical monitors report no EDID serial.

use serde::{Deserialize, Serialize};

/// A display as presented to the frontend picker and stored in settings.
///
/// `id` is the stable-ish persistence key (`device_id` when available, otherwise
/// the GDI device name). The remaining fields exist so the label can show a real
/// name + resolution, and so `resolve_monitor` can fall back on geometry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub id: String,
    /// GDI device name, e.g. `\\.\DISPLAY1`. Matches `MONITORINFOEXW.szDevice`,
    /// Tauri's `Monitor::name()`, and the string the HDR code keys on.
    pub device_name: String,
    /// Plug-and-play instance id from `EnumDisplayDevicesW`, e.g.
    /// `MONITOR\DEL42A3\{...}`. Empty when the driver reports nothing.
    pub device_id: String,
    /// Human-friendly model string, e.g. `DELL U2723QE`.
    pub name: String,
    pub is_primary: bool,
    /// Physical pixels, top-left of the virtual desktop.
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

/// What `resolve_monitor` returns: everything a caller needs to place a window.
#[cfg(windows)]
#[derive(Debug, Clone, Copy)]
pub struct ResolvedMonitor {
    /// 0-based `EnumDisplayMonitors` ordinal, matching mpv's win32 `screen`.
    pub screen_index: i32,
    /// Monitor handle, for the DisplayConfig/HDR calls.
    pub hmon: windows::Win32::Graphics::Gdi::HMONITOR,
    /// Full physical monitor rect (`rcMonitor`), covers the taskbar.
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    /// Usable work-area rect (`rcWork`), excludes the taskbar/docked bars.
    pub work_x: i32,
    pub work_y: i32,
    pub work_width: u32,
    pub work_height: u32,
}

/// The platform identity string stored as `MonitorInfo.id`.
fn monitor_id(device_id: &str, device_name: &str) -> String {
    if device_id.is_empty() {
        device_name.to_string()
    } else {
        device_id.to_string()
    }
}

#[cfg(windows)]
mod imp {
    use super::{monitor_id, MonitorInfo, ResolvedMonitor};
    use windows::core::{BOOL, PCWSTR};
    use windows::Win32::Foundation::{HWND, LPARAM, RECT};
    use windows::Win32::Graphics::Gdi::{
        EnumDisplayDevicesW, EnumDisplayMonitors, GetMonitorInfoW, MonitorFromWindow,
        DISPLAY_DEVICEW, DISPLAY_DEVICE_ATTACHED_TO_DESKTOP, HDC, HMONITOR, MONITORINFOEXW,
        MONITOR_DEFAULTTONEAREST,
    };
    use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI};

    fn wide_to_string(raw: &[u16]) -> String {
        String::from_utf16_lossy(
            &raw.iter()
                .take_while(|&&c| c != 0)
                .copied()
                .collect::<Vec<u16>>(),
        )
    }

    /// Friendly model name and stable id for the display behind a GDI device name
    /// (`\\.\DISPLAY1`).
    ///
    /// The name comes from the DisplayConfig API (`monitorFriendlyDeviceName`),
    /// which is the EDID-derived string Windows Settings shows (e.g. "KGS241Q").
    /// `EnumDisplayDevicesW` is only the fallback: its monitor `DeviceString` is
    /// frequently the generic "Generic PnP Monitor" even when DisplayConfig has
    /// the real model, which is why every card originally read the same. The id
    /// still prefers the `MONITOR\...` PnP id from `EnumDisplayDevicesW`, falling
    /// back to the DisplayConfig device path when that is unavailable.
    fn friendly_name_for(device_name: &str) -> (String, String) {
        let (enum_name, enum_id) = enum_display_device_for(device_name);
        let (dc_name, dc_path) = display_config_for(device_name);

        let name = [dc_name, enum_name]
            .into_iter()
            .map(|n| n.trim().to_string())
            .find(|n| !is_generic_monitor_name(n))
            .unwrap_or_default();
        let id = if enum_id.is_empty() { dc_path } else { enum_id };
        (name, id)
    }

    /// `EnumDisplayDevicesW` for the monitor on this adapter: its `DeviceString`
    /// (often generic) and `MONITOR\...` PnP id. Index 0 is the adapter; monitors
    /// start at index 1.
    fn enum_display_device_for(device_name: &str) -> (String, String) {
        let dev_name: Vec<u16> = device_name.encode_utf16().chain(std::iter::once(0)).collect();
        let adapter = read_display_device(0, &dev_name);
        let mut name = String::new();
        let mut id = String::new();
        for index in 1..8u32 {
            match read_display_device(index, &dev_name) {
                Some((monitor_name, monitor_id, true)) => {
                    if id.is_empty() {
                        id = monitor_id;
                    }
                    if name.is_empty() && !is_generic_monitor_name(&monitor_name) {
                        name = monitor_name;
                    }
                    if !name.is_empty() && !id.is_empty() {
                        break;
                    }
                }
                Some(_) => continue,
                None => break,
            }
        }
        if let Some((adapter_name, adapter_id, _)) = adapter {
            if id.is_empty() {
                id = adapter_id;
            }
            if name.is_empty() && !is_generic_monitor_name(&adapter_name) {
                name = adapter_name;
            }
        }
        (name, id)
    }

    fn read_display_device(index: u32, dev_name: &[u16]) -> Option<(String, String, bool)> {
        let mut dd = DISPLAY_DEVICEW::default();
        dd.cb = std::mem::size_of::<DISPLAY_DEVICEW>() as u32;
        let ok = unsafe { EnumDisplayDevicesW(PCWSTR(dev_name.as_ptr()), index, &mut dd, 0) };
        if !ok.as_bool() {
            return None;
        }
        let attached = dd.StateFlags & DISPLAY_DEVICE_ATTACHED_TO_DESKTOP
            == DISPLAY_DEVICE_ATTACHED_TO_DESKTOP;
        Some((
            wide_to_string(&dd.DeviceString),
            wide_to_string(&dd.DeviceID),
            attached,
        ))
    }

    /// DisplayConfig friendly name and device path for the monitor whose source
    /// GDI name matches `device_name`. Empty strings when the query fails or no
    /// path matches.
    fn display_config_for(device_name: &str) -> (String, String) {
        use windows::Win32::Devices::Display::{
            DisplayConfigGetDeviceInfo, GetDisplayConfigBufferSizes, QueryDisplayConfig,
            DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME, DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
            DISPLAYCONFIG_MODE_INFO, DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_SOURCE_DEVICE_NAME,
            DISPLAYCONFIG_TARGET_DEVICE_NAME, QDC_ONLY_ACTIVE_PATHS,
        };
        use windows::Win32::Foundation::WIN32_ERROR;

        let mut path_count = 0u32;
        let mut mode_count = 0u32;
        if unsafe {
            GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count)
        } != WIN32_ERROR(0)
            || path_count == 0
            || path_count > 64
        {
            return (String::new(), String::new());
        }
        let mut paths: Vec<DISPLAYCONFIG_PATH_INFO> = Vec::new();
        paths.resize_with(path_count as usize, DISPLAYCONFIG_PATH_INFO::default);
        let mut modes: Vec<DISPLAYCONFIG_MODE_INFO> = Vec::new();
        modes.resize_with(mode_count.max(1) as usize, DISPLAYCONFIG_MODE_INFO::default);
        if unsafe {
            QueryDisplayConfig(
                QDC_ONLY_ACTIVE_PATHS,
                &mut path_count,
                paths.as_mut_ptr(),
                &mut mode_count,
                modes.as_mut_ptr(),
                None,
            )
        } != WIN32_ERROR(0)
        {
            return (String::new(), String::new());
        }
        for path in paths.iter().take(path_count as usize) {
            let mut source = DISPLAYCONFIG_SOURCE_DEVICE_NAME::default();
            source.header.r#type = DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME;
            source.header.size = std::mem::size_of::<DISPLAYCONFIG_SOURCE_DEVICE_NAME>() as u32;
            source.header.adapterId = path.sourceInfo.adapterId;
            source.header.id = path.sourceInfo.id;
            if unsafe { DisplayConfigGetDeviceInfo(&mut source.header) } != 0 {
                continue;
            }
            if wide_to_string(&source.viewGdiDeviceName) != device_name {
                continue;
            }

            let mut target = DISPLAYCONFIG_TARGET_DEVICE_NAME::default();
            target.header.r#type = DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME;
            target.header.size = std::mem::size_of::<DISPLAYCONFIG_TARGET_DEVICE_NAME>() as u32;
            target.header.adapterId = path.targetInfo.adapterId;
            target.header.id = path.targetInfo.id;
            if unsafe { DisplayConfigGetDeviceInfo(&mut target.header) } != 0 {
                continue;
            }
            return (
                wide_to_string(&target.monitorFriendlyDeviceName),
                wide_to_string(&target.monitorDevicePath),
            );
        }
        (String::new(), String::new())
    }

    /// True when a monitor name carries no model information, so callers fall
    /// back to the device name instead of showing the same string on every
    /// display. Windows reports these when the EDID never reached the driver
    /// (KVM, DisplayLink dock, virtual display).
    fn is_generic_monitor_name(name: &str) -> bool {
        let lower = name.trim().to_ascii_lowercase();
        lower.is_empty()
            || lower == "generic pnp monitor"
            || lower == "generic monitor"
            || lower == "generic non-pnp monitor"
    }

    fn scale_factor_for(hmon: HMONITOR) -> f64 {
        let mut dpi_x = 0u32;
        let mut dpi_y = 0u32;
        if unsafe { GetDpiForMonitor(hmon, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y) }.is_ok() {
            if dpi_x > 0 {
                return dpi_x as f64 / 96.0;
            }
        }
        1.0
    }

    struct CollectState {
        out: Vec<MonitorInfo>,
        index: i32,
    }

    unsafe extern "system" fn collect_proc(
        hmon: HMONITOR,
        _hdc: HDC,
        _rc: *mut RECT,
        lparam: LPARAM,
    ) -> BOOL {
        let state = &mut *(lparam.0 as *mut CollectState);
        let mut mi = MONITORINFOEXW::default();
        mi.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
        if GetMonitorInfoW(hmon, &mut mi.monitorInfo).as_bool() {
            let device_name = wide_to_string(&mi.szDevice);
            let (name, device_id) = friendly_name_for(&device_name);
            let r = mi.monitorInfo.rcMonitor;
            state.out.push(MonitorInfo {
                id: monitor_id(&device_id, &device_name),
                device_name,
                device_id,
                name,
                is_primary: mi.monitorInfo.dwFlags & 1 != 0,
                x: r.left,
                y: r.top,
                width: (r.right - r.left).max(0) as u32,
                height: (r.bottom - r.top).max(0) as u32,
                scale_factor: scale_factor_for(hmon),
            });
        }
        state.index += 1;
        BOOL(1)
    }

    /// Enumerate every display in `EnumDisplayMonitors` order (the same order
    /// mpv's win32 backend counts for the `screen` option).
    pub fn list() -> Vec<MonitorInfo> {
        let mut state = CollectState {
            out: Vec::new(),
            index: 0,
        };
        let state_ptr = &mut state as *mut CollectState;
        let _ = unsafe {
            EnumDisplayMonitors(None, None, Some(collect_proc), LPARAM(state_ptr as isize))
        };
        state.out
    }

    /// Resolve a stored snapshot to a live monitor, using
    /// DeviceID -> GDI device name -> position+size, else None (caller falls
    /// back to Automatic).
    pub fn resolve(saved: &MonitorInfo) -> Option<ResolvedMonitor> {
        let current = list();
        let by_device_id: Vec<&MonitorInfo> = current
            .iter()
            .filter(|m| !saved.device_id.is_empty() && m.device_id == saved.device_id)
            .collect();
        let by_device_name: Vec<&MonitorInfo> = current
            .iter()
            .filter(|m| !saved.device_name.is_empty() && m.device_name == saved.device_name)
            .collect();

        let chosen = if by_device_id.len() == 1 {
            Some(by_device_id[0])
        } else if by_device_id.len() > 1 {
            // Identical models share a PnP id; the arrangement is what tells them
            // apart, then the primary, then enumeration order.
            by_device_id
                .iter()
                .copied()
                .find(|m| m.x == saved.x && m.y == saved.y && m.width == saved.width)
                .or_else(|| by_device_id.iter().copied().find(|m| m.is_primary))
                .or_else(|| by_device_id.first().copied())
        } else if by_device_name.len() == 1 {
            Some(by_device_name[0])
        } else {
            current
                .iter()
                .find(|m| m.x == saved.x && m.y == saved.y && m.width == saved.width && m.height == saved.height)
        }?;

        resolve_by_device_name(&chosen.device_name)
    }

    /// Resolve by GDI device name directly (used for the "main window's monitor"
    /// fallback path too).
    pub fn resolve_by_device_name(device_name: &str) -> Option<ResolvedMonitor> {
        // Find the HMONITOR whose szDevice matches, via a quick scan.
        struct NameState<'a> {
            device_name: &'a str,
            index: i32,
            found: Option<ResolvedMonitor>,
        }
        unsafe extern "system" fn name_proc(
            hmon: HMONITOR,
            _hdc: HDC,
            _rc: *mut RECT,
            lparam: LPARAM,
        ) -> BOOL {
            let state = &mut *(lparam.0 as *mut NameState);
            let mut mi = MONITORINFOEXW::default();
            mi.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
            if GetMonitorInfoW(hmon, &mut mi.monitorInfo).as_bool()
                && wide_to_string(&mi.szDevice) == state.device_name
            {
                let r = mi.monitorInfo.rcMonitor;
                let w = mi.monitorInfo.rcWork;
                state.found = Some(ResolvedMonitor {
                    screen_index: state.index,
                    hmon,
                    x: r.left,
                    y: r.top,
                    width: (r.right - r.left).max(0) as u32,
                    height: (r.bottom - r.top).max(0) as u32,
                    work_x: w.left,
                    work_y: w.top,
                    work_width: (w.right - w.left).max(0) as u32,
                    work_height: (w.bottom - w.top).max(0) as u32,
                });
                return BOOL(0);
            }
            state.index += 1;
            BOOL(1)
        }
        let mut state = NameState {
            device_name,
            index: 0,
            found: None,
        };
        let _ = unsafe {
            EnumDisplayMonitors(
                None,
                None,
                Some(name_proc),
                LPARAM(&mut state as *mut NameState as isize),
            )
        };
        state.found
    }

    /// Ordinal + geometry of the monitor a window currently sits on.
    pub fn resolve_for_hwnd(hwnd_raw: isize) -> Option<ResolvedMonitor> {
        let hwnd = HWND(hwnd_raw as *mut _);
        let hmon = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
        if hmon.is_invalid() {
            return None;
        }
        let mut mi = MONITORINFOEXW::default();
        mi.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
        let device_name = if unsafe { GetMonitorInfoW(hmon, &mut mi.monitorInfo) }.as_bool() {
            wide_to_string(&mi.szDevice)
        } else {
            String::new()
        };
        if device_name.is_empty() {
            return None;
        }
        resolve_by_device_name(&device_name)
    }
}

#[cfg(windows)]
pub use imp::{list, resolve, resolve_for_hwnd};
#[cfg(not(windows))]
pub fn list() -> Vec<MonitorInfo> {
    Vec::new()
}

/// The `list_monitors` command payload.
#[tauri::command]
pub fn list_monitors() -> Vec<MonitorInfo> {
    list()
}

/// Where a window should open given an explicit choice: the resolved monitor when
/// the user picked one and it is still connected, else `None` meaning "leave it
/// where the OS put it" (Automatic / follow Harbor).
#[cfg(windows)]
pub fn resolve_or_default(saved: Option<&MonitorInfo>) -> Option<ResolvedMonitor> {
    if let Some(s) = saved {
        if let Some(m) = resolve(s) {
            return Some(m);
        }
    }
    None
}

/// Move the main window onto the chosen monitor and size it to fill that monitor,
/// so a following fullscreen/framing lands on the right screen.
///
/// Windows-only; a no-op elsewhere. Idempotent when the monitor is gone (the
/// event is simply not applied). Deliberately does *not* touch fullscreen state:
/// Big Picture drives that itself right after.
pub fn move_window_to_monitor(
    window: &tauri::WebviewWindow,
    resolved: &ResolvedMonitorTarget,
) -> Result<(), String> {
    // Unmaximize first: SetWindowPos position is ignored while maximized, and the
    // window-state plugin restores MAXIMIZED at launch.
    let _ = window.unmaximize();
    let _ = window.set_fullscreen(false);
    window
        .set_position(tauri::PhysicalPosition::new(resolved.x, resolved.y))
        .map_err(|e| format!("set_position: {e}"))?;
    window
        .set_size(tauri::PhysicalSize::new(resolved.width, resolved.height))
        .map_err(|e| format!("set_size: {e}"))?;
    Ok(())
}

/// Geometry a move needs, kept platform-neutral so the command compiles
/// everywhere.
#[derive(Debug, Clone, Copy)]
pub struct ResolvedMonitorTarget {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl From<ResolvedMonitor> for ResolvedMonitorTarget {
    fn from(r: ResolvedMonitor) -> Self {
        Self {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
        }
    }
}

/// Move the main window onto the monitor described by a stored snapshot.
/// Returns `true` when it moved; `false` when the monitor is gone (caller keeps
/// current placement).
#[tauri::command]
pub async fn move_main_to_monitor(
    app: tauri::AppHandle,
    monitor: MonitorInfo,
) -> Result<bool, String> {
    #[cfg(windows)]
    {
        use tauri::Manager;
        let Some(window) = app.get_webview_window("main") else {
            return Err("main window missing".into());
        };
        let Some(resolved) = resolve(&monitor) else {
            return Ok(false);
        };
        move_window_to_monitor(&window, &resolved.into())?;
        Ok(true)
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        let _ = monitor;
        Ok(false)
    }
}
