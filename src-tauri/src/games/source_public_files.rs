//! Explicit read/review of public host metadata. No login, mirror, or CAPTCHA bypass.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashSet, time::Duration};

type Result<T> = std::result::Result<T, &'static str>;
const ROOT: &str = "https://pixeldrain.com/api";
const MAX_BYTES: usize = 16 * 1024 * 1024;
const MAX_FILES: usize = 10_000;

#[derive(Deserialize)]
pub struct Request { pub url: String, #[serde(default)] pub file: String }
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicFile {
    pub id: String, pub name: String, pub bytes: Option<u64>, pub sha256: Option<String>,
    pub state: String, pub speed_limit: Option<u64>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicFiles { pub title: String, pub files: Vec<PublicFile>, pub selected_id: Option<String> }
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicDownload { pub url: String, pub name: String, pub expected_bytes: Option<u64>, pub expected_sha256: Option<String> }
#[derive(Debug)]
struct Target { id: String, list: bool, selected: Option<usize> }
struct Api { client: reqwest::Client, base: String }

fn valid_id(value: &str) -> bool {
    !value.is_empty() && value.len() <= 64 && value.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
fn target(value: &str) -> Result<Target> {
    if value.len() > 8192 || value.chars().any(char::is_control) { return Err("public_url"); }
    let url = reqwest::Url::parse(value).map_err(|_| "public_url")?;
    if !["http", "https"].contains(&url.scheme()) || ![Some("pixeldrain.com"), Some("www.pixeldrain.com")].contains(&url.host_str())
        || !url.username().is_empty() || url.password().is_some() || url.port().is_some() { return Err("public_url"); }
    let parts: Vec<_> = url.path().trim_end_matches('/').split('/').collect();
    let (list, id) = match parts.as_slice() {
        ["", "u", id] | ["", "api", "file", id] | ["", "api", "file", id, "info"] => (false, *id),
        ["", "l", id] | ["", "api", "list", id] => (true, *id),
        _ => return Err("public_url"),
    };
    if !valid_id(id) { return Err("public_url"); }
    let selected = if list { url.fragment().and_then(|hash| hash.strip_prefix("item=")).and_then(|v| v.parse::<usize>().ok()).filter(|v| *v < MAX_FILES) } else { None };
    Ok(Target { id: id.into(), list, selected })
}
fn text(value: &Value, key: &str, max: usize) -> Result<String> {
    let raw = value[key].as_str().ok_or("public_metadata")?;
    if raw.is_empty() || raw.len() > max || raw.chars().any(char::is_control) { return Err("public_metadata"); }
    Ok(raw.to_owned())
}
fn failure(code: &str, status: u16) -> &'static str {
    match code {
        "not_found" => "public_missing",
        "virus_detected_captcha_required" | "unavailable_for_legal_reasons" => "public_restricted",
        "file_rate_limited_captcha_required" | "ip_download_limited_captcha_required" | "server_overload_captcha_required" | "hotlink_detected" | "authentication_required" | "forbidden" => "public_review",
        "ip_rate_limit_reached" | "max_concurrent_downloads" | "transfer_limit_exceeded" | "download_limit_exceeded" => "public_rate_limit",
        _ => match status { 401 | 403 => "public_review", 404 => "public_missing", 429 => "public_rate_limit", 451 => "public_restricted", _ => "public_network" },
    }
}
fn parse_file(value: &Value) -> Result<PublicFile> {
    if value["success"] != true { return Err(failure(value["value"].as_str().unwrap_or(""), 200)); }
    let id = text(value, "id", 64)?;
    if !valid_id(&id) { return Err("public_metadata"); }
    let name = text(value, "name", 1000)?;
    let name = name.rsplit(['/', '\\']).next().unwrap_or("").trim();
    if name.is_empty() || [".", ".."].contains(&name) { return Err("public_metadata"); }
    let bytes = match value.get("size") { None | Some(Value::Null) => None, Some(v) => Some(v.as_u64().filter(|n| *n <= 16 * 1024u64.pow(4)).ok_or("public_metadata")?) };
    let sha256 = match value.get("hash_sha256") {
        Some(Value::String(hash)) if hash.is_empty() => None,
        Some(Value::String(hash)) if hash.len() == 64 && hash.bytes().all(|c| c.is_ascii_hexdigit()) => Some(hash.to_ascii_lowercase()),
        None | Some(Value::Null) => None, _ => return Err("public_metadata"),
    };
    let availability = value["availability"].as_str();
    let abuse = value["abuse_type"].as_str().unwrap_or("");
    let state = if !abuse.is_empty() { "restricted" } else if let Some(code) = availability.filter(|v| !v.is_empty()) {
        match failure(code, 403) { "public_restricted" => "restricted", "public_rate_limit" => "limited", "public_missing" => "missing", _ => "review" }
    } else if value["can_download"] == true && availability == Some("") { "available" }
    else if value["can_download"] == false { "review" } else { "unknown" };
    Ok(PublicFile { id, name: name.into(), bytes, sha256, state: state.into(), speed_limit: value["download_speed_limit"].as_u64().filter(|v| *v > 0) })
}
impl Api {
    fn new() -> Result<Self> {
        let client = reqwest::Client::builder().timeout(Duration::from_secs(20)).redirect(reqwest::redirect::Policy::none())
            .user_agent("Harbor/0.9 (public-file review)").build().map_err(|_| "public_network")?;
        Ok(Self { client, base: ROOT.into() })
    }
    async fn json(&self, path: &str) -> Result<Value> {
        let mut response = self.client.get(format!("{}{path}", self.base)).header("Accept", "application/json").send().await.map_err(|_| "public_network")?;
        let status = response.status().as_u16();
        if response.content_length().is_some_and(|v| v > MAX_BYTES as u64) { return Err("public_limit"); }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| "public_network")? {
            if bytes.len() + chunk.len() > MAX_BYTES { return Err("public_limit"); } bytes.extend_from_slice(&chunk);
        }
        let value: Value = serde_json::from_slice(&bytes).map_err(|_| if status == 200 { "public_metadata" } else { failure("", status) })?;
        if status != 200 || value["success"] == false { return Err(failure(value["value"].as_str().unwrap_or(""), status)); }
        Ok(value)
    }
    async fn review(&self, target: &Target) -> Result<PublicFiles> {
        if !target.list {
            let file = self.info(&target.id).await?;
            return Ok(PublicFiles { title: file.name.clone(), selected_id: Some(file.id.clone()), files: vec![file] });
        }
        let value = self.json(&format!("/list/{}", target.id)).await?;
        if value["id"].as_str() != Some(&target.id) || value["success"] != true { return Err("public_metadata"); }
        let raw = value["files"].as_array().ok_or("public_metadata")?;
        if raw.len() > MAX_FILES { return Err("public_limit"); }
        if value["file_count"].as_u64().is_some_and(|n| n != raw.len() as u64) { return Err("public_metadata"); }
        let mut ids = HashSet::new(); let mut files = Vec::new(); let mut selected_id = None;
        for (index, entry) in raw.iter().enumerate() {
            let file = parse_file(entry)?;
            if target.selected == Some(index) { selected_id = Some(file.id.clone()); }
            if ids.insert(file.id.clone()) { files.push(file); }
        }
        if selected_id.is_none() { selected_id = files.first().map(|v| v.id.clone()); }
        Ok(PublicFiles { title: text(&value, "title", 1200)?, files, selected_id })
    }
    async fn info(&self, id: &str) -> Result<PublicFile> {
        let file = parse_file(&self.json(&format!("/file/{id}/info")).await?)?;
        if file.id != id { return Err("public_metadata"); } Ok(file)
    }
    async fn prepare(&self, target: &Target, id: &str) -> Result<PublicDownload> {
        if !valid_id(id) || !target.list && id != target.id { return Err("public_url"); }
        if target.list && !self.review(target).await?.files.iter().any(|file| file.id == id) { return Err("public_missing"); }
        self.prepare_member(id).await
    }
    async fn prepare_member(&self, id: &str) -> Result<PublicDownload> {
        let file = self.info(id).await?;
        match file.state.as_str() { "available" => (), "restricted" => return Err("public_restricted"), "limited" => return Err("public_rate_limit"), "missing" => return Err("public_missing"), _ => return Err("public_review") }
        // Explicit preparation checks the download endpoint. Drop the response without
        // buffering its body; do not fake a referrer or solve/bypass a host challenge.
        let mut response = self.client.get(format!("{}/file/{id}?download", self.base)).header("Range", "bytes=0-0").send().await.map_err(|_| "public_network")?;
        let status = response.status().as_u16();
        if status != 200 && status != 206 {
            let mut bytes = Vec::new();
            while let Ok(Some(chunk)) = response.chunk().await {
                if bytes.len() + chunk.len() > 8192 { break; } bytes.extend_from_slice(&chunk);
            }
            let value = serde_json::from_slice::<Value>(&bytes).unwrap_or(Value::Null);
            return Err(failure(value["value"].as_str().unwrap_or(""), status));
        }
        Ok(PublicDownload { url: format!("{ROOT}/file/{id}?download"), name: file.name, expected_bytes: file.bytes.filter(|v| *v > 0), expected_sha256: file.sha256 })
    }
}
#[path = "source_public_archive.rs"]
mod archive;
#[path = "source_public_mediafire.rs"]
mod mediafire;
#[path = "source_public_batch.rs"]
pub mod batch;

pub async fn review(request: Request) -> Result<PublicFiles> {
    match reqwest::Url::parse(&request.url).ok().and_then(|url| url.host_str().map(String::from)).as_deref() {
        Some("archive.org" | "www.archive.org") => archive::review(request).await,
        Some("mediafire.com" | "www.mediafire.com") => mediafire::review(request).await,
        _ => Api::new()?.review(&target(&request.url)?).await,
    }
}
pub async fn prepare(request: Request) -> Result<PublicDownload> {
    match reqwest::Url::parse(&request.url).ok().and_then(|url| url.host_str().map(String::from)).as_deref() {
        Some("archive.org" | "www.archive.org") => archive::prepare(request).await,
        Some("mediafire.com" | "www.mediafire.com") => mediafire::prepare(request).await,
        _ => Api::new()?.prepare(&target(&request.url)?, &request.file).await,
    }
}

#[cfg(test)]
#[path = "source_public_files_tests.rs"]
mod tests;
