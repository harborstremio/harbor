use super::connector::{ConnectorHealth, MusicConnector};
use super::{MusicStream, MusicTrack};
use async_trait::async_trait;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::atomic::{AtomicU8, Ordering};
use std::time::Duration;

const LASTFM_API: &str = "https://ws.audioscrobbler.com/2.0/";
pub const API_KEY_SECRET: &str = "harbor.lastfm.v1.apiKey";
pub const API_SECRET_SECRET: &str = "harbor.lastfm.v1.apiSecret";
pub const SESSION_KEY_SECRET: &str = "harbor.lastfm.v1.sessionKey";
pub const USERNAME_SECRET: &str = "harbor.lastfm.v1.username";

pub struct LastFmConnector {
    health: AtomicU8,
}

impl LastFmConnector {
    pub fn new() -> Self {
        Self {
            health: AtomicU8::new(0),
        }
    }
}

#[async_trait]
impl MusicConnector for LastFmConnector {
    fn id(&self) -> &str {
        "lastfm"
    }

    fn name(&self) -> &str {
        "Last.fm"
    }

    async fn search(
        &self,
        _app: &tauri::AppHandle,
        _query: &str,
        _limit: usize,
    ) -> Result<Vec<MusicTrack>, String> {
        Ok(Vec::new())
    }

    async fn resolve(
        &self,
        _app: &tauri::AppHandle,
        _track: &MusicTrack,
    ) -> Result<MusicStream, String> {
        Err("Last.fm is a scrobbling connector".to_string())
    }

    fn set_health(&self, health: ConnectorHealth) {
        self.health.store(health_code(health), Ordering::Relaxed);
    }

    fn health(&self) -> ConnectorHealth {
        match self.health.load(Ordering::Relaxed) {
            1 => ConnectorHealth::Healthy,
            2 => ConnectorHealth::Degraded,
            3 => ConnectorHealth::Offline,
            _ => ConnectorHealth::Unknown,
        }
    }

    fn searchable(&self) -> bool {
        false
    }

    fn playable(&self) -> bool {
        false
    }

    fn scrobbler(&self) -> bool {
        true
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastFmAuthStart {
    token: String,
    auth_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastFmSession {
    username: String,
    session_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastFmStatus {
    pub(super) connected: bool,
    username: Option<String>,
}

pub async fn begin_auth(api_key: &str, api_secret: &str) -> Result<LastFmAuthStart, String> {
    validate_credentials(api_key, api_secret)?;
    let params = BTreeMap::from([
        ("api_key".to_string(), api_key.trim().to_string()),
        ("method".to_string(), "auth.getToken".to_string()),
    ]);
    let response = post(params, api_secret).await?;
    let token = response
        .get("token")
        .and_then(Value::as_str)
        .filter(|token| !token.is_empty())
        .ok_or_else(|| "Last.fm did not return an authorization token".to_string())?
        .to_string();
    let mut auth_url =
        url::Url::parse("https://www.last.fm/api/auth/").map_err(|error| error.to_string())?;
    auth_url
        .query_pairs_mut()
        .append_pair("api_key", api_key.trim())
        .append_pair("token", &token);
    Ok(LastFmAuthStart {
        token,
        auth_url: auth_url.to_string(),
    })
}

pub async fn complete_auth(
    api_key: &str,
    api_secret: &str,
    token: &str,
) -> Result<LastFmSession, String> {
    validate_credentials(api_key, api_secret)?;
    let token = token.trim();
    if token.is_empty() || token.len() > 128 {
        return Err("Last.fm authorization token is invalid".to_string());
    }
    let params = BTreeMap::from([
        ("api_key".to_string(), api_key.trim().to_string()),
        ("method".to_string(), "auth.getSession".to_string()),
        ("token".to_string(), token.to_string()),
    ]);
    let response = post(params, api_secret).await?;
    let session = response
        .get("session")
        .and_then(Value::as_object)
        .ok_or_else(|| "Last.fm did not return a session".to_string())?;
    let username = session
        .get("name")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Last.fm session has no username".to_string())?
        .to_string();
    let session_key = session
        .get("key")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Last.fm session has no key".to_string())?
        .to_string();
    Ok(LastFmSession {
        username,
        session_key,
    })
}

pub fn status(app: &tauri::AppHandle) -> Result<LastFmStatus, String> {
    let session_key = crate::settings_store::secret_value(app, SESSION_KEY_SECRET)?;
    let username = crate::settings_store::secret_value(app, USERNAME_SECRET)?;
    Ok(LastFmStatus {
        connected: session_key
            .as_deref()
            .is_some_and(|value| !value.is_empty()),
        username,
    })
}

pub async fn scrobble(
    app: &tauri::AppHandle,
    track: &MusicTrack,
    started_at: u64,
) -> Result<bool, String> {
    let Some(api_key) = crate::settings_store::secret_value(app, API_KEY_SECRET)? else {
        return Ok(false);
    };
    let Some(api_secret) = crate::settings_store::secret_value(app, API_SECRET_SECRET)? else {
        return Ok(false);
    };
    let Some(session_key) = crate::settings_store::secret_value(app, SESSION_KEY_SECRET)? else {
        return Ok(false);
    };
    let mut params = BTreeMap::from([
        ("api_key".to_string(), api_key),
        ("artist".to_string(), track.artist.clone()),
        ("chosenByUser".to_string(), "1".to_string()),
        ("duration".to_string(), track.duration_seconds.to_string()),
        ("method".to_string(), "track.scrobble".to_string()),
        ("sk".to_string(), session_key),
        ("timestamp".to_string(), started_at.to_string()),
        ("track".to_string(), track.title.clone()),
    ]);
    if let Some(album) = track
        .album
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        params.insert("album".to_string(), album.to_string());
    }
    post(params, &api_secret).await?;
    Ok(true)
}

async fn post(mut params: BTreeMap<String, String>, secret: &str) -> Result<Value, String> {
    let signature = signature(&params, secret);
    params.insert("api_sig".to_string(), signature);
    params.insert("format".to_string(), "json".to_string());
    let response = reqwest::Client::new()
        .post(LASTFM_API)
        .timeout(Duration::from_secs(20))
        .form(&params)
        .send()
        .await
        .map_err(|error| format!("Last.fm request failed: {error}"))?;
    let status = response.status();
    let value = response
        .json::<Value>()
        .await
        .map_err(|error| format!("Last.fm response was invalid: {error}"))?;
    if let Some(code) = value.get("error").and_then(Value::as_i64) {
        let message = value
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("Last.fm rejected the request");
        return Err(format!("Last.fm error {code}: {message}"));
    }
    if !status.is_success() {
        return Err(format!("Last.fm returned HTTP {status}"));
    }
    Ok(value)
}

fn signature(params: &BTreeMap<String, String>, secret: &str) -> String {
    let mut value = String::new();
    for (name, item) in params {
        if name != "format" && name != "callback" && name != "api_sig" {
            value.push_str(name);
            value.push_str(item);
        }
    }
    value.push_str(secret);
    format!("{:x}", md5::compute(value.as_bytes()))
}

pub fn classify_error(error: &str) -> ConnectorHealth {
    let lower = error.to_ascii_lowercase();
    if lower.contains("request failed") || lower.contains("offline") || lower.contains("timed out")
    {
        ConnectorHealth::Offline
    } else {
        ConnectorHealth::Degraded
    }
}

fn health_code(health: ConnectorHealth) -> u8 {
    match health {
        ConnectorHealth::Unknown => 0,
        ConnectorHealth::Healthy => 1,
        ConnectorHealth::Degraded => 2,
        ConnectorHealth::Offline => 3,
    }
}

fn validate_credentials(api_key: &str, api_secret: &str) -> Result<(), String> {
    if api_key.trim().is_empty()
        || api_secret.trim().is_empty()
        || api_key.len() > 128
        || api_secret.len() > 128
    {
        return Err("Last.fm API key and secret are required".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_signature_sorts_parameters_and_appends_secret() {
        let params = BTreeMap::from([
            ("token".to_string(), "token".to_string()),
            ("method".to_string(), "auth.getSession".to_string()),
            ("api_key".to_string(), "key".to_string()),
            ("format".to_string(), "json".to_string()),
        ]);
        assert_eq!(
            signature(&params, "secret"),
            "9ac306496295a8866c4a8673395540eb"
        );
    }
}
