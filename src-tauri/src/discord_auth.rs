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

// Shared head/CSS for the loopback callback pages, styled to match Harbor's
// own theme tokens (see src/index.css) even though this markup is served
// standalone by axum and has no access to the app's stylesheet or fonts.
const PAGE_HEAD: &str = r#"<!doctype html><html><head><meta charset="utf-8"><title>Harbor</title><style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,"Segoe UI",system-ui,sans-serif;background:oklch(0.18 0.004 260);color:oklch(0.97 0.003 260);perspective:1200px}
.card{position:relative;overflow:hidden;text-align:center;max-width:380px;width:100%;padding:40px 36px;border-radius:28px;background:oklch(0.22 0.004 260);border:1px solid oklch(0.36 0.004 260 / 0.25);box-shadow:0 24px 60px -20px oklch(0 0 0 / 0.5);transform-style:preserve-3d;transition:transform 150ms ease-out;animation:rise 420ms cubic-bezier(0.16,1,0.3,1)}
.card::before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(circle at var(--mx,50%) var(--my,50%),oklch(1 0 0 / 0.06),transparent 60%);opacity:0;transition:opacity 200ms;pointer-events:none}
.card:hover::before{opacity:1}
.brand{width:26px;height:auto;margin:0 auto 22px;color:oklch(0.65 0.003 260);opacity:0.6;transform:translateZ(6px)}
.badge{width:56px;height:56px;margin:0 auto 20px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:var(--glow);color:var(--tone);animation:float 3.2s ease-in-out infinite}
.badge svg{width:26px;height:26px}
h1{font-size:20px;font-weight:600;margin:0 0 8px;letter-spacing:-0.01em;transform:translateZ(16px)}
p{color:oklch(0.72 0.003 260);font-size:14px;line-height:1.6;margin:0;transform:translateZ(8px)}
@keyframes rise{from{opacity:0;transform:translateY(10px) scale(0.98)}to{opacity:1;transform:none}}
@keyframes float{0%,100%{transform:translateZ(28px) translateY(0)}50%{transform:translateZ(28px) translateY(-4px)}}
@media (prefers-reduced-motion: reduce){.card{animation:none;transition:none;transform:none}.badge{animation:none;transform:translateZ(28px)}}
</style></head><body>"#;

// Progressive-enhancement pointer tilt: skipped entirely under
// prefers-reduced-motion, and a no-op if JS is unavailable -- the card still
// reads fine as a flat page in that case.
const JS_TILT: &str = r#"<script>
(function(){
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var card = document.querySelector(".card");
  if(!card||reduce) return;
  var raf=null, pending=null;
  function apply(){
    raf=null;
    var r=card.getBoundingClientRect();
    var px=(pending.x-r.left)/r.width;
    var py=(pending.y-r.top)/r.height;
    var rx=(0.5-py)*10;
    var ry=(px-0.5)*10;
    card.style.setProperty("--mx",(px*100).toFixed(1)+"%");
    card.style.setProperty("--my",(py*100).toFixed(1)+"%");
    card.style.transform="rotateX("+rx.toFixed(2)+"deg) rotateY("+ry.toFixed(2)+"deg)";
  }
  card.addEventListener("mousemove",function(e){
    pending={x:e.clientX,y:e.clientY};
    if(!raf) raf=requestAnimationFrame(apply);
  });
  card.addEventListener("mouseleave",function(){
    card.style.transform="";
  });
})();
</script>"#;

// Harbor's brand mark, recolored to currentColor (paths are otherwise an
// unmodified copy of src/assets/harbor-logo-test.svg) so it tints with the
// muted .brand color instead of staying hardcoded white.
const LOGO_MARK: &str = r#"<svg class="brand" viewBox="0 0 700 642.88" fill="currentColor" aria-hidden="true"><g transform="matrix(0.13333333,0,0,-0.13333333,0,642.88)"><path d="m 9124.66,1534.27 c 0,0 1127.54,922.03 1526.94,2636.89 0,0 463.9,-1274.4 17.6,-2625.15 l -1544.54,-11.74"/><path d="m 13028.2,2945.05 -1163.4,-722.79 c -36.7,-22.79 -84.2,3.59 -84.2,46.78 v 1391.45 c 0,42.35 45.8,68.85 82.5,47.75 l 1163.5,-668.68 c 36.1,-20.75 37,-72.53 1.6,-94.51 z M 11074.4,4821.57 V 1438.84 l 2819,416.96 c 0,0 252.5,2501.82 -2819,2965.77"/><path d="m 9667.9,4.40234 c 0,0 -364.82,308.39866 -604.43,706.25766 -28.31,47.012 1.5,107.77 55.86,115.281 l 5023.37,694.179 c 57.3,7.92 102.7,-47.69 83,-102.09 C 14118.4,1122 13799.4,351.742 13275.3,0 L 9667.9,4.40234"/><path d="m 72.0781,1534.27 c 0,0 1127.5819,922.03 1526.9319,2636.89 0,0 463.95,-1274.4 17.61,-2625.15 L 72.0781,1534.27"/><path d="M 3975.59,2945.05 2812.18,2222.26 c -36.68,-22.79 -84.13,3.59 -84.13,46.78 v 1391.45 c 0,42.35 45.8,68.85 82.51,47.75 l 1163.41,-668.68 c 36.11,-20.75 37,-72.53 1.62,-94.51 z M 2021.85,4821.57 V 1438.84 l 2818.94,416.96 c 0,0 252.54,2501.82 -2818.94,2965.77"/><path d="m 615.313,4.40234 c 0,0 -364.817,308.39866 -604.4224,706.25766 -28.3125,47.012 1.4922,107.77 55.8555,115.281 L 5090.13,1520.12 c 57.31,7.92 102.66,-47.69 82.95,-102.09 C 5065.81,1122 4746.77,351.742 4222.68,0 L 615.313,4.40234"/></g></svg>"#;

const ICON_CHECK: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>"#;
const ICON_ALERT: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5h.01"/></svg>"#;
const ICON_CROSS: &str = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>"#;

const TONE_SUCCESS: &str = "oklch(0.68 0.15 150)";
const TONE_SUCCESS_GLOW: &str = "oklch(0.68 0.15 150 / 0.15)";
const TONE_DANGER: &str = "oklch(0.55 0.18 25)";
const TONE_DANGER_GLOW: &str = "oklch(0.55 0.18 25 / 0.15)";
const TONE_ACCENT: &str = "oklch(0.78 0.13 60)";
const TONE_ACCENT_GLOW: &str = "oklch(0.78 0.13 60 / 0.15)";

fn render_page(tone: &str, glow: &str, icon: &str, heading: &str, message: &str) -> String {
    let mut html = PAGE_HEAD.to_string();
    html.push_str(&format!(
        r#"<div class="card">{logo}<div class="badge" style="--tone:{tone};--glow:{glow}">{icon}</div><h1>{heading}</h1><p>{message}</p></div>{script}</body></html>"#,
        logo = LOGO_MARK,
        script = JS_TILT,
    ));
    html
}

fn page_ok() -> String {
    render_page(
        TONE_SUCCESS,
        TONE_SUCCESS_GLOW,
        ICON_CHECK,
        "You're signed in",
        "You can close this tab and head back to Harbor.",
    )
}

fn page_fail() -> String {
    render_page(
        TONE_DANGER,
        TONE_DANGER_GLOW,
        ICON_ALERT,
        "Something went wrong",
        "No sign-in code came through. Return to Harbor and try again.",
    )
}

fn page_denied() -> String {
    render_page(
        TONE_ACCENT,
        TONE_ACCENT_GLOW,
        ICON_CROSS,
        "Sign-in cancelled",
        "Return to Harbor to try again.",
    )
}

// Discord echoes back either `code` (consent granted) or `error` (denied /
// something went wrong on Discord's side), plus the `state` we sent it --
// never both code and error. The native listener validates the state before
// relaying anything so a stray local callback cannot terminate an active
// sign-in attempt. The frontend validates it again as defense in depth.
#[derive(Clone, Serialize)]
struct DiscordAuthResult {
    state: String,
    code: Option<String>,
    error: Option<String>,
}

fn oauth_state_matches(received: &str, expected: &str) -> bool {
    !expected.is_empty() && received == expected
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
    expected_state: String,
) -> Result<u16, String> {
    if expected_state.is_empty() {
        return Err("missing Discord OAuth state".to_string());
    }

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
    let expected_state = Arc::new(expected_state);

    let router = Router::new().route(
        "/cb",
        get(move |Query(params): Query<HashMap<String, String>>| {
            let app = app_handle.clone();
            let done = done.clone();
            let expected_state = expected_state.clone();
            async move {
                let state = params.get("state").cloned().unwrap_or_default();
                let code = params.get("code").cloned();
                let error = params.get("error").cloned();

                if !oauth_state_matches(&state, &expected_state) {
                    return Html(page_fail());
                }

                let page = if error.is_some() {
                    page_denied()
                } else if code.is_some() {
                    page_ok()
                } else {
                    page_fail()
                };

                let _ = app.emit("discord-auth", DiscordAuthResult { state, code, error });
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
        assert!(
            result.is_ok(),
            "expected bind to succeed once the port was released"
        );
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

    #[test]
    fn oauth_state_comparison_rejects_missing_and_mismatched_values() {
        assert!(!oauth_state_matches("", "expected-state"));
        assert!(!oauth_state_matches("other-state", "expected-state"));
        assert!(!oauth_state_matches("anything", ""));
        assert!(oauth_state_matches("expected-state", "expected-state"));
    }
}
