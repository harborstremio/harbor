//! Records copied staging files before publication has a rename journal.
use super::adopt::exists;
use super::*;

const RECORD: &str = "preparation.json";
const KEPT: &str = "recovered-preparations";

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Mods,
    Tray,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub folder: Option<String>,
    pub file: files::Stamp,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Preparation {
    schema: u8,
    root: String,
    id: String,
    kind: Kind,
    title: String,
    created_at: u64,
    files: Vec<Entry>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeptFiles {
    pub id: String,
    pub title: String,
    pub path: String,
    pub created_at: u64,
}
pub fn pending(base: &Path) -> Result<bool> {
    exists(&base.join(RECORD))
}
fn journals(base: &Path) -> Result<bool> {
    Ok(exists(&base.join("journal.json"))? || exists(&base.join("tray-journal.json"))?)
}
fn validate(value: &Preparation, root: &Path) -> Result<()> {
    uuid(&value.id)?;
    if value.schema != 1
        || Path::new(&value.root) != root
        || value.title.trim().is_empty()
        || value.title.len() > 200
        || value.title.chars().any(char::is_control)
        || value.files.is_empty()
        || value.files.len() > 2000
    {
        return Err("sims_record");
    }
    let mut names = BTreeSet::new();
    let mut bytes = 0u64;
    for entry in &value.files {
        match (&value.kind, entry.folder.as_deref()) {
            (Kind::Mods, None) => {}
            (Kind::Tray, Some("tray" | "cc")) => package::filename(&entry.file.name)?,
            _ => return Err("sims_record"),
        }
        validate_tree(std::slice::from_ref(&entry.file))?;
        if !names.insert((entry.folder.clone(), entry.file.name.to_ascii_lowercase())) {
            return Err("sims_record");
        }
        bytes = bytes.checked_add(entry.file.bytes).ok_or("sims_limit")?;
    }
    if bytes > package::MAX_IMPORT as u64 {
        return Err("sims_limit");
    }
    Ok(())
}
fn stage(base: &Path, value: &Preparation) -> PathBuf {
    base.join(if value.kind == Kind::Mods {
        "stage"
    } else {
        "tray-stage"
    })
    .join(&value.id)
}

// Remove empty staging subdirectories only; never follow or purge unknown files.
fn empty_children(path: &Path, depth: usize, budget: &mut usize) -> Result<()> {
    if depth >= 16 || *budget == 0 {
        return Ok(());
    }
    for entry in fs::read_dir(path).map_err(|_| "sims_read")? {
        if *budget == 0 {
            break;
        }
        *budget -= 1;
        let entry = entry.map_err(|_| "sims_read")?;
        let meta = fs::symlink_metadata(entry.path()).map_err(|_| "sims_read")?;
        if meta.is_dir() && !files::linked(&meta) {
            empty_children(&entry.path(), depth + 1, budget)?;
            let _ = fs::remove_dir(entry.path());
        }
    }
    Ok(())
}

pub fn list(root: &Path) -> Result<Vec<KeptFiles>> {
    let parent = root.join(STORE).join(KEPT);
    if !exists(&parent)? {
        return Ok(vec![]);
    }
    files::directory(&parent)?;
    let mut result = vec![];
    for (index, entry) in fs::read_dir(&parent).map_err(|_| "sims_read")?.enumerate() {
        if index >= 4000 {
            return Err("sims_limit");
        }
        let entry = entry.map_err(|_| "sims_read")?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let Some(id) = name.strip_suffix(".json") else {
            continue;
        };
        if uuid(id).is_err() {
            continue;
        }
        // A changed recovery note must not disable the user's entire mod manager.
        let Ok(value) = read_json::<Preparation>(&entry.path()) else {
            continue;
        };
        let path = parent.join(id);
        if value.id != id || validate(&value, root).is_err() || files::directory(&path).is_err() {
            continue;
        }
        result.push(KeptFiles {
            id: value.id,
            title: value.title,
            path: path.to_string_lossy().into_owned(),
            created_at: value.created_at,
        });
    }
    result.sort_by(|a, b| b.created_at.cmp(&a.created_at).then(a.id.cmp(&b.id)));
    Ok(result)
}

pub fn folder(path: &str, id: &str) -> Result<String> {
    uuid(id)?;
    let root = files::validate(path)?;
    let root = Path::new(&root.path);
    let parent = root.join(STORE).join(KEPT);
    let value: Preparation = read_json(&parent.join(format!("{id}.json")))?;
    validate(&value, root)?;
    if value.id != id {
        return Err("sims_record");
    }
    Ok(files::directory(&parent.join(id))?
        .to_string_lossy()
        .into_owned())
}

impl Store {
    pub(super) fn begin_preparation(
        &self,
        kind: Kind,
        id: &str,
        title: &str,
        entries: Vec<Entry>,
    ) -> Result<()> {
        if pending(&self.base)? || journals(&self.base)? {
            return Err("sims_recovery");
        }
        let value = Preparation {
            schema: 1,
            root: self.root.to_string_lossy().into_owned(),
            id: id.into(),
            kind,
            title: title.into(),
            created_at: files::now(),
            files: entries,
        };
        validate(&value, &self.root)?;
        if exists(&stage(&self.base, &value))?
            || exists(&self.base.join(KEPT).join(id))?
            || exists(&self.base.join(KEPT).join(format!("{id}.json")))?
        {
            return Err("sims_exists");
        }
        self.write_record(RECORD, &value)?;
        #[cfg(test)]
        super::super::saves::interruption_checkpoint("simsPreparation");
        Ok(())
    }
    pub(super) fn finish_preparation(&self) -> Result<()> {
        if !pending(&self.base)? {
            return Ok(());
        }
        // A publication journal owns its stage until commit/rollback completes.
        if journals(&self.base)? {
            return Err("sims_recovery");
        }
        let value: Preparation = read_json(&self.base.join(RECORD))?;
        validate(&value, &self.root)?;
        let source = stage(&self.base, &value);
        let parent = self.base.join(KEPT);
        let kept = parent.join(&value.id);
        if exists(&source)? && exists(&kept)? {
            return Err("sims_recovery");
        }
        if exists(&source)? {
            files::directory(&source)?;
            // Only exact completed copies are expendable. Partial/changed files
            // and unrecognized additions are preserved together without execution.
            for entry in &value.files {
                let mut path = source.clone();
                if let Some(folder) = &entry.folder {
                    path.push(folder);
                }
                path.push(&entry.file.name);
                if super::adopt::check_file(&path, &entry.file).is_ok() {
                    fs::remove_file(path).map_err(|_| "sims_write")?;
                }
            }
            empty_children(&source, 0, &mut 4000)?;
            match fs::remove_dir(&source) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::DirectoryNotEmpty => {
                    files::ensure_child(&self.base, KEPT)?;
                    fs::rename(&source, &kept).map_err(|_| "sims_write")?;
                    #[cfg(test)]
                    super::super::saves::interruption_checkpoint("simsPreparationKept");
                }
                Err(_) => return Err("sims_write"),
            }
        }
        if exists(&kept)? {
            files::directory(&kept)?;
            let name = format!("{}.json", value.id);
            if exists(&parent.join(&name))? {
                if read_json::<Preparation>(&parent.join(&name))? != value {
                    return Err("sims_changed");
                }
            } else {
                let bytes = serde_json::to_vec(&value).map_err(|_| "sims_record")?;
                files::atomic(&parent, &name, &bytes)?;
            }
        }
        #[cfg(test)]
        super::super::saves::interruption_checkpoint("simsPreparationClean");
        fs::remove_file(self.base.join(RECORD)).map_err(|_| "sims_write")?;
        Ok(())
    }
    pub(super) fn finish_unpublished_preparation(&self) -> Result<()> {
        if !journals(&self.base)? {
            self.finish_preparation()?;
        }
        Ok(())
    }
}
