use super::worker::{ConnectorManifest, ConnectorPermissions, ConnectorWorkerRequest};
use std::collections::BTreeMap;
use std::path::{Component, Path, PathBuf};

pub(super) fn resolve_entry(package_dir: &Path, entry: &str) -> Result<PathBuf, String> {
    let relative = Path::new(entry);
    if entry.is_empty()
        || relative.extension().and_then(|value| value.to_str()) != Some("json")
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err("Connector entry must be a relative JSON file".to_string());
    }
    let root = package_dir
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let entry = package_dir
        .join(relative)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !entry.starts_with(&root) {
        return Err("Connector entry escapes its package".to_string());
    }
    Ok(entry)
}

pub(super) fn validate_manifest(manifest: &ConnectorManifest) -> Result<(), String> {
    validate_id(&manifest.id)?;
    if manifest.name.trim().is_empty()
        || manifest.name.chars().count() > 100
        || manifest.version.trim().is_empty()
        || manifest.version.len() > 64
        || manifest.permissions.domains.is_empty()
        || manifest.permissions.domains.len() > 32
    {
        return Err("Connector manifest metadata is invalid".to_string());
    }
    for domain in &manifest.permissions.domains {
        validate_domain_permission(domain)?;
    }
    Ok(())
}

pub(super) fn validate_request(request: &ConnectorWorkerRequest) -> Result<(), String> {
    validate_id(&request.operation)?;
    let encoded_size = request
        .params
        .iter()
        .map(|(key, value)| key.len().saturating_add(value.len()))
        .sum::<usize>();
    if request.params.len() > 64
        || encoded_size > 240 * 1024
        || request
            .params
            .iter()
            .any(|(key, value)| key.len() > 100 || value.len() > 16 * 1024)
    {
        return Err("Connector request parameters are too large".to_string());
    }
    Ok(())
}

pub(super) fn validate_url(
    url: &url::Url,
    permissions: &ConnectorPermissions,
) -> Result<(), String> {
    if url.scheme() != "https" && !(permissions.allow_insecure_http && url.scheme() == "http") {
        return Err("Connector URL scheme is not permitted".to_string());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Connector URLs cannot contain credentials".to_string());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "Connector URL has no host".to_string())?
        .to_ascii_lowercase();
    if forbidden_host(&host)
        || !permissions
            .domains
            .iter()
            .any(|permission| domain_matches(&host, permission))
    {
        return Err(format!("Connector is not permitted to access {host}"));
    }
    Ok(())
}

fn validate_domain_permission(domain: &str) -> Result<(), String> {
    let host = domain.strip_prefix("*.").unwrap_or(domain);
    if host.is_empty()
        || forbidden_host(host)
        || !host.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '.'
        })
    {
        return Err("Connector domain permission is invalid".to_string());
    }
    Ok(())
}

fn domain_matches(host: &str, permission: &str) -> bool {
    let permission = permission.to_ascii_lowercase();
    if let Some(suffix) = permission.strip_prefix("*.") {
        host != suffix && host.ends_with(&format!(".{suffix}"))
    } else {
        host == permission
    }
}

fn forbidden_host(host: &str) -> bool {
    if host == "localhost" || host.ends_with(".localhost") || host.ends_with(".local") {
        return true;
    }
    host.parse::<std::net::IpAddr>()
        .is_ok_and(|address| match address {
            std::net::IpAddr::V4(address) => {
                address.is_private()
                    || address.is_loopback()
                    || address.is_link_local()
                    || address.is_unspecified()
            }
            std::net::IpAddr::V6(address) => {
                let octets = address.octets();
                address.is_loopback()
                    || address.is_unspecified()
                    || octets[0] & 0xfe == 0xfc
                    || (octets[0] == 0xfe && octets[1] & 0xc0 == 0x80)
            }
        })
}

pub(super) fn validate_id(value: &str) -> Result<(), String> {
    if value.is_empty()
        || value.len() > 64
        || !value.chars().all(|character| {
            character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || character == '-'
                || character == '_'
        })
    {
        return Err("Connector identifier is invalid".to_string());
    }
    Ok(())
}

pub(super) fn validate_header_name(name: &str) -> Result<(), String> {
    let lower = name.to_ascii_lowercase();
    if [
        "connection",
        "content-length",
        "host",
        "proxy-authorization",
        "transfer-encoding",
    ]
    .contains(&lower.as_str())
    {
        return Err(format!("Connector header is not permitted: {name}"));
    }
    reqwest::header::HeaderName::from_bytes(name.as_bytes())
        .map(|_| ())
        .map_err(|_| "Connector header name is invalid".to_string())
}

pub(super) fn render_template(
    template: &str,
    params: &BTreeMap<String, String>,
    encode: bool,
) -> Result<String, String> {
    let mut rendered = String::new();
    let mut remaining = template;
    while let Some(open) = remaining.find('{') {
        rendered.push_str(&remaining[..open]);
        let after = &remaining[open + 1..];
        let close = after
            .find('}')
            .ok_or_else(|| "Connector template has an unmatched brace".to_string())?;
        let key = &after[..close];
        let value = params
            .get(key)
            .ok_or_else(|| format!("Connector request is missing parameter {key}"))?;
        if encode {
            rendered.extend(url::form_urlencoded::byte_serialize(value.as_bytes()));
        } else {
            rendered.push_str(value);
        }
        remaining = &after[close + 1..];
    }
    if remaining.contains('}') {
        return Err("Connector template has an unmatched brace".to_string());
    }
    rendered.push_str(remaining);
    Ok(rendered)
}

pub(super) fn read_json_limited<T: serde::de::DeserializeOwned>(
    path: &Path,
    limit: u64,
) -> Result<T, String> {
    let metadata = std::fs::metadata(path).map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.len() > limit {
        return Err("Connector package file is invalid or too large".to_string());
    }
    let content = std::fs::read(path).map_err(|error| error.to_string())?;
    serde_json::from_slice(&content).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn template_values_are_url_encoded() {
        let params = BTreeMap::from([("query".to_string(), "a/b & c".to_string())]);
        assert_eq!(
            render_template("https://api.example/search?q={query}", &params, true)
                .expect("render template"),
            "https://api.example/search?q=a%2Fb+%26+c"
        );
    }

    #[test]
    fn domain_permissions_do_not_escape_to_parent_or_private_hosts() {
        assert!(domain_matches("api.example.com", "*.example.com"));
        assert!(!domain_matches("example.com", "*.example.com"));
        assert!(!domain_matches("example.com.evil.test", "*.example.com"));
        assert!(forbidden_host("127.0.0.1"));
        assert!(forbidden_host("localhost"));
    }

    #[test]
    fn manifest_rejects_entry_traversal() {
        assert!(resolve_entry(Path::new("."), "../connector.json").is_err());
    }
}
