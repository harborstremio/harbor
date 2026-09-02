use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderName, HeaderValue, Response, StatusCode};
use axum::response::IntoResponse;
use axum::routing::get;
use futures_util::{SinkExt, StreamExt};
use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::sync::{broadcast, oneshot, Mutex as AsyncMutex};

pub const WEB_PORT: u16 = 11471;
const DEV_FRONTEND: &str = "http://127.0.0.1:1420";

/// True when built/run via `tauri dev` (CLI sets `--cfg dev`).
fn is_tauri_dev() -> bool {
    tauri::is_dev()
}

static RUNNING: AtomicBool = AtomicBool::new(false);
static NEXT_CLIENT_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
struct ServeState {
    app: AppHandle,
    outbound: broadcast::Sender<String>,
    clients: Arc<AsyncMutex<HashSet<u64>>>,
}

fn shutdown_slot() -> &'static Mutex<Option<oneshot::Sender<()>>> {
    static S: OnceLock<Mutex<Option<oneshot::Sender<()>>>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(None))
}

fn serve_state_slot() -> &'static Mutex<Option<ServeState>> {
    static S: OnceLock<Mutex<Option<ServeState>>> = OnceLock::new();
    S.get_or_init(|| Mutex::new(None))
}

fn is_spa_path(raw_path: &str) -> bool {
    raw_path == "/"
        || raw_path.is_empty()
        || raw_path == "/remote"
        || raw_path.starts_with("/remote/")
        || raw_path == "/setup"
        || raw_path.starts_with("/setup/")
        || raw_path == "/reader"
        || raw_path.starts_with("/reader/")
}

fn serve_bundled_asset(app: &AppHandle, raw_path: &str) -> Response<Body> {
    let resolver = app.asset_resolver();
    let path = if is_spa_path(raw_path) {
        "/index.html".to_string()
    } else {
        raw_path.to_string()
    };
    let asset = resolver
        .get(path.clone())
        .or_else(|| resolver.get("/index.html".to_string()));
    match asset {
        Some(a) => {
            let cache = if path.ends_with(".html") || path == "/index.html" {
                "no-cache"
            } else {
                "public, max-age=31536000, immutable"
            };
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, a.mime_type)
                .header(header::CACHE_CONTROL, cache)
                .body(Body::from(a.bytes))
                .unwrap()
        }
        None => Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::from(
                "Harbor web assets are not available in this build.",
            ))
            .unwrap(),
    }
}

/// In `tauri dev`, the desktop window loads Vite live assets, but `:11471`
/// previously only served Tauri's asset resolver (often stale). Proxy those
/// requests to the Vite dev server so phone `/remote` tracks HMR.
async fn proxy_dev_frontend(path_and_query: &str) -> Option<Response<Body>> {
    if !is_tauri_dev() {
        return None;
    }
    let url = format!("{DEV_FRONTEND}{path_and_query}");
    let client = reqwest::Client::new();
    let upstream = client.get(&url).send().await.ok()?;
    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let headers = upstream.headers().clone();
    let bytes = upstream.bytes().await.ok()?;
    let mut builder = Response::builder().status(status);
    let mut out_headers = HeaderMap::new();
    for (name, value) in headers.iter() {
        let skip = matches!(
            name.as_str(),
            "transfer-encoding" | "content-length" | "connection" | "content-encoding"
        );
        if skip {
            continue;
        }
        if let Ok(n) = HeaderName::from_bytes(name.as_str().as_bytes()) {
            if let Ok(v) = HeaderValue::from_bytes(value.as_bytes()) {
                out_headers.insert(n, v);
            }
        }
    }
    out_headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    *builder.headers_mut().unwrap() = out_headers;
    builder.body(Body::from(bytes)).ok()
}

fn pct_hex(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

fn pct_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (pct_hex(bytes[i + 1]), pct_hex(bytes[i + 2])) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn blocked_host(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    let after = lower.split("://").nth(1).unwrap_or("");
    let host = after.split(['/', '?', '#', ':']).next().unwrap_or("");
    host == "localhost"
        || host.starts_with("127.")
        || host.starts_with("0.")
        || host.starts_with("10.")
        || host.starts_with("192.168.")
        || host.starts_with("169.254.")
        || host.starts_with("[::1]")
        || (host.starts_with("172.")
            && host
                .split('.')
                .nth(1)
                .and_then(|o| o.parse::<u8>().ok())
                .map(|o| (16..=31).contains(&o))
                .unwrap_or(false))
}

async fn manga_img_proxy(uri: axum::http::Uri) -> Response<Body> {
    let query = uri.query().unwrap_or("");
    let target = query
        .split('&')
        .find_map(|pair| pair.strip_prefix("u=").map(pct_decode));
    let url = match target {
        Some(u) if (u.starts_with("http://") || u.starts_with("https://")) && !blocked_host(&u) => {
            u
        }
        _ => {
            return Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(Body::empty())
                .unwrap()
        }
    };
    let client = reqwest::Client::new();
    let upstream = match client
        .get(&url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        )
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => {
            return Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(Body::empty())
                .unwrap()
        }
    };
    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let ctype = upstream
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    let bytes = match upstream.bytes().await {
        Ok(b) => b,
        Err(_) => {
            return Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(Body::empty())
                .unwrap()
        }
    };
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, ctype)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::CACHE_CONTROL, "public, max-age=86400")
        .body(Body::from(bytes))
        .unwrap()
}

async fn serve_http(State(state): State<ServeState>, uri: axum::http::Uri) -> Response<Body> {
    let path_and_query = uri
        .path_and_query()
        .map(|pq| pq.as_str().to_string())
        .unwrap_or_else(|| "/".to_string());
    if let Some(proxied) = proxy_dev_frontend(&path_and_query).await {
        return proxied;
    }
    serve_bundled_asset(&state.app, uri.path())
}

async fn remote_ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<ServeState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_remote_socket(socket, state))
}

async fn handle_remote_socket(socket: WebSocket, state: ServeState) {
    let client_id = NEXT_CLIENT_ID.fetch_add(1, Ordering::SeqCst);
    {
        let mut clients = state.clients.lock().await;
        clients.insert(client_id);
    }
    let _ = state.app.emit(
        "remote://client",
        serde_json::json!({ "action": "join", "clientId": client_id }),
    );

    let (mut sender, mut receiver) = socket.split();
    let mut outbound_rx = state.outbound.subscribe();

    let send_task = tauri::async_runtime::spawn(async move {
        loop {
            match outbound_rx.recv().await {
                Ok(msg) => {
                    if sender.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            }
        }
    });

    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                let _ = state.app.emit(
                    "remote://cmd",
                    serde_json::json!({
                        "clientId": client_id,
                        "raw": text.to_string(),
                    }),
                );
            }
            Message::Close(_) => break,
            Message::Ping(_) | Message::Pong(_) | Message::Binary(_) => {}
        }
    }

    send_task.abort();
    {
        let mut clients = state.clients.lock().await;
        clients.remove(&client_id);
    }
    let _ = state.app.emit(
        "remote://client",
        serde_json::json!({ "action": "leave", "clientId": client_id }),
    );
}

#[tauri::command]
pub async fn web_serve_start(app: AppHandle) -> Result<u16, String> {
    if RUNNING.load(Ordering::SeqCst) {
        return Ok(WEB_PORT);
    }
    let listener = TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], WEB_PORT)))
        .await
        .map_err(|e| format!("port {} unavailable: {}", WEB_PORT, e))?;
    let (tx, rx) = oneshot::channel::<()>();
    *shutdown_slot().lock().unwrap() = Some(tx);

    let (outbound, _) = broadcast::channel::<String>(256);
    let state = ServeState {
        app: app.clone(),
        outbound,
        clients: Arc::new(AsyncMutex::new(HashSet::new())),
    };
    *serve_state_slot().lock().unwrap() = Some(state.clone());
    RUNNING.store(true, Ordering::SeqCst);

    let router = axum::Router::new()
        .route("/api/remote", get(remote_ws_handler))
        .route("/manga-img", get(manga_img_proxy))
        .fallback(serve_http)
        .with_state(state);

    tauri::async_runtime::spawn(async move {
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await;
        RUNNING.store(false, Ordering::SeqCst);
        *serve_state_slot().lock().unwrap() = None;
    });
    if is_tauri_dev() {
        eprintln!(
            "[web-serve] Harbor remote WS on 0.0.0.0:{} (UI proxied from {})",
            WEB_PORT, DEV_FRONTEND
        );
    } else {
        eprintln!(
            "[web-serve] Harbor web UI + remote WS listening on 0.0.0.0:{}",
            WEB_PORT
        );
    }
    Ok(WEB_PORT)
}

#[tauri::command]
pub fn web_serve_stop() {
    if let Some(tx) = shutdown_slot().lock().unwrap().take() {
        let _ = tx.send(());
    }
    *serve_state_slot().lock().unwrap() = None;
    RUNNING.store(false, Ordering::SeqCst);
}

#[tauri::command]
pub fn web_serve_status() -> bool {
    RUNNING.load(Ordering::SeqCst)
}

/// Push a JSON text frame to every connected remote client.
#[tauri::command]
pub fn remote_ws_broadcast(payload: String) -> Result<(), String> {
    let guard = serve_state_slot().lock().unwrap();
    let Some(state) = guard.as_ref() else {
        return Ok(());
    };
    let _ = state.outbound.send(payload);
    Ok(())
}

#[tauri::command]
pub async fn remote_ws_client_count() -> Result<usize, String> {
    let state = {
        let guard = serve_state_slot().lock().unwrap();
        guard.clone()
    };
    let Some(state) = state else {
        return Ok(0);
    };
    let count = state.clients.lock().await.len();
    Ok(count)
}
