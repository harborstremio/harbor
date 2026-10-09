use super::identity;
use serde_json::Value;
use std::time::Duration;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);
const API: &str = "https://api-v2.soundcloud.com";
const API_HOST: &str = "api-v2.soundcloud.com";
const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

enum ApiError {
    Unauthorized,
    Message(String),
}

pub async fn get(path: &str, params: &[(&str, String)]) -> Result<Value, String> {
    get_url(&format!("{API}{path}"), params).await
}

pub async fn get_url(url: &str, params: &[(&str, String)]) -> Result<Value, String> {
    let url = safe_api_url(url)?;
    let issued = identity::ensure().await?;
    match request(&url, params, &issued).await {
        Ok(value) => Ok(value),
        Err(ApiError::Message(message)) => Err(message),
        Err(ApiError::Unauthorized) => {
            identity::invalidate(&issued).await;
            let renewed = identity::ensure().await?;
            match request(&url, params, &renewed).await {
                Ok(value) => Ok(value),
                Err(ApiError::Message(message)) => Err(message),
                Err(ApiError::Unauthorized) => Err("SoundCloud rejected the request".to_string()),
            }
        }
    }
}

async fn request(url: &str, params: &[(&str, String)], id: &str) -> Result<Value, ApiError> {
    let response = http()
        .map_err(ApiError::Message)?
        .get(url)
        .query(params)
        .query(&[("client_id", id)])
        .send()
        .await
        .map_err(|error| ApiError::Message(format!("SoundCloud request failed: {error}")))?;
    let status = response.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(ApiError::Unauthorized);
    }
    if !status.is_success() {
        return Err(ApiError::Message(format!(
            "SoundCloud returned HTTP {status}"
        )));
    }
    response
        .json::<Value>()
        .await
        .map_err(|error| ApiError::Message(format!("SoundCloud response was invalid: {error}")))
}

pub(super) fn http() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(BROWSER_UA)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|error| format!("SoundCloud client is unavailable: {error}"))
}

fn safe_api_url(raw: &str) -> Result<String, String> {
    let parsed =
        url::Url::parse(raw.trim()).map_err(|_| "Invalid SoundCloud request".to_string())?;
    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    if parsed.scheme() != "https" || host != API_HOST {
        return Err("Invalid SoundCloud request".to_string());
    }
    Ok(parsed.to_string())
}

pub fn safe_media_url(raw: &str) -> Result<String, String> {
    let parsed = url::Url::parse(raw.trim())
        .map_err(|_| "SoundCloud returned an unusable stream URL".to_string())?;
    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    let known = host.ends_with(".sndcdn.com")
        || host.ends_with(".soundcloud.com")
        || host.ends_with(".soundcloud.cloud");
    if parsed.scheme() != "https" || !known {
        return Err("SoundCloud returned an unusable stream URL".to_string());
    }
    Ok(parsed.to_string())
}

pub fn safe_permalink(raw: &str) -> Result<String, String> {
    let parsed =
        url::Url::parse(raw.trim()).map_err(|_| "Invalid SoundCloud track URL".to_string())?;
    let host = parsed
        .host_str()
        .unwrap_or_default()
        .trim_start_matches("www.")
        .to_ascii_lowercase();
    if parsed.scheme() != "https" || (host != "soundcloud.com" && host != "m.soundcloud.com") {
        return Err("Invalid SoundCloud track URL".to_string());
    }
    Ok(parsed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_calls_stay_on_the_internal_host() {
        assert!(safe_api_url("https://api-v2.soundcloud.com/search/tracks").is_ok());
        assert!(safe_api_url("http://api-v2.soundcloud.com/search/tracks").is_err());
        assert!(safe_api_url("https://evil.test/search/tracks").is_err());
    }

    #[test]
    fn stream_urls_stay_on_soundcloud_delivery_hosts() {
        assert!(safe_media_url("https://cf-media.sndcdn.com/abc.128.mp3?Policy=x").is_ok());
        assert!(safe_media_url(
            "https://playback.media-streaming.soundcloud.cloud/a/playlist.m3u8"
        )
        .is_ok());
        assert!(safe_media_url("https://evil.test/abc.mp3").is_err());
        assert!(safe_media_url("http://cf-media.sndcdn.com/abc.mp3").is_err());
    }

    #[test]
    fn permalinks_require_https_soundcloud() {
        assert!(safe_permalink("https://soundcloud.com/muse/hysteria").is_ok());
        assert!(safe_permalink("https://m.soundcloud.com/muse/hysteria").is_ok());
        assert!(safe_permalink("http://soundcloud.com/muse/hysteria").is_err());
        assert!(safe_permalink("https://example.com/muse/hysteria").is_err());
    }
}
