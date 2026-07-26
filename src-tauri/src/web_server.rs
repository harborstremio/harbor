use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderName, HeaderValue, Response, StatusCode};
use axum::response::IntoResponse;
use axum::routing::get;
use futures_util::{SinkExt, StreamExt};
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::sync::{broadcast, oneshot, Mutex as AsyncMutex};

pub const WEB_PORT: u16 = 11471;
const DEV_FRONTEND: &str = "http://127.0.0.1:1420";

/// True when built/run via `tauri dev` (CLI sets `--cfg dev`).
fn is_tauri_dev() -> bool {
    tauri::is_dev()
}

/// Pairing secret for the remote control socket.
///
/// The remote server listens on every interface, and a WebSocket upgrade is not
/// subject to the same-origin policy: without a secret, any LAN host — and any
/// web page the user happens to have open, by dialling 127.0.0.1 — could drive
/// the app's navigation, typing and playback. The desktop UI hands this token to
/// the phone inside the `/remote` link, so pairing stays a copy-the-address step.
///
/// Generated once per process and kept across start/stop so a link that was
/// already shared with a phone keeps working.
fn pair_token() -> &'static str {
    static TOKEN: OnceLock<String> = OnceLock::new();
    TOKEN
        .get_or_init(|| uuid::Uuid::new_v4().simple().to_string())
        .as_str()
}

/// Length-independent, non-short-circuiting comparison.
fn secret_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

fn query_param(uri: &axum::http::Uri, key: &str) -> Option<String> {
    let query = uri.query()?;
    for pair in query.split('&') {
        let Some((k, v)) = pair.split_once('=') else {
            continue;
        };
        if k == key {
            return Some(percent_decode(v));
        }
    }
    None
}

fn percent_decode(raw: &str) -> String {
    let bytes = raw.replace('+', " ").into_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok();
            if let Some(byte) = hex.and_then(|h| u8::from_str_radix(h, 16).ok()) {
                out.push(byte);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// A browser sends `Origin` on every WebSocket handshake. Ours is served from
/// the same address the socket lives on, so anything else is a cross-site page
/// dialling in and is refused even if it somehow learned the token.
fn origin_is_self(headers: &HeaderMap) -> bool {
    let Some(origin) = headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) else {
        // Non-browser client (no Origin): the token alone gates it.
        return true;
    };
    let origin_authority = origin
        .split_once("://")
        .map(|(_, rest)| rest)
        .unwrap_or(origin);
    let host = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    !host.is_empty() && origin_authority == host
}

#[cfg(test)]
mod pairing_tests {
    use super::*;

    fn headers(pairs: &[(&str, &str)]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for (name, value) in pairs {
            map.insert(
                HeaderName::from_bytes(name.as_bytes()).unwrap(),
                HeaderValue::from_str(value).unwrap(),
            );
        }
        map
    }

    #[test]
    fn only_the_pairing_token_opens_the_socket() {
        assert!(secret_eq(pair_token(), pair_token()));
        assert!(!secret_eq("", pair_token()));
        assert!(!secret_eq(&pair_token()[..8], pair_token()));
        assert!(!secret_eq(&format!("{}x", pair_token()), pair_token()));
    }

    #[test]
    fn reads_the_token_out_of_the_upgrade_query() {
        let uri: axum::http::Uri = "/api/remote?token=abc%2D123&x=1".parse().unwrap();
        assert_eq!(query_param(&uri, "token").as_deref(), Some("abc-123"));
        // A valueless parameter earlier in the string must not end the scan.
        let uri: axum::http::Uri = "/api/remote?flag&token=xyz".parse().unwrap();
        assert_eq!(query_param(&uri, "token").as_deref(), Some("xyz"));
        let uri: axum::http::Uri = "/api/remote".parse().unwrap();
        assert_eq!(query_param(&uri, "token"), None);
    }

    #[test]
    fn refuses_a_cross_site_page_dialling_in() {
        // Our own remote page: Origin matches the address it was served from.
        assert!(origin_is_self(&headers(&[
            ("host", "192.168.1.3:11471"),
            ("origin", "http://192.168.1.3:11471"),
        ])));
        // A random website the user has open, reaching for loopback.
        assert!(!origin_is_self(&headers(&[
            ("host", "127.0.0.1:11471"),
            ("origin", "https://evil.example"),
        ])));
        // Non-browser client: no Origin, so the token alone decides.
        assert!(origin_is_self(&headers(&[("host", "127.0.0.1:11471")])));
    }
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

async fn serve_http(
    State(state): State<ServeState>,
    uri: axum::http::Uri,
) -> Response<Body> {
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
    uri: axum::http::Uri,
    headers: HeaderMap,
) -> Response<Body> {
    let token = query_param(&uri, "token").unwrap_or_default();
    if !secret_eq(&token, pair_token()) || !origin_is_self(&headers) {
        eprintln!("[web-serve] rejected unpaired remote connection");
        return Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .header(header::CONTENT_TYPE, "text/plain")
            .body(Body::from(
                "Not paired. Open the phone remote using the link shown in Harbor's settings.",
            ))
            .unwrap();
    }
    ws.on_upgrade(move |socket| handle_remote_socket(socket, state))
        .into_response()
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

/// Pairing token for the remote socket. Desktop UI only — it is never served
/// over HTTP, otherwise it would not gate anything.
#[tauri::command]
pub fn remote_pair_token() -> String {
    pair_token().to_string()
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
