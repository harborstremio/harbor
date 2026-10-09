//! User-driven verification in an isolated browser, which also reads the catalog.
//! A managed Cloudflare challenge pins its clearance to the browser that solved it:
//! the server demands Sec-CH-UA client hints (Critical-CH) that a native request does
//! not send, so a reqwest retry carrying the cookie is challenged again and returns
//! 403. The body is therefore read in the window that cleared the challenge. That page
//! is read by native evaluation; remote pages do not need access to Harbor commands.
use super::source_verification_policy as policy;
use crate::http_fetch::{public_http_client, HarborFetchResponse};
use base64::Engine;
use sha2::{Digest, Sha256};
use std::{collections::HashMap, sync::{Arc, Mutex, OnceLock, atomic::{AtomicBool, Ordering}}, time::{Duration, Instant}};
use tauri::{Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tokio_util::sync::CancellationToken;

type Result<T> = std::result::Result<T, &'static str>;
const WAIT: Duration = Duration::from_secs(180);
fn browser_failure(stage: &str, error: impl std::fmt::Display) -> &'static str {
    // Native window errors contain the platform failure code; never log page bodies,
    // request URLs, clearance cookies or the user's browser agent here.
    eprintln!("[source-verification] {stage}: {error}");
    "source_verify_failed"
}
struct Active { profile: String, id: String, canceled: CancellationToken }
#[derive(Default)]
struct State {
    active: Option<Active>,
    grants: policy::Grants,
    // Catalog bodies read by the verification window, keyed by profile and address.
    bodies: HashMap<(String, String), (String, Instant)>,
    // A cancel can arrive before the asynchronous start command is dispatched.
    canceled: Vec<(String, String, Instant)>,
}
fn state() -> &'static Mutex<State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE.get_or_init(Mutex::default)
}
fn matches(active: &Option<Active>, profile: &str, id: &str) -> bool {
    active.as_ref().is_some_and(|active| active.profile == profile && active.id == id && !active.canceled.is_cancelled())
}
const BODY_TTL: Duration = Duration::from_secs(300);

/// Reads the catalog from inside the window that cleared the challenge, so the request
/// carries the same client hints, cookie jar and TLS identity the challenge was issued to.
const READ_SCRIPT: &str = include_str!("source_verification_read.js");

#[derive(serde::Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
enum BrowserRead { Ready { body: String }, Error { error: String } }

fn label(profile: &str, id: &str) -> String { format!("source-verification-{:x}-{id}", Sha256::digest(profile.as_bytes())) }

fn reserve(profile: &str, id: &str, now: Instant) -> Result<CancellationToken> {
    state().lock().map_err(|_| "source_verify_failed")?.reserve(profile, id, now)
}

impl State {
    fn complete(&mut self, profile: &str, id: &str, url: &reqwest::Url, agent: &str,
        clearance: Option<String>, read: Option<BrowserRead>, now: Instant) -> Result<bool> {
        if !matches(&self.active, profile, id) { return Err("source_verify_canceled"); }
        let body = match read {
            None => return Ok(false),
            Some(BrowserRead::Error { error }) => return Err(if error == "source_limit" { "source_limit" } else { "source_verify_failed" }),
            Some(BrowserRead::Ready { body }) => body,
        };
        if body.len() > policy::MAX_BYTES { return Err("source_limit"); }
        self.bodies.retain(|_, (_, stored)| now.duration_since(*stored) < BODY_TTL);
        self.bodies.insert((profile.into(), url.to_string()), (body, now));
        if let Some(clearance) = clearance {
            self.grants.insert(profile, url, clearance, agent.into(), id.into(), now);
        }
        Ok(true)
    }
    fn reserve(&mut self, profile: &str, id: &str, now: Instant) -> Result<CancellationToken> {
        self.canceled.retain(|(_, _, until)| *until > now);
        if self.canceled.iter().any(|(p, i, _)| p == profile && i == id) { return Err("source_verify_canceled"); }
        if self.active.is_some() { return Err("source_verify_busy"); }
        let canceled = CancellationToken::new();
        self.active = Some(Active { profile: profile.into(), id: id.into(), canceled: canceled.clone() });
        Ok(canceled)
    }
    fn cancel(&mut self, profile: &str, id: &str, now: Instant) {
        self.canceled.retain(|(_, _, until)| *until > now);
        if self.canceled.len() >= 32 { self.canceled.remove(0); }
        self.canceled.push((profile.into(), id.into(), now + WAIT));
        if matches(&self.active, profile, id) {
            if let Some(active) = self.active.take() { active.canceled.cancel(); }
        }
    }
}

pub fn cancel(app: &tauri::AppHandle, profile: &str, id: &str) {
    if !policy::profile(profile) || uuid::Uuid::parse_str(id).is_err() { return; }
    if let Ok(mut state) = state().lock() {
        state.cancel(profile, id, Instant::now());
    }
    // This label contains the request UUID, so a late cancel cannot close a newer window.
    if let Some(window) = app.get_webview_window(&label(profile, id)) { let _ = window.close(); }
}

fn finish(app: &tauri::AppHandle, profile: &str, id: &str) {
    if let Ok(mut state) = state().lock() {
        if matches(&state.active, profile, id) { state.active.take(); }
    }
    if let Some(window) = app.get_webview_window(&label(profile, id)) { let _ = window.close(); }
}

fn create_window(app: &tauri::AppHandle, profile: &str, id: &str, url: &reqwest::Url, agent: &str, downloaded: Arc<AtomicBool>) -> Result<WebviewWindow> {
    if !matches(&state().lock().map_err(|_| "source_verify_failed")?.active, profile, id) { return Err("source_verify_canceled"); }
    let origin = url.clone(); let expected = url.clone(); let close_profile = profile.to_owned(); let close_id = id.to_owned();
    let builder = WebviewWindowBuilder::new(app, label(profile, id), WebviewUrl::External("about:blank".parse().unwrap()))
        .title(format!("{} · Harbor", url.host_str().unwrap_or("Harbor")))
        .inner_size(900.0, 680.0).min_inner_size(460.0, 400.0)
        .visible(false).focused(false).incognito(true).user_agent(agent)
        .initialization_script(READ_SCRIPT
            .replace("__HARBOR_SOURCE_MAX_BYTES__", &policy::MAX_BYTES.to_string())
            .replace("__HARBOR_SOURCE_URL__", &serde_json::to_string(url.as_str()).unwrap()))
        .on_navigation(move |next| next.as_str() == "about:blank" || policy::same_origin(&origin, next))
        .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
        .on_download(move |_, event| {
            if let tauri::webview::DownloadEvent::Requested { url, .. } = event {
                if url == expected { downloaded.store(true, Ordering::Release); }
            }
            // The catalog always passes through Harbor's size/deadline checks.
            false
        });
    // InPrivate is a controller setting. WebView2 still shares the environment
    // with the main window, whose browser options must match when it is reused.
    let window = crate::browser_args::match_main(app, builder)
        .build().map_err(|error| browser_failure("create window", error))?;
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            if let Ok(mut state) = state().lock() {
                if matches(&state.active, &close_profile, &close_id) {
                    if let Some(active) = state.active.take() { active.canceled.cancel(); }
                }
            }
        }
    });
    if !matches(&state().lock().map_err(|_| "source_verify_failed")?.active, profile, id) {
        let _ = window.close(); return Err("source_verify_canceled");
    }
    let shown = window.navigate(url.clone()).map_err(|error| browser_failure("navigate window", error))
        .and_then(|_| window.show().map_err(|error| browser_failure("show window", error)))
        .and_then(|_| window.set_focus().map_err(|error| browser_failure("focus window", error)));
    if let Err(error) = shown { let _ = window.close(); return Err(error); }
    Ok(window)
}

pub async fn verify(app: tauri::AppHandle, profile: String, id: String, url: String, user_agent: String) -> Result<()> {
    if !policy::profile(&profile) || uuid::Uuid::parse_str(&id).is_err() || !policy::user_agent(&user_agent) { return Err("source_url"); }
    let url = policy::source(&url)?;
    let canceled = reserve(&profile, &id, Instant::now())?;
    let result = tokio::select! {
        _ = canceled.cancelled() => Err("source_verify_canceled"),
        result = tokio::time::timeout(WAIT, verify_inner(app.clone(), profile.clone(), id.clone(), url, user_agent)) => result.unwrap_or(Err("source_verify_timeout")),
    };
    finish(&app, &profile, &id);
    result
}

async fn verify_inner(app: tauri::AppHandle, profile: String, id: String, url: reqwest::Url, agent: String) -> Result<()> {
    // Validate all resolved addresses before opening the browser. The subsequent HTTP
    // fetch resolves again and pins its own public addresses, with redirects disabled.
    public_http_client(&url).await.map_err(|_| "source_network")?;
    let downloaded = Arc::new(AtomicBool::new(false));
    let (browser_app, browser_profile, browser_id, browser_url, browser_agent, browser_downloaded) =
        (app, profile.clone(), id.clone(), url.clone(), agent.clone(), downloaded.clone());
    let window = tauri::async_runtime::spawn_blocking(move || create_window(&browser_app, &browser_profile, &browser_id, &browser_url, &browser_agent, browser_downloaded))
        .await.map_err(|error| browser_failure("window creation task", error))??;
    loop {
        tokio::time::sleep(Duration::from_millis(1000)).await;
        let (read_window, read_url, seen_download) = (window.clone(), url.clone(), downloaded.load(Ordering::Acquire));
        let clearance = tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>> {
            let current = read_window.url().map_err(|error| browser_failure("read window address", error))?;
            if !policy::same_origin(&read_url, &current) && !(seen_download && current.as_str() == "about:blank") { return Ok(None); }
            Ok(read_window.cookies_for_url(read_url).map_err(|error| browser_failure("read verification result", error))?.into_iter()
                .find(|cookie| cookie.name() == "cf_clearance" && cookie.secure() == Some(true) && cookie.path() == Some("/") && policy::cookie(cookie.value()))
                .map(|cookie| format!("cf_clearance={}", cookie.value())))
        }).await.map_err(|error| browser_failure("verification result task", error))??;
        let read = read_browser(&window).await?;
        if state().lock().map_err(|_| "source_verify_failed")?
            .complete(&profile, &id, &url, &agent, clearance, read, Instant::now())? { return Ok(()); }
    }
}

async fn read_browser(window: &WebviewWindow) -> Result<Option<BrowserRead>> {
    let (send, received) = tokio::sync::oneshot::channel();
    let send = Mutex::new(Some(send));
    window.eval_with_callback("window.__harborSourceResult || null", move |value| {
        if let Ok(mut send) = send.lock() {
            if let Some(send) = send.take() { let _ = send.send(value); }
        }
    }).map_err(|error| browser_failure("read catalog", error))?;
    let value = match tokio::time::timeout(Duration::from_secs(5), received).await {
        Ok(value) => value.map_err(|_| "source_verify_failed")?,
        Err(_) => return Ok(None),
    };
    if value.trim().is_empty() { return Ok(None); }
    serde_json::from_str(&value).map_err(|_| "source_verify_failed")
}

pub async fn fetch(profile: String, url: String, max_bytes: usize) -> Result<Option<HarborFetchResponse>> {
    if !policy::profile(&profile) || max_bytes == 0 || max_bytes > policy::MAX_BYTES { return Err("source_limit"); }
    let Ok(url) = policy::source(&url) else { return Ok(None); };
    {
        let mut state = state().lock().map_err(|_| "source_verify_failed")?;
        let now = Instant::now();
        state.bodies.retain(|_, (_, stored)| now.duration_since(*stored) < BODY_TTL);
        if let Some((body, _)) = state.bodies.get(&(profile.clone(), url.to_string())) {
            if body.len() > max_bytes { return Err("source_limit"); }
            return Ok(Some(HarborFetchResponse { status: 200, ok: true,
                body: base64::engine::general_purpose::STANDARD.encode(body.as_bytes()),
                content_type: Some("application/json".into()),
                headers: HashMap::from([("content-type".to_owned(), "application/json".to_owned())]),
                url: Some(url.to_string()) }));
        }
    }
    let grant = state().lock().map_err(|_| "source_verify_failed")?.grants.get(&profile, &url, Instant::now());
    let Some(grant) = grant else { return Ok(None); };
    static FETCHES: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);
    tokio::time::timeout(Duration::from_secs(20), async {
        let _permit = FETCHES.acquire().await.map_err(|_| "source_network")?;
        let client = public_http_client(&url).await.map_err(|_| "source_network")?;
        let mut cookie = reqwest::header::HeaderValue::from_str(&grant.cookie).map_err(|_| "source_verify_failed")?;
        cookie.set_sensitive(true);
        let response = client.get(url.clone()).header(reqwest::header::COOKIE, cookie)
            .header(reqwest::header::USER_AGENT, &grant.user_agent)
            .header(reqwest::header::ACCEPT, "application/json, text/html;q=0.8")
            .send().await.map_err(|_| "source_network")?;
        let status = response.status();
        if status == reqwest::StatusCode::FORBIDDEN {
            state().lock().map_err(|_| "source_verify_failed")?.grants.reject(&profile, &url, &grant.generation);
        }
        read_response(response, max_bytes, &url).await.map(Some)
    }).await.map_err(|_| "source_network")?
}

async fn read_response(mut response: reqwest::Response, max_bytes: usize, url: &reqwest::Url) -> Result<HarborFetchResponse> {
        let status = response.status();
        if response.content_length().is_some_and(|bytes| bytes > max_bytes as u64) { return Err("source_limit"); }
        let headers: HashMap<String, String> = ["content-type", "content-length", "etag", "last-modified", "link", "x-wp-totalpages"].into_iter()
            .filter_map(|name| response.headers().get(name).and_then(|value| value.to_str().ok()).map(|value| (name.to_owned(), value.to_owned()))).collect();
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| "source_network")? {
            if chunk.len() > max_bytes.saturating_sub(body.len()) { return Err("source_limit"); }
            body.extend_from_slice(&chunk);
        }
        Ok(HarborFetchResponse { status: status.as_u16(), ok: status.is_success(),
            body: base64::engine::general_purpose::STANDARD.encode(body), content_type: headers.get("content-type").cloned(), headers, url: Some(url.to_string()) })
}

#[cfg(test)]
#[path = "source_verification_tests.rs"]
mod tests;
