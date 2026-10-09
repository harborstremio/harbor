//! Validated classic lot/room references. Format evidence: SIMS-LOT-CONTENT.md.
//! Layout evidence is recorded in Sims lot/room research; unknown architecture
//! and object attributes remain explicit gaps, never a complete CC verdict.
use super::household::wire;
use std::collections::BTreeSet;
use wire::{Reader, Result};
const FORMAT: &str = "sims_tray_format";
const MAX_FILE: usize = 8 * 1024 * 1024;
const MAX_EXPANDED: usize = 32 * 1024 * 1024;

#[path = "sims_cc_architecture.rs"]
mod architecture;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Lot,
    Room,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Key {
    pub kind: u32,
    pub group: u32,
    pub instance: u64,
}
#[derive(Debug, PartialEq, Eq)]
pub struct Object {
    #[cfg(test)]
    pub id: u64,
    pub definition: u64,
    pub model: Option<Key>,
}
#[derive(Debug)]
pub struct Content {
    pub objects: Vec<Object>,
    pub declared: BTreeSet<Key>,
    pub architecture_bytes: usize,
    pub object_attributes: bool,
    pub other_fields: bool,
}

fn take<'a>(data: &mut &'a [u8], size: usize) -> Result<&'a [u8]> {
    let part = data.get(..size).ok_or(FORMAT)?;
    *data = &data[size..];
    Ok(part)
}
fn u32le(data: &mut &[u8]) -> Result<u32> {
    Ok(u32::from_le_bytes(
        take(data, 4)?.try_into().map_err(|_| FORMAT)?,
    ))
}
fn variable32(data: &mut &[u8]) -> Result<u32> {
    let mut n = 0;
    for i in 0..5 {
        let v = take(data, 1)?[0];
        if i == 4 && v > 15 {
            return Err(FORMAT);
        }
        n |= u32::from(v & 127) << (i * 7);
        if v & 128 == 0 {
            return Ok(n);
        }
    }
    Err(FORMAT)
}
/// Google Snappy raw-block format. Exact input/output consumption, bounded
/// allocation, and cooperative cancellation also during overlapping copies.
fn expand(mut data: &[u8], check: &dyn Fn() -> Result<()>) -> Result<Vec<u8>> {
    check()?;
    let size = variable32(&mut data)? as usize;
    if size > MAX_EXPANDED {
        return Err("sims_limit");
    }
    let mut out = Vec::new();
    out.try_reserve_exact(size).map_err(|_| "sims_limit")?;
    let mut operations = 0;
    while !data.is_empty() {
        if operations % 256 == 0 {
            check()?;
        }
        operations += 1;
        let tag = take(&mut data, 1)?[0];
        let kind = tag & 3;
        if kind == 0 {
            let encoded = usize::from(tag >> 2);
            let length = if encoded < 60 {
                encoded + 1
            } else {
                let mut bytes = [0; 4];
                let n = encoded - 59;
                bytes[..n].copy_from_slice(take(&mut data, n)?);
                (u32::from_le_bytes(bytes) as usize)
                    .checked_add(1)
                    .ok_or(FORMAT)?
            };
            if length > size - out.len() {
                return Err(FORMAT);
            }
            // Chunk large literals so cancellation does not wait for a whole block.
            for bytes in take(&mut data, length)?.chunks(64 * 1024) {
                check()?;
                out.extend_from_slice(bytes);
            }
        } else {
            let (offset, length) = match kind {
                1 => (
                    (usize::from(tag & 0xe0) << 3) | usize::from(take(&mut data, 1)?[0]),
                    4 + usize::from((tag >> 2) & 7),
                ),
                2 => (
                    usize::from(u16::from_le_bytes(
                        take(&mut data, 2)?.try_into().map_err(|_| FORMAT)?,
                    )),
                    1 + usize::from(tag >> 2),
                ),
                _ => (u32le(&mut data)? as usize, 1 + usize::from(tag >> 2)),
            };
            if offset == 0 || offset > out.len() || length > size - out.len() {
                return Err(FORMAT);
            }
            for _ in 0..length {
                out.push(out[out.len() - offset]);
            }
        }
    }
    check()?;
    if out.len() != size {
        return Err(FORMAT);
    }
    Ok(out)
}
fn framed(data: &[u8], version: u32) -> Result<&[u8]> {
    if !(8..=MAX_FILE).contains(&data.len()) {
        return Err(FORMAT);
    }
    let mut rest = data;
    if u32le(&mut rest)? != version {
        return Err(FORMAT);
    }
    let len = u32le(&mut rest)? as usize;
    if len != rest.len() {
        return Err(FORMAT);
    }
    Ok(rest)
}
fn required(fields: &wire::Message<'_>, key: u32) -> Result<u64> {
    wire::number(fields, key, false)?
        .filter(|n| *n != 0)
        .ok_or(FORMAT)
}
fn key(reader: &mut Reader<'_>, data: &[u8]) -> Result<Key> {
    let fields = reader.message(data)?;
    if fields.iter().any(|(n, _)| !(1..=3).contains(n)) {
        return Err(FORMAT);
    }
    Ok(Key {
        kind: u32::try_from(required(&fields, 1)?).map_err(|_| FORMAT)?,
        group: u32::try_from(wire::number(&fields, 2, false)?.unwrap_or(0)).map_err(|_| FORMAT)?,
        instance: required(&fields, 3)?,
    })
}
pub fn read(
    data: &[u8],
    metadata: &[u8],
    expected: u64,
    kind: Kind,
    check: &dyn Fn() -> Result<()>,
) -> Result<Content> {
    check()?;
    let mut reader = Reader::new(check);
    let meta = reader.message(framed(metadata, 0)?)?;
    if expected == 0
        || required(&meta, 1)? != expected
        || required(&meta, 2)? != if kind == Kind::Lot { 2 } else { 3 }
    {
        return Err("sims_tray_set");
    }
    let specific = reader.message(wire::bytes(&meta, 10)?.ok_or(FORMAT)?)?;
    let specific_kind = if kind == Kind::Lot { 1 } else { 7 };
    reader.message(wire::bytes(&specific, specific_kind)?.ok_or(FORMAT)?)?;
    wire::text(&meta, 4)?;
    let body = expand(framed(data, 1)?, check)?;
    let mut rest = body.as_slice();
    let mut declared = BTreeSet::new();
    if kind == Kind::Lot {
        if u32le(&mut rest)? != 0xfea1_baad || u32le(&mut rest)? != 2 {
            return Err(FORMAT);
        }
    } else {
        if u32le(&mut rest)? != 13 {
            return Err(FORMAT);
        }
        let size = u32le(&mut rest)? as usize;
        let fields = reader.message(take(&mut rest, size)?)?;
        if fields.iter().any(|(n, _)| *n != 1) {
            return Err(FORMAT);
        }
        for raw in wire::messages(&fields, 1)? {
            reader.step()?;
            declared.insert(key(&mut reader, raw)?);
        }
        if u32le(&mut rest)? != 1 {
            return Err(FORMAT);
        }
    }
    let size = u32le(&mut rest)? as usize;
    let fields = reader.message(take(&mut rest, size)?)?;
    let mut other_fields = fields.iter().any(|(n, _)| !matches!(n, 1 | 2));
    // Lot IDs are world-local, not the Gallery creation ID. Only the metadata
    // and reviewed filename supply the latter. Never equate those identities.
    wire::number(&fields, 1, false)?;
    let mut objects = Vec::new();
    let mut identities = BTreeSet::new();
    let mut object_attributes = false;
    for raw in wire::messages(&fields, 2)? {
        reader.step()?;
        if objects.len() >= 20_000 {
            return Err("sims_limit");
        }
        let object = reader.message(raw)?;
        let id = required(&object, 1)?;
        if !identities.insert(id) {
            return Err("sims_tray_set");
        }
        let old = wire::number(&object, 4, false)?;
        let new = wire::number(&object, 15, false)?;
        if old.is_some_and(|n| n > u32::MAX as u64)
            || old
                .zip(new)
                .is_some_and(|(a, b)| a != 0 && b != 0 && a != b)
        {
            return Err(FORMAT);
        }
        let definition = new
            .filter(|v| *v != 0)
            .or(old.filter(|v| *v != 0))
            .ok_or(FORMAT)?;
        let model = wire::bytes(&object, 17)?
            .map(|raw| key(&mut reader, raw))
            .transpose()?;
        object_attributes |= wire::bytes(&object, 21)?.is_some_and(|v| !v.is_empty());
        other_fields |= object.iter().any(|(n, _)| !matches!(n, 1 | 3..=24));
        objects.push(Object {
            #[cfg(test)]
            id,
            definition,
            model,
        });
    }
    if kind == Kind::Lot {
        if let Some(keys) = architecture::read(rest, check)? {
            declared.extend(keys);
        }
    }
    check()?;
    Ok(Content {
        objects,
        declared,
        architecture_bytes: rest.len(),
        object_attributes,
        other_fields,
    })
}

#[cfg(test)]
#[path = "sims_cc_build_tests.rs"]
mod tests;
