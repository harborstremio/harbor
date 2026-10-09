use super::{minecraft_instances::{self as instances, Result}, minecraft_pack, p2p_files, save_files};
use serde::Serialize;
use sha1::Sha1;
use sha2::{Digest, Sha512};
use std::{fs, io::Read, path::{Path, PathBuf}, sync::atomic::AtomicBool, time::SystemTime};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entry { pub path: String, pub bytes: u64, pub modified: SystemTime }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Tree { pub files: Vec<Entry>, pub directories: Vec<String>, pub bytes: u64 }
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct File { pub path: String, pub bytes: u64, pub embedded: bool }

// Only for inventory/copy of an existing local instance, never for untrusted pack entries.
pub fn local_relative(value: &str) -> Result<PathBuf> {
    if value.is_empty() || value.len() > 1024 || value.contains('\\') || value.starts_with('/') { return Err("instance_pack_path"); }
    for part in value.split('/') {
        let checked = part.strip_prefix(".harbor-").map(|tail| format!("harbor-{tail}"));
        p2p_files::component(checked.as_deref().unwrap_or(part)).map_err(|_| "instance_pack_path")?;
    }
    Ok(PathBuf::from(value))
}

pub fn scan(root: &Path, cancel: &AtomicBool) -> Result<Tree> {
    fn visit(root: &Path, prefix: &str, tree: &mut Tree, cancel: &AtomicBool) -> Result<()> {
        minecraft_pack::canceled(cancel)?;
        let directory = instances::directory(&root.join(prefix))?;
        for entry in fs::read_dir(directory).map_err(|_| "instance_read")? {
            minecraft_pack::canceled(cancel)?;
            let entry = entry.map_err(|_| "instance_read")?;
            let name = entry.file_name().to_str().ok_or("instance_pack_path")?.to_owned();
            // Inventory includes Harbor metadata; exports filter it before opening files.
            local_relative(&name)?;
            let path = if prefix.is_empty() { name } else { format!("{prefix}/{name}") };
            local_relative(&path)?;
            let meta = fs::symlink_metadata(entry.path()).map_err(|_| "instance_read")?;
            if save_files::reparse(&meta) { return Err("instance_folder"); }
            if meta.is_dir() {
                tree.directories.push(path.clone()); visit(root, &path, tree, cancel)?;
            } else if meta.is_file() {
                tree.bytes = tree.bytes.checked_add(meta.len()).ok_or("instance_limit")?;
                tree.files.push(Entry { path, bytes: meta.len(), modified: meta.modified().map_err(|_| "instance_read")? });
            } else { return Err("instance_folder"); }
            if tree.files.len() + tree.directories.len() > 200_000 || tree.bytes > 256 * 1024 * 1024 * 1024 { return Err("instance_limit"); }
        } Ok(())
    }
    let mut tree = Tree { files: vec![], directories: vec![], bytes: 0 };
    visit(root, "", &mut tree, cancel)?;
    tree.files.sort_by(|a, b| a.path.cmp(&b.path)); tree.directories.sort(); Ok(tree)
}

pub fn open(root: &Path, entry: &Entry) -> Result<fs::File> {
    let file = instances::plain_file(&root.join(instances::relative(&entry.path)?), u64::MAX)?;
    let meta = file.metadata().map_err(|_| "instance_read")?;
    if meta.len() != entry.bytes || meta.modified().ok() != Some(entry.modified) { return Err("instance_changed"); }
    Ok(file)
}
pub fn hashes(root: &Path, entry: &Entry, cancel: &AtomicBool) -> Result<(String, String)> {
    if entry.bytes > minecraft_pack::MAX_FILE { return Err("instance_limit"); }
    let mut file = open(root, entry)?;
    let mut sha1 = Sha1::new(); let mut sha512 = Sha512::new(); let mut bytes = 0_u64; let mut buffer = [0_u8; 65_536];
    loop {
        minecraft_pack::canceled(cancel)?; let size = file.read(&mut buffer).map_err(|_| "instance_read")?; if size == 0 { break; }
        bytes += size as u64; if bytes > entry.bytes { return Err("instance_changed"); }
        sha1.update(&buffer[..size]); sha512.update(&buffer[..size]);
    }
    if bytes != entry.bytes || file.metadata().map_err(|_| "instance_read")?.modified().ok() != Some(entry.modified) { return Err("instance_changed"); }
    Ok((format!("{:x}", sha1.finalize()), format!("{:x}", sha512.finalize())))
}
pub fn exportable(path: &str, worlds: bool, settings: bool) -> bool {
    let path = path.to_ascii_lowercase(); let parts: Vec<_> = path.split('/').collect();
    if parts.iter().any(|part| part.starts_with(".harbor-") || matches!(*part, "session.lock" | "session.json" | "launcher_accounts.json" | "accounts.json" | "launcher_profiles.json" | "usercache.json")) { return false; }
    if ["logs", "crash-reports", "screenshots", ".runtime", ".fabric", ".cache", "natives", "libraries", "versions"].contains(&parts[0]) { return false; }
    if parts[0] == "saves" { return worlds; }
    if ["options.txt", "optionsof.txt", "servers.dat", "servers.dat_old"].contains(&path.as_str()) { return settings; }
    !path.ends_with(".mrpack") && !path.ends_with(".log")
}
pub fn output(library: &Path, value: &str) -> Result<(PathBuf, PathBuf)> {
    let path = Path::new(value);
    if value.len() > 4096 || !path.is_absolute() || !path.extension().is_some_and(|v| v.eq_ignore_ascii_case("mrpack")) { return Err("instance_export_path"); }
    let parent = instances::directory(path.parent().ok_or("instance_export_path")?)?;
    if parent.starts_with(library) { return Err("instance_export_path"); }
    let name = path.file_name().and_then(|s| s.to_str()).ok_or("instance_export_path")?;
    p2p_files::component(name).map_err(|_| "instance_export_path")?;
    let target = parent.join(name);
    match target.symlink_metadata() { Ok(_) => return Err("instance_export_exists"), Err(e) if e.kind() == std::io::ErrorKind::NotFound => (), Err(_) => return Err("instance_export_path") }
    Ok((parent, target))
}
