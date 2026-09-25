mod locate;

use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex as SyncMutex, OnceLock};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Url};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, oneshot, Mutex};

use locate::{resolve_jvm, resolve_layout};

const ENTRY_CLASS: &str = "com.harbor.capstan.bridge.Bridge";
const DEFAULT_TIMEOUT_MS: u64 = 130_000;
const REPLY_SLACK_MS: u64 = 15_000;
const CHALLENGE_CEILING: Duration = Duration::from_secs(110);
const CHALLENGE_METHOD: &str = "challenge";

struct Bridge {
    tx: mpsc::UnboundedSender<String>,
    pending: Arc<SyncMutex<HashMap<String, oneshot::Sender<Value>>>>,
    alive: Arc<AtomicBool>,
}

fn slot() -> &'static Mutex<Option<Arc<Bridge>>> {
    static SLOT: OnceLock<Mutex<Option<Arc<Bridge>>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}

fn next_id() -> String {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    format!("c{}", NEXT.fetch_add(1, Ordering::Relaxed))
}

async fn spawn(app: &AppHandle) -> Result<Arc<Bridge>, String> {
    let jvm = resolve_jvm(app)?;
    let layout = resolve_layout(app)?;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no data directory: {e}"))?
        .join("capstan");
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("data directory: {e}"))?;

    let separator = if cfg!(windows) { ";" } else { ":" };
    let mut classpath = vec![jar_string(&layout.jar)];
    classpath.extend(layout.libs.iter().map(|p| jar_string(p)));

    let mut cmd = tokio::process::Command::new(&jvm.exe);
    cmd.arg("-cp").arg(classpath.join(separator));
    if let Some(tools) = &layout.dex_tools {
        cmd.arg(format!("-Dharbor.capstan.dexTools={}", tools.display()));
    }
    cmd.arg(ENTRY_CLASS).arg("--data-dir").arg(&data_dir);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);
    crate::proc_guard::configure_command(&mut cmd);

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("could not start the extension bridge with {}: {e}", jvm.exe.display()))?;
    crate::proc_guard::adopt(&child);
    eprintln!("[capstan] bridge started, jvm from {}", jvm.source);

    let mut stdin = child.stdin.take().ok_or("bridge stdin unavailable")?;
    let stdout = child.stdout.take().ok_or("bridge stdout unavailable")?;
    let stderr = child.stderr.take().ok_or("bridge stderr unavailable")?;

    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    let pending: Arc<SyncMutex<HashMap<String, oneshot::Sender<Value>>>> =
        Arc::new(SyncMutex::new(HashMap::new()));
    let alive = Arc::new(AtomicBool::new(true));

    tokio::spawn(async move {
        while let Some(line) = rx.recv().await {
            if stdin.write_all(line.as_bytes()).await.is_err()
                || stdin.write_all(b"\n").await.is_err()
                || stdin.flush().await.is_err()
            {
                break;
            }
        }
    });

    tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            eprintln!("[capstan] {line}");
        }
    });

    let reader_pending = pending.clone();
    let reader_alive = alive.clone();
    let reader_tx = tx.clone();
    let reader_app = app.clone();
    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            let Ok(frame) = serde_json::from_str::<Value>(line) else {
                eprintln!("[capstan] stdout carried a line that is not protocol: {line}");
                continue;
            };
            if frame.get("host").is_some() {
                let app = reader_app.clone();
                let tx = reader_tx.clone();
                tokio::spawn(async move {
                    let _ = tx.send(serve_host(app, frame).await.to_string());
                });
                continue;
            }
            let Some(id) = frame.get("id").and_then(|v| v.as_str()) else {
                continue;
            };
            let waiting = reader_pending.lock().unwrap().remove(id);
            if let Some(waiting) = waiting {
                let _ = waiting.send(frame);
            }
        }
        reader_alive.store(false, Ordering::SeqCst);
        reader_pending.lock().unwrap().clear();
        let _ = child.wait().await;
        eprintln!("[capstan] bridge exited");
    });

    Ok(Arc::new(Bridge { tx, pending, alive }))
}

fn jar_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

async fn ensure(app: &AppHandle) -> Result<Arc<Bridge>, String> {
    let mut slot = slot().lock().await;
    if let Some(running) = slot.as_ref() {
        if running.alive.load(Ordering::SeqCst) {
            return Ok(running.clone());
        }
    }
    let fresh = spawn(app).await?;
    *slot = Some(fresh.clone());
    Ok(fresh)
}

async fn solve_challenge(app: AppHandle, url: String) -> Result<(String, String), String> {
    if url.is_empty() {
        return Err("challenge request carried no url".into());
    }
    let host = Url::parse(&url)
        .ok()
        .and_then(|parsed| parsed.host_str().map(|h| h.to_string()))
        .ok_or_else(|| format!("challenge url has no host: {url}"))?;
    if let Some(solved) = crate::cf_solver::cf_cached(&host) {
        return Ok(solved);
    }
    tokio::time::timeout(CHALLENGE_CEILING, crate::cf_solver::cf_fetch(app, url))
        .await
        .map_err(|_| format!("challenge for {host} timed out"))??;
    crate::cf_solver::cf_cached(&host)
        .ok_or_else(|| format!("{host} loaded but handed back no clearance cookie"))
}

async fn serve_host(app: AppHandle, frame: Value) -> Value {
    let id = frame.get("id").and_then(|v| v.as_str()).unwrap_or("");
    let method = frame.get("host").and_then(|v| v.as_str()).unwrap_or("");
    if method != CHALLENGE_METHOD {
        return json!({
            "id": id,
            "ok": false,
            "error": { "code": "unknown_method", "message": format!("no host method {method}") }
        });
    }
    let url = frame
        .get("params")
        .and_then(|p| p.get("url"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    match solve_challenge(app, url).await {
        Ok((cookie, user_agent)) => json!({
            "id": id,
            "ok": true,
            "result": { "cookie": cookie, "userAgent": user_agent }
        }),
        Err(message) => json!({
            "id": id,
            "ok": false,
            "error": { "code": "extension_error", "message": message }
        }),
    }
}

fn unwrap_frame(frame: Value) -> Result<Value, String> {
    if frame.get("ok").and_then(|v| v.as_bool()) == Some(true) {
        return Ok(frame.get("result").cloned().unwrap_or_else(|| json!({})));
    }
    let error = frame.get("error");
    let code = error
        .and_then(|e| e.get("code"))
        .and_then(|v| v.as_str())
        .unwrap_or("extension_error");
    let message = error
        .and_then(|e| e.get("message"))
        .and_then(|v| v.as_str())
        .unwrap_or("the extension bridge refused the request");
    Err(format!("{code}: {message}"))
}

async fn call(app: &AppHandle, method: &str, params: Value) -> Result<Value, String> {
    let timeout_ms = params
        .get("timeoutMs")
        .and_then(|v| v.as_u64())
        .unwrap_or(DEFAULT_TIMEOUT_MS);
    let wait = Duration::from_millis(timeout_ms.saturating_add(REPLY_SLACK_MS));
    for attempt in 0..2 {
        let bridge = ensure(app).await?;
        let id = next_id();
        let (tx, rx) = oneshot::channel();
        bridge.pending.lock().unwrap().insert(id.clone(), tx);
        let frame = json!({ "id": id, "method": method, "params": params });
        if bridge.tx.send(frame.to_string()).is_err() {
            bridge.pending.lock().unwrap().remove(&id);
            bridge.alive.store(false, Ordering::SeqCst);
            if attempt == 0 {
                continue;
            }
            return Err("the extension bridge is not accepting requests".into());
        }
        match tokio::time::timeout(wait, rx).await {
            Ok(Ok(answer)) => return unwrap_frame(answer),
            Ok(Err(_)) => {
                if attempt == 0 {
                    continue;
                }
                return Err("the extension bridge stopped before answering".into());
            }
            Err(_) => {
                bridge.pending.lock().unwrap().remove(&id);
                return Err(format!("{method} timed out after {timeout_ms}ms"));
            }
        }
    }
    Err("the extension bridge could not be started".into())
}

#[tauri::command]
pub async fn capstan_ping(app: AppHandle) -> Result<Value, String> {
    call(&app, "ping", json!({})).await
}

#[tauri::command]
pub async fn capstan_install(app: AppHandle, path: String) -> Result<Value, String> {
    call(&app, "install", json!({ "path": path })).await
}

#[tauri::command]
pub async fn capstan_uninstall(app: AppHandle, id: String) -> Result<Value, String> {
    call(&app, "uninstall", json!({ "id": id })).await
}

#[tauri::command]
pub async fn capstan_extensions(app: AppHandle) -> Result<Value, String> {
    call(&app, "extensions", json!({})).await
}

#[tauri::command]
pub async fn capstan_providers(app: AppHandle) -> Result<Value, String> {
    call(&app, "providers", json!({})).await
}

#[tauri::command]
pub async fn capstan_search(
    app: AppHandle,
    provider_id: String,
    query: String,
    page: Option<u32>,
    quick: Option<bool>,
) -> Result<Value, String> {
    let mut params = json!({ "providerId": provider_id, "query": query });
    if let Some(page) = page {
        params["page"] = json!(page);
    }
    if let Some(quick) = quick {
        params["quick"] = json!(quick);
    }
    call(&app, "search", params).await
}

#[tauri::command]
pub async fn capstan_load(
    app: AppHandle,
    provider_id: String,
    url: String,
) -> Result<Value, String> {
    call(&app, "load", json!({ "providerId": provider_id, "url": url })).await
}

#[tauri::command]
pub async fn capstan_load_links(
    app: AppHandle,
    provider_id: String,
    data: String,
    is_casting: Option<bool>,
) -> Result<Value, String> {
    let mut params = json!({ "providerId": provider_id, "data": data });
    if let Some(is_casting) = is_casting {
        params["isCasting"] = json!(is_casting);
    }
    call(&app, "loadLinks", params).await
}
