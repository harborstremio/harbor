use super::*;
use serde_json::json;

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let parent = PathBuf::from(std::env::var("HARBOR_GAME_TEST_ROOT").unwrap());
        let path = parent.join(format!("torrent-forecast-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }
    fn manager(&self) -> Arc<Torrents> {
        Torrents::new(self.0.join("state"), Arc::new(|_| {})).unwrap()
    }
    fn record(&self, manager: &Torrents, profile: &str, bytes: u64) -> TorrentRecord {
        let mut metadata = format!(
            "d4:infod6:lengthi{bytes}e4:name8:game.bin12:piece lengthi32768e6:pieces{}:",
            bytes.div_ceil(32768) * 20
        )
        .into_bytes();
        metadata.extend(vec![0; bytes.div_ceil(32768) as usize * 20]);
        metadata.extend(b"ee");
        let (meta, _, _) = files::metadata(&metadata).unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let root = self.0.join(&id);
        fs::create_dir(&root).unwrap();
        let record:TorrentRecord=serde_json::from_value(json!({"id":id,"profile":profile,"name":"Fixture","infoHash":meta.info_hash.as_string(),"metadataSha":files::digest(&metadata),"destination":root,"selected":[0],"totalBytes":bytes,"storageBytes":bytes,"received":bytes,"status":"paused","downloadBps":0,"uploadBps":32768,"createdAt":0,"updatedAt":0,"error":null})).unwrap();
        files::atomic(
            &root,
            ".harbor-torrent",
            format!(
                "{}\n{}\n{}",
                record.id,
                files::digest(profile.as_bytes()),
                record.info_hash
            )
            .as_bytes(),
        )
        .unwrap();
        files::atomic(&manager.root, &format!("{}.torrent", record.id), &metadata).unwrap();
        manager.records.lock().unwrap().push(record.clone());
        record
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let parent = fs::canonicalize(std::env::var("HARBOR_GAME_TEST_ROOT").unwrap()).unwrap();
        let path = fs::canonicalize(&self.0).unwrap();
        assert_eq!(path.parent(), Some(parent.as_path()));
        assert!(path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("torrent-forecast-"));
        fs::remove_dir_all(path).unwrap();
    }
}
const TEST_TIME: Duration = Duration::from_secs(10);

#[test]
fn full_metadata_budget_rotates_without_starving_later_torrents() {
    let f = Fixture::new();
    let manager = f.manager();
    let first = f.record(&manager, "one", 32768);
    f.record(&manager, "one", 32768);
    f.record(&manager, "one", 32768);
    let path = manager.root.join(format!("{}.torrent", first.id));
    let original = fs::read(&path).unwrap();
    // A valid top-level comment fills the entire shared byte budget without
    // changing the torrent's info hash or its required file allocation.
    let padding = files::MAX_METADATA - original.len() - 17;
    let mut large = format!("d7:comment{padding}:").into_bytes();
    large.extend(vec![b'x'; padding]);
    large.extend(&original[1..]);
    assert_eq!(large.len(), files::MAX_METADATA);
    assert_eq!(
        files::metadata(&large).unwrap().0.info_hash.as_string(),
        first.info_hash
    );
    fs::write(&path, &large).unwrap();
    {
        let mut records = manager.records.lock().unwrap();
        records[0].metadata_sha = files::digest(&large);
        for record in records.iter_mut() {
            record.storage_bytes = None;
        }
    }
    let first_pass = manager
        .storage_items_bounded("one", MAX_PROBES, TEST_TIME)
        .unwrap();
    assert!(first_pass[0].remaining.is_some());
    assert!(first_pass[1..].iter().all(|item| item.remaining.is_none()));
    assert_eq!(manager.forecast.lock().unwrap().cursor, 1);
    let second_pass = manager
        .storage_items_bounded("one", MAX_PROBES, TEST_TIME)
        .unwrap();
    assert!(second_pass
        .iter()
        .all(|item| item.remaining == Some(32768 + transfer_storage::HEADROOM)));
    assert_eq!(second_pass[0].estimated_files, 1);
    assert!(second_pass[1..]
        .iter()
        .all(|item| item.estimated_files == 0));
    assert_eq!(manager.forecast.lock().unwrap().cursor, 0);
}

#[test]
fn oversized_metadata_stays_unknown_and_does_not_block_later_records() {
    let f = Fixture::new();
    let manager = f.manager();
    let invalid = f.record(&manager, "one", 32768);
    f.record(&manager, "one", 32768);
    fs::write(
        manager.root.join(format!("{}.torrent", invalid.id)),
        vec![0; files::MAX_METADATA + 1],
    )
    .unwrap();
    let result = manager
        .storage_items_bounded("one", MAX_PROBES, TEST_TIME)
        .unwrap();
    assert!(result[0].remaining.is_none());
    assert_eq!(result[0].estimated_files, 0);
    assert_eq!(
        result[1].remaining,
        Some(32768 + transfer_storage::HEADROOM)
    );
    assert_eq!(result[1].estimated_files, 0);
    assert!(manager
        .storage_items_bounded("one", 0, Duration::ZERO)
        .unwrap()[0]
        .remaining
        .is_none());
}

#[test]
fn selected_boundary_files_count_but_virtual_padding_does_not() {
    let f = Fixture::new();
    let manager = f.manager();
    let mut r = f.record(&manager, "one", 32768);
    let mut metadata = b"d4:infod5:filesl".to_vec();
    for (name, len, padding) in [
        ("prefix", 8192, false),
        ("game", 32768, false),
        ("pad", 8192, true),
    ] {
        metadata.extend(
            format!(
                "d{}6:lengthi{len}e4:pathl{}:{name}ee",
                if padding { "4:attr1:p" } else { "" },
                name.len()
            )
            .as_bytes(),
        );
    }
    metadata.extend(b"e4:name4:test12:piece lengthi32768e6:pieces40:");
    metadata.extend([0; 40]);
    metadata.extend(b"ee");
    let (meta, entries, _) = files::metadata(&metadata).unwrap();
    assert_eq!(files::required_storage(&entries, &[1], 32768), 40960);
    r.selected = vec![1];
    r.storage_bytes = None;
    r.info_hash = meta.info_hash.as_string();
    r.metadata_sha = files::digest(&metadata);
    files::atomic(&manager.root, &format!("{}.torrent", r.id), &metadata).unwrap();
    files::atomic(
        Path::new(&r.destination),
        ".harbor-torrent",
        format!(
            "{}\n{}\n{}",
            r.id,
            files::digest(r.profile.as_bytes()),
            r.info_hash
        )
        .as_bytes(),
    )
    .unwrap();
    fs::write(Path::new(&r.destination).join("prefix"), vec![0; 8192]).unwrap();
    manager.records.lock().unwrap()[0] = r;
    let result = manager
        .storage_items_bounded("one", MAX_PROBES, TEST_TIME)
        .unwrap();
    assert_eq!(
        result[0].remaining,
        Some(32768 + transfer_storage::HEADROOM)
    );
    assert_eq!(result[0].file_count, 1);
    assert_eq!(result[0].estimated_files, 0);
}

#[test]
fn paused_forecast_uses_physical_allocation_instead_of_reported_received_bytes() {
    let f = Fixture::new();
    let manager = f.manager();
    let total = 256 * 1024;
    let record = f.record(&manager, "one", total);
    let path = Path::new(&record.destination).join("game.bin");
    fs::write(&path, vec![7u8; 64 * 1024]).unwrap();
    let allocation = p2p_space::allocated(&path, total).unwrap();
    assert!(allocation > 0);
    let result = manager
        .storage_items_bounded("one", MAX_PROBES, TEST_TIME)
        .unwrap();
    assert_eq!(
        result[0].remaining,
        Some(total - allocation + transfer_storage::HEADROOM)
    );
    assert_eq!(result[0].estimated_files, 0);
    fs::remove_file(path).unwrap();
    assert_eq!(
        manager
            .storage_items_bounded("one", MAX_PROBES, TEST_TIME)
            .unwrap()[0]
            .remaining,
        Some(total + transfer_storage::HEADROOM)
    );
    assert!(manager.storage_items("other").unwrap().is_empty());
    assert!(manager.storage_items("").is_err());
}

#[test]
fn active_claim_is_not_reinspected_or_double_counted() {
    let f = Fixture::new();
    let mut manager = f.manager();
    let storage = Storage::with_probe(|_| {
        Some(transfer_storage::Volume {
            id: "drive".into(),
            mount: "D:\\".into(),
            available: 10 * transfer_storage::HEADROOM,
        })
    });
    Arc::get_mut(&mut manager).unwrap().storage = storage.clone();
    let record = f.record(&manager, "one", 256 * 1024);
    let own = storage
        .reserve(
            &format!("torrent:{}", record.id),
            &f.0,
            transfer_storage::HEADROOM + 128,
        )
        .unwrap();
    let extraction = storage.reserve("archive:other-profile", &f.0, 256).unwrap();
    let items = manager
        .storage_items_bounded("one", 0, Duration::ZERO)
        .unwrap();
    assert_eq!(items[0].remaining, Some(transfer_storage::HEADROOM + 128));
    assert_eq!(items[0].estimated_files, 0);
    let forecast = storage.forecast(&items);
    assert_eq!(forecast[0].other_reserved_bytes, 256);
    assert_eq!(
        forecast[0].remaining_bytes,
        transfer_storage::HEADROOM + 128
    );
    let text = serde_json::to_string(&forecast).unwrap();
    assert!(!text.contains(&record.id));
    assert!(!text.contains("other-profile"));
    drop((own, extraction));
}

#[test]
fn inspection_budget_is_global_and_legacy_rotation_does_not_starve_the_next_record() {
    let f = Fixture::new();
    let manager = f.manager();
    for _ in 0..9 {
        let r = f.record(&manager, "one", 32768);
        fs::write(Path::new(&r.destination).join("game.bin"), vec![0; 32768]).unwrap();
    }
    for r in manager.records.lock().unwrap().iter_mut() {
        r.storage_bytes = None;
    }
    let first = manager.storage_items_bounded("one", 1, TEST_TIME).unwrap();
    assert_eq!(first.iter().filter(|r| r.remaining.is_none()).count(), 1);
    assert_eq!(
        first
            .iter()
            .filter(|r| r.estimated_files == 0 && r.remaining.is_some())
            .count(),
        1
    );
    let second = manager.storage_items_bounded("one", 1, TEST_TIME).unwrap();
    assert!(second.iter().all(|r| r.remaining.is_some()));
    assert_eq!(manager.forecast.lock().unwrap().requirements.len(), 9);
    let conservative = manager
        .storage_items_bounded("one", 0, Duration::ZERO)
        .unwrap();
    assert!(
        conservative
            .iter()
            .all(|r| r.remaining == Some(32768 + transfer_storage::HEADROOM)
                && r.estimated_files == 1)
    );
}

#[test]
fn missing_or_changed_metadata_stays_unknown_until_a_successful_review() {
    let f = Fixture::new();
    let manager = f.manager();
    let r = f.record(&manager, "one", 32768);
    let path = manager.root.join(format!("{}.torrent", r.id));
    let original = fs::read(&path).unwrap();
    fs::write(&path, b"invalid").unwrap();
    assert!(manager
        .storage_items_bounded("one", MAX_PROBES, TEST_TIME)
        .unwrap()[0]
        .remaining
        .is_none());
    assert!(manager
        .storage_items_bounded("one", 0, Duration::ZERO)
        .unwrap()[0]
        .remaining
        .is_none());
    fs::write(path, original).unwrap();
    assert_eq!(
        manager
            .storage_items_bounded("one", MAX_PROBES, TEST_TIME)
            .unwrap()[0]
            .remaining,
        Some(32768 + transfer_storage::HEADROOM)
    );
    manager.records.lock().unwrap().clear();
    assert!(manager.storage_items("one").unwrap().is_empty());
    assert!(manager.forecast.lock().unwrap().requirements.is_empty());
}

#[test]
fn replaced_marker_never_grants_allocation_credit() {
    let f = Fixture::new();
    let manager = f.manager();
    let r = f.record(&manager, "one", 32768);
    fs::write(Path::new(&r.destination).join("game.bin"), vec![0; 32768]).unwrap();
    fs::write(
        Path::new(&r.destination).join(".harbor-torrent"),
        b"another-game",
    )
    .unwrap();
    let result = manager
        .storage_items_bounded("one", MAX_PROBES, TEST_TIME)
        .unwrap();
    assert_eq!(
        result[0].remaining,
        Some(32768 + transfer_storage::HEADROOM)
    );
    assert_eq!(result[0].estimated_files, 1);
}
