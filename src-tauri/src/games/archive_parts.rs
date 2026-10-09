//! A reviewed archive set is bounded, ordered and pinned to ordinary sibling files.
use super::{canceled, hash, metadata, unchanged, ArchiveProgress, Result, Work, MAX_ARCHIVE};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs::{self, File},
    path::{Path, PathBuf},
};

pub(super) const MAX_PARTS: usize = 1024;
const MAX_DIRECTORY_ENTRIES: usize = 20_000;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchivePart {
    pub name: String,
    pub bytes: u64,
    pub sha256: String,
}

#[derive(Debug, PartialEq, Eq)]
struct Numbered {
    key: String,
    index: usize,
    first: usize,
}
fn numbered(name: &str) -> Option<Numbered> {
    let name = name.to_lowercase();
    for (extension, scheme) in [(".7z.", "sevenzip"), (".zip.", "zip")] {
        if let Some((prefix, digits)) = name.rsplit_once(extension) {
            if !prefix.is_empty() && digits.len() >= 3 && digits.bytes().all(|v| v.is_ascii_digit()) {
                return Some(Numbered {
                    key: format!("{scheme}:{prefix}"),
                    index: digits.parse().unwrap_or(usize::MAX),
                    first: 1,
                });
            }
        }
    }
    if let Some(stem) = name.strip_suffix(".rar") {
        if let Some((prefix, digits)) = stem.rsplit_once(".part") {
            if !prefix.is_empty()
                && !digits.is_empty()
                && digits.bytes().all(|v| v.is_ascii_digit())
            {
                return Some(Numbered {
                    key: format!("modern:{prefix}"),
                    index: digits.parse().unwrap_or(usize::MAX),
                    first: 1,
                });
            }
        }
        return Some(Numbered {
            key: format!("legacy:{stem}"),
            index: 0,
            first: 0,
        });
    }
    let (stem, extension) = name.rsplit_once('.')?;
    let bytes = extension.as_bytes();
    if !stem.is_empty()
        && bytes.len() == 3
        && (b'r'..=b'z').contains(&bytes[0])
        && bytes[1..].iter().all(u8::is_ascii_digit)
    {
        Some(Numbered {
            key: format!("legacy:{stem}"),
            index: usize::from(bytes[0] - b'r') * 100 + extension[1..].parse::<usize>().ok()? + 1,
            first: 0,
        })
    } else {
        None
    }
}

pub(crate) fn split_sevenzip(name: &str) -> bool {
    numbered(name).is_some_and(|part| part.key.starts_with("sevenzip:"))
}

pub(crate) fn same_family(first:&str,second:&str)->bool{
    match (numbered(first),numbered(second)){
        (Some(a),Some(b))=>a.key==b.key,
        _=>first==second||cfg!(windows)&&first.eq_ignore_ascii_case(second),
    }
}
pub(crate) fn candidate(name:&str)->bool{
    let lower=name.to_ascii_lowercase();
    numbered(&lower).is_some()||[".zip",".7z",".tar",".tar.gz",".tgz",".iso"].iter().any(|suffix|lower.ends_with(suffix))
}
pub(crate) fn split_zip(name: &str) -> bool {
    numbered(name).is_some_and(|part| part.key.starts_with("zip:"))
}
pub(crate) fn split_archive(name: &str) -> bool {
    split_sevenzip(name) || split_zip(name)
}

pub(super) struct OpenParts {
    pub paths: Vec<PathBuf>,
    pub files: Vec<File>,
    before: Vec<fs::Metadata>,
    pub bytes: u64,
}
impl OpenParts {
    pub fn open(selected: &Path, work: &Work) -> Result<Self> {
        metadata(selected)?;
        let selected = selected.canonicalize().map_err(|_| "archive_read")?;
        let selected_name = selected
            .file_name()
            .and_then(|v| v.to_str())
            .ok_or("archive_path")?;
        let paths = if let Some(scheme) = numbered(selected_name) {
            if scheme.index < scheme.first || scheme.index >= MAX_PARTS + scheme.first {
                return Err("archive_limit");
            }
            let parent = selected.parent().ok_or("archive_path")?;
            let mut parts = BTreeMap::new();
            for (count, item) in fs::read_dir(parent)
                .map_err(|_| "archive_read")?
                .enumerate()
            {
                canceled(work)?;
                if count >= MAX_DIRECTORY_ENTRIES {
                    return Err("archive_limit");
                }
                let item = item.map_err(|_| "archive_read")?;
                let filename = item.file_name();
                let Some(name) = filename.to_str() else {
                    continue;
                };
                let Some(part) = numbered(name).filter(|v| v.key == scheme.key) else {
                    continue;
                };
                if part.index < scheme.first || part.index >= MAX_PARTS + scheme.first {
                    return Err("archive_limit");
                }
                if parts.insert(part.index, item.path()).is_some() {
                    return Err("archive_collision");
                }
            }
            if !parts.contains_key(&scheme.index) {
                return Err("archive_changed");
            }
            if parts
                .keys()
                .enumerate()
                .any(|(index, found)| *found != index + scheme.first)
            {
                return Err("archive_missing_part");
            }
            parts.into_values().collect::<Vec<_>>()
        } else {
            vec![selected]
        };
        let mut value = Self {
            paths: Vec::new(),
            files: Vec::new(),
            before: Vec::new(),
            bytes: 0,
        };
        let mut parent: Option<PathBuf> = None;
        #[cfg(windows)]
        let multipart = paths.len() > 1;
        for path in paths {
            canceled(work)?;
            let before = metadata(&path)?;
            let canonical = path.canonicalize().map_err(|_| "archive_read")?;
            if parent
                .as_ref()
                .is_some_and(|v| Some(v.as_path()) != canonical.parent())
            {
                return Err("archive_path");
            }
            parent = canonical.parent().map(Path::to_path_buf);
            value.bytes = value
                .bytes
                .checked_add(before.len())
                .ok_or("archive_limit")?;
            if value.bytes > MAX_ARCHIVE {
                return Err("archive_limit");
            }
            let mut options = fs::OpenOptions::new();
            options.read(true);
            #[cfg(windows)]
            {
                use std::os::windows::fs::OpenOptionsExt;
                // Hold multipart inputs read-only for the entire review/extraction.
                // Single-file behavior is preserved for existing readers.
                if multipart {
                    options.share_mode(1);
                }
            }
            let file = options.open(&canonical).map_err(|_| "archive_read")?;
            unchanged(&canonical, &before)?;
            value.paths.push(canonical);
            value.files.push(file);
            value.before.push(before);
        }
        Ok(value)
    }
    pub fn unchanged(&self) -> Result<()> {
        for (path, before) in self.paths.iter().zip(&self.before) {
            unchanged(path, before)?;
        }
        Ok(())
    }
    pub fn hashes(
        &mut self,
        work: &Work,
        emit: &impl Fn(ArchiveProgress),
    ) -> Result<Vec<ArchivePart>> {
        let mut result = Vec::with_capacity(self.paths.len());
        let mut offset = 0;
        for ((path, file), before) in self.paths.iter().zip(&mut self.files).zip(&self.before) {
            let sha256 = hash(
                file,
                work,
                before.len(),
                &|mut progress: ArchiveProgress| {
                    progress.bytes += offset;
                    progress.total_bytes = self.bytes;
                    progress.current_file =
                        path.file_name().and_then(|v| v.to_str()).map(str::to_owned);
                    emit(progress);
                },
            )?;
            offset += before.len();
            result.push(ArchivePart {
                name: path
                    .file_name()
                    .and_then(|v| v.to_str())
                    .ok_or("archive_path")?
                    .into(),
                bytes: before.len(),
                sha256,
            });
        }
        self.unchanged()?;
        Ok(result)
    }
}

pub(super) fn digest(parts: &[ArchivePart]) -> String {
    if parts.len() == 1 {
        return parts[0].sha256.clone();
    }
    let mut sha = Sha256::new();
    sha.update(b"Harbor archive set v1\0");
    for part in parts {
        sha.update((part.name.len() as u64).to_le_bytes());
        sha.update(part.name.as_bytes());
        sha.update(part.bytes.to_le_bytes());
        sha.update(part.sha256.as_bytes());
    }
    format!("{:x}", sha.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recognizes_modern_and_legacy_part_identities_without_number_confusion() {
        assert_eq!(numbered("GAME.part01.RAR"), numbered("game.part1.rar"));
        assert_eq!(numbered("game.part10.rar").unwrap().index, 10);
        assert_eq!(numbered("game.rar").unwrap().index, 0);
        assert_eq!(numbered("game.r00").unwrap().index, 1);
        assert_eq!(numbered("game.s00").unwrap().index, 101);
        assert_eq!(numbered("GAME.7Z.001"), numbered("game.7z.0001"));
        assert_eq!(numbered("game.7z.010").unwrap().index, 10);
        assert!(numbered("game.7z.1").is_none());
        assert_eq!(numbered("GAME.ZIP.001"), numbered("game.zip.0001"));
        assert_eq!(numbered("game.zip.010").unwrap().index, 10);
        assert_ne!(numbered("game.zip.001").unwrap().key, numbered("game.7z.001").unwrap().key);
        assert!(numbered("game.r1").is_none());
        assert_ne!(
            numbered("game.part1.rar").unwrap().key,
            numbered("game 2.part1.rar").unwrap().key
        );
    }
}
