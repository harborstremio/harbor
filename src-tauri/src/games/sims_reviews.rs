use super::{
    sims_files as files,
    sims_package::{self as package, Result},
    sims_store::{self as store, Action, Plan, State, Store},
};
use serde::Serialize;
use std::{
    collections::HashMap,
    path::Path,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub tray: store::tray::View,
    pub folder: files::Folder,
    pub state: State,
    pub recovery_needed: bool,
    pub kept_files: Vec<store::preparation::KeptFiles>,
    pub save_backup: Option<super::saves::SaveSnapshotInfo>,
    pub troubleshooting: Option<store::trouble::View>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub source: Option<store::CreatorSource>,
    pub token: String,
    pub action: Action,
    pub title: String,
    pub folder: String,
    pub game_version: String,
    pub files: Vec<files::Stamp>,
    pub skipped: Vec<String>,
    pub bytes: u64,
    pub expires_at: u64,
    pub changes: Vec<store::sets::Change>,
    pub backup_folder: Option<String>,
    pub source_folder: Option<String>,
    pub destination_folder: Option<String>,
    pub preview: Option<String>,
    pub information: Option<store::metadata::Report>,
}
struct Held {
    profile: String,
    created: Instant,
    plan: Plan,
}
fn reviews() -> &'static Mutex<HashMap<String, Held>> {
    static STORE: OnceLock<Mutex<HashMap<String, Held>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}
fn profile(value: &str) -> Result<()> {
    if value.is_empty() || value.len() > 200 || value.chars().any(char::is_control) {
        return Err("sims_profile");
    }
    Ok(())
}
pub fn workspace(path: &str) -> Result<Workspace> {
    let folder = files::inventory(path)?;
    let (state, recovery_needed) = store::snapshot(&folder.path)?;
    let troubleshooting = store::trouble::view(&state, &folder.game_version)?;
    Ok(Workspace {
        tray: store::tray::view(&folder.path)?,
        kept_files: store::preparation::list(Path::new(&folder.path))?,
        troubleshooting,
        folder,
        state,
        recovery_needed,
        save_backup: None,
    })
}
pub fn inspect(path: &str, file: &str) -> Result<package::PackageInfo> {
    let folder = files::validate(path)?;
    if file.len() > 2048
        || file.split('/').any(|v| package::filename(v).is_err())
        || !file.to_ascii_lowercase().ends_with(".package")
    {
        return Err("sims_path");
    }
    let mods = Path::new(&folder.path).join("Mods");
    let target = mods.join(file);
    let data = files::read(&target, package::MAX_FILE)?;
    if !target
        .canonicalize()
        .map_err(|_| "sims_path")?
        .starts_with(mods.canonicalize().map_err(|_| "sims_path")?)
    {
        return Err("sims_path");
    }
    package::inspect(&data, true)
}
#[cfg(test)]
pub fn review(
    profile_id: String,
    path: String,
    action: Action,
    sources: Vec<String>,
) -> Result<Review> {
    review_with_events(
        profile_id,
        path,
        action,
        sources,
        uuid::Uuid::new_v4().to_string(),
        |_| {},
    )
}
pub(super) fn parse_guard() -> Result<std::sync::MutexGuard<'static, ()>> {
    static PARSER: OnceLock<Mutex<()>> = OnceLock::new();
    PARSER
        .get_or_init(|| Mutex::new(()))
        .try_lock()
        .map_err(|_| "sims_busy")
}
pub fn review_with_events(
    profile_id: String,
    path: String,
    action: Action,
    sources: Vec<String>,
    operation_id: String,
    emit: impl Fn(store::progress::Progress),
) -> Result<Review> {
    profile(&profile_id)?;
    let mut work = store::progress::Work::start(&profile_id, &operation_id, &emit)?;
    let _parser = parse_guard()?;
    work.reviewing()?;
    let check = work.cancellation_check();
    let mut held = reviews().lock().map_err(|_| "sims_busy")?;
    held.retain(|_, v| v.created.elapsed() < Duration::from_secs(900));
    if held.len() >= 2 {
        return Err("sims_busy");
    }
    drop(held);
    let mut payload = Vec::new();
    let mut skipped = Vec::new();
    let mut total = 0;
    if matches!(&action, Action::Install { .. } | Action::Update { .. }) {
        if sources.is_empty() || sources.len() > 500 {
            return Err("sims_request");
        }
        for source in &sources {
            if source.len() > 4096 {
                return Err("sims_path");
            }
            let p = Path::new(&source);
            let name = p.file_name().and_then(|v| v.to_str()).ok_or("sims_path")?;
            work.review_file(name)?;
            let bytes = files::read_checked(p, package::MAX_IMPORT, &check)?;
            if name.to_ascii_lowercase().ends_with(".zip") {
                let import = package::unpack_zip_checked(&bytes, &check)?;
                skipped.extend(import.skipped);
                payload.extend(import.files);
            } else {
                package::validate_payload_checked(name, &bytes, &check)?;
                payload.push(package::Payload {
                    name: name.into(),
                    bytes,
                });
            }
            total = payload.iter().map(|f| f.bytes.len()).sum::<usize>();
            if total > package::MAX_IMPORT {
                return Err("sims_limit");
            }
        }
    } else if !sources.is_empty()
        && !matches!(action, Action::Adopt { .. } | Action::TrayImport { .. })
    {
        return Err("sims_request");
    }
    if reviews()
        .lock()
        .map_err(|_| "sims_busy")?
        .values()
        .map(|v| v.plan.payload.iter().map(|f| f.bytes.len()).sum::<usize>())
        .sum::<usize>()
        + total
        > package::MAX_IMPORT
    {
        return Err("sims_limit");
    }
    let plan = if matches!(
        action,
        Action::TrayImport { .. } | Action::TrayRemove { .. } | Action::TrayRestore { .. }
    ) {
        store::tray::plan_checked(&path, action, sources, &check)?
    } else if matches!(
        action,
        Action::StartTest { .. } | Action::AnswerTest { .. } | Action::RestoreTest { .. }
    ) {
        store::trouble::plan_checked(&path, action, &check)?
    } else if matches!(action, Action::Adopt { .. }) {
        store::adopt::plan_checked(&path, action, sources, &check)?
    } else if matches!(action, Action::ApplySet { .. }) {
        store::sets::plan_checked(&profile_id, &path, action, &check)?
    } else {
        store::plan_checked(&path, action, payload, skipped, &check)?
    };
    hold_plan(profile_id, plan, &check)
}
pub(super) fn hold_plan(
    profile_id: String,
    plan: Plan,
    check: &dyn Fn() -> Result<()>,
) -> Result<Review> {
    {
        let mut held = reviews().lock().map_err(|_| "sims_busy")?;
        held.retain(|_, entry| entry.created.elapsed() < Duration::from_secs(900));
        if held.len() >= 2 {
            return Err("sims_busy");
        }
    }
    if reviews()
        .lock()
        .map_err(|_| "sims_busy")?
        .values()
        .map(|v| v.plan.payload.iter().map(|f| f.bytes.len()).sum::<usize>())
        .sum::<usize>()
        + plan.payload.iter().map(|f| f.bytes.len()).sum::<usize>()
        > package::MAX_IMPORT
    {
        return Err("sims_limit");
    }
    check()?;
    let title = match &plan.action {
        Action::TrayImport { .. } | Action::TrayRemove { .. } | Action::TrayRestore { .. } => {
            plan.tray.as_ref().ok_or("sims_request")?.item.title.clone()
        }
        Action::StartTest { .. } | Action::AnswerTest { .. } | Action::RestoreTest { .. } => {
            String::new()
        }
        Action::ApplySet { .. } => plan
            .set
            .as_ref()
            .ok_or("sims_request")?
            .selection
            .title
            .clone(),
        Action::Install { title } | Action::Adopt { title } => title.clone(),
        Action::Restore { backup } => plan
            .before
            .backups
            .iter()
            .find(|b| b.id == *backup)
            .ok_or("sims_missing")?
            .group
            .title
            .clone(),
        _ => plan
            .before
            .groups
            .iter()
            .find(|g| g.id == plan.target_id)
            .ok_or("sims_missing")?
            .title
            .clone(),
    };
    let reviewed = plan.reviewed_files();
    let token = uuid::Uuid::new_v4().to_string();
    let review = Review {
        source: plan.source.clone(),
        information: store::metadata::incoming_validated(&plan.payload, check)?,
        preview: if matches!(plan.action, Action::TrayImport { .. }) {
            store::tray::images::payload_preview(
                &plan.tray.as_ref().ok_or("sims_request")?.item,
                &plan.payload,
            )?
        } else {
            None
        },
        token: token.clone(),
        action: plan.action.clone(),
        title,
        folder: plan.before.root.clone(),
        game_version: plan.version.clone(),
        bytes: if plan.set.is_some() || plan.trial.is_some() {
            plan.changes().iter().map(|c| c.bytes).sum()
        } else {
            reviewed.iter().map(|f| f.bytes).sum()
        },
        changes: plan.changes(),
        backup_folder: plan.backup_folder(),
        source_folder: plan.adoption.as_ref().map(|s| s.source_folder.clone()),
        destination_folder: if plan.tray.is_some() {
            Some(
                Path::new(&plan.before.root)
                    .join("Tray")
                    .to_string_lossy()
                    .into_owned(),
            )
        } else {
            plan.adoption.as_ref().map(|_| {
                Path::new(&plan.before.root)
                    .join("Mods")
                    .join(format!("Harbor-{}", plan.target_id))
                    .to_string_lossy()
                    .into_owned()
            })
        },
        files: reviewed,
        skipped: plan.skipped.clone(),
        expires_at: files::now() + 900,
    };
    check()?;
    let mut held = reviews().lock().map_err(|_| "sims_busy")?;
    held.retain(|_, v| v.created.elapsed() < Duration::from_secs(900));
    if held.len() >= 2 {
        return Err("sims_busy");
    }
    held.insert(
        token.clone(),
        Held {
            profile: profile_id,
            created: Instant::now(),
            plan,
        },
    );
    if let Err(error) = check() {
        held.remove(&token);
        return Err(error);
    }
    Ok(review)
}
pub fn discard(profile_id: &str, token: &str) {
    if let Ok(mut held) = reviews().lock() {
        if held.get(token).is_some_and(|h| h.profile == profile_id) {
            held.remove(token);
        }
    }
}
#[cfg(test)]
pub fn apply(profile_id: String, token: String) -> Result<Workspace> {
    apply_with_progress(profile_id, token, uuid::Uuid::new_v4().to_string(), |_| {})
}
#[cfg(test)]
pub fn apply_with_progress(
    profile_id: String,
    token: String,
    operation_id: String,
    emit: impl Fn(super::saves::SaveProgress),
) -> Result<Workspace> {
    apply_with_events(profile_id, token, operation_id, emit, |_| {})
}
pub fn apply_with_events(
    profile_id: String,
    token: String,
    operation_id: String,
    emit: impl Fn(super::saves::SaveProgress),
    emit_mods: impl Fn(store::progress::Progress),
) -> Result<Workspace> {
    profile(&profile_id)?;
    let plan = {
        let mut held = reviews().lock().map_err(|_| "sims_busy")?;
        let h = held.get(&token).ok_or("sims_expired")?;
        if h.profile != profile_id {
            return Err("sims_profile");
        }
        let h = held.remove(&token).ok_or("sims_expired")?;
        if h.created.elapsed() >= Duration::from_secs(900) {
            return Err("sims_expired");
        }
        h.plan
    };
    let path = plan.before.root.clone();
    let mut backup = None;
    let mut work = store::progress::Work::start(&profile_id, &operation_id, &emit_mods)?;
    work.check()?;
    {
        let store = Store::connect(&path)?;
        if plan.set.is_some() || plan.trial.is_some() {
            store.check_set(&plan)?;
            if let Some(vault) = plan.backup_folder() {
                let context = super::sims_saves::context(&path)?;
                backup = Some(super::sims_saves::snapshot(
                    &path,
                    super::saves::SaveRequest {
                        profile: profile_id.clone(),
                        game_id: "steam:1222670".into(),
                        game_name: "The Sims 4".into(),
                        source: context.source,
                        vault: vault.clone(),
                        label: plan
                            .set
                            .as_ref()
                            .map(|s| s.selection.title.clone())
                            .unwrap_or_else(|| "Sims mod test".into()),
                        operation_id: operation_id.clone(),
                    },
                    |value| {
                        if work.check().is_err() {
                            super::saves::cancel(profile_id.clone(), operation_id.clone());
                        }
                        emit(value);
                    },
                )?);
            }
        }
        store.apply_controlled(plan, &mut work)?;
    }
    let mut result = workspace(&path)?;
    result.save_backup = backup;
    work.done();
    Ok(result)
}
pub fn cancel(profile_id: String, operation_id: String) -> bool {
    if store::progress::cancel(&profile_id, &operation_id) {
        super::saves::cancel(profile_id, operation_id);
        true
    } else {
        false
    }
}
pub fn recover(path: String) -> Result<Workspace> {
    {
        let store = Store::connect(&path)?;
        store.recover()?;
    }
    workspace(&path)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn expired_native_review_cannot_apply() {
        let token = uuid::Uuid::new_v4().to_string();
        let plan = Plan {
            source: None,
            tray: None,
            trial: None,
            before: State {
                schema: 1,
                root: "unused".into(),
                revision: "initial".into(),
                groups: vec![],
                backups: vec![],
                troubleshoot: None,
            },
            action: Action::Remove {
                id: "unused".into(),
            },
            version: String::new(),
            payload: vec![],
            skipped: vec![],
            existing: vec![],
            restore_files: vec![],
            target_id: String::new(),
            set: None,
            adoption: None,
        };
        reviews().lock().unwrap().insert(
            token.clone(),
            Held {
                profile: "expired-proof".into(),
                created: Instant::now() - Duration::from_secs(901),
                plan,
            },
        );
        assert!(matches!(
            apply("expired-proof".into(), token.clone()),
            Err("sims_expired")
        ));
        assert!(!reviews().lock().unwrap().contains_key(&token));
    }
}
