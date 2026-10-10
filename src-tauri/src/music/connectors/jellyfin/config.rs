use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;

const MIRROR_SECRET: &str = "harbor.media-server.mirror.v1";
const TOKEN_SECRET: &str = "harbor.media-server.token.v1";
const SHARED_DEVICE_ID: &str = "harbor";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JellyfinConfig {
    pub origin: String,
    pub user_id: String,
    pub user_name: String,
    pub token: String,
    pub device_id: String,
    pub server_name: String,
    pub library_id: Option<String>,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Stored {
    #[serde(default)]
    disabled: bool,
    #[serde(default)]
    server: Option<JellyfinConfig>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct MirrorEntry {
    id: String,
    profile_id: String,
    provider: String,
    origin: String,
    user_id: String,
    name: String,
}

pub fn load(app: &tauri::AppHandle) -> Option<JellyfinConfig> {
    let stored = read(app).unwrap_or_default();
    if let Some(server) = stored.server {
        return Some(server);
    }
    if stored.disabled {
        return None;
    }
    adopt(app)
}

pub fn save(app: &tauri::AppHandle, config: &JellyfinConfig) -> Result<(), String> {
    write(
        app,
        &Stored {
            disabled: false,
            server: Some(config.clone()),
        },
    )
}

pub fn clear(app: &tauri::AppHandle) -> Result<(), String> {
    write(
        app,
        &Stored {
            disabled: true,
            server: None,
        },
    )
}

fn adopt(app: &tauri::AppHandle) -> Option<JellyfinConfig> {
    let raw = crate::settings_store::secret_value(app, MIRROR_SECRET).ok()??;
    let entries = serde_json::from_str::<Vec<MirrorEntry>>(&raw).ok()?;
    entries
        .into_iter()
        .filter(|entry| entry.provider == "jellyfin")
        .find_map(|entry| {
            let key = format!("{TOKEN_SECRET}.{}.{}", entry.profile_id, entry.id);
            let token = crate::settings_store::secret_value(app, &key).ok()??;
            if token.is_empty() || entry.user_id.is_empty() {
                return None;
            }
            Some(JellyfinConfig {
                origin: normalize_origin(&entry.origin).ok()?,
                user_id: entry.user_id,
                user_name: String::new(),
                token,
                device_id: SHARED_DEVICE_ID.to_string(),
                server_name: entry.name,
                library_id: None,
            })
        })
}

fn path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("music");
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("jellyfin.json"))
}

fn read(app: &tauri::AppHandle) -> Option<Stored> {
    let contents = std::fs::read_to_string(path(app).ok()?).ok()?;
    serde_json::from_str(&contents).ok()
}

fn write(app: &tauri::AppHandle, stored: &Stored) -> Result<(), String> {
    let target = path(app)?;
    let contents = serde_json::to_string(stored).map_err(|error| error.to_string())?;
    let temporary = target.with_extension("json.tmp");
    std::fs::write(&temporary, contents.as_bytes()).map_err(|error| error.to_string())?;
    std::fs::rename(&temporary, &target).map_err(|error| error.to_string())
}

pub fn normalize_origin(value: &str) -> Result<String, String> {
    let url = reqwest::Url::parse(value.trim())
        .map_err(|_| "Enter the full Jellyfin server address".to_string())?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("Enter the full Jellyfin server address".to_string());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Leave the sign in details out of the server address".to_string());
    }
    let mut base = url;
    base.set_query(None);
    base.set_fragment(None);
    Ok(base.as_str().trim_end_matches('/').to_string())
}

pub fn device_id(root: &Path, origin: &str, user_name: &str) -> String {
    let seed = format!("{}|{origin}|{user_name}", root.display());
    format!("harbor-music-{:016x}", stable_hash(&seed))
}

fn stable_hash(value: &str) -> u64 {
    value
        .as_bytes()
        .iter()
        .fold(0xcbf29ce484222325, |hash, byte| {
            (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn origins_keep_a_reverse_proxy_subpath_and_lose_the_trailing_slash() {
        assert_eq!(
            normalize_origin("https://media.example.test/jellyfin/").expect("subpath origin"),
            "https://media.example.test/jellyfin"
        );
        assert_eq!(
            normalize_origin(" http://192.168.1.20:8096 ").expect("lan origin"),
            "http://192.168.1.20:8096"
        );
        assert_eq!(
            normalize_origin("https://media.example.test/?token=1#top").expect("stripped origin"),
            "https://media.example.test"
        );
    }

    #[test]
    fn origins_reject_other_schemes_and_embedded_credentials() {
        assert!(normalize_origin("jellyfin.example.test").is_err());
        assert!(normalize_origin("ftp://media.example.test").is_err());
        assert!(normalize_origin("https://user:pass@media.example.test").is_err());
    }

    #[test]
    fn device_ids_separate_two_accounts_on_one_machine() {
        let root = Path::new("C:/harbor");
        let first = device_id(root, "https://media.example.test", "josiah");
        let second = device_id(root, "https://media.example.test", "isabel");
        assert_ne!(first, second);
        assert_eq!(
            first,
            device_id(root, "https://media.example.test", "josiah")
        );
        assert!(first.starts_with("harbor-music-"));
        assert!(!first.contains('"'));
    }

    #[test]
    fn stored_state_round_trips_and_defaults_to_enabled() {
        let stored = serde_json::from_str::<Stored>("{}").expect("empty state");
        assert!(!stored.disabled);
        assert!(stored.server.is_none());

        let encoded = serde_json::to_string(&Stored {
            disabled: false,
            server: Some(JellyfinConfig {
                origin: "https://media.example.test".to_string(),
                user_id: "abc".to_string(),
                user_name: "josiah".to_string(),
                token: "tok".to_string(),
                device_id: "harbor-music-1".to_string(),
                server_name: "Basement".to_string(),
                library_id: Some("lib".to_string()),
            }),
        })
        .expect("encode state");
        let decoded = serde_json::from_str::<Stored>(&encoded).expect("decode state");
        assert_eq!(
            decoded.server.expect("server").library_id.as_deref(),
            Some("lib")
        );
    }

    #[test]
    fn mirror_entries_parse_the_video_connection_shape() {
        let entries = serde_json::from_str::<Vec<MirrorEntry>>(
            r#"[{"id":"c1","profileId":"default","provider":"jellyfin",
                 "origin":"http://10.0.0.4:8096","userId":"u1","name":"Basement"},
                {"id":"c2","profileId":"default","provider":"plex",
                 "origin":"http://10.0.0.5:32400","userId":"u2","name":"Attic"}]"#,
        )
        .expect("mirror entries");
        assert_eq!(entries.len(), 2);
        let jellyfin = entries
            .into_iter()
            .find(|entry| entry.provider == "jellyfin")
            .expect("jellyfin entry");
        assert_eq!(jellyfin.user_id, "u1");
        assert_eq!(
            format!("{TOKEN_SECRET}.{}.{}", jellyfin.profile_id, jellyfin.id),
            "harbor.media-server.token.v1.default.c1"
        );
    }
}
