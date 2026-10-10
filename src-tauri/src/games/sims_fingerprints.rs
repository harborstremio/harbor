//! LlamaLogic content fingerprints, not whole-file checksums or creator signatures.
use super::{sims_manifest::Identity, sims_package as package};
use package::Result;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    io::{Cursor, Read},
};

pub fn calculate(
    name: &str,
    bytes: &[u8],
    identity: &Identity,
    check: &dyn Fn() -> Result<()>,
) -> Result<String> {
    let mut hash = Sha256::new();
    if package::kind(name) == "script" {
        // The caller validates all ZIP members, including their CRC, before this.
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|_| "sims_manifest")?;
        let mut entries = Vec::new();
        for index in 0..archive.len() {
            check()?;
            let entry = archive.by_index(index).map_err(|_| "sims_manifest")?;
            if identity.excluded.contains(entry.name())
                || entry
                    .name()
                    .rsplit('/')
                    .next()
                    .is_some_and(|v| v.eq_ignore_ascii_case("llamalogic.modfilemanifest.yml"))
            {
                continue;
            }
            entries.push((entry.name().to_owned(), entry.crc32()));
        }
        // Match .NET StringComparer.Ordinal, including non-BMP names.
        entries.sort_by(|a, b| a.0.encode_utf16().cmp(b.0.encode_utf16()));
        for (name, crc) in entries {
            check()?;
            hash.update(name.as_bytes());
            hash.update(crc.to_le_bytes());
        }
    } else {
        if identity.resources.is_empty() {
            return Err("sims_manifest");
        }
        let mut entries = BTreeMap::new();
        package::inspect_resources(
            bytes,
            false,
            check,
            &mut |key, position, length, expanded, compression| {
                if identity.resources.contains(&key)
                    && entries
                        .insert(key, (position, length, expanded, compression))
                        .is_some()
                {
                    return Err("sims_manifest");
                }
                Ok(())
            },
        )?;
        if entries.len() != identity.resources.len() {
            return Err("sims_manifest");
        }
        let mut budget = package::MAX_FILE;
        let mut buffer = vec![0; 64 * 1024];
        for ((kind, group, instance), (position, length, expanded, compression)) in entries {
            check()?;
            if expanded > budget || !matches!(compression, 0 | 0x5a42) {
                return Err("sims_manifest");
            }
            budget -= expanded;
            hash.update(instance.to_le_bytes());
            hash.update(kind.to_le_bytes());
            hash.update(group.to_le_bytes());
            let raw = &bytes[position..position + length];
            if compression == 0 {
                if raw.len() != expanded {
                    return Err("sims_manifest");
                }
                for chunk in raw.chunks(buffer.len()) {
                    check()?;
                    hash.update(chunk);
                }
            } else {
                let mut decoder = flate2::read::ZlibDecoder::new(raw).take(expanded as u64 + 1);
                let mut read = 0;
                loop {
                    check()?;
                    let count = decoder.read(&mut buffer).map_err(|_| "sims_manifest")?;
                    if count == 0 {
                        break;
                    }
                    read += count;
                    if read > expanded {
                        return Err("sims_manifest");
                    }
                    hash.update(&buffer[..count]);
                }
                if read != expanded {
                    return Err("sims_manifest");
                }
            }
        }
    }
    check()?;
    Ok(format!("{:x}", hash.finalize()))
}
