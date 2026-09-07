use std::net::SocketAddr;
use std::time::Duration;

use futures_util::StreamExt;
use librqbit::dht::{Dht, DhtBuilder, DhtConfig, Id20};
use tokio::time::{timeout_at, Instant};
use tokio_util::sync::CancellationToken;

const BOOTSTRAP: &[&str] = &[
    "router.bittorrent.com:6881",
    "router.utorrent.com:6881",
    "dht.transmissionbt.com:6881",
    "dht.libtorrent.org:25401",
    "dht.aelitis.com:6881",
    "router.bitcomet.com:6881",
    "router.silotis.us:6881",
];

pub async fn build(cancellation: CancellationToken) -> Option<Dht> {
    let guard = cancellation.clone().drop_guard();
    let boot = BOOTSTRAP.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    match DhtBuilder::with_config(DhtConfig {
        bootstrap_addrs: Some(boot),
        cancellation_token: Some(cancellation),
        ..Default::default()
    })
    .await
    {
        Ok(d) => {
            let _ = guard.disarm();
            Some(d)
        }
        Err(e) => {
            eprintln!("[torrent-engine] side DHT unavailable: {e:#}");
            None
        }
    }
}

pub fn node_count(dht: &Dht) -> usize {
    dht.stats().routing_table_size
}

pub(crate) fn info_hash_from_magnet(magnet: &str) -> Option<Id20> {
    let lower = magnet.to_ascii_lowercase();
    let start = lower.find("btih:")? + 5;
    let hex: String = lower[start..]
        .chars()
        .take_while(|c| c.is_ascii_hexdigit())
        .collect();
    if hex.len() == 40 {
        hex.parse::<Id20>().ok()
    } else {
        None
    }
}

pub async fn seed_peers(dht: &Dht, magnet: &str, max: usize, budget: Duration) -> Vec<SocketAddr> {
    let Some(id) = info_hash_from_magnet(magnet) else {
        return Vec::new();
    };
    let mut stream = dht.get_peers(id, None);
    let mut out: Vec<SocketAddr> = Vec::new();
    let deadline = Instant::now() + budget;
    while out.len() < max {
        match timeout_at(deadline, stream.next()).await {
            Ok(Some(addr)) => {
                if !out.contains(&addr) {
                    out.push(addr);
                }
            }
            _ => break,
        }
    }
    out
}
