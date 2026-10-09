use super::client;
use super::parse::{container, nodes};
use futures_util::future::join_all;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tauri::Manager;

const DEVICE_SECRET_PREFIX: &str = "harbor.plex-auth.device.v1";
const SERVER_SECRET_PREFIX: &str = "harbor.media-server.token.v1.";
const ACCOUNT_TIMEOUT: Duration = Duration::from_secs(7);
const PROBE_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_ACCOUNT_TOKENS: usize = 3;
const MAX_PROBES: usize = 8;

pub const NOT_CONNECTED: &str = "Connect Plex to play from your server";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlexConfig {
    pub origin: String,
    pub token: String,
    pub client_id: String,
    pub section: String,
    pub section_uuid: Option<String>,
    pub server: Option<String>,
}

impl PlexConfig {
    pub fn detail(&self) -> String {
        match self.server.as_deref() {
            Some(server) if !server.is_empty() => server.to_string(),
            _ => self.origin.clone(),
        }
    }
}

pub enum Stored {
    Ready(PlexConfig),
    Dismissed,
    Absent,
}

fn config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("music");
    Ok(directory.join("plex.json"))
}

pub fn load(app: &tauri::AppHandle) -> Stored {
    let Ok(path) = config_path(app) else {
        return Stored::Absent;
    };
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return Stored::Absent;
    };
    let Ok(value) = serde_json::from_str::<Value>(&raw) else {
        return Stored::Absent;
    };
    if value.get("dismissed").and_then(Value::as_bool) == Some(true) {
        return Stored::Dismissed;
    }
    match serde_json::from_value::<PlexConfig>(value) {
        Ok(config) if !config.origin.is_empty() && !config.token.is_empty() => {
            Stored::Ready(config)
        }
        _ => Stored::Absent,
    }
}

fn write(app: &tauri::AppHandle, value: &Value) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let body = serde_json::to_string(value).map_err(|error| error.to_string())?;
    std::fs::write(&path, body).map_err(|error| error.to_string())
}

pub fn store(app: &tauri::AppHandle, config: &PlexConfig) -> Result<(), String> {
    let value = serde_json::to_value(config).map_err(|error| error.to_string())?;
    write(app, &value)
}

pub fn dismiss(app: &tauri::AppHandle) -> Result<(), String> {
    write(app, &serde_json::json!({ "dismissed": true }))
}

fn secrets(app: &tauri::AppHandle) -> serde_json::Map<String, Value> {
    let Ok(Some(raw)) = crate::settings_store::secrets_read(app.clone()) else {
        return serde_json::Map::new();
    };
    serde_json::from_str::<Value>(&raw)
        .ok()
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default()
}

fn secret_values(store: &serde_json::Map<String, Value>, prefix: &str) -> Vec<String> {
    let mut keys = store
        .keys()
        .filter(|key| key.starts_with(prefix))
        .collect::<Vec<_>>();
    keys.sort();
    let mut values = Vec::new();
    for key in keys {
        let Some(value) = store.get(key).and_then(Value::as_str) else {
            continue;
        };
        let value = value.trim();
        if !value.is_empty() && !values.iter().any(|held| held == value) {
            values.push(value.to_string());
        }
    }
    values
}

pub fn client_identifier(app: &tauri::AppHandle) -> Option<String> {
    secret_values(&secrets(app), DEVICE_SECRET_PREFIX)
        .into_iter()
        .next()
}

struct Candidate {
    origin: String,
    token: String,
    server: String,
    rank: u8,
}

fn candidates(resources: &Value) -> Vec<Candidate> {
    let mut out = Vec::new();
    for resource in resources.as_array().map(Vec::as_slice).unwrap_or(&[]) {
        let provides = resource
            .get("provides")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if !provides.split(',').any(|entry| entry.trim() == "server") {
            continue;
        }
        let Some(token) = resource.get("accessToken").and_then(Value::as_str) else {
            continue;
        };
        let server = resource
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("Plex")
            .to_string();
        for connection in nodes(resource, "connections") {
            let relay = connection.get("relay").and_then(Value::as_bool) == Some(true);
            let local = connection.get("local").and_then(Value::as_bool) == Some(true);
            let uri = connection.get("uri").and_then(Value::as_str).unwrap_or("");
            let Ok(origin) = client::normalized_origin(uri) else {
                continue;
            };
            out.push(Candidate {
                origin,
                token: token.to_string(),
                server: server.clone(),
                rank: if relay {
                    2
                } else if local {
                    0
                } else {
                    1
                },
            });
        }
    }
    out.sort_by_key(|candidate| candidate.rank);
    out.truncate(MAX_PROBES);
    out
}

pub async fn music_section(
    origin: &str,
    token: &str,
    client_id: &str,
) -> Result<(String, Option<String>), String> {
    let body = client::get_json(
        origin,
        "/library/sections",
        client_id,
        Some(token),
        PROBE_TIMEOUT,
    )
    .await?;
    nodes(container(&body), "Directory")
        .iter()
        .find(|entry| entry.get("type").and_then(Value::as_str) == Some("artist"))
        .and_then(|entry| {
            let key = entry
                .get("key")
                .and_then(Value::as_str)
                .map(str::to_string)?;
            let uuid = entry
                .get("uuid")
                .and_then(Value::as_str)
                .map(str::to_string);
            Some((key, uuid))
        })
        .ok_or_else(|| "This Plex server has no music library".to_string())
}

pub async fn discover(app: &tauri::AppHandle) -> Result<PlexConfig, String> {
    let vault = secrets(app);
    let client_id = secret_values(&vault, DEVICE_SECRET_PREFIX)
        .into_iter()
        .next()
        .ok_or_else(|| NOT_CONNECTED.to_string())?;
    let mut accounts = secret_values(&vault, SERVER_SECRET_PREFIX);
    accounts.truncate(MAX_ACCOUNT_TOKENS);
    if accounts.is_empty() {
        return Err(NOT_CONNECTED.to_string());
    }
    for account in accounts {
        let Ok(resources) = client::get_json(
            client::ACCOUNT_ORIGIN,
            "/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1",
            &client_id,
            Some(&account),
            ACCOUNT_TIMEOUT,
        )
        .await
        else {
            continue;
        };
        let servers = candidates(&resources);
        if servers.is_empty() {
            continue;
        }
        let probes = join_all(servers.iter().map(|candidate| {
            let client_id = client_id.clone();
            async move { music_section(&candidate.origin, &candidate.token, &client_id).await }
        }))
        .await;
        for (candidate, probe) in servers.into_iter().zip(probes) {
            let Ok((section, section_uuid)) = probe else {
                continue;
            };
            let config = PlexConfig {
                origin: candidate.origin,
                token: candidate.token,
                client_id: client_id.clone(),
                section,
                section_uuid,
                server: Some(candidate.server),
            };
            let _ = store(app, &config);
            return Ok(config);
        }
    }
    Err("No Plex server with a music library was reachable".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store_with(pairs: &[(&str, &str)]) -> serde_json::Map<String, Value> {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_string(), Value::String((*value).to_string())))
            .collect()
    }

    #[test]
    fn device_identifiers_come_from_the_video_plex_sign_in() {
        let store = store_with(&[
            ("harbor.plex-auth.device.v1.default", "cid-one"),
            ("harbor.trakt.session.v1.default", "nope"),
        ]);
        assert_eq!(
            secret_values(&store, DEVICE_SECRET_PREFIX),
            vec!["cid-one".to_string()]
        );
    }

    #[test]
    fn server_tokens_are_deduplicated_and_ordered_by_key() {
        let store = store_with(&[
            ("harbor.media-server.token.v1.default.b", "two"),
            ("harbor.media-server.token.v1.default.a", "one"),
            ("harbor.media-server.token.v1.default.c", "one"),
            ("harbor.lastfm.v1.sessionKey", "skip"),
        ]);
        assert_eq!(
            secret_values(&store, SERVER_SECRET_PREFIX),
            vec!["one".to_string(), "two".to_string()]
        );
    }

    #[test]
    fn candidates_prefer_local_then_remote_then_relay() {
        let resources = serde_json::json!([
            { "name": "Ignore", "provides": "player", "accessToken": "x", "connections": [] },
            {
                "name": "Attic",
                "provides": "server,player",
                "accessToken": "srv",
                "connections": [
                    { "uri": "https://relay.plex.direct:443", "relay": true, "local": false },
                    { "uri": "https://remote.plex.direct:32400", "relay": false, "local": false },
                    { "uri": "https://192-168-1-8.plex.direct:32400", "relay": false, "local": true }
                ]
            }
        ]);
        let found = candidates(&resources);
        assert_eq!(found.len(), 3);
        assert_eq!(found[0].origin, "https://192-168-1-8.plex.direct:32400");
        assert_eq!(found[1].origin, "https://remote.plex.direct:32400");
        assert_eq!(found[2].origin, "https://relay.plex.direct");
        assert_eq!(found[0].token, "srv");
        assert_eq!(found[0].server, "Attic");
    }

    #[test]
    fn stored_configs_round_trip_and_dismissal_is_recognised() {
        let config = PlexConfig {
            origin: "https://plex.local:32400".to_string(),
            token: "abc".to_string(),
            client_id: "cid".to_string(),
            section: "3".to_string(),
            section_uuid: Some("uuid".to_string()),
            server: Some("Attic".to_string()),
        };
        let encoded = serde_json::to_value(&config).expect("encode config");
        assert_eq!(encoded["sectionUuid"], "uuid");
        assert_eq!(encoded["clientId"], "cid");
        let decoded = serde_json::from_value::<PlexConfig>(encoded).expect("decode config");
        assert_eq!(decoded.detail(), "Attic");
        assert_eq!(
            serde_json::json!({ "dismissed": true })
                .get("dismissed")
                .and_then(Value::as_bool),
            Some(true)
        );
    }
}
