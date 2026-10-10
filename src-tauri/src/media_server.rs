use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaServerRequestArgs {
    origin: String,
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
    timeout_ms: Option<u64>,
}

#[derive(Serialize)]
pub struct MediaServerResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: String,
}

fn client() -> Result<&'static reqwest::Client, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(Duration::from_secs(10))
                .build()
                .map_err(|e| e.to_string())
        })
        .as_ref()
        .map_err(Clone::clone)
}

fn normalized_origin(value: &str) -> Result<reqwest::Url, String> {
    let mut url = reqwest::Url::parse(value)
        .map_err(|_| "invalid configured media server origin".to_string())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("invalid configured media server origin".into());
    }
    url.set_query(None);
    url.set_fragment(None);
    url.set_path("");
    Ok(url)
}

fn same_origin(a: &reqwest::Url, b: &reqwest::Url) -> bool {
    a.scheme() == b.scheme()
        && a.host_str() == b.host_str()
        && a.port_or_known_default() == b.port_or_known_default()
}

#[tauri::command]
pub async fn media_server_request(
    args: MediaServerRequestArgs,
) -> Result<MediaServerResponse, String> {
    let origin = normalized_origin(&args.origin)?;
    let target =
        reqwest::Url::parse(&args.url).map_err(|_| "invalid media server URL".to_string())?;
    if !same_origin(&origin, &target)
        || !target.username().is_empty()
        || target.password().is_some()
    {
        return Err("media server request is outside the configured origin".into());
    }
    let method = reqwest::Method::from_bytes(args.method.as_deref().unwrap_or("GET").as_bytes())
        .map_err(|_| "invalid method".to_string())?;
    let mut request = client()?
        .request(method, target)
        .timeout(Duration::from_millis(
            args.timeout_ms.unwrap_or(30_000).min(120_000),
        ));
    for (name, value) in args.headers.unwrap_or_default() {
        let lower = name.to_ascii_lowercase();
        if matches!(lower.as_str(), "host" | "content-length" | "connection") {
            continue;
        }
        request = request.header(name, value);
    }
    if let Some(body) = args.body {
        request = request
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(body);
    }
    let response = request
        .send()
        .await
        .map_err(|e| format!("media server request failed: {e}"))?;
    if response.status().is_redirection() {
        return Err("media server redirects are not followed".into());
    }
    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|v| (k.to_string(), v.to_string())))
        .collect();
    let body = response
        .text()
        .await
        .map_err(|e| format!("media server response failed: {e}"))?;
    Ok(MediaServerResponse {
        status,
        headers,
        body,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn origin_comparison_includes_scheme_and_port() {
        let a = reqwest::Url::parse("http://server:8096/a").unwrap();
        assert!(same_origin(
            &a,
            &reqwest::Url::parse("http://server:8096/b").unwrap()
        ));
        assert!(!same_origin(
            &a,
            &reqwest::Url::parse("https://server:8096/b").unwrap()
        ));
        assert!(!same_origin(
            &a,
            &reqwest::Url::parse("http://server:8097/b").unwrap()
        ));
    }
}
