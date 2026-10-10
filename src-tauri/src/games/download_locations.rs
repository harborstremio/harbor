use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Location {
    path: String,
    label: String,
    available_bytes: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Locations {
    drives: Vec<Location>,
    selected: Option<Location>,
}

fn location(path: &Path, label: String) -> Option<Location> {
    if !path.is_absolute() || !path.is_dir() { return None; }
    Some(Location {
        path: path.to_string_lossy().into_owned(),
        label,
        available_bytes: super::transfer_files::free_bytes(path),
    })
}

/// Read-only. Enumeration excludes network shares; an explicitly chosen folder can
/// still be probed. No directories are created until the download is confirmed.
pub fn inspect(parent: Option<String>) -> Locations {
    let selected = parent.filter(|p| p.len() <= 4096).and_then(|p| {
        location(Path::new(&p), p.clone())
    });
    let mut drives = mounted().into_iter().filter_map(|(path, label)| location(&path, label)).collect::<Vec<_>>();
    drives.sort_by(|a, b| a.path.cmp(&b.path));
    drives.dedup_by(|a, b| a.path == b.path);
    Locations { drives, selected }
}

#[cfg(target_os = "windows")]
fn mounted() -> Vec<(PathBuf, String)> {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetLogicalDrives() -> u32;
        fn GetDriveTypeW(path: *const u16) -> u32;
        fn GetVolumeInformationW(path: *const u16, name: *mut u16, size: u32, serial: *mut u32, component: *mut u32, flags: *mut u32, filesystem: *mut u16, filesystem_size: u32) -> i32;
    }
    let bits = unsafe { GetLogicalDrives() };
    (0..26).filter_map(|index| {
        if bits & (1 << index) == 0 { return None; }
        let path = format!("{}:\\", (b'A' + index) as char);
        let wide = path.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        if !matches!(unsafe { GetDriveTypeW(wide.as_ptr()) }, 2 | 3) { return None; }
        let mut name = [0u16; 261];
        let ok = unsafe { GetVolumeInformationW(wide.as_ptr(), name.as_mut_ptr(), name.len() as u32, std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), 0) };
        let label = if ok != 0 { String::from_utf16_lossy(&name[..name.iter().position(|v| *v == 0).unwrap_or(0)]) } else { String::new() };
        let label = if label.is_empty() { path.clone() } else { format!("{} ({})", label, path.trim_end_matches('\\')) };
        Some((PathBuf::from(path), label))
    }).collect()
}

#[cfg(target_os = "linux")]
fn mounted() -> Vec<(PathBuf, String)> {
    let mut paths = vec![(PathBuf::from("/"), "/".to_owned())];
    if let Ok(mounts) = std::fs::read_to_string("/proc/self/mounts") {
        for line in mounts.lines() {
            let fields = line.split_whitespace().collect::<Vec<_>>();
            if fields.len() < 4 || !fields[0].starts_with("/dev/") || !fields[3].split(',').any(|v| v == "rw") { continue; }
            let path = fields[1].replace("\\040", " ").replace("\\011", "\t").replace("\\134", "\\");
            if path != "/" && !path.starts_with("/boot") { paths.push((PathBuf::from(&path), path)); }
        }
    }
    paths
}

#[cfg(target_os = "macos")]
fn mounted() -> Vec<(PathBuf, String)> {
    let mut paths = vec![(PathBuf::from("/"), "/".to_owned())];
    if let Ok(entries) = std::fs::read_dir("/Volumes") {
        paths.extend(entries.flatten().map(|entry| (entry.path(), entry.file_name().to_string_lossy().into_owned())));
    }
    paths
}

#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
fn mounted() -> Vec<(PathBuf, String)> { Vec::new() }

#[cfg(test)]
mod tests {
    #[test]
    fn selected_folder_requires_an_existing_absolute_directory() {
        assert!(super::inspect(Some("relative/path".into())).selected.is_none());
        let temp = std::env::temp_dir();
        let selected = super::inspect(Some(temp.to_string_lossy().into_owned())).selected.unwrap();
        assert!(selected.available_bytes.is_some());
    }
}
