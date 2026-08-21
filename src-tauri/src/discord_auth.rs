use axum::extract::Query;
use axum::response::Html;
use axum::routing::get;
use axum::Router;
use serde::Serialize;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::net::TcpListener;
use tokio::sync::{oneshot, Mutex};

// Tracks the shutdown sender for whichever loopback listener is currently
// bound to DISCORD_LOOPBACK_PORT, if any. Needed because the port is fixed
// (see the comment below) -- a second discord_auth_start call before the
// first one's 5-minute window elapses (user retries, double-clicks, or the
// first attempt was abandoned) would otherwise hit "address already in use"
// and surface as an unmapped Rust error string on the frontend.
pub struct DiscordLoopbackState(Mutex<Option<oneshot::Sender<()>>>);

impl DiscordLoopbackState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

impl Default for DiscordLoopbackState {
    fn default() -> Self {
        Self::new()
    }
}

// Fixed, not ephemeral, unlike stremio_auth's port-0 bind: Discord requires an
// exact pre-registered redirect_uri match at both /authorize and
// /oauth2/token, so the port here, harbor-themes' DISCORD_REDIRECT_URI
// (services/harbor-themes/.env.example in harbor-hosted, default
// http://127.0.0.1:51988/cb) and the redirect URI registered on the Discord
// app itself all have to agree on the same value. Working assumption pending
// empirical confirmation against a real registered Discord app -- see the
// backend plan's Phase 0.
const DISCORD_LOOPBACK_PORT: u16 = 51988;

const PAGE_OK: &str = r#"<!doctype html><html><head><meta charset="utf-8"><title>Harbor</title><style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;background:#0d0f14;color:#e9ebf2}.c{text-align:center;max-width:380px;padding:32px}h1{font-size:21px;margin:0 0 10px;font-weight:600}p{color:#9aa1ad;font-size:14px;line-height:1.55;margin:0}</style></head><body><div class="c"><h1>You're signed in</h1><p>You can close this tab and head back to Harbor.</p></div></body></html>"#;

const PAGE_FAIL: &str = r#"<!doctype html><html><head><meta charset="utf-8"><title>Harbor</title><style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;background:#0d0f14;color:#e9ebf2}.c{text-align:center;max-width:380px;padding:32px}p{color:#9aa1ad;font-size:14px;line-height:1.55}</style></head><body><div class="c"><p>No sign-in code came through. Return to Harbor and try again.</p></div></body></html>"#;

const PAGE_DENIED: &str = r#"<!doctype html><html><head><meta charset="utf-8"><title>Harbor</title><style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;background:#0d0f14;color:#e9ebf2}.c{text-align:center;max-width:380px;padding:32px}p{color:#9aa1ad;font-size:14px;line-height:1.55}</style></head><body><div class="c"><p>Sign-in was cancelled. Return to Harbor to try again.</p></div></body></html>"#;

// Discord echoes back either `code` (consent granted) or `error` (denied /
// something went wrong on Discord's side), plus the `state` we sent it --
// never both code and error. The frontend (not this listener) is what
// actually validates state against the challenge it started, same as it does
// for Stremio's `key`; this only relays what Discord sent.
#[derive(Clone, Serialize)]
struct DiscordAuthResult {
    state: String,
    code: Option<String>,
    error: Option<String>,
}

// 40 attempts * 75ms = 3s total budget. Generous on purpose: mio does not set
// SO_REUSEADDR on Windows (unlike Unix), so there is no OS-level guarantee
// the previous listener's port is released promptly -- only an observed
// common case. AV/endpoint-protection loopback interception on Windows can
// plausibly add real delay to socket teardown.
const BIND_RETRY_ATTEMPTS: u32 = 40;
const BIND_RETRY_DELAY: std::time::Duration = std::time::Duration::from_millis(75);

// Signaling a previous listener's shutdown doesn't release the OS port
// synchronously -- axum's graceful_shutdown has to unwind the serve future
// first. Retry the bind rather than assuming a fixed delay is long enough
// (or too long). Takes `addr`/`attempts`/`delay` as parameters (rather than
// hard-coding DISCORD_LOOPBACK_PORT) so tests can exercise this against a
// throwaway port instead of the one a running app instance may actually be
// using.
async fn bind_with_retry(
    addr: SocketAddr,
    attempts: u32,
    delay: std::time::Duration,
) -> Result<TcpListener, String> {
    let mut last_err = None;
    for attempt in 0..attempts {
        match TcpListener::bind(addr).await {
            Ok(listener) => return Ok(listener),
            Err(e) => {
                last_err = Some(e);
                if attempt + 1 < attempts {
                    tokio::time::sleep(delay).await;
                }
            }
        }
    }
    Err(format!(
        "bind failed on {}: {}",
        addr,
        last_err.map(|e| e.to_string()).unwrap_or_default()
    ))
}

async fn bind_loopback() -> Result<TcpListener, String> {
    let addr = SocketAddr::from(([127, 0, 0, 1], DISCORD_LOOPBACK_PORT));
    let result = bind_with_retry(addr, BIND_RETRY_ATTEMPTS, BIND_RETRY_DELAY).await;
    if let Err(ref e) = result {
        eprintln!("[harbor::discord_auth] {}", e);
    }
    result
}

#[tauri::command]
pub async fn discord_auth_start(
    app: AppHandle,
    loopback: State<'_, DiscordLoopbackState>,
) -> Result<u16, String> {
    if let Some(prev) = loopback.0.lock().await.take() {
        let _ = prev.send(());
    }

    let listener = bind_loopback().await?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("local_addr: {}", e))?
        .port();

    let (tx, rx) = oneshot::channel::<()>();
    *loopback.0.lock().await = Some(tx);
    let (tx_done, rx_done) = oneshot::channel::<()>();
    let done = Arc::new(Mutex::new(Some(tx_done)));
    let app_handle = app.clone();

    let router = Router::new().route(
        "/cb",
        get(move |Query(params): Query<HashMap<String, String>>| {
            let app = app_handle.clone();
            let done = done.clone();
            async move {
                let state = params.get("state").cloned().unwrap_or_default();
                let code = params.get("code").cloned();
                let error = params.get("error").cloned();

                if state.is_empty() {
                    return Html(PAGE_FAIL);
                }

                let page = if error.is_some() {
                    PAGE_DENIED
                } else if code.is_some() {
                    PAGE_OK
                } else {
                    PAGE_FAIL
                };

                let _ = app.emit(
                    "discord-auth",
                    DiscordAuthResult {
                        state,
                        code,
                        error,
                    },
                );
                if let Some(sender) = done.lock().await.take() {
                    let _ = sender.send(());
                }
                Html(page)
            }
        }),
    );

    tokio::spawn(async move {
        let shutdown = async {
            tokio::select! {
                _ = rx => {}
                _ = rx_done => {}
                _ = tokio::time::sleep(std::time::Duration::from_secs(300)) => {}
            }
        };
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(shutdown)
            .await;
    });

    Ok(port)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Both tests bind to an OS-assigned port (port 0) first to get a real,
    // currently-free port number, rather than using DISCORD_LOOPBACK_PORT --
    // a running app instance may genuinely be listening on 51988, and these
    // tests must not fight it for the port.
    async fn free_port() -> u16 {
        TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
            .await
            .expect("bind to an OS-assigned port")
            .local_addr()
            .expect("local_addr")
            .port()
    }

    #[tokio::test]
    async fn bind_with_retry_succeeds_immediately_when_the_port_is_free() {
        let port = free_port().await;
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        let result = bind_with_retry(addr, 5, std::time::Duration::from_millis(10)).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn bind_with_retry_recovers_once_the_prior_listener_is_dropped() {
        let occupied = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
            .await
            .expect("occupy a port");
        let port = occupied.local_addr().expect("local_addr").port();
        let addr = SocketAddr::from(([127, 0, 0, 1], port));

        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(80)).await;
            drop(occupied);
        });

        // Enough attempts/delay to comfortably outlast the 80ms drop above.
        let result = bind_with_retry(addr, 20, std::time::Duration::from_millis(20)).await;
        assert!(result.is_ok(), "expected bind to succeed once the port was released");
    }

    #[tokio::test]
    async fn bind_with_retry_fails_once_attempts_are_exhausted() {
        let occupied = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
            .await
            .expect("occupy a port");
        let port = occupied.local_addr().expect("local_addr").port();
        let addr = SocketAddr::from(([127, 0, 0, 1], port));

        let result = bind_with_retry(addr, 3, std::time::Duration::from_millis(10)).await;
        assert!(result.is_err());
        drop(occupied);
    }
}
