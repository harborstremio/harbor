use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Duration, Instant};

use librqbit::api::TorrentIdOrHash;
use librqbit::{AddTorrent, AddTorrentOptions, PeerConnectionOptions, Session};
use tokio::time::{sleep, timeout};

use super::types::{step, warn_step, SelfTestStep};
use crate::torrent_engine::{current_port, current_side_dht, dht_boot, merge_trackers};

const MAGNET: &str = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel";
const META_BUDGET: Duration = Duration::from_secs(90);
const PEER_BUDGET: Duration = Duration::from_secs(90);

pub async fn run(session: &Arc<Session>, steps: &mut Vec<SelfTestStep>) {
    let Some(port) = current_port() else {
        steps.push(step("metadata", false, "engine port unavailable"));
        return;
    };
    let seed = match current_side_dht() {
        Some(d) => dht_boot::seed_peers(&d, MAGNET, 40, Duration::from_secs(3)).await,
        None => Vec::new(),
    };
    let seeded = seed.len();
    let opts = AddTorrentOptions {
        overwrite: true,
        trackers: Some(merge_trackers(Vec::new())),
        initial_peers: (!seed.is_empty()).then_some(seed),
        peer_opts: Some(PeerConnectionOptions {
            connect_timeout: Some(Duration::from_secs(7)),
            read_write_timeout: Some(Duration::from_secs(10)),
            keep_alive_interval: None,
        }),
        ..Default::default()
    };
    let added = timeout(
        META_BUDGET,
        session.add_torrent(AddTorrent::from_url(MAGNET), Some(opts)),
    )
    .await;
    let handle = match added {
        Ok(Ok(r)) => match r.into_handle() {
            Some(h) => h,
            None => {
                steps.push(step("metadata", false, "list-only response"));
                return;
            }
        },
        Ok(Err(e)) => {
            steps.push(step("metadata", false, format!("{e:#}")));
            return;
        }
        Err(_) => {
            steps.push(warm_metadata_step(seeded, None));
            return;
        }
    };
    let hash = format!("{:?}", handle.info_hash());
    let meta_started = Instant::now();
    match timeout(META_BUDGET, handle.wait_until_initialized()).await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => {
            steps.push(step("metadata", false, format!("{e:#}")));
            cleanup(session, &hash).await;
            return;
        }
        Err(_) => {
            let snap = handle.stats().live.map(|l| {
                let ps = &l.snapshot.peer_stats;
                (ps.seen, ps.connecting)
            });
            steps.push(warm_metadata_step(seeded, snap));
            cleanup(session, &hash).await;
            return;
        }
    }
    let lengths = handle
        .with_metadata(|m| m.file_infos.iter().map(|fi| fi.len).collect::<Vec<_>>())
        .unwrap_or_default();
    if lengths.is_empty() {
        steps.push(step("metadata", false, "no files in torrent"));
        cleanup(session, &hash).await;
        return;
    }
    steps.push(step(
        "metadata",
        true,
        format!("{} file(s) in {:.1}s", lengths.len(), meta_started.elapsed().as_secs_f64()),
    ));
    let idx = lengths
        .iter()
        .enumerate()
        .max_by_key(|(_, l)| **l)
        .map(|(i, _)| i)
        .unwrap_or(0);

    let peers_started = Instant::now();
    let mut live_peers = 0usize;
    let mut seen = 0usize;
    let mut connecting = 0usize;
    while peers_started.elapsed() < PEER_BUDGET {
        if let Some(live) = handle.stats().live {
            let ps = &live.snapshot.peer_stats;
            seen = ps.seen;
            connecting = ps.connecting;
            if ps.live > 0 {
                live_peers = ps.live;
                break;
            }
        }
        sleep(Duration::from_millis(500)).await;
    }
    if live_peers == 0 {
        steps.push(no_live_peers_step(seen, connecting));
        cleanup(session, &hash).await;
        return;
    }
    steps.push(step(
        "peers",
        true,
        format!("{live_peers} connected ({seen} discovered)"),
    ));

    let only: HashSet<usize> = HashSet::from([idx]);
    if let Err(e) = session.update_only_files(&handle, &only).await {
        steps.push(step("first byte", false, format!("select: {e:#}")));
        cleanup(session, &hash).await;
        return;
    }
    first_byte(steps, port, &hash, idx).await;
    finalize(session, steps, &hash).await;
}

fn warm_metadata_step(seeded: usize, snap: Option<(usize, usize)>) -> SelfTestStep {
    if let Some((seen, connecting)) = snap {
        if seen > 0 {
            return step(
                "metadata",
                false,
                format!("{seen} peer(s) found but none could deliver data in 90s: your network may be blocking BitTorrent connections (a VPN is typically needed)"),
            );
        }
        if connecting > 0 {
            return warn_step(
                "metadata",
                format!("warming: {connecting} connecting, metadata not complete at 90s"),
            );
        }
    }
    if seeded > 0 {
        warn_step(
            "metadata",
            format!("warming: {seeded} peer(s) seeded, still pulling metadata at 90s"),
        )
    } else {
        warn_step("metadata", "warming: still searching for peers at 90s")
    }
}

fn no_live_peers_step(seen: usize, connecting: usize) -> SelfTestStep {
    if seen > 0 {
        step(
            "peers",
            false,
            format!("{seen} peer(s) found, {connecting} connecting, but none completed a connection in 90s: your network may be blocking BitTorrent connections (a VPN is typically needed)"),
        )
    } else {
        step("peers", false, "no peers discovered in 90s")
    }
}

async fn first_byte(steps: &mut Vec<SelfTestStep>, port: u16, hash: &str, idx: usize) {
    let client = reqwest::Client::new();
    let byte_started = Instant::now();
    let url = format!(
        "http://127.0.0.1:{port}/stream/{hash}/{idx}?tok={}",
        crate::torrent_engine::engine_token()
    );
    match client
        .get(&url)
        .header(reqwest::header::RANGE, "bytes=0-65535")
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status();
            let content_range = resp
                .headers()
                .get(reqwest::header::CONTENT_RANGE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string();
            let read = resp.bytes().await.map(|b| b.len()).unwrap_or(0);
            if status.as_u16() == 206 && read == 65536 {
                steps.push(step(
                    "first byte",
                    true,
                    format!("HTTP 206, {read} B, {:.1}s", byte_started.elapsed().as_secs_f64()),
                ));
                let detail = if content_range.is_empty() {
                    "bytes 0-65535".to_string()
                } else {
                    content_range
                };
                steps.push(step("range", true, detail));
            } else {
                steps.push(step(
                    "first byte",
                    false,
                    format!("status {status}, {read} B (expected 206 / 65536)"),
                ));
            }
        }
        Err(e) => steps.push(step("first byte", false, e.to_string())),
    }
}

async fn finalize(session: &Arc<Session>, steps: &mut Vec<SelfTestStep>, hash: &str) {
    match TorrentIdOrHash::parse(hash) {
        Ok(id) => match session.delete(id, true).await {
            Ok(()) => steps.push(step("cleanup", true, "torrent removed")),
            Err(e) => steps.push(step("cleanup", false, format!("{e:#}"))),
        },
        Err(e) => steps.push(step("cleanup", false, e.to_string())),
    }
}

async fn cleanup(session: &Arc<Session>, hash: &str) {
    if let Ok(id) = TorrentIdOrHash::parse(hash) {
        let _ = session.delete(id, true).await;
    }
}
