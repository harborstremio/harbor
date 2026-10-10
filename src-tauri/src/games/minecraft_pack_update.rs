use super::{minecraft_instances::{self as instances, Instance, PackSource, Result}, minecraft_launch_process, minecraft_pack as pack, minecraft_pack_install as install, minecraft_pack_state::{self as files, Action, Manifest, Review}, minecraft_pack_transaction as transaction, minecraft_runtime as runtime, mod_files, save_files};
use serde::Serialize;
use std::{collections::{HashMap, HashSet}, fs, io::{Read, Write}, path::{Path, PathBuf}, sync::{atomic::AtomicBool, Arc, Mutex, OnceLock}, time::{Duration, Instant}};
use sha2::{Digest, Sha512};
use tauri::Emitter;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Change { pub path: String, pub action: Action, pub bytes: u64 }
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub token: String, pub instance: String, pub name: String, pub from_version: String, pub version: String,
    pub game_version: String, pub loader: String, pub loader_version: String, pub changes: Vec<Change>,
    pub download_bytes: u64, pub copy_bytes: u64, pub conflicts: usize, pub preserved: usize, pub extra_mods: Vec<String>,
    pub environment_changed: bool, pub environment_blocked: bool, pub restore: bool,
    pub optional: Vec<pack::ReviewFile>, pub selected_optional: Vec<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct State { pub previous: Option<Instance> }
struct Prepared {
    profile: String, root: PathBuf, folder: PathBuf, before: Instance, after: Instance, fingerprint: String,
    baseline: Manifest, manifest: Manifest, tree: transaction::Tree, review: Review, plan: Plan,
    package: Option<install::Prepared>, backup: Option<PathBuf>, created: Instant,
}
fn plans() -> &'static Mutex<HashMap<String, Prepared>> { static VALUE: OnceLock<Mutex<HashMap<String, Prepared>>> = OnceLock::new(); VALUE.get_or_init(|| Mutex::new(HashMap::new())) }
pub fn discard(profile: &str, token: &str) { if let Ok(mut held) = plans().lock() { if held.get(token).is_some_and(|p| p.profile == profile) { held.remove(token); } } }
pub fn cancel(profile: &str, operation: &str) { runtime::cancel(profile, operation); install::cancel(profile, operation); }
fn emit(app: &tauri::AppHandle, profile: &str, operation: &str, phase: &'static str, name: &str, bytes: u64, total: u64) {
    let _ = app.emit("games:minecraft-progress", install::Progress { profile: profile.into(), operation_id: operation.into(), phase, name: name.into(), bytes, total_bytes: total, files: 0, total_files: 0 });
}
fn idle(folder: &Path) -> Result<()> { minecraft_launch_process::idle(folder).map_err(|e| if e == "launch_running" { "instance_update_running" } else { "instance_update_recovery" }) }
pub async fn state(profile: String, path: String, id: String) -> Result<State> {
    tokio::task::spawn_blocking(move || {
        let root = instances::library(&profile, &path)?; let (folder, _) = instances::load(&root, &profile, &id)?;
        Ok(State { previous: transaction::previous(&root, &folder, &profile, &id)?.map(|(_, value, _)| value) })
    }).await.map_err(|_| "instance_read")?
}
async fn baseline(app: &tauri::AppHandle, profile: &str, path: &str, folder: &Path, instance: &Instance, original: Option<String>, operation: &str, cancel: &Arc<AtomicBool>) -> Result<Manifest> {
    let record = folder.join(files::RECORD);
    if record.try_exists().map_err(|_| "instance_read")? { let value = instances::read(&record)?; files::validate(&value)?; return Ok(value); }
    let source = instance.pack.as_ref().ok_or("instance_update_source")?;
    let (archive, remote) = match original { Some(path) => (path, false), None => (source.version_id.clone().ok_or("instance_update_original")?, true) };
    let plan = install::prepare(app.clone(), profile.into(), path.into(), archive, remote, operation.into(), false, Some(cancel.clone())).await?;
    let prepared = install::take(profile, &plan.token)?;
    if prepared.parsed.index.dependencies["minecraft"] != instance.game_version || prepared.parsed.loader != instance.loader || prepared.parsed.loader_version != instance.loader_version || prepared.plan.version != source.version && prepared.plan.source.as_ref().is_none_or(|p| p.version != source.version) { return Err("instance_update_original"); }
    if remote && prepared.plan.source.as_ref().and_then(|p| p.project.as_ref()) != source.project.as_ref() { return Err("instance_update_source"); }
    let stored: pack::Index = instances::read(&folder.join("pack-index.json"))?;
    if serde_json::to_value(&stored).map_err(|_| "instance_record")? != serde_json::to_value(&prepared.parsed.index).map_err(|_| "instance_record")? { return Err("instance_update_original"); }
    let selected = prepared.parsed.files.iter().filter(|f| f.env.get("client").is_some_and(|v| v == "optional") && folder.join("game").join(&f.path).exists()).map(|f| f.path.clone()).collect();
    let cancel = cancel.clone(); tokio::task::spawn_blocking(move || files::manifest(&prepared.parsed, &prepared.archive, &selected, &cancel)).await.map_err(|_| "instance_read")?
}
fn extras(folder: &Path, baseline: &Manifest) -> Result<Vec<String>> {
    let root = folder.join("game/mods"); if !root.try_exists().map_err(|_| "instance_read")? { return Ok(vec![]); } instances::directory(&root)?;
    let owned: HashSet<_> = baseline.files.iter().map(|f| f.path.to_lowercase()).collect(); let mut result = vec![];
    for (index, entry) in fs::read_dir(root).map_err(|_| "instance_read")?.take(2001).enumerate() {
        if index == 2000 { return Err("instance_limit"); }
        let entry = entry.map_err(|_| "instance_read")?; let name = entry.file_name().to_str().ok_or("instance_pack_path")?.to_owned(); let lower = name.to_lowercase();
        if !(lower.ends_with(".jar") || lower.ends_with(".jar.disabled")) || owned.contains(&format!("mods/{lower}")) { continue; }
        let metadata = fs::symlink_metadata(entry.path()).map_err(|_| "instance_read")?; if !metadata.is_file() || save_files::reparse(&metadata) { return Err("instance_folder"); } result.push(name);
    }
    if result.len() > 2000 { return Err("instance_limit"); } result.sort(); Ok(result)
}
fn analyze(profile: String, root: PathBuf, folder: PathBuf, before: Instance, after: Instance, fingerprint: String, baseline: Manifest, manifest: Manifest, package: Option<install::Prepared>, backup: Option<PathBuf>, selected: Vec<String>, cancel: &AtomicBool) -> Result<Prepared> {
    idle(&folder)?; if transaction::fingerprint(&folder, &profile, &before.id)? != fingerprint { return Err("instance_changed"); }
    let mods = folder.join("game/mods");
    let managed = if mods.join(mod_files::MANIFEST).exists() { Some(mod_files::load(&profile, &mods).map_err(|_| "instance_update_compatibility")?) } else { None };
    let mut review = files::review(&folder.join("game"), &baseline, &manifest, cancel)?;
    if let Some(workspace) = managed { for change in &mut review.changes {
        if change.after.as_ref().is_some_and(|f| workspace.packages.iter().any(|p| format!("mods/{}", mod_files::current_name(p)).eq_ignore_ascii_case(&f.path))) && change.action != Action::Conflict { change.action = Action::Conflict; review.conflicts += 1; }
    } }
    let extra_mods = extras(&folder, &baseline)?; let environment_changed = before.game_version != after.game_version || before.loader != after.loader || before.loader_version != after.loader_version;
    let environment_blocked = before.loader != after.loader && !extra_mods.is_empty(); let tree = transaction::scan(&folder, cancel)?;
    let plan = Plan { token: uuid::Uuid::new_v4().to_string(), instance: before.id.clone(), name: before.name.clone(), from_version: before.pack.as_ref().map(|p| p.version.clone()).unwrap_or_default(), version: after.pack.as_ref().map(|p| p.version.clone()).unwrap_or_default(),
        game_version: after.game_version.clone(), loader: after.loader.clone(), loader_version: after.loader_version.clone(),
        changes: review.changes.iter().map(|c| Change { path: c.path.clone(), action: c.action.clone(), bytes: c.after.as_ref().or(c.before.as_ref()).map_or(0, |f| f.bytes) }).collect(),
        download_bytes: if backup.is_some() { 0 } else { review.bytes }, copy_bytes: tree.bytes, conflicts: review.conflicts, preserved: review.preserved, extra_mods, environment_changed, environment_blocked, restore: backup.is_some(),
        optional: package.as_ref().map(|p| p.plan.files.iter().filter(|f| f.optional).cloned().collect()).unwrap_or_default(), selected_optional: selected };
    Ok(Prepared { profile, root, folder, before, after, fingerprint, baseline, manifest, tree, review, plan, package, backup, created: Instant::now() })
}
fn remember(prepared: Prepared) -> Result<Plan> {
    let plan = prepared.plan.clone(); let mut held = plans().lock().map_err(|_| "instance_busy")?; held.retain(|_, p| p.created.elapsed() < Duration::from_secs(900)); if held.len() >= 4 { return Err("instance_busy"); } held.insert(plan.token.clone(), prepared); Ok(plan)
}
fn take(profile: &str, token: &str) -> Result<Prepared> {
    let mut held = plans().lock().map_err(|_| "instance_busy")?; if !held.get(token).is_some_and(|p| p.profile == profile) { return Err("instance_plan"); }
    let prepared = held.remove(token).ok_or("instance_plan")?; if prepared.created.elapsed() > Duration::from_secs(900) { return Err("instance_plan"); } Ok(prepared)
}
pub async fn review(app: tauri::AppHandle, profile: String, path: String, id: String, source: Option<String>, remote: bool, original: Option<String>, operation: String) -> Result<Plan> {
    let work = runtime::start(&profile, &operation)?; let cancel = work.cancellation(); let root = instances::library(&profile, &path)?; let (folder, before) = instances::load(&root, &profile, &id)?; idle(&folder)?;
    if before.pack.is_none() { return Err("instance_update_source"); } let fingerprint = transaction::fingerprint(&folder, &profile, &id)?;
    let baseline = baseline(&app, &profile, &path, &folder, &before, original, &operation, &cancel).await?;
    let (package, backup, manifest, after, selected) = if let Some(source) = source {
        let plan = install::prepare(app.clone(), profile.clone(), path, source, remote, operation.clone(), false, Some(cancel.clone())).await?; let prepared = install::take(&profile, &plan.token)?;
        if remote && before.pack.as_ref().and_then(|p| p.project.as_ref()).is_some_and(|project| prepared.plan.source.as_ref().and_then(|p| p.project.as_ref()) != Some(project)) { return Err("instance_update_source"); }
        let selected: Vec<_> = plan.files.iter().filter(|f| f.optional).map(|f| f.path.clone()).collect(); let options = selected.iter().cloned().collect(); let check_cancel = cancel.clone();
        let (prepared, manifest) = tokio::task::spawn_blocking(move || { let manifest = files::manifest(&prepared.parsed, &prepared.archive, &options, &check_cancel)?; Ok::<_, &'static str>((prepared, manifest)) }).await.map_err(|_| "instance_read")??;
        let mut after = before.clone(); after.game_version = plan.game_version; after.loader = plan.loader; after.loader_version = plan.loader_version; after.pack = Some(plan.source.unwrap_or(PackSource { name: plan.name, version: plan.version, project: None, version_id: None, icon: String::new() }));
        (Some(prepared), None, manifest, after, selected)
    } else { let (backup, mut after, manifest) = transaction::previous(&root, &folder, &profile, &id)?.ok_or("instance_update_previous")?; after.name = before.name.clone(); (None, Some(backup), manifest, after, vec![]) };
    emit(&app, &profile, &operation, "compare", &before.name, 0, 0);
    let prepared = tokio::task::spawn_blocking(move || { let _work = work; analyze(profile, root, folder, before, after, fingerprint, baseline, manifest, package, backup, selected, &cancel) }).await.map_err(|_| "instance_read")??; remember(prepared)
}
pub async fn select(profile: String, token: String, optional: Vec<String>, operation: String) -> Result<Plan> {
    let work = runtime::start(&profile, &operation)?; let cancel = work.cancellation(); let prepared = take(&profile, &token)?;
    let next = tokio::task::spawn_blocking(move || {
        let _work = work; let package = prepared.package.as_ref().ok_or("instance_request")?;
        let manifest = files::manifest(&package.parsed, &package.archive, &optional.iter().cloned().collect(), &cancel)?;
        analyze(prepared.profile, prepared.root, prepared.folder, prepared.before, prepared.after, prepared.fingerprint, prepared.baseline, manifest, prepared.package, None, optional, &cancel)
    }).await.map_err(|_| "instance_read")??; remember(next)
}

type Progress = Arc<dyn Fn(&'static str, &str, u64, u64) + Send + Sync>;
fn verify_review(prepared: &Prepared, cancel: &AtomicBool) -> Result<()> {
    idle(&prepared.folder)?; if transaction::fingerprint(&prepared.folder, &prepared.profile, &prepared.before.id)? != prepared.fingerprint || transaction::scan(&prepared.folder, cancel)? != prepared.tree { return Err("instance_changed"); }
    let current = files::review(&prepared.folder.join("game"), &prepared.baseline, &prepared.manifest, cancel)?;
    if current.changes.len() != prepared.review.changes.len() || current.changes.iter().zip(&prepared.review.changes).any(|(a, b)| a.path != b.path || a.current != b.current) { return Err("instance_changed"); } Ok(())
}
fn copy_verified(from: &Path, target: &Path, file: &files::File, cancel: &AtomicBool) -> Result<()> {
    let mut source = instances::plain_file(&from.join(files::relative(&file.path)?), pack::MAX_FILE)?; let mut out = instances::create_file(target, &file.path)?;
    let mut hash = Sha512::new(); let mut total = 0; let mut buffer = [0_u8; 65_536];
    loop { pack::canceled(cancel)?; let n = source.read(&mut buffer).map_err(|_| "instance_read")?; if n == 0 { break; } total += n as u64; if total > file.bytes { return Err("instance_changed"); } hash.update(&buffer[..n]); out.write_all(&buffer[..n]).map_err(|_| "instance_write")?; }
    if total != file.bytes || !format!("{:x}", hash.finalize()).eq_ignore_ascii_case(&file.sha512) { return Err("instance_integrity"); } out.sync_all().map_err(|_| "instance_write")
}
async fn apply_prepared(prepared: Prepared, work: runtime::Work, progress: Progress) -> Result<Instance> {
    if prepared.plan.conflicts > 0 { return Err("instance_update_conflict"); } if prepared.plan.environment_blocked { return Err("instance_update_compatibility"); }
    let update_progress = progress.clone();
    let (prepared, staging, work) = tokio::task::spawn_blocking(move || {
        let cancel = work.cancellation(); verify_review(&prepared, &cancel)?;
        if let Some(package) = &prepared.package { if pack::hash(&package.archive, &cancel)? != package.parsed.sha512 { return Err("instance_changed"); } }
        let staging = instances::Staging::new(&prepared.root)?; let mut last = Instant::now(); update_progress("copy", &prepared.before.name, 0, prepared.tree.bytes);
        transaction::copy(&prepared.folder, &staging.path, &prepared.tree, prepared.review.bytes, &cancel, |n| { if last.elapsed() >= Duration::from_millis(100) || n == prepared.tree.bytes { update_progress("copy", &prepared.before.name, n, prepared.tree.bytes); last = Instant::now(); } })?;
        let game = staging.path.join("game");
        for change in &prepared.review.changes { if matches!(change.action, Action::Remove | Action::Replace) {
            let old = change.current.as_ref().ok_or("instance_changed")?;
            if files::observed(&game, &old.path, &cancel)?.as_ref() != Some(old) { return Err("instance_changed"); }
            fs::remove_file(game.join(files::relative(&old.path)?)).map_err(|_| "instance_write")?;
        } }
        Ok::<_, &'static str>((prepared, staging, work))
    }).await.map_err(|_| "instance_write")??;
    let cancel = work.cancellation(); let game = staging.path.join("game");
    let changed: HashSet<_> = prepared.review.changes.iter().filter(|c| matches!(c.action, Action::Add | Action::Replace)).map(|c| c.path.as_str()).collect();
    if let Some(package) = &prepared.package {
        let client = install::client()?; let mut done = 0;
        for file in package.parsed.files.iter().filter(|f| changed.contains(f.path.as_str())) {
            pack::canceled(&cancel)?; drop(instances::create_file(&game, &file.path)?); let target = game.join(files::relative(&file.path)?); fs::remove_file(&target).map_err(|_| "instance_write")?;
            install::download(&client, &file.downloads, &target, file.file_size, &file.hashes["sha512"], &cancel, |n| progress("files", &file.path, done + n, prepared.review.bytes)).await?; done += file.file_size;
        }
    }
    drop(changed);
    tokio::task::spawn_blocking(move || {
        let _work = work; let cancel = _work.cancellation(); let game = staging.path.join("game");
        let changed: HashSet<_> = prepared.review.changes.iter().filter(|c| matches!(c.action, Action::Add | Action::Replace)).map(|c| c.path.as_str()).collect();
        let index: pack::Index = if let Some(package) = &prepared.package {
            let entries: Vec<_> = package.parsed.overrides.iter().filter(|f| changed.contains(f.path.as_str())).cloned().collect(); progress("overrides", "", 0, 0); pack::extract(&package.archive, &game, &entries, &cancel)?; package.parsed.index.clone()
        } else {
            let backup = prepared.backup.as_ref().ok_or("instance_update_previous")?; let mut done = 0;
            for file in prepared.manifest.files.iter().filter(|f| changed.contains(f.path.as_str())) { copy_verified(&backup.join("game"), &game, file, &cancel)?; done += file.bytes; progress("files", &file.path, done, prepared.review.bytes); }
            instances::read(&backup.join("pack-index.json"))?
        };
        for file in prepared.manifest.files.iter().filter(|f| changed.contains(f.path.as_str())) { if files::observed(&game, &file.path, &cancel)?.as_ref() != Some(file) { return Err("instance_integrity"); } }
        progress("verify", "", 0, 0); let mods = game.join("mods");
        if prepared.after.loader == "fabric" && mods.exists() { super::fabric_mods::validate(&mods, &[], &[], &prepared.after.game_version).map_err(|_| "instance_update_compatibility")?; }
        if mods.join(mod_files::MANIFEST).exists() {
            let mut workspace = mod_files::load(&prepared.profile, &mods).map_err(|_| "instance_update_compatibility")?;
            if prepared.after.loader == "fabric" { workspace.game_version = prepared.after.game_version.clone(); workspace.revision = uuid::Uuid::new_v4().to_string(); mod_files::validate(&workspace).map_err(|_| "instance_update_compatibility")?; instances::write(&mods, mod_files::MANIFEST, &workspace)?; }
            else if workspace.packages.is_empty() { fs::remove_file(mods.join(mod_files::MANIFEST)).map_err(|_| "instance_write")?; }
            else { return Err("instance_update_compatibility"); }
        }
        let mut after = prepared.after.clone(); after.files = prepared.manifest.files.len(); after.bytes = prepared.manifest.files.iter().map(|f| f.bytes).sum();
        instances::write(&staging.path, "pack-index.json", &index)?; instances::write(&staging.path, files::RECORD, &prepared.manifest)?;
        verify_review(&prepared, &cancel)?; pack::canceled(&cancel)?; progress("commit", &after.name, 0, 0);
        transaction::commit(&prepared.profile, &prepared.folder, staging, &prepared.fingerprint, &after, &prepared.baseline)?;
        progress("done", &after.name, after.bytes, after.bytes); Ok(after)
    }).await.map_err(|_| "instance_write")?
}
pub async fn apply(app: tauri::AppHandle, profile: String, token: String, operation: String) -> Result<Instance> {
    let work = runtime::start(&profile, &operation)?; let prepared = take(&profile, &token)?;
    apply_prepared(prepared, work, Arc::new(move |phase, name, bytes, total| emit(&app, &profile, &operation, phase, name, bytes, total))).await
}

#[cfg(test)]
#[path = "minecraft_pack_update_tests.rs"]
mod tests;
