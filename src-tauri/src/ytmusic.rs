//! YouTube Music as a real webview, rather than a client rebuilt against innertube.
//!
//! Rebuilding the client means re-earning playlists, radio, likes and video one endpoint at a
//! time, against a service that keeps tightening (PO tokens, range caps). Loading Google's own
//! web app gets all of it at once and keeps working when they change it.

use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

/// Embed and unembed must not interleave. React re-mounts this surface (StrictMode does it on
/// every mount in development), and without serialising, a cleanup can slip between the
/// "already embedded?" check and the build, leaving two queued builds for one label, where the
/// second fails with WindowLabelAlreadyExists and the surface never reports ready.
#[cfg(windows)]
fn embed_lock() -> &'static tokio::sync::Mutex<()> {
    static LOCK: std::sync::OnceLock<tokio::sync::Mutex<()>> = std::sync::OnceLock::new();
    LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

const YTM_LABEL: &str = "harbor-ytmusic";
const YTM_URL: &str = "https://music.youtube.com/";
#[cfg(windows)]
const YTM_EMBED_LABEL: &str = "harbor-ytmusic-embed";

#[tauri::command]
pub async fn ytmusic_open(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(YTM_LABEL) {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let parsed = Url::parse(YTM_URL).map_err(|error| format!("parse url: {error}"))?;
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let scale = main.scale_factor().unwrap_or(1.0);
    let size = main
        .outer_size()
        .map_err(|error| format!("outer_size: {error}"))?
        .to_logical::<f64>(scale);
    let position = main
        .outer_position()
        .map_err(|error| format!("outer_position: {error}"))?
        .to_logical::<f64>(scale);

    // Sign in stores cookies here, so it survives a restart instead of asking every launch.
    let data_directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app_data_dir: {error}"))?
        .join("ytmusic");

    let width = (size.width * 0.9).clamp(900.0, 1600.0);
    let height = (size.height * 0.92).clamp(600.0, 1000.0);
    let x = position.x + (size.width - width) / 2.0;
    let y = position.y + (size.height - height) / 2.0;

    let app_for_main = app.clone();
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    app.run_on_main_thread(move || {
        #[allow(unused_mut)]
        let mut builder =
            WebviewWindowBuilder::new(&app_for_main, YTM_LABEL, WebviewUrl::External(parsed))
                .title("Harbor Music")
                .inner_size(width, height)
                .position(x, y)
                .resizable(true)
                .decorations(true)
                .shadow(true)
                .focused(true);

        #[cfg(any(target_os = "windows", target_os = "macos"))]
        {
            builder = builder.data_directory(data_directory);
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            // data_directory is a WebView2/WKWebView concept. WebKitGTK keeps its own profile
            // directory, so setting it there would do nothing.
            let _ = &data_directory;
        }

        let result = builder.build();
        let _ = match result {
            Ok(window) => {
                let _ = window.show();
                let _ = window.set_focus();
                tx.send(Ok(()))
            }
            Err(error) => {
                eprintln!("[harbor::ytmusic] build failed: {error}");
                tx.send(Err(format!("open YouTube Music: {error}")))
            }
        };
    })
    .map_err(|error| format!("run_on_main_thread: {error}"))?;

    rx.recv()
        .map_err(|error| format!("window build did not report back: {error}"))?
}

#[tauri::command]
pub async fn ytmusic_close(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(YTM_LABEL) {
        let _ = window.close();
    }
    Ok(())
}

#[tauri::command]
pub fn ytmusic_is_open(app: AppHandle) -> bool {
    app.get_webview_window(YTM_LABEL).is_some()
}

/// Embedding puts YouTube Music inside Harbor's own window, so the sidebar and title bar stay
/// around it, instead of it being a second window on the taskbar.
///
/// Windows only, and deliberately so. `parent_raw` is a real WS_CHILD there, clipped to the
/// parent's client area; on macOS it is a floating child window that is not clipped, and on
/// Linux there is only `transient_for`. That is the same ceiling multiview already accepts.
/// Multi-webview via tauri's `unstable` feature would embed on more platforms, but it flips
/// every window in the app from WindowContent to WindowChild, which costs frameless
/// edge-resize, drag-drop routing and focus routing. Not worth it for one surface.
#[cfg(windows)]
#[tauri::command]
pub async fn ytmusic_embed(app: AppHandle, geom: crate::mpv::MpvGeometry) -> Result<(), String> {
    let _guard = embed_lock().lock().await;
    if app.get_webview_window(YTM_EMBED_LABEL).is_some() {
        return ytmusic_set_geometry(app, geom).await;
    }

    let parsed = Url::parse(YTM_URL).map_err(|error| format!("parse url: {error}"))?;
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    // HWND wraps a raw pointer and is not Send, so only the numeric handle crosses into the
    // main-thread closure and the HWND is rebuilt there.
    let parent_raw = main.hwnd().map_err(|error| format!("main hwnd: {error}"))?.0 as isize;
    let data_directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("app_data_dir: {error}"))?
        .join("ytmusic");

    let app_for_main = app.clone();
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    app.run_on_main_thread(move || {
        let parent = windows::Win32::Foundation::HWND(parent_raw as *mut _);
        let built =
            WebviewWindowBuilder::new(&app_for_main, YTM_EMBED_LABEL, WebviewUrl::External(parsed))
                // Do NOT let this title start with "Harbor". mpv.rs finds its own embedded
                // child by enumerating children of the main HWND and matching
                // `class == "mpv"` or `(class.is_empty() && title.starts_with("Harbor"))`.
                // A "Harbor..." title here risks this webview being taken for mpv and shoved
                // to HWND_BOTTOM or hidden with it.
                .title("YouTube Music")
                .parent_raw(parent)
                .decorations(false)
                .resizable(false)
                .shadow(false)
                // A window.open() or target=_blank inside YouTube Music is cancelled by
                // default, silently. Anything it wants to pop out (a share link, a policy page)
                // belongs in the user's real browser, not a chromeless child of Harbor.
                .on_new_window(|url, _features| {
                    let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
                    tauri::webview::NewWindowResponse::Deny
                })
                .focused(false)
                // Built hidden on purpose: with no inner_size/position the window would be
                // created at CW_USEDEFAULT and flash full size at the top-left corner before
                // the first set_geometry lands. ytmusic_embed shows it after placing it.
                .visible(false)
                .data_directory(data_directory)
                .build();
        let _ = match built {
            Ok(window) => {
                let _ = window.show();
                tx.send(Ok(()))
            }
            Err(error) => {
                eprintln!("[harbor::ytmusic] embed build failed: {error}");
                tx.send(Err(format!("embed YouTube Music: {error}")))
            }
        };
    })
    .map_err(|error| format!("run_on_main_thread: {error}"))?;

    rx.recv()
        .map_err(|error| format!("embed did not report back: {error}"))??;
    ytmusic_set_geometry(app.clone(), geom).await?;
    ytmusic_set_visible(app, true).await
}

/// Harbor keeps an inactive view mounted and merely display:none's it for a minute, and a
/// native child window does not honour CSS. Leaving the Music tab therefore has to hide this
/// explicitly, or YouTube Music stays painted over whatever comes next.
#[cfg(windows)]
#[tauri::command]
pub async fn ytmusic_set_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(YTM_EMBED_LABEL) {
        let _ = if visible { window.show() } else { window.hide() };
    }
    Ok(())
}

/// Moves the embedded surface to a CSS rect measured by the page, the same contract the
/// embedded mpv child uses.
#[cfg(windows)]
#[tauri::command]
pub async fn ytmusic_set_geometry(
    app: AppHandle,
    geom: crate::mpv::MpvGeometry,
) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let child = app
        .get_webview_window(YTM_EMBED_LABEL)
        .ok_or_else(|| "YouTube Music is not embedded".to_string())?;
    let parent = main.hwnd().map_err(|error| format!("main hwnd: {error}"))?;
    let hwnd = child.hwnd().map_err(|error| format!("child hwnd: {error}"))?;
    let parent_raw = parent.0 as isize;
    let (x, y, w, h) = crate::multiview::css_to_physical(
        parent_raw,
        geom.css_left,
        geom.css_top,
        geom.css_width,
        geom.css_height,
        geom.css_view_w,
        geom.css_view_h,
    );
    crate::multiview::place_child(hwnd.0 as isize, parent_raw, x, y, w, h);
    Ok(())
}

#[cfg(windows)]
#[tauri::command]
pub async fn ytmusic_unembed(app: AppHandle) -> Result<(), String> {
    let _guard = embed_lock().lock().await;
    if let Some(window) = app.get_webview_window(YTM_EMBED_LABEL) {
        let _ = window.close();
    }
    Ok(())
}
