//! TAR uses the same reviewed paths, staged publication, space reservation and cancellation as ZIP.
use super::*;
use flate2::read::MultiGzDecoder;

/// Iterate raw headers to bound metadata allocation and reject links, devices and sparse files.
pub(super) fn visit(
    file: &mut File,
    gzip: bool,
    work: &Work,
    mut visit: impl FnMut(&ArchiveEntry, &mut dyn Read, u32) -> Result<()>,
) -> Result<()> {
    file.seek(SeekFrom::Start(0)).map_err(|_| "archive_read")?;
    let input = file.try_clone().map_err(|_| "archive_read")?;
    let mut reader: Box<dyn Read> = if gzip {
        Box::new(MultiGzDecoder::new(input))
    } else {
        Box::new(input)
    };
    let mut archive = tar::Archive::new(&mut reader);
    let mut identities = HashMap::new();
    let mut parents = HashSet::new();
    let mut expanded = 0u64;
    let mut buffer = [0; 64 * 1024];
    for (index, item) in archive
        .entries()
        .map_err(|_| "archive_format")?
        .raw(true)
        .enumerate()
    {
        canceled(work)?;
        if index >= MAX_ENTRIES {
            return Err("archive_limit");
        }
        let mut item = item.map_err(|_| "archive_format")?;
        let header = item.header();
        let kind = header.entry_type();
        if !kind.is_file() && !kind.is_dir() {
            return Err("archive_links");
        }
        let bytes = header.size().map_err(|_| "archive_format")?;
        let mode = header.mode().map_err(|_| "archive_format")?;
        expanded = expanded.checked_add(bytes).ok_or("archive_limit")?;
        if expanded > MAX_EXPANDED || (kind.is_dir() && bytes != 0) {
            return Err("archive_limit");
        }
        let name = item.path_bytes();
        let name = std::str::from_utf8(&name).map_err(|_| "archive_path")?;
        let name = name.trim_start_matches("./");
        // Many Unix archives start with a harmless ./ directory header.
        if kind.is_dir() && (name.is_empty() || name == ".") {
            continue;
        }
        let path = relative(name, kind.is_dir())?;
        let identity = path.to_lowercase();
        if identities.insert(identity.clone(), kind.is_dir()).is_some() {
            return Err("archive_collision");
        }
        let mut parent = identity.as_str();
        while let Some((next, _)) = parent.rsplit_once('/') {
            parents.insert(next.to_string());
            parent = next;
        }
        let entry = ArchiveEntry {
            path,
            bytes,
            directory: kind.is_dir(),
        };
        visit(&entry, &mut item, mode)?;
        // Read, rather than seek past, all file data so truncation and gzip CRC errors are checked.
        loop {
            canceled(work)?;
            if item.read(&mut buffer).map_err(|_| "archive_checksum")? == 0 {
                break;
            }
        }
    }
    if identities
        .iter()
        .any(|(path, directory)| !*directory && parents.contains(path))
    {
        return Err("archive_collision");
    }
    drop(archive);
    // Finish the compression stream (CRC/trailer) without accepting unbounded padding or extra archives.
    let mut padding = 0;
    loop {
        canceled(work)?;
        let n = reader.read(&mut buffer).map_err(|_| "archive_checksum")?;
        if n == 0 {
            break;
        }
        padding += n;
        if padding > 1024 * 1024 {
            return Err("archive_limit");
        }
        if buffer[..n].iter().any(|byte| *byte != 0) {
            return Err("archive_format");
        }
    }
    Ok(())
}
