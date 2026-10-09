//! Read PE RT_GROUP_ICON/RT_ICON resources on any host, without loading code.
use super::decode::{self, u16le, u32le, MAX_ASSET_BYTES};
use image::RgbaImage;
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
};

struct Section {
    rva: u64,
    offset: u64,
    bytes: u64,
}
struct Resources<'a> {
    file: &'a mut File,
    length: u64,
    sections: Vec<Section>,
    root: u64,
    directory_bytes: u64,
    remaining: usize,
}
impl Resources<'_> {
    fn read(&mut self, offset: u64, bytes: usize) -> Option<Vec<u8>> {
        if bytes > self.remaining || offset.checked_add(bytes as u64)? > self.length {
            return None;
        }
        self.remaining -= bytes;
        let mut output = vec![0; bytes];
        self.file.seek(SeekFrom::Start(offset)).ok()?;
        self.file.read_exact(&mut output).ok()?;
        Some(output)
    }
    fn rva(&self, rva: u64, size: u64) -> Option<u64> {
        self.sections.iter().find_map(|section| {
            let relative = rva.checked_sub(section.rva)?;
            if relative.checked_add(size)? > section.bytes {
                return None;
            }
            section.offset.checked_add(relative)
        })
    }
    fn relative(&mut self, offset: u32, bytes: usize) -> Option<Vec<u8>> {
        if (offset as u64).checked_add(bytes as u64)? > self.directory_bytes {
            return None;
        }
        let absolute = self.rva(self.root.checked_add(offset as u64)?, bytes as u64)?;
        self.read(absolute, bytes)
    }
    fn directory(&mut self, relative: u32) -> Option<Vec<(u32, u32)>> {
        let header = self.relative(relative, 16)?;
        let count = u16le(&header, 12)? as usize + u16le(&header, 14)? as usize;
        if count > 256 {
            return None;
        }
        let entries = self.relative(relative.checked_add(16)?, count.checked_mul(8)?)?;
        (0..count)
            .map(|i| Some((u32le(&entries, i * 8)?, u32le(&entries, i * 8 + 4)?)))
            .collect()
    }
    fn resource(&mut self, kind: u32, name: Option<u32>) -> Option<Vec<u8>> {
        let (_, type_directory) = self.directory(0)?.into_iter().find(|(id, _)| *id == kind)?;
        if type_directory & 0x80000000 == 0 {
            return None;
        }
        let names = self.directory(type_directory & 0x7fffffff)?;
        let (_, language_directory) = names
            .into_iter()
            .find(|(id, _)| name.is_none_or(|name| *id == name))?;
        if language_directory & 0x80000000 == 0 {
            return None;
        }
        let (_, leaf) = self
            .directory(language_directory & 0x7fffffff)?
            .into_iter()
            .next()?;
        if leaf & 0x80000000 != 0 {
            return None;
        }
        let entry = self.relative(leaf, 16)?;
        let bytes = u32le(&entry, 4)? as usize;
        if bytes == 0 || bytes > MAX_ASSET_BYTES {
            return None;
        }
        let absolute = self.rva(u32le(&entry, 0)? as u64, bytes as u64)?;
        self.read(absolute, bytes)
    }
}

pub(super) fn extract(file: &mut File) -> Option<RgbaImage> {
    let length = file.metadata().ok()?.len();
    let mut resources = Resources {
        file,
        length,
        sections: Vec::new(),
        root: 0,
        directory_bytes: 0,
        remaining: MAX_ASSET_BYTES + 64 * 1024,
    };
    let dos = resources.read(0, 64)?;
    if dos.get(..2)? != b"MZ" {
        return None;
    }
    let pe = u32le(&dos, 60)? as u64;
    if !(64..=1024 * 1024).contains(&pe) {
        return None;
    }
    let coff = resources.read(pe, 24)?;
    if coff.get(..4)? != b"PE\0\0" {
        return None;
    }
    let count = u16le(&coff, 6)? as usize;
    let optional_length = u16le(&coff, 20)? as usize;
    if count == 0 || count > 96 || !(96..=4096).contains(&optional_length) {
        return None;
    }
    let optional = resources.read(pe + 24, optional_length)?;
    let directories = match u16le(&optional, 0)? {
        0x10b => 96,
        0x20b => 112,
        _ => return None,
    };
    if u32le(&optional, directories - 4)? < 3 {
        return None;
    }
    resources.root = u32le(&optional, directories + 16)? as u64;
    resources.directory_bytes = u32le(&optional, directories + 20)? as u64;
    if resources.root == 0 || resources.directory_bytes < 16 {
        return None;
    }
    let sections = resources.read(pe + 24 + optional_length as u64, count * 40)?;
    for index in 0..count {
        let section = &sections[index * 40..index * 40 + 40];
        let rva = u32le(section, 12)? as u64;
        let bytes = u32le(section, 16)? as u64;
        let offset = u32le(section, 20)? as u64;
        if offset.checked_add(bytes)? > length {
            return None;
        }
        resources.sections.push(Section { rva, offset, bytes });
    }
    let group = resources.resource(14, None)?;
    if u16le(&group, 0)? != 0 || u16le(&group, 2)? != 1 {
        return None;
    }
    let count = u16le(&group, 4)? as usize;
    if count == 0 || count > 64 || group.len() < 6 + count * 14 {
        return None;
    }
    let mut icons = Vec::new();
    for index in 0..count {
        let entry = &group[6 + index * 14..6 + (index + 1) * 14];
        let side = match entry[0] {
            0 => 256,
            value => value as u32,
        };
        let bits = u16le(entry, 6)?;
        icons.push((
            (
                side < super::SIDE,
                side.abs_diff(super::SIDE),
                u16::MAX - bits,
            ),
            u16le(entry, 12)? as u32,
        ));
    }
    icons.sort_by_key(|(score, _)| *score);
    for (_, id) in icons {
        if let Some(frame) = resources
            .resource(3, Some(id))
            .and_then(|bytes| decode::frame(&bytes))
        {
            return Some(frame);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, path::PathBuf};
    fn fixture(png: &[u8]) -> Vec<u8> {
        let mut rsrc = vec![0u8; 180 + png.len()];
        for (directory, count) in [(0, 2), (32, 1), (56, 1), (80, 1), (104, 1)] {
            rsrc[directory + 14..directory + 16].copy_from_slice(&(count as u16).to_le_bytes());
        }
        for (offset, id, target) in [
            (16, 3u32, 0x80000020u32),
            (24, 14, 0x80000050),
            (48, 1, 0x80000038),
            (72, 1033, 128),
            (96, 1, 0x80000068),
            (120, 1033, 144),
        ] {
            rsrc[offset..offset + 4].copy_from_slice(&id.to_le_bytes());
            rsrc[offset + 4..offset + 8].copy_from_slice(&target.to_le_bytes());
        }
        for (offset, start, size) in [(128, 160, png.len()), (144, 160 + png.len(), 20)] {
            rsrc[offset..offset + 4].copy_from_slice(&(4096 + start as u32).to_le_bytes());
            rsrc[offset + 4..offset + 8].copy_from_slice(&(size as u32).to_le_bytes());
        }
        rsrc[160..160 + png.len()].copy_from_slice(png);
        let start = 160 + png.len();
        rsrc[start + 2..start + 4].copy_from_slice(&1u16.to_le_bytes());
        rsrc[start + 4..start + 6].copy_from_slice(&1u16.to_le_bytes());
        rsrc[start + 6] = 96;
        rsrc[start + 7] = 96;
        rsrc[start + 12..start + 14].copy_from_slice(&32u16.to_le_bytes());
        rsrc[start + 18..start + 20].copy_from_slice(&1u16.to_le_bytes());
        let mut pe = vec![0u8; 512];
        pe[..2].copy_from_slice(b"MZ");
        pe[60..64].copy_from_slice(&64u32.to_le_bytes());
        pe[64..68].copy_from_slice(b"PE\0\0");
        pe[70..72].copy_from_slice(&1u16.to_le_bytes());
        pe[84..86].copy_from_slice(&224u16.to_le_bytes());
        pe[88..90].copy_from_slice(&0x10bu16.to_le_bytes());
        pe[180..184].copy_from_slice(&16u32.to_le_bytes());
        pe[200..204].copy_from_slice(&4096u32.to_le_bytes());
        pe[204..208].copy_from_slice(&(rsrc.len() as u32).to_le_bytes());
        pe[324..328].copy_from_slice(&4096u32.to_le_bytes());
        pe[328..332].copy_from_slice(&(rsrc.len() as u32).to_le_bytes());
        pe[332..336].copy_from_slice(&512u32.to_le_bytes());
        pe.extend_from_slice(&rsrc);
        pe
    }
    #[test]
    fn resource_reader_uses_rvas_and_rejects_out_of_file_payloads() {
        let base = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        fs::create_dir_all(&base).unwrap();
        let path = base.join(format!("icon-pe-{}.bin", uuid::Uuid::new_v4()));
        let png = decode::encode(RgbaImage::from_pixel(
            96,
            96,
            image::Rgba([12, 34, 56, 255]),
        ))
        .unwrap();
        let mut data = fixture(&png);
        fs::write(&path, &data).unwrap();
        let actual = extract(&mut File::open(&path).unwrap()).unwrap();
        assert_eq!(actual.get_pixel(0, 0).0, [12, 34, 56, 255]);
        data[512 + 128..512 + 132].copy_from_slice(&u32::MAX.to_le_bytes());
        fs::write(&path, &data).unwrap();
        assert!(extract(&mut File::open(&path).unwrap()).is_none());
        fs::remove_file(path).unwrap();
    }
    #[test]
    #[ignore = "explicit local executable, only bounded resource reads"]
    fn actual_pe_icon_uses_portable_reader() {
        let path = PathBuf::from(std::env::var_os("HARBOR_SETUP_ICON_EXE").unwrap());
        let image = extract(&mut File::open(&path).unwrap()).expect("portable embedded icon");
        let png = decode::encode(image).unwrap();
        assert!(png.len() <= super::super::MAX_PNG_BYTES);
        if let Some(path) = std::env::var_os("HARBOR_SETUP_ICON_PNG") {
            fs::write(path, png).unwrap();
        }
    }
}
