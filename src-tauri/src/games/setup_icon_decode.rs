//! Small, bounded icon decoders shared by every host. No image is executed or opened in a shell.
use image::{DynamicImage, ImageFormat, ImageReader, RgbaImage};
use std::io::Cursor;

pub(super) const MAX_ASSET_BYTES: usize = 8 * 1024 * 1024;
const MAX_SIDE: u32 = 1024;

pub(super) fn u16le(bytes: &[u8], offset: usize) -> Option<u16> {
    Some(u16::from_le_bytes(
        bytes.get(offset..offset.checked_add(2)?)?.try_into().ok()?,
    ))
}
pub(super) fn u32le(bytes: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_le_bytes(
        bytes.get(offset..offset.checked_add(4)?)?.try_into().ok()?,
    ))
}

fn raster(bytes: &[u8]) -> Option<RgbaImage> {
    if bytes.len() > MAX_ASSET_BYTES {
        return None;
    }
    let format = image::guess_format(bytes).ok()?;
    // Explicitly avoid formats with external resources and animated frame traversal.
    if !matches!(
        format,
        ImageFormat::Png | ImageFormat::Jpeg | ImageFormat::WebP
    ) {
        return None;
    }
    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(MAX_SIDE);
    limits.max_image_height = Some(MAX_SIDE);
    limits.max_alloc = Some(16 * 1024 * 1024);
    reader.limits(limits);
    Some(reader.decode().ok()?.into_rgba8())
}

/// An RT_ICON payload is either PNG or a DIB with a doubled height for its AND mask.
pub(super) fn frame(bytes: &[u8]) -> Option<RgbaImage> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return raster(bytes);
    }
    if bytes.len() > MAX_ASSET_BYTES {
        return None;
    }
    let header = u32le(bytes, 0)? as usize;
    if !(40..=124).contains(&header) {
        return None;
    }
    let width = i32::from_le_bytes(bytes.get(4..8)?.try_into().ok()?);
    let raw_height = i32::from_le_bytes(bytes.get(8..12)?.try_into().ok()?);
    let height = raw_height.checked_abs()? / 2;
    if width <= 0
        || height <= 0
        || raw_height % 2 != 0
        || width > MAX_SIDE as i32
        || height > MAX_SIDE as i32
    {
        return None;
    }
    let bits = u16le(bytes, 14)? as usize;
    if u16le(bytes, 12)? != 1 || ![1, 4, 8, 24, 32].contains(&bits) || u32le(bytes, 16)? != 0 {
        return None;
    }
    let colors = u32le(bytes, 32)? as usize;
    let palette = if bits <= 8 {
        if colors > 1 << bits {
            return None;
        }
        if colors == 0 {
            1 << bits
        } else {
            colors
        }
    } else {
        0
    };
    let start = header.checked_add(palette.checked_mul(4)?)?;
    let width = width as usize;
    let height = height as usize;
    let stride = (width * bits).div_ceil(32) * 4;
    let pixels = bytes.get(start..start.checked_add(stride.checked_mul(height)?)?)?;
    let mask_stride = width.div_ceil(32) * 4;
    let mask = bytes.get(start + pixels.len()..start + pixels.len() + mask_stride * height);
    let has_alpha = bits == 32 && pixels.chunks_exact(4).any(|pixel| pixel[3] != 0);
    if !has_alpha && mask.is_none() {
        return None;
    }
    let mut output = Vec::with_capacity(width * height * 4);
    for y in 0..height {
        let row = if raw_height > 0 { height - y - 1 } else { y };
        for x in 0..width {
            let (red, green, blue, mut alpha) = if bits >= 24 {
                let pixel = pixels.get(row * stride + x * (bits / 8)..)?;
                (
                    pixel[2],
                    pixel[1],
                    pixel[0],
                    if has_alpha { pixel[3] } else { 255 },
                )
            } else {
                let position = row * stride + x * bits / 8;
                let index = ((pixels[position] >> (8 - bits - (x * bits % 8)))
                    & ((1u16 << bits) - 1) as u8) as usize;
                if index >= palette {
                    return None;
                }
                let pixel = bytes.get(header + index * 4..header + index * 4 + 4)?;
                (pixel[2], pixel[1], pixel[0], 255)
            };
            if mask.is_some_and(|mask| mask[row * mask_stride + x / 8] & (0x80 >> (x % 8)) != 0) {
                alpha = 0;
            }
            output.extend_from_slice(&[red, green, blue, alpha]);
        }
    }
    RgbaImage::from_raw(width as u32, height as u32, output)
}

fn score(side: u32) -> (bool, u32) {
    (side < super::SIDE, side.abs_diff(super::SIDE))
}

fn ico(bytes: &[u8]) -> Option<RgbaImage> {
    if u16le(bytes, 0)? != 0 || u16le(bytes, 2)? != 1 {
        return None;
    }
    let count = u16le(bytes, 4)? as usize;
    if count == 0 || count > 64 {
        return None;
    }
    let mut entries = Vec::new();
    for index in 0..count {
        let offset = 6 + index * 16;
        let side = match *bytes.get(offset)? {
            0 => 256,
            value => value as u32,
        };
        let length = u32le(bytes, offset + 8)? as usize;
        let start = u32le(bytes, offset + 12)? as usize;
        if start < 6 + count * 16 || length > MAX_ASSET_BYTES {
            return None;
        }
        entries.push((score(side), bytes.get(start..start.checked_add(length)?)?));
    }
    entries.sort_by_key(|(score, _)| *score);
    entries.into_iter().find_map(|(_, data)| frame(data))
}

fn icns(bytes: &[u8]) -> Option<RgbaImage> {
    let length = u32::from_be_bytes(bytes.get(4..8)?.try_into().ok()?) as usize;
    if length != bytes.len() {
        return None;
    }
    let mut offset = 8;
    let mut entries = Vec::new();
    let mut chunks = 0;
    while offset < length && chunks < 64 {
        chunks += 1;
        let kind = bytes.get(offset..offset + 4)?;
        let size = u32::from_be_bytes(bytes.get(offset + 4..offset + 8)?.try_into().ok()?) as usize;
        if size < 8 {
            return None;
        }
        let data = bytes.get(offset + 8..offset.checked_add(size)?)?;
        let side = match kind {
            b"icp4" => 16,
            b"icp5" => 32,
            b"icp6" => 64,
            b"ic07" | b"ic13" => 128,
            b"ic08" | b"ic14" => 256,
            b"ic09" => 512,
            b"ic10" => 1024,
            b"ic11" => 32,
            b"ic12" => 64,
            _ => 0,
        };
        if side > 0 {
            entries.push((score(side), data));
        }
        offset += size;
    }
    if offset != length {
        return None;
    }
    entries.sort_by_key(|(score, _)| *score);
    // Modern ICNS embeds PNG. Legacy/JPEG2000 variants use ImageIO on macOS.
    entries.into_iter().find_map(|(_, data)| raster(data))
}

pub(super) fn asset(bytes: &[u8]) -> Option<RgbaImage> {
    if bytes.len() > MAX_ASSET_BYTES {
        return None;
    }
    if bytes.starts_with(b"icns") {
        icns(bytes)
    } else if bytes.starts_with(&[0, 0, 1, 0]) {
        ico(bytes)
    } else {
        raster(bytes)
    }
}

pub(super) fn encode(image: RgbaImage) -> Option<Vec<u8>> {
    if image.width() == 0 || image.height() == 0 || !image.pixels().any(|pixel| pixel[3] > 0) {
        return None;
    }
    let resized = DynamicImage::ImageRgba8(image)
        .thumbnail(super::SIDE, super::SIDE)
        .into_rgba8();
    let mut canvas = RgbaImage::new(super::SIDE, super::SIDE);
    let x = (super::SIDE - resized.width()) / 2;
    let y = (super::SIDE - resized.height()) / 2;
    image::imageops::overlay(&mut canvas, &resized, x as i64, y as i64);
    let mut output = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut output, super::SIDE, super::SIDE);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        encoder
            .write_header()
            .ok()?
            .write_image_data(canvas.as_raw())
            .ok()?;
    }
    (output.len() <= super::MAX_PNG_BYTES).then_some(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dib_alpha_and_legacy_mask_are_preserved() {
        let mut bytes = vec![0u8; 48];
        bytes[0..4].copy_from_slice(&40u32.to_le_bytes());
        bytes[4..8].copy_from_slice(&1u32.to_le_bytes());
        bytes[8..12].copy_from_slice(&2u32.to_le_bytes());
        bytes[12..14].copy_from_slice(&1u16.to_le_bytes());
        bytes[14..16].copy_from_slice(&32u16.to_le_bytes());
        bytes[40..44].copy_from_slice(&[30, 20, 10, 128]);
        assert_eq!(frame(&bytes).unwrap().as_raw(), &[10, 20, 30, 128]);
        bytes[43] = 0;
        assert_eq!(frame(&bytes).unwrap().as_raw(), &[10, 20, 30, 255]);
        bytes[44] = 0x80;
        assert_eq!(frame(&bytes).unwrap().as_raw(), &[10, 20, 30, 0]);
        assert!(frame(&bytes[..44]).is_none());
    }
    #[test]
    fn bounded_png_ico_and_modern_icns_decode_without_platform_apis() {
        let png = encode(RgbaImage::from_pixel(
            32,
            32,
            image::Rgba([20, 40, 60, 255]),
        ))
        .unwrap();
        let mut icon = vec![0, 0, 1, 0, 1, 0, 96, 96, 0, 0, 1, 0, 32, 0];
        icon.extend_from_slice(&(png.len() as u32).to_le_bytes());
        icon.extend_from_slice(&22u32.to_le_bytes());
        icon.extend_from_slice(&png);
        assert_eq!(asset(&icon).unwrap().dimensions(), (96, 96));
        let mut mac = b"icns".to_vec();
        mac.extend_from_slice(&(16 + png.len() as u32).to_be_bytes());
        mac.extend_from_slice(b"ic07");
        mac.extend_from_slice(&(8 + png.len() as u32).to_be_bytes());
        mac.extend_from_slice(&png);
        assert_eq!(asset(&mac).unwrap().dimensions(), (96, 96));
        mac[12..16].copy_from_slice(&u32::MAX.to_be_bytes());
        assert!(asset(&mac).is_none());
        icon[18..22].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(asset(&icon).is_none());
        assert!(asset(&[0u8; 5]).is_none());
    }
}
