use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use librqbit::dht::Dht;
use serde::Serialize;
use tokio::net::UdpSocket;
use tokio::time::{sleep, timeout, Instant};

fn dns_cache() -> &'static Mutex<HashMap<String, Vec<SocketAddr>>> {
    static CACHE: OnceLock<Mutex<HashMap<String, Vec<SocketAddr>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

async fn lookup_cached(host_port: &str) -> Option<SocketAddr> {
    if let Ok(cache) = dns_cache().lock() {
        if let Some(addrs) = cache.get(host_port) {
            if let Some(addr) = addrs.first() {
                return Some(*addr);
            }
        }
    }
    let result = tokio::net::lookup_host(host_port).await.ok()?.next();
    if let Some(addr) = result {
        if let Ok(mut cache) = dns_cache().lock() {
            cache.entry(host_port.to_string()).or_default().push(addr);
        }
        return Some(addr);
    }
    None
}

#[derive(Serialize, Clone)]
pub struct NetStep {
    pub label: String,
    pub ok: bool,
    #[serde(default)]
    pub warn: bool,
    pub detail: String,
}

fn st(label: &str, ok: bool, detail: impl Into<String>) -> NetStep {
    NetStep {
        label: label.to_string(),
        ok,
        warn: false,
        detail: detail.into(),
    }
}

fn degraded(label: &str, detail: impl Into<String>) -> NetStep {
    NetStep {
        label: label.to_string(),
        ok: false,
        warn: true,
        detail: detail.into(),
    }
}

pub async fn run(side_dht: Option<Dht>) -> Vec<NetStep> {
    let (dht, udp, https) = tokio::join!(dht_step(side_dht), udp_step(), https_step());
    vec![dht, udp, https]
}

async fn dht_step(side_dht: Option<Dht>) -> NetStep {
    let Some(d) = side_dht else {
        return degraded(
            "dht nodes",
            "DHT not running (HTTPS trackers can still find peers)",
        );
    };
    let deadline = Instant::now() + Duration::from_secs(8);
    loop {
        let n = d.stats().routing_table_size;
        if n >= 1 {
            return st("dht nodes", true, format!("{n} nodes"));
        }
        if Instant::now() >= deadline {
            return degraded(
                "dht nodes",
                "0 nodes (UDP likely blocked, HTTPS trackers can still find peers)",
            );
        }
        sleep(Duration::from_millis(400)).await;
    }
}

async fn udp_step() -> NetStep {
    for host in [
        "tracker.opentrackr.org:1337",
        "open.demonii.com:1337",
        "exodus.desync.com:6969",
    ] {
        if udp_tracker_reachable(host).await {
            return st("udp egress", true, format!("reached {host}"));
        }
    }
    degraded(
        "udp egress",
        "no UDP tracker replied (UDP likely blocked, HTTPS trackers can still find peers)",
    )
}

async fn udp_tracker_reachable(host_port: &str) -> bool {
    let Ok(sock) = UdpSocket::bind("0.0.0.0:0").await else {
        return false;
    };
    let Some(addr) = lookup_cached(host_port).await else {
        return false;
    };
    if sock.connect(addr).await.is_err() {
        return false;
    }
    let txid: u32 = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0x4861_7262)
        | 1;
    let mut req = [0u8; 16];
    req[0..8].copy_from_slice(&0x0000_0417_2710_1980u64.to_be_bytes());
    req[8..12].copy_from_slice(&0u32.to_be_bytes());
    req[12..16].copy_from_slice(&txid.to_be_bytes());
    if sock.send(&req).await.is_err() {
        return false;
    }
    let mut buf = [0u8; 16];
    matches!(
        timeout(Duration::from_secs(5), sock.recv(&mut buf)).await,
        Ok(Ok(n)) if n >= 16
            && u32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]]) == 0
            && u32::from_be_bytes([buf[4], buf[5], buf[6], buf[7]]) == txid
    )
}

fn https_client() -> Option<&'static reqwest::Client> {
    static CLIENT: OnceLock<Option<reqwest::Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .timeout(Duration::from_secs(6))
                .build()
                .ok()
        })
        .as_ref()
}

async fn https_step() -> NetStep {
    let Some(client) = https_client() else {
        return st("https egress", false, "client build failed");
    };
    for url in super::trackers::ALL
        .iter()
        .filter(|u| u.starts_with("https://"))
    {
        if let Some(host) = announce_host(url) {
            if client.get(*url).send().await.is_ok() {
                return st(
                    "https egress",
                    true,
                    format!("tracker {host} announce reachable"),
                );
            }
        }
    }
    if client.get("https://harbor.site").send().await.is_ok() {
        return degraded(
            "https egress",
            "no HTTPS tracker replied but HTTPS works (trackers may be temporarily down)",
        );
    }
    st("https egress", false, "no HTTPS tracker reachable")
}

fn announce_host(url: &str) -> Option<&str> {
    url.strip_prefix("https://")?.split([':', '/']).next()
}
