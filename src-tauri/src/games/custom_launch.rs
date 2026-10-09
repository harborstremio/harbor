use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Mutex, OnceLock},
    time::{Instant, SystemTime, UNIX_EPOCH},
};

type Result<T> = std::result::Result<T, &'static str>;
#[cfg(windows)]
#[path = "custom_launch_windows.rs"]
mod windows_launch;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchConfig {
    pub executable: String,
    pub working_directory: Option<String>,
    pub arguments: Vec<String>,
    pub mode: String,
    pub runner: Option<String>,
    pub prefix: Option<String>,
    pub steam_directory: Option<String>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomProcess {
    pub profile: String,
    pub id: String,
    pub session_id: String,
    pub path: String,
    pub pid: u32,
    pub started_at: u64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomExit {
    pub profile: String,
    pub id: String,
    pub session_id: String,
    pub pid: u32,
    pub seconds: u64,
    pub started_at: u64,
    pub success: bool,
    pub code: Option<i32>,
    pub ended_at: u64,
}
fn exits() -> &'static Mutex<Vec<CustomExit>> {
    static VALUE: OnceLock<Mutex<Vec<CustomExit>>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(Vec::new()))
}
pub fn history(profile: String) -> Vec<CustomExit> {
    exits()
        .lock()
        .map(|records| {
            records
                .iter()
                .filter(|r| r.profile == profile)
                .cloned()
                .collect()
        })
        .unwrap_or_default()
}
pub fn artwork(value: String) -> Result<String> {
    use std::io::Read;
    let p = path(&value)?;
    let meta = fs::metadata(&p).map_err(|_| "launch_artwork")?;
    if !meta.is_file() || meta.len() > 20 * 1024 * 1024 {
        return Err("launch_artwork");
    }
    let mut bytes = [0u8; 16];
    let count = fs::File::open(&p)
        .and_then(|mut f| f.read(&mut bytes))
        .map_err(|_| "launch_artwork")?;
    let bytes = &bytes[..count];
    if !(bytes.starts_with(b"\x89PNG\r\n\x1a\n")
        || bytes.starts_with(b"\xff\xd8\xff")
        || bytes.starts_with(b"GIF87a")
        || bytes.starts_with(b"GIF89a")
        || (bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP")))
    {
        return Err("launch_artwork");
    }
    Ok(p.to_string_lossy().into_owned())
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn processes() -> &'static Mutex<HashMap<String, Option<CustomProcess>>> {
    static VALUE: OnceLock<Mutex<HashMap<String, Option<CustomProcess>>>> = OnceLock::new();
    VALUE.get_or_init(|| Mutex::new(HashMap::new()))
}
// Reserve the executable without holding the registry lock across a Windows approval prompt.
struct Reservation {
    key: String,
    pending: bool,
}
impl Reservation {
    fn new(key: String) -> Result<Self> {
        let mut registry = processes().lock().map_err(|_| "launch_busy")?;
        if registry.contains_key(&key) {
            return Err("launch_running");
        }
        registry.insert(key.clone(), None);
        Ok(Self { key, pending: true })
    }
    fn started(&mut self, record: CustomProcess) -> Result<()> {
        processes()
            .lock()
            .map_err(|_| "launch_busy")?
            .insert(self.key.clone(), Some(record));
        self.pending = false;
        Ok(())
    }
}
impl Drop for Reservation {
    fn drop(&mut self) {
        if self.pending {
            if let Ok(mut registry) = processes().lock() {
                registry.remove(&self.key);
            }
        }
    }
}
fn path(value: &str) -> Result<PathBuf> {
    if value.is_empty()
        || value.len() > 8192
        || value.contains('\0')
        || !Path::new(value).is_absolute()
    {
        return Err("launch_path");
    }
    Path::new(value)
        .canonicalize()
        .map_err(|_| "launch_missing")
}
fn directory(value: &str) -> Result<PathBuf> {
    let p = path(value)?;
    if !p.is_dir() {
        return Err("launch_directory");
    }
    Ok(p)
}
fn executable(value: &str, windows_game: bool) -> Result<PathBuf> {
    let p = path(value)?;
    #[cfg(target_os = "macos")]
    if !windows_game && p.is_dir() && p.extension().is_some_and(|s| s.eq_ignore_ascii_case("app")) {
        super::native_package::bundle_executable(&p)?;
        return Ok(p);
    }
    let meta = fs::metadata(&p).map_err(|_| "launch_missing")?;
    if !meta.is_file() || meta.len() == 0 {
        return Err("launch_executable");
    }
    if !windows_game {
        use std::io::Read;
        let mut header = [0; 4];
        let count = fs::File::open(&p)
            .and_then(|mut file| file.read(&mut header))
            .map_err(|_| "launch_executable")?;
        if super::native_package::foreign_binary(&header[..count], std::env::consts::OS) {
            return Err("launch_platform");
        }
    }
    if windows_game || cfg!(windows) {
        if !p.extension().is_some_and(|s| s.eq_ignore_ascii_case("exe")) {
            return Err("launch_executable");
        }
    } else {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if meta.permissions().mode() & 0o111 == 0 {
                return Err("launch_permission");
            }
        }
    }
    Ok(p)
}
pub fn validate(mut config: LaunchConfig) -> Result<LaunchConfig> {
    if !["native", "wine", "proton"].contains(&config.mode.as_str()) {
        return Err("launch_mode");
    }
    if config.arguments.len() > 128
        || config
            .arguments
            .iter()
            .any(|s| s.len() > 2048 || s.contains('\0'))
        || config.arguments.iter().map(String::len).sum::<usize>() > 16384
    {
        return Err("launch_arguments");
    }
    if config.mode != "native" && !cfg!(target_os = "linux") {
        return Err("launch_platform");
    }
    let game = executable(&config.executable, config.mode != "native")?;
    let working = match config
        .working_directory
        .as_deref()
        .filter(|p| !p.is_empty())
    {
        Some(value) => directory(value)?,
        None => game.parent().ok_or("launch_directory")?.to_path_buf(),
    };
    config.executable = game.to_string_lossy().into_owned();
    config.working_directory = Some(working.to_string_lossy().into_owned());
    if config.mode != "native" {
        let runner = executable(config.runner.as_deref().ok_or("launch_runner")?, false)?;
        let prefix = directory(config.prefix.as_deref().ok_or("launch_prefix")?)?;
        if prefix.parent().is_none() || prefix.file_name().is_none() {
            return Err("launch_prefix");
        }
        config.runner = Some(runner.to_string_lossy().into_owned());
        config.prefix = Some(prefix.to_string_lossy().into_owned());
        if config.mode == "proton" {
            let steam = match config.steam_directory.as_deref().filter(|p| !p.is_empty()) {
                Some(value) => directory(value)?,
                None => super::steam_paths::find_root().ok_or("launch_steam")?,
            };
            if !steam.join("steamapps").is_dir() {
                return Err("launch_steam");
            }
            config.steam_directory = Some(steam.to_string_lossy().into_owned());
        } else {
            config.steam_directory = None;
        }
    } else {
        config.runner = None;
        config.prefix = None;
        config.steam_directory = None;
    }
    Ok(config)
}
// The arguments are individual values throughout. No shell command is assembled or evaluated.
fn command(config: &LaunchConfig) -> Command {
    let mut result = Command::new(if config.mode == "native" {
        &config.executable
    } else {
        config.runner.as_deref().unwrap_or("")
    });
    if config.mode == "wine" {
        result
            .env("WINEPREFIX", config.prefix.as_deref().unwrap_or(""))
            .arg(&config.executable);
    }
    if config.mode == "proton" {
        result
            .env(
                "STEAM_COMPAT_DATA_PATH",
                config.prefix.as_deref().unwrap_or(""),
            )
            .env(
                "STEAM_COMPAT_CLIENT_INSTALL_PATH",
                config.steam_directory.as_deref().unwrap_or(""),
            )
            .arg("run")
            .arg(&config.executable);
    }
    #[cfg(target_os = "macos")]
    if config.mode == "native" && Path::new(&config.executable).is_dir() {
        result = Command::new("/usr/bin/open");
        result.args(["-W", "-a", &config.executable, "--args"]);
    }
    result
        .args(&config.arguments)
        .current_dir(config.working_directory.as_deref().unwrap_or("."))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        result.creation_flags(0x08000000);
    }
    result
}
fn identity(profile: &str, id: &str) -> Result<()> {
    if profile.is_empty()
        || profile.len() > 160
        || profile.chars().any(char::is_control)
        || uuid::Uuid::parse_str(id).is_err()
    {
        return Err("launch_record");
    }
    Ok(())
}
enum Process {
    Direct(std::process::Child),
    #[cfg(windows)]
    Elevated(windows_launch::Process),
}
impl Process {
    fn id(&self) -> u32 {
        match self {
            Self::Direct(child) => child.id(),
            #[cfg(windows)]
            Self::Elevated(child) => child.id(),
        }
    }
    fn wait(&mut self) -> std::io::Result<std::process::ExitStatus> {
        match self {
            Self::Direct(child) => child.wait(),
            #[cfg(windows)]
            Self::Elevated(child) => child.wait(),
        }
    }
}
fn start(config: &LaunchConfig) -> Result<Process> {
    match command(config).spawn() {
        Ok(child) => Ok(Process::Direct(child)),
        #[cfg(windows)]
        Err(error) if config.mode == "native" && error.raw_os_error() == Some(740) => {
            windows_launch::launch(config).map(Process::Elevated)
        }
        Err(_) => Err("launch_failed"),
    }
}
pub fn running(profile: String) -> Vec<CustomProcess> {
    processes()
        .lock()
        .map(|m| {
            m.values()
                .filter_map(Option::as_ref)
                .filter(|p| p.profile == profile)
                .cloned()
                .collect()
        })
        .unwrap_or_default()
}
pub fn launch(
    profile: String,
    id: String,
    config: LaunchConfig,
    finished: impl FnOnce(CustomExit) + Send + 'static,
) -> Result<CustomProcess> {
    identity(&profile, &id)?;
    let config = validate(config)?;
    let key = if cfg!(windows) {
        config.executable.to_lowercase()
    } else {
        config.executable.clone()
    };
    let mut reservation = Reservation::new(key.clone())?;
    let mut child = start(&config)?;
    let record = CustomProcess {
        profile: profile.clone(),
        id: id.clone(),
        session_id: uuid::Uuid::new_v4().to_string(),
        path: config.executable,
        pid: child.id(),
        started_at: now(),
    };
    reservation.started(record.clone())?;
    let session_id = record.session_id.clone();
    let pid = record.pid;
    let started_at = record.started_at;
    std::thread::spawn(move || {
        let start = Instant::now();
        let status = child.wait();
        if let Ok(mut map) = processes().lock() {
            map.remove(&key);
        }
        let event = CustomExit {
            profile,
            id,
            session_id,
            pid,
            seconds: start.elapsed().as_secs(),
            started_at,
            success: status.as_ref().is_ok_and(|s| s.success()),
            code: status.ok().and_then(|s| s.code()),
            ended_at: now(),
        };
        if let Ok(mut records) = exits().lock() {
            records.push(event.clone());
            if records.len() > 1000 {
                records.remove(0);
            }
        }
        finished(event);
    });
    Ok(record)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pending_launch_does_not_lock_status_and_cancellation_releases_only_its_reservation() {
        let key = uuid::Uuid::new_v4().to_string();
        let first = Reservation::new(key.clone()).unwrap();
        assert!(matches!(
            Reservation::new(key.clone()),
            Err("launch_running")
        ));
        assert!(running("reservation-check".into()).is_empty());
        drop(first);
        let mut second = Reservation::new(key.clone()).unwrap();
        second
            .started(CustomProcess {
                profile: "reservation-check".into(),
                id: uuid::Uuid::new_v4().to_string(),
                session_id: uuid::Uuid::new_v4().to_string(),
                path: key.clone(),
                pid: 1,
                started_at: 0,
            })
            .unwrap();
        assert_eq!(running("reservation-check".into()).len(), 1);
        // A fast exit followed by a new launch cannot be removed by the older guard.
        processes().lock().unwrap().remove(&key);
        let third = Reservation::new(key.clone()).unwrap();
        drop(second);
        assert!(matches!(
            Reservation::new(key.clone()),
            Err("launch_running")
        ));
        drop(third);
        assert!(!processes().lock().unwrap().contains_key(&key));
    }
    fn config() -> LaunchConfig {
        LaunchConfig {
            executable: "/games/雨 & dusk/game.exe".into(),
            working_directory: Some("/games/雨 & dusk".into()),
            arguments: vec![
                "--player".into(),
                "Rain & Dusk".into(),
                "$(literal); quoted \"value\"".into(),
            ],
            mode: "native".into(),
            runner: None,
            prefix: None,
            steam_directory: None,
        }
    }
    #[test]
    fn arguments_stay_separate_and_compatibility_environments_do_not_leak() {
        let native = config();
        let cmd = command(&native);
        assert_eq!(
            cmd.get_args()
                .map(|s| s.to_string_lossy().into_owned())
                .collect::<Vec<_>>(),
            native.arguments
        );
        assert_eq!(cmd.get_current_dir(), Some(Path::new("/games/雨 & dusk")));
        assert_eq!(cmd.get_envs().count(), 0);
        let mut wine = native.clone();
        wine.mode = "wine".into();
        wine.runner = Some("/usr/bin/wine".into());
        wine.prefix = Some("/saves/game-one".into());
        let cmd = command(&wine);
        assert_eq!(cmd.get_args().next().unwrap(), native.executable.as_str());
        assert_eq!(cmd.get_envs().count(), 1);
        wine.mode = "proton".into();
        wine.runner = Some("/compat/proton".into());
        wine.steam_directory = Some("/steam".into());
        let cmd = command(&wine);
        assert_eq!(
            cmd.get_args()
                .take(2)
                .map(|s| s.to_str().unwrap())
                .collect::<Vec<_>>(),
            ["run", native.executable.as_str()]
        );
        assert_eq!(cmd.get_envs().count(), 2);
        assert_eq!(command(&native).get_envs().count(), 0);
    }
    #[test]
    fn invalid_settings_never_spawn() {
        let mut c = config();
        c.arguments = vec!["x".repeat(2049)];
        assert!(matches!(validate(c), Err("launch_arguments")));
        let mut c = config();
        c.mode = "shell".into();
        assert!(matches!(validate(c), Err("launch_mode")));
        assert!(identity("p", "../other").is_err());
        assert!(path("relative.exe").is_err());
        assert!(path("/game\0.exe").is_err());
    }
}
