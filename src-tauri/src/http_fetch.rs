use std::collections::HashMap;
use std::future::Future;
use std::sync::Mutex;
use std::sync::OnceLock;
use std::time::Duration;

use futures_util::future::{AbortHandle, Abortable};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tokio::sync::{Semaphore, SemaphorePermit};

const BROWSER_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const MAX_RESPONSE_BYTES: usize = 16 * 1024 * 1024;

/// Maximum concurrent HTTP fetch requests. This caps native work and DNS
/// lookups when the interface starts a burst of provider requests.
const MAX_CONCURRENT_FETCHES: usize = 10;

fn fetch_semaphore() -> &'static Semaphore {
    static SEM: OnceLock<Semaphore> = OnceLock::new();
    SEM.get_or_init(|| Semaphore::new(MAX_CONCURRENT_FETCHES))
}

fn active_fetches() -> &'static Mutex<HashMap<String, Option<AbortHandle>>> {
    static ACTIVE: OnceLock<Mutex<HashMap<String, Option<AbortHandle>>>> = OnceLock::new();
    ACTIVE.get_or_init(|| Mutex::new(HashMap::new()))
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
    CLIENT
        .get_or_init(|| {
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
    pub request_id: Option<String>,
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

#[tauri::command]
pub async fn harbor_fetch(args: HarborFetchArgs) -> Result<HarborFetchResponse, String> {
    let timeout = Duration::from_millis(args.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));
    let Some(request_id) = args.request_id.clone() else {
        return run_with_deadline(timeout, harbor_fetch_inner(args)).await;
    };
    let (abort_handle, abort_registration) = AbortHandle::new_pair();
    {
        let mut active = active_fetches()
            .lock()
            .map_err(|e| format!("fetch lock: {e}"))?;
        if matches!(active.remove(&request_id), Some(None)) {
            return Err("aborted".to_string());
        }
        active.insert(request_id.clone(), Some(abort_handle));
    }
    let result = run_with_deadline(timeout, async {
        Abortable::new(harbor_fetch_inner(args), abort_registration)
            .await
            .map_err(|_| "aborted".to_string())?
    })
    .await;
    if let Ok(mut active) = active_fetches().lock() {
        active.remove(&request_id);
    }
    result
}

#[tauri::command]
pub fn harbor_fetch_cancel(request_id: String) -> Result<(), String> {
    let mut active = active_fetches()
        .lock()
        .map_err(|e| format!("fetch lock: {e}"))?;
    match active.remove(&request_id) {
        Some(Some(handle)) => handle.abort(),
        Some(None) => {}
        None => {
            active.insert(request_id.clone(), None);
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(5)).await;
                if let Ok(mut active) = active_fetches().lock() {
                    if matches!(active.get(&request_id), Some(None)) {
                        active.remove(&request_id);
                    }
                }
            });
        }
    }
    Ok(())
}

fn append_response_chunk(body: &mut Vec<u8>, chunk: &[u8], limit: usize) -> Result<(), String> {
    if body.len().saturating_add(chunk.len()) > limit {
        return Err(format!("response body exceeds {limit} bytes"));
    }
    body.extend_from_slice(chunk);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_body_that_exceeds_limit() {
        let mut body = Vec::new();
        append_response_chunk(&mut body, &[0; 5], 4).expect_err("oversized body must fail");
        assert!(body.is_empty());
    }
}

async fn harbor_fetch_inner(args: HarborFetchArgs) -> Result<HarborFetchResponse, String> {
    let _permit = acquire_fetch_permit().await?;

    let client = http_client()?;

    let method = args.method.as_deref().unwrap_or("GET").to_uppercase();
    let parsed_method =
        reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| format!("method: {}", e))?;

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
    if res
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
    {
        return Err(format!("response body exceeds {MAX_RESPONSE_BYTES} bytes"));
    }
    let mut bytes = Vec::new();
    let mut stream = res.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("body: {error}"))?;
        append_response_chunk(&mut bytes, &chunk, MAX_RESPONSE_BYTES)?;
    }
    let body = String::from_utf8_lossy(&bytes).into_owned();

    Ok(HarborFetchResponse {
        status,
        ok,
        body,
        content_type,
    })
}
