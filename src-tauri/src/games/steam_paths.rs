use std::path::PathBuf;

/// Read Steam's own install location before trying platform defaults.
pub fn find_root() -> Option<PathBuf> {
    candidates()
        .into_iter()
        .find(|path| path.join("steamapps").is_dir())
}

fn candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Registry::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
        for (hive, key, value) in [
            (HKEY_CURRENT_USER, "Software\\Valve\\Steam", "SteamPath"),
            (HKEY_LOCAL_MACHINE, "Software\\Valve\\Steam", "InstallPath"),
            (
                HKEY_LOCAL_MACHINE,
                "Software\\WOW6432Node\\Valve\\Steam",
                "InstallPath",
            ),
        ] {
            if let Some(path) = registry_path(hive, key, value) {
                paths.push(path);
            }
        }
        for key in ["ProgramFiles(x86)", "ProgramFiles"] {
            if let Some(path) = std::env::var_os(key) {
                paths.push(PathBuf::from(path).join("Steam"));
            }
        }
    }
    #[cfg(target_os = "linux")]
    if let Some(home) = std::env::var_os("HOME") {
        let home = PathBuf::from(home);
        for path in [
            ".local/share/Steam",
            ".steam/steam",
            ".var/app/com.valvesoftware.Steam/.local/share/Steam",
        ] {
            paths.push(home.join(path));
        }
    }
    #[cfg(target_os = "macos")]
    if let Some(home) = std::env::var_os("HOME") {
        paths.push(PathBuf::from(home).join("Library/Application Support/Steam"));
    }
    paths
}

#[cfg(target_os = "windows")]
fn registry_path(
    hive: windows::Win32::System::Registry::HKEY,
    key: &str,
    value: &str,
) -> Option<PathBuf> {
    use windows::core::PCWSTR;
    use windows::Win32::System::Registry::{RegGetValueW, RRF_RT_REG_SZ};
    let key: Vec<u16> = key.encode_utf16().chain(Some(0)).collect();
    let value: Vec<u16> = value.encode_utf16().chain(Some(0)).collect();
    let mut bytes = 0u32;
    // RRF_RT_REG_SZ rejects unrelated value types. Cap allocation before the second read.
    unsafe {
        RegGetValueW(
            hive,
            PCWSTR(key.as_ptr()),
            PCWSTR(value.as_ptr()),
            RRF_RT_REG_SZ,
            None,
            None,
            Some(&mut bytes),
        )
        .ok()
        .ok()?;
        if bytes < 2 || bytes > 65_536 {
            return None;
        }
        let mut buffer = vec![0u16; (bytes as usize + 1) / 2];
        RegGetValueW(
            hive,
            PCWSTR(key.as_ptr()),
            PCWSTR(value.as_ptr()),
            RRF_RT_REG_SZ,
            None,
            Some(buffer.as_mut_ptr().cast()),
            Some(&mut bytes),
        )
        .ok()
        .ok()?;
        let end = buffer
            .iter()
            .position(|value| *value == 0)
            .unwrap_or(buffer.len());
        let path = PathBuf::from(String::from_utf16(&buffer[..end]).ok()?);
        path.is_absolute().then_some(path)
    }
}
