//! Read-only evidence of pack content in a user-selected Sims 4 installation.
//! Delta directories contain patches even for packs that are not installed.
use super::{
    sims_files as files, sims_launch_settings as launch,
    sims_package::Result,
    sims_store::progress::{Progress, Work},
};
use serde::Serialize;
use std::{
    collections::BTreeMap,
    fs,
    io::{Read, Seek, SeekFrom},
    path::Path,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const MAX_ENTRIES: usize = 2048;
const MAX_PACK_FILES: usize = 256;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Found,
    Unchecked,
}
#[derive(Debug, Serialize)]
pub struct Pack {
    pub code: String,
    pub status: Status,
    pub files: Vec<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub path: String,
    pub packs: Vec<Pack>,
    pub partial: bool,
    pub checked_at: u64,
    pub launch: launch::Settings,
}
impl Report {
    pub fn availability(&self, code: &str) -> Option<bool> {
        if self.launch.state == "checked" && self.launch.disabled.contains(code) {
            return Some(false);
        }
        match self
            .packs
            .iter()
            .find(|pack| pack.code == code)
            .map(|pack| pack.status)
        {
            Some(Status::Found) if self.launch.state == "checked" => Some(true),
            None if !self.partial => Some(false),
            _ => None,
        }
    }
}

fn code(name: &str) -> Option<String> {
    let bytes = name.as_bytes();
    (bytes.len() == 4
        && b"EFGS".contains(&bytes[0].to_ascii_uppercase())
        && bytes[1].eq_ignore_ascii_case(&b'P')
        && bytes[2..].iter().all(u8::is_ascii_digit))
    .then(|| name.to_ascii_uppercase())
}
fn full_build(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    ["clientfullbuild", "simulationfullbuild"]
        .iter()
        .any(|prefix| {
            lower
                .strip_prefix(prefix)
                .and_then(|tail| tail.strip_suffix(".package"))
                .is_some_and(|digits| {
                    !digits.is_empty()
                        && digits.len() <= 3
                        && digits.bytes().all(|b| b.is_ascii_digit())
                })
        })
}
fn unchanged(path: &Path, before: &fs::Metadata) -> Result<()> {
    let after = files::regular(path)?;
    if before.len() != after.len() || before.modified().ok() != after.modified().ok() {
        return Err("sims_changed");
    }
    Ok(())
}
fn package_header(path: &Path, check: &dyn Fn() -> Result<()>) -> Result<()> {
    check()?;
    let before = files::regular(path)?;
    let mut header = [0u8; 96];
    fs::File::open(path)
        .and_then(|mut f| f.read_exact(&mut header))
        .map_err(|_| "sims_read")?;
    let word = |at| u32::from_le_bytes(header[at..at + 4].try_into().unwrap());
    let offset = if word(40) != 0 {
        u64::from(word(40))
    } else {
        u64::from_le_bytes(header[64..72].try_into().unwrap())
    };
    if &header[..4] != b"DBPF"
        || word(4) != 2
        || word(8) != 1
        || word(36) == 0
        || offset < 96
        || word(44) < 4
        || offset
            .checked_add(u64::from(word(44)))
            .is_none_or(|end| end > before.len())
    {
        return Err("sims_format");
    }
    check()?;
    unchanged(path, &before)
}
fn executable(path: &Path, check: &dyn Fn() -> Result<()>) -> Result<()> {
    check()?;
    let before = files::regular(path)?;
    let mut file = fs::File::open(path).map_err(|_| "sims_read")?;
    let mut dos = [0u8; 64];
    file.read_exact(&mut dos).map_err(|_| "sims_read")?;
    let at = u64::from(u32::from_le_bytes(dos[60..64].try_into().unwrap()));
    if &dos[..2] != b"MZ" || !(64..=1024 * 1024).contains(&at) || at + 4 > before.len() {
        return Err("sims_format");
    }
    let mut pe = [0; 4];
    file.seek(SeekFrom::Start(at))
        .and_then(|_| file.read_exact(&mut pe))
        .map_err(|_| "sims_read")?;
    if pe != *b"PE\0\0" {
        return Err("sims_format");
    }
    check()?;
    unchanged(path, &before)
}
fn pack(path: &Path, code: String, check: &dyn Fn() -> Result<()>) -> Result<Pack> {
    let mut value = Pack {
        code,
        status: Status::Unchecked,
        files: vec![],
    };
    let Ok(root) = files::directory(path) else {
        return Ok(value);
    };
    let Ok(before) = fs::metadata(&root) else {
        return Ok(value);
    };
    let Ok(entries) = fs::read_dir(&root) else {
        return Ok(value);
    };
    let mut partial = false;
    for (index, entry) in entries.enumerate() {
        check()?;
        if index >= MAX_PACK_FILES {
            partial = true;
            break;
        }
        let Ok(entry) = entry else {
            partial = true;
            continue;
        };
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            partial = true;
            continue;
        };
        if !full_build(&name) {
            continue;
        }
        match package_header(&entry.path(), check) {
            Ok(()) => value.files.push(name),
            Err("sims_canceled" | "sims_limit") => {
                check()?;
                return Err("sims_limit");
            }
            Err(_) => partial = true,
        }
    }
    check()?;
    if files::directory(path).ok().as_ref() != Some(&root)
        || fs::metadata(&root).ok().and_then(|m| m.modified().ok()) != before.modified().ok()
    {
        partial = true;
    }
    value.files.sort();
    if !partial && !value.files.is_empty() {
        value.status = Status::Found;
    }
    Ok(value)
}
pub fn scan(
    profile: &str,
    path: &str,
    operation: &str,
    custom: &[launch::CustomLaunch],
    emit: impl Fn(Progress),
) -> Result<Report> {
    let mut work = Work::start(profile, operation, &emit)?;
    let report = inspect(path, custom, &launch::Environment::current(), &work)?;
    work.done();
    Ok(report)
}
pub fn inspect(
    path: &str,
    custom: &[launch::CustomLaunch],
    environment: &launch::Environment,
    work: &Work<'_>,
) -> Result<Report> {
    let started = Instant::now();
    let check = || {
        work.check()?;
        if started.elapsed() > Duration::from_secs(10) {
            Err("sims_limit")
        } else {
            Ok(())
        }
    };
    check()?;
    if path.len() > 4096 {
        return Err("sims_packs_folder");
    }
    let root = files::directory(Path::new(path)).map_err(|_| "sims_packs_folder")?;
    let mut valid_exe = false;
    for name in ["TS4_x64.exe", "TS4_DX9_x64.exe", "TS4_x64_fpb.exe"] {
        check()?;
        if executable(&root.join("Game/Bin").join(name), &check).is_ok() {
            valid_exe = true;
            break;
        }
    }
    check()?;
    if !valid_exe {
        return Err("sims_packs_folder");
    }
    let base = package_header(&root.join("Data/Client/ClientFullBuild0.package"), &check);
    check()?;
    base.map_err(|_| "sims_packs_folder")?;
    let before = fs::metadata(&root).map_err(|_| "sims_read")?;
    let entries = fs::read_dir(&root).map_err(|_| "sims_read")?;
    let mut partial = false;
    let mut packs = BTreeMap::<String, Pack>::new();
    for (index, entry) in entries.enumerate() {
        check()?;
        if index >= MAX_ENTRIES {
            partial = true;
            break;
        }
        let Ok(entry) = entry else {
            partial = true;
            continue;
        };
        let Some(name) = entry.file_name().to_str().and_then(code) else {
            continue;
        };
        let value = pack(&entry.path(), name.clone(), &check)?;
        if let Some(previous) = packs.get_mut(&name) {
            previous.status = Status::Unchecked;
        } else {
            packs.insert(name, value);
        }
    }
    check()?;
    if files::directory(Path::new(path))? != root
        || before.modified().ok() != fs::metadata(&root).ok().and_then(|m| m.modified().ok())
    {
        return Err("sims_changed");
    }
    let report = Report {
        path: root.to_string_lossy().into_owned(),
        packs: packs.into_values().collect(),
        partial,
        checked_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "sims_read")?
            .as_secs(),
        launch: launch::inspect(&root, custom, environment, &check)?,
    };
    Ok(report)
}

#[cfg(test)]
#[path = "sims_packs_tests.rs"]
mod tests;
