use super::{
    mod_files::{self, Workspace},
    modrinth::{self, Package, Result},
    transfer_files,
};
use serde::Serialize;
use sha2::{Digest, Sha512};
use std::{
    collections::{HashMap, VecDeque},
    path::PathBuf,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

static LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
static PLANS: OnceLock<Mutex<HashMap<String, Held>>> = OnceLock::new();
static OPERATIONS: OnceLock<Mutex<HashMap<String, CancellationToken>>> = OnceLock::new();
fn plans() -> &'static Mutex<HashMap<String, Held>> {
    PLANS.get_or_init(Default::default)
}
fn operations() -> &'static Mutex<HashMap<String, CancellationToken>> {
    OPERATIONS.get_or_init(Default::default)
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub token: String,
    pub packages: Vec<Package>,
    pub replaced: Vec<Package>,
    pub existing: usize,
    pub optional: usize,
    pub bytes: u64,
    pub loader: String,
    pub game_version: String,
}
struct Held {
    profile: String,
    root: PathBuf,
    before: Workspace,
    plan: Plan,
    at: Instant,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub profile: String,
    pub operation_id: String,
    pub name: String,
    pub bytes: u64,
    pub total_bytes: u64,
}
fn operation(profile: &str, id: &str) -> Result<(String, CancellationToken)> {
    mod_files::owner(profile)?;
    uuid::Uuid::parse_str(id).map_err(|_| "mods_request")?;
    let key = format!("{profile}\0{id}");
    let token = CancellationToken::new();
    let mut all = operations().lock().map_err(|_| "mods_busy")?;
    if all.contains_key(&key) || all.len() >= 2 {
        return Err("mods_busy");
    }
    all.insert(key.clone(), token.clone());
    Ok((key, token))
}
pub fn cancel(profile: &str, id: &str) {
    if let Ok(all) = operations().lock() {
        if let Some(token) = all.get(&format!("{profile}\0{id}")) {
            token.cancel();
        }
    }
}
pub fn discard(profile: &str, token: &str) {
    if let Ok(mut all) = plans().lock() {
        if all.get(token).is_some_and(|held| held.profile == profile) {
            all.remove(token);
        }
    }
}
pub async fn workspace(
    profile: String,
    path: String,
    loader: Option<String>,
    game: Option<String>,
) -> Result<Workspace> {
    let _guard = LOCK.try_lock().map_err(|_| "mods_busy")?;
    tokio::task::spawn_blocking(move || {
    let root = mod_files::root(&path)?;
    let instance = super::minecraft_content::guard(&profile, &root)?;
    if let Some(instance) = &instance { instance.environment(loader.as_deref(), game.as_deref())?; }
    match (loader, game) {
        (Some(l), Some(g)) => mod_files::connect(&profile, &path, &l, &g),
        _ => mod_files::load(&profile, &root),
    }})
    .await
    .map_err(|_| "mods_record")?
}
pub async fn action(
    profile: String,
    path: String,
    project: String,
    action: String,
    revision: Option<String>,
) -> Result<Workspace> {
    let _guard = LOCK.try_lock().map_err(|_| "mods_busy")?;
    tokio::task::spawn_blocking(move || {
        let root = mod_files::root(&path)?;
        let _instance = super::minecraft_content::guard(&profile, &root)?;
        let before = mod_files::load(&profile, &root)?;
        if revision.as_ref().is_some_and(|r| r != &before.revision) {
            return Err("mods_changed");
        }
        if action == "rollback" {
            let (after, moves, restored, backup) = mod_files::rollback(&before, &project)?;
            if before.loader != "fabric" {
                return Err("mods_loader_support");
            }
            let removed = before
                .packages
                .iter()
                .filter(|p| p.project == project && p.enabled)
                .map(|p| p.filename.clone())
                .collect::<Vec<_>>();
            let added = if restored.enabled {
                vec![(backup, restored.filename)]
            } else {
                vec![]
            };
            super::fabric_mods::validate(&root, &added, &removed, &before.game_version)?;
            return mod_files::transact(&root, before, after, moves);
        }
        let package = before
            .packages
            .iter()
            .find(|p| p.project == project)
            .ok_or("mods_missing")?;
        if !["enable", "disable", "remove"].contains(&action.as_str()) {
            return Err("mods_request");
        }
        let enable = action == "enable";
        if enable && !package.enabled || !enable && package.enabled {
            super::fabric_mods::validate(
                &root,
                &if enable {
                    vec![(mod_files::current_name(package), package.filename.clone())]
                } else {
                    vec![]
                },
                &if package.enabled {
                    vec![package.filename.clone()]
                } else {
                    vec![]
                },
                &before.game_version,
            )?;
        }
        mod_files::action(&profile, &path, &project, &action)
    })
    .await
    .map_err(|_| "mods_write")?
}
pub async fn review(profile: String, path: String, version: String, id: String) -> Result<Plan> {
    let _guard = LOCK.try_lock().map_err(|_| "mods_busy")?;
    let _instance = super::minecraft_content::guard(&profile, &mod_files::root(&path)?)?;
    let (key, cancel) = operation(&profile, &id)?;
    let result = tokio::select! { _ = cancel.cancelled() => Err("mods_canceled"), result = tokio::time::timeout(Duration::from_secs(90), resolve(&profile, &path, &version)) => result.unwrap_or(Err("mods_timeout")) };
    if let Ok(mut all) = operations().lock() {
        all.remove(&key);
    }
    result
}
async fn resolve(profile: &str, path: &str, version: &str) -> Result<Plan> {
    let root = mod_files::root(path)?;
    let before = mod_files::load(profile, &root)?;
    let client = modrinth::client()?;
    if before.loader != "fabric" {
        return Err("mods_loader_support");
    }
    let mut queue =
        VecDeque::from([
            modrinth::version(&client, version, &before.loader, &before.game_version).await?,
        ]);
    let mut selected: HashMap<String, Package> = HashMap::new();
    let mut requests = 1;
    while let Some(mut package) = queue.pop_front() {
        if let Some(other) = selected.get(&package.project) {
            if other.version != package.version {
                return Err("mods_conflict");
            }
            continue;
        }
        if let Some(other) = before
            .packages
            .iter()
            .find(|p| p.project == package.project)
        {
            mod_files::matches(&root, other)?;
            package.enabled = other.enabled;
        }
        selected.insert(package.project.clone(), package.clone());
        if selected.len() > 32 {
            return Err("mods_limit");
        }
        if !package.enabled {
            continue;
        }
        for dependency in package
            .dependencies
            .iter()
            .filter(|d| d.dependency_type == "required")
        {
            if dependency
                .version_id
                .as_deref()
                .is_none_or(|id| !modrinth::identifier(id))
                && dependency
                    .project_id
                    .as_deref()
                    .is_none_or(|id| !modrinth::identifier(id))
            {
                return Err("mods_dependency");
            }
            let existing = selected.values().chain(before.packages.iter()).find(|p| {
                dependency.version_id.as_ref().map_or_else(
                    || dependency.project_id.as_ref() == Some(&p.project),
                    |id| id == &p.version,
                )
            });
            if let Some(existing) = existing {
                if !existing.enabled {
                    return Err("mods_conflict");
                }
                if !selected.contains_key(&existing.project) {
                    queue.push_back(existing.clone());
                }
                continue;
            }
            requests += 1;
            if requests > 64 {
                return Err("mods_limit");
            }
            let next = if let Some(id) = dependency.version_id.as_ref() {
                modrinth::version(&client, id, &before.loader, &before.game_version).await?
            } else {
                modrinth::latest(
                    &client,
                    dependency.project_id.as_deref().ok_or("mods_dependency")?,
                    &before.loader,
                    &before.game_version,
                )
                .await?
            };
            if dependency
                .project_id
                .as_ref()
                .is_some_and(|id| id != &next.project)
            {
                return Err("mods_metadata");
            }
            queue.push_back(next);
        }
    }
    let mut additions: Vec<_> = selected
        .into_values()
        .filter(|p| {
            !before
                .packages
                .iter()
                .any(|v| v.project == p.project && v.version == p.version)
        })
        .collect();
    additions.sort_by(|a, b| a.name.cmp(&b.name));
    let replaced = before
        .packages
        .iter()
        .filter(|p| additions.iter().any(|v| v.project == p.project))
        .cloned()
        .collect::<Vec<_>>();
    let mut all = before
        .packages
        .iter()
        .filter(|p| !additions.iter().any(|v| v.project == p.project))
        .cloned()
        .collect::<Vec<_>>();
    all.extend(additions.clone());
    mod_files::compatible(&all)?;
    if additions.is_empty() {
        return Err("mods_installed");
    }
    let mut filenames = std::collections::HashSet::new();
    for p in &all {
        if !filenames.insert(p.filename.to_ascii_lowercase()) {
            return Err("mods_exists");
        }
    }
    for p in &additions {
        for name in [
            p.filename.clone(),
            format!("{}.harbor-disabled", p.filename),
        ] {
            if root.join(&name).symlink_metadata().is_ok()
                && !replaced.iter().any(|old| {
                    old.project == p.project
                        && mod_files::current_name(old).eq_ignore_ascii_case(&name)
                })
            {
                return Err("mods_exists");
            }
        }
    }
    let bytes = additions.iter().map(|p| p.bytes).sum();
    if bytes > 512 * 1024 * 1024 {
        return Err("mods_limit");
    }
    let plan = Plan {
        token: uuid::Uuid::new_v4().to_string(),
        optional: additions
            .iter()
            .flat_map(|p| &p.dependencies)
            .filter(|d| d.dependency_type == "optional")
            .count(),
        existing: all.len() - additions.len(),
        packages: additions,
        replaced,
        bytes,
        loader: before.loader.clone(),
        game_version: before.game_version.clone(),
    };
    let mut held = plans().lock().map_err(|_| "mods_busy")?;
    held.retain(|_, p| p.at.elapsed() < Duration::from_secs(900));
    if held.len() >= 8 {
        return Err("mods_busy");
    }
    held.insert(
        plan.token.clone(),
        Held {
            profile: profile.into(),
            root,
            before,
            plan: plan.clone(),
            at: Instant::now(),
        },
    );
    Ok(plan)
}
pub async fn install(
    profile: String,
    token: String,
    id: String,
    progress: impl Fn(Progress),
) -> Result<Workspace> {
    let _guard = LOCK.try_lock().map_err(|_| "mods_busy")?;
    let (key, cancel) = operation(&profile, &id)?;
    let held = {
        let mut all = plans().lock().map_err(|_| "mods_busy")?;
        if all.get(&token).is_some_and(|v| v.profile == profile) {
            all.remove(&token)
        } else {
            None
        }
    };
    let result = match held {
        Some(held) if held.at.elapsed() < Duration::from_secs(900) => {
            install_held(&profile, &id, held, &cancel, progress).await
        }
        _ => Err("mods_expired"),
    };
    if let Ok(mut all) = operations().lock() {
        all.remove(&key);
    }
    result
}
async fn install_held(
    profile: &str,
    id: &str,
    held: Held,
    cancel: &CancellationToken,
    progress: impl Fn(Progress),
) -> Result<Workspace> {
    let root = mod_files::root(held.root.to_str().ok_or("mods_folder")?)?;
    let _instance = super::minecraft_content::guard(profile, &root)?;
    let current = mod_files::load(profile, &root)?;
    if current.revision != held.before.revision {
        return Err("mods_changed");
    }
    for p in &current.packages {
        mod_files::matches(&root, p)?;
    }
    if transfer_files::free_bytes(&root)
        .is_some_and(|free| free < held.plan.bytes + 32 * 1024 * 1024)
    {
        return Err("mods_space");
    }
    let client = modrinth::client()?;
    let mut staged = Vec::new();
    let mut created = Vec::new();
    let mut completed = 0;
    let result: Result<()> = async {
        for p in &held.plan.packages {
            if cancel.is_cancelled() { return Err("mods_canceled"); }
            let name = mod_files::internal("part"); let path = root.join(&name);
            let mut file = tokio::fs::OpenOptions::new().write(true).create_new(true).open(&path).await.map_err(|_| "mods_write")?; created.push(path);
            let mut response = tokio::select! { _ = cancel.cancelled() => return Err("mods_canceled"), response = client.get(&p.url).send() => response.map_err(|_| "mods_network")? };
            if !response.status().is_success() || response.content_length().is_some_and(|size| size != p.bytes) { return Err("mods_download"); }
            let mut bytes = 0; let mut hash = Sha512::new(); let mut tick = Instant::now() - Duration::from_secs(1);
            loop {
                let chunk = tokio::select! { _ = cancel.cancelled() => return Err("mods_canceled"), chunk = response.chunk() => chunk.map_err(|_| "mods_download")? };
                let Some(chunk) = chunk else { break; }; bytes += chunk.len() as u64; if bytes > p.bytes { return Err("mods_integrity"); }
                hash.update(&chunk); file.write_all(&chunk).await.map_err(|_| "mods_write")?;
                if tick.elapsed() >= Duration::from_millis(100) { progress(Progress { profile: profile.into(), operation_id: id.into(), name: p.name.clone(), bytes: completed + bytes, total_bytes: held.plan.bytes }); tick = Instant::now(); }
            }
            file.sync_all().await.map_err(|_| "mods_write")?; drop(file);
            if bytes != p.bytes || format!("{:x}", hash.finalize()) != p.sha512 { return Err("mods_integrity"); }
            completed += bytes; staged.push(name);
        }
        if cancel.is_cancelled() { return Err("mods_canceled"); } Ok(())
    }.await;
    if let Err(error) = result {
        for path in created {
            let _ = tokio::fs::remove_file(path).await;
        }
        return Err(error);
    }
    let prepared = mod_files::replacement(&current, &held.plan.packages, &staged);
    let (after, moves) = match prepared {
        Ok(value) => value,
        Err(error) => {
            for path in created {
                let _ = tokio::fs::remove_file(path).await;
            }
            return Err(error);
        }
    };
    let check_root = root.clone();
    let check_files = held
        .plan
        .packages
        .iter()
        .zip(&staged)
        .filter(|(p, _)| p.enabled)
        .map(|(p, stage)| (stage.clone(), p.filename.clone()))
        .collect::<Vec<_>>();
    let removed = held
        .plan
        .replaced
        .iter()
        .filter(|p| p.enabled)
        .map(|p| p.filename.clone())
        .collect::<Vec<_>>();
    let game = after.game_version.clone();
    let checked = tokio::task::spawn_blocking(move || {
        super::fabric_mods::validate(&check_root, &check_files, &removed, &game)
    })
    .await
    .unwrap_or(Err("mods_embedded_metadata"));
    if let Err(error) = checked {
        for path in created {
            let _ = tokio::fs::remove_file(path).await;
        }
        return Err(error);
    }
    if cancel.is_cancelled() {
        for path in created {
            let _ = tokio::fs::remove_file(path).await;
        }
        return Err("mods_canceled");
    }
    let commit_root = root.clone();
    let result = tokio::task::spawn_blocking(move || {
        mod_files::transact(&commit_root, current, after, moves)
    })
    .await
    .unwrap_or(Err("mods_write"));
    // Once a journal exists, recovery owns its files; never delete them outside that transaction.
    if !root.join(".harbor-mods-transaction.json").exists() {
        for path in created {
            let _ = tokio::fs::remove_file(path).await;
        }
    }
    result
}

#[cfg(test)]
#[path = "mods_tests.rs"]
mod tests;
