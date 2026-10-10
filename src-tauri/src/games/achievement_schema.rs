//! Bounded reader for Steam's local binary KeyValues achievement permissions.
use std::{collections::BTreeMap, fs, io::Read, path::Path};

type Result<T> = std::result::Result<T, &'static str>;
#[derive(Debug)]
enum Value {
    Text(String),
    Integer(i64),
    Object(Vec<(String, Value)>),
    Other,
}
impl Value {
    fn get(&self, key: &str) -> Option<&Self> {
        match self {
            Self::Object(v) => v
                .iter()
                .rev()
                .find(|(k, _)| k.eq_ignore_ascii_case(key))
                .map(|(_, v)| v),
            _ => None,
        }
    }
    fn text(&self) -> Option<&str> {
        if let Self::Text(v) = self {
            Some(v)
        } else {
            None
        }
    }
    fn integer(&self) -> Option<i64> {
        match self {
            Self::Integer(v) => Some(*v),
            Self::Text(v) => v.parse().ok(),
            _ => None,
        }
    }
    fn entries(&self) -> &[(String, Self)] {
        if let Self::Object(v) = self {
            v
        } else {
            &[]
        }
    }
}
struct Reader<'a> {
    data: &'a [u8],
    at: usize,
    nodes: usize,
}
impl Reader<'_> {
    fn take(&mut self, n: usize) -> Result<&[u8]> {
        let bytes = self
            .data
            .get(self.at..self.at.checked_add(n).ok_or("achievement_schema")?)
            .ok_or("achievement_schema")?;
        self.at += n;
        Ok(bytes)
    }
    fn string(&mut self) -> Result<String> {
        let n = self.data[self.at..]
            .iter()
            .take(65537)
            .position(|v| *v == 0)
            .ok_or("achievement_schema")?;
        let result = std::str::from_utf8(self.take(n)?)
            .map_err(|_| "achievement_schema")?
            .to_owned();
        self.take(1)?;
        Ok(result)
    }
    fn object(&mut self, depth: usize) -> Result<Value> {
        if depth > 32 {
            return Err("achievement_schema");
        }
        let mut entries = Vec::new();
        loop {
            let kind = self.take(1)?[0];
            if kind == 8 {
                return Ok(Value::Object(entries));
            }
            self.nodes += 1;
            if self.nodes > 100_000 {
                return Err("achievement_schema");
            }
            let key = self.string()?;
            let value = match kind {
                0 => self.object(depth + 1)?,
                1 => Value::Text(self.string()?),
                2 => Value::Integer(i32::from_le_bytes(self.take(4)?.try_into().unwrap()) as i64),
                3 | 4 | 6 => {
                    self.take(4)?;
                    Value::Other
                }
                7 => {
                    self.take(8)?;
                    Value::Other
                }
                10 => Value::Integer(i64::from_le_bytes(self.take(8)?.try_into().unwrap())),
                _ => return Err("achievement_schema"),
            };
            entries.push((key, value));
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Definition {
    pub editable: bool,
    pub icon: String,
    pub locked_icon: String,
}

fn icon(value: Option<&Value>, app_id: u32) -> String {
    let Some(hash) = value.and_then(Value::text) else {
        return String::new();
    };
    // Steam schema icons are content hashes, never file paths or executable URLs.
    if hash.len() != 44
        || !hash.ends_with(".jpg")
        || !hash[..40].bytes().all(|b| b.is_ascii_hexdigit())
    {
        return String::new();
    }
    format!("https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/{app_id}/{hash}")
}
pub fn parse(bytes: &[u8], app_id: u32) -> Result<BTreeMap<String, Definition>> {
    if bytes.len() > 4 * 1024 * 1024 || app_id == 0 {
        return Err("achievement_schema");
    }
    let mut reader = Reader {
        data: bytes,
        at: 0,
        nodes: 0,
    };
    let root = reader.object(0)?;
    if reader.at != bytes.len() {
        return Err("achievement_schema");
    }
    let stats = root
        .get(&app_id.to_string())
        .and_then(|v| v.get("stats"))
        .ok_or("achievement_schema")?;
    let mut output = BTreeMap::new();
    for (_, stat) in stats.entries() {
        for (_, bits) in stat
            .entries()
            .iter()
            .filter(|(k, _)| k.eq_ignore_ascii_case("bits"))
        {
            for (_, bit) in bits.entries() {
                let id = bit
                    .get("name")
                    .and_then(Value::text)
                    .filter(|id| !id.is_empty() && id.len() <= 256)
                    .ok_or("achievement_schema")?;
                // Unknown or future permission values are read-only. Missing permission is Steam's client default.
                let allowed = |v: Option<&Value>| v.map_or(true, |v| v.integer() == Some(0));
                let editable = allowed(bit.get("permission"))
                    && allowed(stat.get("permission"))
                    && allowed(bit.get("bSetByTrustedGS"))
                    && allowed(stat.get("bSetByTrustedGS"));
                let display = bit.get("display");
                let def = Definition {
                    editable,
                    icon: icon(display.and_then(|v| v.get("icon")), app_id),
                    locked_icon: icon(display.and_then(|v| v.get("icon_gray")), app_id),
                };
                if output.insert(id.to_owned(), def).is_some() || output.len() > 10_000 {
                    return Err("achievement_schema");
                }
            }
        }
    }
    Ok(output)
}
pub fn read(root: &Path, app_id: u32) -> Result<BTreeMap<String, Definition>> {
    let root = root.canonicalize().map_err(|_| "achievement_schema")?;
    let path = root
        .join(format!("appcache/stats/UserGameStatsSchema_{app_id}.bin"))
        .canonicalize()
        .map_err(|_| "achievement_schema")?;
    if !path.starts_with(&root) {
        return Err("achievement_schema");
    }
    let file = fs::File::open(path).map_err(|_| "achievement_schema")?;
    let mut data = Vec::new();
    file.take(4 * 1024 * 1024 + 1)
        .read_to_end(&mut data)
        .map_err(|_| "achievement_schema")?;
    parse(&data, app_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn text(k: &str, v: &str) -> Vec<u8> {
        [
            vec![1],
            k.as_bytes().to_vec(),
            vec![0],
            v.as_bytes().to_vec(),
            vec![0],
        ]
        .concat()
    }
    fn obj(k: &str, v: Vec<u8>) -> Vec<u8> {
        [vec![0], k.as_bytes().to_vec(), vec![0], v, vec![8]].concat()
    }
    fn schema(bits: Vec<u8>) -> Vec<u8> {
        [
            obj("123", obj("stats", obj("1", obj("bits", bits)))),
            vec![8],
        ]
        .concat()
    }
    #[test]
    fn permissions_are_explicit_and_duplicates_rejected() {
        let data = schema(
            [
                obj("0", text("name", "first")),
                obj(
                    "1",
                    [text("name", "server"), text("permission", "1")].concat(),
                ),
            ]
            .concat(),
        );
        let values = parse(&data, 123).unwrap();
        assert!(values["first"].editable);
        assert!(!values["server"].editable);
        assert!(parse(&data, 456).is_err());
        assert!(parse(
            &schema(
                [
                    obj("0", text("name", "same")),
                    obj("1", text("name", "same"))
                ]
                .concat()
            ),
            123
        )
        .is_err());
        assert!(
            !parse(
                &schema(obj(
                    "0",
                    [text("name", "future"), text("permission", "nonsense")].concat()
                )),
                123
            )
            .unwrap()["future"]
                .editable
        );
    }
    #[test]
    fn truncated_nested_and_oversized_inputs_fail_closed() {
        let data = schema(obj("0", text("name", "first")));
        for end in 0..data.len() {
            assert!(parse(&data[..end], 123).is_err());
        }
        assert!(parse(&vec![0; 4 * 1024 * 1024 + 1], 123).is_err());
        let mut nest = text("name", "first");
        for _ in 0..40 {
            nest = obj("0", nest);
        }
        assert!(parse(&schema(nest), 123).is_err());
    }
}
