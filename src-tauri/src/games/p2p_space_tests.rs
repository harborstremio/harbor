use super::*;
use std::{
    io::{Seek, SeekFrom, Write},
    sync::atomic::{AtomicBool, AtomicU64},
};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let parent = PathBuf::from(
            std::env::var("HARBOR_GAME_TEST_ROOT").expect("Set test root on data drive"),
        );
        let root = parent.join(format!("torrent-space-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let allowed = fs::canonicalize(std::env::var("HARBOR_GAME_TEST_ROOT").unwrap()).unwrap();
        let target = fs::canonicalize(&self.0).unwrap();
        assert_eq!(target.parent(), Some(allowed.as_path()));
        assert!(target
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("torrent-space-"));
        fs::remove_dir_all(target).unwrap();
    }
}
fn files(bytes: u64) -> Vec<TorrentFile> {
    vec![TorrentFile {
        index: 0,
        path: "game.bin".into(),
        bytes,
        padding: false,
    }]
}
fn storage(free: u64) -> (Arc<Storage>, Arc<AtomicU64>) {
    let available = Arc::new(AtomicU64::new(free));
    let probe = available.clone();
    (
        Storage::with_probe(move |_| {
            Some(super::super::transfer_storage::Volume {
                id: "test-volume".into(),
                mount: "test".into(),
                available: probe.load(Ordering::Relaxed),
            })
        }),
        available,
    )
}

#[test]
fn physical_allocation_and_resume_share_capacity_with_other_engines() {
    let root = Fixture::new();
    let total = 2 * 1024 * 1024;
    fs::write(root.0.join("game.bin"), vec![7; 128 * 1024]).unwrap();
    let existing = allocated(&root.0.join("game.bin"), total).unwrap();
    assert!(existing > 0 && existing < total);
    let (storage, _) = storage(2 * HEADROOM + total - existing);
    let space =
        TorrentSpace::new(&storage, "resumed", &root.0, &files(total), &[0], 32768).unwrap();
    let lease = space.lease();
    assert_eq!(
        storage.other_reserved("test-volume", &[]),
        HEADROOM + total - existing
    );
    assert!(matches!(
        storage.reserve("direct-other-profile", &root.0, 1),
        Err("transfer_space")
    ));
    assert!(matches!(
        TorrentSpace::new(&storage, "another", &root.0, &files(total), &[0], 32768),
        Err("torrent_space")
    ));
    drop(lease);
    assert_eq!(storage.other_reserved("test-volume", &[]), 0);
    assert!(storage.reserve("archive", &root.0, total).is_ok());
}

#[test]
fn repeated_writes_do_not_count_as_new_capacity_and_stop_rejects_late_writes() {
    let root = Fixture::new();
    let total = 1024 * 1024;
    let (storage, free) = storage(2 * HEADROOM + total);
    let space =
        TorrentSpace::new(&storage, "writing", &root.0, &files(total), &[0], 32768).unwrap();
    let lease = space.lease();
    let path = root.0.join("game.bin");
    space
        .operation(0, 4096, 4096, false, || {
            fs::write(&path, [7; 4096])?;
            Ok(())
        })
        .unwrap();
    free.fetch_sub(allocated(&path, total).unwrap(), Ordering::Relaxed);
    space.check().unwrap();
    let claim = storage.other_reserved("test-volume", &[]);
    for _ in 0..12 {
        space
            .operation(0, 4096, 4096, false, || {
                fs::write(&path, [8; 4096])?;
                Ok(())
            })
            .unwrap();
        space.check().unwrap();
        assert_eq!(storage.other_reserved("test-volume", &[]), claim);
    }
    drop(lease);
    let executed = AtomicBool::new(false);
    assert!(space
        .operation(0, 4096, 4096, false, || {
            executed.store(true, Ordering::Relaxed);
            Ok(())
        })
        .is_err());
    assert!(!executed.load(Ordering::Relaxed));
    assert_eq!(storage.other_reserved("test-volume", &[]), 0);
}

#[test]
fn external_space_loss_is_checked_before_resize_and_retry_reacquires() {
    let root = Fixture::new();
    let total = 1024 * 1024;
    let (storage, free) = storage(2 * HEADROOM + total);
    let space = TorrentSpace::new(&storage, "first", &root.0, &files(total), &[0], 32768).unwrap();
    let lease = space.lease();
    free.store(2 * HEADROOM + total - 1, Ordering::Relaxed);
    let executed = AtomicBool::new(false);
    assert!(space
        .operation(0, total, 0, true, || {
            executed.store(true, Ordering::Relaxed);
            Ok(())
        })
        .is_err());
    assert!(!executed.load(Ordering::Relaxed));
    assert_eq!(space.failure(), Some("torrent_space"));
    drop(lease);
    free.store(2 * HEADROOM + total, Ordering::Relaxed);
    let retry = TorrentSpace::new(&storage, "retry", &root.0, &files(total), &[0], 32768).unwrap();
    retry.check().unwrap();
    assert_eq!(retry.failure(), None);
}

#[test]
fn selected_boundary_extents_and_padding_are_preserved() {
    let files: Vec<_> = [100000, 1, 100000]
        .into_iter()
        .enumerate()
        .map(|(index, bytes)| TorrentFile {
            index,
            path: format!("{index}.bin"),
            bytes,
            padding: false,
        })
        .collect();
    assert_eq!(
        p2p_files::storage_extents(&files, &[1], 32768),
        [100000, 1, 31071]
    );
    let mut padded = files.clone();
    padded[0].padding = true;
    assert_eq!(
        p2p_files::storage_extents(&padded, &[1], 32768),
        [0, 1, 31071]
    );
    let root = Fixture::new();
    let (storage, _) = storage(2 * HEADROOM + 131072);
    let space = TorrentSpace::new(&storage, "selection", &root.0, &files, &[1], 32768).unwrap();
    assert_eq!(
        storage.other_reserved("test-volume", &[]),
        HEADROOM + 131072
    );
    assert!(space
        .operation(2, 31072, 1, false, || panic!("outside required extent"))
        .is_err());
    assert_eq!(space.failure(), Some("torrent_destination"));
}

#[test]
fn sparse_logical_length_does_not_count_as_allocated_space() {
    let root = Fixture::new();
    let path = root.0.join("game.bin");
    let mut file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create_new(true)
        .open(&path)
        .unwrap();
    #[cfg(windows)]
    {
        use std::os::windows::io::AsRawHandle;
        #[link(name = "kernel32")]
        extern "system" {
            fn DeviceIoControl(
                handle: *mut std::ffi::c_void,
                code: u32,
                input: *const std::ffi::c_void,
                input_len: u32,
                output: *mut std::ffi::c_void,
                output_len: u32,
                returned: *mut u32,
                overlapped: *mut std::ffi::c_void,
            ) -> i32;
        }
        let mut returned = 0;
        assert_ne!(
            unsafe {
                DeviceIoControl(
                    file.as_raw_handle(),
                    0x900c4,
                    std::ptr::null(),
                    0,
                    std::ptr::null_mut(),
                    0,
                    &mut returned,
                    std::ptr::null_mut(),
                )
            },
            0,
            "fixture volume must support sparse files"
        );
    }
    let total = 8 * 1024 * 1024;
    file.set_len(total).unwrap();
    assert_eq!(allocated(&path, total).unwrap(), 0);
    let (storage, free) = storage(2 * HEADROOM + total);
    let space = TorrentSpace::new(&storage, "sparse", &root.0, &files(total), &[0], 32768).unwrap();
    let lease = space.lease();
    assert_eq!(storage.other_reserved("test-volume", &[]), HEADROOM + total);
    space
        .operation(0, total, 4096, false, || {
            file.seek(SeekFrom::Start(total - 4096))?;
            file.write_all(&[3; 4096])?;
            file.sync_all()?;
            Ok(())
        })
        .unwrap();
    let used = allocated(&path, total).unwrap();
    assert!(used > 0 && used < total);
    free.fetch_sub(used, Ordering::Relaxed);
    space.check().unwrap();
    assert_eq!(
        storage.other_reserved("test-volume", &[]),
        HEADROOM + total - used
    );
    drop(lease);
    drop(file);
}

#[test]
fn close_waits_for_inflight_write_before_releasing_claim() {
    let root = Fixture::new();
    let (storage, _) = storage(2 * HEADROOM + 1024);
    let space =
        TorrentSpace::new(&storage, "in-flight", &root.0, &files(1024), &[0], 32768).unwrap();
    let lease = space.lease();
    let (entered, observed) = std::sync::mpsc::channel();
    let (release, wait) = std::sync::mpsc::channel();
    let writer = space.clone();
    let thread = std::thread::spawn(move || {
        writer
            .operation(0, 1, 1, false, || {
                entered.send(()).unwrap();
                wait.recv().unwrap();
                Ok(())
            })
            .unwrap()
    });
    observed.recv_timeout(Duration::from_secs(2)).unwrap();
    let (closed, done) = std::sync::mpsc::channel();
    let closer = std::thread::spawn(move || {
        drop(lease);
        closed.send(()).unwrap();
    });
    assert!(done.recv_timeout(Duration::from_millis(30)).is_err());
    assert_eq!(storage.other_reserved("test-volume", &[]), HEADROOM + 1024);
    release.send(()).unwrap();
    done.recv_timeout(Duration::from_secs(2)).unwrap();
    thread.join().unwrap();
    closer.join().unwrap();
    assert_eq!(storage.other_reserved("test-volume", &[]), 0);
}

#[test]
fn unknown_volume_identity_still_checks_reconciled_remaining_bytes() {
    let root = Fixture::new();
    let storage = Storage::with_probe(|_| None);
    let reservation = storage.reserve("unknown-volume", &root.0, 0).unwrap();
    reservation.set_remaining(u64::MAX);
    assert_eq!(reservation.check(), Err("transfer_space"));
    reservation.set_remaining(0);
    assert!(reservation.check().is_ok());
}

#[test]
#[ignore = "Opt-in local disk throughput observation; not a cross-machine performance guarantee"]
fn allocation_accounting_throughput() {
    let root = Fixture::new();
    let total = 32 * 1024 * 1024;
    let buffer = vec![91u8; 16 * 1024];
    for guarded in [false, true] {
        let path = root.0.join("game.bin");
        let mut file = fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .read(true)
            .write(true)
            .open(&path)
            .unwrap();
        file.set_len(total).unwrap();
        let storage = Arc::new(Storage::default());
        let space =
            TorrentSpace::new(&storage, "throughput", &root.0, &files(total), &[0], 32768).unwrap();
        let lease = space.lease();
        let start = Instant::now();
        for offset in (0..total).step_by(buffer.len()) {
            let mut write = || -> anyhow::Result<()> {
                file.seek(SeekFrom::Start(offset))?;
                file.write_all(&buffer)?;
                Ok(())
            };
            if guarded {
                space
                    .operation(
                        0,
                        offset + buffer.len() as u64,
                        buffer.len() as u64,
                        false,
                        write,
                    )
                    .unwrap();
            } else {
                write().unwrap();
            }
        }
        file.sync_all().unwrap();
        let elapsed = start.elapsed();
        println!("allocation-throughput guarded={guarded} bytes={total} elapsed_ms={:.3} mib_per_second={:.2}", elapsed.as_secs_f64() * 1000.0, total as f64 / (1024.0 * 1024.0) / elapsed.as_secs_f64());
        assert_eq!(fs::read(&path).unwrap(), vec![91u8; total as usize]);
        drop(lease);
        drop(file);
    }
}
