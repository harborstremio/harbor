#[cfg(target_os = "linux")]
use tauri::Emitter;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

const BROWSER_LABEL: &str = "harbor-browser";

const CHROME_INIT_SCRIPT: &str = r#"
(function () {
  if (window.__harborBrowserBooted) return;
  window.__harborBrowserBooted = true;

  const close = () => {
    try {
      if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
        window.__TAURI_INTERNALS__.invoke('browser_close');
      }
    } catch (_) {}
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }, true);
})();
"#;

// Linux only: WebKitGTK can't open stremio:// or navigate to a raw manifest.json,
// so an addon's "Install" button dies with "URL can't be shown". We funnel those
// intents into a top-level location change, which on_navigation then captures.
#[cfg(target_os = "linux")]
const STREMIO_CAPTURE_SCRIPT: &str = r#"
(function () {
  if (window.__harborCaptureBooted) return;
  window.__harborCaptureBooted = true;
  const isInstall = (u) => {
    try {
      const s = String(u);
      return s.indexOf('stremio://') === 0 || /\/manifest\.json(\?|$)/i.test(s);
    } catch (_) { return false; }
  };
  const origOpen = window.open;
  window.open = function (u) {
    if (isInstall(u)) { try { window.location.href = String(u); } catch (_) {} return null; }
    return origOpen ? origOpen.apply(window, arguments) : null;
  };
  document.addEventListener('click', function (e) {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a && isInstall(a.getAttribute('href'))) {
      e.preventDefault();
      e.stopPropagation();
      try { window.location.href = a.href || a.getAttribute('href'); } catch (_) {}
    }
  }, true);
})();
"#;

#[tauri::command]
pub async fn browser_open(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|e| format!("parse url: {}", e))?;

    if let Some(existing) = app.get_webview_window(BROWSER_LABEL) {
        let _ = existing.eval(&format!(
            "window.location.href = {};",
            serde_json::to_string(&url).unwrap_or_else(|_| "''".to_string())
        ));
        let _ = existing.set_focus();
        return Ok(());
    }

    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let scale = main.scale_factor().unwrap_or(1.0);
    let main_size = main
        .outer_size()
        .map_err(|e| format!("outer_size: {}", e))?
        .to_logical::<f64>(scale);
    let main_pos = main
        .outer_position()
        .map_err(|e| format!("outer_position: {}", e))?
        .to_logical::<f64>(scale);

    let target_w = (main_size.width * 0.82).clamp(820.0, 1280.0);
    let target_h = (main_size.height * 0.88).clamp(560.0, 880.0);
    let target_x = main_pos.x + (main_size.width - target_w) / 2.0;
    let target_y = main_pos.y + (main_size.height - target_h) / 2.0;

    let app_for_main = app.clone();
    #[cfg(target_os = "linux")]
    let init_script = format!("{}\n{}", CHROME_INIT_SCRIPT, STREMIO_CAPTURE_SCRIPT);
    #[cfg(not(target_os = "linux"))]
    let init_script = CHROME_INIT_SCRIPT.to_string();
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    app.run_on_main_thread(move || {
        eprintln!(
            "[browser] building {} at ({:.0}, {:.0}) size {:.0}x{:.0}",
            BROWSER_LABEL, target_x, target_y, target_w, target_h
        );
        #[allow(unused_mut)]
        let mut builder =
            WebviewWindowBuilder::new(&app_for_main, BROWSER_LABEL, WebviewUrl::External(parsed))
                .title("Harbor Browser")
                .inner_size(target_w, target_h)
                .position(target_x, target_y)
                .resizable(true)
                .decorations(true)
                .shadow(true)
                .focused(true)
                .initialization_script(&init_script);

        #[cfg(target_os = "linux")]
        {
            let nav_app = app_for_main.clone();
            builder = builder.on_navigation(move |url| {
                let s = url.as_str();
                if url.scheme() == "stremio" || s.contains("/manifest.json") {
                    eprintln!("[browser] captured install link: {}", s);
                    let _ = nav_app.emit("harbor://browser-stremio-capture", s.to_string());
                    return false;
                }
                true
            });
        }

        let result = builder.build();
        match result {
            Ok(window) => {
                eprintln!("[browser] window built, label={}", window.label());
                let label_owned = BROWSER_LABEL.to_string();
                window.on_window_event(move |event| {
                    eprintln!("[browser/{}] event: {:?}", label_owned, event);
                });
                let _ = window.show();
                let _ = window.set_focus();
                let _ = tx.send(Ok(()));
            }
            Err(e) => {
                eprintln!("[browser] BUILD FAILED: {}", e);
                let _ = tx.send(Err(format!("build: {}", e)));
            }
        }
    })
    .map_err(|e| format!("run_on_main_thread: {}", e))?;

    rx.recv().map_err(|e| format!("channel: {}", e))??;
    Ok(())
}

#[tauri::command]
pub async fn browser_close(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(BROWSER_LABEL) {
        let _ = w.close();
    }
    Ok(())
}
