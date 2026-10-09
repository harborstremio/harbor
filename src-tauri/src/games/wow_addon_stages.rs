//! Remove only a reviewed staging tree, never live addons or retained backups.
//! Store's exclusive handle is held for the whole lifetime of an open review.
use super::*;

const RECEIPT: &str = ".harbor-stage.json";
pub(super) const PARTIAL: &str = ".harbor-partial";

#[derive(Serialize, Deserialize)]
struct Receipt {
    schema: u8,
    id: String,
    token: String,
    group: Group,
}

impl Store {
    pub(super) fn mark_stage(&self, root: &Path, token: &str, group: &Group) -> Result<()> {
        uuid(token)?;
        validate_group(group)?;
        if directory(root)? != self.area(&Area::Stage(token.into()), false)? {
            return Err("wow_addons_record");
        }
        let receipt = Receipt {
            schema: 1,
            id: self.id.clone(),
            token: token.into(),
            group: group.clone(),
        };
        let bytes = serde_json::to_vec(&receipt).map_err(|_| "wow_addons_record")?;
        if bytes.len() > RECORD_LIMIT {
            return Err("wow_addons_limit");
        }
        // No payload is written until this new ownership receipt is durable.
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(root.join(RECEIPT))
            .map_err(|_| "wow_addons_write")?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| "wow_addons_write")
    }

    pub fn discard(&self, plan: &Plan) -> Result<()> {
        // An interrupted transaction still owns its stage until guarded recovery.
        if exists(&self.records.join("journal.json"))? {
            return Err("wow_addons_recovery");
        }
        if let Some(Area::Stage(token)) = &plan.source {
            if token != &plan.token {
                return Err("wow_addons_record");
            }
            self.clear_stage(token)?;
        }
        Ok(())
    }

    /// Call only while owning this Store, after guarded journal recovery. No
    /// concurrent review can own a stage while its store handle is held here.
    pub fn cleanup_stages(&self) -> Result<usize> {
        if exists(&self.records.join("journal.json"))? {
            return Err("wow_addons_recovery");
        }
        let parent = self.records.join("stage");
        if !exists(&parent)? {
            return Ok(0);
        }
        let parent = directory(&parent)?;
        let mut tokens = Vec::new();
        for (index, entry) in fs::read_dir(&parent)
            .map_err(|_| "wow_addons_read")?
            .enumerate()
        {
            if index >= 64 {
                return Err("wow_addons_limit");
            }
            let entry = entry.map_err(|_| "wow_addons_read")?;
            let token = entry
                .file_name()
                .into_string()
                .map_err(|_| "wow_addons_record")?;
            uuid(&token)?;
            directory(&entry.path())?;
            tokens.push(token);
        }
        for token in &tokens {
            self.clear_stage(token)?;
        }
        Ok(tokens.len())
    }

    fn clear_stage(&self, token: &str) -> Result<()> {
        uuid(token)?;
        let path = self.records.join("stage").join(token);
        if !exists(&path)? {
            return Ok(());
        }
        let root = self.area(&Area::Stage(token.into()), false)?;
        if fs::read_dir(&root)
            .map_err(|_| "wow_addons_read")?
            .next()
            .is_none()
        {
            return fs::remove_dir(root).map_err(|_| "wow_addons_write");
        }
        let receipt: Receipt = read_json(&root.join(RECEIPT))?;
        if receipt.schema != 1 || receipt.id != self.id || receipt.token != token {
            return Err("wow_addons_record");
        }
        validate_group(&receipt.group)?;
        let expected: BTreeMap<_, _> = receipt
            .group
            .files
            .iter()
            .map(|f| (f.path.as_str(), f))
            .collect();
        let mut allowed_dirs = BTreeSet::new();
        for file in &receipt.group.files {
            let mut path = file.path.as_str();
            while let Some((parent, _)) = path.rsplit_once('/') {
                allowed_dirs.insert(parent.to_owned());
                path = parent;
            }
        }
        let mut pending = vec![String::new()];
        let mut directories = Vec::new();
        let mut files = Vec::new();
        let mut count = 0;
        while let Some(relative) = pending.pop() {
            let folder = directory(&root.join(&relative))?;
            for entry in fs::read_dir(&folder).map_err(|_| "wow_addons_read")? {
                count += 1;
                if count > 16002 {
                    return Err("wow_addons_limit");
                }
                let entry = entry.map_err(|_| "wow_addons_read")?;
                let name = entry
                    .file_name()
                    .into_string()
                    .map_err(|_| "wow_addons_record")?;
                let path = if relative.is_empty() {
                    name.clone()
                } else {
                    format!("{relative}/{name}")
                };
                let meta = fs::symlink_metadata(entry.path()).map_err(|_| "wow_addons_read")?;
                if save_files::reparse(&meta) {
                    return Err("wow_addons_linked");
                }
                if relative.is_empty() && name == RECEIPT {
                    if !meta.is_file() || meta.len() > RECORD_LIMIT as u64 {
                        return Err("wow_addons_record");
                    }
                    continue;
                }
                if relative.is_empty() && name == PARTIAL {
                    if !meta.is_file() || meta.len() > 16 * 1024 * 1024 {
                        return Err("wow_addons_record");
                    }
                    files.push((entry.path(), None));
                } else if meta.is_dir() && allowed_dirs.contains(&path) {
                    pending.push(path);
                    directories.push(entry.path());
                } else if meta.is_file() {
                    let stamp = expected.get(path.as_str()).ok_or("wow_addons_changed")?;
                    let bytes = read(&entry.path(), 16 * 1024 * 1024)?;
                    if bytes.len() as u64 != stamp.bytes || package::digest(&bytes) != stamp.sha256
                    {
                        return Err("wow_addons_changed");
                    }
                    files.push((entry.path(), Some((*stamp).clone())));
                } else {
                    return Err("wow_addons_changed");
                }
            }
        }
        // Validate everything before removing anything. In particular, preserve
        // unexpected or externally edited content for the user to inspect.
        for (path, expected) in files {
            let bytes = read(&path, 16 * 1024 * 1024)?;
            if expected.is_some_and(|stamp| {
                bytes.len() as u64 != stamp.bytes || package::digest(&bytes) != stamp.sha256
            }) {
                return Err("wow_addons_changed");
            }
            fs::remove_file(path).map_err(|_| "wow_addons_write")?;
        }
        directories.sort_by_key(|path| std::cmp::Reverse(path.components().count()));
        for path in directories {
            directory(&path)?;
            fs::remove_dir(path).map_err(|_| "wow_addons_write")?;
        }
        fs::remove_file(root.join(RECEIPT)).map_err(|_| "wow_addons_write")?;
        fs::remove_dir(root).map_err(|_| "wow_addons_write")
    }
}
