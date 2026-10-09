use super::{minecraft_instances::{self as instances, Result}, p2p_files};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha512};
use std::{collections::{BTreeMap, HashSet}, fs, io::Read, path::{Path, PathBuf}, sync::atomic::{AtomicBool, Ordering}};

pub const MAX_ARCHIVE: u64 = 256 * 1024 * 1024;
pub const MAX_FILE: u64 = 512 * 1024 * 1024;
pub const MAX_TOTAL: u64 = 20 * 1024 * 1024 * 1024;
#[derive(Clone, Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Index {
    pub format_version: u8, pub game: String, pub version_id: String, pub name: String,
    #[serde(default)] pub summary: String,
    pub files: Vec<PackFile>, pub dependencies: BTreeMap<String, String>,
}
#[derive(Clone, Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PackFile {
    pub path: String, pub hashes: BTreeMap<String, String>, pub downloads: Vec<String>, pub file_size: u64,
    #[serde(default)] pub env: BTreeMap<String, String>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewFile { pub path: String, pub bytes: u64, pub optional: bool }
#[derive(Clone)]
pub struct Override { pub archive_name: String, pub path: String, pub bytes: u64 }
pub struct Parsed { pub index: Index, pub files: Vec<PackFile>, pub overrides: Vec<Override>, pub loader: String, pub loader_version: String, pub skipped: usize, pub sha512: String }

pub fn canceled(cancel: &AtomicBool) -> Result<()> { if cancel.load(Ordering::Relaxed) { Err("instance_canceled") } else { Ok(()) } }
fn digest(value: Option<&String>, length: usize) -> bool { value.is_some_and(|v| v.len() == length && v.bytes().all(|b| b.is_ascii_hexdigit())) }
pub fn download_url(value: &str) -> Result<reqwest::Url> {
    let url = reqwest::Url::parse(value).map_err(|_| "instance_pack_source")?;
    if value.len() > 4096 || url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() || url.port().is_some() || url.fragment().is_some()
        || !matches!(url.host_str(), Some("cdn.modrinth.com" | "github.com" | "raw.githubusercontent.com" | "gitlab.com" | "release-assets.githubusercontent.com" | "objects.githubusercontent.com")) { return Err("instance_pack_source"); }
    Ok(url)
}
pub fn environment(index: &Index) -> Result<(String, String)> {
    if index.format_version != 1 || index.game != "minecraft" || !instances::name(&index.name) || index.version_id.len() > 200 || index.version_id.is_empty() || index.summary.len() > 5000 || index.files.len() > 10_000 { return Err("instance_pack_format"); }
    if !index.dependencies.get("minecraft").is_some_and(|v| instances::version(v)) { return Err("instance_pack_format"); }
    let mut loader = ("vanilla".to_string(), String::new());
    for (key, value) in &index.dependencies {
        if key == "minecraft" { continue; }
        let kind = match key.as_str() { "fabric-loader" => "fabric", "quilt-loader" => "quilt", "forge" => "forge", "neoforge" => "neoforge", _ => return Err("instance_pack_loader") };
        if loader.0 != "vanilla" || !instances::version(value) { return Err("instance_pack_loader"); }
        loader = (kind.into(), value.clone());
    }
    Ok(loader)
}
pub fn hash(path: &Path, cancel: &AtomicBool) -> Result<String> {
    let mut file = instances::plain_file(path, MAX_ARCHIVE)?; let mut hash = Sha512::new(); let mut bytes = 0; let mut buffer = [0_u8; 65_536];
    loop { canceled(cancel)?; let n = file.read(&mut buffer).map_err(|_| "instance_read")?; if n == 0 { break; } bytes += n as u64; if bytes > MAX_ARCHIVE { return Err("instance_limit"); } hash.update(&buffer[..n]); }
    Ok(format!("{:x}", hash.finalize()))
}
fn hierarchy(paths: impl Iterator<Item = String>) -> Result<()> {
    let entries: HashSet<String> = paths.map(|v| v.to_lowercase()).collect();
    for path in &entries { let mut parent = Path::new(path).parent(); while let Some(p) = parent { if entries.contains(&p.to_string_lossy().replace('\\', "/")) { return Err("instance_pack_path"); } parent = p.parent(); } }
    Ok(())
}
pub fn parse(path: &Path, cancel: &AtomicBool) -> Result<Parsed> {
    let sha512 = hash(path, cancel)?;
    let mut archive = zip::ZipArchive::new(instances::plain_file(path, MAX_ARCHIVE)?).map_err(|_| "instance_pack_format")?;
    if archive.len() > 20_000 { return Err("instance_limit"); }
    let index: Index = {
        let entry = archive.by_name("modrinth.index.json").map_err(|_| "instance_pack_format")?;
        if entry.size() > 4 * 1024 * 1024 { return Err("instance_limit"); }
        let mut bytes = Vec::new(); entry.take(4 * 1024 * 1024 + 1).read_to_end(&mut bytes).map_err(|_| "instance_pack_format")?;
        if bytes.len() > 4 * 1024 * 1024 { return Err("instance_limit"); }
        serde_json::from_slice(&bytes).map_err(|_| "instance_pack_format")?
    };
    let (loader, loader_version) = environment(&index)?;
    let mut files = Vec::new(); let mut seen = HashSet::new(); let mut total = 0_u64; let mut skipped = 0;
    for file in &index.files {
        canceled(cancel)?; instances::relative(&file.path)?;
        if !seen.insert(file.path.to_lowercase()) || !digest(file.hashes.get("sha512"), 128) || !digest(file.hashes.get("sha1"), 40) || file.file_size > MAX_FILE || file.downloads.is_empty() || file.downloads.len() > 8 || file.env.iter().any(|(k, v)| !["client", "server"].contains(&k.as_str()) || !["required", "optional", "unsupported"].contains(&v.as_str())) { return Err("instance_pack_format"); }
        if file.env.get("client").is_some_and(|v| v == "unsupported") { skipped += 1; continue; }
        if !file.downloads.iter().any(|url| download_url(url).is_ok()) { return Err("instance_pack_source"); }
        total = total.checked_add(file.file_size).ok_or("instance_limit")?;
        if total > MAX_TOTAL { return Err("instance_limit"); } files.push(file.clone());
    }
    let mut archive_names = HashSet::new(); let mut common = BTreeMap::new(); let mut client = BTreeMap::new(); let mut expanded = 0_u64;
    for i in 0..archive.len() {
        canceled(cancel)?; let entry = archive.by_index(i).map_err(|_| "instance_pack_format")?;
        let name = entry.name().trim_end_matches('/'); instances::relative(name)?;
        if !archive_names.insert(name.to_lowercase()) || entry.unix_mode().is_some_and(|m| ![0, 0o040000, 0o100000].contains(&(m & 0o170000))) { return Err("instance_pack_path"); }
        if entry.is_dir() { continue; }
        expanded = expanded.checked_add(entry.size()).ok_or("instance_limit")?;
        if entry.size() > MAX_FILE || expanded > MAX_TOTAL { return Err("instance_limit"); }
        let layer = if let Some(path) = name.strip_prefix("overrides/") { Some((&mut common, path)) } else { name.strip_prefix("client-overrides/").map(|path| (&mut client, path)) };
        if let Some((map, path)) = layer { instances::relative(path)?; map.insert(path.to_lowercase(), Override { archive_name: name.into(), path: path.into(), bytes: entry.size() }); }
    }
    // Client overrides win over common overrides and downloaded files, per the format.
    common.extend(client); files.retain(|f| !common.contains_key(&f.path.to_lowercase()));
    let overrides: Vec<_> = common.into_values().collect();
    if files.len() + overrides.len() > 20_000 { return Err("instance_limit"); }
    hierarchy(files.iter().map(|f| f.path.clone()).chain(overrides.iter().map(|f| f.path.clone())))?;
    if total + overrides.iter().map(|v| v.bytes).sum::<u64>() > MAX_TOTAL { return Err("instance_limit"); }
    Ok(Parsed { index, files, overrides, loader, loader_version, skipped, sha512 })
}
pub fn extract(path: &Path, target: &Path, entries: &[Override], cancel: &AtomicBool) -> Result<()> {
    let mut archive = zip::ZipArchive::new(instances::plain_file(path, MAX_ARCHIVE)?).map_err(|_| "instance_pack_format")?;
    for entry in entries {
        canceled(cancel)?; let file = archive.by_name(&entry.archive_name).map_err(|_| "instance_pack_format")?;
        if file.size() != entry.bytes { return Err("instance_changed"); }
        let mut out = instances::create_file(target, &entry.path)?; instances::copy_file(file, &mut out, entry.bytes)?;
    }
    Ok(())
}

pub struct Temporary(pub PathBuf);
impl Drop for Temporary { fn drop(&mut self) { if self.0.file_name().is_some_and(|v| v.to_string_lossy().starts_with(".pack-")) && self.0.parent().is_some_and(|p| p2p_files::plain_dir(p).is_ok()) { let _ = fs::remove_file(&self.0); } } }
