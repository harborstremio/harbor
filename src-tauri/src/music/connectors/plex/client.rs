use crate::music::connector::ConnectorHealth;
use serde_json::Value;
use std::sync::LazyLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const API_VERSION: &str = "1.2.2";
pub const AGENT: &str = "Harbor/1.0";
pub const ACCOUNT_ORIGIN: &str = "https://clients.plex.tv";
pub const COVER_SIZE: u32 = 480;
pub const CIRCLE_SIZE: u32 = 320;

static CLIENT: LazyLock<Result<reqwest::Client, String>> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent(AGENT)
        .connect_timeout(Duration::from_secs(6))
        .gzip(true)
        .build()
        .map_err(|error| error.to_string())
});

fn client() -> Result<&'static reqwest::Client, String> {
    CLIENT.as_ref().map_err(Clone::clone)
}

pub fn encode(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

pub fn normalized_origin(raw: &str) -> Result<String, String> {
    let parsed = url::Url::parse(raw.trim()).map_err(|_| invalid_origin())?;
    if !matches!(parsed.scheme(), "http" | "https")
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err(invalid_origin());
    }
    let port = match parsed.port() {
        Some(port) => format!(":{port}"),
        None => String::new(),
    };
    Ok(format!(
        "{}://{}{port}",
        parsed.scheme(),
        parsed.host_str().unwrap_or_default()
    ))
}

fn invalid_origin() -> String {
    "Enter a Plex server address such as https://192-168-1-8.plex.direct:32400".to_string()
}

pub fn safe_path(path: &str) -> Result<String, String> {
    let path = path.trim();
    if !path.starts_with('/') || path.contains("..") || path.contains(['\\', ' ', '"']) {
        return Err("Plex returned an unusable resource path".to_string());
    }
    Ok(path.to_string())
}

pub fn safe_key(raw: &str) -> Result<String, String> {
    let key = raw.trim();
    if key.is_empty()
        || key.len() > 40
        || !key
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Plex item id is invalid".to_string());
    }
    Ok(key.to_string())
}

pub async fn get_json(
    origin: &str,
    path: &str,
    client_id: &str,
    token: Option<&str>,
    timeout: Duration,
) -> Result<Value, String> {
    let request = client()?
        .get(format!("{origin}{path}"))
        .timeout(timeout)
        .header("Accept", "application/json")
        .header("X-Plex-Product", "Harbor")
        .header("X-Plex-Version", "1")
        .header("X-Plex-Platform", std::env::consts::OS)
        .header("X-Plex-Platform-Version", "1")
        .header("X-Plex-Device", "Harbor")
        .header("X-Plex-Device-Name", "Harbor Desktop")
        .header("X-Plex-Model", "standalone")
        .header("X-Plex-Pms-Api-Version", API_VERSION)
        .header("X-Plex-Client-Identifier", client_id);
    let request = match token {
        Some(token) => request.header("X-Plex-Token", token),
        None => request,
    };
    let response = request
        .send()
        .await
        .map_err(|error| format!("Plex request failed: {error}"))?;
    let status = response.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err("Plex rejected the stored access token".to_string());
    }
    if !status.is_success() {
        return Err(format!("Plex answered {}", status.as_u16()));
    }
    response
        .json::<Value>()
        .await
        .map_err(|error| format!("Plex sent an unreadable response: {error}"))
}

pub fn artwork_url(origin: &str, token: &str, thumb: &str, size: u32) -> String {
    let Ok(path) = safe_path(thumb) else {
        return String::new();
    };
    let inner = format!("{path}?X-Plex-Token={}", encode(token));
    format!(
        "{origin}/photo/:/transcode?url={}&width={size}&height={size}&minSize=1&upscale=1&format=jpg&quality=-1&X-Plex-Token={}",
        encode(&inner),
        encode(token)
    )
}

pub fn direct_stream_url(origin: &str, token: &str, part: &str) -> Result<String, String> {
    let path = safe_path(part)?;
    Ok(format!("{origin}{path}?X-Plex-Token={}", encode(token)))
}

pub fn transcode_stream_url(origin: &str, token: &str, client_id: &str, key: &str) -> String {
    format!(
        "{origin}/music/:/transcode/universal/start.mp3?path={}&mediaIndex=0&partIndex=0&protocol=http&offset=0&directPlay=0&directStream=1&musicBitrate=320&hasMDE=1&X-Plex-Client-Identifier={}&X-Plex-Session-Identifier={}&X-Plex-Token={}",
        encode(&format!("/library/metadata/{key}")),
        encode(client_id),
        encode(&uuid::Uuid::new_v4().to_string()),
        encode(token)
    )
}

pub fn mime_for(container: Option<&str>, codec: Option<&str>) -> String {
    let hint = container.or(codec).unwrap_or_default().to_ascii_lowercase();
    match hint.as_str() {
        "flac" => "audio/flac",
        "wav" => "audio/wav",
        "ogg" | "opus" | "vorbis" => "audio/ogg",
        "m4a" | "mp4" | "aac" | "alac" => "audio/mp4",
        "aiff" | "aif" => "audio/aiff",
        _ => "audio/mpeg",
    }
    .to_string()
}

pub fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs() as i64)
        .unwrap_or_default()
}

pub fn classify_error(error: &str) -> ConnectorHealth {
    let lower = error.to_ascii_lowercase();
    if [
        "timed out",
        "timeout",
        "network",
        "connection",
        "dns",
        "resolve host",
        "offline",
        "rejected",
        "unauthorized",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
    {
        ConnectorHealth::Offline
    } else {
        ConnectorHealth::Degraded
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transport_failures_read_as_offline_and_parse_failures_as_degraded() {
        assert_eq!(
            classify_error("Plex request failed: connection refused"),
            ConnectorHealth::Offline
        );
        assert_eq!(
            classify_error("Plex rejected the stored access token"),
            ConnectorHealth::Offline
        );
        assert_eq!(
            classify_error("Plex sent an unreadable response"),
            ConnectorHealth::Degraded
        );
    }

    #[test]
    fn origins_drop_paths_and_reject_credentials() {
        assert_eq!(
            normalized_origin("https://plex.local:32400/library/"),
            Ok("https://plex.local:32400".to_string())
        );
        assert_eq!(
            normalized_origin("http://10.0.0.4:32400"),
            Ok("http://10.0.0.4:32400".to_string())
        );
        assert!(normalized_origin("https://user:pass@plex.local:32400").is_err());
        assert!(normalized_origin("ftp://plex.local").is_err());
        assert!(normalized_origin("plex.local:32400").is_err());
    }

    #[test]
    fn paths_must_be_server_relative_and_free_of_traversal() {
        assert!(safe_path("/library/parts/4/17/file.flac").is_ok());
        assert!(safe_path("library/parts/4").is_err());
        assert!(safe_path("/library/../etc/passwd").is_err());
        assert!(safe_path("/library/parts/4 5").is_err());
    }

    #[test]
    fn keys_are_limited_to_plex_rating_key_shapes() {
        assert_eq!(safe_key(" 46618 "), Ok("46618".to_string()));
        assert!(safe_key("").is_err());
        assert!(safe_key("46618/children").is_err());
        assert!(safe_key("46618; rm").is_err());
    }

    #[test]
    fn artwork_carries_the_token_inside_and_outside_the_inner_url() {
        let url = artwork_url(
            "https://plex.local:32400",
            "tok en",
            "/library/metadata/12/thumb/1715",
            400,
        );
        assert!(url.starts_with("https://plex.local:32400/photo/:/transcode?url="));
        assert!(url.contains("X-Plex-Token%3Dtok%2Ben"));
        assert!(url.ends_with("&X-Plex-Token=tok+en"));
        assert!(url.contains("width=400&height=400"));
        assert!(artwork_url("https://plex.local", "t", "not-a-path", 400).is_empty());
    }

    #[test]
    fn direct_streams_append_the_token_to_the_part_key() {
        assert_eq!(
            direct_stream_url("https://plex.local", "abc", "/library/parts/1/2/a.flac"),
            Ok("https://plex.local/library/parts/1/2/a.flac?X-Plex-Token=abc".to_string())
        );
        assert!(direct_stream_url("https://plex.local", "abc", "parts/1").is_err());
    }

    #[test]
    fn transcode_urls_pin_the_client_identifier_and_bitrate() {
        let url = transcode_stream_url("https://plex.local", "abc", "harbor-cid", "77");
        assert!(
            url.contains("/music/:/transcode/universal/start.mp3?path=%2Flibrary%2Fmetadata%2F77")
        );
        assert!(url.contains("musicBitrate=320"));
        assert!(url.contains("X-Plex-Client-Identifier=harbor-cid"));
        assert!(url.contains("X-Plex-Session-Identifier="));
    }

    #[test]
    fn mime_types_follow_the_container_then_the_codec() {
        assert_eq!(mime_for(Some("flac"), None), "audio/flac");
        assert_eq!(mime_for(None, Some("aac")), "audio/mp4");
        assert_eq!(mime_for(Some("mp3"), Some("mp3")), "audio/mpeg");
        assert_eq!(mime_for(None, None), "audio/mpeg");
    }
}
