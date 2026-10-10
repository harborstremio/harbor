//! Read-only checks of Fabric's authoritative dependency declarations. No JAR is executed.
use super::modrinth::Result;
use serde_json::Value;
use std::{
    cmp::Ordering,
    collections::HashMap,
    fs,
    io::{Cursor, Read, Seek},
    path::Path,
};

#[derive(Clone, Debug)]
struct Module {
    id: String,
    version: String,
    provides: Vec<String>,
    depends: HashMap<String, Value>,
    breaks: HashMap<String, Value>,
}
fn id(value: &str) -> bool {
    (2..=64).contains(&value.len())
        && value.as_bytes()[0].is_ascii_lowercase()
        && value
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"_-".contains(&b))
}
fn numeric(value: &str) -> Option<(Vec<u64>, Option<&str>)> {
    let value = value.split('+').next()?;
    let (core, pre) = value
        .split_once('-')
        .map_or((value, None), |(a, b)| (a, Some(b)));
    let parts: Option<Vec<_>> = core
        .split('.')
        .map(|s| {
            if s.is_empty() || s.len() > 19 {
                None
            } else {
                s.parse::<u64>().ok()
            }
        })
        .collect();
    let parts = parts?;
    (parts.len() <= 8).then_some((parts, pre))
}
fn compare(left: &str, right: &str) -> Option<Ordering> {
    let (a, ap) = numeric(left)?;
    let (b, bp) = numeric(right)?;
    for i in 0..a.len().max(b.len()) {
        let order = a.get(i).unwrap_or(&0).cmp(b.get(i).unwrap_or(&0));
        if !order.is_eq() {
            return Some(order);
        }
    }
    match (ap, bp) {
        (None, None) => Some(Ordering::Equal),
        (None, Some(_)) => Some(Ordering::Greater),
        (Some(_), None) => Some(Ordering::Less),
        (Some(a), Some(b)) => {
            let a: Vec<_> = a.split('.').collect();
            let b: Vec<_> = b.split('.').collect();
            for i in 0..a.len().max(b.len()) {
                let (Some(a), Some(b)) = (a.get(i), b.get(i)) else {
                    return Some(a.len().cmp(&b.len()));
                };
                let order = match (a.parse::<u64>(), b.parse::<u64>()) {
                    (Ok(a), Ok(b)) => a.cmp(&b),
                    (Ok(_), Err(_)) => Ordering::Less,
                    (Err(_), Ok(_)) => Ordering::Greater,
                    _ => a.cmp(b),
                };
                if !order.is_eq() {
                    return Some(order);
                }
            }
            Some(Ordering::Equal)
        }
    }
}
fn predicate(version: &str, term: &str) -> Result<bool> {
    if term == "*" {
        return Ok(true);
    }
    let (op, expected) = [">=", "<=", ">", "<", "=", "~", "^"]
        .into_iter()
        .find_map(|op| term.strip_prefix(op).map(|value| (op, value)))
        .unwrap_or(("=", term));
    if expected.is_empty() {
        return Err("mods_embedded_metadata");
    }
    if expected
        .split('.')
        .any(|part| ["x", "X", "*"].contains(&part))
    {
        if op != "=" {
            return Err("mods_embedded_metadata");
        }
        let prefix: Vec<_> = expected
            .split('.')
            .take_while(|part| !["x", "X", "*"].contains(part))
            .collect();
        if expected
            .split('.')
            .skip(prefix.len())
            .any(|part| !["x", "X", "*"].contains(&part))
        {
            return Err("mods_embedded_metadata");
        }
        let (actual, _) = numeric(version).ok_or("mods_embedded_metadata")?;
        for (i, part) in prefix.iter().enumerate() {
            if part.parse::<u64>().map_err(|_| "mods_embedded_metadata")?
                != *actual.get(i).unwrap_or(&0)
            {
                return Ok(false);
            }
        }
        return Ok(true);
    }
    let Some(order) = compare(version, expected) else {
        return if op == "=" {
            Ok(version == expected)
        } else {
            Err("mods_embedded_metadata")
        };
    };
    Ok(match op {
        "=" => order.is_eq(),
        ">=" => !order.is_lt(),
        ">" => order.is_gt(),
        "<=" => !order.is_gt(),
        "<" => order.is_lt(),
        "^" | "~" => {
            let (mut upper, _) = numeric(expected).ok_or("mods_embedded_metadata")?;
            let index = if op == "^" || upper.len() == 1 { 0 } else { 1 };
            upper.resize(index + 1, 0);
            upper[index] = upper[index]
                .checked_add(1)
                .ok_or("mods_embedded_metadata")?;
            let upper = format!(
                "{}-",
                upper
                    .iter()
                    .map(u64::to_string)
                    .collect::<Vec<_>>()
                    .join(".")
            );
            !order.is_lt() && compare(version, &upper).is_some_and(|o| o.is_lt())
        }
        _ => return Err("mods_embedded_metadata"),
    })
}
fn accepts(version: &str, range: &Value) -> Result<bool> {
    match range {
        Value::String(value) if !value.is_empty() && value.len() <= 500 => {
            let mut matches = true;
            let terms: Vec<_> = value.split_whitespace().collect();
            if terms.is_empty() || terms.len() > 16 {
                return Err("mods_embedded_metadata");
            }
            for term in terms {
                matches &= predicate(version, term)?;
            }
            Ok(matches)
        }
        Value::Array(values) if !values.is_empty() && values.len() <= 32 => {
            let mut matches = false;
            for value in values {
                if !value.is_string() {
                    return Err("mods_embedded_metadata");
                }
                matches |= accepts(version, value)?;
            }
            Ok(matches)
        }
        _ => Err("mods_embedded_metadata"),
    }
}
fn read_zip<R: Read + Seek>(
    mut reader: R,
    depth: usize,
    total: &mut u64,
    modules: &mut Vec<Module>,
    required: bool,
) -> Result<()> {
    if depth > 4 || modules.len() > 512 {
        return Err("mods_limit");
    }
    let count = super::archives::preflight(&mut reader).map_err(|_| "mods_embedded_metadata")?;
    if count > 50000 {
        return Err("mods_limit");
    }
    let mut zip = zip::ZipArchive::new(reader).map_err(|_| "mods_embedded_metadata")?;
    if zip.len() != count {
        return Err("mods_embedded_metadata");
    }
    let data = {
        let entry = zip.by_name("fabric.mod.json");
        let mut entry = match entry {
            Ok(entry) => entry,
            Err(zip::result::ZipError::FileNotFound) if !required => return Ok(()),
            _ => return Err("mods_embedded_metadata"),
        };
        if entry.size() > 1024 * 1024 {
            return Err("mods_limit");
        }
        let mut bytes = Vec::new();
        entry
            .by_ref()
            .take(1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "mods_embedded_metadata")?;
        if bytes.len() > 1024 * 1024 {
            return Err("mods_limit");
        }
        serde_json::from_slice::<Value>(&bytes).map_err(|_| "mods_embedded_metadata")?
    };
    if data["schemaVersion"].as_u64() != Some(1) {
        return Err("mods_embedded_metadata");
    }
    let module_id = data["id"].as_str().ok_or("mods_embedded_metadata")?;
    let version = data["version"].as_str().ok_or("mods_embedded_metadata")?;
    if !id(module_id) || version.is_empty() || version.len() > 200 {
        return Err("mods_embedded_metadata");
    }
    let map = |key: &str| -> Result<HashMap<String, Value>> {
        match data.get(key) {
            None => Ok(HashMap::new()),
            Some(Value::Object(map)) if map.len() <= 128 && map.keys().all(|key| id(key)) => {
                Ok(map.clone().into_iter().collect())
            }
            _ => Err("mods_embedded_metadata"),
        }
    };
    let provides = match data.get("provides") {
        None => vec![],
        Some(Value::Array(values)) if values.len() <= 64 => values
            .iter()
            .map(|v| {
                v.as_str()
                    .filter(|v| id(v))
                    .map(String::from)
                    .ok_or("mods_embedded_metadata")
            })
            .collect::<Result<Vec<_>>>()?,
        _ => return Err("mods_embedded_metadata"),
    };
    modules.push(Module {
        id: module_id.into(),
        version: version.into(),
        provides,
        depends: map("depends")?,
        breaks: map("breaks")?,
    });
    if let Some(jars) = data.get("jars") {
        let jars = jars.as_array().ok_or("mods_embedded_metadata")?;
        if jars.len() > 128 {
            return Err("mods_limit");
        }
        for jar in jars {
            let name = jar["file"].as_str().ok_or("mods_embedded_metadata")?;
            if name.len() > 1024
                || name.starts_with('/')
                || name.contains(['\\', ':'])
                || name.split('/').any(|s| s == ".." || s == ".")
            {
                return Err("mods_embedded_metadata");
            }
            let bytes = {
                let mut entry = zip.by_name(name).map_err(|_| "mods_embedded_metadata")?;
                if entry.size() > 32 * 1024 * 1024 {
                    return Err("mods_limit");
                }
                *total += entry.size();
                if *total > 128 * 1024 * 1024 {
                    return Err("mods_limit");
                }
                let mut bytes = Vec::new();
                entry
                    .by_ref()
                    .take(32 * 1024 * 1024 + 1)
                    .read_to_end(&mut bytes)
                    .map_err(|_| "mods_embedded_metadata")?;
                if bytes.len() > 32 * 1024 * 1024 {
                    return Err("mods_limit");
                }
                bytes
            };
            read_zip(Cursor::new(bytes), depth + 1, total, modules, false)?;
        }
    }
    Ok(())
}
fn check(modules: &[Module], game: &str) -> Result<()> {
    let mut versions: HashMap<String, String> = HashMap::from([("minecraft".into(), game.into())]);
    for m in modules {
        for key in std::iter::once(&m.id).chain(m.provides.iter()) {
            if versions
                .get(key)
                .is_none_or(|old| compare(&m.version, old).is_some_and(|o| o.is_gt()))
            {
                versions.insert(key.clone(), m.version.clone());
            }
        }
    }
    for m in modules {
        for (dependency, range) in &m.depends {
            if ["java", "fabricloader"].contains(&dependency.as_str()) {
                continue;
            }
            let version = versions.get(dependency).ok_or("mods_embedded_dependency")?;
            if !accepts(version, range)? {
                return Err("mods_embedded_conflict");
            }
        }
        for (dependency, range) in &m.breaks {
            if let Some(version) = versions.get(dependency) {
                if accepts(version, range)? {
                    return Err("mods_embedded_conflict");
                }
            }
        }
    }
    Ok(())
}
pub fn validate(
    root: &Path,
    new_files: &[(String, String)],
    disabled: &[String],
    game: &str,
) -> Result<()> {
    let mut modules = Vec::new();
    let mut bytes = 0;
    let entries = fs::read_dir(root)
        .map_err(|_| "mods_folder")?
        .take(2001)
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|_| "mods_folder")?;
    if entries.len() > 2000 {
        return Err("mods_limit");
    }
    for entry in entries {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.to_ascii_lowercase().ends_with(".jar") || disabled.contains(&name) {
            continue;
        }
        let meta = fs::symlink_metadata(entry.path()).map_err(|_| "mods_changed")?;
        if !meta.is_file() || super::save_files::reparse(&meta) || meta.len() > 128 * 1024 * 1024 {
            return Err("mods_embedded_metadata");
        }
        read_zip(
            fs::File::open(entry.path()).map_err(|_| "mods_changed")?,
            0,
            &mut bytes,
            &mut modules,
            false,
        )?;
    }
    for (name, _) in new_files {
        read_zip(
            fs::File::open(root.join(name)).map_err(|_| "mods_changed")?,
            0,
            &mut bytes,
            &mut modules,
            true,
        )?;
    }
    check(&modules, game)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fabric_ranges_use_its_extended_semver_rules() {
        for (v, r, expected) in [
            ("1.21.1", "1.21.x", true),
            ("0.8.13+mc1.21.1", ">=0.6 <0.7", false),
            ("1.8.8", "<1.8.13", true),
            ("0.5.0", "^0.4.0", true),
            ("1.3.0-alpha", "~1.2.0", false),
            ("1.2.3.4", ">1.2.3", true),
            ("1.2.0-", "<1.2.0-alpha", true),
            ("strange", "strange", true),
        ] {
            assert_eq!(
                accepts(v, &Value::String(r.into())).unwrap(),
                expected,
                "{v} {r}"
            );
        }
        assert!(accepts("1.21.1", &serde_json::json!(["1.21", "1.21.1"])).unwrap());
    }
    #[test]
    fn embedded_hard_breaks_catch_provider_project_only_mismatch() {
        let iris = Module {
            id: "iris".into(),
            version: "1.8.8".into(),
            provides: vec![],
            depends: HashMap::from([("sodium".into(), serde_json::json!("*"))]),
            breaks: HashMap::new(),
        };
        let sodium = Module {
            id: "sodium".into(),
            version: "0.8.13".into(),
            provides: vec![],
            depends: HashMap::new(),
            breaks: HashMap::from([("iris".into(), serde_json::json!("<1.8.13"))]),
        };
        assert_eq!(
            check(&[iris, sodium], "1.21.1").unwrap_err(),
            "mods_embedded_conflict"
        );
    }
    #[test]
    fn bundled_aliases_and_absent_dependencies_are_checked() {
        let base = Module {
            id: "base".into(),
            version: "1.0".into(),
            provides: vec!["alias".into()],
            depends: HashMap::new(),
            breaks: HashMap::new(),
        };
        let mut feature = base.clone();
        feature.id = "feature".into();
        feature.provides.clear();
        feature
            .depends
            .insert("alias".into(), serde_json::json!(">=1.0"));
        assert!(check(&[base, feature.clone()], "1.21.1").is_ok());
        assert_eq!(
            check(&[feature], "1.21.1").unwrap_err(),
            "mods_embedded_dependency"
        );
    }
}
