use std::collections::{HashMap, HashSet};
use std::net::UdpSocket;
use std::time::{Duration, Instant};

use serde::Serialize;

const SSDP_TARGET: &str = "239.255.255.250:1900";
const M_SEARCH_ROKU: &[u8] = b"M-SEARCH * HTTP/1.1\r\n\
HOST: 239.255.255.250:1900\r\n\
MAN: \"ssdp:discover\"\r\n\
MX: 2\r\n\
ST: roku:ecp\r\n\
USER-AGENT: Harbor/1.0\r\n\r\n";

const MEDIA_ASSISTANT_CHANNEL: &str = "782875";

#[derive(Debug, Clone, Serialize)]
pub struct RokuDevice {
    pub id: String,
    pub name: String,
    pub model: Option<String>,
    pub host: String,
    pub ecp_base: String,
}

pub async fn discover(timeout_ms: u64) -> Vec<RokuDevice> {
    let entries = tokio::task::spawn_blocking(move || ssdp_search(timeout_ms))
        .await
        .unwrap_or_default();
    let mut out = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for (id, location) in entries {
        if !seen.insert(id.clone()) {
            continue;
        }
        if !ecp_url_uses_roku_port(&location) {
            eprintln!("[harbor::roku] dropping non-8060 candidate: {}", location);
            continue;
        }
        match fetch_device_info(&location).await {
            Ok((name, model)) => {
                let host = host_from_url(&location).unwrap_or_else(|| location.clone());
                out.push(RokuDevice {
                    id,
                    name,
                    model,
                    host,
                    ecp_base: location,
                });
            }
            Err(e) => {
                eprintln!(
                    "[harbor::roku] device-info probe failed for {}: {}",
                    location, e
                );
                out.push(RokuDevice {
                    id: id.clone(),
                    name: "Roku".into(),
                    model: None,
                    host: host_from_url(&location).unwrap_or_else(|| location.clone()),
                    ecp_base: location,
                });
            }
        }
    }
    out
}

fn ecp_url_uses_roku_port(url: &str) -> bool {
    let Some(host_port) = host_from_url(url) else {
        return false;
    };
    let Some(colon) = host_port.find(':') else {
        return false;
    };
    &host_port[colon + 1..] == "8060"
}

fn ssdp_search(timeout_ms: u64) -> Vec<(String, String)> {
    let mut found: HashMap<String, String> = HashMap::new();
    let Ok(socket) = UdpSocket::bind("0.0.0.0:0") else {
        return Vec::new();
    };
    let _ = socket.set_read_timeout(Some(Duration::from_millis(250)));
    let _ = socket.set_multicast_ttl_v4(4);
    let _ = socket.send_to(M_SEARCH_ROKU, SSDP_TARGET);
    std::thread::sleep(Duration::from_millis(120));
    let _ = socket.send_to(M_SEARCH_ROKU, SSDP_TARGET);

    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let mut buf = [0u8; 4096];
    while Instant::now() < deadline {
        match socket.recv_from(&mut buf) {
            Ok((n, _)) => {
                let resp = String::from_utf8_lossy(&buf[..n]);
                let location = extract_header(&resp, "location");
                let usn = extract_header(&resp, "usn");
                if let (Some(loc), Some(usn_val)) = (location, usn) {
                    let id = usn_to_id(&usn_val).unwrap_or_else(|| loc.clone());
                    let mut normalized = loc.clone();
                    if !normalized.ends_with('/') {
                        normalized.push('/');
                    }
                    found.entry(id).or_insert(normalized);
                }
            }
            Err(_) => continue,
        }
    }
    found.into_iter().collect()
}

fn extract_header(resp: &str, header_lower: &str) -> Option<String> {
    for line in resp.lines() {
        let mut parts = line.splitn(2, ':');
        let key = parts.next()?.trim().to_lowercase();
        if key == header_lower {
            return Some(parts.next()?.trim().to_string());
        }
    }
    None
}

fn usn_to_id(usn: &str) -> Option<String> {
    let lower = usn.to_lowercase();
    if let Some(idx) = lower.find("uuid:") {
        let tail = &usn[idx + 5..];
        let end = tail.find("::").unwrap_or(tail.len());
        return Some(tail[..end].to_string());
    }
    None
}

fn host_from_url(url: &str) -> Option<String> {
    let scheme_end = url.find("://")? + 3;
    let rest = &url[scheme_end..];
    let end = rest.find('/').unwrap_or(rest.len());
    Some(rest[..end].to_string())
}

async fn fetch_device_info(ecp_base: &str) -> Result<(String, Option<String>), String> {
    let url = format!("{}query/device-info", ecp_base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| format!("client: {e}"))?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("get info: {e}"))?;
    let xml = resp.text().await.map_err(|e| format!("body: {e}"))?;
    let name = extract_tag(&xml, "friendly-device-name")
        .or_else(|| extract_tag(&xml, "user-device-name"))
        .or_else(|| extract_tag(&xml, "model-name"))
        .unwrap_or_else(|| "Roku".into());
    let model = extract_tag(&xml, "model-name");
    Ok((name, model))
}

fn extract_tag(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = xml.find(&open)? + open.len();
    let len = xml[start..].find(&close)?;
    Some(xml[start..start + len].trim().to_string())
}

fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
}

fn guess_format(url: &str, content_type: Option<&str>) -> &'static str {
    if let Some(ct) = content_type {
        let lower = ct.to_lowercase();
        if lower.contains("application/dash+xml") || lower.contains("dash+xml") {
            return "dash";
        }
        if lower.contains("application/x-mpegurl")
            || lower.contains("application/vnd.apple.mpegurl")
            || lower.contains("mpegurl")
        {
            return "hls";
        }
        if lower.contains("matroska") {
            return "mkv";
        }
        if lower.contains("video/mp4")
            || lower.contains("video/quicktime")
            || lower.contains("video/x-m4v")
            || lower.contains("m4v")
        {
            return "mp4";
        }
        if lower.contains("application/vnd.ms-sstr+xml") || lower.contains("smoothstreaming") {
            return "ism";
        }
    }
    let lower = url.to_lowercase();
    let path = lower.split('?').next().unwrap_or(&lower);
    if path.ends_with(".m3u8") {
        return "hls";
    }
    if path.ends_with(".mpd") || path.ends_with(".dash") {
        return "dash";
    }
    if path.ends_with(".mkv") || path.ends_with(".mks") {
        return "mkv";
    }
    if path.ends_with(".m4v") || path.ends_with(".mov") {
        return "mp4";
    }
    if path.ends_with(".ism") || path.contains("/manifest") {
        return "ism";
    }
    "mp4"
}

pub async fn load(
    ecp_base: String,
    url: String,
    title: Option<String>,
    content_type: Option<String>,
    start_time_sec: Option<f64>,
) -> Result<(), String> {
    let format = guess_format(&url, content_type.as_deref());
    let title_str = title.unwrap_or_else(|| "Harbor".into());
    let channel_id = match locate_media_player_channel(&ecp_base).await {
        Ok(id) => id,
        Err(e) => {
            eprintln!("[harbor::roku] no Media Assistant channel: {}", e);
            return Err(e);
        }
    };
    let mut launch = format!(
        "{}launch/{}?u={}&t=v&k=(null)&videoName={}&videoFormat={}&streamformat={}",
        ecp_base,
        channel_id,
        percent_encode(&url),
        percent_encode(&title_str),
        format,
        format,
    );
    if let Some(s) = start_time_sec.filter(|s| *s > 1.0) {
        launch.push_str(&format!("&startMS={}", (s * 1000.0) as u64));
    }
    eprintln!(
        "[harbor::roku] launch URL (channel={}): {}",
        channel_id, launch
    );
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .build()
        .map_err(|e| format!("client: {e}"))?;
    let resp = client
        .post(&launch)
        .header("Content-Length", "0")
        .body(String::new())
        .send()
        .await
        .map_err(|e| format!("launch: {e}"))?;
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    eprintln!(
        "[harbor::roku] launch response: {} body={}",
        status,
        body.chars().take(200).collect::<String>()
    );
    if !status.is_success() {
        return Err(format!("launch status {} body={}", status, body));
    }
    Ok(())
}

async fn locate_media_player_channel(ecp_base: &str) -> Result<String, String> {
    let url = format!("{}query/apps", ecp_base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| format!("client: {e}"))?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("query/apps: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        eprintln!("[harbor::roku] query/apps blocked: {}", status);
        return Err(match status.as_u16() {
            401 | 403 => "ROKU_ECP_BLOCKED: this Roku rejected the request. Network access for mobile apps is disabled on this device.".to_string(),
            404 => "ROKU_ECP_NOT_FOUND: no Roku ECP service at this address (device may not be a Roku).".to_string(),
            other => format!("ROKU_ECP_ERROR: Roku ECP returned HTTP {} on /query/apps.", other),
        });
    }
    let xml = resp
        .text()
        .await
        .map_err(|e| format!("query/apps body: {e}"))?;
    let apps = iter_apps(&xml);
    eprintln!(
        "[harbor::roku] query/apps status={} parsed_apps={}",
        status,
        apps.len()
    );
    for (id, name) in &apps {
        let lower = name.to_lowercase();
        if lower.contains("media assistant") || id == MEDIA_ASSISTANT_CHANNEL {
            eprintln!(
                "[harbor::roku] found Media Assistant channel id={} name={}",
                id, name
            );
            return Ok(id.clone());
        }
    }
    eprintln!(
        "[harbor::roku] installed channels: [{}]",
        apps.iter()
            .map(|(id, name)| format!("{}={:?}", id, name))
            .collect::<Vec<_>>()
            .join(", ")
    );
    let probe = format!("{}query/icon/{}", ecp_base, MEDIA_ASSISTANT_CHANNEL);
    match client.get(&probe).send().await {
        Ok(r) => {
            let st = r.status();
            eprintln!("[harbor::roku] Media Assistant icon probe -> {}", st);
            if st.is_success() {
                return Ok(MEDIA_ASSISTANT_CHANNEL.to_string());
            }
        }
        Err(e) => eprintln!("[harbor::roku] Media Assistant icon probe error: {}", e),
    }
    Err("ROKU_MEDIA_ASSISTANT_MISSING: Media Assistant channel is not installed on this Roku. Casting to Roku requires the free Media Assistant channel from the Roku Channel Store (the built-in Roku Media Player no longer accepts third-party launches on OS 11.5+).".to_string())
}

fn iter_apps(xml: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut pos = 0;
    while let Some(start) = xml[pos..].find("<app ") {
        let abs_start = pos + start;
        let close = match xml[abs_start..].find('>') {
            Some(i) => abs_start + i,
            None => break,
        };
        let header = &xml[abs_start..close];
        let id = attr_value(header, "id").unwrap_or_default();
        let after = &xml[close + 1..];
        let end_tag = match after.find("</app>") {
            Some(i) => i,
            None => break,
        };
        let name = after[..end_tag].trim().to_string();
        if !id.is_empty() && !name.is_empty() {
            out.push((id, name));
        }
        pos = close + 1 + end_tag + 6;
    }
    out
}

fn attr_value(header: &str, name: &str) -> Option<String> {
    let needle = format!("{}=\"", name);
    let start = header.find(&needle)? + needle.len();
    let end = header[start..].find('"')?;
    Some(header[start..start + end].to_string())
}

async fn keypress(ecp_base: &str, key: &str) -> Result<(), String> {
    let url = format!("{}keypress/{}", ecp_base, key);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .map_err(|e| format!("client: {e}"))?;
    let resp = client
        .post(&url)
        .body(String::new())
        .send()
        .await
        .map_err(|e| format!("keypress: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("keypress status {}", resp.status()));
    }
    Ok(())
}

pub async fn play(ecp_base: String) -> Result<(), String> {
    keypress(&ecp_base, "Play").await
}

pub async fn pause(ecp_base: String) -> Result<(), String> {
    keypress(&ecp_base, "Play").await
}

pub async fn stop(ecp_base: String) -> Result<(), String> {
    keypress(&ecp_base, "Home").await
}

pub async fn seek(_ecp_base: String, _sec: f64) -> Result<(), String> {
    eprintln!("[harbor::roku] absolute-seek not implemented (ECP has no primitive on Media Assistant; re-launch with startMS is the documented path).");
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
pub struct RokuMediaStatus {
    pub position_sec: f64,
    pub duration_sec: Option<f64>,
    pub player_state: String,
    pub error: bool,
}

pub async fn status(ecp_base: &str) -> Result<RokuMediaStatus, String> {
    let url = format!("{}query/media-player", ecp_base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| format!("client: {e}"))?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("status get: {e}"))?;
    let xml = resp.text().await.map_err(|e| format!("status body: {e}"))?;
    let state = extract_attr(&xml, "player", "state").unwrap_or_else(|| "unknown".into());
    let error = extract_attr(&xml, "player", "error")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let position_sec = extract_tag(&xml, "position")
        .and_then(|s| parse_ms(&s))
        .map(|ms| ms as f64 / 1000.0)
        .unwrap_or(0.0);
    let duration_sec = extract_tag(&xml, "duration")
        .and_then(|s| parse_ms(&s))
        .map(|ms| ms as f64 / 1000.0);
    Ok(RokuMediaStatus {
        position_sec,
        duration_sec,
        player_state: state.to_uppercase(),
        error,
    })
}

fn extract_attr(xml: &str, tag: &str, attr: &str) -> Option<String> {
    let open = format!("<{tag}");
    let start = xml.find(&open)? + open.len();
    let end = xml[start..].find('>')?;
    let header = &xml[start..start + end];
    let needle = format!("{}=\"", attr);
    let attr_start = header.find(&needle)? + needle.len();
    let attr_end = header[attr_start..].find('"')?;
    Some(header[attr_start..attr_start + attr_end].to_string())
}

fn parse_ms(s: &str) -> Option<u64> {
    let trimmed = s
        .trim()
        .trim_end_matches(" ms")
        .trim_end_matches("ms")
        .trim();
    trimmed.parse::<u64>().ok()
}
