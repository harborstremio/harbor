//! Read only the recorded creation's cover. Never substitute an unrelated image.
use super::*;
use std::borrow::Cow;

const MAX_IMAGE: usize = 8 * 1024 * 1024;

pub fn preview(path: &str, id: &str) -> Result<Option<String>> {
    uuid(id)?;
    let folder = files::validate(path)?;
    let root = Path::new(&folder.path);
    let library = read_library(root)?;
    let item = library
        .items
        .iter()
        .find(|item| item.id == id)
        .ok_or("sims_missing")?;
    let base = if item.installed {
        tray_path(root)?
    } else {
        root.join(STORE).join("tray-vault").join(id)
    };
    cover(item, |stamp| {
        files::read(&base.join(&stamp.name), MAX_IMAGE)
    })
}

// The review uses its held bytes, never a second read of the selected download.
pub fn payload_preview(item: &Item, payload: &[package::Payload]) -> Result<Option<String>> {
    cover(item, |stamp| {
        payload
            .iter()
            .find(|file| file.name == stamp.name && file.bytes.len() <= MAX_IMAGE)
            .map(|file| file.bytes.clone())
            .ok_or("sims_changed")
    })
}

fn cover(
    item: &Item,
    mut read: impl FnMut(&files::Stamp) -> Result<Vec<u8>>,
) -> Result<Option<String>> {
    let ext = match item.category.as_str() {
        "lot" => "bpi",
        "room" => "rmi",
        "household" => "hhi",
        _ => return Ok(None),
    };
    let instance = item
        .files
        .iter()
        .find(|f| f.name.to_ascii_lowercase().ends_with(".trayitem"))
        .ok_or("sims_record")
        .and_then(|f| format::identity(&f.name))?;
    // Group 3 is the large cover; group 2 is the same view at thumbnail size.
    // Floor-plan and individual-Sim pictures must not take its place.
    for group in [3, 2] {
        let mut candidates = item.files.iter().filter(|f| {
            let name = f.name.to_ascii_lowercase();
            let Some(group_hex) = name.get(2..10) else {
                return false;
            };
            let Ok(value) = u32::from_str_radix(group_hex, 16) else {
                return false;
            };
            name.ends_with(&format!("!{instance}.{ext}"))
                && if ext == "hhi" {
                    value & 0xff == group
                } else {
                    value == group
                }
        });
        let Some(stamp) = candidates.next() else {
            continue;
        };
        // A household's high group bits can version its portrait. If more than
        // one cover is present, avoid choosing a different pose arbitrarily.
        if candidates.next().is_some() {
            return Ok(None);
        }
        if stamp.bytes > MAX_IMAGE as u64 {
            continue;
        }
        let bytes = read(stamp)?;
        if files::stamp(stamp.name.clone(), &bytes) != *stamp {
            return Err("sims_changed");
        }
        if let Some(image) = decode(&bytes).and_then(package::thumbnail_png) {
            return Ok(Some(image));
        }
    }
    Ok(None)
}

pub(crate) fn decode(bytes: &[u8]) -> Option<image::DynamicImage> {
    if bytes.len() > MAX_IMAGE {
        return None;
    }
    let payload = if bytes.starts_with(b"\xff\xd8\xff") || bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Cow::Borrowed(bytes)
    } else {
        // Observed classic wrappers use the same repeating mask. Version 1 has
        // a 32-bit payload length followed by four opaque bytes; version 2 uses
        // a 64-bit length. Do not require the old padding to be zero or relax v2.
        // Format observations and fixture hashes: docs/games/SIMS-TRAY-IMAGES.md.
        let header = bytes.get(..24)?;
        let version = u64::from_le_bytes(header[16..24].try_into().ok()?);
        let length = match version {
            1 => u64::from(u32::from_le_bytes(header[..4].try_into().ok()?)),
            2 => u64::from_le_bytes(header[..8].try_into().ok()?),
            _ => return None,
        };
        if length != (bytes.len() - 24) as u64
            || header[8..16] != [0x8e, 0xfc, 0x24, 0x48, 0x9b, 0x78, 0x0e, 0x3c]
        {
            return None;
        }
        const MASK: [u8; 8] = [0x41, 0x25, 0xe6, 0xcd, 0x47, 0xba, 0xb2, 0x1a];
        Cow::Owned(
            bytes[24..]
                .iter()
                .enumerate()
                .map(|(i, byte)| byte ^ MASK[i % 8])
                .collect::<Vec<_>>(),
        )
    };
    let color = package::thumbnail_image(&payload)?;
    if !payload.starts_with(b"\xff\xd8") {
        return Some(color);
    }
    // Sims JPEGs can carry an ALFA PNG in an APP0 segment. Honor the mask rather
    // than rendering black rectangles around transparent household portraits.
    let mut offset = 2usize;
    let mut alpha = None;
    while offset < payload.len() {
        if *payload.get(offset)? != 0xff {
            return None;
        }
        while *payload.get(offset)? == 0xff {
            offset += 1;
        }
        let marker = *payload.get(offset)?;
        offset += 1;
        if matches!(marker, 0xda | 0xd9) {
            break;
        }
        if matches!(marker, 0x01 | 0xd0..=0xd7) {
            continue;
        }
        let length = u16::from_be_bytes(payload.get(offset..offset + 2)?.try_into().ok()?) as usize;
        if length < 2 {
            return None;
        }
        let segment = payload.get(offset + 2..offset.checked_add(length)?)?;
        if marker == 0xe0 && segment.starts_with(b"ALFA") {
            if alpha.is_some() {
                return None;
            }
            let size = u32::from_be_bytes(segment.get(4..8)?.try_into().ok()?) as usize;
            let mask = segment.get(8..)?;
            if size != mask.len() || !mask.starts_with(b"\x89PNG\r\n\x1a\n") {
                return None;
            }
            let image = package::thumbnail_image(mask)?;
            if image.width() != color.width() || image.height() != color.height() {
                return None;
            }
            alpha = Some(image.to_luma8());
        }
        offset += length;
    }
    match alpha {
        None => Some(color),
        Some(alpha) => {
            let mut rgba = color.to_rgba8();
            for (pixel, opacity) in rgba.pixels_mut().zip(alpha.pixels()) {
                pixel[3] = opacity[0];
            }
            Some(image::DynamicImage::ImageRgba8(rgba))
        }
    }
}
