use super::{protocol as wire, Result, MAX_ENTRIES, MAX_EXPANDED};
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom, Write},
    path::Path,
};
use zeroize::Zeroizing;

fn code(error: sevenz_rust2::Error) -> &'static str {
    use sevenz_rust2::Error::*;
    match error {
        PasswordRequired => "archive_encrypted",
        MaybeBadPassword(_) => "archive_password",
        MaxMemLimited { .. } => "archive_limit",
        ChecksumVerificationFailed | NextHeaderCrcMismatch => "archive_checksum",
        UnsupportedCompressionMethod(_) | ExternalUnsupported | Unsupported(_) => {
            "archive_compression"
        }
        _ => "archive_format",
    }
}
fn entry(item: &sevenz_rust2::ArchiveEntry) -> Result<wire::Entry> {
    let attributes = item.windows_attributes;
    let mode = if item.has_windows_attributes && attributes & 0x8000 != 0 {
        attributes >> 16
    } else {
        0
    };
    if item.is_anti_item
        || attributes & 0x400 != 0
        || ![0, 0o100000, 0o040000].contains(&(mode & 0o170000))
    {
        return Err("archive_links");
    }
    let path = item.name.replace('\\', "/");
    // Output metadata is bounded before serialization, in both processes.
    if path.len() > 2048 || (item.is_directory && item.size != 0) {
        return Err("archive_limit");
    }
    Ok(wire::Entry {
        path,
        bytes: item.size,
        directory: item.is_directory,
        mode,
    })
}
fn run(mut request: wire::Request, output: &mut impl Write) -> Result<()> {
    let password = request.password.take().map(Zeroizing::new);
    if password.as_ref().is_some_and(|v| v.len() > 4096) {
        return Err("archive_password");
    }
    let path = Path::new(&request.source);
    if !path.is_absolute() {
        return Err("archive_path");
    }
    let parts = request
        .parts
        .iter()
        .map(std::path::PathBuf::from)
        .collect::<Vec<_>>();
    if parts.is_empty()
        || parts.len() > super::super::parts::MAX_PARTS
        || parts.first().map(|v| v.as_path()) != Some(path)
    {
        return Err("archive_parts");
    }
    let mut part_before = Vec::with_capacity(parts.len());
    for part in &parts {
        if !part.is_absolute()
            || part.parent() != path.parent()
            || part.to_string_lossy().len() > 8192
            || part.canonicalize().map_err(|_| "archive_read")? != *part
        {
            return Err("archive_path");
        }
        part_before.push(super::super::metadata(part)?);
    }
    let total = part_before
        .iter()
        .try_fold(0u64, |total, entry| total.checked_add(entry.len()))
        .ok_or("archive_limit")?;
    if total > super::super::MAX_ARCHIVE {
        return Err("archive_limit");
    }
    let mut file = File::open(path).map_err(|_| "archive_read")?;
    let split = path.file_name().and_then(|v| v.to_str()).is_some_and(super::super::parts::split_sevenzip);
    let mut signature = [0; 4];
    if split {
        signature = *b"7z\xbc\xaf";
    } else {
        file.read_exact(&mut signature).map_err(|_| "archive_format")?;
    }
    file.seek(SeekFrom::Start(0)).map_err(|_| "archive_read")?;
    if signature == *b"Rar!" {
        let mut signature = [0; 8];
        file.read_exact(&mut signature)
            .map_err(|_| "archive_format")?;
        let length = if signature.starts_with(b"Rar!\x1a\x07\x00") {
            7
        } else if signature == *b"Rar!\x1a\x07\x01\x00" {
            8
        } else {
            return Err("archive_format");
        };
        for part in parts.iter().skip(1) {
            let mut actual = [0; 8];
            File::open(part)
                .map_err(|_| "archive_read")?
                .read_exact(&mut actual)
                .map_err(|_| "archive_parts")?;
            if actual[..length] != signature[..length] {
                return Err("archive_parts");
            }
        }
        super::rar::run(
            path,
            &parts,
            password.as_deref().map(|v| v.as_str()),
            request.extract,
            output,
        )?;
        for (part, before) in parts.iter().zip(&part_before) {
            super::super::unchanged(part, before)?;
        }
        wire::write_frame(output, wire::DONE, &[]).map_err(|_| "archive_write")?;
        return Ok(());
    }
    if parts.len() != 1 && !split {
        return Err("archive_parts");
    }
    if !split && signature != *b"7z\xbc\xaf" {
        if let Some(kind) = super::disc::kind(&mut file)? {
            super::disc::run(path, kind, request.extract, output)?;
            for (part, before) in parts.iter().zip(&part_before) {
                super::super::unchanged(part, before)?;
            }
            wire::write_frame(output, wire::DONE, &[]).map_err(|_| "archive_write")?;
            return Ok(());
        }
    }
    let input = super::split::Reader::open(&parts, split)?;
    let mut archive = sevenz_rust2::ArchiveReader::new(
        input,
        sevenz_rust2::Password::from(password.as_deref().map(|v| v.as_str()).unwrap_or("")),
    )
    .map_err(code)?;
    archive.set_thread_count(2);
    if archive.archive().files.len() > MAX_ENTRIES {
        return Err("archive_limit");
    }
    let mut total = 0u64;
    for item in &archive.archive().files {
        entry(item)?;
        total = total.checked_add(item.size).ok_or("archive_limit")?;
        if total > MAX_EXPANDED {
            return Err("archive_limit");
        }
    }
    let encrypted = archive
        .archive()
        .blocks
        .iter()
        .flat_map(|block| &block.coders)
        .any(|coder| coder.encoder_method_id() == sevenz_rust2::EncoderMethod::ID_AES256_SHA256);
    if encrypted && password.is_none() {
        return Err("archive_encrypted");
    }
    if !request.extract {
        for item in &archive.archive().files {
            let encoded = serde_json::to_vec(&entry(item)?).map_err(|_| "archive_format")?;
            wire::write_frame(output, wire::ENTRY, &encoded).map_err(|_| "archive_write")?;
        }
    } else {
        let mut failure = None;
        let mut buffer = vec![0; wire::CHUNK];
        let mut decoded = 0u64;
        let result = archive.for_each_entries(|item, input| {
            let result = (|| -> Result<()> {
                let metadata = entry(item)?;
                let encoded = serde_json::to_vec(&metadata).map_err(|_| "archive_format")?;
                wire::write_frame(output, wire::ENTRY, &encoded).map_err(|_| "archive_write")?;
                let mut count = 0u64;
                loop {
                    let length = input.read(&mut buffer).map_err(|_| {
                        if encrypted {
                            "archive_password_or_checksum"
                        } else {
                            "archive_checksum"
                        }
                    })?;
                    if length == 0 {
                        break;
                    }
                    count = count.checked_add(length as u64).ok_or("archive_limit")?;
                    decoded = decoded.checked_add(length as u64).ok_or("archive_limit")?;
                    if count > metadata.bytes || decoded > total {
                        return Err("archive_limit");
                    }
                    wire::write_frame(output, wire::DATA, &buffer[..length])
                        .map_err(|_| "archive_write")?;
                }
                if count != metadata.bytes {
                    return Err("archive_checksum");
                }
                wire::write_frame(output, wire::END_ENTRY, &[]).map_err(|_| "archive_write")?;
                Ok(())
            })();
            if let Err(error) = result {
                failure = Some(error);
                // A false callback only stops the current solid block in this
                // decoder. Abort traversal so no later entry obscures the error.
                return Err(sevenz_rust2::Error::Other("archive_worker_stopped".into()));
            }
            Ok(true)
        });
        if let Some(error) = failure {
            return Err(error);
        }
        result.map_err(|error| {
            let value = code(error);
            if encrypted
                && matches!(
                    value,
                    "archive_format" | "archive_checksum" | "archive_password"
                )
            {
                "archive_password_or_checksum"
            } else {
                value
            }
        })?;
        if decoded != total {
            return Err("archive_checksum");
        }
    }
    for (part, before) in parts.iter().zip(&part_before) {
        super::super::unchanged(part, before)?;
    }
    wire::write_frame(output, wire::DONE, &[]).map_err(|_| "archive_write")?;
    Ok(())
}
pub fn main() -> i32 {
    super::limits::worker_started();
    // Nothing from archive data (or a password) is printed to stdout/stderr.
    let mut input = std::io::stdin().lock();
    let request = match wire::read_request(&mut input) {
        Ok(value) => value,
        Err(_) => return 2,
    };
    let mut output = std::io::BufWriter::with_capacity(64 * 1024, std::io::stdout().lock());
    if output.write_all(wire::MAGIC).is_err() {
        return 2;
    }
    let result =
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| run(request, &mut output)));
    let error = match result {
        Ok(Ok(())) => None,
        Ok(Err(code)) => Some(code),
        Err(_) => Some("archive_format"),
    };
    if let Some(code) = error {
        let _ = wire::write_frame(&mut output, wire::ERROR, code.as_bytes());
    }
    if output.flush().is_err() {
        return 2;
    }
    if error.is_some() {
        1
    } else {
        0
    }
}
