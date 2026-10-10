//! Android and Android TV tuning for the librqbit P2P session.
//!
//! Pure policy. No `tauri` import, no global state, no I/O. Every value here is
//! a function of its arguments, so the module compiles and unit tests on a
//! desktop host, which is the only place it has ever been compiled. The harness
//! that does that is `tools/android-p2p-probe`.
//!
//! Desktop cannot reach this file. `lib.rs` declares the module behind
//! `#[cfg(target_os = "android")]`, so on every desktop target the compiler
//! never parses it.
//!
//! Four values differ from `torrent_engine::new_session`. Each divergence is
//! justified where it is declared. Everything else is deliberately identical to
//! desktop so there is one engine to reason about, not two.

use std::collections::HashSet;
use std::num::NonZeroU32;
use std::ops::Range;
use std::path::{Path, PathBuf};
use std::time::Duration;

use librqbit::dht::PersistentDhtConfig;
use librqbit::limits::LimitsConfig;
use librqbit::{PeerConnectionOptions, SessionOptions, SessionPersistenceConfig};

/// Matches the directory name desktop uses under its own root.
pub const ENGINE_SUBDIR: &str = "engine";

/// Inbound listen range, identical to desktop on purpose. Two Harbors on one
/// LAN both asking a router to forward 16881 is survivable: the second UPnP
/// request is refused, tier 1 fails, and the tier ladder drops to no-inbound.
/// A separate Android range would buy nothing and add a number to explain.
pub const LISTEN_PORT_RANGE: Range<u16> = 16881..16931;

/// `torrent_engine::init` sets `DHT_QUERIES_PER_SECOND=400` for desktop. Home
/// routers keep small NAT conntrack tables and a 400 qps UDP fan-out is the
/// textbook way to fill one, which drops the whole household off the network
/// rather than only this app. A TV has no reason to hurry, and a stick's SoC
/// cannot service that rate anyway.
pub const DHT_QUERIES_PER_SECOND: &str = "100";

/// Wi-Fi is half duplex and a stick has one radio, so every byte uploaded
/// steals airtime from the byte being played. Desktop leaves upload uncapped
/// because it is usually on ethernet. Cap it here instead of letting
/// tit-for-tat saturate the link mid-stream.
pub const MAX_UPLOAD_BPS: u32 = 512 * 1024;

const PEER_CONNECT_TIMEOUT: Duration = Duration::from_secs(4);
const PEER_READ_WRITE_TIMEOUT: Duration = Duration::from_secs(10);

/// Tauri's `app_cache_dir()` resolves to `activity.cacheDir` on Android. That is
/// verified, not assumed: `tauri-2.10.3/mobile/android/.../PathPlugin.kt`
/// answers `getCacheDir` with `activity.cacheDir.absolutePath`. Android reclaims
/// that directory under storage pressure while the app is running and does not
/// tell the app. A 4GB payload on a stick with roughly 5GB usable makes that the
/// ordinary case, not an edge case, so the engine root has to come from
/// `app_data_dir()`, which the same file answers with `activity.dataDir`.
pub fn engine_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(ENGINE_SUBDIR)
}

/// Session-level peer defaults. These are the same numbers `ensure_added`
/// already passes per torrent, hoisted so any path that adds a torrent without
/// explicit options still gets them rather than librqbit's longer defaults.
pub fn peer_opts() -> PeerConnectionOptions {
    PeerConnectionOptions {
        connect_timeout: Some(PEER_CONNECT_TIMEOUT),
        read_write_timeout: Some(PEER_READ_WRITE_TIMEOUT),
        keep_alive_interval: None,
    }
}

/// Android counterpart to `torrent_engine::new_session`'s `SessionOptions`.
/// Same four-argument shape and the same tier semantics, so the tier ladder in
/// `init` works unchanged: `full` means try inbound plus UPnP, `dht` and
/// `persist_dht` step down from there.
///
/// `trackers` is passed in rather than read from `torrent_engine::trackers`
/// so this module stays free of crate-internal state and can be tested.
pub fn session_options(
    dir: &Path,
    full: bool,
    dht: bool,
    persist_dht: bool,
    trackers: HashSet<url::Url>,
) -> SessionOptions {
    SessionOptions {
        fastresume: true,
        persistence: Some(SessionPersistenceConfig::Json {
            folder: Some(dir.to_path_buf()),
        }),
        disable_dht: !dht,
        disable_dht_persistence: !persist_dht,
        // config_filename is a FILE, not a folder. Handing librqbit a directory
        // here is the one Android-specific defect its maintainer named when he
        // reported running rqbit on Android (ikatson/rqbit#518). Desktop already
        // gets this right; keep it right.
        dht_config: persist_dht.then(|| PersistentDhtConfig {
            config_filename: Some(dir.join("dht.json")),
            dump_interval: None,
        }),
        trackers,
        listen_port_range: full.then(|| LISTEN_PORT_RANGE),
        enable_upnp_port_forwarding: full,
        peer_opts: Some(peer_opts()),
        ratelimits: LimitsConfig {
            upload_bps: NonZeroU32::new(MAX_UPLOAD_BPS),
            download_bps: None,
        },
        ..Default::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir() -> PathBuf {
        PathBuf::from("/data/user/0/com.harbor.app/engine")
    }

    #[test]
    fn engine_root_hangs_off_the_data_dir_not_the_cache_dir() {
        let root = engine_root(Path::new("/data/user/0/com.harbor.app"));
        assert_eq!(
            root,
            PathBuf::from("/data/user/0/com.harbor.app").join("engine")
        );
        assert!(!root.to_string_lossy().contains("cache"));
    }

    #[test]
    fn tier1_takes_inbound_and_upnp() {
        let o = session_options(&dir(), true, true, true, HashSet::new());
        assert_eq!(o.listen_port_range, Some(LISTEN_PORT_RANGE));
        assert!(o.enable_upnp_port_forwarding);
        assert!(!o.disable_dht);
        assert!(!o.disable_dht_persistence);
    }

    #[test]
    fn tier2_drops_inbound_but_keeps_dht() {
        let o = session_options(&dir(), false, true, true, HashSet::new());
        assert_eq!(o.listen_port_range, None);
        assert!(!o.enable_upnp_port_forwarding);
        assert!(!o.disable_dht);
    }

    #[test]
    fn tier4_disables_dht_and_writes_no_dht_json() {
        let o = session_options(&dir(), false, false, false, HashSet::new());
        assert!(o.disable_dht);
        assert!(o.disable_dht_persistence);
        assert!(o.dht_config.is_none());
    }

    #[test]
    fn dht_persistence_target_is_a_file() {
        let o = session_options(&dir(), true, true, true, HashSet::new());
        let path = o
            .dht_config
            .and_then(|c| c.config_filename)
            .expect("tier1 persists dht");
        assert_eq!(path, dir().join("dht.json"));
        assert_eq!(path.extension().and_then(|e| e.to_str()), Some("json"));
    }

    #[test]
    fn upload_is_capped_and_download_is_not() {
        let o = session_options(&dir(), true, true, true, HashSet::new());
        assert_eq!(o.ratelimits.upload_bps, NonZeroU32::new(MAX_UPLOAD_BPS));
        assert!(o.ratelimits.download_bps.is_none());
    }

    #[test]
    fn persistence_folder_is_the_engine_dir() {
        let o = session_options(&dir(), true, true, true, HashSet::new());
        match o.persistence {
            Some(SessionPersistenceConfig::Json { folder }) => {
                assert_eq!(folder, Some(dir()))
            }
            _ => panic!("expected json persistence"),
        }
    }
}
