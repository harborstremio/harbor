use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::State;
#[cfg(windows)]
#[allow(unused_imports)]
use tokio::io::AsyncReadExt;
use tokio::io::AsyncWriteExt;
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, oneshot, Mutex, Notify};
use uuid::Uuid;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const BUCKET_SECONDS: f64 = 2.0;
const THUMB_WIDTH: u32 = 240;
const SCREENSHOT_QUALITY: u32 = 72;
const REQUEST_TIMEOUT_MS: u64 = 12000;
const SEEK_WAIT_MS: u64 = 4000;
const SHADOW_QUIT_GRACE: Duration = Duration::from_millis(80);
const SHADOW_KILL_WAIT: Duration = Duration::from_secs(2);
const THUMB_CACHE_MAX_BYTES: usize = 48 * 1024 * 1024;
const THUMB_CACHE_MAX_ENTRIES: usize = 160;

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<(), String>>>>>;

struct CacheEntry {
    value: String,
    bytes: usize,
    last_used: u64,
}

struct ThumbCache {
    entries: HashMap<u32, CacheEntry>,
    total_bytes: usize,
    clock: u64,
    max_bytes: usize,
    max_entries: usize,
}

impl ThumbCache {
    fn new(max_bytes: usize, max_entries: usize) -> Self {
        Self {
            entries: HashMap::new(),
            total_bytes: 0,
            clock: 0,
            max_bytes,
            max_entries,
        }
    }

    fn tick(&mut self) -> u64 {
        self.clock = self.clock.wrapping_add(1);
        self.clock
    }

    fn get(&mut self, bucket: u32) -> Option<String> {
        let last_used = self.tick();
        self.entries.get_mut(&bucket).map(|entry| {
            entry.last_used = last_used;
            entry.value.clone()
        })
    }

    fn contains(&self, bucket: u32) -> bool {
        self.entries.contains_key(&bucket)
    }

    fn insert(&mut self, bucket: u32, value: String) {
        let bytes = value.len();
        if bytes > self.max_bytes || self.max_entries == 0 {
            return;
        }
        if let Some(previous) = self.entries.remove(&bucket) {
            self.total_bytes = self.total_bytes.saturating_sub(previous.bytes);
        }
        while self.entries.len() >= self.max_entries
            || self.total_bytes.saturating_add(bytes) > self.max_bytes
        {
            let Some((&oldest, _)) = self.entries.iter().min_by_key(|(_, entry)| entry.last_used)
            else {
                break;
            };
            if let Some(removed) = self.entries.remove(&oldest) {
                self.total_bytes = self.total_bytes.saturating_sub(removed.bytes);
            }
        }
        let last_used = self.tick();
        self.total_bytes = self.total_bytes.saturating_add(bytes);
        self.entries.insert(
            bucket,
            CacheEntry {
                value,
                bytes,
                last_used,
            },
        );
    }

    fn clear(&mut self) {
        self.entries.clear();
        self.total_bytes = 0;
    }

    #[cfg(test)]
    fn len(&self) -> usize {
        self.entries.len()
    }

    #[cfg(test)]
    fn bytes(&self) -> usize {
        self.total_bytes
    }
}

pub struct ThumbsState {
    inner: Arc<Mutex<Inner>>,
    spawn_lock: Arc<Mutex<()>>,
}

struct Inner {
    shadow: Option<Shadow>,
    url: Option<String>,
    session: Option<String>,
    cache: ThumbCache,
    pending: Pending,
    next_request_id: u64,
    next_worker_id: u64,
    wanted: Option<u32>,
    active_worker: Option<u64>,
}

struct Shadow {
    child: Child,
    writer_tx: mpsc::Sender<Value>,
    cache_dir: PathBuf,
    pipe: String,
    seek_notify: Arc<Notify>,
}

impl ThumbsState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Inner {
                shadow: None,
                url: None,
                session: None,
                cache: ThumbCache::new(THUMB_CACHE_MAX_BYTES, THUMB_CACHE_MAX_ENTRIES),
                pending: Arc::new(Mutex::new(HashMap::new())),
                next_request_id: 1000,
                next_worker_id: 1,
                wanted: None,
                active_worker: None,
            })),
            spawn_lock: Arc::new(Mutex::new(())),
        }
    }
}

pub(crate) fn locate_mpv() -> Option<PathBuf> {
    let mut candidates: Vec<String> = Vec::new();
    if cfg!(windows) {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                candidates.push(dir.join("mpv.exe").to_string_lossy().into_owned());
                candidates.push(
                    dir.join("mpv-x86_64-pc-windows-msvc.exe")
                        .to_string_lossy()
                        .into_owned(),
                );
                for up in ["..", "..\\..", "..\\..\\.."] {
                    candidates.push(
                        dir.join(format!("{up}\\binaries\\mpv-x86_64-pc-windows-msvc.exe"))
                            .to_string_lossy()
                            .into_owned(),
                    );
                }
            }
        }
        candidates.push(r"src-tauri\binaries\mpv-x86_64-pc-windows-msvc.exe".into());
        candidates.push(r"binaries\mpv-x86_64-pc-windows-msvc.exe".into());
        candidates.push("mpv.exe".into());
        candidates.push("mpv".into());
    } else if cfg!(target_os = "macos") {
        candidates.push("/opt/homebrew/bin/mpv".into());
        candidates.push("/usr/local/bin/mpv".into());
        candidates.push("mpv".into());
    } else {
        candidates.extend(
            crate::binary_lookup::linux_binary_candidates("mpv")
                .into_iter()
                .map(|path| path.to_string_lossy().into_owned()),
        );
    }
    for c in candidates {
        let p = PathBuf::from(&c);
        let mut cmd = std::process::Command::new(&p);
        cmd.arg("--version");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                return Some(p);
            }
        }
    }
    None
}

fn shadow_pipe(session: &str) -> String {
    if cfg!(windows) {
        format!("\\\\.\\pipe\\harbor-thumbs-{}", session)
    } else {
        std::env::temp_dir()
            .join(format!("harbor-thumbs-{}.sock", session))
            .to_string_lossy()
            .into_owned()
    }
}

fn cache_dir(session: &str) -> PathBuf {
    std::env::temp_dir().join("harbor-thumbs").join(session)
}

async fn drop_shadow(shadow: &mut Shadow) {
    let _ = shadow.writer_tx.try_send(json!({"command": ["quit"]}));
    tokio::time::sleep(SHADOW_QUIT_GRACE).await;
    if shadow.child.try_wait().ok().flatten().is_none() {
        if let Err(error) = shadow.child.start_kill() {
            eprintln!("[thumbs] failed to kill shadow mpv: {error}");
        }
        if tokio::time::timeout(SHADOW_KILL_WAIT, shadow.child.wait())
            .await
            .is_err()
        {
            eprintln!("[thumbs] shadow mpv did not exit after kill request");
        }
    }
    let _ = tokio::fs::remove_file(&shadow.pipe).await;
    let _ = tokio::fs::remove_dir_all(&shadow.cache_dir).await;
}

async fn send_ipc_message(
    writer_tx: &mpsc::Sender<Value>,
    message: Value,
    timeout_duration: Duration,
) -> Result<(), String> {
    match tokio::time::timeout(timeout_duration, writer_tx.send(message)).await {
        Ok(Ok(())) => Ok(()),
        Ok(Err(_)) => Err("mpv IPC writer closed".to_string()),
        Err(_) => Err("mpv IPC writer timeout".to_string()),
    }
}

#[tauri::command]
pub async fn thumbs_set_url(state: State<'_, ThumbsState>, url: String) -> Result<(), String> {
    let shadow = {
        let mut inner = state.inner.lock().await;
        let shadow = inner.shadow.take();
        inner.url = Some(url);
        inner.session = Some(Uuid::new_v4().simple().to_string());
        inner.cache.clear();
        inner.wanted = None;
        inner.active_worker = None;
        shadow
    };
    let _spawn_guard = state.spawn_lock.lock().await;
    if let Some(mut s) = shadow {
        drop_shadow(&mut s).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn thumbs_spawn_eager(state: State<'_, ThumbsState>) -> Result<(), String> {
    let _spawn_guard = state.spawn_lock.lock().await;
    let (url, session, pending) = {
        let inner = state.inner.lock().await;
        if inner.shadow.is_some() {
            return Ok(());
        }
        (
            inner.url.clone().ok_or_else(|| "no url".to_string())?,
            inner
                .session
                .clone()
                .ok_or_else(|| "no session".to_string())?,
            inner.pending.clone(),
        )
    };
    let shadow = spawn_shadow(&url, &session, pending).await?;
    let stale = {
        let mut inner = state.inner.lock().await;
        if inner.session.as_deref() == Some(session.as_str()) && inner.shadow.is_none() {
            inner.shadow = Some(shadow);
            None
        } else {
            Some(shadow)
        }
    };
    if let Some(mut shadow) = stale {
        drop_shadow(&mut shadow).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn thumbs_get(
    state: State<'_, ThumbsState>,
    time_sec: f64,
) -> Result<Option<String>, String> {
    if !time_sec.is_finite() || time_sec < 0.0 {
        return Ok(None);
    }
    let bucket = (time_sec / BUCKET_SECONDS).round() as u32;
    let inner_arc = state.inner.clone();
    let mut inner = inner_arc.lock().await;
    if let Some(p) = inner.cache.get(bucket) {
        return Ok(Some(p.clone()));
    }
    if inner.url.is_none() || inner.session.is_none() {
        return Err("no url".to_string());
    }
    inner.wanted = Some(bucket);
    if inner.active_worker.is_none() {
        let worker_id = inner.next_worker_id;
        inner.next_worker_id = inner.next_worker_id.wrapping_add(1);
        inner.active_worker = Some(worker_id);
        let arc = inner_arc.clone();
        let spawn_lock = state.spawn_lock.clone();
        tokio::spawn(worker(arc, spawn_lock, worker_id));
    }
    Ok(None)
}

async fn worker(inner_arc: Arc<Mutex<Inner>>, spawn_lock: Arc<Mutex<()>>, worker_id: u64) {
    loop {
        let (bucket, url, session, pending, shadow) = {
            let mut inner = inner_arc.lock().await;
            if inner.active_worker != Some(worker_id) {
                return;
            }
            let bucket = match inner.wanted.take() {
                Some(b) => b,
                None => {
                    inner.active_worker = None;
                    return;
                }
            };
            if inner.cache.contains(bucket) {
                continue;
            }
            let url = match inner.url.clone() {
                Some(u) => u,
                None => {
                    inner.active_worker = None;
                    return;
                }
            };
            let session = match inner.session.clone() {
                Some(s) => s,
                None => {
                    inner.active_worker = None;
                    return;
                }
            };
            (
                bucket,
                url,
                session,
                inner.pending.clone(),
                inner.shadow.is_some(),
            )
        };
        if !shadow {
            let _spawn_guard = spawn_lock.lock().await;
            let should_spawn = {
                let inner = inner_arc.lock().await;
                inner.active_worker == Some(worker_id)
                    && inner.session.as_deref() == Some(session.as_str())
                    && inner.shadow.is_none()
            };
            if !should_spawn {
                let mut inner = inner_arc.lock().await;
                if inner.active_worker == Some(worker_id) {
                    inner.active_worker = None;
                }
                return;
            }
            let new_shadow = match spawn_shadow(&url, &session, pending.clone()).await {
                Ok(shadow) => shadow,
                Err(_) => {
                    let mut inner = inner_arc.lock().await;
                    if inner.active_worker == Some(worker_id) {
                        inner.active_worker = None;
                    }
                    return;
                }
            };
            let stale = {
                let mut inner = inner_arc.lock().await;
                if inner.session.as_deref() == Some(session.as_str()) && inner.shadow.is_none() {
                    inner.shadow = Some(new_shadow);
                    None
                } else {
                    Some(new_shadow)
                }
            };
            if let Some(mut stale) = stale {
                drop_shadow(&mut stale).await;
            }
        }
        let (writer_tx, dir, request_id, seek_notify) = {
            let mut inner = inner_arc.lock().await;
            if inner.active_worker != Some(worker_id)
                || inner.session.as_deref() != Some(session.as_str())
            {
                if inner.active_worker == Some(worker_id) {
                    inner.active_worker = None;
                }
                return;
            }
            let request_id = inner.next_request_id;
            inner.next_request_id += 1;
            let Some(shadow) = inner.shadow.as_ref() else {
                inner.active_worker = None;
                return;
            };
            (
                shadow.writer_tx.clone(),
                shadow.cache_dir.clone(),
                request_id,
                shadow.seek_notify.clone(),
            )
        };
        let uri =
            generate_thumb(bucket, &writer_tx, &dir, request_id, &pending, &seek_notify).await;
        let mut inner = inner_arc.lock().await;
        if inner.active_worker != Some(worker_id)
            || inner.session.as_deref() != Some(session.as_str())
        {
            if inner.active_worker == Some(worker_id) {
                inner.active_worker = None;
            }
            return;
        }
        if let Ok(u) = uri {
            inner.cache.insert(bucket, u);
        }
    }
}

async fn generate_thumb(
    bucket: u32,
    writer_tx: &mpsc::Sender<Value>,
    cache_dir: &PathBuf,
    request_id: u64,
    pending: &Pending,
    seek_notify: &Arc<Notify>,
) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
    let target_time = (bucket as f64) * BUCKET_SECONDS;
    let thumb_path = cache_dir.join(format!("{}.jpg", bucket));
    let thumb_str = thumb_path.to_string_lossy().to_string();

    let restart = seek_notify.notified();
    tokio::pin!(restart);
    restart.as_mut().enable();
    send_ipc_message(
        writer_tx,
        json!({"command": ["seek", target_time, "absolute", "keyframes"]}),
        Duration::from_millis(REQUEST_TIMEOUT_MS),
    )
    .await?;
    let _ = tokio::time::timeout(Duration::from_millis(SEEK_WAIT_MS), restart).await;

    let (done_tx, done_rx) = oneshot::channel::<Result<(), String>>();
    {
        let mut p = pending.lock().await;
        p.insert(request_id, done_tx);
    }
    if let Err(error) = send_ipc_message(
        writer_tx,
        json!({
            "command": ["screenshot-to-file", thumb_str.clone(), "video"],
            "request_id": request_id,
        }),
        Duration::from_millis(REQUEST_TIMEOUT_MS),
    )
    .await
    {
        let mut p = pending.lock().await;
        p.remove(&request_id);
        return Err(error);
    }

    let result = tokio::time::timeout(Duration::from_millis(REQUEST_TIMEOUT_MS), done_rx).await;
    {
        let mut p = pending.lock().await;
        p.remove(&request_id);
    }

    match result {
        Ok(Ok(Ok(()))) => {
            let bytes = tokio::fs::read(&thumb_path)
                .await
                .map_err(|e| format!("read: {}", e))?;
            let _ = tokio::fs::remove_file(&thumb_path).await;
            if bytes.is_empty() {
                return Err("screenshot empty".to_string());
            }
            Ok(format!("data:image/jpeg;base64,{}", B64.encode(&bytes)))
        }
        Ok(Ok(Err(e))) => Err(e),
        Ok(Err(_)) => Err("request canceled".to_string()),
        Err(_) => Err("screenshot timeout".to_string()),
    }
}

#[tauri::command]
pub async fn thumbs_stop(state: State<'_, ThumbsState>) -> Result<(), String> {
    state.stop().await;
    Ok(())
}

impl ThumbsState {
    async fn stop(&self) {
        let shadow = {
            let mut inner = self.inner.lock().await;
            let shadow = inner.shadow.take();
            inner.url = None;
            inner.session = None;
            inner.cache.clear();
            inner.wanted = None;
            inner.active_worker = None;
            shadow
        };
        let _spawn_guard = self.spawn_lock.lock().await;
        if let Some(mut s) = shadow {
            drop_shadow(&mut s).await;
        }
    }
}

pub(crate) fn shutdown(app: &tauri::AppHandle) {
    use tauri::Manager;

    let state = app.state::<ThumbsState>();
    tauri::async_runtime::block_on(state.stop());
}

async fn spawn_shadow(url: &str, session: &str, pending: Pending) -> Result<Shadow, String> {
    let bin = locate_mpv().ok_or_else(|| "mpv not found".to_string())?;
    let pipe = shadow_pipe(session);
    let dir = cache_dir(session);
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("cache dir: {}", e))?;

    let args: Vec<String> = vec![
        format!("--input-ipc-server={}", pipe),
        "--no-config".into(),
        "--no-audio".into(),
        "--no-sub".into(),
        "--vo=null".into(),
        "--pause=yes".into(),
        "--keep-open=yes".into(),
        "--idle=yes".into(),
        "--load-scripts=no".into(),
        "--ytdl=no".into(),
        "--cache=yes".into(),
        "--demuxer-max-bytes=32MiB".into(),
        format!("--vf=scale={}:-2", THUMB_WIDTH),
        "--screenshot-format=jpg".into(),
        format!("--screenshot-jpeg-quality={}", SCREENSHOT_QUALITY),
        "--screenshot-tag-colorspace=no".into(),
        "--hr-seek=no".into(),
        url.to_string(),
    ];

    let mut cmd = Command::new(&bin);
    cmd.kill_on_drop(true);
    cmd.args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = cmd.spawn().map_err(|e| format!("spawn shadow: {}", e))?;

    tokio::time::sleep(Duration::from_millis(400)).await;
    if let Some(status) = child
        .try_wait()
        .map_err(|e| format!("check shadow process: {e}"))?
    {
        let _ = tokio::fs::remove_file(&pipe).await;
        let _ = tokio::fs::remove_dir_all(&dir).await;
        return Err(format!("shadow mpv exited during startup: {status}"));
    }

    let (writer_tx, writer_rx) = mpsc::channel::<Value>(64);
    let seek_notify = Arc::new(Notify::new());
    spawn_ipc(pipe.clone(), writer_rx, pending, seek_notify.clone());

    Ok(Shadow {
        child,
        writer_tx,
        cache_dir: dir,
        pipe,
        seek_notify,
    })
}

fn handle_line(line: &str, pending: &Pending, seek_notify: &Arc<Notify>) {
    let v: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => return,
    };
    if v.get("event").and_then(|x| x.as_str()) == Some("playback-restart") {
        seek_notify.notify_waiters();
        return;
    }
    let id = match v.get("request_id").and_then(|x| x.as_u64()) {
        Some(id) => id,
        None => return,
    };
    let error = v
        .get("error")
        .and_then(|x| x.as_str())
        .unwrap_or("unknown")
        .to_string();
    let pending = pending.clone();
    tokio::spawn(async move {
        let mut p = pending.lock().await;
        if let Some(tx) = p.remove(&id) {
            let _ = tx.send(if error == "success" {
                Ok(())
            } else {
                Err(error)
            });
        }
    });
}

#[cfg(windows)]
fn spawn_ipc(
    pipe: String,
    mut writer_rx: mpsc::Receiver<Value>,
    pending: Pending,
    seek_notify: Arc<Notify>,
) {
    use tokio::net::windows::named_pipe::ClientOptions;
    tokio::spawn(async move {
        let mut client = None;
        for _ in 0..40 {
            match ClientOptions::new().open(&pipe) {
                Ok(c) => {
                    client = Some(c);
                    break;
                }
                Err(_) => tokio::time::sleep(Duration::from_millis(100)).await,
            }
        }
        let client = match client {
            Some(c) => c,
            None => return,
        };
        let (mut reader, mut writer) = tokio::io::split(client);

        let read_pending = pending.clone();
        let read_notify = seek_notify.clone();
        tokio::spawn(async move {
            let mut buf = vec![0u8; 8192];
            let mut acc = String::new();
            loop {
                let n = match tokio::time::timeout(
                    Duration::from_millis(50),
                    AsyncReadExt::read(&mut reader, &mut buf),
                )
                .await
                {
                    Ok(Ok(0)) => break,
                    Ok(Ok(n)) => n,
                    Ok(Err(_)) => break,
                    Err(_) => 0,
                };
                if n == 0 {
                    tokio::time::sleep(Duration::from_millis(20)).await;
                    continue;
                }
                acc.push_str(&String::from_utf8_lossy(&buf[..n]));
                while let Some(idx) = acc.find('\n') {
                    let line = acc[..idx].trim().to_string();
                    acc = acc[idx + 1..].to_string();
                    if line.is_empty() {
                        continue;
                    }
                    handle_line(&line, &read_pending, &read_notify);
                }
            }
        });

        while let Some(msg) = writer_rx.recv().await {
            let mut s = msg.to_string();
            s.push('\n');
            if writer.write_all(s.as_bytes()).await.is_err() {
                break;
            }
            let _ = writer.flush().await;
        }
    });
}

#[cfg(not(windows))]
fn spawn_ipc(
    pipe: String,
    mut writer_rx: mpsc::Receiver<Value>,
    pending: Pending,
    seek_notify: Arc<Notify>,
) {
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::net::UnixStream;
    tokio::spawn(async move {
        let mut stream = None;
        for _ in 0..40 {
            match UnixStream::connect(&pipe).await {
                Ok(s) => {
                    stream = Some(s);
                    break;
                }
                Err(_) => tokio::time::sleep(Duration::from_millis(100)).await,
            }
        }
        let stream = match stream {
            Some(s) => s,
            None => return,
        };
        let (r, mut w) = stream.into_split();
        let mut reader = BufReader::new(r);
        let read_pending = pending.clone();
        let read_notify = seek_notify.clone();
        tokio::spawn(async move {
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) => break,
                    Ok(_) => {
                        let trimmed = line.trim();
                        if trimmed.is_empty() {
                            continue;
                        }
                        handle_line(trimmed, &read_pending, &read_notify);
                    }
                    Err(_) => break,
                }
            }
        });
        while let Some(msg) = writer_rx.recv().await {
            let mut s = msg.to_string();
            s.push('\n');
            if w.write_all(s.as_bytes()).await.is_err() {
                break;
            }
        }
    });
}

#[cfg(test)]
mod cache_tests {
    use super::{send_ipc_message, ThumbCache, ThumbsState};
    use serde_json::json;
    use std::time::Duration;

    #[test]
    fn cache_evicts_least_recently_used_entry() {
        let mut cache = ThumbCache::new(8, 2);
        cache.insert(1, "1111".into());
        cache.insert(2, "2222".into());
        assert_eq!(cache.get(1), Some("1111".into()));
        cache.insert(3, "3333".into());
        assert_eq!(cache.get(2), None);
        assert_eq!(cache.get(1), Some("1111".into()));
        assert_eq!(cache.get(3), Some("3333".into()));
    }

    #[test]
    fn cache_enforces_byte_and_entry_limits() {
        let mut cache = ThumbCache::new(6, 2);
        cache.insert(1, "111".into());
        cache.insert(2, "222".into());
        cache.insert(3, "333".into());
        assert_eq!(cache.len(), 2);
        assert_eq!(cache.bytes(), 6);
        assert_eq!(cache.get(1), None);
    }

    #[test]
    fn cache_rejects_oversized_entries_and_clears_cleanly() {
        let mut cache = ThumbCache::new(4, 2);
        cache.insert(1, "12345".into());
        assert_eq!(cache.len(), 0);
        cache.insert(2, "1234".into());
        cache.clear();
        assert_eq!(cache.len(), 0);
        assert_eq!(cache.bytes(), 0);
    }

    #[tokio::test]
    async fn ipc_send_times_out_when_writer_is_stalled() {
        let (tx, _rx) = tokio::sync::mpsc::channel(1);
        tx.send(json!({"first": true})).await.unwrap();

        let result =
            send_ipc_message(&tx, json!({"second": true}), Duration::from_millis(10)).await;

        assert_eq!(result, Err("mpv IPC writer timeout".to_string()));
    }

    #[tokio::test]
    async fn stop_clears_thumbnail_session_state() {
        let state = ThumbsState::new();
        {
            let mut inner = state.inner.lock().await;
            inner.url = Some("https://example.com/video".into());
            inner.session = Some("session".into());
            inner.cache.insert(1, "thumbnail".into());
            inner.wanted = Some(1);
            inner.active_worker = Some(1);
        }

        state.stop().await;

        let inner = state.inner.lock().await;
        assert!(inner.shadow.is_none());
        assert!(inner.url.is_none());
        assert!(inner.session.is_none());
        assert_eq!(inner.cache.len(), 0);
        assert!(inner.wanted.is_none());
        assert!(inner.active_worker.is_none());
    }
}
