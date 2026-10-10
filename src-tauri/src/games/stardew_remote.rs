//! Fixed public endpoints only. No credentials, caller URLs or automatic retries.
use super::{stardew_manifest::Result, stardew_progress::Work};
use serde_json::Value;
use std::time::Duration;

pub fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent("Harbor-Stardew/1.0")
        .timeout(Duration::from_secs(25))
        .connect_timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "stardew_catalog_network")
}
pub async fn bytes(
    client: &reqwest::Client,
    url: &str,
    limit: usize,
    work: &Work<'_>,
    download: bool,
) -> Result<Vec<u8>> {
    let mut target = reqwest::Url::parse(url).map_err(|_| "stardew_catalog_response")?;
    for redirects in 0..=4 {
        if !allowed(&target, download) {
            return Err("stardew_catalog_response");
        }
        let mut response = work
            .wait(client.get(target.clone()).send())
            .await?
            .map_err(|_| "stardew_catalog_network")?;
        if response.status().is_redirection() {
            if redirects == 4 {
                return Err("stardew_catalog_response");
            }
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or("stardew_catalog_response")?;
            target = target
                .join(location)
                .map_err(|_| "stardew_catalog_response")?;
            continue;
        }
        if matches!(response.status().as_u16(), 403 | 429) {
            return Err("stardew_rate_limit");
        }
        if !response.status().is_success() {
            return Err("stardew_catalog_network");
        }
        let total = response.content_length().unwrap_or(0) as usize;
        if total > limit {
            return Err("stardew_catalog_response");
        }
        let mut body = Vec::new();
        while let Some(chunk) = work
            .wait(response.chunk())
            .await?
            .map_err(|_| "stardew_catalog_network")?
        {
            if body.len().saturating_add(chunk.len()) > limit {
                return Err("stardew_catalog_response");
            }
            body.extend_from_slice(&chunk);
            if download {
                work.progress("downloading", body.len(), total)?;
            }
        }
        return Ok(body);
    }
    Err("stardew_catalog_response")
}
fn allowed(url: &reqwest::Url, download: bool) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && match url.host_str() {
            Some("api.github.com" | "raw.githubusercontent.com") => !download,
            Some(
                "github.com"
                | "release-assets.githubusercontent.com"
                | "objects.githubusercontent.com",
            ) => download,
            _ => false,
        }
}
pub async fn json(client: &reqwest::Client, url: &str, work: &Work<'_>) -> Result<Value> {
    serde_json::from_slice(&bytes(client, url, 3 * 1024 * 1024, work, false).await?)
        .map_err(|_| "stardew_catalog_response")
}
pub fn text(value: &Value, key: &str, max: usize) -> Result<String> {
    value[key]
        .as_str()
        .filter(|v| !v.trim().is_empty() && v.len() <= max && !v.chars().any(char::is_control))
        .map(|v| v.trim().to_owned())
        .ok_or("stardew_catalog_response")
}
pub fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stardew_remote_rejects_untrusted_redirects() {
        for url in [
            "http://github.com/a",
            "https://github.com.evil/a",
            "https://github.com@evil/a",
            "https://127.0.0.1/a",
            "https://user@github.com/a",
            "https://github.com:4433/a",
        ] {
            assert!(!allowed(&reqwest::Url::parse(url).unwrap(), true));
        }
        assert!(allowed(
            &reqwest::Url::parse("https://release-assets.githubusercontent.com/a?token=public")
                .unwrap(),
            true
        ));
        assert!(!allowed(
            &reqwest::Url::parse("https://api.github.com/a").unwrap(),
            true
        ));
    }
}
