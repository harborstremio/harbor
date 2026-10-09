//! Keep Music's YouTube extractor current without replacing the bundled fallback.
//! Every executable is matched to the official release's SHA-256 manifest before use.

use crate::trailer::YtDlpOutput;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Mutex;

const RELEASE_API: &str = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
const CHECK_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);
const RETRY_INTERVAL: Duration = Duration::from_secs(5 * 60);
const UPDATE_TIMEOUT: Duration = Duration::from_secs(20);
const METADATA_TIMEOUT: Duration = Duration::from_secs(4);
const MAX_BINARY: usize = 96 * 1024 * 1024;
const MAX_METADATA: usize = 1024 * 1024;
const MAX_CHECKSUMS: usize = 256 * 1024;
const MANIFEST: &str = "verified-release.json";
static UPDATE_GATE: LazyLock<Mutex<Option<Instant>>> = LazyLock::new(|| Mutex::new(None));

#[derive(Clone, Deserialize, Serialize)]
struct CachedRelease {
    version: String,
    asset: String,
    sha256: String,
    checked_at: u64,
}

impl CachedRelease {
    fn filename(&self) -> Option<String> {
        if !safe_version(&self.version)
            || Some(self.asset.as_str()) != platform_asset()
            || !valid_digest(&self.sha256)
        {
            return None;
        }
        Some(format!("{}-{}", self.version, self.asset))
    }

    fn fresh(&self, now: u64) -> bool {
        now >= self.checked_at && now - self.checked_at < CHECK_INTERVAL.as_secs()
    }
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

/// One total deadline includes a remote attempt and the existing bundled fallback.
pub async fn run(
    app: &tauri::AppHandle,
    args: Vec<String>,
    timeout: Duration,
    label: &str,
) -> Result<YtDlpOutput, String> {
    tokio::time::timeout(timeout, run_with_fallback(app, args, timeout, label))
        .await
        .map_err(|_| "YouTube Music timed out while resolving this track.".to_string())?
}

async fn run_with_fallback(
    app: &tauri::AppHandle,
    args: Vec<String>,
    timeout: Duration,
    label: &str,
) -> Result<YtDlpOutput, String> {
    let started = Instant::now();
    let directory = app
        .path()
        .app_cache_dir()
        .ok()
        .map(|path| path.join("music/yt-dlp"));
    let remote = match directory {
        Some(directory) => cached_executable(&directory).await,
        None => None,
    };
    if let Some(executable) = remote {
        // Reserve time for the bundled helper when the current release cannot run.
        let budget = timeout.saturating_sub(started.elapsed()).mul_f32(0.65);
        if let Ok(output) = execute(&executable, &args, budget).await {
            if output.success {
                return Ok(output);
            }
        }
    }
    let remaining = timeout.saturating_sub(started.elapsed());
    let output = crate::trailer::run_yt_dlp(app, args, remaining, label).await?;
    if output.success {
        Ok(output)
    } else {
        Err(
            "YouTube Music could not resolve this track. Try again or choose another source."
                .to_string(),
        )
    }
}

async fn execute(path: &Path, args: &[String], timeout: Duration) -> Result<YtDlpOutput, ()> {
    let mut command = tokio::process::Command::new(path);
    command.args(args).kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    let output = tokio::time::timeout(timeout, command.output())
        .await
        .map_err(|_| ())?
        .map_err(|_| ())?;
    Ok(YtDlpOutput {
        success: output.status.success(),
        exit_code: output.status.code(),
        stdout: output.stdout,
        stderr: output.stderr,
    })
}

async fn cached_executable(directory: &Path) -> Option<PathBuf> {
    let mut attempted = UPDATE_GATE.lock().await;
    let cached = read_verified(directory).await;
    let cached_path = cached
        .as_ref()
        .and_then(|entry| entry.filename())
        .map(|name| directory.join(name));
    if cached
        .as_ref()
        .is_some_and(|entry| entry.fresh(now_seconds()))
        || attempted.is_some_and(|stamp| stamp.elapsed() < RETRY_INTERVAL)
    {
        return cached_path;
    }
    *attempted = Some(Instant::now());
    match tokio::time::timeout(UPDATE_TIMEOUT, refresh(directory, cached.as_ref())).await {
        Ok(Ok(path)) => Some(path),
        _ => cached_path,
    }
}

async fn read_verified(directory: &Path) -> Option<CachedRelease> {
    let manifest = read_limited(&directory.join(MANIFEST), MAX_METADATA).await?;
    let entry: CachedRelease = serde_json::from_slice(&manifest).ok()?;
    let filename = entry.filename()?;
    let bytes = read_limited(&directory.join(filename), MAX_BINARY).await?;
    digest_matches(&bytes, &entry.sha256).then_some(entry)
}

async fn read_limited(path: &Path, limit: usize) -> Option<Vec<u8>> {
    let metadata = tokio::fs::metadata(path).await.ok()?;
    if !metadata.is_file() || metadata.len() > limit as u64 {
        return None;
    }
    let file = tokio::fs::File::open(path).await.ok()?;
    let mut bytes = Vec::new();
    file.take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .await
        .ok()?;
    (bytes.len() <= limit).then_some(bytes)
}

async fn refresh(directory: &Path, cached: Option<&CachedRelease>) -> Result<PathBuf, ()> {
    let asset_name = platform_asset().ok_or(())?;
    let client = reqwest::Client::builder()
        .user_agent("Harbor-Music")
        .connect_timeout(Duration::from_secs(3))
        .timeout(UPDATE_TIMEOUT)
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            let url = attempt.url();
            if attempt.previous().len() < 5
                && url.scheme() == "https"
                && matches!(
                    url.host_str(),
                    Some(
                        "github.com"
                            | "release-assets.githubusercontent.com"
                            | "objects.githubusercontent.com"
                    )
                )
            {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(|_| ())?;
    let metadata = fetch_limited(&client, RELEASE_API, MAX_METADATA, METADATA_TIMEOUT).await?;
    let release: Release = serde_json::from_slice(&metadata).map_err(|_| ())?;
    if !safe_version(&release.tag_name) {
        return Err(());
    }
    if let Some(cached) = cached.filter(|entry| entry.version == release.tag_name) {
        let mut renewed = cached.clone();
        renewed.checked_at = now_seconds();
        save_manifest(directory, &renewed).await?;
        return Ok(directory.join(renewed.filename().ok_or(())?));
    }
    let asset_url = release_url(&release, asset_name).ok_or(())?;
    let checksum_url = release_url(&release, "SHA2-256SUMS").ok_or(())?;
    let checksum_body =
        fetch_limited(&client, checksum_url, MAX_CHECKSUMS, METADATA_TIMEOUT).await?;
    let expected = checksum_for(
        std::str::from_utf8(&checksum_body).map_err(|_| ())?,
        asset_name,
    )
    .ok_or(())?;
    let bytes = fetch_limited(&client, asset_url, MAX_BINARY, UPDATE_TIMEOUT).await?;
    if !digest_matches(&bytes, &expected) {
        return Err(());
    }
    let entry = CachedRelease {
        version: release.tag_name.clone(),
        asset: asset_name.to_string(),
        sha256: expected,
        checked_at: now_seconds(),
    };
    tokio::fs::create_dir_all(directory).await.map_err(|_| ())?;
    let path = directory.join(entry.filename().ok_or(())?);
    atomic_write(&path, &bytes, true).await?;
    save_manifest(directory, &entry).await?;
    if let Some(previous) = cached
        .and_then(CachedRelease::filename)
        .map(|name| directory.join(name))
    {
        if previous != path {
            // A process may still be using this release; failure leaves it intact.
            let _ = tokio::fs::remove_file(previous).await;
        }
    }
    Ok(path)
}

async fn fetch_limited(
    client: &reqwest::Client,
    url: &str,
    limit: usize,
    timeout: Duration,
) -> Result<Vec<u8>, ()> {
    let mut response = client
        .get(url)
        .timeout(timeout)
        .send()
        .await
        .map_err(|_| ())?
        .error_for_status()
        .map_err(|_| ())?;
    if response
        .content_length()
        .is_some_and(|length| length > limit as u64)
    {
        return Err(());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| ())? {
        if chunk.len() > limit.saturating_sub(bytes.len()) {
            return Err(());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

async fn save_manifest(directory: &Path, entry: &CachedRelease) -> Result<(), ()> {
    let bytes = serde_json::to_vec(entry).map_err(|_| ())?;
    atomic_write(&directory.join(MANIFEST), &bytes, false).await
}

struct PartialFile(PathBuf);
impl Drop for PartialFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

async fn atomic_write(path: &Path, bytes: &[u8], executable: bool) -> Result<(), ()> {
    let temporary = PartialFile(path.with_extension(format!("{}.part", uuid::Uuid::new_v4())));
    let mut file = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary.0)
        .await
        .map_err(|_| ())?;
    file.write_all(bytes).await.map_err(|_| ())?;
    file.flush().await.map_err(|_| ())?;
    drop(file);
    #[cfg(unix)]
    if executable {
        use std::os::unix::fs::PermissionsExt;
        tokio::fs::set_permissions(&temporary.0, std::fs::Permissions::from_mode(0o755))
            .await
            .map_err(|_| ())?;
    }
    #[cfg(not(unix))]
    let _ = executable;
    tokio::fs::rename(&temporary.0, path).await.map_err(|_| ())
}

fn release_url<'a>(release: &'a Release, asset: &str) -> Option<&'a str> {
    let expected = format!(
        "https://github.com/yt-dlp/yt-dlp/releases/download/{}/{asset}",
        release.tag_name
    );
    release
        .assets
        .iter()
        .find(|candidate| candidate.name == asset && candidate.browser_download_url == expected)
        .map(|candidate| candidate.browser_download_url.as_str())
}

fn checksum_for(manifest: &str, asset: &str) -> Option<String> {
    manifest.lines().find_map(|line| {
        let mut fields = line.split_whitespace();
        let digest = fields.next()?;
        let filename = fields.next()?.trim_start_matches('*');
        (filename == asset && fields.next().is_none() && valid_digest(digest))
            .then(|| digest.to_ascii_lowercase())
    })
}

fn valid_digest(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn digest_matches(bytes: &[u8], expected: &str) -> bool {
    valid_digest(expected) && format!("{:x}", Sha256::digest(bytes)).eq_ignore_ascii_case(expected)
}

fn safe_version(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 40
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || byte == b'.')
        && value.bytes().any(|byte| byte.is_ascii_digit())
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn platform_asset() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => Some("yt-dlp.exe"),
        ("windows", "aarch64") => Some("yt-dlp_arm64.exe"),
        ("macos", "x86_64" | "aarch64") => Some("yt-dlp_macos"),
        ("linux", "x86_64") => Some("yt-dlp_linux"),
        ("linux", "aarch64") => Some("yt-dlp_linux_aarch64"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checksums_match_the_exact_official_asset_and_reject_changed_bytes() {
        let digest = format!("{:x}", Sha256::digest(b"verified extractor"));
        let manifest = format!("{digest}  yt-dlp.exe\n{digest}  yt-dlp_linux\n");
        assert_eq!(
            checksum_for(&manifest, "yt-dlp.exe").as_deref(),
            Some(digest.as_str())
        );
        assert!(checksum_for(&manifest, "yt-dlp").is_none());
        assert!(checksum_for("bad  yt-dlp.exe", "yt-dlp.exe").is_none());
        assert!(digest_matches(b"verified extractor", &digest));
        assert!(!digest_matches(b"changed extractor", &digest));
    }

    #[test]
    fn release_assets_require_the_exact_official_https_location() {
        let mut release = Release {
            tag_name: "2026.08.19".into(),
            assets: vec![Asset {
                name: "yt-dlp.exe".into(),
                browser_download_url:
                    "https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/yt-dlp.exe"
                        .into(),
            }],
        };
        assert!(release_url(&release, "yt-dlp.exe").is_some());
        release.assets[0].browser_download_url = "https://example.com/yt-dlp.exe".into();
        assert!(release_url(&release, "yt-dlp.exe").is_none());
        assert!(!safe_version("../2026.08.19"));
        assert!(!safe_version("2026.08.19/evil"));
    }

    #[tokio::test]
    async fn a_cached_release_is_verified_again_before_use() {
        let directory =
            std::env::temp_dir().join(format!("harbor-ytdlp-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&directory)
            .await
            .expect("fixture directory");
        let entry = CachedRelease {
            version: "2026.08.19".into(),
            asset: platform_asset().expect("desktop fixture").into(),
            sha256: format!("{:x}", Sha256::digest(b"verified extractor")),
            checked_at: 1000,
        };
        let path = directory.join(entry.filename().expect("safe filename"));
        atomic_write(&path, b"verified extractor", false)
            .await
            .expect("fixture binary");
        save_manifest(&directory, &entry)
            .await
            .expect("fixture manifest");
        assert!(read_verified(&directory).await.is_some());
        assert!(entry.fresh(1000 + CHECK_INTERVAL.as_secs() - 1));
        assert!(!entry.fresh(1000 + CHECK_INTERVAL.as_secs()));
        assert!(!entry.fresh(999));
        tokio::fs::write(&path, b"changed extractor")
            .await
            .expect("tamper fixture");
        assert!(read_verified(&directory).await.is_none());
        tokio::fs::remove_file(path)
            .await
            .expect("remove fixture binary");
        tokio::fs::remove_file(directory.join(MANIFEST))
            .await
            .expect("remove fixture manifest");
        tokio::fs::remove_dir(directory)
            .await
            .expect("remove fixture directory");
    }
}
