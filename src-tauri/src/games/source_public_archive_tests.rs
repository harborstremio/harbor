use super::*;
use serde_json::json;
use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::{Arc, Mutex},
};

fn metadata() -> Value {
    json!({"metadata":{"identifier":"public-project","title":"Public project"},"files_count":3,"files":[
        {"name":"Manual.pdf","size":"2048","sha1":"a".repeat(40)},
        {"name":"Builds/Project 日本+1.zip","size":"4096"},
        {"name":"private.zip","size":10,"private":"true"}
    ]})
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
    let replies = replies
        .into_iter()
        .map(|(s, h, b)| (s, h.to_owned(), b))
        .collect::<Vec<_>>();
    let worker = std::thread::spawn(move || {
        for (status, headers, body) in replies {
            let deadline = std::time::Instant::now() + Duration::from_secs(5);
            let mut socket = loop {
                match listener.accept() {
                    Ok((socket, _)) => break socket,
                    Err(e)
                        if e.kind() == std::io::ErrorKind::WouldBlock
                            && std::time::Instant::now() < deadline =>
                    {
                        std::thread::sleep(Duration::from_millis(5))
                    }
                    Err(e) => panic!("missing fixture request: {e}"),
                }
            };
            socket.set_nonblocking(false).unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            while !bytes.windows(4).any(|b| b == b"\r\n\r\n") {
                let mut part = [0; 1024];
                let n = socket.read(&mut part).unwrap();
                if n == 0 {
                    break;
                }
                bytes.extend_from_slice(&part[..n]);
            }
            capture
                .lock()
                .unwrap()
                .push(String::from_utf8(bytes).unwrap());
            write!(socket,"HTTP/1.1 {status} Fixture\r\n{headers}Content-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
        }
    });
    let mut api = Api::new().unwrap();
    api.base = format!("http://{address}");
    (api, calls, worker)
}
#[test]
fn canonical_items_and_nested_files_preserve_exact_identity() {
    for route in ["details", "metadata", "download"] {
        assert_eq!(
            target(&format!("https://archive.org/{route}/public-project/"))
                .unwrap()
                .item,
            "public-project"
        );
    }
    let file = target(
        "https://www.archive.org/download/public-project/Builds/Project%20%E6%97%A5%E6%9C%AC+1.zip",
    )
    .unwrap();
    assert_eq!(file.file.as_deref(), Some("Builds/Project 日本+1.zip"));
    for input in [
        "https://archive.org.evil/download/public-project/a.zip",
        "https://user:pass@archive.org/details/public-project",
        "https://archive.org:8443/details/public-project",
        "file://archive.org/details/public-project",
        "https://archive.org/details/_bad",
        "https://archive.org/download/public-project/../a.zip",
        "https://archive.org/download/public-project/%2e%2e/a.zip",
        "https://archive.org/download/public-project/a%2F..%2Fb.zip",
        "https://archive.org/download/public-project/a%5Cb.zip",
        "https://archive.org/download/public-project/%FF",
        "https://archive.org/metadata/public-project/files/0",
        "https://archive.org/details/public-project/extra",
    ] {
        assert!(target(input).is_err(), "{input}");
    }
    assert!(target(&format!("https://archive.org/details/{}", "a".repeat(101))).is_err());
}
#[test]
fn metadata_keeps_paths_sizes_and_access_states_without_inventing_sha256() {
    let item = target("https://archive.org/details/public-project").unwrap();
    let result = parse(&metadata(), &item).unwrap();
    assert_eq!(result.files.len(), 3);
    assert_eq!(result.files[0].bytes, Some(2048));
    assert_eq!(result.files[1].id, "Builds/Project 日本+1.zip");
    assert_eq!(result.files[2].state, "review");
    assert!(result.files.iter().all(|f| f.sha256.is_none()));
    let mut restricted = metadata();
    restricted["metadata"]["access-restricted-item"] = json!("true");
    assert!(parse(&restricted, &item)
        .unwrap()
        .files
        .iter()
        .all(|f| f.state == "review"));
    restricted["is_dark"] = json!(true);
    assert_eq!(parse(&restricted, &item).unwrap_err(), "public_restricted");
    assert_eq!(parse(&json!([]), &item).unwrap_err(), "public_missing");
    assert_eq!(
        parse(&json!({"error":"deleted","errcode":104}), &item).unwrap_err(),
        "public_missing"
    );
}
#[test]
fn malformed_or_partial_records_are_never_silently_completed() {
    let item = target("https://archive.org/details/public-project").unwrap();
    for (key, bad) in [
        ("name", json!("../outside.zip")),
        ("name", json!("folder\\file.zip")),
        ("size", json!("-1")),
    ] {
        let mut value = metadata();
        value["files"][0][key] = bad;
        assert!(parse(&value, &item).is_err());
    }
    let mut value = metadata();
    value["metadata"]["identifier"] = json!("other-item");
    assert!(parse(&value, &item).is_err());
    value = metadata();
    value["files_count"] = json!(20);
    assert!(parse(&value, &item).is_err());
    value = metadata();
    value["files"][1] = value["files"][0].clone();
    assert!(parse(&value, &item).is_err());
    value = metadata();
    value["files"] = json!(vec![json!({"name":"a"}); MAX_FILES + 1]);
    assert_eq!(parse(&value, &item).unwrap_err(), "public_limit");
    let file = target("https://archive.org/download/public-project/removed.zip").unwrap();
    assert_eq!(parse(&metadata(), &file).unwrap_err(), "public_missing");
}
#[test]
fn redirects_stay_on_archive_nodes_and_the_exact_selected_file() {
    let item = target("https://archive.org/details/public-project").unwrap();
    for url in [
        "https://archive.org/download/public-project/Manual.pdf",
        "https://ia800308.us.archive.org/21/items/public-project/Manual.pdf",
        "https://dn790006.ca.archive.org/0/items/public-project/Manual.pdf",
    ] {
        assert!(
            redirect_allowed(&Url::parse(url).unwrap(), &item, "Manual.pdf"),
            "{url}"
        );
    }
    for url in [
        "https://archive.org/account/login",
        "https://evil.invalid/items/public-project/Manual.pdf",
        "https://ia800308.us.archive.org.evil/21/items/public-project/Manual.pdf",
        "http://ia800308.us.archive.org/21/items/public-project/Manual.pdf",
        "https://localhost.us.archive.org/21/items/public-project/Manual.pdf",
        "https://ia800308.us.archive.org/21/items/other/Manual.pdf",
        "https://ia800308.us.archive.org/21/items/public-project/different.pdf",
        "https://user:pass@ia800308.us.archive.org/21/items/public-project/Manual.pdf",
    ] {
        assert!(
            !redirect_allowed(&Url::parse(url).unwrap(), &item, "Manual.pdf"),
            "{url}"
        );
    }
}
#[tokio::test]
async fn review_fetches_only_metadata_and_direct_file_selects_no_siblings() {
    let (api, calls, worker) = fixture(vec![(
        200,
        "Content-Type: application/json\r\n",
        metadata().to_string(),
    )]);
    let result = api
        .review(&target("https://archive.org/download/public-project/Manual.pdf").unwrap())
        .await
        .unwrap();
    assert_eq!(result.files.len(), 1);
    assert_eq!(result.selected_id.as_deref(), Some("Manual.pdf"));
    worker.join().unwrap();
    let calls = calls.lock().unwrap();
    assert_eq!(calls.len(), 1);
    assert!(calls[0].starts_with("GET /metadata/public-project?extended_err=1 "));
}
#[tokio::test]
async fn explicit_preparation_rechecks_metadata_and_probes_only_the_selected_endpoint() {
    let (api, calls, worker) = fixture(vec![
        (
            200,
            "Content-Type: application/json\r\n",
            metadata().to_string(),
        ),
        (206, "Content-Type: application/zip\r\n", "x".into()),
    ]);
    let result = api
        .prepare(
            &target("https://archive.org/details/public-project").unwrap(),
            "Builds/Project 日本+1.zip",
        )
        .await
        .unwrap();
    assert_eq!(result.name, "Project 日本+1.zip");
    assert_eq!(result.expected_bytes, Some(4096));
    assert!(result.expected_sha256.is_none());
    assert_eq!(
        result.url,
        "https://archive.org/download/public-project/Builds/Project%20%E6%97%A5%E6%9C%AC+1.zip"
    );
    worker.join().unwrap();
    let calls = calls.lock().unwrap();
    assert_eq!(calls.len(), 2);
    assert!(calls[1].to_ascii_lowercase().contains("range: bytes=0-0"));
    assert!(calls
        .iter()
        .all(|c| !c.to_ascii_lowercase().contains("authorization:")
            && !c.to_ascii_lowercase().contains("cookie:")));
}
#[tokio::test]
async fn removed_private_or_changed_files_cannot_be_prepared_by_substitution() {
    for (file, error) in [
        ("private.zip", "public_review"),
        ("removed.zip", "public_missing"),
    ] {
        let (api, calls, worker) = fixture(vec![(
            200,
            "Content-Type: application/json\r\n",
            metadata().to_string(),
        )]);
        assert_eq!(
            api.prepare(
                &target("https://archive.org/details/public-project").unwrap(),
                file
            )
            .await
            .unwrap_err(),
            error
        );
        worker.join().unwrap();
        assert_eq!(calls.lock().unwrap().len(), 1);
    }
    let api = Api::new().unwrap();
    assert_eq!(
        api.prepare(
            &target("https://archive.org/download/public-project/Manual.pdf").unwrap(),
            "private.zip"
        )
        .await
        .unwrap_err(),
        "public_url"
    );
}
#[tokio::test]
async fn access_errors_and_login_redirects_do_not_create_downloads() {
    for (status, headers, error) in [
        (403, "", "public_review"),
        (404, "", "public_missing"),
        (429, "", "public_rate_limit"),
        (451, "", "public_restricted"),
        (200, "Content-Type: text/html\r\n", "public_review"),
        (
            302,
            "Location: https://archive.org/account/login\r\n",
            "public_review",
        ),
        (
            302,
            "Location: https://evil.invalid/file.zip\r\n",
            "public_review",
        ),
    ] {
        let (api, calls, worker) = fixture(vec![
            (
                200,
                "Content-Type: application/json\r\n",
                metadata().to_string(),
            ),
            (status, headers, "".into()),
        ]);
        assert_eq!(
            api.prepare(
                &target("https://archive.org/details/public-project").unwrap(),
                "Manual.pdf"
            )
            .await
            .unwrap_err(),
            error
        );
        worker.join().unwrap();
        assert_eq!(calls.lock().unwrap().len(), 2);
    }
}
#[tokio::test]
#[ignore = "Explicit live metadata check for the API documentation's public example; no saved payload"]
async fn live_documented_item_metadata() {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let result = review(Request {
        url: "https://archive.org/download/xfetch/xfetch.pdf".into(),
        file: String::new(),
    })
    .await
    .unwrap();
    assert_eq!(result.selected_id.as_deref(), Some("xfetch.pdf"));
    assert_eq!(result.files.len(), 1);
    assert!(result.files[0].bytes.is_some_and(|n| n > 0));
}

#[tokio::test]
async fn public_batch_reviews_archive_once_and_keeps_exact_nested_members() {
    let headers="Content-Type: application/octet-stream\r\n";
    let(api,calls,worker)=fixture(vec![(200,"Content-Type: application/json\r\n",metadata().to_string()),(206,headers,"x".into()),(206,headers,"x".into())]);
    let result=api.prepare_batch(&target("https://archive.org/details/public-project").unwrap(),&["Builds/Project 日本+1.zip".into(),"Manual.pdf".into()]).await.unwrap();
    worker.join().unwrap();
    assert_eq!(result.len(),2);assert_eq!(result[0].name,"Project 日本+1.zip");assert_eq!(result[1].name,"Manual.pdf");
    assert!(result[0].url.contains("/Builds/Project%20"));assert_eq!(result[0].expected_bytes,Some(4096));
    let calls=calls.lock().unwrap();assert_eq!(calls.len(),3);assert_eq!(calls.iter().filter(|r|r.starts_with("GET /metadata/")).count(),1);
}
#[tokio::test]
async fn public_batch_restricted_archive_member_prevents_all_probes() {
    let(api,calls,worker)=fixture(vec![(200,"Content-Type: application/json\r\n",metadata().to_string())]);
    let error=api.prepare_batch(&target("https://archive.org/details/public-project").unwrap(),&["Manual.pdf".into(),"private.zip".into()]).await.unwrap_err();
    worker.join().unwrap();assert_eq!(error.code,"public_review");assert_eq!(error.file.as_deref(),Some("private.zip"));assert_eq!(calls.lock().unwrap().len(),1);
}
