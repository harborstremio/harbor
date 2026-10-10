use super::{protocol as wire, Result, MAX_ENTRIES, MAX_EXPANDED};
use hadris_iso::{file::EntryType, IsoImage};
use std::{
    fs::File,
    io::{BufReader, Read, Seek, SeekFrom, Write},
    path::Path,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Kind {
    Iso,
    Udf,
}

/// Inspect the bounded volume-recognition area, including UDF descriptors after
/// an ISO terminator. A bridge's ISO namespace may omit UDF-only game files.
pub(super) fn kind(file: &mut File) -> Result<Option<Kind>> {
    let length = file.metadata().map_err(|_| "archive_read")?.len();
    let mut iso = false;
    let mut extended = false;
    for sector in 16..256u64 {
        if sector * 2048 + 7 > length {
            break;
        }
        file.seek(SeekFrom::Start(sector * 2048))
            .map_err(|_| "archive_read")?;
        let mut header = [0; 7];
        file.read_exact(&mut header).map_err(|_| "archive_read")?;
        match &header[1..6] {
            b"CD001" => iso = true,
            b"BEA01" => extended = true,
            b"NSR02" | b"NSR03" if extended => return Ok(Some(Kind::Udf)),
            // Recognition descriptors are contiguous. Searching arbitrary file
            // sectors would misclassify an ISO containing these byte strings.
            _ => break,
        }
    }
    Ok(iso.then_some(Kind::Iso))
}

struct Output<'a, W> {
    stream: &'a mut W,
    extract: bool,
    entries: usize,
    bytes: u64,
}
impl<W: Write> Output<'_, W> {
    fn entry(&mut self, path: String, bytes: u64, directory: bool, mode: u32) -> Result<()> {
        self.entries += 1;
        self.bytes = self.bytes.checked_add(bytes).ok_or("archive_limit")?;
        if self.entries > MAX_ENTRIES || self.bytes > MAX_EXPANDED || path.len() > 2048 {
            return Err("archive_limit");
        }
        // Reject ambiguous names before producing data, and revalidate in the parent.
        super::super::relative(&path, directory)?;
        let encoded = serde_json::to_vec(&wire::Entry {
            path,
            bytes,
            directory,
            mode,
        })
        .map_err(|_| "archive_format")?;
        wire::write_frame(self.stream, wire::ENTRY, &encoded).map_err(|_| "archive_write")
    }
    fn data(&mut self, data: &[u8]) -> Result<()> {
        wire::write_frame(self.stream, wire::DATA, data).map_err(|_| "archive_write")
    }
    fn end(&mut self) -> Result<()> {
        if self.extract {
            wire::write_frame(self.stream, wire::END_ENTRY, &[]).map_err(|_| "archive_write")?;
        }
        Ok(())
    }
}
fn child_path(parent: &str, name: &str) -> Result<String> {
    if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\\']) {
        return Err("archive_path");
    }
    let full = if parent.is_empty() {
        name.into()
    } else {
        format!("{parent}/{name}")
    };
    if full.len() > 2048 {
        return Err("archive_limit");
    }
    Ok(full)
}

pub(super) fn run(path: &Path, kind: Kind, extract: bool, stream: &mut impl Write) -> Result<()> {
    let mut output = Output {
        stream,
        extract,
        entries: 0,
        bytes: 0,
    };
    match kind {
        Kind::Iso => iso(path, &mut output),
        // Never downgrade an advertised UDF image to a possibly incomplete ISO view.
        Kind::Udf => udf(path, &mut output),
    }
}

fn iso(path: &Path, output: &mut Output<'_, impl Write>) -> Result<()> {
    let iso = IsoImage::open(BufReader::new(
        File::open(path).map_err(|_| "archive_read")?,
    ))
    .map_err(|_| "archive_format")?;
    let root = iso.root_dirs().try_best_choice().ok_or("archive_format")?;
    let joliet = matches!(root.entry_type(), EntryType::Joliet { .. });
    let mut stack = vec![(String::new(), root.dir_ref(), 0usize)];
    while let Some((parent, directory, depth)) = stack.pop() {
        if depth > 32 {
            return Err("archive_limit");
        }
        for item in iso.open_dir(directory).entries() {
            let item = item.map_err(|_| "archive_format")?;
            if item.is_special() {
                continue;
            }
            let mode = item
                .rrip
                .as_ref()
                .and_then(|metadata| metadata.posix_attributes)
                .map(|px| px.file_mode.read())
                .unwrap_or(0);
            if item.rrip.as_ref().is_some_and(|metadata| {
                metadata.symlink_target.is_some() || metadata.device_number.is_some()
            }) || ![0, 0o100000, 0o040000].contains(&(mode & 0o170000))
                || (mode & 0o170000 == 0o040000 && !item.is_directory())
                || (mode & 0o170000 == 0o100000 && item.is_directory())
            {
                return Err("archive_links");
            }
            let name = if let Some(name) = item
                .rrip
                .as_ref()
                .and_then(|metadata| metadata.alternate_name.as_ref())
            {
                name.clone()
            } else {
                let value = if joliet {
                    if item.name().len() % 2 != 0 {
                        return Err("archive_format");
                    }
                    String::from_utf16(
                        &item
                            .name()
                            .chunks_exact(2)
                            .map(|bytes| u16::from_be_bytes([bytes[0], bytes[1]]))
                            .collect::<Vec<_>>(),
                    )
                    .map_err(|_| "archive_format")?
                } else {
                    String::from_utf8(item.name().to_vec()).map_err(|_| "archive_format")?
                };
                match value.rsplit_once(';') {
                    Some((base, version))
                        if !version.is_empty()
                            && version.bytes().all(|byte| byte.is_ascii_digit()) =>
                    {
                        base.to_owned()
                    }
                    _ => value,
                }
            };
            let full = child_path(&parent, &name)?;
            let bytes = if item.is_directory() {
                0
            } else {
                item.total_size()
            };
            output.entry(full.clone(), bytes, item.is_directory(), mode)?;
            if item.is_directory() {
                stack.push((
                    full,
                    item.as_dir_ref(&iso).map_err(|_| "archive_format")?,
                    depth + 1,
                ));
            } else if output.extract {
                let mut chunks = iso
                    .read_file_chunked::<{ wire::CHUNK }>(&item)
                    .map_err(|_| "archive_format")?;
                let mut read = 0u64;
                while let Some(chunk) = chunks.next_chunk().map_err(|_| "archive_checksum")? {
                    read = read
                        .checked_add(chunk.len() as u64)
                        .ok_or("archive_limit")?;
                    if read > bytes {
                        return Err("archive_checksum");
                    }
                    output.data(&chunk)?;
                }
                if read != bytes {
                    return Err("archive_checksum");
                }
            }
            output.end()?;
        }
    }
    Ok(())
}

fn udf(path: &Path, output: &mut Output<'_, impl Write>) -> Result<()> {
    let image = harbor_udfread::Image::open(path).map_err(|_| "archive_format")?;
    let mut stack = vec![(
        String::new(),
        image.root().map_err(|_| "archive_format")?,
        0usize,
    )];
    let mut buffer = vec![0; wire::CHUNK];
    while let Some((parent, mut directory, depth)) = stack.pop() {
        if depth > 32 {
            return Err("archive_limit");
        }
        while let Some(entry) = directory.next_entry().map_err(|_| "archive_format")? {
            if entry.name == ".." {
                continue;
            }
            let full = child_path(&parent, &entry.name)?;
            if entry.directory {
                let child = directory
                    .directory(&entry.name)
                    .map_err(|_| "archive_format")?;
                output.entry(full.clone(), 0, true, 0)?;
                stack.push((full, child, depth + 1));
            } else {
                // Opening during inventory also rejects non-regular file entries.
                let mut file = directory.file(&entry.name).map_err(|_| "archive_format")?;
                let bytes = file.size().map_err(|_| "archive_format")?;
                output.entry(full, bytes, false, 0)?;
                if output.extract {
                    let mut read = 0u64;
                    loop {
                        let count = file.read(&mut buffer).map_err(|_| "archive_checksum")?;
                        if count == 0 {
                            break;
                        }
                        read = read.checked_add(count as u64).ok_or("archive_limit")?;
                        if read > bytes {
                            return Err("archive_checksum");
                        }
                        output.data(&buffer[..count])?;
                    }
                    if read != bytes {
                        return Err("archive_checksum");
                    }
                }
            }
            output.end()?;
        }
    }
    Ok(())
}
