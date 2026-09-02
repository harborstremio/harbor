use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use crate::install;

const WAIT_LIMIT: Duration = Duration::from_secs(45);

#[derive(Default)]
struct Args {
    update: bool,
    passive: bool,
    relaunch: bool,
    target_dir: Option<PathBuf>,
    wait_pid: Option<u32>,
    from_version: Option<String>,
    to_version: Option<String>,
    log: Option<PathBuf>,
}

fn parse() -> Args {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let mut args = Args::default();
    let mut i = 0;
    while i < argv.len() {
        let value = |i: usize| argv.get(i + 1).cloned();
        match argv[i].as_str() {
            "--update" => args.update = true,
            "--passive" => args.passive = true,
            "--relaunch" => args.relaunch = true,
            "--target-dir" => {
                args.target_dir = value(i).map(PathBuf::from);
                i += 1;
            }
            "--wait-pid" => {
                args.wait_pid = value(i).and_then(|v| v.parse().ok());
                i += 1;
            }
            "--from-version" => {
                args.from_version = value(i);
                i += 1;
            }
            "--to-version" => {
                args.to_version = value(i);
                i += 1;
            }
            "--log" => {
                args.log = value(i).map(PathBuf::from);
                i += 1;
            }
            _ => {}
        }
        i += 1;
    }
    args
}

struct Log {
    file: Option<File>,
    start: Instant,
}

impl Log {
    fn open(path: Option<&Path>) -> Self {
        let file = path.and_then(|p| {
            if let Some(parent) = p.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            OpenOptions::new().create(true).append(true).open(p).ok()
        });
        Log {
            file,
            start: Instant::now(),
        }
    }

    fn line(&mut self, message: &str) {
        if let Some(file) = self.file.as_mut() {
            let _ = writeln!(file, "[{:>7.2}s] {}", self.start.elapsed().as_secs_f64(), message);
            let _ = file.flush();
        }
    }
}

#[cfg(windows)]
fn wait_for_exit(pid: u32, limit: Duration) -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, WAIT_OBJECT_0};
    use windows_sys::Win32::Storage::FileSystem::SYNCHRONIZE;
    use windows_sys::Win32::System::Threading::{OpenProcess, WaitForSingleObject};
    unsafe {
        let handle = OpenProcess(SYNCHRONIZE, 0, pid);
        if handle.is_null() {
            return true;
        }
        let ms = limit.as_millis().min(u32::MAX as u128) as u32;
        let outcome = WaitForSingleObject(handle, ms);
        CloseHandle(handle);
        outcome == WAIT_OBJECT_0
    }
}

#[cfg(not(windows))]
fn wait_for_exit(_pid: u32, _limit: Duration) -> bool {
    true
}

fn resolve_dest(requested: Option<&Path>) -> PathBuf {
    if let Some(dir) = requested {
        if !dir.as_os_str().is_empty() {
            return dir.to_path_buf();
        }
    }
    if let Some(found) = install::scan_uninstall_roots() {
        let from_registry = PathBuf::from(&found.path);
        if from_registry.join(install::MAIN_EXE).exists() {
            return from_registry;
        }
    }
    PathBuf::from(install::default_install_dir())
}

fn desktop_shortcut_present() -> bool {
    install::desktop_lnk().map(|lnk| lnk.exists()).unwrap_or(false)
}

#[cfg(windows)]
fn relaunch(dest: &Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const DETACHED_PROCESS: u32 = 0x0000_0008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
    std::process::Command::new(dest.join(install::MAIN_EXE))
        .current_dir(dest)
        .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(not(windows))]
fn relaunch(_dest: &Path) -> Result<(), String> {
    Err("relaunch is Windows only".to_string())
}

pub fn maybe_run() -> Option<i32> {
    let args = parse();
    if !args.update {
        return None;
    }
    Some(run(args))
}

fn run(args: Args) -> i32 {
    let mut log = Log::open(args.log.as_deref());
    let shipped = install::shipped_version();
    log.line(&format!(
        "harbor-setup {} update mode ({}) from {} to {}",
        shipped,
        if args.passive { "passive" } else { "interactive" },
        args.from_version.as_deref().unwrap_or("?"),
        args.to_version.as_deref().unwrap_or("?"),
    ));

    let dest = resolve_dest(args.target_dir.as_deref());
    let from_marker = install::read_marker_version(&dest);
    log.line(&format!("target {} (marker {})", dest.display(), from_marker));

    if !dest.join(install::MAIN_EXE).exists() {
        log.line("no harbor.exe at the target; refusing to write there");
        return 1;
    }

    if let Some(pid) = args.wait_pid {
        log.line(&format!("waiting up to {}s for pid {}", WAIT_LIMIT.as_secs(), pid));
        if wait_for_exit(pid, WAIT_LIMIT) {
            log.line("harbor exited");
        } else {
            log.line("harbor is still running; closing it");
        }
    }
    install::stop_harbor();

    let desktop = desktop_shortcut_present();
    let mut bucket = -1i64;
    let outcome = install::install_core(&dest, desktop, &mut |pct, step| {
        let next = (pct / 10.0) as i64;
        if next != bucket {
            bucket = next;
            log.line(&format!("{:>3.0}% {}", pct, step));
        }
    });

    if let Err(reason) = outcome {
        log.line(&format!("FAILED {}", reason));
        return 1;
    }
    log.line(&format!(
        "installed {} (marker {})",
        shipped,
        install::read_marker_version(&dest)
    ));

    if args.relaunch {
        match relaunch(&dest) {
            Ok(()) => log.line("relaunched harbor"),
            Err(reason) => log.line(&format!("relaunch failed: {}", reason)),
        }
    }
    log.line("done");
    0
}
