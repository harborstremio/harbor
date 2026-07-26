use std::io::SeekFrom;
use std::path::Path as FsPath;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Json, Path, RawQuery, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::Router;
use librqbit::api::TorrentIdOrHash;
use librqbit::Session;
use serde::Deserialize;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

pub fn router(session: Arc<Session>) -> Router {
    Router::new()
        .route("/stream/{hash}/{file_id}", get(h_stream).head(h_stream))
        .route("/health", get(health))
        .route("/settings", get(h_settings))
        .route("/{hash}/create", post(h_create))
        .route("/{hash}/{file_id}", get(h_remote_stream).head(h_remote_stream))
        .with_state(session)
}

async fn health() -> &'static str {
    "ok"
}

/// Guard for every route that streams or adds a torrent.
///
/// Without it, a plain cross-origin `GET` from any web page — or any host on
/// the Wi-Fi once the LAN server is on — reaches `h_remote_stream`, which adds
/// the requested info hash and starts downloading and seeding it. Harbor puts
/// the key on the URLs it builds (`?tok=`), and mpv / cast devices simply fetch
/// the URL they were given, so nothing legitimate needs to know about it.
fn authorized(query: Option<&str>, headers: &HeaderMap) -> bool {
    if let Some(value) = headers
        .get("x-harbor-engine-token")
        .and_then(|v| v.to_str().ok())
    {
        if super::token_matches(value) {
            return true;
        }
    }
    let Some(raw) = query else { return false };
    for pair in raw.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        if key == "tok" {
            if let Some(decoded) = urldecode(value) {
                return super::token_matches(&decoded);
            }
        }
    }
    false
}

#[cfg(test)]
mod auth_tests {
    use super::*;

    fn key() -> String {
        crate::torrent_engine::engine_token().to_string()
    }

    #[test]
    fn accepts_the_engine_key_from_query_or_header() {
        let query = format!("tok={}", key());
        assert!(authorized(Some(&query), &HeaderMap::new()));

        let with_other_params = format!("tr=udp%3A%2F%2Ftracker&tok={}&f=file.mkv", key());
        assert!(authorized(Some(&with_other_params), &HeaderMap::new()));

        let mut headers = HeaderMap::new();
        headers.insert("x-harbor-engine-token", key().parse().unwrap());
        assert!(authorized(None, &headers));
    }

    #[test]
    fn refuses_everything_else() {
        // The drive-by case: a plain cross-origin GET carries no key at all.
        assert!(!authorized(None, &HeaderMap::new()));
        assert!(!authorized(Some(""), &HeaderMap::new()));
        assert!(!authorized(Some("tr=udp%3A%2F%2Ftracker"), &HeaderMap::new()));
        assert!(!authorized(Some("tok="), &HeaderMap::new()));
        assert!(!authorized(Some("tok=00000000000000000000000000000000"), &HeaderMap::new()));
        // A prefix of the real key must not pass.
        let truncated = format!("tok={}", &key()[..8]);
        assert!(!authorized(Some(&truncated), &HeaderMap::new()));

        let mut headers = HeaderMap::new();
        headers.insert("x-harbor-engine-token", "nope".parse().unwrap());
        assert!(!authorized(None, &headers));
    }
}

fn unauthorized() -> Response {
    (
        StatusCode::FORBIDDEN,
        "Missing or invalid engine key. This endpoint is only for Harbor on this machine.",
    )
        .into_response()
}

async fn h_settings() -> Response {
    let body = serde_json::json!({
        "values": {
            "serverVersion": "harbor-engine",
            "appPath": "",
            "cacheRoot": "",
            "cacheSize": serde_json::Value::Null,
            "transcodeProfile": serde_json::Value::Null,
        }
    });
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/json")],
        body.to_string(),
    )
        .into_response()
}

#[derive(Deserialize)]
struct CreateBody {
    #[serde(rename = "peerSearch")]
    peer_search: Option<PeerSearch>,
}

#[derive(Deserialize)]
struct PeerSearch {
    sources: Option<Vec<String>>,
}

fn trackers_from_sources(sources: Option<Vec<String>>) -> Vec<String> {
    sources
        .unwrap_or_default()
        .into_iter()
        .filter_map(|s| {
            if let Some(rest) = s.strip_prefix("tracker:") {
                Some(rest.to_string())
            } else if s.starts_with("dht:") {
                None
            } else if s.starts_with("udp://") || s.starts_with("http://") || s.starts_with("https://") || s.starts_with("ws://") || s.starts_with("wss://") {
                Some(s)
            } else {
                None
            }
        })
        .collect()
}

fn trackers_from_query(query: Option<String>) -> Vec<String> {
    let raw = query.unwrap_or_default();
    raw.split('&')
        .filter_map(|pair| pair.strip_prefix("tr="))
        .filter_map(|v| urldecode(v))
        .filter(|v| !v.is_empty())
        .collect()
}

fn urldecode(input: &str) -> Option<String> {
    let bytes = input.replace('+', " ");
    let bytes = bytes.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let h = std::str::from_utf8(&bytes[i + 1..i + 3]).ok()?;
            let n = u8::from_str_radix(h, 16).ok()?;
            out.push(n);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

async fn h_create(
    State(_session): State<Arc<Session>>,
    Path(hash): Path<String>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
    Json(body): Json<CreateBody>,
) -> Response {
    if !authorized(query.as_deref(), &headers) {
        return unauthorized();
    }
    let trackers = trackers_from_sources(body.peer_search.and_then(|p| p.sources));
    match super::ensure_added(&hash, trackers, None).await {
        Ok((_info_hash, files)) => {
            let guessed = files
                .iter()
                .max_by_key(|f| f.length)
                .map(|f| f.idx);
            let out = serde_json::json!({
                "guessedFileIdx": guessed,
                "files": files,
            });
            (StatusCode::OK, [(header::CONTENT_TYPE, "application/json")], out.to_string()).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

async fn h_remote_stream(
    State(session): State<Arc<Session>>,
    Path((hash, file_id)): Path<(String, usize)>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Response {
    if !authorized(query.as_deref(), &headers) {
        return unauthorized();
    }
    let trackers = trackers_from_query(query);
    if let Err(e) = super::ensure_added(&hash, trackers, Some(file_id)).await {
        return (StatusCode::NOT_FOUND, e).into_response();
    }
    stream_file(&session, &hash, file_id, &headers).await
}

async fn h_stream(
    State(session): State<Arc<Session>>,
    Path((hash, file_id)): Path<(String, usize)>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Response {
    if !authorized(query.as_deref(), &headers) {
        return unauthorized();
    }
    stream_file(&session, &hash, file_id, &headers).await
}

async fn stream_file(
    session: &Arc<Session>,
    hash: &str,
    file_id: usize,
    headers: &HeaderMap,
) -> Response {
    let Ok(id) = TorrentIdOrHash::parse(hash) else {
        return (StatusCode::BAD_REQUEST, "bad hash").into_response();
    };
    let Some(handle) = session.get(id) else {
        return (StatusCode::NOT_FOUND, "no torrent").into_response();
    };
    let ct = handle
        .with_metadata(|m| m.file_infos.get(file_id).map(|fi| ct_for(&fi.relative_filename)))
        .ok()
        .flatten()
        .unwrap_or("application/octet-stream");
    let mut stream = match handle.stream(file_id) {
        Ok(s) => s,
        Err(e) => return (StatusCode::NOT_FOUND, format!("{e:#}")).into_response(),
    };
    let len = stream.len();
    let parsed = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(parse_range);
    let (status, start, end) = match parsed {
        Some((s, e_opt)) => {
            let e = e_opt.map(|x| x + 1).unwrap_or(len);
            if e > len || e <= s {
                return (StatusCode::RANGE_NOT_SATISFIABLE, "range not satisfiable").into_response();
            }
            (StatusCode::PARTIAL_CONTENT, s, e)
        }
        None => (StatusCode::OK, 0u64, len),
    };
    if start > 0 && stream.seek(SeekFrom::Start(start)).await.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "seek failed").into_response();
    }
    let to_take = end - start;
    let mut out = HeaderMap::new();
    out.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    out.insert(header::CONTENT_TYPE, HeaderValue::from_static(ct));
    out.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&to_take.to_string()).unwrap(),
    );
    if status == StatusCode::PARTIAL_CONTENT {
        out.insert(
            header::CONTENT_RANGE,
            HeaderValue::from_str(&format!("bytes {}-{}/{}", start, end - 1, len)).unwrap(),
        );
    }
    let body = Body::from_stream(tokio_util::io::ReaderStream::with_capacity(
        stream.take(to_take),
        65536,
    ));
    (status, out, body).into_response()
}

fn parse_range(raw: &str) -> Option<(u64, Option<u64>)> {
    let spec = raw.trim().strip_prefix("bytes=")?;
    let (s, e) = spec.split_once('-')?;
    let start: u64 = s.trim().parse().ok()?;
    let end = e.trim();
    if end.is_empty() {
        Some((start, None))
    } else {
        Some((start, Some(end.parse().ok()?)))
    }
}

fn ct_for(path: &FsPath) -> &'static str {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "mp4" | "m4v" => "video/mp4",
        "mkv" => "video/x-matroska",
        "webm" => "video/webm",
        "avi" => "video/x-msvideo",
        "mov" => "video/quicktime",
        "ts" | "m2ts" | "mts" => "video/mp2t",
        "ogv" => "video/ogg",
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        "aac" | "m4a" => "audio/aac",
        "srt" => "application/x-subrip",
        "vtt" => "text/vtt",
        _ => "application/octet-stream",
    }
}
