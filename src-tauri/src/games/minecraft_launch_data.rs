use super::{minecraft_instances::{self as instances, Result}, minecraft_java_data, minecraft_pack, minecraft_runtime_data::Runtime};
use std::{collections::{HashMap, HashSet}, io::{Read, Write}, path::{Path, PathBuf}, sync::atomic::AtomicBool};

// Credentials are deliberately neither serializable nor Debug. They are only
// substituted into the native child command and never the JVM argument file.
pub struct Credentials { pub name: String, pub uuid: String, pub access: String, pub client: String, pub xuid: String }
pub struct Arguments { pub jvm: Vec<String>, pub game: Vec<String> }
fn expand(value: &str, values: &HashMap<&str, String>) -> Result<String> {
    let mut output = String::new(); let mut remaining = value;
    while let Some(start) = remaining.find("${") {
        output.push_str(&remaining[..start]); let tail = &remaining[start + 2..]; let end = tail.find('}').ok_or("launch_arguments")?;
        output.push_str(values.get(&tail[..end]).ok_or("launch_arguments")?); remaining = &tail[end + 1..];
    }
    output.push_str(remaining); if output.len() > 256 * 1024 || output.chars().any(char::is_control) { return Err("launch_arguments"); } Ok(output)
}
pub fn arguments(runtime: &Runtime, _game: &Path, session: &str, memory: u32, account: &Credentials) -> Result<Arguments> {
    if !instances::identifier(session) || account.name.len() < 3 || account.name.len() > 16 || !account.name.bytes().all(|b|b.is_ascii_alphanumeric() || b == b'_') || uuid::Uuid::parse_str(&account.uuid).is_err() || uuid::Uuid::parse_str(&account.client).is_err() || account.access.is_empty() || account.access.len() > 131_072 || account.access.chars().any(char::is_control) || account.xuid.is_empty() || account.xuid.len() > 20 || !account.xuid.bytes().all(|b|b.is_ascii_digit()) { return Err("minecraft_response"); }
    let memory = minecraft_java_data::memory(memory)?;
    // The process runs in game/. Relative JVM paths avoid Windows command-size
    // and non-ASCII argument-file encoding issues in old Java versions.
    let runtime_root = PathBuf::from("../.runtime");
    let classpath = std::env::join_paths(runtime.classpath.iter().map(|p| instances::relative(p).map(|p|runtime_root.join(p))).collect::<Result<Vec<_>>>()?).map_err(|_| "launch_arguments")?.into_string().map_err(|_| "launch_arguments")?;
    let values = HashMap::from([
        ("auth_player_name",account.name.clone()),("auth_uuid",uuid::Uuid::parse_str(&account.uuid).map_err(|_|"minecraft_response")?.simple().to_string()),("auth_access_token",account.access.clone()),("clientid",account.client.clone()),("auth_xuid",account.xuid.clone()),
        ("version_name",runtime.version.clone()),("version_type",runtime.version_type.clone()),("game_directory",".".into()),("assets_root","../.runtime/assets".into()),("assets_index_name",runtime.asset_index.clone()),
        ("natives_directory",format!("../.runtime/launch/{session}/natives")),("runtime_root","../.runtime".into()),("library_directory","../.runtime/libraries".into()),("classpath_separator",if cfg!(windows) { ";" } else { ":" }.into()),
        ("launcher_name","Harbor".into()),("launcher_version",env!("CARGO_PKG_VERSION").into()),("classpath",classpath),("user_type","msa".into()),("user_properties","{}".into())
    ]);
    if runtime.jvm.iter().any(|v|v.contains("${auth_") || v.contains("${clientid}")) { return Err("launch_arguments"); }
    let mut jvm = runtime.jvm.iter().map(|v|expand(v,&values)).collect::<Result<Vec<_>>>()?;
    jvm.push("-Xms512M".into()); jvm.push(format!("-Xmx{memory}M"));
    if runtime.main.is_empty() || runtime.main.len()>256 || !runtime.main.bytes().all(|b|b.is_ascii_alphanumeric() || b"._$".contains(&b)) { return Err("launch_arguments"); }
    jvm.push(runtime.main.clone());
    let game = runtime.args.iter().map(|v|expand(v,&values)).collect::<Result<Vec<_>>>()?; Ok(Arguments { jvm, game })
}
pub fn argument_file(values: &[String]) -> Result<String> {
    let mut result = String::new();
    for value in values {
        if !value.is_ascii() || value.chars().any(char::is_control) || value.len()>256*1024 { return Err("launch_arguments"); }
        result.push('"'); for c in value.chars() { if c == '\\' || c == '"' { result.push('\\'); } result.push(c); } result.push_str("\"\n");
    } if result.len()>512*1024 { return Err("launch_arguments"); } Ok(result)
}
pub fn native_libraries(runtime: &Runtime, root: &Path, output: &Path, cancel: &AtomicBool) -> Result<()> {
    let mut paths = HashSet::new(); let mut bytes = 0_u64; let mut count = 0;
    for archive in &runtime.natives {
        minecraft_pack::canceled(cancel)?;
        let mut zip = zip::ZipArchive::new(instances::plain_file(&root.join(instances::relative(archive)?),512*1024*1024)?).map_err(|_| "launch_natives")?;
        if zip.len()>4096 { return Err("launch_natives"); }
        for i in 0..zip.len() {
            minecraft_pack::canceled(cancel)?; let mut entry = zip.by_index(i).map_err(|_| "launch_natives")?;
            let name = entry.name().trim_end_matches('/').to_owned(); let path = instances::relative(&name)?;
            let mode = entry.unix_mode().unwrap_or(0o100644) & 0o170000;
            if mode != 0 && mode != if entry.is_dir() { 0o040000 } else { 0o100000 } { return Err("launch_natives"); }
            if entry.is_dir() || name.starts_with("META-INF/") { continue; }
            count += 1; bytes = bytes.checked_add(entry.size()).ok_or("launch_natives")?;
            if count>4096 || entry.size()>128*1024*1024 || bytes>512*1024*1024 || !paths.insert(name.to_ascii_lowercase()) { return Err("launch_natives"); }
            let mut out = instances::create_file(output,path.to_str().ok_or("launch_natives")?)?;
            let expected = entry.size(); let mut copied=0_u64; let mut buffer=[0_u8;64*1024];
            loop { minecraft_pack::canceled(cancel)?; let n=entry.read(&mut buffer).map_err(|_|"launch_natives")?;if n==0{break;} copied+=n as u64;if copied>expected{return Err("launch_natives");}out.write_all(&buffer[..n]).map_err(|_|"instance_write")?; }
            if copied!=expected{return Err("launch_natives");}out.flush().and_then(|_|out.sync_all()).map_err(|_|"instance_write")?;
            #[cfg(unix)] { use std::{fs, os::unix::fs::PermissionsExt}; fs::set_permissions(output.join(path),fs::Permissions::from_mode(0o755)).map_err(|_|"instance_write")?; }
        }
    } Ok(())
}


pub struct LogLines { buffer: Vec<u8>, oversized: bool, secrets: Vec<String> }
impl LogLines {
    pub fn new(secrets: Vec<String>) -> Self { Self { buffer:Vec::new(),oversized:false,secrets:secrets.into_iter().filter(|s|!s.is_empty()).collect() } }
    fn line(&mut self) -> Option<String> {
        if self.oversized { self.buffer.clear();self.oversized=false;return None; }
        let mut text = String::from_utf8_lossy(&self.buffer).into_owned(); self.buffer.clear();
        for secret in &self.secrets { text=text.replace(secret,"[redacted]"); }
        Some(text.chars().filter(|c|!c.is_control() || *c=='\t').collect())
    }
    pub fn feed(&mut self, bytes: &[u8]) -> Vec<String> {
        let mut lines=Vec::new();for b in bytes { if *b==b'\n' { if let Some(line)=self.line(){lines.push(line);} } else if !self.oversized { if self.buffer.len()>=64*1024 {self.buffer.clear();self.oversized=true;}else{self.buffer.push(*b);} } } lines
    }
    pub fn finish(&mut self) -> Option<String> { if self.buffer.is_empty() || self.oversized {self.buffer.clear();None}else{self.line()} }
}
