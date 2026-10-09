use super::{minecraft_instances::{self as instances, Result}, minecraft_runtime_data::{self as data, File, Runtime}, minecraft_pack, p2p_files, save_files};
use futures_util::{stream, StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha1::{Digest, Sha1};
use std::{collections::HashMap, fs, io::Read, path::{Path, PathBuf}, sync::{atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering}, Arc, Mutex, OnceLock}, time::{Duration, Instant}};
use tokio::io::AsyncWriteExt;

const MANIFEST: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan { pub token: String, pub instance: String, pub game: String, pub loader: String, pub loader_version: String, pub java: u32, pub files: usize, pub bytes: u64, pub cached_files: usize, pub cached_bytes: u64, pub processors: usize }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct State { pub installed: bool, pub java: Option<u32>, pub files: usize, pub bytes: u64 }
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress { pub profile: String, pub operation_id: String, pub phase: &'static str, pub name: String, pub files: usize, pub total_files: usize, pub bytes: u64, pub total_bytes: u64 }
struct ForgeWork { setup: super::minecraft_forge_data::Setup, inputs: Vec<File> }
struct Prepared { profile: String, folder: PathBuf, instance: String, created: Instant, runtime: Runtime, forge: Option<ForgeWork>, plan: Plan }
#[derive(Serialize, Deserialize)]
struct Requirement { schema: u8, owner: String, instance: String, game: String, loader: String, loader_version: String, java: u32, platform: String }
impl Requirement {
    fn new(instance: &instances::Instance, runtime: &Runtime) -> Self {
        Self { schema: 1, owner: instance.owner.clone(), instance: instance.id.clone(), game: runtime.game.clone(), loader: runtime.loader.clone(), loader_version: runtime.loader_version.clone(), java: runtime.java, platform: runtime.platform.clone() }
    }
    fn matches(&self, instance: &instances::Instance) -> bool {
        self.schema == 1 && self.owner == instance.owner && self.instance == instance.id && self.game == instance.game_version && self.loader == instance.loader && self.loader_version == instance.loader_version && self.platform == data::platform() && (8..=40).contains(&self.java)
    }
}
#[derive(Clone)]
struct Job { profile: String, id: String, cancel: Arc<AtomicBool> }
pub struct Work(Job);
impl Work { pub fn cancellation(&self) -> Arc<AtomicBool> { self.0.cancel.clone() } }
fn jobs() -> &'static Mutex<Option<Job>> { static VALUE: OnceLock<Mutex<Option<Job>>> = OnceLock::new(); VALUE.get_or_init(|| Mutex::new(None)) }
fn plans() -> &'static Mutex<HashMap<String, Prepared>> { static VALUE: OnceLock<Mutex<HashMap<String, Prepared>>> = OnceLock::new(); VALUE.get_or_init(|| Mutex::new(HashMap::new())) }
impl Drop for Work { fn drop(&mut self) { if let Ok(mut active) = jobs().lock() { if active.as_ref().is_some_and(|j| j.id == self.0.id && j.profile == self.0.profile) { *active = None; } } } }
pub fn start(profile: &str, operation: &str) -> Result<Work> {
    instances::owner(profile)?; if !instances::identifier(operation) { return Err("instance_request"); }
    let mut active = jobs().lock().map_err(|_| "instance_busy")?; if active.is_some() { return Err("instance_busy"); }
    let job = Job { profile: profile.into(), id: operation.into(), cancel: Arc::new(AtomicBool::new(false)) }; *active = Some(job.clone()); Ok(Work(job))
}
pub fn cancel(profile: &str, operation: &str) { if let Ok(active) = jobs().lock() { if let Some(job) = active.as_ref().filter(|j| j.profile == profile && j.id == operation) { job.cancel.store(true, Ordering::Relaxed); } } }
pub fn cancel_profile(profile: &str) { if let Ok(active) = jobs().lock() { if let Some(job) = active.as_ref().filter(|j| j.profile == profile) { job.cancel.store(true, Ordering::Relaxed); } } }
pub fn discard(profile: &str, token: &str) { if let Ok(mut held) = plans().lock() { if held.get(token).is_some_and(|p| p.profile == profile) { held.remove(token); } } }
pub(super) fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder().user_agent("Harbor-Games/0.9 (https://harbor.site)").connect_timeout(Duration::from_secs(10)).read_timeout(Duration::from_secs(30)).timeout(Duration::from_secs(300))
        .redirect(reqwest::redirect::Policy::custom(|a| { if a.previous().len() >= 3 || data::host(a.url().as_str()).is_err() { a.error("runtime redirect") } else { a.follow() } })).build().map_err(|_| "instance_network")
}
pub async fn cancellable<T>(cancel: &AtomicBool, future: impl std::future::Future<Output = T>) -> Result<T> {
    tokio::pin!(future); loop { minecraft_pack::canceled(cancel)?; tokio::select! { value = &mut future => { minecraft_pack::canceled(cancel)?; return Ok(value); }, _ = tokio::time::sleep(Duration::from_millis(150)) => () } }
}
pub(super) async fn bytes(client: &reqwest::Client, url: &str, max: usize, cancel: &AtomicBool) -> Result<Vec<u8>> {
    let mut response = cancellable(cancel, client.get(data::host(url)?).send()).await?.map_err(|_| "instance_network")?;
    if !response.status().is_success() { return Err(if response.status().as_u16() == 429 { "instance_rate_limit" } else { "instance_network" }); }
    if response.content_length().is_some_and(|n| n > max as u64) { return Err("runtime_limit"); }
    let mut result = Vec::new(); while let Some(chunk) = cancellable(cancel, response.chunk()).await?.map_err(|_| "instance_network")? { if result.len() + chunk.len() > max { return Err("runtime_limit"); } result.extend_from_slice(&chunk); } Ok(result)
}
async fn json(client: &reqwest::Client, url: &str, digest: Option<&str>, cancel: &AtomicBool) -> Result<Value> {
    let body = bytes(client, url, 16 * 1024 * 1024, cancel).await?;
    if digest.is_some_and(|s| !data::digest(s) || !format!("{:x}", Sha1::digest(&body)).eq_ignore_ascii_case(s)) { return Err("instance_integrity"); }
    serde_json::from_slice(&body).map_err(|_| "runtime_metadata")
}
pub fn directory(root: &Path, component: &str) -> Result<PathBuf> {
    p2p_files::component(component).map_err(|_| "instance_folder")?; instances::directory(root)?;
    let path = root.join(component); match fs::create_dir(&path) { Ok(()) => (), Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => (), Err(_) => return Err("instance_write") }
    instances::directory(&path)
}
fn runtime_folder(folder: &Path) -> Result<PathBuf> { directory(folder, ".runtime") }
pub fn verified(root: &Path, file: &File, cancel: &AtomicBool) -> Result<bool> {
    minecraft_pack::canceled(cancel)?; let target = root.join(instances::relative(&file.path)?);
    if !target.exists() { return Ok(false); }
    let mut input = match instances::plain_file(&target, data::MAX_FILE) { Ok(v) => v, Err(_) => return Err("instance_folder") };
    if input.metadata().map_err(|_| "instance_read")?.len() != file.size { return Ok(false); }
    let mut hash = Sha1::new(); let mut buffer = [0_u8; 64 * 1024];
    loop { minecraft_pack::canceled(cancel)?; let n = input.read(&mut buffer).map_err(|_| "instance_read")?; if n == 0 { break; } hash.update(&buffer[..n]); }
    Ok(format!("{:x}", hash.finalize()).eq_ignore_ascii_case(&file.sha1))
}
fn environment() -> (&'static str, &'static str, String) {
    let os = match std::env::consts::OS { "macos" => "osx", other => other };
    let arch = match std::env::consts::ARCH { "x86_64" => "amd64", other => other };
    // Only old Windows library exclusions use a version rule in supported
    // manifests. Obtain the actual version; never claim an unknown OS matches.
    #[cfg(windows)]
    let version = { #[repr(C)] struct Version { size: u32, major: u32, minor: u32, build: u32, platform: u32, text: [u16; 128] }
        #[link(name = "ntdll")] unsafe extern "system" { fn RtlGetVersion(info: *mut Version) -> i32; }
        let mut info = Version { size: std::mem::size_of::<Version>() as u32, major: 0, minor: 0, build: 0, platform: 0, text: [0;128] };
        if unsafe { RtlGetVersion(&mut info) } == 0 { format!("{}.{}.{}", info.major, info.minor, info.build) } else { String::new() } };
    #[cfg(not(windows))]
    let version = String::new();
    (os, arch, version)
}
async fn resolve_prepared(instance: &instances::Instance, cancel: &AtomicBool) -> Result<(Runtime, Option<ForgeWork>)> {
    if !matches!(instance.loader.as_str(), "vanilla" | "fabric" | "quilt" | "forge" | "neoforge") { return Err("runtime_loader"); }
    if !matches!(std::env::consts::OS, "windows" | "linux" | "macos") || !matches!(std::env::consts::ARCH, "x86_64" | "aarch64") { return Err("runtime_platform"); }
    let client = client()?; let manifest = json(&client, MANIFEST, None, cancel).await?;
    let entry = manifest["versions"].as_array().ok_or("runtime_metadata")?.iter().find(|v| v["id"].as_str() == Some(instance.game_version.as_str())).ok_or("runtime_version")?;
    let value = json(&client, data::text(entry, "url")?, Some(data::text(entry, "sha1")?), cancel).await?;
    let (os, arch, os_version) = environment(); let mut runtime = data::base(&value, instance, os, arch, &os_version)?;
    let index = json(&client, data::text(&value["assetIndex"], "url")?, Some(data::text(&value["assetIndex"], "sha1")?), cancel).await?; data::assets(&mut runtime, &index)?;
    let mut forge = None;
    if matches!(instance.loader.as_str(), "forge" | "neoforge") {
        let setup = super::minecraft_forge::prepare(&instance.loader, &instance.game_version, &instance.loader_version, cancel).await?;
        let inputs = super::minecraft_forge_profile::apply(&mut runtime, &value, &setup, os, arch, &os_version)?;
        forge = Some(ForgeWork { setup, inputs });
    } else if instance.loader != "vanilla" {
        let mut route = super::minecraft_loader::route_for(&instance.loader, &instance.game_version, Some(&instance.loader_version))?;
        route.path_segments_mut().map_err(|_| "runtime_metadata")?.extend(["profile", "json"]);
        let profile = json(&client, route.as_str(), None, cancel).await?;
        data::loader_profile(&mut runtime, &profile)?;
        // Bound provider requests while retaining the profile's classpath order.
        let libraries = profile["libraries"].as_array().ok_or("runtime_metadata")?.clone();
        let files: Vec<File> = stream::iter(libraries.into_iter().map(|library| {
            let client = client.clone(); let loader = instance.loader.clone();
            async move {
            let (path, url) = data::loader_library(&loader, &library)?;
            let sha1 = if let Some(value) = library["sha1"].as_str() { value.to_string() } else { String::from_utf8(bytes(&client, &format!("{url}.sha1"), 256, cancel).await?).map_err(|_| "runtime_metadata")?.trim().into() };
            if !data::digest(&sha1) { return Err("runtime_metadata"); }
            let size = if let Some(size) = library["size"].as_u64() { size } else {
                let response = cancellable(cancel, client.head(data::host(&url)?).send()).await?.map_err(|_| "instance_network")?;
                if !response.status().is_success() { return Err("instance_network"); }
                // A HEAD response has an empty body; reqwest's body size hint
                // can be zero even when the artifact's Content-Length is set.
                response.headers().get(reqwest::header::CONTENT_LENGTH).and_then(|v| v.to_str().ok()).and_then(|v| v.parse::<u64>().ok()).ok_or("runtime_metadata")?
            };
            Ok::<_, &'static str>(File { path, url, sha1: sha1.to_lowercase(), size })
        }})).buffered(4).try_collect().await?;
        runtime.classpath.splice(0..0, files.iter().map(|file| file.path.clone())); runtime.files.extend(files);
        for (key, to) in [("jvm", &mut runtime.jvm), ("game", &mut runtime.args)] { if !profile["arguments"][key].is_null() { to.extend(data::arguments(&profile["arguments"][key], os, arch, &os_version)?); } }
    }
    data::validate(&mut runtime)?;
    if serde_json::to_vec(&runtime).map_err(|_| "runtime_metadata")?.len() > 4 * 1024 * 1024 { return Err("runtime_limit"); }
    Ok((runtime, forge))
}
#[cfg(test)]
pub async fn resolve(instance: &instances::Instance, cancel: &AtomicBool) -> Result<Runtime> { Ok(resolve_prepared(instance, cancel).await?.0) }
pub async fn resolve_installed(instance: &instances::Instance, root: &Path, cancel: &AtomicBool) -> Result<Runtime> {
    let (mut runtime, forge) = resolve_prepared(instance, cancel).await?;
    if let Some(work) = forge {
        let receipt = instances::read::<super::minecraft_forge_process::Receipt>(&root.join("forge-receipt.json")).map_err(|_| "launch_files")?;
        super::minecraft_forge_process::matching(&receipt, &work.setup, &runtime.game, &runtime.loader, &runtime.loader_version).map_err(|_| "launch_files")?;
        runtime.files.extend(receipt.files);
        data::validate(&mut runtime)?;
    }
    Ok(runtime)
}
pub fn state(profile: &str, path: &str, id: &str) -> Result<State> {
    let root = instances::library(profile, path)?; let (folder, instance) = instances::load(&root, profile, id)?;
    let record = folder.join(".runtime/runtime.json");
    let stored = instances::read::<Runtime>(&record).ok().and_then(|mut r| { data::validate(&mut r).ok()?; Some(r) }).filter(|r| r.schema == 1 && (8..=40).contains(&r.java) && r.game == instance.game_version && r.loader == instance.loader && r.loader_version == instance.loader_version && r.platform == data::platform())
        .filter(|r| !matches!(r.loader.as_str(), "forge" | "neoforge") || super::minecraft_forge_process::recorded(&folder.join(".runtime"), r).is_ok());
    let required = instances::read::<Requirement>(&folder.join(".runtime/requirements.json")).ok().filter(|r| r.matches(&instance)).map(|r| r.java);
    Ok(match stored { Some(r) => State { installed: true, java: Some(r.java), files: r.files.len(), bytes: r.files.iter().map(|f| f.size).sum() }, None => State { installed: false, java: required, files: 0, bytes: 0 } })
}
pub async fn review(profile: String, path: String, id: String, operation: String) -> Result<Plan> {
    let work = start(&profile, &operation)?; let root = instances::library(&profile, &path)?; let (folder, instance) = instances::load(&root, &profile, &id)?;
    let (runtime, forge) = resolve_prepared(&instance, &work.0.cancel).await?; let target = runtime_folder(&folder)?;
    instances::write(&target, "requirements.json", &Requirement::new(&instance, &runtime))?;
    let held = runtime.clone(); let cancel = work.0.cancel.clone();
    let (cached_files, cached_bytes) = tauri::async_runtime::spawn_blocking(move || { let mut count = 0; let mut bytes = 0; for file in &held.files { if verified(&target, file, &cancel)? { count += 1; bytes += file.size; } } Ok::<_, &'static str>((count, bytes)) }).await.map_err(|_| "instance_read")??;
    minecraft_pack::canceled(&work.0.cancel)?;
    let plan = Plan { token: uuid::Uuid::new_v4().to_string(), instance: id.clone(), game: runtime.game.clone(), loader: runtime.loader.clone(), loader_version: runtime.loader_version.clone(), java: runtime.java, files: runtime.files.len(), bytes: runtime.files.iter().map(|f| f.size).sum(), cached_files, cached_bytes, processors: forge.as_ref().map_or(0, |work| work.setup.processors.len()) };
    let mut held = plans().lock().map_err(|_| "instance_busy")?; held.retain(|_, p| p.created.elapsed() < Duration::from_secs(900)); if held.len() >= 4 { return Err("instance_busy"); }
    held.insert(plan.token.clone(), Prepared { profile, folder, instance: id, created: Instant::now(), runtime, forge, plan: plan.clone() }); Ok(plan)
}
struct Partial(PathBuf);
impl Drop for Partial { fn drop(&mut self) { if self.0.file_name().is_some_and(|v| v.to_string_lossy().starts_with(".runtime-part-")) && self.0.parent().is_some_and(|p| instances::directory(p).is_ok()) { let _ = fs::remove_file(&self.0); } } }
async fn download(client: &reqwest::Client, root: &Path, file: &File, cancel: &AtomicBool, progress: impl Fn(u64)) -> Result<()> {
    let relative = instances::relative(&file.path)?; let mut parent = instances::directory(root)?;
    for component in relative.parent().ok_or("runtime_metadata")?.components() { parent = directory(&parent, component.as_os_str().to_str().ok_or("runtime_metadata")?)?; }
    let target = parent.join(relative.file_name().ok_or("runtime_metadata")?);
    if let Ok(meta) = fs::symlink_metadata(&target) { if !meta.is_file() || save_files::reparse(&meta) { return Err("instance_folder"); } }
    let partial = Partial(parent.join(format!(".runtime-part-{}", uuid::Uuid::new_v4())));
    let mut response = cancellable(cancel, client.get(data::host(&file.url)?).send()).await?.map_err(|_| "instance_network")?;
    if !response.status().is_success() { return Err(if response.status().as_u16() == 429 { "instance_rate_limit" } else { "instance_network" }); }
    if response.content_length().is_some_and(|n| n != file.size) { return Err("instance_integrity"); }
    let output = fs::OpenOptions::new().write(true).create_new(true).open(&partial.0).map_err(|_| "instance_write")?;
    let mut output = tokio::fs::File::from_std(output); let mut size = 0_u64; let mut hash = Sha1::new();
    while let Some(chunk) = cancellable(cancel, response.chunk()).await?.map_err(|_| "instance_network")? {
        size += chunk.len() as u64; if size > file.size { return Err("instance_integrity"); }
        hash.update(&chunk); output.write_all(&chunk).await.map_err(|_| "instance_write")?; progress(chunk.len() as u64);
    }
    if size != file.size || !format!("{:x}", hash.finalize()).eq_ignore_ascii_case(&file.sha1) { return Err("instance_integrity"); }
    output.flush().await.map_err(|_| "instance_write")?; output.sync_all().await.map_err(|_| "instance_write")?; drop(output); minecraft_pack::canceled(cancel)?;
    instances::directory(&parent)?;
    fs::rename(&partial.0, target).map_err(|_| "instance_write")?; Ok(())
}
pub async fn install(profile: String, token: String, operation: String, progress: impl Fn(Progress) + Send + Sync + 'static) -> Result<State> {
    let work = start(&profile, &operation)?;
    let prepared = { let mut held = plans().lock().map_err(|_| "instance_busy")?; if !held.get(&token).is_some_and(|p| p.profile == profile) { return Err("instance_plan"); } held.remove(&token).ok_or("instance_plan")? };
    if prepared.created.elapsed() >= Duration::from_secs(900) { return Err("instance_plan"); }
    let (_, current) = instances::load(prepared.folder.parent().ok_or("instance_folder")?, &profile, &prepared.instance)?;
    super::minecraft_launch_process::idle(&prepared.folder)?;
    if current.game_version != prepared.runtime.game || current.loader != prepared.runtime.loader || current.loader_version != prepared.runtime.loader_version { return Err("instance_changed"); }
    let java = if prepared.forge.is_some() { Some(super::minecraft_java::configured(&prepared.folder, prepared.runtime.java, &work.0.cancel).await?) } else { None };
    let root = runtime_folder(&prepared.folder)?;
    // A repair cannot keep advertising its old ready receipt while files are
    // being replaced. The verified inputs remain available for the next retry.
    if prepared.forge.is_some() && root.join("runtime.json").try_exists().map_err(|_| "instance_read")? {
        drop(instances::plain_file(&root.join("runtime.json"), 4 * 1024 * 1024)?);
        fs::remove_file(root.join("runtime.json")).map_err(|_| "instance_write")?;
    }
    let client = client()?; let count = AtomicUsize::new(0); let loaded = AtomicU64::new(0); let last_emit = Mutex::new(Instant::now() - Duration::from_secs(1));
    let emit = |name: &str, force: bool| { if let Ok(mut last) = last_emit.lock() { if force || last.elapsed() >= Duration::from_millis(120) { *last = Instant::now(); progress(Progress { profile: profile.clone(), operation_id: operation.clone(), phase: "files", name: name.into(), files: count.load(Ordering::Relaxed), total_files: prepared.plan.files, bytes: loaded.load(Ordering::Relaxed), total_bytes: prepared.plan.bytes }); } } };
    stream::iter(prepared.runtime.files.clone().into_iter().map(|file| {
        let root = &root; let client = &client; let cancel = &work.0.cancel; let count = &count; let loaded = &loaded; let emit = &emit;
        async move {
            let check_root = root.clone(); let check_file = file.clone(); let check_cancel = cancel.clone();
            let cached = tauri::async_runtime::spawn_blocking(move || verified(&check_root, &check_file, &check_cancel)).await.map_err(|_| "instance_read")??;
            if cached { loaded.fetch_add(file.size, Ordering::Relaxed); } else { download(client, root, &file, cancel, |bytes| { loaded.fetch_add(bytes, Ordering::Relaxed); emit(&file.path, false); }).await?; }
            count.fetch_add(1, Ordering::Relaxed); emit(&file.path, false); Ok::<_, &'static str>(())
        }
    })).buffer_unordered(4).try_collect::<Vec<_>>().await?;
    minecraft_pack::canceled(&work.0.cancel)?;
    emit("", true);
    let mut runtime = prepared.runtime;
    if let Some(forge) = prepared.forge {
        // Windows limits a child process's working directory even when file
        // APIs accept longer paths. Keep the stage above the profile/instance
        // IDs, inside the user's same Harbor Minecraft storage directory.
        let stage_root = prepared.folder.parent().and_then(Path::parent).ok_or("instance_folder")?;
        let receipt = super::minecraft_forge_process::install(&root, stage_root, java.as_ref().ok_or("java_invalid")?, &forge.setup, &forge.inputs, &runtime.game, &runtime.loader, &runtime.loader_version, work.0.cancel.clone(), |done, total| {
            progress(Progress { profile: profile.clone(), operation_id: operation.clone(), phase: "processors", name: String::new(), files: done, total_files: total, bytes: prepared.plan.bytes, total_bytes: prepared.plan.bytes });
        }).await?;
        runtime.files.extend(receipt.files);
        data::validate(&mut runtime)?;
    }
    minecraft_pack::canceled(&work.0.cancel)?;
    instances::write(&root, "runtime.json", &runtime)?;
    Ok(State { installed: true, java: Some(runtime.java), files: runtime.files.len(), bytes: runtime.files.iter().map(|f| f.size).sum() })
}

#[cfg(test)]
#[path = "minecraft_runtime_forge_tests.rs"]
mod forge_tests;
#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture { base: PathBuf, root: PathBuf }
    impl Fixture {
        fn new() -> Self { let base = PathBuf::from(std::env::var_os("HARBOR_GAME_TEST_ROOT").unwrap_or_else(|| std::env::temp_dir().into_os_string())); fs::create_dir_all(&base).unwrap(); let root = base.join(format!("runtime-qa-{}", uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap(); Self { base, root } }
    }
    impl Drop for Fixture { fn drop(&mut self) { let root = self.root.canonicalize().unwrap(); assert!(root.starts_with(self.base.canonicalize().unwrap())); assert!(root.file_name().unwrap().to_string_lossy().starts_with("runtime-qa-")); fs::remove_dir_all(root).unwrap(); } }
    #[test]
    fn minecraft_runtime_cache_detects_corruption_and_cancellation() {
        let fixture = Fixture::new(); let bytes = b"verified cache fixture";
        let file = File { path: "test.bin".into(), url: "https://libraries.minecraft.net/test.bin".into(), sha1: format!("{:x}", Sha1::digest(bytes)), size: bytes.len() as u64 };
        assert!(!verified(&fixture.root, &file, &AtomicBool::new(false)).unwrap());
        fs::write(fixture.root.join("test.bin"), bytes).unwrap(); assert!(verified(&fixture.root, &file, &AtomicBool::new(false)).unwrap());
        fs::write(fixture.root.join("test.bin"), b"damaged cache fixture!").unwrap(); assert!(!verified(&fixture.root, &file, &AtomicBool::new(false)).unwrap());
        assert_eq!(verified(&fixture.root, &file, &AtomicBool::new(true)).unwrap_err(), "instance_canceled");
        assert!(!fixture.root.join("runtime.json").exists());
    }
    #[tokio::test]
    #[ignore = "Explicit opt-in: downloads one small official logging configuration; no executable content"]
    async fn minecraft_runtime_download_repair_hash_and_partial_cleanup() {
        let Some(path) = std::env::var_os("HARBOR_MINECRAFT_RUNTIME_FIXTURE") else { panic!("Set the official runtime fixture directory"); };
        let value: Value = serde_json::from_slice(&fs::read(PathBuf::from(path).join("minecraft-version.json")).unwrap()).unwrap();
        let file = data::file(&value["logging"]["client"]["file"], "logging/client.xml".into()).unwrap(); assert!(file.size < 64 * 1024);
        let fixture = Fixture::new(); let client = client().unwrap(); let cancel = AtomicBool::new(false); let received = AtomicU64::new(0);
        download(&client, &fixture.root, &file, &cancel, |n| { received.fetch_add(n, Ordering::Relaxed); }).await.unwrap();
        assert_eq!(received.load(Ordering::Relaxed), file.size); assert!(verified(&fixture.root, &file, &cancel).unwrap());
        fs::write(fixture.root.join(&file.path), b"damaged").unwrap(); assert!(!verified(&fixture.root, &file, &cancel).unwrap());
        download(&client, &fixture.root, &file, &cancel, |_| {}).await.unwrap(); assert!(verified(&fixture.root, &file, &cancel).unwrap());
        let mut wrong = file.clone(); wrong.path = "logging/bad.xml".into(); wrong.sha1 = "0".repeat(40);
        assert_eq!(download(&client, &fixture.root, &wrong, &cancel, |_| {}).await.unwrap_err(), "instance_integrity"); assert!(!fixture.root.join(&wrong.path).exists());
        assert!(fs::read_dir(fixture.root.join("logging")).unwrap().all(|e| !e.unwrap().file_name().to_string_lossy().starts_with(".runtime-part-")));
        wrong.path = "logging/cancel.xml".into(); assert_eq!(download(&client, &fixture.root, &wrong, &AtomicBool::new(true), |_| {}).await.unwrap_err(), "instance_canceled"); assert!(!fixture.root.join(&wrong.path).exists());
    }
    #[tokio::test]
    #[ignore = "Explicit opt-in: tests install/repair transactions with two small official configuration downloads"]
    async fn minecraft_runtime_install_is_profile_bound_repairable_and_cancelable() {
        let fixture = Fixture::new(); let profile = "runtime-transaction-qa"; let path = fixture.root.to_str().unwrap();
        let value: Value = serde_json::from_slice(&fs::read(PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_RUNTIME_FIXTURE").expect("runtime fixture")).join("minecraft-version.json")).unwrap()).unwrap();
        let instance = instances::create(profile, path, "Transaction QA", value["id"].as_str().unwrap()).unwrap();
        let root = instances::library(profile, path).unwrap(); let (folder, _) = instances::load(&root, profile, &instance.id).unwrap();
        fs::write(folder.join("game/world-marker.txt"), b"preserve world").unwrap();
        let (os, arch, os_version) = environment(); let mut runtime = data::base(&value, &instance, os, arch, &os_version).unwrap();
        let entry = data::file(&value["logging"]["client"]["file"], "logging/one.xml".into()).unwrap(); assert!(entry.size < 64 * 1024);
        let mut second = entry.clone(); second.path = "logging/two.xml".into(); runtime.files = vec![entry, second]; runtime.classpath.clear(); runtime.natives.clear();
        let prepare = |runtime: Runtime| {
            let plan = Plan { token: uuid::Uuid::new_v4().to_string(), instance: instance.id.clone(), game: runtime.game.clone(), loader: runtime.loader.clone(), loader_version: runtime.loader_version.clone(), java: runtime.java, files: runtime.files.len(), bytes: runtime.files.iter().map(|f| f.size).sum(), cached_files: 0, cached_bytes: 0, processors: 0 };
            plans().lock().unwrap().insert(plan.token.clone(), Prepared { profile: profile.into(), folder: folder.clone(), instance: instance.id.clone(), created: Instant::now(), runtime, forge: None, plan: plan.clone() }); plan
        };
        let reviewed = prepare(runtime.clone());
        assert!(matches!(install("other-profile".into(), reviewed.token.clone(), uuid::Uuid::new_v4().to_string(), |_| {}).await, Err("instance_plan")));
        let canceled_id = uuid::Uuid::new_v4().to_string(); let cancel_id = canceled_id.clone();
        assert!(matches!(install(profile.into(), reviewed.token, canceled_id, move |_| cancel(profile, &cancel_id)).await, Err("instance_canceled")));
        assert!(!state(profile, path, &instance.id).unwrap().installed);
        let reviewed = prepare(runtime.clone()); let result = install(profile.into(), reviewed.token.clone(), uuid::Uuid::new_v4().to_string(), |_| {}).await.unwrap(); assert_eq!(result.files, 2); assert!(state(profile, path, &instance.id).unwrap().installed);
        assert!(matches!(install(profile.into(), reviewed.token, uuid::Uuid::new_v4().to_string(), |_| {}).await, Err("instance_plan")));
        let target = runtime_folder(&folder).unwrap(); fs::write(target.join("logging/one.xml"), b"corrupt").unwrap(); let reviewed = prepare(runtime.clone());
        install(profile.into(), reviewed.token, uuid::Uuid::new_v4().to_string(), |_| {}).await.unwrap();
        for file in &runtime.files { assert!(verified(&target, file, &AtomicBool::new(false)).unwrap()); }
        assert_eq!(fs::read(folder.join("game/world-marker.txt")).unwrap(), b"preserve world");
        assert!(plans().lock().unwrap().values().all(|p| p.profile != profile));
        let mut corrupt = runtime.clone(); corrupt.files[0].size = u64::MAX; instances::write(&target, "runtime.json", &corrupt).unwrap();
        assert!(!state(profile, path, &instance.id).unwrap().installed);
    }
    #[tokio::test]
    #[ignore = "Explicit opt-in: fetches current official runtime metadata, never game binaries"]
    async fn minecraft_runtime_live_metadata() {
        let instance = instances::Instance { schema: 1, id: uuid::Uuid::new_v4().to_string(), owner: instances::owner("runtime-qa").unwrap(), name: "Runtime metadata QA".into(), game_version: std::env::var("HARBOR_MINECRAFT_VERSION").unwrap_or_else(|_| "1.21.1".into()), loader: "fabric".into(), loader_version: std::env::var("HARBOR_FABRIC_VERSION").unwrap_or_else(|_| "0.16.10".into()), created_at: 0, pack: None, files: 0, bytes: 0 };
        let result = resolve(&instance, &AtomicBool::new(false)).await.unwrap(); assert!(result.files.len() > 100); assert!(result.classpath.len() > 10); assert_eq!(result.main, "net.fabricmc.loader.impl.launch.knot.KnotClient"); assert!(result.files.iter().any(|f| f.path.contains("fabric-loader")));
        println!("Official runtime metadata: {} files, {} bytes, Java {}", result.files.len(), result.files.iter().map(|f| f.size).sum::<u64>(), result.java);
    }

    #[tokio::test]
    #[ignore = "Downloads official Quilt loader libraries into an isolated fixture; no game/account launch"]
    async fn minecraft_runtime_live_quilt_libraries_and_launch_identity() {
        let versions = super::super::minecraft_loader::versions_for("quilt".into(),"1.21.1".into()).await.unwrap();
        let instance = instances::Instance { schema:1,id:uuid::Uuid::new_v4().to_string(),owner:"quilt-qa".into(),name:"Quilt runtime QA".into(),game_version:"1.21.1".into(),loader:"quilt".into(),loader_version:versions.iter().find(|v|v.stable).unwrap().version.clone(),created_at:0,pack:None,files:0,bytes:0 };
        let cancel = AtomicBool::new(false); let runtime = resolve(&instance,&cancel).await.unwrap();
        assert_eq!(runtime.main,"org.quiltmc.loader.impl.launch.knot.KnotClient"); assert_eq!(runtime.java,21);
        let libraries = runtime.files.iter().filter(|f| f.url.starts_with("https://maven.quiltmc.org/") || f.url.starts_with("https://maven.fabricmc.net/")).collect::<Vec<_>>();
        assert!(libraries.len() >= 8); assert!(libraries.iter().map(|f|f.size).sum::<u64>() < 64*1024*1024);
        let fixture = Fixture::new(); let client = client().unwrap();
        for file in &libraries { download(&client,&fixture.root,file,&cancel,|_|{}).await.unwrap(); assert!(verified(&fixture.root,file,&cancel).unwrap()); }
        let loader = libraries.iter().find(|f|f.path.contains("/quilt-loader/")).unwrap();
        let mut zip = zip::ZipArchive::new(fs::File::open(fixture.root.join(&loader.path)).unwrap()).unwrap();
        assert!(zip.by_name("org/quiltmc/loader/impl/launch/knot/KnotClient.class").is_ok());
        println!("Quilt {}: {} verified loader libraries, {} runtime files, Java {}",instance.loader_version,libraries.len(),runtime.files.len(),runtime.java);
    }
}
