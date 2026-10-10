use librespot_core::authentication::Credentials;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

pub const SESSION_KEY: &str = "harbor.spotify.v1.credentials";
pub const DEVICE_ID_KEY: &str = "harbor.spotify.v1.deviceId";
pub const WEB_TOKEN_KEY: &str = "harbor.spotify.v1.webToken";
pub const CLIENT_ID_KEY: &str = "harbor.spotify.v1.clientId";
pub const PLAY_TARGET_KEY: &str = "harbor.spotify.v1.playTarget";

const TOKEN_SKEW_SECONDS: u64 = 60;
const LEGACY_FILE: &str = "credentials.json";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: u64,
    #[serde(default)]
    pub scopes: Vec<String>,
}

impl WebToken {
    pub fn is_fresh(&self, now: u64) -> bool {
        !self.access_token.trim().is_empty()
            && self.expires_at > now.saturating_add(TOKEN_SKEW_SECONDS)
    }
}

pub fn read(app: &AppHandle, key: &str) -> Option<String> {
    crate::settings_store::secret_value(app, key)
        .ok()
        .flatten()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub fn write(app: &AppHandle, key: &str, value: Option<&str>) -> Result<(), String> {
    let stored = crate::settings_store::secrets_read(app.clone())?.unwrap_or_default();
    let mut document = serde_json::from_str::<Value>(&stored)
        .unwrap_or_else(|_| Value::Object(serde_json::Map::new()));
    if !document.is_object() {
        document = Value::Object(serde_json::Map::new());
    }
    let entries = document
        .as_object_mut()
        .ok_or_else(|| "Harbor secrets are not a JSON object".to_string())?;
    match value {
        Some(value) => {
            entries.insert(key.to_string(), Value::String(value.to_string()));
        }
        None => {
            entries.remove(key);
        }
    }
    let encoded = serde_json::to_string(&document).map_err(|error| error.to_string())?;
    crate::settings_store::secrets_write(app.clone(), encoded)
}

pub fn load(app: &AppHandle, cache_dir: &Path) -> Option<Credentials> {
    if let Some(stored) = read(app, SESSION_KEY) {
        if let Ok(session) = serde_json::from_str::<Credentials>(&stored) {
            return Some(session);
        }
    }
    harvest(app, cache_dir)
}

pub fn capture(app: &AppHandle, cache_dir: &Path) {
    let _ = harvest(app, cache_dir);
}

pub fn forget(app: &AppHandle, cache_dir: &Path) -> Result<(), String> {
    let path = legacy_path(cache_dir);
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|error| format!("remove Spotify sign in {}: {error}", path.display()))?;
    }
    write(app, WEB_TOKEN_KEY, None)?;
    write(app, PLAY_TARGET_KEY, None)?;
    write(app, SESSION_KEY, None)
}

pub fn web_token(app: &AppHandle) -> Option<WebToken> {
    serde_json::from_str::<WebToken>(&read(app, WEB_TOKEN_KEY)?).ok()
}

pub fn store_web_token(app: &AppHandle, token: &WebToken) -> Result<(), String> {
    let encoded = serde_json::to_string(token).map_err(|error| error.to_string())?;
    write(app, WEB_TOKEN_KEY, Some(&encoded))
}

pub fn device_id(app: &AppHandle) -> String {
    if let Some(stored) = read(app, DEVICE_ID_KEY) {
        if is_device_id(&stored) {
            return stored;
        }
    }
    let minted = uuid::Uuid::new_v4().as_hyphenated().to_string();
    let _ = write(app, DEVICE_ID_KEY, Some(&minted));
    minted
}

fn harvest(app: &AppHandle, cache_dir: &Path) -> Option<Credentials> {
    let path = legacy_path(cache_dir);
    let stored = std::fs::read_to_string(&path).ok()?;
    let session = serde_json::from_str::<Credentials>(&stored).ok()?;
    if write(app, SESSION_KEY, Some(stored.trim())).is_ok() {
        let _ = std::fs::remove_file(&path);
    }
    Some(session)
}

fn legacy_path(cache_dir: &Path) -> PathBuf {
    cache_dir.join(LEGACY_FILE)
}

fn is_device_id(value: &str) -> bool {
    value.len() == 36
        && value
            .chars()
            .all(|entry| entry.is_ascii_hexdigit() || entry == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn web_tokens_expire_before_the_server_does() {
        let token = WebToken {
            access_token: "token".to_string(),
            refresh_token: None,
            expires_at: 1_000,
            scopes: Vec::new(),
        };
        assert!(token.is_fresh(800));
        assert!(!token.is_fresh(940));
        assert!(!token.is_fresh(1_200));
    }

    #[test]
    fn blank_web_tokens_are_never_fresh() {
        let token = WebToken {
            access_token: "   ".to_string(),
            refresh_token: Some("refresh".to_string()),
            expires_at: u64::MAX,
            scopes: Vec::new(),
        };
        assert!(!token.is_fresh(0));
    }

    #[test]
    fn device_ids_must_look_like_a_uuid() {
        assert!(is_device_id("3f2504e0-4f89-11d3-9a0c-0305e82c3301"));
        assert!(!is_device_id("3f2504e0"));
        assert!(!is_device_id("3f2504e0-4f89-11d3-9a0c-0305e82c330z"));
    }

    #[test]
    fn stored_web_tokens_round_trip_as_camel_case() {
        let token = WebToken {
            access_token: "access".to_string(),
            refresh_token: Some("refresh".to_string()),
            expires_at: 42,
            scopes: vec!["user-library-read".to_string()],
        };
        let encoded = serde_json::to_string(&token).expect("encode");
        assert!(encoded.contains("accessToken"));
        assert!(encoded.contains("expiresAt"));
        let decoded = serde_json::from_str::<WebToken>(&encoded).expect("decode");
        assert_eq!(decoded.refresh_token.as_deref(), Some("refresh"));
        assert_eq!(decoded.expires_at, 42);
        assert_eq!(decoded.scopes, vec!["user-library-read"]);
    }

    #[test]
    fn older_tokens_do_not_gain_playlist_write_permission() {
        let token: WebToken = serde_json::from_str(
            r#"{"accessToken":"access","refreshToken":"refresh","expiresAt":42}"#,
        )
        .unwrap();
        assert!(token.scopes.is_empty());
    }
}
