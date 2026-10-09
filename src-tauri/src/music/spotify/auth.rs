use super::keystore;
use librespot_oauth::{OAuthClient, OAuthClientBuilder, OAuthError, OAuthToken};
use std::io::Write;
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

pub const EXPIRED: &str = "Spotify sign in expired";
pub const REJECTED_CLIENT: &str = "Spotify rejected that client id";
pub const MISSING_CLIENT_ID: &str = "Spotify needs your own client id";
pub const BRING_YOUR_OWN: &str = "Bring your own Spotify app";

const REDIRECT_PORT: u16 = 8898;
const OAUTH_TIMEOUT: Duration = Duration::from_secs(90);
const CANCEL_TIMEOUT: Duration = Duration::from_secs(2);
const SCOPES: &[&str] = &[
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "user-read-recently-played",
    "user-top-read",
    "user-library-read",
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-private",
    "playlist-modify-public",
];
const CALLBACK_HTML: &str = r#"<!doctype html>
<html><head><meta charset="utf-8"><title>Harbor Music connected</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0d10;color:#f5f3ec;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}h1{font-weight:500;margin:0 0 .5rem;font-size:1.25rem}p{opacity:.6;margin:0;font-size:.875rem}</style></head>
<body><main><h1>Connected to Harbor Music</h1><p>You can close this tab.</p></main></body></html>"#;

pub struct Authorization {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: u64,
    pub scopes: Vec<String>,
}

pub fn client_id(app: &AppHandle) -> Result<String, String> {
    keystore::read(app, keystore::CLIENT_ID_KEY)
        .ok_or_else(|| format!("{MISSING_CLIENT_ID}. {}", setup_hint()))
}

/// What a listener has to do once, in their own Spotify dashboard, before Harbor can
/// ask Spotify for a token on their behalf.
pub fn setup_hint() -> String {
    format!(
        "Create an app at developer.spotify.com/dashboard, add {} as a redirect URI, then paste the client id here.",
        redirect_uri()
    )
}

pub async fn authorize(app: &AppHandle) -> Result<Authorization, String> {
    ensure_port_free().await?;
    let client_id = client_id(app)?;
    let granted = tokio::task::spawn_blocking(move || {
        client(&client_id)?.get_access_token().map_err(describe)
    });
    match tokio::time::timeout(OAUTH_TIMEOUT, granted).await {
        Ok(Ok(token)) => token.map(authorization),
        Ok(Err(_)) => {
            release_listener().await;
            Err("Spotify sign in stopped before it finished".to_string())
        }
        Err(_) => {
            release_listener().await;
            Err(format!(
                "Spotify sign in timed out after {} seconds",
                OAUTH_TIMEOUT.as_secs()
            ))
        }
    }
}

pub async fn refresh(app: &AppHandle, refresh_token: &str) -> Result<Authorization, String> {
    let client_id = client_id(app)?;
    let refresh_token = refresh_token.to_string();
    tokio::task::spawn_blocking(move || {
        client(&client_id)?
            .refresh_token(&refresh_token)
            .map_err(describe)
    })
    .await
    .map_err(|_| "Spotify token refresh stopped before it finished".to_string())?
    .map(authorization)
}

fn client(client_id: &str) -> Result<OAuthClient, String> {
    OAuthClientBuilder::new(client_id, &redirect_uri(), SCOPES.to_vec())
        .open_in_browser()
        .with_custom_message(CALLBACK_HTML)
        .build()
        .map_err(describe)
}

fn redirect_uri() -> String {
    format!("http://127.0.0.1:{REDIRECT_PORT}/login")
}

fn authorization(token: OAuthToken) -> Authorization {
    let remaining = token.expires_at.saturating_duration_since(Instant::now());
    Authorization {
        access_token: token.access_token,
        refresh_token: Some(token.refresh_token).filter(|value| !value.trim().is_empty()),
        expires_at: unix_seconds().saturating_add(remaining.as_secs()),
        scopes: token.scopes,
    }
}

fn port_free() -> bool {
    TcpListener::bind(callback_address()).is_ok()
}

/// A sign in the listener abandoned leaves our own callback socket bound, so the retry has to
/// nudge that listener loose before deciding another program is holding the port.
async fn ensure_port_free() -> Result<(), String> {
    if port_free() {
        return Ok(());
    }
    release_listener().await;
    for _ in 0..12 {
        tokio::time::sleep(Duration::from_millis(120)).await;
        if port_free() {
            return Ok(());
        }
    }
    Err(format!(
        "Spotify sign in needs port {REDIRECT_PORT}. Close whatever is using it, or restart Harbor, and try again."
    ))
}

async fn release_listener() {
    let _ = tokio::task::spawn_blocking(|| {
        let Ok(mut stream) = TcpStream::connect_timeout(&callback_address(), CANCEL_TIMEOUT) else {
            return;
        };
        let _ = stream.write_all(b"GET /login HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
        let _ = stream.flush();
    })
    .await;
}

fn callback_address() -> SocketAddr {
    SocketAddr::from((Ipv4Addr::LOCALHOST, REDIRECT_PORT))
}

fn describe(error: OAuthError) -> String {
    let text = error.to_string();
    let marker = text.to_ascii_lowercase();
    if marker.contains("invalid_grant") {
        return format!("{EXPIRED}. Connect Spotify again.");
    }
    if marker.contains("invalid_client")
        || marker.contains("unauthorized_client")
        || marker.contains("redirect_uri")
        || marker.contains("invalid redirect")
    {
        return format!(
            "{REJECTED_CLIENT}. Confirm the Spotify app allows {} as a redirect URI.",
            redirect_uri()
        );
    }
    if marker.contains("failed to bind") {
        return format!(
            "Spotify sign in needs port {REDIRECT_PORT}. Close the app that is holding it and try again."
        );
    }
    if marker.contains("auth code param not found") {
        return "Spotify sign in was cancelled before it finished.".to_string();
    }
    format!("Spotify sign in failed: {text}")
}

fn unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_redirect_uri_is_the_loopback_literal_spotify_requires() {
        assert_eq!(redirect_uri(), "http://127.0.0.1:8898/login");
        assert_eq!(callback_address().port(), 8898);
        assert!(callback_address().ip().is_loopback());
    }

    #[test]
    fn the_scope_list_covers_every_browse_row_harbor_builds() {
        for scope in [
            "user-library-read",
            "user-top-read",
            "user-read-recently-played",
            "playlist-read-private",
            "playlist-read-collaborative",
            "streaming",
        ] {
            assert!(SCOPES.contains(&scope), "missing scope {scope}");
        }
    }
}
