use super::session::AccountTier;
use super::{api, auth, keystore, SpotifyState};
use librespot_core::session::Session;
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

pub const CONNECT_FIRST: &str = "Connect Spotify Premium to use Spotify";

const DEFAULT_MARKET: &str = "US";

impl SpotifyState {
    pub(super) fn http(&self) -> &reqwest::Client {
        &self.http
    }

    pub(super) fn market(&self) -> String {
        let country = self.account.read().country.trim().to_ascii_uppercase();
        if country.len() == 2 && country.chars().all(|entry| entry.is_ascii_alphabetic()) {
            country
        } else {
            DEFAULT_MARKET.to_string()
        }
    }

    pub(super) async fn web_token(&self) -> Result<String, String> {
        if !self.connected() {
            return Err(CONNECT_FIRST.to_string());
        }
        let now = unix_seconds();
        let cached = self.web_token.read().clone();
        if let Some(token) = cached.as_ref().filter(|token| token.is_fresh(now)) {
            return Ok(token.access_token.clone());
        }
        let app = self.app.read().clone();
        if let Some(app) = app {
            if let Some(stored) = cached.or_else(|| keystore::web_token(&app)) {
                if stored.is_fresh(now) {
                    let access = stored.access_token.clone();
                    *self.web_token.write() = Some(stored);
                    return Ok(access);
                }
                if let Some(previous) = stored.refresh_token.clone() {
                    match auth::refresh(&app, &previous).await {
                        Ok(mut granted) => {
                            // Refresh cannot grant new scopes. The OAuth library substitutes its
                            // requested scopes when Spotify omits them from a refresh response.
                            granted.scopes = stored.scopes.clone();
                            return Ok(self.adopt_web_token(&app, granted, Some(previous)));
                        }
                        Err(error) if error.contains(auth::EXPIRED) => {
                            *self.web_token.write() = None;
                            let _ = keystore::write(&app, keystore::WEB_TOKEN_KEY, None);
                        }
                        Err(_) => {}
                    }
                }
            }
        }
        self.session_token().await
    }

    pub(super) fn adopt_web_token(
        &self,
        app: &AppHandle,
        granted: auth::Authorization,
        previous: Option<String>,
    ) -> String {
        let token = keystore::WebToken {
            access_token: granted.access_token,
            refresh_token: granted.refresh_token.or(previous),
            expires_at: granted.expires_at,
            scopes: granted.scopes,
        };
        let access = token.access_token.clone();
        let _ = keystore::store_web_token(app, &token);
        *self.web_token.write() = Some(token);
        access
    }

    pub(super) async fn probe_tier(&self, session: &Session) -> AccountTier {
        let Ok(token) = session.login5().auth_token().await else {
            return AccountTier::Unknown;
        };
        let Ok(body) = api::me(&self.http, &token.access_token).await else {
            return AccountTier::Unknown;
        };
        body.get("product")
            .and_then(Value::as_str)
            .map_or(AccountTier::Unknown, AccountTier::from_attribute)
    }

    async fn session_token(&self) -> Result<String, String> {
        self.ensure_session().await?;
        let session = self.account.read().session.clone();
        let session = session
            .filter(|session| !session.is_invalid())
            .ok_or_else(|| CONNECT_FIRST.to_string())?;
        let token = session
            .login5()
            .auth_token()
            .await
            .map_err(|error| format!("Spotify authorization failed: {error}"))?;
        Ok(token.access_token)
    }
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
    fn the_market_falls_back_to_a_valid_country_code() {
        let state = SpotifyState::new();
        assert_eq!(state.market(), DEFAULT_MARKET);
        state.account.write().country = "gb".to_string();
        assert_eq!(state.market(), "GB");
        state.account.write().country = "united kingdom".to_string();
        assert_eq!(state.market(), DEFAULT_MARKET);
        state.account.write().country = "1a".to_string();
        assert_eq!(state.market(), DEFAULT_MARKET);
    }

    #[tokio::test]
    async fn a_disconnected_state_asks_for_a_sign_in_before_any_web_call() {
        let state = SpotifyState::new();
        assert_eq!(
            state.web_token().await.expect_err("disconnected"),
            CONNECT_FIRST
        );
    }

    #[test]
    fn the_clock_moves_forward() {
        assert!(unix_seconds() > 1_700_000_000);
    }
}
