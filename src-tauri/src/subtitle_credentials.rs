use std::collections::{HashMap, VecDeque};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

const CREDENTIAL_TTL: Duration = Duration::from_secs(24 * 60 * 60);
const MAX_CREDENTIALS: usize = 512;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SubtitleCredentialKind {
    SubsourceApiKey,
    SubdlApiKey,
}

impl SubtitleCredentialKind {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "subsource-api-key" => Some(Self::SubsourceApiKey),
            "subdl-api-key" => Some(Self::SubdlApiKey),
            _ => None,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::SubsourceApiKey => "subsource-api-key",
            Self::SubdlApiKey => "subdl-api-key",
        }
    }
}

#[derive(Clone)]
struct CredentialBinding {
    kind: SubtitleCredentialKind,
    secret: String,
    expires_at: Instant,
}

pub struct ResolvedSubtitleCredential {
    kind: SubtitleCredentialKind,
    secret: String,
}

#[derive(Default)]
struct VaultInner {
    bindings: HashMap<String, CredentialBinding>,
    insertion_order: VecDeque<String>,
}

#[derive(Default)]
struct CredentialVault {
    inner: Mutex<VaultInner>,
}

impl CredentialVault {
    fn prune_expired(inner: &mut VaultInner, now: Instant) {
        inner.bindings.retain(|_, binding| binding.expires_at > now);
        inner
            .insertion_order
            .retain(|handle| inner.bindings.contains_key(handle));
    }

    fn make_room_for_binding(inner: &mut VaultInner) {
        while inner.bindings.len() >= MAX_CREDENTIALS {
            let Some(oldest) = inner.insertion_order.pop_front() else {
                break;
            };
            inner.bindings.remove(&oldest);
        }
    }

    fn bind(&self, kind: SubtitleCredentialKind, secret: &str) -> Result<String, String> {
        let secret = secret.trim();
        if secret.is_empty() {
            return Err("subtitle credential is empty".to_string());
        }
        if secret.len() > 4096 {
            return Err("subtitle credential is too long".to_string());
        }

        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "subtitle credential vault is unavailable".to_string())?;
        let now = Instant::now();
        Self::prune_expired(&mut inner, now);
        Self::make_room_for_binding(&mut inner);
        let handle = Uuid::new_v4().to_string();
        inner.bindings.insert(
            handle.clone(),
            CredentialBinding {
                kind,
                secret: secret.to_string(),
                expires_at: now + CREDENTIAL_TTL,
            },
        );
        inner.insertion_order.push_back(handle.clone());
        Ok(handle)
    }

    fn resolve(&self, handle: &str) -> Result<ResolvedSubtitleCredential, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "subtitle credential vault is unavailable".to_string())?;
        let now = Instant::now();
        Self::prune_expired(&mut inner, now);
        let binding = inner
            .bindings
            .get(handle)
            .ok_or_else(|| "subtitle credential is unavailable or expired".to_string())?;
        Ok(ResolvedSubtitleCredential {
            kind: binding.kind,
            secret: binding.secret.clone(),
        })
    }

    fn clear(&self) -> Result<(), String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "subtitle credential vault is unavailable".to_string())?;
        inner.bindings.clear();
        inner.insertion_order.clear();
        Ok(())
    }
}

fn vault() -> &'static CredentialVault {
    static VAULT: OnceLock<CredentialVault> = OnceLock::new();
    VAULT.get_or_init(CredentialVault::default)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BindSubtitleCredentialArgs {
    kind: String,
    api_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleCredentialRef {
    kind: String,
    credential_id: String,
}

#[tauri::command]
pub fn subtitle_credential_bind(
    args: BindSubtitleCredentialArgs,
) -> Result<SubtitleCredentialRef, String> {
    let kind = SubtitleCredentialKind::parse(&args.kind)
        .ok_or_else(|| "unsupported subtitle credential kind".to_string())?;
    let credential_id = vault().bind(kind, &args.api_key)?;
    Ok(SubtitleCredentialRef {
        kind: kind.as_str().to_string(),
        credential_id,
    })
}

#[tauri::command]
pub fn subtitle_credentials_clear() -> Result<(), String> {
    vault().clear()
}

pub fn resolve(handle: &str) -> Result<ResolvedSubtitleCredential, String> {
    vault().resolve(handle)
}

fn exact_https_origin(url: &reqwest::Url, hostname: &str) -> bool {
    url.scheme() == "https"
        && url
            .host_str()
            .is_some_and(|host| host.eq_ignore_ascii_case(hostname))
        && url.port_or_known_default() == Some(443)
        && url.username().is_empty()
        && url.password().is_none()
}

/// Apply a credential to one outbound request without exposing it to the
/// renderer. The returned URL/header must be used only for this request; the
/// redirect loop retains the credential solely while the origin is unchanged.
pub fn apply_to_request(
    url: &reqwest::Url,
    credential: &ResolvedSubtitleCredential,
) -> Result<(reqwest::Url, Option<(String, String)>), String> {
    match credential.kind {
        SubtitleCredentialKind::SubsourceApiKey => {
            if !exact_https_origin(url, "api.subsource.net") {
                return Err("subtitle credential origin is not allowed".to_string());
            }
            Ok((
                url.clone(),
                Some(("X-API-Key".to_string(), credential.secret.clone())),
            ))
        }
        SubtitleCredentialKind::SubdlApiKey => {
            if !exact_https_origin(url, "api.subdl.com") {
                return Err("subtitle credential origin is not allowed".to_string());
            }
            if url
                .query_pairs()
                .any(|(name, _)| name.eq_ignore_ascii_case("api_key"))
            {
                return Err("subtitle credential URL already contains api_key".to_string());
            }
            let mut authenticated = url.clone();
            authenticated
                .query_pairs_mut()
                .append_pair("api_key", &credential.secret);
            Ok((authenticated, None))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        apply_to_request, resolve, subtitle_credential_bind, BindSubtitleCredentialArgs,
        CredentialVault, SubtitleCredentialKind,
    };

    #[test]
    fn command_handle_resolves_from_the_process_wide_vault() {
        let bound = subtitle_credential_bind(BindSubtitleCredentialArgs {
            kind: "subsource-api-key".to_string(),
            api_key: "cross-webview-secret".to_string(),
        })
        .unwrap();
        assert_eq!(bound.kind, "subsource-api-key");
        assert!(!bound.credential_id.contains("cross-webview-secret"));
        let resolved = resolve(&bound.credential_id).unwrap();
        assert_eq!(resolved.kind, SubtitleCredentialKind::SubsourceApiKey);
        assert_eq!(resolved.secret, "cross-webview-secret");
    }

    #[test]
    fn opaque_handles_resolve_without_containing_the_secret() {
        let vault = CredentialVault::default();
        let handle = vault
            .bind(SubtitleCredentialKind::SubsourceApiKey, "secret-value")
            .unwrap();
        assert!(!handle.contains("secret-value"));
        let resolved = vault.resolve(&handle).unwrap();
        assert_eq!(resolved.kind, SubtitleCredentialKind::SubsourceApiKey);
        assert_eq!(resolved.secret, "secret-value");
    }

    #[test]
    fn reaching_capacity_does_not_evict_on_read() {
        let vault = CredentialVault::default();
        let mut handles = Vec::with_capacity(super::MAX_CREDENTIALS);
        for index in 0..super::MAX_CREDENTIALS {
            handles.push(
                vault
                    .bind(
                        SubtitleCredentialKind::SubsourceApiKey,
                        &format!("secret-{index}"),
                    )
                    .unwrap(),
            );
        }

        assert!(vault.resolve(&handles[0]).is_ok());
        vault
            .bind(SubtitleCredentialKind::SubsourceApiKey, "overflow")
            .unwrap();
        assert!(vault.resolve(&handles[0]).is_err());
        assert!(vault.resolve(&handles[1]).is_ok());
    }

    #[test]
    fn subsource_key_is_header_bound_to_its_exact_https_origin() {
        let vault = CredentialVault::default();
        let handle = vault
            .bind(SubtitleCredentialKind::SubsourceApiKey, "subsource-secret")
            .unwrap();
        let credential = vault.resolve(&handle).unwrap();
        let allowed =
            reqwest::Url::parse("https://api.subsource.net/api/v1/subtitles/1/download").unwrap();
        let (url, header) = apply_to_request(&allowed, &credential).unwrap();
        assert_eq!(url, allowed);
        assert_eq!(
            header,
            Some(("X-API-Key".to_string(), "subsource-secret".to_string()))
        );

        for denied in [
            "http://api.subsource.net/api/v1/subtitles",
            "https://api.subsource.net.evil.test/api/v1/subtitles",
            "https://api.subsource.net:444/api/v1/subtitles",
            "https://user@api.subsource.net/api/v1/subtitles",
        ] {
            let url = reqwest::Url::parse(denied).unwrap();
            assert!(apply_to_request(&url, &credential).is_err(), "{denied}");
        }
    }

    #[test]
    fn subdl_key_is_query_bound_to_its_exact_https_origin() {
        let vault = CredentialVault::default();
        let handle = vault
            .bind(SubtitleCredentialKind::SubdlApiKey, "subdl-secret")
            .unwrap();
        let credential = vault.resolve(&handle).unwrap();
        let original =
            reqwest::Url::parse("https://api.subdl.com/api/v1/subtitles?imdb_id=tt1").unwrap();
        let (authenticated, header) = apply_to_request(&original, &credential).unwrap();
        assert!(header.is_none());
        assert!(!original.as_str().contains("subdl-secret"));
        assert!(authenticated
            .query_pairs()
            .any(|(name, value)| name == "api_key" && value == "subdl-secret"));

        let download = reqwest::Url::parse("https://dl.subdl.com/subtitle.zip").unwrap();
        assert!(apply_to_request(&download, &credential).is_err());
        let duplicate =
            reqwest::Url::parse("https://api.subdl.com/api/v1/subtitles?api_key=visible").unwrap();
        assert!(apply_to_request(&duplicate, &credential).is_err());
    }
}
