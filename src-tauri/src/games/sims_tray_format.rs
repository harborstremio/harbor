//! Tray exports are related sets of flat library files, not Mods packages.
use super::{files, package};
use package::{Import, Payload, Result};
use std::{
    collections::{BTreeMap, BTreeSet},
    io::{Cursor, Read},
    path::Path,
};
#[path = "sims_tray_metadata.rs"]
mod metadata;

pub fn extension(name: &str) -> &str {
    name.rsplit('.').next().unwrap_or("")
}
pub fn is_tray(name: &str) -> bool {
    matches!(
        extension(&name.to_ascii_lowercase()),
        "trayitem" | "blueprint" | "bpi" | "householdbinary" | "hhi" | "sgi" | "room" | "rmi"
    )
}
pub fn identity(name: &str) -> Result<String> {
    package::filename(name)?;
    if !is_tray(name) {
        return Err("sims_tray_format");
    }
    let stem = name
        .rsplit_once('.')
        .ok_or("sims_tray_format")?
        .0
        .to_ascii_lowercase();
    let (group, instance) = stem.split_once('!').ok_or("sims_tray_format")?;
    if group.len() != 10
        || instance.len() != 18
        || !group.starts_with("0x")
        || !instance.starts_with("0x")
        || !group[2..].bytes().all(|b| b.is_ascii_hexdigit())
        || !instance[2..].bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err("sims_tray_format");
    }
    Ok(instance.into())
}
pub fn validate_file(name: &str, bytes: &[u8]) -> Result<()> {
    identity(name)?;
    // This is an export-set check, not a claim to validate every game payload.
    if bytes.len() < 8
        || bytes.len() > package::MAX_FILE
        || bytes.starts_with(b"MZ")
        || bytes.starts_with(b"\x7fELF")
        || bytes.starts_with(b"PK\x03\x04")
    {
        return Err("sims_tray_format");
    }
    Ok(())
}
pub fn category(names: &[String]) -> Result<&'static str> {
    let mut items: BTreeMap<String, BTreeMap<String, usize>> = BTreeMap::new();
    let mut portraits = 0;
    for name in names {
        let id = identity(name)?;
        if extension(&name.to_ascii_lowercase()) == "sgi" {
            portraits += 1;
            continue;
        }
        *items
            .entry(id)
            .or_default()
            .entry(extension(&name.to_ascii_lowercase()).into())
            .or_default() += 1;
    }
    // Each review represents one creation; unrelated exports need separate names.
    if items.len() != 1 {
        return Err("sims_tray_set");
    }
    let (_, kinds) = items.into_iter().next().ok_or("sims_tray_set")?;
    let count = |key: &str| kinds.get(key).copied().unwrap_or(0);
    if count("trayitem") != 1 {
        return Err("sims_tray_set");
    }
    if count("blueprint") == 1 && count("bpi") >= 1 && kinds.len() == 3 && portraits == 0 {
        Ok("lot")
    } else if count("householdbinary") == 1
        && count("hhi") >= 2
        && kinds.len() == 3
        && portraits <= 256
    {
        Ok("household")
    } else if count("room") == 1 && count("rmi") >= 1 && kinds.len() == 3 && portraits == 0 {
        Ok("room")
    } else {
        Err("sims_tray_set")
    }
}
#[cfg(test)]
pub fn read_sources(sources: &[String]) -> Result<Import> {
    read_sources_checked(sources, &|| Ok(()))
}
pub fn read_sources_checked(sources: &[String], check: &dyn Fn() -> Result<()>) -> Result<Import> {
    check()?;
    if sources.is_empty() || sources.len() > 500 {
        return Err("sims_request");
    }
    read_inputs(
        sources.iter().map(|source| {
            if source.len() > 4096 {
                return Err("sims_path");
            }
            let path = Path::new(source);
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or("sims_path")?
                .to_owned();
            Ok((name, files::read_checked(path, package::MAX_IMPORT, check)?))
        }),
        check,
    )
}
/// Only chooses the validator; every member is still checked before review.
pub fn contains_tray(bytes: &[u8], check: &dyn Fn() -> Result<()>) -> Result<bool> {
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|_| "sims_archive")?;
    if zip.len() > 2000 {
        return Err("sims_limit");
    }
    for i in 0..zip.len() {
        check()?;
        let entry = zip.by_index(i).map_err(|_| "sims_archive")?;
        if !entry.is_dir() && is_tray(entry.name()) {
            return Ok(true);
        }
    }
    Ok(false)
}
pub fn unpack_zip_checked(bytes: Vec<u8>, check: &dyn Fn() -> Result<()>) -> Result<Import> {
    if bytes.len() > package::MAX_IMPORT {
        return Err("sims_limit");
    }
    read_inputs(std::iter::once(Ok(("creator.zip".into(), bytes))), check)
}
fn read_inputs(
    inputs: impl Iterator<Item = Result<(String, Vec<u8>)>>,
    check: &dyn Fn() -> Result<()>,
) -> Result<Import> {
    let mut result = Import {
        files: vec![],
        skipped: vec![],
    };
    let mut total = 0usize;
    let mut names = BTreeSet::new();
    let mut add = |name: String, bytes: Vec<u8>| -> Result<()> {
        if !names.insert(name.to_ascii_lowercase()) {
            return Err("sims_archive_layout");
        }
        total = total.checked_add(bytes.len()).ok_or("sims_limit")?;
        if total > package::MAX_IMPORT || names.len() > 500 {
            return Err("sims_limit");
        }
        if is_tray(&name) {
            validate_file(&name, &bytes)?;
        } else {
            package::validate_payload_checked(&name, &bytes, check)?;
        }
        result.files.push(Payload { name, bytes });
        Ok(())
    };
    for input in inputs {
        check()?;
        let (name, bytes) = input?;
        if !name.to_ascii_lowercase().ends_with(".zip") {
            add(name, bytes)?;
            continue;
        }
        let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|_| "sims_archive")?;
        if zip.len() > 2000 {
            return Err("sims_limit");
        }
        for i in 0..zip.len() {
            check()?;
            let mut entry = zip.by_index(i).map_err(|_| "sims_archive")?;
            let relative = entry.name().trim_end_matches('/');
            if relative.is_empty()
                || relative.len() > 1000
                || relative.contains('\\')
                || relative.split('/').any(|p| package::filename(p).is_err())
                || entry.encrypted()
                || entry
                    .unix_mode()
                    .is_some_and(|mode| mode & 0o170000 == 0o120000)
            {
                return Err("sims_archive");
            }
            if entry.is_dir() {
                continue;
            }
            let name = relative
                .rsplit('/')
                .next()
                .ok_or("sims_archive")?
                .to_owned();
            if matches!(
                extension(&name.to_ascii_lowercase()),
                "txt" | "md" | "pdf" | "png" | "jpg" | "jpeg"
            ) {
                result.skipped.push(relative.into());
                continue;
            }
            if entry.size() > package::MAX_FILE as u64 {
                return Err("sims_limit");
            }
            let expected = entry.size();
            let mut content = Vec::new();
            package::copy_checked(
                &mut entry.by_ref().take(expected + 1),
                &mut content,
                "sims_archive",
                check,
            )?;
            if content.len() as u64 != expected {
                return Err("sims_archive");
            }
            add(name, content)?;
        }
    }
    let category = category(
        &result
            .files
            .iter()
            .filter(|f| is_tray(&f.name))
            .map(|f| f.name.clone())
            .collect::<Vec<_>>(),
    )?;
    if category == "household" {
        metadata::validate_household(&result.files)?;
    }
    if result.files.iter().any(|f| !is_tray(&f.name))
        && !result
            .files
            .iter()
            .any(|f| matches!(package::kind(&f.name), "package" | "script"))
    {
        return Err("sims_archive_content");
    }
    Ok(result)
}
