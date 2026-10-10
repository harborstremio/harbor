fn batch_args(f: &Fixture, s: &Server, names: &[&str]) -> NewBatch {
    NewBatch {
        profile: "one".into(), directory: f.0.to_string_lossy().into_owned(),
        files: names.iter().map(|name| batch::BatchFile {
            source_link: None,
            browser_ticket: None,
            filename: (*name).into(), name: (*name).into(), game: None, url: format!("{}/fast", s.url),
            expected_bytes: Some(s.data.len() as u64), expected_sha256: Some(s.hash()),
        }).collect(),
    }
}
fn batch_partials(f: &Fixture) -> usize {
    fs::read_dir(&f.0).unwrap().flatten().filter(|entry| entry.file_name().to_string_lossy().starts_with(".harbor-")).count()
}

#[tokio::test]
async fn batch_downloads_keep_names_order_hashes_and_restart_history() {
    let f = Fixture::new(); let s = Server::start(); let root = f.0.join("state");
    let manager = Transfers::load(root.clone(), |_| {}).unwrap();
    let mut request=batch_args(&f, &s, &["Garden 日本.part01.rar", "Garden 日本.part02.rar", "Garden 日本.part03.rar"]);
    for file in &mut request.files {file.source_link=Some("https://example.com/releases/garden".into());}
    let records = manager.add_batch(request).unwrap();
    assert!(records[0].batch_id.as_deref().is_some_and(|id| uuid::Uuid::parse_str(id).is_ok()));
    assert!(records.iter().all(|r|r.batch_id==records[0].batch_id));
    assert_eq!(records.iter().map(|r| r.queue_order).collect::<Vec<_>>(), vec![1,2,3]);
    for record in &records {
        let complete = until(&manager, &record.id, |r| r.status == Status::Complete).await;
        assert_eq!(fs::read(&complete.destination).unwrap(), *s.data);
        assert_eq!(complete.sha256.as_deref(), Some(s.hash().as_str()));
        assert_eq!(Path::new(&complete.destination).file_name().unwrap().to_string_lossy(), record.name);
    }
    drop(manager);
    let loaded = Transfers::load(root, |_| {}).unwrap().list("one").unwrap();
    assert_eq!(loaded.len(), 3);
    for (a, b) in loaded.iter().zip(records) { assert_eq!(a.id,b.id); assert_eq!(a.batch_id,b.batch_id); assert_eq!(a.queue_order,b.queue_order); assert_eq!(a.source_link.as_deref(),Some("https://example.com/releases/garden")); assert!(a.source_page.is_none()); }
    assert_eq!(batch_partials(&f), 0);
}

#[test]
fn batch_invalid_metadata_and_names_never_create_partial_queues() {
    let f = Fixture::new(); let s = Server::start(); let manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
    for invalid in ["../escape.zip", "a/b.zip", "a\\b.zip", "con.rar", "x:stream", "a. ", ".", ".harbor-secret", ""] {
        assert!(matches!(manager.add_batch(batch_args(&f,&s,&["ok.zip", invalid])), Err("transfer_batch_names")));
    }
    assert!(matches!(manager.add_batch(batch_args(&f,&s,&["Part01.rar", "part01.rar"])), Err("transfer_batch_names")));
    let mut bad = batch_args(&f,&s,&["one.rar", "two.rar"]); bad.files[1].expected_sha256 = Some("bad".into());
    assert!(manager.add_batch(bad).is_err());
    let mut bad = batch_args(&f,&s,&["one.rar", "two.rar"]); bad.files[1].url = "file:///private".into();
    assert!(manager.add_batch(bad).is_err());
    let mut bad = batch_args(&f,&s,&["one.rar", "two.rar"]); bad.files[1].expected_bytes = Some(0);
    assert!(manager.add_batch(bad).is_err());
    assert!(manager.list("one").unwrap().is_empty()); assert_eq!(batch_partials(&f),0);
    assert!(s.requests.lock().unwrap().is_empty());
}

#[test]
fn batch_existing_file_or_other_profile_destination_keeps_everything_untouched() {
    let f = Fixture::new(); let s = Server::start(); let manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
    fs::write(f.0.join("two.rar"), b"original").unwrap();
    assert!(matches!(manager.add_batch(batch_args(&f,&s,&["one.rar", "two.rar"])), Err("transfer_exists")));
    assert_eq!(fs::read(f.0.join("two.rar")).unwrap(), b"original");
    assert!(!f.0.join("one.rar").exists()); assert_eq!(batch_partials(&f),0);
    let mut previous = queued_fixture(&f,&s,"other.rar","two",1); previous.status = Status::Paused;
    manager.state.lock().unwrap().records.push(previous.clone());
    assert!(matches!(manager.add_batch(batch_args(&f,&s,&["one.rar", "other.rar"])), Err("transfer_duplicate")));
    assert!(manager.list("one").unwrap().is_empty()); assert_eq!(manager.list("two").unwrap()[0].id,previous.id);
    assert!(s.requests.lock().unwrap().is_empty());
}

#[test]
fn batch_store_failure_rolls_back_records_and_all_created_partials() {
    let f = Fixture::new(); let s = Server::start(); let root = f.0.join("state");
    let manager = Transfers::load(root.clone(), |_| {}).unwrap();
    let path=root.join("transfers.json"); if path.is_file(){fs::remove_file(&path).unwrap()} fs::create_dir(&path).unwrap();
    assert!(matches!(manager.add_batch(batch_args(&f,&s,&["one.rar","two.rar","three.rar"])), Err("transfer_store")));
    assert!(manager.list("one").unwrap().is_empty()); assert_eq!(batch_partials(&f),0);
    assert!(s.requests.lock().unwrap().is_empty());
}

#[test]
fn batch_queue_capacity_is_checked_before_writing_anything() {
    let f = Fixture::new(); let s = Server::start(); let manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
    let mut existing = queued_fixture(&f,&s,"held.rar","one",1); existing.status=Status::Paused;
    manager.state.lock().unwrap().records = vec![existing; LIMIT-1];
    assert!(matches!(manager.add_batch(batch_args(&f,&s,&["one.rar","two.rar"])), Err("transfer_limit")));
    assert_eq!(manager.list("one").unwrap().len(),LIMIT-1); assert_eq!(batch_partials(&f),0);
    assert!(s.requests.lock().unwrap().is_empty());
}

#[tokio::test]
async fn batch_integrity_failure_does_not_cancel_sibling_parts() {
    let f = Fixture::new(); let s = Server::start(); let manager = Transfers::load(f.0.join("state"), |_| {}).unwrap();
    let mut args=batch_args(&f,&s,&["bad.rar","good.rar"]); args.files[0].expected_sha256=Some("a".repeat(64));
    let records=manager.add_batch(args).unwrap();
    let failed=until(&manager,&records[0].id,|r| r.status==Status::Failed).await;
    let good=until(&manager,&records[1].id,|r| r.status==Status::Complete).await;
    assert!(!Path::new(&failed.destination).exists()); assert_eq!(fs::read(&good.destination).unwrap(),*s.data);
}
