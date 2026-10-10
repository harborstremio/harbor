//! Read-only content comparison. A match is not a compatibility verdict.
use super::{sims_files as files, sims_package::Result, sims_reviews, sims_store as store};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::File,
    io::Read,
    path::Path,
    time::{Duration, Instant},
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Copy {
    pub path: String,
    pub group_id: Option<String>,
    pub group_title: Option<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Match {
    pub bytes: u64,
    pub copies: Vec<Copy>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub matches: Vec<Match>,
    pub checked_files: usize,
    pub skipped_files: usize,
    pub partial: bool,
    pub checked_at: u64,
}

fn hash(path: &Path, size: u64, check: &dyn Fn() -> Result<()>) -> Result<String> {
    check()?;
    let before = files::regular(path)?;
    if before.len() != size {
        return Err("sims_changed");
    }
    let mut file = File::open(path).map_err(|_| "sims_read")?;
    let mut buffer = vec![0u8; 256 * 1024];
    let mut digest = Sha256::new();
    let mut read = 0u64;
    loop {
        check()?;
        let count = file.read(&mut buffer).map_err(|_| "sims_read")?;
        if count == 0 {
            break;
        }
        read += count as u64;
        if read > size {
            return Err("sims_changed");
        }
        digest.update(&buffer[..count]);
    }
    let after = files::regular(path)?;
    if read != size || after.len() != size || before.modified().ok() != after.modified().ok() {
        return Err("sims_changed");
    }
    check()?;
    Ok(format!("{:x}", digest.finalize()))
}

pub fn scan(
    profile: &str,
    path: &str,
    operation: &str,
    emit: impl Fn(store::progress::Progress),
) -> Result<Report> {
    let mut work = store::progress::Work::start(profile, operation, &emit)?;
    let _parser = sims_reviews::parse_guard()?;
    let result = scan_checked(
        path,
        &mut work,
        8 * 1024 * 1024 * 1024,
        Duration::from_secs(60),
    )?;
    work.done();
    Ok(result)
}

fn scan_checked(
    path: &str,
    work: &mut store::progress::Work<'_>,
    mut budget: u64,
    duration: Duration,
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
    let mut report = Report {
        matches: vec![],
        checked_files: 0,
        skipped_files: 0,
        partial: folder.partial,
        checked_at: files::now(),
    };
    let mut sizes: BTreeMap<(&str, u64), Vec<&files::Entry>> = BTreeMap::new();
    for entry in &folder.files {
        if !matches!(entry.kind, "package" | "script") {
            continue;
        }
        sizes
            .entry((entry.kind, entry.bytes))
            .or_default()
            .push(entry);
    }
    let mods = Path::new(&folder.path).join("Mods");
    let owned: BTreeMap<_, _> = state
        .groups
        .iter()
        .filter(|group| group.enabled)
        .flat_map(|group| {
            group
                .files
                .iter()
                .map(move |file| (format!("Harbor-{}/{}", group.id, file.name), (group, file)))
        })
        .collect();
    for ((_, size), entries) in sizes {
        check()?;
        // Different lengths cannot be byte-identical; avoid unnecessary disk reads.
        if entries.len() == 1 {
            report.checked_files += 1;
            continue;
        }
        let mut hashes: BTreeMap<String, Vec<Copy>> = BTreeMap::new();
        for entry in entries {
            check()?;
            if size == 0 || size > budget {
                report.skipped_files += 1;
                continue;
            }
            budget -= size;
            if files::relative_name(&entry.path).is_err() {
                report.skipped_files += 1;
                continue;
            }
            work.review_file(entry.path.rsplit('/').next().ok_or("sims_path")?)?;
            match hash(&mods.join(&entry.path), size, &check) {
                Ok(digest) => {
                    report.checked_files += 1;
                    let group = owned
                        .get(&entry.path)
                        .filter(|(_, file)| file.hash == digest && file.bytes == size)
                        .map(|(group, _)| *group);
                    hashes.entry(digest).or_default().push(Copy {
                        path: entry.path.clone(),
                        group_id: group.map(|g| g.id.clone()),
                        group_title: group.map(|g| g.title.clone()),
                    });
                }
                Err(error @ ("sims_canceled" | "sims_limit")) => return Err(error),
                Err(_) => report.skipped_files += 1,
            }
        }
        report
            .matches
            .extend(
                hashes
                    .into_values()
                    .filter(|copies| copies.len() > 1)
                    .map(|copies| Match {
                        bytes: size,
                        copies,
                    }),
            );
    }
    check()?;
    let (after, recovery) = store::snapshot(&folder.path)?;
    if recovery || after.revision != state.revision {
        return Err("sims_changed");
    }
    report.partial |= report.skipped_files > 0;
    report
        .matches
        .sort_by(|a, b| a.copies[0].path.cmp(&b.copies[0].path));
    report.checked_at = files::now();
    Ok(report)
}

#[cfg(test)]
#[path = "sims_duplicates_tests.rs"]
mod tests;
