use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tokio::io::AsyncWriteExt;

const MARKER: &str = "harbor-install.json";
const STAGE_PREFIX: &str = "harbor-update-";
const SETUP_NAME: &str = "harbor-setup.exe";
const LOG_NAME: &str = "harbor-setup.log";
const GRACE_MS: u64 = 2_000;
const POLL_MS: u64 = 100;
const FLUSH_STEPS: u32 = 16;
const FLUSH_STEP_MS: u64 = 50;
const PROGRESS_BYTES: u64 = 2 * 1024 * 1024;

struct Staged {
    path: PathBuf,
    version: String,
}

static STAGED: Mutex<Option<Staged>> = Mutex::new(None);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallMarker {
    payload_version: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HandoffProbe {
    supported: bool,
    managed: bool,
    install_dir: String,
    payload_version: u64,
    platform_key: String,
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum StageEvent {
    Started { total: Option<u64> },
    Progress { received: u64, total: Option<u64> },
    Verifying,
    Ready,
}

fn install_dir() -> Option<PathBuf> {
    std::env::current_exe().ok()?.parent().map(PathBuf::from)
}

fn platform_key() -> String {
    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };
    let arch = if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else if cfg!(target_arch = "x86") {
        "i686"
    } else if cfg!(target_arch = "arm") {
        "armv7"
    } else {
        std::env::consts::ARCH
    };
    format!("{}-{}", os, arch)
}

#[tauri::command]
pub fn handoff_probe() -> HandoffProbe {
    let dir = install_dir();
    let marker = dir
        .as_ref()
        .and_then(|d| std::fs::read_to_string(d.join(MARKER)).ok())
        .and_then(|text| serde_json::from_str::<InstallMarker>(&text).ok());
    HandoffProbe {
        supported: cfg!(target_os = "windows") && dir.is_some(),
        managed: marker.is_some(),
        install_dir: dir
            .map(|d| d.to_string_lossy().to_string())
            .unwrap_or_default(),
        payload_version: marker.and_then(|m| m.payload_version).unwrap_or(0),
        platform_key: platform_key(),
    }
}

fn updater_pubkey(app: &tauri::AppHandle) -> Result<String, String> {
    app.config()
        .plugins
        .0
        .get("updater")
        .and_then(|v| v.get("pubkey"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "this build carries no updater public key".to_string())
}

fn safe_version(version: &str) -> String {
    let cleaned: String = version
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '-')
        .collect();
    if cleaned.is_empty() {
        "pending".to_string()
    } else {
        cleaned
    }
}

fn stage_dir(version: &str) -> Result<PathBuf, String> {
    let root = std::env::temp_dir();
    if let Ok(entries) = std::fs::read_dir(&root) {
        for entry in entries.flatten() {
            if entry
                .file_name()
                .to_string_lossy()
                .starts_with(STAGE_PREFIX)
            {
                let _ = std::fs::remove_dir_all(entry.path());
            }
        }
    }
    let dir = root.join(format!("{}{}", STAGE_PREFIX, safe_version(version)));
    std::fs::create_dir_all(&dir).map_err(|e| format!("staging folder: {}", e))?;
    Ok(dir)
}

async fn fetch_setup(url: &str, dest: &Path, on_event: &Channel<StageEvent>) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("http client: {}", e))?;
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("request: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!(
            "the installer download returned HTTP {}",
            resp.status().as_u16()
        ));
    }
    let total = resp.content_length();
    let _ = on_event.send(StageEvent::Started { total });
    let mut file = tokio::fs::File::create(dest)
        .await
        .map_err(|e| format!("create download: {}", e))?;
    let mut stream = resp.bytes_stream();
    let mut received: u64 = 0;
    let mut marked: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("transfer: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("write download: {}", e))?;
        received += chunk.len() as u64;
        if received - marked >= PROGRESS_BYTES {
            marked = received;
            let _ = on_event.send(StageEvent::Progress { received, total });
        }
    }
    file.sync_all()
        .await
        .map_err(|e| format!("flush download: {}", e))?;
    drop(file);
    let _ = on_event.send(StageEvent::Progress { received, total });
    if let Some(expected) = total {
        if received != expected {
            return Err(format!(
                "the download ended early at {} of {} bytes",
                received, expected
            ));
        }
    }
    Ok(())
}

fn verify_setup(path: &Path, signature: &str, pubkey: &str) -> Result<(), String> {
    use base64::Engine;
    let engine = base64::engine::general_purpose::STANDARD;
    let key_text = engine
        .decode(pubkey.trim())
        .ok()
        .and_then(|raw| String::from_utf8(raw).ok())
        .ok_or_else(|| "the bundled updater public key is unreadable".to_string())?;
    let key = minisign_verify::PublicKey::decode(key_text.trim())
        .map_err(|e| format!("updater public key: {}", e))?;
    let sig_text = engine
        .decode(signature.trim())
        .ok()
        .and_then(|raw| String::from_utf8(raw).ok())
        .ok_or_else(|| "the installer signature in the manifest is unreadable".to_string())?;
    let sig = minisign_verify::Signature::decode(sig_text.trim())
        .map_err(|e| format!("installer signature: {}", e))?;
    let mut file = std::fs::File::open(path).map_err(|e| format!("open download: {}", e))?;
    match key.verify_stream(&sig) {
        Ok(mut verifier) => {
            let mut buf = vec![0u8; 1024 * 1024];
            loop {
                let read = file
                    .read(&mut buf)
                    .map_err(|e| format!("read download: {}", e))?;
                if read == 0 {
                    break;
                }
                verifier.update(&buf[..read]);
            }
            verifier
                .finalize()
                .map_err(|e| format!("the downloaded installer failed its signature check: {}", e))
        }
        Err(_) => {
            let bytes = std::fs::read(path).map_err(|e| format!("read download: {}", e))?;
            key.verify(&bytes, &sig, true)
                .map_err(|e| format!("the downloaded installer failed its signature check: {}", e))
        }
    }
}

#[tauri::command]
pub async fn handoff_stage(
    app: tauri::AppHandle,
    url: String,
    signature: String,
    version: String,
    on_event: Channel<StageEvent>,
) -> Result<(), String> {
    if !cfg!(target_os = "windows") {
        return Err("the installer handoff only exists on Windows".to_string());
    }
    if signature.trim().is_empty() {
        return Err("the update manifest carries no signature for the installer".to_string());
    }
    let pubkey = updater_pubkey(&app)?;
    let dir = stage_dir(&version)?;
    let dest = dir.join(SETUP_NAME);
    if let Err(e) = fetch_setup(&url, &dest, &on_event).await {
        let _ = std::fs::remove_dir_all(&dir);
        return Err(e);
    }
    let _ = on_event.send(StageEvent::Verifying);
    let checked = dest.clone();
    let outcome = tokio::task::spawn_blocking(move || verify_setup(&checked, &signature, &pubkey))
        .await
        .map_err(|e| format!("verify: {}", e))?;
    if let Err(e) = outcome {
        let _ = std::fs::remove_dir_all(&dir);
        return Err(e);
    }
    if let Ok(mut slot) = STAGED.lock() {
        *slot = Some(Staged {
            path: dest,
            version,
        });
    }
    let _ = on_event.send(StageEvent::Ready);
    Ok(())
}

#[cfg(windows)]
fn spawn_setup(
    setup: &Path,
    target: &Path,
    log: &Path,
    pid: u32,
    from: &str,
    to: &str,
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const DETACHED_PROCESS: u32 = 0x0000_0008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
    let mut child = std::process::Command::new(setup)
        .arg("--update")
        .arg("--passive")
        .arg("--target-dir")
        .arg(target)
        .arg("--wait-pid")
        .arg(pid.to_string())
        .arg("--relaunch")
        .arg("--from-version")
        .arg(from)
        .arg("--to-version")
        .arg(to)
        .arg("--log")
        .arg(log)
        .current_dir(std::env::temp_dir())
        .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("could not start Harbor Setup: {}", e))?;
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(GRACE_MS);
    while std::time::Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(status)) => {
                return Err(format!(
                    "Harbor Setup stopped straight away with exit code {}",
                    status.code().unwrap_or(-1)
                ))
            }
            Ok(None) => std::thread::sleep(std::time::Duration::from_millis(POLL_MS)),
            Err(e) => return Err(format!("could not watch Harbor Setup: {}", e)),
        }
    }
    Ok(())
}

#[cfg(not(windows))]
fn spawn_setup(
    _setup: &Path,
    _target: &Path,
    _log: &Path,
    _pid: u32,
    _from: &str,
    _to: &str,
) -> Result<(), String> {
    Err("the installer handoff only exists on Windows".to_string())
}

fn quit_for_handoff(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        use tauri::{Emitter, Manager};
        if let Some(window) = app.get_webview_window("main") {
            crate::CLOSE_FLUSH_DONE.store(false, std::sync::atomic::Ordering::SeqCst);
            let _ = window.emit("harbor://app-closing", ());
            for _ in 0..FLUSH_STEPS {
                if crate::CLOSE_FLUSH_DONE.load(std::sync::atomic::Ordering::SeqCst) {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(FLUSH_STEP_MS));
            }
        }
        crate::shutdown_services(&app);
        app.exit(0);
    });
}

#[tauri::command]
pub async fn handoff_launch(app: tauri::AppHandle) -> Result<(), String> {
    let staged = STAGED
        .lock()
        .ok()
        .and_then(|slot| slot.as_ref().map(|s| (s.path.clone(), s.version.clone())));
    let (setup, version) = staged.ok_or_else(|| "no verified installer is staged".to_string())?;
    if !setup.is_file() {
        return Err("the staged installer is no longer on disk".to_string());
    }
    let target =
        install_dir().ok_or_else(|| "cannot resolve the Harbor install folder".to_string())?;
    let log = setup.with_file_name(LOG_NAME);
    let from = app.package_info().version.to_string();
    let pid = std::process::id();
    tokio::task::spawn_blocking(move || spawn_setup(&setup, &target, &log, pid, &from, &version))
        .await
        .map_err(|e| format!("launch: {}", e))??;
    quit_for_handoff(app);
    Ok(())
}
