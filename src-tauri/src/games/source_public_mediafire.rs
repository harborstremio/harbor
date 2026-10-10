//! Public MediaFire metadata and an explicit, fresh download-page handoff.
//! This does not submit passwords, cookies, CAPTCHAs or deferred security tokens.
use super::{PublicDownload, PublicFile, PublicFiles, Request};
use regex::Regex;
use reqwest::{header, redirect::Policy, Client, Url};
use serde_json::Value;
use std::{collections::HashMap, sync::LazyLock, time::Duration};

type Result<T> = std::result::Result<T, &'static str>;
const ROOT: &str = "https://www.mediafire.com";
const MAX_BODY: usize = 2 * 1024 * 1024;
const MAX_FILE: u64 = 16 * 1024u64.pow(4);

fn valid_key(value: &str) -> bool {
    !value.is_empty() && value.len() <= 64 && value.bytes().all(|c| c.is_ascii_alphanumeric())
}
fn safe_url(value: &str) -> Result<Url> {
    if value.len() > 8192 || value.contains('\\') || value.chars().any(char::is_control) {
        return Err("public_url");
    }
    // Check the original path before Url normalizes dot segments and backslashes.
    let without_query = value.split(['?', '#']).next().unwrap_or("");
    let raw_path = without_query
        .split_once("://")
        .and_then(|(_, rest)| rest.split_once('/'))
        .map(|(_, path)| path)
        .unwrap_or("");
    for segment in raw_path.split('/') {
        let mut decoded = Vec::with_capacity(segment.len());
        let mut bytes = segment.bytes();
        while let Some(byte) = bytes.next() {
            let byte = if byte == b'%' {
                let high = bytes
                    .next()
                    .and_then(|c| (c as char).to_digit(16))
                    .ok_or("public_url")?;
                let low = bytes
                    .next()
                    .and_then(|c| (c as char).to_digit(16))
                    .ok_or("public_url")?;
                (high * 16 + low) as u8
            } else {
                byte
            };
            if byte.is_ascii_control() || byte == b'/' || byte == b'\\' {
                return Err("public_url");
            }
            decoded.push(byte);
        }
        if decoded == b"." || decoded == b".." {
            return Err("public_url");
        }
    }
    let url = Url::parse(value).map_err(|_| "public_url")?;
    if !["http", "https"].contains(&url.scheme())
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
    {
        return Err("public_url");
    }
    Ok(url)
}
fn target(value: &str) -> Result<String> {
    let url = safe_url(value)?;
    if ![Some("mediafire.com"), Some("www.mediafire.com")].contains(&url.host_str()) {
        return Err("public_url");
    }
    let parts: Vec<_> = url.path().trim_end_matches('/').split('/').collect();
    let id = match parts.as_slice() {
        [""] | ["", ""] => url
            .query()
            .filter(|query| valid_key(query))
            .ok_or("public_url")?,
        ["", "file" | "view" | "download", id] => *id,
        ["", "file" | "view" | "download", id, name]
        | ["", "file" | "view" | "download", id, name, "file"] => {
            let lower = name.to_ascii_lowercase();
            if name.is_empty()
                || [".", ".."].contains(name)
                || lower.contains("%2f")
                || lower.contains("%5c")
            {
                return Err("public_url");
            }
            *id
        }
        _ => return Err("public_url"),
    };
    if !valid_key(id) {
        return Err("public_url");
    }
    Ok(id.into())
}
fn download_url(value: &str, id: &str) -> Result<Url> {
    let mut url = safe_url(value)?;
    let server = url
        .host_str()
        .and_then(|host| host.strip_prefix("download"))
        .and_then(|host| host.strip_suffix(".mediafire.com"))
        .ok_or("public_review")?;
    if server.is_empty()
        || server.len() > 8
        || !server.bytes().all(|c| c.is_ascii_digit())
        || url.fragment().is_some()
    {
        return Err("public_review");
    }
    let parts: Vec<_> = url.path().split('/').collect();
    if !matches!(parts.as_slice(), ["", token, key, name] if !token.is_empty() && *key == id && !name.is_empty())
    {
        return Err("public_review");
    }
    if url.path().to_ascii_lowercase().contains("%2f")
        || url.path().to_ascii_lowercase().contains("%5c")
    {
        return Err("public_review");
    }
    url.set_scheme("https").map_err(|_| "public_url")?;
    Ok(url)
}
fn failure(status: u16, code: Option<u64>) -> &'static str {
    match code {
        Some(110 | 210) => "public_missing",
        Some(165) => "public_restricted",
        Some(163 | 261) => "public_rate_limit",
        Some(114 | 130 | 186) => "public_review",
        _ => match status {
            401 | 403 => "public_review",
            404 | 410 => "public_missing",
            429 => "public_rate_limit",
            451 => "public_restricted",
            200..=399 => "public_review",
            _ => "public_network",
        },
    }
}
fn number(value: &Value) -> Option<u64> {
    value.as_u64().or_else(|| {
        value
            .as_str()
            .filter(|text| !text.is_empty() && text.bytes().all(|c| c.is_ascii_digit()))
            .and_then(|text| text.parse().ok())
    })
}
fn parse_info(value: &Value, id: &str) -> Result<PublicFile> {
    let response = &value["response"];
    if response["result"] == "Error" {
        return Err(failure(200, number(&response["error"])));
    }
    if response["result"] != "Success" || response["action"] != "file/get_info" {
        return Err("public_metadata");
    }
    let file = &response["file_info"];
    if file["quickkey"].as_str() != Some(id) {
        return Err("public_metadata");
    }
    let raw = file["filename"].as_str().ok_or("public_metadata")?;
    if raw.is_empty() || raw.len() > 1000 || raw.chars().any(char::is_control) {
        return Err("public_metadata");
    }
    let name = raw.rsplit(['/', '\\']).next().unwrap_or("").trim();
    if name.is_empty() || [".", ".."].contains(&name) {
        return Err("public_metadata");
    }
    let bytes = match file.get("size") {
        None | Some(Value::Null) => None,
        Some(value) => Some(
            number(value)
                .filter(|n| *n <= MAX_FILE)
                .ok_or("public_metadata")?,
        ),
    };
    // MediaFire documents older 32-digit MD5 values in the same `hash` field.
    let sha256 = match file.get("hash") {
        None | Some(Value::Null) => None,
        Some(Value::String(hash)) if hash.is_empty() => None,
        Some(Value::String(hash))
            if [32, 64].contains(&hash.len()) && hash.bytes().all(|c| c.is_ascii_hexdigit()) =>
        {
            (hash.len() == 64).then(|| hash.to_ascii_lowercase())
        }
        _ => return Err("public_metadata"),
    };
    let flag = match file.get("flag") {
        None | Some(Value::Null) => 0,
        Some(value) => number(value).ok_or("public_metadata")?,
    };
    let protected = file
        .get("password_protected")
        .is_some_and(|value| value != "no" && !value.is_null());
    let state = if flag & 8 != 0 {
        "restricted"
    } else if file["delete_date"]
        .as_str()
        .is_some_and(|date| !date.is_empty())
    {
        "missing"
    } else if file["privacy"] != "public"
        || file["ready"] != "yes"
        || protected
        || number(&file["permissions"]["read"]) == Some(0)
    {
        "review"
    } else {
        "available"
    };
    Ok(PublicFile {
        id: id.into(),
        name: name.into(),
        bytes,
        sha256,
        state: state.into(),
        speed_limit: None,
    })
}
fn page_download(html: &str, id: &str) -> Result<Url> {
    static INERT: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?is)<!--.*?-->|<script\b[^>]*>.*?</script\s*>|<style\b[^>]*>.*?</style\s*>")
            .unwrap()
    });
    static ANCHOR: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?is)<a\s([^>]+)>").unwrap());
    static ATTRIBUTE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"(?is)(?:^|\s)([a-z_:][a-z0-9_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')"#).unwrap()
    });
    let visible = INERT.replace_all(html, "");
    let mut result = None;
    for anchor in ANCHOR.captures_iter(&visible) {
        if anchor[1].len() > 16_384 {
            return Err("public_limit");
        }
        let mut attributes = HashMap::new();
        let mut ambiguous = false;
        for attr in ATTRIBUTE.captures_iter(&anchor[1]) {
            let key = attr[1].to_ascii_lowercase();
            let value = attr.get(2).or_else(|| attr.get(3)).unwrap().as_str();
            if attributes.insert(key.clone(), value).is_some()
                && ["id", "href"].contains(&key.as_str())
            {
                ambiguous = true;
            }
        }
        if attributes.get("id") != Some(&"downloadButton") {
            continue;
        }
        if ambiguous {
            return Err("public_metadata");
        }
        let href = attributes.get("href").ok_or("public_review")?;
        let decoded = quick_xml::escape::unescape(href).map_err(|_| "public_metadata")?;
        let url = download_url(&decoded, id)?;
        if result.as_ref().is_some_and(|previous| previous != &url) {
            return Err("public_metadata");
        }
        result = Some(url);
    }
    result.ok_or("public_review")
}
struct Api {
    client: Client,
    base: String,
}
impl Api {
    fn new() -> Result<Self> {
        Ok(Self {
            client: Client::builder()
                .timeout(Duration::from_secs(20))
                .redirect(Policy::none())
                .user_agent("Harbor/0.9 (public-file review)")
                .build()
                .map_err(|_| "public_network")?,
            base: ROOT.into(),
        })
    }
    async fn body(&self, url: &str, html: bool) -> Result<String> {
        let mut response = self
            .client
            .get(url)
            .header(
                header::ACCEPT,
                if html {
                    "text/html"
                } else {
                    "application/json"
                },
            )
            .send()
            .await
            .map_err(|_| "public_network")?;
        let status = response.status().as_u16();
        if status != 200 {
            return Err(failure(status, None));
        }
        let mime = response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if html && !mime.to_ascii_lowercase().starts_with("text/html") {
            return Err("public_review");
        }
        if response
            .content_length()
            .is_some_and(|len| len > MAX_BODY as u64)
        {
            return Err("public_limit");
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| "public_network")? {
            if bytes.len() + chunk.len() > MAX_BODY {
                return Err("public_limit");
            }
            bytes.extend_from_slice(&chunk);
        }
        String::from_utf8(bytes).map_err(|_| "public_metadata")
    }
    async fn info(&self, id: &str) -> Result<PublicFile> {
        let raw = self
            .body(
                &format!(
                    "{}/api/1.5/file/get_info.php?quick_key={id}&response_format=json",
                    self.base
                ),
                false,
            )
            .await?;
        let value = serde_json::from_str(&raw).map_err(|_| "public_review")?;
        parse_info(&value, id)
    }
    async fn review(&self, id: &str) -> Result<PublicFiles> {
        let file = self.info(id).await?;
        Ok(PublicFiles {
            title: file.name.clone(),
            selected_id: Some(file.id.clone()),
            files: vec![file],
        })
    }
    async fn prepare(&self, id: &str, selected: &str) -> Result<PublicDownload> {
        let download = self.resolve(id, selected).await?;
        self.probe(&download_url(&download.url, id)?, download.expected_bytes)
            .await?;
        Ok(download)
    }
    async fn resolve(&self, id: &str, selected: &str) -> Result<PublicDownload> {
        if selected != id {
            return Err("public_url");
        }
        let file = self.info(id).await?;
        match file.state.as_str() {
            "available" => (),
            "restricted" => return Err("public_restricted"),
            "missing" => return Err("public_missing"),
            _ => return Err("public_review"),
        }
        let html = self.body(&format!("{}/file/{id}", self.base), true).await?;
        let url = page_download(&html, id)?;
        Ok(PublicDownload {
            url: url.to_string(),
            name: file.name,
            expected_bytes: file.bytes,
            expected_sha256: file.sha256,
        })
    }
    async fn probe(&self, url: &Url, bytes: Option<u64>) -> Result<()> {
        // HEAD never reads the payload; redirects are rejected instead of fetching an arbitrary target.
        let response = self
            .client
            .head(url.clone())
            .send()
            .await
            .map_err(|_| "public_network")?;
        if response.status().as_u16() != 200 {
            return Err(failure(response.status().as_u16(), None));
        }
        let mime = response
            .headers()
            .get(header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_ascii_lowercase();
        let attachment = response
            .headers()
            .get(header::CONTENT_DISPOSITION)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| v.to_ascii_lowercase().starts_with("attachment;"));
        if !attachment && (mime.starts_with("text/html") || mime.starts_with("application/json")) {
            return Err("public_review");
        }
        let length = response
            .headers()
            .get(header::CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok());
        if bytes
            .zip(length)
            .is_some_and(|(expected, actual)| expected != actual)
        {
            return Err("public_metadata");
        }
        Ok(())
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

#[cfg(test)]
#[path = "source_public_mediafire_tests.rs"]
mod tests;
