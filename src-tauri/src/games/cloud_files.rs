//! Game-file access to existing debrid libraries. Never creates, selects, deletes, or cleans up remote torrents.
#[path = "cloud_links.rs"]
mod links;
pub use links::{resolve as resolve_link, LinkRequest};
#[path = "cloud_hosts.rs"]
mod hosts;
pub use hosts::{check as host_check, HostCheck};
#[path="cloud_web_jobs.rs"]
mod web;
pub use web::{create as web_create,list as web_list,status as web_status,download as web_download,find as web_find,WebJob,WebPage};
#[path = "cloud_pm_jobs.rs"]
mod pm;
pub use pm::{create as pm_create,list as pm_list,status as pm_status,download as pm_download,retry as pm_retry,PmJob,PmPage};
#[path = "cloud_ad_links.rs"]
mod ad;
pub use ad::{prepare as ad_prepare, status as ad_status, AdPrepare, AdRequest, AdLink, AdStatus};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

type Result<T> = std::result::Result<T, &'static str>;
const LIMIT: usize = 8 * 1024 * 1024;
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudEntry {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub bytes: Option<u64>,
    pub ready: bool,
    pub status: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudPage {
    pub entries: Vec<CloudEntry>,
    pub next: Option<u32>,
    pub label: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudDownload {
    pub url: String,
    pub name: String,
    pub expected_bytes: Option<u64>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub provider: String,
    pub key: String,
    #[serde(default)]
    pub parent: String,
    #[serde(default)]
    pub page: u32,
    #[serde(default)]
    pub file: String,
}
struct Api {
    client: reqwest::Client,
    base: String,
    provider: String,
    key: String,
}
fn text(value: &Value, key: &str, limit: usize) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .chars()
        .filter(|c| !c.is_control())
        .take(limit)
        .collect()
}
fn identifier(value: &str) -> bool {
    !value.is_empty()
        && ![".", ".."].contains(&value)
        && value.len() <= 128
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_-.:".contains(&b))
}
fn record_id(value: &Value) -> Result<String> {
    let id = value
        .as_str()
        .map(String::from)
        .or_else(|| value.as_u64().map(|v| v.to_string()))
        .ok_or("cloud_metadata")?;
    if !identifier(&id) {
        return Err("cloud_metadata");
    }
    Ok(id)
}
fn size(value: &Value) -> Option<u64> {
    value
        .as_u64()
        .or_else(|| value.as_str().and_then(|v| v.parse::<u64>().ok()))
        .filter(|v| *v > 0 && *v <= 16 * 1024 * 1024 * 1024 * 1024)
}
fn url(value: &str) -> Result<String> {
    if value.len() > 16384 {
        return Err("cloud_link");
    }
    let parsed = reqwest::Url::parse(value).map_err(|_| "cloud_link")?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("cloud_link");
    }
    Ok(parsed.into())
}
impl Api {
    fn new(request: &Request) -> Result<Self> {
        Self::configured(request, false)
    }
    fn configured(request: &Request, allow_anonymous: bool) -> Result<Self> {
        if (!allow_anonymous && request.key.trim().is_empty())
            || request.key.len() > 2048
            || request.key.chars().any(char::is_control)
        {
            return Err("cloud_key");
        }
        if request.page > 100
            || (!request.parent.is_empty() && !identifier(&request.parent))
            || (!request.file.is_empty() && !identifier(&request.file))
        {
            return Err("cloud_request");
        }
        let base = match request.provider.as_str() {
            "rd" => "https://api.real-debrid.com/rest/1.0",
            "tb" => "https://api.torbox.app/v1/api",
            "pm" => "https://www.premiumize.me/api",
            "ad" => "https://api.alldebrid.com",
            _ => return Err("cloud_provider"),
        };
        let client = reqwest::Client::builder()
            .user_agent("Harbor-Games/0.9 (https://harbor.site)")
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|_| "cloud_network")?;
        Ok(Self {
            client,
            base: base.into(),
            provider: request.provider.clone(),
            key: request.key.trim().into(),
        })
    }
    async fn request(
        &self,
        path: &str,
        query: &[(&str, String)],
        form: Option<&[(&str, String)]>,
    ) -> Result<Value> {
        let mut url =
            reqwest::Url::parse(&format!("{}{path}", self.base)).map_err(|_| "cloud_request")?;
        for (k, v) in query {
            url.query_pairs_mut().append_pair(k, v);
        }
        let request = if let Some(form) = form {
            self.client.post(url).form(form)
        } else {
            self.client.get(url)
        };
        self.send(request).await
    }
    async fn send(&self, request:reqwest::RequestBuilder)->Result<Value>{
        let request = if self.key.is_empty() { request } else { request.bearer_auth(&self.key) };
        let mut response = request
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|_| "cloud_network")?;
        let status = response.status().as_u16();
        match status {
            401 | 403 if self.provider == "ad" => {},
            401 | 403 => return Err("cloud_key"),
            429 => return Err("cloud_rate_limit"),
            404 => return Err("cloud_missing"),
            200..=299 => {}
            _ => return Err("cloud_network"),
        }
        if response.content_length().is_some_and(|v| v > LIMIT as u64) {
            return Err("cloud_limit");
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| "cloud_network")? {
            if bytes.len() + chunk.len() > LIMIT {
                return Err("cloud_limit");
            }
            bytes.extend_from_slice(&chunk);
        }
        let data: Value = serde_json::from_slice(&bytes).map_err(|_| "cloud_metadata")?;
        if self.provider == "ad" {
            if [401, 403].contains(&status) && data["status"].as_str() != Some("error") { return Err("cloud_key"); }
            return ad::envelope(data);
        }
        if data["success"].as_bool() == Some(false)
            || data["status"].as_str() == Some("error")
            || data.get("error_code").is_some()
        {
            if self.provider == "pm" {
                return Err(match data["code"].as_str() {
                    Some("authentication_failed" | "permission_denied") => "cloud_key",
                    Some("not_found") => "cloud_missing",
                    Some("rate_limit_reached") => "cloud_rate_limit",
                    _ => "cloud_service",
                });
            }
            return Err("cloud_service");
        }
        Ok(data)
    }
    async fn list(&self, parent: &str, page: u32) -> Result<CloudPage> {
        if self.provider == "rd" {
            if parent.is_empty() {
                let data = self
                    .request(
                        "/torrents",
                        &[("limit", "100".into()), ("page", (page + 1).to_string())],
                        None,
                    )
                    .await?;
                return rd_list(data, page);
            }
            let data = self
                .request(&format!("/torrents/info/{parent}"), &[], None)
                .await?;
            rd_files(data)
        } else if self.provider == "tb" {
            let mut query = vec![
                ("limit", "100".into()),
                ("offset", (page * 100).to_string()),
            ];
            if !parent.is_empty() {
                if parent.parse::<u64>().is_err() {
                    return Err("cloud_request");
                }
                query.push(("id", parent.into()));
            }
            let data = self.request("/torrents/mylist", &query, None).await?;
            if parent.is_empty() {
                tb_list(&data["data"], page)
            } else {
                tb_files(&data["data"])
            }
        } else {
            let query = if parent.is_empty() {
                vec![]
            } else {
                vec![("id", parent.into())]
            };
            let data = self.request("/folder/list", &query, None).await?;
            pm_files(data)
        }
    }
    async fn resolve(&self, parent: &str, file: &str) -> Result<CloudDownload> {
        if self.provider == "rd" {
            if !identifier(parent) {
                return Err("cloud_request");
            }
            let index = file
                .strip_prefix("link:")
                .and_then(|v| v.parse::<usize>().ok())
                .ok_or("cloud_request")?;
            let data = self
                .request(&format!("/torrents/info/{parent}"), &[], None)
                .await?;
            if data["status"].as_str() != Some("downloaded") {
                return Err("cloud_not_ready");
            }
            let link = data["links"]
                .as_array()
                .and_then(|links| links.get(index))
                .and_then(Value::as_str)
                .ok_or("cloud_missing")?;
            let link = url(link)?;
            // The link is fetched from this authenticated torrent, never accepted from page content.
            let result = self
                .request("/unrestrict/link", &[], Some(&[("link", link)]))
                .await?;
            Ok(CloudDownload {
                url: url(result["download"].as_str().ok_or("cloud_link")?)?,
                name: clean_name(&text(&result, "filename", 500))?,
                expected_bytes: size(&result["filesize"]),
            })
        } else if self.provider == "tb" {
            if parent.parse::<u64>().is_err() || file.parse::<u64>().is_err() {
                return Err("cloud_request");
            }
            let info = self
                .request("/torrents/mylist", &[("id", parent.into())], None)
                .await?;
            let page = tb_files(&info["data"])?;
            let item = page
                .entries
                .iter()
                .find(|v| v.id == file)
                .ok_or("cloud_missing")?;
            if !item.ready {
                return Err("cloud_not_ready");
            }
            // TorBox requires token on this endpoint; it is sent only to its fixed HTTPS API, never logged or persisted.
            let result = self
                .request(
                    "/torrents/requestdl",
                    &[
                        ("token", self.key.clone()),
                        ("torrent_id", parent.into()),
                        ("file_id", file.into()),
                        ("zip_link", "false".into()),
                        ("redirect", "false".into()),
                    ],
                    None,
                )
                .await?;
            Ok(CloudDownload {
                url: url(result["data"].as_str().ok_or("cloud_link")?)?,
                name: clean_name(&item.name)?,
                expected_bytes: item.bytes,
            })
        } else {
            if !identifier(file) {
                return Err("cloud_request");
            }
            let result = self
                .request("/item/details", &[("id", file.into())], None)
                .await?;
            if record_id(&result["id"])? != file {
                return Err("cloud_metadata");
            }
            Ok(CloudDownload {
                url: url(result["link"].as_str().ok_or("cloud_link")?)?,
                name: clean_name(&text(&result, "name", 500))?,
                expected_bytes: size(&result["size"]),
            })
        }
    }
}
fn clean_name(name: &str) -> Result<String> {
    let name = name.rsplit(['/', '\\']).next().unwrap_or("").trim();
    if name.is_empty() {
        return Err("cloud_metadata");
    }
    Ok(name.into())
}
fn array(value: &Value) -> Result<&Vec<Value>> {
    let list = value.as_array().ok_or("cloud_metadata")?;
    if list.len() > 10000 {
        return Err("cloud_limit");
    }
    Ok(list)
}
fn state(value: &Value) -> (bool, String) {
    let ready = value["status"].as_str() == Some("downloaded");
    (
        ready,
        if ready {
            "ready"
        } else if ["error", "virus", "dead", "magnet_error"]
            .contains(&value["status"].as_str().unwrap_or(""))
        {
            "failed"
        } else {
            "preparing"
        }
        .into(),
    )
}
fn rd_list(value: Value, page: u32) -> Result<CloudPage> {
    let list = array(&value)?;
    let entries = list
        .iter()
        .map(|v| {
            let (ready, status) = state(v);
            Ok(CloudEntry {
                id: record_id(&v["id"])?,
                name: text(v, "filename", 500),
                kind: "torrent".into(),
                bytes: size(&v["bytes"]),
                ready,
                status,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(CloudPage {
        entries,
        next: (list.len() == 100 && page < 100).then_some(page + 1),
        label: String::new(),
    })
}
fn rd_files(value: Value) -> Result<CloudPage> {
    let (ready, status) = state(&value);
    if !ready {
        return Ok(CloudPage {
            entries: vec![],
            next: None,
            label: status,
        });
    }
    let links = array(&value["links"])?;
    let files = array(&value["files"])?;
    let selected: Vec<_> = files
        .iter()
        .filter(|f| f["selected"].as_u64() == Some(1))
        .collect();
    let entries = if ready {
        links
            .iter()
            .enumerate()
            .map(|(index, _)| {
                let matching = (selected.len() == links.len()).then(|| selected[index]);
                CloudEntry {
                    id: format!("link:{index}"),
                    name: matching.map(|f| text(f, "path", 1000)).unwrap_or_default(),
                    kind: "file".into(),
                    bytes: matching.and_then(|f| size(&f["bytes"])),
                    ready: true,
                    status: "ready".into(),
                }
            })
            .collect()
    } else {
        vec![]
    };
    Ok(CloudPage {
        entries,
        next: None,
        label: if ready {
            text(&value, "filename", 500)
        } else {
            status
        },
    })
}
fn tb_ready(value: &Value) -> bool {
    value["download_present"].as_bool() == Some(true)
        || value["download_finished"].as_bool() == Some(true)
}
fn tb_list(value: &Value, page: u32) -> Result<CloudPage> {
    let list = array(value)?;
    let entries = list
        .iter()
        .map(|v| {
            Ok(CloudEntry {
                id: record_id(&v["id"])?,
                name: text(v, "name", 500),
                kind: "torrent".into(),
                bytes: size(&v["size"]),
                ready: tb_ready(v),
                status: if tb_ready(v) {
                    "ready"
                } else if text(v, "download_state", 100).contains("error") {
                    "failed"
                } else {
                    "preparing"
                }
                .into(),
            })
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(CloudPage {
        entries,
        next: (list.len() == 100 && page < 100).then_some(page + 1),
        label: String::new(),
    })
}
fn tb_files(value: &Value) -> Result<CloudPage> {
    if !value.is_object() {
        return Err("cloud_missing");
    }
    let ready = tb_ready(value);
    if !ready && value["files"].is_null() {
        return Ok(CloudPage {
            entries: vec![],
            next: None,
            label: "preparing".into(),
        });
    }
    let files = array(&value["files"])?;
    let entries = files
        .iter()
        .map(|f| {
            Ok(CloudEntry {
                id: record_id(&f["id"])?,
                name: text(f, "name", 1000),
                kind: "file".into(),
                bytes: size(&f["size"]),
                ready,
                status: if ready { "ready" } else { "preparing" }.into(),
            })
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(CloudPage {
        entries,
        next: None,
        label: text(value, "name", 500),
    })
}
fn pm_files(value: Value) -> Result<CloudPage> {
    let files = array(&value["content"])?;
    let entries = files
        .iter()
        .filter(|f| ["folder", "file"].contains(&f["type"].as_str().unwrap_or("")))
        .map(|f| {
            Ok(CloudEntry {
                id: record_id(&f["id"])?,
                name: text(f, "name", 1000),
                kind: text(f, "type", 10),
                bytes: size(&f["size"]),
                ready: true,
                status: "ready".into(),
            })
        })
        .collect::<Result<Vec<_>>>()?;
    Ok(CloudPage {
        entries,
        next: None,
        label: text(&value, "name", 500),
    })
}
pub async fn list(request: Request) -> Result<CloudPage> {
    if !["rd", "tb", "pm"].contains(&request.provider.as_str()) { return Err("cloud_provider"); }
    let api = Api::new(&request)?;
    api.list(&request.parent, request.page).await
}
pub async fn resolve(request: Request) -> Result<CloudDownload> {
    if !["rd", "tb", "pm"].contains(&request.provider.as_str()) { return Err("cloud_provider"); }
    let api = Api::new(&request)?;
    api.resolve(&request.parent, &request.file).await
}

#[cfg(test)]
#[path = "cloud_files_tests.rs"]
mod tests;
