use std::collections::HashMap;
use std::future::Future;
use std::net::{IpAddr, SocketAddr};
use std::sync::OnceLock;
use std::time::Duration;

use base64::Engine;
use serde::{Deserialize, Serialize};
use tokio::sync::{Semaphore, SemaphorePermit};

const BROWSER_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const MAX_CONCURRENT_FETCHES: usize = 48;
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MAX_REDIRECTS: usize = 10;

fn fetch_semaphore() -> &'static Semaphore {
    static SEM: OnceLock<Semaphore> = OnceLock::new();
    SEM.get_or_init(|| Semaphore::new(MAX_CONCURRENT_FETCHES))
}

async fn acquire_fetch_permit() -> Result<SemaphorePermit<'static>, String> {
    fetch_semaphore()
        .acquire()
        .await
        .map_err(|error| format!("semaphore: {error}"))
}

async fn run_with_deadline<T>(
    duration: Duration,
    work: impl Future<Output = Result<T, String>>,
) -> Result<T, String> {
    tokio::time::timeout(duration, work)
        .await
        .unwrap_or_else(|_| Err(format!("timeout after {} ms", duration.as_millis())))
}

fn is_blocked_ip(ip: IpAddr) -> bool {
    let ip = match ip {
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => IpAddr::V4(v4),
            None => IpAddr::V6(v6),
        },
        other => other,
    };
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback() || v4.is_link_local() || v4.is_unspecified() || v4.is_broadcast()
        }
        IpAddr::V6(v6) => {
            v6.is_loopback() || v6.is_unspecified() || (v6.segments()[0] & 0xffc0) == 0xfe80
        }
    }
}

fn is_public_network_ip(ip: IpAddr) -> bool {
    let ip = match ip {
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => IpAddr::V4(v4),
            None => IpAddr::V6(v6),
        },
        other => other,
    };
    match ip {
        IpAddr::V4(v4) => {
            let [a, b, c, _] = v4.octets();
            !(a == 0
                || a == 10
                || a == 127
                || a >= 224
                || (a == 100 && (64..=127).contains(&b))
                || (a == 169 && b == 254)
                || (a == 172 && (16..=31).contains(&b))
                || (a == 192 && b == 168)
                || (a == 192 && b == 0)
                || (a == 192 && b == 88 && c == 99)
                || (a == 198 && (b == 18 || b == 19))
                || (a == 198 && b == 51 && c == 100)
                || (a == 203 && b == 0 && c == 113))
        }
        IpAddr::V6(v6) => {
            let segments = v6.segments();
            (segments[0] & 0xe000) == 0x2000
                && segments[0] != 0x2002
                && !(segments[0] == 0x2001 && segments[1] == 0x0db8)
                && !(segments[0] == 0x2001 && segments[1] < 0x0200)
        }
    }
}

async fn resolve_public_target(url: &reqwest::Url) -> Result<Vec<SocketAddr>, String> {
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(format!("public target bad scheme: {}", url.scheme()));
    }
    let host = url
        .host_str()
        .map(|value| {
            value
                .trim_start_matches('[')
                .trim_end_matches(']')
                .to_string()
        })
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "public target has no host".to_string())?;
    let port = url
        .port_or_known_default()
        .ok_or_else(|| "public target has no port".to_string())?;
    if let Ok(ip) = host.parse::<IpAddr>() {
        if !is_public_network_ip(ip) {
            return Err(format!("blocked non-public target: {host}"));
        }
        return Ok(vec![SocketAddr::new(ip, port)]);
    }

    let lookup = (host.clone(), port);
    let mut addresses = tokio::task::spawn_blocking(move || {
        use std::net::ToSocketAddrs;
        lookup
            .to_socket_addrs()
            .map(|items| items.collect::<Vec<_>>())
    })
    .await
    .map_err(|_| format!("public target DNS failed: {host}"))?
    .map_err(|_| format!("public target DNS failed: {host}"))?;
    if addresses.is_empty()
        || addresses
            .iter()
            .any(|address| !is_public_network_ip(address.ip()))
    {
        return Err(format!("blocked non-public target: {host}"));
    }
    addresses.sort_unstable();
    addresses.dedup();
    Ok(addresses)
}

fn host_is_blocked_literal(url: &reqwest::Url) -> bool {
    match url.host_str() {
        Some(h) => match h
            .trim_start_matches('[')
            .trim_end_matches(']')
            .parse::<IpAddr>()
        {
            Ok(ip) => is_blocked_ip(ip),
            Err(_) => false,
        },
        None => false,
    }
}

// `allow_local` opts the target out of the SSRF guard for loopback, link-local,
// and private network addresses. It is only set by callers that have explicitly
// received a URL from the user (e.g. wiring up their own self-hosted Suwayomi
// server), never for implicitly-discovered URLs.
async fn validate_target(url: &reqwest::Url, allow_local: bool) -> Result<(), String> {
    let host = match url.host_str() {
        Some(h) => h.trim_start_matches('[').trim_end_matches(']').to_string(),
        None => return Ok(()),
    };
    if host_is_blocked_literal(url) && !allow_local {
        return Err(format!("blocked internal target: {}", host));
    }
    if host.parse::<IpAddr>().is_ok() {
        return Ok(());
    }
    if allow_local {
        return Ok(());
    }
    let port = url.port_or_known_default().unwrap_or(80);
    let lookup = (host.clone(), port);
    let resolved = tokio::task::spawn_blocking(move || {
        use std::net::ToSocketAddrs;
        lookup
            .to_socket_addrs()
            .map(|it| it.map(|a| a.ip()).collect::<Vec<_>>())
    })
    .await;
    if let Ok(Ok(ips)) = resolved {
        if ips.into_iter().any(is_blocked_ip) {
            return Err(format!("blocked internal target: {}", host));
        }
    }
    Ok(())
}

fn same_origin(a: &reqwest::Url, b: &reqwest::Url) -> bool {
    a.scheme() == b.scheme()
        && a.host_str() == b.host_str()
        && a.port_or_known_default() == b.port_or_known_default()
}

fn is_https_downgrade(a: &reqwest::Url, b: &reqwest::Url) -> bool {
    a.scheme() == "https" && b.scheme() == "http"
}

fn strip_headers(headers: &mut Vec<(String, String)>, drop: &[&str]) {
    headers.retain(|(k, _)| {
        let low = k.to_ascii_lowercase();
        !drop.contains(&low.as_str())
    });
}

fn collect_headers(headers: &reqwest::header::HeaderMap) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for (name, value) in headers.iter() {
        if let Ok(v) = value.to_str() {
            out.insert(name.as_str().to_ascii_lowercase(), v.to_string());
        }
    }
    out
}

fn is_followable_redirect(status: reqwest::StatusCode) -> bool {
    use reqwest::StatusCode;
    matches!(
        status,
        StatusCode::MOVED_PERMANENTLY
            | StatusCode::FOUND
            | StatusCode::SEE_OTHER
            | StatusCode::TEMPORARY_REDIRECT
            | StatusCode::PERMANENT_REDIRECT
    )
}

fn apply_redirect_method(
    method: &mut reqwest::Method,
    body: &mut Option<Vec<u8>>,
    status: reqwest::StatusCode,
) {
    use reqwest::{Method, StatusCode};
    match status {
        StatusCode::SEE_OTHER => {
            if *method != Method::HEAD {
                *method = Method::GET;
            }
            *body = None;
        }
        StatusCode::MOVED_PERMANENTLY | StatusCode::FOUND if *method == Method::POST => {
            *method = Method::GET;
            *body = None;
        }
        _ => {}
    }
}

fn http_client_builder() -> reqwest::ClientBuilder {
    reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(10))
        .pool_idle_timeout(Duration::from_secs(30))
        .pool_max_idle_per_host(8)
}

fn http_client() -> Result<&'static reqwest::Client, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            http_client_builder()
                .build()
                .map_err(|e| format!("client: {e}"))
        })
        .as_ref()
        .map_err(|e| e.clone())
}

async fn public_http_client(url: &reqwest::Url) -> Result<reqwest::Client, String> {
    let host = url
        .host_str()
        .ok_or_else(|| "public target has no host".to_string())?;
    let addresses = resolve_public_target(url).await?;
    http_client_builder()
        .resolve_to_addrs(host, &addresses)
        .build()
        .map_err(|error| format!("public client: {error}"))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarborFetchArgs {
    pub url: String,
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub body_base64: Option<String>,
    pub timeout_ms: Option<u64>,
    pub response_type: Option<String>,
    pub max_response_bytes: Option<u64>,
    pub credential_handle: Option<String>,
    pub public_network_only: Option<bool>,
    pub allow_local_network: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HarborFetchResponse {
    pub status: u16,
    pub ok: bool,
    pub body: String,
    pub content_type: Option<String>,
    pub headers: HashMap<String, String>,
}

#[tauri::command]
pub async fn harbor_fetch(
    app: tauri::AppHandle,
    args: HarborFetchArgs,
) -> Result<HarborFetchResponse, String> {
    let timeout = Duration::from_millis(args.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));
    let _permit = acquire_fetch_permit().await?;
    run_with_deadline(timeout, harbor_fetch_inner(app, args)).await
}

async fn harbor_fetch_inner(
    app: tauri::AppHandle,
    args: HarborFetchArgs,
) -> Result<HarborFetchResponse, String> {
    let timeout = Duration::from_millis(args.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));
    let public_network_only = args.public_network_only.unwrap_or(false);
    let allow_local_network = args.allow_local_network.unwrap_or(false);

    let method = args.method.as_deref().unwrap_or("GET").to_uppercase();
    let mut current_method =
        reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| format!("method: {}", e))?;

    let mut current_url = reqwest::Url::parse(&args.url).map_err(|e| format!("url: {}", e))?;
    validate_target(&current_url, allow_local_network).await?;

    let mut subtitle_credential = args
        .credential_handle
        .as_deref()
        .map(crate::subtitle_credentials::resolve)
        .transpose()?;

    let original_host = current_url.host_str().map(|s| s.to_string());
    let cf = current_url.host_str().and_then(crate::cf_solver::cf_cached);

    let mut headers: Vec<(String, String)> = Vec::new();
    let mut has_user_agent = false;
    let mut has_accept = false;
    let mut has_accept_language = false;
    if let Some(caller_headers) = args.headers {
        for (k, v) in caller_headers {
            let low = k.to_ascii_lowercase();
            if low == "x-harbor-subtitle-credential" {
                continue;
            }
            if subtitle_credential.is_some() && low == "x-api-key" {
                continue;
            }
            if low == "user-agent" {
                if cf.is_some() {
                    continue;
                }
                has_user_agent = true;
            }
            if low == "cookie" && cf.is_some() {
                continue;
            }
            if low == "accept" {
                has_accept = true;
            }
            if low == "accept-language" {
                has_accept_language = true;
            }
            headers.push((k, v));
        }
    }
    if let Some((cookie, ua)) = cf {
        headers.push(("Cookie".to_string(), cookie));
        headers.push(("User-Agent".to_string(), ua));
        has_user_agent = true;
    }
    if !has_user_agent {
        headers.push(("User-Agent".to_string(), BROWSER_UA.to_string()));
    }
    if !has_accept {
        headers.push((
            "Accept".to_string(),
            "application/json, text/plain, */*".to_string(),
        ));
    }
    if !has_accept_language {
        headers.push(("Accept-Language".to_string(), "en-US,en;q=0.9".to_string()));
    }

    let mut body = match args.body_base64 {
        Some(value) => Some(
            base64::engine::general_purpose::STANDARD
                .decode(value)
                .map_err(|error| format!("request base64: {error}"))?,
        ),
        None => args.body.map(String::into_bytes),
    };
    let mut redirect_count = 0usize;

    let mut res = loop {
        let pinned_client = if public_network_only {
            Some(public_http_client(&current_url).await?)
        } else {
            None
        };
        let client = if let Some(client) = pinned_client.as_ref() {
            client
        } else {
            http_client()?
        };
        let (request_url, credential_header) = match subtitle_credential.as_ref() {
            Some(credential) => {
                crate::subtitle_credentials::apply_to_request(&current_url, credential)?
            }
            None => (current_url.clone(), None),
        };
        let mut req = client
            .request(current_method.clone(), request_url)
            .timeout(timeout);
        for (k, v) in &headers {
            req = req.header(k.as_str(), v.as_str());
        }
        if let Some((name, value)) = credential_header {
            req = req.header(name.as_str(), value.as_str());
        }
        if let Some(b) = &body {
            req = req.body(b.clone());
        }

        let resp = req.send().await.map_err(|error| {
            if subtitle_credential.is_some() {
                "send: subtitle provider request failed".to_string()
            } else {
                format!("send: {error}")
            }
        })?;
        let status = resp.status();
        if !is_followable_redirect(status) {
            break resp;
        }
        let location = resp
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());
        let Some(location) = location else {
            break resp;
        };

        redirect_count += 1;
        if redirect_count > MAX_REDIRECTS {
            return Err("too many redirects".to_string());
        }
        let next_url = current_url
            .join(&location)
            .map_err(|e| format!("redirect url: {}", e))?;
        if next_url.scheme() != "http" && next_url.scheme() != "https" {
            return Err(format!("redirect bad scheme: {}", next_url.scheme()));
        }
        if is_https_downgrade(&current_url, &next_url) {
            return Err("redirect from HTTPS to HTTP is not allowed".to_string());
        }
        if !public_network_only {
            validate_target(&next_url, allow_local_network).await?;
        }
        let cross_origin = !same_origin(&current_url, &next_url);
        let had_body = body.is_some();
        apply_redirect_method(&mut current_method, &mut body, status);
        if cross_origin_redirect_forwards_body(cross_origin, &body) {
            return Err("cross-origin redirect cannot forward request body".to_string());
        }
        if cross_origin {
            subtitle_credential = None;
            strip_headers(
                &mut headers,
                &[
                    "authorization",
                    "proxy-authorization",
                    "x-api-key",
                    "api-key",
                    "x-auth-token",
                    "x-harbor-auth",
                    "cookie",
                    "referer",
                    "origin",
                ],
            );
        }
        if had_body && body.is_none() {
            strip_headers(
                &mut headers,
                &[
                    "content-type",
                    "content-length",
                    "content-encoding",
                    "transfer-encoding",
                ],
            );
        }
        current_url = next_url;
    };

    let status = res.status().as_u16();
    let ok = res.status().is_success();
    let cf_mitigated = res
        .headers()
        .get("cf-mitigated")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_lowercase());
    let content_type = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let response_headers = collect_headers(res.headers());
    let body = if let Some(max_bytes) = args.max_response_bytes {
        if res.content_length().is_some_and(|size| size > max_bytes) {
            return Err("response size limit exceeded".to_string());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = res
            .chunk()
            .await
            .map_err(|error| format!("read: {error}"))?
        {
            if (bytes.len() as u64).saturating_add(chunk.len() as u64) > max_bytes {
                return Err("response size limit exceeded".to_string());
            }
            bytes.extend_from_slice(&chunk);
        }
        if args.response_type.as_deref() == Some("base64") {
            base64::engine::general_purpose::STANDARD.encode(&bytes)
        } else {
            String::from_utf8_lossy(&bytes).into_owned()
        }
    } else if args.response_type.as_deref() == Some("base64") {
        match res.bytes().await {
            Ok(bytes) => base64::engine::general_purpose::STANDARD.encode(&bytes),
            Err(_) => String::new(),
        }
    } else {
        res.text().await.unwrap_or_default()
    };

    if is_cloudflare_challenge(status, cf_mitigated.as_deref(), &body) {
        if let Some(h) = original_host.as_deref() {
            crate::cf_solver::cf_invalidate(h);
        }
        let solver_ok = original_host
            .as_deref()
            .map(solver_host_allowed)
            .unwrap_or(false);
        // The solver returns text, not a byte-preserving/base64 response, and does not
        // participate in the caller's response-size contract. Binary/capped callers
        // must receive the original bounded response instead of bypassing those rules.
        if solver_ok
            && args.response_type.as_deref() != Some("base64")
            && args.max_response_bytes.is_none()
        {
            eprintln!("[cf] challenge detected ({}) for {}", status, args.url);
            if let Ok(solved) = crate::cf_solver::cf_fetch(app, args.url.clone()).await {
                return Ok(HarborFetchResponse {
                    status: 200,
                    ok: true,
                    body: solved,
                    content_type: None,
                    headers: HashMap::new(),
                });
            }
        }
    }

    Ok(HarborFetchResponse {
        status,
        ok,
        body,
        content_type,
        headers: response_headers,
    })
}

const BACKGROUND_PROVIDER_HOSTS: &[&str] =
    &["api.theintrodb.org", "api.introdb.app", "api.skipdb.tv"];

fn solver_host_allowed(host: &str) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    !BACKGROUND_PROVIDER_HOSTS.contains(&host.as_str())
}

fn is_cloudflare_hard_block(body: &str) -> bool {
    body.contains("Sorry, you have been blocked")
        || body.contains("error code: 1020")
        || body.contains("Error 1015")
        || body.contains("You are being rate limited")
}

fn is_cloudflare_challenge(status: u16, cf_mitigated: Option<&str>, body: &str) -> bool {
    if is_cloudflare_hard_block(body) {
        return false;
    }
    if cf_mitigated == Some("challenge") {
        return true;
    }
    if !matches!(status, 403 | 503) {
        return false;
    }
    body.contains("Just a moment")
        || body.contains("cf_chl_opt")
        || body.contains("challenge-form")
        || body.contains("cf-please-wait")
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarborUploadArgs {
    pub url: String,
    pub field: String,
    pub filename: String,
    pub content_type: Option<String>,
    pub data_base64: String,
    pub headers: Option<HashMap<String, String>>,
    pub timeout_ms: Option<u64>,
}

#[tauri::command]
pub async fn harbor_upload(args: HarborUploadArgs) -> Result<HarborFetchResponse, String> {
    let timeout = Duration::from_millis(args.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));
    run_with_deadline(timeout, harbor_upload_inner(args)).await
}

async fn harbor_upload_inner(args: HarborUploadArgs) -> Result<HarborFetchResponse, String> {
    let _permit = acquire_fetch_permit().await?;
    let client = http_client()?;
    let url = reqwest::Url::parse(&args.url).map_err(|e| format!("url: {}", e))?;
    validate_target(&url, false).await?;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(args.data_base64.as_bytes())
        .map_err(|e| format!("base64: {}", e))?;

    let mut part = reqwest::multipart::Part::bytes(bytes).file_name(args.filename);
    if let Some(ct) = args.content_type.as_deref() {
        part = part.mime_str(ct).map_err(|e| format!("mime: {}", e))?;
    }
    let form = reqwest::multipart::Form::new().part(args.field, part);

    let mut req = client
        .post(url)
        .timeout(Duration::from_millis(
            args.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS),
        ))
        .multipart(form);
    let mut has_ua = false;
    if let Some(caller_headers) = args.headers {
        for (k, v) in caller_headers {
            if k.eq_ignore_ascii_case("user-agent") {
                has_ua = true;
            }
            req = req.header(k.as_str(), v.as_str());
        }
    }
    if !has_ua {
        req = req.header("User-Agent", BROWSER_UA);
    }

    let resp = req.send().await.map_err(|e| format!("send: {}", e))?;
    let status = resp.status().as_u16();
    let ok = resp.status().is_success();
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let headers = collect_headers(resp.headers());
    let body = resp.text().await.unwrap_or_default();
    Ok(HarborFetchResponse {
        status,
        ok,
        body,
        content_type,
        headers,
    })
}

fn cross_origin_redirect_forwards_body(cross_origin: bool, body: &Option<Vec<u8>>) -> bool {
    cross_origin && body.is_some()
}

#[cfg(test)]
mod tests {
    use super::{
        apply_redirect_method, cross_origin_redirect_forwards_body, host_is_blocked_literal,
        is_https_downgrade, is_public_network_ip, same_origin, strip_headers, validate_target,
    };

    #[test]
    fn cross_host_redirects_strip_credentials() {
        let mut headers = vec![
            ("X-API-Key".to_string(), "secret".to_string()),
            ("Authorization".to_string(), "Bearer secret".to_string()),
            ("Cookie".to_string(), "session=secret".to_string()),
            ("Accept".to_string(), "application/zip".to_string()),
        ];
        strip_headers(&mut headers, &["x-api-key", "authorization", "cookie"]);
        assert_eq!(
            headers,
            vec![("Accept".to_string(), "application/zip".to_string())]
        );
    }

    #[test]
    fn redirect_origin_includes_scheme_and_effective_port() {
        let https = reqwest::Url::parse("https://example.test/path").unwrap();
        let same = reqwest::Url::parse("https://example.test/next").unwrap();
        let downgrade = reqwest::Url::parse("http://example.test:443/next").unwrap();

        assert!(same_origin(&https, &same));
        assert!(!same_origin(&https, &downgrade));
        assert!(is_https_downgrade(&https, &downgrade));
    }

    #[test]
    fn cross_origin_redirects_never_forward_request_bodies() {
        use reqwest::{Method, StatusCode};

        for (status, method) in [
            (StatusCode::TEMPORARY_REDIRECT, Method::POST),
            (StatusCode::PERMANENT_REDIRECT, Method::POST),
            (StatusCode::MOVED_PERMANENTLY, Method::PUT),
            (StatusCode::FOUND, Method::PATCH),
        ] {
            let mut redirected_method = method;
            let mut body = Some(b"secret".to_vec());
            apply_redirect_method(&mut redirected_method, &mut body, status);
            assert!(cross_origin_redirect_forwards_body(true, &body));
            assert!(!cross_origin_redirect_forwards_body(false, &body));
        }

        let mut method = Method::POST;
        let mut body = Some(b"safe-to-drop".to_vec());
        apply_redirect_method(&mut method, &mut body, StatusCode::SEE_OTHER);
        assert!(!cross_origin_redirect_forwards_body(true, &body));
    }

    #[test]
    fn provider_public_network_policy_rejects_local_and_reserved_ranges() {
        for value in [
            "127.0.0.1",
            "10.0.0.1",
            "172.16.0.1",
            "192.168.1.1",
            "100.64.0.1",
            "169.254.1.1",
            "198.18.0.1",
            "203.0.113.1",
            "::1",
            "fe80::1",
            "fc00::1",
            "fec0::1",
            "2001:db8::1",
            "2002:0a00:0001::1",
            "::ffff:127.0.0.1",
        ] {
            let ip: std::net::IpAddr = value.parse().unwrap();
            assert!(!is_public_network_ip(ip), "{value}");
        }
        for value in ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"] {
            let ip: std::net::IpAddr = value.parse().unwrap();
            assert!(is_public_network_ip(ip), "{value}");
        }
    }

    #[test]
    fn guarded_fetch_blocks_loopback_literals() {
        for value in [
            "http://127.0.0.1:4567/api",
            "http://[::1]:4567/api",
            "http://[::ffff:127.0.0.1]:4567/api",
            "http://0.0.0.0:4567/api",
            "http://169.254.169.254/latest/meta-data/",
        ] {
            let url: reqwest::Url = value.parse().unwrap();
            assert!(host_is_blocked_literal(&url), "{value}");
        }
        for value in [
            "http://sonicbit.example.com:4567/api",
            "http://192.168.1.10:4567/api",
            "http://8.8.8.8:4567/api",
        ] {
            let url: reqwest::Url = value.parse().unwrap();
            assert!(!host_is_blocked_literal(&url), "{value}");
        }
    }

    #[tokio::test]
    async fn validate_target_respects_allow_local() {
        for value in [
            "http://127.0.0.1:4567/api",
            "http://[::1]:4567/api",
            "http://[::ffff:127.0.0.1]:4567/api",
            "http://0.0.0.0:4567/api",
            "http://169.254.169.254/latest/meta-data/",
        ] {
            let url: reqwest::Url = value.parse().unwrap();
            assert!(validate_target(&url, false).await.is_err(), "{value} blocked");
            assert!(validate_target(&url, true).await.is_ok(), "{value} allowed with allow_local");
        }
        for value in ["http://192.168.1.10:4567/api", "http://8.8.8.8:4567/api"] {
            let url: reqwest::Url = value.parse().unwrap();
            assert!(validate_target(&url, false).await.is_ok(), "{value} public ok");
        }
    }
}
