use std::{
    fs,
    io::{Cursor, Read},
    path::{Component, Path, PathBuf},
};

/// Bundle identity comes from Info.plist, not an arbitrary executable inside Contents.
pub fn bundle_executable(bundle: &Path) -> Result<PathBuf, &'static str> {
    let root = bundle.canonicalize().map_err(|_| "launch_missing")?;
    let info = root.join("Contents/Info.plist");
    let mut file = fs::File::open(info)
        .map_err(|_| "launch_executable")?
        .take(1024 * 1024 + 1);
    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|_| "launch_executable")?;
    if data.len() > 1024 * 1024 {
        return Err("launch_executable");
    }
    let value = plist::Value::from_reader(Cursor::new(data)).map_err(|_| "launch_executable")?;
    let name = value
        .as_dictionary()
        .and_then(|v| v.get("CFBundleExecutable"))
        .and_then(|v| v.as_string())
        .ok_or("launch_executable")?;
    if name.is_empty()
        || name.contains(['/', '\\', ':'])
        || !matches!(
            Path::new(name).components().next(),
            Some(Component::Normal(_))
        )
    {
        return Err("launch_executable");
    }
    let executable = root
        .join("Contents/MacOS")
        .join(name)
        .canonicalize()
        .map_err(|_| "launch_missing")?;
    if !executable.starts_with(&root) {
        return Err("launch_executable");
    }
    let meta = fs::metadata(&executable).map_err(|_| "launch_missing")?;
    if !meta.is_file() || meta.len() == 0 {
        return Err("launch_executable");
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if meta.permissions().mode() & 0o111 == 0 {
            return Err("launch_permission");
        }
    }
    Ok(executable)
}

pub fn external_installer(path: &Path, os: &str) -> bool {
    let ext = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_ascii_lowercase();
    match os {
        "macos" => ["dmg", "pkg"].contains(&ext.as_str()),
        "linux" => ["deb", "rpm"].contains(&ext.as_str()),
        _ => false,
    }
}

/// File headers reject known foreign binaries before the OS reports an opaque exec-format error.
pub fn foreign_binary(header: &[u8], os: &str) -> bool {
    if header.starts_with(b"MZ") {
        return os != "windows";
    }
    if header.starts_with(b"\x7fELF") {
        return os != "linux";
    }
    let macho = [
        [0xfe, 0xed, 0xfa, 0xce],
        [0xce, 0xfa, 0xed, 0xfe],
        [0xfe, 0xed, 0xfa, 0xcf],
        [0xcf, 0xfa, 0xed, 0xfe],
        [0xca, 0xfe, 0xba, 0xbe],
        [0xbe, 0xba, 0xfe, 0xca],
        [0xca, 0xfe, 0xba, 0xbf],
        [0xbf, 0xba, 0xfe, 0xca],
    ];
    os != "macos" && macho.iter().any(|magic| header.starts_with(magic))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn package_handlers_are_host_specific() {
        assert!(external_installer(Path::new("Game.dmg"), "macos"));
        assert!(external_installer(Path::new("Game.PKG"), "macos"));
        assert!(external_installer(Path::new("Game.deb"), "linux"));
        assert!(!external_installer(Path::new("Game.dmg"), "linux"));
        assert!(!external_installer(Path::new("Game.exe"), "macos"));
    }
    #[test]
    fn foreign_formats_are_not_native_launches() {
        assert!(foreign_binary(b"MZhello", "linux"));
        assert!(foreign_binary(b"\x7fELF", "macos"));
        assert!(!foreign_binary(b"\x7fELF", "linux"));
        assert!(!foreign_binary(&[0xcf, 0xfa, 0xed, 0xfe], "macos"));
        assert!(foreign_binary(&[0xcf, 0xfa, 0xed, 0xfe], "linux"));
        assert!(!foreign_binary(b"#!/bin/sh", "linux"));
    }
    #[test]
    fn bundles_require_the_declared_executable_and_reject_traversal() {
        let dir = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("bundle-{}", uuid::Uuid::new_v4()));
        let app = dir.join("Game.app");
        fs::create_dir_all(app.join("Contents/MacOS")).unwrap();
        assert_eq!(bundle_executable(&app).unwrap_err(), "launch_executable");
        let mut values = plist::Dictionary::new();
        values.insert(
            "CFBundleExecutable".into(),
            plist::Value::String("Game".into()),
        );
        plist::Value::Dictionary(values.clone())
            .to_file_binary(app.join("Contents/Info.plist"))
            .unwrap();
        let executable = app.join("Contents/MacOS/Game");
        fs::write(&executable, b"game binary").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&executable, fs::Permissions::from_mode(0o700)).unwrap();
        }
        assert_eq!(
            bundle_executable(&app).unwrap(),
            executable.canonicalize().unwrap()
        );
        values.insert(
            "CFBundleExecutable".into(),
            plist::Value::String("../other".into()),
        );
        plist::Value::Dictionary(values)
            .to_file_xml(app.join("Contents/Info.plist"))
            .unwrap();
        assert_eq!(bundle_executable(&app).unwrap_err(), "launch_executable");
        fs::remove_dir_all(&dir).unwrap();
    }
}

// Only a user-initiated repair may add the owner's execute bit; never run the file here.
pub fn allow_execution(value: String) -> Result<String, &'static str> {
    #[cfg(not(target_os = "linux"))]
    {
        let _ = value;
        Err("launch_platform")
    }
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::PermissionsExt;
        let selected = Path::new(&value);
        if !selected.is_absolute() || value.len() > 8192 {
            return Err("launch_path");
        }
        let meta = fs::symlink_metadata(selected).map_err(|_| "launch_missing")?;
        if !meta.is_file() || meta.file_type().is_symlink() {
            return Err("launch_executable");
        }
        let mut file = fs::File::open(selected).map_err(|_| "launch_missing")?;
        let mut header = [0; 4];
        let n = file.read(&mut header).map_err(|_| "launch_executable")?;
        if !header[..n].starts_with(b"\x7fELF") && !header[..n].starts_with(b"#!") {
            return Err("launch_executable");
        }
        let mut permissions = file.metadata().map_err(|_| "launch_missing")?.permissions();
        permissions.set_mode(permissions.mode() | 0o100);
        file.set_permissions(permissions)
            .map_err(|_| "launch_permission")?;
        Ok(value)
    }
}

#[cfg(test)]
mod permission_tests {
    use super::*;
    #[cfg(not(target_os = "linux"))]
    #[test]
    fn permission_repair_is_not_available_on_other_operating_systems() {
        assert_eq!(
            allow_execution("fixture".into()).unwrap_err(),
            "launch_platform"
        );
    }
    #[cfg(target_os = "linux")]
    #[test]
    fn permission_repair_only_changes_the_selected_native_files_owner_bit() {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("permission-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let game = root.join("Game.AppImage");
        fs::write(&game, b"\x7fELFtest fixture").unwrap();
        fs::set_permissions(&game, fs::Permissions::from_mode(0o640)).unwrap();
        allow_execution(game.to_string_lossy().into()).unwrap();
        assert_eq!(
            fs::metadata(&game).unwrap().permissions().mode() & 0o777,
            0o740
        );
        let link = root.join("link");
        symlink(&game, &link).unwrap();
        assert_eq!(
            allow_execution(link.to_string_lossy().into()).unwrap_err(),
            "launch_executable"
        );
        fs::write(&game, b"MZwindows").unwrap();
        assert_eq!(
            allow_execution(game.to_string_lossy().into()).unwrap_err(),
            "launch_executable"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
