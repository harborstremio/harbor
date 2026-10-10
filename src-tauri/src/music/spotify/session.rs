use librespot_core::authentication::Credentials;
use librespot_core::cache::Cache;
use librespot_core::config::SessionConfig;
use librespot_core::session::Session;
use std::path::Path;
use std::time::Duration;

pub const FREE_ACCOUNT: &str =
    "Spotify Free cannot stream through third party apps. Connect a Spotify Premium account.";
pub const SIGN_IN_AGAIN: &str = "Spotify rejected the saved sign in. Connect Spotify again.";

const AUDIO_DIR: &str = "audio";
const AUDIO_CACHE_LIMIT: u64 = 2 * 1024 * 1024 * 1024;
const PRODUCT_INFO_TIMEOUT: Duration = Duration::from_secs(8);
const PRODUCT_INFO_POLL: Duration = Duration::from_millis(100);
const ACCOUNT_ATTRIBUTE: &str = "type";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccountTier {
    Premium,
    Free,
    Unknown,
}

impl AccountTier {
    pub fn from_attribute(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "premium" => Self::Premium,
            "" => Self::Unknown,
            _ => Self::Free,
        }
    }

    pub fn label(self) -> Option<&'static str> {
        match self {
            Self::Premium => Some("Premium"),
            Self::Free => Some("Spotify Free"),
            Self::Unknown => None,
        }
    }

    pub fn premium(self) -> bool {
        matches!(self, Self::Premium)
    }
}

pub fn clear_audio_cache(root: &Path) {
    let audio = root.join(AUDIO_DIR);
    if audio.is_dir() {
        let _ = std::fs::remove_dir_all(&audio);
    }
}

pub fn make_cache(root: &Path) -> Result<Cache, String> {
    let audio = root.join(AUDIO_DIR);
    std::fs::create_dir_all(&audio)
        .map_err(|error| format!("create Spotify cache {}: {error}", audio.display()))?;
    Cache::new(
        Some(root.to_path_buf()),
        Some(root.to_path_buf()),
        Some(audio),
        Some(AUDIO_CACHE_LIMIT),
    )
    .map_err(|error| format!("open Spotify cache {}: {error}", root.display()))
}

pub fn build(cache: Cache, device_id: String) -> Session {
    let mut config = SessionConfig::default();
    if !device_id.trim().is_empty() {
        config.device_id = device_id;
    }
    Session::new(config, Some(cache))
}

pub async fn connect(session: &Session, credentials: Credentials) -> Result<AccountTier, String> {
    session
        .connect(credentials, true)
        .await
        .map_err(describe_connect)?;
    let tier = await_account_tier(session).await;
    if tier == AccountTier::Free {
        session.shutdown();
        return Err(FREE_ACCOUNT.to_string());
    }
    if session.is_invalid() {
        return Err("Spotify closed the session before it was ready.".to_string());
    }
    Ok(tier)
}

async fn await_account_tier(session: &Session) -> AccountTier {
    let deadline = tokio::time::Instant::now() + PRODUCT_INFO_TIMEOUT;
    loop {
        if let Some(value) = session.get_user_attribute(ACCOUNT_ATTRIBUTE) {
            return AccountTier::from_attribute(&value);
        }
        if session.is_invalid() || tokio::time::Instant::now() >= deadline {
            return AccountTier::Unknown;
        }
        tokio::time::sleep(PRODUCT_INFO_POLL).await;
    }
}

fn describe_connect(error: librespot_core::Error) -> String {
    let text = error.to_string();
    let marker = text.to_ascii_lowercase();
    if marker.contains("badcredentials")
        || marker.contains("bad credentials")
        || marker.contains("invalid credentials")
        || marker.contains("unauthenticated")
    {
        return SIGN_IN_AGAIN.to_string();
    }
    format!("Spotify session connection failed: {text}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_tiers_read_the_product_info_attribute() {
        assert_eq!(AccountTier::from_attribute("premium"), AccountTier::Premium);
        assert_eq!(
            AccountTier::from_attribute(" Premium "),
            AccountTier::Premium
        );
        assert_eq!(AccountTier::from_attribute("free"), AccountTier::Free);
        assert_eq!(AccountTier::from_attribute("open"), AccountTier::Free);
        assert_eq!(AccountTier::from_attribute("  "), AccountTier::Unknown);
    }

    #[test]
    fn only_premium_reports_premium_and_every_tier_labels_itself_honestly() {
        assert!(AccountTier::Premium.premium());
        assert!(!AccountTier::Free.premium());
        assert!(!AccountTier::Unknown.premium());
        assert_eq!(AccountTier::Premium.label(), Some("Premium"));
        assert_eq!(AccountTier::Free.label(), Some("Spotify Free"));
        assert_eq!(AccountTier::Unknown.label(), None);
    }

    #[test]
    fn the_free_account_message_names_the_real_limit() {
        assert!(FREE_ACCOUNT.contains("Spotify Free"));
        assert!(FREE_ACCOUNT.contains("Premium"));
    }
}
