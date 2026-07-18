use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
#[cfg(windows)]
use tauri::Manager;
use tauri::{AppHandle, State};
use tokio::process::{Child, Command};
use tokio::sync::{Mutex, Semaphore};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub const MAX_SLOTS: u32 = 4;
#[cfg(any(windows, test))]
const IPC_QUEUE_CAPACITY: usize = 64;
#[cfg(any(windows, test))]
const MAX_IPC_BUFFER_BYTES: usize = 1_048_576;

#[cfg(any(windows, test))]
#[derive(Debug, PartialEq)]
enum MultiviewIpcEvent {
    Error(String),
    Playing,
}

#[cfg(any(windows, test))]
fn classify_ipc_event(text: &str) -> Option<MultiviewIpcEvent> {
    let value = serde_json::from_str::<serde_json::Value>(text).ok()?;
    match value.get("event").and_then(|event| event.as_str())? {
        "end-file" => {
            let reason = value.get("reason").and_then(|reason| reason.as_str())?;
            matches!(reason, "error" | "eof" | "network" | "unknown")
                .then(|| MultiviewIpcEvent::Error(reason.to_string()))
        }
        "file-loaded" | "playback-restart" => Some(MultiviewIpcEvent::Playing),
        _ => None,
    }
}

#[cfg(any(windows, test))]
fn consume_ipc_lines<F>(pending: &mut Vec<u8>, chunk: &[u8], mut consume: F) -> bool
where
    F: FnMut(&str),
{
    pending.extend_from_slice(chunk);
    let mut consumed = 0;
    let mut oversized = false;
    while let Some(offset) = pending[consumed..].iter().position(|&byte| byte == b'\n') {
        let start = consumed;
        let end = start + offset;
        consumed = end + 1;
        if end - start > MAX_IPC_BUFFER_BYTES {
            oversized = true;
            continue;
        }
        if let Ok(text) = std::str::from_utf8(&pending[start..end]) {
            let text = text.trim();
            if !text.is_empty() {
                consume(text);
            }
        }
    }
    if consumed > 0 {
        pending.drain(..consumed);
    }
    if pending.len() > MAX_IPC_BUFFER_BYTES {
        pending.clear();
        oversized = true;
    }
    oversized
}

struct Slot {
    child: Option<Child>,
    pid: Option<u32>,
    hwnd: Option<isize>,
    writer: Option<tokio::sync::mpsc::Sender<String>>,
    last_rect: Option<(i32, i32, i32, i32)>,
}

pub struct MultiviewState {
    slots: Arc<Mutex<HashMap<u32, Slot>>>,
    spawn_lock: Arc<Semaphore>,
}

impl MultiviewState {
    pub fn new() -> Self {
        Self {
            slots: Arc::new(Mutex::new(HashMap::new())),
            spawn_lock: Arc::new(Semaphore::new(1)),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenArgs {
    pub slot: u32,
    pub css_left: f64,
    pub css_top: f64,
    pub css_width: f64,
    pub css_height: f64,
    pub css_view_w: f64,
    pub css_view_h: f64,
    pub url: String,
    #[serde(default)]
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RectArgs {
    pub slot: u32,
    pub css_left: f64,
    pub css_top: f64,
    pub css_width: f64,
    pub css_height: f64,
    pub css_view_w: f64,
    pub css_view_h: f64,
}

fn slot_title(slot: u32) -> String {
    format!("HARBOR_MV_SLOT_{slot}")
}

fn pipe_path(slot: u32) -> String {
    #[cfg(windows)]
    {
        format!("\\\\.\\pipe\\harbor-mv-{}-{}", slot, std::process::id())
    }
    #[cfg(not(windows))]
    {
        format!("/tmp/harbor-mv-{}-{}.sock", slot, std::process::id())
    }
}

fn main_hwnd(app: &AppHandle) -> Result<isize, String> {
    #[cfg(windows)]
    {
        let win = app
            .get_webview_window("main")
            .ok_or_else(|| "main window missing".to_string())?;
        let hwnd = win.hwnd().map_err(|e| format!("hwnd: {e}"))?;
        Ok(hwnd.0 as isize)
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("Multiview is currently Windows-only".into())
    }
}

#[cfg(windows)]
fn client_scale(parent: isize, css_view_w: f64, css_view_h: f64) -> (f64, f64, i32, i32) {
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::UI::WindowsAndMessaging::GetClientRect;
    let mut rc = RECT::default();
    let ok = unsafe { GetClientRect(HWND(parent as *mut _), &mut rc).is_ok() };
    let (cw, ch) = (rc.right, rc.bottom);
    if ok && cw > 0 && ch > 0 && css_view_w > 0.5 && css_view_h > 0.5 {
        (cw as f64 / css_view_w, ch as f64 / css_view_h, cw, ch)
    } else {
        (1.0, 1.0, 0, 0)
    }
}

#[cfg(not(windows))]
fn client_scale(_parent: isize, _css_view_w: f64, _css_view_h: f64) -> (f64, f64, i32, i32) {
    (1.0, 1.0, 0, 0)
}

fn css_to_physical(
    parent: isize,
    css_left: f64,
    css_top: f64,
    css_width: f64,
    css_height: f64,
    css_view_w: f64,
    css_view_h: f64,
) -> (i32, i32, i32, i32) {
    let (sx, sy, cw, ch) = client_scale(parent, css_view_w, css_view_h);
    let mut x = (css_left * sx).round() as i32;
    let mut y = (css_top * sy).round() as i32;
    let mut w = (css_width * sx).round().max(1.0) as i32;
    let mut h = (css_height * sy).round().max(1.0) as i32;
    if x.abs() <= 2 {
        w += x;
        x = 0;
    }
    if y.abs() <= 2 {
        h += y;
        y = 0;
    }
    if cw > 0 && ((x + w - cw).abs() <= 4 || css_left + css_width >= css_view_w - 2.0) {
        w = cw - x;
    }
    if ch > 0 && ((y + h - ch).abs() <= 4 || css_top + css_height >= css_view_h - 2.0) {
        h = ch - y;
    }
    (x, y, w.max(1), h.max(1))
}

async fn on_main<R: Send + 'static>(app: &AppHandle, f: impl FnOnce() -> R + Send + 'static) -> R {
    let (tx, rx) = tokio::sync::oneshot::channel();
    let _ = app.run_on_main_thread(move || {
        let _ = tx.send(f());
    });
    rx.await.expect("main-thread dispatcher channel closed")
}

#[cfg(windows)]
fn find_child_by_pid_and_title(parent: isize, want_pid: u32, title: &str) -> Option<isize> {
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, GetWindowTextW, GetWindowThreadProcessId,
    };
    struct Ctx {
        want_pid: u32,
        want_title: Vec<u16>,
        found: isize,
    }
    let mut ctx = Ctx {
        want_pid,
        want_title: title.encode_utf16().collect(),
        found: 0,
    };
    unsafe extern "system" fn proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = &mut *(lparam.0 as *mut Ctx);
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid != ctx.want_pid {
            return BOOL(1);
        }
        let mut buf = [0u16; 256];
        let n = GetWindowTextW(hwnd, &mut buf);
        if n > 0 && &buf[..n as usize] == ctx.want_title.as_slice() {
            ctx.found = hwnd.0 as isize;
            return BOOL(0);
        }
        BOOL(1)
    }
    unsafe {
        let _ = EnumChildWindows(
            Some(HWND(parent as *mut _)),
            Some(proc),
            LPARAM(&mut ctx as *mut Ctx as isize),
        );
    }
    if ctx.found != 0 {
        Some(ctx.found)
    } else {
        None
    }
}

#[cfg(not(windows))]
fn find_child_by_pid_and_title(_parent: isize, _want_pid: u32, _title: &str) -> Option<isize> {
    None
}

#[cfg(windows)]
fn place_child(hwnd_raw: isize, _parent_raw: isize, x: i32, y: i32, w: i32, h: i32) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{CreateRoundRectRgn, SetWindowRgn};
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos, HWND_TOP, SWP_NOACTIVATE};
    let hwnd = HWND(hwnd_raw as *mut _);
    let w = w.max(1);
    let h = h.max(1);
    unsafe {
        let _ = SetWindowPos(hwnd, Some(HWND_TOP), x, y, w, h, SWP_NOACTIVATE);
        let rgn = CreateRoundRectRgn(0, 0, w + 1, h + 1, 18, 18);
        if !rgn.is_invalid() {
            let _ = SetWindowRgn(hwnd, Some(rgn), true);
        }
    }
}

#[cfg(windows)]
fn move_child_only(hwnd_raw: isize, x: i32, y: i32) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOP, SWP_NOACTIVATE, SWP_NOSIZE,
    };
    let hwnd = HWND(hwnd_raw as *mut _);
    unsafe {
        let _ = SetWindowPos(
            hwnd,
            Some(HWND_TOP),
            x,
            y,
            0,
            0,
            SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }
}

#[cfg(not(windows))]
fn place_child(_hwnd_raw: isize, _parent_raw: isize, _x: i32, _y: i32, _w: i32, _h: i32) {}

#[cfg(not(windows))]
fn move_child_only(_hwnd_raw: isize, _x: i32, _y: i32) {}

#[cfg(windows)]
fn kill_pid(pid: u32) {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};
    if pid == 0 {
        return;
    }
    unsafe {
        if let Ok(h) = OpenProcess(PROCESS_TERMINATE, false, pid) {
            let _ = TerminateProcess(h, 0);
            let _ = CloseHandle(h);
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
}

#[cfg(not(windows))]
fn kill_pid(_pid: u32) {}

#[cfg(windows)]
fn kill_orphan_mpv_for_slot(parent: isize, slot: u32, keep_pid: Option<u32>) {
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, GetWindowTextW, GetWindowThreadProcessId,
    };
    struct Ctx {
        want: Vec<u16>,
        keep: u32,
        kills: Vec<u32>,
    }
    let mut ctx = Ctx {
        want: slot_title(slot).encode_utf16().collect(),
        keep: keep_pid.unwrap_or(0),
        kills: Vec::new(),
    };
    unsafe extern "system" fn proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = &mut *(lparam.0 as *mut Ctx);
        let mut buf = [0u16; 256];
        let n = GetWindowTextW(hwnd, &mut buf);
        if n > 0 && &buf[..n as usize] == ctx.want.as_slice() {
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid != 0 && pid != ctx.keep {
                ctx.kills.push(pid);
            }
        }
        BOOL(1)
    }
    unsafe {
        let _ = EnumChildWindows(
            Some(HWND(parent as *mut _)),
            Some(proc),
            LPARAM(&mut ctx as *mut Ctx as isize),
        );
    }
    for pid in ctx.kills {
        kill_pid(pid);
    }
}

#[cfg(not(windows))]
fn kill_orphan_mpv_for_slot(_parent: isize, _slot: u32, _keep_pid: Option<u32>) {}

#[cfg(any(windows, test))]
async fn write_ipc_messages<W>(
    mut writer: W,
    mut messages: tokio::sync::mpsc::Receiver<String>,
    mut shutdown: tokio::sync::watch::Receiver<bool>,
) where
    W: tokio::io::AsyncWrite + Unpin,
{
    use tokio::io::AsyncWriteExt;

    loop {
        tokio::select! {
            biased;
            changed = shutdown.changed() => {
                if changed.is_err() || *shutdown.borrow() {
                    break;
                }
            }
            message = messages.recv() => {
                let Some(message) = message else {
                    break;
                };
                if writer.write_all(message.as_bytes()).await.is_err()
                    || writer.write_all(b"\n").await.is_err()
                {
                    break;
                }
            }
        }
    }
}

#[cfg(windows)]
async fn connect_ipc(
    app: &AppHandle,
    slot: u32,
    pipe: &str,
) -> Option<tokio::sync::mpsc::Sender<String>> {
    use tauri::Emitter;
    use tokio::io::AsyncReadExt;
    use tokio::net::windows::named_pipe::ClientOptions;
    let stream = {
        let mut retries = 20;
        loop {
            match ClientOptions::new().open(pipe) {
                Ok(s) => break Some(s),
                Err(_) if retries > 0 => {
                    tokio::time::sleep(Duration::from_millis(250)).await;
                    retries -= 1;
                }
                Err(_) => break None,
            }
        }
    }?;
    let (mut reader, writer) = tokio::io::split(stream);
    let (tx, rx) = tokio::sync::mpsc::channel::<String>(16);
    let (event_tx, mut event_rx) =
        tokio::sync::mpsc::channel::<MultiviewIpcEvent>(IPC_QUEUE_CAPACITY);
    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
    let app_for_events = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut buf = [0u8; 8192];
        let mut pending = Vec::with_capacity(16_384);
        let mut last_oversized_log = None;
        'read: loop {
            match reader.read(&mut buf).await {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let mut events = Vec::new();
                    let oversized = consume_ipc_lines(&mut pending, &buf[..n], |line| {
                        if let Some(event) = classify_ipc_event(line) {
                            events.push(event);
                        }
                    });
                    if oversized
                        && last_oversized_log
                            .map(|last: std::time::Instant| {
                                last.elapsed() >= Duration::from_secs(5)
                            })
                            .unwrap_or(true)
                    {
                        eprintln!("[harbor::multiview] discarding oversized IPC message");
                        last_oversized_log = Some(std::time::Instant::now());
                    }
                    for event in events {
                        if event_tx.send(event).await.is_err() {
                            break 'read;
                        }
                    }
                }
            }
        }
        let _ = shutdown_tx.send(true);
    });

    tauri::async_runtime::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            match event {
                MultiviewIpcEvent::Error(reason) => {
                    let _ = app_for_events.emit(
                        "multiview-slot-error",
                        serde_json::json!({ "slot": slot, "reason": reason }),
                    );
                }
                MultiviewIpcEvent::Playing => {
                    let _ = app_for_events.emit(
                        "multiview-slot-playing",
                        serde_json::json!({ "slot": slot }),
                    );
                }
            }
        }
    });

    tauri::async_runtime::spawn(write_ipc_messages(writer, rx, shutdown_rx));
    Some(tx)
}

#[cfg(not(windows))]
async fn connect_ipc(
    _app: &AppHandle,
    _slot: u32,
    _pipe: &str,
) -> Option<tokio::sync::mpsc::Sender<String>> {
    None
}

fn spawn_mpv(
    main_hwnd: isize,
    slot: u32,
    pipe: &str,
    user_agent: Option<&str>,
) -> Result<Child, String> {
    let mpv = crate::dvr::locate_mpv()
        .ok_or_else(|| "mpv not found. Multiview needs mpv installed (same as DVR).".to_string())?;
    let ua = user_agent.unwrap_or("VLC/3.0.20 LibVLC/3.0.20");
    let mut cmd = Command::new(&mpv);
    cmd.kill_on_drop(true);
    cmd.arg(format!("--input-ipc-server={pipe}"))
        .arg(format!("--wid={main_hwnd}"))
        .arg(format!("--title={}", slot_title(slot)))
        .arg("--force-window=immediate")
        .arg("--idle=yes")
        .arg("--keep-open=yes")
        .arg("--no-osc")
        .arg("--no-osd-bar")
        .arg("--osd-level=0")
        .arg("--input-default-bindings=no")
        .arg("--input-media-keys=no")
        .arg("--no-input-cursor")
        .arg("--cursor-autohide=no")
        .arg("--no-terminal")
        .arg("--no-config")
        .arg("--cache=yes")
        .arg("--cache-pause=no")
        .arg("--cache-pause-initial=no")
        .arg("--cache-secs=20")
        .arg("--demuxer-readahead-secs=30")
        .arg("--network-timeout=60")
        .arg("--stream-lavf-o=reconnect=1,reconnect_streamed=1,reconnect_delay_max=10")
        .arg("--vd-lavc-threads=2")
        .arg("--volume=100")
        .arg("--mute=yes")
        .arg(format!("--user-agent={ua}"));
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.spawn().map_err(|e| format!("spawn mpv: {e}"))
}

fn ipc_loadfile_msg(url: &str) -> String {
    let escaped = url.replace('\\', "\\\\").replace('"', "\\\"");
    format!("{{\"command\":[\"loadfile\",\"{escaped}\",\"replace\"]}}")
}

const IPC_WAKE_REDRAW: &str = "{\"command\":[\"set_property\",\"video-zoom\",0]}";

async fn poke_other_slots(state: &State<'_, MultiviewState>, exclude: u32) {
    let writers: Vec<tokio::sync::mpsc::Sender<String>> = {
        let slots = state.slots.lock().await;
        slots
            .iter()
            .filter(|(k, _)| **k != exclude)
            .filter_map(|(_, s)| s.writer.clone())
            .collect()
    };
    for tx in writers {
        let _ = tx.send(IPC_WAKE_REDRAW.to_string()).await;
    }
}

#[tauri::command]
pub async fn multiview_open(
    app: AppHandle,
    state: State<'_, MultiviewState>,
    args: OpenArgs,
) -> Result<(), String> {
    if args.slot >= MAX_SLOTS {
        return Err("slot out of range".into());
    }
    let mh = main_hwnd(&app)?;
    let (x, y, w, hh) = css_to_physical(
        mh,
        args.css_left,
        args.css_top,
        args.css_width,
        args.css_height,
        args.css_view_w,
        args.css_view_h,
    );

    let (existing_writer, existing_hwnd) = {
        let slots = state.slots.lock().await;
        match slots.get(&args.slot) {
            Some(s) => (s.writer.clone(), s.hwnd),
            None => (None, None),
        }
    };

    if let Some(writer) = existing_writer {
        if let Some(h) = existing_hwnd {
            on_main(&app, move || place_child(h, mh, x, y, w, hh)).await;
        }
        let _ = writer.send(ipc_loadfile_msg(&args.url)).await;
        {
            let mut slots = state.slots.lock().await;
            if let Some(s) = slots.get_mut(&args.slot) {
                s.last_rect = Some((x, y, w, hh));
            }
        }
        return Ok(());
    }

    let prev = {
        let mut slots = state.slots.lock().await;
        slots.remove(&args.slot)
    };
    if let Some(mut s) = prev {
        if let Some(pid) = s.pid {
            kill_pid(pid);
        }
        if let Some(child) = s.child.as_mut() {
            let _ = child.start_kill();
        }
    }

    let writer = ensure_slot(&app, &state, args.slot, args.user_agent.as_deref()).await?;

    {
        let mut slots = state.slots.lock().await;
        if let Some(s) = slots.get_mut(&args.slot) {
            s.last_rect = Some((x, y, w, hh));
        }
    }
    let hwnd = {
        let slots = state.slots.lock().await;
        slots.get(&args.slot).and_then(|s| s.hwnd)
    };
    if let Some(h) = hwnd {
        on_main(&app, move || place_child(h, mh, x, y, w, hh)).await;
    }

    let others: Vec<(isize, (i32, i32, i32, i32))> = {
        let slots = state.slots.lock().await;
        slots
            .iter()
            .filter(|(k, _)| **k != args.slot)
            .filter_map(|(_, s)| match (s.hwnd, s.last_rect) {
                (Some(h), Some(r)) => Some((h, r)),
                _ => None,
            })
            .collect()
    };
    if !others.is_empty() {
        on_main(&app, move || {
            for (h, (x, y, w, hh)) in others {
                place_child(h, mh, x, y, w, hh);
            }
        })
        .await;
    }

    if let Some(tx) = writer {
        let _ = tx.send(ipc_loadfile_msg(&args.url)).await;
    }
    poke_other_slots(&state, args.slot).await;
    Ok(())
}

#[tauri::command]
pub async fn multiview_prespawn(
    app: AppHandle,
    state: State<'_, MultiviewState>,
    count: u32,
) -> Result<(), String> {
    let n = count.min(MAX_SLOTS);
    let mh = main_hwnd(&app)?;
    let needed: Vec<u32> = {
        let slots = state.slots.lock().await;
        (0..n).filter(|i| !slots.contains_key(i)).collect()
    };
    let _ = mh;
    for slot in needed {
        let _ = ensure_slot(&app, &state, slot, None).await;
    }
    Ok(())
}

async fn ensure_slot(
    app: &AppHandle,
    state: &State<'_, MultiviewState>,
    slot: u32,
    user_agent: Option<&str>,
) -> Result<Option<tokio::sync::mpsc::Sender<String>>, String> {
    let _permit = state
        .spawn_lock
        .acquire()
        .await
        .map_err(|_| "multiview spawn lock closed".to_string())?;
    let mh = main_hwnd(app)?;
    {
        let slots = state.slots.lock().await;
        if let Some(s) = slots.get(&slot) {
            if s.writer.is_some() && s.hwnd.is_some() {
                return Ok(s.writer.clone());
            }
        }
    }

    let pipe = pipe_path(slot);
    let prev = {
        let mut slots = state.slots.lock().await;
        slots.remove(&slot)
    };
    if let Some(mut s) = prev {
        if let Some(pid) = s.pid {
            kill_pid(pid);
        }
        if let Some(child) = s.child.as_mut() {
            let _ = child.start_kill();
        }
    }

    let child = spawn_mpv(mh, slot, &pipe, user_agent)?;
    let pid = child.id();
    {
        let mut slots = state.slots.lock().await;
        slots.insert(
            slot,
            Slot {
                child: Some(child),
                pid,
                hwnd: None,
                writer: None,
                last_rect: None,
            },
        );
    }

    let mut found: Option<isize> = None;
    let target_pid = pid.unwrap_or(0);
    if target_pid != 0 {
        for _ in 0..80 {
            tokio::time::sleep(Duration::from_millis(25)).await;
            let title = slot_title(slot);
            let p = target_pid;
            let h = on_main(app, move || find_child_by_pid_and_title(mh, p, &title)).await;
            if let Some(hwnd) = h {
                on_main(app, move || {
                    move_child_only(hwnd, -30000, 0);
                })
                .await;
                found = Some(hwnd);
                break;
            }
        }
    }

    let keep = pid;
    on_main(app, move || kill_orphan_mpv_for_slot(mh, slot, keep)).await;

    let writer = connect_ipc(app, slot, &pipe).await;
    {
        let mut slots = state.slots.lock().await;
        if let Some(s) = slots.get_mut(&slot) {
            s.hwnd = found;
            s.writer = writer.clone();
        }
    }
    Ok(writer)
}

#[tauri::command]
pub async fn multiview_geometry(
    app: AppHandle,
    state: State<'_, MultiviewState>,
    args: RectArgs,
) -> Result<(), String> {
    let mh = main_hwnd(&app)?;
    let (x, y, w, hh) = css_to_physical(
        mh,
        args.css_left,
        args.css_top,
        args.css_width,
        args.css_height,
        args.css_view_w,
        args.css_view_h,
    );
    let hwnd = {
        let mut slots = state.slots.lock().await;
        if let Some(s) = slots.get_mut(&args.slot) {
            s.last_rect = Some((x, y, w, hh));
            s.hwnd
        } else {
            None
        }
    };
    if let Some(h) = hwnd {
        on_main(&app, move || place_child(h, mh, x, y, w, hh)).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn multiview_audio_focus(
    state: State<'_, MultiviewState>,
    focus: i64,
) -> Result<(), String> {
    let writers: Vec<(u32, tokio::sync::mpsc::Sender<String>)> = {
        let slots = state.slots.lock().await;
        slots
            .iter()
            .filter_map(|(slot, state)| state.writer.clone().map(|writer| (*slot, writer)))
            .collect()
    };
    for (slot, writer) in writers {
        let muted = !(focus >= 0 && slot as i64 == focus);
        let message = format!("{{\"command\":[\"set_property\",\"mute\",{muted}]}}");
        let _ = writer.send(message).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn multiview_close(
    app: AppHandle,
    state: State<'_, MultiviewState>,
    slot: u32,
) -> Result<(), String> {
    let (writer, hwnd, last_rect) = {
        let slots = state.slots.lock().await;
        match slots.get(&slot) {
            Some(s) => (s.writer.clone(), s.hwnd, s.last_rect),
            None => (None, None, None),
        }
    };
    if let Some(tx) = writer {
        let _ = tx.send("{\"command\":[\"stop\"]}".to_string()).await;
        let _ = tx
            .send("{\"command\":[\"set_property\",\"mute\",true]}".to_string())
            .await;
    }
    if let Some(h) = hwnd {
        let _ = last_rect;
        on_main(&app, move || {
            move_child_only(h, -30000, 0);
        })
        .await;
    }
    Ok(())
}

#[tauri::command]
pub async fn multiview_visibility(
    app: AppHandle,
    state: State<'_, MultiviewState>,
    visible: bool,
) -> Result<(), String> {
    let mh = main_hwnd(&app)?;
    let _ = mh;
    let targets: Vec<(isize, Option<(i32, i32)>)> = {
        let slots = state.slots.lock().await;
        slots
            .values()
            .filter_map(|s| match (s.hwnd, s.last_rect) {
                (Some(h), Some(r)) if visible => Some((h, Some((r.0, r.1)))),
                (Some(h), _) if !visible => Some((h, Some((-30000, 0)))),
                _ => None,
            })
            .collect()
    };
    on_main(&app, move || {
        for (h, pos) in targets {
            if let Some((x, y)) = pos {
                move_child_only(h, x, y);
            }
        }
    })
    .await;
    Ok(())
}

#[tauri::command]
pub async fn multiview_stop_all(
    _app: AppHandle,
    state: State<'_, MultiviewState>,
) -> Result<(), String> {
    let drained: Vec<Slot> = {
        let mut slots = state.slots.lock().await;
        slots.drain().map(|(_, s)| s).collect()
    };
    for mut s in drained {
        if let Some(pid) = s.pid {
            kill_pid(pid);
        }
        if let Some(child) = s.child.as_mut() {
            let _ = child.start_kill();
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        classify_ipc_event, consume_ipc_lines, MultiviewIpcEvent, IPC_QUEUE_CAPACITY,
        MAX_IPC_BUFFER_BYTES,
    };
    use std::time::Duration;

    #[test]
    fn ipc_parser_handles_split_lines_and_keeps_partial_tail() {
        let mut pending = Vec::new();
        let mut lines = Vec::new();

        assert!(!consume_ipc_lines(
            &mut pending,
            b"{\"event\":\"file-",
            |line| { lines.push(line.to_string()) }
        ));
        assert!(!consume_ipc_lines(
            &mut pending,
            b"loaded\"}\n{\"event\":\"end-file\"}\npartial",
            |line| lines.push(line.to_string()),
        ));

        assert_eq!(
            lines,
            ["{\"event\":\"file-loaded\"}", "{\"event\":\"end-file\"}"]
        );
        assert_eq!(pending, b"partial");
    }

    #[test]
    fn ipc_parser_discards_oversized_unterminated_message() {
        let mut pending = Vec::new();
        let oversized = vec![b'x'; MAX_IPC_BUFFER_BYTES + 1];

        assert!(consume_ipc_lines(&mut pending, &oversized, |_| {
            panic!("oversized message must not be delivered")
        }));
        assert!(pending.is_empty());
    }

    #[test]
    fn ipc_classifier_ignores_malformed_and_replaceable_events() {
        assert_eq!(classify_ipc_event("not-json"), None);
        assert_eq!(
            classify_ipc_event(r#"{"event":"property-change","name":"time-pos"}"#),
            None
        );
        assert_eq!(
            classify_ipc_event(r#"{"event":"end-file","reason":"error"}"#),
            Some(MultiviewIpcEvent::Error("error".to_string()))
        );
    }

    #[tokio::test]
    async fn saturated_ipc_queue_preserves_critical_events() {
        let (sender, mut receiver) = tokio::sync::mpsc::channel(IPC_QUEUE_CAPACITY);
        for _ in 0..IPC_QUEUE_CAPACITY {
            sender.send(MultiviewIpcEvent::Playing).await.unwrap();
        }
        let blocked_sender = sender.clone();
        let send = tokio::spawn(async move {
            blocked_sender
                .send(MultiviewIpcEvent::Error("error".to_string()))
                .await
        });
        tokio::task::yield_now().await;
        assert!(!send.is_finished());

        assert_eq!(receiver.recv().await, Some(MultiviewIpcEvent::Playing));
        assert!(send.await.unwrap().is_ok());
        for _ in 1..IPC_QUEUE_CAPACITY {
            assert_eq!(receiver.recv().await, Some(MultiviewIpcEvent::Playing));
        }
        assert_eq!(
            receiver.recv().await,
            Some(MultiviewIpcEvent::Error("error".to_string()))
        );
    }

    #[tokio::test]
    async fn ipc_writer_stops_when_reader_signals_shutdown() {
        let (client, mut server) = tokio::io::duplex(64);
        let (_reader, writer) = tokio::io::split(client);
        let (tx, rx) = tokio::sync::mpsc::channel(1);
        let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
        let task = tokio::spawn(super::write_ipc_messages(writer, rx, shutdown_rx));

        tx.send("before-shutdown".to_string()).await.unwrap();
        let mut bytes = vec![0; 16];
        tokio::io::AsyncReadExt::read_exact(&mut server, &mut bytes)
            .await
            .unwrap();
        assert_eq!(&bytes, b"before-shutdown\n");

        shutdown_tx.send(true).unwrap();
        tokio::time::timeout(Duration::from_millis(100), task)
            .await
            .expect("writer task should stop")
            .unwrap();
    }
}
