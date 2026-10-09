//! Read-only source cleanup eligibility. A review is never permission to delete:
//! an eventual apply operation must acquire ownership again and revalidate bytes.
use super::{
    archive_jobs::{ArchiveJob, Archives, Status},
    archives::{self, ArchivePart, ArchiveProgress},
    save_files,
};
use serde::{Serialize,Deserialize};
use std::{
    collections::HashSet,
    fs,
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

type Result<T> = std::result::Result<T, &'static str>;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Blocker {
    AnotherProfile,
    ActiveDownload,
    Sharing,
    PendingPreparation,
    OtherExtraction,
}

pub(crate) struct Usage {
    pub path: String,
    pub tree: bool,
    pub family: bool,
    pub reason: Blocker,
}

#[derive(Clone,Debug,Serialize,Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupFile {
    pub identity:String,
    pub path: String,
    pub name: String,
    pub bytes: u64,
    pub sha256: String,
}

#[derive(Clone,Debug,Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub token:Option<String>,
    pub job_id: String,
    pub revision: u64,
    pub checked_at: u64,
    pub destination: String,
    pub files: Vec<CleanupFile>,
    pub bytes: u64,
    pub files_verified: bool,
    pub blockers: Vec<Blocker>,
}

// Native download paths are already absolute. Preserve component boundaries,
// including the root of a drive, when comparing Windows extended paths.
fn key(value: &str) -> String {
    let value = value.replace('\\', "/");
    let value = if cfg!(windows) {
        value
            .strip_prefix("//?/UNC/")
            .map(|v| format!("//{v}"))
            .unwrap_or_else(|| value.strip_prefix("//?/").unwrap_or(&value).to_owned())
            .to_lowercase()
    } else {
        value
    };
    value.trim_end_matches('/').to_owned()
}
fn within(path: &str, parent: &str) -> bool {
    path == parent
        || path
            .strip_prefix(parent)
            .is_some_and(|rest| rest.starts_with('/'))
}
pub(super) fn matches(usage: &Usage, path: &Path) -> bool {
    let target = key(&path.to_string_lossy());
    let source = key(&usage.path);
    if source == target || usage.tree && within(&target, &source) {
        return true;
    }
    if !usage.family {
        return false;
    }
    let Some((a_parent, a_name)) = source.rsplit_once('/') else {
        return false;
    };
    let Some((b_parent, b_name)) = target.rsplit_once('/') else {
        return false;
    };
    a_parent == b_parent && archives::preparation_family(a_name, b_name)
}
pub(super) fn plain(path: &Path, directory: bool) -> Result<PathBuf> {
    if !path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir | Component::CurDir))
    {
        return Err("archive_path");
    }
    for ancestor in path.ancestors() {
        let meta = fs::symlink_metadata(ancestor).map_err(|_| "archive_read")?;
        if save_files::reparse(&meta) {
            return Err("archive_links");
        }
        if ancestor != path && !meta.is_dir() {
            return Err("archive_path");
        }
    }
    let meta = fs::symlink_metadata(path).map_err(|_| "archive_read")?;
    if directory && !meta.is_dir() || !directory && !meta.is_file() {
        return Err("archive_path");
    }
    path.canonicalize().map_err(|_| "archive_read")
}
fn receipt(
    job: &ArchiveJob,
) -> Result<(
    &super::archives::ArchiveReceipt,
    PathBuf,
    Vec<(PathBuf, ArchivePart)>,
)> {
    let receipt = job
        .receipt
        .as_ref()
        .filter(|_| job.status == Status::Complete)
        .ok_or("archive_cleanup_incomplete")?;
    if key(&receipt.destination) != key(&job.destination)
        || receipt.parts.is_empty()
        || receipt.parts.len() > 1024
    {
        return Err("archive_cleanup_receipt");
    }
    let output = plain(Path::new(&receipt.destination), true)?;
    let source = plain(Path::new(&receipt.source), false)?;
    if !archives::preparation_candidate(
        source
            .file_name()
            .and_then(|v| v.to_str())
            .ok_or("archive_path")?,
    ) {
        return Err("archive_cleanup_receipt");
    }
    let parent = source.parent().ok_or("archive_path")?;
    let source_name = source
        .file_name()
        .and_then(|v| v.to_str())
        .ok_or("archive_path")?;
    let selected_name = Path::new(&job.source)
        .file_name()
        .and_then(|v| v.to_str())
        .ok_or("archive_path")?;
    if key(&plain(Path::new(&job.source), false)?
        .parent()
        .ok_or("archive_path")?
        .to_string_lossy())
        != key(&parent.to_string_lossy())
        || !archives::preparation_family(source_name, selected_name)
    {
        return Err("archive_cleanup_receipt");
    }
    let mut seen = HashSet::new();
    let mut parts = Vec::new();
    for part in &receipt.parts {
        if part.name.is_empty()
            || part.name.len() > 255
            || part.name.contains(['/', '\\', ':'])
            || part.name == "."
            || part.name == ".."
            || part.name.ends_with(['.', ' '])
            || part.name.chars().any(char::is_control)
            || part.sha256.len() != 64
            || !part.sha256.bytes().all(|v| v.is_ascii_hexdigit())
            || part.bytes == 0
            || !seen.insert(key(&part.name))
            || !archives::preparation_family(source_name, &part.name)
        {
            return Err("archive_cleanup_receipt");
        }
        let path = plain(&parent.join(&part.name), false)?;
        if path.parent() != Some(parent)
            || within(
                &key(&path.to_string_lossy()),
                &key(&output.to_string_lossy()),
            )
        {
            return Err("archive_cleanup_receipt");
        }
        parts.push((path, part.clone()));
    }
    if !parts.iter().any(|(path, _)| path == &source)
        || !parts
            .iter()
            .any(|(path, _)| key(&path.to_string_lossy()) == key(&job.source))
    {
        return Err("archive_cleanup_receipt");
    }
    Ok((receipt, output, parts))
}

impl Archives {
    pub(crate) fn cleanup_usage(&self, id: &str) -> Result<Vec<Usage>> {
        let jobs = self.jobs.lock().map_err(|_| "archive_store")?;
        Ok(jobs
            .iter()
            .filter(|job| job.id != id)
            .flat_map(|job| {
                [
                    Usage {
                        path: job.source.clone(),
                        tree: false,
                        family: true,
                        reason: Blocker::OtherExtraction,
                    },
                    Usage {
                        path: job.destination.clone(),
                        tree: true,
                        family: false,
                        reason: Blocker::OtherExtraction,
                    },
                ]
            })
            .collect())
    }
    pub(crate) fn review_cleanup(
        &self,
        profile: &str,
        id: &str,
        operation_id: &str,
        usage: impl Fn() -> Result<Vec<Usage>>,
        emit: impl Fn(ArchiveProgress),
    ) -> Result<Review> {
        let work=archives::start(profile,operation_id)?;
        let review=self.review_cleanup_reserved(profile,id,&work,usage,emit)?;
        super::archive_cleanup_plans::remember(self,profile,review)
    }
    pub(super) fn review_cleanup_reserved(&self,profile:&str,id:&str,work:&archives::Work,usage:impl Fn()->Result<Vec<Usage>>,emit:impl Fn(ArchiveProgress))->Result<Review>{
        let job = self
            .list(profile)?
            .into_iter()
            .find(|job| job.id == id)
            .ok_or("archive_expired")?;
        let (_, output, parts) = receipt(&job)?;
        let bytes = parts.iter().try_fold(0u64, |sum, (_, part)| {
            sum.checked_add(part.bytes).ok_or("archive_limit")
        })?;
        if bytes > 64 * 1024 * 1024 * 1024 {
            return Err("archive_limit");
        }
        let consumers = || -> Result<Vec<Blocker>> {
            let mut references = usage()?;
            references.extend(self.cleanup_usage(id)?);
            let mut blockers = Vec::new();
            for reference in references {
                if parts.iter().any(|(path, _)| matches(&reference, path))
                    && !blockers.contains(&reference.reason)
                {
                    blockers.push(reference.reason);
                }
            }
            Ok(blockers)
        };
        let blocked = consumers()?;
        if !blocked.is_empty() {
            return Ok(Review {
                token:None,
                job_id: job.id,
                revision: job.updated_at,
                checked_at: stamp(),
                destination: output.to_string_lossy().into_owned(),
                files: parts
                    .iter()
                    .map(|(path, part)| CleanupFile {
                        identity:String::new(),
                        path: path.to_string_lossy().into_owned(),
                        name: part.name.clone(),
                        bytes: part.bytes,
                        sha256: part.sha256.clone(),
                    })
                    .collect(),
                bytes,
                files_verified: false,
                blockers: blocked,
            });
        }
        let mut files = Vec::with_capacity(parts.len());
        let before = parts
            .iter()
            .map(|(path, _)| {
                let meta = fs::symlink_metadata(path).map_err(|_| "archive_read")?;
                Ok((meta.len(), meta.modified().map_err(|_| "archive_read")?))
            })
            .collect::<Result<Vec<_>>>()?;
        let mut offset = 0u64;
        for (index, (path, expected)) in parts.iter().enumerate() {
            let found = archives::cleanup_fingerprint(path, &work, &|mut progress| {
                progress.bytes = progress.bytes.saturating_add(offset);
                progress.total_bytes = bytes;
                progress.files = index;
                progress.total_files = parts.len();
                progress.current_file = Some(expected.name.clone());
                emit(progress);
            })?;
            if found.bytes != expected.bytes || !found.sha256.eq_ignore_ascii_case(&expected.sha256)
            {
                return Err("archive_changed");
            }
            offset = offset.checked_add(found.bytes).ok_or("archive_limit")?;
            files.push(CleanupFile {
                identity:super::archive_cleanup_io::identity(path)?,
                path: path.to_string_lossy().into_owned(),
                name: found.name,
                bytes: found.bytes,
                sha256: found.sha256,
            });
        }
        // Hashing can take time. Fetch consumers afterward and recheck the job;
        // no manager lock is held during file reads or progress callbacks.
        let blockers = consumers()?;
        for ((path, _), (bytes, modified)) in parts.iter().zip(before) {
            let meta = fs::symlink_metadata(path).map_err(|_| "archive_read")?;
            if plain(path, false)? != *path
                || meta.len() != bytes
                || meta.modified().map_err(|_| "archive_read")? != modified
            {
                return Err("archive_changed");
            }
        }
        let current = self
            .list(profile)?
            .into_iter()
            .find(|j| j.id == id)
            .ok_or("archive_expired")?;
        if current.updated_at != job.updated_at || current.status != Status::Complete {
            return Err("archive_changed");
        }
        // An output directory disappearing during the read invalidates the review.
        if plain(Path::new(&current.destination), true)? != output {
            return Err("archive_changed");
        }
        Ok(Review {
            token:None,
            job_id: job.id,
            revision: job.updated_at,
            checked_at: stamp(),
            destination: output.to_string_lossy().into_owned(),
            files,
            bytes,
            files_verified: true,
            blockers,
        })
    }
}
fn stamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn review(
    app: &tauri::AppHandle,
    profile: &str,
    id: &str,
    operation_id: &str,
) -> Result<Review> {
    use tauri::Emitter;
    let archives = super::archive_jobs::manager(app)?;
    let direct = super::transfers::manager(app)?;
    let torrents = super::p2p::manager(app)?;
    let preparation = super::preparation_runtime::manager(app)?;
    archives.review_cleanup(
        profile,
        id,
        operation_id,
        || {
            let mut usage = direct.cleanup_usage(profile, id)?;
            usage.extend(torrents.cleanup_usage(profile, id)?);
            usage.extend(preparation.cleanup_usage(id)?);
            Ok(usage)
        },
        |event| {
            let _ = app.emit("games:archive-progress", event);
        },
    )
}

#[cfg(test)]
#[path = "archive_cleanup_tests.rs"]
pub(crate) mod tests;
