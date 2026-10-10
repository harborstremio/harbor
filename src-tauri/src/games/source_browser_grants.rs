//! Native-only exact-file receipts. Cookies stay in memory and are never serialized.
use super::source_browser_policy as policy;
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
struct Grant {
    profile: String,
    url: String,
    page: String,
    cookie: Option<String>,
    expires: Instant,
}
#[derive(Default)]
pub struct Grants(Mutex<HashMap<String, Grant>>);
impl Grants {
    pub fn insert(
        &self,
        profile: &str,
        url: &str,
        page: &str,
        cookie: Option<String>,
    ) -> Result<String, &'static str> {
        let host = policy::browser_pair(page, url)?;
        match (host, cookie.as_deref()) {
            (policy::Host::Gofile, Some(value))
                if value
                    .strip_prefix("accountToken=")
                    .is_some_and(policy::cookie) =>
            {
                ()
            }
            (policy::Host::FuckingFast, None) => (),
            (
                policy::Host::DataNodes | policy::Host::Fichier | policy::Host::Buzzheavier
                | policy::Host::VikingFile | policy::Host::Fileditch | policy::Host::MegaDb
                | policy::Host::FileKeeper | policy::Host::AkiraBox | policy::Host::Rootz,
                value,
            ) if value.is_none_or(policy::cookie_header) => (),
            _ => return Err("public_browser"),
        }
        let mut grants = self.0.lock().map_err(|_| "public_browser")?;
        grants.retain(|_, g| g.expires > Instant::now());
        if grants.len() >= 200 {
            return Err("public_limit");
        }
        let id = uuid::Uuid::new_v4().to_string();
        grants.insert(
            id.clone(),
            Grant {
                profile: profile.into(),
                url: url.into(),
                page: page.into(),
                cookie,
                expires: Instant::now() + Duration::from_secs(30 * 60),
            },
        );
        Ok(id)
    }
    pub fn resolve(&self, id: &str, profile: &str, url: &str) -> Result<String, &'static str> {
        let mut grants = self.0.lock().map_err(|_| "transfer_access")?;
        grants.retain(|_, g| g.expires > Instant::now());
        let g = grants
            .get(id)
            .filter(|g| g.profile == profile && g.url == url)
            .ok_or("transfer_access")?;
        Ok(g.page.clone())
    }
    pub fn cookie(&self, profile: &str, url: &str) -> Option<String> {
        let mut grants = self.0.lock().ok()?;
        grants.retain(|_, g| g.expires > Instant::now());
        grants
            .values()
            .filter(|g| g.profile == profile && g.url == url)
            .max_by_key(|g| g.expires)
            .and_then(|g| g.cookie.clone())
    }
}
pub fn shared() -> &'static Grants {
    static GRANTS: OnceLock<Grants> = OnceLock::new();
    GRANTS.get_or_init(Grants::default)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn new_hosts_bind_optional_cookies_to_the_exact_file_and_profile() {
        let grants = Grants::default();
        for (page, file) in [
            (
                "https://datanodes.to/r9s07mymkzbt",
                "https://cdn17.datanodes.to/download/token/archive.rar",
            ),
            (
                "https://1fichier.com/?b7ltalh4x9cn68f0grn1",
                "https://a-34.1fichier.com/c1103650933",
            ),
            (
                "https://buzzheavier.com/abcdefghijkl",
                "https://dl.buzzheavier.com/download/token/archive.zip",
            ),
        ] {
            let ticket = grants
                .insert(
                    "owner",
                    file,
                    page,
                    Some("session=fixture; preference=en".into()),
                )
                .unwrap();
            assert_eq!(grants.resolve(&ticket, "owner", file).unwrap(), page);
            assert!(grants.resolve(&ticket, "other", file).is_err());
            assert!(grants.cookie("other", file).is_none());
            assert!(grants
                .insert("owner", file, page, Some("session=x\r\nHost: evil".into()))
                .is_err());
            assert!(grants
                .insert("owner", file, "https://gofile.io/d/a1B2c3", None)
                .is_err());
            assert!(grants.insert("owner", file, page, None).is_ok());
        }
    }
    #[test]
    fn receipts_bind_profile_and_exact_file_expire_and_remain_retryable() {
        let file = "https://store-eu-par-1.gofile.io/download/web/8b9c0d1e-2f3a-4b4c-ad5e-6f7a8b9c0d1e/file.zip";
        let page = "https://gofile.io/d/a1B2c3";
        let grants = Grants::default();
        let ticket = grants
            .insert("profile-a", file, page, Some("accountToken=test".into()))
            .unwrap();
        for _ in 0..2 {
            assert_eq!(grants.resolve(&ticket, "profile-a", file).unwrap(), page);
        }
        assert!(grants.resolve(&ticket, "profile-b", file).is_err());
        assert!(grants.resolve(&ticket, "profile-a", "file-b").is_err());
        assert!(grants.cookie("profile-b", file).is_none());
        assert!(grants.cookie("profile-a", "file-b").is_none());
        assert_eq!(
            grants.cookie("profile-a", file).as_deref(),
            Some("accountToken=test")
        );
        grants.0.lock().unwrap().get_mut(&ticket).unwrap().expires = Instant::now();
        assert!(grants.resolve(&ticket, "profile-a", file).is_err());
        assert!(grants.cookie("profile-a", file).is_none());
    }
    #[test]
    fn public_temporary_links_have_receipts_without_borrowing_provider_cookies() {
        let grants = Grants::default();
        let file = format!("https://fuckingfast.co/dl/{}", "a".repeat(64));
        let page = "https://fuckingfast.co/ab12cd34ef56";
        let ticket = grants.insert("profile-a", &file, page, None).unwrap();
        assert_eq!(grants.resolve(&ticket, "profile-a", &file).unwrap(), page);
        assert!(grants.resolve(&ticket, "profile-b", &file).is_err());
        assert!(grants
            .resolve(&ticket, "profile-a", &format!("{file}b"))
            .is_err());
        assert!(grants.cookie("profile-a", &file).is_none());
        assert!(grants
            .insert("profile-a", &file, page, Some("accountToken=test".into()))
            .is_err());
        assert!(grants
            .insert("profile-a", &file, "https://gofile.io/d/a1B2c3", None)
            .is_err());
    }
}

#[cfg(test)]
mod rotating_storage_tests {
    use super::*;
    #[test]
    fn newer_providers_issue_exact_file_receipts_for_rotating_storage() {
        let grants = Grants::default();
        for page in ["https://vikingfile.com/f/PPOab9zWW1", "https://filekeeper.net/ab12cd34ef56", "https://akirabox.com/abx7k2m9/file", "https://rootz.so/d/Abc123xy"] {
            let file = "https://rotating-storage.example.net/file.zip?signature=fixture";
            let ticket = grants.insert("profile", file, page, None).unwrap();
            assert_eq!(grants.resolve(&ticket, "profile", file).unwrap(), page);
            assert!(grants.resolve(&ticket, "other", file).is_err());
            assert!(grants.resolve(&ticket, "profile", "https://rotating-storage.example.net/other.zip").is_err());
        }
    }
}
