//! AllDebrid file links. Preparation is explicit; status checks never resubmit a link.
use super::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdPrepare {
    pub key: String,
    pub url: String,
    #[serde(default)]
    pub password: String,
}
#[derive(Deserialize)]
pub struct AdRequest { pub key: String, pub id: String }
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdLink {
    pub name: String,
    pub expected_bytes: Option<u64>,
    pub delayed_id: Option<String>,
    pub url: Option<String>,
}
#[derive(Debug, Serialize)]
pub struct AdStatus {
    pub status: String,
    pub url: Option<String>,
    pub seconds: Option<u64>,
}

pub(super) fn envelope(value: Value) -> Result<Value> {
    match value["status"].as_str() {
        Some("success") if value["data"].is_object() => Ok(value["data"].clone()),
        Some("error") => Err(match value["error"]["code"].as_str().unwrap_or("") {
            "AUTH_BLOCKED" => "cloud_auth_blocked",
            "AUTH_MISSING_APIKEY" | "AUTH_BAD_APIKEY" | "AUTH_USER_BANNED" | "MUST_BE_PREMIUM" => "cloud_key",
            "LINK_PASS_PROTECTED" => "cloud_password",
            "LINK_HOST_NOT_SUPPORTED" | "LINK_NOT_SUPPORTED" => "cloud_unsupported",
            "LINK_DOWN" | "DELAYED_INVALID_ID" => "cloud_missing",
            "LINK_HOST_LIMIT_REACHED" | "FREE_TRIAL_LIMIT_REACHED" => "cloud_quota",
            "LINK_TOO_MANY_DOWNLOADS" | "LINK_HOST_FULL" => "cloud_rate_limit",
            "LINK_IS_MISSING" | "BAD_LINK" => "cloud_link",
            _ => "cloud_service",
        }),
        _ => Err("cloud_metadata"),
    }
}
fn delayed_id(value: &str) -> Result<String> {
    if value.len() > 16 || !value.bytes().all(|v| v.is_ascii_digit()) { return Err("cloud_request"); }
    let id = value.parse::<u64>().map_err(|_| "cloud_request")?;
    if id == 0 || id > 9_007_199_254_740_991 { return Err("cloud_request"); }
    Ok(id.to_string())
}
fn prepared(value: Value) -> Result<AdLink> {
    // A media-quality picker or a container is not a downloadable game archive.
    let raw_name = value["filename"].as_str().ok_or("cloud_metadata")?;
    if raw_name.len() > 1000 || raw_name.chars().any(char::is_control) { return Err("cloud_metadata"); }
    let name = clean_name(raw_name)?;
    if name == "." || name == ".." { return Err("cloud_metadata"); }
    let expected_bytes = size(&value["filesize"]);
    if let Some(id) = value.get("delayed").filter(|id| !id.is_null()) {
        let id = delayed_id(&record_id(id)?).map_err(|_| "cloud_metadata")?;
        return Ok(AdLink { name, expected_bytes, delayed_id: Some(id), url: None });
    }
    let link = value["link"].as_str().filter(|v| !v.is_empty()).ok_or("cloud_metadata")?;
    // Official download servers may return HTTP. Keep their supplied transport;
    // no credentials are appended and Harbor's transfer engine validates it again.
    let link = download_url(link)?;
    Ok(AdLink { name, expected_bytes, delayed_id: None, url: Some(link) })
}
fn download_url(link: &str) -> Result<String> {
    if link.len() > 8192 { return Err("cloud_link"); }
    links::source_link(link)
}
fn delayed(value: Value) -> Result<AdStatus> {
    let seconds = value["time_left"].as_u64().filter(|v| *v <= 7 * 24 * 60 * 60);
    match value["status"].as_u64() {
        Some(1) => Ok(AdStatus { status: "preparing".into(), url: None, seconds }),
        Some(2) => Ok(AdStatus { status: "ready".into(), url: Some(download_url(value["link"].as_str().ok_or("cloud_metadata")?)?), seconds: None }),
        Some(3) => Ok(AdStatus { status: "failed".into(), url: None, seconds: None }),
        _ => Err("cloud_metadata"),
    }
}
fn api(key: String) -> Result<Api> {
    Api::new(&Request { provider: "ad".into(), key, parent: String::new(), file: String::new(), page: 0 })
}
impl Api {
    async fn ad_prepare(&self, link: &str, password: &str) -> Result<AdLink> {
        let link = links::source_link(link)?;
        if password.len() > 1024 || password.chars().any(char::is_control) { return Err("cloud_password"); }
        let mut form = vec![("link", link)];
        if !password.is_empty() { form.push(("password", password.into())); }
        prepared(self.request("/v4/link/unlock", &[], Some(&form)).await?)
    }
    async fn ad_status(&self, id: &str) -> Result<AdStatus> {
        let id = delayed_id(id)?;
        delayed(self.request("/v4/link/delayed", &[], Some(&[("id", id)])).await?)
    }
}
pub async fn prepare(request: AdPrepare) -> Result<AdLink> {
    api(request.key)?.ad_prepare(&request.url, &request.password).await
}
pub async fn status(request: AdRequest) -> Result<AdStatus> {
    api(request.key)?.ad_status(&request.id).await
}

#[cfg(test)]
#[path = "cloud_ad_links_tests.rs"]
mod tests;
