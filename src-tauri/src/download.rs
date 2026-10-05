use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use serde::Serialize;
use tauri::ipc::Channel;
use tauri::State;
use tokio::io::AsyncWriteExt;

pub struct DownloadState {
    tasks: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl DownloadState {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DownloadEvent {
    Started { total: Option<u64>, resumed: u64 },
    Progress { received: u64, total: Option<u64> },
    Done { received: u64 },
    Error { message: String },
    Canceled { received: u64 },
}

enum DownloadEnd {
    Canceled(u64),
    Failed(String),
}

const EMIT_INTERVAL_MS: u128 = 250;
const EMIT_BYTES: u64 = 4 * 1024 * 1024;
const MIN_VIDEO_BYTES: u64 = 512 * 1024;
const BROWSER_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

fn total_from_content_range(value: &str) -> Option<u64> {
    value
        .rsplit('/')
        .next()
        .and_then(|s| s.trim().parse::<u64>().ok())
}

fn enforce_size_limit(size: u64, max_size_bytes: Option<u64>) -> Result<(), DownloadEnd> {
    if max_size_bytes.is_some_and(|limit| limit > 0 && size > limit) {
        return Err(DownloadEnd::Failed(
            "This source exceeds your maximum stream size. Change the limit in Streaming sources or choose a smaller source.".into(),
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn download_start(
    state: State<'_, DownloadState>,
    id: String,
    url: String,
    dest: String,
    headers: Option<HashMap<String, String>>,
    on_event: Channel<DownloadEvent>,
    max_size_bytes: Option<u64>,
) -> Result<(), String> {
    let cancel = Arc::new(AtomicBool::new(false));
    state
        .tasks
        .lock()
        .unwrap()
        .insert(id.clone(), cancel.clone());

    let outcome = run_download(
        &url,
        &dest,
        &headers.unwrap_or_default(),
        &cancel,
        &on_event,
        max_size_bytes,
    )
    .await;
    state.tasks.lock().unwrap().remove(&id);

    match outcome {
        Ok(()) => Ok(()),
        Err(DownloadEnd::Canceled(received)) => {
            let _ = on_event.send(DownloadEvent::Canceled { received });
            Ok(())
        }
        Err(DownloadEnd::Failed(message)) => {
            let _ = on_event.send(DownloadEvent::Error {
                message: message.clone(),
            });
            Err(message)
        }
    }
}

#[tauri::command]
pub fn download_cancel(state: State<'_, DownloadState>, id: String) {
    if let Some(flag) = state.tasks.lock().unwrap().get(&id) {
        flag.store(true, Ordering::Relaxed);
    }
}

async fn run_download(
    url: &str,
    dest: &str,
    headers: &HashMap<String, String>,
    cancel: &Arc<AtomicBool>,
    on_event: &Channel<DownloadEvent>,
    max_size_bytes: Option<u64>,
) -> Result<(), DownloadEnd> {
    let part = format!("{}.part", dest);

    if let Some(parent) = std::path::Path::new(dest).parent() {
        if !parent.as_os_str().is_empty() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| DownloadEnd::Failed(format!("create folder: {}", e)))?;
        }
    }

    let start_byte = match tokio::fs::metadata(&part).await {
        Ok(meta) => meta.len(),
        Err(_) => 0,
    };
    enforce_size_limit(start_byte, max_size_bytes)?;

    let client = reqwest::Client::builder()
        .user_agent(BROWSER_UA)
        .build()
        .map_err(|e| DownloadEnd::Failed(format!("client: {}", e)))?;
    let has = |name: &str| headers.keys().any(|k| k.eq_ignore_ascii_case(name));
    let mut req = client.get(url);
    if !has("accept") {
        req = req.header(reqwest::header::ACCEPT, "*/*");
    }
    for (k, v) in headers {
        req = req.header(k.as_str(), v.as_str());
    }
    if start_byte > 0 {
        req = req.header(reqwest::header::RANGE, format!("bytes={}-", start_byte));
    } else if !has("range") {
        req = req.header(reqwest::header::RANGE, "bytes=0-");
    }
    eprintln!(
        "[harbor::download] GET {} resume-from={}",
        log_host(url),
        start_byte
    );
    let resp = tokio::select! {
        biased;
        _ = wait_cancelled(cancel) => return Err(DownloadEnd::Canceled(start_byte)),
        r = req.send() => r.map_err(|e| DownloadEnd::Failed(format!("request: {}", e)))?,
    };
    let status = resp.status();
    eprintln!(
        "[harbor::download] status={} content-length={:?}",
        status.as_u16(),
        resp.content_length()
    );

    if status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE && start_byte > 0 {
        let _ = tokio::fs::rename(&part, dest).await;
        let _ = on_event.send(DownloadEvent::Done {
            received: start_byte,
        });
        return Ok(());
    }
    if !status.is_success() {
        eprintln!(
            "[harbor::download] upstream rejected: HTTP {}",
            status.as_u16()
        );
        return Err(DownloadEnd::Failed(format!("HTTP {}", status.as_u16())));
    }

    let total = resp
        .headers()
        .get(reqwest::header::CONTENT_RANGE)
        .and_then(|h| h.to_str().ok())
        .and_then(total_from_content_range)
        .or_else(|| resp.content_length());
    if let Some(size) = total {
        enforce_size_limit(size, max_size_bytes)?;
    }

    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_lowercase();
    let declared = resp.content_length();
    eprintln!(
        "[harbor::download] content-type={} content-length={:?}",
        content_type, declared
    );
    let non_video = content_type.starts_with("text/")
        || content_type.contains("html")
        || content_type.contains("json")
        || content_type.contains("xml");
    if non_video || declared.map(|n| n < 65_536).unwrap_or(false) {
        let body = resp.text().await.unwrap_or_default();
        let snippet: String = body.chars().take(500).collect();
        eprintln!(
            "[harbor::download] NON-VIDEO response ({} bytes): {}",
            body.len(),
            snippet
        );
        return Err(DownloadEnd::Failed(format!(
            "source returned a {} page, not the video: {}",
            if content_type.is_empty() {
                "small"
            } else {
                content_type.as_str()
            },
            snippet.chars().take(160).collect::<String>()
        )));
    }

    let resuming = start_byte > 0 && status == reqwest::StatusCode::PARTIAL_CONTENT;

    let mut received = if resuming { start_byte } else { 0 };
    let file = if resuming {
        tokio::fs::OpenOptions::new().append(true).open(&part).await
    } else {
        tokio::fs::File::create(&part).await
    }
    .map_err(|e| DownloadEnd::Failed(format!("open: {}", e)))?;
    let mut writer = tokio::io::BufWriter::with_capacity(1 << 20, file);

    let _ = on_event.send(DownloadEvent::Started {
        total,
        resumed: received,
    });

    let mut stream = resp.bytes_stream();
    let mut last = Instant::now();
    let mut since: u64 = 0;
    loop {
        let next = tokio::select! {
            biased;
            _ = wait_cancelled(cancel) => {
                let _ = writer.flush().await;
                return Err(DownloadEnd::Canceled(received));
            }
            n = stream.next() => n,
        };
        let Some(chunk) = next else { break };
        let bytes = chunk.map_err(|e| DownloadEnd::Failed(format!("stream: {}", e)))?;
        if let Err(error) =
            enforce_size_limit(received.saturating_add(bytes.len() as u64), max_size_bytes)
        {
            let _ = writer.flush().await;
            return Err(error);
        }
        writer
            .write_all(&bytes)
            .await
            .map_err(|e| DownloadEnd::Failed(format!("write: {}", e)))?;
        received += bytes.len() as u64;
        since += bytes.len() as u64;
        if last.elapsed().as_millis() >= EMIT_INTERVAL_MS || since >= EMIT_BYTES {
            let _ = on_event.send(DownloadEvent::Progress { received, total });
            last = Instant::now();
            since = 0;
        }
    }

    let _ = writer.flush().await;
    drop(writer);

    if received < MIN_VIDEO_BYTES {
        eprintln!(
            "[harbor::download] refusing {} bytes (not a video file)",
            received
        );
        let _ = tokio::fs::remove_file(&part).await;
        return Err(DownloadEnd::Failed(format!(
            "source returned only {} bytes, not the video (try a different source)",
            received
        )));
    }

    tokio::fs::rename(&part, dest)
        .await
        .map_err(|e| DownloadEnd::Failed(format!("rename: {}", e)))?;

    eprintln!("[harbor::download] done {} bytes -> {}", received, dest);
    let _ = on_event.send(DownloadEvent::Progress { received, total });
    let _ = on_event.send(DownloadEvent::Done { received });
    Ok(())
}

async fn wait_cancelled(cancel: &Arc<AtomicBool>) {
    while !cancel.load(Ordering::Relaxed) {
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
}

fn log_host(url: &str) -> String {
    match url.split_once("://") {
        Some((scheme, rest)) => format!("{}://{}/…", scheme, rest.split('/').next().unwrap_or("")),
        None => url.chars().take(48).collect(),
    }
}

#[cfg(test)]
mod size_limit_tests {
    use super::*;
    use tokio::io::AsyncReadExt;

    #[tokio::test]
    async fn oversized_response_is_rejected_before_a_partial_file_is_created() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = [0_u8; 4096];
            let _ = socket.read(&mut request).await;
            socket.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: video/mp4\r\nContent-Length: 80530636800\r\nConnection: close\r\n\r\n").await.unwrap();
        });
        let destination = std::env::temp_dir().join(format!(
            "harbor-size-limit-{}-{}.mkv",
            std::process::id(),
            address.port()
        ));
        let events = Channel::new(|_| Ok(()));
        let result = run_download(
            &format!("http://{address}/movie"),
            destination.to_str().unwrap(),
            &HashMap::new(),
            &Arc::new(AtomicBool::new(false)),
            &events,
            Some(10 * 1024_u64.pow(3)),
        )
        .await;
        assert!(
            matches!(result, Err(DownloadEnd::Failed(message)) if message.contains("maximum stream size"))
        );
        assert!(!destination.exists());
        assert!(!std::path::Path::new(&format!("{}.part", destination.display())).exists());
        server.await.unwrap();
    }
}
