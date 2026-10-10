use super::*;
use std::io::{Read, Write};
use std::net::TcpListener;

struct Fixture(std::path::PathBuf);
impl Fixture {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("jl-download-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&path).unwrap(); Self(path)
    }
    fn dest(&self) -> String { self.0.join("synthetic.bin").to_string_lossy().into_owned() }
}
impl Drop for Fixture { fn drop(&mut self) { let _ = std::fs::remove_dir_all(&self.0); } }

fn server(responses: Vec<(String, Vec<u8>)>) -> (String, std::thread::JoinHandle<Vec<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/fixture", listener.local_addr().unwrap());
    let handle = std::thread::spawn(move || responses.into_iter().map(|(headers, body)| {
        let (mut stream, _) = listener.accept().unwrap();
        stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        let mut request = Vec::new(); let mut byte = [0];
        while !request.ends_with(b"\r\n\r\n") { stream.read_exact(&mut byte).unwrap(); request.push(byte[0]); }
        stream.write_all(format!("{headers}\r\nConnection: close\r\n\r\n").as_bytes()).unwrap();
        let _ = stream.write_all(&body);
        String::from_utf8(request).unwrap().to_ascii_lowercase()
    }).collect());
    (url, handle)
}
fn full(body: Vec<u8>) -> (String, Vec<u8>) {
    (format!("HTTP/1.1 200 OK\r\nContent-Type: video/mp4\r\nETag: \"fixture-a\"\r\nContent-Length: {}", body.len()), body)
}
async fn seed(dest: &str, url: &str, body: &[u8], total: u64, etag: Option<&str>) {
    tokio::fs::write(format!("{dest}.part"), body).await.unwrap();
    let identity = PartialIdentity { source: source_identity(url, &HashMap::new()), etag: etag.map(str::to_owned), total: Some(total), digest: None };
    tokio::fs::write(format!("{dest}.part.meta.json"), serde_json::to_vec(&identity).unwrap()).await.unwrap();
}
async fn run(url: &str, dest: &str) -> Result<(), DownloadEnd> {
    run_download(url, dest, &HashMap::new(), &Arc::new(AtomicBool::new(false)), &|_| {}, false).await
}

#[test]
fn range_and_source_validation() {
    assert_eq!(content_range("bytes 12-19/20"), Some((12, 19, 20)));
    for value in ["bytes */20", "bytes 9-1/20", "bytes 0-20/20", "bytes 0-2/*"] { assert!(content_range(value).is_none()); }
    for url in ["file:///etc/passwd", "https://user:password@example.test/a", "https://example.test/a.m3u8?token=private", "https://example.test/a.mpd"] { assert!(reject_source(url).is_err()); }
    assert!(unsupported_prefix(b"#EXTM3U\n"));
    assert!(unsupported_prefix(b"\0\0\0\x18ftypisom\0\0\0\x10pssh"));
    assert!(unsupported_content("application/vnd.apple.mpegurl"));
}

#[tokio::test]
async fn interrupted_transfer_resumes_exact_bytes_after_restart() {
    let fixture = Fixture::new(); let dest = fixture.dest();
    let body = vec![7u8; 1_048_576]; let offset = 262_144;
    let (url, requests) = server(vec![
        (format!("HTTP/1.1 200 OK\r\nContent-Type: video/mp4\r\nETag: \"fixture-a\"\r\nContent-Length: {}", body.len()), body[..offset].to_vec()),
        (format!("HTTP/1.1 206 Partial Content\r\nContent-Type: video/mp4\r\nETag: \"fixture-a\"\r\nContent-Range: bytes {}-{}/{}\r\nContent-Length: {}", offset, body.len()-1, body.len(), body.len()-offset), body[offset..].to_vec()),
    ]);
    assert!(run(&url, &dest).await.is_err());
    assert!(!std::path::Path::new(&dest).exists());
    assert_eq!(tokio::fs::metadata(format!("{dest}.part")).await.unwrap().len(), offset as u64);
    run(&url, &dest).await.unwrap();
    assert_eq!(tokio::fs::read(&dest).await.unwrap(), body);
    let requests = requests.join().unwrap();
    assert!(requests[1].contains("range: bytes=262144-"));
    assert!(requests[1].contains("if-range: \"fixture-a\""));
}

#[tokio::test]
async fn missing_validator_restarts_instead_of_appending() {
    let fixture = Fixture::new(); let dest = fixture.dest(); let body = vec![8u8; 524_288];
    let (url, requests) = server(vec![full(body.clone())]);
    seed(&dest, &url, &[9u8; 500], body.len() as u64, None).await;
    run(&url, &dest).await.unwrap();
    assert_eq!(tokio::fs::read(&dest).await.unwrap(), body);
    assert!(!requests.join().unwrap()[0].contains("\r\nrange:"));
}

#[tokio::test]
async fn invalid_range_and_416_restart_never_promote_partial_bytes() {
    for status in ["HTTP/1.1 416 Range Not Satisfiable\r\nContent-Length: 0".to_owned(),
        "HTTP/1.1 206 Partial Content\r\nContent-Length: 0\r\nETag: \"fixture-a\"\r\nContent-Range: bytes 0-9/10".to_owned()] {
        let fixture = Fixture::new(); let dest = fixture.dest(); let body = vec![6u8; 524_288];
        let (url, requests) = server(vec![(status, vec![]), full(body.clone())]);
        seed(&dest, &url, &[4u8; 100], body.len() as u64, Some("\"fixture-a\"")).await;
        run(&url, &dest).await.unwrap();
        assert_eq!(tokio::fs::read(&dest).await.unwrap(), body);
        let requests = requests.join().unwrap();
        assert!(requests[0].contains("range: bytes=100-"));
        assert!(!requests[1].contains("\r\nrange:"));
    }
}

#[tokio::test]
async fn changed_etag_restarts_and_existing_destination_is_never_overwritten() {
    let fixture = Fixture::new(); let dest = fixture.dest(); let body = vec![5u8; 524_288];
    let (url, requests) = server(vec![
        ("HTTP/1.1 206 Partial Content\r\nETag: \"other\"\r\nContent-Range: bytes 100-524287/524288\r\nContent-Length: 524188".to_owned(), vec![]), full(body.clone())]);
    seed(&dest, &url, &[4u8; 100], body.len() as u64, Some("\"fixture-a\"")).await;
    run(&url, &dest).await.unwrap(); requests.join().unwrap();
    assert_eq!(tokio::fs::read(&dest).await.unwrap(), body);
    assert!(run(&url, &dest).await.is_err());
    assert_eq!(tokio::fs::read(&dest).await.unwrap(), body);
}

#[tokio::test]
async fn disguised_playlist_is_not_saved_or_reported_complete() {
    let fixture = Fixture::new(); let dest = fixture.dest();
    let mut body = b"#EXTM3U\n".to_vec(); body.resize(524_288, b' ');
    let (url, requests) = server(vec![full(body)]);
    assert!(run(&url, &dest).await.is_err()); requests.join().unwrap();
    assert!(!std::path::Path::new(&dest).exists());
}

#[tokio::test]
async fn completed_file_recovers_after_ui_restart_without_network_and_detects_corruption() {
    let fixture = Fixture::new(); let dest = fixture.dest(); let body = vec![7u8; 524_288];
    let (url, requests) = server(vec![full(body)]);
    run(&url, &dest).await.unwrap(); requests.join().unwrap();
    // Server is gone: recovery cannot contact it and needs no saved credentials.
    assert_eq!(download_verify(dest.clone()).await.unwrap(), Some(524_288));
    tokio::fs::write(&dest, vec![8u8; 524_288]).await.unwrap();
    assert!(download_verify(dest).await.is_err());
}

#[tokio::test]
async fn private_headers_are_not_forwarded_to_another_origin() {
    let fixture = Fixture::new(); let dest = fixture.dest();
    let target = TcpListener::bind("127.0.0.1:0").unwrap();
    target.set_nonblocking(true).unwrap();
    let (url, requests) = server(vec![(format!("HTTP/1.1 302 Found\r\nContent-Length: 0\r\nLocation: http://{}/other", target.local_addr().unwrap()), vec![])]);
    let headers = HashMap::from([("X-Api-Key".to_owned(), "synthetic-only".to_owned())]);
    let result = run_download(&url, &dest, &headers, &Arc::new(AtomicBool::new(false)), &|_| {}, false).await;
    assert!(matches!(result, Err(DownloadEnd::Failed(message)) if message.contains("private headers cannot be forwarded")));
    assert_eq!(target.accept().unwrap_err().kind(), std::io::ErrorKind::WouldBlock);
    requests.join().unwrap();
}

#[tokio::test]
async fn cancel_keeps_partial_state_without_publishing_done() {
    let fixture = Fixture::new(); let dest = fixture.dest(); let body = vec![7u8; 524_288];
    let (url, requests) = server(vec![full(body)]);
    let cancel = Arc::new(AtomicBool::new(false));
    let events = Mutex::new(Vec::new());
    let result = run_download(&url, &dest, &HashMap::new(), &cancel, &|event| {
        if matches!(event, DownloadEvent::Started { .. }) { cancel.store(true, Ordering::Relaxed); }
        events.lock().unwrap().push(event);
    }, false).await;
    assert!(matches!(result, Err(DownloadEnd::Canceled(_))));
    assert!(!events.lock().unwrap().iter().any(|event| matches!(event, DownloadEvent::Done { .. })));
    assert!(!std::path::Path::new(&dest).exists());
    requests.join().unwrap();
}
