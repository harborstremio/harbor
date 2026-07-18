use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri::Manager;

const MAX_REPORT_BYTES: usize = 64 * 1024;
const PANIC_FILE: &str = "panic.json";
const RUNNING_FILE: &str = "running";

static PENDING: OnceLock<Mutex<Option<StartupCrashReport>>> = OnceLock::new();
static PANIC_PATH: OnceLock<PathBuf> = OnceLock::new();
static MARKER_PATH: OnceLock<PathBuf> = OnceLock::new();

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupCrashReport {
    pub kind: String,
    pub version: String,
    pub platform: String,
    pub message: Option<String>,
    pub location: Option<String>,
    pub backtrace: Option<String>,
}

pub fn initialize(app: &tauri::AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("resolve crash report directory: {error}"))?
        .join("crash-recovery");
    std::fs::create_dir_all(&dir).map_err(|error| format!("create crash directory: {error}"))?;

    let panic_path = dir.join(PANIC_FILE);
    let marker_path = dir.join(RUNNING_FILE);
    let previous = read_previous_report(&dir);
    let _ = PENDING.set(Mutex::new(previous));
    let _ = PANIC_PATH.set(panic_path.clone());
    let _ = MARKER_PATH.set(marker_path.clone());
    std::fs::write(&marker_path, std::process::id().to_string())
        .map_err(|error| format!("write running marker: {error}"))?;

    install_panic_hook(
        panic_path,
        app.package_info().version.to_string(),
        std::env::consts::OS.to_string(),
    );
    Ok(())
}

pub fn mark_clean_exit() {
    if let Some(path) = MARKER_PATH.get() {
        remove_marker(path);
    }
}

fn remove_marker(path: &Path) {
    let _ = std::fs::remove_file(path);
}

#[tauri::command]
pub fn take_startup_crash_report() -> Option<StartupCrashReport> {
    take_pending(PENDING.get()?, PANIC_PATH.get().map(PathBuf::as_path))
}

fn install_panic_hook(path: PathBuf, version: String, platform: String) {
    static INSTALLED: OnceLock<()> = OnceLock::new();
    if INSTALLED.set(()).is_err() {
        return;
    }
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let message = info
            .payload()
            .downcast_ref::<&str>()
            .map(|value| (*value).to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "Rust panic".to_string());
        let location = info.location().map(|location| {
            format!(
                "{}:{}:{}",
                location.file(),
                location.line(),
                location.column()
            )
        });
        let report = StartupCrashReport {
            kind: "panic".to_string(),
            version: version.clone(),
            platform: platform.clone(),
            message: Some(message),
            location,
            backtrace: Some(std::backtrace::Backtrace::force_capture().to_string()),
        };
        let _ = write_bounded_report(&path, &report);
        previous(info);
    }));
}

fn read_previous_report(dir: &Path) -> Option<StartupCrashReport> {
    let panic_path = dir.join(PANIC_FILE);
    if panic_path.exists() {
        let parsed = std::fs::File::open(&panic_path).ok().and_then(|file| {
            let mut bytes = Vec::new();
            file.take((MAX_REPORT_BYTES + 1) as u64)
                .read_to_end(&mut bytes)
                .ok()?;
            if bytes.len() > MAX_REPORT_BYTES {
                return None;
            }
            serde_json::from_slice(&bytes).ok()
        });
        if parsed.is_some() {
            return parsed;
        }
        let _ = std::fs::remove_file(&panic_path);
    }
    None
}

fn take_pending(
    pending: &Mutex<Option<StartupCrashReport>>,
    panic_path: Option<&Path>,
) -> Option<StartupCrashReport> {
    let report = pending.lock().ok()?.take()?;
    if report.kind == "panic" {
        if let Some(path) = panic_path {
            let _ = std::fs::remove_file(path);
        }
    }
    Some(report)
}

fn write_bounded_report(path: &Path, report: &StartupCrashReport) -> Result<(), String> {
    let mut report = report.clone();
    report.version = truncate(&report.version, 128);
    report.platform = truncate(&report.platform, 128);
    report.message = report.message.map(|value| truncate(&value, 4096));
    report.location = report.location.map(|value| truncate(&value, 1024));
    report.backtrace = report.backtrace.map(|value| truncate(&value, 60_000));

    let mut bytes = serde_json::to_vec(&report).map_err(|error| error.to_string())?;
    while bytes.len() > MAX_REPORT_BYTES {
        let Some(backtrace) = report.backtrace.as_ref() else {
            return Err("crash report exceeds size limit".to_string());
        };
        let target = backtrace
            .len()
            .saturating_sub((bytes.len() - MAX_REPORT_BYTES).saturating_add(256));
        if target < 1024 {
            report.backtrace = None;
        } else {
            report.backtrace = Some(truncate(backtrace, target));
        }
        bytes = serde_json::to_vec(&report).map_err(|error| error.to_string())?;
    }
    std::fs::write(path, bytes).map_err(|error| error.to_string())
}

fn truncate(value: &str, max_bytes: usize) -> String {
    if value.len() <= max_bytes {
        return value.to_string();
    }
    let mut end = max_bytes.min(value.len());
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    value[..end].to_string()
}

#[cfg(test)]
mod tests {
    use super::{
        read_previous_report, remove_marker, take_pending, write_bounded_report, StartupCrashReport,
    };
    use std::sync::Mutex;

    fn temp_dir() -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "harbor-crash-report-test-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn panic_report_wins_over_running_marker() {
        let dir = temp_dir();
        std::fs::write(dir.join("running"), b"1").unwrap();
        std::fs::write(
            dir.join("panic.json"),
            r#"{"kind":"panic","version":"1.2.3","platform":"macos","message":"boom","location":"main.rs:7","backtrace":"trace"}"#,
        )
        .unwrap();

        let report = read_previous_report(&dir).unwrap();

        assert_eq!(report.kind, "panic");
        assert_eq!(report.message.as_deref(), Some("boom"));
        assert!(dir.join("panic.json").exists());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn marker_without_panic_is_ignored() {
        let dir = temp_dir();
        std::fs::write(dir.join("running"), b"1").unwrap();

        let report = read_previous_report(&dir);

        assert!(report.is_none());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn report_writer_caps_the_file_size() {
        let dir = temp_dir();
        let report = StartupCrashReport {
            kind: "panic".into(),
            version: "1.2.3".into(),
            platform: "test".into(),
            message: Some("boom".into()),
            location: Some("main.rs:7".into()),
            backtrace: Some("x".repeat(100_000)),
        };

        write_bounded_report(&dir.join("panic.json"), &report).unwrap();

        assert!(std::fs::metadata(dir.join("panic.json")).unwrap().len() <= 65_536);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn report_writer_handles_heavily_escaped_backtraces() {
        let dir = temp_dir();
        let report = StartupCrashReport {
            kind: "panic".into(),
            version: "1.2.3".into(),
            platform: "test".into(),
            message: Some("boom".into()),
            location: Some("main.rs:7".into()),
            backtrace: Some("\0".repeat(100_000)),
        };

        write_bounded_report(&dir.join("panic.json"), &report).unwrap();

        assert!(std::fs::metadata(dir.join("panic.json")).unwrap().len() <= 65_536);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn pending_report_is_consumed_once() {
        let dir = temp_dir();
        let panic_path = dir.join("panic.json");
        std::fs::write(&panic_path, b"report").unwrap();
        let pending = Mutex::new(Some(StartupCrashReport {
            kind: "panic".into(),
            version: "1.2.3".into(),
            platform: "test".into(),
            message: None,
            location: None,
            backtrace: None,
        }));

        assert!(take_pending(&pending, Some(&panic_path)).is_some());
        assert!(!panic_path.exists());
        assert!(take_pending(&pending, Some(&panic_path)).is_none());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn clean_exit_removes_the_running_marker() {
        let dir = temp_dir();
        let marker = dir.join("running");
        std::fs::write(&marker, b"1").unwrap();

        remove_marker(&marker);

        assert!(!marker.exists());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
