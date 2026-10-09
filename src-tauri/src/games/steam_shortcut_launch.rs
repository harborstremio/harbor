//! Explicit, reviewed direct launches. Steam identity and custom-library records stay separate.
use super::{custom_launch, steam_shortcuts};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

type Result<T> = std::result::Result<T, &'static str>;
const ID_PREFIX: [u8; 8] = *b"HarborSS";

#[derive(Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub executable: String,
    pub start_directory: String,
    pub launch_options: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Process {
    pub profile: String,
    pub id: String,
    pub session_id: String,
    pub pid: u32,
    pub started_at: u64,
}

fn scope(profile: &str, root: &Path) -> Result<String> {
    if profile.is_empty() || profile.len() > 160 || profile.chars().any(char::is_control) {
        return Err("launch_record");
    }
    let root = root.canonicalize().map_err(|_| "shortcut_location")?;
    let mut root = root.to_string_lossy().into_owned();
    if cfg!(windows) {
        root.make_ascii_lowercase();
    }
    let mut digest = Sha256::new();
    digest.update(profile.as_bytes());
    digest.update([0]);
    digest.update(root.as_bytes());
    Ok(format!("shortcut:{:x}", digest.finalize()))
}

fn engine_id(account_id: u32, id: &str) -> Result<String> {
    let id = steam_shortcuts::request_id(account_id, None, Some(id))?;
    let suffix = id.rsplit(':').next().ok_or("shortcut_identity")?;
    let mut bytes = [0u8; 16];
    if let Some(local) = suffix.strip_prefix("local-") {
        bytes[0] = 1;
        bytes[1..5].copy_from_slice(&account_id.to_be_bytes());
        for (index, byte) in bytes[5..].iter_mut().enumerate() {
            *byte = u8::from_str_radix(&local[index * 2..index * 2 + 2], 16)
                .map_err(|_| "shortcut_identity")?;
        }
    } else {
        bytes[..8].copy_from_slice(&ID_PREFIX);
        bytes[8..12].copy_from_slice(&account_id.to_be_bytes());
        bytes[12..].copy_from_slice(
            &suffix
                .parse::<u32>()
                .map_err(|_| "shortcut_identity")?
                .to_be_bytes(),
        );
    }
    Ok(uuid::Uuid::from_bytes(bytes).to_string())
}

fn shortcut_id(id: &str) -> Option<String> {
    let id = uuid::Uuid::parse_str(id).ok()?;
    let bytes = id.as_bytes();
    if bytes[0] == 1 {
        let account = u32::from_be_bytes(bytes[1..5].try_into().ok()?);
        let key: String = bytes[5..]
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        return steam_shortcuts::request_id(
            account,
            None,
            Some(&format!("steam-shortcut:{account}:local-{key}")),
        )
        .ok();
    }
    if bytes[..8] != ID_PREFIX {
        return None;
    }
    let account = u32::from_be_bytes(bytes[8..12].try_into().ok()?);
    let app = u32::from_be_bytes(bytes[12..].try_into().ok()?);
    steam_shortcuts::request_id(account, Some(app), None).ok()
}

fn process(profile: &str, value: custom_launch::CustomProcess) -> Option<Process> {
    Some(Process {
        profile: profile.into(),
        id: shortcut_id(&value.id)?,
        session_id: value.session_id,
        pid: value.pid,
        started_at: value.started_at,
    })
}

pub fn running(profile: &str, root: &Path) -> Result<Vec<Process>> {
    Ok(custom_launch::running(scope(profile, root)?)
        .into_iter()
        .filter_map(|value| process(profile, value))
        .collect())
}

fn directory(raw: &str) -> Result<Option<String>> {
    let raw = raw.trim();
    if raw.is_empty() {
        return Ok(None);
    }
    let raw = if raw.starts_with('"') {
        raw.strip_prefix('"')
            .and_then(|value| value.strip_suffix('"'))
            .ok_or("launch_directory")?
    } else {
        raw
    };
    if raw.contains('"') || raw.chars().any(char::is_control) || !Path::new(raw).is_absolute() {
        return Err("launch_directory");
    }
    Ok(Some(raw.into()))
}

fn arguments(raw: &str) -> Result<Vec<String>> {
    if raw.len() > 32768 || raw.chars().any(|ch| ch.is_control() && ch != '\t') {
        return Err("launch_arguments");
    }
    // A Steam command wrapper needs Steam's substitution rules, not literal argv or a shell.
    if raw.to_ascii_lowercase().contains("%command%") {
        return Err("shortcut_options");
    }
    #[cfg(windows)]
    {
        use windows::{
            core::PCWSTR,
            Win32::{
                Foundation::{LocalFree, HLOCAL},
                UI::Shell::CommandLineToArgvW,
            },
        };
        let line: Vec<u16> = format!("harbor.exe {raw}")
            .encode_utf16()
            .chain(Some(0))
            .collect();
        let mut count = 0;
        let values = unsafe { CommandLineToArgvW(PCWSTR(line.as_ptr()), &mut count) };
        if values.is_null() {
            return Err("launch_arguments");
        }
        let result = if (1..=129).contains(&count) {
            unsafe { std::slice::from_raw_parts(values, count as usize) }
                .iter()
                .skip(1)
                .map(|value| unsafe { value.to_string() }.map_err(|_| "launch_arguments"))
                .collect()
        } else {
            Err("launch_arguments")
        };
        unsafe {
            let _ = LocalFree(Some(HLOCAL(values.cast())));
        }
        result
    }
    #[cfg(not(windows))]
    posix_arguments(raw)
}

#[cfg(any(not(windows), test))]
fn posix_arguments(raw: &str) -> Result<Vec<String>> {
    let mut result = Vec::new();
    let mut word = String::new();
    let mut quote = None;
    let mut present = false;
    let mut chars = raw.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\\' && quote != Some('\'') {
            let next = chars.next().ok_or("launch_arguments")?;
            if quote == Some('"') && !['"', '\\', '$', '`'].contains(&next) {
                word.push('\\');
            }
            word.push(next);
            present = true;
        } else if quote == Some(ch) {
            quote = None;
            present = true;
        } else if quote.is_none() && ['\'', '"'].contains(&ch) {
            quote = Some(ch);
            present = true;
        } else if quote.is_none() && ch.is_whitespace() {
            if present {
                result.push(std::mem::take(&mut word));
                present = false;
            }
        } else {
            word.push(ch);
            present = true;
        }
        if result.len() > 128 || word.len() > 2048 {
            return Err("launch_arguments");
        }
    }
    if quote.is_some() {
        return Err("launch_arguments");
    }
    if present {
        result.push(word);
    }
    Ok(result)
}

pub fn prepare(
    root: &Path,
    account_id: u32,
    id: &str,
    reviewed: &Review,
) -> Result<custom_launch::LaunchConfig> {
    let game = steam_shortcuts::find_id(root, account_id, id)?;
    if game.executable != reviewed.executable
        || game.start_directory != reviewed.start_directory
        || game.launch_options != reviewed.launch_options
    {
        return Err("shortcut_changed");
    }
    let executable = game.executable_path().ok_or("shortcut_executable")?;
    custom_launch::validate(custom_launch::LaunchConfig {
        executable: executable.to_string_lossy().into_owned(),
        working_directory: directory(&game.start_directory)?,
        arguments: arguments(&game.launch_options)?,
        mode: "native".into(),
        runner: None,
        prefix: None,
        steam_directory: None,
    })
}

pub fn launch(
    profile: String,
    root: &Path,
    account_id: u32,
    shortcut_id: &str,
    reviewed: Review,
    finished: impl FnOnce(Process) + Send + 'static,
) -> Result<Process> {
    let owner = scope(&profile, root)?;
    let config = prepare(root, account_id, shortcut_id, &reviewed)?;
    let id = engine_id(account_id, shortcut_id)?;
    if custom_launch::running(owner.clone())
        .iter()
        .any(|process| process.id == id)
    {
        return Err("launch_running");
    }
    let exit_profile = profile.clone();
    let exit_id = shortcut_id.to_owned();
    let started = custom_launch::launch(owner, id, config, move |exit| {
        finished(Process {
            profile: exit_profile,
            id: exit_id,
            session_id: exit.session_id,
            pid: exit.pid,
            started_at: exit.started_at,
        })
    })?;
    process(&profile, started).ok_or("launch_record")
}

#[cfg(test)]
#[path = "steam_shortcut_launch_tests.rs"]
mod tests;
