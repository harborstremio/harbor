use super::{minecraft_instances::{self as instances, Instance, Result}, minecraft_lifecycle_files as files, minecraft_pack as pack, minecraft_pack_transaction as transaction, minecraft_runtime as runtime, minecraft_launch_process, mod_files, transfer_files};
use serde::Serialize;
use sha2::{Digest, Sha512};
use std::{collections::{BTreeMap, HashMap}, fs, io::{Read, Write}, path::PathBuf, sync::{atomic::AtomicBool, Mutex, OnceLock}, time::{Duration, Instant}};
use tauri::Emitter;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan { pub token: String, pub name: String, pub version: String, pub game_version: String, pub loader: String, pub files: Vec<files::File>, pub embedded_bytes: u64, pub download_bytes: u64, pub worlds: bool, pub settings: bool, pub excluded: usize }
#[derive(Serialize)]
pub struct Exported { pub path: String, pub bytes: u64 }
struct Prepared { profile: String, library: PathBuf, folder: PathBuf, instance: Instance, fingerprint: String, tree: files::Tree, index: pack::Index, embedded: Vec<(files::Entry, String)>, plan: Plan, created: Instant }
fn plans() -> &'static Mutex<HashMap<String, Prepared>> { static VALUE: OnceLock<Mutex<HashMap<String, Prepared>>> = OnceLock::new(); VALUE.get_or_init(|| Mutex::new(HashMap::new())) }
pub fn discard(profile: &str, token: &str) { if let Ok(mut held) = plans().lock() { if held.get(token).is_some_and(|p| p.profile == profile) { held.remove(token); } } }
fn take(profile: &str, token: &str) -> Result<Prepared> {
    let mut held = plans().lock().map_err(|_| "instance_busy")?;
    if !held.get(token).is_some_and(|p| p.profile == profile) { return Err("instance_plan"); }
    let value = held.remove(token).ok_or("instance_plan")?;
    if value.created.elapsed() > Duration::from_secs(900) { return Err("instance_plan"); } Ok(value)
}
fn idle(folder: &std::path::Path) -> Result<()> { minecraft_launch_process::idle(folder).map_err(|e| if e == "launch_running" { "instance_update_running" } else { "instance_update_recovery" }) }
fn prepare(profile: &str, path: &str, id: &str, version: &str, worlds: bool, settings: bool, cancel: &AtomicBool, mut progress: impl FnMut(&str, u64, u64)) -> Result<Prepared> {
    if version.trim().is_empty() || version.len() > 200 || version.chars().any(char::is_control) { return Err("instance_request"); }
    let library = instances::library(profile, path)?; let (folder, instance) = instances::load(&library, profile, id)?; idle(&folder)?;
    let fingerprint = transaction::fingerprint(&folder, profile, id)?; let game = folder.join("game"); let tree = files::scan(&game, cancel)?;
    let mut known = HashMap::new();
    if folder.join("pack-index.json").try_exists().map_err(|_| "instance_read")? {
        let index: pack::Index = instances::read(&folder.join("pack-index.json"))?; pack::environment(&index)?;
        for file in index.files { known.insert(file.path.to_lowercase(), (file.hashes.get("sha512").cloned().unwrap_or_default(), file.downloads)); }
    }
    if game.join("mods").join(mod_files::MANIFEST).try_exists().map_err(|_| "instance_read")? {
        let workspace = mod_files::load(profile, &game.join("mods")).map_err(|_| "instance_read")?;
        for file in workspace.packages { known.insert(format!("mods/{}", mod_files::current_name(&file)).to_lowercase(), (file.sha512, vec![file.url])); }
    }
    let mut dependencies = BTreeMap::from([("minecraft".into(), instance.game_version.clone())]);
    if instance.loader != "vanilla" { dependencies.insert(match instance.loader.as_str() { "fabric" => "fabric-loader", "quilt" => "quilt-loader", "forge" => "forge", "neoforge" => "neoforge", _ => return Err("instance_pack_loader") }.into(), instance.loader_version.clone()); }
    let mut index = pack::Index { format_version: 1, game: "minecraft".into(), name: instance.name.clone(), version_id: version.trim().into(), summary: String::new(), files: vec![], dependencies };
    let mut plan = Plan { token: uuid::Uuid::new_v4().to_string(), name: instance.name.clone(), version: version.trim().into(), game_version: instance.game_version.clone(), loader: instance.loader.clone(), files: vec![], embedded_bytes: 0, download_bytes: 0, worlds, settings, excluded: 0 };
    let mut embedded = vec![]; let mut read = 0;
    for file in &tree.files {
        pack::canceled(cancel)?;
        if !files::exportable(&file.path, worlds, settings) { plan.excluded += 1; continue; }
        let (sha1, sha512) = files::hashes(&game, file, cancel)?; read += file.bytes; progress(&file.path, read, tree.bytes);
        let downloads: Vec<_> = known.get(&file.path.to_lowercase()).filter(|(hash, _)| hash.eq_ignore_ascii_case(&sha512)).map(|(_, urls)| urls.iter().filter(|url| pack::download_url(url).is_ok()).take(8).cloned().collect()).unwrap_or_default();
        let include = downloads.is_empty(); plan.files.push(files::File { path: file.path.clone(), bytes: file.bytes, embedded: include });
        if include { plan.embedded_bytes += file.bytes; embedded.push((file.clone(), sha512)); }
        else { plan.download_bytes += file.bytes; index.files.push(pack::PackFile { path: file.path.clone(), hashes: BTreeMap::from([("sha1".into(), sha1), ("sha512".into(), sha512)]), downloads, file_size: file.bytes, env: BTreeMap::from([("client".into(), "required".into()), ("server".into(), "unsupported".into())]) }); }
        if plan.files.len() >= 20_000 || plan.embedded_bytes + plan.download_bytes > pack::MAX_TOTAL { return Err("instance_limit"); }
    }
    pack::environment(&index)?;
    if serde_json::to_vec(&index).map_err(|_| "instance_record")?.len() > 4 * 1024 * 1024 { return Err("instance_limit"); }
    if tree != files::scan(&game, cancel)? || fingerprint != transaction::fingerprint(&folder, profile, id)? { return Err("instance_changed"); }
    Ok(Prepared { profile: profile.into(), library, folder, instance, fingerprint, tree, index, embedded, plan, created: Instant::now() })
}
fn emit(app: &tauri::AppHandle, profile: &str, operation: &str, phase: &'static str, name: &str, bytes: u64, total: u64) {
    let _ = app.emit("games:minecraft-progress", super::minecraft_pack_install::Progress { profile: profile.into(), operation_id: operation.into(), phase, name: name.into(), bytes, total_bytes: total, files: 0, total_files: 0 });
}
pub async fn review(app: tauri::AppHandle, profile: String, path: String, id: String, version: String, worlds: bool, settings: bool, operation: String) -> Result<Plan> {
    let work = runtime::start(&profile, &operation)?;
    let prepared = tokio::task::spawn_blocking(move || {
        let _work = work; let mut last = Instant::now();
        prepare(&profile, &path, &id, &version, worlds, settings, &_work.cancellation(), |name, bytes, total| { if last.elapsed() > Duration::from_millis(100) { emit(&app, &profile, &operation, "exportReview", name, bytes, total); last = Instant::now(); } })
    }).await.map_err(|_| "instance_read")??;
    let plan = prepared.plan.clone(); let mut held = plans().lock().map_err(|_| "instance_busy")?; held.retain(|_, p| p.created.elapsed() < Duration::from_secs(900));
    if held.len() >= 4 { return Err("instance_busy"); } held.insert(plan.token.clone(), prepared); Ok(plan)
}
fn write_archive(prepared: Prepared, path: &str, cancel: &AtomicBool, mut progress: impl FnMut(&str, u64, u64)) -> Result<Exported> {
    idle(&prepared.folder)?;
    let game = prepared.folder.join("game");
    if prepared.fingerprint != transaction::fingerprint(&prepared.folder, &prepared.profile, &prepared.instance.id)? || prepared.tree != files::scan(&game, cancel)? { return Err("instance_changed"); }
    let (parent, target) = files::output(&prepared.library, path)?;
    if transfer_files::free_bytes(&parent).is_none_or(|bytes| bytes < prepared.plan.embedded_bytes.saturating_add(16 * 1024 * 1024)) { return Err("instance_update_space"); }
    let temporary = pack::Temporary(parent.join(format!(".pack-export-{}", uuid::Uuid::new_v4())));
    let file = fs::OpenOptions::new().write(true).read(true).create_new(true).open(&temporary.0).map_err(|_| "instance_write")?;
    let mut archive = zip::ZipWriter::new(file); let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    archive.start_file("modrinth.index.json", options).map_err(|_| "instance_write")?;
    archive.write_all(&serde_json::to_vec(&prepared.index).map_err(|_| "instance_record")?).map_err(|_| "instance_write")?;
    let mut bytes = 0_u64; let mut buffer = [0_u8; 65_536]; let mut last = Instant::now();
    for (entry, expected) in &prepared.embedded {
        pack::canceled(cancel)?; let mut source = files::open(&game, entry)?; let mut hash = Sha512::new(); let mut copied = 0_u64;
        archive.start_file(format!("client-overrides/{}", entry.path), options).map_err(|_| "instance_write")?;
        loop {
            pack::canceled(cancel)?; let n = source.read(&mut buffer).map_err(|_| "instance_read")?; if n == 0 { break; }
            copied += n as u64; bytes += n as u64; if copied > entry.bytes { return Err("instance_changed"); }
            hash.update(&buffer[..n]); archive.write_all(&buffer[..n]).map_err(|_| "instance_write")?;
            if last.elapsed() > Duration::from_millis(100) || bytes == prepared.plan.embedded_bytes {
                if fs::metadata(&temporary.0).map_err(|_| "instance_read")?.len() > pack::MAX_ARCHIVE { return Err("instance_export_limit"); }
                progress(&entry.path, bytes, prepared.plan.embedded_bytes); last = Instant::now();
            }
        }
        if copied != entry.bytes || format!("{:x}", hash.finalize()) != *expected || source.metadata().map_err(|_| "instance_read")?.modified().ok() != Some(entry.modified) { return Err("instance_changed"); }
    }
    let file = archive.finish().map_err(|_| "instance_write")?; file.sync_all().map_err(|_| "instance_write")?; drop(file);
    // Round-trip the written file through the actual importer before publishing it.
    if fs::metadata(&temporary.0).map_err(|_| "instance_read")?.len() > pack::MAX_ARCHIVE { return Err("instance_export_limit"); }
    let _parsed = pack::parse(&temporary.0, cancel)?;
    if prepared.fingerprint != transaction::fingerprint(&prepared.folder, &prepared.profile, &prepared.instance.id)? || prepared.tree != files::scan(&game, cancel)? { return Err("instance_changed"); }
    idle(&prepared.folder)?; pack::canceled(cancel)?;
    let bytes = fs::metadata(&temporary.0).map_err(|_| "instance_read")?.len();
    transfer_files::publish(&temporary.0, &target).map_err(|e| if e == "transfer_exists" { "instance_export_exists" } else { "instance_write" })?;
    Ok(Exported { path: target.to_string_lossy().into_owned(), bytes })
}
pub async fn apply(app: tauri::AppHandle, profile: String, token: String, path: String, operation: String) -> Result<Exported> {
    let work = runtime::start(&profile, &operation)?; let prepared = take(&profile, &token)?;
    tokio::task::spawn_blocking(move || { let _work = work; write_archive(prepared, &path, &_work.cancellation(), |name, bytes, total| emit(&app, &profile, &operation, "exportWrite", name, bytes, total)) }).await.map_err(|_| "instance_write")?
}

#[cfg(test)]
#[path = "minecraft_instance_export_tests.rs"]
mod tests;
