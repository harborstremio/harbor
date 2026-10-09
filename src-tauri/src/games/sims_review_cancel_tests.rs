use super::super::super::sims_reviews;
use super::*;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    mpsc,
};

#[test]
fn cancellation_interrupts_local_reads_zip_inflation_and_nested_scripts() {
    let f = Fixture::new();
    let mut large = dbpf(1);
    large.resize(12 * 1024 * 1024, 0);
    let path = f.0.join("large.package");
    fs::write(&path, &large).unwrap();
    let checks = AtomicUsize::new(0);
    let cancel = || {
        if checks.fetch_add(1, Ordering::SeqCst) >= 8 {
            Err("sims_canceled")
        } else {
            Ok(())
        }
    };
    assert_eq!(
        files::read_checked(&path, package::MAX_FILE, &cancel).err(),
        Some("sims_canceled")
    );
    let zip = archive(&[("large.package", large.clone())]);
    checks.store(0, Ordering::SeqCst);
    assert_eq!(
        package::unpack_zip_checked(&zip, &cancel).err(),
        Some("sims_canceled")
    );
    let script = archive(&[("script.pyc", large)]);
    checks.store(0, Ordering::SeqCst);
    assert_eq!(
        package::validate_script_checked(&script, &cancel),
        Err("sims_canceled")
    );
    // Inspection never changes the source or creates a managed installation.
    assert_eq!(fs::metadata(path).unwrap().len(), 12 * 1024 * 1024);
    assert!(!f.0.join(STORE).exists());
}

#[test]
fn cancellation_stops_a_tray_archive_before_all_entries_are_read() {
    let f = Fixture::new();
    let path = f.0.join("creation.zip");
    fs::write(
        &path,
        archive(&[
            ("0x00000002!0x123456789abcdef0.trayitem", vec![0; 32]),
            ("0x00000000!0x123456789abcdef0.blueprint", vec![0; 32]),
            (
                "0x00000003!0x123456789abcdef0.bpi",
                vec![0; 12 * 1024 * 1024],
            ),
        ]),
    )
    .unwrap();
    let checks = AtomicUsize::new(0);
    let cancel = || {
        if checks.fetch_add(1, Ordering::SeqCst) >= 20 {
            Err("sims_canceled")
        } else {
            Ok(())
        }
    };
    assert_eq!(
        tray::format::read_sources_checked(&[path.to_string_lossy().into_owned()], &cancel).err(),
        Some("sims_canceled")
    );
    assert!(!f.0.join("Tray").exists());
}

#[test]
fn ready_reviews_can_be_discarded_while_another_import_is_parsing() {
    let f = Fixture::new();
    let source = f.0.join("selected.package");
    fs::write(&source, dbpf(1)).unwrap();
    let sources = vec![source.to_string_lossy().into_owned()];
    let first = sims_reviews::review(
        "ready-review".into(),
        f.path().into(),
        Action::Install {
            title: "First".into(),
        },
        sources.clone(),
    )
    .unwrap();
    let operation = uuid::Uuid::new_v4().to_string();
    let worker_operation = operation.clone();
    let path = f.path().to_owned();
    let (started, started_rx) = mpsc::channel();
    let (resume, resume_rx) = mpsc::channel();
    let worker = std::thread::spawn(move || {
        sims_reviews::review_with_events(
            "parsing-review".into(),
            path,
            Action::Install {
                title: "Second".into(),
            },
            sources,
            worker_operation,
            |progress| {
                if progress.phase == "reviewing" && progress.file.is_some() {
                    started.send(()).unwrap();
                    resume_rx
                        .recv_timeout(std::time::Duration::from_secs(10))
                        .unwrap();
                }
            },
        )
        .err()
    });
    started_rx
        .recv_timeout(std::time::Duration::from_secs(10))
        .unwrap();
    let (discarded, discarded_rx) = mpsc::channel();
    let token = first.token.clone();
    let discard_worker = std::thread::spawn(move || {
        sims_reviews::discard("ready-review", &token);
        discarded.send(()).unwrap();
    });
    let responsive = discarded_rx
        .recv_timeout(std::time::Duration::from_secs(2))
        .is_ok();
    assert!(!sims_reviews::cancel(
        "wrong-profile".into(),
        operation.clone()
    ));
    assert!(sims_reviews::cancel(
        "parsing-review".into(),
        operation.clone()
    ));
    resume.send(()).unwrap();
    assert_eq!(worker.join().unwrap(), Some("sims_canceled"));
    discard_worker.join().unwrap();
    assert!(responsive, "Ready review was locked for the whole parse");
    assert_eq!(
        sims_reviews::apply("ready-review".into(), first.token).err(),
        Some("sims_expired")
    );
    assert!(!sims_reviews::cancel("parsing-review".into(), operation));
    assert!(!f.0.join(STORE).exists());
    let retry = sims_reviews::review(
        "parsing-review".into(),
        f.path().into(),
        Action::Install {
            title: "Retry".into(),
        },
        vec![source.to_string_lossy().into_owned()],
    )
    .unwrap();
    sims_reviews::discard("parsing-review", &retry.token);
}
