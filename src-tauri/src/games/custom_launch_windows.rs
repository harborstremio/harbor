use super::LaunchConfig;
use std::{
    io,
    os::windows::{
        io::{AsRawHandle, FromRawHandle, OwnedHandle},
        process::ExitStatusExt,
    },
    process::ExitStatus,
};
use windows::{
    core::{w, PCWSTR},
    Win32::{
        Foundation::{HANDLE, WAIT_OBJECT_0},
        System::{
            Com::{
                CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
            },
            Threading::{GetExitCodeProcess, GetProcessId, WaitForSingleObject, INFINITE},
        },
        UI::{
            Shell::{
                ShellExecuteExW, SEE_MASK_FLAG_NO_UI, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS,
                SHELLEXECUTEINFOW,
            },
            WindowsAndMessaging::SW_SHOWNORMAL,
        },
    },
};

pub(super) struct Process {
    handle: OwnedHandle,
    pid: u32,
}
impl Process {
    pub(super) fn id(&self) -> u32 {
        self.pid
    }
    pub(super) fn wait(&mut self) -> io::Result<ExitStatus> {
        let handle = HANDLE(self.handle.as_raw_handle());
        if unsafe { WaitForSingleObject(handle, INFINITE) } != WAIT_OBJECT_0 {
            return Err(io::Error::last_os_error());
        }
        let mut code = 0;
        unsafe { GetExitCodeProcess(handle, &mut code) }.map_err(io::Error::other)?;
        Ok(ExitStatus::from_raw(code))
    }
}

// lpParameters is a Windows argv string, never a cmd.exe/PowerShell expression.
fn parameters(arguments: &[String]) -> String {
    arguments
        .iter()
        .map(|argument| {
            let mut quoted = String::from("\"");
            let mut slashes = 0;
            for ch in argument.chars() {
                if ch == '\\' {
                    slashes += 1;
                    continue;
                }
                quoted.extend(std::iter::repeat_n(
                    '\\',
                    if ch == '"' { slashes * 2 + 1 } else { slashes },
                ));
                quoted.push(ch);
                slashes = 0;
            }
            quoted.extend(std::iter::repeat_n('\\', slashes * 2));
            quoted.push('"');
            quoted
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn shell_path(path: &str) -> String {
    if let Some(unc) = path.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{unc}");
    }
    if let Some(disk) = path.strip_prefix(r"\\?\") {
        if disk.as_bytes().get(1) == Some(&b':') {
            return disk.to_owned();
        }
    }
    path.to_owned()
}

fn error_code(error: windows::core::Error) -> &'static str {
    if error.code().0 as u32 == 0x800704c7 {
        "launch_canceled"
    } else {
        "launch_failed"
    }
}

pub(super) fn launch(config: &LaunchConfig) -> Result<Process, &'static str> {
    execute(config, w!("runas"))
}

fn execute(config: &LaunchConfig, verb: PCWSTR) -> Result<Process, &'static str> {
    struct Apartment(bool);
    impl Drop for Apartment {
        fn drop(&mut self) {
            if self.0 {
                unsafe {
                    CoUninitialize();
                }
            }
        }
    }
    let initialized =
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) };
    if initialized.is_err() && initialized.0 as u32 != 0x80010106 {
        return Err("launch_failed");
    }
    let _apartment = Apartment(initialized.is_ok());
    let wide = |value: String| value.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    let file = wide(shell_path(&config.executable));
    let directory = wide(shell_path(
        config
            .working_directory
            .as_deref()
            .ok_or("launch_directory")?,
    ));
    let arguments = wide(parameters(&config.arguments));
    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        // NO_UI suppresses duplicate error dialogs, never Windows security prompts.
        fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC | SEE_MASK_FLAG_NO_UI,
        lpVerb: verb,
        lpFile: PCWSTR(file.as_ptr()),
        lpDirectory: PCWSTR(directory.as_ptr()),
        lpParameters: if config.arguments.is_empty() {
            PCWSTR::null()
        } else {
            PCWSTR(arguments.as_ptr())
        },
        nShow: SW_SHOWNORMAL.0,
        ..Default::default()
    };
    unsafe { ShellExecuteExW(&mut info) }.map_err(error_code)?;
    if info.hProcess.is_invalid() {
        return Err("launch_failed");
    }
    // Dropping this owned handle only releases observation; it never stops the game.
    let handle = unsafe { OwnedHandle::from_raw_handle(info.hProcess.0) };
    let pid = unsafe { GetProcessId(HANDLE(handle.as_raw_handle())) };
    if pid == 0 {
        return Err("launch_failed");
    }
    Ok(Process { handle, pid })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shell_paths_preserve_disk_unc_unicode_and_device_identity() {
        assert_eq!(
            shell_path(r"\\?\D:\Games\雨 & dusk.exe"),
            r"D:\Games\雨 & dusk.exe"
        );
        assert_eq!(
            shell_path(r"\\?\UNC\server\games\a.exe"),
            r"\\server\games\a.exe"
        );
        assert_eq!(
            shell_path(r"\\?\Volume{abc}\game.exe"),
            r"\\?\Volume{abc}\game.exe"
        );
    }
    #[test]
    fn canceled_approval_is_distinct_from_a_broken_executable() {
        assert_eq!(
            error_code(windows::core::Error::from_hresult(windows::core::HRESULT(
                0x800704c7u32 as i32
            ))),
            "launch_canceled"
        );
        assert_eq!(
            error_code(windows::core::Error::from_hresult(windows::core::HRESULT(
                0x80070005u32 as i32
            ))),
            "launch_failed"
        );
    }
    #[test]
    fn parameters_round_trip_through_windows_parser() {
        use windows::Win32::{Foundation::LocalFree, UI::Shell::CommandLineToArgvW};
        let args: Vec<String> = [
            "",
            "plain",
            "a b",
            "雨 😀",
            "quote\"inside",
            "C:\\trailing\\",
            "one\\\"two",
            "a\tb",
            "&|><^%PATH%$(literal)",
        ]
        .into_iter()
        .map(str::to_owned)
        .collect();
        let command: Vec<u16> = format!("probe.exe {}", parameters(&args))
            .encode_utf16()
            .chain(Some(0))
            .collect();
        let mut count = 0;
        let parsed = unsafe { CommandLineToArgvW(PCWSTR(command.as_ptr()), &mut count) };
        assert!(!parsed.is_null());
        let actual: Vec<String> = unsafe { std::slice::from_raw_parts(parsed, count as usize) }
            .iter()
            .skip(1)
            .map(|value| unsafe { value.to_string() }.unwrap())
            .collect();
        unsafe {
            let _ = LocalFree(Some(windows::Win32::Foundation::HLOCAL(parsed.cast())));
        }
        assert_eq!(actual, args);
    }
    #[test]
    fn shell_process_preserves_arguments_directory_exit_and_handle_lifetime() {
        let Ok(executable) = std::env::var("HARBOR_LAUNCH_TEST_EXE") else {
            return;
        };
        let root = std::env::var("HARBOR_GAME_TEST_ROOT").expect("test output root");
        let output =
            std::path::Path::new(&root).join(format!("launch-{}.json", uuid::Uuid::new_v4()));
        let args = vec![
            output.to_string_lossy().into_owned(),
            "".into(),
            "雨 & a \"quote\"\\".into(),
            "$(literal);%PATH%".into(),
        ];
        let config = super::super::validate(LaunchConfig {
            executable,
            working_directory: Some(root.clone()),
            arguments: args.clone(),
            mode: "native".into(),
            runner: None,
            prefix: None,
            steam_directory: None,
        })
        .unwrap();
        let mut process = execute(&config, w!("open")).unwrap();
        assert!(process.id() > 0);
        assert_eq!(process.wait().unwrap().code(), Some(23));
        let result: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&output).unwrap()).unwrap();
        assert_eq!(result["arguments"], serde_json::json!(args));
        assert_eq!(
            std::path::Path::new(result["directory"].as_str().unwrap())
                .canonicalize()
                .unwrap(),
            std::path::Path::new(&root).canonicalize().unwrap()
        );
        std::fs::remove_file(output).unwrap();
    }
}
