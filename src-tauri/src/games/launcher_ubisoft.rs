//! Optional public product artwork from Ubisoft Connect's local configuration cache.
use super::{protobuf_values, ProtoValue};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

pub(super) const MAX_CACHE_BYTES: u64 = 8 * 1024 * 1024;
const ASSETS: &str = "https://ubistatic3-a.akamaihd.net/orbit/uplay_launcher_3_0/assets/";
const KEYS: [&str; 4] = ["name", "thumb_image", "background_image", "logo_image"];

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct Artwork {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capsule: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hero: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Product {
    pub name: Option<String>,
    pub artwork: Option<Artwork>,
    pub catalog_steam_id: Option<u32>,
}

// This publisher association is metadata only; it never changes Ubisoft dispatch.
fn catalog_steam_id(source: &str) -> Option<u32> {
    let (mut root, mut start, mut steam) = (false, false, false);
    let (mut seen_start, mut seen_steam, mut seen_id) = (false, false, false);
    let mut result = None;
    for line in source.lines() {
        if line.trim().is_empty() || line.trim_start().starts_with('#') {
            continue;
        }
        let depth = line.len() - line.trim_start_matches(' ').len();
        let field = line.trim();
        match depth {
            0 => {
                root = field == "root:";
                start = false;
                steam = false;
            }
            2 if root => {
                start = field == "start_game:";
                steam = false;
                if field.starts_with("start_game:") && std::mem::replace(&mut seen_start, true) {
                    return None;
                }
            }
            4 if root && start => {
                steam = field == "steam:";
                if field.starts_with("steam:") && std::mem::replace(&mut seen_steam, true) {
                    return None;
                }
            }
            6 if root && start && steam => {
                if let Some(raw) = field.strip_prefix("steam_app_id:") {
                    if std::mem::replace(&mut seen_id, true) {
                        return None;
                    }
                    let raw = raw.trim();
                    if raw.is_empty() || !raw.bytes().all(|byte| byte.is_ascii_digit()) {
                        return None;
                    }
                    result = raw.parse::<u32>().ok().filter(|value| *value > 0);
                }
            }
            _ => {}
        }
    }
    result
}

// This is a deliberately narrow scalar reader, not a general YAML evaluator.
// Unknown shapes, block strings, aliases and tags supply no display metadata.
fn scalar(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() || raw.len() > 4096 {
        return None;
    }
    let value = if raw.starts_with('"') {
        serde_json::from_str::<String>(raw).ok()?
    } else if raw.starts_with('\'') {
        raw.strip_prefix('\'')?
            .strip_suffix('\'')?
            .replace("''", "'")
    } else {
        if raw.starts_with(['!', '&', '*', '{', '[', '|', '>', '#', '%', '@', '`'])
            || raw.contains(": ")
        {
            return None;
        }
        raw.split(" #").next()?.trim_end().to_owned()
    };
    (!value.is_empty() && !value.chars().any(char::is_control)).then_some(value)
}

fn image(value: Option<String>) -> Option<String> {
    let value = value?;
    let (hash, extension) = value.rsplit_once('.')?;
    (hash.len() == 32
        && hash.bytes().all(|byte| byte.is_ascii_hexdigit())
        && matches!(
            extension.to_ascii_lowercase().as_str(),
            "jpg" | "jpeg" | "png" | "webp"
        ))
    .then(|| format!("{ASSETS}{value}"))
}

fn product(source: &str) -> Option<Product> {
    if source.len() > 256 * 1024 || source.contains('\t') {
        return None;
    }
    let mut root = BTreeMap::new();
    let mut local = BTreeMap::new();
    let mut sections = BTreeSet::new();
    let mut section = "";
    let mut default = false;
    // First collect only direct root display keys. Nested related games must not leak in.
    for line in source.lines() {
        if line.is_empty() || line.trim_start().starts_with('#') || line == "---" {
            continue;
        }
        if !line.starts_with(' ') {
            section = line.trim();
            if matches!(section, "root:" | "localizations:") && !sections.insert(section) {
                return None;
            }
        } else if section == "root:" && line.starts_with("  ") && !line.starts_with("   ") {
            if let Some((key, value)) = line.trim_start().split_once(':') {
                if KEYS.contains(&key) && root.insert(key, scalar(value)).is_some() {
                    return None;
                }
            }
        }
    }
    section = "";
    let mut saw_default = false;
    for line in source.lines() {
        if line.is_empty() || line.trim_start().starts_with('#') {
            continue;
        }
        if !line.starts_with(' ') {
            section = line.trim();
            default = false;
        } else if section == "localizations:" {
            if line.starts_with("  ") && !line.starts_with("   ") {
                default = line.trim() == "default:";
                if default && saw_default {
                    return None;
                }
                saw_default |= default;
            } else if default && line.starts_with("    ") && !line.starts_with("     ") {
                if let Some((key, value)) = line.trim_start().split_once(':') {
                    if root.values().flatten().any(|reference| reference == key)
                        && local.insert(key, scalar(value)).is_some()
                    {
                        return None;
                    }
                }
            }
        }
    }
    let resolve = |key| -> Option<String> {
        let reference = root.get(key)?.as_ref()?;
        local
            .get(reference.as_str())
            .cloned()
            .unwrap_or_else(|| Some(reference.clone()))
    };
    let name = resolve("name").filter(|name| {
        name.len() <= 512
            && !name.starts_with("RELATED_")
            && !matches!(name.as_str(), "GAMENAME" | "GAME_NAME")
            && !(name.len() > 1
                && name.starts_with('l')
                && name[1..].bytes().all(|byte| byte.is_ascii_digit()))
    });
    let artwork = Artwork {
        capsule: image(resolve("thumb_image")),
        hero: image(resolve("background_image")),
        logo: image(resolve("logo_image")),
    };
    let artwork = (artwork != Artwork::default()).then_some(artwork);
    let catalog_steam_id = catalog_steam_id(source);
    (name.is_some() || artwork.is_some() || catalog_steam_id.is_some()).then_some(Product {
        name,
        artwork,
        catalog_steam_id,
    })
}

pub(super) fn catalog(bytes: &[u8]) -> Result<BTreeMap<u32, Product>, &'static str> {
    if bytes.len() as u64 > MAX_CACHE_BYTES {
        return Err("launcher_manifest_invalid");
    }
    let mut products = BTreeMap::new();
    let mut conflicts = BTreeSet::new();
    for (field, item) in protobuf_values(bytes)? {
        let (1, ProtoValue::Bytes(item)) = (field, item) else {
            continue;
        };
        let mut id = None;
        let mut source = None;
        let mut duplicate = false;
        for (key, value) in protobuf_values(item)? {
            match (key, value) {
                (1, ProtoValue::Number(value)) => {
                    duplicate |= id.is_some();
                    id = Some(value);
                }
                (3, ProtoValue::Bytes(value)) => {
                    duplicate |= source.is_some();
                    source = Some(value);
                }
                _ => {}
            }
        }
        let Some(id) = id
            .and_then(|id| u32::try_from(id).ok())
            .filter(|id| *id > 0)
        else {
            continue;
        };
        // Field 2 is a shared installation ID, not the edition/product identity.
        if duplicate {
            conflicts.insert(id);
            continue;
        }
        let Some(value) = source
            .and_then(|s| std::str::from_utf8(s).ok())
            .and_then(product)
        else {
            continue;
        };
        if products.get(&id).is_some_and(|previous| previous != &value) {
            conflicts.insert(id);
        } else {
            products.insert(id, value);
        }
    }
    products.retain(|id, _| !conflicts.contains(id));
    Ok(products)
}
