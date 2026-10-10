use super::*;
use serde_json::json;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

fn file(id: &str) -> PublicFile {
    PublicFile {
        id: id.into(),
        name: format!("Project.{id}.7z"),
        bytes: Some(123),
        sha256: None,
        state: "available".into(),
        speed_limit: None,
    }
}
fn list() -> PublicFiles {
    PublicFiles {
        title: "Parts".into(),
        files: (0..9).map(|n| file(&n.to_string())).collect(),
        selected_id: None,
    }
}
fn download(file: &PublicFile) -> PublicDownload {
    PublicDownload {
        url: format!("https://pixeldrain.com/api/file/{}?download", file.id),
        name: file.name.clone(),
        expected_bytes: file.bytes,
        expected_sha256: None,
    }
}

#[test]
fn member_review_rejects_missing_restricted_duplicate_and_colliding_selections() {
    assert_eq!(
        members(list(), &["2".into(), "0".into()])
            .unwrap()
            .iter()
            .map(|f| f.id.as_str())
            .collect::<Vec<_>>(),
        ["2", "0"]
    );
    for ids in [vec![], vec!["0".into(); 201]] {
        assert_eq!(
            members(list(), &ids).unwrap_err().code,
            "public_batch_limit"
        );
    }
    assert_eq!(
        members(list(), &["0".into(), "0".into()]).unwrap_err().code,
        "public_metadata"
    );
    assert_eq!(
        members(list(), &["absent".into()]).unwrap_err().code,
        "public_missing"
    );
    let mut value = list();
    value.files[1].state = "restricted".into();
    let error = members(value, &["0".into(), "1".into()]).unwrap_err();
    assert_eq!(error.code, "public_restricted");
    assert_eq!(error.file.as_deref(), Some("Project.1.7z"));
    let mut value = list();
    value.files[0].name = "a/PART.zip".into();
    value.files[1].name = "b/part.zip".into();
    assert_eq!(
        members(value, &["0".into(), "1".into()]).unwrap_err().code,
        "transfer_batch_names"
    );
}
#[test]
fn cancellation_is_profile_bound_bounded_and_keeps_slots_until_work_ends() {
    let now = Instant::now();
    let mut state = State::default();
    state.cancel("one", "early", now);
    assert_eq!(
        state.reserve("one", "early", now).unwrap_err(),
        "public_batch_canceled"
    );
    let one = state.reserve("one", "a", now).unwrap();
    let two = state.reserve("two", "a", now).unwrap();
    state.cancel("two", "a", now);
    assert!(!one.is_cancelled());
    assert!(two.is_cancelled());
    assert_eq!(
        state.reserve("three", "a", now).unwrap_err(),
        "public_batch_busy"
    );
    state.active.remove(&("two".into(), "a".into()));
    assert!(state.reserve("three", "a", now).is_ok());
    for n in 0..100 {
        state.cancel("one", &n.to_string(), now)
    }
    assert_eq!(state.canceled.len(), 32);
    state.active.clear();
    assert!(state
        .reserve("one", "99", now + WAIT + Duration::from_secs(1))
        .is_ok());
}
#[tokio::test]
async fn parallel_checks_are_bounded_ordered_and_fail_as_one_selection() {
    let files = list().files;
    let active = AtomicUsize::new(0);
    let maximum = AtomicUsize::new(0);
    let result = collect(&files, |file| async {
        let count = active.fetch_add(1, Ordering::SeqCst) + 1;
        maximum.fetch_max(count, Ordering::SeqCst);
        tokio::time::sleep(Duration::from_millis(
            5 * (9 - file.id.parse::<u64>().unwrap()),
        ))
        .await;
        active.fetch_sub(1, Ordering::SeqCst);
        Ok(download(file))
    })
    .await
    .unwrap();
    assert_eq!(maximum.load(Ordering::SeqCst), 3);
    assert_eq!(active.load(Ordering::SeqCst), 0);
    assert_eq!(
        result.iter().map(|f| f.name.clone()).collect::<Vec<_>>(),
        files.iter().map(|f| f.name.clone()).collect::<Vec<_>>()
    );
    let called = AtomicUsize::new(0);
    let error = collect(&files, |file| {
        called.fetch_add(1, Ordering::SeqCst);
        async move {
            if file.id == "0" {
                Err("public_review")
            } else {
                std::future::pending().await
            }
        }
    })
    .await
    .unwrap_err();
    assert_eq!(error.code, "public_review");
    assert_eq!(error.file.as_deref(), Some("Project.0.7z"));
    assert!(called.load(Ordering::SeqCst) <= 3);
    let error = collect(&files, |file| async move {
        let mut result = download(file);
        result.name = "same.zip".into();
        Ok(result)
    })
    .await
    .unwrap_err();
    assert_eq!(error.code, "transfer_batch_names");
}
#[tokio::test]
async fn cancel_drops_pending_requests_and_returns_the_slot_without_a_queue_result() {
    let session = uuid::Uuid::new_v4().to_string();
    let files = list().files;
    let called = Arc::new(AtomicUsize::new(0));
    let seen = called.clone();
    let future = run(
        "batch-test",
        &session,
        collect(&files, |_| {
            seen.fetch_add(1, Ordering::SeqCst);
            std::future::pending()
        }),
    );
    let canceler = async {
        while called.load(Ordering::SeqCst) < 3 {
            tokio::task::yield_now().await
        }
        cancel("other-profile", &session);
        tokio::task::yield_now().await;
        cancel("batch-test", &session);
    };
    let (result, _) = tokio::join!(future, canceler);
    assert_eq!(result.unwrap_err().code, "public_batch_canceled");
    assert_eq!(called.load(Ordering::SeqCst), 3);
    assert!(!state()
        .lock()
        .unwrap()
        .active
        .contains_key(&("batch-test".into(), session.clone())));
    assert_eq!(
        run("batch-test", &session, async {
            panic!("canceled work must not start")
        })
        .await
        .unwrap_err()
        .code,
        "public_batch_canceled"
    );
}

// Real local HTTP probes exercise the production adapters. No external source or payload.
async fn fixture(
    stall: bool,
) -> (
    String,
    Arc<Mutex<Vec<String>>>,
    Arc<AtomicUsize>,
    tokio::task::JoinHandle<()>,
) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let calls = Arc::new(Mutex::new(Vec::new()));
    let capture = calls.clone();
    let closed = Arc::new(AtomicUsize::new(0));
    let seen = closed.clone();
    let server = tokio::spawn(async move {
        loop {
            let (socket, _) = listener.accept().await.unwrap();
            let capture = capture.clone();
            let closed = seen.clone();
            tokio::spawn(async move {
                let mut socket = socket;
                let mut data = Vec::new();
                loop {
                    let mut part = [0; 1024];
                    let size = socket.read(&mut part).await.unwrap();
                    if size == 0 {
                        return;
                    }
                    data.extend_from_slice(&part[..size]);
                    if data.windows(4).any(|v| v == b"\r\n\r\n") {
                        break;
                    }
                }
                let request = String::from_utf8(data).unwrap();
                let route = request.split_whitespace().nth(1).unwrap().to_string();
                capture.lock().unwrap().push(request);
                if stall && route.ends_with("/info") {
                    let mut byte = [0];
                    if matches!(
                        tokio::time::timeout(Duration::from_secs(5), socket.read(&mut byte)).await,
                        Ok(Ok(0))
                    ) {
                        closed.fetch_add(1, Ordering::SeqCst);
                    }
                    return;
                }
                let entry = |id: &str| json!({"success":true,"id":id,"name":format!("Project.{id}.7z"),"size":123,"availability":"","can_download":true});
                let (content, body) = if route.starts_with("/list/") {
                    ("application/json",json!({"success":true,"id":"parts","title":"Parts","file_count":9,"files":(0..9).map(|n|entry(&n.to_string())).collect::<Vec<_>>()} ).to_string())
                } else if route.ends_with("/info") {
                    (
                        "application/json",
                        entry(route.split('/').nth(2).unwrap()).to_string(),
                    )
                } else if route.starts_with("/metadata/") {
                    ("application/json",json!({"metadata":{"identifier":"parts","title":"Parts"},"files_count":9,"files":(0..9).map(|n|json!({"name":format!("{n}.7z"),"size":"123"})).collect::<Vec<_>>()}).to_string())
                } else {
                    ("application/octet-stream", "x".into())
                };
                let reply=format!("HTTP/1.1 200 OK\r\nContent-Type: {content}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len());
                let _ = socket.write_all(reply.as_bytes()).await;
            });
        }
    });
    (base, calls, closed, server)
}
#[tokio::test]
async fn pixeldrain_batch_reads_the_list_once_and_probes_exact_selected_ids() {
    let (base, calls, _, server) = fixture(false).await;
    let mut api = super::super::Api::new().unwrap();
    api.base = base;
    let target = super::super::target("https://pixeldrain.com/l/parts").unwrap();
    let ids = vec!["8".into(), "2".into(), "0".into()];
    let result = prepare_pixeldrain(&api, &target, &ids).await.unwrap();
    assert_eq!(
        result.iter().map(|f| f.name.as_str()).collect::<Vec<_>>(),
        ["Project.8.7z", "Project.2.7z", "Project.0.7z"]
    );
    let calls = calls.lock().unwrap();
    assert_eq!(calls.len(), 7);
    assert_eq!(
        calls.iter().filter(|r| r.starts_with("GET /list/")).count(),
        1
    );
    for id in ["8", "2", "0"] {
        assert!(calls
            .iter()
            .any(|r| r.starts_with(&format!("GET /file/{id}/info "))));
        assert!(calls
            .iter()
            .any(|r| r.starts_with(&format!("GET /file/{id}?download "))
                && r.to_lowercase().contains("range: bytes=0-0")))
    }
    server.abort();
}

#[tokio::test]
async fn cancel_closes_actual_http_requests_and_never_starts_later_members() {
    let (base, calls, closed, server) = fixture(true).await;
    let mut api = super::super::Api::new().unwrap();
    api.base = base;
    let target = super::super::target("https://pixeldrain.com/l/parts").unwrap();
    let ids = (0..9).map(|n| n.to_string()).collect::<Vec<_>>();
    let session = uuid::Uuid::new_v4().to_string();
    let future = run(
        "http-cancel-test",
        &session,
        prepare_pixeldrain(&api, &target, &ids),
    );
    let canceler = async {
        tokio::time::timeout(Duration::from_secs(5), async {
            while calls.lock().unwrap().len() < 4 {
                tokio::task::yield_now().await
            }
        })
        .await
        .unwrap();
        cancel("http-cancel-test", &session);
    };
    let (result, _) = tokio::join!(future, canceler);
    assert_eq!(result.unwrap_err().code, "public_batch_canceled");
    tokio::time::timeout(Duration::from_secs(5), async {
        while closed.load(Ordering::SeqCst) < 3 {
            tokio::task::yield_now().await
        }
    })
    .await
    .unwrap();
    assert_eq!(calls.lock().unwrap().len(), 4);
    assert!(!calls
        .lock()
        .unwrap()
        .iter()
        .any(|r| r.contains("?download")));
    server.abort();
}
