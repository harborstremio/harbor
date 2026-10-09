use super::{minecraft_instances::{self as instances, Result}, minecraft_java_archive, minecraft_java_data::{self as data, Config, Java, Package}, minecraft_pack, minecraft_runtime as runtime};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{collections::HashMap, fs, path::{Path, PathBuf}, process::Stdio, sync::{atomic::AtomicBool, Arc, Mutex, OnceLock}, time::{Duration, Instant}};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct State { pub required: Option<u32>, pub configured: Option<Config>, pub compatible: bool }
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan { pub token: String, pub instance: String, pub major: u32, pub version: String, pub bytes: u64, pub name: String }
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress { pub profile: String, pub operation_id: String, pub phase: &'static str, pub bytes: u64, pub total_bytes: u64 }
struct Prepared { profile: String, path: String, instance: String, created: Instant, package: Package }
fn plans() -> &'static Mutex<HashMap<String, Prepared>> { static VALUE: OnceLock<Mutex<HashMap<String, Prepared>>> = OnceLock::new(); VALUE.get_or_init(|| Mutex::new(HashMap::new())) }
pub fn discard(profile: &str, token: &str) { if let Ok(mut held) = plans().lock() { if held.get(token).is_some_and(|p| p.profile == profile) { held.remove(token); } } }

fn saved(folder: &Path) -> Option<Config> {
    instances::read::<Config>(&folder.join("java.json")).ok().filter(|c| data::memory(c.memory_mib).is_ok() && c.java.path.len() <= 4096 && c.java.version.len() <= 200 && c.java.vendor.len() <= 200 && data::major(&c.java.version) == Some(c.java.major) && data::executable(&c.java.path).is_ok())
}
pub async fn configured(folder: &Path, required: u32, cancel: &AtomicBool) -> Result<Java> {
    let config = saved(folder).ok_or("java_invalid")?;
    let java = probe(Path::new(&config.java.path), config.java.managed, cancel).await?;
    data::compatible(&java, required)?;
    Ok(java)
}
pub fn state(profile: &str, path: &str, id: &str) -> Result<State> {
    let root = instances::library(profile, path)?; let (folder, _) = instances::load(&root, profile, id)?;
    let required = runtime::state(profile, path, id)?.java; let configured = saved(&folder);
    let compatible = configured.as_ref().zip(required).is_some_and(|(c, major)| data::compatible(&c.java, major).is_ok());
    Ok(State { required, configured, compatible })
}
fn required(profile: &str, path: &str, id: &str) -> Result<u32> { runtime::state(profile, path, id)?.java.ok_or("java_game_files") }

pub async fn probe(path: &Path, managed: bool, cancel: &AtomicBool) -> Result<Java> {
    minecraft_pack::canceled(cancel)?;
    let path = data::executable(path.to_str().ok_or("java_path")?)?;
    let mut command = tokio::process::Command::new(&path);
    command.args(["-XshowSettings:properties", "-version"]).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true);
    for key in ["JAVA_TOOL_OPTIONS", "_JAVA_OPTIONS", "JDK_JAVA_OPTIONS", "CLASSPATH"] { command.env_remove(key); }
    #[cfg(windows)] command.creation_flags(0x08000000);
    minecraft_pack::canceled(cancel)?;
    let mut child = command.spawn().map_err(|error| {
        #[cfg(test)] eprintln!("Java probe spawn failed ({error}); executable path length {}",path.as_os_str().len());
        #[cfg(not(test))] let _ = error;
        "java_invalid"
    })?;
    let stdout = child.stdout.take().ok_or("java_invalid")?; let stderr = child.stderr.take().ok_or("java_invalid")?;
    let read = async move {
        let mut out = Vec::new(); let mut err = Vec::new();
        let mut stdout = stdout.take(65537); let mut stderr = stderr.take(65537);
        let (a,b,status) = tokio::try_join!(stdout.read_to_end(&mut out), stderr.read_to_end(&mut err), child.wait()).map_err(|_| "java_invalid")?;
        if !status.success() || a > 65536 || b > 65536 {
            #[cfg(test)] eprintln!("Java probe status {status}; bounded diagnostic: {}",String::from_utf8_lossy(&err).lines().filter(|v| v.starts_with("Error") || v.starts_with("Fatal")).collect::<Vec<_>>().join(" | "));
            return Err("java_invalid");
        }
        out.extend_from_slice(&err); String::from_utf8(out).map_err(|_| "java_invalid")
    };
    let output = runtime::cancellable(cancel, tokio::time::timeout(Duration::from_secs(10), read)).await?.map_err(|_| "java_timeout")??;
    data::parse_probe(&path, &output, managed).inspect_err(|_| {
        #[cfg(test)] eprintln!("Java property parse failed: {}",output.lines().filter(|v|["java.version =", "java.vendor =", "os.arch ="].iter().any(|key|v.trim().starts_with(key))).collect::<Vec<_>>().join(" | "));
    })
}
pub async fn select(profile: String, path: String, id: String, executable: String, memory: u32, operation: String) -> Result<State> {
    let work = runtime::start(&profile, &operation)?; let cancel = work.cancellation(); let memory = data::memory(memory)?; let major = required(&profile, &path, &id)?;
    let root = instances::library(&profile, &path)?; let (folder, _) = instances::load(&root, &profile, &id)?;
    let java = probe(Path::new(&executable), false, &cancel).await?; data::compatible(&java, major)?; minecraft_pack::canceled(&cancel)?;
    super::minecraft_launch_process::idle(&folder)?;
    instances::write(&folder, "java.json", &Config { java, memory_mib: memory })?; state(&profile, &path, &id)
}
pub fn memory(profile: &str, path: &str, id: &str, memory: u32) -> Result<State> {
    let _work = runtime::start(profile, &uuid::Uuid::new_v4().to_string())?;
    let root = instances::library(profile, path)?; let (folder, _) = instances::load(&root, profile, id)?;
    let mut config = saved(&folder).ok_or("java_invalid")?; config.memory_mib = data::memory(memory)?;
    super::minecraft_launch_process::idle(&folder)?;
    instances::write(&folder, "java.json", &config)?; state(profile, path, id)
}
fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder().user_agent("Harbor-Games/0.9 (https://harbor.site)").connect_timeout(Duration::from_secs(10)).read_timeout(Duration::from_secs(30)).timeout(Duration::from_secs(300))
        .redirect(reqwest::redirect::Policy::custom(|a| { if a.previous().len() >= 5 || data::download_url(a.url().as_str(),true).is_err() { a.error("java redirect") } else { a.follow() } })).build().map_err(|_| "instance_network")
}
async fn package(major: u32, cancel: &AtomicBool) -> Result<Package> {
    let (os, arch) = data::platform()?; let route = format!("https://api.adoptium.net/v3/assets/latest/{major}/hotspot?architecture={arch}&image_type=jre&os={os}&vendor=eclipse");
    let mut response = runtime::cancellable(cancel, client()?.get(data::download_url(&route,false)?).send()).await?.map_err(|_| "instance_network")?;
    if !response.status().is_success() { return Err(if response.status().as_u16() == 404 { "java_unavailable" } else { "instance_network" }); }
    if response.content_length().is_some_and(|n| n > 1024 * 1024) { return Err("java_metadata"); }
    let mut body = Vec::new(); while let Some(chunk) = runtime::cancellable(cancel,response.chunk()).await?.map_err(|_| "instance_network")? { if body.len() + chunk.len() > 1024 * 1024 { return Err("java_metadata"); } body.extend_from_slice(&chunk); }
    data::package(&serde_json::from_slice(&body).map_err(|_| "java_metadata")?, major, os, arch)
}
pub async fn review(profile: String, path: String, id: String, operation: String) -> Result<Plan> {
    let work = runtime::start(&profile, &operation)?; let cancel = work.cancellation(); let major = required(&profile, &path, &id)?; let package = package(major, &cancel).await?;
    let token = uuid::Uuid::new_v4().to_string(); let plan = Plan { token: token.clone(), instance: id.clone(), major, version: package.version.clone(), bytes: package.bytes, name: package.name.clone() };
    let mut held = plans().lock().map_err(|_| "instance_busy")?; held.retain(|_, p| p.created.elapsed() < Duration::from_secs(900)); if held.len() >= 4 { return Err("instance_busy"); }
    held.insert(token, Prepared { profile, path, instance: id, created: Instant::now(), package }); Ok(plan)
}
struct Staging { root: PathBuf, path: PathBuf }
impl Staging {
    fn new(root: &Path) -> Result<Self> { instances::directory(root)?; let path = root.join(format!(".java-install-{}",uuid::Uuid::new_v4())); fs::create_dir(&path).map_err(|_| "instance_write")?; Ok(Self { root: root.into(), path }) }
}
impl Drop for Staging { fn drop(&mut self) { if self.path.parent() == Some(self.root.as_path()) && self.path.file_name().is_some_and(|v| v.to_string_lossy().starts_with(".java-install-")) && instances::directory(&self.path).is_ok() { let _ = fs::remove_dir_all(&self.path); } } }
struct Installed { root: PathBuf, path: PathBuf, committed: bool }
impl Installed {
    fn place(root: &Path, source: &Path, digest: &str) -> Result<Self> {
        instances::directory(root)?; instances::directory(source)?;
        let path = root.join(format!("{}-{}",&digest[..16], &uuid::Uuid::new_v4().simple().to_string()[..12]));
        if path.symlink_metadata().is_ok() { return Err("instance_changed"); }
        fs::rename(source,&path).map_err(|_| "instance_write")?; Ok(Self { root: root.into(), path, committed: false })
    }
}
impl Drop for Installed { fn drop(&mut self) { if !self.committed && self.path.parent() == Some(self.root.as_path()) && instances::directory(&self.path).is_ok() { let _ = fs::remove_dir_all(&self.path); } } }

async fn download(package: &Package, staging: &Path, cancel: &AtomicBool, progress: impl Fn(u64)) -> Result<PathBuf> {
    let file = staging.join("runtime.archive"); let output = instances::create_file(staging,"runtime.archive")?; let mut output = tokio::fs::File::from_std(output);
    let mut response = runtime::cancellable(cancel,client()?.get(data::download_url(&package.url,false)?).send()).await?.map_err(|_| "instance_network")?;
    if !response.status().is_success() { return Err("instance_network"); } if response.content_length().is_some_and(|n| n != package.bytes) { return Err("instance_integrity"); }
    let mut bytes = 0; let mut digest = Sha256::new();
    while let Some(chunk) = runtime::cancellable(cancel,response.chunk()).await?.map_err(|_| "instance_network")? { bytes += chunk.len() as u64; if bytes > package.bytes { return Err("instance_integrity"); } digest.update(&chunk); output.write_all(&chunk).await.map_err(|_| "instance_write")?; progress(bytes); }
    if bytes != package.bytes || format!("{:x}",digest.finalize()) != package.sha256 { return Err("instance_integrity"); }
    output.flush().await.map_err(|_| "instance_write")?; output.sync_all().await.map_err(|_| "instance_write")?; drop(output); minecraft_pack::canceled(cancel)?; Ok(file)
}
pub async fn install(profile: String, token: String, memory: u32, operation: String, progress: impl Fn(Progress) + Send + Sync + 'static) -> Result<State> {
    let work = runtime::start(&profile, &operation)?; let cancel = work.cancellation(); let memory = data::memory(memory)?;
    let prepared = { let mut held = plans().lock().map_err(|_| "instance_busy")?; if !held.get(&token).is_some_and(|p| p.profile == profile) { return Err("instance_plan"); } held.remove(&token).ok_or("instance_plan")? };
    if prepared.created.elapsed() >= Duration::from_secs(900) { return Err("instance_plan"); }
    if required(&profile,&prepared.path,&prepared.instance)? != prepared.package.major { return Err("instance_changed"); }
    let root = instances::library(&profile,&prepared.path)?; let (folder,_) = instances::load(&root,&profile,&prepared.instance)?;
    super::minecraft_launch_process::idle(&folder)?;
    let managed = runtime::directory(&root,".java")?; let staging = Staging::new(&managed)?;
    let progress = Arc::new(progress); let last = Mutex::new(Instant::now() - Duration::from_secs(1));
    let emit = |phase, bytes| { if let Ok(mut held) = last.lock() { if phase != "download" || bytes == prepared.package.bytes || held.elapsed() >= Duration::from_millis(120) { *held = Instant::now(); progress(Progress { profile: profile.clone(), operation_id: operation.clone(), phase, bytes, total_bytes: prepared.package.bytes }); } } };
    emit("download",0); let archive = download(&prepared.package,&staging.path,&cancel,|n| emit("download",n)).await?;
    emit("extract",prepared.package.bytes); let payload = runtime::directory(&staging.path,"runtime")?; let extract_root = payload.clone(); let extract_cancel = cancel.clone(); let zip = prepared.package.os == "windows";
    let executable = tauri::async_runtime::spawn_blocking(move || minecraft_java_archive::extract(&archive,&extract_root,zip,&extract_cancel)).await.map_err(|_| "java_archive")??;
    minecraft_pack::canceled(&cancel)?; emit("verify",prepared.package.bytes);
    let relative = executable.strip_prefix(&payload).map_err(|_| "instance_folder")?;
    let provider_root = payload.join(relative.components().next().ok_or("java_archive")?);
    let binary = executable.strip_prefix(&provider_root).map_err(|_| "instance_folder")?;
    // Probe at the final compact location. The Windows launcher can fail with
    // STATUS_BUFFER_TOO_SMALL inside a long staging/provider directory tree.
    let mut installed = Installed::place(&managed,&provider_root,&prepared.package.sha256)?;
    let java = probe(&installed.path.join(binary),true,&cancel).await?; data::compatible(&java,prepared.package.major)?;
    instances::write(&installed.path,"harbor-source.json",&prepared.package)?; minecraft_pack::canceled(&cancel)?;
    instances::write(&folder,"java.json",&Config { java, memory_mib: memory })?; installed.committed = true; state(&profile,&prepared.path,&prepared.instance)
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture { base: PathBuf, root: PathBuf }
    impl Fixture { fn new() -> Self { let base = PathBuf::from(std::env::var_os("HARBOR_GAME_TEST_ROOT").expect("explicit test root")); fs::create_dir_all(&base).unwrap(); let root = base.join(format!("java-qa-{}",uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap(); Self { base,root } } }
    impl Drop for Fixture { fn drop(&mut self) { let root = self.root.canonicalize().unwrap(); assert!(root.starts_with(self.base.canonicalize().unwrap())); assert!(root.file_name().unwrap().to_string_lossy().starts_with("java-qa-")); fs::remove_dir_all(root).unwrap(); } }
    #[tokio::test]
    #[ignore = "Explicit opt-in: probes a selected existing local Java, never launches Minecraft"]
    async fn minecraft_java_probe_existing_runtime() {
        let input = PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_JAVA_PROBE").expect("explicit executable"));
        let result = probe(&input,false,&AtomicBool::new(false)).await.unwrap(); assert!(!result.vendor.is_empty()); assert!((8..=40).contains(&result.major));
        assert_eq!(data::executable(&result.path).unwrap(),input.canonicalize().unwrap());
        assert!(matches!(probe(&input,false,&AtomicBool::new(true)).await,Err("instance_canceled")));
        println!("Selected runtime verified: Java {}, {}", result.major,result.vendor);
    }
    #[tokio::test]
    #[ignore = "Explicit opt-in: downloads and verifies official Temurin JRE, probes -version, then removes only this test fixture"]
    async fn minecraft_java_real_install_transaction() {
        use super::super::minecraft_runtime_data as game_data;
        let fixture = Fixture::new(); let path = fixture.root.to_str().unwrap(); let profile = "java-install-qa";
        let value:serde_json::Value=serde_json::from_slice(&fs::read(PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_RUNTIME_FIXTURE").expect("runtime fixture")).join("minecraft-version.json")).unwrap()).unwrap();
        let instance = instances::create(profile,path,"Java installation QA",value["id"].as_str().unwrap()).unwrap();
        let root = instances::library(profile,path).unwrap(); let (folder,_) = instances::load(&root,profile,&instance.id).unwrap();
        let os = if cfg!(target_os="macos") { "osx" } else { std::env::consts::OS }; let arch=if cfg!(target_arch="x86_64") { "amd64" } else { "aarch64" };
        let mut runtime = game_data::base(&value,&instance,os,arch,"10.0.26100").unwrap(); game_data::validate(&mut runtime).unwrap();
        instances::write(&runtime::directory(&folder,".runtime").unwrap(),"runtime.json",&runtime).unwrap();
        fs::write(folder.join("game/world-marker.txt"),b"preserve world").unwrap();
        let plan = review(profile.into(),path.into(),instance.id.clone(),uuid::Uuid::new_v4().to_string()).await.unwrap(); assert_eq!(plan.major,runtime.java);
        assert!(matches!(install("other-profile".into(),plan.token.clone(),4096,uuid::Uuid::new_v4().to_string(), |_|{}).await,Err("instance_plan")));
        let canceled = uuid::Uuid::new_v4().to_string(); let cancel_id = canceled.clone();
        assert!(matches!(install(profile.into(),plan.token,4096,canceled,move |_| runtime::cancel(profile,&cancel_id)).await,Err("instance_canceled")));
        assert!(state(profile,path,&instance.id).unwrap().configured.is_none());
        assert_eq!(fs::read_dir(root.join(".java")).unwrap().count(),0);
        let plan = review(profile.into(),path.into(),instance.id.clone(),uuid::Uuid::new_v4().to_string()).await.unwrap(); let token = plan.token.clone();
        let result = install(profile.into(),plan.token,4096,uuid::Uuid::new_v4().to_string(), |_|{}).await.unwrap(); assert!(result.compatible);
        let config = result.configured.unwrap(); assert!(config.java.managed); assert_eq!(config.java.major,runtime.java); assert_eq!(config.memory_mib,4096);
        assert!(Path::new(&config.java.path).starts_with(root.join(".java"))); assert_eq!(probe(Path::new(&config.java.path),true,&AtomicBool::new(false)).await.unwrap().major,runtime.java);
        assert!(matches!(install(profile.into(),token,4096,uuid::Uuid::new_v4().to_string(), |_|{}).await,Err("instance_plan")));
        assert_eq!(memory(profile,path,&instance.id,6144).unwrap().configured.unwrap().memory_mib,6144);
        assert!(memory(profile,path,&instance.id,99999).is_err()); assert_eq!(state(profile,path,&instance.id).unwrap().configured.unwrap().memory_mib,6144);
        let chosen=select(profile.into(),path.into(),instance.id.clone(),config.java.path,4096,uuid::Uuid::new_v4().to_string()).await.unwrap(); assert!(chosen.compatible);
        assert_eq!(fs::read(folder.join("game/world-marker.txt")).unwrap(),b"preserve world");
        assert!(fs::read_dir(root.join(".java")).unwrap().all(|e|!e.unwrap().file_name().to_string_lossy().starts_with(".java-install-")));
        println!("Official Temurin Java {} installed, probed, selected and isolated; cancellation/profile binding/one-use plans/memory verified",runtime.java);
    }
}
