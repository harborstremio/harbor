use super::config::{self, JellyfinConfig};
use super::http::{dispatch, get, post, DEVICE_NAME};
use super::items::safe_item_id;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
use tauri::Manager;

pub const NOT_CONNECTED: &str = "Connect a Jellyfin server to play from it";

pub struct PlaybackSession {
    pub item_id: String,
    pub play_session_id: String,
    pub media_source_id: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct MediaSource {
    #[serde(rename = "Id")]
    pub id: Option<String>,
    #[serde(rename = "Container")]
    pub container: Option<String>,
    #[serde(rename = "Bitrate")]
    pub bitrate: Option<u64>,
    #[serde(rename = "SupportsDirectPlay")]
    pub supports_direct_play: bool,
    #[serde(rename = "SupportsDirectStream")]
    pub supports_direct_stream: bool,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct PlaybackInfo {
    #[serde(rename = "MediaSources")]
    pub media_sources: Vec<MediaSource>,
    #[serde(rename = "PlaySessionId")]
    pub play_session_id: Option<String>,
}

pub async fn sign_in(
    app: &tauri::AppHandle,
    fields: &HashMap<String, String>,
) -> Result<JellyfinConfig, String> {
    let address = fields.get("url").map(String::as_str).unwrap_or_default();
    let origin = config::normalize_origin(address)?;
    let user_name = fields
        .get("username")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Enter the Jellyfin username".to_string())?;
    let password = fields.get("password").cloned().unwrap_or_default();
    let root = app.path().app_data_dir();
    let root = root.map_err(|error| error.to_string())?;
    let device_id = config::device_id(&root, &origin, &user_name);

    let public = dispatch(
        &origin,
        &device_id,
        None,
        reqwest::Method::GET,
        "/System/Info/Public",
        &[],
        None,
    )
    .await?;
    let server_name = public["ServerName"]
        .as_str()
        .unwrap_or_default()
        .to_string();

    let authenticated = dispatch(
        &origin,
        &device_id,
        None,
        reqwest::Method::POST,
        "/Users/AuthenticateByName",
        &[],
        Some(json!({ "Username": user_name, "Pw": password })),
    )
    .await?;
    let token = authenticated["AccessToken"]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Jellyfin did not issue an access token".to_string())?
        .to_string();
    let user_id = authenticated["User"]["Id"]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Jellyfin did not return the signed in account".to_string())?
        .to_string();

    let account = authenticated["User"]["Name"].as_str();
    let mut config = JellyfinConfig {
        origin,
        user_id,
        user_name: account.unwrap_or(&user_name).to_string(),
        token,
        device_id,
        server_name,
        library_id: None,
    };
    config.library_id = music_library(&config).await?;
    Ok(config)
}

pub async fn music_library(config: &JellyfinConfig) -> Result<Option<String>, String> {
    let value = get(
        config,
        "/UserViews",
        &[
            ("userId", config.user_id.clone()),
            ("includeExternalContent", "false".to_string()),
        ],
    )
    .await?;
    let page = serde_json::from_value::<super::items::ItemPage>(value)
        .map_err(|error| format!("Jellyfin libraries were unreadable: {error}"))?;
    Ok(page
        .items
        .into_iter()
        .find(|item| item.collection_type == "music")
        .map(|item| item.id))
}

pub async fn report_started(
    config: &JellyfinConfig,
    session: &PlaybackSession,
    direct: bool,
) -> Result<(), String> {
    let method = if direct { "DirectStream" } else { "Transcode" };
    let mut body = json!({
        "ItemId": session.item_id,
        "PlaySessionId": session.play_session_id,
        "CanSeek": true,
        "IsPaused": false,
        "PlayMethod": method
    });
    if let Some(source) = session.media_source_id.as_ref() {
        body["MediaSourceId"] = json!(source);
    }
    post(config, "/Sessions/Playing", &[], body).await.map(drop)
}

pub async fn report_stopped(
    config: &JellyfinConfig,
    session: &PlaybackSession,
) -> Result<(), String> {
    let mut body = json!({
        "ItemId": session.item_id,
        "PlaySessionId": session.play_session_id
    });
    if let Some(source) = session.media_source_id.as_ref() {
        body["MediaSourceId"] = json!(source);
    }
    post(config, "/Sessions/Playing/Stopped", &[], body)
        .await
        .map(drop)
}

pub async fn playback_info(
    config: &JellyfinConfig,
    item_id: &str,
    bitrate: u64,
) -> Result<PlaybackInfo, String> {
    let item_id = safe_item_id(item_id)?;
    let containers = super::stream::DIRECT_CONTAINERS;
    let value = post(
        config,
        &format!("/Items/{item_id}/PlaybackInfo"),
        &[("userId", config.user_id.clone())],
        json!({
            "UserId": config.user_id,
            "MaxStreamingBitrate": bitrate,
            "EnableDirectPlay": true,
            "EnableDirectStream": true,
            "EnableTranscoding": true,
            "DeviceProfile": {
                "Name": DEVICE_NAME,
                "DirectPlayProfiles": [{ "Type": "Audio", "Container": containers }],
                "MaxStreamingBitrate": bitrate,
                "MaxStaticBitrate": bitrate,
                "MusicStreamingTranscodingBitrate": bitrate,
                "TranscodingProfiles": [{
                    "Type": "Audio",
                    "Container": "mp3",
                    "AudioCodec": "mp3",
                    "Protocol": "http",
                    "Context": "Streaming"
                }],
                "CodecProfiles": [],
                "SubtitleProfiles": []
            }
        }),
    )
    .await?;
    serde_json::from_value(value)
        .map_err(|error| format!("Jellyfin playback details were unreadable: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn playback_info_parses_the_source_a_direct_play_decision_needs() {
        let info = serde_json::from_str::<PlaybackInfo>(
            r#"{"MediaSources":[{"Id":"m1","Container":"flac","Bitrate":940000,
                "SupportsDirectPlay":true,"SupportsDirectStream":true}],"PlaySessionId":"ps1"}"#,
        )
        .expect("playback info");
        assert_eq!(info.play_session_id.as_deref(), Some("ps1"));
        let source = &info.media_sources[0];
        assert_eq!(source.container.as_deref(), Some("flac"));
        assert_eq!(source.bitrate, Some(940_000));
        assert!(source.supports_direct_play);
        assert!(source.supports_direct_stream);
    }
}
