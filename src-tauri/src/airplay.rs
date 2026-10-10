#![allow(dead_code)]

use mdns_sd::{ServiceDaemon, ServiceEvent};
use std::collections::HashMap;
use std::net::IpAddr;
use std::time::Duration;

const AIRPLAY_SERVICE_TYPE: &str = "_airplay._tcp.local.";

#[derive(Debug, Clone)]
pub struct AirPlayDevice {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub model: Option<String>,
}

fn pick_address(addrs: &std::collections::HashSet<IpAddr>) -> Option<IpAddr> {
    addrs
        .iter()
        .copied()
        .find(|a| a.is_ipv4())
        .or_else(|| addrs.iter().copied().next())
}

/// AirPlay 2 / HomeKit-required devices set bit 27 (HKPairingAndAccessControl) or
/// require pairing via /pair-setup. Probe /server-info — if it 403s or returns
/// `requiredSenderFeatures` indicating pairing-only, return false so we drop the entry.
pub async fn supports_legacy_airplay(host: &str, port: u16) -> bool {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_millis(900))
        .user_agent("MediaControl/1.0")
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };
    let url = format!("http://{host}:{port}/server-info");
    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(_) => return false,
    };
    let status = resp.status().as_u16();
    if status == 403 || status == 404 {
        return false;
    }
    if !resp.status().is_success() {
        return false;
    }
    let body = resp.text().await.unwrap_or_default().to_lowercase();
    if body.contains("requiressenderfeatures") || body.contains("hkpairing") {
        return false;
    }
    true
}

pub async fn discover(timeout_ms: u64) -> Vec<AirPlayDevice> {
    let raw = discover_mdns(timeout_ms).await;
    let mut out = Vec::new();
    for d in raw {
        if supports_legacy_airplay(&d.host, d.port).await {
            out.push(d);
        } else {
            eprintln!(
                "[harbor::airplay] dropping {} ({}:{}) — needs AirPlay 2 pairing or doesn't accept legacy /play",
                d.name, d.host, d.port
            );
        }
    }
    out
}

async fn discover_mdns(timeout_ms: u64) -> Vec<AirPlayDevice> {
    tokio::task::spawn_blocking(move || -> Vec<AirPlayDevice> {
        let Ok(daemon) = ServiceDaemon::new() else {
            return Vec::new();
        };
        let Ok(receiver) = daemon.browse(AIRPLAY_SERVICE_TYPE) else {
            return Vec::new();
        };
        let deadline = std::time::Instant::now() + Duration::from_millis(timeout_ms);
        let mut devices: HashMap<String, AirPlayDevice> = HashMap::new();
        while std::time::Instant::now() < deadline {
            match receiver.recv_timeout(Duration::from_millis(120)) {
                Ok(ServiceEvent::ServiceResolved(info)) => {
                    let addrs = info.get_addresses();
                    let Some(addr) = pick_address(addrs) else {
                        continue;
                    };
                    let port = info.get_port();
                    let host = addr.to_string();
                    let props: HashMap<String, String> = info
                        .get_properties()
                        .iter()
                        .map(|p| (p.key().to_lowercase(), p.val_str().to_string()))
                        .collect();
                    let name = info
                        .get_fullname()
                        .trim_end_matches(AIRPLAY_SERVICE_TYPE)
                        .trim_end_matches('.')
                        .to_string();
                    let model = props.get("model").or_else(|| props.get("am")).cloned();
                    let id = format!("airplay-{}-{}", host, port);
                    devices.insert(
                        id.clone(),
                        AirPlayDevice {
                            id,
                            name,
                            host,
                            port,
                            model,
                        },
                    );
                }
                Ok(_) => {}
                Err(_) => {}
            }
        }
        let _ = daemon.shutdown();
        devices.into_values().collect()
    })
    .await
    .unwrap_or_default()
}

fn airplay_endpoint(host: &str, port: u16, path: &str) -> String {
    format!("http://{}:{}{}", host, port, path)
}

fn airplay_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("MediaControl/1.0")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

pub async fn load(
    host: String,
    port: u16,
    url: String,
    start_time_sec: Option<f64>,
) -> Result<(), String> {
    let start = start_time_sec.unwrap_or(0.0).max(0.0);
    let body = format!(
        "Content-Location: {}\r\nStart-Position: {:.6}\r\n",
        url, 0.0,
    );
    let client = airplay_client();
    let resp = client
        .post(airplay_endpoint(&host, port, "/play"))
        .header("Content-Type", "text/parameters")
        .header("User-Agent", "MediaControl/1.0")
        .header("X-Apple-Session-ID", uuid_session_id())
        .body(body)
        .send()
        .await
        .map_err(|e| format!("airplay play: {}", e))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if status.as_u16() == 403 {
            return Err(
                "AirPlay 403 forbidden. This usually means the TV requires AirPlay pairing (HomeKit / on-screen PIN), or AirPlay access is set to \"Require code\". On Samsung TVs, go to Settings → General → Apple AirPlay Settings → set \"Require Code\" to \"First Time Only\" and accept on the TV. Or pick the DLNA entry for this TV instead.".to_string(),
            );
        }
        if status.as_u16() == 404 {
            return Err(
                "AirPlay 404 — this device doesn't actually support AirPlay's legacy /play endpoint (common for Sonos and some non-Apple speakers that advertise AirPlay but only work with the AirPlay 2 pairing protocol). Try the DLNA / UPnP entry for this device, or use a Chromecast / Roku.".to_string(),
            );
        }
        return Err(format!("airplay play status {}: {}", status, text));
    }
    if start > 1.0 {
        tokio::time::sleep(Duration::from_millis(1200)).await;
        let _ = scrub(&host, port, start).await;
    }
    Ok(())
}

pub async fn scrub(host: &str, port: u16, sec: f64) -> Result<(), String> {
    let client = airplay_client();
    let resp = client
        .post(airplay_endpoint(
            host,
            port,
            &format!("/scrub?position={:.6}", sec.max(0.0)),
        ))
        .header("User-Agent", "MediaControl/1.0")
        .send()
        .await
        .map_err(|e| format!("airplay scrub: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("airplay scrub status {}", resp.status()));
    }
    Ok(())
}

pub async fn play(host: String, port: u16) -> Result<(), String> {
    rate(&host, port, 1.0).await
}

pub async fn pause(host: String, port: u16) -> Result<(), String> {
    rate(&host, port, 0.0).await
}

async fn rate(host: &str, port: u16, value: f32) -> Result<(), String> {
    let client = airplay_client();
    let resp = client
        .post(airplay_endpoint(
            host,
            port,
            &format!("/rate?value={}", value),
        ))
        .header("User-Agent", "MediaControl/1.0")
        .send()
        .await
        .map_err(|e| format!("airplay rate: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("airplay rate status {}", resp.status()));
    }
    Ok(())
}

pub async fn seek(host: String, port: u16, sec: f64) -> Result<(), String> {
    scrub(&host, port, sec).await
}

pub async fn stop(host: String, port: u16) -> Result<(), String> {
    let client = airplay_client();
    let _ = client
        .post(airplay_endpoint(&host, port, "/stop"))
        .header("User-Agent", "MediaControl/1.0")
        .send()
        .await;
    Ok(())
}

pub async fn status(host: String, port: u16) -> Result<(f64, String), String> {
    let client = airplay_client();
    let resp = client
        .get(airplay_endpoint(&host, port, "/playback-info"))
        .header("User-Agent", "MediaControl/1.0")
        .send()
        .await
        .map_err(|e| format!("airplay status: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("airplay status {}", resp.status()));
    }
    let text = resp.text().await.unwrap_or_default();
    let position = parse_plist_real(&text, "position").unwrap_or(0.0);
    let rate = parse_plist_real(&text, "rate").unwrap_or(0.0);
    let state = if rate > 0.5 { "PLAYING" } else { "PAUSED" }.to_string();
    Ok((position, state))
}

fn parse_plist_real(xml: &str, key: &str) -> Option<f64> {
    let needle = format!("<key>{}</key>", key);
    let idx = xml.find(&needle)?;
    let rest = &xml[idx + needle.len()..];
    let real_start = rest.find("<real>")?;
    let real_end = rest.find("</real>")?;
    if real_end <= real_start {
        return None;
    }
    let val = &rest[real_start + 6..real_end];
    val.trim().parse::<f64>().ok()
}

fn uuid_session_id() -> String {
    uuid::Uuid::new_v4().to_string().to_uppercase()
}
