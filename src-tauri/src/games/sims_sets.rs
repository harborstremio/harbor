//! Named selections refer to managed group IDs, never arbitrary file paths.
//! New imports stay unchanged; removed members require an explicit edit.
use super::*;
use sha2::{Digest, Sha256};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Member {
    pub id: String,
    pub title: String,
    pub enabled: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModSet {
    pub id: String,
    pub title: String,
    pub members: Vec<Member>,
    pub updated_at: u64,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Catalog {
    schema: u8,
    root: String,
    profile: String,
    sets: Vec<ModSet>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Selection {
    pub id: String,
    pub enabled: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Edit {
    pub revision: String,
    pub previous: Option<ModSet>,
    pub title: String,
    pub members: Vec<Selection>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub id: String,
    pub title: String,
    pub enabled: bool,
    pub file_count: usize,
    pub bytes: u64,
    #[serde(skip)]
    pub files: Vec<files::Stamp>,
}
pub struct SetPlan {
    pub profile: String,
    pub selection: ModSet,
    pub changes: Vec<Change>,
    pub backup_folder: Option<String>,
}
fn scope(profile: &str) -> Result<String> {
    if profile.is_empty() || profile.len() > 200 || profile.chars().any(char::is_control) {
        return Err("sims_profile");
    }
    Ok(format!("{:x}", Sha256::digest(profile.as_bytes())))
}
fn title(value: &str) -> Result<()> {
    if value.trim().is_empty() || value.len() > 200 || value.chars().any(char::is_control) {
        return Err("sims_title");
    }
    Ok(())
}
fn catalog(profile: &str, root: &Path) -> Result<Catalog> {
    let profile = scope(profile)?;
    let path = root.join(STORE).join(format!("sets-{profile}.json"));
    if !path.try_exists().map_err(|_| "sims_read")? {
        return Ok(Catalog {
            schema: 1,
            root: root.to_string_lossy().into_owned(),
            profile,
            sets: vec![],
        });
    }
    let value: Catalog = read_json(&path)?;
    if value.schema != 1
        || value.root != root.to_string_lossy()
        || value.profile != profile
        || value.sets.len() > 100
    {
        return Err("sims_record");
    }
    let mut ids = BTreeSet::new();
    for set in &value.sets {
        uuid(&set.id)?;
        title(&set.title)?;
        if !ids.insert(&set.id) || set.members.is_empty() || set.members.len() > 500 {
            return Err("sims_record");
        }
        let mut members = BTreeSet::new();
        for member in &set.members {
            uuid(&member.id)?;
            title(&member.title)?;
            if !members.insert(&member.id) {
                return Err("sims_record");
            }
        }
    }
    Ok(value)
}
pub fn list(profile: &str, path: &str) -> Result<Vec<ModSet>> {
    let folder = files::inspect_folder(path)?;
    Ok(catalog(profile, Path::new(&folder.path))?.sets)
}
pub fn save(profile: &str, path: &str, edit: Edit) -> Result<Vec<ModSet>> {
    title(&edit.title)?;
    let store = Store::connect(path)?;
    let (state, pending) = snapshot(path)?;
    if pending {
        return Err("sims_recovery");
    }
    if state.revision != edit.revision {
        return Err("sims_changed");
    }
    let mut value = catalog(profile, &store.root)?;
    let id = if let Some(previous) = &edit.previous {
        if !value.sets.contains(previous) {
            return Err("sims_changed");
        }
        previous.id.clone()
    } else {
        if value.sets.len() >= 100 {
            return Err("sims_limit");
        }
        uuid::Uuid::new_v4().to_string()
    };
    let mut members = Vec::new();
    let mut ids = BTreeSet::new();
    if edit.members.len() != state.groups.len() || edit.members.is_empty() {
        return Err("sims_changed");
    }
    for selection in edit.members {
        if !ids.insert(selection.id.clone()) {
            return Err("sims_request");
        }
        let group = state
            .groups
            .iter()
            .find(|g| g.id == selection.id)
            .ok_or("sims_missing")?;
        members.push(Member {
            id: group.id.clone(),
            title: group.title.clone(),
            enabled: selection.enabled,
        });
    }
    members.sort_by(|a, b| a.id.cmp(&b.id));
    let set = ModSet {
        id: id.clone(),
        title: edit.title.trim().into(),
        members,
        updated_at: files::now(),
    };
    value.sets.retain(|s| s.id != id);
    value.sets.push(set);
    store.write_record(&format!("sets-{}.json", value.profile), &value)?;
    Ok(value.sets)
}
pub fn remove(profile: &str, path: &str, previous: ModSet) -> Result<Vec<ModSet>> {
    let store = Store::connect(path)?;
    if snapshot(path)?.1 {
        return Err("sims_recovery");
    }
    let mut value = catalog(profile, &store.root)?;
    if !value.sets.contains(&previous) {
        return Err("sims_changed");
    }
    value.sets.retain(|s| s.id != previous.id);
    store.write_record(&format!("sets-{}.json", value.profile), &value)?;
    Ok(value.sets)
}
pub fn changes_checked(
    state: &State,
    members: &[Member],
    check: &dyn Fn() -> Result<()>,
) -> Result<Vec<Change>> {
    let root = Path::new(&state.root);
    let mut changes = Vec::new();
    for member in members {
        let group = state
            .groups
            .iter()
            .find(|g| g.id == member.id)
            .ok_or("sims_set_missing")?;
        if group.enabled == member.enabled {
            continue;
        }
        let tree = files::tree_checked(
            &area_path(root, &root.join(STORE), &location(group))?,
            check,
        )?;
        verify_owned(group, &tree)?;
        validate_tree(&tree)?;
        changes.push(Change {
            id: group.id.clone(),
            title: group.title.clone(),
            enabled: member.enabled,
            file_count: tree.len(),
            bytes: tree.iter().map(|f| f.bytes).sum(),
            files: tree,
        });
    }
    changes.sort_by(|a, b| a.enabled.cmp(&b.enabled).then_with(|| a.id.cmp(&b.id)));
    Ok(changes)
}
pub fn backup_folder(path: &str, value: &Option<String>) -> Result<Option<String>> {
    Ok(match value {
        Some(value) if value.len() <= 4096 && !value.contains('\0') => Some(if value.is_empty() {
            super::super::sims_saves::context(path)?.vault
        } else {
            value.clone()
        }),
        Some(_) => return Err("sims_path"),
        None => None,
    })
}
#[cfg(test)]
pub fn plan(profile: &str, path: &str, action: Action) -> Result<Plan> {
    plan_checked(profile, path, action, &|| Ok(()))
}
pub fn plan_checked(
    profile: &str,
    path: &str,
    action: Action,
    check: &dyn Fn() -> Result<()>,
) -> Result<Plan> {
    check()?;
    let Action::ApplySet { id, backup_folder } = &action else {
        return Err("sims_request");
    };
    let folder = files::validate(path)?;
    let (state, pending) = snapshot(path)?;
    if pending {
        return Err("sims_recovery");
    }
    trouble::unlocked(&state)?;
    let selection = list(profile, path)?
        .into_iter()
        .find(|s| s.id == *id)
        .ok_or("sims_missing")?;
    let changes = changes_checked(&state, &selection.members, check)?;
    if changes.is_empty() {
        return Err("sims_set_unchanged");
    }
    let backup_folder = self::backup_folder(path, backup_folder)?;
    let plan = Plan {
        source: None,
        tray: None,
        trial: None,
        adoption: None,
        before: state,
        action,
        version: folder.game_version,
        payload: vec![],
        skipped: vec![],
        existing: vec![],
        restore_files: vec![],
        target_id: String::new(),
        set: Some(SetPlan {
            profile: profile.into(),
            selection,
            changes,
            backup_folder,
        }),
    };
    check_controlled(&plan, check)?;
    Ok(plan)
}
pub fn check(plan: &Plan) -> Result<()> {
    check_controlled(plan, &|| Ok(()))
}
fn check_controlled(plan: &Plan, cancel: &dyn Fn() -> Result<()>) -> Result<()> {
    let set = plan.set.as_ref().ok_or("sims_request")?;
    if !list(&set.profile, &plan.before.root)?.contains(&set.selection) {
        return Err("sims_changed");
    }
    check_changes_controlled(plan, &set.changes, cancel)
}
pub fn check_changes_controlled(
    plan: &Plan,
    changes: &[Change],
    cancel: &dyn Fn() -> Result<()>,
) -> Result<()> {
    let inventory = files::inventory(&plan.before.root)?;
    if inventory.partial {
        return Err("sims_set_scan");
    }
    let mut incoming = BTreeSet::new();
    let outgoing: Vec<_> = changes
        .iter()
        .filter(|c| !c.enabled)
        .map(|c| format!("harbor-{}/", c.id.to_lowercase()))
        .collect();
    for change in changes {
        let group = plan
            .before
            .groups
            .iter()
            .find(|g| g.id == change.id)
            .ok_or("sims_missing")?;
        unchanged_checked(
            &area_path(
                Path::new(&plan.before.root),
                &Path::new(&plan.before.root).join(STORE),
                &location(group),
            )?,
            &change.files,
            cancel,
        )?;
        if change.enabled {
            for file in change
                .files
                .iter()
                .filter(|f| matches!(package::kind(&f.name), "package" | "script"))
            {
                if !incoming.insert(file.name.to_ascii_lowercase()) {
                    return Err("sims_duplicate");
                }
            }
        }
    }
    for file in inventory.files {
        let path = file.path.to_ascii_lowercase();
        if !outgoing.iter().any(|prefix| path.starts_with(prefix))
            && incoming.contains(path.rsplit('/').next().unwrap_or(""))
        {
            return Err("sims_duplicate");
        }
    }
    Ok(())
}
