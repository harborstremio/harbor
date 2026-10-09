use regex::Regex;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::LazyLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tokio::sync::Mutex;

const MUSIC_ORIGIN: &str = "https://music.youtube.com";
const MUSIC_API: &str = "https://music.youtube.com/youtubei/v1";
const DESKTOP_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const VISITOR_FILE: &str = "youtube-visitor-id";
const CONSENT_COOKIE: &str = "SOCS=CAI";
const VISITOR_HEADER: &str = "x-goog-visitor-id";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

pub const SONGS_FILTER: &str = "EgWKAQIIAWoMEA4QChADEAQQCRAF";
pub const VIDEOS_FILTER: &str = "EgWKAQIQAWoMEA4QChADEAQQCRAF";
pub const ALBUMS_FILTER: &str = "EgWKAQIYAWoMEA4QChADEAQQCRAF";
pub const ARTISTS_FILTER: &str = "EgWKAQIgAWoMEA4QChADEAQQCRAF";
pub const PLAYLISTS_FILTER: &str = "Eg-KAQwIABAAGAAgACgBMABqChAEEAMQCRAFEAo%3D";

static YTCFG: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?s)ytcfg\.set\s*\(\s*(\{.+?\})\s*\)\s*;").expect("ytcfg pattern")
});

static VISITOR_DATA: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#""VISITOR_DATA"\s*:\s*"([^"]+)""#).expect("visitor data pattern")
});

pub struct Client {
    http: reqwest::Client,
    visitor: Mutex<Option<String>>,
}

impl Client {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::new(),
            visitor: Mutex::new(None),
        }
    }

    pub async fn search(
        &self,
        app: &tauri::AppHandle,
        query: &str,
        filter: &str,
    ) -> Result<Value, String> {
        self.post(app, "search", json!({ "query": query, "params": filter }))
            .await
    }

    pub async fn browse(&self, app: &tauri::AppHandle, browse_id: &str) -> Result<Value, String> {
        self.post(app, "browse", json!({ "browseId": browse_id }))
            .await
    }

    pub async fn search_continuation(&self, app: &tauri::AppHandle, token: &str) -> Result<Value, String> {
        self.post(app, "search", json!({ "continuation": token })).await
    }

    pub async fn browse_collection(
        &self,
        app: &tauri::AppHandle,
        browse_id: &str,
        params: Option<&str>,
    ) -> Result<Value, String> {
        let mut body = json!({ "browseId": browse_id });
        if let Some(params) = params {
            body["params"] = json!(params);
        }
        self.post(app, "browse", body).await
    }

    pub async fn browse_continuation(
        &self,
        app: &tauri::AppHandle,
        token: &str,
    ) -> Result<Value, String> {
        self.post(app, "browse", json!({ "continuation": token }))
            .await
    }

    pub async fn watch_queue(
        &self,
        app: &tauri::AppHandle,
        video_id: Option<&str>,
        playlist_id: &str,
    ) -> Result<Value, String> {
        let mut body = json!({
            "playlistId": playlist_id,
            "enablePersistentPlaylistPanel": true,
            "isAudioOnly": true,
            "tunerSettingValue": "AUTOMIX_SETTING_NORMAL",
            "params": "wAEB",
        });
        if let Some(video_id) = video_id {
            body["videoId"] = Value::String(video_id.to_string());
        }
        self.post(app, "next", body).await
    }

    async fn post(
        &self,
        app: &tauri::AppHandle,
        endpoint: &str,
        mut body: Value,
    ) -> Result<Value, String> {
        let visitor = self.visitor(app).await;
        body["context"] = music_context();
        let mut request = self
            .http
            .post(format!("{MUSIC_API}/{endpoint}?alt=json"))
            .timeout(REQUEST_TIMEOUT)
            .header(reqwest::header::USER_AGENT, DESKTOP_AGENT)
            .header(reqwest::header::ORIGIN, MUSIC_ORIGIN)
            .header(reqwest::header::COOKIE, CONSENT_COOKIE)
            .json(&body);
        if let Some(visitor) = visitor.as_deref() {
            request = request.header(VISITOR_HEADER, visitor);
        }
        let response = request
            .send()
            .await
            .map_err(|error| format!("YouTube Music request failed: {error}"))?;
        let value = read_response(response).await?;
        if visitor.is_none() {
            if let Some(seed) = value
                .pointer("/responseContext/visitorData")
                .and_then(Value::as_str)
            {
                self.remember(app, seed).await;
            }
        }
        Ok(value)
    }

    async fn visitor(&self, app: &tauri::AppHandle) -> Option<String> {
        self.require_visitor(app).await.ok()
    }

    async fn require_visitor(&self, app: &tauri::AppHandle) -> Result<String, String> {
        {
            let mut slot = self.visitor.lock().await;
            if let Some(visitor) = slot.as_deref() {
                return Ok(visitor.to_string());
            }
            if let Some(stored) = read_visitor(app).await {
                *slot = Some(stored.clone());
                return Ok(stored);
            }
        }
        let fetched = self.fetch_visitor().await?;
        self.remember(app, &fetched).await;
        Ok(fetched)
    }

    async fn remember(&self, app: &tauri::AppHandle, visitor: &str) {
        {
            let mut slot = self.visitor.lock().await;
            if slot.is_some() {
                return;
            }
            *slot = Some(visitor.to_string());
        }
        write_visitor(app, visitor).await;
    }

    async fn fetch_visitor(&self) -> Result<String, String> {
        let page = self
            .http
            .get(MUSIC_ORIGIN)
            .timeout(REQUEST_TIMEOUT)
            .header(reqwest::header::USER_AGENT, DESKTOP_AGENT)
            .header(reqwest::header::COOKIE, CONSENT_COOKIE)
            .send()
            .await
            .map_err(|error| format!("YouTube Music request failed: {error}"))?
            .text()
            .await
            .map_err(|error| format!("YouTube Music response was invalid: {error}"))?;
        visitor_from_page(&page)
            .ok_or_else(|| "YouTube Music did not return a session id".to_string())
    }
}

async fn read_response(response: reqwest::Response) -> Result<Value, String> {
    let status = response.status();
    let value = response
        .json::<Value>()
        .await
        .map_err(|error| format!("YouTube Music response was invalid: {error}"))?;
    if !status.is_success() {
        let message = value
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("YouTube Music rejected the request");
        return Err(format!("YouTube Music returned HTTP {status}: {message}"));
    }
    Ok(value)
}

fn music_context() -> Value {
    json!({
        "client": {
            "clientName": "WEB_REMIX",
            "clientVersion": client_version(now_seconds()),
            "hl": "en",
            "gl": "US",
        },
        "user": {},
    })
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}

fn client_version(now: u64) -> String {
    let (year, month, day) = civil_date(now / 86_400);
    format!("1.{year:04}{month:02}{day:02}.01.00")
}

fn civil_date(days: u64) -> (u64, u64, u64) {
    let shifted = days as i64 + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    (year as u64, month as u64, day as u64)
}

fn visitor_from_page(page: &str) -> Option<String> {
    for capture in YTCFG.captures_iter(page) {
        let Some(raw) = capture.get(1) else {
            continue;
        };
        let Ok(config) = serde_json::from_str::<Value>(raw.as_str()) else {
            continue;
        };
        if let Some(visitor) = config.get("VISITOR_DATA").and_then(Value::as_str) {
            if !visitor.is_empty() {
                return Some(visitor.to_string());
            }
        }
    }
    VISITOR_DATA
        .captures(page)
        .and_then(|capture| capture.get(1))
        .map(|value| value.as_str().to_string())
        .filter(|value| !value.is_empty())
}

fn visitor_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|directory| directory.join(VISITOR_FILE))
}

async fn read_visitor(app: &tauri::AppHandle) -> Option<String> {
    let raw = tokio::fs::read_to_string(visitor_path(app)?).await.ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.len() > 512 {
        return None;
    }
    Some(trimmed.to_string())
}

async fn write_visitor(app: &tauri::AppHandle, visitor: &str) {
    let Some(path) = visitor_path(app) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let _ = tokio::fs::write(path, visitor).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn civil_dates_match_known_epoch_days() {
        assert_eq!(civil_date(0), (1970, 1, 1));
        assert_eq!(civil_date(10_957), (2000, 1, 1));
        assert_eq!(civil_date(20_454), (2026, 1, 1));
        assert_eq!(civil_date(20_698), (2026, 9, 2));
    }

    #[test]
    fn client_version_tracks_the_current_day() {
        assert_eq!(client_version(20_698 * 86_400), "1.20260902.01.00");
        assert_eq!(client_version(20_698 * 86_400 + 86_399), "1.20260902.01.00");
    }

    #[test]
    fn visitor_id_reads_the_ytcfg_block() {
        let page = r#"<script>ytcfg.set({"INNERTUBE_API_KEY":"key","VISITOR_DATA":"CgtabcXYZ%3D%3D","INNERTUBE_CLIENT_VERSION":"1.20260901.12.00"});</script>"#;
        assert_eq!(visitor_from_page(page).expect("visitor"), "CgtabcXYZ%3D%3D");
    }

    #[test]
    fn visitor_id_falls_back_to_the_bare_key() {
        let page = r#"<script>window.ytcfg={};ytcfg.set(notjson);var meta={"VISITOR_DATA":"CgtOTHER%3D%3D"};</script>"#;
        assert_eq!(visitor_from_page(page).expect("visitor"), "CgtOTHER%3D%3D");
        assert!(visitor_from_page("<html></html>").is_none());
    }

    #[test]
    fn music_context_names_the_web_remix_client() {
        let context = music_context();
        assert_eq!(context["client"]["clientName"], "WEB_REMIX");
        assert_eq!(context["client"]["hl"], "en");
        assert!(context["client"]["clientVersion"]
            .as_str()
            .expect("version")
            .starts_with("1.20"));
    }
}
