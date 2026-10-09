use super::*;
use serde_json::json;
use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::{Arc, Mutex},
};

const KEY: &str = "j2tq12gr15jhq2r";
fn info() -> Value {
    json!({"response":{"action":"file/get_info","result":"Success","file_info":{
        "quickkey":KEY,"filename":"Public project.zip","size":"233373","hash":"a".repeat(64),
        "ready":"yes","privacy":"public","password_protected":"no","flag":"0","permissions":{"read":"1"}
    }}})
}
fn html() -> String {
    format!(
        r#"<a href="https://download854.mediafire.com/temporary/{KEY}/Public+project.zip" id="downloadButton">Download</a>"#
    )
}
fn fixture(
    replies: Vec<(u16, &str, String)>,
) -> (Api, Arc<Mutex<Vec<String>>>, std::thread::JoinHandle<()>) {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    listener.set_nonblocking(true).unwrap();
    let calls = Arc::new(Mutex::new(Vec::new()));
    let capture = calls.clone();
    let replies: Vec<_> = replies
        .into_iter()
        .map(|(code, mime, body)| (code, mime.to_owned(), body))
        .collect();
    let worker = std::thread::spawn(move || {
        for (status, mime, body) in replies {
            let deadline = std::time::Instant::now() + Duration::from_secs(5);
            let mut socket = loop {
                match listener.accept() {
                    Ok((socket, _)) => break socket,
                    Err(error)
                        if error.kind() == std::io::ErrorKind::WouldBlock
                            && std::time::Instant::now() < deadline =>
                    {
                        std::thread::sleep(Duration::from_millis(5))
                    }
                    Err(error) => panic!("missing fixture request: {error}"),
                }
            };
            socket.set_nonblocking(false).unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            while !bytes.windows(4).any(|v| v == b"\r\n\r\n") {
                let mut part = [0; 1024];
                let size = socket.read(&mut part).unwrap();
                if size == 0 {
                    break;
                }
                bytes.extend_from_slice(&part[..size]);
            }
            let request = String::from_utf8(bytes).unwrap();
            let head = request.starts_with("HEAD ");
            capture.lock().unwrap().push(request);
            write!(socket, "HTTP/1.1 {status} Fixture\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nLocation: https://127.0.0.1/private\r\nConnection: close\r\n\r\n", body.len()).unwrap();
            if !head {
                socket.write_all(body.as_bytes()).unwrap();
            }
        }
    });
    let mut api = Api::new().unwrap();
    api.base = format!("http://{address}");
    (api, calls, worker)
}

#[test]
fn only_single_file_provider_routes_are_accepted() {
    for path in [
        format!("/?{KEY}"),
        format!("/file/{KEY}"),
        format!("/file/{KEY}/Project.zip/file"),
        format!("/view/{KEY}/Project.zip"),
        format!("/download/{KEY}/Project.zip/file/"),
    ] {
        assert_eq!(
            target(&format!("http://www.mediafire.com{path}")).unwrap(),
            KEY
        );
    }
    for url in [
        "https://mediafire.com/folder/abc",
        "https://evil.invalid/file/abc",
        "https://mediafire.com.evil/file/abc",
        "https://user:pass@mediafire.com/file/abc",
        "https://mediafire.com:444/file/abc",
        "https://download1.mediafire.com/token/abc/game.zip",
        "https://mediafire.com/file/a%2Fb",
        "https://mediafire.com/file/abc/name/extra",
        "https://mediafire.com/file/abc/a%2fb",
        "https://mediafire.com/?abc&other=123",
        "https://mediafire.com/file/ab\nc",
        "https://mediafire.com/file/ABC/../DEF",
        "https://mediafire.com/file/ABC/%2e%2e/DEF",
        "https://mediafire.com/file/ABC/.%2E/DEF",
        "https://mediafire.com/file/ABC/%2e/DEF",
        "https://mediafire.com/file/ABC\\DEF",
        "https://mediafire.com\\file\\ABC",
        "https://mediafire.com/file/ABC/name%00.zip",
        "https://mediafire.com/file/ABC/name%.zip",
        "https://mediafire.com/file/ABC/name%2",
        "https://mediafire.com/file/ABC/name%GG.zip",
    ] {
        assert!(target(url).is_err(), "{url}");
    }
    assert!(target(&format!("https://mediafire.com/file/{}", "a".repeat(65))).is_err());
}
#[test]
fn exact_metadata_preserves_sha256_and_does_not_mislabel_older_md5() {
    let file = parse_info(&info(), KEY).unwrap();
    assert_eq!(file.bytes, Some(233373));
    assert_eq!(file.sha256, Some("a".repeat(64)));
    assert_eq!(file.state, "available");
    let mut old = info();
    old["response"]["file_info"]["hash"] = json!("b".repeat(32));
    assert_eq!(parse_info(&old, KEY).unwrap().sha256, None);
    for (field, value) in [
        ("quickkey", json!("other")),
        ("filename", json!("..")),
        ("filename", json!("bad\nname")),
        ("size", json!("-1")),
        ("size", json!(MAX_FILE + 1)),
        ("hash", json!("not-a-hash")),
    ] {
        let mut value_info = info();
        value_info["response"]["file_info"][field] = value;
        assert!(parse_info(&value_info, KEY).is_err(), "{field}");
    }
}
#[test]
fn availability_and_public_api_errors_remain_truthful_and_do_not_echo_payloads() {
    for (field, value, expected) in [
        ("privacy", json!("private"), "review"),
        ("password_protected", json!("yes"), "review"),
        ("ready", json!("no"), "review"),
        ("flag", json!("8"), "restricted"),
        ("delete_date", json!("2026-10-01"), "missing"),
    ] {
        let mut value_info = info();
        value_info["response"]["file_info"][field] = value;
        assert_eq!(parse_info(&value_info, KEY).unwrap().state, expected);
    }
    for (code, expected) in [
        (110, "public_missing"),
        (210, "public_missing"),
        (114, "public_review"),
        (165, "public_restricted"),
        (163, "public_rate_limit"),
        (261, "public_rate_limit"),
        (999, "public_review"),
    ] {
        assert_eq!(parse_info(&json!({"response":{"result":"Error","error":code,"message":"private provider details"}}), KEY).unwrap_err(), expected);
    }
}
#[test]
fn only_the_real_download_button_and_exact_provider_file_can_be_prepared() {
    let accepted = page_download(&html(), KEY).unwrap();
    assert_eq!(accepted.host_str(), Some("download854.mediafire.com"));
    let encoded = html().replace("project.zip", "project.zip?a=1&amp;b=2");
    assert_eq!(
        page_download(&encoded, KEY).unwrap().query(),
        Some("a=1&b=2")
    );
    assert!(page_download(
        &format!("<!--{}--><script>{}</script>", html(), html()),
        KEY
    )
    .is_err());
    for bad in [
        html().replace(
            "download854.mediafire.com",
            "download854.mediafire.com.evil",
        ),
        html().replace(KEY, "wrongkey"),
        html().replace("download854", "download"),
        html().replace("id=\"downloadButton\"", "id=\"advertisement\""),
        html().replace("https://download854.mediafire.com", "https://127.0.0.1"),
        html().replace("/temporary/", "/a%2fb/"),
        html().replace("https://", "https://user:pass@"),
        "<a id=\"deferredDownloadButton\" data-security-token=\"secret\">Download</a>".into(),
    ] {
        assert!(page_download(&bad, KEY).is_err());
    }
    assert!(page_download(
        &format!("{}{}", html(), html().replace("/temporary/", "/other/")),
        KEY
    )
    .is_err());
}
#[tokio::test]
async fn review_requests_only_api_metadata_without_credentials_or_file_payload() {
    let (api, calls, worker) = fixture(vec![(200, "application/json", info().to_string())]);
    let result = api.review(KEY).await.unwrap();
    assert_eq!(result.files.len(), 1);
    assert_eq!(result.selected_id.as_deref(), Some(KEY));
    worker.join().unwrap();
    let calls = calls.lock().unwrap();
    assert_eq!(calls.len(), 1);
    assert!(calls[0].starts_with(&format!(
        "GET /api/1.5/file/get_info.php?quick_key={KEY}&response_format=json "
    )));
    assert!(
        !calls[0].to_ascii_lowercase().contains("authorization:")
            && !calls[0].to_ascii_lowercase().contains("cookie:")
    );
}
#[tokio::test]
async fn explicit_resolution_refreshes_metadata_before_reading_the_public_page() {
    let mut latest = info();
    latest["response"]["file_info"]["filename"] = json!("Current project.zip");
    let (api, calls, worker) = fixture(vec![
        (200, "application/json", latest.to_string()),
        (200, "text/html; charset=UTF-8", html()),
    ]);
    assert_eq!(api.resolve(KEY, "other").await.unwrap_err(), "public_url");
    let result = api.resolve(KEY, KEY).await.unwrap();
    assert_eq!(result.name, "Current project.zip");
    assert_eq!(result.expected_bytes, Some(233373));
    worker.join().unwrap();
    let calls = calls.lock().unwrap();
    assert_eq!(calls.len(), 2);
    assert!(calls[1].starts_with(&format!("GET /file/{KEY} ")));
}
#[tokio::test]
async fn restrictions_and_challenges_never_turn_into_a_payload_request() {
    for (field, value, expected) in [
        ("privacy", json!("private"), "public_review"),
        ("password_protected", json!("yes"), "public_review"),
        ("flag", json!("8"), "public_restricted"),
    ] {
        let mut restricted = info();
        restricted["response"]["file_info"][field] = value;
        let (api, calls, worker) = fixture(vec![(200, "application/json", restricted.to_string())]);
        assert_eq!(api.resolve(KEY, KEY).await.unwrap_err(), expected);
        worker.join().unwrap();
        assert_eq!(calls.lock().unwrap().len(), 1);
    }
    for (status, expected) in [
        (302, "public_review"),
        (403, "public_review"),
        (404, "public_missing"),
        (429, "public_rate_limit"),
        (451, "public_restricted"),
    ] {
        let (api, calls, worker) =
            fixture(vec![(status, "text/html", "challenge/private info".into())]);
        assert_eq!(api.review(KEY).await.unwrap_err(), expected);
        worker.join().unwrap();
        assert_eq!(calls.lock().unwrap().len(), 1);
    }
    let (api, _, worker) = fixture(vec![
        (200, "application/json", info().to_string()),
        (200, "text/html", "<form>Complete the CAPTCHA</form>".into()),
    ]);
    assert_eq!(api.resolve(KEY, KEY).await.unwrap_err(), "public_review");
    worker.join().unwrap();
}
#[tokio::test]
async fn download_probe_uses_head_without_body_or_redirect_and_rejects_size_changes() {
    for (status, mime, expected_bytes, expected) in [
        (200, "application/octet-stream", 4, Ok(())),
        (200, "application/octet-stream", 5, Err("public_metadata")),
        (200, "text/html", 4, Err("public_review")),
        (302, "application/octet-stream", 4, Err("public_review")),
        (403, "text/html", 4, Err("public_review")),
    ] {
        let (api, calls, worker) = fixture(vec![(status, mime, "data".into())]);
        assert_eq!(
            api.probe(
                &Url::parse(&format!("{}/probe", api.base)).unwrap(),
                Some(expected_bytes)
            )
            .await,
            expected
        );
        worker.join().unwrap();
        let calls = calls.lock().unwrap();
        assert_eq!(calls.len(), 1);
        assert!(calls[0].starts_with("HEAD /probe "));
    }
}
#[tokio::test]
#[ignore = "explicit metadata-only acceptance; no page preparation or payload download"]
async fn live_public_metadata_contract() {
    let url = std::env::var("HARBOR_MEDIAFIRE_TEST_URL").expect("explicit public file URL");
    let result = review(Request {
        url,
        file: String::new(),
    })
    .await
    .unwrap();
    assert_eq!(result.files.len(), 1);
    assert!(valid_key(&result.files[0].id));
    assert!(!result.files[0].name.is_empty());
}
