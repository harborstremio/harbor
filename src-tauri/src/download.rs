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
    Started {
        total: Option<u64>,
        resumed: u64,
    },
    Progress {
        received: u64,
        total: Option<u64>,
    },
    Retrying {
        attempt: u32,
        #[serde(rename = "delaySeconds")]
        delay_seconds: u64,
    },
    Done {
        received: u64,
    },
    Error {
        message: String,
    },
    Canceled {
        received: u64,
    },
}

trait DownloadEventSink: Sync {
    fn send_event(&self, event: DownloadEvent);
}

impl DownloadEventSink for Channel<DownloadEvent> {
    fn send_event(&self, event: DownloadEvent) {
        let _ = self.send(event);
    }
}

#[derive(Debug)]
enum DownloadEnd {
    Canceled(u64),
    Failed(String),
}

const EMIT_INTERVAL_MS: u128 = 250;
const EMIT_BYTES: u64 = 4 * 1024 * 1024;
const MIN_VIDEO_BYTES: u64 = 512 * 1024;
const RETRY_DELAYS: [Duration; 5] = [
    Duration::from_secs(2),
    Duration::from_secs(5),
    Duration::from_secs(10),
    Duration::from_secs(20),
    Duration::from_secs(30),
];
const RESPONSE_IDLE_TIMEOUT: Duration = Duration::from_secs(45);
const BROWSER_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

fn parse_content_range(value: &str) -> Option<(u64, u64, u64)> {
    let (range, total) = value.strip_prefix("bytes ")?.split_once('/')?;
    let (start, end) = range.split_once('-')?;
    let start = start.parse().ok()?;
    let end = end.parse().ok()?;
    let total = total.parse().ok()?;
    (start <= end && end < total).then_some((start, end, total))
}

fn unsatisfied_range_total(value: &str) -> Option<u64> {
    value
        .strip_prefix("bytes */")
        .and_then(|total| total.trim().parse::<u64>().ok())
}

fn retryable_status(status: reqwest::StatusCode) -> bool {
    status == reqwest::StatusCode::REQUEST_TIMEOUT
        || status == reqwest::StatusCode::TOO_MANY_REQUESTS
        || status.is_server_error()
}

fn retryable_transport(error: &reqwest::Error) -> bool {
    error.is_timeout()
        || error.is_connect()
        || error.is_body()
        || error.is_request()
        || error.is_decode()
}

#[tauri::command]
pub async fn download_start(
    state: State<'_, DownloadState>,
    id: String,
    url: String,
    dest: String,
    headers: Option<HashMap<String, String>>,
    on_event: Channel<DownloadEvent>,
    media_kind: Option<String>,
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
        media_kind.as_deref() == Some("audio"),
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
    on_event: &impl DownloadEventSink,
    audio: bool,
) -> Result<(), DownloadEnd> {
    let part = format!("{}.part", dest);

    if let Some(parent) = std::path::Path::new(dest).parent() {
        if !parent.as_os_str().is_empty() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| DownloadEnd::Failed(format!("create folder: {}", e)))?;
        }
    }

    let client = reqwest::Client::builder()
        .user_agent(BROWSER_UA)
        .connect_timeout(Duration::from_secs(20))
        .read_timeout(RESPONSE_IDLE_TIMEOUT)
        .build()
        .map_err(|e| DownloadEnd::Failed(format!("client: {}", e)))?;
    let has = |name: &str| headers.keys().any(|k| k.eq_ignore_ascii_case(name));
    let mut retries = 0usize;

    loop {
        let start_byte = match tokio::fs::metadata(&part).await {
            Ok(meta) => meta.len(),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => 0,
            Err(error) => return Err(DownloadEnd::Failed(format!("stat partial: {error}"))),
        };
        let mut req = client.get(url);
        if !has("accept") {
            req = req.header(reqwest::header::ACCEPT, "*/*");
        }
        for (k, v) in headers {
            req = req.header(k.as_str(), v.as_str());
        }
        // Force identity after caller headers so Range offsets always describe
        // the bytes stored in the .part file.
        req = req.header(reqwest::header::ACCEPT_ENCODING, "identity");
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
        let response = tokio::select! {
            biased;
            _ = wait_cancelled(cancel) => return Err(DownloadEnd::Canceled(start_byte)),
            result = req.send() => match result {
                Ok(response) => response,
                Err(error) if retryable_transport(&error) => {
                    let message = error.without_url().to_string();
                    retry_or_fail(&message, retries, start_byte, cancel, on_event).await?;
                    retries += 1;
                    continue;
                }
                Err(error) => return Err(DownloadEnd::Failed(format!("request: {}", error.without_url()))),
            },
        };
        let status = response.status();
        eprintln!(
            "[harbor::download] status={} content-length={:?}",
            status.as_u16(),
            response.content_length()
        );

        if status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE && start_byte > 0 {
            let total = response
                .headers()
                .get(reqwest::header::CONTENT_RANGE)
                .and_then(|value| value.to_str().ok())
                .and_then(unsatisfied_range_total);
            if total == Some(start_byte) && start_byte >= minimum_bytes(audio) {
                tokio::fs::rename(&part, dest)
                    .await
                    .map_err(|e| DownloadEnd::Failed(format!("rename: {e}")))?;
                on_event.send_event(DownloadEvent::Done {
                    received: start_byte,
                });
                return Ok(());
            }
            return Err(DownloadEnd::Failed(
                "server rejected the resume range; partial download is incomplete".to_string(),
            ));
        }
        if retryable_status(status) {
            retry_or_fail(
                &format!("HTTP {}", status.as_u16()),
                retries,
                start_byte,
                cancel,
                on_event,
            )
            .await?;
            retries += 1;
            continue;
        }
        if !status.is_success() {
            eprintln!(
                "[harbor::download] upstream rejected: HTTP {}",
                status.as_u16()
            );
            return Err(DownloadEnd::Failed(format!("HTTP {}", status.as_u16())));
        }

        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_lowercase();
        let declared = response.content_length();
        eprintln!(
            "[harbor::download] content-type={} content-length={:?}",
            content_type, declared
        );
        let non_video = content_type.starts_with("text/")
            || content_type.contains("html")
            || content_type.contains("json")
            || content_type.contains("xml");
        if non_video
            || (audio && (content_type.contains("mpegurl") || content_type.contains("dash+xml")))
            || (status != reqwest::StatusCode::PARTIAL_CONTENT
                && declared
                    .map(|n| n < if audio { 1024 } else { 65_536 })
                    .unwrap_or(false))
        {
            eprintln!("[harbor::download] NON-VIDEO response, declared-length={declared:?}");
            return Err(DownloadEnd::Failed(format!(
                "source returned a {} page, not the video",
                if content_type.is_empty() {
                    "small"
                } else {
                    content_type.as_str()
                }
            )));
        }

        let status_is_partial = status == reqwest::StatusCode::PARTIAL_CONTENT;
        let range = if status_is_partial {
            let value = response
                .headers()
                .get(reqwest::header::CONTENT_RANGE)
                .and_then(|h| h.to_str().ok())
                .and_then(parse_content_range)
                .ok_or_else(|| {
                    DownloadEnd::Failed("server returned an invalid Content-Range".to_string())
                })?;
            if value.0 != start_byte {
                return Err(DownloadEnd::Failed(
                    "server returned the wrong byte range".to_string(),
                ));
            }
            Some(value)
        } else {
            None
        };

        // A server may ignore Range and return the full body. In that case the old
        // partial must be replaced, never appended to the new response.
        let append = status_is_partial && start_byte > 0;
        let total = range.map(|(_, _, total)| total).or(declared);
        let response_length = range.map(|(start, end, _)| end - start + 1).or(declared);
        let received_before = if append { start_byte } else { 0 };
        let file = if append {
            tokio::fs::OpenOptions::new().append(true).open(&part).await
        } else {
            tokio::fs::File::create(&part).await
        }
        .map_err(|e| DownloadEnd::Failed(format!("open: {e}")))?;
        let mut writer = tokio::io::BufWriter::with_capacity(1 << 20, file);
        on_event.send_event(DownloadEvent::Started {
            total,
            resumed: received_before,
        });

        let mut received = received_before;
        let mut received_this_response = 0u64;
        let mut stream = response.bytes_stream();
        let mut last = Instant::now();
        let mut since: u64 = 0;
        let mut transport_failure = None;
        loop {
            let next = tokio::select! {
                biased;
                _ = wait_cancelled(cancel) => {
                    let _ = writer.flush().await;
                    return Err(DownloadEnd::Canceled(received));
                }
                next = tokio::time::timeout(RESPONSE_IDLE_TIMEOUT, stream.next()) => next,
            };
            let next = match next {
                Err(_) => {
                    transport_failure = Some("response stalled".to_string());
                    break;
                }
                Ok(next) => next,
            };
            let Some(chunk) = next else { break };
            let bytes = match chunk {
                Ok(bytes) => bytes,
                Err(error) if retryable_transport(&error) => {
                    transport_failure = Some("connection interrupted".to_string());
                    break;
                }
                Err(error) => return Err(DownloadEnd::Failed(format!("stream: {error}"))),
            };
            writer
                .write_all(&bytes)
                .await
                .map_err(|e| DownloadEnd::Failed(format!("write: {e}")))?;
            received += bytes.len() as u64;
            received_this_response += bytes.len() as u64;
            since += bytes.len() as u64;
            if last.elapsed().as_millis() >= EMIT_INTERVAL_MS || since >= EMIT_BYTES {
                on_event.send_event(DownloadEvent::Progress { received, total });
                last = Instant::now();
                since = 0;
            }
        }
        writer
            .flush()
            .await
            .map_err(|e| DownloadEnd::Failed(format!("flush: {e}")))?;
        drop(writer);

        if let Some(reason) = transport_failure {
            retry_or_fail(&reason, retries, received, cancel, on_event).await?;
            retries += 1;
            continue;
        }
        if let Some(expected) = response_length {
            if received_this_response != expected {
                retry_or_fail(
                    "response ended before the declared length",
                    retries,
                    received,
                    cancel,
                    on_event,
                )
                .await?;
                retries += 1;
                continue;
            }
        }
        if let Some(expected) = total {
            if received > expected {
                return Err(DownloadEnd::Failed(
                    "download exceeded the declared video length".to_string(),
                ));
            }
            if received < expected {
                retry_or_fail(
                    "server returned only part of the video",
                    retries,
                    received,
                    cancel,
                    on_event,
                )
                .await?;
                retries += 1;
                continue;
            }
        }

        if received < minimum_bytes(audio) {
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
            .map_err(|e| DownloadEnd::Failed(format!("rename: {e}")))?;

        eprintln!("[harbor::download] done {} bytes -> {}", received, dest);
        on_event.send_event(DownloadEvent::Progress { received, total });
        on_event.send_event(DownloadEvent::Done { received });
        return Ok(());
    }
}

fn minimum_bytes(audio: bool) -> u64 {
    if audio {
        1024
    } else {
        MIN_VIDEO_BYTES
    }
}

async fn retry_or_fail(
    reason: &str,
    retries: usize,
    received: u64,
    cancel: &Arc<AtomicBool>,
    on_event: &impl DownloadEventSink,
) -> Result<(), DownloadEnd> {
    let Some(delay) = RETRY_DELAYS.get(retries).copied() else {
        return Err(DownloadEnd::Failed(format!(
            "download failed after {} retries: {reason}",
            RETRY_DELAYS.len()
        )));
    };
    let attempt = retries as u32 + 1;
    let delay_seconds = delay.as_secs();
    eprintln!(
        "[harbor::download] transient failure; retry {attempt}/{} in {delay_seconds}s (received={received}): {reason}",
        RETRY_DELAYS.len()
    );
    on_event.send_event(DownloadEvent::Retrying {
        attempt,
        delay_seconds,
    });
    tokio::select! {
        biased;
        _ = wait_cancelled(cancel) => Err(DownloadEnd::Canceled(received)),
        _ = tokio::time::sleep(delay) => Ok(()),
    }
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
mod tests {
    use super::*;
    use std::future::Future;
    use std::pin::Pin;
    use std::sync::atomic::AtomicUsize;
    use tokio::io::AsyncReadExt;
    use tokio::net::TcpListener;

    const VIDEO: &[u8] = &[b'v'; 600 * 1024];
    type Handler = dyn Fn(String, tokio::net::TcpStream) -> Pin<Box<dyn Future<Output = ()> + Send>>
        + Send
        + Sync;

    async fn test_server(handler: Arc<Handler>) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            loop {
                let Ok((mut stream, _)) = listener.accept().await else {
                    break;
                };
                let handler = handler.clone();
                tokio::spawn(async move {
                    let mut request = Vec::new();
                    let mut buffer = [0u8; 1024];
                    while !request.ends_with(b"\r\n\r\n") {
                        let Ok(count) = stream.read(&mut buffer).await else {
                            break;
                        };
                        if count == 0 {
                            break;
                        }
                        request.extend_from_slice(&buffer[..count]);
                    }
                    handler(String::from_utf8_lossy(&request).to_string(), stream).await;
                });
            }
        });
        format!("http://{address}/video")
    }

    #[derive(Default)]
    struct Events {
        values: Mutex<Vec<serde_json::Value>>,
        cancel_on_retry: Option<Arc<AtomicBool>>,
    }

    impl DownloadEventSink for Events {
        fn send_event(&self, event: DownloadEvent) {
            let retrying = matches!(event, DownloadEvent::Retrying { .. });
            self.values
                .lock()
                .unwrap()
                .push(serde_json::to_value(event).unwrap());
            if retrying {
                if let Some(cancel) = &self.cancel_on_retry {
                    cancel.store(true, Ordering::Relaxed);
                }
            }
        }
    }

    async fn temp_dest() -> (std::path::PathBuf, String) {
        let dir =
            std::env::temp_dir().join(format!("harbor-download-test-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&dir).await.unwrap();
        let dest = dir.join("episode.mp4");
        (dir, dest.to_string_lossy().into_owned())
    }

    async fn write_response(
        mut stream: tokio::net::TcpStream,
        status: &str,
        headers: &str,
        body: &[u8],
    ) {
        let head = format!("HTTP/1.1 {status}\r\n{headers}Connection: close\r\n\r\n");
        stream.write_all(head.as_bytes()).await.unwrap();
        stream.write_all(body).await.unwrap();
        stream.shutdown().await.unwrap();
    }

    #[tokio::test]
    async fn resumes_after_mid_body_disconnect_and_keeps_exact_bytes() {
        let calls = Arc::new(AtomicUsize::new(0));
        let seen_range = Arc::new(Mutex::new(None::<String>));
        let calls_for_handler = calls.clone();
        let range_for_handler = seen_range.clone();
        let url = test_server(Arc::new(move |request, mut stream| -> Pin<Box<dyn Future<Output = ()> + Send>> {
            let calls = calls_for_handler.clone();
            let seen_range = range_for_handler.clone();
            Box::pin(async move {
                if calls.fetch_add(1, Ordering::SeqCst) == 0 {
                    let head = format!("HTTP/1.1 200 OK\r\nContent-Type: video/mp4\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", VIDEO.len());
                    stream.write_all(head.as_bytes()).await.unwrap();
                    stream.write_all(&VIDEO[..180 * 1024]).await.unwrap();
                    stream.shutdown().await.unwrap();
                } else {
                    let range = request.lines().find(|line| line.to_ascii_lowercase().starts_with("range:")).unwrap().to_string();
                    *seen_range.lock().unwrap() = Some(range);
                    let offset = 180 * 1024;
                    let body = &VIDEO[offset..];
                    let headers = format!("Content-Type: video/mp4\r\nContent-Length: {}\r\nContent-Range: bytes {}-{}/{}\r\n", body.len(), offset, VIDEO.len() - 1, VIDEO.len());
                    // Avoid whitespace in the numeric total, which strict clients reject.
                    let headers = headers.replace("/ ", "/");
                    write_response(stream, "206 Partial Content", &headers, body).await;
                }
            })
        })).await;
        let (dir, dest) = temp_dest().await;
        let cancel = Arc::new(AtomicBool::new(false));
        let events = Events::default();
        let result = run_download(&url, &dest, &HashMap::new(), &cancel, &events, false).await;
        assert!(result.is_ok(), "{result:?}");
        assert_eq!(calls.load(Ordering::SeqCst), 2);
        assert_eq!(
            seen_range.lock().unwrap().as_deref(),
            Some("range: bytes=184320-")
        );
        assert_eq!(tokio::fs::read(&dest).await.unwrap().as_slice(), VIDEO);
        assert!(events
            .values
            .lock()
            .unwrap()
            .iter()
            .any(|event| event["kind"] == "retrying"));
        tokio::fs::remove_dir_all(dir).await.unwrap();
    }

    #[tokio::test]
    async fn ignored_range_restarts_from_zero_instead_of_appending() {
        let url = test_server(Arc::new(
            |_request, stream| -> Pin<Box<dyn Future<Output = ()> + Send>> {
                Box::pin(async move {
                    write_response(
                        stream,
                        "200 OK",
                        &format!(
                            "Content-Type: video/mp4\r\nContent-Length: {}\r\n",
                            VIDEO.len()
                        ),
                        VIDEO,
                    )
                    .await;
                })
            },
        ))
        .await;
        let (dir, dest) = temp_dest().await;
        tokio::fs::write(format!("{dest}.part"), &VIDEO[..128 * 1024])
            .await
            .unwrap();
        let cancel = Arc::new(AtomicBool::new(false));
        let result = run_download(
            &url,
            &dest,
            &HashMap::new(),
            &cancel,
            &Events::default(),
            false,
        )
        .await;
        assert!(result.is_ok(), "{result:?}");
        assert_eq!(tokio::fs::read(&dest).await.unwrap().as_slice(), VIDEO);
        tokio::fs::remove_dir_all(dir).await.unwrap();
    }

    #[tokio::test]
    async fn accepts_a_valid_small_resume_tail() {
        let offset = VIDEO.len() - 10 * 1024;
        let url = test_server(Arc::new(|_request, stream| -> Pin<Box<dyn Future<Output = ()> + Send>> {
            Box::pin(async move {
                let offset = VIDEO.len() - 10 * 1024;
                let body = &VIDEO[offset..];
                let headers = format!(
                    "Content-Type: video/mp4\r\nContent-Length: {}\r\nContent-Range: bytes {}-{}/{}\r\n",
                    body.len(), offset, VIDEO.len() - 1, VIDEO.len()
                );
                write_response(stream, "206 Partial Content", &headers, body).await;
            })
        })).await;
        let (dir, dest) = temp_dest().await;
        tokio::fs::write(format!("{dest}.part"), &VIDEO[..offset])
            .await
            .unwrap();
        let cancel = Arc::new(AtomicBool::new(false));
        let result = run_download(
            &url,
            &dest,
            &HashMap::new(),
            &cancel,
            &Events::default(),
            false,
        )
        .await;
        assert!(result.is_ok(), "{result:?}");
        assert_eq!(tokio::fs::read(&dest).await.unwrap().as_slice(), VIDEO);
        tokio::fs::remove_dir_all(dir).await.unwrap();
    }

    #[tokio::test]
    async fn rejects_a_partial_response_with_the_wrong_range_start() {
        let url = test_server(Arc::new(|_request, stream| -> Pin<Box<dyn Future<Output = ()> + Send>> {
            Box::pin(async move {
                let offset = 128 * 1024 - 1;
                let body = &VIDEO[offset..];
                let headers = format!(
                    "Content-Type: video/mp4\r\nContent-Length: {}\r\nContent-Range: bytes {}-{}/{}\r\n",
                    body.len(), offset, VIDEO.len() - 1, VIDEO.len()
                );
                write_response(stream, "206 Partial Content", &headers, body).await;
            })
        })).await;
        let (dir, dest) = temp_dest().await;
        tokio::fs::write(format!("{dest}.part"), &VIDEO[..128 * 1024])
            .await
            .unwrap();
        let cancel = Arc::new(AtomicBool::new(false));
        let events = Events::default();
        let result = run_download(&url, &dest, &HashMap::new(), &cancel, &events, false).await;
        assert!(matches!(result, Err(DownloadEnd::Failed(_))));
        assert_eq!(
            tokio::fs::metadata(format!("{dest}.part"))
                .await
                .unwrap()
                .len(),
            128 * 1024
        );
        assert!(!events
            .values
            .lock()
            .unwrap()
            .iter()
            .any(|event| event["kind"] == "retrying"));
        tokio::fs::remove_dir_all(dir).await.unwrap();
    }

    #[tokio::test]
    async fn does_not_emit_a_sixth_retry_after_budget_is_exhausted() {
        let events = Events::default();
        let cancel = Arc::new(AtomicBool::new(false));
        let result = retry_or_fail("transient", RETRY_DELAYS.len(), 1234, &cancel, &events).await;
        assert!(matches!(result, Err(DownloadEnd::Failed(_))));
        assert!(events.values.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn retries_when_connection_closes_before_response_headers() {
        let calls = Arc::new(AtomicUsize::new(0));
        let calls_for_handler = calls.clone();
        let url = test_server(Arc::new(
            move |_request, stream| -> Pin<Box<dyn Future<Output = ()> + Send>> {
                let calls = calls_for_handler.clone();
                Box::pin(async move {
                    if calls.fetch_add(1, Ordering::SeqCst) == 0 {
                        drop(stream);
                    } else {
                        write_response(
                            stream,
                            "200 OK",
                            &format!(
                                "Content-Type: video/mp4\r\nContent-Length: {}\r\n",
                                VIDEO.len()
                            ),
                            VIDEO,
                        )
                        .await;
                    }
                })
            },
        ))
        .await;
        let (dir, dest) = temp_dest().await;
        let cancel = Arc::new(AtomicBool::new(false));
        let events = Events::default();
        let result = run_download(&url, &dest, &HashMap::new(), &cancel, &events, false).await;
        assert!(result.is_ok(), "{result:?}");
        assert_eq!(calls.load(Ordering::SeqCst), 2);
        assert_eq!(tokio::fs::read(&dest).await.unwrap().as_slice(), VIDEO);
        assert!(events
            .values
            .lock()
            .unwrap()
            .iter()
            .any(|event| event["kind"] == "retrying"));
        tokio::fs::remove_dir_all(dir).await.unwrap();
    }

    #[tokio::test]
    async fn only_accepts_416_when_partial_size_matches_server_total() {
        let url = test_server(Arc::new(
            |_request, stream| -> Pin<Box<dyn Future<Output = ()> + Send>> {
                Box::pin(async move {
                    write_response(
                        stream,
                        "416 Range Not Satisfiable",
                        "Content-Range: bytes */614400\r\n",
                        b"",
                    )
                    .await;
                })
            },
        ))
        .await;
        let (dir, dest) = temp_dest().await;
        tokio::fs::write(format!("{dest}.part"), VIDEO)
            .await
            .unwrap();
        let cancel = Arc::new(AtomicBool::new(false));
        assert!(run_download(
            &url,
            &dest,
            &HashMap::new(),
            &cancel,
            &Events::default(),
            false
        )
        .await
        .is_ok());
        assert_eq!(
            tokio::fs::metadata(&dest).await.unwrap().len(),
            VIDEO.len() as u64
        );
        tokio::fs::remove_dir_all(dir).await.unwrap();

        let url = test_server(Arc::new(
            |_request, stream| -> Pin<Box<dyn Future<Output = ()> + Send>> {
                Box::pin(async move {
                    write_response(
                        stream,
                        "416 Range Not Satisfiable",
                        "Content-Range: bytes */700000\r\n",
                        b"",
                    )
                    .await;
                })
            },
        ))
        .await;
        let (dir, dest) = temp_dest().await;
        tokio::fs::write(format!("{dest}.part"), &VIDEO[..])
            .await
            .unwrap();
        let cancel = Arc::new(AtomicBool::new(false));
        let result = run_download(
            &url,
            &dest,
            &HashMap::new(),
            &cancel,
            &Events::default(),
            false,
        )
        .await;
        assert!(matches!(result, Err(DownloadEnd::Failed(_))));
        assert!(tokio::fs::try_exists(format!("{dest}.part")).await.unwrap());
        tokio::fs::remove_dir_all(dir).await.unwrap();
    }

    #[tokio::test]
    async fn cancellation_during_retry_backoff_stops_without_losing_partial() {
        let calls = Arc::new(AtomicUsize::new(0));
        let calls_for_handler = calls.clone();
        let url = test_server(Arc::new(
            move |_request, stream| -> Pin<Box<dyn Future<Output = ()> + Send>> {
                let calls = calls_for_handler.clone();
                Box::pin(async move {
                    calls.fetch_add(1, Ordering::SeqCst);
                    write_response(
                        stream,
                        "503 Service Unavailable",
                        "Content-Length: 0\r\n",
                        b"",
                    )
                    .await;
                })
            },
        ))
        .await;
        let (dir, dest) = temp_dest().await;
        tokio::fs::write(format!("{dest}.part"), &VIDEO[..128 * 1024])
            .await
            .unwrap();
        let cancel = Arc::new(AtomicBool::new(false));
        let events = Events {
            values: Mutex::new(Vec::new()),
            cancel_on_retry: Some(cancel.clone()),
        };
        let result = run_download(&url, &dest, &HashMap::new(), &cancel, &events, false).await;
        assert!(matches!(result, Err(DownloadEnd::Canceled(131072))));
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(
            tokio::fs::metadata(format!("{dest}.part"))
                .await
                .unwrap()
                .len(),
            131072
        );
        tokio::fs::remove_dir_all(dir).await.unwrap();
    }

    #[tokio::test]
    async fn permanent_http_error_does_not_retry_and_redacts_response_body() {
        let calls = Arc::new(AtomicUsize::new(0));
        let calls_for_handler = calls.clone();
        let url = test_server(Arc::new(
            move |_request, stream| -> Pin<Box<dyn Future<Output = ()> + Send>> {
                let calls = calls_for_handler.clone();
                Box::pin(async move {
                    calls.fetch_add(1, Ordering::SeqCst);
                    write_response(stream, "404 Not Found", "Content-Length: 0\r\n", b"").await;
                })
            },
        ))
        .await;
        let (dir, dest) = temp_dest().await;
        let cancel = Arc::new(AtomicBool::new(false));
        let events = Events::default();
        let result = run_download(&url, &dest, &HashMap::new(), &cancel, &events, false).await;
        assert!(matches!(result, Err(DownloadEnd::Failed(message)) if message == "HTTP 404"));
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert!(!events
            .values
            .lock()
            .unwrap()
            .iter()
            .any(|event| event["kind"] == "retrying"));
        tokio::fs::remove_dir_all(dir).await.unwrap();
    }

    #[test]
    fn retry_event_serializes_fields_for_frontend() {
        let event = serde_json::to_value(DownloadEvent::Retrying {
            attempt: 2,
            delay_seconds: 5,
        })
        .unwrap();
        assert_eq!(
            event,
            serde_json::json!({"kind":"retrying", "attempt":2, "delaySeconds":5})
        );
    }
}
