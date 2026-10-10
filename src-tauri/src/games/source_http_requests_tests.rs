use super::*;
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, sync::oneshot};

fn id() -> String { uuid::Uuid::new_v4().to_string() }

#[tokio::test]
async fn cancellation_before_dispatch_is_scoped_and_invalid_identities_are_refused() {
    let requests = Requests::default(); let session = id();
    requests.cancel(Some("one"), &session);
    assert_eq!(requests.run(Some("one"), &session, DEADLINE, async { Ok(1) }).await.unwrap_err(), "source_canceled");
    assert_eq!(requests.run(Some("two"), &session, DEADLINE, async { Ok(2) }).await.unwrap(), 2);
    assert_eq!(requests.run(None, &session, DEADLINE, async { Ok(3) }).await.unwrap(), 3);
    assert_eq!(requests.run(Some("one"), &session, DEADLINE, async { Ok(4) }).await.unwrap_err(), "source_canceled");
    for profile in [Some(""), Some("bad\nprofile")] {
        assert!(requests.run(profile, &id(), DEADLINE, async { Ok(()) }).await.is_err());
    }
    assert!(requests.run(None, "not-an-id", DEADLINE, async { Ok(()) }).await.is_err());
    assert!(requests.state.lock().unwrap().active.is_empty());
}

#[tokio::test]
async fn a_thousand_successful_reads_do_not_fill_cancellation_history_or_block_refresh() {
    let requests = Requests::default();
    for i in 0..1000 { assert_eq!(requests.run(Some("one"), &id(), DEADLINE, async { Ok(i) }).await.unwrap(), i); }
    let state = requests.state.lock().unwrap(); assert!(state.active.is_empty()); assert!(state.closed.is_empty());
    assert!(state.saturated_until.is_none()); assert_eq!(requests.slot.available_permits(), 1);
}

#[test]
fn pending_and_cancel_history_are_bounded_without_forgetting_early_cancels() {
    let now = Instant::now(); let mut state = State::default();
    for _ in 0..MAX_PENDING { state.reserve(&key(Some("one"), &id()).unwrap(), now).unwrap(); }
    assert_eq!(state.reserve(&key(Some("one"), &id()).unwrap(), now).unwrap_err(), "source_network");
    state.active.clear();
    for _ in 0..MAX_HISTORY { state.remember(key(None, &id()).unwrap(), now); }
    let overflow = key(None, &id()).unwrap(); state.remember(overflow.clone(), now);
    assert_eq!(state.closed.len(), MAX_HISTORY);
    assert!(state.reserve(&overflow, now).is_err());
    assert!(state.reserve(&key(None, &id()).unwrap(), now).is_err());
    assert!(state.reserve(&key(None, &id()).unwrap(), now + HISTORY).is_ok());
    assert!(state.closed.is_empty());
}

// A real socket held before headers or partway through a body. Dropping the
// reqwest future must close it; a UI-only Promise race would leave it open.
async fn held_http(body_started: bool) -> (String, oneshot::Receiver<()>, tokio::task::JoinHandle<usize>) {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/catalog", listener.local_addr().unwrap());
    let (ready, received) = oneshot::channel();
    let task = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = Vec::new(); let mut buf = [0; 1024];
        while !request.windows(4).any(|part| part == b"\r\n\r\n") {
            let read = stream.read(&mut buf).await.unwrap(); assert!(read > 0); request.extend_from_slice(&buf[..read]);
        }
        if body_started {
            stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 1000000\r\nConnection: close\r\n\r\npartial").await.unwrap();
        }
        ready.send(()).unwrap();
        tokio::time::timeout(Duration::from_secs(3), stream.read(&mut buf)).await.expect("canceled native request kept its HTTP socket open").unwrap_or(0)
    });
    (url, received, task)
}

#[tokio::test]
async fn native_cancellation_closes_waiting_headers_and_partial_body_sockets() {
    for body_started in [false, true] {
        let requests = Arc::new(Requests::default()); let session = id();
        let (url, ready, server) = held_http(body_started).await;
        let owner = requests.clone(); let current = session.clone();
        let task = tokio::spawn(async move { owner.run(Some("one"), &current, DEADLINE, async {
            reqwest::Client::new().get(url).send().await.map_err(|_| "send")?.bytes().await.map_err(|_| "body")?;
            Ok(())
        }).await });
        ready.await.unwrap(); requests.cancel(Some("other"), &session);
        assert!(!task.is_finished());
        requests.cancel(Some("one"), &session);
        assert_eq!(tokio::time::timeout(Duration::from_secs(3), task).await.unwrap().unwrap().unwrap_err(), "source_canceled");
        assert_eq!(server.await.unwrap(), 0);
        assert!(requests.state.lock().unwrap().active.is_empty());
        assert_eq!(requests.slot.available_permits(), 1);
        assert_eq!(requests.run(Some("one"), &id(), DEADLINE, async { Ok(7) }).await.unwrap(), 7);
    }
}

#[tokio::test]
async fn queued_cancellation_and_deadline_never_start_http_work() {
    let requests = Arc::new(Requests::default()); let session = id();
    let owner = requests.clone(); let current = session.clone(); let (started, ready) = oneshot::channel();
    let active = tokio::spawn(async move { owner.run(Some("one"), &current, DEADLINE, async {
        let _ = started.send(()); std::future::pending::<Result<()>>().await
    }).await });
    ready.await.unwrap();
    assert_eq!(requests.run(Some("one"), &session, DEADLINE, async { Ok(()) }).await.unwrap_err(), "source_network");
    let count = Arc::new(AtomicUsize::new(0)); let mut queued = Vec::new();
    for _ in 0..24 {
        let owner = requests.clone(); let probe = count.clone(); let session = id(); let current = session.clone();
        queued.push((session, tokio::spawn(async move { owner.run(Some("one"), &current, DEADLINE, async {
            probe.fetch_add(1, Ordering::SeqCst); Ok(())
        }).await })));
    }
    // Pre-dispatch cancellation is also valid; no timing sleep is needed.
    for (session, _) in &queued { requests.cancel(Some("one"), session); }
    for (_, task) in queued { assert_eq!(task.await.unwrap().unwrap_err(), "source_canceled"); }
    let probe = count.clone();
    assert_eq!(requests.run(Some("one"), &id(), Duration::from_millis(50), async {
        probe.fetch_add(1, Ordering::SeqCst); Ok(())
    }).await.unwrap_err(), "source_network");
    assert_eq!(count.load(Ordering::SeqCst), 0);
    requests.cancel(Some("one"), &session); assert_eq!(active.await.unwrap().unwrap_err(), "source_canceled");
    assert!(requests.state.lock().unwrap().active.is_empty());
    assert_eq!(requests.run(None, &id(), DEADLINE, async { Ok(8) }).await.unwrap(), 8);
}

#[tokio::test]
async fn timeout_drops_http_and_abandoned_command_releases_ownership() {
    let requests = Arc::new(Requests::default()); let session = id();
    let (url, ready, server) = held_http(true).await;
    let owner = requests.clone(); let current = session.clone();
    let task = tokio::spawn(async move { owner.run(None, &current, Duration::from_millis(500), async {
        reqwest::Client::new().get(url).send().await.map_err(|_| "send")?.bytes().await.map_err(|_| "body")?; Ok(())
    }).await });
    ready.await.unwrap(); assert_eq!(task.await.unwrap().unwrap_err(), "source_network"); assert_eq!(server.await.unwrap(), 0);
    let (started, ready) = oneshot::channel(); let owner = requests.clone(); let session = id();
    let task = tokio::spawn(async move { owner.run(None, &session, DEADLINE, async {
        let _ = started.send(()); std::future::pending::<Result<()>>().await
    }).await });
    ready.await.unwrap(); task.abort(); assert!(task.await.unwrap_err().is_cancelled());
    assert!(requests.state.lock().unwrap().active.is_empty()); assert_eq!(requests.slot.available_permits(), 1);
}

#[tokio::test]
async fn serial_admission_and_failures_keep_later_requests_usable() {
    let requests = Arc::new(Requests::default()); let count = Arc::new(AtomicUsize::new(0)); let peak = Arc::new(AtomicUsize::new(0));
    let mut tasks = Vec::new();
    for i in 0..24 {
        let owner = requests.clone(); let count = count.clone(); let peak = peak.clone();
        tasks.push(tokio::spawn(async move { owner.run(Some("one"), &id(), DEADLINE, async {
            let active = count.fetch_add(1, Ordering::SeqCst) + 1; peak.fetch_max(active, Ordering::SeqCst);
            tokio::task::yield_now().await; count.fetch_sub(1, Ordering::SeqCst);
            if i % 2 == 0 { Err("fixture-failure".into()) } else { Ok(i) }
        }).await }));
    }
    let mut passed = 0; for task in tasks { if task.await.unwrap().is_ok() { passed += 1; } }
    assert_eq!(passed, 12); assert_eq!(peak.load(Ordering::SeqCst), 1);
    assert!(requests.state.lock().unwrap().active.is_empty()); assert_eq!(requests.slot.available_permits(), 1);
}
