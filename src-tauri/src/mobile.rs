// The Android entry. Desktop keeps its own `run()` in lib.rs, untouched.
//
// This builder exists because almost nothing in the desktop one survives the
// port: single-instance and window-state compile to empty crates on Android,
// updater and process declare support level "none", and every window call the
// desktop setup makes (show, set_focus, set_position) is a #[cfg(desktop)]
// method in tauri 2. Sharing one builder would mean threading cfg attributes
// through a 400 line function and putting the desktop path at risk on every
// future edit. Two builders keep the desktop path literally unchanged.
//
// What Android gets: the librqbit torrent engine and its localhost stream
// server, the proxy, the LAN web server, settings, and the fetch bridge. What
// it does not get, and why, is listed in the handoff: no mpv, so no on-demand
// native playback path (the webview plays it), and no ffmpeg sidecar, so no
// thumbnails, transcode, DVR, subtitle extract, autosync or trailers.

use crate::{
    crash_report, diagnostics, download, ebook_tts, fonts, gamepad, http_fetch, local_lib,
    media_server, power, proc_mem, settings_store, stream_proxy, streams, stremio_auth,
    subtitle_credentials, temp_prune, torrent_engine, transcode, web_server,
};

// Desktop answers this from dlna.rs, but that module is #[cfg(desktop)] because
// it pulls mdns-sd, which Android does not build. The QR hand-off encodes this
// address, so without a mobile copy onboarding falls back to typing a TMDB key
// on a remote. Connecting a UDP socket picks the interface the kernel would
// actually route through; no packet is sent.
#[tauri::command]
fn lan_ip() -> Option<String> {
    use std::net::{IpAddr, UdpSocket};
    for target in ["1.1.1.1:80", "8.8.8.8:80", "192.168.1.1:80"] {
        let Ok(sock) = UdpSocket::bind("0.0.0.0:0") else {
            continue;
        };
        if sock.connect(target).is_err() {
            continue;
        }
        let Ok(addr) = sock.local_addr() else {
            continue;
        };
        if let IpAddr::V4(v4) = addr.ip() {
            if !v4.is_loopback() && !v4.is_unspecified() {
                return Some(v4.to_string());
            }
        }
    }
    None
}

pub fn run() {
    // librqbit speaks rustls, and rustls refuses to work until a process wide
    // crypto provider is installed. Desktop does this too.
    let _ = rustls::crypto::ring::default_provider().install_default();
    std::thread::spawn(temp_prune::sweep_temp);

    let proxy_state = tauri::async_runtime::block_on(stream_proxy::ProxyState::start())
        .unwrap_or_else(|e| {
            eprintln!("[stream-proxy] failed to start: {}", e);
            stream_proxy::ProxyState::placeholder()
        });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(proxy_state)
        .manage(download::DownloadState::new())
        .setup(|app| {
            if let Err(error) = crash_report::initialize(app.handle()) {
                eprintln!("[harbor::crash-report] initialization failed: {error}");
            }
            torrent_engine::ensure_started_on_setup(app.handle());
            gamepad::spawn(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            lan_ip,
            crate::save_text_file,
            crate::harbor_take_pending_file,
            crate::harbor_set_webview_memory_low,
            crate::harbor_set_webview_visible,
            crate::harbor_set_context_menu,
            crate::harbor_try_suspend_webview,
            crate::harbor_resume_webview,
            crash_report::take_startup_crash_report,
            settings_store::settings_read,
            settings_store::settings_write,
            settings_store::secrets_read,
            settings_store::secrets_write,
            media_server::media_server_request,
            http_fetch::harbor_fetch,
            http_fetch::harbor_upload,
            subtitle_credentials::subtitle_credential_bind,
            subtitle_credentials::subtitle_credentials_clear,
            stream_proxy::proxy_register,
            stream_proxy::proxy_unregister,
            stream_proxy::proxy_gc_idle,
            torrent_engine::torrent_engine_status,
            torrent_engine::torrent_engine_set_enabled,
            torrent_engine::torrent_engine_add,
            torrent_engine::torrent_engine_select,
            torrent_engine::torrent_engine_select_set,
            torrent_engine::torrent_engine_stats,
            torrent_engine::torrent_engine_list,
            torrent_engine::torrent_engine_pause,
            torrent_engine::torrent_engine_resume,
            torrent_engine::torrent_engine_remove,
            torrent_engine::torrent_engine_selftest,
            torrent_engine::torrent_engine_restart,
            torrent_engine::torrent_engine_hard_reset,
            torrent_engine::torrent_engine_set_options,
            web_server::web_serve_start,
            web_server::web_serve_stop,
            web_server::web_serve_status,
            web_server::remote_ws_broadcast,
            web_server::remote_ws_client_count,
            streams::streams_run_pipeline,
            streams::streams_parse,
            streams::streams_core_version,
            local_lib::harbor_scan_folder,
            download::download_start,
            download::download_cancel,
            diagnostics::diagnostics_collect,
            diagnostics::diagnostics_cleanup,
            proc_mem::harbor_process_memory,
            temp_prune::temp_usage_bytes,
            temp_prune::temp_clear,
            fonts::install_sub_font,
            fonts::remove_sub_font,
            fonts::list_sub_fonts,
            ebook_tts::ebook_tts_synthesize,
            ebook_tts::ebook_tts_cancel,
            ebook_tts::ebook_tts_voices,
            gamepad::gamepad_list,
            gamepad::gamepad_set_enabled,
            gamepad::gamepad_set_background_input,
            power::power_inhibit,
            stremio_auth::stremio_auth_start,
            transcode::cast_ffmpeg_present,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                stream_proxy::shutdown(app_handle);
                torrent_engine::stop();
                crash_report::mark_clean_exit();
            }
        });
}
