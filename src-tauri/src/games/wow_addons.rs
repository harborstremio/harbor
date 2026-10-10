//! Read-only TOC inventory for a freshly discovered WoW installation.
//! Never opens SavedVariables, executes Lua, or accepts a frontend filesystem path.
use serde::Serialize;
use std::{collections::{BTreeMap, BTreeSet}, fs, io::Read, path::{Path, PathBuf}, time::Instant};
use super::launcher_scan;

const TOC_LIMIT: u64 = 128 * 1024;
const SCAN_LIMIT: usize = 8 * 1024 * 1024;

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub file: String, pub title: String, pub version: String, pub author: String,
    pub notes: String, pub interfaces: Vec<u32>, pub dependencies: Vec<String>,
    pub wowi_id: Option<u32>, pub website: String, pub load_on_demand: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Addon {
    pub folder: String, pub manifest: Option<Manifest>, pub state: &'static str,
    pub missing_dependencies: Vec<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inventory {
    pub id: String, pub client_version: Option<String>, pub addons: Vec<Addon>,
    pub partial: bool, pub checked_at: u64,
}

fn edition(id: &str) -> Option<&'static str> {
    match id { "battlenet:wow" => Some("_retail_"), "battlenet:wow_classic" => Some("_classic_"), "battlenet:wow_classic_era" => Some("_classic_era_"), "battlenet:wow_classic_anniversary" => Some("_anniversary_"), _ => None }
}
fn linked(meta: &fs::Metadata) -> bool {
    #[cfg(windows)] { use std::os::windows::fs::MetadataExt; if meta.file_attributes() & 0x400 != 0 { return true; } }
    meta.file_type().is_symlink()
}
fn child(root: &Path, path: &Path) -> Result<PathBuf, &'static str> {
    let meta = fs::symlink_metadata(path).map_err(|_| "wow_addons_unreadable")?;
    if linked(&meta) { return Err("wow_addons_linked"); }
    let canonical = fs::canonicalize(path).map_err(|_| "wow_addons_unreadable")?;
    if !canonical.starts_with(root) || canonical == root { return Err("wow_addons_outside_install"); }
    Ok(canonical)
}

/// Strip WoW's display escapes; the result is always rendered as plain text.
fn display_text(value: &str, max: usize) -> String {
    let mut out = String::new(); let mut rest = value;
    while !rest.is_empty() && out.chars().count() < max {
        if let Some(tail) = rest.strip_prefix("|c") {
            if tail.as_bytes().get(..8).is_some_and(|v| v.iter().all(u8::is_ascii_hexdigit)) { rest = &tail[8..]; continue; }
        }
        if rest.starts_with("|T") || rest.starts_with("|A") || rest.starts_with("|H") {
            let end = if rest.starts_with("|T") { "|t" } else if rest.starts_with("|A") { "|a" } else { "|h" };
            if let Some(index) = rest[2..].find(end) { rest = &rest[index + 4..]; continue; }
        }
        if rest.starts_with("|r") || rest.starts_with("|h") { rest = &rest[2..]; continue; }
        if rest.starts_with("|n") { out.push(' '); rest = &rest[2..]; continue; }
        let ch = rest.chars().next().unwrap(); rest = &rest[ch.len_utf8()..];
        if !ch.is_control() { out.push(ch); }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}
fn folder_name(value: &str) -> bool {
    !value.is_empty() && value.len() <= 180 && !matches!(value, "." | "..") && !value.chars().any(|c| c.is_control() || "/\\:|".contains(c))
}
pub(super) fn manifest(file: &str, raw: &str) -> Manifest {
    let mut fields = BTreeMap::new();
    for line in raw.trim_start_matches('\u{feff}').lines().take(2000) {
        if let Some((key, value)) = line.trim().strip_prefix("##").and_then(|line| line.split_once(':')) {
            fields.insert(key.trim().to_ascii_lowercase(), value.trim());
        }
    }
    let text = |key, max| display_text(fields.get(key).copied().unwrap_or(""), max);
    let dependencies = ["dependencies", "requireddeps"].iter().filter_map(|key| fields.get(*key))
        .flat_map(|value| value.split(',')).map(str::trim).filter(|value| folder_name(value)).take(64).map(str::to_owned).collect::<BTreeSet<_>>().into_iter().collect();
    Manifest {
        file: file.to_owned(), title: text("title", 160), version: text("version", 80), author: text("author", 180), notes: text("notes", 320),
        interfaces: fields.get("interface").into_iter().flat_map(|value| value.split(',')).filter_map(|value| value.trim().parse::<u32>().ok()).filter(|value| (10_000..1_000_000).contains(value)).take(32).collect(),
        dependencies, wowi_id: fields.get("x-wowi-id").and_then(|value| value.parse::<u32>().ok()).filter(|id| *id > 0), website: text("x-website", 2048),
        load_on_demand: fields.get("loadondemand").is_some_and(|value| *value == "1"),
    }
}
pub(super) fn suffixes(id: &str, major: Option<u32>) -> &'static [&'static str] {
    match (id, major) {
        ("battlenet:wow", _) => &["mainline"],
        ("battlenet:wow_classic_era", _) => &["vanilla"],
        (_, Some(1)) => &["vanilla"], (_, Some(2)) => &["tbc", "bcc"],
        (_, Some(3)) => &["wrath"], (_, Some(4)) => &["cata"], (_, Some(5)) => &["mists"],
        _ => &[],
    }
}
pub(super) fn select_manifest(folder: &str, choices: &[Manifest], suffixes: &[&str]) -> Result<Option<Manifest>, ()> {
    let base = folder.to_ascii_lowercase();
    let specific: Vec<_> = choices.iter().filter(|item| suffixes.iter().any(|suffix| {
        let name = item.file.to_ascii_lowercase(); name == format!("{base}_{suffix}.toc") || name == format!("{base}-{suffix}.toc")
    })).collect();
    if specific.len() > 1 { return Err(()); }
    if let Some(item) = specific.first() { return Ok(Some((*item).clone())); }
    let generic: Vec<_> = choices.iter().filter(|item| item.file.eq_ignore_ascii_case(&format!("{folder}.toc"))).collect();
    if generic.len() > 1 { return Err(()); }
    Ok(generic.first().map(|item| (*item).clone()))
}

#[cfg(windows)]
fn client_version(path: &Path) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{core::{w, PCWSTR}, Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW}};
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    // Version resources are read by Windows; the executable is never loaded or run.
    unsafe {
        let size = GetFileVersionInfoSizeW(PCWSTR(wide.as_ptr()), None);
        if size == 0 || size > 1024 * 1024 { return None; }
        let mut buffer = vec![0u64; (size as usize).div_ceil(8)];
        GetFileVersionInfoW(PCWSTR(wide.as_ptr()), None, size, buffer.as_mut_ptr().cast()).ok()?;
        let valid = |ptr: *const std::ffi::c_void, bytes: usize| { let address = ptr as usize; let start = buffer.as_ptr() as usize; address >= start && address.checked_add(bytes).is_some_and(|end| end <= start + size as usize) };
        let mut ptr = std::ptr::null_mut(); let mut length = 0;
        if !VerQueryValueW(buffer.as_ptr().cast(), w!("\\VarFileInfo\\Translation"), &mut ptr, &mut length).as_bool() || length < 4 || length > 256 || !valid(ptr, length as usize) { return None; }
        let translations: Vec<_> = (0..length as usize / 4).take(8).map(|index| {
            let pair = ptr.cast::<u16>().add(index * 2); (pair.read_unaligned(), pair.add(1).read_unaligned())
        }).collect();
        // WoW packs VS_FIXEDFILEINFO differently (205.5.6626.5 vs 2.5.5.66265).
        // Read its published version string instead of guessing from those integers.
        for (language, codepage) in translations {
            let query: Vec<_> = format!("\\StringFileInfo\\{language:04x}{codepage:04x}\\FileVersion").encode_utf16().chain(Some(0)).collect();
            if !VerQueryValueW(buffer.as_ptr().cast(), PCWSTR(query.as_ptr()), &mut ptr, &mut length).as_bool() || length == 0 || length > 100 || !valid(ptr, length as usize * 2) { continue; }
            let text: Vec<_> = (0..length as usize).map(|index| ptr.cast::<u16>().add(index).read_unaligned()).take_while(|value| *value != 0).collect();
            let value = String::from_utf16(&text).ok()?;
            if let Some(version) = version_string(&value) { return Some(version); }
        }
        None
    }
}
#[cfg(any(windows, test))]
fn version_string(value: &str) -> Option<String> {
    let value = value.trim(); let parts: Vec<_> = value.split('.').collect();
    if !(3..=4).contains(&parts.len()) || parts.iter().any(|part| part.is_empty() || !part.bytes().all(|ch| ch.is_ascii_digit()) || part.parse::<u32>().is_err()) { return None; }
    if !(1..100).contains(&parts[0].parse::<u32>().ok()?) { return None; }
    Some(value.to_owned())
}
#[cfg(not(windows))]
fn client_version(_: &Path) -> Option<String> { None }

pub fn scan(id: &str) -> Result<Inventory, &'static str> {
    edition(id).ok_or("wow_addons_edition")?;
    let game = launcher_scan::scan().games.into_iter().find(|game| game.id == id && game.state == "installed").ok_or("wow_addons_not_installed")?;
    inventory(id, Path::new(&game.install_path))
}

pub(super) fn target(id: &str) -> Result<(PathBuf, String), &'static str> {
    let folder = edition(id).ok_or("wow_addons_edition")?;
    let game = launcher_scan::scan().games.into_iter().find(|game| game.id == id && game.state == "installed").ok_or("wow_addons_not_installed")?;
    let root = super::p2p_files::plain_dir(Path::new(&game.install_path)).map_err(|_| "wow_addons_linked")?;
    let client = child(&root, &root.join(folder))?;
    let binary = child(&client, &client.join(if id == "battlenet:wow" { "Wow.exe" } else { "WowClassic.exe" }))?;
    let version = client_version(&binary).ok_or("wow_addons_version")?;
    Ok((client, version))
}
fn inventory(id: &str, install: &Path) -> Result<Inventory, &'static str> {
    let start = Instant::now();
    let root = fs::canonicalize(install).map_err(|_| "wow_addons_unreadable")?;
    let client = child(&root, &root.join(edition(id).ok_or("wow_addons_edition")?))?;
    let binary = child(&client, &client.join(if id == "battlenet:wow" { "Wow.exe" } else { "WowClassic.exe" }))?;
    let version = client_version(&binary);
    let major = version.as_ref().and_then(|value| value.split('.').next()?.parse().ok());
    let mut result = Inventory { id: id.to_owned(), client_version: version, addons: vec![], partial: false, checked_at: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64 };
    let mut addons_root = client.clone();
    for part in ["Interface", "AddOns"] {
        let path = addons_root.join(part);
        match fs::symlink_metadata(&path) { Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(result), Err(_) => return Err("wow_addons_unreadable"), Ok(_) => {} }
        addons_root = child(&client, &path)?;
    }
    let mut entries = Vec::new();
    for (index, entry) in fs::read_dir(&addons_root).map_err(|_| "wow_addons_unreadable")?.take(1025).enumerate() {
        if index == 1024 { result.partial = true; break; }
        let entry = entry.map_err(|_| "wow_addons_unreadable")?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !folder_name(&name) || name.starts_with("Blizzard_") { continue; }
        if entries.len() == 512 { result.partial = true; break; }
        match entry.file_type() { Ok(kind) if kind.is_dir() || kind.is_symlink() => entries.push((name, entry.path())), Err(_) => result.partial = true, _ => {} }
    }
    entries.sort_by_key(|(name, _)| name.to_ascii_lowercase());
    let folders: BTreeSet<_> = entries.iter().map(|(name, _)| name.to_ascii_lowercase()).collect();
    let mut bytes = 0;
    for (folder, path) in entries {
        if bytes >= SCAN_LIMIT || start.elapsed().as_secs() >= 5 { result.partial = true; break; }
        let mut item = Addon { folder, manifest: None, state: "unreadable", missing_dependencies: vec![] };
        if let Ok(path) = child(&addons_root, &path) {
            if let Ok(files) = fs::read_dir(&path) {
                let mut choices = Vec::new(); let mut failed = false; let mut scanned = 0;
                for file in files.take(513) {
                    if start.elapsed().as_secs() >= 5 { failed = true; result.partial = true; break; }
                    scanned += 1;
                    if scanned > 512 { failed = true; break; }
                    let Ok(file) = file else { failed = true; continue; };
                    let name = file.file_name().to_string_lossy().into_owned();
                    if !name.to_ascii_lowercase().ends_with(".toc") { continue; }
                    if choices.len() >= 32 || bytes >= SCAN_LIMIT { failed = true; break; }
                    let Ok(file_path) = child(&path, &file.path()) else { failed = true; continue; };
                    let Ok(file) = fs::File::open(file_path) else { failed = true; continue; };
                    if !file.metadata().is_ok_and(|meta| meta.is_file() && meta.len() <= TOC_LIMIT) { failed = true; continue; }
                    let mut raw = String::new();
                    if file.take(TOC_LIMIT + 1).read_to_string(&mut raw).is_err() || raw.len() > TOC_LIMIT as usize { failed = true; continue; }
                    if raw.len() > SCAN_LIMIT - bytes { failed = true; result.partial = true; break; }
                    bytes += raw.len(); choices.push(manifest(&name, &raw));
                }
                if !failed { match select_manifest(&item.folder, &choices, suffixes(id, major)) { Ok(value) => { item.state = if value.is_some() { "ready" } else { "noManifest" }; item.manifest = value; }, Err(_) => item.state = "ambiguous" } }
            }
        }
        if let Some(metadata) = &item.manifest {
            // Blizzard's own modules can live in client archives, outside AddOns.
            item.missing_dependencies = metadata.dependencies.iter().filter(|name| {
                let key = name.to_ascii_lowercase();
                !key.starts_with("blizzard_") && !folders.contains(&key)
            }).cloned().collect();
        }
        result.addons.push(item);
    }
    if result.partial { for item in &mut result.addons { item.missing_dependencies.clear(); } }
    Ok(result)
}

#[cfg(test)]
#[path = "wow_addons_tests.rs"]
mod tests;
