//! Hosts whose normal browser download can be handed to the HTTP queue.
use reqwest::Url;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Host {
    Gofile,
    FuckingFast,
    DataNodes,
    Fichier,
    Buzzheavier,
    VikingFile,
    Fileditch,
    MegaDb,
    FileKeeper,
    AkiraBox,
    Rootz,
    Generic,
}
impl Host {
    pub fn key(self) -> &'static str {
        match self {
            Self::Gofile => "gofile",
            Self::FuckingFast => "fuckingfast",
            Self::DataNodes => "datanodes",
            Self::Fichier => "fichier",
            Self::Buzzheavier => "buzzheavier",
            Self::VikingFile => "vikingfile",
            Self::Fileditch => "fileditch",
            Self::MegaDb => "megadb",
            Self::Rootz => "rootz",
            Self::AkiraBox => "akirabox",
            Self::FileKeeper => "filekeeper",
            Self::Generic => "generic",
        }
    }
    pub fn title(self) -> &'static str {
        match self {
            Self::Gofile => "Gofile",
            Self::FuckingFast => "FuckingFast",
            Self::DataNodes => "DataNodes",
            Self::Fichier => "1fichier",
            Self::Buzzheavier => "Buzzheavier",
            Self::VikingFile => "VikingFile",
            Self::Fileditch => "Fileditch",
            Self::MegaDb => "MegaDB",
            Self::Rootz => "Rootz",
            Self::AkiraBox => "AkiraBox",
            Self::FileKeeper => "FileKeeper",
            Self::Generic => "Website",
        }
    }
}

fn decode(value: &str) -> Result<String, &'static str> {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len() {
                return Err("public_url");
            }
            let hex =
                std::str::from_utf8(&bytes[index + 1..index + 3]).map_err(|_| "public_url")?;
            out.push(u8::from_str_radix(hex, 16).map_err(|_| "public_url")?);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(out).map_err(|_| "public_url")
}

fn url(value: &str) -> Result<Url, &'static str> {
    if value.len() > 8192 || value.chars().any(|c| c.is_control() || c == '\\') {
        return Err("public_url");
    }
    let parsed = Url::parse(value).map_err(|_| "public_url")?;
    // Providers serve files from their own nodes on alternate HTTPS ports, so a port is not what
    // makes a destination private. The public hostname rule below is what keeps this off a LAN.
    if parsed.scheme() != "https"
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("public_url");
    }
    let raw_path = value
        .split_once("://")
        .ok_or("public_url")?
        .1
        .split_once('/')
        .map(|(_, p)| p)
        .unwrap_or("");
    let decoded = decode(raw_path.split(['?', '#']).next().unwrap_or(""))?;
    if decoded.chars().any(|c| c.is_control() || c == '\\')
        || decoded.split('/').any(|part| part == "." || part == "..")
    {
        return Err("public_url");
    }
    Ok(parsed)
}

pub fn page(value: &str) -> Result<Url, &'static str> {
    let mut parsed = url(value)?;
    let domain = parsed.host_str().unwrap_or("");
    let route = parsed.path();
    let valid = match domain {
        "vikingfile.com" | "www.vikingfile.com" | "vik1ngfile.site" | "www.vik1ngfile.site" => Some({
            let parts: Vec<_> = route.trim_end_matches('/').split('/').collect();
            matches!(parts.as_slice(), ["", "f", id] | ["", "f", id, _] if id.len() == 10 && id.bytes().all(|b| b.is_ascii_alphanumeric()))
                && !route.to_ascii_lowercase().contains("%2f")
                && parsed.query().is_none()
        }),
        "fileditchfiles.st" | "fileditchfiles.me" => Some(fileditch_path(route) && parsed.query().is_none()),
        "akirabox.com" | "www.akirabox.com" => Some({
            let parts: Vec<_> = route.trim_end_matches('/').split('/').collect();
            matches!(parts.as_slice(), ["", id, "file"] if (8..=32).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_alphanumeric())) && parsed.query().is_none()
        }),
        "rootz.so" | "www.rootz.so" => Some({
            (route.trim_end_matches('/').strip_prefix("/download/").is_some_and(|id| id.len() == 36 && uuid::Uuid::parse_str(id).is_ok()) || route.trim_end_matches('/').strip_prefix("/d/").is_some_and(|id| (4..=64).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b)))) && parsed.query().is_none()
        }),
        "filekeeper.net" | "www.filekeeper.net" | "megadb.net" | "www.megadb.net" => Some({
            let parts: Vec<_> = route.trim_end_matches('/').split('/').collect();
            let valid = match parts.as_slice() {
                ["", id] => lower_id(id.strip_suffix(".html").unwrap_or(id), 12, 12),
                ["", id, name] => lower_id(id, 12, 12) && !name.is_empty(),
                _ => false,
            };
            valid && !route.to_ascii_lowercase().contains("%2f") && parsed.query().is_none()
        }),
        "datanodes.to" | "www.datanodes.to" => Some({
            let parts: Vec<_> = route.trim_end_matches('/').split('/').collect();
            matches!(parts.as_slice(), ["", id] | ["", id, _] if lower_id(id, 12, 12))
                && !route.to_ascii_lowercase().contains("%2f")
                && parsed.query().is_none()
        }),
        "1fichier.com" | "www.1fichier.com" => Some({
            let query = parsed.query().unwrap_or("");
            let mut parts = query.split('&');
            route == "/"
                && lower_id(parts.next().unwrap_or(""), 5, 20)
                && parts.next().is_none_or(|v| {
                    v.strip_prefix("af=").is_some_and(|v| {
                        !v.is_empty() && v.len() <= 20 && v.bytes().all(|b| b.is_ascii_digit())
                    })
                })
                && parts.next().is_none()
        }),
        "buzzheavier.com"
        | "www.buzzheavier.com"
        | "dd.buzzheavier.com"
        | "bzzhr.co"
        | "bzzhr.to" => Some({
            let route = route.trim_end_matches('/');
            let valid = route.strip_prefix("/f/").is_some_and(|id| {
                let token = id.trim_end_matches('=');
                (8..=64).contains(&token.len())
                    && id.len() - token.len() <= 2
                    && token
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
            }) || route
                .strip_prefix('/')
                .is_some_and(|id| lower_id(id, 12, 12));
            valid && parsed.query().is_none()
        }),
        _ => None,
    };
    if let Some(valid) = valid {
        return if valid && !route.ends_with("//") && parsed.fragment().is_none() {
            Ok(parsed)
        } else {
            Err("public_url")
        };
    }
    if parsed.host_str() == Some("fuckingfast.co") {
        let id = parsed.path().trim_matches('/');
        if parsed.query().is_some()
            || id.len() != 12
            || !id
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
            || parsed.path() != format!("/{id}")
        {
            return Err("public_url");
        }
        if let Some(hint) = parsed.fragment() {
            let hint = decode(hint)?;
            if hint.len() > 1000
                || hint
                    .chars()
                    .any(|c| c.is_control() || c == '/' || c == '\\')
            {
                return Err("public_url");
            }
        }
        // Catalog filename fragments are display hints, never file identity or credentials.
        parsed.set_fragment(None);
        return Ok(parsed);
    }
    let parts: Vec<_> = parsed.path().trim_end_matches('/').split('/').collect();
    if !matches!(parsed.host_str(), Some("gofile.io" | "www.gofile.io")) {
        if !public_host(&parsed) {
            return Err("public_url");
        }
        parsed.set_fragment(None);
        return Ok(parsed);
    }
    if parsed.query().is_some() || parsed.fragment().is_some() {
        return Err("public_url");
    }
    match parts.as_slice() {
        ["", "d", id]
            if (id.len() == 6 || id.len() == 8)
                && id.bytes().all(|b| b.is_ascii_alphanumeric()) =>
        {
            Ok(parsed)
        }
        ["", "d", id] if uuid::Uuid::parse_str(id).is_ok() => Ok(parsed),
        _ => Err("public_url"),
    }
}

/// A destination captured by the native browser, not a renderer-supplied download.
fn public_host(parsed: &Url) -> bool {
    let Some(domain) = parsed.host_str() else {
        return false;
    };
    !domain.parse::<std::net::IpAddr>().is_ok()
        && !domain.starts_with('[')
        && domain.contains('.')
        && !["localhost", "local", "internal", "lan", "home", "arpa"]
            .iter()
            .any(|suffix| domain == *suffix || domain.ends_with(&format!(".{suffix}")))
}

pub fn browser_file(value: &str) -> Result<Url, &'static str> {
    let parsed = url(value)?;
    if parsed.fragment().is_some() || !public_host(&parsed) {
        return Err("public_url");
    }
    Ok(parsed)
}

pub fn browser_pair(page_url: &str, file_url: &str) -> Result<Host, &'static str> {
    let provider = host(page_url)?;
    browser_file(file_url)?;
    Ok(provider)
}

pub fn host(value: &str) -> Result<Host, &'static str> {
    Ok(match page(value)?.host_str().unwrap_or("") {
        "vikingfile.com" | "www.vikingfile.com" | "vik1ngfile.site" | "www.vik1ngfile.site" => Host::VikingFile,
        "fileditchfiles.st" | "fileditchfiles.me" => Host::Fileditch,
        "filekeeper.net" | "www.filekeeper.net" => Host::FileKeeper,
        "akirabox.com" | "www.akirabox.com" => Host::AkiraBox,
        "rootz.so" | "www.rootz.so" => Host::Rootz,
        "megadb.net" | "www.megadb.net" => Host::MegaDb,
        "fuckingfast.co" => Host::FuckingFast,
        "datanodes.to" | "www.datanodes.to" => Host::DataNodes,
        "1fichier.com" | "www.1fichier.com" => Host::Fichier,
        "buzzheavier.com"
        | "www.buzzheavier.com"
        | "dd.buzzheavier.com"
        | "bzzhr.co"
        | "bzzhr.to" => Host::Buzzheavier,
        "gofile.io" | "www.gofile.io" => Host::Gofile,
        _ => Host::Generic,
    })
}

fn fileditch_path(route: &str) -> bool {
    let parts: Vec<_> = route.split('/').collect();
    matches!(parts.as_slice(), ["", server, id, name] if
        server.find(|c: char| c.is_ascii_digit()).is_some_and(|i| i > 0 && server[..i].bytes().all(|b| b.is_ascii_lowercase()) && server[i..].bytes().all(|b| b.is_ascii_digit())) &&
        id.len() == 20 && id.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) && !name.is_empty())
        && !route.to_ascii_lowercase().contains("%2f")
}

fn lower_id(id: &str, min: usize, max: usize) -> bool {
    (min..=max).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
}

pub fn cookie_header(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 16384
        && value.split("; ").all(|part| {
            part.split_once('=').is_some_and(|(name, value)| {
                !name.is_empty()
                    && name
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b"!#$%&'*+-.^_`|~".contains(&b))
                    && value
                        .bytes()
                        .all(|b| (0x21..=0x7e).contains(&b) && !b"\";,\\".contains(&b))
            })
        })
}

pub fn cookie(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 4096
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
}

#[cfg(test)]
mod tests {
    use super::*;

    const GOFILE: &str = "https://store-eu-par-1.gofile.io/download/web/8b9c0d1e-2f3a-4b4c-ad5e-6f7a8b9c0d1e/a%20file.zip";

    #[test]
    fn provider_pages_are_recognised_by_their_own_routes() {
        assert!(page("https://gofile.io/d/a1B2c3").is_ok());
        assert!(page("https://www.gofile.io/d/a1B2c3D4/").is_ok());
        assert_eq!(host("https://filekeeper.net/abc123def456").unwrap(), Host::FileKeeper);
        assert_eq!(host("https://vikingfile.com/f/PPOab9zWW1").unwrap(), Host::VikingFile);
        assert_eq!(host("https://datanodes.to/rsl50kl0ywnu").unwrap(), Host::DataNodes);
        for bad in ["http://gofile.io/d/a1B2c3", "https://gofile.io", "https://gofile.io/d/"] {
            assert!(page(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn storage_hosts_are_accepted_without_a_provider_rule() {
        // Providers rotate storage names, so a signed file is judged on being public, not on a list.
        for good in [
            GOFILE,
            "https://west-eu-upload.04b3d96d52475741e6b10f97f0a84a16.r2.cloudflarestorage.com/example/archive.zip?signature=fixture",
            "https://charming-glaser.s3.bhs.io.cloud.ovh.net/example/archive.zip?signature=fixture",
            "https://tunnel42.dlproxy.uk/example/archive.rar",
            "https://node43.datanodes.to:8443/d/abcdef/Mafia%20II.rar",
            "https://cdn7.some-new-mirror.example/example/archive.rar",
        ] {
            assert!(browser_file(good).is_ok(), "{good}");
        }
    }

    #[test]
    fn private_and_malformed_destinations_stay_rejected() {
        for bad in [
            "http://example.com/a.zip",
            "https://user:pass@example.com/a.zip",
            "https://127.0.0.1/a.zip",
            "https://[::1]/a.zip",
            "https://192.168.1.10/a.zip",
            "https://localhost/a.zip",
            "https://router.lan/a.zip",
            "https://files.internal/a.zip",
            "https://nas.home/a.zip",
            "https://host/a.zip",
            "https://example.com/a.zip#fragment",
        ] {
            assert!(browser_file(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn a_receipt_needs_a_known_page_and_a_public_file() {
        assert_eq!(
            browser_pair("https://filekeeper.net/abc123def456", "https://tunnel42.dlproxy.uk/a.rar").unwrap(),
            Host::FileKeeper
        );
        assert!(browser_pair("https://filekeeper.net/abc123def456", "https://127.0.0.1/a.rar").is_err());
        assert!(browser_pair("http://filekeeper.net/abc123def456", GOFILE).is_err());
    }

    #[test]
    fn native_cookie_headers_are_bounded_and_cannot_inject_headers() {
        assert!(cookie_header("session=token; __cf_bm=token._-; empty="));
        for bad in [
            "",
            "=token",
            "cookie=x\r\nHost: evil",
            "cookie=x;evil=1",
            "cookie=x,y",
            "cookie=\"x\"",
            "cookie=x y",
        ] {
            assert!(!cookie_header(bad));
        }
        assert!(!cookie_header(&format!("cookie={}", "x".repeat(16384))));
    }
}
