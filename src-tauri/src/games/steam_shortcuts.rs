//! Read-only discovery of Steam's non-store shortcuts. Never execute shortcut fields.
//! The u64 run-game identity is kept separate from a Steam store app ID.

use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

const MAX_FILE: usize = 8 * 1024 * 1024;
const MAX_FIELDS: usize = 100_000;
const MAX_GAMES: usize = 10_000;

#[derive(Debug, Clone, PartialEq)]
pub struct Shortcut {
    pub account_id: u32,
    pub app_id: u32,
    pub name: String,
    pub executable: String,
    pub start_directory: String,
    pub launch_options: String,
    pub icon: String,
    pub hidden: bool,
    pub last_played: u32,
    pub tags: Vec<String>,
}

impl Shortcut {
    pub fn id(&self) -> String {
        let key = self
            .steam_app_id()
            .map(|id| id.to_string())
            .unwrap_or_else(|| {
                // Row order, artwork and activity are mutable. The reviewed launch definition
                // distinguishes variants; an edited definition becomes a new local identity.
                let mut hash = Sha256::new();
                hash.update(b"harbor-steam-shortcut-local-v1");
                for field in [
                    &self.name,
                    &self.executable,
                    &self.start_directory,
                    &self.launch_options,
                ] {
                    hash.update((field.len() as u64).to_le_bytes());
                    hash.update(field.as_bytes());
                }
                // Eleven digest bytes fit beside the account and a type byte in the process
                // engine's UUID. Any same-account collision is excluded by the reader below.
                format!("local-{}", &format!("{:x}", hash.finalize())[..22])
            });
        format!("steam-shortcut:{}:{key}", self.account_id)
    }

    pub fn steam_app_id(&self) -> Option<u32> {
        (self.app_id & 0x8000_0000 != 0).then_some(self.app_id)
    }

    pub fn run_game_id(&self) -> Option<u64> {
        self.steam_app_id()
            .map(|id| (u64::from(id) << 32) | 0x02000000)
    }

    pub fn executable_path(&self) -> Option<PathBuf> {
        // Only accept a whole quoted path, not a shell command assembled from Exe.
        let value = self.executable.trim();
        let value = if value.starts_with('"') {
            value.strip_prefix('"')?.strip_suffix('"')?
        } else {
            value
        };
        if value.contains('"') || value.chars().any(char::is_control) {
            return None;
        }
        let path = PathBuf::from(value);
        path.is_absolute().then_some(path)
    }
}

#[derive(Debug, Default)]
pub struct Scan {
    pub shortcuts: Vec<Shortcut>,
    pub accounts_scanned: usize,
    pub files_found: usize,
    pub warnings: BTreeSet<&'static str>,
}

#[derive(Debug)]
enum Value {
    Object(Vec<(String, Value)>),
    Text(String),
    Integer(u32),
    Other,
}

struct Reader<'a> {
    data: &'a [u8],
    at: usize,
    fields: usize,
}
impl<'a> Reader<'a> {
    fn take(&mut self, count: usize) -> Result<&'a [u8], &'static str> {
        let end = self.at.checked_add(count).ok_or("shortcut_truncated")?;
        let bytes = self.data.get(self.at..end).ok_or("shortcut_truncated")?;
        self.at = end;
        Ok(bytes)
    }

    fn string(&mut self) -> Result<String, &'static str> {
        let rest = &self.data[self.at..];
        let count = rest
            .iter()
            .take(32_769)
            .position(|byte| *byte == 0)
            .ok_or("shortcut_string")?;
        let text = std::str::from_utf8(self.take(count)?)
            .map_err(|_| "shortcut_encoding")?
            .to_owned();
        self.take(1)?;
        Ok(text)
    }

    fn object(&mut self, depth: usize) -> Result<Vec<(String, Value)>, &'static str> {
        if depth > 16 {
            return Err("shortcut_depth");
        }
        let mut fields = Vec::new();
        loop {
            let kind = self.take(1)?[0];
            if kind == 8 {
                return Ok(fields);
            }
            self.fields += 1;
            if self.fields > MAX_FIELDS {
                return Err("shortcut_fields");
            }
            let key = self.string()?;
            let value = match kind {
                0 => Value::Object(self.object(depth + 1)?),
                1 => Value::Text(self.string()?),
                2 => Value::Integer(u32::from_le_bytes(self.take(4)?.try_into().unwrap())),
                3 | 4 | 6 => {
                    self.take(4)?;
                    Value::Other
                }
                7 | 10 => {
                    self.take(8)?;
                    Value::Other
                }
                5 => {
                    let mut ended = false;
                    for _ in 0..16_385 {
                        if self.take(2)? == [0, 0] {
                            ended = true;
                            break;
                        }
                    }
                    if !ended {
                        return Err("shortcut_string");
                    }
                    Value::Other
                }
                _ => return Err("shortcut_type"),
            };
            fields.push((key, value));
        }
    }
}

fn field<'a>(fields: &'a [(String, Value)], name: &str) -> Option<&'a Value> {
    // Ambiguous duplicate fields should not choose a different identity from Steam.
    let mut matching = fields
        .iter()
        .filter(|(key, _)| key.eq_ignore_ascii_case(name));
    let value = &matching.next()?.1;
    matching.next().is_none().then_some(value)
}
fn text(fields: &[(String, Value)], name: &str) -> String {
    match field(fields, name) {
        Some(Value::Text(value)) => value.clone(),
        _ => String::new(),
    }
}
fn integer(fields: &[(String, Value)], name: &str) -> Option<u32> {
    match field(fields, name) {
        Some(Value::Integer(value)) => Some(*value),
        _ => None,
    }
}

struct ParsedAccount {
    shortcuts: Vec<Shortcut>,
    skipped: usize,
}

fn valid_fields(fields: &[(String, Value)]) -> bool {
    let mut seen = BTreeSet::new();
    fields.iter().all(|(key, value)| {
        let key = key.to_ascii_lowercase();
        let valid = match key.as_str() {
            "appname" | "exe" | "startdir" | "launchoptions" | "icon" => {
                matches!(value, Value::Text(_))
            }
            "appid" | "ishidden" | "lastplaytime" => matches!(value, Value::Integer(_)),
            "tags" => matches!(value, Value::Object(_)),
            _ => return true,
        };
        valid && seen.insert(key)
    })
}

pub fn parse(data: &[u8], account_id: u32) -> Result<Vec<Shortcut>, &'static str> {
    parse_account(data, account_id).map(|parsed| parsed.shortcuts)
}

fn parse_account(data: &[u8], account_id: u32) -> Result<ParsedAccount, &'static str> {
    if account_id == 0 {
        return Err("shortcut_account");
    }
    if data.len() > MAX_FILE {
        return Err("shortcut_size");
    }
    if data.is_empty() {
        return Ok(ParsedAccount {
            shortcuts: Vec::new(),
            skipped: 0,
        });
    }
    let mut reader = Reader {
        data,
        at: 0,
        fields: 0,
    };
    if reader.take(1)?[0] != 0 || !reader.string()?.eq_ignore_ascii_case("shortcuts") {
        return Err("shortcut_root");
    }
    let entries = reader.object(0)?;
    // Steam versions write either the inner terminator alone or an additional root terminator.
    if !matches!(&data[reader.at..], [] | [8]) {
        return Err("shortcut_trailing");
    }
    if entries.len() > MAX_GAMES {
        return Err("shortcut_count");
    }
    // Inspect every record before accepting identities. Neither side of a collision is safe
    // to launch, even when the other record has an invalid name or launch field.
    let mut ids = BTreeSet::new();
    let mut duplicate_ids = BTreeSet::new();
    let mut indexes = BTreeSet::new();
    let mut duplicate_indexes = BTreeSet::new();
    for (index, entry) in &entries {
        if let Ok(index) = index.parse::<u32>() {
            if !indexes.insert(index) {
                duplicate_indexes.insert(index);
            }
        }
        if let Value::Object(fields) = entry {
            for (key, value) in fields {
                if key.eq_ignore_ascii_case("appid") {
                    if let Value::Integer(id) = value {
                        if id & 0x8000_0000 != 0 && !ids.insert(*id) {
                            duplicate_ids.insert(*id);
                        }
                    }
                }
            }
        }
    }
    let mut shortcuts = Vec::new();
    let mut skipped = 0;
    for (index, entry) in entries {
        if !index
            .parse::<u32>()
            .is_ok_and(|index| !duplicate_indexes.contains(&index))
        {
            skipped += 1;
            continue;
        }
        let Value::Object(fields) = entry else {
            skipped += 1;
            continue;
        };
        if !valid_fields(&fields) {
            skipped += 1;
            continue;
        }
        let app_id = integer(&fields, "appid").unwrap_or(0);
        if duplicate_ids.contains(&app_id) {
            skipped += 1;
            continue;
        }
        let name = text(&fields, "AppName");
        let executable = text(&fields, "Exe");
        if name.trim().is_empty() || executable.trim().is_empty() || name.len() > 1024 {
            skipped += 1;
            continue;
        }
        let tags = match field(&fields, "tags") {
            Some(Value::Object(values)) => values
                .iter()
                .filter_map(|(_, value)| {
                    if let Value::Text(value) = value {
                        Some(value.clone())
                    } else {
                        None
                    }
                })
                .take(128)
                .collect(),
            _ => Vec::new(),
        };
        shortcuts.push(Shortcut {
            account_id,
            app_id,
            name,
            executable,
            start_directory: text(&fields, "StartDir"),
            launch_options: text(&fields, "LaunchOptions"),
            icon: text(&fields, "icon"),
            hidden: integer(&fields, "IsHidden") == Some(1),
            last_played: integer(&fields, "LastPlayTime").unwrap_or(0),
            tags,
        });
    }
    let mut identities = BTreeSet::new();
    let mut collisions = BTreeSet::new();
    for game in &shortcuts {
        let id = game.id();
        if !identities.insert(id.clone()) {
            collisions.insert(id);
        }
    }
    shortcuts.retain(|game| {
        if collisions.contains(&game.id()) {
            skipped += 1;
            false
        } else {
            true
        }
    });
    Ok(ParsedAccount { shortcuts, skipped })
}

pub fn scan(root: &Path) -> Scan {
    let mut result = Scan::default();
    let folder = root.join("userdata");
    let entries = match fs::read_dir(&folder) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return result,
        Err(_) => {
            result.warnings.insert("shortcut_read");
            return result;
        }
    };
    let mut accounts = Vec::new();
    for (index, entry) in entries.take(1025).enumerate() {
        if index == 1024 {
            result.warnings.insert("shortcut_accounts");
            break;
        }
        let Ok(entry) = entry else {
            result.warnings.insert("shortcut_read");
            continue;
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        let Ok(account) = name.parse::<u32>() else {
            continue;
        };
        if account == 0
            || name != account.to_string()
            || !entry.file_type().is_ok_and(|kind| kind.is_dir())
        {
            continue;
        }
        accounts.push((account, entry.path()));
    }
    accounts.sort_by_key(|(account, _)| *account);
    if accounts.len() > 128 {
        result.warnings.insert("shortcut_accounts");
        accounts.truncate(128);
    }
    for (account, folder) in accounts {
        result.accounts_scanned += 1;
        let path = folder.join("config/shortcuts.vdf");
        let file = match File::open(&path) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => {
                result.warnings.insert("shortcut_read");
                continue;
            }
        };
        result.files_found += 1;
        // Never follow a config/file link outside this account's own userdata directory.
        if !path.canonicalize().is_ok_and(|path| {
            folder
                .canonicalize()
                .is_ok_and(|root| path.starts_with(root))
        }) {
            result.warnings.insert("shortcut_path");
            continue;
        }
        let mut data = Vec::new();
        if file
            .take(MAX_FILE as u64 + 1)
            .read_to_end(&mut data)
            .is_err()
        {
            result.warnings.insert("shortcut_read");
            continue;
        }
        match parse_account(&data, account) {
            Ok(parsed) if result.shortcuts.len() + parsed.shortcuts.len() <= MAX_GAMES => {
                if parsed.skipped > 0 {
                    result.warnings.insert("shortcut_entries");
                }
                result.shortcuts.extend(parsed.shortcuts)
            }
            Ok(_) => {
                result.warnings.insert("shortcut_count");
            }
            Err(code) => {
                result.warnings.insert(code);
            }
        }
    }
    result
}

/// Re-read the selected account's shortcut before handing its exact identity back to Steam.
/// Account selection and Steam-client dispatch remain a caller responsibility.
pub fn launch_uri(root: &Path, account_id: u32, app_id: u32) -> Result<String, &'static str> {
    let shortcut = find(root, account_id, app_id)?;
    if !shortcut.executable_path().is_some_and(|path| {
        path.is_file()
            || (cfg!(target_os = "macos")
                && path.extension().is_some_and(|ext| ext == "app")
                && path.is_dir())
    }) {
        return Err("shortcut_executable");
    }
    Ok(format!(
        "steam://rungameid/{}",
        shortcut.run_game_id().ok_or("shortcut_identity")?
    ))
}

/// Read only the requested account; visible icon requests must not rescan every account.
pub fn find(root: &Path, account_id: u32, app_id: u32) -> Result<Shortcut, &'static str> {
    if app_id & 0x8000_0000 == 0 {
        return Err("shortcut_identity");
    }
    read_account(root, account_id)?
        .into_iter()
        .find(|shortcut| shortcut.app_id == app_id)
        .ok_or("shortcut_missing")
}

/// A local identity never doubles as a Steam app ID. Keep old numeric callers valid,
/// while rejecting conflicting selectors and account aliases before reading the file.
pub fn request_id(
    account_id: u32,
    app_id: Option<u32>,
    id: Option<&str>,
) -> Result<String, &'static str> {
    if account_id == 0 {
        return Err("shortcut_account");
    }
    if app_id.is_some_and(|id| id & 0x8000_0000 == 0) {
        return Err("shortcut_identity");
    }
    let Some(id) = id else {
        return app_id
            .map(|id| format!("steam-shortcut:{account_id}:{id}"))
            .ok_or("shortcut_identity");
    };
    let prefix = format!("steam-shortcut:{account_id}:");
    let suffix = id.strip_prefix(&prefix).ok_or("shortcut_identity")?;
    if let Some(local) = suffix.strip_prefix("local-") {
        if app_id.is_some()
            || local.len() != 22
            || !local
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err("shortcut_identity");
        }
    } else {
        let value = suffix.parse::<u32>().map_err(|_| "shortcut_identity")?;
        if value & 0x8000_0000 == 0
            || value.to_string() != suffix
            || app_id.is_some_and(|id| id != value)
        {
            return Err("shortcut_identity");
        }
    }
    Ok(id.into())
}

pub fn find_id(root: &Path, account_id: u32, id: &str) -> Result<Shortcut, &'static str> {
    let id = request_id(account_id, None, Some(id))?;
    read_account(root, account_id)?
        .into_iter()
        .find(|game| game.id() == id)
        .ok_or("shortcut_missing")
}

pub fn read_account(root: &Path, account_id: u32) -> Result<Vec<Shortcut>, &'static str> {
    if account_id == 0 {
        return Err("shortcut_account");
    }
    let folder = root.join("userdata").join(account_id.to_string());
    let metadata = fs::symlink_metadata(&folder).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "shortcut_missing"
        } else {
            "shortcut_read"
        }
    })?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err("shortcut_path");
    }
    let path = folder.join("config/shortcuts.vdf");
    let file = File::open(&path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "shortcut_missing"
        } else {
            "shortcut_read"
        }
    })?;
    if !path.canonicalize().is_ok_and(|path| {
        folder
            .canonicalize()
            .is_ok_and(|root| path.starts_with(root))
    }) {
        return Err("shortcut_path");
    }
    let mut data = Vec::new();
    file.take(MAX_FILE as u64 + 1)
        .read_to_end(&mut data)
        .map_err(|_| "shortcut_read")?;
    parse(&data, account_id)
}

#[cfg(test)]
#[path = "steam_shortcuts_tests.rs"]
mod tests;
