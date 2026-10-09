use serde_json::{Map, Value};

const BASE_URL_KEY: &str = "harbor.subsonic.v1.baseUrl";
const USERNAME_KEY: &str = "harbor.subsonic.v1.username";
const SALT_KEY: &str = "harbor.subsonic.v1.salt";
const TOKEN_KEY: &str = "harbor.subsonic.v1.token";

#[derive(Clone)]
pub struct Pairing {
    pub base_url: String,
    pub username: String,
    pub salt: String,
    pub token: String,
}

pub fn load(app: &tauri::AppHandle) -> Result<Option<Pairing>, String> {
    let items = read(app)?;
    match (
        entry(&items, BASE_URL_KEY),
        entry(&items, USERNAME_KEY),
        entry(&items, SALT_KEY),
        entry(&items, TOKEN_KEY),
    ) {
        (Some(base_url), Some(username), Some(salt), Some(token)) => Ok(Some(Pairing {
            base_url,
            username,
            salt,
            token,
        })),
        _ => Ok(None),
    }
}

pub fn save(app: &tauri::AppHandle, pairing: &Pairing) -> Result<(), String> {
    let mut items = read(app)?;
    for (key, value) in [
        (BASE_URL_KEY, &pairing.base_url),
        (USERNAME_KEY, &pairing.username),
        (SALT_KEY, &pairing.salt),
        (TOKEN_KEY, &pairing.token),
    ] {
        items.insert(key.to_string(), Value::String(value.clone()));
    }
    write(app, items)
}

pub fn clear(app: &tauri::AppHandle) -> Result<(), String> {
    let mut items = read(app)?;
    for key in [BASE_URL_KEY, USERNAME_KEY, SALT_KEY, TOKEN_KEY] {
        items.remove(key);
    }
    write(app, items)
}

fn read(app: &tauri::AppHandle) -> Result<Map<String, Value>, String> {
    let Some(content) = crate::settings_store::secrets_read(app.clone())? else {
        return Ok(Map::new());
    };
    Ok(serde_json::from_str::<Value>(&content)
        .ok()
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default())
}

fn write(app: &tauri::AppHandle, items: Map<String, Value>) -> Result<(), String> {
    let content = serde_json::to_string(&Value::Object(items))
        .map_err(|error| format!("Harbor could not store this music server sign in: {error}"))?;
    crate::settings_store::secrets_write(app.clone(), content)
}

fn entry(items: &Map<String, Value>, key: &str) -> Option<String> {
    items
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn items(raw: &str) -> Map<String, Value> {
        serde_json::from_str::<Value>(raw)
            .expect("stored values")
            .as_object()
            .cloned()
            .expect("object")
    }

    #[test]
    fn entries_ignore_blank_and_non_string_values() {
        let stored = items(
            r#"{"harbor.subsonic.v1.username":" alice ","harbor.subsonic.v1.salt":"","harbor.subsonic.v1.token":42}"#,
        );
        assert_eq!(entry(&stored, USERNAME_KEY).as_deref(), Some("alice"));
        assert!(entry(&stored, SALT_KEY).is_none());
        assert!(entry(&stored, TOKEN_KEY).is_none());
        assert!(entry(&stored, BASE_URL_KEY).is_none());
    }
}
