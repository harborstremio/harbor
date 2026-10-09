use super::config::JellyfinConfig;
use crate::music::connector::ConnectorHealth;
use serde_json::Value;
use std::sync::OnceLock;
use std::time::Duration;

const VERSION: &str = env!("CARGO_PKG_VERSION");
const CLIENT_NAME: &str = "Harbor";
pub const DEVICE_NAME: &str = "Harbor Music";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const RETRY_CEILING: Duration = Duration::from_secs(4);

fn client() -> Result<&'static reqwest::Client, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .user_agent(format!("Harbor/{VERSION}"))
                .connect_timeout(Duration::from_secs(10))
                .timeout(REQUEST_TIMEOUT)
                .build()
                .map_err(|error| error.to_string())
        })
        .as_ref()
        .map_err(Clone::clone)
}

fn authorization(device_id: &str, token: Option<&str>) -> String {
    let mut value = format!("MediaBrowser Client=\"{CLIENT_NAME}\", Device=\"{DEVICE_NAME}\"");
    value.push_str(&format!(
        ", DeviceId=\"{device_id}\", Version=\"{VERSION}\""
    ));
    if let Some(token) = token.filter(|token| !token.is_empty()) {
        value.push_str(&format!(", Token=\"{token}\""));
    }
    value
}

fn endpoint(origin: &str, path: &str, params: &[(&str, String)]) -> Result<reqwest::Url, String> {
    let mut url = reqwest::Url::parse(&format!("{origin}{path}"))
        .map_err(|error| format!("Jellyfin address is unusable: {error}"))?;
    if !params.is_empty() {
        url.query_pairs_mut()
            .extend_pairs(params.iter().map(|(key, value)| (*key, value.as_str())));
    }
    Ok(url)
}

pub async fn dispatch(
    origin: &str,
    device_id: &str,
    token: Option<&str>,
    method: reqwest::Method,
    path: &str,
    params: &[(&str, String)],
    body: Option<Value>,
) -> Result<Value, String> {
    let url = endpoint(origin, path, params)?;
    let mut attempt = 0;
    loop {
        let mut request = client()?
            .request(method.clone(), url.clone())
            .header(reqwest::header::ACCEPT, "application/json")
            .header(
                reqwest::header::AUTHORIZATION,
                authorization(device_id, token),
            );
        if let Some(body) = body.as_ref() {
            request = request.json(body);
        }
        let response = request
            .send()
            .await
            .map_err(|error| format!("Jellyfin request failed: {error}"))?;
        let status = response.status();
        if status.as_u16() == 503 && attempt == 0 {
            attempt += 1;
            tokio::time::sleep(retry_after(response.headers())).await;
            continue;
        }
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err("Jellyfin rejected the saved sign in".to_string());
        }
        if !status.is_success() {
            return Err(format!("Jellyfin returned {}", status.as_u16()));
        }
        let text = response
            .text()
            .await
            .map_err(|error| format!("Jellyfin response failed: {error}"))?;
        if text.trim().is_empty() {
            return Ok(Value::Null);
        }
        return serde_json::from_str(&text)
            .map_err(|error| format!("Jellyfin response was unreadable: {error}"));
    }
}

fn retry_after(headers: &reqwest::header::HeaderMap) -> Duration {
    headers
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(Duration::from_secs)
        .unwrap_or(RETRY_CEILING)
        .min(RETRY_CEILING)
}

pub async fn get(
    config: &JellyfinConfig,
    path: &str,
    params: &[(&str, String)],
) -> Result<Value, String> {
    dispatch(
        &config.origin,
        &config.device_id,
        Some(&config.token),
        reqwest::Method::GET,
        path,
        params,
        None,
    )
    .await
}

pub async fn post(
    config: &JellyfinConfig,
    path: &str,
    params: &[(&str, String)],
    body: Value,
) -> Result<Value, String> {
    dispatch(
        &config.origin,
        &config.device_id,
        Some(&config.token),
        reqwest::Method::POST,
        path,
        params,
        Some(body),
    )
    .await
}

pub fn classify(error: &str) -> ConnectorHealth {
    let lower = error.to_ascii_lowercase();
    if [
        "timed out",
        "timeout",
        "network",
        "connection",
        "dns",
        "resolve host",
        "offline",
        "request failed",
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
    fn the_authorization_header_uses_the_scheme_that_survives_twelve_zero() {
        let header = authorization("harbor-music-1", Some("tok"));
        assert!(header.starts_with("MediaBrowser "));
        assert!(header.contains("DeviceId=\"harbor-music-1\""));
        assert!(header.contains("Token=\"tok\""));
        assert!(!header.contains("Emby"));
    }

    #[test]
    fn the_sign_in_header_omits_the_token_it_does_not_have_yet() {
        let header = authorization("harbor-music-1", None);
        assert!(!header.contains("Token="));
        assert!(!authorization("harbor-music-1", Some("")).contains("Token="));
    }

    #[test]
    fn endpoints_escape_query_values_and_keep_a_proxy_subpath() {
        let url = endpoint(
            "https://media.example.test/jellyfin",
            "/Items",
            &[("searchTerm", "muse & friends".to_string())],
        )
        .expect("endpoint");
        assert_eq!(url.path(), "/jellyfin/Items");
        assert_eq!(url.query(), Some("searchTerm=muse+%26+friends"));
    }

    #[test]
    fn retry_after_is_honoured_and_capped() {
        let mut headers = reqwest::header::HeaderMap::new();
        assert_eq!(retry_after(&headers), RETRY_CEILING);
        headers.insert(reqwest::header::RETRY_AFTER, "2".parse().expect("header"));
        assert_eq!(retry_after(&headers), Duration::from_secs(2));
        headers.insert(reqwest::header::RETRY_AFTER, "900".parse().expect("header"));
        assert_eq!(retry_after(&headers), RETRY_CEILING);
    }

    #[test]
    fn transport_errors_read_as_offline_and_server_errors_as_degraded() {
        assert_eq!(
            classify("Jellyfin request failed: error sending request"),
            ConnectorHealth::Offline
        );
        assert_eq!(classify("Jellyfin returned 500"), ConnectorHealth::Degraded);
    }
}
