// Real HTTP/file/queue tests for replacing one expired link without merging different files.
fn relink_fixture(f: &Fixture, s: &Server, saved: usize) -> (Arc<Transfers>, Transfer, PathBuf) {
    let manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
    let mut record = queued_fixture(f, s, "game.zip", "one", 7);
    record.url = format!("{}/forbidden", s.url);
    record.source_link = Some("https://example.org/releases/game".into());
    record.status = Status::Failed;
    record.error = Some("transfer_access".into());
    record.received = saved as u64;
    record.validator = Some("\"fixture-v1\"".into());
    let part = files::partial(Path::new(&record.destination), &record.id).unwrap();
    fs::write(&part, &s.data[..saved]).unwrap();
    {
        let mut state = manager.state.lock().unwrap();
        state.records.push(record.clone());
        manager.persist(&state).unwrap();
    }
    (manager, record, part)
}
fn fresh_link(record: &Transfer, s: &Server, route: &str) -> Relink {
    Relink {
        profile: record.profile.clone(),
        id: record.id.clone(),
        previous_url: record.url.clone(),
        url: format!("{}{route}", s.url),
        filename: "game.zip".into(),
        source_link: record.source_link.clone(),
        browser_ticket: None,
        expected_bytes: record.expected_bytes,
        expected_sha256: record.expected_sha256.clone(),
    }
}
#[tokio::test]
async fn relink_checks_saved_prefix_before_tail_and_preserves_transfer_identity() {
    for saved in [0, 65537, 4 * 1024 * 1024] {
        let f = Fixture::new();
        let s = Server::start();
        let (manager, old, part) = relink_fixture(&f, &s, saved);
        let accepted = manager.relink(fresh_link(&old, &s, "/fast")).unwrap();
        assert_eq!(accepted.id, old.id);
        assert_eq!(accepted.destination, old.destination);
        assert_eq!(accepted.queue_order, old.queue_order);
        assert_eq!(accepted.created_at, old.created_at);
        assert_eq!(accepted.source_link, old.source_link);
        assert_eq!(accepted.checking_partial, (saved > 0).then_some(0));
        assert!(accepted.validator.is_none());
        let done = until(&manager, &old.id, |r| r.status == Status::Complete).await;
        assert!(done.checking_partial.is_none());
        assert_eq!(done.sha256, Some(s.hash()));
        assert_eq!(fs::read(&done.destination).unwrap(), *s.data);
        assert!(!part.exists());
        let requests = s.requests.lock().unwrap();
        assert_eq!(requests.len(), 1);
        assert!(!requests[0].to_ascii_lowercase().contains("range:"));
    }
}
#[tokio::test]
async fn relink_rejects_a_different_prefix_even_when_the_hosts_reuse_an_etag() {
    let f = Fixture::new();
    let s = Server::start();
    let (manager, old, part) = relink_fixture(&f, &s, 131073);
    let mut original = fs::read(&part).unwrap();
    original[65536] ^= 1;
    fs::write(&part, &original).unwrap();
    manager.relink(fresh_link(&old, &s, "/fast")).unwrap();
    let failed = until(&manager, &old.id, |r| r.status == Status::Failed).await;
    assert_eq!(failed.error.as_deref(), Some("transfer_changed"));
    assert!(failed.checking_partial.is_some());
    assert!(failed.validator.is_none());
    assert_eq!(fs::read(&part).unwrap(), original);
    assert!(!Path::new(&old.destination).exists());
}
#[test]
fn relink_rejects_wrong_file_profile_source_stale_state_and_receipt_without_mutation() {
    let f = Fixture::new();
    let s = Server::start();
    let (manager, old, part) = relink_fixture(&f, &s, 65537);
    let before = fs::read(f.0.join("state/transfers.json")).unwrap();
    let bytes = fs::read(&part).unwrap();
    for case in 0..8 {
        let mut request = fresh_link(&old, &s, "/fast");
        match case {
            0 => request.filename = "another.zip".into(),
            1 => request.profile = "two".into(),
            2 => request.source_link = None,
            3 => request.previous_url.push('x'),
            4 => request.expected_bytes = Some(42),
            5 => request.expected_sha256 = Some("a".repeat(64)),
            6 => request.browser_ticket = Some(uuid::Uuid::new_v4().to_string()),
            _ => request.url = "file:///game.zip".into(),
        }
        assert!(manager.relink(request).is_err(), "case {case}");
        assert_eq!(fs::read(f.0.join("state/transfers.json")).unwrap(), before);
        assert_eq!(fs::read(&part).unwrap(), bytes);
    }
    assert_eq!(manager.list("one").unwrap()[0].url, old.url);
    assert!(s.requests.lock().unwrap().is_empty());
}
#[tokio::test]
async fn relink_pause_reload_rechecks_the_entire_prefix_before_resuming() {
    let f = Fixture::new();
    let s = Server::start();
    let (manager, old, part) = relink_fixture(&f, &s, 262145);
    manager.bandwidth.set("one", 32768);
    manager.relink(fresh_link(&old, &s, "/fast")).unwrap();
    until(&manager, &old.id, |r| {
        r.checking_partial.is_some_and(|n| n > 0)
    })
    .await;
    manager.action("one", &old.id, "pause").unwrap();
    let paused = until(&manager, &old.id, |r| r.status == Status::Paused).await;
    assert!(paused.checking_partial.is_some());
    assert!(paused.validator.is_none());
    assert_eq!(fs::read(&part).unwrap(), s.data[..262145]);
    drop(manager);
    let restored = Transfers::load(f.0.join("state"), |_| {}).unwrap();
    assert!(restored.list("one").unwrap()[0].checking_partial.is_some());
    restored.action("one", &old.id, "resume").unwrap();
    let done = until(&restored, &old.id, |r| r.status == Status::Complete).await;
    assert_eq!(done.sha256, Some(s.hash()));
    let requests = s.requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    assert!(requests
        .iter()
        .all(|r| !r.to_ascii_lowercase().contains("range:")));
}
#[tokio::test]
async fn relink_interrupted_prefix_retries_from_zero_without_discarding_partial() {
    let f = Fixture::new();
    let s = Server::start();
    let (manager, old, _) = relink_fixture(&f, &s, 3 * 1024 * 1024);
    manager.relink(fresh_link(&old, &s, "/drop")).unwrap();
    let done = until(&manager, &old.id, |r| r.status == Status::Complete).await;
    assert_eq!(done.sha256, Some(s.hash()));
    let requests = s.requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    assert!(requests
        .iter()
        .all(|r| !r.to_ascii_lowercase().contains("range:")));
}
#[tokio::test]
async fn relink_html_error_preserves_partial_and_the_pending_identity_check() {
    let f = Fixture::new();
    let s = Server::start();
    let (manager, old, part) = relink_fixture(&f, &s, 65537);
    manager.relink(fresh_link(&old, &s, "/html")).unwrap();
    let failed = until(&manager, &old.id, |r| r.status == Status::Failed).await;
    assert!(failed.checking_partial.is_some());
    assert_eq!(fs::read(&part).unwrap(), s.data[..65537]);
    assert!(!Path::new(&old.destination).exists());
}

#[tokio::test]
async fn relink_verified_prefix_allows_a_range_retry_on_the_replacement_url() {
    let f = Fixture::new();
    let s = Server::start();
    let (manager, old, _) = relink_fixture(&f, &s, 65537);
    manager.relink(fresh_link(&old, &s, "/drop")).unwrap();
    let done = until(&manager, &old.id, |r| r.status == Status::Complete).await;
    assert_eq!(done.sha256, Some(s.hash()));
    assert_eq!(fs::read(&old.destination).unwrap(), *s.data);
    let requests = s.requests.lock().unwrap();
    assert_eq!(requests.len(), 2);
    assert!(!requests[0].to_ascii_lowercase().contains("range:"));
    assert!(requests[1]
        .to_ascii_lowercase()
        .contains("range: bytes=2097152-"));
    assert!(requests[1].contains("\"fixture-v1\""));
}
#[test]
fn relink_active_record_and_failed_store_write_preserve_the_original_request() {
    let f = Fixture::new();
    let s = Server::start();
    let (manager, old, part) = relink_fixture(&f, &s, 65537);
    manager
        .state
        .lock()
        .unwrap()
        .active
        .insert(old.id.clone(), CancellationToken::new());
    assert!(matches!(
        manager.relink(fresh_link(&old, &s, "/fast")),
        Err("transfer_state")
    ));
    manager.state.lock().unwrap().active.remove(&old.id);
    let path = f.0.join("state/transfers.json");
    let backup = f.0.join("state/original.json");
    fs::rename(&path, &backup).unwrap();
    fs::create_dir(&path).unwrap();
    assert!(matches!(
        manager.relink(fresh_link(&old, &s, "/fast")),
        Err("transfer_store")
    ));
    let after = manager.list("one").unwrap().remove(0);
    assert_eq!(after.url, old.url);
    assert_eq!(after.validator, old.validator);
    assert_eq!(after.status, old.status);
    assert_eq!(after.checking_partial, old.checking_partial);
    assert_eq!(fs::read(&part).unwrap(), s.data[..65537]);
    assert!(manager.state.lock().unwrap().active.is_empty());
    fs::remove_dir(&path).unwrap();
    fs::rename(&backup, &path).unwrap();
}
#[tokio::test]
async fn relink_unknown_length_verifies_existing_bytes_and_completes_with_exact_hash() {
    let f = Fixture::new();
    let s = Server::start();
    let (manager, mut old, _) = relink_fixture(&f, &s, 65537);
    old.total = None;
    old.expected_bytes = None;
    old.source_link = None;
    {
        let mut state = manager.state.lock().unwrap();
        state.records[0] = old.clone();
        manager.persist(&state).unwrap();
    }
    manager.relink(fresh_link(&old, &s, "/unknown")).unwrap();
    let done = until(&manager, &old.id, |r| r.status == Status::Complete).await;
    assert_eq!(done.sha256, Some(s.hash()));
    assert_eq!(done.source_link, Some(old.url));
    assert_eq!(fs::read(&old.destination).unwrap(), *s.data);
}

#[tokio::test]
async fn relink_browser_receipt_is_bound_and_persists_without_an_external_request() {
    let f = Fixture::new();
    let s = Server::start();
    let (manager, old, part) = relink_fixture(&f, &s, 65537);
    let holds: Vec<_> = (0..2)
        .map(|_| QueueEntry::new(QueueKind::Torrent, &uuid::Uuid::new_v4().to_string(), "one"))
        .collect();
    manager.queue.register(&holds).unwrap();
    let cancel = CancellationToken::new();
    let mut tickets = Vec::new();
    for hold in &holds {
        let ticket = manager
            .queue
            .ticket(hold.kind, &hold.profile, &hold.id)
            .unwrap();
        ticket.acquire(&cancel).await.unwrap();
        tickets.push(ticket);
    }
    let page = "https://fuckingfast.co/ab12cd34ef56";
    let url = format!("https://fuckingfast.co/dl/{}", "new_aB9-".repeat(12));
    let grant = super::super::source_browser_grants::shared()
        .insert("one", &url, page, None)
        .unwrap();
    let mut request = fresh_link(&old, &s, "/fast");
    request.url = url.clone();
    request.browser_ticket = Some(grant.clone());
    request.url.push('x');
    assert!(matches!(manager.relink(request), Err("transfer_access")));
    let mut request = fresh_link(&old, &s, "/fast");
    request.url = url.clone();
    request.browser_ticket = Some(grant);
    let changed = manager.relink(request).unwrap();
    assert_eq!(changed.source_page.as_deref(), Some(page));
    assert_eq!(changed.source_link, old.source_link);
    manager.action("one", &old.id, "pause").unwrap();
    until(&manager, &old.id, |r| r.status == Status::Paused).await;
    drop(tickets);
    drop(manager);
    let restored = Transfers::load(f.0.join("state"), |_| {})
        .unwrap()
        .list("one")
        .unwrap()
        .remove(0);
    assert_eq!(restored.url, url);
    assert_eq!(restored.source_page.as_deref(), Some(page));
    assert!(restored.checking_partial.is_some());
    assert_eq!(fs::read(&part).unwrap(), s.data[..65537]);
    let json = fs::read_to_string(f.0.join("state/transfers.json")).unwrap();
    assert!(!json.contains("browserTicket"));
    assert!(!json.contains("accountToken"));
    assert!(s.requests.lock().unwrap().is_empty());
}
