use std::io::{Read, Write};
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
    signature: String,
    recoverable: bool,
}

static STAGED: Mutex<Option<Staged>> = Mutex::new(None);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallMarker {
    payload_version: Option<u64>,
}

fn read_install_marker(dest: &Path) -> Option<InstallMarker> {
    std::fs::read_to_string(dest.join(MARKER))
        .ok()
        .and_then(|text| serde_json::from_str::<InstallMarker>(&text).ok())
}

fn payload_version(version: &str) -> Result<u64, String> {
    let parts: Vec<_> = version.split('.').collect();
    if parts.len() != 3
        || parts
            .iter()
            .any(|part| part.is_empty() || !part.bytes().all(|c| c.is_ascii_digit()))
    {
        return Err("the running Harbor version cannot be used for installer recovery".into());
    }
    let major = parts[0].parse::<u64>().map_err(|e| e.to_string())?;
    let minor = parts[1].parse::<u64>().map_err(|e| e.to_string())?;
    let patch = parts[2].parse::<u64>().map_err(|e| e.to_string())?;
    if minor >= 1_000 || patch >= 1_000 {
        return Err("the running Harbor version cannot be used for installer recovery".into());
    }
    major
        .checked_mul(1_000_000)
        .and_then(|value| value.checked_add(minor * 1_000))
        .and_then(|value| value.checked_add(patch))
        .ok_or_else(|| "the running Harbor version cannot be used for installer recovery".into())
}

fn ensure_recovery_marker(dest: &Path, version: &str) -> Result<bool, String> {
    let marker = dest.join(MARKER);
    if marker.exists() {
        return read_install_marker(dest)
            .filter(|value| value.payload_version.unwrap_or(0) > 0)
            .map(|_| false)
            .ok_or_else(|| "the existing Harbor install marker is invalid".into());
    }
    if !dest.join("harbor.exe").is_file() {
        return Err("the Harbor installation is missing harbor.exe".into());
    }
    let installed_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let body = serde_json::json!({
        "payloadVersion": payload_version(version)?,
        "version": version,
        "installedAt": installed_at,
        "installer": "harbor-bootstrap",
    });
    let mut file = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&marker)
        .map_err(|e| format!("cannot create the Harbor install marker: {e}"))?;
    serde_json::to_writer_pretty(&mut file, &body)
        .map_err(|e| format!("cannot write the Harbor install marker: {e}"))?;
    file.write_all(b"\n")
        .map_err(|e| format!("cannot write the Harbor install marker: {e}"))?;
    file.sync_all()
        .map_err(|e| format!("cannot flush the Harbor install marker: {e}"))?;
    Ok(true)
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
    let marker = dir.as_deref().and_then(read_install_marker);
    let payload_version = marker
        .as_ref()
        .and_then(|value| value.payload_version)
        .unwrap_or(0);
    HandoffProbe {
        supported: cfg!(target_os = "windows") && dir.is_some(),
        managed: payload_version > 0,
        install_dir: dir
            .map(|d| d.to_string_lossy().to_string())
            .unwrap_or_default(),
        payload_version,
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
    // Do not erase a previous handoff or its recovery installer when retrying.
    let dir = root.join(format!(
        "{}{}-{}",
        STAGE_PREFIX,
        safe_version(version),
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir(&dir).map_err(|e| format!("staging folder: {}", e))?;
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
    recoverable: Option<bool>,
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
    let verify_signature = signature.clone();
    let outcome =
        tokio::task::spawn_blocking(move || verify_setup(&checked, &verify_signature, &pubkey))
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
            signature,
            recoverable: recoverable.unwrap_or(false),
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
    recoverable: bool,
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const DETACHED_PROCESS: u32 = 0x0000_0008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
    let mut command = std::process::Command::new(setup);
    if recoverable {
        command.arg("--recoverable");
    }
    let mut child = command
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
    _recoverable: bool,
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
    let staged = STAGED.lock().ok().and_then(|slot| {
        slot.as_ref().map(|s| {
            (
                s.path.clone(),
                s.version.clone(),
                s.signature.clone(),
                s.recoverable,
            )
        })
    });
    let (setup, version, signature, recoverable) =
        staged.ok_or_else(|| "no verified installer is staged".to_string())?;
    if !setup.is_file() {
        return Err("the staged installer is no longer on disk".to_string());
    }
    let target =
        install_dir().ok_or_else(|| "cannot resolve the Harbor install folder".to_string())?;
    let log = setup.with_file_name(LOG_NAME);
    let from = app.package_info().version.to_string();
    let pid = std::process::id();
    let pubkey = updater_pubkey(&app)?;
    tokio::task::spawn_blocking(move || {
        verify_setup(&setup, &signature, &pubkey)?;
        if recoverable {
            ensure_recovery_marker(&target, &from)?;
        }
        spawn_setup(&setup, &target, &log, pid, &from, &version, recoverable)
    })
    .await
    .map_err(|e| format!("launch: {}", e))??;
    quit_for_handoff(app);
    Ok(())
}

#[tauri::command]
pub fn handoff_confirm(app: tauri::AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" || !cfg!(target_os = "windows") {
        return Ok(());
    }
    let dest = install_dir().ok_or("cannot resolve the install directory")?;
    harbor_install_recovery::acknowledge(&dest, &app.package_info().version.to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn handoff_save_backup(app: tauri::AppHandle, content: String) -> Result<(), String> {
    use tauri::Manager;
    if content.len() > 100 * 1024 * 1024 {
        return Err("recovery backup is too large".into());
    }
    let backup: serde_json::Value =
        serde_json::from_str(&content).map_err(|_| "invalid recovery backup")?;
    if backup.get("format").and_then(|v| v.as_str()) != Some("harbor-backup") {
        return Err("invalid recovery backup format".into());
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("update-recovery")
        .join(uuid::Uuid::new_v4().to_string());
    tokio::task::spawn_blocking(move || {
        use std::io::Write;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let mut options = std::fs::OpenOptions::new();
        options.create_new(true).write(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(dir.join("profile.harbx"))
            .map_err(|e| e.to_string())?;
        file.write_all(content.as_bytes())
            .map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> PathBuf {
        std::env::temp_dir().join(format!("harbor-handoff-bootstrap-{}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn bootstraps_a_recoverable_nsis_install() {
        let dest = fixture();
        std::fs::create_dir_all(&dest).unwrap();
        std::fs::write(dest.join("harbor.exe"), b"test").unwrap();

        assert!(harbor_install_recovery::Transaction::begin(&dest, "0.999.1").is_err());
        assert!(ensure_recovery_marker(&dest, "0.9.124").unwrap());

        let marker: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(dest.join(MARKER)).unwrap()).unwrap();
        assert_eq!(marker["payloadVersion"], 9_124);
        assert_eq!(marker["version"], "0.9.124");
        assert_eq!(marker["installer"], "harbor-bootstrap");
        assert!(!ensure_recovery_marker(&dest, "0.9.124").unwrap());

        let transaction = harbor_install_recovery::Transaction::begin(&dest, "0.999.1").unwrap();
        let recovery = transaction.root().to_path_buf();
        drop(transaction);
        std::fs::remove_dir_all(recovery).unwrap();
        std::fs::remove_dir_all(dest).unwrap();
    }

    #[test]
    fn refuses_to_replace_an_invalid_marker() {
        let dest = fixture();
        std::fs::create_dir_all(&dest).unwrap();
        std::fs::write(dest.join("harbor.exe"), b"test").unwrap();
        std::fs::write(dest.join(MARKER), b"not json").unwrap();

        assert!(ensure_recovery_marker(&dest, "0.9.124").is_err());
        assert_eq!(std::fs::read(dest.join(MARKER)).unwrap(), b"not json");
        std::fs::remove_dir_all(dest).unwrap();
    }
}
