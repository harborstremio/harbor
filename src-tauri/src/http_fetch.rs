use std::collections::HashMap;
use std::future::Future;
use std::sync::OnceLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::sync::{Semaphore, SemaphorePermit};

const BROWSER_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT_MS: u64 = 30_000;

/// Maximum concurrent HTTP fetch requests. This caps native work and DNS
/// lookups when the interface starts a burst of provider requests.
const MAX_CONCURRENT_FETCHES: usize = 10;

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

fn http_client() -> Result<&'static reqwest::Client, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .no_proxy()
            .hickory_dns(true)
            .timeout(Duration::from_secs(30))
            .pool_idle_timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(4)
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
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HarborFetchResponse {
    pub status: u16,
    pub ok: bool,
    pub body: String,
    pub content_type: Option<String>,
}

fn is_blocked_ssrf_url(url_str: &str) -> bool {
    let Ok(parsed) = url::Url::parse(url_str) else {
        return true;
    };
    let Some(host) = parsed.host_str() else {
        return true;
    };
    let host_lower = host.to_ascii_lowercase();
    if host_lower == "localhost"
        || host_lower == "127.0.0.1"
        || host_lower == "0.0.0.0"
        || host_lower == "::1"
        || host_lower == "[::1]"
        || host_lower.starts_with("169.254.")
        || host_lower.starts_with("192.168.")
        || host_lower.starts_with("10.")
    {
        return true;
    }
    if host_lower.starts_with("172.") {
        if let Some(second) = host_lower.split('.').nth(1) {
            if let Ok(num) = second.parse::<u8>() {
                if (16..=31).contains(&num) {
                    return true;
                }
            }
        }
    }
    false
}

#[tauri::command]
pub async fn harbor_fetch(args: HarborFetchArgs) -> Result<HarborFetchResponse, String> {
    if is_blocked_ssrf_url(&args.url) {
        return Err("fetch target blocked by SSRF protection".to_string());
    }
    let timeout = Duration::from_millis(args.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));
    run_with_deadline(timeout, harbor_fetch_inner(args)).await
}

async fn harbor_fetch_inner(args: HarborFetchArgs) -> Result<HarborFetchResponse, String> {
    let _permit = acquire_fetch_permit().await?;

    let client = http_client()?;

    let method = args
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_uppercase();
    let parsed_method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|e| format!("method: {}", e))?;

    let mut req = client.request(parsed_method, &args.url);

    let mut has_user_agent = false;
    if let Some(headers) = args.headers {
        for (k, v) in headers {
            if k.eq_ignore_ascii_case("user-agent") {
                has_user_agent = true;
            }
            req = req.header(k, v);
        }
    }
    if !has_user_agent {
        req = req.header("User-Agent", BROWSER_UA);
    }
    req = req.header("Accept", "application/json, text/plain, */*");
    req = req.header("Accept-Language", "en-US,en;q=0.9");

    if let Some(body) = args.body {
        req = req.body(body);
    }

    let res = req.send().await.map_err(|e| format!("send: {}", e))?;
    let status = res.status().as_u16();
    let ok = res.status().is_success();
    let content_type = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let body = res.text().await.unwrap_or_default();

    Ok(HarborFetchResponse {
        status,
        ok,
        body,
        content_type,
    })
}
