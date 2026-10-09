use super::{minecraft_data, p2p_files, save_files};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, io::{Read, Write}, path::{Path, PathBuf}};

pub type Result<T> = std::result::Result<T, &'static str>;
pub const RECORD: &str = "instance.json";
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Instance {
    pub schema: u8, pub id: String, pub owner: String, pub name: String,
    pub game_version: String, pub loader: String, pub loader_version: String,
    pub created_at: u64, pub pack: Option<PackSource>, pub files: usize, pub bytes: u64,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PackSource { pub name: String, pub version: String, pub project: Option<String>, pub version_id: Option<String>, pub icon: String }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Library { pub path: String, pub instances: Vec<Instance>, pub unreadable: usize }

pub fn now() -> u64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs() }
pub fn owner(profile: &str) -> Result<String> {
    if !minecraft_data::valid_profile(profile) { return Err("instance_profile"); }
    Ok(format!("{:x}", Sha256::digest(profile.as_bytes())))
}
pub fn identifier(value: &str) -> bool { uuid::Uuid::parse_str(value).is_ok_and(|id| id.to_string() == value) }
pub fn version(value: &str) -> bool { !value.is_empty() && value.len() <= 80 && value.bytes().all(|c| c.is_ascii_alphanumeric() || b".-_+ ".contains(&c)) }
pub fn name(value: &str) -> bool { !value.trim().is_empty() && value.len() <= 640 && value.chars().count() <= 160 && !value.chars().any(char::is_control) }
pub fn directory(path: &Path) -> Result<PathBuf> { p2p_files::plain_dir(path).map_err(|_| "instance_folder") }
fn child(root: &Path, name: &str) -> Result<PathBuf> {
    let path = root.join(name);
    match fs::create_dir(&path) { Ok(()) => (), Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => (), Err(_) => return Err("instance_write") }
    let held = directory(&path)?; if held.parent() != Some(root) { return Err("instance_folder"); } Ok(held)
}
pub fn library(profile: &str, path: &str) -> Result<PathBuf> {
    if path.len() > 4096 { return Err("instance_folder"); }
    let base = directory(Path::new(path))?;
    let root = child(&base, "Harbor Minecraft")?;
    let library = child(&root, &owner(profile)?)?;
    super::minecraft_pack_transaction::recover_all(&library, profile)?;
    Ok(library)
}
pub fn plain_file(path: &Path, limit: u64) -> Result<fs::File> {
    directory(path.parent().ok_or("instance_folder")?)?;
    let meta = fs::symlink_metadata(path).map_err(|_| "instance_read")?;
    if !meta.is_file() || save_files::reparse(&meta) || meta.len() > limit { return Err("instance_read"); }
    fs::File::open(path).map_err(|_| "instance_read")
}
pub fn read<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    let mut bytes = Vec::new(); plain_file(path, 4 * 1024 * 1024)?.take(4 * 1024 * 1024 + 1).read_to_end(&mut bytes).map_err(|_| "instance_read")?;
    if bytes.len() > 4 * 1024 * 1024 { return Err("instance_read"); }
    serde_json::from_slice(&bytes).map_err(|_| "instance_read")
}
pub fn write<T: Serialize>(root: &Path, filename: &str, value: &T) -> Result<()> {
    directory(root)?;
    let bytes = serde_json::to_vec(value).map_err(|_| "instance_write")?;
    if bytes.len() > 4 * 1024 * 1024 { return Err("instance_limit"); }
    if let Ok(meta) = fs::symlink_metadata(root.join(filename)) { if !meta.is_file() || save_files::reparse(&meta) { return Err("instance_write"); } }
    p2p_files::atomic(root, filename, &bytes).map_err(|_| "instance_write")
}
pub fn validate(value: &Instance, profile: &str, id: &str) -> Result<()> {
    if value.schema != 1 || value.id != id || !identifier(id) || value.owner != owner(profile)? || !name(&value.name) || !version(&value.game_version)
        || !["vanilla", "fabric", "quilt", "forge", "neoforge"].contains(&value.loader.as_str())
        || (value.loader != "vanilla" && !version(&value.loader_version)) || value.files > 20_000 || value.bytes > 20 * 1024 * 1024 * 1024 { return Err("instance_record"); }
    if let Some(pack) = &value.pack { if !name(&pack.name) || pack.version.len() > 200 || pack.icon.len() > 2048 || pack.project.as_ref().is_some_and(|v| !super::modrinth::identifier(v)) || pack.version_id.as_ref().is_some_and(|v| !super::modrinth::identifier(v)) { return Err("instance_record"); } }
    Ok(())
}
pub fn load(root: &Path, profile: &str, id: &str) -> Result<(PathBuf, Instance)> {
    if !identifier(id) { return Err("instance_record"); }
    super::minecraft_pack_transaction::recover(root, profile, id)?;
    let path = directory(&root.join(id))?;
    if path.parent() != Some(root) { return Err("instance_folder"); }
    let value = read::<Instance>(&path.join(RECORD))?; validate(&value, profile, id)?;
    directory(&path.join("game"))?; Ok((path, value))
}
pub fn list(profile: &str, path: &str) -> Result<Library> {
    let root = library(profile, path)?; let mut instances = Vec::new(); let mut unreadable = 0;
    for entry in fs::read_dir(&root).map_err(|_| "instance_read")?.take(1001) {
        let entry = entry.map_err(|_| "instance_read")?; let id = entry.file_name().to_string_lossy().into_owned();
        if !identifier(&id) { continue; }
        match load(&root, profile, &id) { Ok((_, value)) => instances.push(value), Err(_) => unreadable += 1 }
    }
    if instances.len() + unreadable > 200 { return Err("instance_limit"); }
    instances.sort_by(|a, b| b.created_at.cmp(&a.created_at).then(a.name.cmp(&b.name)));
    Ok(Library { path: path.into(), instances, unreadable })
}
pub struct Staging { pub root: PathBuf, pub path: PathBuf, pub committed: bool }
impl Staging {
    pub fn new(root: &Path) -> Result<Self> {
        let path = root.join(format!(".install-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&path).map_err(|_| "instance_write")?;
        fs::create_dir(path.join("game")).map_err(|_| "instance_write")?;
        Ok(Self { root: root.into(), path, committed: false })
    }
    pub fn commit(mut self, value: &Instance) -> Result<()> {
        if !identifier(&value.id) { return Err("instance_record"); }
        write(&self.path, RECORD, value)?;
        directory(&self.root)?; directory(&self.path)?;
        let target = self.root.join(&value.id); if target.symlink_metadata().is_ok() { return Err("instance_changed"); }
        fs::rename(&self.path, target).map_err(|_| "instance_write")?; self.committed = true; Ok(())
    }
}
impl Drop for Staging {
    fn drop(&mut self) {
        // Only the unique staging directory created by this operation can be removed.
        if !self.committed && self.path.parent() == Some(self.root.as_path()) && self.path.file_name().is_some_and(|v| v.to_string_lossy().starts_with(".install-")) && directory(&self.path).is_ok() { let _ = fs::remove_dir_all(&self.path); }
    }
}
#[cfg(test)]
pub fn create(profile: &str, path: &str, title: &str, game: &str) -> Result<Instance> {
    create_configured(profile, path, title, game, "vanilla", "", &std::sync::atomic::AtomicBool::new(false))
}
pub fn create_configured(profile: &str, path: &str, title: &str, game: &str, loader: &str, loader_version: &str, cancel: &std::sync::atomic::AtomicBool) -> Result<Instance> {
    if !name(title) || !version(game) { return Err("instance_request"); }
    if !matches!(loader, "vanilla" | "fabric" | "quilt" | "forge" | "neoforge") || (loader != "vanilla" && !version(loader_version)) || (loader == "vanilla" && !loader_version.is_empty()) { return Err("instance_request"); }
    if matches!(loader, "forge" | "neoforge") { super::minecraft_forge::installer_url(loader, game, loader_version)?; }
    super::minecraft_pack::canceled(cancel)?;
    let root = library(profile, path)?;
    if list(profile, path)?.instances.len() >= 200 { return Err("instance_limit"); }
    let value = Instance { schema: 1, id: uuid::Uuid::new_v4().to_string(), owner: owner(profile)?, name: title.trim().into(), game_version: game.into(), loader: loader.into(), loader_version: loader_version.into(), created_at: now(), pack: None, files: 0, bytes: 0 };
    let staging = Staging::new(&root)?; super::minecraft_pack::canceled(cancel)?; staging.commit(&value)?; Ok(value)
}
pub fn rename(profile: &str, path: &str, id: &str, title: &str) -> Result<Instance> {
    if !name(title) { return Err("instance_request"); } let root = library(profile, path)?;
    let (folder, mut value) = load(&root, profile, id)?; value.name = title.trim().into(); write(&folder, RECORD, &value)?; Ok(value)
}
pub fn game_folder(profile: &str, path: &str, id: &str) -> Result<String> {
    let root = library(profile, path)?; let (folder, _) = load(&root, profile, id)?;
    Ok(directory(&folder.join("game"))?.to_string_lossy().into_owned())
}

pub fn relative(value: &str) -> Result<PathBuf> {
    if value.len() > 1024 || value.is_empty() || value.contains('\\') || value.starts_with('/') { return Err("instance_pack_path"); }
    for part in value.split('/') { p2p_files::component(part).map_err(|_| "instance_pack_path")?; }
    Ok(PathBuf::from(value))
}
pub fn create_file(root: &Path, name: &str) -> Result<fs::File> {
    let relative = relative(name)?; let parent = relative.parent().ok_or("instance_pack_path")?;
    let mut dir = directory(root)?;
    for part in parent.components() { dir = child(&dir, part.as_os_str().to_str().ok_or("instance_pack_path")?)?; }
    fs::OpenOptions::new().write(true).create_new(true).open(root.join(relative)).map_err(|_| "instance_write")
}
pub fn copy_file(mut from: impl Read, to: &mut fs::File, size: u64) -> Result<()> {
    let copied = std::io::copy(&mut from.by_ref().take(size + 1), to).map_err(|_| "instance_write")?;
    if copied != size { return Err("instance_integrity"); } to.flush().and_then(|_| to.sync_all()).map_err(|_| "instance_write")
}
