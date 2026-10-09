//! Validate a single SMAPI mod ZIP before any game-directory write.
use super::stardew_manifest::{self, Manifest, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    io::{Cursor, Read},
};

pub const MAX_ARCHIVE: usize = 32 * 1024 * 1024;
pub const MAX_CONTENT: usize = 128 * 1024 * 1024;
pub const MAX_FILES: usize = 4096;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Stamp {
    pub name: String,
    pub bytes: u64,
    pub hash: String,
}
pub struct File {
    pub stamp: Stamp,
    pub bytes: Vec<u8>,
}
pub struct Package {
    pub folder: String,
    pub manifest: Manifest,
    pub files: Vec<File>,
    pub archive_hash: String,
    pub origin: Option<Origin>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Origin {
    pub url: String,
    pub file: String,
    pub sha256: String,
}
impl Origin {
    pub fn valid(&self, id: &str, version: &str, hash: &str) -> bool {
        id.eq_ignore_ascii_case("Annosz.UiInfoSuite2")
            && self.url == format!("https://github.com/Annosz/UIInfoSuite2/releases/tag/v{version}")
            && version
                .bytes()
                .all(|v| v.is_ascii_alphanumeric() || matches!(v, b'.' | b'-' | b'+'))
            && component(&self.file)
            && self.file.ends_with(".zip")
            && self.sha256 == hash
            && hash.len() == 64
            && hash.bytes().all(|v| v.is_ascii_hexdigit())
    }
}
pub fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub fn component(value: &str) -> bool {
    let stem = value.split('.').next().unwrap_or("").to_ascii_uppercase();
    !value.is_empty()
        && value.len() <= 180
        && !matches!(value, "." | "..")
        && !value.ends_with(['.', ' '])
        && !value.chars().any(|c| {
            c.is_control() || matches!(c, ':' | '/' | '\\' | '<' | '>' | '"' | '|' | '?' | '*')
        })
        && ![
            "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
            "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
        ]
        .contains(&stem.as_str())
}
pub fn relative(value: &str) -> bool {
    value.len() <= 768 && value.split('/').count() <= 16 && value.split('/').all(component)
}
pub fn stamp(name: &str, bytes: &[u8]) -> Stamp {
    Stamp {
        name: name.into(),
        bytes: bytes.len() as u64,
        hash: hash(bytes),
    }
}
pub fn unpack(bytes: &[u8], check: &dyn Fn() -> Result<()>) -> Result<Package> {
    check()?;
    if bytes.len() > MAX_ARCHIVE {
        return Err("stardew_limit");
    }
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|_| "stardew_archive")?;
    if zip.is_empty() || zip.len() > MAX_FILES {
        return Err("stardew_limit");
    }
    let mut names = BTreeSet::new();
    let mut files = BTreeMap::new();
    let mut total = 0usize;
    for index in 0..zip.len() {
        check()?;
        let mut entry = zip.by_index(index).map_err(|_| "stardew_archive")?;
        let name = entry.name().replace('\\', "/");
        let name = name.trim_end_matches('/');
        if !relative(name)
            || entry.enclosed_name().is_none()
            || entry.encrypted()
            || entry
                .unix_mode()
                .is_some_and(|m| !matches!(m & 0o170000, 0 | 0o100000 | 0o040000))
            || !names.insert(name.to_ascii_lowercase())
        {
            return Err("stardew_archive");
        }
        if entry.is_dir() {
            continue;
        }
        let size = usize::try_from(entry.size()).map_err(|_| "stardew_limit")?;
        total = total
            .checked_add(size)
            .filter(|v| *v <= MAX_CONTENT)
            .ok_or("stardew_limit")?;
        let ext = name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
        if [
            "exe", "com", "bat", "cmd", "ps1", "vbs", "msi", "scr", "lnk", "url", "sh", "dylib",
            "so",
        ]
        .contains(&ext.as_str())
        {
            return Err("stardew_archive");
        }
        let mut data = Vec::with_capacity(size.min(1024 * 1024));
        let mut block = [0u8; 64 * 1024];
        loop {
            check()?;
            let n = entry.read(&mut block).map_err(|_| "stardew_archive")?;
            if n == 0 {
                break;
            }
            if data.len() + n > size {
                return Err("stardew_limit");
            };
            data.extend_from_slice(&block[..n]);
        }
        if data.len() != size {
            return Err("stardew_archive");
        }
        files.insert(name.to_string(), data);
    }
    let manifests = files
        .keys()
        .filter(|p| {
            p.rsplit('/')
                .next()
                .is_some_and(|v| v.eq_ignore_ascii_case("manifest.json"))
        })
        .cloned()
        .collect::<Vec<_>>();
    if manifests.len() != 1 {
        return Err("stardew_archive_layout");
    }
    let location = &manifests[0];
    let (folder, filename) = location.split_once('/').ok_or("stardew_archive_layout")?;
    if filename != "manifest.json"
        || folder.starts_with('.')
        || folder.eq_ignore_ascii_case("Mods")
        || folder.starts_with("__")
        || files.keys().any(|p| !p.starts_with(&format!("{folder}/")))
    {
        return Err("stardew_archive_layout");
    }
    let manifest = stardew_manifest::parse(files.get(location).ok_or("stardew_manifest")?)?;
    if let Some(dll) = &manifest.entry_dll {
        if !files.contains_key(&format!("{folder}/{}", dll.replace('\\', "/"))) {
            return Err("stardew_archive_layout");
        }
    }
    // A file cannot also be the parent of another file, even on a case-sensitive host.
    let names = files
        .keys()
        .map(|n| n.to_ascii_lowercase())
        .collect::<BTreeSet<_>>();
    for name in &names {
        let mut p = name.as_str();
        while let Some((parent, _)) = p.rsplit_once('/') {
            if names.contains(parent) {
                return Err("stardew_archive_layout");
            };
            p = parent;
        }
    }
    let files = files
        .into_iter()
        .map(|(name, bytes)| {
            let name = name[folder.len() + 1..].to_string();
            File {
                stamp: stamp(&name, &bytes),
                bytes,
            }
        })
        .collect();
    Ok(Package {
        origin: None,
        folder: folder.into(),
        manifest,
        files,
        archive_hash: hash(bytes),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    fn zip(files: &[(&str, &[u8])]) -> Vec<u8> {
        let mut z = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for (n, b) in files {
            z.start_file(*n, zip::write::SimpleFileOptions::default())
                .unwrap();
            z.write_all(b).unwrap();
        }
        z.finish().unwrap().into_inner()
    }
    const MANIFEST: &[u8] =
        br#"{"Name":"Test","Author":"A","UniqueID":"A.Test","Version":"1.0","EntryDll":"mod.dll"}"#;
    #[test]
    fn validates_complete_mod_and_rejects_escape_collisions_and_source_archives() {
        let valid = zip(&[("Test/manifest.json", MANIFEST), ("Test/mod.dll", b"test")]);
        assert_eq!(unpack(&valid, &|| Ok(())).unwrap().files.len(), 2);
        for files in [
            vec![("../escape", b"x".as_slice())],
            vec![
                ("Test/manifest.json", MANIFEST),
                ("test/MANIFEST.json", MANIFEST),
            ],
            vec![("Test/manifest.json", MANIFEST)],
            vec![
                ("Test/manifest.json", MANIFEST),
                ("Test/mod.dll", b"test"),
                ("Test/install.exe", b"x"),
            ],
            vec![
                ("Test/manifest.json", MANIFEST),
                ("Test/mod.dll", b"test"),
                ("Test/config", b"x"),
                ("Test/config/child", b"x"),
            ],
        ] {
            assert!(unpack(&zip(&files), &|| Ok(())).is_err());
        }
        assert!(unpack(
            &zip(&[
                ("Source/Test/manifest.json", MANIFEST),
                ("Source/Test/mod.dll", b"x")
            ]),
            &|| Ok(())
        )
        .is_err());
        assert!(unpack(&valid, &|| Err("stardew_canceled")).is_err());
    }
    #[test]
    fn creator_archive_is_a_ready_smapi_mod() {
        let Some(path) = std::env::var_os("HARBOR_TEST_STARDEW_ZIP") else {
            return;
        };
        let bytes = std::fs::read(path).unwrap();
        let p = unpack(&bytes, &|| Ok(())).unwrap();
        assert_eq!(p.manifest.id, "Annosz.UiInfoSuite2");
        assert_eq!(p.manifest.version, "2.3.7");
        assert_eq!(p.files.len(), 21);
        assert_eq!(
            p.archive_hash,
            "27ad51a664d37db1aeffc51bfa8493966f99614fc106383b18ae2fa5b800f975"
        );
    }
}
