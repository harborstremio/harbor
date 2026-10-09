//! Bounded Windows installation records only. No account databases, tokens or whole-drive scans.
use super::{ea_registration, identifier, local_path, Inputs, Launcher};
use std::path::{Path, PathBuf};
use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::{ERROR_NO_MORE_ITEMS, ERROR_SUCCESS};
use windows::Win32::System::Registry::{
    RegCloseKey, RegEnumKeyExW, RegGetValueW, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER,
    HKEY_LOCAL_MACHINE, KEY_READ, RRF_RT_REG_SZ,
};

#[path = "launcher_windows_extra.rs"]
mod extra;

struct Key(HKEY);
impl Drop for Key {
    fn drop(&mut self) {
        unsafe {
            let _ = RegCloseKey(self.0);
        }
    }
}
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}
fn open(hive: HKEY, name: &str) -> Option<Key> {
    let name = wide(name);
    let mut key = HKEY::default();
    unsafe {
        RegOpenKeyExW(hive, PCWSTR(name.as_ptr()), None, KEY_READ, &mut key)
            .ok()
            .ok()?;
    }
    Some(Key(key))
}
fn value(key: HKEY, name: &str) -> Option<String> {
    let name = wide(name);
    let mut bytes = 0u32;
    unsafe {
        RegGetValueW(
            key,
            None,
            PCWSTR(name.as_ptr()),
            RRF_RT_REG_SZ,
            None,
            None,
            Some(&mut bytes),
        )
        .ok()
        .ok()?;
        if !(2..=65536).contains(&bytes) {
            return None;
        }
        let mut buf = vec![0u16; (bytes as usize + 1) / 2];
        RegGetValueW(
            key,
            None,
            PCWSTR(name.as_ptr()),
            RRF_RT_REG_SZ,
            None,
            Some(buf.as_mut_ptr().cast()),
            Some(&mut bytes),
        )
        .ok()
        .ok()?;
        let end = buf.iter().position(|ch| *ch == 0).unwrap_or(buf.len());
        String::from_utf16(&buf[..end]).ok()
    }
}
fn subkeys(key: HKEY, warnings: &mut Vec<&'static str>) -> Vec<String> {
    let mut out = Vec::new();
    for index in 0..4096 {
        let mut buffer = [0u16; 256];
        let mut len = buffer.len() as u32;
        let status = unsafe {
            RegEnumKeyExW(
                key,
                index,
                Some(PWSTR(buffer.as_mut_ptr())),
                &mut len,
                None,
                None,
                None,
                None,
            )
        };
        if status == ERROR_NO_MORE_ITEMS {
            return out;
        }
        if status != ERROR_SUCCESS {
            warnings.push("launcher_registry_partial");
            continue;
        }
        if let Ok(name) = String::from_utf16(&buffer[..len as usize]) {
            out.push(name);
        }
    }
    warnings.push("launcher_registry_limit");
    out
}
#[derive(Default)]
struct Program {
    key: String,
    name: String,
    publisher: String,
    path: PathBuf,
    uninstall: String,
    registration: Option<String>,
}
fn uninstall_programs(warnings: &mut Vec<&'static str>) -> Vec<Program> {
    let mut programs = Vec::new();
    for hive in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
        for root in [
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ] {
            let Some(key) = open(hive, root) else {
                continue;
            };
            for name in subkeys(key.0, warnings) {
                let Some(item) = open(key.0, &name) else {
                    warnings.push("launcher_registry_partial");
                    continue;
                };
                let path = PathBuf::from(value(item.0, "InstallLocation").unwrap_or_default());
                if !local_path(&path) {
                    continue;
                }
                programs.push(Program {
                    registration: ea_registration(
                        if hive == HKEY_LOCAL_MACHINE {
                            "machine"
                        } else {
                            "user"
                        },
                        &name,
                    ),
                    key: name,
                    path,
                    name: value(item.0, "DisplayName").unwrap_or_default(),
                    publisher: value(item.0, "Publisher").unwrap_or_default(),
                    uninstall: value(item.0, "UninstallString").unwrap_or_default(),
                });
            }
        }
    }
    programs
}
fn client(inputs: &mut Inputs, launcher: Launcher, directory: &Path, filenames: &[&str]) {
    if !local_path(directory) {
        return;
    }
    for file in filenames {
        let candidate = directory.join(file);
        if candidate.is_file() {
            inputs.clients.entry(launcher).or_insert(candidate);
            break;
        }
    }
}
fn uid(command: &str) -> Option<String> {
    // Read the uninstall product switch as data. This command is never executed.
    let lowered = command.to_ascii_lowercase();
    if !lowered.contains("battle.net") && !lowered.contains("blizzard uninstaller") {
        return None;
    }
    let token = command
        .split_whitespace()
        .find_map(|part| part.strip_prefix("--uid="))?
        .trim_matches('"');
    identifier(token).then(|| token.to_owned())
}
fn immediate_ea_roots(inputs: &mut Inputs, root: &Path) {
    if !local_path(root) {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(root) {
        for entry in entries.flatten().take(512) {
            let path = entry.path();
            if entry
                .file_type()
                .is_ok_and(|kind| kind.is_dir() && !kind.is_symlink())
                && path.join("__Installer/installerdata.xml").is_file()
            {
                inputs
                    .ea
                    .push((entry.file_name().to_string_lossy().into_owned(), path));
            }
        }
    }
}
pub(super) fn discover() -> Inputs {
    let mut inputs = Inputs::default();
    let programs = uninstall_programs(&mut inputs.warnings);
    for program in &programs {
        if program.publisher.trim().eq_ignore_ascii_case("Blizzard Entertainment")
            && ["Diablo II", "Warcraft III"].iter().any(|name| program.name.trim().eq_ignore_ascii_case(name))
        {
            inputs.battle_classic.push((program.name.clone(), program.publisher.clone(), program.path.clone()));
        }
        match program.name.to_ascii_lowercase().as_str() {
            "itch" => {
                if let Some(executable) = super::itch::client(&program.path) {
                    inputs.clients.entry(Launcher::Itch).or_insert(executable);
                }
            }
            "battle.net" => client(
                &mut inputs,
                Launcher::Battlenet,
                &program.path,
                &["Battle.net.exe"],
            ),
            "ubisoft connect" | "uplay" => client(
                &mut inputs,
                Launcher::Ubisoft,
                &program.path,
                &["UbisoftConnect.exe", "upc.exe"],
            ),
            "ea app" | "ea desktop" => client(
                &mut inputs,
                Launcher::Ea,
                &program.path,
                &[
                    "EALauncher.exe",
                    "EADesktop.exe",
                    "EA Desktop/EALauncher.exe",
                    "EA Desktop/EADesktop.exe",
                ],
            ),
            _ => {}
        }
        if let Some(product) = uid(&program.uninstall) {
            if !matches!(product.as_str(), "agent" | "battle.net") {
                inputs
                    .battle
                    .push((product, program.name.clone(), program.path.clone()));
            }
        }
        // Only EA-origin records with their own manifest are considered; publisher names alone
        // don't grant launch rights or turn a Steam copy into an EA library entry.
        if (program.key.starts_with("Origin")
            || program
                .publisher
                .to_ascii_lowercase()
                .contains("electronic arts")
            || program.publisher.eq_ignore_ascii_case("EA"))
            && program.path.join("__Installer/installerdata.xml").is_file()
        {
            inputs.ea.push((program.name.clone(), program.path.clone()));
            if let Some(key) = &program.registration {
                inputs.ea_keys.push((program.path.clone(), key.clone()));
            }
        }
    }
    for hive in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
        for prefix in [r"SOFTWARE", r"SOFTWARE\WOW6432Node"] {
            if let Some(key) = open(hive, &format!(r"{prefix}\Ubisoft\Launcher")) {
                if let Some(path) = value(key.0, "InstallDir") {
                    client(
                        &mut inputs,
                        Launcher::Ubisoft,
                        Path::new(&path),
                        &["UbisoftConnect.exe", "upc.exe"],
                    );
                }
                if let Some(installs) = open(key.0, "Installs") {
                    for id in subkeys(installs.0, &mut inputs.warnings) {
                        if !id.parse::<u32>().is_ok_and(|id| id > 0) {
                            continue;
                        }
                        if let Some(install) = open(installs.0, &id) {
                            if let Some(path) = value(install.0, "InstallDir") {
                                let path = PathBuf::from(path.replace('/', "\\"));
                                let title = value(install.0, "DisplayName")
                                    .or_else(|| {
                                        programs
                                            .iter()
                                            .find(|p| {
                                                p.path
                                                    .to_string_lossy()
                                                    .eq_ignore_ascii_case(&path.to_string_lossy())
                                            })
                                            .map(|p| p.name.clone())
                                    })
                                    .unwrap_or_default();
                                inputs.ubisoft.push((id, title, path));
                            }
                        }
                    }
                }
            }
            if let Some(key) = open(hive, &format!(r"{prefix}\Electronic Arts\EA Desktop")) {
                if let Some(path) = value(key.0, "InstallLocation") {
                    client(
                        &mut inputs,
                        Launcher::Ea,
                        Path::new(&path),
                        &["EALauncher.exe", "EADesktop.exe"],
                    );
                }
            }
            for ea_root in [
                format!(r"{prefix}\EA Games"),
                format!(r"{prefix}\Electronic Arts\EA Games"),
            ] {
                if let Some(key) = open(hive, &ea_root) {
                    for name in subkeys(key.0, &mut inputs.warnings) {
                        if let Some(game) = open(key.0, &name) {
                            if let Some(path) =
                                value(game.0, "Install Dir").or_else(|| value(game.0, "InstallDir"))
                            {
                                inputs.ea.push((name, PathBuf::from(path)));
                            }
                        }
                    }
                }
            }
        }
    }
    if let Some(root) = std::env::var_os("ProgramData") {
        let path = PathBuf::from(root).join("Battle.net/Agent/product.db");
        if local_path(&path) && path.is_file() {
            inputs.battle_db = Some(path);
        }
    }
    for env in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Some(root) = std::env::var_os(env) {
            let root = PathBuf::from(root);
            client(
                &mut inputs,
                Launcher::Battlenet,
                &root.join("Battle.net"),
                &["Battle.net.exe"],
            );
            client(
                &mut inputs,
                Launcher::Ubisoft,
                &root.join("Ubisoft/Ubisoft Game Launcher"),
                &["UbisoftConnect.exe", "upc.exe"],
            );
            client(
                &mut inputs,
                Launcher::Ea,
                &root.join("Electronic Arts/EA Desktop/EA Desktop"),
                &["EALauncher.exe", "EADesktop.exe"],
            );
            immediate_ea_roots(&mut inputs, &root.join("EA Games"));
            immediate_ea_roots(&mut inputs, &root.join("Origin Games"));
        }
    }
    if let Some(root) = std::env::var_os("LOCALAPPDATA") {
        if let Some(executable) = super::itch::client(&PathBuf::from(&root).join("itch")) {
            inputs.clients.entry(Launcher::Itch).or_insert(executable);
        }
        let path =
            PathBuf::from(root).join("Ubisoft Game Launcher/cache/configuration/configurations");
        if local_path(&path) && path.is_file() {
            inputs.ubisoft_cache = Some(path);
        }
    }
    extra::discover(&mut inputs, &programs);
    if let Some(root) = std::env::var_os("APPDATA") {
        let path = PathBuf::from(root).join("itch/db/butler.db");
        if local_path(&path) {
            match path.try_exists() {
                Ok(true) => inputs.itch_db = Some(path),
                Err(_) => inputs.warnings.push("itch_database_unreadable"),
                Ok(false) => {},
            }
        }
    }
    inputs
}
