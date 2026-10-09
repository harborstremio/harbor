//! Read-only SMAPI inventory. No save, configuration, assembly or mod execution.
use super::{
    stardew_manifest::{self as manifest, Result},
    stardew_progress::Work,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs, io::Read, path::Path};
const MAX_MODS: usize = 512;
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Requirement {
    pub kind: &'static str,
    pub id: String,
    pub minimum: Option<String>,
    pub required: bool,
    pub status: &'static str,
    pub installed: Option<String>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Mod {
    pub folder: String,
    pub manifest: manifest::Manifest,
    pub missing_dll: bool,
    pub duplicate: bool,
    pub requirements: Vec<Requirement>,
}
#[derive(Clone, Debug, Serialize)]
pub struct Issue {
    pub path: String,
    pub reason: &'static str,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inventory {
    pub path: String,
    pub game_version: Option<String>,
    pub smapi_version: Option<String>,
    pub mods: Vec<Mod>,
    pub issues: Vec<Issue>,
    pub partial: bool,
    #[serde(skip)]
    pub fingerprint: String,
}
fn linked(m: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if m.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    m.file_type().is_symlink()
}
fn regular(path: &Path) -> Result<fs::Metadata> {
    let m = fs::symlink_metadata(path).map_err(|_| "stardew_read")?;
    if !m.is_file() || linked(&m) {
        return Err("stardew_link");
    };
    Ok(m)
}
fn display(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}
fn read(path: &Path, check: &dyn Fn() -> Result<()>) -> Result<Vec<u8>> {
    check()?;
    let before = regular(path)?;
    if before.len() > 256 * 1024 {
        return Err("stardew_limit");
    }
    let mut b = Vec::new();
    fs::File::open(path)
        .map_err(|_| "stardew_read")?
        .take(256 * 1024 + 1)
        .read_to_end(&mut b)
        .map_err(|_| "stardew_read")?;
    check()?;
    let after = regular(path)?;
    if before.len() != after.len()
        || before.modified().ok() != after.modified().ok()
        || b.len() as u64 != after.len()
    {
        return Err("stardew_changed");
    };
    Ok(b)
}
fn relevant(name: &str, directory: bool) -> bool {
    let name = name.to_ascii_lowercase();
    if name.starts_with('.')
        || [
            "__folder_managed_by_vortex",
            "__macosx",
            "mcs",
            "desktop.ini",
            "thumbs.db",
        ]
        .contains(&name.as_str())
    {
        return false;
    }
    if directory {
        return true;
    }
    ![
        "doc", "docx", "md", "rtf", "txt", "bmp", "gif", "ico", "jpeg", "jpg", "png", "psd", "tif",
        "xcf", "rar", "zip", "7z", "tar", "gz", "backup", "bak", "old", "url", "lnk",
    ]
    .contains(&name.rsplit('.').next().unwrap_or(""))
}
fn file_in(root: &Path, relative: &str) -> bool {
    if !manifest::safe_relative(relative) {
        return false;
    }
    let mut p = root.to_path_buf();
    let parts = relative.split(['/', '\\']).collect::<Vec<_>>();
    for (i, part) in parts.iter().enumerate() {
        p.push(part);
        let Ok(m) = fs::symlink_metadata(&p) else {
            return false;
        };
        if linked(&m) || (i + 1 < parts.len() && !m.is_dir()) {
            return false;
        }
    }
    regular(&p).is_ok()
}
#[cfg(windows)]
pub(super) fn version(path: &Path) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{
        core::{w, PCWSTR},
        Win32::Storage::FileSystem::{
            GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW,
        },
    };
    regular(path).ok()?;
    let wide = path
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    // Windows reads version resources; it does not load this assembly.
    unsafe {
        let size = GetFileVersionInfoSizeW(PCWSTR(wide.as_ptr()), None);
        if size == 0 || size > 1024 * 1024 {
            return None;
        }
        let mut b = vec![0u64; (size as usize).div_ceil(8)];
        GetFileVersionInfoW(PCWSTR(wide.as_ptr()), None, size, b.as_mut_ptr().cast()).ok()?;
        let valid = |p: *const std::ffi::c_void, n: usize| {
            let p = p as usize;
            let start = b.as_ptr() as usize;
            p >= start
                && p.checked_add(n)
                    .is_some_and(|end| end <= start + size as usize)
        };
        let mut p = std::ptr::null_mut();
        let mut n = 0;
        if !VerQueryValueW(
            b.as_ptr().cast(),
            w!("\\VarFileInfo\\Translation"),
            &mut p,
            &mut n,
        )
        .as_bool()
            || n < 4
            || n > 256
            || !valid(p, n as usize)
        {
            return None;
        }
        let translations = (0..n as usize / 4)
            .take(8)
            .map(|i| {
                let q = p.cast::<u16>().add(i * 2);
                (q.read_unaligned(), q.add(1).read_unaligned())
            })
            .collect::<Vec<_>>();
        for (lang, codepage) in translations {
            let query = format!("\\StringFileInfo\\{lang:04x}{codepage:04x}\\ProductVersion")
                .encode_utf16()
                .chain(Some(0))
                .collect::<Vec<_>>();
            if !VerQueryValueW(b.as_ptr().cast(), PCWSTR(query.as_ptr()), &mut p, &mut n).as_bool()
                || n == 0
                || n > 160
                || !valid(p, n as usize * 2)
            {
                continue;
            }
            let chars = (0..n as usize)
                .map(|i| p.cast::<u16>().add(i).read_unaligned())
                .take_while(|v| *v != 0)
                .collect::<Vec<_>>();
            let text = String::from_utf16(&chars).ok()?;
            let text = text.split('+').next()?.trim();
            if !text.is_empty()
                && text.len() <= 80
                && text
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'.' | b'-' | b'_'))
            {
                return Some(text.into());
            }
        }
    }
    None
}
#[cfg(not(windows))]
pub(super) fn version(_: &Path) -> Option<String> {
    None
}
pub(super) fn requirements(inventory: &mut Inventory) {
    let mut ids: BTreeMap<String, Vec<(String, bool)>> = BTreeMap::new();
    for item in &inventory.mods {
        ids.entry(item.manifest.id.to_ascii_lowercase())
            .or_default()
            .push((item.manifest.version.clone(), item.missing_dll));
    }
    for item in &mut inventory.mods {
        item.duplicate = ids
            .get(&item.manifest.id.to_ascii_lowercase())
            .is_some_and(|v| v.len() > 1);
        let mut requirements = Vec::new();
        for d in &item.manifest.dependencies {
            let found = ids.get(&d.id.to_ascii_lowercase());
            let (status, installed) = match found {
                Some(found) if found.len() > 1 => ("duplicate", None),
                Some(found) if found[0].1 => ("unusable", Some(found[0].0.clone())),
                Some(found) => (
                    match manifest::satisfies(&found[0].0, d.minimum.as_deref()) {
                        Some(true) => "present",
                        Some(false) => "older",
                        None => "unchecked",
                    },
                    Some(found[0].0.clone()),
                ),
                None => (
                    if inventory.partial {
                        "unchecked"
                    } else if d.required {
                        "missing"
                    } else {
                        "optional"
                    },
                    None,
                ),
            };
            requirements.push(Requirement {
                kind: "mod",
                id: d.id.clone(),
                minimum: d.minimum.clone(),
                required: d.required,
                status,
                installed,
            });
        }
        for (kind, id, minimum, installed) in [
            (
                "smapi",
                "SMAPI",
                &item.manifest.minimum_api,
                &inventory.smapi_version,
            ),
            (
                "game",
                "Stardew Valley",
                &item.manifest.minimum_game,
                &inventory.game_version,
            ),
        ] {
            if let Some(minimum) = minimum {
                let status = match installed
                    .as_deref()
                    .and_then(|v| manifest::satisfies(v, Some(minimum)))
                {
                    Some(true) => "present",
                    Some(false) => "older",
                    None => "unchecked",
                };
                requirements.push(Requirement {
                    kind,
                    id: id.into(),
                    minimum: Some(minimum.clone()),
                    required: true,
                    status,
                    installed: installed.clone(),
                })
            }
        }
        item.requirements = requirements;
    }
}
pub fn scan(
    value: &str,
    check: &dyn Fn() -> Result<()>,
    progress: &dyn Fn(usize) -> Result<()>,
) -> Result<Inventory> {
    let requested = Path::new(value);
    if !requested.is_absolute() {
        return Err("stardew_folder");
    }
    let root = requested.canonicalize().map_err(|_| "stardew_folder")?;
    if !root.is_dir() {
        return Err("stardew_folder");
    }
    let game = [
        "Stardew Valley.dll",
        "Stardew Valley.exe",
        "StardewValley.exe",
    ]
    .into_iter()
    .map(|n| root.join(n))
    .find(|p| regular(p).is_ok())
    .ok_or("stardew_folder")?;
    let mods = root.join("Mods");
    let m = fs::symlink_metadata(&mods).map_err(|_| "stardew_mods_missing")?;
    if !m.is_dir() || linked(&m) {
        return Err("stardew_link");
    }
    let mut inventory = Inventory {
        path: root.to_string_lossy().into(),
        game_version: version(&game),
        smapi_version: version(&root.join("StardewModdingAPI.dll"))
            .or_else(|| version(&root.join("StardewModdingAPI.exe"))),
        mods: vec![],
        issues: vec![],
        partial: false,
        fingerprint: String::new(),
    };
    let mut pending = vec![(mods.clone(), 0usize)];
    let mut entries = 0;
    let mut bytes = 0;
    let mut digest = Sha256::new();
    while let Some((folder, depth)) = pending.pop() {
        check()?;
        if depth > 12
            || entries >= 10000
            || inventory.mods.len() >= MAX_MODS
            || bytes >= 16 * 1024 * 1024
        {
            inventory.partial = true;
            break;
        }
        let fm = fs::symlink_metadata(&folder).map_err(|_| "stardew_read")?;
        if !fm.is_dir() || linked(&fm) {
            inventory.partial = true;
            inventory.issues.push(Issue {
                path: display(&mods, &folder),
                reason: "stardew_link",
            });
            continue;
        }
        let mut children = Vec::new();
        let mut relevant_files = Vec::new();
        let mut manifests = Vec::new();
        let dir = match fs::read_dir(&folder) {
            Ok(v) => v,
            Err(_) => {
                inventory.partial = true;
                inventory.issues.push(Issue {
                    path: display(&mods, &folder),
                    reason: "stardew_read",
                });
                continue;
            }
        };
        for child in dir {
            check()?;
            entries += 1;
            if entries > 10000 {
                inventory.partial = true;
                break;
            }
            let Ok(child) = child else {
                inventory.partial = true;
                continue;
            };
            let name = child.file_name().to_string_lossy().into_owned();
            let p = child.path();
            let Ok(m) = fs::symlink_metadata(&p) else {
                inventory.partial = true;
                continue;
            };
            if !relevant(&name, m.is_dir()) {
                continue;
            }
            if linked(&m) {
                inventory.partial = true;
                inventory.issues.push(Issue {
                    path: display(&mods, &p),
                    reason: "stardew_link",
                });
                continue;
            }
            if m.is_dir() {
                children.push(p)
            } else if m.is_file() {
                if name.eq_ignore_ascii_case("manifest.json") {
                    manifests.push(p.clone())
                }
                relevant_files.push(p)
            }
        }
        children.sort();
        // SMAPI searches organizational folders only when they have no relevant
        // files. A mod's nested assets are not independent installed mods.
        if depth == 0 || (!children.is_empty() && relevant_files.is_empty()) {
            pending.extend(children.into_iter().rev().map(|p| (p, depth + 1)));
            continue;
        }
        if relevant_files.is_empty() {
            continue;
        }
        if manifests.len() != 1 {
            inventory.partial = true;
            inventory.issues.push(Issue {
                path: display(&mods, &folder),
                reason: "stardew_manifest",
            });
            continue;
        }
        match read(&manifests[0], check).and_then(|b| {
            bytes += b.len();
            digest.update(display(&mods, &folder).as_bytes());
            digest.update(&b);
            manifest::parse(&b)
        }) {
            Ok(manifest) => {
                let missing_dll = manifest
                    .entry_dll
                    .as_deref()
                    .is_some_and(|dll| !file_in(&folder, dll));
                inventory.mods.push(Mod {
                    folder: display(&mods, &folder),
                    manifest,
                    missing_dll,
                    duplicate: false,
                    requirements: vec![],
                });
                progress(inventory.mods.len())?;
            }
            Err(e @ ("stardew_canceled" | "stardew_timeout" | "stardew_changed")) => return Err(e),
            Err(reason) => {
                inventory.partial = true;
                inventory.issues.push(Issue {
                    path: display(&mods, &folder),
                    reason,
                });
            }
        }
    }
    inventory.mods.sort_by(|a, b| a.folder.cmp(&b.folder));
    inventory.issues.truncate(100);
    digest.update(
        serde_json::to_vec(&(
            &inventory.game_version,
            &inventory.smapi_version,
            &inventory.mods,
            &inventory.issues,
            inventory.partial,
        ))
        .map_err(|_| "stardew_manifest")?,
    );
    inventory.fingerprint = format!("{:x}", digest.finalize());
    requirements(&mut inventory);
    Ok(inventory)
}
pub fn inspect(
    profile: &str,
    path: &str,
    operation: &str,
    emit: &dyn Fn(super::stardew_progress::Progress),
) -> Result<Inventory> {
    let work = Work::start(profile, operation, emit)?;
    scan(path, &|| work.check(), &|count| {
        work.progress("scanning", count, 0)
    })
}

#[cfg(test)]
#[path = "stardew_tests.rs"]
mod tests;
