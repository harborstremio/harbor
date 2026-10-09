//! Read only DBPF header/index bytes, retaining requested resource identities.
//! Large installed game packages must not be loaded or decompressed into memory.
use super::household::Resource;
use std::{
    collections::BTreeSet,
    io::{BufReader, Read, Seek, SeekFrom},
};
type Result<T> = std::result::Result<T, &'static str>;
const FORMAT: &str = "sims_format";
const MAX_INDEX: u64 = 32 * 1024 * 1024;
const MAX_MATCHES: usize = 50_000;

#[derive(Debug, PartialEq, Eq)]
pub struct Entry {
    pub resource: Resource,
    pub group: u32,
    pub compression: u16,
}
impl Entry {
    pub fn deleted(&self) -> bool {
        self.compression == 0xffe0
    }
}
#[derive(Debug)]
pub struct Index {
    pub records: u32,
    pub matches: Vec<Entry>,
}
fn at32(bytes: &[u8], at: usize) -> Result<u32> {
    Ok(u32::from_le_bytes(
        bytes
            .get(at..at + 4)
            .ok_or(FORMAT)?
            .try_into()
            .map_err(|_| FORMAT)?,
    ))
}
fn at64(bytes: &[u8], at: usize) -> Result<u64> {
    Ok(u64::from_le_bytes(
        bytes
            .get(at..at + 8)
            .ok_or(FORMAT)?
            .try_into()
            .map_err(|_| FORMAT)?,
    ))
}
fn word(reader: &mut impl Read, remaining: &mut u64) -> Result<u32> {
    if *remaining < 4 {
        return Err(FORMAT);
    }
    let mut bytes = [0; 4];
    reader.read_exact(&mut bytes).map_err(|_| "sims_read")?;
    *remaining -= 4;
    Ok(u32::from_le_bytes(bytes))
}
#[cfg(test)]
fn read(
    source: &mut (impl Read + Seek),
    wanted: &BTreeSet<Resource>,
    check: &dyn Fn() -> Result<()>,
) -> Result<Index> {
    read_with_budget(source, wanted, &mut (MAX_INDEX + 96), check)
}
pub fn read_with_budget(
    source: &mut (impl Read + Seek),
    wanted: &BTreeSet<Resource>,
    budget: &mut u64,
    check: &dyn Fn() -> Result<()>,
) -> Result<Index> {
    check()?;
    *budget = budget.checked_sub(96).ok_or("sims_limit")?;
    if wanted.len() > MAX_MATCHES {
        return Err("sims_limit");
    }
    let file_size = source.seek(SeekFrom::End(0)).map_err(|_| "sims_read")?;
    if file_size < 96 {
        return Err(FORMAT);
    }
    source.seek(SeekFrom::Start(0)).map_err(|_| "sims_read")?;
    let mut header = [0; 96];
    source.read_exact(&mut header).map_err(|_| "sims_read")?;
    if &header[..4] != b"DBPF" || at32(&header, 4)? != 2 || at32(&header, 8)? != 1 {
        return Err(FORMAT);
    }
    let count = at32(&header, 36)?;
    let short = u64::from(at32(&header, 40)?);
    let long = at64(&header, 64)?;
    if short != 0 && long != 0 && short != long {
        return Err(FORMAT);
    }
    let offset = if short != 0 { short } else { long };
    let size = u64::from(at32(&header, 44)?);
    if count > 1_000_000 || size > MAX_INDEX {
        return Err("sims_limit");
    }
    let end = offset.checked_add(size).ok_or(FORMAT)?;
    if offset < 96 || end > file_size || size < 4 {
        return Err(FORMAT);
    }
    *budget = match budget.checked_sub(size) {
        Some(value) => value,
        None => {
            *budget = 0;
            return Err("sims_limit");
        }
    };
    source
        .seek(SeekFrom::Start(offset))
        .map_err(|_| "sims_read")?;
    let mut input = BufReader::with_capacity(64 * 1024, source.take(size));
    let mut remaining = size;
    let flags = word(&mut input, &mut remaining)?;
    if flags & !7 != 0 {
        return Err(FORMAT);
    }
    let mut common = [None; 3];
    for (i, value) in common.iter_mut().enumerate() {
        if flags & (1 << i) != 0 {
            *value = Some(word(&mut input, &mut remaining)?);
        }
    }
    // A malformed count cannot force a long loop through an undersized index.
    let min_record = (4 + 3 - flags.count_ones()) as u64 * 4;
    if u64::from(count) * min_record > remaining {
        return Err(FORMAT);
    }
    let mut matches = Vec::new();
    for i in 0..count {
        if i % 256 == 0 {
            check()?;
        }
        let mut key = [0; 3];
        for (i, value) in key.iter_mut().enumerate() {
            *value = match common[i] {
                Some(value) => value,
                None => word(&mut input, &mut remaining)?,
            };
        }
        let low = word(&mut input, &mut remaining)?;
        let resource = Resource {
            kind: key[0],
            instance: u64::from(key[2]) << 32 | u64::from(low),
        };
        let position = u64::from(word(&mut input, &mut remaining)?);
        let packed = word(&mut input, &mut remaining)?;
        let length = u64::from(packed & 0x7fff_ffff);
        let _expanded = word(&mut input, &mut remaining)?;
        let compression = if packed & 0x8000_0000 != 0 {
            word(&mut input, &mut remaining)? as u16
        } else {
            0
        };
        if compression != 0xffe0 {
            let payload_end = position.checked_add(length).ok_or(FORMAT)?;
            if position < 96
                || payload_end > file_size
                || (length > 0 && position < end && payload_end > offset)
            {
                return Err(FORMAT);
            }
        }
        if wanted.contains(&resource) {
            if matches.len() >= MAX_MATCHES {
                return Err("sims_limit");
            }
            matches.push(Entry {
                resource,
                group: key[1],
                compression,
            });
        }
    }
    if remaining != 0 {
        return Err(FORMAT);
    }
    check()?;
    Ok(Index {
        records: count,
        matches,
    })
}

#[cfg(test)]
#[path = "sims_cc_index_tests.rs"]
mod tests;
