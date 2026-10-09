//! Explicit ownership transfer for selected sibling files already in Mods.
//! The journal exists before the first file move; original directories stay put.
use super::*;
use std::path::Component;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Source {
    pub relative: String,
    pub file: files::Stamp,
}
pub struct Selection {
    pub sources: Vec<Source>,
    pub source_folder: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Record {
    pub stage: String,
    pub group: String,
    pub sources: Vec<Source>,
}
fn relative(value: &str) -> Result<PathBuf> {
    if value.is_empty() || value.len() > 2048 || value.contains('\\') {
        return Err("sims_record");
    }
    let path = Path::new(value);
    let parts: Vec<_> = path.components().collect();
    if parts.len() > 9 || parts.iter().any(|p| !matches!(p, Component::Normal(_))) {
        return Err("sims_record");
    }
    for part in value.split('/') {
        package::filename(part)?;
    }
    if value
        .split('/')
        .next()
        .is_some_and(|s| s.to_ascii_lowercase().starts_with("harbor-"))
        || value.eq_ignore_ascii_case("Resource.cfg")
    {
        return Err("sims_adopt_managed");
    }
    Ok(path.into())
}
fn origin(root: &Path, source: &Source) -> Result<PathBuf> {
    let rel = relative(&source.relative)?;
    if rel.file_name().and_then(|v| v.to_str()) != Some(source.file.name.as_str()) {
        return Err("sims_record");
    }
    let mods = files::directory(&root.join("Mods"))?;
    let path = mods.join(rel);
    files::directory(path.parent().ok_or("sims_path")?)?;
    Ok(path)
}
pub(super) fn exists(path: &Path) -> Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err("sims_read"),
    }
}
pub(super) fn check_file(path: &Path, expected: &files::Stamp) -> Result<()> {
    check_file_controlled(path, expected, &|| Ok(()))
}
pub(super) fn check_file_controlled(
    path: &Path,
    expected: &files::Stamp,
    check: &dyn Fn() -> Result<()>,
) -> Result<()> {
    let bytes = files::read_checked(path, package::MAX_FILE, check)?;
    if files::stamp(expected.name.clone(), &bytes) != *expected {
        return Err("sims_changed");
    }
    Ok(())
}
pub(super) fn move_file(from: &Path, to: &Path, expected: &files::Stamp) -> Result<()> {
    check_file(from, expected)?;
    if exists(to)? {
        return Err("sims_exists");
    }
    fs::rename(from, to).map_err(|_| "sims_write")
}
#[cfg(test)]
pub fn plan(path: &str, action: Action, sources: Vec<String>) -> Result<Plan> {
    plan_checked(path, action, sources, &|| Ok(()))
}
pub fn plan_checked(
    path: &str,
    action: Action,
    sources: Vec<String>,
    check: &dyn Fn() -> Result<()>,
) -> Result<Plan> {
    check()?;
    let Action::Adopt { title } = &action else {
        return Err("sims_request");
    };
    if title.trim().is_empty() || title.len() > 200 || title.chars().any(char::is_control) {
        return Err("sims_title");
    }
    if sources.is_empty() || sources.len() > 500 {
        return Err("sims_request");
    }
    let folder = files::validate(path)?;
    let (state, pending) = snapshot(&folder.path)?;
    if pending {
        return Err("sims_recovery");
    }
    trouble::unlocked(&state)?;
    let mods = files::directory(&Path::new(&folder.path).join("Mods"))?;
    let mut selected = Vec::new();
    let mut parent: Option<PathBuf> = None;
    let mut total = 0;
    for source in sources {
        if source.len() > 4096 {
            return Err("sims_path");
        }
        let file = Path::new(&source);
        let name = file
            .file_name()
            .and_then(|v| v.to_str())
            .ok_or("sims_path")?;
        package::filename(name)?;
        let current = files::directory(file.parent().ok_or("sims_path")?)?;
        if parent.as_ref().is_some_and(|p| p != &current) {
            return Err("sims_adopt_folder");
        }
        parent = Some(current.clone());
        let rel = current
            .strip_prefix(&mods)
            .map_err(|_| "sims_adopt_folder")?
            .join(name);
        let rel = rel.to_str().ok_or("sims_path")?.replace('\\', "/");
        relative(&rel)?;
        let bytes = files::read_checked(&current.join(name), package::MAX_FILE, check)?;
        package::validate_payload_checked(name, &bytes, check)?;
        total += bytes.len();
        if total > package::MAX_IMPORT {
            return Err("sims_limit");
        }
        selected.push(Source {
            relative: rel,
            file: files::stamp(name.into(), &bytes),
        });
    }
    selected.sort_by(|a, b| a.file.name.cmp(&b.file.name));
    let stamps: Vec<_> = selected.iter().map(|s| s.file.clone()).collect();
    validate_tree(&stamps)?;
    if !stamps
        .iter()
        .any(|f| matches!(package::kind(&f.name), "package" | "script"))
    {
        return Err("sims_format");
    }
    let plan = Plan {
        source: None,
        tray: None,
        trial: None,
        before: state,
        action,
        version: folder.game_version,
        payload: vec![],
        skipped: vec![],
        existing: vec![],
        restore_files: vec![],
        target_id: uuid::Uuid::new_v4().to_string(),
        set: None,
        adoption: Some(Selection {
            sources: selected,
            source_folder: parent.ok_or("sims_path")?.to_string_lossy().into_owned(),
        }),
    };
    check_controlled(&plan, check)?;
    Ok(plan)
}
pub fn check(plan: &Plan) -> Result<()> {
    check_controlled(plan, &|| Ok(()))
}
fn check_controlled(plan: &Plan, cancel: &dyn Fn() -> Result<()>) -> Result<()> {
    let selection = plan.adoption.as_ref().ok_or("sims_request")?;
    let inventory = files::inventory(&plan.before.root)?;
    if inventory.partial {
        return Err("sims_adopt_scan");
    }
    let names: BTreeSet<_> = selection
        .sources
        .iter()
        .filter(|s| matches!(package::kind(&s.file.name), "package" | "script"))
        .map(|s| s.file.name.to_ascii_lowercase())
        .collect();
    let selected: BTreeSet<_> = selection
        .sources
        .iter()
        .map(|s| s.relative.to_ascii_lowercase())
        .collect();
    for file in inventory.files {
        let path = file.path.to_ascii_lowercase();
        if !selected.contains(&path) && names.contains(path.rsplit('/').next().unwrap_or("")) {
            return Err("sims_duplicate");
        }
    }
    for source in &selection.sources {
        check_file_controlled(
            &origin(Path::new(&plan.before.root), source)?,
            &source.file,
            cancel,
        )?;
    }
    Ok(())
}
pub(super) fn validate(journal: &Journal, root: &Path) -> Result<()> {
    if journal.before.troubleshoot.is_some() || journal.after.troubleshoot.is_some() {
        return Err("sims_record");
    }
    let record = journal.adoption.as_ref().ok_or("sims_record")?;
    uuid(&record.stage)?;
    uuid(&record.group)?;
    if !journal.moves.is_empty() || record.sources.is_empty() || record.sources.len() > 500 {
        return Err("sims_record");
    }
    let files: Vec<_> = record.sources.iter().map(|s| s.file.clone()).collect();
    validate_tree(&files)?;
    let mut parent: Option<PathBuf> = None;
    for source in &record.sources {
        let path = origin(root, source)?;
        if parent
            .as_ref()
            .is_some_and(|p| Some(p.as_path()) != path.parent())
        {
            return Err("sims_record");
        }
        parent = path.parent().map(PathBuf::from);
    }
    if journal.before.groups.iter().any(|g| g.id == record.group) {
        return Err("sims_record");
    }
    let group = journal
        .after
        .groups
        .iter()
        .find(|g| g.id == record.group)
        .ok_or("sims_record")?;
    if !group.enabled || group.files != files {
        return Err("sims_record");
    }
    let mut expected = journal.before.clone();
    expected.revision = journal.after.revision.clone();
    expected.groups.push(group.clone());
    if expected != journal.after {
        return Err("sims_record");
    }
    Ok(())
}
impl Store {
    fn adoption_container(&self, record: &Record) -> Result<Option<PathBuf>> {
        let stage = self.path(&Area::Stage(record.stage.clone()))?;
        let live = self.path(&Area::Live(record.group.clone()))?;
        if exists(&stage)? {
            files::directory(&stage)?;
            Ok(Some(stage))
        } else if exists(&live)? {
            files::directory(&live)?;
            Ok(Some(live))
        } else {
            Ok(None)
        }
    }
    fn rollback_adoption(&self, journal: &Journal) -> Result<()> {
        let record = journal.adoption.as_ref().ok_or("sims_record")?;
        let container = self.adoption_container(record)?;
        let actual = container
            .as_ref()
            .map(|p| files::tree(p))
            .transpose()?
            .unwrap_or_default();
        // No unrecorded files may be moved or removed, including creator files
        // written after a completed publication but before journal recovery.
        if actual
            .iter()
            .any(|f| !record.sources.iter().any(|s| s.file == *f))
        {
            return Err("sims_changed");
        }
        for source in &record.sources {
            let original = origin(&self.root, source)?;
            let held = container.as_ref().map(|p| p.join(&source.file.name));
            match (
                exists(&original)?,
                held.as_ref()
                    .map(|p| exists(p))
                    .transpose()?
                    .unwrap_or(false),
            ) {
                (true, false) => check_file(&original, &source.file)?,
                (false, true) => check_file(held.as_ref().ok_or("sims_record")?, &source.file)?,
                _ => return Err("sims_recovery"),
            }
        }
        files::idle()?;
        for (_index, source) in record.sources.iter().rev().enumerate() {
            let original = origin(&self.root, source)?;
            if let Some(container) = &container {
                let held = container.join(&source.file.name);
                if exists(&held)? {
                    move_file(&held, &original, &source.file)?;
                }
            }
            #[cfg(test)]
            super::super::saves::interruption_checkpoint(&format!("adoptRollback{}", _index + 1));
        }
        if let Some(container) = container {
            // remove_dir is deliberately non-recursive: new external files win.
            fs::remove_dir(container).map_err(|_| "sims_recovery")?;
        }
        self.write_state(&journal.before)?;
        fs::remove_file(self.base.join("journal.json")).map_err(|_| "sims_write")?;
        Ok(())
    }
    pub(super) fn recover_adoption(&self, journal: &Journal) -> Result<State> {
        self.rollback_adoption(journal)?;
        Ok(journal.before.clone())
    }
    pub(super) fn apply_adoption(
        &self,
        plan: Plan,
        work: &mut progress::Work<'_>,
    ) -> Result<State> {
        files::idle()?;
        let (current, pending) = snapshot(self.root.to_str().ok_or("sims_path")?)?;
        if pending {
            return Err("sims_recovery");
        }
        if current != plan.before || files::validate(&current.root)?.game_version != plan.version {
            return Err("sims_changed");
        }
        trouble::unlocked(&current)?;
        check(&plan)?;
        let Action::Adopt { title } = &plan.action else {
            return Err("sims_request");
        };
        let selection = plan.adoption.as_ref().ok_or("sims_request")?;
        let group = Group {
            source: None,
            id: plan.target_id.clone(),
            title: title.trim().into(),
            enabled: true,
            files: selection.sources.iter().map(|s| s.file.clone()).collect(),
            installed_at: files::now(),
            game_version: plan.version.clone(),
        };
        let mut after = current.clone();
        after.revision = uuid::Uuid::new_v4().to_string();
        after.groups.push(group.clone());
        let record = Record {
            stage: uuid::Uuid::new_v4().to_string(),
            group: group.id.clone(),
            sources: selection.sources.clone(),
        };
        let stage = self.path(&Area::Stage(record.stage.clone()))?;
        let live = self.path(&Area::Live(group.id.clone()))?;
        if exists(&live)? {
            return Err("sims_exists");
        }
        let journal = Journal {
            before: current,
            after: after.clone(),
            moves: vec![],
            adoption: Some(record),
        };
        validate_journal(&journal, &self.root)?;
        work.publish()?;
        self.begin_preparation(
            preparation::Kind::Mods,
            &journal.adoption.as_ref().ok_or("sims_request")?.stage,
            &group.title,
            group
                .files
                .iter()
                .cloned()
                .map(|file| preparation::Entry { folder: None, file })
                .collect(),
        )?;
        fs::create_dir(&stage).map_err(|_| "sims_write")?;
        if let Err(error) = self.write_journal(&journal) {
            let _ = fs::remove_dir(&stage);
            return Err(error);
        }
        #[cfg(test)]
        super::super::saves::interruption_checkpoint("adoptJournal");
        let applied = (|| {
            files::idle()?;
            for (_index, source) in selection.sources.iter().enumerate() {
                move_file(
                    &origin(&self.root, source)?,
                    &stage.join(&source.file.name),
                    &source.file,
                )?;
                #[cfg(test)]
                super::super::saves::interruption_checkpoint(&format!("adoptMove{}", _index + 1));
            }
            unchanged(&stage, &group.files)?;
            if exists(&live)? {
                return Err("sims_exists");
            }
            fs::rename(&stage, &live).map_err(|_| "sims_write")?;
            #[cfg(test)]
            super::super::saves::interruption_checkpoint("adoptPublished");
            self.write_state(&after)?;
            #[cfg(test)]
            super::super::saves::interruption_checkpoint("adoptState");
            fs::remove_file(self.base.join("journal.json")).map_err(|_| "sims_write")?;
            Ok(())
        })();
        if let Err(error) = applied {
            return if self.rollback_adoption(&journal).is_ok() {
                Err(error)
            } else {
                Err("sims_recovery")
            };
        }
        Ok(after)
    }
}
