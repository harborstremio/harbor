//! Sims4 content inspection. Nothing from a script archive is executed.
use serde::Serialize;
use std::{
    collections::BTreeSet,
    io::{Cursor, Read},
};
pub type Result<T> = std::result::Result<T, &'static str>;
pub const MAX_FILE: usize = 128 * 1024 * 1024;
pub const MAX_IMPORT: usize = 512 * 1024 * 1024;
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageInfo {
    pub resources: usize,
    pub category: &'static str,
    pub thumbnail: Option<String>,
}
pub struct Payload {
    pub name: String,
    pub bytes: Vec<u8>,
}
pub struct Import {
    pub files: Vec<Payload>,
    pub skipped: Vec<String>,
}
fn u32_at(bytes: &[u8], at: usize) -> Result<u32> {
    Ok(u32::from_le_bytes(
        bytes
            .get(at..at + 4)
            .ok_or("sims_format")?
            .try_into()
            .map_err(|_| "sims_format")?,
    ))
}
fn u64_at(bytes: &[u8], at: usize) -> Result<u64> {
    Ok(u64::from_le_bytes(
        bytes
            .get(at..at + 8)
            .ok_or("sims_format")?
            .try_into()
            .map_err(|_| "sims_format")?,
    ))
}
fn take(bytes: &[u8], at: &mut usize) -> Result<u32> {
    let value = u32_at(bytes, *at)?;
    *at += 4;
    Ok(value)
}
pub fn filename(name: &str) -> Result<()> {
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    if name.is_empty()
        || name.len() > 200
        || name.ends_with(['.', ' '])
        || name.starts_with('.')
        || name
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        || ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
        || ((stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.len() == 4
            && stem.as_bytes()[3].is_ascii_digit())
    {
        return Err("sims_path");
    }
    Ok(())
}
fn archive_path(name: &str) -> Result<()> {
    if name.is_empty()
        || name.len() > 1000
        || name.contains('\\')
        || name.split('/').any(|part| filename(part).is_err())
    {
        return Err("sims_archive");
    }
    Ok(())
}
pub fn kind(name: &str) -> &'static str {
    match name
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "package" => "package",
        "ts4script" => "script",
        "cfg" | "json" => "settings",
        _ => "other",
    }
}
pub fn inspect(bytes: &[u8], preview: bool) -> Result<PackageInfo> {
    inspect_checked(bytes, preview, &|| Ok(()))
}
pub fn inspect_checked(
    bytes: &[u8],
    preview: bool,
    check: &dyn Fn() -> Result<()>,
) -> Result<PackageInfo> {
    inspect_resources(bytes, preview, check, &mut |_, _, _, _, _| Ok(()))
}
pub(super) fn inspect_resources(
    bytes: &[u8],
    preview: bool,
    check: &dyn Fn() -> Result<()>,
    visit: &mut dyn FnMut((u32, u32, u64), usize, usize, usize, u32) -> Result<()>,
) -> Result<PackageInfo> {
    check()?;
    if bytes.len() < 96
        || bytes.len() > MAX_FILE
        || &bytes[..4] != b"DBPF"
        || u32_at(bytes, 4)? != 2
        || u32_at(bytes, 8)? != 1
    {
        return Err("sims_format");
    }
    let count = u32_at(bytes, 36)? as usize;
    let short = u32_at(bytes, 40)? as usize;
    let offset = if short > 0 {
        short
    } else {
        usize::try_from(u64_at(bytes, 64)?).map_err(|_| "sims_format")?
    };
    let size = u32_at(bytes, 44)? as usize;
    if count == 0
        || count > 200_000
        || offset < 96
        || size < 4
        || offset.checked_add(size).is_none_or(|end| end > bytes.len())
    {
        return Err("sims_format");
    }
    let index = &bytes[offset..offset + size];
    let mut at = 0;
    let flags = take(index, &mut at)?;
    if flags & !7 != 0 {
        return Err("sims_format");
    }
    let ctype = if flags & 1 != 0 {
        Some(take(index, &mut at)?)
    } else {
        None
    };
    let cgroup = if flags & 2 != 0 {
        Some(take(index, &mut at)?)
    } else {
        None
    };
    let chi = if flags & 4 != 0 {
        Some(take(index, &mut at)?)
    } else {
        None
    };
    let mut cas = false;
    let mut build = false;
    let mut tuning = false;
    let mut thumbnail = None;
    let mut thumbnail_family = None;
    let mut thumbnail_pixels = 0;
    let mut preview_budget = 16 * 1024 * 1024;
    let mut preview_attempts = 0;
    for resource_index in 0..count {
        if resource_index % 256 == 0 {
            check()?;
        }
        let resource_type = if let Some(value) = ctype {
            value
        } else {
            take(index, &mut at)?
        };
        let group = match cgroup {
            Some(value) => value,
            None => take(index, &mut at)?,
        };
        let hi = match chi {
            Some(value) => value,
            None => take(index, &mut at)?,
        };
        let instance = (u64::from(hi) << 32) | u64::from(take(index, &mut at)?);
        let position = take(index, &mut at)? as usize;
        let packed = take(index, &mut at)?;
        let length = (packed & 0x7fff_ffff) as usize;
        let expanded = take(index, &mut at)? as usize;
        let compression = if packed & 0x8000_0000 != 0 {
            let word = take(index, &mut at)?;
            word & 0xffff
        } else {
            0
        };
        if compression == 0xffe0 {
            continue;
        }
        if position < 96
            || position
                .checked_add(length)
                .is_none_or(|end| end > bytes.len())
            || expanded > MAX_IMPORT
        {
            return Err("sims_format");
        }
        cas |= resource_type == 0x034aeecb;
        build |= resource_type == 0x319e4f1d;
        tuning |= resource_type == 0x03b33ddf;
        visit(
            (resource_type, group, instance),
            position,
            length,
            expanded,
            compression,
        )?;
        // Thumbnail groups contain resolution variants. Keep the first usable
        // item's identity/frame, then prefer its highest-resolution image.
        let resolution_group =
            if matches!(resource_type, 0x3c1af1f2 | 0x3c2a8647) && group & 0xff <= 3 {
                group & 0xffff_ff00
            } else {
                group
            };
        let family = (resource_type, resolution_group, instance);
        if preview
            && thumbnail_family.is_none_or(|chosen| chosen == family)
            && matches!(resource_type, 0x3c1af1f2 | 0x3c2a8647 | 0x5b282d45)
            && length <= 8 * 1024 * 1024
            && expanded <= 8 * 1024 * 1024
            && matches!(compression, 0 | 0x5a42)
            && preview_attempts < 16
            && length.max(expanded) <= preview_budget
        {
            preview_attempts += 1;
            preview_budget -= length.max(expanded);
            let data = &bytes[position..position + length];
            let decoded = if compression == 0x5a42 {
                let mut output = Vec::new();
                flate2::read::ZlibDecoder::new(data)
                    .take(expanded as u64 + 1)
                    .read_to_end(&mut output)
                    .ok()
                    .filter(|_| output.len() == expanded)
                    .map(|_| output)
            } else if compression == 0 {
                Some(data.to_vec())
            } else {
                None
            };
            if let Some(raw) = decoded {
                if let Some(image) = thumbnail_image(&raw) {
                    let pixels = u64::from(image.width()) * u64::from(image.height());
                    if pixels > thumbnail_pixels {
                        thumbnail_pixels = pixels;
                        thumbnail_family = Some(family);
                        thumbnail = Some(image);
                    }
                }
            }
        }
    }
    if at != index.len() {
        return Err("sims_format");
    }
    Ok(PackageInfo {
        resources: count,
        category: if cas {
            "cas"
        } else if build {
            "build"
        } else if tuning {
            "gameplay"
        } else {
            "package"
        },
        thumbnail: thumbnail.and_then(thumbnail_png),
    })
}
pub(super) fn thumbnail_image(bytes: &[u8]) -> Option<image::DynamicImage> {
    let mut reader = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .ok()?;
    if !matches!(
        reader.format(),
        Some(image::ImageFormat::Png | image::ImageFormat::Jpeg)
    ) {
        return None;
    }
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(2048);
    limits.max_image_height = Some(2048);
    limits.max_alloc = Some(32 * 1024 * 1024);
    reader.limits(limits);
    reader.decode().ok()
}
pub(super) fn thumbnail_png(image: image::DynamicImage) -> Option<String> {
    use base64::Engine;
    let image = if image.width() > 320 || image.height() > 320 {
        image.thumbnail(320, 320)
    } else {
        image
    };
    let mut png = Cursor::new(Vec::new());
    image.write_to(&mut png, image::ImageFormat::Png).ok()?;
    Some(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png.into_inner())
    ))
}
// Read only bounded snippet resources; texture/thumbnail decoding is not needed.
pub fn snippets_checked(
    bytes: &[u8],
    check: &dyn Fn() -> Result<()>,
) -> Result<(Vec<Vec<u8>>, bool)> {
    let mut snippets = Vec::new();
    let mut partial = false;
    let mut attempts = 0;
    let mut budget = 4 * 1024 * 1024;
    inspect_resources(
        bytes,
        false,
        check,
        &mut |(kind, _, _), position, length, expanded, compression| {
            if kind != 0x7df2169c {
                return Ok(());
            }
            attempts += 1;
            if attempts > 64
                || length.max(expanded) > super::sims_manifest::MAX_TEXT
                || length.max(expanded) > budget
                || !matches!(compression, 0 | 0x5a42)
            {
                partial = true;
                return Ok(());
            }
            budget -= length.max(expanded);
            let raw = &bytes[position..position + length];
            let mut output = Vec::new();
            if compression == 0 {
                output.extend_from_slice(raw);
            } else {
                if let Err(error) = copy_checked(
                    &mut flate2::read::ZlibDecoder::new(raw).take(expanded as u64 + 1),
                    &mut output,
                    "sims_manifest",
                    check,
                ) {
                    if error == "sims_canceled" {
                        return Err(error);
                    }
                    partial = true;
                    return Ok(());
                }
            }
            if output.len() != expanded {
                partial = true;
            } else {
                snippets.push(output);
            }
            Ok(())
        },
    )?;
    Ok((snippets, partial))
}
#[cfg(test)]
pub fn validate_script(bytes: &[u8]) -> Result<()> {
    validate_script_checked(bytes, &|| Ok(()))
}
pub fn validate_script_checked(bytes: &[u8], check: &dyn Fn() -> Result<()>) -> Result<()> {
    check()?;
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|_| "sims_script")?;
    if archive.len() > 5000 {
        return Err("sims_limit");
    }
    let mut code = false;
    let mut total = 0u64;
    let mut names = BTreeSet::new();
    for i in 0..archive.len() {
        check()?;
        let mut file = archive.by_index(i).map_err(|_| "sims_script")?;
        archive_path(file.name().trim_end_matches('/'))?;
        if file.unix_mode().is_some_and(|v| v & 0o170000 == 0o120000) || file.encrypted() {
            return Err("sims_archive");
        }
        if !names.insert(file.name().to_ascii_lowercase()) {
            return Err("sims_archive");
        }
        if file.is_dir() {
            continue;
        }
        total = total.checked_add(file.size()).ok_or("sims_limit")?;
        if total > MAX_IMPORT as u64 || file.size() > MAX_FILE as u64 {
            return Err("sims_limit");
        }
        let ext = file
            .name()
            .rsplit('.')
            .next()
            .unwrap_or("")
            .to_ascii_lowercase();
        // LlamaLogic manifests are inert metadata inside the original script ZIP.
        // Accept the known filename without parsing YAML or trusting its claims.
        let manifest = file
            .name()
            .rsplit('/')
            .next()
            .is_some_and(|name| name.eq_ignore_ascii_case("llamalogic.modfilemanifest.yml"));
        if manifest && file.size() > 1024 * 1024 {
            return Err("sims_limit");
        }
        if !["py", "pyc", "txt", "json"].contains(&ext.as_str()) && !manifest {
            return Err("sims_script");
        }
        code |= ext == "py" || ext == "pyc";
        let expected = file.size();
        let read = copy_checked(
            &mut file.by_ref().take(expected + 1),
            &mut std::io::sink(),
            "sims_script",
            check,
        )?;
        if read != expected {
            return Err("sims_script");
        }
    }
    if !code {
        return Err("sims_script");
    }
    Ok(())
}
pub fn validate_payload_checked(
    name: &str,
    bytes: &[u8],
    check: &dyn Fn() -> Result<()>,
) -> Result<()> {
    check()?;
    filename(name)?;
    if bytes.len() > MAX_FILE {
        return Err("sims_limit");
    }
    match kind(name) {
        "package" => {
            inspect_checked(bytes, false, check)?;
        }
        "script" => validate_script_checked(bytes, check)?,
        "settings" => {
            if bytes.len() > 1024 * 1024 || std::str::from_utf8(bytes).is_err() {
                return Err("sims_format");
            }
        }
        _ => return Err("sims_format"),
    }
    Ok(())
}
#[cfg(test)]
pub fn unpack_zip(bytes: &[u8]) -> Result<Import> {
    unpack_zip_checked(bytes, &|| Ok(()))
}
pub fn unpack_zip_checked(bytes: &[u8], check: &dyn Fn() -> Result<()>) -> Result<Import> {
    check()?;
    if bytes.len() > MAX_IMPORT {
        return Err("sims_limit");
    }
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|_| "sims_archive")?;
    if archive.len() > 2000 {
        return Err("sims_limit");
    }
    let mut result = Import {
        files: Vec::new(),
        skipped: Vec::new(),
    };
    let mut directories = BTreeSet::new();
    let mut names = BTreeSet::new();
    let mut total = 0;
    for i in 0..archive.len() {
        check()?;
        let mut file = archive.by_index(i).map_err(|_| "sims_archive")?;
        archive_path(file.name().trim_end_matches('/'))?;
        if file.unix_mode().is_some_and(|v| v & 0o170000 == 0o120000) || file.encrypted() {
            return Err("sims_archive");
        }
        if file.is_dir() {
            continue;
        }
        let path = file.name().to_owned();
        let (directory, name) = path.rsplit_once('/').unwrap_or(("", path.as_str()));
        let extension = name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
        if ["txt", "md", "pdf", "png", "jpg", "jpeg"].contains(&extension.as_str()) {
            result.skipped.push(path);
            continue;
        }
        if kind(name) == "other" {
            return Err("sims_archive_content");
        }
        directories.insert(directory.to_owned());
        if directories.len() > 1 {
            return Err("sims_archive_layout");
        }
        if !names.insert(name.to_ascii_lowercase()) {
            return Err("sims_archive_layout");
        }
        if file.size() > MAX_FILE as u64 {
            return Err("sims_limit");
        }
        total += file.size() as usize;
        if total > MAX_IMPORT {
            return Err("sims_limit");
        }
        let mut bytes = Vec::new();
        let size = file.size();
        copy_checked(
            &mut file.by_ref().take(size + 1),
            &mut bytes,
            "sims_archive",
            check,
        )?;
        if bytes.len() as u64 != size {
            return Err("sims_archive");
        }
        validate_payload_checked(name, &bytes, check)?;
        result.files.push(Payload {
            name: name.to_owned(),
            bytes,
        });
    }
    if !result
        .files
        .iter()
        .any(|f| matches!(kind(&f.name), "package" | "script"))
    {
        return Err("sims_archive_content");
    }
    Ok(result)
}

// Cooperative reads bound the work between cancellation checks, including ZIP inflation.
pub fn copy_checked(
    reader: &mut impl std::io::Read,
    writer: &mut impl std::io::Write,
    error: &'static str,
    check: &dyn Fn() -> Result<()>,
) -> Result<u64> {
    let mut buffer = vec![0; 256 * 1024];
    let mut total = 0;
    loop {
        check()?;
        let count = match reader.read(&mut buffer) {
            Ok(count) => count,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(_) => return Err(error),
        };
        check()?;
        if count == 0 {
            return Ok(total);
        }
        writer.write_all(&buffer[..count]).map_err(|_| error)?;
        total += count as u64;
    }
}
