//! Import existing bytes, never the provider's newer files. Published bundle
//! membership accounts for companion folders without an X-WoWI-ID of their own.
use super::*;

impl Store {
    pub fn adopt(
        &self,
        layout: package::Layout,
        version: &str,
        cancel: &CancellationToken,
    ) -> Result<Plan> {
        package::check_cancel(cancel)?;
        let before = self.load()?;
        self.check_owned_with(&before, cancel)?;
        if layout.release.id == 0
            || before
                .packages
                .iter()
                .any(|group| group.id == layout.release.id)
        {
            return Err("wow_addons_identity");
        }
        let root = self.area(&Area::Live, false)?;
        let target = package::interface(version)?;
        let published: BTreeSet<_> = layout
            .folders
            .iter()
            .map(|folder| folder.to_ascii_lowercase())
            .collect();
        let mut found = Vec::new();
        let mut budget = 8 * 1024 * 1024;
        for (index, entry) in fs::read_dir(&root)
            .map_err(|_| "wow_addons_read")?
            .enumerate()
        {
            package::check_cancel(cancel)?;
            if index >= 2000 {
                return Err("wow_addons_limit");
            }
            let entry = entry.map_err(|_| "wow_addons_read")?;
            let name = entry
                .file_name()
                .into_string()
                .map_err(|_| "wow_addons_record")?;
            if name.to_ascii_lowercase().starts_with("blizzard_") {
                continue;
            }
            let listed = published.contains(&name.to_ascii_lowercase());
            let meta = fs::symlink_metadata(entry.path()).map_err(|_| "wow_addons_read")?;
            if save_files::reparse(&meta) {
                if listed {
                    return Err("wow_addons_linked");
                }
                continue;
            }
            if !meta.is_dir() {
                continue;
            }
            let toc = self.external_manifest(&root, &name, target, &mut budget)?;
            let Some(toc) = toc else {
                if listed {
                    return Err("wow_addons_manifest");
                }
                continue;
            };
            if listed && toc.wowi_id.is_some_and(|id| id != layout.release.id) {
                return Err("wow_addons_identity");
            }
            if toc.wowi_id != Some(layout.release.id) && !listed {
                continue;
            }
            if !toc.interfaces.contains(&target) {
                return Err("wow_addons_incompatible");
            }
            if found.len() >= 64 {
                return Err("wow_addons_limit");
            }
            found.push((name, toc));
        }
        found.sort_by(|a, b| a.0.cmp(&b.0));
        // A folder name alone cannot establish the installed package's identity.
        let anchor = found
            .iter()
            .filter(|(_, toc)| toc.wowi_id == Some(layout.release.id))
            .min_by_key(|(_, toc)| toc.dependencies.len())
            .ok_or("wow_addons_identity")?;
        if anchor.1.version.is_empty() {
            return Err("wow_addons_manifest");
        }
        let folders: Vec<_> = found.iter().map(|(name, _)| name.clone()).collect();
        let names: BTreeSet<_> = folders
            .iter()
            .map(|name| name.to_ascii_lowercase())
            .collect();
        let dependencies = found
            .iter()
            .flat_map(|(_, toc)| toc.dependencies.iter())
            .filter(|name| {
                !name.to_ascii_lowercase().starts_with("blizzard_")
                    && !names.contains(&name.to_ascii_lowercase())
            })
            .cloned()
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect();
        let next = Group {
            id: layout.release.id,
            title: layout.release.title,
            version: anchor.1.version.clone(),
            files: tree(&root, &folders, cancel)?,
            folders,
            dependencies,
        };
        // The manifest used to identify the package must be the one whose bytes
        // were just stamped, even if another manager edits files during the scan.
        for (name, expected) in &found {
            package::check_cancel(cancel)?;
            let observed = self.external_manifest(&root, name, target, &mut budget)?;
            if serde_json::to_vec(&observed).map_err(|_| "wow_addons_record")?
                != serde_json::to_vec(&Some(expected)).map_err(|_| "wow_addons_record")?
            {
                return Err("wow_addons_changed");
            }
        }
        validate_group(&next)?;
        self.collisions(&before, Some(&next), Some(&next))?;
        Ok(Plan {
            token: uuid::Uuid::new_v4().to_string(),
            before,
            previous: None,
            next: Some(next),
            source: Some(Area::Live),
            restored: None,
        })
    }
}
