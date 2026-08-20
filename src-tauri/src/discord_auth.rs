use axum::extract::Query;
use axum::response::Html;
use axum::routing::get;
use axum::Router;
use serde::Serialize;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::sync::{oneshot, Mutex};

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

#[tauri::command]
pub async fn discord_auth_start(app: AppHandle) -> Result<u16, String> {
    let listener = TcpListener::bind(SocketAddr::from((
        [127, 0, 0, 1],
        DISCORD_LOOPBACK_PORT,
    )))
    .await
    .map_err(|e| format!("bind failed on 127.0.0.1:{}: {}", DISCORD_LOOPBACK_PORT, e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("local_addr: {}", e))?
        .port();

    let (tx, rx) = oneshot::channel::<()>();
    let done = Arc::new(Mutex::new(Some(tx)));
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
                _ = tokio::time::sleep(std::time::Duration::from_secs(300)) => {}
            }
        };
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(shutdown)
            .await;
    });

    Ok(port)
}
