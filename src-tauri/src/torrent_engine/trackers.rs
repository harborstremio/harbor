use std::collections::HashSet;

pub const ALL: &[&str] = &[
    "https://tracker.zhuqiy.com:443/announce",
    "https://tracker.nekomi.cn:443/announce",
    "https://tracker.gcrenwp.top:443/announce",
    "https://tracker.7471.top:443/announce",
    "https://tracker.leechshield.link:443/announce",
    "https://tracker.pmman.tech:443/announce",
    "https://tr.zukizuki.org:443/announce",
    "https://tr.nyacat.pw:443/announce",
    "https://torrents.tmtime.dev:443/announce",
    "https://t.213891.xyz:443/announce",
    "https://tracker.yemekyedim.com:443/announce",
    "https://tracker.anibt.net:443/announce",
    "https://tracker.manager.v6.navy:443/announce",
    "http://tracker.opentrackr.org:1337/announce",
    "http://bt1.archive.org:6969/announce",
    "http://tracker.mywaifu.best:6969/announce",
    "http://tracker.renfei.net:8080/announce",
    "http://tracker.dhitechnical.com:6969/announce",
    "http://tracker.waaa.moe:6969/announce",
    "http://tracker.tritan.gg:8080/announce",
    "http://tracker.dler.org:6969/announce",
    "http://tracker.qu.ax:6969/announce",
    "http://tracker.bittor.pw:1337/announce",
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://open.demonii.com:1337/announce",
    "udp://open.stealth.si:80/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://tracker.dler.org:6969/announce",
    "udp://tracker.qu.ax:6969/announce",
    "udp://tracker-udp.gbitt.info:80/announce",
    "udp://tracker.bittor.pw:1337/announce",
    "udp://bt1.archive.org:6969/announce",
    "udp://exodus.desync.com:6969/announce",
];

pub fn as_url_set() -> HashSet<url::Url> {
    ALL.iter().filter_map(|t| url::Url::parse(t).ok()).collect()
}

pub fn merge_into(mut trackers: Vec<String>) -> Vec<String> {
    for t in ALL {
        let s = t.to_string();
        if !trackers.contains(&s) {
            trackers.push(s);
        }
    }
    trackers
}

/// Splice trackers into a magnet URI as `tr=` params.
///
/// librqbit 8.1.1 does NOT honor `AddTorrentOptions.trackers` for magnet links:
/// only the magnet's own `tr=` params plus the session-wide tracker set are ever
/// announced (see session.rs `add_torrent`). So per-stream trackers passed via
/// options are silently dropped for magnets. When UDP (and therefore DHT) is
/// blocked, the magnet's HTTPS trackers are the only path to peers - if they only
/// arrive via the options list, they never get announced and the torrent sits at
/// 0 peers. Embedding them here guarantees the magnet parser picks them up.
///
/// No-op for non-magnet inputs. Trackers already declared in the magnet are not
/// duplicated. Strictly additive: it only ever appends trackers, so it cannot
/// remove any tracker the working path already relied on.
pub fn embed_into_magnet(magnet: &str, extra: &[String]) -> String {
    if !magnet.starts_with("magnet:") {
        return magnet.to_string();
    }
    let existing: HashSet<String> = url::Url::parse(magnet)
        .map(|u| {
            u.query_pairs()
                .filter(|(k, _)| k == "tr")
                .map(|(_, v)| v.into_owned())
                .collect()
        })
        .unwrap_or_default();
    let mut seen = existing;
    let mut out = magnet.to_string();
    let sep = if out.contains('?') { '&' } else { '?' };
    let mut first = true;
    for t in extra {
        let t = t.trim();
        if t.is_empty() || !seen.insert(t.to_string()) {
            continue;
        }
        out.push(if first { sep } else { '&' });
        first = false;
        out.push_str("tr=");
        out.push_str(&pct_encode(t));
    }
    out
}

/// Percent-encode a tracker URL for use as a magnet `tr=` query value. Encodes
/// everything outside the RFC 3986 unreserved set so reserved characters
/// (`:` `/` `&` `=` `?`) round-trip cleanly through `Url::query_pairs`.
fn pct_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for &b in s.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
