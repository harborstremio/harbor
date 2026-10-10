//! Windows resource extraction. Loading an icon never executes the selected program.
use super::{MAX_PNG_BYTES, SIDE};
use std::{os::windows::ffi::OsStrExt, path::Path};
use windows::{
    core::PCWSTR,
    Win32::{
        Graphics::Gdi::{
            CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject, GdiFlush, SelectObject,
            BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP, HDC, HGDIOBJ,
        },
        UI::{
            Shell::SHDefExtractIconW,
            WindowsAndMessaging::{DestroyIcon, DrawIconEx, DI_NORMAL, HICON},
        },
    },
};
struct Icon(HICON);
impl Drop for Icon {
    fn drop(&mut self) {
        unsafe {
            let _ = DestroyIcon(self.0);
        }
    }
}
struct Dc(HDC);
impl Drop for Dc {
    fn drop(&mut self) {
        unsafe {
            let _ = DeleteDC(self.0);
        }
    }
}
struct Bitmap(HBITMAP);
impl Drop for Bitmap {
    fn drop(&mut self) {
        unsafe {
            let _ = DeleteObject(self.0.into());
        }
    }
}
struct Canvas {
    _bitmap: Bitmap,
    dc: Dc,
    previous: HGDIOBJ,
    pixels: *mut u8,
}
impl Drop for Canvas {
    fn drop(&mut self) {
        unsafe {
            SelectObject(self.dc.0, self.previous);
        }
    }
}
impl Canvas {
    fn new() -> Option<Self> {
        let dc = Dc(unsafe { CreateCompatibleDC(None) });
        if dc.0.is_invalid() {
            return None;
        }
        let info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: SIDE as i32,
                biHeight: -(SIDE as i32),
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut pixels = std::ptr::null_mut();
        let bitmap = Bitmap(
            unsafe { CreateDIBSection(Some(dc.0), &info, DIB_RGB_COLORS, &mut pixels, None, 0) }
                .ok()?,
        );
        if pixels.is_null() {
            return None;
        }
        let previous = unsafe { SelectObject(dc.0, bitmap.0.into()) };
        if previous.is_invalid() {
            return None;
        }
        Some(Self {
            _bitmap: bitmap,
            dc,
            previous,
            pixels: pixels.cast(),
        })
    }
    fn render(&mut self, icon: HICON, background: u8) -> Option<Vec<u8>> {
        let length = (SIDE * SIDE * 4) as usize;
        unsafe {
            std::ptr::write_bytes(self.pixels, background, length);
            DrawIconEx(
                self.dc.0,
                0,
                0,
                icon,
                SIDE as i32,
                SIDE as i32,
                0,
                None,
                DI_NORMAL,
            )
            .ok()?;
            if !GdiFlush().as_bool() {
                return None;
            }
            Some(std::slice::from_raw_parts(self.pixels, length).to_vec())
        }
    }
}

fn rgba(black: &[u8], white: &[u8]) -> Vec<u8> {
    // Two backgrounds recover transparency for both alpha icons and legacy AND masks.
    black
        .chunks_exact(4)
        .zip(white.chunks_exact(4))
        .flat_map(|(black, white)| {
            let alpha = 255
                - (0..3)
                    .map(|i| white[i].saturating_sub(black[i]))
                    .max()
                    .unwrap_or(255);
            let channel = |i: usize| {
                if alpha == 0 {
                    0
                } else {
                    ((black[i] as u32 * 255 + alpha as u32 / 2) / alpha as u32).min(255) as u8
                }
            };
            [channel(2), channel(1), channel(0), alpha]
        })
        .collect()
}

fn png(icon: HICON) -> Option<Vec<u8>> {
    let mut canvas = Canvas::new()?;
    let pixels = rgba(&canvas.render(icon, 0)?, &canvas.render(icon, 255)?);
    if !pixels.chunks_exact(4).any(|pixel| pixel[3] != 0) {
        return None;
    }
    let mut output = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut output, SIDE, SIDE);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        encoder
            .write_header()
            .ok()?
            .write_image_data(&pixels)
            .ok()?;
    }
    (output.len() <= MAX_PNG_BYTES).then_some(output)
}

pub(super) fn extract(path: &Path) -> Option<Vec<u8>> {
    extract_index(path, 0)
}

pub(super) fn extract_index(path: &Path, index: i32) -> Option<Vec<u8>> {
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    if wide.len() > 8193 {
        return None;
    }
    let mut handle = HICON::default();
    // Explicit resource extraction; no association lookup, shell extension, or ShellExecute.
    let result = unsafe {
        SHDefExtractIconW(
            PCWSTR(wide.as_ptr()),
            index,
            0,
            Some(&mut handle),
            None,
            SIDE,
        )
    };
    let icon = Icon(handle);
    if result.0 != 0 || icon.0.is_invalid() {
        return None;
    }
    png(icon.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn alpha_conversion_preserves_transparent_opaque_and_translucent_pixels() {
        assert_eq!(
            rgba(
                &[0, 0, 0, 0, 10, 20, 30, 0, 25, 50, 100, 0],
                &[255, 255, 255, 0, 10, 20, 30, 0, 152, 177, 227, 0]
            ),
            [0, 0, 0, 0, 30, 20, 10, 255, 199, 100, 50, 128]
        );
    }
}
