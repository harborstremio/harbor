//! Check for a running Stardew/SMAPI process, then hold its binaries against
//! writes/deletion and new opens during a short native transaction.
#[cfg(windows)]
use super::stardew_install_files as files;
use super::stardew_manifest::Result;
#[cfg(windows)]
use std::path::Path;
use std::{fs, path::PathBuf};
pub struct Guard {
    pub root: PathBuf,
    pub game_version: Option<String>,
    pub smapi_version: Option<String>,
    _files: Vec<fs::File>,
}
#[cfg(windows)]
fn idle() -> Result<()> {
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
            .map_err(|_| "stardew_process")?,
    );
    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    let mut result = unsafe { Process32FirstW(snapshot.0, &mut entry) };
    loop {
        match result {
            Ok(()) => {}
            Err(e) if e.code() == HRESULT::from_win32(ERROR_NO_MORE_FILES.0) => return Ok(()),
            Err(_) => return Err("stardew_process"),
        };
        let len = entry
            .szExeFile
            .iter()
            .position(|c| *c == 0)
            .unwrap_or(entry.szExeFile.len());
        let name = String::from_utf16_lossy(&entry.szExeFile[..len]).to_ascii_lowercase();
        if [
            "stardew valley.exe",
            "stardewvalley.exe",
            "stardewmoddingapi.exe",
        ]
        .contains(&name.as_str())
        {
            return Err("stardew_running");
        };
        result = unsafe { Process32NextW(snapshot.0, &mut entry) };
    }
}
impl Guard {
    #[cfg(windows)]
    pub fn acquire(path: &str) -> Result<Self> {
        use std::os::windows::fs::OpenOptionsExt;
        idle()?;
        if !Path::new(path).is_absolute() {
            return Err("stardew_folder");
        };
        let root = files::directory(Path::new(path))?;
        let mut held = Vec::new();
        let mut game = false;
        let mut game_version = None;
        let mut smapi_version = None;
        for name in [
            "Stardew Valley.dll",
            "Stardew Valley.exe",
            "StardewValley.exe",
            "StardewModdingAPI.dll",
            "StardewModdingAPI.exe",
        ] {
            let file = root.join(name);
            if !files::exists(&file)? {
                continue;
            };
            let before = files::regular(&file)?;
            let version = super::stardew::version(&file);
            let f = fs::OpenOptions::new()
                .read(true)
                .share_mode(0)
                .custom_flags(0x00200000)
                .open(&file)
                .map_err(|_| "stardew_running")?;
            let after = f.metadata().map_err(|_| "stardew_read")?;
            if super::save_files::reparse(&after)
                || before.len() != after.len()
                || before.modified().ok() != after.modified().ok()
            {
                return Err("stardew_changed");
            };
            if name == "Stardew Valley.exe" || name == "StardewValley.exe" {
                game = true
            };
            if name.starts_with("StardewModdingAPI") {
                if smapi_version.is_none() {
                    smapi_version = version
                }
            } else if game_version.is_none() {
                game_version = version
            }
            held.push(f);
        }
        if !game {
            return Err("stardew_folder");
        };
        idle()?;
        Ok(Self {
            root,
            game_version,
            smapi_version,
            _files: held,
        })
    }
    #[cfg(not(windows))]
    pub fn acquire(_: &str) -> Result<Self> {
        Err("stardew_platform")
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::{
        process::{Command, Stdio},
        thread,
        time::Duration,
    };
    #[test]
    #[ignore]
    fn hold_worker() {
        loop {
            thread::sleep(Duration::from_millis(50));
        }
    }
    #[test]
    fn a_real_matching_process_and_exclusive_binary_lock_block_mutation() {
        let base = std::env::var_os("HARBOR_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!("harbor-stardew-guard-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        fs::copy(
            std::env::current_exe().unwrap(),
            root.join("StardewModdingAPI.exe"),
        )
        .unwrap();
        fs::write(root.join("Stardew Valley.exe"), b"fixture").unwrap();
        let guard = Guard::acquire(root.to_str().unwrap()).unwrap();
        assert!(fs::OpenOptions::new()
            .write(true)
            .open(root.join("Stardew Valley.exe"))
            .is_err());
        drop(guard);
        let mut child = Command::new(root.join("StardewModdingAPI.exe"))
            .args(["stardew_guard::tests::hold_worker", "--ignored", "--exact"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        thread::sleep(Duration::from_millis(100));
        assert!(child.try_wait().unwrap().is_none());
        assert_eq!(
            Guard::acquire(root.to_str().unwrap()).err(),
            Some("stardew_running")
        );
        child.kill().unwrap();
        child.wait().unwrap();
        assert!(Guard::acquire(root.to_str().unwrap()).is_ok());
        fs::remove_dir_all(root).unwrap();
    }
}
