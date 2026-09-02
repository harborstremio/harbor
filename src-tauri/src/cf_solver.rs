use std::collections::HashMap;
use std::sync::mpsc;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::{oneshot, Mutex as AsyncMutex};

const SOLVER_LABEL: &str = "harbor-cf-solver";
const CF_TTL: Duration = Duration::from_secs(20 * 60);
const CF_RETRY_COOLDOWN: Duration = Duration::from_secs(30 * 60);

static PENDING: Mutex<Option<oneshot::Sender<String>>> = Mutex::new(None);

fn request_lock() -> &'static AsyncMutex<()> {
    static LOCK: OnceLock<AsyncMutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| AsyncMutex::new(()))
}

struct CfEntry {
    cookie: String,
    ua: String,
    at: Instant,
}

fn cf_cache() -> &'static Mutex<HashMap<String, CfEntry>> {
    static C: OnceLock<Mutex<HashMap<String, CfEntry>>> = OnceLock::new();
    C.get_or_init(|| Mutex::new(HashMap::new()))
}

fn last_ua() -> &'static Mutex<String> {
    static U: OnceLock<Mutex<String>> = OnceLock::new();
    U.get_or_init(|| Mutex::new(String::new()))
}

// Cached (Cookie header, User-Agent) for a host that already cleared a Cloudflare
// challenge in the solver webview. cf_clearance is UA-bound, so both must be replayed
// together, and only for the exact host that solved.
pub fn cf_cached(host: &str) -> Option<(String, String)> {
    let cache = cf_cache().lock().unwrap();
    let e = cache.get(host)?;
    if e.at.elapsed() > CF_TTL {
        return None;
    }
    Some((e.cookie.clone(), e.ua.clone()))
}

pub fn cf_invalidate(host: &str) {
    cf_cache().lock().unwrap().remove(host);
}

fn cf_failures() -> &'static Mutex<HashMap<String, Instant>> {
    static F: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
    F.get_or_init(|| Mutex::new(HashMap::new()))
}

fn host_of(url: &str) -> Option<String> {
    Url::parse(url).ok()?.host_str().map(|s| s.to_string())
}

fn cf_in_cooldown(host: &str) -> bool {
    let mut map = cf_failures().lock().unwrap();
    let fresh = map.get(host).map(|at| at.elapsed() < CF_RETRY_COOLDOWN);
    match fresh {
        Some(true) => true,
        Some(false) => {
            map.remove(host);
            false
        }
        None => false,
    }
}

fn cf_note_failure(host: &str) {
    cf_failures()
        .lock()
        .unwrap()
        .insert(host.to_string(), Instant::now());
}

fn cf_clear_failure(host: &str) {
    cf_failures().lock().unwrap().remove(host);
}

struct SolverDismiss(AppHandle);

impl Drop for SolverDismiss {
    fn drop(&mut self) {
        if let Some(w) = self.0.get_webview_window(SOLVER_LABEL) {
            let _ = w.set_always_on_top(false);
            let _ = w.hide();
        }
    }
}

fn harvest(app: &AppHandle, url: &str) -> bool {
    let Some(win) = app.get_webview_window(SOLVER_LABEL) else {
        return false;
    };
    let Ok(parsed) = Url::parse(url) else {
        return false;
    };
    let Some(host) = parsed.host_str().map(|s| s.to_string()) else {
        return false;
    };
    let ua = last_ua().lock().unwrap().clone();
    if ua.is_empty() {
        return false;
    }
    let cookies = match win.cookies_for_url(parsed) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[cf] cookie read failed: {e}");
            return false;
        }
    };
    let mut parts: Vec<String> = Vec::new();
    for c in cookies {
        let name = c.name();
        if name == "cf_clearance" || name == "__cf_bm" || name.starts_with("cf_chl") {
            parts.push(format!("{}={}", name, c.value()));
        }
    }
    if parts.is_empty() {
        return false;
    }
    let cookie = parts.join("; ");
    cf_cache().lock().unwrap().insert(
        host.clone(),
        CfEntry {
            cookie,
            ua,
            at: Instant::now(),
        },
    );
    eprintln!("[cf] harvested clearance for {}", host);
    true
}

const INIT_SCRIPT: &str = r#"
(function () {
  if (window.__harborCfBooted) return;
  window.__harborCfBooted = true;
  var done = false;
  function challenged() {
    var t = (document.title || '').toLowerCase();
    if (t.indexOf('just a moment') >= 0 || t.indexOf('attention required') >= 0) return true;
    if (document.getElementById('challenge-running') || document.getElementById('cf-please-wait')) return true;
    if (document.querySelector('#challenge-form, #cf-challenge-running, .cf-turnstile')) return true;
    return false;
  }
  function send(body) {
    try { window.__TAURI_INTERNALS__.invoke('cf_report', { body: body, ua: navigator.userAgent || '' }); } catch (e) {}
  }
  function report() {
    if (done || challenged()) return;
    done = true;
    fetch(location.href, { credentials: 'include', headers: { Accept: 'application/json, text/plain, */*' } })
      .then(function (r) { return r.text(); })
      .then(function (t) { send(t); })
      .catch(function () { send(document.body ? document.body.innerText || '' : ''); });
  }
  var tries = 0;
  var iv = setInterval(function () {
    tries += 1;
    report();
    if (done || tries > 220) clearInterval(iv);
  }, 400);
  document.addEventListener('DOMContentLoaded', report);
  window.addEventListener('load', report);
})();
"#;

#[tauri::command]
pub fn cf_report(body: String, ua: String) {
    eprintln!("[cf] report {} bytes", body.len());
    if !ua.is_empty() {
        *last_ua().lock().unwrap() = ua;
    }
    if let Some(tx) = PENDING.lock().unwrap().take() {
        let _ = tx.send(body);
    }
}

fn open_solver(app: &AppHandle, url: &str) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(SOLVER_LABEL) {
        eprintln!("[cf] reusing solver window");
        let _ = existing.eval(&format!(
            "window.location.href = {};",
            serde_json::to_string(url).unwrap_or_else(|_| "''".into())
        ));
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let parsed = Url::parse(url).map_err(|e| format!("url: {e}"))?;
    let app_main = app.clone();
    let (tx, rx) = mpsc::channel::<Result<(), String>>();
    app.run_on_main_thread(move || {
        let built =
            WebviewWindowBuilder::new(&app_main, SOLVER_LABEL, WebviewUrl::External(parsed))
                .title("Harbor · checking source")
                .inner_size(480.0, 640.0)
                .center()
                .resizable(true)
                .decorations(true)
                .shadow(true)
                .focused(true)
                .initialization_script(INIT_SCRIPT)
                .build();
        match built {
            Ok(window) => {
                let _ = window.show();
                let _ = window.set_focus();
                eprintln!("[cf] solver window built + shown");
                let _ = tx.send(Ok(()));
            }
            Err(e) => {
                eprintln!("[cf] build FAILED: {e}");
                let _ = tx.send(Err(format!("build: {e}")));
            }
        }
    })
    .map_err(|e| format!("main thread: {e}"))?;
    rx.recv_timeout(Duration::from_secs(8))
        .map_err(|e| format!("build wait: {e}"))?
}

pub async fn cf_fetch(app: AppHandle, url: String) -> Result<String, String> {
    let _guard = request_lock().lock().await;
    let host = host_of(&url);
    if let Some(h) = host.as_deref() {
        if cf_in_cooldown(h) {
            eprintln!("[cf] skipping {}, a recent solve failed", h);
            return Err(format!("cloudflare challenge for {} recently failed", h));
        }
        cf_note_failure(h);
    }
    let (tx, rx) = oneshot::channel::<String>();
    *PENDING.lock().unwrap() = Some(tx);

    eprintln!("[cf] solving {}", url);
    open_solver(&app, &url)?;
    let _dismiss = SolverDismiss(app.clone());
    if let Some(w) = app.get_webview_window(SOLVER_LABEL) {
        let _ = w.unminimize();
        let _ = w.set_always_on_top(true);
        let _ = w.set_focus();
        eprintln!("[cf] raised solver window to front");
    }

    match tokio::time::timeout(Duration::from_secs(90), rx).await {
        Ok(Ok(body)) => {
            eprintln!("[cf] got {} bytes", body.len());
            let cleared = harvest(&app, &url);
            if cleared {
                if let Some(h) = host.as_deref() {
                    cf_clear_failure(h);
                }
            }
            Ok(body)
        }
        _ => {
            PENDING.lock().unwrap().take();
            eprintln!("[cf] TIMEOUT {}", url);
            Err("cloudflare challenge timed out".into())
        }
    }
}
