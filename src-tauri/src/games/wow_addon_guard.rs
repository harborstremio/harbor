//! Resolve the native installation again at the point of mutation. Holding the
//! client executable excludes a new read/write/delete open during deployment.
use super::{p2p_files, save_files, wow_addon_package::Result, wow_addons};
use std::{
    fs,
    path::{Path, PathBuf},
    time::SystemTime,
};

pub struct Guard {
    pub root: PathBuf,
    pub version: String,
    _executable: fs::File,
}

#[derive(Debug, PartialEq, Eq)]
struct Stamp {
    bytes: u64,
    modified: SystemTime,
    created: SystemTime,
}
fn stamp(metadata: &fs::Metadata) -> Result<Stamp> {
    if !metadata.is_file() || save_files::reparse(metadata) {
        return Err("wow_addons_linked");
    }
    Ok(Stamp {
        bytes: metadata.len(),
        modified: metadata.modified().map_err(|_| "wow_addons_read")?,
        created: metadata.created().map_err(|_| "wow_addons_read")?,
    })
}

fn executable_name(id: &str) -> Result<&'static str> {
    match id {
        "battlenet:wow" => Ok("Wow.exe"),
        "battlenet:wow_classic"
        | "battlenet:wow_classic_era"
        | "battlenet:wow_classic_anniversary" => Ok("WowClassic.exe"),
        _ => Err("wow_addons_edition"),
    }
}
#[cfg(windows)]
fn wow_process(name: &str) -> bool {
    [
        "wow.exe",
        "wowclassic.exe",
        "wow-64.exe",
        "wowclassic-64.exe",
        "wowt.exe",
        "wowclassict.exe",
    ]
    .contains(&name.to_ascii_lowercase().as_str())
}

#[cfg(windows)]
pub fn idle() -> Result<()> {
    use windows::{
        core::HRESULT,
        Win32::{
            Foundation::{CloseHandle, ERROR_NO_MORE_FILES, HANDLE},
            System::Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                TH32CS_SNAPPROCESS,
            },
        },
    };
    struct Snapshot(HANDLE);
    impl Drop for Snapshot {
        fn drop(&mut self) {
            unsafe {
                let _ = CloseHandle(self.0);
            }
        }
    }
    let snapshot = Snapshot(
        unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }
            .map_err(|_| "wow_addons_process")?,
    );
    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    let mut result = unsafe { Process32FirstW(snapshot.0, &mut entry) };
    loop {
        match result {
            Ok(()) => {}
            Err(error) if error.code() == HRESULT::from_win32(ERROR_NO_MORE_FILES.0) => {
                return Ok(())
            }
            Err(_) => return Err("wow_addons_process"),
        }
        let end = entry
            .szExeFile
            .iter()
            .position(|ch| *ch == 0)
            .unwrap_or(entry.szExeFile.len());
        if wow_process(&String::from_utf16_lossy(&entry.szExeFile[..end])) {
            return Err("wow_addons_running");
        }
        result = unsafe { Process32NextW(snapshot.0, &mut entry) };
    }
}
#[cfg(not(windows))]
pub fn idle() -> Result<()> {
    Err("wow_addons_platform")
}

#[cfg(windows)]
fn hold(path: &Path, expected: &Stamp) -> Result<fs::File> {
    use std::os::windows::fs::OpenOptionsExt;
    p2p_files::plain_dir(path.parent().ok_or("wow_addons_read")?)
        .map_err(|_| "wow_addons_linked")?;
    let file = fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .custom_flags(0x00200000) // FILE_FLAG_OPEN_REPARSE_POINT
        .open(path)
        .map_err(|error| {
            if error.raw_os_error() == Some(32) {
                "wow_addons_game_busy"
            } else {
                "wow_addons_read"
            }
        })?;
    if &stamp(&file.metadata().map_err(|_| "wow_addons_read")?)? != expected {
        return Err("wow_addons_changed");
    }
    Ok(file)
}
#[cfg(not(windows))]
fn hold(_path: &Path, _expected: &Stamp) -> Result<fs::File> {
    Err("wow_addons_platform")
}

impl Guard {
    pub fn acquire(id: &str) -> Result<Self> {
        idle()?;
        let (root, version) = wow_addons::target(id)?;
        let binary = root.join(executable_name(id)?);
        let before = stamp(&fs::symlink_metadata(&binary).map_err(|_| "wow_addons_read")?)?;
        // Version-resource inspection opens the binary. Resolve it before taking
        // the exclusive handle, then reject a concurrent replacement/update.
        let (checked, checked_version) = wow_addons::target(id)?;
        if checked != root || checked_version != version {
            return Err("wow_addons_changed");
        }
        let executable = hold(&binary, &before)?;
        idle()?;
        Ok(Self {
            root,
            version,
            _executable: executable,
        })
    }
    pub fn matches(&self, root: &Path, version: &str) -> Result<()> {
        if self.root != root || self.version != version {
            return Err("wow_addons_changed");
        }
        if p2p_files::plain_dir(root).map_err(|_| "wow_addons_linked")? != self.root {
            return Err("wow_addons_changed");
        }
        Ok(())
    }
}

#[cfg(all(test, windows))]
#[path = "wow_addon_guard_tests.rs"]
mod tests;
