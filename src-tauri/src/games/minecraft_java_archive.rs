use super::{minecraft_instances::{self as instances, Result}, minecraft_java_data as data, minecraft_pack, minecraft_runtime};
use std::{collections::{HashMap, HashSet}, fs, io::{Read, Write}, path::{Path, PathBuf}, sync::atomic::AtomicBool};

const MAX_ENTRIES: usize = 20_000;
const MAX_FILE: u64 = 512 * 1024 * 1024;
struct Entries { names: HashSet<String>, files: HashSet<String>, count: usize, bytes: u64 }
impl Entries {
    fn new() -> Self { Self { names: HashSet::new(), files: HashSet::new(), count: 0, bytes: 0 } }
    fn add(&mut self, name: &str, directory: bool, size: u64) -> Result<PathBuf> {
        let path = instances::relative(name)?; let key = name.to_ascii_lowercase(); self.count += 1;
        self.bytes = self.bytes.checked_add(size).ok_or("java_archive")?;
        if self.count > MAX_ENTRIES || self.bytes > data::MAX_UNPACKED || size > MAX_FILE || !self.names.insert(key.clone()) { return Err("java_archive"); }
        let mut parent = path.parent();
        while let Some(p) = parent { if self.files.contains(&p.to_string_lossy().replace('\\', "/").to_ascii_lowercase()) { return Err("java_archive"); } parent = p.parent(); }
        if !directory {
            if self.names.iter().any(|p| p.starts_with(&format!("{key}/"))) { return Err("java_archive"); }
            self.files.insert(key);
        } Ok(path)
    }
}
fn directory(root: &Path, relative: &Path) -> Result<()> {
    let mut current = root.to_path_buf(); for part in relative.components() { current = minecraft_runtime::directory(&current, part.as_os_str().to_str().ok_or("java_archive")?)?; } Ok(())
}
fn copy(mut input: impl Read, root: &Path, name: &str, size: u64, mode: u32, cancel: &AtomicBool) -> Result<()> {
    let mut output = instances::create_file(root, name)?; let mut written = 0; let mut buffer = [0_u8; 64 * 1024];
    loop { minecraft_pack::canceled(cancel)?; let n = input.read(&mut buffer).map_err(|_| "java_archive")?; if n == 0 { break; } written += n as u64; if written > size { return Err("java_archive"); } output.write_all(&buffer[..n]).map_err(|_| "instance_write")?; }
    if written != size { return Err("java_archive"); } output.flush().and_then(|_| output.sync_all()).map_err(|_| "instance_write")?;
    #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; output.set_permissions(fs::Permissions::from_mode(if mode & 0o111 != 0 { 0o755 } else { 0o644 })).map_err(|_| "instance_write")?; }
    #[cfg(not(unix))] let _ = mode;
    Ok(())
}
fn link_target(name: &str, target: &str, hard: bool) -> Result<String> {
    if target.contains('\\') || target.starts_with('/') || target.len() > 1024 { return Err("java_archive"); }
    let mut parts: Vec<&str> = if hard { Vec::new() } else { name.split('/').collect() }; if !hard { parts.pop(); }
    for part in target.split('/') { match part { "" | "." => (), ".." => { if parts.pop().is_none() { return Err("java_archive"); } }, other => parts.push(other) } }
    let result = parts.join("/"); instances::relative(&result)?;
    // A runtime archive must never link outside its single provider directory.
    if name.split('/').next() != result.split('/').next() || name == result { return Err("java_archive"); } Ok(result)
}
pub fn extract(archive: &Path, root: &Path, zip: bool, cancel: &AtomicBool) -> Result<PathBuf> {
    instances::directory(root)?; let input = instances::plain_file(archive, data::MAX_ARCHIVE)?; let mut entries = Entries::new();
    if zip {
        let mut reader = zip::ZipArchive::new(input).map_err(|_| "java_archive")?;
        if reader.len() > MAX_ENTRIES { return Err("java_archive"); }
        for i in 0..reader.len() {
            minecraft_pack::canceled(cancel)?; let mut item = reader.by_index(i).map_err(|_| "java_archive")?;
            let name = item.name().trim_end_matches('/').to_string(); let mode = item.unix_mode().unwrap_or(0o100644); let is_dir = item.is_dir();
            if mode & 0o170000 != 0 && mode & 0o170000 != if is_dir { 0o040000 } else { 0o100000 } { return Err("java_archive"); }
            let path = entries.add(&name, is_dir, if is_dir { 0 } else { item.size() })?;
            if is_dir { directory(root, &path)?; } else { let size = item.size(); copy(&mut item, root, &name, size, mode, cancel)?; }
        }
    } else {
        let mut reader = tar::Archive::new(flate2::read::GzDecoder::new(input)); let mut links = HashMap::new();
        for item in reader.entries().map_err(|_| "java_archive")? {
            minecraft_pack::canceled(cancel)?; let mut item = item.map_err(|_| "java_archive")?;
            let name = item.path().map_err(|_| "java_archive")?.to_str().ok_or("java_archive")?.trim_end_matches('/').to_string();
            let kind = item.header().entry_type(); let size = item.size(); let mode = item.header().mode().map_err(|_| "java_archive")?;
            if !(kind.is_file() || kind.is_dir() || kind.is_symlink() || kind.is_hard_link()) { return Err("java_archive"); }
            let path = entries.add(&name, kind.is_dir(), if kind.is_file() { size } else { 0 })?;
            if kind.is_dir() { directory(root, &path)?; }
            else if kind.is_file() { copy(&mut item, root, &name, size, mode, cancel)?; }
            else { let target = item.link_name().map_err(|_| "java_archive")?.ok_or("java_archive")?; let target = link_target(&name, target.to_str().ok_or("java_archive")?, kind.is_hard_link())?; links.insert(name, target); }
        }
        // Materialize only internal regular-file links. No live symlink enters
        // the managed runtime, so later path validation has the same contract.
        for (name, first) in &links {
            minecraft_pack::canceled(cancel)?; let mut target = first; let mut seen = HashSet::new();
            while let Some(next) = links.get(target) { if !seen.insert(target) { return Err("java_archive"); } target = next; }
            let input = instances::plain_file(&root.join(instances::relative(target)?), MAX_FILE)?; let metadata = input.metadata().map_err(|_| "java_archive")?;
            entries.bytes = entries.bytes.checked_add(metadata.len()).ok_or("java_archive")?; if entries.bytes > data::MAX_UNPACKED { return Err("java_archive"); }
            #[cfg(unix)] let mode = { use std::os::unix::fs::PermissionsExt; metadata.permissions().mode() };
            #[cfg(not(unix))] let mode = 0o644;
            copy(input, root, name, metadata.len(), mode, cancel)?;
        }
    }
    let mut roots = fs::read_dir(root).map_err(|_| "java_archive")?; let top = roots.next().ok_or("java_archive")?.map_err(|_| "java_archive")?.path();
    if roots.next().is_some() { return Err("java_archive"); } instances::directory(&top)?;
    let executable = top.join(if cfg!(windows) { "bin/java.exe" } else if cfg!(target_os = "macos") { "Contents/Home/bin/java" } else { "bin/java" });
    instances::plain_file(&executable, MAX_FILE)?; Ok(executable)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn minecraft_java_archive_rejects_collisions_and_escaping_links() {
        for name in ["../java.exe", "C:/java.exe", "runtime/../java.exe", "runtime\\bin\\java", "/runtime"] { assert!(Entries::new().add(name,false,1).is_err()); }
        let mut list = Entries::new(); list.add("runtime/bin/java",false,1).unwrap(); assert!(list.add("runtime/BIN/JAVA",false,1).is_err()); assert!(list.add("runtime/bin/java/file",false,1).is_err()); assert!(list.add("runtime/bin",false,1).is_err());
        assert!(Entries::new().add("runtime/large",false,MAX_FILE+1).is_err());
        assert_eq!(link_target("runtime/legal/java.desktop/LICENSE","../java.base/LICENSE",false).unwrap(),"runtime/legal/java.base/LICENSE");
        for target in ["../../outside", "/etc/passwd", "C:/file"] { assert!(link_target("runtime/bin/java",target,false).is_err()); }
    }
    #[test] fn minecraft_java_archives_extract_bytes_and_materialize_internal_links() {
        let base = PathBuf::from(std::env::var_os("HARBOR_GAME_TEST_ROOT").unwrap_or_else(|| std::env::temp_dir().into_os_string())); fs::create_dir_all(&base).unwrap();
        let root = base.join(format!("java-archive-qa-{}",uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap();
        let binary = if cfg!(windows) { "runtime/bin/java.exe" } else if cfg!(target_os="macos") { "runtime/Contents/Home/bin/java" } else { "runtime/bin/java" };
        let archive = root.join("runtime.zip"); let mut zip = zip::ZipWriter::new(fs::File::create(&archive).unwrap()); let opts = zip::write::SimpleFileOptions::default();
        zip.start_file(binary,opts).unwrap(); zip.write_all(b"java fixture").unwrap(); zip.start_file("runtime/legal/LICENSE",opts).unwrap(); zip.write_all(b"license preserved").unwrap(); zip.finish().unwrap();
        let dest = minecraft_runtime::directory(&root,"zip").unwrap(); let executable = extract(&archive,&dest,true,&AtomicBool::new(false)).unwrap(); assert_eq!(fs::read(executable).unwrap(),b"java fixture"); assert_eq!(fs::read(dest.join("runtime/legal/LICENSE")).unwrap(),b"license preserved");
        let dest = minecraft_runtime::directory(&root,"canceled").unwrap(); assert!(matches!(extract(&archive,&dest,true,&AtomicBool::new(true)),Err("instance_canceled"))); assert_eq!(fs::read_dir(dest).unwrap().count(),0);
        let archive = root.join("runtime.tar.gz"); let gzip = flate2::write::GzEncoder::new(fs::File::create(&archive).unwrap(),flate2::Compression::default()); let mut tar = tar::Builder::new(gzip);
        for (name,bytes) in [(binary,b"java fixture".as_slice()),("runtime/legal/java.base/LICENSE",b"license preserved")] { let mut header = tar::Header::new_gnu(); header.set_size(bytes.len() as u64); header.set_mode(0o755); header.set_cksum(); tar.append_data(&mut header,name,bytes).unwrap(); }
        let mut header = tar::Header::new_gnu(); header.set_entry_type(tar::EntryType::Symlink); header.set_size(0); header.set_mode(0o777); header.set_cksum(); tar.append_link(&mut header,"runtime/legal/java.desktop/LICENSE","../java.base/LICENSE").unwrap(); tar.into_inner().unwrap().finish().unwrap();
        let dest = minecraft_runtime::directory(&root,"tar").unwrap(); extract(&archive,&dest,false,&AtomicBool::new(false)).unwrap(); let link = dest.join("runtime/legal/java.desktop/LICENSE"); assert_eq!(fs::read(&link).unwrap(),b"license preserved"); assert!(fs::symlink_metadata(link).unwrap().is_file());
        let held = root.canonicalize().unwrap(); assert!(held.starts_with(base.canonicalize().unwrap())); assert!(held.file_name().unwrap().to_string_lossy().starts_with("java-archive-qa-")); fs::remove_dir_all(held).unwrap();
    }
}
