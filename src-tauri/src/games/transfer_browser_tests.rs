#[test]
fn browser_transfer_context_persists_without_cookie_and_rejects_changed_urls() {
    let f = Fixture::new(); let s = Server::start();
    let root = f.0.join("state");
    let manager = Transfers::load(root.clone(), |_| {}).unwrap();
    let page = "https://gofile.io/d/a1B2c3";
    let url = "https://store-eu-par-1.gofile.io/download/web/8b9c0d1e-2f3a-4b4c-ad5e-6f7a8b9c0d1e/game.zip";
    let mut record = queued_fixture(&f, &s, "browser.zip", "one", 1);
    record.source_page = Some(page.into()); record.url = url.into(); record.status = Status::Paused;
    { let mut state = manager.state.lock().unwrap(); state.records.push(record.clone()); manager.persist(&state).unwrap(); }
    drop(manager);
    let loaded = Transfers::load(root.clone(), |_| {}).unwrap();
    let restored = loaded.list("one").unwrap().remove(0);
    assert_eq!(restored.source_page.as_deref(), Some(page));
    assert_eq!(restored.url, url); assert!(loaded.list("two").unwrap().is_empty());
    let serialized = fs::read_to_string(root.join("transfers.json")).unwrap();
    assert!(!serialized.contains("accountToken")); assert!(!serialized.contains("browserTicket"));
    let mut value: serde_json::Value = serde_json::from_str(&serialized).unwrap();
    value["records"][0]["url"] = "https://attacker.example/game.zip".into();
    fs::write(root.join("transfers.json"), serde_json::to_vec(&value).unwrap()).unwrap();
    assert!(matches!(Transfers::load(root, |_| {}), Err("transfer_store")));
}

#[test]
fn browser_receipt_is_checked_before_queue_or_files_are_created() {
    let f = Fixture::new(); let s = Server::start();
    let manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
    let mut request = args(&f, &s, "/fast", "browser.zip");
    request.url = "https://store-eu-par-1.gofile.io/download/web/8b9c0d1e-2f3a-4b4c-ad5e-6f7a8b9c0d1e/game.zip".into();
    request.browser_ticket = Some(uuid::Uuid::new_v4().to_string());
    assert!(matches!(manager.add(request), Err("transfer_access")));
    assert!(manager.list("one").unwrap().is_empty()); assert_eq!(batch_partials(&f), 0);
}

#[test]
fn browser_public_link_and_original_page_survive_reload_without_cross_provider_access() {
    let f = Fixture::new(); let s = Server::start();
    let root = f.0.join("state");
    let manager = Transfers::load(root.clone(), |_| {}).unwrap();
    let page = "https://fuckingfast.co/ab12cd34ef56";
    let url = format!("https://fuckingfast.co/dl/{}", "a_B9-".repeat(20));
    let mut record = queued_fixture(&f, &s, "public-browser.zip", "one", 1);
    record.source_page = Some(page.into()); record.source_link = Some(format!("{page}#Original.zip")); record.url = url.clone(); record.status = Status::Paused;
    { let mut state = manager.state.lock().unwrap(); state.records.push(record.clone()); manager.persist(&state).unwrap(); }
    drop(manager);
    let loaded = Transfers::load(root.clone(), |_| {}).unwrap();
    let restored = loaded.list("one").unwrap().remove(0);
    assert_eq!(restored.source_page.as_deref(), Some(page));
    assert_eq!(restored.source_link, record.source_link);
    assert_eq!(restored.url, url);
    assert!(loaded.list("two").unwrap().is_empty());
    let serialized = fs::read_to_string(root.join("transfers.json")).unwrap();
    assert!(!serialized.contains("accountToken")); assert!(!serialized.contains("browserTicket"));
    let mut value: serde_json::Value = serde_json::from_str(&serialized).unwrap();
    value["records"][0]["sourcePage"] = "https://gofile.io/d/a1B2c3".into();
    fs::write(root.join("transfers.json"), serde_json::to_vec(&value).unwrap()).unwrap();
    assert!(matches!(Transfers::load(root, |_| {}), Err("transfer_store")));
}

#[tokio::test]
async fn browser_public_receipt_enters_the_real_queue_and_remains_bound_to_its_source() {
    for (page, url) in [
        ("https://fuckingfast.co/ab12cd34ef56", format!("https://fuckingfast.co/dl/{}", "a_B9-".repeat(20))),
        ("https://datanodes.to/r9s07mymkzbt", "https://cdn17.datanodes.to/download/token/archive.rar".into()),
        ("https://1fichier.com/?b7ltalh4x9cn68f0grn1", "https://a-34.1fichier.com/c1103650933".into()),
        ("https://buzzheavier.com/abcdefghijkl", "https://dl.buzzheavier.com/download/token/archive.zip".into()),
    ] { browser_queue_admission(page, url).await; }
}

async fn browser_queue_admission(page: &str, url: String) {
    let f = Fixture::new(); let s = Server::start();
    let root = f.0.join("state");
    let manager = Transfers::load(root.clone(), |_| {}).unwrap();
    // Hold both scheduler slots with owned fixture tickets. No external request may start.
    let holds: Vec<_> = (0..2).map(|_| QueueEntry::new(QueueKind::Torrent, &uuid::Uuid::new_v4().to_string(), "one")).collect();
    manager.queue.register(&holds).unwrap();
    let cancel = CancellationToken::new(); let mut tickets = Vec::new();
    for hold in &holds {
        let ticket = manager.queue.ticket(hold.kind, &hold.profile, &hold.id).unwrap();
        tokio::time::timeout(Duration::from_secs(2), ticket.acquire(&cancel)).await.unwrap().unwrap(); tickets.push(ticket);
    }
    let ticket = super::super::source_browser_grants::shared().insert("one", &url, page, None).unwrap();
    let source_link = if page.contains("fuckingfast.co/") { format!("{page}#Archive.zip") } else { page.to_owned() };
    let mut request = args(&f, &s, "/fast", "browser-accepted.zip");
    request.url = url.clone(); request.browser_ticket = Some(ticket.clone()); request.source_link = Some(source_link.clone());
    let accepted = manager.add(request).unwrap();
    assert_eq!(accepted.source_page.as_deref(), Some(page));
    assert_eq!(accepted.source_link.as_deref(), Some(source_link.as_str()));
    assert_eq!(accepted.url, url);
    assert!(matches!(manager.list("one").unwrap()[0].status, Status::Queued));
    let mut wrong = args(&f, &s, "/fast", "wrong-profile.zip");
    wrong.profile = "two".into(); wrong.url = url; wrong.browser_ticket = Some(ticket);
    assert!(matches!(manager.add(wrong), Err("transfer_access")));
    manager.action("one", &accepted.id, "pause").unwrap();
    let until = Instant::now() + Duration::from_secs(3);
    while !manager.state.lock().unwrap().active.is_empty() { assert!(Instant::now() < until); tokio::time::sleep(Duration::from_millis(5)).await; }
    drop(tickets); drop(manager);
    let restored = Transfers::load(root, |_| {}).unwrap().list("one").unwrap().remove(0);
    assert!(matches!(restored.status, Status::Paused));
    assert_eq!(restored.source_page, accepted.source_page);
    assert_eq!(restored.source_link, accepted.source_link);
    assert_eq!(restored.received, 0);
    assert!(!Path::new(&restored.destination).exists());
}
