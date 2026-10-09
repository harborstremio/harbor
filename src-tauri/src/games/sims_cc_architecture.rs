//! Exact resource keys from the observed classic lot BNDL v3 table.
//! Geometry and record payloads remain unread; these are declared references,
//! not proof of installed content, CC classification, or complete dependencies.
use super::{take, u32le, Key, Result, FORMAT};
use std::collections::BTreeSet;

const MAX_RECORDS: usize = 20_000;
const MAX_KEYS: usize = 10_000;

pub(super) fn read(
    mut data: &[u8],
    check: &dyn Fn() -> Result<()>,
) -> Result<Option<BTreeSet<Key>>> {
    check()?;
    if data.len() < 4 || u32le(&mut data)? != 1 {
        return Ok(None);
    }
    let pairs = u32le(&mut data)? as usize;
    if pairs > MAX_RECORDS {
        return Err("sims_limit");
    }
    // Skip the observed variant pairs; their semantics are not established.
    // Derive the bundle boundary, never search arbitrary bytes for its magic.
    take(&mut data, pairs.checked_mul(16).ok_or(FORMAT)?)?;
    if u32le(&mut data)? != 0 {
        return Ok(None);
    }
    let bundle = data;
    if u32le(&mut data)? != 0x424e_444c || u32le(&mut data)? != 3 {
        return Ok(None);
    }
    if u32le(&mut data)? != 0 || u32le(&mut data)? != 0 {
        return Ok(None);
    }
    let records = u32le(&mut data)? as usize;
    let table1 = u32le(&mut data)? as usize;
    let table3 = u32le(&mut data)? as usize;
    let keys_at = u32le(&mut data)? as usize;
    let repeated_records = u32le(&mut data)? as usize;
    let table2 = u32le(&mut data)? as usize;
    if records > MAX_RECORDS {
        return Err("sims_limit");
    }
    if records != repeated_records
        || keys_at != 40
        || table1 < 44
        || table1.checked_add(records * 8) != Some(table2)
        || table2.checked_add((records + 1) * 12) != Some(table3)
        || table3 > bundle.len()
    {
        return Err(FORMAT);
    }
    let count = u32le(&mut data)? as usize;
    if count > MAX_KEYS {
        return Err("sims_limit");
    }
    if 44 + count * 16 > table1 {
        return Err(FORMAT);
    }
    let mut keys = BTreeSet::new();
    for index in 0..count {
        if index % 256 == 0 {
            check()?;
        }
        let key = Key {
            kind: u32le(&mut data)?,
            group: u32le(&mut data)?,
            instance: u64::from_le_bytes(take(&mut data, 8)?.try_into().map_err(|_| FORMAT)?),
        };
        if key.kind == 0 && key.group == 0 && key.instance == 0 {
            continue;
        }
        if key.kind == 0 || key.instance == 0 {
            return Err(FORMAT);
        }
        keys.insert(key);
    }
    check()?;
    Ok(Some(keys))
}

#[cfg(test)]
#[path = "sims_cc_architecture_tests.rs"]
mod tests;
