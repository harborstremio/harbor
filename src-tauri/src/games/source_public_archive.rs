//! Internet Archive's public metadata and canonical download routes.
use super::{
    failure, PublicDownload, PublicFile, PublicFiles, Request, Result, MAX_BYTES, MAX_FILES,
};
use reqwest::{Client, Url};
use serde_json::Value;
use std::{collections::HashSet, time::Duration};

const ROOT: &str = "https://archive.org";
#[derive(Debug)]
struct Target {
    item: String,
    file: Option<String>,
}
struct Api {
    client: Client,
    base: String,
}

fn identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 100
        && value.as_bytes()[0].is_ascii_alphanumeric()
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"_.-".contains(&c))
}
fn path(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 2048
        && !value.chars().any(char::is_control)
        && !value.contains('\\')
        && value.split('/').count() <= 32
        && value
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}
fn decode(value: &str) -> Result<String> {
    let mut bytes = Vec::with_capacity(value.len());
    let mut input = value.bytes();
    while let Some(byte) = input.next() {
        bytes.push(if byte == b'%' {
            let high = input
                .next()
                .and_then(|c| (c as char).to_digit(16))
                .ok_or("public_url")?;
            let low = input
                .next()
                .and_then(|c| (c as char).to_digit(16))
                .ok_or("public_url")?;
            (high * 16 + low) as u8
        } else {
            byte
        });
    }
    String::from_utf8(bytes).map_err(|_| "public_url")
}
fn target(value: &str) -> Result<Target> {
    if value.len() > 8192 || value.contains('\\') || value.chars().any(char::is_control) {
        return Err("public_url");
    }
    // Check the raw path before URL parsing normalizes dot segments away.
    let raw = value.split_once("://").ok_or("public_url")?.1;
    let raw = raw
        .split_once('/')
        .map(|(_, p)| p)
        .unwrap_or("")
        .split(['?', '#'])
        .next()
        .unwrap_or("");
    let decoded = decode(raw)?;
    if decoded.split('/').any(|p| p == "." || p == "..") {
        return Err("public_url");
    }
    let url = Url::parse(value).map_err(|_| "public_url")?;
    if !["http", "https"].contains(&url.scheme())
        || ![Some("archive.org"), Some("www.archive.org")].contains(&url.host_str())
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
    {
        return Err("public_url");
    }
    let route = decode(url.path())?;
    let mut parts = route.strip_prefix('/').ok_or("public_url")?.splitn(3, '/');
    let kind = parts.next().unwrap_or("");
    let item = parts.next().unwrap_or("");
    let file = parts.next().filter(|v| !v.is_empty());
    if !identifier(item)
        || !["details", "download", "metadata"].contains(&kind)
        || kind != "download" && file.is_some()
        || file.is_some_and(|v| !path(v))
    {
        return Err("public_url");
    }
    Ok(Target {
        item: item.into(),
        file: file.map(String::from),
    })
}
fn flagged(value: &Value) -> bool {
    value == true
        || value == 1
        || value
            .as_str()
            .is_some_and(|v| v.eq_ignore_ascii_case("true") || v == "1")
}
fn parse(value: &Value, target: &Target) -> Result<PublicFiles> {
    if value.as_object().is_some_and(|v| v.is_empty())
        || value.as_array().is_some_and(|v| v.is_empty())
    {
        return Err("public_missing");
    }
    if value.get("error").is_some() {
        return Err(if value["errcode"] == 104 {
            "public_missing"
        } else {
            "public_network"
        });
    }
    if flagged(&value["is_dark"]) {
        return Err("public_restricted");
    }
    if value["metadata"]["identifier"].as_str() != Some(&target.item) {
        return Err("public_metadata");
    }
    let raw = value["files"].as_array().ok_or("public_metadata")?;
    if raw.len() > MAX_FILES {
        return Err("public_limit");
    }
    if value["files_count"]
        .as_u64()
        .is_some_and(|n| n != raw.len() as u64)
    {
        return Err("public_metadata");
    }
    let restricted = flagged(&value["metadata"]["access-restricted-item"]);
    let mut files = Vec::new();
    let mut ids = HashSet::new();
    for entry in raw {
        let name = entry["name"]
            .as_str()
            .filter(|v| path(v))
            .ok_or("public_metadata")?;
        if !ids.insert(name) {
            return Err("public_metadata");
        }
        if target
            .file
            .as_deref()
            .is_some_and(|selected| selected != name)
        {
            continue;
        }
        let bytes = match entry.get("size") {
            None | Some(Value::Null) => None,
            Some(v) => Some(
                v.as_u64()
                    .or_else(|| v.as_str()?.parse().ok())
                    .filter(|n| *n <= 16 * 1024u64.pow(4))
                    .ok_or("public_metadata")?,
            ),
        };
        let state = if restricted || flagged(&entry["private"]) {
            "review"
        } else {
            "unknown"
        };
        files.push(PublicFile {
            id: name.into(),
            name: name.into(),
            bytes,
            sha256: None,
            state: state.into(),
            speed_limit: None,
        });
    }
    if target.file.is_some() && files.is_empty() {
        return Err("public_missing");
    }
    let title = value["metadata"]["title"]
        .as_str()
        .filter(|v| !v.is_empty() && v.len() <= 1200 && !v.chars().any(char::is_control))
        .unwrap_or(&target.item);
    Ok(PublicFiles {
        title: title.into(),
        selected_id: files.first().map(|f| f.id.clone()),
        files,
    })
}
fn download_url(item: &str, file: &str) -> Url {
    let mut url = Url::parse(ROOT).expect("fixed root");
    url.path_segments_mut()
        .unwrap()
        .extend(["download", item])
        .extend(file.split('/'));
    url
}
fn redirect_allowed(url: &Url, target: &Target, file: &str) -> bool {
    if url.scheme() != "https"
        || url.port().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return false;
    }
    let host = url.host_str().unwrap_or("");
    let Ok(decoded) = decode(url.path()) else {
        return false;
    };
    if ["archive.org", "www.archive.org"].contains(&host) {
        return decoded == format!("/download/{}/{file}", target.item);
    }
    let node = host.split('.').next().unwrap_or("");
    let numbered = node
        .strip_prefix("ia")
        .or_else(|| node.strip_prefix("dn"))
        .is_some_and(|v| !v.is_empty() && v.bytes().all(|c| c.is_ascii_digit()));
    numbered
        && [".us.archive.org", ".eu.archive.org", ".ca.archive.org"]
            .iter()
            .any(|suffix| host.ends_with(suffix))
        && decoded.split_once("/items/").is_some_and(|(prefix, rest)| {
            prefix
                .trim_start_matches('/')
                .bytes()
                .all(|c| c.is_ascii_digit())
                && rest == format!("{}/{file}", target.item)
        })
}
impl Api {
    fn new() -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::none())
            .user_agent("Harbor/0.9 (public-file review)")
            .build()
            .map_err(|_| "public_network")?;
        Ok(Self {
            client,
            base: ROOT.into(),
        })
    }
    async fn review(&self, target: &Target) -> Result<PublicFiles> {
        let mut response = self
            .client
            .get(format!(
                "{}/metadata/{}?extended_err=1",
                self.base, target.item
            ))
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|_| "public_network")?;
        let status = response.status().as_u16();
        if status != 200 {
            return Err(failure("", status));
        }
        if response
            .content_length()
            .is_some_and(|n| n > MAX_BYTES as u64)
        {
            return Err("public_limit");
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| "public_network")? {
            if bytes.len() + chunk.len() > MAX_BYTES {
                return Err("public_limit");
            }
            bytes.extend_from_slice(&chunk);
        }
        parse(
            &serde_json::from_slice(&bytes).map_err(|_| "public_metadata")?,
            target,
        )
    }
    async fn prepare(&self, target: &Target, selected: &str) -> Result<PublicDownload> {
        if !path(selected) || target.file.as_deref().is_some_and(|v| v != selected) {
            return Err("public_url");
        }
        let file = self
            .review(target)
            .await?
            .files
            .into_iter()
            .find(|f| f.id == selected)
            .ok_or("public_missing")?;
        self.prepare_member(target, &file).await
    }
    async fn prepare_member(&self, target: &Target, file: &PublicFile) -> Result<PublicDownload> {
        let selected = &file.id;
        if file.state == "review" {
            return Err("public_review");
        }
        let canonical = download_url(&target.item, selected);
        let mut endpoint = if self.base == ROOT {
            canonical.clone()
        } else {
            Url::parse(&format!("{}{}", self.base, canonical.path())).map_err(|_| "public_url")?
        };
        for _ in 0..5 {
            // Only inspect response headers. Range limits a compliant server to one byte.
            let response = self
                .client
                .get(endpoint.clone())
                .header("Range", "bytes=0-0")
                .send()
                .await
                .map_err(|_| "public_network")?;
            let status = response.status().as_u16();
            if [301, 302, 303, 307, 308].contains(&status) {
                let location = response
                    .headers()
                    .get("location")
                    .and_then(|v| v.to_str().ok())
                    .ok_or("public_review")?;
                let next = endpoint.join(location).map_err(|_| "public_review")?;
                if !redirect_allowed(&next, target, selected) {
                    return Err("public_review");
                }
                endpoint = next;
                continue;
            }
            if status != 200 && status != 206 {
                return Err(failure("", status));
            }
            let content_type = response
                .headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_ascii_lowercase();
            if content_type.contains("text/html") || content_type.contains("application/json") {
                return Err("public_review");
            }
            return Ok(PublicDownload {
                url: canonical.into(),
                name: selected.rsplit('/').next().unwrap_or(selected).into(),
                expected_bytes: file.bytes.filter(|n| *n > 0),
                expected_sha256: None,
            });
        }
        Err("public_review")
    }
    async fn prepare_batch(&self, target: &Target, ids: &[String]) -> super::batch::BatchResult {
        let members = super::batch::members(self.review(target).await?, ids)?;
        super::batch::collect(&members, |file| self.prepare_member(target, file)).await
    }
}
pub(super) async fn review(request: Request) -> Result<PublicFiles> {
    Api::new()?.review(&target(&request.url)?).await
}
pub(super) async fn prepare(request: Request) -> Result<PublicDownload> {
    Api::new()?
        .prepare(&target(&request.url)?, &request.file)
        .await
}

pub(super) async fn prepare_batch(request: &super::batch::Request) -> super::batch::BatchResult {
    let api = Api::new()?;
    let target = target(&request.url)?;
    api.prepare_batch(&target, &request.files).await
}

#[cfg(test)]
#[path = "source_public_archive_tests.rs"]
mod tests;
