//! Android P2P probe.
//!
//! Answers three questions and nothing else, in this order:
//!   1. Does Harbor's exact librqbit pin cross-compile for aarch64-linux-android.
//!   2. Does DHT reach peers from inside a TV stick's network stack.
//!   3. Can it serve an HTTP byte range off a live torrent on that device.
//!
//! If it fails at 1 the whole Android plan changes to debrid-only and nobody
//! should have touched src-tauri/src/lib.rs yet. That is why this exists as a
//! throwaway crate outside src-tauri rather than as a branch of the real app.
//!
//! It compiles and runs on the desktop host too, which is how the code below
//! and `p2p_android.rs` were verified at all. A host run proves the code is
//! real. It proves nothing about Android.

// The real module, compiled here rather than copied. If p2p_android.rs stops
// compiling, this crate stops compiling, which is the point.
#[path = "../../../src-tauri/src/p2p_android.rs"]
mod p2p_android;

use std::collections::HashSet;
use std::io::SeekFrom;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Path as AxPath, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use librqbit::{AddTorrent, AddTorrentOptions, ManagedTorrent, Session};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio::net::TcpListener;
use tokio::time::timeout;

const USAGE: &str = "\
usage: android-p2p-probe <magnet> [storage-root] [port]

  magnet        required. A well seeded magnet you have verified is alive on a
                desktop first. No default is baked in on purpose: a dead hash
                would report \"no peers\" and send you hunting a network bug
                that is not there.
  storage-root  default ./probe-data. On device use an app-writable path.
  port          default 11470, the port Harbor's engine already uses.
";

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("[probe] FAILED: {e}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), String> {
    let mut args = std::env::args().skip(1);
    let magnet = match args.next() {
        Some(m) if m.starts_with("magnet:") => m,
        _ => {
            eprint!("{USAGE}");
            std::process::exit(2);
        }
    };
    let root = args
        .next()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("./probe-data"));
    let port: u16 = args
        .next()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT);

    // Exercises the real policy function rather than reimplementing it.
    let dir = p2p_android::engine_root(&root);
    std::fs::create_dir_all(&dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
    std::env::set_var("DHT_QUERIES_PER_SECOND", p2p_android::DHT_QUERIES_PER_SECOND);

    println!("[probe] storage   {}", dir.display());
    println!("[probe] dht qps   {}", p2p_android::DHT_QUERIES_PER_SECOND);
    println!("[probe] up cap    {} B/s", p2p_android::MAX_UPLOAD_BPS);

    let (session, tier) = open_session(&dir).await?;
    println!("[probe] session   tier {tier}");

    let handle = add(&session, &magnet).await?;
    let files = handle
        .with_metadata(|m| {
            m.file_infos
                .iter()
                .enumerate()
                .map(|(idx, fi)| (idx, fi.relative_filename.display().to_string(), fi.len))
                .collect::<Vec<_>>()
        })
        .map_err(|e| format!("{e:#}"))?;
    for (idx, name, len) in &files {
        println!("[probe] file {idx}  {len:>13}  {name}");
    }

    let listener = TcpListener::bind(("0.0.0.0", port))
        .await
        .map_err(|e| format!("bind 0.0.0.0:{port}: {e}"))?;
    println!("[probe] serving   http://127.0.0.1:{port}/stream/<file_id>");
    println!("[probe] test with curl -r 0-1048576 -o /dev/null -w '%{{http_code}} %{{size_download}}\\n' http://127.0.0.1:{port}/stream/0");

    let router = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/stream/{file_id}", get(h_stream).head(h_stream))
        .with_state(handle.clone());

    tokio::spawn(stats_loop(handle));
    axum::serve(listener, router)
        .await
        .map_err(|e| format!("serve: {e}"))
}

const DEFAULT_PORT: u16 = 11470;

/// Same tier ladder torrent_engine::init walks, minus the no-DHT floor. On a TV
/// stick tier 1 is expected to fail: there is no UPnP-friendly path through most
/// living-room routers and no inbound port. Seeing "tier 2" here is a pass, not
/// a warning.
async fn open_session(dir: &Path) -> Result<(Arc<Session>, u8), String> {
    let ladder = [(true, true, true), (false, true, true), (false, true, false)];
    let mut last = String::new();
    for (i, (full, dht, persist)) in ladder.into_iter().enumerate() {
        let opts = p2p_android::session_options(dir, full, dht, persist, HashSet::new());
        match Session::new_with_opts(dir.to_path_buf(), opts).await {
            Ok(s) => return Ok((s, i as u8 + 1)),
            Err(e) => {
                last = format!("{e:#}");
                eprintln!("[probe] tier {} unavailable: {last}", i + 1);
            }
        }
    }
    Err(format!("no session tier started, last error: {last}"))
}

async fn add(session: &Arc<Session>, magnet: &str) -> Result<Arc<ManagedTorrent>, String> {
    let opts = AddTorrentOptions {
        overwrite: true,
        paused: false,
        peer_opts: Some(p2p_android::peer_opts()),
        force_tracker_interval: Some(Duration::from_secs(300)),
        ..Default::default()
    };
    let added = timeout(
        Duration::from_secs(90),
        session.add_torrent(AddTorrent::from_url(magnet), Some(opts)),
    )
    .await
    .map_err(|_| "metadata timed out: no peers reached in 90s".to_string())?
    .map_err(|e| format!("{e:#}"))?;
    let handle = added
        .into_handle()
        .ok_or_else(|| "torrent added as list-only".to_string())?;
    timeout(Duration::from_secs(60), handle.wait_until_initialized())
        .await
        .map_err(|_| "torrent init timed out in 60s".to_string())?
        .map_err(|e| format!("{e:#}"))?;
    Ok(handle)
}

async fn stats_loop(handle: Arc<ManagedTorrent>) {
    loop {
        tokio::time::sleep(Duration::from_secs(3)).await;
        println!("[probe] {}", handle.stats());
    }
}

async fn h_stream(
    State(handle): State<Arc<ManagedTorrent>>,
    AxPath(file_id): AxPath<usize>,
    headers: HeaderMap,
) -> Response {
    let mut stream = match handle.stream(file_id) {
        Ok(s) => s,
        Err(e) => return (StatusCode::NOT_FOUND, format!("{e:#}")).into_response(),
    };
    let len = stream.len();
    let (status, start, end) = match parse_range(&headers) {
        Some((s, e_opt)) => {
            let e = e_opt.map(|x| x + 1).unwrap_or(len);
            if e > len || e <= s {
                return (StatusCode::RANGE_NOT_SATISFIABLE, "range").into_response();
            }
            (StatusCode::PARTIAL_CONTENT, s, e)
        }
        None => (StatusCode::OK, 0u64, len),
    };
    if start > 0 && stream.seek(SeekFrom::Start(start)).await.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "seek").into_response();
    }
    let take = end - start;
    let mut out = HeaderMap::new();
    out.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    out.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/octet-stream"),
    );
    out.insert(
        header::CONTENT_LENGTH,
        HeaderValue::from_str(&take.to_string()).unwrap(),
    );
    if status == StatusCode::PARTIAL_CONTENT {
        out.insert(
            header::CONTENT_RANGE,
            HeaderValue::from_str(&format!("bytes {}-{}/{}", start, end - 1, len)).unwrap(),
        );
    }
    let body = Body::from_stream(tokio_util::io::ReaderStream::with_capacity(
        stream.take(take),
        65536,
    ));
    (status, out, body).into_response()
}

fn parse_range(headers: &HeaderMap) -> Option<(u64, Option<u64>)> {
    let raw = headers.get(header::RANGE)?.to_str().ok()?;
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
