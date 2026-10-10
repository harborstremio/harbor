//! Source-only cancellation wraps the existing ordinary and verified HTTP paths.
use super::{source_http_requests::{Requests, DEADLINE}, source_verification, source_verification_policy};
use crate::http_fetch::{harbor_fetch, HarborFetchArgs, HarborFetchResponse};
use std::{collections::HashMap, sync::OnceLock};

fn requests() -> &'static Requests {
    static REQUESTS: OnceLock<Requests> = OnceLock::new();
    REQUESTS.get_or_init(Requests::default)
}

pub(super) fn cancel(profile: Option<&str>, session: &str) { requests().cancel(profile, session); }

pub(super) async fn fetch(app: tauri::AppHandle, profile: Option<String>, session: String,
    url: String, max_bytes: usize) -> Result<HarborFetchResponse, String> {
    if max_bytes == 0 || max_bytes > source_verification_policy::MAX_BYTES { return Err("source_limit".into()); }
    let parsed = reqwest::Url::parse(&url).map_err(|_| "source_url")?;
    if url.len() > 8192 || !matches!(parsed.scheme(), "http" | "https") || parsed.host_str().is_none()
        || !parsed.username().is_empty() || parsed.password().is_some() || parsed.fragment().is_some()
        || url.chars().any(char::is_control) { return Err("source_url".into()); }
    requests().run(profile.as_deref(), &session, DEADLINE, async {
        if let Some(profile) = &profile {
            if let Some(document) = source_verification::fetch(profile.clone(), url.clone(), max_bytes).await? {
                return Ok(document);
            }
        }
        // Keep the established target/redirect/body guards and no automatic browser
        // challenge solving for capped base64 responses. No new HTTP adapter.
        harbor_fetch(app, HarborFetchArgs {
            url, method: Some("GET".into()), headers: Some(HashMap::from([
                ("Accept".into(), "application/json, text/html;q=0.8".into()),
            ])), body: None, body_base64: None, timeout_ms: Some(DEADLINE.as_millis() as u64),
            response_type: Some("base64".into()), max_response_bytes: Some(max_bytes as u64),
            credential_handle: None, public_network_only: None, allow_local_network: None,
            follow_redirects: None, thumb_width_px: None,
        }).await.map_err(|error| if error.contains("response size limit exceeded") { "source_limit".into() } else { "source_network".into() })
    }).await
}
