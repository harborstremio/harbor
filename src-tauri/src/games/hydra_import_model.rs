//! Allowlisted migration metadata. Unknown fields and account sublevels never leave the reader.
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Default, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Report {
    pub games: Vec<Game>,
    pub sources: Vec<Source>,
    pub deleted_games: usize,
    pub invalid_games: usize,
    pub invalid_sources: usize,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Game {
    pub key: String,
    pub name: String,
    pub shop: String,
    pub object_id: String,
    pub executable: Option<String>,
    pub launch_options: Option<String>,
    pub wine_prefix: Option<String>,
    pub proton: Option<String>,
    pub added_at: Option<String>,
    pub last_played: Option<String>,
    pub playtime_ms: Option<u64>,
    pub steam_playtime_ms: Option<u64>,
    pub playtime_manually_edited: bool,
    pub favorite: bool,
    pub pinned: bool,
    pub concealed: bool,
    pub issues: Vec<String>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    pub key: String,
    pub name: String,
    pub url: String,
}

fn text(value: &Value, max: usize) -> Option<&str> {
    value.as_str().filter(|text| {
        !text.trim().is_empty() && text.len() <= max && !text.chars().any(char::is_control)
    })
}
fn optional(value: &Value, key: &str, max: usize, issues: &mut Vec<String>) -> Option<String> {
    if value.get(key).is_none_or(Value::is_null) {
        return None;
    }
    // Hydra saves empty launch/path fields as strings as well as null.
    if value[key].as_str().is_some_and(str::is_empty) {
        return None;
    }
    match text(&value[key], max) {
        Some(text) => Some(text.into()),
        None => {
            issues.push(key.into());
            None
        }
    }
}
fn milliseconds(value: &Value, key: &str, issues: &mut Vec<String>) -> Option<u64> {
    if value.get(key).is_none_or(Value::is_null) {
        return None;
    }
    match value[key].as_u64().filter(|n| *n <= 3_600_000_000_000) {
        Some(n) => Some(n),
        None => {
            issues.push(key.into());
            None
        }
    }
}
fn flag(value: &Value, key: &str, issues: &mut Vec<String>) -> bool {
    if value.get(key).is_none_or(Value::is_null) {
        return false;
    }
    match value[key].as_bool() {
        Some(flag) => flag,
        None => {
            issues.push(key.into());
            false
        }
    }
}
impl Report {
    pub fn game(&mut self, key: &[u8], bytes: &[u8]) {
        let parsed = (|| {
            let key = std::str::from_utf8(key).ok()?.strip_prefix("!games!")?;
            let value: Value = serde_json::from_slice(bytes).ok()?;
            let name = text(&value["title"], 500)?;
            let shop = text(&value["shop"], 40)?;
            let object_id = text(&value["objectId"], 200)?;
            if key != format!("{shop}:{object_id}") {
                return None;
            }
            if value["isDeleted"] == true {
                self.deleted_games += 1;
                return Some(());
            }
            let mut issues = Vec::new();
            if !matches!(shop, "steam" | "custom" | "launchbox") {
                issues.push("shop".into());
            }
            if shop == "steam"
                && !object_id
                    .parse::<u32>()
                    .is_ok_and(|id| id > 0 && id.to_string() == object_id)
            {
                issues.push("objectId".into());
            }
            if value.get("isDeleted").is_some_and(|v| !v.is_boolean()) {
                issues.push("isDeleted".into());
            }
            // These require explicit mapping in the import UI. A normal executable
            // match must not silently discard a multi-disc or custom tracking setup.
            for key in ["trackingExecutablePaths", "discs", "collectionIds"] {
                if value
                    .get(key)
                    .is_some_and(|v| !v.is_null() && !v.as_array().is_some_and(Vec::is_empty))
                {
                    issues.push(key.into());
                }
            }
            for key in ["autoRunMangohud", "autoRunGamemode", "automaticCloudSync"] {
                if value.get(key).is_some_and(|v| !v.is_null() && v != false) {
                    issues.push(key.into());
                }
            }
            if value["enableHydraPlaytimeTracking"] == false {
                issues.push("enableHydraPlaytimeTracking".into());
            }
            let game = Game {
                key: key.into(),
                name: name.into(),
                shop: shop.into(),
                object_id: object_id.into(),
                executable: optional(&value, "executablePath", 4096, &mut issues),
                launch_options: optional(&value, "launchOptions", 16384, &mut issues),
                wine_prefix: optional(&value, "winePrefixPath", 4096, &mut issues),
                proton: optional(&value, "protonPath", 4096, &mut issues),
                added_at: optional(&value, "addedToLibraryAt", 128, &mut issues),
                last_played: optional(&value, "lastTimePlayed", 128, &mut issues),
                playtime_ms: milliseconds(&value, "playTimeInMilliseconds", &mut issues),
                steam_playtime_ms: milliseconds(&value, "steamPlayTimeInMilliseconds", &mut issues),
                playtime_manually_edited: flag(&value, "hasManuallyUpdatedPlaytime", &mut issues),
                favorite: flag(&value, "favorite", &mut issues),
                pinned: flag(&value, "isPinned", &mut issues),
                concealed: flag(&value, "isConcealed", &mut issues),
                issues,
            };
            self.games.push(game);
            Some(())
        })();
        if parsed.is_none() {
            self.invalid_games += 1;
        }
    }
    pub fn source(&mut self, key: &[u8], bytes: &[u8]) {
        let parsed = (|| {
            let key = std::str::from_utf8(key)
                .ok()?
                .strip_prefix("!downloadSources!")?;
            let value: Value = serde_json::from_slice(bytes).ok()?;
            let id = text(&value["id"], 200)?;
            if key != id {
                return None;
            }
            let name = text(&value["name"], 500)?;
            let url = text(&value["url"], 4096)?;
            let parsed = url::Url::parse(url).ok()?;
            if !matches!(parsed.scheme(), "https" | "http")
                || parsed.host_str().is_none()
                || !parsed.username().is_empty()
                || parsed.password().is_some()
            {
                return None;
            }
            self.sources.push(Source {
                key: key.into(),
                name: name.into(),
                url: url.into(),
            });
            Some(())
        })();
        if parsed.is_none() {
            self.invalid_sources += 1;
        }
    }
}
