//! Bounded protobuf wire reader for Sims content inspection; never executes data.
pub type Result<T> = std::result::Result<T, &'static str>;
const FORMAT: &str = "sims_tray_format";

#[derive(Clone, Copy, Debug)]
pub enum Value<'a> {
    Varint(u64),
    Fixed64(u64),
    Fixed32(u32),
    Bytes(&'a [u8]),
}
pub type Message<'a> = Vec<(u32, Value<'a>)>;

pub struct Reader<'a> {
    remaining: usize,
    check: &'a dyn Fn() -> Result<()>,
}
impl<'a> Reader<'a> {
    pub fn new(check: &'a dyn Fn() -> Result<()>) -> Self {
        Self {
            remaining: 200_000,
            check,
        }
    }
    pub fn step(&mut self) -> Result<()> {
        if self.remaining == 0 {
            return Err("sims_limit");
        }
        if self.remaining % 256 == 0 {
            (self.check)()?;
        }
        self.remaining -= 1;
        Ok(())
    }
    pub fn message<'b>(&mut self, mut data: &'b [u8]) -> Result<Message<'b>> {
        (self.check)()?;
        let mut fields = Vec::new();
        while !data.is_empty() {
            self.step()?;
            if fields.len() >= 10_000 {
                return Err("sims_limit");
            }
            let key = varint(&mut data)?;
            if !(1..=0x1fff_ffff).contains(&(key >> 3)) {
                return Err(FORMAT);
            }
            let value = match key & 7 {
                0 => Value::Varint(varint(&mut data)?),
                1 => Value::Fixed64(u64::from_le_bytes(
                    take(&mut data, 8)?.try_into().map_err(|_| FORMAT)?,
                )),
                2 => {
                    let count = usize::try_from(varint(&mut data)?).map_err(|_| FORMAT)?;
                    Value::Bytes(take(&mut data, count)?)
                }
                5 => Value::Fixed32(u32::from_le_bytes(
                    take(&mut data, 4)?.try_into().map_err(|_| FORMAT)?,
                )),
                _ => return Err(FORMAT),
            };
            fields.push(((key >> 3) as u32, value));
        }
        Ok(fields)
    }
    pub fn ids(&mut self, fields: &Message<'_>, key: u32, fixed: bool) -> Result<Vec<u64>> {
        let mut values = Vec::new();
        for (_, value) in fields.iter().filter(|(n, _)| *n == key) {
            self.step()?;
            match (fixed, value) {
                (true, Value::Fixed64(v)) | (false, Value::Varint(v)) => values.push(*v),
                (_, Value::Bytes(bytes)) => {
                    let mut rest = *bytes;
                    while !rest.is_empty() {
                        self.step()?;
                        values.push(if fixed {
                            u64::from_le_bytes(take(&mut rest, 8)?.try_into().map_err(|_| FORMAT)?)
                        } else {
                            varint(&mut rest)?
                        });
                    }
                }
                _ => return Err(FORMAT),
            }
        }
        Ok(values)
    }
}
fn take<'a>(data: &mut &'a [u8], count: usize) -> Result<&'a [u8]> {
    let value = data.get(..count).ok_or(FORMAT)?;
    *data = &data[count..];
    Ok(value)
}
fn varint(data: &mut &[u8]) -> Result<u64> {
    let mut value = 0;
    for shift in (0..70).step_by(7) {
        let byte = take(data, 1)?[0];
        if shift == 63 && byte > 1 {
            return Err(FORMAT);
        }
        value |= u64::from(byte & 127) << shift;
        if byte & 128 == 0 {
            return Ok(value);
        }
    }
    Err(FORMAT)
}
pub fn one<'a>(fields: &Message<'a>, key: u32) -> Result<Option<Value<'a>>> {
    let mut found = fields.iter().filter(|(n, _)| *n == key);
    let value = found.next().map(|(_, value)| *value);
    if found.next().is_some() {
        return Err(FORMAT);
    }
    Ok(value)
}
pub fn bytes<'a>(fields: &Message<'a>, key: u32) -> Result<Option<&'a [u8]>> {
    match one(fields, key)? {
        Some(Value::Bytes(v)) => Ok(Some(v)),
        None => Ok(None),
        _ => Err(FORMAT),
    }
}
pub fn number(fields: &Message<'_>, key: u32, fixed: bool) -> Result<Option<u64>> {
    match (fixed, one(fields, key)?) {
        (true, Some(Value::Fixed64(v))) | (false, Some(Value::Varint(v))) => Ok(Some(v)),
        (_, None) => Ok(None),
        _ => Err(FORMAT),
    }
}
pub fn messages<'a>(fields: &Message<'a>, key: u32) -> Result<Vec<&'a [u8]>> {
    fields
        .iter()
        .filter(|(n, _)| *n == key)
        .map(|(_, value)| match value {
            Value::Bytes(v) => Ok(*v),
            _ => Err(FORMAT),
        })
        .collect()
}
pub fn text(fields: &Message<'_>, key: u32) -> Result<String> {
    let raw = bytes(fields, key)?.unwrap_or_default();
    if raw.len() > 512 {
        return Err("sims_limit");
    }
    let value = std::str::from_utf8(raw).map_err(|_| FORMAT)?;
    if value.chars().any(char::is_control) {
        return Err(FORMAT);
    }
    Ok(value.into())
}
