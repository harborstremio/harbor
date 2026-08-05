use std::collections::HashMap;
use std::future::Future;
use std::net::IpAddr;
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

fn host_is_blocked_literal(url: &reqwest::Url) -> bool {
    match url.host_str() {
        Some(h) => match h.trim_start_matches('[').trim_end_matches(']').parse::<IpAddr>() {
            Ok(ip) => is_blocked_ip(ip),
            Err(_) => false,
        },
        None => false,
    }
}

async fn validate_target(url: &reqwest::Url) -> Result<(), String> {
    let host = match url.host_str() {
        Some(h) => h.trim_start_matches('[').trim_end_matches(']').to_string(),
        None => return Ok(()),
    };
    if host_is_blocked_literal(url) {
        return Err(format!("blocked internal target: {}", host));
    }
    if host.parse::<IpAddr>().is_ok() {
        return Ok(());
    }
    let port = url.port_or_known_default().unwrap_or(80);
    let lookup = (host.clone(), port);
    let resolved = tokio::task::spawn_blocking(move || {
        use std::net::ToSocketAddrs;
        lookup.to_socket_addrs().map(|it| it.map(|a| a.ip()).collect::<Vec<_>>())
    })
    .await;
    if let Ok(Ok(ips)) = resolved {
        if ips.into_iter().any(is_blocked_ip) {
            return Err(format!("blocked internal target: {}", host));
        }
    }
    Ok(())
}

fn same_host(a: &reqwest::Url, b: &reqwest::Url) -> bool {
    a.host_str() == b.host_str() && a.port_or_known_default() == b.port_or_known_default()
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
    body: &mut Option<String>,
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
        StatusCode::MOVED_PERMANENTLY | StatusCode::FOUND => {
            if *method == Method::POST {
                *method = Method::GET;
                *body = None;
            }
        }
        _ => {}
    }
}

fn http_client() -> Result<&'static reqwest::Client, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .no_proxy()
                .redirect(reqwest::redirect::Policy::none())
                .timeout(Duration::from_secs(30))
                .connect_timeout(Duration::from_secs(10))
                .pool_idle_timeout(Duration::from_secs(30))
                .pool_max_idle_per_host(8)
                .build()
                .map_err(|e| format!("client: {e}"))
        })
        .as_ref()
        .map_err(|e| e.clone())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarborFetchArgs {
    pub url: String,
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    pub timeout_ms: Option<u64>,
    pub response_type: Option<String>,
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
    run_with_deadline(timeout, harbor_fetch_inner(app, args)).await
}

async fn harbor_fetch_inner(
    app: tauri::AppHandle,
    args: HarborFetchArgs,
) -> Result<HarborFetchResponse, String> {
    let _permit = acquire_fetch_permit().await?;

    let client = http_client()?;
    let timeout = Duration::from_millis(args.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));

    let method = args
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_uppercase();
    let mut current_method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|e| format!("method: {}", e))?;

    let mut current_url = reqwest::Url::parse(&args.url).map_err(|e| format!("url: {}", e))?;
    validate_target(&current_url).await?;

    let original_host = current_url.host_str().map(|s| s.to_string());
    let cf = current_url.host_str().and_then(crate::cf_solver::cf_cached);

    let mut headers: Vec<(String, String)> = Vec::new();
    let mut has_user_agent = false;
    let mut has_accept = false;
    let mut has_accept_language = false;
    if let Some(caller_headers) = args.headers {
        for (k, v) in caller_headers {
            let low = k.to_ascii_lowercase();
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

    let mut body: Option<String> = args.body;
    let mut redirect_count = 0usize;

    let res = loop {
        let mut req = client
            .request(current_method.clone(), current_url.clone())
            .timeout(timeout);
        for (k, v) in &headers {
            req = req.header(k.as_str(), v.as_str());
        }
        if let Some(b) = &body {
            req = req.body(b.clone());
        }

        let resp = req.send().await.map_err(|e| format!("send: {}", e))?;
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
        validate_target(&next_url).await?;
        if !same_host(&current_url, &next_url) {
            strip_headers(&mut headers, &["cookie", "referer", "origin"]);
        }
        let had_body = body.is_some();
        apply_redirect_method(&mut current_method, &mut body, status);
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
    let body = if args.response_type.as_deref() == Some("base64") {
        match res.bytes().await {
            Ok(bytes) => base64::engine::general_purpose::STANDARD.encode(&bytes),
            Err(_) => String::new(),
        }
    } else {
        res.text().await.unwrap_or_default()
    };

    if is_cloudflare_challenge(status, cf_mitigated.as_deref(), &body) {
        eprintln!("[cf] challenge detected ({}) for {}", status, args.url);
        if let Some(h) = original_host.as_deref() {
            crate::cf_solver::cf_invalidate(h);
        }
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

    Ok(HarborFetchResponse {
        status,
        ok,
        body,
        content_type,
        headers: response_headers,
    })
}

fn is_cloudflare_challenge(status: u16, cf_mitigated: Option<&str>, body: &str) -> bool {
    if cf_mitigated == Some("challenge") {
        return true;
    }
    if !matches!(status, 403 | 429 | 503) {
        return false;
    }
    body.contains("Just a moment")
        || body.contains("challenge-platform")
        || body.contains("__cf_chl")
        || body.contains("cf-please-wait")
        || body.contains("cf_chl_opt")
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
    validate_target(&url).await?;

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
        .timeout(Duration::from_millis(args.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS)))
        .multipart(form);
    let mut has_ua = false;
    if let Some(caller_headers) = args.headers {
        for (k, v) in caller_headers {
            if k.to_ascii_lowercase() == "user-agent" {
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
