//! Resolve an explicitly selected source link through a connected service.
use super::*;
use std::collections::HashSet;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkRequest {
    pub provider: String,
    pub key: String,
    pub url: String,
}

pub(super) fn source_link(value: &str) -> Result<String> {
    if value.len() > 16384 || value.chars().any(char::is_control) {
        return Err("cloud_link");
    }
    let parsed = reqwest::Url::parse(value).map_err(|_| "cloud_link")?;
    if !["http", "https"].contains(&parsed.scheme()) || parsed.host_str().is_none()
        || !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("cloud_link");
    }
    Ok(parsed.into())
}

fn downloads(value: Value, provider: &str) -> Result<Vec<CloudDownload>> {
    let entries = if provider == "pm" {
        value.get("content").and_then(Value::as_array).cloned().ok_or("cloud_metadata")?
    } else if value.is_array() {
        value.as_array().cloned().ok_or("cloud_metadata")?
    } else {
        vec![value]
    };
    if entries.len() > 2000 { return Err("cloud_limit"); }
    if entries.is_empty() { return Err("cloud_missing"); }
    let mut seen = HashSet::new();
    let mut files = Vec::with_capacity(entries.len());
    for entry in entries {
        let (link_field, name_field, size_field) = if provider == "pm" { ("link", "path", "size") } else { ("download", "filename", "filesize") };
        let link = url(entry[link_field].as_str().ok_or("cloud_link")?)?;
        let name = clean_name(&text(&entry, name_field, 500))?;
        if seen.insert((link.clone(), name.clone())) {
            files.push(CloudDownload { url: link, name, expected_bytes: size(&entry[size_field]) });
        }
    }
    Ok(files)
}

impl Api {
    async fn resolve_link(&self, link: &str) -> Result<Vec<CloudDownload>> {
        let link = source_link(link)?;
        let result = match self.provider.as_str() {
            "rd" => self.request("/unrestrict/link", &[], Some(&[("link", link)])).await?,
            "pm" => self.request("/transfer/directdl", &[], Some(&[("src", link)])).await?,
            // TorBox web downloads are asynchronous account jobs, not instant links.
            _ => return Err("cloud_provider"),
        };
        downloads(result, &self.provider)
    }
}

pub async fn resolve(request: LinkRequest) -> Result<Vec<CloudDownload>> {
    if !["rd", "pm"].contains(&request.provider.as_str()) { return Err("cloud_provider"); }
    let api = Api::new(&Request { provider: request.provider, key: request.key, parent: String::new(), page: 0, file: String::new() })?;
    api.resolve_link(&request.url).await
}

#[cfg(test)]
#[path = "cloud_links_tests.rs"]
mod tests;
