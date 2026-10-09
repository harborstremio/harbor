use super::*;
use std::sync::atomic::{AtomicUsize, Ordering};

fn root() -> PathBuf {
    let root = PathBuf::from(
        std::env::var("HARBOR_GAME_TEST_ROOT").expect("Set fixture root on data drive"),
    )
    .join(format!("p2p-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    root
}
fn fake(name: &str) -> Vec<u8> {
    let mut out = format!(
        "d4:infod6:lengthi32768e4:name{}:{}12:piece lengthi32768e6:pieces20:",
        name.len(),
        name
    )
    .into_bytes();
    out.extend([0u8; 20]);
    out.extend(b"ee");
    out
}
fn request(profile: &str, plan: &TorrentPlan, root: &Path, name: &str) -> StartTorrent {
    StartTorrent {
        profile: profile.into(),
        token: plan.token.clone(),
        parent: root.to_string_lossy().into_owned(),
        name: name.into(),
        game: None,
        selected: plan.files.iter().map(|f| f.index).collect(),
        download_bps: 2 * 1024 * 1024,
        upload_bps: 128 * 1024,
    }
}
#[test]
fn rejects_unsafe_metadata_before_any_output() {
    for name in [
        "../escape",
        "C:\\escape",
        "/absolute",
        "con.txt",
        "NUL",
        "trailing.",
        ".harbor-torrent",
        "a:b",
        "bad\0name",
    ] {
        assert!(files::metadata(&fake(name)).is_err(), "{name}");
    }
    assert!(files::metadata(&fake("Night garden 雨.dat")).is_ok());
    let mut deep = vec![b'l'; 65];
    deep.extend(vec![b'e'; 65]);
    assert_eq!(files::metadata(&deep).unwrap_err(), "torrent_limit");
    let (_, items, _) = files::metadata(&fake("data.bin")).unwrap();
    assert_eq!(files::selected(&items, &[0, 0]), Err("torrent_selection"));
    assert_eq!(files::selected(&items, &[1]), Err("torrent_selection"));
    assert!(limits(1, 32 * 1024).is_err());
    assert!(limits(0, 0).is_err());
    let safe = files::magnet(&format!(
        "magnet:?xt=urn:btih:{}&so=0-18446744073709551615",
        "a".repeat(40)
    ))
    .unwrap();
    assert!(!safe.contains("so="));
    assert!(librqbit::Magnet::parse(&safe).is_ok());
    let base32 = files::magnet(&format!("magnet:?xt=urn:btih:{}", "A".repeat(32))).unwrap();
    assert!(base32.contains(&"0".repeat(40)));
    let without_unsafe_hint = files::magnet(&format!(
        "magnet:?xt=urn:btih:{}&tr=file:///tmp/x",
        "a".repeat(40)
    ))
    .unwrap();
    assert!(!without_unsafe_hint.contains("tr="));
    assert!(librqbit::Magnet::parse(&without_unsafe_hint).is_ok());
}

#[test]
fn long_magnets_preserve_tracker_hints_without_remote_file_selection() {
    let mut source = format!("magnet:?xt=urn:btih:{}&xt=urn:btmh:1220{}&so=0-18446744073709551615", "a".repeat(40), "b".repeat(64));
    for index in 0..436 { source.push_str(&format!("&tr.{}=udp%3A%2F%2Ftracker{}.example%3A6969%2Fannounce", index + 1, index)); }
    assert!(source.len() > 8192);
    let normalized = files::magnet(&source).unwrap();
    let parsed = reqwest::Url::parse(&normalized).unwrap();
    assert_eq!(parsed.query_pairs().filter(|(key, _)| key == "tr").count(), 436);
    assert!(!normalized.contains("so="));
    assert!(!normalized.contains("btmh"));
    assert!(librqbit::Magnet::parse(&normalized).is_ok());
    assert_eq!(files::magnet(&format!("{normalized}&tr=udp%3A%2F%2Ftracker0.example%3A6969%2Fannounce")), Ok(normalized.clone()));
    assert!(files::magnet(&format!("{normalized}&xt=urn:btih:{}", "b".repeat(40))).is_err());
    assert_eq!(files::magnet(&format!("{normalized}&tr=https%3A%2F%2Fuser%3Apass%40tracker.example&tr=broken")), Ok(normalized.clone()));
    assert!(files::magnet(&format!("magnet:?xt=urn:btmh:1220{}", "b".repeat(64))).is_err());
    assert!(files::magnet(&format!("{normalized}&dn={}", "x".repeat(65536))).is_err());
}

#[test]
fn shared_piece_space_and_store_failures_are_reported_truthfully() {
    let files: Vec<_> = [100000, 1, 100000]
        .iter()
        .enumerate()
        .map(|(index, bytes)| TorrentFile {
            index,
            path: format!("file-{index}"),
            bytes: *bytes,
            padding: false,
        })
        .collect();
    assert_eq!(files::required_storage(&files, &[1], 32768), 131072);
    let mut padded = files.clone();
    padded[0].padding = true;
    assert_eq!(files::required_storage(&padded, &[1], 32768), 31072);
    assert_eq!(files::selected(&padded, &[0]), Err("torrent_selection"));
    let root = root();
    let events = Arc::new(Mutex::new(Vec::new()));
    let captured = events.clone();
    let manager = Torrents::new(
        root.join("state"),
        Arc::new(move |record| {
            captured.lock().unwrap().push(record);
        }),
    )
    .unwrap();
    let record = TorrentRecord {
        preparation: None,
        completed_at: None,
        sharing: None,
        storage_bytes: None,
        queue_order: 0,
        id: uuid::Uuid::new_v4().to_string(),
        profile: "alice".into(),
        name: "test".into(),
        game: None,
        info_hash: "a".repeat(40),
        metadata_sha: "b".repeat(64),
        destination: root.to_string_lossy().into_owned(),
        selected: vec![0],
        total_bytes: 1,
        received: 0,
        status: Status::Queued,
        download_bps: 0,
        upload_bps: 32768,
        created_at: now(),
        updated_at: now(),
        error: None,
        bytes_per_second: 0,
        disk_bytes_per_second: Some(0),
        upload_per_second: 0,
        peers: 0,
        seeders: None,
    };
    manager.records.lock().unwrap().push(record.clone());
    fs::create_dir(manager.root.join("transfers.json")).unwrap();
    assert_eq!(
        manager.update(&record.id, true, |r| r.status = Status::Complete),
        Err("torrent_store")
    );
    let event = events.lock().unwrap().last().unwrap().clone();
    assert_eq!(event.status, Status::Failed);
    assert_eq!(event.error.as_deref(), Some("torrent_store"));
}
#[tokio::test]
async fn review_is_profile_bound_expiring_and_never_downloads() {
    let root = root();
    let manager = Torrents::new(root.join("state"), Arc::new(|_| {})).unwrap();
    let source = root.join("local.torrent");
    fs::write(&source, fake("content.bin")).unwrap();
    let plan = manager
        .inspect(
            "alice".into(),
            source.to_string_lossy().into_owned(),
            uuid::Uuid::new_v4().to_string(),
        )
        .await
        .unwrap();
    assert_eq!(plan.files.len(), 1);
    assert!(!root.join("content.bin").exists());
    assert!(manager.list("alice").unwrap().is_empty());
    assert_eq!(
        manager
            .start(request("bob", &plan, &root, "download"))
            .await
            .unwrap_err(),
        "torrent_expired"
    );
    fs::create_dir(root.join("existing")).unwrap();
    assert_eq!(
        manager
            .start(request("alice", &plan, &root, "existing"))
            .await
            .unwrap_err(),
        "torrent_exists"
    );
    manager
        .plans
        .lock()
        .unwrap()
        .get_mut(&plan.token)
        .unwrap()
        .created = Instant::now() - TTL - Duration::from_secs(1);
    assert_eq!(
        manager
            .start(request("alice", &plan, &root, "download"))
            .await
            .unwrap_err(),
        "torrent_expired"
    );
    assert_eq!(fs::read(source).unwrap(), fake("content.bin"));
}
#[tokio::test]
async fn queue_pause_remove_preserves_files_and_restart_is_offline() {
    let root = root();
    let state = root.join("state");
    let manager = Torrents::new(state.clone(), Arc::new(|_| {})).unwrap();
    let held = manager.slots.clone().acquire_many_owned(2).await.unwrap();
    let plan = manager
        .prepare("alice", fake("content.bin"), vec![])
        .unwrap();
    let record = manager
        .start(request("alice", &plan, &root, "kept"))
        .await
        .unwrap();
    assert_eq!(manager.list("alice").unwrap()[0].status, Status::Queued);
    assert!(manager.list("bob").unwrap().is_empty());
    let restarted = Torrents::new(state, Arc::new(|_| {})).unwrap();
    assert_eq!(restarted.list("alice").unwrap()[0].status, Status::Paused);
    assert!(restarted.jobs.lock().unwrap().is_empty());
    manager
        .action("alice".into(), record.id.clone(), "pause".into())
        .await
        .unwrap();
    let user_file = Path::new(&record.destination).join("keep.txt");
    fs::write(&user_file, "keep").unwrap();
    assert_eq!(
        manager
            .action("bob".into(), record.id.clone(), "remove".into())
            .await,
        Err("torrent_missing")
    );
    manager
        .action("alice".into(), record.id.clone(), "remove".into())
        .await
        .unwrap();
    assert!(manager.list("alice").unwrap().is_empty());
    assert_eq!(fs::read_to_string(user_file).unwrap(), "keep");
    drop(held);
}
#[tokio::test]
async fn changed_metadata_and_destination_fail_without_replacing_files() {
    let root = root();
    let manager = Torrents::new(root.join("state"), Arc::new(|_| {})).unwrap();
    let held = manager.slots.clone().acquire_many_owned(2).await.unwrap();
    let plan = manager
        .prepare("alice", fake("content.bin"), vec![])
        .unwrap();
    let record = manager
        .start(request("alice", &plan, &root, "kept"))
        .await
        .unwrap();
    manager
        .action("alice".into(), record.id.clone(), "pause".into())
        .await
        .unwrap();
    drop(held);
    fs::write(
        manager.root.join(format!("{}.torrent", record.id)),
        fake("other.bin"),
    )
    .unwrap();
    manager
        .action("alice".into(), record.id.clone(), "resume".into())
        .await
        .unwrap();
    tokio::time::timeout(Duration::from_secs(4), async {
        loop {
            if manager.list("alice").unwrap()[0].status == Status::Failed {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .unwrap();
    assert_eq!(
        manager.list("alice").unwrap()[0].error.as_deref(),
        Some("torrent_metadata")
    );
    fs::write(
        manager.root.join(format!("{}.torrent", record.id)),
        fake("content.bin"),
    )
    .unwrap();
    fs::write(
        Path::new(&record.destination).join(".harbor-torrent"),
        "changed",
    )
    .unwrap();
    manager
        .action("alice".into(), record.id.clone(), "resume".into())
        .await
        .unwrap();
    tokio::time::timeout(Duration::from_secs(4), async {
        loop {
            if manager.list("alice").unwrap()[0].status == Status::Failed {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .unwrap();
    assert_eq!(
        manager.list("alice").unwrap()[0].error.as_deref(),
        Some("torrent_destination")
    );
    assert!(!Path::new(&record.destination).join("content.bin").exists());
}
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn real_local_peers_verify_selected_files_pause_resume_and_stop_sharing() {
    let root = root();
    let source = root.join("source");
    fs::create_dir(&source).unwrap();
    // The upstream fixture generator appends an empty hash at an exact piece boundary.
    let bytes: Vec<u8> = (0..8 * 1024 * 1024 + 137)
        .map(|i| ((i * 37 + i / 53) % 251) as u8)
        .collect();
    fs::write(source.join("world.dat"), &bytes).unwrap();
    fs::write(source.join("extra.dat"), vec![42u8; 128 * 1024]).unwrap();
    let torrent = librqbit::create_torrent(
        &source,
        librqbit::CreateTorrentOptions {
            piece_length: Some(32 * 1024),
            ..Default::default()
        },
    )
    .await
    .unwrap();
    let metadata = torrent.as_bytes().unwrap().to_vec();
    fs::write(root.join("fixture.torrent"), &metadata).unwrap();
    let seed = Session::new_with_opts(
        source.clone(),
        SessionOptions {
            disable_dht: true,
            disable_dht_persistence: true,
            listen_port_range: Some(45100..45900),
            ..Default::default()
        },
    )
    .await
    .unwrap();
    let seed_handle = seed
        .add_torrent(
            AddTorrent::from_bytes(metadata.clone()),
            Some(AddTorrentOptions {
                output_folder: Some(source.to_string_lossy().into_owned()),
                overwrite: true,
                disable_trackers: true,
                ..Default::default()
            }),
        )
        .await
        .unwrap()
        .into_handle()
        .unwrap();
    seed_handle.wait_until_initialized().await.unwrap();
    let count = Arc::new(AtomicUsize::new(0));
    let emitted = count.clone();
    let writes = Arc::new(AtomicUsize::new(0));
    let observed_writes = writes.clone();
    let seeds = Arc::new(AtomicUsize::new(0));
    let observed_seeds = seeds.clone();
    let manager = Torrents::new(
        root.join("state"),
        Arc::new(move |record| {
            emitted.fetch_add(1, Ordering::Relaxed);
            if record.disk_bytes_per_second.is_some_and(|value| value > 0) { observed_writes.fetch_add(1, Ordering::Relaxed); }
            if record.seeders == Some(1) { observed_seeds.fetch_add(1, Ordering::Relaxed); }
        }),
    )
    .unwrap();
    let peer: SocketAddr = format!("127.0.0.1:{}", seed.tcp_listen_port().unwrap())
        .parse()
        .unwrap();
    let plan = manager.prepare("alice", metadata, vec![peer]).unwrap();
    let mut args = request("alice", &plan, &root, "download");
    args.game = Some(DownloadGame { id: "local:test-world".into(), name: "World".into(), artwork: Some("https://art.example/world.jpg".into()), logo: None, source_name: Some("Test publisher".into()), content_kind: Some("game".into()) });
    args.selected = vec![
        plan.files
            .iter()
            .find(|f| f.path == "world.dat")
            .unwrap()
            .index,
    ];
    let record = manager.start(args).await.unwrap();
    tokio::time::timeout(Duration::from_secs(25), async {
        loop {
            let r = manager.list("alice").unwrap().remove(0);
            assert_ne!(r.status, Status::Failed, "{:?}", r.error);
            if r.received > 0 {
                break;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    })
    .await
    .unwrap();
    manager
        .action("alice".into(), record.id.clone(), "pause".into())
        .await
        .unwrap();
    let paused = manager.list("alice").unwrap().remove(0);
    assert_eq!(paused.status, Status::Paused);
    assert_eq!(paused.disk_bytes_per_second, Some(0));
    assert_eq!(paused.seeders, Some(0));
    assert!(seeds.load(Ordering::Relaxed) > 0, "the complete connected local peer is reported as a seeder");
    assert!(writes.load(Ordering::Relaxed) > 0, "actual writes emit a disk sample");
    assert!(paused.received < paused.total_bytes);
    let restarted = Torrents::new(root.join("state"), Arc::new(|_| {})).unwrap();
    assert_eq!(restarted.list("alice").unwrap()[0].status, Status::Paused);
    assert_eq!(restarted.list("alice").unwrap()[0].game, record.game);
    restarted
        .known_peers
        .lock()
        .unwrap()
        .insert(record.id.clone(), vec![peer]);
    restarted
        .action("alice".into(), record.id.clone(), "resume".into())
        .await
        .unwrap();
    tokio::time::timeout(Duration::from_secs(35), async {
        loop {
            let r = restarted.list("alice").unwrap().remove(0);
            assert_ne!(r.status, Status::Failed, "{:?}", r.error);
            if r.status == Status::Complete {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await
    .unwrap();
    let job = restarted.jobs.lock().unwrap().remove(&record.id).unwrap();
    job.task.await.unwrap();
    assert_eq!(
        fs::read(Path::new(&record.destination).join("world.dat")).unwrap(),
        bytes
    );
    assert_eq!(fs::read(source.join("world.dat")).unwrap(), bytes);
    assert!(count.load(Ordering::Relaxed) >= 3);
    let done = restarted.list("alice").unwrap().remove(0);
    assert_eq!(done.received, done.total_bytes);
    assert_eq!(done.upload_per_second, 0);
    assert_eq!(done.disk_bytes_per_second, Some(0));
    assert_eq!(done.seeders, Some(0));
    let mut legacy = serde_json::to_value(&done).unwrap();
    legacy.as_object_mut().unwrap().remove("game");
    legacy.as_object_mut().unwrap().remove("diskBytesPerSecond");
    legacy.as_object_mut().unwrap().remove("seeders");
    let old: TorrentRecord = serde_json::from_value(legacy).unwrap();
    assert_eq!(old.game, None); assert_eq!(old.disk_bytes_per_second, None);
    assert_eq!(old.seeders, None);
    assert!(
        fs::metadata(Path::new(&record.destination).join("extra.dat"))
            .unwrap()
            .len()
            < 128 * 1024
    );
    seed.stop().await;
}

#[tokio::test]
async fn queued_torrent_rechecks_space_before_engine_creates_files_and_can_resume() {
    use std::sync::atomic::AtomicU64;
    let root = root();
    let mut manager = Torrents::new(root.join("state"), Arc::new(|_| {})).unwrap();
    let free = Arc::new(AtomicU64::new(2 * transfer_storage::HEADROOM + 32768));
    let probe = free.clone();
    let storage = Storage::with_probe(move |_| Some(transfer_storage::Volume { id: "queue-volume".into(), mount: "test".into(), available: probe.load(Ordering::Relaxed) }));
    Arc::get_mut(&mut manager).unwrap().storage = storage.clone();
    let held = manager.slots.clone().acquire_many_owned(2).await.unwrap();
    let plan = manager.prepare("alice", fake("content.bin"), vec![]).unwrap();
    let record = manager.start(request("alice", &plan, &root, "queued")).await.unwrap();
    free.store(2 * transfer_storage::HEADROOM + 32767, Ordering::Relaxed);
    drop(held);
    tokio::time::timeout(Duration::from_secs(4), async {
        while manager.list("alice").unwrap()[0].status != Status::Failed { tokio::time::sleep(Duration::from_millis(10)).await; }
    }).await.unwrap();
    assert_eq!(manager.list("alice").unwrap()[0].error.as_deref(), Some("torrent_space"));
    assert!(!Path::new(&record.destination).join("content.bin").exists());
    assert_eq!(storage.other_reserved("queue-volume", &[]), 0);
    free.store(2 * transfer_storage::HEADROOM + 32768, Ordering::Relaxed);
    manager.action("alice".into(), record.id.clone(), "resume".into()).await.unwrap();
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            let row = &manager.list("alice").unwrap()[0];
            assert_ne!(row.status, Status::Failed, "{:?}", row.error);
            if row.status == Status::Downloading { break; }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }).await.unwrap();
    assert!(Path::new(&record.destination).join("content.bin").exists());
    assert!(storage.other_reserved("queue-volume", &[]) >= transfer_storage::HEADROOM);
    assert!(matches!(storage.reserve("other-profile-extraction", &root, transfer_storage::HEADROOM + 32769), Err("transfer_space")));
    let partial = fs::read(Path::new(&record.destination).join("content.bin")).unwrap();
    free.store(transfer_storage::HEADROOM - 1, Ordering::Relaxed);
    tokio::time::timeout(Duration::from_secs(5), async {
        while manager.list("alice").unwrap()[0].status != Status::Failed { tokio::time::sleep(Duration::from_millis(10)).await; }
    }).await.unwrap();
    assert_eq!(manager.list("alice").unwrap()[0].error.as_deref(), Some("torrent_space"));
    assert_eq!(fs::read(Path::new(&record.destination).join("content.bin")).unwrap(), partial);
    assert_eq!(storage.other_reserved("queue-volume", &[]), 0);
    free.store(2 * transfer_storage::HEADROOM + 32768, Ordering::Relaxed);
    manager.action("alice".into(), record.id.clone(), "resume".into()).await.unwrap();
    tokio::time::timeout(Duration::from_secs(5), async {
        while manager.list("alice").unwrap()[0].status != Status::Downloading { tokio::time::sleep(Duration::from_millis(10)).await; }
    }).await.unwrap();
    manager.action("alice".into(), record.id.clone(), "pause".into()).await.unwrap();
    assert_eq!(storage.other_reserved("queue-volume", &[]), 0);
    assert_eq!(manager.list("alice").unwrap()[0].status, Status::Paused);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn real_http_and_torrent_payloads_share_live_bandwidth_and_keep_exact_bytes() {
    use super::super::transfers::{NewTransfer, Status as DirectStatus, Transfers};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let root = root();
    let source = root.join("bandwidth-seed");
    fs::create_dir(&source).unwrap();
    let bytes: Vec<u8> = (0..1024 * 1024 + 137).map(|i| ((i * 41 + i / 17) % 251) as u8).collect();
    fs::write(source.join("payload.dat"), &bytes).unwrap();
    let torrent = librqbit::create_torrent(&source, librqbit::CreateTorrentOptions {
        piece_length: Some(32 * 1024), ..Default::default()
    }).await.unwrap();
    let metadata = torrent.as_bytes().unwrap().to_vec();
    let seed = Session::new_with_opts(source.clone(), SessionOptions {
        disable_dht: true, disable_dht_persistence: true, listen_port_range: Some(46000..46900), ..Default::default()
    }).await.unwrap();
    let seed_handle = seed.add_torrent(AddTorrent::from_bytes(metadata.clone()), Some(AddTorrentOptions {
        output_folder: Some(source.to_string_lossy().into_owned()), overwrite: true, disable_trackers: true, ..Default::default()
    })).await.unwrap().into_handle().unwrap();
    seed_handle.wait_until_initialized().await.unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let data = bytes.clone();
    let server = tokio::spawn(async move {
        let (mut connection, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        while !request.ends_with(b"\r\n\r\n") {
            assert!(request.len() < 8192);
            request.push(connection.read_u8().await.unwrap());
        }
        let headers = format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nETag: \"bandwidth-fixture\"\r\nConnection: close\r\n\r\n", data.len());
        connection.write_all(headers.as_bytes()).await.unwrap();
        connection.write_all(&data).await.unwrap();
    });
    let queue_root = root.join("shared-queue");
    let queue = Queue::load(queue_root.clone(), Vec::new(), |_| {}).unwrap();
    let direct = Transfers::load_with_queue(root.join("direct"), |_| {}, queue.clone()).unwrap();
    let torrents = Torrents::new_with_queue(root.join("torrents"), Arc::new(|_| {}), queue.clone(), direct.bandwidth()).unwrap();
    const RATE: u64 = 128 * 1024;
    direct.set_bandwidth("alice", 16 * 1024).unwrap();
    assert_eq!(direct.settings("other").unwrap().bytes_per_second_limit, 0);
    let peer = format!("127.0.0.1:{}", seed.tcp_listen_port().unwrap()).parse().unwrap();
    let plan = torrents.prepare("alice", metadata, vec![peer]).unwrap();
    let startup = Instant::now();
    let file = direct.add(NewTransfer {
        source_link: None, browser_ticket: None, profile: "alice".into(), name: "payload.dat".into(), game: None,
        url: format!("http://{address}/payload.dat"), destination: root.join("direct-payload.dat").to_string_lossy().into_owned(),
        expected_bytes: Some(bytes.len() as u64), expected_sha256: Some(files::digest(&bytes)),
    }).unwrap();
    let mut args = request("alice", &plan, &root, "torrent-payload");
    args.download_bps = 0;
    let torrent = torrents.start(args).await.unwrap();
    // Measure shared throughput after both engines have actually transferred.
    // Peer initialization and host/compiler scheduling are not payload pacing.
    let (initial_http, initial_p2p) = tokio::time::timeout(Duration::from_secs(25), async {
        loop {
            let http = direct.list("alice").unwrap().remove(0);
            let p2p = torrents.list("alice").unwrap().remove(0);
            assert_ne!(http.status, DirectStatus::Failed, "{:?}", http.error);
            assert_ne!(p2p.status, Status::Failed, "{:?}", p2p.error);
            if http.received > 0 && p2p.received > 0 { break (http.received, p2p.received); }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }).await.expect("both real engines must make progress within the bounded startup period");
    eprintln!("both engines ready after {:.3}s: {initial_http} HTTP + {initial_p2p} torrent bytes", startup.elapsed().as_secs_f64());
    direct.set_bandwidth("alice", RATE).unwrap();
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(5) {
        tokio::time::sleep(Duration::from_millis(200)).await;
        let http = direct.list("alice").unwrap().remove(0);
        let p2p = torrents.list("alice").unwrap().remove(0);
        assert_ne!(http.status, DirectStatus::Failed, "{:?}", http.error);
        assert_ne!(p2p.status, Status::Failed, "{:?}", p2p.error);
        let ceiling = (start.elapsed().as_secs_f64() * RATE as f64) as u64 + 8 * CHUNK_BYTES as u64;
        let received = http.received + p2p.received - initial_http - initial_p2p;
        assert!(received <= ceiling, "combined payload bypassed cap: {received} > {ceiling}");
    }
    let http = direct.list("alice").unwrap().remove(0);
    let p2p = torrents.list("alice").unwrap().remove(0);
    assert!(http.received > initial_http && p2p.received > initial_p2p, "both real engines must make progress during measurement");
    assert!(http.received + p2p.received < (bytes.len() * 2) as u64);
    eprintln!("shared cap: {} HTTP + {} torrent bytes in {:.3}s at {RATE} B/s", http.received - initial_http, p2p.received - initial_p2p, start.elapsed().as_secs_f64());
    direct.set_bandwidth("alice", 16 * 1024).unwrap();
    tokio::time::timeout(Duration::from_secs(3), torrents.action("alice".into(), torrent.id.clone(), "pause".into())).await.unwrap().unwrap();
    assert_eq!(torrents.list("alice").unwrap()[0].status, Status::Paused);
    direct.set_bandwidth("alice", 0).unwrap();
    let unlimited = Instant::now();
    torrents.action("alice".into(), torrent.id.clone(), "resume".into()).await.unwrap();
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let http = direct.list("alice").unwrap().remove(0);
            let p2p = torrents.list("alice").unwrap().remove(0);
            assert_ne!(http.status, DirectStatus::Failed, "{:?}", http.error);
            assert_ne!(p2p.status, Status::Failed, "{:?}", p2p.error);
            if http.status == DirectStatus::Complete && p2p.status == Status::Complete { break; }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }).await.unwrap();
    assert_eq!(fs::read(&file.destination).unwrap(), bytes);
    assert_eq!(fs::read(Path::new(&torrent.destination).join("payload.dat")).unwrap(), bytes);
    eprintln!("pause remained responsive; unlimited completed both exact payloads in {:.3}s", unlimited.elapsed().as_secs_f64());
    direct.set_bandwidth("alice", RATE).unwrap();
    let reloaded_queue = Queue::load(queue_root, Vec::new(), |_| {}).unwrap();
    let reloaded = Transfers::load_with_queue(root.join("direct"), |_| {}, reloaded_queue.clone()).unwrap();
    let reloaded_torrents = Torrents::new_with_queue(root.join("torrents"), Arc::new(|_| {}), reloaded_queue, reloaded.bandwidth()).unwrap();
    assert_eq!(reloaded.settings("alice").unwrap().bytes_per_second_limit, RATE);
    assert!(Arc::ptr_eq(&reloaded_torrents.bandwidth, &reloaded.bandwidth()));
    assert!(reloaded_torrents.jobs.lock().unwrap().is_empty());
    server.await.unwrap();
    seed.stop().await;
}

#[tokio::test]
async fn torrent_admission_accounts_for_active_direct_and_extraction_claims() {
    let root = root();
    let mut manager = Torrents::new(root.join("state"), Arc::new(|_| {})).unwrap();
    let storage = Storage::with_probe(|_| Some(transfer_storage::Volume { id: "shared-volume".into(), mount: "test".into(), available: 2 * transfer_storage::HEADROOM + 32768 }));
    Arc::get_mut(&mut manager).unwrap().storage = storage.clone();
    let direct = storage.reserve("direct-another-profile", &root, 1).unwrap();
    let plan = manager.prepare("alice", fake("content.bin"), vec![]).unwrap();
    assert_eq!(manager.start(request("alice", &plan, &root, "blocked")).await.unwrap_err(), "torrent_space");
    assert!(!root.join("blocked").exists());
    assert!(manager.list("alice").unwrap().is_empty());
    drop(direct);
    let held = manager.slots.clone().acquire_many_owned(2).await.unwrap();
    let record = manager.start(request("alice", &plan, &root, "allowed")).await.unwrap();
    manager.action("alice".into(), record.id, "pause".into()).await.unwrap();
    drop(held);
}
