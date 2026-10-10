use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::ipc::Channel;
use tauri::State;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

pub struct DownloadState {
    tasks: Arc<Mutex<HashMap<String, (String, Arc<AtomicBool>)>>>,
}
impl DownloadState {
    pub fn new() -> Self { Self { tasks: Arc::new(Mutex::new(HashMap::new())) } }
}
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DownloadEvent {
    Started { total: Option<u64>, resumed: u64 },
    Progress { received: u64, total: Option<u64> },
    Verifying { received: u64 },
    Done { received: u64 },
    Error { message: String },
    Canceled { received: u64 },
}
#[derive(Debug)]
enum DownloadEnd { Canceled(u64), Failed(String) }
#[derive(Serialize, Deserialize)]
struct PartialIdentity {
    // URLs, headers, cookies and tokens are never written into the sidecar.
    source: String,
    etag: Option<String>,
    total: Option<u64>,
    #[serde(default)]
    digest: Option<String>,
}
const IDLE_TIMEOUT: Duration = Duration::from_secs(30);
const MIN_VIDEO_BYTES: u64 = 512 * 1024;
const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
fn failure(message: &str) -> DownloadEnd { DownloadEnd::Failed(message.to_owned()) }
fn strong_etag(headers: &reqwest::header::HeaderMap) -> Option<String> {
    headers.get(reqwest::header::ETAG)?.to_str().ok()
        .filter(|value| value.starts_with('"') && value.ends_with('"'))
        .map(str::to_owned)
}
fn content_range(value: &str) -> Option<(u64, u64, u64)> {
    let (range, total) = value.strip_prefix("bytes ")?.split_once('/')?;
    let (start, end) = range.split_once('-')?;
    let (start, end, total) = (start.parse().ok()?, end.parse().ok()?, total.parse().ok()?);
    (start <= end && end < total).then_some((start, end, total))
}
fn source_identity(url: &str, headers: &HashMap<String, String>) -> String {
    let mut pairs: Vec<_> = headers.iter().map(|(k, v)| (k.to_ascii_lowercase(), v)).collect();
    pairs.sort();
    let mut hash = Sha256::new();
    hash.update(url.as_bytes());
    for (key, value) in pairs {
        hash.update([0]); hash.update(key.as_bytes()); hash.update([0]); hash.update(value.as_bytes());
    }
    format!("{:x}", hash.finalize())
}

async fn file_digest(path: &str, cancel: &Arc<AtomicBool>, received: u64) -> Result<String, DownloadEnd> {
    let mut file = tokio::fs::File::open(path).await.map_err(|_| failure("Could not verify the saved file"))?;
    let mut buffer = vec![0; 1 << 20];
    let mut hash = Sha256::new();
    loop {
        if cancel.load(Ordering::Relaxed) { return Err(DownloadEnd::Canceled(received)); }
        let count = file.read(&mut buffer).await.map_err(|_| failure("Could not verify the saved file"))?;
        if count == 0 { break; }
        hash.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hash.finalize()))
}

// Recovery reads local bytes only. The completion digest is written after all
// bytes are verified and flushed, before atomic publication. It survives a
// crash between publication and the UI's durable 'done' transition.
#[tauri::command]
pub async fn download_verify(dest: String) -> Result<Option<u64>, String> {
    if !std::path::Path::new(&dest).is_absolute() { return Err("Invalid download path".into()); }
    let Some(size) = crate::transfer_files::ensure_regular(std::path::Path::new(&dest))
        .map_err(|_| "The saved path is not a regular file")? else { return Ok(None); };
    let sidecar = format!("{dest}.part.meta.json");
    crate::transfer_files::ensure_regular(std::path::Path::new(&sidecar))
        .map_err(|_| "The saved state is not a regular file")?;
    let record = tokio::fs::read(sidecar).await.ok().and_then(|bytes| serde_json::from_slice::<PartialIdentity>(&bytes).ok());
    let Some(record) = record.filter(|record| record.digest.is_some()) else { return Ok(None); };
    if record.total != Some(size) { return Err("The saved file size changed".into()); }
    let digest = file_digest(&dest, &Arc::new(AtomicBool::new(false)), size).await
        .map_err(|_| "Could not verify the saved file")?;
    if record.digest.as_deref() != Some(digest.as_str()) { return Err("The saved file failed its integrity check".into()); }
    Ok(Some(size))
}
fn reject_source(url: &str) -> Result<(), DownloadEnd> {
    let parsed = reqwest::Url::parse(url).map_err(|_| failure("Invalid download URL"))?;
    if !["http", "https"].contains(&parsed.scheme()) || !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(failure("Offline downloads require a direct HTTP or HTTPS media file"));
    }
    let path = parsed.path().to_ascii_lowercase();
    if [".m3u8", ".m3u", ".mpd"].iter().any(|ext| path.ends_with(ext)) {
        return Err(failure("Streaming playlists cannot be saved as offline files. Choose a direct, unencrypted source."));
    }
    Ok(())
}
fn unsupported_content(content_type: &str) -> bool {
    content_type.starts_with("text/") || ["html", "json", "xml", "mpegurl", "dash", "cenc"].iter().any(|kind| content_type.contains(kind))
}
fn unsupported_prefix(prefix: &[u8]) -> bool {
    let text = String::from_utf8_lossy(prefix);
    let text = text.trim_start_matches('\u{feff}').trim_start().to_ascii_lowercase();
    if ["#extm3u", "<mpd", "<?xml", "<!doctype html", "<html"].iter().any(|start| text.starts_with(start)) { return true; }
    // Known protected ISO-BMFF initialization boxes: refuse, never decrypt.
    prefix.windows(4).any(|w| w == b"ftyp") && prefix.windows(4).any(|w| w == b"pssh" || w == b"sinf")
}
#[tauri::command]
pub async fn download_start(
    state: State<'_, DownloadState>, id: String, url: String, dest: String,
    headers: Option<HashMap<String, String>>, on_event: Channel<DownloadEvent>, media_kind: Option<String>,
) -> Result<(), String> {
    let cancel = Arc::new(AtomicBool::new(false));
    let destination_key = if cfg!(target_os = "windows") { dest.replace('/', "\\").to_lowercase() } else { dest.clone() };
    {
        let mut tasks = state.tasks.lock().map_err(|_| "Download state unavailable")?;
        if tasks.contains_key(&id) || tasks.values().any(|(path, _)| path == &destination_key) {
            return Err("A download is already writing this file".to_owned());
        }
        tasks.insert(id.clone(), (destination_key, cancel.clone()));
    }
    let outcome = run_download(&url, &dest, &headers.unwrap_or_default(), &cancel,
        &|event| { let _ = on_event.send(event); }, media_kind.as_deref() == Some("audio")).await;
    if let Ok(mut tasks) = state.tasks.lock() { tasks.remove(&id); }
    match outcome {
        Ok(()) => Ok(()),
        Err(DownloadEnd::Canceled(received)) => { let _ = on_event.send(DownloadEvent::Canceled { received }); Ok(()) }
        Err(DownloadEnd::Failed(message)) => {
            let _ = on_event.send(DownloadEvent::Error { message: message.clone() }); Err(message)
        }
    }
}
#[tauri::command]
pub fn download_cancel(state: State<'_, DownloadState>, id: String) {
    if let Ok(tasks) = state.tasks.lock() {
        if let Some((_, flag)) = tasks.get(&id) { flag.store(true, Ordering::Relaxed); }
    }
}
async fn run_download(
    url: &str, dest: &str, headers: &HashMap<String, String>, cancel: &Arc<AtomicBool>,
    emit: &(dyn Fn(DownloadEvent) + Send + Sync), audio: bool,
) -> Result<(), DownloadEnd> {
    reject_source(url)?;
    if !std::path::Path::new(dest).is_absolute() || dest.contains('\0') {
        return Err(failure("Choose an absolute download folder on this device"));
    }
    let part = format!("{dest}.part");
    let sidecar = format!("{part}.meta.json");
    if tokio::fs::try_exists(dest).await.unwrap_or(false) {
        return Err(failure("The destination already exists. Choose another file name."));
    }
    if let Some(parent) = std::path::Path::new(dest).parent().filter(|p| !p.as_os_str().is_empty()) {
        tokio::fs::create_dir_all(parent).await.map_err(|_| failure("Could not create the download folder"))?;
    }
    let source = source_identity(url, headers);
    let existing = crate::transfer_files::ensure_regular(std::path::Path::new(&part))
        .map_err(|_| failure("The partial download is not a regular file"))?.unwrap_or(0);
    crate::transfer_files::ensure_regular(std::path::Path::new(&sidecar))
        .map_err(|_| failure("The download state is not a regular file"))?;
    let saved = tokio::fs::read(&sidecar).await.ok().and_then(|bytes| serde_json::from_slice::<PartialIdentity>(&bytes).ok());
    let saved = saved.filter(|identity| identity.source == source && identity.etag.is_some() && identity.total.is_some_and(|n| n >= existing));
    let mut start = if saved.is_some() { existing } else { 0 };
    let private_headers = headers.keys().any(|key| !["accept", "accept-language", "user-agent", "range", "if-range", "accept-encoding"].contains(&key.to_ascii_lowercase().as_str()));
    let origin = reqwest::Url::parse(url).map_err(|_| failure("Invalid download URL"))?.origin();
    let redirects = reqwest::redirect::Policy::custom(move |attempt| {
        if attempt.previous().len() >= 10 || (private_headers && attempt.url().origin() != origin) { attempt.stop() } else { attempt.follow() }
    });
    let client = reqwest::Client::builder().user_agent(BROWSER_UA).redirect(redirects).no_gzip().connect_timeout(IDLE_TIMEOUT)
        .build().map_err(|_| failure("Could not start the download client"))?;
    // Validation failure gets one clean request. A 416 never proves completion.
    let (response, total) = loop {
        let mut request = client.get(url).header(reqwest::header::ACCEPT, "*/*")
            .header(reqwest::header::ACCEPT_ENCODING, "identity");
        for (key, value) in headers {
            if !["range", "if-range", "accept-encoding", "host", "content-length"].contains(&key.to_ascii_lowercase().as_str()) {
                request = request.header(key.as_str(), value.as_str());
            }
        }
        if start > 0 {
            request = request.header(reqwest::header::RANGE, format!("bytes={start}-"))
                .header(reqwest::header::IF_RANGE, saved.as_ref().unwrap().etag.as_ref().unwrap());
        }
        let response = tokio::select! {
            biased;
            _ = wait_cancelled(cancel) => return Err(DownloadEnd::Canceled(existing)),
            result = tokio::time::timeout(IDLE_TIMEOUT, request.send()) => result
                .map_err(|_| failure("The source timed out. Retry when it is available."))?
                .map_err(|_| failure("Could not connect to the source. Retry or select a fresh source."))?,
        };
        let status = response.status();
        let range = response.headers().get(reqwest::header::CONTENT_RANGE).and_then(|v| v.to_str().ok()).and_then(content_range);
        if start > 0 && status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE { start = 0; continue; }
        if !status.is_success() {
            if status.is_redirection() && private_headers {
                return Err(failure("The source redirected to another origin. Select its direct file URL; private headers cannot be forwarded."));
            }
            return Err(failure(&format!("Source returned HTTP {}. Retry or select a fresh source.", status.as_u16())));
        }
        if status == reqwest::StatusCode::PARTIAL_CONTENT {
            let valid = range.is_some_and(|(first, last, total)| first == start && last + 1 == total
                && response.content_length().map_or(true, |length| length == last - first + 1)
                && (start == 0 || saved.as_ref().is_some_and(|identity| identity.total == Some(total) && identity.etag == strong_etag(response.headers()))));
            if !valid {
                if start > 0 { start = 0; continue; }
                return Err(failure("The source returned an invalid byte range. The file was not saved."));
            }
            break (response, range.map(|(_, _, total)| total));
        }
        if status != reqwest::StatusCode::OK { return Err(failure("The source did not return a complete media file")); }
        start = 0;
        let total = response.content_length();
        break (response, total);
    };
    let content_type = response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or("").to_ascii_lowercase();
    if unsupported_content(&content_type) || response.headers().get(reqwest::header::CONTENT_ENCODING).is_some_and(|v| v != "identity") {
        return Err(failure("The source returned a page, playlist or protected/encoded stream. Choose a direct, unencrypted media file."));
    }
    let mut identity = PartialIdentity { source, etag: strong_etag(response.headers()), total, digest: None };
    if let (Some(total), Some(parent)) = (total, std::path::Path::new(dest).parent()) {
        if crate::transfer_files::free_bytes(parent).is_some_and(|available| available < total.saturating_sub(start)) {
            return Err(failure("There is not enough free space in the download folder"));
        }
    }
    let file = if start > 0 { tokio::fs::OpenOptions::new().append(true).open(&part).await } else { tokio::fs::File::create(&part).await }
        .map_err(|_| failure("Could not write the download file. Check storage and folder access."))?;
    // An invalid or missing sidecar forces a safe restart on the next retry.
    tokio::fs::write(&sidecar, serde_json::to_vec(&identity).map_err(|_| failure("Could not save download state"))?).await
        .map_err(|_| failure("Could not save download state"))?;
    let mut writer = tokio::io::BufWriter::with_capacity(1 << 20, file);
    let mut received = start;
    let mut prefix = Vec::new();
    let mut stream = response.bytes_stream();
    let mut last = Instant::now();
    emit(DownloadEvent::Started { total, resumed: start });
    loop {
        let next = tokio::select! {
            biased;
            _ = wait_cancelled(cancel) => {
                writer.flush().await.map_err(|_| failure("Could not save paused download bytes"))?;
                return Err(DownloadEnd::Canceled(received));
            }
            next = tokio::time::timeout(IDLE_TIMEOUT, stream.next()) => next,
        };
        let bytes = match next {
            Ok(None) => break,
            Ok(Some(Ok(bytes))) => bytes,
            _ => {
                let _ = writer.flush().await;
                return Err(failure("The source stopped sending data. Retry to resume safely."));
            }
        };
        if start == 0 && prefix.len() < 262_144 {
            prefix.extend_from_slice(&bytes[..bytes.len().min(262_144 - prefix.len())]);
            if unsupported_prefix(&prefix) { return Err(failure("This source is a playlist, page or protected media file. Offline saving is unsupported.")); }
        }
        received = received.checked_add(bytes.len() as u64).ok_or_else(|| failure("File size overflow"))?;
        if total.is_some_and(|total| received > total) { return Err(failure("The source sent more data than its declared file size")); }
        writer.write_all(&bytes).await.map_err(|_| failure("Could not write download bytes. Check available storage."))?;
        if last.elapsed() >= Duration::from_millis(250) {
            emit(DownloadEvent::Progress { received, total }); last = Instant::now();
        }
    }
    writer.flush().await.map_err(|_| failure("Could not save the completed download"))?;
    writer.get_ref().sync_all().await.map_err(|_| failure("Could not sync the completed download"))?;
    drop(writer);
    if total.is_some_and(|expected| expected != received) { return Err(failure("The download is incomplete. Retry to resume safely.")); }
    if received < if audio { 1024 } else { MIN_VIDEO_BYTES } {
        return Err(failure("The source returned too little data for a complete media file"));
    }
    if cancel.load(Ordering::Relaxed) { return Err(DownloadEnd::Canceled(received)); }
    emit(DownloadEvent::Verifying { received });
    identity.digest = Some(file_digest(&part, cancel, received).await?);
    identity.total = Some(received);
    let mut completion = tokio::fs::File::create(&sidecar).await
        .map_err(|_| failure("Could not save completed file state"))?;
    completion.write_all(&serde_json::to_vec(&identity).map_err(|_| failure("Could not save completed file state"))?).await
        .map_err(|_| failure("Could not save completed file state"))?;
    // The recovery marker must reach disk before the final file becomes visible.
    completion.sync_all().await.map_err(|_| failure("Could not sync completed file state"))?;
    drop(completion);
    if cancel.load(Ordering::Relaxed) { return Err(DownloadEnd::Canceled(received)); }
    // Same-folder, no-clobber publication is atomic on Windows, including
    // FAT/exFAT. Reuse the game transfer implementation instead of copying into
    // a visible final file (which a crash could leave partially populated).
    crate::transfer_files::publish(std::path::Path::new(&part), std::path::Path::new(dest))
        .map_err(|_| failure("Could not finalize the file without overwriting an existing destination"))?;
    emit(DownloadEvent::Progress { received, total });
    emit(DownloadEvent::Done { received });
    Ok(())
}
async fn wait_cancelled(cancel: &Arc<AtomicBool>) {
    while !cancel.load(Ordering::Relaxed) { tokio::time::sleep(Duration::from_millis(100)).await; }
}
#[cfg(test)]
#[path = "download_tests.rs"]
mod tests;
