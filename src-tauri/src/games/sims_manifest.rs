//! Creator-supplied metadata only. No authenticity or compatibility verdicts.
use super::sims_package::Result;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use yaml_rust2::parser::{Event, Parser};

pub const MAX_TEXT: usize = 128 * 1024;
const ERROR: &str = "sims_manifest";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Requirement {
    #[serde(skip)]
    pub check: Option<Dependency>,
    pub name: String,
    pub version: Option<String>,
    pub creators: Vec<String>,
    pub url: Option<String>,
    pub features: Vec<String>,
    pub conditional: bool,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    #[serde(skip)]
    pub identity: Option<Identity>,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub creators: Vec<String>,
    pub url: Option<String>,
    pub required_packs: Vec<String>,
    pub incompatible_packs: Vec<String>,
    pub requirements: Vec<Requirement>,
}
#[derive(Debug)]
pub struct Identity {
    pub hash: String,
    pub resources: BTreeSet<(u32, u32, u64)>,
    pub excluded: BTreeSet<String>,
    pub subsumed: BTreeSet<String>,
    pub features: BTreeSet<String>,
}
#[derive(Debug)]
pub struct Dependency {
    pub hashes: BTreeSet<String>,
    pub if_available: Option<String>,
    pub if_unavailable: Option<String>,
    pub pack_available: Option<String>,
    pub pack_unavailable: Option<String>,
    pub alternative: Option<String>,
}
#[derive(Debug)]
enum Value {
    Null,
    Text(String),
    List(Vec<Value>),
    Map(BTreeMap<String, Value>),
}
enum Frame {
    List(Vec<Value>),
    Map(BTreeMap<String, Value>, Option<String>),
}
fn attach(stack: &mut [Frame], root: &mut Option<Value>, value: Value) -> Result<()> {
    match stack.last_mut() {
        Some(Frame::List(items)) => items.push(value),
        Some(Frame::Map(items, key)) => {
            if let Some(key) = key.take() {
                if items.insert(key, value).is_some() {
                    return Err(ERROR);
                }
            } else if let Value::Text(text) = value {
                if text.len() > 100 {
                    return Err(ERROR);
                }
                *key = Some(text);
            } else {
                return Err(ERROR);
            }
        }
        None => {
            if root.replace(value).is_some() {
                return Err(ERROR);
            }
        }
    }
    Ok(())
}
fn yaml(input: &str, check: &dyn Fn() -> Result<()>) -> Result<Value> {
    if input.len() > MAX_TEXT {
        return Err(ERROR);
    }
    let mut root = None;
    let mut stack = Vec::new();
    let mut documents = 0;
    let mut count = 0;
    let mut parser = Parser::new_from_str(input);
    loop {
        check()?;
        count += 1;
        if count > 4096 {
            return Err(ERROR);
        }
        match parser.next_token().map_err(|_| ERROR)?.0 {
            Event::StreamEnd => break,
            Event::StreamStart | Event::DocumentEnd => {}
            Event::DocumentStart => {
                documents += 1;
                if documents > 1 {
                    return Err(ERROR);
                }
            }
            Event::Scalar(text, style, 0, None) => attach(
                &mut stack,
                &mut root,
                if style == yaml_rust2::scanner::TScalarStyle::Plain
                    && matches!(text.as_str(), "" | "~" | "null" | "Null" | "NULL")
                {
                    Value::Null
                } else {
                    Value::Text(text)
                },
            )?,
            Event::SequenceStart(0, None) => stack.push(Frame::List(vec![])),
            Event::MappingStart(0, None) => stack.push(Frame::Map(BTreeMap::new(), None)),
            Event::SequenceEnd => {
                let Some(Frame::List(items)) = stack.pop() else {
                    return Err(ERROR);
                };
                attach(&mut stack, &mut root, Value::List(items))?;
            }
            Event::MappingEnd => {
                let Some(Frame::Map(items, None)) = stack.pop() else {
                    return Err(ERROR);
                };
                attach(&mut stack, &mut root, Value::Map(items))?;
            }
            // Never expand aliases, anchors, tags or multi-document input.
            _ => return Err(ERROR),
        }
        if stack.len() > 12 {
            return Err(ERROR);
        }
    }
    if !stack.is_empty() {
        return Err(ERROR);
    }
    root.ok_or(ERROR)
}

#[derive(Deserialize)]
struct XmlRoot {
    #[serde(rename = "@i")]
    instance: String,
    #[serde(rename = "@m")]
    module: String,
    #[serde(rename = "@c")]
    class: String,
    #[serde(rename = "$value", default)]
    fields: Vec<XmlField>,
}
#[derive(Deserialize)]
struct XmlElement {
    #[serde(rename = "@n")]
    name: Option<String>,
    #[serde(rename = "$text", default)]
    text: String,
    #[serde(rename = "$value", default)]
    fields: Vec<XmlField>,
}
#[derive(Deserialize)]
enum XmlField {
    #[serde(rename = "T")]
    Text(XmlElement),
    #[serde(rename = "L")]
    List(XmlElement),
    #[serde(rename = "U")]
    Tuple(XmlElement),
}
fn xml_field(field: XmlField) -> Result<(Option<String>, Value)> {
    match field {
        XmlField::Text(field) if field.fields.is_empty() => {
            Ok((field.name, Value::Text(field.text)))
        }
        XmlField::List(field) if field.text.trim().is_empty() => {
            let mut list = Vec::new();
            for child in field.fields {
                let (name, value) = xml_field(child)?;
                if name.is_some() {
                    return Err(ERROR);
                }
                list.push(value);
            }
            Ok((field.name, Value::List(list)))
        }
        XmlField::Tuple(field) if field.text.trim().is_empty() => {
            Ok((field.name, xml_map(field.fields)?))
        }
        _ => Err(ERROR),
    }
}
fn xml_map(fields: Vec<XmlField>) -> Result<Value> {
    let mut values = BTreeMap::new();
    for field in fields {
        let (name, value) = xml_field(field)?;
        if values.insert(name.ok_or(ERROR)?, value).is_some() {
            return Err(ERROR);
        }
    }
    Ok(Value::Map(values))
}
fn xml(input: &str, check: &dyn Fn() -> Result<()>) -> Result<Option<Value>> {
    use quick_xml::events::Event as XmlEvent;
    if input.len() > MAX_TEXT {
        return Err(ERROR);
    }
    let mut reader = quick_xml::Reader::from_str(input);
    let mut count = 0;
    let mut depth = 0;
    let mut roots = 0;
    loop {
        check()?;
        count += 1;
        if count > 8192 {
            return Err(ERROR);
        }
        match reader.read_event().map_err(|_| ERROR)? {
            XmlEvent::Start(element) => {
                if depth == 0 {
                    roots += 1;
                    if roots > 1 || element.name().as_ref() != b"I" {
                        return Ok(None);
                    }
                    let mut attributes = BTreeMap::new();
                    for attribute in element.attributes() {
                        let attribute = attribute.map_err(|_| ERROR)?;
                        attributes.insert(
                            attribute.key.as_ref().to_vec(),
                            attribute
                                .decode_and_unescape_value(reader.decoder())
                                .map_err(|_| ERROR)?
                                .into_owned(),
                        );
                    }
                    if attributes.get(b"i".as_slice()).map(String::as_str) != Some("snippet")
                        || attributes.get(b"m".as_slice()).map(String::as_str)
                            != Some("llamalogic.snippets.modfilemanifest")
                        || attributes.get(b"c".as_slice()).map(String::as_str)
                            != Some("ModFileManifest")
                    {
                        return Ok(None);
                    }
                }
                depth += 1;
                if depth > 12 {
                    return Err(ERROR);
                }
            }
            XmlEvent::End(_) => {
                if depth == 0 {
                    return Err(ERROR);
                }
                depth -= 1;
            }
            XmlEvent::Empty(_) if depth == 0 => return Ok(None),
            XmlEvent::DocType(_) => return Err(ERROR),
            XmlEvent::Eof => break,
            _ => {}
        }
    }
    if depth != 0 || roots != 1 {
        return Err(ERROR);
    }
    let root: XmlRoot = quick_xml::de::from_str(input).map_err(|_| ERROR)?;
    if root.instance != "snippet"
        || root.module != "llamalogic.snippets.modfilemanifest"
        || root.class != "ModFileManifest"
    {
        return Ok(None);
    }
    xml_map(root.fields).map(Some)
}

fn text(map: &BTreeMap<String, Value>, key: &str, limit: usize) -> Result<Option<String>> {
    match map.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Text(value)) if value.trim().is_empty() => Ok(None),
        Some(Value::Text(value))
            if value.len() <= limit
                && !value
                    .chars()
                    .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t')) =>
        {
            Ok(Some(value.trim().to_owned()))
        }
        _ => Err(ERROR),
    }
}
fn strings(map: &BTreeMap<String, Value>, key: &str, count: usize) -> Result<Vec<String>> {
    match map.get(key) {
        None | Some(Value::Null) => Ok(vec![]),
        Some(Value::List(values)) if values.len() <= count => values
            .iter()
            .map(|value| {
                if let Value::Text(value) = value {
                    if !value.trim().is_empty()
                        && value.len() <= 160
                        && !value.chars().any(char::is_control)
                    {
                        return Ok(value.trim().to_owned());
                    }
                }
                Err(ERROR)
            })
            .collect(),
        _ => Err(ERROR),
    }
}
fn url(map: &BTreeMap<String, Value>) -> Result<Option<String>> {
    let Some(value) = text(map, "url", 2048)? else {
        return Ok(None);
    };
    let Ok(url) = reqwest::Url::parse(&value) else {
        return Ok(None);
    };
    let host = url.host_str().unwrap_or_default();
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some_and(|p| p != 443)
        || !host.contains('.')
        || host.parse::<std::net::IpAddr>().is_ok()
        || host.ends_with(".localhost")
        || host.ends_with(".local")
    {
        return Ok(None);
    }
    Ok(Some(url.into()))
}
fn digest(value: &str) -> Result<String> {
    if value.len() != 64 || !value.bytes().all(|v| v.is_ascii_hexdigit()) {
        return Err(ERROR);
    }
    Ok(value.to_ascii_lowercase())
}
fn hashes(map: &BTreeMap<String, Value>, key: &str) -> Result<BTreeSet<String>> {
    strings(map, key, 256)?.iter().map(|v| digest(v)).collect()
}
fn optional_hash(map: &BTreeMap<String, Value>, key: &str) -> Result<Option<String>> {
    text(map, key, 64)?.map(|v| digest(&v)).transpose()
}
fn identity(map: &BTreeMap<String, Value>) -> Result<Identity> {
    let mut resources = BTreeSet::new();
    for key in strings(map, "hash_resource_keys", 1024)? {
        let parts: Vec<_> = key
            .split(if key.contains(':') { ':' } else { '-' })
            .collect();
        if parts.len() != 3 || parts[0].len() != 8 || parts[1].len() != 8 || parts[2].len() != 16 {
            return Err(ERROR);
        }
        let key = (
            u32::from_str_radix(parts[0], 16).map_err(|_| ERROR)?,
            u32::from_str_radix(parts[1], 16).map_err(|_| ERROR)?,
            u64::from_str_radix(parts[2], 16).map_err(|_| ERROR)?,
        );
        if !resources.insert(key) {
            return Err(ERROR);
        }
    }
    Ok(Identity {
        hash: optional_hash(map, "hash")?.ok_or(ERROR)?,
        resources,
        excluded: strings(map, "excluded_entries", 1024)?
            .into_iter()
            .collect(),
        subsumed: hashes(map, "subsumed_hashes")?,
        features: strings(map, "features", 128)?.into_iter().collect(),
    })
}
fn dependency(map: &BTreeMap<String, Value>) -> Result<Dependency> {
    let pack = |key| {
        if matches!(map.get(key), Some(Value::Text(value)) if value.trim().is_empty()) {
            return Err(ERROR);
        }
        text(map, key, 4)?
            .map(|code| super::sims_launch_settings::pack_code(&code).ok_or(ERROR))
            .transpose()
    };
    let unavailable = pack("ignore_if_pack_unavailable")?;
    let legacy = pack("ignore_if_pash_unavailable")?;
    if unavailable.is_some() && legacy.is_some() && unavailable != legacy {
        return Err(ERROR);
    }
    Ok(Dependency {
        hashes: hashes(map, "hashes")?,
        if_available: optional_hash(map, "ignore_if_hash_available")?,
        if_unavailable: optional_hash(map, "ignore_if_hash_unavailable")?,
        pack_available: pack("ignore_if_pack_available")?,
        pack_unavailable: unavailable.or(legacy),
        alternative: text(map, "requirement_identifier", 160)?,
    })
}
fn manifest(value: Value) -> Result<Manifest> {
    let Value::Map(map) = value else {
        return Err(ERROR);
    };
    let mut requirements = Vec::new();
    if let Some(value) = map.get("required_mods") {
        let Value::List(values) = value else {
            return Err(ERROR);
        };
        if values.len() > 32 {
            return Err(ERROR);
        }
        for value in values {
            let Value::Map(mod_map) = value else {
                return Err(ERROR);
            };
            requirements.push(Requirement {
                check: dependency(mod_map).ok(),
                name: text(mod_map, "name", 160)?.ok_or(ERROR)?,
                version: text(mod_map, "version", 80)?,
                creators: strings(mod_map, "creators", 20)?,
                url: url(mod_map)?,
                features: strings(mod_map, "required_features", 32)?,
                conditional: [
                    "ignore_if_hash_available",
                    "ignore_if_hash_unavailable",
                    "ignore_if_pack_available",
                    "ignore_if_pack_unavailable",
                    "ignore_if_pash_unavailable",
                    "requirement_identifier",
                ]
                .iter()
                .any(|key| mod_map.contains_key(*key)),
            });
        }
    }
    Ok(Manifest {
        identity: identity(&map).ok(),
        name: text(&map, "name", 160)?.ok_or(ERROR)?,
        description: text(&map, "description", 2400)?,
        version: text(&map, "version", 80)?,
        creators: strings(&map, "creators", 20)?,
        url: url(&map)?,
        required_packs: strings(&map, "required_packs", 100)?,
        incompatible_packs: strings(&map, "incompatible_packs", 100)?,
        requirements,
    })
}
pub fn from_yaml(input: &str, check: &dyn Fn() -> Result<()>) -> Result<Manifest> {
    manifest(yaml(input, check)?)
}
pub fn from_xml(input: &str, check: &dyn Fn() -> Result<()>) -> Result<Option<Manifest>> {
    xml(input, check)?.map(manifest).transpose()
}
