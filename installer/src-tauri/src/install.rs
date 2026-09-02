use std::fs;
#[cfg(feature = "payload")]
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const APP_NAME: &str = "Harbor";
pub(crate) const MAIN_EXE: &str = "harbor.exe";
const UNINST_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\Harbor";

#[derive(Clone, Serialize)]
struct Progress {
    pct: f64,
    step: String,
}

#[cfg(windows)]
fn quiet<S: AsRef<std::ffi::OsStr>>(program: S) -> Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(windows))]
fn quiet<S: AsRef<std::ffi::OsStr>>(program: S) -> Command {
    Command::new(program)
}

#[cfg(feature = "payload")]
fn emit(app: &AppHandle, pct: f64, step: &str) {
    let _ = app.emit("install://progress", Progress { pct, step: step.to_string() });
}

#[cfg(feature = "payload")]
const PAYLOAD: &[u8] = include_bytes!("../payload/harbor-payload.zip");
#[cfg(feature = "payload")]
const PAYLOAD_VERSION: &str = include_str!("../payload/version.txt");

#[cfg(feature = "payload")]
const UNINST_EXE: &str = "uninstall.exe";

#[cfg(feature = "payload")]
const MARKER: &str = "harbor-install.json";

#[cfg(feature = "payload")]
pub(crate) fn shipped_version() -> String {
    PAYLOAD_VERSION.trim().to_string()
}

#[cfg(not(feature = "payload"))]
pub(crate) fn shipped_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(feature = "payload")]
fn open_payload() -> Result<zip::ZipArchive<std::io::Cursor<&'static [u8]>>, String> {
    zip::ZipArchive::new(std::io::Cursor::new(PAYLOAD)).map_err(|e| e.to_string())
}

#[cfg(feature = "payload")]
fn safe_rel(name: &str) -> Option<PathBuf> {
    let mut out = PathBuf::new();
    for part in name.split(['/', '\\']) {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." || part.contains(':') {
            return None;
        }
        out.push(part);
    }
    if out.as_os_str().is_empty() {
        None
    } else {
        Some(out)
    }
}

#[cfg(feature = "payload")]
#[tauri::command]
pub fn payload_entries() -> Result<Vec<String>, String> {
    let mut archive = open_payload()?;
    let mut out = Vec::new();
    for i in 0..archive.len() {
        let e = archive.by_index(i).map_err(|x| x.to_string())?;
        let raw = e.name().to_string();
        let resolved = match safe_rel(&raw) {
            Some(p) => p.to_string_lossy().to_string(),
            None => String::from("<REJECTED>"),
        };
        out.push(format!("{} -> {}", raw, resolved));
    }
    Ok(out)
}

#[cfg(feature = "payload")]
#[derive(Clone, Serialize)]
pub struct Component {
    pub key: String,
    pub bytes: u64,
}

#[cfg(feature = "payload")]
#[derive(Clone, Serialize)]
pub struct Facts {
    pub components: Vec<Component>,
    pub installed_bytes: u64,
    pub installer_bytes: u64,
    pub webview2_present: bool,
    pub webview2_bytes: u64,
    pub free_bytes: u64,
    pub dest: String,
    pub version: String,
}

#[cfg(feature = "payload")]
fn bucket_for(name: &str) -> &'static str {
    let n = name.to_ascii_lowercase();
    if n.contains("mpv") {
        "mpv"
    } else if n.contains("ffmpeg") || n.contains("ffprobe") {
        "ffmpeg"
    } else if n.contains("yt-dlp") {
        "ytdlp"
    } else if n.contains("fonts") || n.contains("notices") {
        "support"
    } else {
        "harbor"
    }
}

#[cfg(all(windows, feature = "payload"))]
fn webview2_installed() -> bool {
    use winreg::enums::*;
    use winreg::RegKey;
    const GUID: &str = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    let paths = [
        (HKEY_LOCAL_MACHINE, format!(r"SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{GUID}")),
        (HKEY_LOCAL_MACHINE, format!(r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{GUID}")),
        (HKEY_CURRENT_USER, format!(r"Software\Microsoft\EdgeUpdate\Clients\{GUID}")),
    ];
    for (root, path) in paths {
        if let Ok(key) = RegKey::predef(root).open_subkey(&path) {
            if let Ok(v) = key.get_value::<String, _>("pv") {
                if !v.is_empty() && v != "0.0.0.0" {
                    return true;
                }
            }
        }
    }
    false
}

#[cfg(all(not(windows), feature = "payload"))]
fn webview2_installed() -> bool {
    true
}

#[cfg(feature = "payload")]
fn free_space(dest: &Path) -> u64 {
    let mut probe = dest.to_path_buf();
    loop {
        if probe.exists() {
            break;
        }
        match probe.parent() {
            Some(p) => probe = p.to_path_buf(),
            None => return 0,
        }
    }
    match fs::metadata(&probe) {
        Ok(_) => available_bytes(&probe),
        Err(_) => 0,
    }
}

#[cfg(all(windows, feature = "payload"))]
fn available_bytes(path: &Path) -> u64 {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    wide.push(0);
    let mut free: u64 = 0;
    let ok = unsafe {
        GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if ok == 0 { 0 } else { free }
}

#[cfg(all(not(windows), feature = "payload"))]
fn available_bytes(_path: &Path) -> u64 {
    0
}

#[cfg(feature = "payload")]
#[tauri::command]
pub fn install_facts() -> Result<Facts, String> {
    let mut archive = open_payload()?;
    let mut totals: std::collections::BTreeMap<&'static str, u64> = std::collections::BTreeMap::new();
    let mut installed: u64 = 0;
    for i in 0..archive.len() {
        let e = archive.by_index(i).map_err(|x| x.to_string())?;
        let size = e.size();
        installed += size;
        *totals.entry(bucket_for(e.name())).or_insert(0) += size;
    }
    let components = totals
        .into_iter()
        .map(|(k, v)| Component { key: k.to_string(), bytes: v })
        .collect();
    let dest = PathBuf::from(default_install_dir());
    let installer_bytes = std::env::current_exe()
        .ok()
        .and_then(|p| fs::metadata(p).ok())
        .map(|m| m.len())
        .unwrap_or(0);
    Ok(Facts {
        components,
        installed_bytes: installed,
        installer_bytes,
        webview2_present: webview2_installed(),
        webview2_bytes: 136_000_000,
        free_bytes: free_space(&dest),
        dest: dest.to_string_lossy().to_string(),
        version: shipped_version(),
    })
}

#[tauri::command]
pub fn is_uninstall_mode() -> bool {
    if cfg!(not(feature = "payload")) {
        return true;
    }
    std::env::args().any(|a| a == "--uninstall")
}

#[derive(Clone, Serialize)]
pub struct UninstallFacts {
    pub dest: String,
    pub version: String,
    pub program_bytes: u64,
    pub data_bytes: u64,
    pub data_dirs: Vec<String>,
}

fn dir_size(path: &Path) -> u64 {
    let mut total = 0;
    let entries = match fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => return 0,
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            total += dir_size(&p);
        } else if let Ok(meta) = entry.metadata() {
            total += meta.len();
        }
    }
    total
}

fn data_dirs() -> Vec<PathBuf> {
    let mut out = Vec::new();
    for var in ["APPDATA", "LOCALAPPDATA"] {
        if let Ok(base) = std::env::var(var) {
            let dir = PathBuf::from(base).join("app.harbor");
            if dir.is_dir() {
                out.push(dir);
            }
        }
    }
    out
}

fn uninstall_target() -> PathBuf {
    if let Some(found) = scan_uninstall_roots() {
        let from_registry = PathBuf::from(&found.path);
        if from_registry.join(MAIN_EXE).exists() {
            return from_registry;
        }
    }

    let beside_me = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()));
    if let Some(dir) = beside_me {
        if dir.join(MAIN_EXE).exists() {
            return dir;
        }
    }

    PathBuf::from(default_install_dir())
}

#[tauri::command]
pub fn uninstall_facts() -> UninstallFacts {
    let dest = uninstall_target();

    let dirs = data_dirs();
    let version = installed_version().unwrap_or_else(shipped_version);

    UninstallFacts {
        program_bytes: dir_size(&dest),
        data_bytes: dirs.iter().map(|d| dir_size(d)).sum(),
        data_dirs: dirs.iter().map(|d| d.to_string_lossy().to_string()).collect(),
        dest: dest.to_string_lossy().to_string(),
        version,
    }
}

#[cfg(windows)]
fn installed_version() -> Option<String> {
    use winreg::enums::*;
    use winreg::RegKey;
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(UNINST_KEY)
        .ok()
        .and_then(|k| k.get_value::<String, _>("DisplayVersion").ok())
        .filter(|v| !v.is_empty())
}

#[cfg(not(windows))]
fn installed_version() -> Option<String> {
    None
}

#[cfg(feature = "payload")]
#[tauri::command]
pub fn harbor_version() -> String {
    shipped_version()
}

#[cfg(feature = "payload")]
#[tauri::command]
pub fn free_space_at(path: String) -> u64 {
    free_space(&PathBuf::from(path))
}

#[tauri::command]
pub fn default_install_dir() -> String {
    match std::env::var("LOCALAPPDATA") {
        Ok(base) => PathBuf::from(base).join(APP_NAME).to_string_lossy().to_string(),
        Err(_) => format!("C:\\{APP_NAME}"),
    }
}

#[cfg(feature = "payload")]
#[tauri::command]
pub fn payload_size() -> Result<u64, String> {
    let mut archive = open_payload()?;
    let mut total: u64 = 0;
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        total += entry.size();
    }
    Ok(total)
}


#[cfg(all(windows, feature = "payload"))]
fn make_shortcuts(lnks: &[PathBuf], target: &Path, workdir: &Path) -> Result<(), String> {
    use windows::core::{Interface, HSTRING};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

    if lnks.is_empty() {
        return Ok(());
    }
    for lnk in lnks {
        if let Some(parent) = lnk.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let result = (|| -> Result<(), String> {
            for lnk in lnks {
                let link: IShellLinkW =
                    CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).map_err(|e| e.to_string())?;
                link.SetPath(&HSTRING::from(target.as_os_str())).map_err(|e| e.to_string())?;
                link.SetWorkingDirectory(&HSTRING::from(workdir.as_os_str()))
                    .map_err(|e| e.to_string())?;
                let file: IPersistFile = link.cast().map_err(|e| e.to_string())?;
                file.Save(&HSTRING::from(lnk.as_os_str()), true).map_err(|e| e.to_string())?;
            }
            Ok(())
        })();
        CoUninitialize();
        result
    }
}

#[cfg(all(not(windows), feature = "payload"))]
fn make_shortcuts(_lnks: &[PathBuf], _target: &Path, _workdir: &Path) -> Result<(), String> {
    Ok(())
}

fn start_menu_lnk() -> Option<PathBuf> {
    std::env::var("APPDATA").ok().map(|a| {
        PathBuf::from(a)
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs")
            .join(format!("{APP_NAME}.lnk"))
    })
}

pub(crate) fn desktop_lnk() -> Option<PathBuf> {
    std::env::var("USERPROFILE").ok().map(|u| PathBuf::from(u).join("Desktop").join(format!("{APP_NAME}.lnk")))
}

#[cfg(all(windows, feature = "payload"))]
fn uninstall_string_for(dest: &Path) -> String {
    format!("\"{}\" --uninstall", dest.join(UNINST_EXE).display())
}

#[cfg(all(windows, feature = "payload"))]
fn uninstall_entry_intact(dest: &Path, version: &str) -> bool {
    use winreg::enums::*;
    use winreg::RegKey;
    let key = match RegKey::predef(HKEY_CURRENT_USER).open_subkey(UNINST_KEY) {
        Ok(k) => k,
        Err(_) => return false,
    };
    let expect: [(&str, String); 4] = [
        ("DisplayName", APP_NAME.to_string()),
        ("DisplayVersion", version.to_string()),
        ("InstallLocation", dest.to_string_lossy().to_string()),
        ("UninstallString", uninstall_string_for(dest)),
    ];
    for (name, want) in expect {
        match key.get_value::<String, _>(name) {
            Ok(got) if got == want => continue,
            _ => return false,
        }
    }
    true
}

#[cfg(all(not(windows), feature = "payload"))]
fn uninstall_entry_intact(_dest: &Path, _version: &str) -> bool {
    true
}

#[cfg(all(windows, feature = "payload"))]
fn write_uninstall_entry(dest: &Path, version: &str, size_kb: u32) -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu.create_subkey(UNINST_KEY).map_err(|e| e.to_string())?;
    let exe = dest.join(MAIN_EXE);
    key.set_value("DisplayName", &APP_NAME.to_string()).map_err(|e| e.to_string())?;
    key.set_value("DisplayVersion", &version.to_string()).map_err(|e| e.to_string())?;
    key.set_value("Publisher", &"Harbor".to_string()).map_err(|e| e.to_string())?;
    key.set_value("InstallLocation", &dest.to_string_lossy().to_string()).map_err(|e| e.to_string())?;
    key.set_value("DisplayIcon", &exe.to_string_lossy().to_string()).map_err(|e| e.to_string())?;
    key.set_value("UninstallString", &uninstall_string_for(dest)).map_err(|e| e.to_string())?;
    key.set_value("EstimatedSize", &size_kb).map_err(|e| e.to_string())?;
    key.set_value("NoModify", &1u32).map_err(|e| e.to_string())?;
    key.set_value("NoRepair", &1u32).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(all(not(windows), feature = "payload"))]
fn write_uninstall_entry(_dest: &Path, _version: &str, _size_kb: u32) -> Result<(), String> {
    Ok(())
}

const SIDECARS: [&str; 5] = [
    "mpv.exe",
    "yt-dlp.exe",
    "ffmpeg.exe",
    "ffprobe.exe",
    "stremio-server.exe",
];

#[derive(Clone, Serialize)]
pub struct Existing {
    pub path: String,
    pub version: String,
    pub scope: String,
}

#[cfg(windows)]
pub(crate) fn scan_uninstall_roots() -> Option<Existing> {
    use winreg::enums::*;
    use winreg::RegKey;
    let roots: [(isize, &str, &str); 3] = [
        (HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Uninstall", "user"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", "machine"),
        (HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall", "machine"),
    ];
    for (hive, path, scope) in roots {
        let root = match RegKey::predef(hive).open_subkey(path) {
            Ok(k) => k,
            Err(_) => continue,
        };
        for name in root.enum_keys().flatten() {
            let key = match root.open_subkey(&name) {
                Ok(k) => k,
                Err(_) => continue,
            };
            let display: String = key.get_value("DisplayName").unwrap_or_default();
            if display != APP_NAME {
                continue;
            }
            let location: String = key.get_value("InstallLocation").unwrap_or_default();
            if location.is_empty() || !PathBuf::from(&location).join(MAIN_EXE).exists() {
                continue;
            }
            let version: String = key.get_value("DisplayVersion").unwrap_or_default();
            return Some(Existing { path: location, version, scope: scope.to_string() });
        }
    }
    None
}

#[cfg(not(windows))]
pub(crate) fn scan_uninstall_roots() -> Option<Existing> {
    None
}

#[cfg(feature = "payload")]
#[tauri::command]
pub fn existing_install() -> Option<Existing> {
    scan_uninstall_roots()
}

pub(crate) fn stop_harbor() {
    let mut kill = quiet("taskkill");
    kill.args(["/F", "/T", "/IM", MAIN_EXE]);
    for name in SIDECARS {
        kill.args(["/IM", name]);
    }
    let _ = kill.output();

    let _ = quiet("taskkill")
        .args(["/F", "/T", "/FI", "IMAGENAME eq stremio-server*"])
        .output();
    std::thread::sleep(std::time::Duration::from_millis(500));
}

fn step(app: &AppHandle, pct: f64, label: &str) {
    let _ = app.emit("uninstall://progress", Progress { pct, step: label.to_string() });
}

#[cfg(windows)]
fn remove_shortcuts() {
    if let Some(lnk) = start_menu_lnk() {
        let _ = fs::remove_file(lnk);
    }
    if let Some(lnk) = desktop_lnk() {
        let _ = fs::remove_file(lnk);
    }
}

#[cfg(not(windows))]
fn remove_shortcuts() {}

#[cfg(windows)]
fn remove_registry() {
    use winreg::enums::*;
    use winreg::RegKey;
    let _ = RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(UNINST_KEY);
}

#[cfg(not(windows))]
fn remove_registry() {}

fn remove_tree(app: &AppHandle, dest: &Path, from: f64, to: f64) {
    let me = std::env::current_exe().ok();
    let mut files = Vec::new();
    collect_files(dest, dest, &mut files);
    let total = files.len().max(1) as f64;

    for (i, rel) in files.iter().enumerate() {
        let full = dest.join(rel);
        if me.as_deref() == Some(full.as_path()) {
            continue;
        }
        let _ = fs::remove_file(&full);
        if i % 8 == 0 || i + 1 == files.len() {
            let pct = from + (i as f64 / total) * (to - from);
            let name = rel.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
            step(app, pct, &format!("Removing {name}"));
        }
    }

    prune_empty_dirs(dest, dest);
    if fs::remove_dir_all(dest).is_err() {
        schedule_self_delete(dest);
    }
}

fn collect_files(dir: &Path, base: &Path, out: &mut Vec<PathBuf>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            collect_files(&p, base, out);
        } else if let Ok(rel) = p.strip_prefix(base) {
            out.push(rel.to_path_buf());
        }
    }
}

#[cfg(feature = "payload")]
fn prune_stale(dest: &Path, shipped: &std::collections::BTreeSet<PathBuf>) {
    let me = std::env::current_exe().ok();
    let mut found = Vec::new();
    collect_files(dest, dest, &mut found);
    for rel in found {
        if shipped.contains(&rel) {
            continue;
        }
        if rel.as_os_str().eq_ignore_ascii_case(UNINST_EXE) {
            continue;
        }
        #[cfg(feature = "payload")]
        if rel.as_os_str().eq_ignore_ascii_case(MARKER) {
            continue;
        }
        let full = dest.join(&rel);
        if me.as_deref() == Some(full.as_path()) {
            continue;
        }
        let _ = fs::remove_file(&full);
    }
    prune_empty_dirs(dest, dest);
}

fn prune_empty_dirs(dir: &Path, base: &Path) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_dir() {
            prune_empty_dirs(&p, base);
        }
    }
    if dir != base {
        if let Ok(mut rd) = fs::read_dir(dir) {
            if rd.next().is_none() {
                let _ = fs::remove_dir(dir);
            }
        }
    }
}

#[cfg(feature = "payload")]
#[tauri::command]
pub async fn run_install(app: AppHandle, dest: String, desktop_shortcut: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || install_blocking(app, dest, desktop_shortcut))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(feature = "payload")]
fn install_blocking(app: AppHandle, dest: String, desktop_shortcut: bool) -> Result<(), String> {
    let dest = PathBuf::from(dest);
    install_core(&dest, desktop_shortcut, &mut |pct, step| emit(&app, pct, step))
}

#[cfg(feature = "payload")]
pub(crate) fn payload_version_number(version: &str) -> u64 {
    let mut parts = version.trim().split(['.', '-', '+']);
    let major: u64 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    let minor: u64 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    let patch: u64 = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    major * 1_000_000 + minor * 1_000 + patch
}

#[cfg(feature = "payload")]
pub(crate) fn read_marker_version(dest: &Path) -> u64 {
    fs::read_to_string(dest.join(MARKER))
        .ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .and_then(|v| v.get("payloadVersion").and_then(|n| n.as_u64()))
        .unwrap_or(0)
}

#[cfg(feature = "payload")]
fn write_install_marker(dest: &Path, version: &str) -> Result<(), String> {
    let installed_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let body = serde_json::json!({
        "payloadVersion": payload_version_number(version),
        "version": version,
        "installedAt": installed_at,
        "installer": "harbor-setup",
    });
    let text = serde_json::to_string_pretty(&body).map_err(|e| e.to_string())?;
    fs::write(dest.join(MARKER), text).map_err(|e| e.to_string())
}

#[cfg(feature = "payload")]
pub(crate) fn install_core(
    dest: &Path,
    desktop_shortcut: bool,
    progress: &mut dyn FnMut(f64, &str),
) -> Result<(), String> {
    let dest = dest.to_path_buf();
    progress(1.0, "Preparing");

    let replacing = dest.join(MAIN_EXE).exists();
    progress(3.0, if replacing { "Closing the running version" } else { "Preparing" });
    stop_harbor();

    fs::create_dir_all(&dest).map_err(|e| format!("cannot create {}: {e}", dest.display()))?;

    let mut archive = open_payload()?;

    let mut total: u64 = 0;
    for i in 0..archive.len() {
        total += archive.by_index(i).map_err(|e| e.to_string())?.size();
    }
    let total = total.max(1);
    let mut done: u64 = 0;

    progress(5.0, "Copying application files");
    let mut shipped: std::collections::BTreeSet<PathBuf> = std::collections::BTreeSet::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let raw = entry.name().to_string();
        let rel = match safe_rel(&raw) {
            Some(p) => p,
            None => continue,
        };
        let out = dest.join(&rel);
        if entry.is_dir() || raw.ends_with('/') || raw.ends_with('\\') {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut buf = Vec::with_capacity(entry.size() as usize);
        entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        fs::write(&out, &buf).map_err(|e| {
            format!("write {}: {e}. Close Harbor and any playback still running, then try again.", out.display())
        })?;
        shipped.insert(rel.clone());
        done += entry.size();
        let pct = 5.0 + (done as f64 / total as f64) * 80.0;
        let name = rel.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        progress(pct, &format!("Copying {name}"));
    }

    if replacing {
        progress(86.0, "Clearing files from the old version");
        prune_stale(&dest, &shipped);
    }

    progress(88.0, "Registering shortcuts");
    let exe = dest.join(MAIN_EXE);
    let mut lnks: Vec<PathBuf> = Vec::new();
    if let Some(lnk) = start_menu_lnk() {
        lnks.push(lnk);
    }
    if desktop_shortcut {
        if let Some(lnk) = desktop_lnk() {
            lnks.push(lnk);
        }
    }
    make_shortcuts(&lnks, &exe, &dest)?;

    if !dest.join(UNINST_EXE).exists() {
        progress(94.0, "Writing the uninstaller");
        if let Ok(me) = std::env::current_exe() {
            let _ = fs::copy(&me, dest.join(UNINST_EXE));
        }
    }
    progress(96.0, "Registering the uninstall entry");
    write_uninstall_entry(&dest, &shipped_version(), (total / 1024) as u32)?;

    progress(98.0, "Recording the install");
    write_install_marker(&dest, &shipped_version())?;

    progress(100.0, "Finished");
    Ok(())
}

#[cfg(feature = "payload")]
#[derive(Clone, Serialize)]
pub struct RepairReport {
    pub checked: u32,
    pub missing: u32,
    pub damaged: u32,
    pub restored_bytes: u64,
    pub shortcut_restored: bool,
    pub registry_restored: bool,
    pub stopped_harbor: bool,
}

#[cfg(feature = "payload")]
enum FileState {
    Intact,
    Missing,
    Damaged,
}

#[cfg(feature = "payload")]
fn crc32_of(path: &Path) -> Option<u32> {
    let mut file = fs::File::open(path).ok()?;
    let mut hasher = crc32fast::Hasher::new();
    let mut buf = vec![0u8; 256 * 1024];
    loop {
        let read = file.read(&mut buf).ok()?;
        if read == 0 {
            break;
        }
        hasher.update(&buf[..read]);
    }
    Some(hasher.finalize())
}

#[cfg(feature = "payload")]
fn file_state(path: &Path, size: u64, crc: u32) -> FileState {
    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return FileState::Missing,
    };
    if !meta.is_file() {
        return FileState::Missing;
    }
    if meta.len() != size {
        return FileState::Damaged;
    }
    match crc32_of(path) {
        Some(found) if found == crc => FileState::Intact,
        _ => FileState::Damaged,
    }
}

#[cfg(feature = "payload")]
#[tauri::command]
pub async fn run_repair(app: AppHandle, dest: String) -> Result<RepairReport, String> {
    tauri::async_runtime::spawn_blocking(move || repair_blocking(app, dest))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(feature = "payload")]
fn repair_blocking(app: AppHandle, dest: String) -> Result<RepairReport, String> {
    let dest = PathBuf::from(dest);
    if !dest.join(MAIN_EXE).exists() {
        return Err(format!("No Harbor install found in {}.", dest.display()));
    }

    let mut report = RepairReport {
        checked: 0,
        missing: 0,
        damaged: 0,
        restored_bytes: 0,
        shortcut_restored: false,
        registry_restored: false,
        stopped_harbor: false,
    };

    emit(&app, 1.0, "Checking the installed files");
    let mut archive = open_payload()?;

    let mut total: u64 = 0;
    for i in 0..archive.len() {
        total += archive.by_index(i).map_err(|e| e.to_string())?.size();
    }
    let total = total.max(1);
    let mut done: u64 = 0;

    for i in 0..archive.len() {
        let (rel, size, crc) = {
            let entry = archive.by_index(i).map_err(|e| e.to_string())?;
            let raw = entry.name().to_string();
            if entry.is_dir() || raw.ends_with('/') || raw.ends_with('\\') {
                continue;
            }
            match safe_rel(&raw) {
                Some(p) => (p, entry.size(), entry.crc32()),
                None => continue,
            }
        };

        let out = dest.join(&rel);
        let name = rel.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
        emit(&app, 2.0 + (done as f64 / total as f64) * 84.0, &format!("Checking {name}"));

        let state = file_state(&out, size, crc);
        report.checked += 1;
        done += size;

        match state {
            FileState::Intact => continue,
            FileState::Missing => report.missing += 1,
            FileState::Damaged => report.damaged += 1,
        }

        if !report.stopped_harbor {
            report.stopped_harbor = true;
            emit(&app, 2.0 + (done as f64 / total as f64) * 84.0, "Closing the running version");
            stop_harbor();
        }

        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let mut buf = Vec::with_capacity(size as usize);
        entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        fs::write(&out, &buf).map_err(|e| {
            format!("write {}: {e}. Close Harbor and any playback still running, then try again.", out.display())
        })?;
        report.restored_bytes += size;
        emit(&app, 2.0 + (done as f64 / total as f64) * 84.0, &format!("Restoring {name}"));
    }

    emit(&app, 88.0, "Checking shortcuts");
    if let Some(lnk) = start_menu_lnk() {
        if !lnk.exists() && make_shortcuts(&[lnk], &dest.join(MAIN_EXE), &dest).is_ok() {
            report.shortcut_restored = true;
        }
    }

    emit(&app, 94.0, "Checking the uninstall entry");
    let version = shipped_version();
    report.registry_restored = !uninstall_entry_intact(&dest, &version);
    write_uninstall_entry(&dest, &version, (total / 1024) as u32)?;
    write_install_marker(&dest, &version)?;

    emit(&app, 100.0, "Finished");
    Ok(report)
}

#[cfg(feature = "payload")]
#[tauri::command]
pub fn launch_harbor(dest: String) -> Result<(), String> {
    let exe = PathBuf::from(dest).join(MAIN_EXE);
    quiet(&exe).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(feature = "payload")]
const LICENSE_TEXT: &str = include_str!("../../ui/assets/LICENSE.txt");

#[cfg(feature = "payload")]
#[tauri::command]
pub fn save_license() -> Result<String, String> {
    let base = std::env::var("USERPROFILE")
        .map(|p| PathBuf::from(p).join("Downloads"))
        .unwrap_or_else(|_| std::env::temp_dir());
    let dir = if base.is_dir() { base } else { std::env::temp_dir() };
    let path = dir.join("Harbor-LICENSE.txt");
    fs::write(&path, LICENSE_TEXT.replace('\n', "\r\n")).map_err(|e| e.to_string())?;

    #[cfg(windows)]
    {
        let _ = quiet("explorer")
            .args(["/select,", &path.to_string_lossy()])
            .spawn();
    }

    Ok(path.to_string_lossy().to_string())
}

#[cfg(feature = "payload")]
#[derive(serde::Deserialize)]
pub struct PrintSection {
    pub heading: String,
    pub paragraphs: Vec<String>,
}

#[cfg(feature = "payload")]
#[derive(serde::Deserialize)]
pub struct PrintDoc {
    pub title: String,
    pub intro: String,
    pub sections: Vec<PrintSection>,
    pub rtl: bool,
}

#[cfg(feature = "payload")]
fn escape_html(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(ch),
        }
    }
    out
}

#[cfg(feature = "payload")]
#[tauri::command]
pub fn print_terms(doc: PrintDoc) -> Result<String, String> {
    let mut body = String::new();
    body.push_str(&format!("<h1>{}</h1>\n", escape_html(&doc.title)));
    body.push_str(&format!("<p class=\"intro\">{}</p>\n", escape_html(&doc.intro)));
    for (i, section) in doc.sections.iter().enumerate() {
        body.push_str(&format!("<h2>{}. {}</h2>\n", i + 1, escape_html(&section.heading)));
        for para in &section.paragraphs {
            body.push_str(&format!("<p>{}</p>\n", escape_html(para)));
        }
    }

    let dir = if doc.rtl { "rtl" } else { "ltr" };
    let html = format!(
        "<!doctype html><html dir=\"{dir}\"><head><meta charset=\"utf-8\">\
<title>{title}</title><style>\
body{{font:14px/1.65 Georgia,'Times New Roman',serif;color:#111;max-width:44em;margin:3em auto;padding:0 2em}}\
h1{{font-size:26px;font-weight:600;margin:0 0 1em}}\
h2{{font-size:15px;font-weight:700;margin:2em 0 .5em}}\
p{{margin:0 0 1em}}\
.intro{{color:#444;border-bottom:1px solid #ccc;padding-bottom:1.4em}}\
@media print{{body{{margin:0;max-width:none}}}}\
</style></head><body>{body}</body></html>",
        dir = dir,
        title = escape_html(&doc.title),
        body = body
    );

    let mut path = std::env::temp_dir();
    path.push("harbor-terms.html");
    fs::write(&path, html.as_bytes()).map_err(|e| e.to_string())?;

    #[cfg(windows)]
    {
        quiet("explorer").arg(&path).spawn().map_err(|e| e.to_string())?;
    }

    Ok(path.to_string_lossy().to_string())
}

#[cfg(feature = "payload")]
const CHANGELOG_URL: &str = "https://harbor.site/updates/versions-beta.json";

#[cfg(feature = "payload")]
#[tauri::command]
pub async fn fetch_changelog() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        ureq::get(CHANGELOG_URL)
            .timeout(std::time::Duration::from_secs(8))
            .call()
            .map_err(|e| e.to_string())?
            .into_string()
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(windows)]
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    let scheme_ok = url.starts_with("https://") || url.starts_with("mailto:");
    let chars_ok = url
        .bytes()
        .all(|b| b > 0x20 && b < 0x7f && b != 0x22 && b != 0x27 && b != 0x60);
    if !scheme_ok || !chars_ok || url.len() > 300 {
        return Err("blocked".into());
    }
    quiet("explorer").arg(&url).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn open_external(_url: String) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
#[tauri::command]
pub async fn run_uninstall(app: AppHandle, dest: String, remove_data: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || uninstall_blocking(app, dest, remove_data))
        .await
        .map_err(|e| e.to_string())?
}

fn uninstall_blocking(app: AppHandle, dest: String, remove_data: bool) -> Result<(), String> {
    let dest = PathBuf::from(dest);

    step(&app, 4.0, "Closing Harbor");
    stop_harbor();

    step(&app, 22.0, "Removing shortcuts");
    remove_shortcuts();

    step(&app, 34.0, "Removing the registry entry");
    remove_registry();

    step(&app, 44.0, "Removing application files");
    remove_tree(&app, &dest, 44.0, if remove_data { 76.0 } else { 96.0 });

    if remove_data {
        step(&app, 78.0, "Removing your data");
        for dir in data_dirs() {
            let _ = fs::remove_dir_all(&dir);
        }
    }

    step(&app, 100.0, "Done");
    Ok(())
}

#[cfg(windows)]
pub fn uninstall_at(dest: &Path) {
    use winreg::enums::*;
    use winreg::RegKey;
    stop_harbor();
    if let Some(lnk) = start_menu_lnk() {
        let _ = fs::remove_file(lnk);
    }
    if let Some(lnk) = desktop_lnk() {
        let _ = fs::remove_file(lnk);
    }
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let _ = hkcu.delete_subkey_all(UNINST_KEY);

    let me = std::env::current_exe().ok();
    let mut found = Vec::new();
    collect_files(dest, dest, &mut found);
    for rel in found {
        let full = dest.join(&rel);
        if me.as_deref() == Some(full.as_path()) {
            continue;
        }
        let _ = fs::remove_file(&full);
    }
    prune_empty_dirs(dest, dest);

    if fs::remove_dir_all(dest).is_err() {
        schedule_self_delete(dest);
    }
}

#[cfg(windows)]
fn schedule_self_delete(dest: &Path) {
    let me = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return,
    };
    let script = format!(
        "ping 127.0.0.1 -n 4 >nul & del /f /q \"{}\" & rmdir /s /q \"{}\"",
        me.display(),
        dest.display()
    );
    let _ = quiet("cmd").args(["/C", &script]).spawn();
}

#[cfg(not(windows))]
#[tauri::command]
pub fn run_uninstall(_dest: String, _remove_data: bool) -> Result<(), String> {
    Ok(())
}
