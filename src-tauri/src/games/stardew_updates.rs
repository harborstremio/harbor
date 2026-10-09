//! Use SMAPI's own suggested update, not a home-grown "newest file" rule.
use super::{
    stardew::{self, Inventory},
    stardew_manifest::Result,
    stardew_progress::{Progress, Work},
};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet, VecDeque},
    sync::OnceLock,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
const ENDPOINT: &str = "https://smapi.io/api/v4.0.0/mods";
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Update {
    pub id: String,
    pub state: &'static str,
    pub version: Option<String>,
    pub url: Option<String>,
    pub name: Option<String>,
    pub community_note: Option<String>,
    pub errors: Vec<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub inventory: Inventory,
    pub updates: Vec<Update>,
    pub observed_at: u64,
}
fn version(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value.as_bytes()[0].is_ascii_digit()
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'.' | b'-' | b'_' | b'+'))
}
fn https(value: &str) -> Option<String> {
    let u = reqwest::Url::parse(value).ok()?;
    (u.scheme() == "https"
        && u.username().is_empty()
        && u.password().is_none()
        && u.port().is_none()
        && value.len() <= 2048)
        .then(|| u.to_string())
}
fn short(value: &Value, key: &str, max: usize) -> Option<String> {
    value
        .get(key)?
        .as_str()
        .filter(|s| !s.trim().is_empty() && s.len() <= max)
        .map(|s| s.trim().into())
}
fn note(value: &str) -> String {
    let re = regex::Regex::new(r"(?s)<[^>]*>").expect("static markup expression");
    let text = re.replace_all(value, " ").replace("&nbsp;", " ");
    quick_xml::escape::unescape(&text)
        .unwrap_or(std::borrow::Cow::Borrowed(&text))
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(1200)
        .collect()
}
fn request(inventory: &Inventory) -> Value {
    let mut mods: BTreeMap<String, Value> = BTreeMap::new();
    for entry in &inventory.mods {
        if entry.duplicate {
            continue;
        }
        mods.insert(entry.manifest.id.to_ascii_lowercase(),json!({"id":entry.manifest.id,"installedVersion":version(&entry.manifest.version).then_some(&entry.manifest.version),"updateKeys":entry.manifest.update_keys,"isBroken":false}));
    }
    // Missing requirements can still resolve to the provider's actual name and
    // project page. They never become installed or an automatic download.
    for entry in &inventory.mods {
        for dependency in &entry.manifest.dependencies {
            if mods.len() >= 1024 {
                break;
            }
            mods.entry(dependency.id.to_ascii_lowercase())
                .or_insert_with(|| json!({"id":dependency.id,"updateKeys":[],"isBroken":false}));
        }
    }
    json!({"mods":mods.into_values().collect::<Vec<_>>(),"apiVersion":inventory.smapi_version,"gameVersion":inventory.game_version,"platform":if cfg!(target_os="windows"){"Windows"}else if cfg!(target_os="macos"){"Mac"}else{"Linux"},"includeExtendedMetadata":true})
}
fn parse(value: Value, request: &Value) -> Result<Vec<Update>> {
    let expected = request["mods"].as_array().ok_or("stardew_response")?;
    let values = value
        .as_array()
        .filter(|v| v.len() <= 100)
        .ok_or("stardew_response")?;
    let mut rows = BTreeMap::new();
    for value in values {
        let id = short(value, "id", 256).ok_or("stardew_response")?;
        let key = id.to_ascii_lowercase();
        if !expected.iter().any(|m| {
            m["id"]
                .as_str()
                .is_some_and(|v| v.eq_ignore_ascii_case(&id))
        }) || rows.contains_key(&key)
        {
            return Err("stardew_response");
        }
        rows.insert(key, value);
    }
    expected
        .iter()
        .map(|entry| {
            let id = entry["id"].as_str().ok_or("stardew_response")?;
            let Some(row) = rows.get(&id.to_ascii_lowercase()) else {
                return Ok(Update {
                    id: id.into(),
                    state: "unknown",
                    version: None,
                    url: None,
                    name: None,
                    community_note: None,
                    errors: vec![],
                });
            };
            let metadata = &row["metadata"];
            let candidate = &row["suggestedUpdate"];
            let suggested = short(candidate, "version", 80)
                .filter(|v| version(v))
                .zip(short(candidate, "url", 2048).and_then(|v| https(&v)));
            let main = short(&metadata["main"], "version", 80)
                .zip(short(&metadata["main"], "url", 2048).and_then(|v| https(&v)));
            let errors = row
                .get("errors")
                .and_then(Value::as_array)
                .map(|v| {
                    v.iter()
                        .take(8)
                        .filter_map(Value::as_str)
                        .map(note)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let has_installed = entry["installedVersion"].as_str().is_some();
            let state = if suggested.is_some() && has_installed {
                "available"
            } else if main.is_some()
                && errors.is_empty()
                && has_installed
                && request["apiVersion"].as_str().is_some()
            {
                "noneSuggested"
            } else {
                "unknown"
            };
            let (version, url) = suggested
                .or(main)
                .map(|(v, u)| (Some(v), Some(u)))
                .unwrap_or((None, None));
            Ok(Update {
                id: id.into(),
                state,
                version,
                url,
                name: short(metadata, "name", 300),
                community_note: short(metadata, "compatibilitySummary", 8000)
                    .map(|v| note(&v))
                    .filter(|v| !v.is_empty()),
                errors,
            })
        })
        .collect()
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
async fn fetch(body: &Value, work: &Work<'_>) -> Result<(Vec<Update>, u64)> {
    type Cache = VecDeque<(String, Instant, Vec<Update>, u64)>;
    static CACHE: OnceLock<tokio::sync::Mutex<Cache>> = OnceLock::new();
    let key = format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(body).map_err(|_| "stardew_request")?)
    );
    let mut cache = work
        .wait(
            CACHE
                .get_or_init(|| tokio::sync::Mutex::new(VecDeque::new()))
                .lock(),
        )
        .await?;
    if let Some((_, _, result, at)) = cache
        .iter()
        .find(|(k, t, _, _)| k == &key && t.elapsed() < Duration::from_secs(300))
    {
        return Ok((result.clone(), *at));
    }
    let client = reqwest::Client::builder()
        .user_agent("Harbor/1.0")
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "stardew_network")?;
    let mut response = work
        .wait(client.post(ENDPOINT).json(body).send())
        .await?
        .map_err(|_| "stardew_network")?;
    if !response.status().is_success() {
        return Err("stardew_network");
    }
    if response
        .content_length()
        .is_some_and(|v| v > 4 * 1024 * 1024)
    {
        return Err("stardew_response");
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = work
        .wait(response.chunk())
        .await?
        .map_err(|_| "stardew_network")?
    {
        if bytes.len() + chunk.len() > 4 * 1024 * 1024 {
            return Err("stardew_response");
        };
        bytes.extend_from_slice(&chunk)
    }
    let result = parse(
        serde_json::from_slice(&bytes).map_err(|_| "stardew_response")?,
        body,
    )?;
    let at = now();
    cache.retain(|(k, _, _, _)| k != &key);
    if cache.len() >= 16 {
        cache.pop_front();
    }
    cache.push_back((key, Instant::now(), result.clone(), at));
    Ok((result, at))
}
pub async fn check(
    profile: &str,
    path: &str,
    operation: &str,
    emit: &dyn Fn(Progress),
) -> Result<Report> {
    let work = Work::start(profile, operation, emit)?;
    let inventory = stardew::scan(path, &|| work.check(), &|n| work.progress("scanning", n, 0))?;
    let body = request(&inventory);
    let entries = body["mods"].as_array().ok_or("stardew_request")?;
    let mut updates = Vec::new();
    let mut observed = now();
    for batch in entries.chunks(100) {
        work.progress("checking", updates.len(), entries.len())?;
        let mut chunk = body.clone();
        chunk["mods"] = json!(batch);
        let (items, at) = fetch(&chunk, &work).await?;
        observed = observed.min(at);
        updates.extend(items);
    }
    let current = stardew::scan(path, &|| work.check(), &|n| work.progress("scanning", n, 0))?;
    if current.fingerprint != inventory.fingerprint {
        return Err("stardew_changed");
    }
    // Unsupported update keys can mean an unchecked release channel. A missing
    // suggestion must not turn that uncertainty into "no update suggested".
    let unsupported = inventory
        .mods
        .iter()
        .filter(|m| m.manifest.unsupported_keys)
        .map(|m| m.manifest.id.to_ascii_lowercase())
        .collect::<BTreeSet<_>>();
    for u in &mut updates {
        if u.state == "noneSuggested" && unsupported.contains(&u.id.to_ascii_lowercase()) {
            u.state = "unknown"
        }
    }
    Ok(Report {
        inventory,
        updates,
        observed_at: observed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn absent_suggestion_is_not_proof_a_mod_is_current() {
        let req = json!({"apiVersion":"4.5.2","mods":[{"id":"A.Known","installedVersion":"1.0"},{"id":"A.Unknown","installedVersion":"1.0"},{"id":"A.Missing"}]});
        let value = json!([{"id":"A.Known","metadata":{"main":{"version":"1.0","url":"https://example.org/mod"}},"errors":[]},{"id":"A.Unknown","metadata":{"id":[]},"errors":[]},{"id":"A.Missing","metadata":{"main":{"version":"1.0","url":"https://example.org/mod"}}}]);
        let rows = parse(value.clone(), &req).unwrap();
        assert_eq!(
            rows.iter().map(|u| u.state).collect::<Vec<_>>(),
            ["noneSuggested", "unknown", "unknown"]
        );
        let mut missing = req.clone();
        missing["apiVersion"] = Value::Null;
        assert!(parse(value, &missing)
            .unwrap()
            .iter()
            .all(|u| u.state == "unknown"));
        assert!(parse(json!([{"id":"Wrong.Mod"}]), &req).is_err());
        assert!(parse(json!([{"id":"A.Known"},{"id":"a.known"}]), &req).is_err());
    }
    #[test]
    fn provider_suggestions_keep_exact_public_destinations_and_plain_notes() {
        let req = json!({"apiVersion":"4.5.2","mods":[{"id":"A.Mod","installedVersion":"1.0"}]});
        let data = json!([{"id":"A.Mod","suggestedUpdate":{"version":"2.0","url":"https://example.org/mod?id=3"},"metadata":{"compatibilitySummary":"use <a href='https://example.org'>an unofficial update</a> &amp; read notes"}}]);
        let row = parse(data, &req).unwrap().remove(0);
        assert_eq!(row.state, "available");
        assert_eq!(row.url.as_deref(), Some("https://example.org/mod?id=3"));
        assert_eq!(
            row.community_note.as_deref(),
            Some("use an unofficial update & read notes")
        );
        let unsafe_url =
            json!([{"id":"A.Mod","suggestedUpdate":{"version":"2.0","url":"file:///C:/file"}}]);
        assert_eq!(parse(unsafe_url, &req).unwrap()[0].state, "unknown");
    }
}
