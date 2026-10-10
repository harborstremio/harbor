use super::p2p::{Result, TorrentFile, TorrentRecord};
use librqbit::{torrent_from_bytes, ByteBufOwned, TorrentMetaV1Owned};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

pub const MAX_METADATA: usize = 8 * 1024 * 1024;
pub const MAX_FILES: usize = 10_000;
pub const MAX_BYTES: u64 = 256 * 1024 * 1024 * 1024;
const MAX_MAGNET_BYTES: usize = 64 * 1024;
const MAX_MAGNET_TRACKERS: usize = 512;

pub fn magnet(value: &str) -> Result<String> {
    if value.len() > MAX_MAGNET_BYTES {
        return Err("torrent_request");
    }
    let parsed = reqwest::Url::parse(value).map_err(|_| "torrent_request")?;
    if parsed.scheme() != "magnet" || parsed.host_str().is_some() || !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("torrent_request");
    }
    let mut hash = None;
    let mut trackers = Vec::new();
    let mut seen_trackers = HashSet::new();
    for (key, value) in parsed.query_pairs() {
        if key == "xt" {
            let value = value.to_ascii_lowercase();
            if value.strip_prefix("urn:btmh:1220").is_some_and(|hash| hash.len() == 64 && hash.bytes().all(|c| c.is_ascii_hexdigit())) {
                continue; // Hybrid metadata is verified using the supported v1 identity below.
            }
            let input = value.strip_prefix("urn:btih:").ok_or("torrent_request")?;
            let normalized = if input.len() == 40 && input.bytes().all(|c| c.is_ascii_hexdigit()) {
                input.to_ascii_lowercase()
            } else if input.len() == 32 {
                let mut bits = 0u32;
                let mut count = 0;
                let mut bytes = Vec::new();
                for c in input.bytes().map(|c| c.to_ascii_uppercase()) {
                    let n = match c {
                        b'A'..=b'Z' => c - b'A',
                        b'2'..=b'7' => c - b'2' + 26,
                        _ => return Err("torrent_request"),
                    };
                    bits = (bits << 5) | n as u32;
                    count += 5;
                    if count >= 8 {
                        count -= 8;
                        bytes.push((bits >> count) as u8);
                    }
                }
                bytes.iter().map(|b| format!("{b:02x}")).collect()
            } else {
                return Err("torrent_request");
            };
            if hash.as_ref().is_some_and(|previous| previous != &normalized) {
                return Err("torrent_request");
            }
            hash = Some(normalized);
        } else if key == "tr" || key.strip_prefix("tr.").is_some_and(|index| !index.is_empty() && index.bytes().all(|c| c.is_ascii_digit())) {
            // A broken optional hint does not invalidate the torrent identity.
            if tracker(&value).is_err() { continue; }
            if seen_trackers.insert(value.to_string()) { trackers.push(value.into_owned()); }
            if trackers.len() > MAX_MAGNET_TRACKERS {
                return Err("torrent_limit");
            }
        }
        // File-selection ranges from a link are deliberately ignored. Selection happens in the review.
    }
    let mut normalized = reqwest::Url::parse("magnet:?").map_err(|_| "torrent_request")?;
    normalized.query_pairs_mut().append_pair(
        "xt",
        &format!("urn:btih:{}", hash.ok_or("torrent_request")?),
    );
    for tracker in trackers {
        normalized.query_pairs_mut().append_pair("tr", &tracker);
    }
    let normalized: String = normalized.into();
    if normalized.len() > MAX_MAGNET_BYTES { return Err("torrent_limit"); }
    Ok(normalized)
}
fn tracker(value: &str) -> Result<()> {
    if value.len() > 2048 {
        return Err("torrent_metadata");
    }
    let url = reqwest::Url::parse(value).map_err(|_| "torrent_metadata")?;
    if !["http", "https", "udp"].contains(&url.scheme())
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("torrent_metadata");
    }
    Ok(())
}

pub fn profile(value: &str) -> Result<()> {
    if value.is_empty() || value.len() > 200 || value.chars().any(char::is_control) {
        return Err("torrent_profile");
    }
    Ok(())
}
pub fn component(value: &str) -> Result<()> {
    let stem = value.split('.').next().unwrap_or("").to_ascii_uppercase();
    if value.is_empty()
        || value.len() > 240
        || value == "."
        || value == ".."
        || value.ends_with([' ', '.'])
        || value
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        || value.starts_with(".harbor-")
        || ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
        || ((stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.len() == 4
            && stem.as_bytes()[3].is_ascii_digit())
    {
        return Err("torrent_path");
    }
    Ok(())
}
pub fn read(path: &Path, limit: usize) -> Result<Vec<u8>> {
    let meta = fs::symlink_metadata(path).map_err(|_| "torrent_read")?;
    if !meta.is_file() || linked(&meta) || meta.len() > limit as u64 {
        return Err("torrent_read");
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|_| "torrent_read")?
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "torrent_read")?;
    if bytes.len() > limit {
        return Err("torrent_limit");
    }
    Ok(bytes)
}
pub fn linked(meta: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        meta.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    {
        meta.file_type().is_symlink()
    }
}
pub fn plain_dir(path: &Path) -> Result<PathBuf> {
    if !path.is_absolute() {
        return Err("torrent_destination");
    }
    let mut current = PathBuf::new();
    for part in path.components() {
        current.push(part);
        if matches!(part, std::path::Component::Prefix(_)) {
            continue;
        }
        let meta = fs::symlink_metadata(&current).map_err(|_| "torrent_destination")?;
        if linked(&meta) || !meta.is_dir() {
            return Err("torrent_destination");
        }
    }
    fs::canonicalize(path).map_err(|_| "torrent_destination")
}
// Bound nesting before passing remote bytes to the metadata parser.
fn preflight(bytes: &[u8]) -> Result<()> {
    if bytes.is_empty() || bytes.len() > MAX_METADATA {
        return Err("torrent_limit");
    }
    let mut pos = 0usize;
    let mut depth = 0usize;
    let mut nodes = 0usize;
    while pos < bytes.len() {
        nodes += 1;
        if nodes > 250_000 {
            return Err("torrent_limit");
        }
        match bytes[pos] {
            b'd' | b'l' => {
                depth += 1;
                if depth > 64 {
                    return Err("torrent_limit");
                }
                pos += 1;
            }
            b'e' => {
                depth = depth.checked_sub(1).ok_or("torrent_metadata")?;
                pos += 1;
            }
            b'i' => {
                pos += 1;
                let start = pos;
                while pos < bytes.len() && bytes[pos] != b'e' {
                    pos += 1;
                }
                if pos == bytes.len() || pos - start > 21 {
                    return Err("torrent_metadata");
                }
                pos += 1;
            }
            b'0'..=b'9' => {
                let mut len = 0usize;
                let start = pos;
                while pos < bytes.len() && bytes[pos].is_ascii_digit() {
                    len = len
                        .checked_mul(10)
                        .and_then(|n| n.checked_add((bytes[pos] - b'0') as usize))
                        .ok_or("torrent_limit")?;
                    pos += 1;
                }
                if pos == bytes.len() || bytes[pos] != b':' || pos - start > 9 {
                    return Err("torrent_metadata");
                }
                pos = (pos + 1).checked_add(len).ok_or("torrent_limit")?;
                if pos > bytes.len() {
                    return Err("torrent_metadata");
                }
            }
            _ => return Err("torrent_metadata"),
        }
    }
    if depth != 0 {
        return Err("torrent_metadata");
    }
    Ok(())
}
pub fn metadata(bytes: &[u8]) -> Result<(TorrentMetaV1Owned, Vec<TorrentFile>, u64)> {
    preflight(bytes)?;
    let meta = torrent_from_bytes::<ByteBufOwned>(bytes).map_err(|_| "torrent_metadata")?;
    let mut tracker_count = 0;
    for value in meta.iter_announce() {
        let value = std::str::from_utf8(value.as_ref()).map_err(|_| "torrent_metadata")?;
        if value.is_empty() {
            continue;
        }
        tracker(value)?;
        tracker_count += 1;
        if tracker_count > 64 {
            return Err("torrent_limit");
        }
    }
    if !(16 * 1024..=16 * 1024 * 1024).contains(&meta.info.piece_length) {
        return Err("torrent_limit");
    }
    let mut files = Vec::new();
    let mut total = 0u64;
    let mut paths = HashSet::new();
    for (index, file) in meta
        .info
        .iter_file_details()
        .map_err(|_| "torrent_metadata")?
        .enumerate()
    {
        if index >= MAX_FILES {
            return Err("torrent_limit");
        }
        if file.attrs().symlink || file.symlink_path.is_some() {
            return Err("torrent_path");
        }
        let parts = file.filename.to_vec().map_err(|_| "torrent_path")?;
        if parts.is_empty() || parts.len() > 32 {
            return Err("torrent_path");
        }
        for part in &parts {
            component(part)?;
        }
        let path = parts.join("/");
        if path.len() > 2048 {
            return Err("torrent_path");
        }
        if !paths.insert(path.to_lowercase()) {
            return Err("torrent_path");
        }
        total = total.checked_add(file.len).ok_or("torrent_limit")?;
        if total > MAX_BYTES {
            return Err("torrent_limit");
        }
        files.push(TorrentFile {
            index,
            path,
            bytes: file.len,
            padding: file.attrs().padding,
        });
    }
    for path in &paths {
        for (pos, _) in path.match_indices('/') {
            if paths.contains(&path[..pos]) {
                return Err("torrent_path");
            }
        }
    }
    let pieces = meta.info.pieces.as_ref().len();
    if total == 0
        || pieces % 20 != 0
        || pieces / 20 != total.div_ceil(meta.info.piece_length as u64) as usize
    {
        return Err("torrent_metadata");
    }
    Ok((meta, files, total))
}
pub fn selected(files: &[TorrentFile], indices: &[usize]) -> Result<u64> {
    let unique: HashSet<_> = indices.iter().copied().collect();
    if indices.is_empty() || unique.len() != indices.len() || indices.len() > files.len() {
        return Err("torrent_selection");
    }
    let mut bytes = 0;
    for index in indices {
        let file = files.get(*index).ok_or("torrent_selection")?;
        if file.padding {
            return Err("torrent_selection");
        }
        bytes += file.bytes;
    }
    if bytes == 0 {
        return Err("torrent_selection");
    }
    Ok(bytes)
}
pub fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
// Shared boundary pieces can extend an unselected file. Reserve its logical extent too,
// since not every target filesystem creates sparse gaps for those writes.
pub fn required_storage(files: &[TorrentFile], indices: &[usize], piece: u32) -> u64 {
    storage_extents(files, indices, piece).into_iter().sum()
}
pub fn storage_extents(files: &[TorrentFile], indices: &[usize], piece: u32) -> Vec<u64> {
    let selected: HashSet<_> = indices.iter().copied().collect();
    let piece = piece as u64;
    let mut ranges: Vec<(u64, u64)> = Vec::new();
    let mut offset = 0;
    for file in files {
        if selected.contains(&file.index) && file.bytes > 0 {
            let start = offset / piece * piece;
            let end = (offset + file.bytes).div_ceil(piece) * piece;
            if let Some(last) = ranges.last_mut().filter(|last| last.1 >= start) {
                last.1 = end;
            } else {
                ranges.push((start, end));
            }
        }
        offset += file.bytes;
    }
    let mut required = Vec::with_capacity(files.len());
    let mut current = 0;
    offset = 0;
    for file in files {
        let end = offset + file.bytes;
        while current < ranges.len() && ranges[current].1 <= offset {
            current += 1;
        }
        let mut range = current;
        let mut extent = 0;
        while range < ranges.len() && ranges[range].0 < end {
            if ranges[range].1 > offset {
                extent = ranges[range].1.min(end) - offset;
            }
            range += 1;
        }
        required.push(if file.padding { 0 } else { extent });
        offset = end;
    }
    required
}
pub fn atomic(root: &Path, name: &str, bytes: &[u8]) -> Result<()> {
    fs::create_dir_all(root).map_err(|_| "torrent_store")?;
    let temp = root.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&temp).map_err(|_| "torrent_store")?;
        file.write_all(bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| "torrent_store")?;
        drop(file);
        fs::rename(&temp, root.join(name)).map_err(|_| "torrent_store")
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}
pub fn verify_destination(record: &TorrentRecord, files: &[TorrentFile]) -> Result<()> {
    let root = plain_dir(Path::new(&record.destination))?;
    let marker = read(&root.join(".harbor-torrent"), 2048)?;
    let expected = format!(
        "{}\n{}\n{}",
        record.id,
        digest(record.profile.as_bytes()),
        record.info_hash
    );
    if marker != expected.as_bytes() {
        return Err("torrent_destination");
    }
    for file in files {
        let mut path = root.clone();
        let parts: Vec<_> = file.path.split('/').collect();
        for (index, part) in parts.iter().enumerate() {
            path.push(part);
            match fs::symlink_metadata(&path) {
                Ok(meta)
                    if linked(&meta)
                        || (index + 1 == parts.len() && !meta.is_file())
                        || (index + 1 != parts.len() && !meta.is_dir()) =>
                {
                    return Err("torrent_destination")
                }
                Ok(meta) if index + 1 == parts.len() && meta.len() > file.bytes => {
                    return Err("torrent_destination")
                }
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
                Err(_) => return Err("torrent_destination"),
            }
        }
    }
    Ok(())
}
