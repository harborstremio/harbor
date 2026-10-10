//! Seek across the reviewed volumes without a joined copy or whole-archive buffer.
use super::Result;
use std::{
    fs::File,
    io::{self, Read, Seek, SeekFrom},
    path::PathBuf,
};

pub(crate) struct Reader {
    files: Vec<File>,
    ends: Vec<u64>,
    position: u64,
    cursor: Option<(usize, u64)>,
}

impl Reader {
    pub fn single(file: File) -> Result<Self> {
        let bytes = file.metadata().map_err(|_| "archive_read")?.len();
        if bytes > super::super::MAX_ARCHIVE {
            return Err("archive_limit");
        }
        Ok(Self {
            files: vec![file],
            ends: vec![bytes],
            position: 0,
            cursor: None,
        })
    }

    pub fn zip(paths: &[PathBuf]) -> Result<Self> {
        let mut value = Self::open(paths, false)?;
        if value.ends.first() == Some(&0) || value.ends.windows(2).any(|v| v[0] == v[1]) {
            return Err("archive_missing_part");
        }
        let mut magic = [0; 4];
        value
            .read_exact(&mut magic)
            .map_err(|_| "archive_missing_part")?;
        if !magic.starts_with(b"PK") {
            return Err("archive_format");
        }
        value.position = 0;
        Ok(value)
    }

    pub fn open(paths: &[PathBuf], split: bool) -> Result<Self> {
        if paths.is_empty() || paths.len() > super::super::parts::MAX_PARTS {
            return Err("archive_parts");
        }
        let mut value = Self {
            files: Vec::with_capacity(paths.len()),
            ends: Vec::with_capacity(paths.len()),
            position: 0,
            cursor: None,
        };
        let mut bytes = 0u64;
        for path in paths {
            let file = File::open(path).map_err(|_| "archive_read")?;
            let size = file.metadata().map_err(|_| "archive_read")?.len();
            if split && size == 0 {
                return Err("archive_missing_part");
            }
            bytes = bytes.checked_add(size).ok_or("archive_limit")?;
            if bytes > super::super::MAX_ARCHIVE {
                return Err("archive_limit");
            }
            value.files.push(file);
            value.ends.push(bytes);
        }
        if split {
            // The CRC-checked start header declares the exact end of a 7z stream.
            // This detects an absent last volume or an unrelated extra volume even
            // when every discovered filename is consecutively numbered.
            let mut header = [0u8; 32];
            value
                .read_exact(&mut header)
                .map_err(|_| "archive_missing_part")?;
            if header[..6] != *b"7z\xbc\xaf\x27\x1c" {
                return Err("archive_format");
            }
            let mut crc = !0u32;
            for byte in &header[12..] {
                crc ^= u32::from(*byte);
                for _ in 0..8 {
                    crc = (crc >> 1) ^ (0xedb88320 & (0u32.wrapping_sub(crc & 1)));
                }
            }
            if !crc != u32::from_le_bytes(header[8..12].try_into().unwrap()) {
                return Err("archive_checksum");
            }
            let offset = u64::from_le_bytes(header[12..20].try_into().unwrap());
            let size = u64::from_le_bytes(header[20..28].try_into().unwrap());
            let expected = 32u64
                .checked_add(offset)
                .and_then(|v| v.checked_add(size))
                .ok_or("archive_format")?;
            if bytes < expected {
                return Err("archive_missing_part");
            }
            if bytes > expected {
                return Err("archive_parts");
            }
            value.position = 0;
        }
        Ok(value)
    }
}

impl Read for Reader {
    fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
        let index = self.ends.partition_point(|end| *end <= self.position);
        if output.is_empty() || index == self.files.len() {
            return Ok(0);
        }
        let start = if index == 0 { 0 } else { self.ends[index - 1] };
        let available = (self.ends[index] - self.position).min(output.len() as u64) as usize;
        let file = &mut self.files[index];
        let offset = self.position - start;
        // Decoders can issue very small sequential reads. Seek only on an actual
        // position or volume change, preserving the single-file read cost.
        if self.cursor != Some((index, offset)) {
            file.seek(SeekFrom::Start(offset))?;
        }
        let count = file.read(&mut output[..available])?;
        if count == 0 {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "archive_changed",
            ));
        }
        self.position += count as u64;
        self.cursor = Some((index, offset + count as u64));
        Ok(count)
    }
}

impl Seek for Reader {
    fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
        let position = match position {
            SeekFrom::Start(value) => i128::from(value),
            SeekFrom::Current(offset) => i128::from(self.position) + i128::from(offset),
            SeekFrom::End(offset) => {
                i128::from(*self.ends.last().unwrap_or(&0)) + i128::from(offset)
            }
        };
        self.position = u64::try_from(position)
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "archive_seek"))?;
        Ok(self.position)
    }
}
