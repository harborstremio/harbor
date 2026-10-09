use super::{minecraft_instances::{self as instances, Instance, PackSource, Result}, minecraft_pack::{self as pack, Parsed, ReviewFile, Temporary}, modrinth};
use serde::Serialize;
use sha2::{Digest, Sha512};
use std::{collections::{HashMap, HashSet}, fs, path::{Path, PathBuf}, sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex, OnceLock}, time::{Duration, Instant}};
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub token: String, pub name: String, pub version: String, pub summary: String, pub game_version: String,
    pub loader: String, pub loader_version: String, pub files: Vec<ReviewFile>, pub override_count: usize,
    pub override_bytes: u64, pub skipped: usize, pub source: Option<PackSource>,
}
pub(super) struct Prepared { pub(super) profile: String, pub(super) root: PathBuf, pub(super) archive: PathBuf, pub(super) parsed: Parsed, pub(super) plan: Plan, created: Instant, _temporary: Option<Temporary> }
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress { pub profile: String, pub operation_id: String, pub phase: &'static str, pub name: String, pub bytes: u64, pub total_bytes: u64, pub files: usize, pub total_files: usize }
struct Job { profile: String, id: String, cancel: Arc<AtomicBool> }
struct Work(Job);
fn jobs() -> &'static Mutex<Option<Job>> { static VALUE: OnceLock<Mutex<Option<Job>>> = OnceLock::new(); VALUE.get_or_init(|| Mutex::new(None)) }
fn plans() -> &'static Mutex<HashMap<String, Prepared>> { static VALUE: OnceLock<Mutex<HashMap<String, Prepared>>> = OnceLock::new(); VALUE.get_or_init(|| Mutex::new(HashMap::new())) }
impl Drop for Work { fn drop(&mut self) { if let Ok(mut job) = jobs().lock() { if job.as_ref().is_some_and(|j| j.id == self.0.id && j.profile == self.0.profile) { *job = None; } } } }
fn start(profile: &str, id: &str) -> Result<Work> {
    start_with(profile, id, None)
}
fn start_with(profile: &str, id: &str, cancel: Option<Arc<AtomicBool>>) -> Result<Work> {
    instances::owner(profile)?; if !instances::identifier(id) { return Err("instance_request"); }
    let mut active = jobs().lock().map_err(|_| "instance_busy")?;
    if active.is_some() { return Err("instance_busy"); }
    let job = Job { profile: profile.into(), id: id.into(), cancel: cancel.unwrap_or_else(|| Arc::new(AtomicBool::new(false))) };
    *active = Some(Job { profile: job.profile.clone(), id: job.id.clone(), cancel: job.cancel.clone() }); Ok(Work(job))
}
pub fn cancel(profile: &str, id: &str) { if let Ok(job) = jobs().lock() { if let Some(job) = job.as_ref().filter(|j| j.profile == profile && j.id == id) { job.cancel.store(true, Ordering::Relaxed); } } }
pub fn discard(profile: &str, token: &str) { if let Ok(mut plans) = plans().lock() { if plans.get(token).is_some_and(|p| p.profile == profile) { plans.remove(token); } } }
pub(super) fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder().user_agent("Harbor-Games/0.9 (https://harbor.site)").connect_timeout(Duration::from_secs(10)).read_timeout(Duration::from_secs(25)).timeout(Duration::from_secs(300))
        .redirect(reqwest::redirect::Policy::custom(|attempt| { if attempt.previous().len() >= 4 || pack::download_url(attempt.url().as_str()).is_err() { attempt.error("unsupported pack redirect") } else { attempt.follow() } }))
        .build().map_err(|_| "instance_network")
}
async fn cancellable<T>(cancel: &AtomicBool, future: impl std::future::Future<Output = T>) -> Result<T> {
    tokio::pin!(future);
    loop { pack::canceled(cancel)?; tokio::select! { value = &mut future => { pack::canceled(cancel)?; return Ok(value); }, _ = tokio::time::sleep(Duration::from_millis(150)) => () } }
}
pub(super) async fn download(client: &reqwest::Client, urls: &[String], target: &Path, bytes: u64, digest: &str, cancel: &AtomicBool, mut progress: impl FnMut(u64)) -> Result<()> {
    if bytes > pack::MAX_FILE || digest.len() != 128 { return Err("instance_limit"); }
    let mut last = "instance_network";
    for url in urls.iter().filter_map(|v| pack::download_url(v).ok()) {
        pack::canceled(cancel)?;
        let mut response = match cancellable(cancel, client.get(url).send()).await? { Ok(value) => value, Err(_) => { last = "instance_network"; continue; } };
        if !response.status().is_success() { last = if response.status().as_u16() == 429 { "instance_rate_limit" } else { "instance_network" }; continue; }
        if response.content_length().is_some_and(|n| n > bytes) { last = "instance_integrity"; continue; }
        // A failed mirror never leaves a partially downloaded final file.
        let attempt = async {
            let file = fs::OpenOptions::new().write(true).create_new(true).open(target).map_err(|_| "instance_write")?;
            let mut file = tokio::fs::File::from_std(file); let mut hash = Sha512::new(); let mut size = 0_u64; let mut last_emit = Instant::now();
            while let Some(chunk) = cancellable(cancel, response.chunk()).await?.map_err(|_| "instance_network")? {
                size += chunk.len() as u64; if size > bytes { return Err("instance_integrity"); }
                hash.update(&chunk); file.write_all(&chunk).await.map_err(|_| "instance_write")?;
                if last_emit.elapsed() >= Duration::from_millis(100) { progress(size); last_emit = Instant::now(); }
            }
            if size != bytes || !format!("{:x}", hash.finalize()).eq_ignore_ascii_case(digest) { return Err("instance_integrity"); }
            file.flush().await.map_err(|_| "instance_write")?; file.sync_all().await.map_err(|_| "instance_write")?; progress(size); Ok(())
        }.await;
        match attempt { Ok(()) => return Ok(()), Err(reason) => { let _ = fs::remove_file(target); if reason == "instance_canceled" || reason == "instance_write" { return Err(reason); } last = reason; } }
    }
    Err(last)
}
fn emit(app: &tauri::AppHandle, work: &Work, phase: &'static str, name: &str, bytes: u64, total: u64, files: usize, count: usize) {
    let _ = app.emit("games:minecraft-progress", Progress { profile: work.0.profile.clone(), operation_id: work.0.id.clone(), phase, name: name.into(), bytes, total_bytes: total, files, total_files: count });
}
async fn remote(app: &tauri::AppHandle, work: &Work, root: &Path, version: &str) -> Result<(PathBuf, PackSource, Temporary)> {
    if !modrinth::identifier(version) { return Err("instance_request"); }
    let api = modrinth::client().map_err(|_| "instance_network")?;
    let value = cancellable(&work.0.cancel, modrinth::json(&api, reqwest::Url::parse(&format!("{}/version/{version}", modrinth::API)).map_err(|_| "instance_request")?)).await?.map_err(|_| "instance_network")?;
    let project = value["project_id"].as_str().filter(|v| modrinth::identifier(v)).ok_or("instance_pack_format")?;
    if value["id"].as_str() != Some(version) { return Err("instance_pack_format"); }
    let detail = cancellable(&work.0.cancel, modrinth::json(&api, reqwest::Url::parse(&format!("{}/project/{project}", modrinth::API)).map_err(|_| "instance_request")?)).await?.map_err(|_| "instance_network")?;
    if detail["id"].as_str() != Some(project) || detail["project_type"].as_str() != Some("modpack") { return Err("instance_pack_format"); }
    let files = value["files"].as_array().ok_or("instance_pack_format")?;
    let file = files.iter().find(|v| v["primary"].as_bool() == Some(true)).or_else(|| (files.len() == 1).then(|| &files[0])).ok_or("instance_pack_format")?;
    let bytes = file["size"].as_u64().filter(|n| *n > 0 && *n <= pack::MAX_ARCHIVE).ok_or("instance_limit")?;
    let digest = file["hashes"]["sha512"].as_str().filter(|v| v.len() == 128 && v.bytes().all(|b| b.is_ascii_hexdigit())).ok_or("instance_pack_format")?;
    let url = pack::download_url(file["url"].as_str().ok_or("instance_pack_source")?)?;
    if url.host_str() != Some("cdn.modrinth.com") || !url.path().starts_with(&format!("/data/{project}/versions/{version}/")) || !file["filename"].as_str().is_some_and(|v| v.ends_with(".mrpack")) { return Err("instance_pack_source"); }
    let path = root.join(format!(".pack-{}.mrpack", uuid::Uuid::new_v4())); let temporary = Temporary(path.clone());
    let source = PackSource { name: detail["title"].as_str().filter(|v| instances::name(v)).ok_or("instance_pack_format")?.into(), version: value["version_number"].as_str().unwrap_or(version).chars().take(200).collect(), project: Some(project.into()), version_id: Some(version.into()), icon: detail["icon_url"].as_str().filter(|v| reqwest::Url::parse(v).is_ok_and(|u| u.scheme() == "https" && u.host_str() == Some("cdn.modrinth.com") && u.username().is_empty() && u.password().is_none())).unwrap_or("").chars().take(2048).collect() };
    emit(app, work, "pack", &source.name, 0, bytes, 0, 1);
    download(&client()?, &[url.into()], &path, bytes, digest, &work.0.cancel, |n| emit(app, work, "pack", &source.name, n, bytes, 0, 1)).await?;
    Ok((path, source, temporary))
}
pub async fn review(app: tauri::AppHandle, profile: String, path: String, source: String, remote_version: bool, operation: String) -> Result<Plan> {
    prepare(app, profile, path, source, remote_version, operation, true, None).await
}
pub(super) async fn prepare(app: tauri::AppHandle, profile: String, path: String, source: String, remote_version: bool, operation: String, new_instance: bool, cancel: Option<Arc<AtomicBool>>) -> Result<Plan> {
    let work = start_with(&profile, &operation, cancel)?; pack::canceled(&work.0.cancel)?; let root = instances::library(&profile, &path)?;
    if new_instance && instances::list(&profile, &path)?.instances.len() >= 200 { return Err("instance_limit"); }
    let (archive, source, temporary) = if remote_version { let (file, info, guard) = remote(&app, &work, &root, &source).await?; (file, Some(info), Some(guard)) } else {
        let file = PathBuf::from(source); if file.extension().is_none_or(|v| !v.eq_ignore_ascii_case("mrpack")) { return Err("instance_pack_format"); } instances::plain_file(&file, pack::MAX_ARCHIVE)?; (file, None, None)
    };
    emit(&app, &work, "review", "", 0, 0, 0, 0);
    let held = archive.clone(); let cancel = work.0.cancel.clone();
    let parsed = tauri::async_runtime::spawn_blocking(move || pack::parse(&held, &cancel)).await.map_err(|_| "instance_pack_format")??;
    pack::canceled(&work.0.cancel)?;
    let plan = Plan { token: uuid::Uuid::new_v4().to_string(), name: parsed.index.name.clone(), version: parsed.index.version_id.clone(), summary: parsed.index.summary.clone(), game_version: parsed.index.dependencies["minecraft"].clone(), loader: parsed.loader.clone(), loader_version: parsed.loader_version.clone(), files: parsed.files.iter().map(|f| ReviewFile { path: f.path.clone(), bytes: f.file_size, optional: f.env.get("client").is_some_and(|v| v == "optional") }).collect(), override_count: parsed.overrides.len(), override_bytes: parsed.overrides.iter().map(|f| f.bytes).sum(), skipped: parsed.skipped, source };
    let mut plans = plans().lock().map_err(|_| "instance_busy")?;
    plans.retain(|_, p| p.created.elapsed() < Duration::from_secs(900)); if plans.len() >= 4 { return Err("instance_busy"); }
    plans.insert(plan.token.clone(), Prepared { profile, root, archive, parsed, plan: plan.clone(), created: Instant::now(), _temporary: temporary }); Ok(plan)
}
pub(super) fn take(profile: &str, token: &str) -> Result<Prepared> {
    let prepared = { let mut plans = plans().lock().map_err(|_| "instance_busy")?; if !plans.get(token).is_some_and(|p| p.profile == profile) { return Err("instance_plan"); } plans.remove(token).ok_or("instance_plan")? };
    if prepared.created.elapsed() > Duration::from_secs(900) { return Err("instance_plan"); }
    Ok(prepared)
}
pub async fn install(app: tauri::AppHandle, profile: String, token: String, title: String, optional: Vec<String>, operation: String) -> Result<Instance> {
    let work = start(&profile, &operation)?;
    if !instances::name(&title) { return Err("instance_request"); }
    let prepared = take(&profile, &token)?;
    instances::directory(&prepared.root)?;
    let chosen: HashSet<_> = optional.into_iter().collect();
    if chosen.len() > 10_000 || chosen.iter().any(|p| !prepared.plan.files.iter().any(|f| &f.path == p && f.optional)) { return Err("instance_request"); }
    let archive = prepared.archive.clone(); let cancel = work.0.cancel.clone();
    let hash = tauri::async_runtime::spawn_blocking(move || pack::hash(&archive, &cancel)).await.map_err(|_| "instance_read")??;
    if hash != prepared.parsed.sha512 { return Err("instance_changed"); }
    let selected = chosen.clone(); let cancel = work.0.cancel.clone();
    let (prepared, receipt) = tauri::async_runtime::spawn_blocking(move || {
        let receipt = super::minecraft_pack_state::manifest(&prepared.parsed, &prepared.archive, &selected, &cancel)?;
        Ok::<_, &'static str>((prepared, receipt))
    }).await.map_err(|_| "instance_read")??;
    let staging = instances::Staging::new(&prepared.root)?; let game = staging.path.join("game");
    let files: Vec<_> = prepared.parsed.files.iter().filter(|f| f.env.get("client").is_none_or(|v| v != "optional") || chosen.contains(&f.path)).collect();
    let total = files.iter().map(|f| f.file_size).sum::<u64>() + prepared.plan.override_bytes;
    let count = files.len() + prepared.parsed.overrides.len(); let mut done = 0_u64;
    let client = client()?;
    for (i, file) in files.iter().enumerate() {
        pack::canceled(&work.0.cancel)?;
        // Create parents with the same path/reparse checks as archive extraction.
        let placeholder = instances::create_file(&game, &file.path)?; drop(placeholder);
        let target = game.join(instances::relative(&file.path)?); fs::remove_file(&target).map_err(|_| "instance_write")?;
        download(&client, &file.downloads, &target, file.file_size, &file.hashes["sha512"], &work.0.cancel, |n| emit(&app, &work, "files", &file.path, done + n, total, i, count)).await?;
        done += file.file_size;
    }
    emit(&app, &work, "overrides", "", done, total, files.len(), count);
    let archive = prepared.archive.clone(); let destination = game.clone(); let entries = prepared.parsed.overrides.clone(); let cancel = work.0.cancel.clone();
    tauri::async_runtime::spawn_blocking(move || pack::extract(&archive, &destination, &entries, &cancel)).await.map_err(|_| "instance_write")??;
    pack::canceled(&work.0.cancel)?;
    // Keep provenance beside the instance record; it can never overwrite game files.
    instances::write(&staging.path, "pack-index.json", &prepared.parsed.index)?;
    instances::write(&staging.path, super::minecraft_pack_state::RECORD, &receipt)?;
    let value = Instance { schema: 1, id: uuid::Uuid::new_v4().to_string(), owner: instances::owner(&profile)?, name: title.trim().into(), game_version: prepared.plan.game_version.clone(), loader: prepared.plan.loader.clone(), loader_version: prepared.plan.loader_version.clone(), created_at: instances::now(), pack: Some(prepared.plan.source.clone().unwrap_or(PackSource { name: prepared.plan.name.clone(), version: prepared.plan.version.clone(), project: None, version_id: None, icon: String::new() })), files: count, bytes: total };
    instances::validate(&value, &profile, &value.id)?; staging.commit(&value)?;
    emit(&app, &work, "done", &value.name, total, total, count, count); Ok(value)
}

#[cfg(test)] mod tests {
    use super::*;
    #[tokio::test]
    #[ignore = "Requires explicitly supplied primary-provider fixture metadata; performs bounded live HTTP requests"]
    async fn minecraft_download_verifies_real_provider_bytes_hashes_and_cancellation() {
        let path = PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_PACK_FIXTURE").expect("fixture archive"));
        let value: serde_json::Value = instances::read(&path.with_extension("json")).unwrap();
        let url = value["source"].as_str().unwrap().to_string(); let bytes = value["bytes"].as_u64().filter(|v| *v <= 1024 * 1024).unwrap(); let hash = value["sha512"].as_str().unwrap();
        let base = instances::directory(path.parent().unwrap()).unwrap(); let root = base.join(format!("minecraft-download-{}", uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap();
        let cancel = AtomicBool::new(false); let target = root.join("valid.mrpack"); let mut progress = 0;
        download(&client().unwrap(), &[url.clone()], &target, bytes, hash, &cancel, |n| progress = n).await.unwrap();
        assert_eq!(progress, bytes); assert_eq!(pack::hash(&target, &cancel).unwrap(), hash);
        let bad = root.join("bad.mrpack"); let bad_hash = format!("{}{}", if hash.starts_with('0') { "1" } else { "0" }, &hash[1..]);
        assert_eq!(download(&client().unwrap(), &[url.clone()], &bad, bytes, &bad_hash, &cancel, |_| {}).await, Err("instance_integrity")); assert!(!bad.exists());
        let canceled = root.join("canceled.mrpack"); assert_eq!(download(&client().unwrap(), &[url], &canceled, bytes, hash, &AtomicBool::new(true), |_| {}).await, Err("instance_canceled")); assert!(!canceled.exists());
        let resolved = instances::directory(&root).unwrap(); assert_eq!(resolved.parent(), Some(base.as_path())); assert!(resolved.file_name().unwrap().to_string_lossy().starts_with("minecraft-download-")); fs::remove_dir_all(resolved).unwrap();
    }
}
