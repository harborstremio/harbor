//! Read SMAPI's documented manifest fields without loading mod assemblies.
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub type Result<T> = std::result::Result<T, &'static str>;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dependency {
    pub id: String,
    pub minimum: Option<String>,
    pub required: bool,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub id: String,
    pub name: String,
    pub author: String,
    pub description: String,
    pub version: String,
    pub entry_dll: Option<String>,
    pub content_pack_for: Option<String>,
    pub minimum_api: Option<String>,
    pub minimum_game: Option<String>,
    pub dependencies: Vec<Dependency>,
    pub update_keys: Vec<String>,
    pub unsupported_keys: bool,
}
fn text(value: &Value, key: &str, limit: usize) -> Result<Option<String>> {
    match field(value, key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(s))
            if s.len() <= limit
                && !s
                    .chars()
                    .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t')) =>
        {
            Ok(Some(s.split_whitespace().collect::<Vec<_>>().join(" ")))
        }
        _ => Err("stardew_manifest"),
    }
}
fn field<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    value.get(key).or_else(|| {
        value
            .as_object()?
            .iter()
            .find(|(name, _)| name.eq_ignore_ascii_case(key))
            .map(|(_, v)| v)
    })
}
fn required(value: &Value, key: &str, limit: usize) -> Result<String> {
    text(value, key, limit)?
        .filter(|s| !s.is_empty())
        .ok_or("stardew_manifest")
}
fn dependency(value: &Value, force: bool) -> Result<Dependency> {
    Ok(Dependency {
        id: required(value, "UniqueID", 256)?,
        minimum: text(value, "MinimumVersion", 80)?.filter(|s| !s.is_empty()),
        required: if force {
            true
        } else {
            match field(value, "IsRequired") {
                None | Some(Value::Null) => true,
                Some(Value::Bool(v)) => *v,
                _ => return Err("stardew_manifest"),
            }
        },
    })
}
pub fn update_key(value: &str) -> Option<String> {
    if value.len() > 180 {
        return None;
    }
    let (kind, id) = value.split_once(':')?;
    let kind = kind.to_ascii_lowercase();
    if ["nexus", "moddrop", "curseforge", "chucklefish"].contains(&kind.as_str()) {
        return (!id.is_empty()
            && id.len() <= 12
            && id.bytes().all(|c| c.is_ascii_digit())
            && id.parse::<u64>().ok()? > 0)
            .then(|| format!("{kind}:{id}"));
    }
    if kind == "github" {
        let (owner, repo) = id.split_once('/')?;
        if !owner.is_empty()
            && owner.len() <= 39
            && owner
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-')
            && !repo.is_empty()
            && repo.len() <= 100
            && repo != "."
            && repo != ".."
            && repo
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'.' | b'_' | b'-'))
        {
            return Some(format!("github:{owner}/{repo}"));
        }
    }
    None
}
// Newtonsoft JSON permits comments and trailing commas. Preserve quoted text
// (including URLs and escaped quotes) instead of stripping with a regex.
fn json(input: &str) -> Result<Value> {
    let mut out = input.trim_start_matches('\u{feff}').as_bytes().to_vec();
    let mut i = 0;
    let mut quoted = false;
    let mut escaped = false;
    while i < out.len() {
        if quoted {
            if escaped {
                escaped = false;
            } else if out[i] == b'\\' {
                escaped = true;
            } else if out[i] == b'"' {
                quoted = false;
            }
            i += 1;
            continue;
        }
        if out[i] == b'"' {
            quoted = true;
            i += 1;
            continue;
        }
        if out.get(i..i + 2) == Some(b"//") {
            while i < out.len() && out[i] != b'\n' {
                out[i] = b' ';
                i += 1;
            }
        } else if out.get(i..i + 2) == Some(b"/*") {
            out[i] = b' ';
            out[i + 1] = b' ';
            i += 2;
            while i + 1 < out.len() && &out[i..i + 2] != b"*/" {
                out[i] = b' ';
                i += 1;
            }
            if i + 1 >= out.len() {
                return Err("stardew_manifest");
            }
            out[i] = b' ';
            out[i + 1] = b' ';
            i += 2;
        } else {
            i += 1;
        }
    }
    if quoted {
        return Err("stardew_manifest");
    }
    i = 0;
    quoted = false;
    escaped = false;
    while i < out.len() {
        if quoted {
            if escaped {
                escaped = false;
            } else if out[i] == b'\\' {
                escaped = true;
            } else if out[i] == b'"' {
                quoted = false;
            }
        } else if out[i] == b'"' {
            quoted = true;
        } else if out[i] == b',' {
            let mut next = i + 1;
            while next < out.len() && out[next].is_ascii_whitespace() {
                next += 1;
            }
            if matches!(out.get(next), Some(b'}' | b']')) {
                out[i] = b' ';
            }
        }
        i += 1;
    }
    serde_json::from_slice(&out).map_err(|_| "stardew_manifest")
}
pub fn parse(bytes: &[u8]) -> Result<Manifest> {
    if bytes.len() > 256 * 1024 {
        return Err("stardew_limit");
    }
    let v = json(std::str::from_utf8(bytes).map_err(|_| "stardew_manifest")?)?;
    let entry = text(&v, "EntryDll", 240)?.filter(|s| !s.is_empty());
    let pack = field(&v, "ContentPackFor")
        .filter(|v| !v.is_null())
        .map(|v| dependency(v, true))
        .transpose()?;
    if entry.is_some() == pack.is_some() {
        return Err("stardew_manifest");
    }
    if entry.as_ref().is_some_and(|s| !safe_relative(s)) {
        return Err("stardew_manifest");
    }
    let mut dependencies = Vec::new();
    if let Some(pack) = &pack {
        dependencies.push(pack.clone());
    }
    if let Some(d) = field(&v, "Dependencies").filter(|v| !v.is_null()) {
        let items = d
            .as_array()
            .filter(|v| v.len() <= 64)
            .ok_or("stardew_manifest")?;
        for value in items {
            dependencies.push(dependency(value, false)?);
        }
    }
    let mut update_keys = Vec::new();
    let mut unsupported_keys = false;
    if let Some(keys) = field(&v, "UpdateKeys").filter(|v| !v.is_null()) {
        let keys = keys
            .as_array()
            .filter(|v| v.len() <= 32)
            .ok_or("stardew_manifest")?;
        for key in keys {
            match key.as_str().and_then(update_key) {
                Some(value) => {
                    if !update_keys.contains(&value) {
                        update_keys.push(value);
                    }
                }
                None => unsupported_keys = true,
            }
        }
    }
    Ok(Manifest {
        id: required(&v, "UniqueID", 256)?,
        name: required(&v, "Name", 300)?,
        author: required(&v, "Author", 300)?,
        description: text(&v, "Description", 4000)?.unwrap_or_default(),
        version: required(&v, "Version", 80)?,
        entry_dll: entry,
        content_pack_for: pack.map(|v| v.id),
        minimum_api: text(&v, "MinimumApiVersion", 80)?.filter(|s| !s.is_empty()),
        minimum_game: text(&v, "MinimumGameVersion", 80)?.filter(|s| !s.is_empty()),
        dependencies,
        update_keys,
        unsupported_keys,
    })
}
pub fn safe_relative(value: &str) -> bool {
    !value.is_empty()
        && !value.starts_with(['/', '\\'])
        && !value.contains(':')
        && !value.chars().any(char::is_control)
        && value
            .split(['/', '\\'])
            .all(|v| !v.is_empty() && v != "." && v != "..")
}
pub fn stable_version(value: &str) -> Option<[u32; 3]> {
    let value = value.split_once('+').map_or(value, |(v, _)| v);
    let parts = value.split('.').collect::<Vec<_>>();
    if !(1..=4).contains(&parts.len())
        || parts
            .iter()
            .any(|s| s.is_empty() || s.len() > 9 || !s.bytes().all(|c| c.is_ascii_digit()))
    {
        return None;
    }
    if parts.len() == 4 && parts[3] != "0" {
        return None;
    }
    Some([
        parts[0].parse().ok()?,
        parts.get(1).unwrap_or(&"0").parse().ok()?,
        parts.get(2).unwrap_or(&"0").parse().ok()?,
    ])
}
pub fn satisfies(installed: &str, minimum: Option<&str>) -> Option<bool> {
    let Some(minimum) = minimum else {
        return Some(true);
    };
    if installed == minimum {
        return Some(true);
    }
    // Nonstandard/prerelease comparisons stay unconfirmed rather than making
    // a different ordering decision from SMAPI's version implementation.
    Some(stable_version(installed)? >= stable_version(minimum)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn manifest_keeps_pack_dependencies_and_filters_network_keys() {
        let m=parse(br#"{"Name":"Farm","Author":"A","UniqueID":"A.Farm","Version":"1.2.0",// a comment
          "Description":"https://example.com/a/*b*/","ContentPackFor":{"UniqueID":"Pathoschild.ContentPatcher","MinimumVersion":"2.0"},
          "Dependencies":[{"UniqueID":"A.Optional","IsRequired":false},],"UpdateKeys":["Nexus:1915","GitHub:Pathoschild/StardewMods","https://private.example/token","UpdateManifest:https://private.example/"],}"#).unwrap();
        assert_eq!(m.dependencies.len(), 2);
        assert!(m.dependencies[0].required);
        assert!(!m.dependencies[1].required);
        assert_eq!(m.description, "https://example.com/a/*b*/");
        assert_eq!(m.update_keys.len(), 2);
        assert!(m.unsupported_keys);
        assert!(parse(br#"{/* unterminated"#).is_err());
        assert!(parse(
            br#"{"Name":"X","Author":"A","UniqueID":"A.X","Version":"1","EntryDll":"../x.dll"}"#
        )
        .is_err());
    }
    #[test]
    fn stable_versions_do_not_guess_prerelease_order() {
        assert_eq!(satisfies("2.9.1", Some("2.0")), Some(true));
        assert_eq!(satisfies("2.0", Some("2.9.1")), Some(false));
        assert_eq!(satisfies("4.5.2.0", Some("4.5.2")), Some(true));
        assert_eq!(satisfies("4.5.2+abc", Some("4.5.2")), Some(true));
        assert_eq!(satisfies("1.6.15.1234", Some("1.6.15")), None);
        assert_eq!(satisfies("1.0-beta.2", Some("1.0-beta.1")), None);
        assert_eq!(satisfies("1.0-beta.2", Some("1.0-beta.2")), Some(true));
        for k in [
            "Nexus:0",
            "Nexus:1?secret=x",
            "GitHub:owner/repo/token",
            "GitHub:owner/../repo",
        ] {
            assert!(update_key(k).is_none());
        }
    }
}
