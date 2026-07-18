mod cache_sweep;
mod dht_boot;
mod netcheck;
mod selftest;
mod stream_route;
mod trackers;

use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use librqbit::api::TorrentIdOrHash;
use librqbit::dht::{Dht, PersistentDhtConfig};
use librqbit::{
    AddTorrent, AddTorrentOptions, PeerConnectionOptions, Session, SessionOptions,
    SessionPersistenceConfig,
};
use serde::Serialize;
use tauri::{AppHandle, Manager};
use tokio::net::TcpListener;
use tokio::time::timeout;

struct EngineState {
    session: Option<Arc<Session>>,
    side_dht: Option<Dht>,
    port: Option<u16>,
    dht_tier: u8,
    ready: bool,
    last_error: Option<String>,
    server: Option<tokio::task::JoinHandle<()>>,
    sweeper: Option<CacheSweeper>,
    lan_server: Option<tokio::task::JoinHandle<()>>,
    lan_port: Option<u16>,
    lan_error: Option<String>,
}

fn engine() -> &'static Mutex<EngineState> {
    static S: OnceLock<Mutex<EngineState>> = OnceLock::new();
    S.get_or_init(|| {
        Mutex::new(EngineState {
            session: None,
            side_dht: None,
            port: None,
            dht_tier: 0,
            ready: false,
            last_error: None,
            server: None,
            sweeper: None,
            lan_server: None,
            lan_port: None,
            lan_error: None,
        })
    })
}

pub const LAN_SERVER_PORT: u16 = 11470;

const CACHE_SWEEP_INITIAL_DELAY_SECS: u64 = 60;
const CACHE_SWEEP_INTERVAL_SECS: u64 = 30 * 60;
static CACHE_SWEEP_RUNNING: AtomicBool = AtomicBool::new(false);

struct CacheSweepGuard;

impl Drop for CacheSweepGuard {
    fn drop(&mut self) {
        CACHE_SWEEP_RUNNING.store(false, Ordering::Release);
    }
}

struct CacheSweeper {
    task: tokio::task::JoinHandle<()>,
    cancelled: Arc<AtomicBool>,
}

impl CacheSweeper {
    fn cancel(self) {
        self.cancelled.store(true, Ordering::Release);
        self.task.abort();
    }
}

fn spawn_cache_sweeper(app: AppHandle) -> CacheSweeper {
    let cancelled = Arc::new(AtomicBool::new(false));
    let cancelled_for_task = cancelled.clone();
    let task = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(CACHE_SWEEP_INITIAL_DELAY_SECS)).await;
        loop {
            if cancelled_for_task.load(Ordering::Acquire) {
                break;
            }
            let cfg = read_config(&app);
            if let Ok(dir) = engine_dir(&app, &cfg) {
                let retention = cfg.retention_hours.unwrap_or(24);
                let max_gb = cfg.max_gb.unwrap_or(0);
                let started = std::time::Instant::now();
                let cancelled_for_sweep = cancelled_for_task.clone();
                let result = tokio::task::spawn_blocking(move || {
                    if CACHE_SWEEP_RUNNING
                        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
                        .is_err()
                    {
                        return None;
                    }
                    let _guard = CacheSweepGuard;
                    Some(cache_sweep::run_with_cancel(
                        &dir,
                        retention,
                        max_gb,
                        &cancelled_for_sweep,
                    ))
                })
                .await;
                match result {
                    Ok(Some(stats)) => eprintln!(
                        "[torrent-engine] cache sweep completed in {:?}: scanned={} deleted={} reclaimed_bytes={} errors={} cancelled={}",
                        started.elapsed(),
                        stats.scanned,
                        stats.deleted,
                        stats.reclaimed_bytes,
                        stats.errors,
                        stats.cancelled,
                    ),
                    Ok(None) => eprintln!("[torrent-engine] cache sweep skipped; another sweep is active"),
                    Err(error) => eprintln!("[torrent-engine] cache sweep task failed: {error}"),
                }
            }
            tokio::time::sleep(Duration::from_secs(CACHE_SWEEP_INTERVAL_SECS)).await;
        }
    });
    CacheSweeper { task, cancelled }
}

fn current_session() -> Option<Arc<Session>> {
    engine().lock().unwrap().session.clone()
}

fn current_side_dht() -> Option<Dht> {
    engine().lock().unwrap().side_dht.clone()
}

fn current_port() -> Option<u16> {
    engine().lock().unwrap().port
}

#[derive(Serialize)]
pub struct EngineStatusDto {
    ready: bool,
    port: Option<u16>,
    active_torrents: usize,
    last_error: Option<String>,
    dht_tier: u8,
    dht_nodes: usize,
}

#[derive(Serialize)]
pub struct EngineFile {
    idx: usize,
    name: String,
    length: u64,
}

#[derive(Serialize)]
pub struct AddResult {
    info_hash: String,
    files: Vec<EngineFile>,
    stream_base: String,
}

#[derive(Serialize)]
pub struct TorrentEngineStats {
    peers: usize,
    unchoked: usize,
    downloaded: u64,
    #[serde(rename = "downloadSpeed")]
    download_speed: u64,
    #[serde(rename = "streamProgress")]
    stream_progress: u64,
    #[serde(rename = "streamLen")]
    stream_len: u64,
    #[serde(rename = "peerSearchRunning")]
    peer_search_running: bool,
    finished: bool,
    state: String,
}

async fn new_session(
    dir: &std::path::Path,
    full: bool,
    dht: bool,
    persist_dht: bool,
) -> Result<Arc<Session>, String> {
    Session::new_with_opts(
        dir.to_path_buf(),
        SessionOptions {
            fastresume: true,
            persistence: Some(SessionPersistenceConfig::Json {
                folder: Some(dir.to_path_buf()),
            }),
            disable_dht: !dht,
            disable_dht_persistence: !persist_dht,
            dht_config: persist_dht.then(|| PersistentDhtConfig {
                config_filename: Some(dir.join("dht.json")),
                dump_interval: None,
            }),
            trackers: trackers::as_url_set(),
            listen_port_range: if full { Some(16881..16931) } else { None },
            enable_upnp_port_forwarding: full,
            ..Default::default()
        },
    )
    .await
    .map_err(|e| format!("{e:#}"))
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct EngineConfig {
    dir: Option<String>,
    retention_hours: Option<u64>,
    max_gb: Option<u64>,
}

fn config_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path()
        .app_cache_dir()
        .ok()
        .map(|d| d.join("engine.json"))
}

fn read_config(app: &AppHandle) -> EngineConfig {
    config_path(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<EngineConfig>(&s).ok())
        .unwrap_or_default()
}

fn engine_dir(app: &AppHandle, cfg: &EngineConfig) -> Result<std::path::PathBuf, String> {
    if let Some(custom) = cfg.dir.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        return Ok(std::path::PathBuf::from(custom).join("harbor-stream-cache"));
    }
    app.path()
        .app_cache_dir()
        .map_err(|e| e.to_string())
        .map(|d| d.join("engine"))
}

async fn init(app: AppHandle) -> Result<(), String> {
    std::env::set_var("DHT_QUERIES_PER_SECOND", "20");
    let cfg = read_config(&app);
    let dir = engine_dir(&app, &cfg)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let (session, dht_tier) = match new_session(&dir, true, true, true).await {
        Ok(s) => (s, 1u8),
        Err(e1) => {
            eprintln!("[torrent-engine] tier1 (inbound + warm dht) unavailable ({e1}); trying no-inbound + warm dht");
            match new_session(&dir, false, true, true).await {
                Ok(s) => (s, 2u8),
                Err(e2) => {
                    eprintln!(
                        "[torrent-engine] tier2 unavailable ({e2}); trying cold ephemeral dht"
                    );
                    match new_session(&dir, false, true, false).await {
                        Ok(s) => (s, 3u8),
                        Err(e3) => {
                            eprintln!("[torrent-engine] tier3 (cold dht) unavailable ({e3}); starting without dht");
                            (new_session(&dir, false, false, false).await?, 4u8)
                        }
                    }
                }
            }
        }
    };
    let side_dht = dht_boot::build().await;
    let listener = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
        .await
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let router = stream_route::router(session.clone());
    let server = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, router).await {
            eprintln!("[torrent-engine] server error: {e}");
        }
    });
    let sweeper = spawn_cache_sweeper(app.clone());
    let mut st = engine().lock().unwrap();
    if let Some(old) = st.server.take() {
        old.abort();
    }
    if let Some(old) = st.sweeper.take() {
        old.cancel();
    }
    st.session = Some(session);
    st.side_dht = side_dht;
    st.port = Some(port);
    st.dht_tier = dht_tier;
    st.ready = true;
    st.last_error = None;
    st.server = Some(server);
    st.sweeper = Some(sweeper);
    eprintln!("[torrent-engine] ready on 127.0.0.1:{port} (dht tier {dht_tier})");
    Ok(())
}

async fn ensure_session(app: &AppHandle) -> Result<Arc<Session>, String> {
    if let Some(s) = current_session() {
        return Ok(s);
    }
    if crate::settings_store::read_torrents_disabled(app) {
        return Err("torrents disabled in settings".to_string());
    }
    init(app.clone()).await?;
    current_session().ok_or_else(|| "engine failed to initialize".to_string())
}

pub fn ensure_started_on_setup(app: &AppHandle) {
    if crate::settings_store::read_torrents_disabled(app) {
        eprintln!("[torrent-engine] torrents disabled in settings — skipping engine init");
        let mut st = engine().lock().unwrap();
        st.ready = false;
        st.last_error = Some("torrents disabled in settings".to_string());
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = init(app).await {
            eprintln!("[torrent-engine] init failed: {e}");
            let mut st = engine().lock().unwrap();
            st.ready = false;
            st.last_error = Some(e);
        }
    });
}

pub fn stop() {
    let mut st = engine().lock().unwrap();
    if let Some(server) = st.server.take() {
        server.abort();
    }
    if let Some(sweeper) = st.sweeper.take() {
        sweeper.cancel();
    }
    st.session = None;
    st.side_dht = None;
    st.port = None;
    st.dht_tier = 0;
    st.ready = false;
}

#[tauri::command]
pub fn torrent_engine_status() -> EngineStatusDto {
    let (port, ready, last_error, dht_tier) = {
        let st = engine().lock().unwrap();
        (st.port, st.ready, st.last_error.clone(), st.dht_tier)
    };
    let active_torrents = current_session()
        .map(|s| s.with_torrents(|t| t.count()))
        .unwrap_or(0);
    let dht_nodes = current_side_dht()
        .map(|d| dht_boot::node_count(&d))
        .unwrap_or(0);
    EngineStatusDto {
        ready,
        port,
        active_torrents,
        last_error,
        dht_tier,
        dht_nodes,
    }
}

fn merge_trackers(trackers: Vec<String>) -> Vec<String> {
    trackers::merge_into(trackers)
}

#[tauri::command]
pub async fn torrent_engine_add(
    app: AppHandle,
    magnet: String,
    trackers: Vec<String>,
    file_idx: Option<usize>,
) -> Result<AddResult, String> {
    let session = ensure_session(&app).await?;
    let seed = match current_side_dht() {
        Some(d) => dht_boot::seed_peers(&d, magnet.as_str(), 40, Duration::from_secs(3)).await,
        None => Vec::new(),
    };
    let opts = AddTorrentOptions {
        overwrite: true,
        paused: true,
        only_files: file_idx.map(|i| vec![i]),
        trackers: Some(merge_trackers(trackers)),
        initial_peers: (!seed.is_empty()).then_some(seed),
        peer_opts: Some(PeerConnectionOptions {
            connect_timeout: Some(Duration::from_secs(7)),
            read_write_timeout: Some(Duration::from_secs(10)),
            keep_alive_interval: None,
        }),
        force_tracker_interval: Some(Duration::from_secs(300)),
        ..Default::default()
    };
    let added = timeout(
        Duration::from_secs(60),
        session.add_torrent(AddTorrent::from_url(magnet.as_str()), Some(opts)),
    )
    .await
    .map_err(|_| "metadata timed out: no peers reached in 60s".to_string())?
    .map_err(|e| format!("{e:#}"))?;
    let handle = added
        .into_handle()
        .ok_or_else(|| "torrent added as list-only".to_string())?;
    let info_hash = format!("{:?}", handle.info_hash());
    let files = handle
        .with_metadata(|m| {
            m.file_infos
                .iter()
                .enumerate()
                .map(|(idx, fi)| EngineFile {
                    idx,
                    name: fi
                        .relative_filename
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| fi.relative_filename.to_string_lossy().to_string()),
                    length: fi.len,
                })
                .collect::<Vec<_>>()
        })
        .map_err(|e| format!("{e:#}"))?;
    timeout(Duration::from_secs(45), handle.wait_until_initialized())
        .await
        .map_err(|_| "torrent init timed out".to_string())?
        .map_err(|e| format!("{e:#}"))?;
    let narrow_idx = file_idx
        .filter(|&i| i < files.len())
        .or_else(|| files.iter().max_by_key(|f| f.length).map(|f| f.idx));
    if let Some(idx) = narrow_idx {
        let only: HashSet<usize> = HashSet::from([idx]);
        if let Err(e) = session.update_only_files(&handle, &only).await {
            eprintln!("[torrent-engine] initial file narrowing failed: {e:#}");
        }
    }
    let port = current_port().ok_or_else(|| "engine port unavailable".to_string())?;
    Ok(AddResult {
        info_hash,
        files,
        stream_base: format!("http://127.0.0.1:{port}/stream"),
    })
}

fn build_magnet(hash: &str) -> String {
    format!("magnet:?xt=urn:btih:{hash}")
}

pub(crate) async fn ensure_added(
    hash: &str,
    trackers: Vec<String>,
    file_idx: Option<usize>,
) -> Result<(String, Vec<EngineFile>), String> {
    let session = current_session().ok_or_else(|| "engine not ready".to_string())?;
    let id = TorrentIdOrHash::parse(hash).map_err(|e| e.to_string())?;
    let handle = match session.get(id) {
        Some(h) => h,
        None => {
            let magnet = build_magnet(hash);
            let seed = match current_side_dht() {
                Some(d) => {
                    dht_boot::seed_peers(&d, magnet.as_str(), 40, Duration::from_secs(3)).await
                }
                None => Vec::new(),
            };
            let opts = AddTorrentOptions {
                overwrite: true,
                paused: file_idx.is_none(),
                only_files: file_idx.map(|i| vec![i]),
                trackers: Some(merge_trackers(trackers)),
                initial_peers: (!seed.is_empty()).then_some(seed),
                peer_opts: Some(PeerConnectionOptions {
                    connect_timeout: Some(Duration::from_secs(7)),
                    read_write_timeout: Some(Duration::from_secs(10)),
                    keep_alive_interval: None,
                }),
                force_tracker_interval: Some(Duration::from_secs(300)),
                ..Default::default()
            };
            let added = timeout(
                Duration::from_secs(60),
                session.add_torrent(AddTorrent::from_url(magnet.as_str()), Some(opts)),
            )
            .await
            .map_err(|_| "metadata timed out: no peers reached in 60s".to_string())?
            .map_err(|e| format!("{e:#}"))?;
            let h = added
                .into_handle()
                .ok_or_else(|| "torrent added as list-only".to_string())?;
            timeout(Duration::from_secs(45), h.wait_until_initialized())
                .await
                .map_err(|_| "torrent init timed out".to_string())?
                .map_err(|e| format!("{e:#}"))?;
            h
        }
    };
    let info_hash = format!("{:?}", handle.info_hash());
    let files = handle
        .with_metadata(|m| {
            m.file_infos
                .iter()
                .enumerate()
                .map(|(idx, fi)| EngineFile {
                    idx,
                    name: fi
                        .relative_filename
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| fi.relative_filename.to_string_lossy().to_string()),
                    length: fi.len,
                })
                .collect::<Vec<_>>()
        })
        .map_err(|e| format!("{e:#}"))?;
    if let Some(idx) = file_idx.filter(|&i| i < files.len()) {
        let only: HashSet<usize> = HashSet::from([idx]);
        let _ = session.update_only_files(&handle, &only).await;
        let _ = session.unpause(&handle).await;
    }
    Ok((info_hash, files))
}

pub fn lan_status() -> (bool, Option<u16>, Option<String>) {
    let st = engine().lock().unwrap();
    (st.lan_server.is_some(), st.lan_port, st.lan_error.clone())
}

pub async fn start_lan_server(app: &AppHandle) -> Result<u16, String> {
    let session = ensure_session(app).await?;
    stop_lan_server();
    let listener = match TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], LAN_SERVER_PORT))).await
    {
        Ok(l) => l,
        Err(e) => {
            let msg = format!("port {LAN_SERVER_PORT} unavailable: {e}");
            engine().lock().unwrap().lan_error = Some(msg.clone());
            return Err(msg);
        }
    };
    let router = stream_route::router(session);
    let server = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, router).await {
            eprintln!("[torrent-engine] lan server error: {e}");
        }
    });
    let mut st = engine().lock().unwrap();
    st.lan_server = Some(server);
    st.lan_port = Some(LAN_SERVER_PORT);
    st.lan_error = None;
    Ok(LAN_SERVER_PORT)
}

pub fn stop_lan_server() {
    let mut st = engine().lock().unwrap();
    if let Some(h) = st.lan_server.take() {
        h.abort();
    }
    st.lan_port = None;
}

#[tauri::command]
pub async fn torrent_engine_select(info_hash: String, file_idx: usize) -> Result<(), String> {
    let session = current_session().ok_or_else(|| "engine not ready".to_string())?;
    let id = TorrentIdOrHash::parse(&info_hash).map_err(|e| e.to_string())?;
    let handle = session.get(id).ok_or_else(|| "no torrent".to_string())?;
    let only: HashSet<usize> = HashSet::from([file_idx]);
    session
        .update_only_files(&handle, &only)
        .await
        .map_err(|e| format!("{e:#}"))?;
    session
        .unpause(&handle)
        .await
        .map_err(|e| format!("{e:#}"))?;
    Ok(())
}

#[tauri::command]
pub async fn torrent_engine_stats(
    info_hash: String,
    file_idx: Option<usize>,
) -> Result<TorrentEngineStats, String> {
    let session = current_session().ok_or_else(|| "engine not ready".to_string())?;
    let id = TorrentIdOrHash::parse(&info_hash).map_err(|e| e.to_string())?;
    let handle = session.get(id).ok_or_else(|| "no torrent".to_string())?;
    let s = handle.stats();
    let (peers, download_speed, peer_search_running) = match &s.live {
        Some(live) => (
            live.snapshot.peer_stats.live,
            (live.download_speed.mbps * 1024.0 * 1024.0) as u64,
            true,
        ),
        None => (0, 0, false),
    };
    let stream_progress = match file_idx {
        Some(i) => s.file_progress.get(i).copied().unwrap_or(s.progress_bytes),
        None => s.progress_bytes,
    };
    let stream_len = match file_idx {
        Some(i) => handle
            .with_metadata(|m| m.file_infos.get(i).map(|fi| fi.len))
            .ok()
            .flatten()
            .unwrap_or(s.total_bytes),
        None => s.total_bytes,
    };
    Ok(TorrentEngineStats {
        peers,
        unchoked: peers,
        downloaded: s.progress_bytes,
        download_speed,
        stream_progress,
        stream_len,
        peer_search_running,
        finished: s.finished,
        state: format!("{:?}", s.state),
    })
}

#[tauri::command]
pub async fn torrent_engine_remove(info_hash: String, delete_files: bool) -> Result<(), String> {
    let session = current_session().ok_or_else(|| "engine not ready".to_string())?;
    let id = TorrentIdOrHash::parse(&info_hash).map_err(|e| e.to_string())?;
    session
        .delete(id, delete_files)
        .await
        .map_err(|e| format!("{e:#}"))?;
    Ok(())
}

#[tauri::command]
pub async fn torrent_engine_restart(app: AppHandle) -> Result<EngineStatusDto, String> {
    stop();
    tokio::time::sleep(Duration::from_millis(600)).await;
    init(app).await?;
    Ok(torrent_engine_status())
}

#[tauri::command]
pub async fn torrent_engine_hard_reset(app: AppHandle) -> Result<EngineStatusDto, String> {
    stop();
    tokio::time::sleep(Duration::from_millis(800)).await;
    let cfg = read_config(&app);
    if let Ok(dir) = engine_dir(&app, &cfg) {
        let _ = std::fs::remove_dir_all(&dir);
    }
    engine().lock().unwrap().last_error = None;
    init(app).await?;
    Ok(torrent_engine_status())
}

#[tauri::command]
pub async fn torrent_engine_set_options(
    app: AppHandle,
    dir: Option<String>,
    retention_hours: u64,
    max_gb: u64,
    restart: bool,
) -> Result<EngineStatusDto, String> {
    let cfg = EngineConfig {
        dir: dir.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        retention_hours: Some(retention_hours),
        max_gb: Some(max_gb),
    };
    if let Some(p) = config_path(&app) {
        if let Some(parent) = p.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::write(&p, serde_json::to_string(&cfg).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    }
    if restart {
        stop();
        tokio::time::sleep(Duration::from_millis(600)).await;
        init(app).await?;
    }
    Ok(torrent_engine_status())
}

#[tauri::command]
pub async fn torrent_engine_selftest(app: AppHandle) -> selftest::SelfTestResult {
    selftest::run(app).await
}
