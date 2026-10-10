use super::*;
use zip::write::SimpleFileOptions;
#[path = "archives_password_tests.rs"]
mod passwords;
#[path = "archives_split_zip_tests.rs"]
mod split_zip;
pub(super) static SERIAL: Mutex<()> = Mutex::new(());
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("archive-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }
    fn archive(&self, names: &[(&str, &[u8])]) -> PathBuf {
        let path = self.0.join("Game 雨.zip");
        let mut zip = zip::ZipWriter::new(File::create(&path).unwrap());
        for (name, bytes) in names {
            if name.ends_with('/') {
                zip.add_directory(*name, SimpleFileOptions::default())
                    .unwrap();
            } else {
                zip.start_file(
                    *name,
                    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated),
                )
                .unwrap();
                zip.write_all(bytes).unwrap();
            }
        }
        zip.finish().unwrap();
        path
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}
fn review(path: &Path) -> Result<ArchivePlan> {
    inspect(
        "fixture".into(),
        path.to_string_lossy().into(),
        id(),
        None,
        |_| {},
    )
}
fn run(f: &Fixture, plan: &ArchivePlan, name: &str) -> Result<ArchiveReceipt> {
    extract(
        "fixture".into(),
        plan.token.clone(),
        f.0.to_string_lossy().into(),
        name.into(),
        id(),
        |_| {},
    )
}
#[test]
fn extraction_space_preview_respects_shared_claims_and_retains_a_blocked_plan() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let source = f.archive(&[("file.bin", &[1; 100])]);
    let original = fs::read(&source).unwrap();
    let plan = review(&source).unwrap();
    let storage = super::super::transfer_storage::Storage::with_probe(|_| {
        Some(super::super::transfer_storage::Volume {
            id: "drive".into(),
            mount: "W:\\".into(),
            available: SPACE_HEADROOM + 149,
        })
    });
    let download = storage.reserve("other-profile-download", &f.0, 50).unwrap();
    let capacity =
        space_with_storage("fixture", &plan.token, f.0.to_str().unwrap(), &storage).unwrap();
    assert_eq!(capacity.reserved_bytes, 50);
    assert_eq!(capacity.shortfall_bytes, Some(1));
    assert_eq!(capacity.after_bytes, Some(0));
    assert_eq!(
        space_with_storage(
            "other-profile",
            &plan.token,
            f.0.to_str().unwrap(),
            &storage
        )
        .err(),
        Some("archive_expired")
    );
    let result = extract_with_storage(
        "fixture".into(),
        plan.token.clone(),
        f.0.to_string_lossy().into(),
        "Output".into(),
        id(),
        |_| {},
        storage.clone(),
    );
    assert_eq!(result.err(), Some("archive_space"));
    assert!(!f.0.join("Output").exists());
    assert_eq!(fs::read(&source).unwrap(), original);
    assert!(prepared("fixture", &plan.token).is_ok());
    drop(download);
    let capacity =
        space_with_storage("fixture", &plan.token, f.0.to_str().unwrap(), &storage).unwrap();
    assert_eq!(capacity.shortfall_bytes, Some(0));
    assert_eq!(capacity.after_bytes, Some(49));
    extract_with_storage(
        "fixture".into(),
        plan.token.clone(),
        f.0.to_string_lossy().into(),
        "Output".into(),
        id(),
        |_| {},
        storage.clone(),
    )
    .unwrap();
    assert_eq!(storage.other_reserved("drive", &[]), 0);
    assert_eq!(fs::read(f.0.join("Output/file.bin")).unwrap(), [1; 100]);
}
#[test]
fn extraction_reservation_blocks_a_competing_download_then_releases() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let source = f.archive(&[("file.bin", &[2; 100])]);
    let plan = review(&source).unwrap();
    let storage = super::super::transfer_storage::Storage::with_probe(|_| {
        Some(super::super::transfer_storage::Volume {
            id: "drive".into(),
            mount: "W:\\".into(),
            available: SPACE_HEADROOM + 150,
        })
    });
    let checked = AtomicBool::new(false);
    extract_with_storage(
        "fixture".into(),
        plan.token.clone(),
        f.0.to_string_lossy().into(),
        "Output".into(),
        id(),
        |event| {
            if event.phase == "checking" {
                assert_eq!(
                    storage.reserve("competing-download", &f.0, 51).err(),
                    Some("transfer_space")
                );
                checked.store(true, Ordering::Relaxed);
            }
        },
        storage.clone(),
    )
    .unwrap();
    assert!(checked.load(Ordering::Relaxed));
    assert_eq!(storage.other_reserved("drive", &[]), 0);
    assert!(storage.reserve("competing-download", &f.0, 51).is_ok());
}
#[test]
fn external_disk_use_stops_extraction_cleans_stage_and_allows_reviewed_retry() {
    use std::sync::atomic::AtomicU64;
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let bytes = vec![3; 9 * 1024 * 1024];
    let source = f.archive(&[("large.bin", &bytes)]);
    let original = fs::read(&source).unwrap();
    let plan = review(&source).unwrap();
    let free = Arc::new(AtomicU64::new(SPACE_HEADROOM + bytes.len() as u64));
    let probe = free.clone();
    let storage = super::super::transfer_storage::Storage::with_probe(move |_| {
        Some(super::super::transfer_storage::Volume {
            id: "drive".into(),
            mount: "W:\\".into(),
            available: probe.load(Ordering::Relaxed),
        })
    });
    let result = extract_with_storage(
        "fixture".into(),
        plan.token.clone(),
        f.0.to_string_lossy().into(),
        "Output".into(),
        id(),
        |event| {
            if event.phase == "extracting" {
                free.store(1, Ordering::Relaxed);
            }
        },
        storage.clone(),
    );
    assert_eq!(result.err(), Some("archive_space"));
    assert!(!f.0.join("Output").exists());
    assert!(!fs::read_dir(&f.0).unwrap().any(|entry| entry
        .unwrap()
        .file_name()
        .to_string_lossy()
        .starts_with(".harbor-extract-")));
    assert_eq!(storage.other_reserved("drive", &[]), 0);
    assert_eq!(fs::read(&source).unwrap(), original);
    assert!(prepared("fixture", &plan.token).is_ok());
    free.store(SPACE_HEADROOM + bytes.len() as u64, Ordering::Relaxed);
    extract_with_storage(
        "fixture".into(),
        plan.token.clone(),
        f.0.to_string_lossy().into(),
        "Output".into(),
        id(),
        |_| {},
        storage.clone(),
    )
    .unwrap();
    assert_eq!(fs::read(f.0.join("Output/large.bin")).unwrap(), bytes);
    assert_eq!(storage.other_reserved("drive", &[]), 0);
}
#[test]
fn unavailable_archive_capacity_stays_unknown_and_preview_is_read_only() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let source = f.archive(&[("file.bin", &[4; 10])]);
    let plan = review(&source).unwrap();
    let storage = super::super::transfer_storage::Storage::with_probe(|_| None);
    let capacity =
        space_with_storage("fixture", &plan.token, f.0.to_str().unwrap(), &storage).unwrap();
    assert_eq!(capacity.available_bytes, None);
    assert_eq!(capacity.shortfall_bytes, None);
    assert_eq!(capacity.after_bytes, None);
    assert_eq!(capacity.expanded_bytes, 10);
    assert!(prepared("fixture", &plan.token).is_ok());
    assert_eq!(fs::read_dir(&f.0).unwrap().count(), 1);
    assert_eq!(
        space_with_storage("fixture", &plan.token, "relative", &storage).err(),
        Some("archive_destination")
    );
    discard("fixture".into(), plan.token.clone());
    assert_eq!(
        space_with_storage("fixture", &plan.token, f.0.to_str().unwrap(), &storage).err(),
        Some("archive_expired")
    );
}
#[test]
fn preserves_unicode_empty_directories_and_original_archive() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let path = f.archive(&[
        ("Game/readme.txt", b"Original"),
        ("Game/日本.bin", b"rain"),
        ("Game/saves/", b""),
    ]);
    let original = fs::read(&path).unwrap();
    let plan = review(&path).unwrap();
    assert_eq!(plan.file_count, 2);
    assert_eq!(plan.directory_count, 1);
    assert_eq!(plan.expanded_bytes, 12);
    let receipt = run(&f, &plan, "My game").unwrap();
    assert_eq!(receipt.bytes, 12);
    assert_eq!(
        fs::read(f.0.join("My game/Game/日本.bin")).unwrap(),
        b"rain"
    );
    assert!(f.0.join("My game/Game/saves").is_dir());
    assert_eq!(fs::read(path).unwrap(), original);
    assert_eq!(run(&f, &plan, "Again").err(), Some("archive_expired"));
}
#[test]
fn rejects_traversal_windows_devices_and_case_or_prefix_collisions() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    for name in [
        "../outside.txt",
        "/outside.txt",
        "C:/outside.txt",
        "a\\outside.txt",
        "NUL.txt",
        "dir/aux",
        "dir/trailing.",
        "dir/test:stream",
    ] {
        let path = f.archive(&[(name, b"x")]);
        assert!(review(&path).is_err(), "{name}");
    }
    for names in [
        vec![("Game.txt", b"one" as &[u8]), ("game.txt", b"two" as &[u8])],
        vec![("dir", b"one" as &[u8]), ("dir/file", b"two" as &[u8])],
    ] {
        let path = f.archive(&names);
        assert_eq!(review(&path).err(), Some("archive_collision"));
    }
}
#[test]
fn refuses_changed_source_existing_folder_and_wrong_profile() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let path = f.archive(&[("game.bin", b"one")]);
    let plan = review(&path).unwrap();
    assert_eq!(
        extract(
            "other".into(),
            plan.token.clone(),
            f.0.to_string_lossy().into(),
            "New".into(),
            id(),
            |_| {}
        )
        .err(),
        Some("archive_expired")
    );
    fs::create_dir(f.0.join("Existing")).unwrap();
    fs::write(f.0.join("Existing/keep"), b"kept").unwrap();
    assert_eq!(run(&f, &plan, "Existing").err(), Some("archive_exists"));
    assert_eq!(fs::read(f.0.join("Existing/keep")).unwrap(), b"kept");
    let plan = review(&path).unwrap();
    f.archive(&[("game.bin", b"two")]);
    assert_eq!(run(&f, &plan, "Changed").err(), Some("archive_changed"));
    assert!(!f.0.join("Changed").exists());
}
#[test]
fn cancellation_and_destination_race_remove_only_the_owned_stage() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let path = f.archive(&[("large.bin", &vec![42; 2 * 1024 * 1024])]);
    let plan = review(&path).unwrap();
    let operation = id();
    let result = extract(
        "fixture".into(),
        plan.token,
        f.0.to_string_lossy().into(),
        "Canceled".into(),
        operation.clone(),
        |progress| {
            if progress.phase == "extracting" {
                cancel("fixture".into(), operation.clone());
            }
        },
    );
    assert_eq!(result.err(), Some("archive_canceled"));
    assert!(!f.0.join("Canceled").exists());
    assert!(!fs::read_dir(&f.0).unwrap().any(|e| e
        .unwrap()
        .file_name()
        .to_string_lossy()
        .starts_with(".harbor-extract-")));
    let plan = review(&path).unwrap();
    let target = f.0.join("Race");
    let result = extract(
        "fixture".into(),
        plan.token,
        f.0.to_string_lossy().into(),
        "Race".into(),
        id(),
        |progress| {
            if progress.phase == "extracting" && !target.exists() {
                fs::create_dir(&target).unwrap();
                fs::write(target.join("keep"), b"kept").unwrap();
            }
        },
    );
    assert_eq!(result.err(), Some("archive_exists"));
    assert_eq!(fs::read(target.join("keep")).unwrap(), b"kept");
}
#[test]
fn corrupt_payloads_and_unbounded_central_directory_are_not_published() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let path = f.archive(&[("game.bin", b"hello")]);
    let mut bytes = fs::read(&path).unwrap();
    let central = bytes.windows(4).position(|v| v == b"PK\x01\x02").unwrap();
    bytes[central + 16] ^= 1;
    fs::write(&path, &bytes).unwrap();
    let plan = review(&path).unwrap();
    assert_eq!(run(&f, &plan, "Bad CRC").err(), Some("archive_checksum"));
    assert!(!f.0.join("Bad CRC").exists());
    let path = f.archive(&[("game.bin", b"hello")]);
    let mut bytes = fs::read(&path).unwrap();
    let end = bytes.len() - 22;
    bytes[end + 12..end + 16].copy_from_slice(&(100_000_000u32).to_le_bytes());
    fs::write(&path, &bytes).unwrap();
    assert_eq!(review(&path).err(), Some("archive_limit"));
}
#[test]
fn rejects_symlink_entries_and_expired_tokens() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let path = f.0.join("links.zip");
    let mut zip = zip::ZipWriter::new(File::create(&path).unwrap());
    zip.add_symlink("link", "../target", SimpleFileOptions::default())
        .unwrap();
    zip.finish().unwrap();
    assert_eq!(review(&path).err(), Some("archive_links"));
    let path = f.archive(&[("game.bin", b"one")]);
    let plan = review(&path).unwrap();
    plans()
        .lock()
        .unwrap()
        .get_mut(&plan.token)
        .unwrap()
        .created = Instant::now() - PLAN_TTL - Duration::from_secs(1);
    assert_eq!(run(&f, &plan, "Expired").err(), Some("archive_expired"));
}

fn tar_fixture(f: &Fixture, gzip: bool, kind: tar::EntryType, name: &str) -> PathBuf {
    let mut builder = tar::Builder::new(Vec::new());
    let mut header = tar::Header::new_ustar();
    header.set_entry_type(kind);
    header.set_mode(0o755);
    header.set_size(if kind.is_file() { 4 } else { 0 });
    header.set_mtime(0);
    // Raw names also exercise paths a normal builder would refuse.
    header.as_mut_bytes()[..name.len()].copy_from_slice(name.as_bytes());
    if kind.is_symlink() {
        header.set_link_name("../../outside").unwrap();
    }
    header.set_cksum();
    builder
        .append(
            &header,
            if kind.is_file() {
                &b"game"[..]
            } else {
                &[][..]
            },
        )
        .unwrap();
    let bytes = builder.into_inner().unwrap();
    let path = f.0.join(if gzip { "Game.tar.gz" } else { "Game.tar" });
    if gzip {
        let mut writer = flate2::write::GzEncoder::new(
            File::create(&path).unwrap(),
            flate2::Compression::default(),
        );
        writer.write_all(&bytes).unwrap();
        writer.finish().unwrap();
    } else {
        fs::write(&path, bytes).unwrap();
    }
    path
}
#[test]
fn tar_and_gzip_share_review_and_transactional_extraction() {
    let _guard = SERIAL.lock().unwrap();
    for gzip in [false, true] {
        let f = Fixture::new();
        let source = tar_fixture(&f, gzip, tar::EntryType::Regular, "./Game/bin/play");
        let original = fs::read(&source).unwrap();
        let plan = review(&source).unwrap();
        assert_eq!(plan.file_count, 1);
        assert_eq!(plan.expanded_bytes, 4);
        assert_eq!(plan.entries[0].path, "Game/bin/play");
        let receipt = run(&f, &plan, "Installed").unwrap();
        assert_eq!(receipt.bytes, 4);
        let installed = f.0.join("Installed/Game/bin/play");
        assert_eq!(fs::read(&installed).unwrap(), b"game");
        assert_eq!(fs::read(&source).unwrap(), original);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(installed).unwrap().permissions().mode() & 0o777,
                0o700
            );
        }
    }
}
#[test]
fn tar_rejects_traversal_links_and_corrupt_compression() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    assert_eq!(
        review(&tar_fixture(
            &f,
            false,
            tar::EntryType::Regular,
            "../escape"
        ))
        .err(),
        Some("archive_path")
    );
    assert_eq!(
        review(&tar_fixture(&f, false, tar::EntryType::Symlink, "link")).err(),
        Some("archive_links")
    );
    let source = tar_fixture(&f, true, tar::EntryType::Regular, "play");
    let mut bytes = fs::read(&source).unwrap();
    let crc = bytes.len() - 8;
    bytes[crc] ^= 0xff;
    fs::write(&source, bytes).unwrap();
    assert_eq!(review(&source).err(), Some("archive_checksum"));
}
#[test]
fn tar_revalidates_reviewed_content_and_does_not_publish_on_cancel() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let source = tar_fixture(&f, true, tar::EntryType::Regular, "play");
    let plan = review(&source).unwrap();
    let operation = id();
    let result = extract(
        "fixture".into(),
        plan.token,
        f.0.to_string_lossy().into(),
        "Canceled".into(),
        operation.clone(),
        |event| {
            if event.phase == "extracting" {
                cancel("fixture".into(), operation.clone());
            }
        },
    );
    assert_eq!(result.err(), Some("archive_canceled"));
    assert!(!f.0.join("Canceled").exists());
    assert!(!fs::read_dir(&f.0).unwrap().any(|entry| entry
        .unwrap()
        .file_name()
        .to_string_lossy()
        .starts_with(".harbor-extract-")));
    let plan = review(&source).unwrap();
    fs::write(&source, b"changed after review").unwrap();
    assert_eq!(run(&f, &plan, "Changed").err(), Some("archive_changed"));
}
