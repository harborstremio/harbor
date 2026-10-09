//! On-demand comparison of declared requirements with validated enabled files.
use super::{
    sims_files as files, sims_fingerprints, sims_launch_settings, sims_manifest as manifest,
    sims_package as package, sims_packs, sims_reviews, sims_store as store,
};
use package::Result;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
    time::{Duration, Instant},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Found,
    Missing,
    Unchecked,
    NotRequired,
    Alternative,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Requirement {
    pub file: String,
    pub mod_name: String,
    pub name: String,
    pub version: Option<String>,
    pub url: Option<String>,
    pub status: Status,
    pub matched_files: Vec<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub requirements: Vec<Requirement>,
    pub checked_files: usize,
    pub manifest_files: usize,
    pub partial: bool,
    pub checked_at: u64,
    pub packs: Option<sims_packs::Report>,
    pub pack_error: Option<&'static str>,
}
#[derive(Deserialize)]
pub struct PackSelection {
    pub path: String,
    #[serde(default)]
    pub custom: Vec<sims_launch_settings::CustomLaunch>,
}
struct Present {
    file: String,
    features: BTreeSet<String>,
}
type Catalog = BTreeMap<String, Vec<std::sync::Arc<Present>>>;

fn evaluate(
    requirement: &manifest::Requirement,
    present: &Catalog,
    partial: bool,
    packs: Option<&sims_packs::Report>,
) -> (Status, Vec<String>) {
    let Some(rule) = &requirement.check else {
        return (Status::Unchecked, vec![]);
    };
    let available = rule
        .pack_available
        .as_deref()
        .map(|code| packs.and_then(|report| report.availability(code)));
    let unavailable = rule
        .pack_unavailable
        .as_deref()
        .map(|code| packs.and_then(|report| report.availability(code)));
    if available == Some(Some(true))
        || unavailable == Some(Some(false))
        || rule
            .if_available
            .as_ref()
            .is_some_and(|hash| present.contains_key(hash))
        || !partial
            && rule
                .if_unavailable
                .as_ref()
                .is_some_and(|hash| !present.contains_key(hash))
    {
        return (Status::NotRequired, vec![]);
    }
    let matches: Vec<_> = rule
        .hashes
        .iter()
        .flat_map(|hash| present.get(hash).into_iter().flatten())
        .collect();
    let found = !rule.hashes.is_empty()
        && rule.hashes.iter().all(|hash| present.contains_key(hash))
        && requirement
            .features
            .iter()
            .all(|feature| matches.iter().any(|entry| entry.features.contains(feature)));
    let files = matches
        .iter()
        .map(|entry| entry.file.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .take(8)
        .collect();
    if found {
        (Status::Found, files)
    } else if partial
        || rule.hashes.is_empty()
        || available == Some(None)
        || unavailable == Some(None)
        || rule
            .if_unavailable
            .as_ref()
            .is_some_and(|hash| !present.contains_key(hash))
    {
        (Status::Unchecked, files)
    } else {
        (Status::Missing, files)
    }
}

fn resolve(
    file: &str,
    manifest: &manifest::Manifest,
    catalog: &Catalog,
    partial: bool,
    packs: Option<&sims_packs::Report>,
) -> Vec<Requirement> {
    let mut results: Vec<_> = manifest
        .requirements
        .iter()
        .map(|requirement| {
            let (status, matched_files) = evaluate(
                requirement,
                catalog,
                partial || manifest.requirements.iter().any(|r| r.check.is_none()),
                packs,
            );
            Requirement {
                file: file.to_owned(),
                mod_name: manifest.name.clone(),
                name: requirement.name.clone(),
                version: requirement.version.clone(),
                url: requirement.url.clone(),
                status,
                matched_files,
            }
        })
        .collect();
    let mut alternatives: BTreeMap<&str, Vec<usize>> = BTreeMap::new();
    for (index, requirement) in manifest.requirements.iter().enumerate() {
        if let Some(name) = requirement
            .check
            .as_ref()
            .and_then(|rule| rule.alternative.as_deref())
        {
            alternatives.entry(name).or_default().push(index);
        }
    }
    for indexes in alternatives.values() {
        if let Some(found) = indexes
            .iter()
            .find(|i| results[**i].status == Status::Found)
        {
            let matched = results[*found].matched_files.clone();
            for index in indexes {
                if results[*index].status != Status::Found {
                    results[*index].status = Status::Alternative;
                    results[*index].matched_files = matched.clone();
                }
            }
        } else if indexes
            .iter()
            .any(|i| matches!(results[*i].status, Status::Unchecked | Status::NotRequired))
        {
            for index in indexes {
                if results[*index].status == Status::Missing {
                    results[*index].status = Status::Unchecked;
                }
            }
        }
    }
    results
}

pub fn scan(
    profile: &str,
    path: &str,
    operation: &str,
    selection: Option<&PackSelection>,
    emit: impl Fn(store::progress::Progress),
) -> Result<Report> {
    let mut work = store::progress::Work::start(profile, operation, &emit)?;
    let _parser = sims_reviews::parse_guard()?;
    let report = scan_checked(
        path,
        &mut work,
        2 * 1024 * 1024 * 1024,
        Duration::from_secs(60),
        selection,
    )?;
    work.done();
    Ok(report)
}
fn scan_checked(
    path: &str,
    work: &mut store::progress::Work<'_>,
    mut budget: u64,
    duration: Duration,
    selection: Option<&PackSelection>,
) -> Result<Report> {
    let start = Instant::now();
    let cancel = work.cancellation_check();
    let check = || {
        cancel()?;
        if start.elapsed() >= duration {
            Err("sims_limit")
        } else {
            Ok(())
        }
    };
    let folder = files::inventory_checked(path, &check)?;
    let (state, recovery) = store::snapshot(&folder.path)?;
    if recovery || folder.save_recovery {
        return Err("sims_recovery");
    }
    let root = Path::new(&folder.path).join("Mods");
    let mut report = Report {
        requirements: vec![],
        checked_files: 0,
        manifest_files: 0,
        partial: folder.partial,
        checked_at: files::now(),
        packs: None,
        pack_error: None,
    };
    let mut manifests = Vec::new();
    let mut catalog: Catalog = BTreeMap::new();
    let mut stamps = Vec::new();
    let mut catalog_entries = 0;
    for entry in &folder.files {
        check()?;
        if !matches!(entry.kind, "package" | "script") {
            continue;
        }
        if entry.bytes > budget || entry.bytes > package::MAX_FILE as u64 || manifests.len() >= 512
        {
            report.partial = true;
            continue;
        }
        budget -= entry.bytes;
        files::relative_name(&entry.path)?;
        let file = root.join(&entry.path);
        let before = match files::regular(&file) {
            Ok(v) => v,
            Err(_) => {
                report.partial = true;
                continue;
            }
        };
        if before.len() != entry.bytes {
            return Err("sims_changed");
        }
        work.review_file(entry.path.rsplit('/').next().ok_or("sims_path")?)?;
        let bytes = match files::read_checked(&file, package::MAX_FILE, &check) {
            Ok(v) => v,
            Err(error @ ("sims_canceled" | "sims_limit" | "sims_changed")) => return Err(error),
            Err(_) => {
                report.partial = true;
                continue;
            }
        };
        stamps.push((file, before.len(), before.modified().ok()));
        let (values, partial) = match store::metadata::extract(&entry.path, &bytes, &check) {
            Ok(v) => v,
            Err(error @ ("sims_canceled" | "sims_limit")) => return Err(error),
            Err(_) => {
                report.partial = true;
                continue;
            }
        };
        report.checked_files += 1;
        report.partial |= partial;
        if !values.is_empty() {
            report.manifest_files += 1;
        }
        for value in values {
            if manifests.len() >= 512 {
                report.partial = true;
                break;
            }
            if let Some(identity) = &value.identity {
                match sims_fingerprints::calculate(&entry.path, &bytes, identity, &check) {
                    Ok(digest) if digest == identity.hash => {
                        // Files below the game's script depth cannot provide an enabled dependency.
                        if !entry.script_too_deep {
                            let present = std::sync::Arc::new(Present {
                                file: entry.path.clone(),
                                features: identity.features.clone(),
                            });
                            for hash in std::iter::once(&digest).chain(identity.subsumed.iter()) {
                                check()?;
                                if catalog_entries >= 8192 {
                                    report.partial = true;
                                    break;
                                }
                                catalog
                                    .entry(hash.clone())
                                    .or_default()
                                    .push(present.clone());
                                catalog_entries += 1;
                            }
                        }
                    }
                    Err(error @ ("sims_canceled" | "sims_limit")) => return Err(error),
                    _ => report.partial = true,
                }
            } else {
                report.partial = true;
            }
            manifests.push((entry.path.clone(), value));
        }
    }
    if let Some(selection) = selection {
        check()?;
        match sims_packs::inspect(
            &selection.path,
            &selection.custom,
            &sims_launch_settings::Environment::current(),
            work,
        ) {
            Ok(packs) => report.packs = Some(packs),
            Err(error @ ("sims_canceled" | "sims_limit")) => return Err(error),
            Err(error) => report.pack_error = Some(error),
        }
    }
    // An external edit/addition during the scan must not become a missing-dependency verdict.
    for (file, size, modified) in stamps {
        check()?;
        let after = files::regular(&file).map_err(|_| "sims_changed")?;
        if after.len() != size || after.modified().ok() != modified {
            return Err("sims_changed");
        }
    }
    let after_folder = files::inventory_checked(path, &check)?;
    let entries = |f: &files::Folder| {
        f.files
            .iter()
            .map(|entry| (entry.path.clone(), entry.bytes))
            .collect::<BTreeSet<_>>()
    };
    if entries(&folder) != entries(&after_folder)
        || folder.game_version != after_folder.game_version
    {
        return Err("sims_changed");
    }
    report.partial |= after_folder.partial;
    let (after, recovery) = store::snapshot(&folder.path)?;
    if recovery || after.revision != state.revision {
        return Err("sims_changed");
    }
    report.partial |= manifests
        .iter()
        .map(|(_, m)| m.requirements.len())
        .sum::<usize>()
        > 512;
    for (file, manifest) in manifests {
        check()?;
        let remaining = 512 - report.requirements.len();
        if remaining == 0 {
            break;
        }
        report.requirements.extend(
            resolve(
                &file,
                &manifest,
                &catalog,
                report.partial,
                report.packs.as_ref(),
            )
            .into_iter()
            .take(remaining),
        );
    }
    report.requirements.sort_by_key(|entry| match entry.status {
        Status::Missing => 0,
        Status::Unchecked => 1,
        Status::Found => 2,
        Status::Alternative => 3,
        Status::NotRequired => 4,
    });
    report.checked_at = files::now();
    check()?;
    Ok(report)
}

#[cfg(test)]
#[path = "sims_dependencies_tests.rs"]
mod tests;
