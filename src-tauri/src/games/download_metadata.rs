use serde::{Deserialize, Serialize};

/// Original user-selected source link for presentation only. It never grants
/// cookies, provider access or authority to make a different network request.
pub fn source_link(value: Option<String>) -> Option<String> {
    let value = value?;
    if value.is_empty() || value.len() > 8192 || value.chars().any(|c| c.is_control() || c == '\\') {
        return None;
    }
    let url = reqwest::Url::parse(&value).ok()?;
    (matches!(url.scheme(), "http" | "https") && url.host_str().is_some()
        && url.username().is_empty() && url.password().is_none()).then_some(value)
}

/// Display identity supplied by an exact catalog selection, never inferred from a filename.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DownloadGame {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub artwork: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_kind: Option<String>,
}

fn text(value: &str, limit: usize) -> Option<String> {
    (!value.trim().is_empty() && value.len() <= limit && !value.chars().any(char::is_control))
        .then(|| value.trim().to_owned())
}

fn artwork(value: Option<String>) -> Option<String> {
    let value = value?;
    if value.len() > 2048 || value.chars().any(|ch| ch.is_control() || ch.is_whitespace()) { return None; }
    let mut url = reqwest::Url::parse(&value).ok()?;
    let host = url.host_str().unwrap_or_default();
    let steam = host == "steamstatic.com" || host.ends_with(".steamstatic.com") || host == "steamcdn-a.akamaihd.net";
    let query: Vec<_> = url.query_pairs().collect();
    if steam && query.len() == 1 && query[0].0 == "t" && !query[0].1.is_empty()
        && query[0].1.len() <= 16 && query[0].1.bytes().all(|ch| ch.is_ascii_digit()) {
        // Steam's public artwork timestamp is a cache-buster, not an access credential.
        url.set_query(None);
    }
    // Display art must not persist signed links, user-info, query credentials or file URLs.
    (matches!(url.scheme(), "http" | "https") && url.host_str().is_some()
        && url.username().is_empty() && url.password().is_none()
        && url.query().is_none() && url.fragment().is_none()).then(|| url.to_string())
}

pub fn sanitize(value: Option<DownloadGame>) -> Option<DownloadGame> {
    let value = value?;
    Some(DownloadGame {
        id: text(&value.id, 256)?, name: text(&value.name, 500)?,
        artwork: artwork(value.artwork), logo: artwork(value.logo),
        source_name: value.source_name.as_deref().and_then(|name| text(name, 200)),
        content_kind: value.content_kind.filter(|kind| matches!(kind.as_str(), "game" | "patch" | "mod" | "extra")),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exact_identity_survives_but_credentials_and_unsafe_art_do_not() {
        let game = DownloadGame { id: "steam:730".into(), name: "Counter-Strike 2".into(),
            artwork: Some("https://cdn.example/730/hero.jpg".into()), logo: None, source_name: Some("Publisher".into()), content_kind: None };
        assert_eq!(sanitize(Some(game.clone())), Some(game.clone()));
        let mut steam = game.clone();
        steam.logo = Some("https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/logo.png?t=1773680448".into());
        assert_eq!(sanitize(Some(steam)).unwrap().logo.as_deref(), Some("https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/logo.png"));
        for bad in ["file:///private", "javascript:alert(1)", "https://user:secret@example.com/art.png", "https://example.com/art?token=secret", "https://example.com/art#secret", " https://example.com/a", "https://steamstatic.com.evil.test/art?t=123", "https://shared.fastly.steamstatic.com/art?t=123&token=secret"] {
            let mut next = game.clone(); next.logo = Some(bad.into());
            assert_eq!(sanitize(Some(next)).unwrap().logo, None, "{bad}");
        }
        let mut invalid = game; invalid.id = "".into();
        assert!(sanitize(Some(invalid)).is_none());
        assert!(sanitize(None).is_none());
    }

    #[test]
    fn declared_content_kind_survives_storage_without_requiring_legacy_metadata() {
        let legacy = serde_json::json!({"id":"catalog:game", "name":"Game"});
        let old: DownloadGame = serde_json::from_value(legacy.clone()).unwrap();
        assert_eq!(old.content_kind, None);
        for kind in ["game", "patch", "mod", "extra"] {
            let mut record = legacy.clone();
            record["contentKind"] = kind.into();
            let game = sanitize(Some(serde_json::from_value(record).unwrap())).unwrap();
            let stored = serde_json::to_vec(&game).unwrap();
            let reloaded: DownloadGame = serde_json::from_slice(&stored).unwrap();
            assert_eq!(reloaded.content_kind.as_deref(), Some(kind));
        }
        for unsupported in ["workshop", "dlc", "", "Mod"] {
            let mut record = legacy.clone();
            record["contentKind"] = unsupported.into();
            let game = sanitize(Some(serde_json::from_value(record).unwrap())).unwrap();
            assert_eq!(game.content_kind, None);
            assert!(serde_json::to_value(game).unwrap().get("contentKind").is_none());
        }
    }
}
