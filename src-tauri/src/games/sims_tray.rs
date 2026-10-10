//! Flat Tray publication shares the Sims root lock and durable recovery flow.
use super::adopt::{check_file, exists, move_file};
use super::*;
#[path = "sims_tray_format.rs"]
pub mod format;
#[path = "sims_tray_images.rs"]
pub mod images;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub title: String,
    pub category: String,
    pub files: Vec<files::Stamp>,
    pub installed: bool,
    pub installed_at: u64,
    pub cc_group: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<CreatorSource>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
struct Library {
    schema: u8,
    root: String,
    revision: String,
    items: Vec<Item>,
}
#[derive(Clone)]
pub struct Selection {
    before: Library,
    pub item: Item,
}
#[derive(Serialize)]
pub struct View {
    pub items: Vec<Item>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
struct Transaction {
    before: State,
    after: State,
    library_before: Library,
    library_after: Library,
    action: Action,
    item: Item,
    stage: String,
}
fn read_library(root: &Path) -> Result<Library> {
    let path = root.join(STORE).join("tray.json");
    let value = if exists(&path)? {
        read_json(&path)?
    } else {
        Library {
            schema: 1,
            root: root.to_string_lossy().into_owned(),
            revision: "initial".into(),
            items: vec![],
        }
    };
    validate_library(&value, root)?;
    Ok(value)
}
fn validate_library(value: &Library, root: &Path) -> Result<()> {
    if value.schema != 1 || Path::new(&value.root) != root || value.items.len() > 1000 {
        return Err("sims_record");
    }
    if value.revision != "initial" {
        uuid(&value.revision)?;
    }
    let mut ids = BTreeSet::new();
    let mut names = BTreeSet::new();
    for item in &value.items {
        uuid(&item.id)?;
        if !ids.insert(&item.id)
            || item.title.trim().is_empty()
            || item.title.len() > 200
            || item.title.chars().any(char::is_control)
        {
            return Err("sims_record");
        }
        if let Some(id) = &item.cc_group {
            uuid(id)?;
        }
        if let Some(source) = &item.source {
            source.validate()?;
            if source.provider != "mts" {
                return Err("sims_record");
            }
        }
        validate_tree(&item.files)?;
        if format::category(
            &item
                .files
                .iter()
                .map(|f| f.name.clone())
                .collect::<Vec<_>>(),
        )? != item.category
        {
            return Err("sims_record");
        }
        for file in &item.files {
            if !names.insert(file.name.to_ascii_lowercase()) {
                return Err("sims_record");
            }
        }
    }
    Ok(())
}
pub fn view(path: &str) -> Result<View> {
    Ok(View {
        items: read_library(Path::new(path))?.items,
    })
}
fn tray_path(root: &Path) -> Result<PathBuf> {
    let path = root.join("Tray");
    if exists(&path)? {
        files::directory(&path)?;
    }
    Ok(path)
}
fn no_collisions(root: &Path, item: &Item) -> Result<()> {
    let tray = tray_path(root)?;
    if !exists(&tray)? {
        return Ok(());
    }
    let names: BTreeSet<_> = item
        .files
        .iter()
        .map(|f| f.name.to_ascii_lowercase())
        .collect();
    for (i, entry) in fs::read_dir(&tray).map_err(|_| "sims_read")?.enumerate() {
        if i >= 100_000 {
            return Err("sims_limit");
        }
        let entry = entry.map_err(|_| "sims_read")?;
        if names.contains(&entry.file_name().to_string_lossy().to_ascii_lowercase()) {
            return Err("sims_tray_exists");
        }
    }
    Ok(())
}
fn check_cc(plan: &Plan) -> Result<()> {
    let inventory = files::inventory(&plan.before.root)?;
    let names: BTreeSet<_> = plan
        .payload
        .iter()
        .filter(|f| !format::is_tray(&f.name))
        .map(|f| f.name.to_ascii_lowercase())
        .collect();
    if !names.is_empty() && inventory.partial {
        return Err("sims_limit");
    }
    if inventory
        .files
        .iter()
        .any(|f| names.contains(&f.path.rsplit('/').next().unwrap_or("").to_ascii_lowercase()))
    {
        return Err("sims_duplicate");
    }
    Ok(())
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
    plan_with_import(path, action, sources, None, check)
}
pub fn plan_import_checked(
    path: &str,
    title: String,
    imported: package::Import,
    check: &dyn Fn() -> Result<()>,
) -> Result<Plan> {
    plan_with_import(
        path,
        Action::TrayImport { title },
        vec![],
        Some(imported),
        check,
    )
}
fn plan_with_import(
    path: &str,
    action: Action,
    sources: Vec<String>,
    imported: Option<package::Import>,
    check: &dyn Fn() -> Result<()>,
) -> Result<Plan> {
    check()?;
    let folder = files::validate(path)?;
    let root = Path::new(&folder.path);
    let (before, pending) = snapshot(&folder.path)?;
    if pending {
        return Err("sims_recovery");
    }
    trouble::unlocked(&before)?;
    let library = read_library(root)?;
    let mut payload = vec![];
    let mut skipped = vec![];
    let item = match &action {
        Action::TrayImport { title } => {
            if title.trim().is_empty() || title.len() > 200 || title.chars().any(char::is_control) {
                return Err("sims_title");
            }
            let imported = match imported {
                Some(value) => value,
                None => format::read_sources_checked(&sources, check)?,
            };
            payload = imported.files;
            skipped = imported.skipped;
            let mut files: Vec<_> = payload
                .iter()
                .filter(|f| format::is_tray(&f.name))
                .map(|f| files::stamp(f.name.clone(), &f.bytes))
                .collect();
            files.sort_by(|a, b| a.name.cmp(&b.name));
            let category =
                format::category(&files.iter().map(|f| f.name.clone()).collect::<Vec<_>>())?.into();
            if library.items.iter().any(|item| {
                item.files.iter().any(|f| {
                    files
                        .iter()
                        .any(|new| new.name.eq_ignore_ascii_case(&f.name))
                })
            }) {
                return Err("sims_tray_exists");
            }
            Item {
                id: uuid::Uuid::new_v4().to_string(),
                title: title.trim().into(),
                category,
                files,
                installed: true,
                installed_at: files::now(),
                cc_group: payload
                    .iter()
                    .any(|f| !format::is_tray(&f.name))
                    .then(|| uuid::Uuid::new_v4().to_string()),
                source: None,
            }
        }
        Action::TrayRemove { id } | Action::TrayRestore { id } => {
            if !sources.is_empty() {
                return Err("sims_request");
            }
            let mut item = library
                .items
                .iter()
                .find(|item| item.id == *id)
                .cloned()
                .ok_or("sims_missing")?;
            let restore = matches!(&action, Action::TrayRestore { .. });
            if item.installed == restore {
                return Err("sims_changed");
            }
            item.installed = restore;
            item
        }
        _ => return Err("sims_request"),
    };
    if item.installed {
        no_collisions(root, &item)?;
    } else {
        for f in &item.files {
            super::adopt::check_file_controlled(&tray_path(root)?.join(&f.name), f, check)?;
        }
    }
    if matches!(&action, Action::TrayRestore { .. }) {
        for f in &item.files {
            super::adopt::check_file_controlled(
                &root
                    .join(STORE)
                    .join("tray-vault")
                    .join(&item.id)
                    .join(&f.name),
                f,
                check,
            )?;
        }
    }
    let plan = Plan {
        source: None,
        before,
        action,
        version: folder.game_version,
        payload,
        skipped,
        existing: vec![],
        restore_files: vec![],
        target_id: item.id.clone(),
        set: None,
        adoption: None,
        trial: None,
        tray: Some(Selection {
            before: library,
            item,
        }),
    };
    check_cc(&plan)?;
    Ok(plan)
}
pub fn reviewed_files(plan: &Plan) -> Vec<files::Stamp> {
    let Some(selection) = &plan.tray else {
        return vec![];
    };
    let mut result = selection.item.files.clone();
    for file in &mut result {
        file.name = format!("Tray/{}", file.name);
    }
    if let Some(id) = &selection.item.cc_group {
        result.extend(
            plan.payload
                .iter()
                .filter(|f| !format::is_tray(&f.name))
                .map(|f| files::stamp(format!("Mods/Harbor-{id}/{}", f.name), &f.bytes)),
        );
    }
    result
}
fn validate_transaction(tx: &Transaction, root: &Path) -> Result<()> {
    validate_state(&tx.before, root)?;
    validate_state(&tx.after, root)?;
    validate_library(&tx.library_before, root)?;
    validate_library(&tx.library_after, root)?;
    uuid(&tx.stage)?;
    let mut expected = tx.library_before.clone();
    expected.revision = tx.library_after.revision.clone();
    if expected.revision == tx.library_before.revision {
        return Err("sims_record");
    }
    let mut mods = tx.before.clone();
    match &tx.action {
        Action::TrayImport { title } => {
            if !tx.item.installed
                || title.trim() != tx.item.title
                || expected.items.iter().any(|i| i.id == tx.item.id)
            {
                return Err("sims_record");
            }
            expected.items.push(tx.item.clone());
            if let Some(id) = &tx.item.cc_group {
                if mods.groups.iter().any(|g| g.id == *id) {
                    return Err("sims_record");
                }
                let group = tx
                    .after
                    .groups
                    .iter()
                    .find(|g| g.id == *id)
                    .ok_or("sims_record")?;
                if !group.enabled || group.title != tx.item.title {
                    return Err("sims_record");
                }
                mods.groups.push(group.clone());
                mods.revision = tx.after.revision.clone();
                if mods.revision == tx.before.revision {
                    return Err("sims_record");
                }
            }
        }
        Action::TrayRemove { id } | Action::TrayRestore { id } => {
            let item = expected
                .items
                .iter_mut()
                .find(|i| i.id == *id)
                .ok_or("sims_record")?;
            if item.installed == tx.item.installed
                || tx.item.installed != matches!(tx.action, Action::TrayRestore { .. })
            {
                return Err("sims_record");
            }
            item.installed = tx.item.installed;
            if *item != tx.item {
                return Err("sims_record");
            }
        }
        _ => return Err("sims_record"),
    }
    if mods != tx.after
        || expected != tx.library_after
        || tx.before.troubleshoot.is_some()
        || tx.after.troubleshoot.is_some()
    {
        return Err("sims_record");
    }
    Ok(())
}
impl Store {
    fn tray_stage(&self, tx: &Transaction) -> PathBuf {
        self.base.join("tray-stage").join(&tx.stage)
    }
    fn tray_ends(&self, tx: &Transaction) -> Result<(PathBuf, PathBuf)> {
        let tray = tray_path(&self.root)?;
        let vault = self.base.join("tray-vault").join(&tx.item.id);
        match tx.action {
            Action::TrayImport { .. } => Ok((self.tray_stage(tx).join("tray"), tray)),
            Action::TrayRemove { .. } => Ok((tray, vault)),
            Action::TrayRestore { .. } => Ok((vault, tray)),
            _ => Err("sims_record"),
        }
    }
    fn tray_cc<'a>(&self, tx: &'a Transaction) -> Option<(PathBuf, PathBuf, &'a Group)> {
        if !matches!(tx.action, Action::TrayImport { .. }) {
            return None;
        }
        let id = tx.item.cc_group.as_ref()?;
        tx.after.groups.iter().find(|g| g.id == *id).map(|g| {
            (
                self.tray_stage(tx).join("cc"),
                self.root.join("Mods").join(format!("Harbor-{id}")),
                g,
            )
        })
    }
    fn rollback_tray(&self, tx: &Transaction) -> Result<()> {
        validate_transaction(tx, &self.root)?;
        let (from, to) = self.tray_ends(tx)?;
        for file in &tx.item.files {
            match (
                exists(&from.join(&file.name))?,
                exists(&to.join(&file.name))?,
            ) {
                (true, false) => check_file(&from.join(&file.name), file)?,
                (false, true) => check_file(&to.join(&file.name), file)?,
                _ => return Err("sims_recovery"),
            }
        }
        if let Some((stage, live, g)) = self.tray_cc(tx) {
            match (exists(&stage)?, exists(&live)?) {
                (true, false) => unchanged(&stage, &g.files)?,
                (false, true) => unchanged(&live, &g.files)?,
                _ => return Err("sims_recovery"),
            }
        }
        files::idle()?;
        if let Some((stage, live, g)) = self.tray_cc(tx) {
            if exists(&live)? {
                unchanged(&live, &g.files)?;
                fs::rename(live, stage).map_err(|_| "sims_write")?;
            }
        }
        for (_index, file) in tx.item.files.iter().enumerate().rev() {
            if exists(&to.join(&file.name))? {
                move_file(&to.join(&file.name), &from.join(&file.name), file)?;
            }
            #[cfg(test)]
            super::super::saves::interruption_checkpoint(&format!("trayRollback{}", _index + 1));
        }
        self.write_state(&tx.before)?;
        #[cfg(test)]
        super::super::saves::interruption_checkpoint("trayRollbackState");
        self.write_record("tray.json", &tx.library_before)?;
        fs::remove_file(self.base.join("tray-journal.json")).map_err(|_| "sims_write")?;
        self.clean_tray_stage(tx);
        Ok(())
    }
    fn clean_tray_stage(&self, tx: &Transaction) {
        if preparation::pending(&self.base) != Ok(false) {
            return;
        }
        // Delete only unpublished, exact recorded import bytes. Later files win.
        if !matches!(tx.action, Action::TrayImport { .. }) {
            return;
        }
        let stage = self.tray_stage(tx);
        for (child, expected) in [
            ("tray", Some(tx.item.files.as_slice())),
            ("cc", self.tray_cc(tx).map(|(_, _, g)| g.files.as_slice())),
        ] {
            let path = stage.join(child);
            if let Some(expected) = expected {
                for file in expected {
                    let target = path.join(&file.name);
                    if check_file(&target, file).is_ok() {
                        let _ = fs::remove_file(target);
                    }
                }
            }
            let _ = fs::remove_dir(path);
        }
        let _ = fs::remove_dir(stage);
    }
    pub(super) fn recover_tray(&self) -> Result<State> {
        if exists(&self.base.join("journal.json"))? {
            return Err("sims_recovery");
        }
        let tx: Transaction = read_json(&self.base.join("tray-journal.json"))?;
        validate_transaction(&tx, &self.root)?;
        let (current, _) = snapshot(self.root.to_str().ok_or("sims_path")?)?;
        let library = read_library(&self.root)?;
        if (current != tx.before && current != tx.after)
            || (library != tx.library_before && library != tx.library_after)
        {
            return Err("sims_changed");
        }
        self.rollback_tray(&tx)?;
        Ok(tx.before)
    }
    pub(super) fn apply_tray(&self, plan: Plan, work: &mut progress::Work<'_>) -> Result<State> {
        files::idle()?;
        let (current, pending) = snapshot(self.root.to_str().ok_or("sims_path")?)?;
        if pending {
            return Err("sims_recovery");
        }
        if current != plan.before || files::validate(&current.root)?.game_version != plan.version {
            return Err("sims_changed");
        }
        let selection = plan.tray.as_ref().ok_or("sims_request")?;
        if read_library(&self.root)? != selection.before {
            return Err("sims_changed");
        }
        trouble::unlocked(&current)?;
        check_cc(&plan)?;
        if selection.item.installed {
            no_collisions(&self.root, &selection.item)?;
        }
        let mut library = selection.before.clone();
        library.revision = uuid::Uuid::new_v4().to_string();
        if matches!(plan.action, Action::TrayImport { .. }) {
            library.items.push(selection.item.clone());
        } else {
            *library
                .items
                .iter_mut()
                .find(|i| i.id == selection.item.id)
                .ok_or("sims_missing")? = selection.item.clone();
        }
        let mut after = current.clone();
        if matches!(plan.action, Action::TrayImport { .. }) {
            if let Some(id) = &selection.item.cc_group {
                let mut stamps: Vec<_> = plan
                    .payload
                    .iter()
                    .filter(|f| !format::is_tray(&f.name))
                    .map(|f| files::stamp(f.name.clone(), &f.bytes))
                    .collect();
                stamps.sort_by(|a, b| a.name.cmp(&b.name));
                after.groups.push(Group {
                    source: None,
                    id: id.clone(),
                    title: selection.item.title.clone(),
                    enabled: true,
                    files: stamps,
                    installed_at: files::now(),
                    game_version: plan.version.clone(),
                });
                after.revision = uuid::Uuid::new_v4().to_string();
            }
        }
        let tx = Transaction {
            before: current,
            after: after.clone(),
            library_before: selection.before.clone(),
            library_after: library,
            action: plan.action,
            item: selection.item.clone(),
            stage: uuid::Uuid::new_v4().to_string(),
        };
        validate_transaction(&tx, &self.root)?;
        files::space(
            &self.base,
            plan.payload.iter().map(|f| f.bytes.len() as u64).sum(),
        )?;
        let staged = (|| {
            files::ensure_child(&self.root, "Tray")?;
            files::ensure_child(&self.base, "tray-vault")?;
            if matches!(tx.action, Action::TrayImport { .. }) {
                work.staging(plan.payload.iter().map(|f| f.bytes.len() as u64).sum())?;
                let parent = files::ensure_child(&self.base, "tray-stage")?;
                self.begin_preparation(
                    preparation::Kind::Tray,
                    &tx.stage,
                    &tx.item.title,
                    plan.payload
                        .iter()
                        .map(|file| preparation::Entry {
                            folder: Some(
                                if format::is_tray(&file.name) {
                                    "tray"
                                } else {
                                    "cc"
                                }
                                .into(),
                            ),
                            file: files::stamp(file.name.clone(), &file.bytes),
                        })
                        .collect(),
                )?;
                let stage = files::ensure_child(&parent, &tx.stage)?;
                files::ensure_child(&stage, "tray")?;
                if tx.item.cc_group.is_some() {
                    files::ensure_child(&stage, "cc")?;
                }
                for file in &plan.payload {
                    let path = stage
                        .join(if format::is_tray(&file.name) {
                            "tray"
                        } else {
                            "cc"
                        })
                        .join(&file.name);
                    work.write(&path, &file.bytes)?;
                }
            }
            if matches!(tx.action, Action::TrayRemove { .. }) {
                files::ensure_child(&self.base.join("tray-vault"), &tx.item.id)?;
            }
            let (from, to) = self.tray_ends(&tx)?;
            for file in &tx.item.files {
                work.check()?;
                check_file(&from.join(&file.name), file)?;
                if exists(&to.join(&file.name))? {
                    return Err("sims_tray_exists");
                }
            }
            if let Some((stage, live, g)) = self.tray_cc(&tx) {
                unchanged(&stage, &g.files)?;
                if exists(&live)? {
                    return Err("sims_exists");
                }
            }
            work.publish()?;
            self.write_record("tray-journal.json", &tx)
        })();
        if let Err(error) = staged {
            self.clean_tray_stage(&tx);
            return Err(error);
        }
        let (from, to) = self.tray_ends(&tx)?;
        #[cfg(test)]
        super::super::saves::interruption_checkpoint("trayJournal");
        let result = (|| {
            files::idle()?;
            for (_index, file) in tx.item.files.iter().enumerate() {
                move_file(&from.join(&file.name), &to.join(&file.name), file)?;
                #[cfg(test)]
                super::super::saves::interruption_checkpoint(&format!("trayMove{}", _index + 1));
            }
            if let Some((stage, live, g)) = self.tray_cc(&tx) {
                unchanged(&stage, &g.files)?;
                if exists(&live)? {
                    return Err("sims_exists");
                }
                fs::rename(stage, live).map_err(|_| "sims_write")?;
            }
            #[cfg(test)]
            super::super::saves::interruption_checkpoint("trayCc");
            self.write_state(&tx.after)?;
            #[cfg(test)]
            super::super::saves::interruption_checkpoint("trayModsState");
            self.write_record("tray.json", &tx.library_after)?;
            #[cfg(test)]
            super::super::saves::interruption_checkpoint("trayState");
            fs::remove_file(self.base.join("tray-journal.json")).map_err(|_| "sims_write")?;
            Ok(())
        })();
        if let Err(e) = result {
            return if self.rollback_tray(&tx).is_ok() {
                Err(e)
            } else {
                Err("sims_recovery")
            };
        }
        self.clean_tray_stage(&tx);
        Ok(after)
    }
}
