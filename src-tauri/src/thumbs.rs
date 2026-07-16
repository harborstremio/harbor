use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use tauri::State;
use tokio::io::AsyncWriteExt;
#[cfg(windows)]
#[allow(unused_imports)]
use tokio::io::AsyncReadExt;
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

type Pending = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<(), String>>>>>;

pub struct ThumbsState {
    inner: Arc<Mutex<Inner>>,
}

struct Inner {
    shadow: Option<Shadow>,
    url: Option<String>,
    session: Option<String>,
    cache: HashMap<u32, String>,
    pending: Pending,
    next_request_id: u64,
    wanted: Option<u32>,
    busy: bool,
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
                cache: HashMap::new(),
                pending: Arc::new(Mutex::new(HashMap::new())),
                next_request_id: 1000,
                wanted: None,
                busy: false,
            })),
        }
    }
}

pub(crate) fn locate_mpv() -> Option<PathBuf> {
    let mut candidates: Vec<String> = Vec::new();
    if cfg!(windows) {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                candidates.push(dir.join("mpv.exe").to_string_lossy().into_owned());
                candidates
                    .push(dir.join("mpv-x86_64-pc-windows-msvc.exe").to_string_lossy().into_owned());
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
    let _ = shadow.writer_tx.send(json!({"command": ["quit"]})).await;
    tokio::time::sleep(Duration::from_millis(80)).await;
    if shadow.child.try_wait().ok().flatten().is_none() {
        let _ = shadow.child.start_kill();
    }
    let _ = shadow.child.wait().await;
    let _ = std::fs::remove_file(&shadow.pipe);
    let _ = std::fs::remove_dir_all(&shadow.cache_dir);
}

#[tauri::command]
pub async fn thumbs_set_url(state: State<'_, ThumbsState>, url: String) -> Result<(), String> {
    let mut inner = state.inner.lock().await;
    if let Some(mut s) = inner.shadow.take() {
        drop_shadow(&mut s).await;
    }
    inner.url = Some(url);
    inner.session = Some(Uuid::new_v4().simple().to_string());
    inner.cache.clear();
    inner.wanted = None;
    Ok(())
}

#[tauri::command]
pub async fn thumbs_spawn_eager(state: State<'_, ThumbsState>) -> Result<(), String> {
    let mut inner = state.inner.lock().await;
    if inner.shadow.is_some() {
        return Ok(());
    }
    let url = inner.url.clone().ok_or_else(|| "no url".to_string())?;
    let session = inner.session.clone().ok_or_else(|| "no session".to_string())?;
    let pending = inner.pending.clone();
    let s = spawn_shadow(&url, &session, pending).await?;
    inner.shadow = Some(s);
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
    if let Some(p) = inner.cache.get(&bucket) {
        return Ok(Some(p.clone()));
    }
    if inner.url.is_none() || inner.session.is_none() {
        return Err("no url".to_string());
    }
    inner.wanted = Some(bucket);
    if !inner.busy {
        inner.busy = true;
        let arc = inner_arc.clone();
        tokio::spawn(worker(arc));
    }
    Ok(None)
}

async fn worker(inner_arc: Arc<Mutex<Inner>>) {
    loop {
        let (bucket, writer_tx, dir, request_id, pending, seek_notify, session) = {
            let mut inner = inner_arc.lock().await;
            let bucket = match inner.wanted.take() {
                Some(b) => b,
                None => {
                    inner.busy = false;
                    return;
                }
            };
            if inner.cache.contains_key(&bucket) {
                continue;
            }
            let url = match inner.url.clone() {
                Some(u) => u,
                None => {
                    inner.busy = false;
                    return;
                }
            };
            let session = match inner.session.clone() {
                Some(s) => s,
                None => {
                    inner.busy = false;
                    return;
                }
            };
            if inner.shadow.is_none() {
                let pending = inner.pending.clone();
                match spawn_shadow(&url, &session, pending).await {
                    Ok(s) => inner.shadow = Some(s),
                    Err(_) => {
                        inner.busy = false;
                        return;
                    }
                }
            }
            let id = inner.next_request_id;
            inner.next_request_id += 1;
            let shadow = inner.shadow.as_ref().unwrap();
            (
                bucket,
                shadow.writer_tx.clone(),
                shadow.cache_dir.clone(),
                id,
                inner.pending.clone(),
                shadow.seek_notify.clone(),
                session,
            )
        };
        let uri = generate_thumb(bucket, &writer_tx, &dir, request_id, &pending, &seek_notify).await;
        let mut inner = inner_arc.lock().await;
        if inner.session.as_deref() != Some(session.as_str()) {
            inner.busy = false;
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
    let _ = writer_tx
        .send(json!({"command": ["seek", target_time, "absolute", "keyframes"]}))
        .await;
    let _ = tokio::time::timeout(Duration::from_millis(SEEK_WAIT_MS), restart).await;

    let (done_tx, done_rx) = oneshot::channel::<Result<(), String>>();
    {
        let mut p = pending.lock().await;
        p.insert(request_id, done_tx);
    }
    let _ = writer_tx
        .send(json!({
            "command": ["screenshot-to-file", thumb_str.clone(), "video"],
            "request_id": request_id,
        }))
        .await;

    let result = tokio::time::timeout(Duration::from_millis(REQUEST_TIMEOUT_MS), done_rx).await;
    {
        let mut p = pending.lock().await;
        p.remove(&request_id);
    }

    match result {
        Ok(Ok(Ok(()))) => {
            let bytes = std::fs::read(&thumb_path).map_err(|e| format!("read: {}", e))?;
            let _ = std::fs::remove_file(&thumb_path);
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
    let mut inner = state.inner.lock().await;
    if let Some(mut s) = inner.shadow.take() {
        drop_shadow(&mut s).await;
    }
    inner.url = None;
    inner.session = None;
    inner.cache.clear();
    inner.wanted = None;
    Ok(())
}

async fn spawn_shadow(url: &str, session: &str, pending: Pending) -> Result<Shadow, String> {
    let bin = locate_mpv().ok_or_else(|| "mpv not found".to_string())?;
    let pipe = shadow_pipe(session);
    let dir = cache_dir(session);
    std::fs::create_dir_all(&dir).map_err(|e| format!("cache dir: {}", e))?;

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
    let child = cmd.spawn().map_err(|e| format!("spawn shadow: {}", e))?;

    tokio::time::sleep(Duration::from_millis(400)).await;

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
            Some(c) => Arc::new(Mutex::new(c)),
            None => return,
        };

        let read_client = client.clone();
        let read_pending = pending.clone();
        let read_notify = seek_notify.clone();
        tokio::spawn(async move {
            let mut buf = vec![0u8; 8192];
            let mut acc = String::new();
            loop {
                let n = {
                    let mut g = read_client.lock().await;
                    match tokio::time::timeout(
                        Duration::from_millis(50),
                        AsyncReadExt::read(&mut *g, &mut buf),
                    )
                    .await
                    {
                        Ok(Ok(0)) => break,
                        Ok(Ok(n)) => n,
                        Ok(Err(_)) => break,
                        Err(_) => 0,
                    }
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
            let mut g = client.lock().await;
            if g.write_all(s.as_bytes()).await.is_err() {
                break;
            }
            let _ = g.flush().await;
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
