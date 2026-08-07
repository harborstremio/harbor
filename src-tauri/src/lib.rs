mod browser;
mod http_fetch;
mod settings_store;
mod streams;
mod webview_helpers;
mod stremio_auth;
mod download;

#[cfg(desktop)]
mod anime4k;
#[cfg(desktop)]
mod cast;
#[cfg(desktop)]
mod cast_hls;
#[cfg(desktop)]
mod cast_server;
#[cfg(desktop)]
mod cast_subs;
#[cfg(desktop)]
mod cf_relay;
#[cfg(desktop)]
mod discord_rp;
#[cfg(desktop)]
mod dlna;
#[cfg(desktop)]
mod dvr;
#[cfg(desktop)]
mod fonts;
#[cfg(desktop)]
mod fullscreen;
#[cfg(desktop)]
mod hdr_overlay;
mod local_lib;
#[cfg(desktop)]
mod modal_overlay;
#[cfg(desktop)]
mod mpv;
#[cfg(desktop)]
mod multiview;
#[cfg(desktop)]
mod proc_mem;
#[cfg(desktop)]
mod roku;
#[cfg(all(desktop, target_os = "macos"))]
mod mpv_render_mac;
#[cfg(all(desktop, target_os = "linux"))]
mod mpv_render_linux;
#[cfg(desktop)]
mod pip;
#[cfg(all(desktop, target_os = "macos"))]
mod pip_mac;
#[cfg(desktop)]
mod power;
#[cfg(desktop)]
mod airplay;
#[cfg(desktop)]
mod stream_proxy;
#[cfg(desktop)]
mod svp;
#[cfg(desktop)]
mod thumbs;
#[cfg(desktop)]
mod torrent_engine;
#[cfg(desktop)]
mod trailer;
#[cfg(desktop)]
mod transcode;
#[cfg(desktop)]
mod tray;
#[cfg(not(desktop))]
mod tray {
    use serde::{Deserialize, Serialize};
    use tauri::AppHandle;

    #[derive(Serialize, Deserialize, Clone, Copy)]
    #[serde(rename_all = "camelCase")]
    pub struct TrayPrefs {
        pub close_to_tray: bool,
        pub always_on_top: bool,
        pub pause_minimized: bool,
        pub pause_unfocused: bool,
    }

    #[derive(Clone, Copy)]
    pub enum Pref {
        CloseToTray,
        AlwaysOnTop,
        PauseMinimized,
        PauseUnfocused,
    }

    pub fn build(_: &AppHandle) -> tauri::Result<()> {
        Ok(())
    }

    pub fn close_to_tray() -> bool {
        false
    }

    pub fn current_prefs() -> TrayPrefs {
        TrayPrefs {
            close_to_tray: false,
            always_on_top: false,
            pause_minimized: false,
            pause_unfocused: false,
        }
    }

    pub fn tray_set_prefs(_: AppHandle, _: TrayPrefs) {}

    pub fn toggle(_: &AppHandle, _: Pref) {}

    pub fn apply_always_on_top(_: &AppHandle, _: bool) {}

    pub fn show_main(_: &AppHandle) {}
}
mod web_server;

pub(crate) fn shutdown_services(app: &tauri::AppHandle) {
    #[cfg(desktop)]
    {
        cast_server::stop();
        torrent_engine::stop();
        discord_rp::shutdown(app);
    }
}

pub static CLOSE_FLUSH_DONE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
static CLOSE_IN_PROGRESS: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
fn harbor_flush_done() {
    CLOSE_FLUSH_DONE.store(true, std::sync::atomic::Ordering::SeqCst);
}

#[tauri::command]
fn close_aux_windows(app: tauri::AppHandle) {
    // Desktop: close auxiliary webview windows
    #[cfg(not(target_os = "android"))]
    {
        use tauri::Manager;
        for (label, window) in app.webview_windows() {
            if label != "main" {
                let _ = window.close();
            }
        }
    }
    // Android: nothing to do
}

#[cfg(desktop)]
#[tauri::command]
async fn deeplink_set_stremio(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_deep_link::DeepLinkExt;
    if enabled {
        app.deep_link()
            .register("stremio")
            .map_err(|e| format!("register stremio: {}", e))?;
    } else {
        let _ = app.deep_link().unregister("stremio");
    }
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
async fn deeplink_is_stremio_registered(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_deep_link::DeepLinkExt;
    app.deep_link()
        .is_registered("stremio")
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_text_file(path: String, contents: String) -> Result<(), String> {
    let target = std::path::PathBuf::from(&path);
    if let Some(parent) = target.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| format!("create folder: {}", e))?;
        }
    }
    std::fs::write(&target, contents.as_bytes()).map_err(|e| format!("write file: {}", e))
}

#[cfg(windows)]
fn make_main_transparent(app: &tauri::AppHandle) {
    use tauri::Manager;
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("[harbor::transparent] main window missing");
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
                let color = COREWEBVIEW2_COLOR { A: 0, R: 0, G: 0, B: 0 };
                match controller2.SetDefaultBackgroundColor(color) {
                    Ok(()) => eprintln!("[harbor::transparent] SetDefaultBackgroundColor OK (alpha=0)"),
                    Err(e) => eprintln!("[harbor::transparent] SetDefaultBackgroundColor FAILED: {:?}", e),
                }
            }
            Err(e) => eprintln!("[harbor::transparent] cast to Controller2 FAILED: {:?}", e),
        }
    });
    if let Err(e) = res {
        eprintln!("[harbor::transparent] with_webview FAILED: {:?}", e);
    }
}

#[cfg(windows)]
const HARBOR_MAXGUARD_SUBCLASS_ID: usize = 0x4842_4D47;

#[cfg(windows)]
unsafe extern "system" fn maxguard_subclass_proc(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    _id: usize,
    _data: usize,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows::Win32::UI::Shell::DefSubclassProc;
    use windows::Win32::UI::WindowsAndMessaging::{MINMAXINFO, WM_GETMINMAXINFO};
    let res = DefSubclassProc(hwnd, msg, wparam, lparam);
    if msg == WM_GETMINMAXINFO {
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut mi = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if GetMonitorInfoW(monitor, &mut mi).as_bool() {
            let mmi = &mut *(lparam.0 as *mut MINMAXINFO);
            mmi.ptMaxPosition.x = mi.rcWork.left - mi.rcMonitor.left;
            mmi.ptMaxPosition.y = mi.rcWork.top - mi.rcMonitor.top;
            mmi.ptMaxSize.x = mi.rcWork.right - mi.rcWork.left;
            mmi.ptMaxSize.y = mi.rcWork.bottom - mi.rcWork.top;
        }
    }
    res
}

#[cfg(windows)]
fn install_maximize_guard(app: &tauri::AppHandle) {
    use tauri::Manager;
    use windows::Win32::UI::Shell::SetWindowSubclass;
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("[harbor::maxguard] main window missing");
        return;
    };
    let Ok(hwnd) = window.hwnd() else {
        eprintln!("[harbor::maxguard] hwnd unavailable");
        return;
    };
    unsafe {
        let _ = SetWindowSubclass(hwnd, Some(maxguard_subclass_proc), HARBOR_MAXGUARD_SUBCLASS_ID, 0);
    }
    eprintln!("[harbor::maxguard] WM_GETMINMAXINFO work-area guard installed");
}

#[tauri::command]
fn harbor_set_webview_memory_low(app: tauri::AppHandle, low: bool) {
    #[cfg(windows)]
    {
        use tauri::Manager;
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        let _ = window.with_webview(move |webview| unsafe {
            use webview2_com::Microsoft::Web::WebView2::Win32::{
                ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
                COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
            };
            use windows::core::Interface;
            let controller = webview.controller();
            if let Ok(core) = controller.CoreWebView2() {
                if let Ok(w3) = core.cast::<ICoreWebView2_19>() {
                    let level = if low {
                        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
                    } else {
                        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
                    };
                    let _ = w3.SetMemoryUsageTargetLevel(level);
                }
            }
        });
    }
    #[cfg(not(windows))]
    {
        let _ = (&app, low);
    }
}

#[tauri::command]
fn harbor_set_webview_visible(app: tauri::AppHandle, visible: bool) {
    #[cfg(windows)]
    {
        use tauri::Manager;
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        let _ = window.with_webview(move |webview| unsafe {
            let _ = webview.controller().SetIsVisible(visible);
        });
    }
    #[cfg(not(windows))]
    {
        let _ = (&app, visible);
    }
}

#[tauri::command]
fn harbor_try_suspend_webview(app: tauri::AppHandle) {
    #[cfg(windows)]
    {
        use tauri::Manager;
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        let _ = window.with_webview(move |webview| unsafe {
            use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_3;
            use webview2_com::TrySuspendCompletedHandler;
            use windows::core::Interface;
            let controller = webview.controller();
            let _ = controller.SetIsVisible(false);
            if let Ok(core) = controller.CoreWebView2() {
                if let Ok(c3) = core.cast::<ICoreWebView2_3>() {
                    let handler = TrySuspendCompletedHandler::create(Box::new(|_hr, _ok| Ok(())));
                    let _ = c3.TrySuspend(&handler);
                }
            }
        });
    }
    #[cfg(not(windows))]
    {
        let _ = &app;
    }
}

#[tauri::command]
fn harbor_resume_webview(app: tauri::AppHandle) {
    #[cfg(windows)]
    {
        use tauri::Manager;
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        let _ = window.with_webview(move |webview| unsafe {
            use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_3;
            use windows::core::Interface;
            let controller = webview.controller();
            if let Ok(core) = controller.CoreWebView2() {
                if let Ok(c3) = core.cast::<ICoreWebView2_3>() {
                    let _ = c3.Resume();
                }
            }
            let _ = controller.SetIsVisible(true);
        });
    }
    #[cfg(not(windows))]
    {
        let _ = &app;
    }
}

#[cfg(not(target_os = "android"))]
fn ensure_window_on_screen(app: &tauri::AppHandle) {
    use tauri::Manager;
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let (pos, size) = match (window.outer_position(), window.outer_size()) {
        (Ok(p), Ok(s)) => (p, s),
        _ => return,
    };
    let monitors = match window.available_monitors() {
        Ok(m) if !m.is_empty() => m,
        _ => return,
    };
    let ww = size.width as i32;
    let wh = size.height as i32;
    let on_screen = monitors.iter().any(|m| {
        let mp = m.position();
        let ms = m.size();
        pos.x < mp.x + ms.width as i32
            && pos.x + ww > mp.x
            && pos.y < mp.y + ms.height as i32
            && pos.y + wh > mp.y
    });
    if on_screen {
        return;
    }
    let target = window
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| monitors.into_iter().next());
    let Some(mon) = target else {
        return;
    };
    let mp = mon.position();
    let ms = mon.size();
    let cx = mp.x + (ms.width as i32 - ww).max(0) / 2;
    let cy = mp.y + (ms.height as i32 - wh).max(0) / 2;
    let _ = window.set_position(tauri::PhysicalPosition::new(cx, cy));
    eprintln!("[harbor::window] launched off-screen; recentered to {},{}", cx, cy);
}

#[cfg(target_os = "android")]
fn ensure_window_on_screen(_: &tauri::AppHandle) {
    // no-op on Android
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    std::env::set_var("RUST_BACKTRACE", "1");
    std::env::set_var("RUST_LIB_BACKTRACE", "1");
    println!("Harbor lib run() starting...");
    #[cfg(target_os = "linux")]
    mpv_render_linux::enforce_nvidia_x11();
    let _ = rustls::crypto::ring::default_provider().install_default();
    #[cfg(desktop)]
    {
        trailer::sweep_cache();
        let proxy_state = tauri::async_runtime::block_on(stream_proxy::ProxyState::start())
            .unwrap_or_else(|e| {
                eprintln!("[stream-proxy] failed to start: {}", e);
                stream_proxy::ProxyState::placeholder()
            });
        let mpv_state = mpv::MpvState::new();
        let pip_state = pip::PipState::new();
        let fullscreen_state = fullscreen::FullscreenState::new();
        let thumbs_state = thumbs::ThumbsState::new();
        let dvr_state = dvr::DvrState::new();
    }
    #[cfg(desktop)]
    let multiview_state = multiview::MultiviewState::new();
    #[cfg(desktop)]
    let modal_overlay_state = modal_overlay::ModalOverlayState::new();
    #[cfg(desktop)]
    let app_builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            use tauri::{Emitter, Manager};
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            if let Some(url) = args.iter().find(|a| a.starts_with("harbor://")) {
                let _ = app.emit("harbor:stremio-deeplink", url.clone());
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED
                        | tauri_plugin_window_state::StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .manage(proxy_state)
        .manage(mpv_state)
        .manage(pip_state)
        .manage(fullscreen_state)
        .manage(thumbs_state)
        .manage(dvr_state)
        .manage(multiview_state)
        .manage(modal_overlay_state)
        .manage(discord_rp::DiscordState::new())
        .manage(download::DownloadState::new());

    #[cfg(not(desktop))]
    let app_builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .manage(download::DownloadState::new());

    #[cfg(target_os = "macos")]
    let app_builder = app_builder.register_uri_scheme_protocol("stremio", |ctx, request| {
        use tauri::Emitter;
        let url = request.uri().to_string();
        let _ = ctx.app_handle().emit("harbor:stremio-deeplink", url);
        tauri::http::Response::builder()
            .status(200)
            .header("content-type", "text/html; charset=utf-8")
            .body(b"<!doctype html><meta charset=\"utf-8\"><title>Harbor</title>".to_vec())
            .unwrap()
    });

    let app_builder = app_builder
        .setup(move |app| {
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                if let Err(e) = app.deep_link().register_all() {
                    eprintln!("[harbor::deep-link] register_all failed: {:?}", e);
                }
            }
            #[cfg(windows)]
            make_main_transparent(&app.handle());
            #[cfg(windows)]
            install_maximize_guard(&app.handle());
            #[cfg(windows)]
            {
                use tauri::Manager;
                if let Ok(res) = app.path().resource_dir() {
                    let mpv = res.join("mpv.exe");
                    if mpv.exists() {
                        thumbs::set_bundled_mpv(mpv);
                    }
                }
            }
            #[cfg(desktop)]
            ensure_window_on_screen(&app.handle());
            #[cfg(target_os = "macos")]
            {
                use tauri::Manager;
                if let Some(window) = app.handle().get_webview_window("main") {
                    if let Ok(ns_window) = window.ns_window() {
                        let ns_window_ptr = ns_window as i64;
                        if let Err(e) = mpv_render_mac::install_window_rounding(ns_window_ptr) {
                            eprintln!("[harbor::mac] rounding failed: {}", e);
                        }
                        if let Err(e) = mpv_render_mac::make_resizable(ns_window_ptr) {
                            eprintln!("[harbor::mac] resizable failed: {}", e);
                        }
                    }
                }
            }
            #[cfg(desktop)]
            cast_server::ensure_started_on_setup(&app.handle());
            #[cfg(desktop)]
            torrent_engine::ensure_started_on_setup(&app.handle());
            #[cfg(desktop)]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || discord_rp::run_loop(handle));
            }
            #[cfg(desktop)]
            if let Err(e) = tray::build(&app.handle()) {
                eprintln!("[harbor::tray] build failed: {:?}", e);
            }
            #[cfg(mobile)]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    if let Err(e) = window.set_zoom(0.75) {
                        eprintln!("[harbor] failed to set zoom: {}", e);
                    }
                }
            }
            Ok(())
        });
        
    #[cfg(not(target_os = "android"))]
    let app_builder = app_builder.on_window_event(|window, event| {
        if window.label() != "main" {
            return;
        }

        use tauri::Manager;

        match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if tray::close_to_tray() {
                    api.prevent_close();
                    let _ = window.hide();
                } else if !CLOSE_IN_PROGRESS.swap(
                    true,
                    std::sync::atomic::Ordering::SeqCst,
                ) {
                    use tauri::Emitter;

                    api.prevent_close();
                    CLOSE_FLUSH_DONE.store(
                        false,
                        std::sync::atomic::Ordering::SeqCst,
                    );

                    let _ = window.emit("harbor://app-closing", ());
                    let w = window.clone();

                    std::thread::spawn(move || {
                        for _ in 0..24 {
                            if CLOSE_FLUSH_DONE.load(
                                std::sync::atomic::Ordering::SeqCst,
                            ) {
                                break;
                            }

                            std::thread::sleep(std::time::Duration::from_millis(50));
                        }

                        let _ = w.close();
                    });
                }
            }

            tauri::WindowEvent::Focused(focused) => {
                use tauri::Emitter;

                let minimized = if *focused {
                    false
                } else {
                    window.is_minimized().unwrap_or(false)
                        || !window.is_visible().unwrap_or(true)
                };

                let _ = window.emit(
                    "harbor://window-activity",
                    serde_json::json!({
                        "focused": *focused,
                        "minimized": minimized
                    }),
                );
            }

            tauri::WindowEvent::Destroyed => {
                shutdown_services(window.app_handle());
            }

            _ => {}
        }
    });

    #[cfg(desktop)]
    {
        app_builder
            .invoke_handler(tauri::generate_handler![
                harbor_flush_done,
                close_aux_windows,
                power::power_inhibit,
                harbor_set_webview_memory_low,
                harbor_set_webview_visible,
                harbor_try_suspend_webview,
                harbor_resume_webview,
                save_text_file,
                cast_server::stop_stremio_sidecar,
                cast_server::cast_server_stop,
                web_server::web_serve_start,
                web_server::web_serve_stop,
                web_server::web_serve_status,
                anime4k::anime4k_download,
                anime4k::anime4k_dir,
                svp::svp_status,
                svp::svp_launch,
                svp::svp_apply,
                settings_store::settings_read,
                settings_store::settings_write,
                proc_mem::harbor_process_memory,
                trailer::fetch_trailer,
                download::download_start,
                download::download_cancel,
                stream_proxy::proxy_register,
                stream_proxy::proxy_unregister,
                stream_proxy::proxy_gc_idle,
                cf_relay::cf_list_accounts,
                cf_relay::cf_deploy_relay,
                cf_relay::cf_delete_relay,
                cf_relay::cf_relay_status,
                mpv::mpv_probe,
                mpv::mpv_start,
                mpv::mpv_command,
                mpv::mpv_set_property,
                mpv::mpv_get_property,
                mpv::mpv_set_geometry,
                mpv::mpv_force_below,
                mpv::mpv_export_log,
                mpv::mpv_set_hdr_stage,
                mpv::display_hdr_active,
                webview_helpers::webview_reapply_transparency,
                mpv::mpv_on_pip_changed,
                mpv::mpv_screenshot_data_url,
                mpv::mpv_save_screenshot,
                mpv::mpv_gif_start,
                mpv::mpv_gif_stop,
                mpv::mpv_gif_abort,
                mpv::mpv_clip_save,
                modal_overlay::modal_overlay_open,
                modal_overlay::modal_overlay_close,
                modal_overlay::modal_overlay_emit_state,
                modal_overlay::modal_overlay_emit_action,
                modal_overlay::modal_overlay_sync,
                modal_overlay::modal_overlay_get_pending,
                hdr_overlay::hdr_overlay_open,
                hdr_overlay::hdr_overlay_close,
                hdr_overlay::hdr_overlay_sync,
                hdr_overlay::hdr_overlay_emit_props,
                hdr_overlay::hdr_overlay_emit_action,
                mpv::mpv_sub_add,
                mpv::sub_download,
                mpv::mpv_stop,
                pip::pip_open,
                pip::pip_get_session,
                pip::pip_close,
                pip::pip_publish_state,
                pip::window_pip_enter,
                pip::window_pip_exit,
                fullscreen::window_fullscreen_enter,
                fullscreen::window_fullscreen_exit,
                browser::browser_open,
                browser::browser_close,
                thumbs::thumbs_set_url,
                thumbs::thumbs_spawn_eager,
                thumbs::thumbs_get,
                thumbs::thumbs_stop,
                dvr::dvr_start,
                dvr::dvr_stop,
                dvr::dvr_list,
                dvr::dvr_default_dir,
                dvr::dvr_reveal,
                multiview::multiview_open,
                multiview::multiview_prespawn,
                multiview::multiview_geometry,
                multiview::multiview_audio_focus,
                multiview::multiview_close,
                multiview::multiview_visibility,
                multiview::multiview_stop_all,
                http_fetch::harbor_fetch,
                discord_rp::discord_set_presence,
                discord_rp::discord_clear,
                discord_rp::discord_set_enabled,
                cast::cast_discover,
                dlna::lan_ip,
                cast::cast_load,
                cast::cast_play,
                cast::cast_pause,
                cast::cast_seek,
                cast::cast_stop,
                cast::cast_status,
                cast_server::cast_server_status,
                cast_server::cast_server_restart,
                torrent_engine::torrent_engine_status,
                torrent_engine::torrent_engine_add,
                torrent_engine::torrent_engine_select,
                torrent_engine::torrent_engine_stats,
                torrent_engine::torrent_engine_remove,
                torrent_engine::torrent_engine_selftest,
                torrent_engine::torrent_engine_restart,
                torrent_engine::torrent_engine_hard_reset,
                torrent_engine::torrent_engine_set_options,
                transcode::cast_ffmpeg_present,
                streams::streams_run_pipeline,
                streams::streams_parse,
                streams::streams_core_version,
                local_lib::harbor_scan_folder,
                tray::tray_set_prefs,
                stremio_auth::stremio_auth_start,
                deeplink_set_stremio,
                deeplink_is_stremio_registered,
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }

    #[cfg(mobile)]
    {
        app_builder
            .invoke_handler(tauri::generate_handler![
                harbor_flush_done,
                close_aux_windows,
                browser::browser_open,
                browser::browser_close,
                harbor_set_webview_memory_low,
                harbor_set_webview_visible,
                harbor_try_suspend_webview,
                harbor_resume_webview,
                save_text_file,
                web_server::web_serve_start,
                web_server::web_serve_stop,
                web_server::web_serve_status,
                settings_store::settings_read,
                settings_store::settings_write,
                streams::streams_run_pipeline,
                streams::streams_parse,
                streams::streams_core_version,
                local_lib::harbor_scan_folder,
                download::download_start,
                download::download_cancel,
                http_fetch::harbor_fetch,
                stremio_auth::stremio_auth_start,
                // just strip it down to the bare minimum for now.
            ])
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
    }

}
