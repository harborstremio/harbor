//! Read-only launch-option evidence. Never expose account files or execute options.
use super::{sims_files as files, sims_package::Result};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeSet,
    fs,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
};
#[path = "vdf.rs"]
mod vdf;

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomLaunch {
    pub executable: String,
    pub arguments: Vec<String>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub source: Option<&'static str>,
    pub state: &'static str,
    pub disabled: BTreeSet<String>,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            source: None,
            state: "unknown",
            disabled: BTreeSet::new(),
        }
    }
}
#[derive(Default)]
pub struct Environment {
    pub steam_root: Option<PathBuf>,
    pub steam_account: Option<u32>,
    pub ea_root: Option<PathBuf>,
    pub ea_data: Option<PathBuf>,
}
impl Environment {
    pub fn current() -> Self {
        Self {
            steam_root: super::steam_paths::find_root(),
            steam_account: super::steam_shortcut_commands::active_account(),
            ea_root: ea_installation(),
            ea_data: std::env::var_os("LOCALAPPDATA")
                .map(|p| PathBuf::from(p).join("Electronic Arts/EA Desktop")),
        }
    }
}
fn ea_installation() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        use windows::{
            core::PCWSTR,
            Win32::System::Registry::{RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ},
        };
        for location in [
            "SOFTWARE\\WOW6432Node\\Maxis\\The Sims 4",
            "SOFTWARE\\Maxis\\The Sims 4",
        ] {
            let key: Vec<u16> = location.encode_utf16().chain(Some(0)).collect();
            let name: Vec<u16> = "Install Dir\0".encode_utf16().collect();
            let mut buffer = [0u16; 4096];
            let mut size = (buffer.len() * 2) as u32;
            if unsafe {
                RegGetValueW(
                    HKEY_LOCAL_MACHINE,
                    PCWSTR(key.as_ptr()),
                    PCWSTR(name.as_ptr()),
                    RRF_RT_REG_SZ,
                    None,
                    Some(buffer.as_mut_ptr().cast()),
                    Some(&mut size),
                )
            }
            .is_ok()
            {
                let end = buffer.iter().position(|v| *v == 0)?;
                let value = PathBuf::from(String::from_utf16(&buffer[..end]).ok()?);
                if value.is_absolute() {
                    return Some(value);
                }
            }
        }
    }
    None
}
pub fn pack_code(value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    (bytes.len() == 4
        && b"EFGS".contains(&bytes[0].to_ascii_uppercase())
        && bytes[1].eq_ignore_ascii_case(&b'P')
        && bytes[2..].iter().all(u8::is_ascii_digit))
    .then(|| value.to_ascii_uppercase())
}
fn same_directory(a: &Path, b: &Path) -> bool {
    match (files::directory(a), files::directory(b)) {
        (Ok(a), Ok(b)) => a
            .to_string_lossy()
            .eq_ignore_ascii_case(&b.to_string_lossy()),
        _ => false,
    }
}
fn text(path: &Path, limit: usize, check: &dyn Fn() -> Result<()>) -> Result<String> {
    String::from_utf8(files::read_checked(path, limit, check)?).map_err(|_| "sims_launch_settings")
}
fn unique<'a>(value: &'a vdf::Value, key: &str) -> Result<Option<&'a vdf::Value>> {
    let mut matches = value
        .entries()
        .ok_or("sims_launch_settings")?
        .iter()
        .filter(|(name, _)| name.eq_ignore_ascii_case(key));
    matches.next();
    if matches.next().is_some() {
        return Err("sims_launch_settings");
    }
    Ok(value.get(key))
}
fn child<'a>(value: &'a vdf::Value, key: &str) -> Result<&'a vdf::Value> {
    unique(value, key)?.ok_or("sims_launch_settings")
}
fn words(value: &str) -> Result<Vec<String>> {
    if value.len() > 16384 || value.chars().any(|c| c.is_control() && c != '\t') {
        return Err("sims_launch_settings");
    }
    let mut chars = value.chars().peekable();
    let mut result = Vec::new();
    while chars.peek().is_some() {
        while chars.peek().is_some_and(|c| c.is_whitespace()) {
            chars.next();
        }
        if chars.peek().is_none() {
            break;
        }
        let mut token = String::new();
        let mut quoted = false;
        while let Some(&c) = chars.peek() {
            if c.is_whitespace() && !quoted {
                break;
            }
            chars.next();
            if c == '"' {
                quoted = !quoted;
            } else if c == '\\' {
                let mut count = 1;
                while chars.peek() == Some(&'\\') {
                    chars.next();
                    count += 1;
                }
                if chars.peek() == Some(&'"') {
                    token.extend(std::iter::repeat_n('\\', count / 2));
                    chars.next();
                    if count % 2 == 1 {
                        token.push('"');
                    } else {
                        quoted = !quoted;
                    }
                } else {
                    token.extend(std::iter::repeat_n('\\', count));
                }
            } else {
                token.push(c);
            }
        }
        if quoted || token.len() > 2048 || result.len() >= 128 {
            return Err("sims_launch_settings");
        }
        result.push(token);
    }
    Ok(result)
}
fn disabled(args: &[String]) -> Result<BTreeSet<String>> {
    if args.len() > 128 || args.iter().map(String::len).sum::<usize>() > 16384 {
        return Err("sims_launch_settings");
    }
    let mut found: Option<BTreeSet<String>> = None;
    for argument in args {
        if argument.len() > 2048 || argument.chars().any(char::is_control) {
            return Err("sims_launch_settings");
        }
        if let Some(value) = argument.strip_prefix("-disablepacks:") {
            let codes = if value.is_empty() {
                BTreeSet::new()
            } else {
                value
                    .split(',')
                    .map(|v| pack_code(v).ok_or("sims_launch_settings"))
                    .collect::<Result<BTreeSet<_>>>()?
            };
            if found.as_ref().is_some_and(|old| old != &codes) {
                return Err("sims_launch_settings");
            }
            found = Some(codes);
        } else if argument.to_ascii_lowercase().contains("disablepacks")
            || argument.contains([';', '|', '>', '<'])
            || argument.contains("%command%") && argument != "%command%"
        {
            return Err("sims_launch_settings");
        }
    }
    Ok(found.unwrap_or_default())
}
fn consensus(source: &'static str, candidates: Vec<Result<BTreeSet<String>>>) -> Settings {
    let mut result = Settings {
        source: Some(source),
        ..Settings::default()
    };
    let mut sets = Vec::new();
    for candidate in candidates {
        match candidate {
            Ok(value) => sets.push(value),
            Err(_) => return result,
        }
    }
    let Some(first) = sets.first() else {
        return result;
    };
    if sets.iter().any(|value| value != first) {
        result.state = "conflicting";
        return result;
    }
    result.state = "checked";
    result.disabled = first.clone();
    result
}
fn steam_installation(root: &Path, check: &dyn Fn() -> Result<()>) -> Result<bool> {
    let Some(common) = root.parent().filter(|p| {
        p.file_name()
            .is_some_and(|n| n.eq_ignore_ascii_case("common"))
    }) else {
        return Ok(false);
    };
    let Some(apps) = common.parent() else {
        return Ok(false);
    };
    let path = apps.join("appmanifest_1222670.acf");
    if !path.try_exists().map_err(|_| "sims_launch_settings")? {
        return Ok(false);
    }
    let data = vdf::parse(&text(&path, 1024 * 1024, check)?).map_err(|_| "sims_launch_settings")?;
    let app = child(&data, "AppState")?;
    let directory = child(app, "installdir")?
        .text()
        .ok_or("sims_launch_settings")?;
    if directory.is_empty()
        || directory.contains(['/', '\\', ':'])
        || directory == "."
        || directory == ".."
    {
        return Err("sims_launch_settings");
    }
    Ok(child(app, "appid")?.text() == Some("1222670")
        && same_directory(&common.join(directory), root))
}
fn steam_options(env: &Environment, check: &dyn Fn() -> Result<()>) -> Result<BTreeSet<String>> {
    let (Some(root), Some(account)) = (&env.steam_root, env.steam_account.filter(|id| *id != 0))
    else {
        return Err("sims_launch_settings");
    };
    let data = vdf::parse(&text(
        &root.join(format!("userdata/{account}/config/localconfig.vdf")),
        4 * 1024 * 1024,
        check,
    )?)
    .map_err(|_| "sims_launch_settings")?;
    let mut node = &data;
    for key in ["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"] {
        node = child(node, key)?;
    }
    let Some(app) = unique(node, "1222670")? else {
        return Ok(BTreeSet::new());
    };
    let Some(options) = unique(app, "LaunchOptions")? else {
        return Ok(BTreeSet::new());
    };
    disabled(&words(options.text().ok_or("sims_launch_settings")?)?)
}
fn ea_offers(data: &Path, check: &dyn Fn() -> Result<()>) -> Result<BTreeSet<String>> {
    let logs = files::directory(&data.join("Logs"))?;
    let mut entries = Vec::new();
    for (index, entry) in fs::read_dir(logs)
        .map_err(|_| "sims_launch_settings")?
        .enumerate()
    {
        check()?;
        if index >= 256 {
            return Err("sims_launch_settings");
        }
        let entry = entry.map_err(|_| "sims_launch_settings")?;
        if entry
            .file_name()
            .to_string_lossy()
            .starts_with("EADesktopVerbose.")
        {
            let meta = files::regular(&entry.path())?;
            entries.push((meta.modified().ok(), entry.path(), meta.len()));
        }
    }
    entries.sort_by(|a, b| b.0.cmp(&a.0));
    let mut offers = BTreeSet::new();
    for (_, path, length) in entries.into_iter().take(8) {
        check()?;
        let before = files::regular(&path)?;
        if before.len() != length {
            return Err("sims_changed");
        }
        let mut file = fs::File::open(&path).map_err(|_| "sims_launch_settings")?;
        let offset = length.saturating_sub(256 * 1024);
        file.seek(SeekFrom::Start(offset))
            .map_err(|_| "sims_launch_settings")?;
        let mut bytes = Vec::new();
        file.take(256 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "sims_launch_settings")?;
        let after = files::regular(&path)?;
        if after.len() != length
            || before.modified().ok() != after.modified().ok()
            || bytes.len() > 256 * 1024
        {
            return Err("sims_changed");
        }
        let text = String::from_utf8_lossy(&bytes);
        for line in text.lines().skip(usize::from(offset > 0)) {
            if !line.contains("slug=[the-sims-4]") {
                continue;
            }
            let Some(id) = line
                .split_once("offerId=[")
                .and_then(|(_, tail)| tail.split_once(']').map(|(id, _)| id))
            else {
                continue;
            };
            if id.is_empty()
                || id.len() > 128
                || !id
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || b"._:-".contains(&c))
            {
                continue;
            }
            offers.insert(id.to_ascii_lowercase());
            if offers.len() > 32 {
                return Err("sims_launch_settings");
            }
        }
    }
    if offers.is_empty() {
        return Err("sims_launch_settings");
    }
    Ok(offers)
}
fn ea_options(env: &Environment, check: &dyn Fn() -> Result<()>) -> Result<Settings> {
    let data = files::directory(env.ea_data.as_deref().ok_or("sims_launch_settings")?)?;
    let offers = ea_offers(&data, check)?;
    let mut candidates = Vec::new();
    let mut budget = 2 * 1024 * 1024;
    let mut users = 0;
    for (index, entry) in fs::read_dir(&data)
        .map_err(|_| "sims_launch_settings")?
        .enumerate()
    {
        check()?;
        if index >= 256 {
            return Err("sims_launch_settings");
        }
        let entry = entry.map_err(|_| "sims_launch_settings")?;
        let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
        if !name.starts_with("user_") || !name.ends_with(".ini") {
            continue;
        }
        users += 1;
        if users > 32 {
            return Err("sims_launch_settings");
        }
        let input = text(&entry.path(), budget.min(256 * 1024), check)?;
        budget = budget.saturating_sub(input.len());
        let mut values = Vec::new();
        let mut seen = BTreeSet::new();
        let mut global = true;
        for line in input.lines() {
            let line = line.trim().trim_start_matches('\u{feff}');
            if line.starts_with('[') {
                global = false;
            }
            if line.starts_with([';', '#']) || line.is_empty() {
                continue;
            }
            let Some((key, value)) = line.split_once('=') else {
                continue;
            };
            let key = key.trim().to_ascii_lowercase();
            let Some(id) = key
                .strip_prefix("user.gamecommandline.")
                .filter(|id| offers.contains(*id))
            else {
                continue;
            };
            if !global {
                return Err("sims_launch_settings");
            }
            if !seen.insert(id.to_owned()) {
                return Err("sims_launch_settings");
            }
            let value = value.trim();
            // EA stores a command line as an INI value; reject escaped/typed Qt values
            // instead of turning an unreadable setting into an empty configuration.
            if value.starts_with('@') {
                return Err("sims_launch_settings");
            }
            values.push(disabled(&words(value)?));
        }
        for id in &offers {
            if !seen.contains(id) {
                values.push(Ok(BTreeSet::new()));
            }
        }
        candidates.extend(values);
    }
    Ok(consensus("ea", candidates))
}
pub fn inspect(
    root: &Path,
    custom: &[CustomLaunch],
    env: &Environment,
    check: &dyn Fn() -> Result<()>,
) -> Result<Settings> {
    check()?;
    let result = if !custom.is_empty() {
        let values = if custom.len() > 32 {
            vec![Err("sims_launch_settings")]
        } else {
            custom
                .iter()
                .map(|launch| {
                    let executable = Path::new(&launch.executable);
                    files::regular(executable)?;
                    let expected = root.join("Game/Bin");
                    if !same_directory(
                        executable.parent().ok_or("sims_launch_settings")?,
                        &expected,
                    ) || !executable.file_name().is_some_and(|name| {
                        ["TS4_x64.exe", "TS4_DX9_x64.exe", "TS4_x64_fpb.exe"]
                            .iter()
                            .any(|v| name.eq_ignore_ascii_case(v))
                    }) {
                        return Err("sims_launch_settings");
                    }
                    disabled(&launch.arguments)
                })
                .collect()
        };
        consensus("custom", values)
    } else {
        match steam_installation(root, check) {
            Ok(true) => consensus("steam", vec![steam_options(env, check)]),
            Err(_) => Settings {
                source: Some("steam"),
                ..Settings::default()
            },
            Ok(false)
                if env
                    .ea_root
                    .as_deref()
                    .is_some_and(|path| same_directory(path, root)) =>
            {
                ea_options(env, check).unwrap_or_else(|_| Settings {
                    source: Some("ea"),
                    ..Settings::default()
                })
            }
            _ => Settings::default(),
        }
    };
    check()?;
    Ok(result)
}

#[cfg(test)]
#[path = "sims_launch_settings_tests.rs"]
mod tests;
