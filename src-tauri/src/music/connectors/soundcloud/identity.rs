use super::client;
use futures_util::stream::{FuturesUnordered, StreamExt};
use regex::Regex;
use std::future::Future;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{LazyLock, OnceLock, RwLock};
use std::time::Duration;
use tauri::Manager;
use tokio::sync::{Mutex, OnceCell};

const CACHE_FILE: &str = "soundcloud-client-id";
const HOME: &str = "https://soundcloud.com/";
const BUNDLE_HEAD: &str = "bytes=0-50000";
const MAX_BUNDLES: usize = 6;
const ID_LENGTH: usize = 32;
const SCRAPE_BUDGET: Duration = Duration::from_secs(5);
const PAGE_TIMEOUT: Duration = Duration::from_secs(2);
const BUNDLE_TIMEOUT: Duration = Duration::from_secs(2);

static CACHE_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();
static PRIMED: OnceCell<()> = OnceCell::const_new();
static CLIENT_ID: LazyLock<RwLock<Option<String>>> = LazyLock::new(|| RwLock::new(None));
static WARMING: AtomicBool = AtomicBool::new(false);
static SCRAPE_GATE: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

static SCRIPT_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"https://a-v2\.sndcdn\.com/assets/[A-Za-z0-9._~/-]+\.js")
        .expect("soundcloud script pattern")
});

static CLIENT_ID_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new("client_id\\s*:\\s*\"([0-9a-zA-Z]{32})\"").expect("soundcloud client id pattern")
});

pub async fn attach(app: &tauri::AppHandle) -> Option<String> {
    let _ = CACHE_PATH.set(
        app.path()
            .app_data_dir()
            .ok()
            .map(|directory| directory.join(CACHE_FILE)),
    );
    PRIMED.get_or_init(prime).await;
    cached()
}

pub fn cached() -> Option<String> {
    CLIENT_ID.read().ok().and_then(|slot| slot.clone())
}

pub async fn ensure() -> Result<String, String> {
    if let Some(found) = cached() {
        return Ok(found);
    }
    let _gate = SCRAPE_GATE.lock().await;
    if let Some(found) = cached() {
        return Ok(found);
    }
    let scraped = scrape().await?;
    remember(&scraped).await;
    Ok(scraped)
}

pub fn warm() {
    if cached().is_some() || WARMING.swap(true, Ordering::SeqCst) {
        return;
    }
    tauri::async_runtime::spawn(async {
        let _ = ensure().await;
        WARMING.store(false, Ordering::SeqCst);
    });
}

pub async fn invalidate(stale: &str) {
    let dropped = match CLIENT_ID.write() {
        Ok(mut slot) if slot.as_deref() == Some(stale) => {
            *slot = None;
            true
        }
        _ => false,
    };
    if !dropped {
        return;
    }
    if let Some(path) = cache_path() {
        let _ = tokio::fs::remove_file(path).await;
    }
}

async fn prime() {
    let Some(path) = cache_path() else {
        return;
    };
    let Ok(raw) = tokio::fs::read_to_string(&path).await else {
        return;
    };
    if usable(raw.trim()) {
        hold(raw.trim());
    }
}

async fn remember(value: &str) {
    hold(value);
    let Some(path) = cache_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let _ = tokio::fs::write(path, value).await;
}

fn hold(value: &str) {
    if let Ok(mut slot) = CLIENT_ID.write() {
        *slot = Some(value.to_string());
    }
}

fn cache_path() -> Option<PathBuf> {
    CACHE_PATH.get().cloned().flatten()
}

async fn scrape() -> Result<String, String> {
    match tokio::time::timeout(SCRAPE_BUDGET, walk_the_web_app()).await {
        Ok(result) => result,
        Err(_) => Err("SoundCloud timed out while publishing a client id".to_string()),
    }
}

async fn walk_the_web_app() -> Result<String, String> {
    let http = client::http()?;
    let html = http
        .get(HOME)
        .timeout(PAGE_TIMEOUT)
        .send()
        .await
        .map_err(|error| format!("SoundCloud request failed: {error}"))?
        .text()
        .await
        .map_err(|error| format!("SoundCloud response was invalid: {error}"))?;
    let missing = || "SoundCloud did not publish a usable client id".to_string();
    let bundles = bundle_candidates(&html);
    if bundles.is_empty() {
        return Err(missing());
    }
    first_id(bundles, |url| {
        let http = http.clone();
        async move { bundle_head(&http, &url).await }
    })
    .await
    .ok_or_else(missing)
}

async fn bundle_head(http: &reqwest::Client, url: &str) -> Option<String> {
    http.get(url)
        .header("Range", BUNDLE_HEAD)
        .timeout(BUNDLE_TIMEOUT)
        .send()
        .await
        .ok()?
        .text()
        .await
        .ok()
}

async fn first_id<F, R>(urls: Vec<String>, load: F) -> Option<String>
where
    F: Fn(String) -> R,
    R: Future<Output = Option<String>>,
{
    let mut pending = urls.into_iter().map(load).collect::<FuturesUnordered<_>>();
    while let Some(body) = pending.next().await {
        if let Some(found) = body.as_deref().and_then(id_from_bundle) {
            return Some(found);
        }
    }
    None
}

fn bundle_candidates(html: &str) -> Vec<String> {
    let mut urls = Vec::new();
    for found in SCRIPT_PATTERN.find_iter(html) {
        let url = found.as_str().to_string();
        if !urls.contains(&url) {
            urls.push(url);
        }
    }
    urls.reverse();
    urls.truncate(MAX_BUNDLES);
    urls
}

fn id_from_bundle(body: &str) -> Option<String> {
    CLIENT_ID_PATTERN
        .captures(body)
        .map(|captures| captures[1].to_string())
}

fn usable(value: &str) -> bool {
    value.len() == ID_LENGTH
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    use std::sync::Arc;
    use std::time::Instant;

    const PAGE: &str = r#"<html><head>
<script crossorigin src="https://a-v2.sndcdn.com/assets/0-b5c1a2f4.js"></script>
<script crossorigin src="https://a-v2.sndcdn.com/assets/2-9d0e1122.js"></script>
<script crossorigin src="https://a-v2.sndcdn.com/assets/0-b5c1a2f4.js"></script>
<script crossorigin src="https://a-v2.sndcdn.com/assets/55-70f3b3d1.js"></script>
<script src="https://widget.sndcdn.com/other.js"></script>
</head></html>"#;

    const BUNDLE: &str = r#"n.exports={api:{v2:"https://api-v2.soundcloud.com"},
client_id:"a3e059563d7fd3372b49b37f00a00bcf",app_version:"1725012345"}"#;

    const CROWDED: &str = r#"<html>
<script src="https://a-v2.sndcdn.com/assets/1.js"></script>
<script src="https://a-v2.sndcdn.com/assets/2.js"></script>
<script src="https://a-v2.sndcdn.com/assets/3.js"></script>
<script src="https://a-v2.sndcdn.com/assets/4.js"></script>
<script src="https://a-v2.sndcdn.com/assets/5.js"></script>
<script src="https://a-v2.sndcdn.com/assets/6.js"></script>
<script src="https://a-v2.sndcdn.com/assets/7.js"></script>
<script src="https://a-v2.sndcdn.com/assets/8.js"></script>
</html>"#;

    #[test]
    fn bundle_candidates_drop_duplicates_and_try_the_last_scripts_first() {
        assert_eq!(
            bundle_candidates(PAGE),
            vec![
                "https://a-v2.sndcdn.com/assets/55-70f3b3d1.js",
                "https://a-v2.sndcdn.com/assets/2-9d0e1122.js",
                "https://a-v2.sndcdn.com/assets/0-b5c1a2f4.js",
            ]
        );
        assert!(bundle_candidates("<html></html>").is_empty());
    }

    #[test]
    fn bundle_candidates_never_exceed_the_cap() {
        let candidates = bundle_candidates(CROWDED);
        assert_eq!(candidates.len(), MAX_BUNDLES);
        assert_eq!(candidates[0], "https://a-v2.sndcdn.com/assets/8.js");
    }

    #[test]
    fn client_id_is_read_out_of_the_web_app_bundle() {
        assert_eq!(
            id_from_bundle(BUNDLE).as_deref(),
            Some("a3e059563d7fd3372b49b37f00a00bcf")
        );
        assert_eq!(id_from_bundle("client_id:\"tooshort\""), None);
        assert_eq!(
            id_from_bundle("client_id:\"a3e059563d7fd3372b49b37f00a00bcf1\""),
            None
        );
        assert_eq!(id_from_bundle("var client_secret = 12;"), None);
    }

    #[test]
    fn client_id_tolerates_whitespace_around_the_assignment() {
        assert_eq!(
            id_from_bundle("client_id : \"0123456789abcdefABCDEF0123456789\"").as_deref(),
            Some("0123456789abcdefABCDEF0123456789")
        );
    }

    #[test]
    fn only_a_thirty_two_character_alphanumeric_id_is_usable() {
        assert!(usable("a3e059563d7fd3372b49b37f00a00bcf"));
        assert!(!usable(""));
        assert!(!usable("a3e059563d7fd3372b49b37f00a00bc"));
        assert!(!usable("a3e059563d7fd3372b49b37f00a00bc-"));
    }

    #[tokio::test]
    async fn the_scan_answers_from_the_first_bundle_that_carries_an_id() {
        let urls = vec!["slow".to_string(), "fast".to_string()];
        let started = Instant::now();
        let found = first_id(urls, |url| async move {
            if url == "slow" {
                tokio::time::sleep(Duration::from_secs(10)).await;
                return Some(BUNDLE.to_string());
            }
            Some("client_id:\"0123456789abcdefABCDEF0123456789\"".to_string())
        })
        .await;
        assert_eq!(found.as_deref(), Some("0123456789abcdefABCDEF0123456789"));
        assert!(started.elapsed() < Duration::from_secs(2));
    }

    #[tokio::test]
    async fn dry_bundles_are_skipped_and_every_candidate_gets_a_turn() {
        let seen = Arc::new(AtomicUsize::new(0));
        let counter = seen.clone();
        let urls = (0..4).map(|index| index.to_string()).collect::<Vec<_>>();
        let found = first_id(urls, move |_| {
            let counter = counter.clone();
            async move {
                counter.fetch_add(1, Ordering::SeqCst);
                Some("var client_secret = 12;".to_string())
            }
        })
        .await;
        assert!(found.is_none());
        assert_eq!(seen.load(Ordering::SeqCst), 4);
    }

    #[tokio::test]
    async fn a_scan_whose_requests_all_fail_reports_nothing() {
        let urls = vec!["a".to_string(), "b".to_string()];
        assert!(first_id(urls, |_| async { None }).await.is_none());
    }

    #[tokio::test]
    async fn the_scan_gives_up_inside_its_budget() {
        let budget = Duration::from_millis(120);
        let urls = vec!["a".to_string(), "b".to_string()];
        let started = Instant::now();
        let outcome = tokio::time::timeout(
            budget,
            first_id(urls, |_| async {
                tokio::time::sleep(Duration::from_secs(30)).await;
                Some(BUNDLE.to_string())
            }),
        )
        .await;
        assert!(outcome.is_err());
        assert!(started.elapsed() < Duration::from_secs(1));
    }

    #[test]
    fn the_scrape_budget_stays_under_the_browse_budget() {
        assert!(SCRAPE_BUDGET < Duration::from_secs(12));
        assert!(PAGE_TIMEOUT + BUNDLE_TIMEOUT <= SCRAPE_BUDGET);
    }
}
