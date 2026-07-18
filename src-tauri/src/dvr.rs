use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use uuid::Uuid;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const PROGRESS_TICK_MS: u64 = 2000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DvrStartArgs {
    pub url: String,
    pub output_dir: String,
    pub filename: String,
    pub duration_sec: f64,
    pub channel_name: String,
    pub program_title: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DvrSession {
    pub id: String,
    pub output_path: String,
    pub channel_name: String,
    pub program_title: Option<String>,
    pub started_at_ms: i64,
    pub planned_duration_sec: f64,
    pub bytes_written: u64,
    pub elapsed_sec: f64,
    pub state: String,
    pub error: Option<String>,
}

struct ActiveRecording {
    child: Child,
    output_path: PathBuf,
    channel_name: String,
    program_title: Option<String>,
    started_at: Instant,
    started_at_ms: i64,
    planned_duration_sec: f64,
}

pub struct DvrState {
    inner: Arc<Mutex<HashMap<String, ActiveRecording>>>,
}

impl DvrState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

pub(crate) fn locate_mpv() -> Option<PathBuf> {
    let candidates = if cfg!(windows) {
        vec![PathBuf::from("mpv.exe"), PathBuf::from("mpv")]
    } else if cfg!(target_os = "macos") {
        vec![
            PathBuf::from("/opt/homebrew/bin/mpv"),
            PathBuf::from("/usr/local/bin/mpv"),
            PathBuf::from("mpv"),
        ]
    } else {
        crate::binary_lookup::linux_binary_candidates("mpv")
    };
    for c in candidates {
        let mut cmd = std::process::Command::new(&c);
        cmd.arg("--version");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                return Some(c);
            }
        }
    }
    None
}

fn sanitize_filename(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars() {
        match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\0' => out.push('_'),
            c if c.is_control() => out.push('_'),
            c => out.push(c),
        }
    }
    let trimmed = out.trim().trim_end_matches('.').to_string();
    if trimmed.is_empty() {
        "recording".into()
    } else {
        trimmed
    }
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub async fn dvr_start(
    app: AppHandle,
    state: State<'_, DvrState>,
    args: DvrStartArgs,
) -> Result<String, String> {
    let mpv_bin = locate_mpv().ok_or_else(|| "mpv binary not found on system".to_string())?;
    let out_dir = PathBuf::from(&args.output_dir);
    if !out_dir.exists() {
        std::fs::create_dir_all(&out_dir).map_err(|e| format!("create dir: {}", e))?;
    }
    let base = sanitize_filename(&args.filename);
    let output_path = out_dir.join(format!("{}.ts", base));

    let mut cmd = Command::new(&mpv_bin);
    cmd.arg("--no-terminal")
        .arg("--quiet")
        .arg("--idle=no")
        .arg("--force-window=no")
        .arg("--vo=null")
        .arg("--ao=null")
        .arg("--cache=yes")
        .arg("--network-timeout=60")
        .arg("--user-agent=VLC/3.0.20 LibVLC/3.0.20")
        .arg(format!("--stream-record={}", output_path.display()))
        .arg(&args.url);
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    cmd.kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let child = cmd.spawn().map_err(|e| format!("spawn mpv: {}", e))?;

    let id = Uuid::new_v4().to_string();
    let started_at = Instant::now();
    let started_at_ms = now_ms();

    {
        let mut g = state.inner.lock().await;
        g.insert(
            id.clone(),
            ActiveRecording {
                child,
                output_path: output_path.clone(),
                channel_name: args.channel_name.clone(),
                program_title: args.program_title.clone(),
                started_at,
                started_at_ms,
                planned_duration_sec: args.duration_sec,
            },
        );
    }

    let app_for_progress = app.clone();
    let state_arc = state.inner.clone();
    let id_for_progress = id.clone();
    let output_path_for_progress = output_path.clone();
    let channel_for_progress = args.channel_name.clone();
    let program_for_progress = args.program_title.clone();
    let planned_for_progress = args.duration_sec;

    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_millis(PROGRESS_TICK_MS)).await;
            let still_active = {
                let g = state_arc.lock().await;
                g.contains_key(&id_for_progress)
            };
            if !still_active {
                break;
            }
            let bytes = tokio::fs::metadata(&output_path_for_progress)
                .await
                .map(|m| m.len())
                .unwrap_or(0);
            let elapsed = started_at.elapsed().as_secs_f64();
            let payload = DvrSession {
                id: id_for_progress.clone(),
                output_path: output_path_for_progress.to_string_lossy().to_string(),
                channel_name: channel_for_progress.clone(),
                program_title: program_for_progress.clone(),
                started_at_ms,
                planned_duration_sec: planned_for_progress,
                bytes_written: bytes,
                elapsed_sec: elapsed,
                state: "recording".into(),
                error: None,
            };
            let _ = app_for_progress.emit("dvr://progress", &payload);
            if elapsed >= planned_for_progress {
                let _ = finalize(&app_for_progress, &state_arc, &id_for_progress, None).await;
                break;
            }
        }
    });

    let app_for_done = app.clone();
    let state_arc_done = state.inner.clone();
    let id_for_done = id.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_millis(PROGRESS_TICK_MS)).await;
            let exit = {
                let mut g = state_arc_done.lock().await;
                if let Some(rec) = g.get_mut(&id_for_done) {
                    match rec.child.try_wait() {
                        Ok(Some(status)) => Some(status.success()),
                        Ok(None) => None,
                        Err(_) => Some(false),
                    }
                } else {
                    return;
                }
            };
            if let Some(ok) = exit {
                let msg = if ok {
                    None
                } else {
                    Some("mpv exited unexpectedly".into())
                };
                let _ = finalize(&app_for_done, &state_arc_done, &id_for_done, msg).await;
                return;
            }
        }
    });

    Ok(id)
}

async fn finalize(
    app: &AppHandle,
    state: &Arc<Mutex<HashMap<String, ActiveRecording>>>,
    id: &str,
    error: Option<String>,
) -> Result<(), String> {
    let recording = { state.lock().await.remove(id) };
    if let Some(mut rec) = recording {
        let _ = rec.child.kill().await;
        let bytes = tokio::fs::metadata(&rec.output_path)
            .await
            .map(|m| m.len())
            .unwrap_or(0);
        let elapsed = rec.started_at.elapsed().as_secs_f64();
        let payload = DvrSession {
            id: id.to_string(),
            output_path: rec.output_path.to_string_lossy().to_string(),
            channel_name: rec.channel_name.clone(),
            program_title: rec.program_title.clone(),
            started_at_ms: rec.started_at_ms,
            planned_duration_sec: rec.planned_duration_sec,
            bytes_written: bytes,
            elapsed_sec: elapsed,
            state: if error.is_some() {
                "error".into()
            } else {
                "done".into()
            },
            error: error.clone(),
        };
        let topic = if error.is_some() {
            "dvr://error"
        } else {
            "dvr://done"
        };
        let _ = app.emit(topic, &payload);
    }
    Ok(())
}

#[tauri::command]
pub async fn dvr_stop(
    app: AppHandle,
    state: State<'_, DvrState>,
    id: String,
) -> Result<(), String> {
    finalize(&app, &state.inner, &id, None).await
}

#[tauri::command]
pub async fn dvr_list(state: State<'_, DvrState>) -> Result<Vec<DvrSession>, String> {
    let recordings: Vec<_> = {
        let g = state.inner.lock().await;
        g.iter()
            .map(|(id, rec)| {
                (
                    id.clone(),
                    rec.output_path.clone(),
                    rec.channel_name.clone(),
                    rec.program_title.clone(),
                    rec.started_at,
                    rec.started_at_ms,
                    rec.planned_duration_sec,
                )
            })
            .collect()
    };
    let mut out = Vec::with_capacity(recordings.len());
    for (
        id,
        output_path,
        channel_name,
        program_title,
        started_at,
        started_at_ms,
        planned_duration_sec,
    ) in recordings
    {
        let bytes = tokio::fs::metadata(&output_path)
            .await
            .map(|m| m.len())
            .unwrap_or(0);
        out.push(DvrSession {
            id,
            output_path: output_path.to_string_lossy().to_string(),
            channel_name,
            program_title,
            started_at_ms,
            planned_duration_sec,
            bytes_written: bytes,
            elapsed_sec: started_at.elapsed().as_secs_f64(),
            state: "recording".into(),
            error: None,
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn dvr_default_dir(app: AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let base = app
        .path()
        .video_dir()
        .or_else(|_| app.path().download_dir())
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| format!("no base dir: {}", e))?;
    let dir = base.join("Harbor DVR");
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn dvr_reveal(_app: AppHandle, path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let parent = p.parent().unwrap_or(p);
    let target = parent.to_string_lossy().to_string();
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer").arg(&target).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&target).spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(&target).spawn();
    }
    Ok(())
}
