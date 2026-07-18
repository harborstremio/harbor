use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, HeaderName, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::TcpListener;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::cast_hls::HlsState;
use crate::transcode::{handle_transcode, TranscodeProfile};

#[derive(Clone)]
struct Session {
    url: String,
    base_url: Option<String>,
    headers: HashMap<String, String>,
    transcode: bool,
    profile: TranscodeProfile,
    burn_sub: Option<(String, String)>,
    created_at: Instant,
}

#[derive(Clone)]
pub struct ProxyState {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    port: u16,
    client: reqwest::Client,
    hls: HlsState,
}

#[derive(Serialize)]
pub struct RegisterResult {
    pub session_id: String,
    pub url: String,
}

#[derive(Deserialize)]
pub struct RegisterArgs {
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub transcode: bool,
    #[serde(default)]
    pub profile: Option<TranscodeProfile>,
    #[serde(default)]
    pub target_host: Option<String>,
    #[serde(default)]
    pub start_time_sec: Option<f64>,
    #[serde(default)]
    pub burn_sub_path: Option<String>,
    #[serde(default)]
    pub burn_sub_style: Option<String>,
}

impl ProxyState {
    pub fn placeholder() -> Self {
        ProxyState {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            port: 0,
            client: reqwest::Client::new(),
            hls: HlsState::new(),
        }
    }

    pub async fn start() -> Result<Self, String> {
        let listener = TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], 0)))
            .await
            .map_err(|e| format!("bind failed: {}", e))?;
        let port = listener
            .local_addr()
            .map_err(|e| format!("local_addr: {}", e))?
            .port();
        let client = reqwest::Client::builder()
            .hickory_dns(true)
            .pool_idle_timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| format!("client build: {}", e))?;
        let hls = HlsState::new();
        let state = ProxyState {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            port,
            client,
            hls: hls.clone(),
        };
        let proxy_routes = Router::new()
            .route("/s/{id}", get(handle_stream).head(handle_stream))
            .route(
                "/p/{id}/{*path}",
                get(handle_playlist).head(handle_playlist),
            )
            .route("/health", get(handle_health))
            .with_state(state.clone());
        let app = proxy_routes.merge(crate::cast_hls::router(hls));
        tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("[stream-proxy] server error: {}", e);
            }
        });
        Ok(state)
    }

    pub async fn register(&self, args: RegisterArgs) -> RegisterResult {
        let id = Uuid::new_v4().to_string();
        if !args.transcode {
            if let Some((base, last_seg, query)) = split_playlist_url(&args.url) {
                let session = Session {
                    url: args.url.clone(),
                    base_url: Some(base),
                    headers: args.headers,
                    transcode: false,
                    profile: args.profile.unwrap_or_default(),
                    burn_sub: None,
                    created_at: Instant::now(),
                };
                self.sessions.write().await.insert(id.clone(), session);
                let qs = query.map(|q| format!("?{}", q)).unwrap_or_default();
                let url = format!("http://127.0.0.1:{}/p/{}/{}{}", self.port, id, last_seg, qs);
                return RegisterResult {
                    session_id: id,
                    url,
                };
            }
        }
        let session = Session {
            url: args.url.clone(),
            base_url: None,
            headers: args.headers,
            transcode: args.transcode,
            profile: args.profile.unwrap_or_default(),
            burn_sub: None,
            created_at: Instant::now(),
        };
        self.sessions.write().await.insert(id.clone(), session);
        let suffix = if args.transcode { ".ts" } else { "" };
        let url = format!("http://127.0.0.1:{}/s/{}{}", self.port, id, suffix);
        RegisterResult {
            session_id: id,
            url,
        }
    }

    pub async fn register_cast(&self, args: RegisterArgs) -> RegisterResult {
        let id = Uuid::new_v4().to_string();
        let host = args
            .target_host
            .as_deref()
            .and_then(reachable_ip_for)
            .or_else(lan_ip)
            .unwrap_or_else(|| "127.0.0.1".to_string());
        let burn_sub = args
            .burn_sub_path
            .clone()
            .map(|path| (path, args.burn_sub_style.clone().unwrap_or_default()));
        if args.transcode {
            let seek = args.start_time_sec.unwrap_or(0.0).max(0.0);
            match self
                .hls
                .register_with_seek(
                    args.url.clone(),
                    args.headers.clone(),
                    seek,
                    burn_sub.clone(),
                )
                .await
            {
                Ok(hid) => {
                    let url = format!("http://{}:{}/cast/hls/{}/master.m3u8", host, self.port, hid);
                    eprintln!(
                        "[harbor::proxy] cast HLS session: {} (seek={:.1}s)",
                        url, seek
                    );
                    return RegisterResult {
                        session_id: hid,
                        url,
                    };
                }
                Err(e) => {
                    eprintln!("[harbor::proxy] HLS register failed ({}); falling back to direct transcode", e);
                }
            }
        }
        let playlist_parts = if args.transcode {
            None
        } else {
            split_playlist_url(&args.url)
        };
        if let Some((base, last_seg, query)) = playlist_parts {
            let session = Session {
                url: args.url.clone(),
                base_url: Some(base),
                headers: args.headers,
                transcode: false,
                profile: args.profile.unwrap_or_default(),
                burn_sub: None,
                created_at: Instant::now(),
            };
            self.sessions.write().await.insert(id.clone(), session);
            let qs = query.map(|q| format!("?{}", q)).unwrap_or_default();
            let url = format!("http://{}:{}/p/{}/{}{}", host, self.port, id, last_seg, qs);
            return RegisterResult {
                session_id: id,
                url,
            };
        }
        let session = Session {
            url: args.url.clone(),
            base_url: None,
            headers: args.headers,
            transcode: args.transcode,
            profile: args.profile.unwrap_or_default(),
            burn_sub,
            created_at: Instant::now(),
        };
        self.sessions.write().await.insert(id.clone(), session);
        let suffix = if args.transcode { ".ts" } else { "" };
        let url = format!("http://{}:{}/s/{}{}", host, self.port, id, suffix);
        RegisterResult {
            session_id: id,
            url,
        }
    }

    pub async fn unregister(&self, session_id: &str) {
        self.sessions.write().await.remove(session_id);
    }

    pub async fn stop_hls_session(&self, session_id: &str) -> bool {
        self.hls.stop_session(session_id).await
    }

    pub async fn stop_all_hls(&self) -> usize {
        self.hls.stop_all().await
    }

    pub async fn gc_idle(&self) -> usize {
        const PROXY_MAX_AGE: Duration = Duration::from_secs(3 * 60 * 60);
        const HLS_IDLE: Duration = Duration::from_secs(5 * 60);
        let now = Instant::now();
        let mut removed = {
            let mut map = self.sessions.write().await;
            let stale: Vec<String> = map
                .iter()
                .filter(|(_, s)| now.duration_since(s.created_at) > PROXY_MAX_AGE)
                .map(|(k, _)| k.clone())
                .collect();
            for k in &stale {
                map.remove(k);
            }
            stale.len()
        };
        removed += self.hls.evict_idle(HLS_IDLE).await;
        removed
    }
}

pub(crate) fn shutdown(app: &tauri::AppHandle) {
    use tauri::Manager;

    let state = app.state::<ProxyState>().inner().clone();
    tauri::async_runtime::block_on(async move {
        state.stop_all_hls().await;
    });
}

pub(crate) fn lan_ip() -> Option<String> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    let addr = socket.local_addr().ok()?;
    let ip = addr.ip();
    if ip.is_unspecified() || ip.is_loopback() {
        return None;
    }
    Some(ip.to_string())
}

/// Find the local interface IP that the OS would use to reach `target_host`.
/// Used so the URL we hand a cast device is on the same subnet as the device,
/// not the Tailscale/VPN interface that `lan_ip()` might pick up.
pub(crate) fn reachable_ip_for(target_host: &str) -> Option<String> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect((target_host, 1u16)).ok()?;
    let addr = socket.local_addr().ok()?;
    let ip = addr.ip();
    if ip.is_unspecified() || ip.is_loopback() {
        return None;
    }
    Some(ip.to_string())
}

async fn handle_health() -> &'static str {
    "ok"
}

fn split_playlist_url(url: &str) -> Option<(String, String, Option<String>)> {
    let (path_part, query) = match url.split_once('?') {
        Some((p, q)) => (p, Some(q.to_string())),
        None => (url, None),
    };
    let scheme_end = path_part.find("://")? + 3;
    let host_end = scheme_end + path_part[scheme_end..].find('/')?;
    let last_slash = path_part[host_end..].rfind('/').map(|i| i + host_end)?;
    let last_seg = &path_part[last_slash + 1..];
    if !last_seg.to_lowercase().ends_with(".m3u8") {
        return None;
    }
    let base = path_part[..last_slash].to_string();
    Some((base, last_seg.to_string(), query))
}

fn guess_ct_from_url(url: &str) -> &'static str {
    let lower = url.split('?').next().unwrap_or(url).to_lowercase();
    if lower.ends_with(".mp4") || lower.ends_with(".m4v") {
        return "video/mp4";
    }
    if lower.ends_with(".mkv") {
        return "video/x-matroska";
    }
    if lower.ends_with(".webm") {
        return "video/webm";
    }
    if lower.ends_with(".m3u8") {
        return "application/vnd.apple.mpegurl";
    }
    if lower.ends_with(".mpd") {
        return "application/dash+xml";
    }
    if lower.ends_with(".ts") {
        return "video/mp2t";
    }
    "video/mp4"
}

async fn handle_stream(
    State(state): State<ProxyState>,
    Path(id_with_ext): Path<String>,
    headers: HeaderMap,
) -> Response {
    let id = id_with_ext.trim_end_matches(".ts").to_string();
    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("(no-ua)");
    let range = headers
        .get("range")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("(no-range)");
    eprintln!("[harbor::proxy] req id={id} ua={ua} range={range}");
    let session = {
        let map = state.sessions.read().await;
        match map.get(&id) {
            Some(s) => s.clone(),
            None => {
                return (StatusCode::NOT_FOUND, "session not found").into_response();
            }
        }
    };

    if session.transcode {
        return handle_transcode(
            &session.url,
            &session.headers,
            &session.profile,
            session.burn_sub.as_ref(),
        )
        .await;
    }

    forward_upstream(&state, &session, &session.url, &headers).await
}

async fn handle_playlist(
    State(state): State<ProxyState>,
    Path((id, rest)): Path<(String, String)>,
    headers: HeaderMap,
    uri: axum::http::Uri,
) -> Response {
    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("(no-ua)");
    let range = headers
        .get("range")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("(no-range)");
    eprintln!("[harbor::proxy] playlist req id={id} path={rest} ua={ua} range={range}");
    let session = {
        let map = state.sessions.read().await;
        match map.get(&id) {
            Some(s) => s.clone(),
            None => return (StatusCode::NOT_FOUND, "session not found").into_response(),
        }
    };
    let base = match session.base_url.as_deref() {
        Some(b) => b,
        None => return (StatusCode::NOT_FOUND, "not a playlist session").into_response(),
    };
    let qs = uri.query().map(|q| format!("?{}", q)).unwrap_or_default();
    let upstream_url = format!("{}/{}{}", base, rest, qs);
    forward_upstream(&state, &session, &upstream_url, &headers).await
}

async fn forward_upstream(
    state: &ProxyState,
    session: &Session,
    upstream_url: &str,
    headers: &HeaderMap,
) -> Response {
    let mut req = state.client.get(upstream_url);
    let session_keys: std::collections::HashSet<String> =
        session.headers.keys().map(|k| k.to_lowercase()).collect();
    // NOTE: do NOT forward `accept-encoding` — reqwest manages compression
    // itself and rejects manual setting of this header (the noisy warning we
    // were seeing). The client gets the upstream encoding handled.
    for forward in [
        "range",
        "accept",
        "user-agent",
        "referer",
        "origin",
        "if-range",
        "if-none-match",
        "if-modified-since",
    ] {
        if session_keys.contains(forward) {
            continue;
        }
        if let Some(val) = headers.get(forward) {
            req = req.header(forward, val);
        }
    }
    for (k, v) in &session.headers {
        if k.to_lowercase() == "accept-encoding" {
            continue;
        }
        req = req.header(k, v);
    }

    let upstream = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            return (StatusCode::BAD_GATEWAY, format!("upstream error: {}", e)).into_response();
        }
    };

    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let upstream_ct = upstream
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("(none)")
        .to_string();
    let upstream_cr = upstream
        .headers()
        .get("content-range")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("(none)")
        .to_string();
    let upstream_cl = upstream
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("(none)")
        .to_string();
    eprintln!(
        "[harbor::proxy] upstream status={} ct={} content-range={} content-length={}",
        status, upstream_ct, upstream_cr, upstream_cl
    );
    let mut response_headers = HeaderMap::new();
    for forward in [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "etag",
        "last-modified",
        "cache-control",
    ] {
        if let Some(val) = upstream.headers().get(forward) {
            if let (Ok(name), Ok(value)) = (
                HeaderName::try_from(forward),
                HeaderValue::from_bytes(val.as_bytes()),
            ) {
                response_headers.insert(name, value);
            }
        }
    }
    // Cast receivers reject `application/octet-stream` for video — force-set
    // a reasonable video MIME if the upstream is unhelpful. The URL extension
    // is the best hint we have.
    let needs_ct_override = response_headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .map(|ct| ct.starts_with("application/octet-stream") || ct.starts_with("binary/"))
        .unwrap_or(true);
    if needs_ct_override {
        let ct = guess_ct_from_url(upstream_url);
        if let Ok(value) = HeaderValue::from_str(ct) {
            response_headers.insert(HeaderName::from_static("content-type"), value);
            eprintln!("[harbor::proxy] forced content-type={ct} (upstream was {upstream_ct})");
        }
    }
    if response_headers.get("accept-ranges").is_none() {
        response_headers.insert(
            HeaderName::from_static("accept-ranges"),
            HeaderValue::from_static("bytes"),
        );
    }
    response_headers.insert(
        HeaderName::from_static("access-control-allow-origin"),
        HeaderValue::from_static("*"),
    );
    response_headers.insert(
        HeaderName::from_static("access-control-allow-headers"),
        HeaderValue::from_static("Content-Type, Accept-Encoding, Range"),
    );
    response_headers.insert(
        HeaderName::from_static("access-control-expose-headers"),
        HeaderValue::from_static("Content-Length, Content-Range"),
    );

    let body_ct = response_headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_lowercase();
    let is_m3u8 = body_ct.contains("mpegurl")
        || upstream_url
            .split('?')
            .next()
            .unwrap_or("")
            .to_lowercase()
            .ends_with(".m3u8");

    if is_m3u8 {
        response_headers.insert(
            HeaderName::from_static("cache-control"),
            HeaderValue::from_static("no-cache"),
        );
        response_headers.insert(
            HeaderName::from_static("content-type"),
            HeaderValue::from_static("application/x-mpegURL"),
        );
        let original = match upstream.bytes().await {
            Ok(b) => b,
            Err(e) => {
                return (StatusCode::BAD_GATEWAY, format!("body read: {}", e)).into_response();
            }
        };
        let rewritten = inject_hls_codecs(std::str::from_utf8(&original).unwrap_or(""));
        let bytes = rewritten.into_bytes();
        response_headers.remove("content-length");
        response_headers.insert(
            HeaderName::from_static("content-length"),
            HeaderValue::from_str(&bytes.len().to_string()).unwrap(),
        );
        let mut resp = Response::builder().status(status);
        if let Some(h) = resp.headers_mut() {
            h.extend(response_headers);
        }
        return resp.body(Body::from(bytes)).unwrap_or_else(|_| {
            (StatusCode::INTERNAL_SERVER_ERROR, "response build failed").into_response()
        });
    }

    let stream = upstream.bytes_stream();
    let body = Body::from_stream(stream);
    let mut resp = Response::builder().status(status);
    if let Some(h) = resp.headers_mut() {
        h.extend(response_headers);
    }
    resp.body(body).unwrap_or_else(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, "response build failed").into_response()
    })
}

fn inject_hls_codecs(body: &str) -> String {
    const CODECS: &str = "avc1.640029,mp4a.40.2";
    let mut out = String::with_capacity(body.len() + 64);
    for line in body.split_inclusive('\n') {
        if line.starts_with("#EXT-X-STREAM-INF:") && !line.contains("CODECS=") {
            let (tag, rest) = line.split_at("#EXT-X-STREAM-INF:".len());
            out.push_str(tag);
            out.push_str("CODECS=\"");
            out.push_str(CODECS);
            out.push_str("\",");
            out.push_str(rest);
        } else {
            out.push_str(line);
        }
    }
    out
}

#[tauri::command]
pub async fn proxy_register(
    args: RegisterArgs,
    state: tauri::State<'_, ProxyState>,
) -> Result<RegisterResult, String> {
    Ok(state.register(args).await)
}

#[tauri::command]
pub async fn proxy_unregister(
    session_id: String,
    state: tauri::State<'_, ProxyState>,
) -> Result<(), String> {
    state.unregister(&session_id).await;
    Ok(())
}

#[tauri::command]
pub async fn proxy_gc_idle(state: tauri::State<'_, ProxyState>) -> Result<usize, String> {
    Ok(state.gc_idle().await)
}
