use super::{LaunchConfig, Shortcuts};
use std::{
    fs,
    path::{Path, PathBuf},
};
use windows::{
    core::{Interface, HSTRING},
    Win32::{
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, IPersistFile,
            CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, STGM_READ,
        },
        UI::Shell::{
            FOLDERID_Desktop, FOLDERID_Programs, IShellLinkW, SHGetKnownFolderPath, ShellLink,
            KF_FLAG_DEFAULT, SLGP_RAWPATH,
        },
    },
};

struct Apartment;
impl Apartment {
    fn new() -> Result<Self, &'static str> {
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }
            .ok()
            .map_err(|_| "shortcut_write")?;
        Ok(Self)
    }
}
impl Drop for Apartment {
    fn drop(&mut self) {
        unsafe {
            CoUninitialize();
        }
    }
}

fn shell_path(path: &str) -> String {
    if let Some(unc) = path.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{unc}")
    } else {
        path.strip_prefix(r"\\?\").unwrap_or(path).to_owned()
    }
}

// Windows argv quoting, never cmd.exe or PowerShell input. Empty values and trailing slashes survive.
fn arguments(values: &[String]) -> String {
    values
        .iter()
        .map(|value| {
            let mut result = String::from("\"");
            let mut slashes = 0;
            for ch in value.chars() {
                if ch == '\\' {
                    slashes += 1;
                    continue;
                }
                result.extend(std::iter::repeat_n(
                    '\\',
                    if ch == '"' { slashes * 2 + 1 } else { slashes },
                ));
                result.push(ch);
                slashes = 0;
            }
            result.extend(std::iter::repeat_n('\\', slashes * 2));
            result.push('"');
            result
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn link() -> Result<IShellLinkW, &'static str> {
    unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER) }
        .map_err(|_| "shortcut_write")
}
fn text(value: &[u16]) -> String {
    String::from_utf16_lossy(&value[..value.iter().position(|&v| v == 0).unwrap_or(value.len())])
}
fn matches(path: &Path, config: &LaunchConfig) -> bool {
    let read = || -> windows::core::Result<bool> {
        let link: IShellLinkW =
            unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)? };
        let persist: IPersistFile = link.cast()?;
        let mut target = vec![0u16; 32768];
        let mut args = vec![0u16; 32768];
        let mut work = vec![0u16; 32768];
        unsafe {
            persist.Load(&HSTRING::from(path.as_os_str()), STGM_READ)?;
            link.GetPath(&mut target, std::ptr::null_mut(), SLGP_RAWPATH.0 as u32)?;
            link.GetArguments(&mut args)?;
            link.GetWorkingDirectory(&mut work)?;
        }
        Ok(
            text(&target).eq_ignore_ascii_case(&shell_path(&config.executable))
                && text(&args) == arguments(&config.arguments)
                && text(&work).eq_ignore_ascii_case(&shell_path(
                    config.working_directory.as_deref().unwrap_or(""),
                )),
        )
    };
    read().unwrap_or(false)
}

fn folder(id: &windows::core::GUID) -> Result<PathBuf, &'static str> {
    let value = unsafe { SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, None) }
        .map_err(|_| "shortcut_folder")?;
    let result = unsafe { value.to_string() }
        .map(PathBuf::from)
        .map_err(|_| "shortcut_folder");
    unsafe {
        CoTaskMemFree(Some(value.0.cast()));
    }
    result
}

fn filename(name: &str) -> String {
    let clean: String = name
        .chars()
        .take(80)
        .map(|ch| {
            if ch.is_control() || "<>:\"/\\|?*".contains(ch) {
                '_'
            } else {
                ch
            }
        })
        .collect();
    let clean = clean.trim().trim_end_matches(['.', ' ']);
    // The prefix also keeps reserved DOS names (CON, AUX, COM1...) out of the filename.
    format!("{} (Harbor)", if clean.is_empty() { "Game" } else { clean })
}

fn location(root: &Path, name: &str, id: &str, config: &LaunchConfig) -> PathBuf {
    let base = root.join(format!("{}.lnk", filename(name)));
    if !base.exists() || matches(&base, config) {
        base
    } else {
        root.join(format!("{}-{}.lnk", filename(name), id))
    }
}

fn save(path: &Path, config: &LaunchConfig, name: &str) -> Result<(), &'static str> {
    if path.exists() {
        return if matches(path, config) {
            Ok(())
        } else {
            Err("shortcut_exists")
        };
    }
    let parent = path.parent().ok_or("shortcut_folder")?;
    fs::create_dir_all(parent).map_err(|_| "shortcut_folder")?;
    let temporary = parent.join(format!(".harbor-{}.lnk", uuid::Uuid::new_v4()));
    let result = (|| {
        let link = link()?;
        unsafe {
            link.SetPath(&HSTRING::from(shell_path(&config.executable)))
                .map_err(|_| "shortcut_write")?;
            link.SetArguments(&HSTRING::from(arguments(&config.arguments)))
                .map_err(|_| "shortcut_write")?;
            link.SetWorkingDirectory(&HSTRING::from(shell_path(
                config.working_directory.as_deref().unwrap_or(""),
            )))
            .map_err(|_| "shortcut_write")?;
            // Windows reads the game's embedded application icon at its native sizes.
            link.SetIconLocation(&HSTRING::from(shell_path(&config.executable)), 0)
                .map_err(|_| "shortcut_write")?;
            link.SetDescription(&HSTRING::from(name))
                .map_err(|_| "shortcut_write")?;
            let persist: IPersistFile = link.cast().map_err(|_| "shortcut_write")?;
            persist
                .Save(&HSTRING::from(temporary.as_os_str()), true)
                .map_err(|_| "shortcut_write")?;
        }
        // MoveFileW (without replacement flags) fails if another link wins the destination.
        unsafe {
            windows::Win32::Storage::FileSystem::MoveFileW(
                &HSTRING::from(temporary.as_os_str()),
                &HSTRING::from(path.as_os_str()),
            )
        }
        .map_err(|_| {
            if path.exists() {
                "shortcut_exists"
            } else {
                "shortcut_write"
            }
        })
    })();
    let _ = fs::remove_file(temporary);
    result
}

pub(super) fn run(
    id: &str,
    name: &str,
    config: &LaunchConfig,
    target: Option<&str>,
) -> Result<Shortcuts, &'static str> {
    let _apartment = Apartment::new()?;
    let desktop = location(&folder(&FOLDERID_Desktop)?, name, id, config);
    let menu = location(
        &folder(&FOLDERID_Programs)?.join("Harbor Games"),
        name,
        id,
        config,
    );
    if let Some(target) = target {
        save(
            if target == "desktop" { &desktop } else { &menu },
            config,
            name,
        )?;
    }
    Ok(Shortcuts {
        desktop: matches(&desktop, config).then(|| desktop.to_string_lossy().into_owned()),
        start_menu: matches(&menu, config).then(|| menu.to_string_lossy().into_owned()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shortcut_arguments_are_literal_windows_values() {
        let values = vec![
            "".into(),
            "a b".into(),
            "x\"y".into(),
            "C:\\tail\\".into(),
            "$(noop) & more".into(),
        ];
        let encoded = arguments(&values);
        unsafe {
            use windows::Win32::{
                Foundation::{LocalFree, HLOCAL},
                UI::Shell::CommandLineToArgvW,
            };
            let wide = HSTRING::from(format!("game.exe {encoded}"));
            let mut count = 0;
            let parsed = CommandLineToArgvW(windows::core::PCWSTR(wide.as_ptr()), &mut count);
            assert!(!parsed.is_null());
            let result = std::slice::from_raw_parts(parsed, count as usize)
                .iter()
                .skip(1)
                .map(|value| value.to_string().unwrap())
                .collect::<Vec<_>>();
            let _ = LocalFree(Some(HLOCAL(parsed.cast())));
            assert_eq!(result, values);
        }
    }
    #[test]
    fn link_roundtrip_preserves_icon_target_arguments_and_existing_files() {
        let _apartment = Apartment::new().unwrap();
        let root =
            std::env::temp_dir().join(format!("harbor-shortcut-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let config = LaunchConfig {
            executable: std::env::current_exe()
                .unwrap()
                .to_string_lossy()
                .into_owned(),
            working_directory: Some(root.to_string_lossy().into_owned()),
            arguments: vec!["--example".into(), "hello world".into()],
            mode: "native".into(),
            runner: None,
            prefix: None,
            steam_directory: None,
        };
        let path = root.join("Game.lnk");
        save(&path, &config, "Game").unwrap();
        assert!(matches(&path, &config));
        let link = link().unwrap();
        let persist: IPersistFile = link.cast().unwrap();
        let mut icon = [0u16; 32768];
        let mut index = -1;
        unsafe {
            persist
                .Load(&HSTRING::from(path.as_os_str()), STGM_READ)
                .unwrap();
            link.GetIconLocation(&mut icon, &mut index).unwrap();
        }
        assert_eq!(text(&icon), shell_path(&config.executable));
        assert_eq!(index, 0);
        let before = fs::read(&path).unwrap();
        save(&path, &config, "Game").unwrap();
        assert_eq!(fs::read(&path).unwrap(), before);
        let other = root.join("Unrelated.lnk");
        fs::write(&other, b"do not replace").unwrap();
        assert_eq!(save(&other, &config, "Game"), Err("shortcut_exists"));
        assert_eq!(fs::read(&other).unwrap(), b"do not replace");
        assert!(!filename("../CON:Game?").contains('/'));
        drop(persist);
        drop(link);
        fs::remove_dir_all(&root).unwrap();
    }
}
