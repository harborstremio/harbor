//! Minimal, bounded TrayMetadata reader. Field numbers follow Exchange.proto:
//! https://github.com/Llama-Logic/LlamaLogic/blob/main/LlamaLogic.Protobuf/Protos/Exchange.proto
use super::*;

enum Value<'a> {
    Number(u64),
    Bytes(&'a [u8]),
    Other,
}
type Field<'a> = (u64, Value<'a>);
fn varint(data: &mut &[u8]) -> Result<u64> {
    let mut value = 0u64;
    for shift in (0..70).step_by(7) {
        let (&byte, tail) = data.split_first().ok_or("sims_tray_format")?;
        *data = tail;
        if shift == 63 && byte > 1 {
            return Err("sims_tray_format");
        }
        value |= u64::from(byte & 0x7f) << shift;
        if byte & 0x80 == 0 {
            return Ok(value);
        }
    }
    Err("sims_tray_format")
}
fn fields(mut data: &[u8]) -> Result<Vec<Field<'_>>> {
    let mut result = vec![];
    while !data.is_empty() {
        if result.len() >= 10_000 {
            return Err("sims_limit");
        }
        let key = varint(&mut data)?;
        if key >> 3 == 0 || key >> 3 > 0x1fff_ffff {
            return Err("sims_tray_format");
        }
        let value = match key & 7 {
            0 => Value::Number(varint(&mut data)?),
            1 | 5 => {
                let count = if key & 7 == 1 { 8 } else { 4 };
                data = data.get(count..).ok_or("sims_tray_format")?;
                Value::Other
            }
            2 => {
                let count = usize::try_from(varint(&mut data)?).map_err(|_| "sims_tray_format")?;
                let bytes = data.get(..count).ok_or("sims_tray_format")?;
                data = &data[count..];
                Value::Bytes(bytes)
            }
            _ => return Err("sims_tray_format"),
        };
        result.push((key >> 3, value));
    }
    Ok(result)
}
fn number(values: &[Field<'_>], key: u64) -> Result<u64> {
    let mut found = values.iter().filter(|(n, _)| *n == key);
    let value = match found.next() {
        Some((_, Value::Number(n))) => *n,
        _ => return Err("sims_tray_format"),
    };
    if found.next().is_some() {
        return Err("sims_tray_format");
    }
    Ok(value)
}
fn message<'a>(values: &[Field<'a>], key: u64) -> Result<&'a [u8]> {
    let mut found = values.iter().filter(|(n, _)| *n == key);
    let value = match found.next() {
        Some((_, Value::Bytes(b))) => *b,
        _ => return Err("sims_tray_format"),
    };
    if found.next().is_some() {
        return Err("sims_tray_format");
    }
    Ok(value)
}
pub(super) fn validate_household(payload: &[Payload]) -> Result<()> {
    let item = payload
        .iter()
        .find(|f| extension(&f.name.to_ascii_lowercase()) == "trayitem")
        .ok_or("sims_tray_set")?;
    let bytes = &item.bytes;
    if bytes.len() < 8 || bytes.len() > 4 * 1024 * 1024 || bytes[..4] != [0, 0, 0, 0] {
        return Err("sims_tray_format");
    }
    let length =
        u32::from_le_bytes(bytes[4..8].try_into().map_err(|_| "sims_tray_format")?) as usize;
    if length != bytes.len() - 8 {
        return Err("sims_tray_format");
    }
    let metadata = fields(&bytes[8..])?;
    let id = identity(&item.name)?;
    if number(&metadata, 1)? != u64::from_str_radix(&id[2..], 16).map_err(|_| "sims_tray_format")?
        || number(&metadata, 2)? != 1
    {
        return Err("sims_tray_set");
    }
    let specific = fields(message(&metadata, 10)?)?;
    let household = fields(message(&specific, 2)?)?;
    let mut expected = BTreeSet::new();
    let mut ids = BTreeSet::new();
    for (i, (_, sim)) in household.iter().filter(|(n, _)| *n == 2).enumerate() {
        if i >= 256 {
            return Err("sims_limit");
        }
        let Value::Bytes(sim) = sim else {
            return Err("sims_tray_format");
        };
        let id = number(&fields(sim)?, 5)?;
        if !ids.insert(id) {
            return Err("sims_tray_set");
        }
        expected.insert(format!("0x{:08x}!0x{id:016x}.sgi", ((i + 1) << 4) | 3));
    }
    if ids.is_empty()
        || household.iter().any(|(n, _)| *n == 1) && number(&household, 1)? != ids.len() as u64
    {
        return Err("sims_tray_set");
    }
    // Individual portraits are optional; when included, their index and Sim ID
    // must belong to this household. Do not join arbitrary files by extension.
    for file in payload
        .iter()
        .filter(|f| extension(&f.name.to_ascii_lowercase()) == "sgi")
    {
        if !expected.contains(&file.name.to_ascii_lowercase()) {
            return Err("sims_tray_set");
        }
    }
    Ok(())
}
