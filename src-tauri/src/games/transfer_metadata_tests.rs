#[tokio::test]
async fn download_identity_and_write_metrics_survive_transfer_and_restart() {
    let f = Fixture::new(); let s = Server::start();
    let events = Arc::new(Mutex::new(Vec::new())); let seen = events.clone();
    let manager = Transfers::load(f.0.join("state"), move |record| seen.lock().unwrap().push(record)).unwrap();
    let mut request = args(&f, &s, "/idle", "game.zip");
    let source_link = "https://www.mediafire.com/file/ExactSource/Community.zip/file";
    request.source_link = Some(source_link.into());
    request.game = Some(DownloadGame { id: "catalog:exact-edition".into(), name: "The selected game".into(),
        artwork: Some("https://art.example/game.jpg".into()), logo: Some("https://art.example/logo.png?token=private".into()), source_name: Some("Official archive".into()), content_kind: Some("patch".into()) });
    let record = manager.add(request).unwrap();
    let complete = until(&manager, &record.id, |r| r.status == Status::Complete).await;
    assert_eq!(complete.game.as_ref().unwrap().id, "catalog:exact-edition");
    assert_eq!(complete.source_link.as_deref(), Some(source_link));
    assert!(complete.source_page.is_none(), "display provenance must never turn into browser authentication");
    assert_eq!(complete.game.as_ref().unwrap().content_kind.as_deref(), Some("patch"));
    assert_eq!(complete.game.as_ref().unwrap().logo, None);
    assert_eq!(complete.disk_bytes_per_second, Some(0));
    assert!(events.lock().unwrap().iter().any(|r| r.status == Status::Downloading && r.disk_bytes_per_second.is_some_and(|value| value > 0)));
    assert!(events.lock().unwrap().iter().any(|r| r.status == Status::Downloading && r.received > 0 && r.bytes_per_second == 0 && r.disk_bytes_per_second == Some(0)), "idle periods clear both live rates");
    assert_eq!(fs::read(&complete.destination).unwrap(), *s.data);
    drop(manager);
    let loaded = Transfers::load(f.0.join("state"), |_| {}).unwrap();
    assert_eq!(loaded.list("one").unwrap()[0].game, complete.game);
    assert_eq!(loaded.list("one").unwrap()[0].source_link, complete.source_link);
    assert!(loaded.list("another").unwrap().is_empty());
    // Old stores retain all transfer behavior without needing display metadata.
    let mut legacy = serde_json::to_value(&complete).unwrap();
    legacy.as_object_mut().unwrap().remove("game");
    legacy.as_object_mut().unwrap().remove("sourceLink");
    legacy.as_object_mut().unwrap().remove("diskBytesPerSecond");
    let old: Transfer = serde_json::from_value(legacy).unwrap();
    assert_eq!(old.game, None); assert_eq!(old.disk_bytes_per_second, None);
    assert_eq!(old.source_link, None);
}

#[test]
fn source_provenance_rejects_invalid_input_before_creating_a_transfer() {
    let f=Fixture::new(); let s=Server::start();
    let manager=Transfers::load(f.0.join("state"), |_| {}).unwrap();
    for invalid in ["", "file:///C:/private", "https://user:secret@example.com/file", "https://example.com/\nfile", "https://example.com/\\file", "javascript:alert(1)"] {
        let mut request=args(&f,&s,"/fast","unused.zip"); request.source_link=Some(invalid.into());
        assert!(matches!(manager.add(request),Err("transfer_invalid_record")));
        assert!(manager.list("one").unwrap().is_empty()); assert_eq!(batch_partials(&f),0);
    }
}

#[test]
fn oversized_transfer_metadata_keeps_the_last_readable_store() {
    let f = Fixture::new(); let s = Server::start();
    let root = f.0.join("state");
    let manager = Transfers::load(root.clone(), |_| {}).unwrap();
    let mut record = queued_fixture(&f, &s, "held.zip", "one", 1);
    record.status = Status::Paused;
    let mut state = manager.state.lock().unwrap();
    state.records.push(record);
    manager.persist(&state).unwrap();
    let previous = fs::read(root.join("transfers.json")).unwrap();
    state.records[0].source_link = Some("x".repeat(STORE_BYTES));
    assert!(matches!(manager.persist(&state), Err("transfer_limit")));
    assert_eq!(fs::read(root.join("transfers.json")).unwrap(), previous);
    drop(state); drop(manager);
    assert_eq!(Transfers::load(root, |_| {}).unwrap().list("one").unwrap().len(), 1);
}
