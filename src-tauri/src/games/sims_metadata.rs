use super::super::{sims_manifest as manifest, sims_reviews};
use super::{area_path, files, location, package, progress, snapshot, uuid, Result, STORE};
use serde::{Deserialize, Serialize};
use std::{
    io::{Cursor, Read},
    path::Path,
    time::{Duration, Instant},
};

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum Target {
    Group { id: String },
    File { file: String },
}
#[derive(Debug, Serialize)]
pub struct Information {
    pub file: String,
    pub manifests: Vec<manifest::Manifest>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub files: Vec<Information>,
    pub checked_files: usize,
    pub partial: bool,
}
const MAX_MANIFESTS: usize = 32;
impl Report {
    fn append(
        &mut self,
        file: String,
        mut manifests: Vec<manifest::Manifest>,
        partial: bool,
    ) -> bool {
        let count = self
            .files
            .iter()
            .map(|entry| entry.manifests.len())
            .sum::<usize>();
        let remaining = MAX_MANIFESTS.saturating_sub(count);
        self.partial |= partial || manifests.len() > remaining;
        manifests.truncate(remaining);
        let full = count + manifests.len() >= MAX_MANIFESTS;
        if !manifests.is_empty() {
            self.files.push(Information { file, manifests });
        }
        full
    }
}

pub(crate) fn extract(
    name: &str,
    bytes: &[u8],
    check: &dyn Fn() -> Result<()>,
) -> Result<(Vec<manifest::Manifest>, bool)> {
    if package::kind(name) == "script" {
        package::validate_script_checked(bytes, check)?;
    }
    extract_validated(name, bytes, check)
}

fn extract_validated(
    name: &str,
    bytes: &[u8],
    check: &dyn Fn() -> Result<()>,
) -> Result<(Vec<manifest::Manifest>, bool)> {
    let mut found = Vec::new();
    let mut partial = false;
    if package::kind(name) == "script" {
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|_| "sims_script")?;
        for index in 0..archive.len() {
            check()?;
            let mut member = archive.by_index(index).map_err(|_| "sims_script")?;
            if !member
                .name()
                .rsplit('/')
                .next()
                .is_some_and(|s| s.eq_ignore_ascii_case("llamalogic.modfilemanifest.yml"))
            {
                continue;
            }
            if member.size() > manifest::MAX_TEXT as u64 || found.len() >= 16 {
                partial = true;
                continue;
            }
            let mut data = Vec::new();
            package::copy_checked(
                &mut member.by_ref().take(manifest::MAX_TEXT as u64 + 1),
                &mut data,
                "sims_manifest",
                check,
            )?;
            match std::str::from_utf8(&data)
                .map_err(|_| "sims_manifest")
                .and_then(|text| manifest::from_yaml(text, check))
            {
                Ok(value) => found.push(value),
                Err("sims_canceled") => return Err("sims_canceled"),
                Err(_) => partial = true,
            }
        }
    } else {
        let (snippets, limited) = package::snippets_checked(bytes, check)?;
        partial |= limited;
        for data in snippets {
            check()?;
            if found.len() >= 16 {
                partial = true;
                break;
            }
            match std::str::from_utf8(&data)
                .map_err(|_| "sims_manifest")
                .and_then(|text| manifest::from_xml(text, check))
            {
                Ok(Some(value)) => found.push(value),
                Ok(None) => {}
                Err("sims_canceled") => return Err("sims_canceled"),
                Err(_) => partial = true,
            }
        }
    }
    Ok((found, partial))
}

// Plan payloads have already passed import validation. Reuse those exact bytes;
// optional manifest errors must not reject an otherwise supported import.
pub(crate) fn incoming_validated(
    payload: &[package::Payload],
    check: &dyn Fn() -> Result<()>,
) -> Result<Option<Report>> {
    let mut candidates = payload
        .iter()
        .filter(|file| matches!(package::kind(&file.name), "package" | "script"))
        .peekable();
    if candidates.peek().is_none() {
        return Ok(None);
    }
    let start = Instant::now();
    let bounded = || {
        check()?;
        if start.elapsed() > Duration::from_secs(30) {
            Err("sims_metadata_limit")
        } else {
            Ok(())
        }
    };
    let mut report = Report {
        files: vec![],
        checked_files: 0,
        partial: false,
    };
    while let Some(file) = candidates.next() {
        check()?;
        if start.elapsed() > Duration::from_secs(30) {
            report.partial = true;
            break;
        }
        match extract_validated(&file.name, &file.bytes, &bounded) {
            Ok((manifests, partial)) => {
                report.checked_files += 1;
                if report.append(file.name.clone(), manifests, partial)
                    && candidates.peek().is_some()
                {
                    report.partial = true;
                    break;
                }
            }
            Err("sims_canceled") => return Err("sims_canceled"),
            Err("sims_metadata_limit") => {
                report.partial = true;
                break;
            }
            Err(_) => report.partial = true,
        }
    }
    check()?;
    Ok(Some(report))
}
pub fn inspect(
    profile: &str,
    path: &str,
    target: Target,
    operation: &str,
    emit: impl Fn(progress::Progress),
) -> Result<Report> {
    let mut work = progress::Work::start(profile, operation, &emit)?;
    let _parser = sims_reviews::parse_guard()?;
    let start = Instant::now();
    let cancel = work.cancellation_check();
    let check = || {
        cancel()?;
        if start.elapsed() > Duration::from_secs(30) {
            Err("sims_limit")
        } else {
            Ok(())
        }
    };
    let folder = files::validate(path)?;
    let (state, recovery) = snapshot(&folder.path)?;
    if recovery {
        return Err("sims_recovery");
    }
    let root = Path::new(&folder.path);
    let (directory, names) = match target {
        Target::Group { id } => {
            uuid(&id)?;
            let group = state
                .groups
                .iter()
                .find(|g| g.id == id)
                .ok_or("sims_missing")?;
            (
                area_path(root, &root.join(STORE), &location(group))?,
                group
                    .files
                    .iter()
                    .filter(|f| matches!(package::kind(&f.name), "package" | "script"))
                    .map(|f| f.name.clone())
                    .collect::<Vec<_>>(),
            )
        }
        Target::File { file } => {
            files::relative_name(&file)?;
            if !matches!(package::kind(&file), "package" | "script") {
                return Err("sims_path");
            }
            (root.join("Mods"), vec![file])
        }
    };
    let mut report = Report {
        files: Vec::new(),
        checked_files: 0,
        partial: false,
    };
    let mut budget = package::MAX_IMPORT;
    let file_count = names.len();
    for (index, name) in names.into_iter().enumerate() {
        check()?;
        files::relative_name(&name)?;
        let path = directory.join(&name);
        let Ok(size) = files::regular(&path).map(|m| m.len()) else {
            report.partial = true;
            continue;
        };
        if size > budget as u64 || size > package::MAX_FILE as u64 {
            report.partial = true;
            continue;
        }
        budget -= size as usize;
        work.review_file(name.rsplit('/').next().ok_or("sims_path")?)?;
        let contents = files::read_checked(&path, package::MAX_FILE, &check);
        match contents.and_then(|bytes| extract(&name, &bytes, &check)) {
            Ok((manifests, limited)) => {
                report.checked_files += 1;
                if report.append(name, manifests, limited) && index + 1 < file_count {
                    report.partial = true;
                    break;
                }
            }
            Err(error @ ("sims_canceled" | "sims_limit")) => return Err(error),
            Err(_) => report.partial = true,
        }
    }
    check()?;
    let (after, recovery) = snapshot(&folder.path)?;
    if recovery || after.revision != state.revision {
        return Err("sims_changed");
    }
    work.done();
    Ok(report)
}
#[cfg(test)]
#[path = "sims_metadata_tests.rs"]
mod tests;
