use super::super::archive_cleanup::tests::{Fixture, PROFILE};
use super::*;
use std::{
    process::{Child, Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};
fn begin(f: &Fixture) -> (Store, Record) {
    let review = f.review().unwrap();
    let mut store = Store::load(&f.manager).unwrap();
    let record = store
        .begin(
            &f.manager,
            PROFILE,
            review.token.as_deref().unwrap(),
            &uuid::Uuid::new_v4().to_string(),
        )
        .unwrap();
    (store, record)
}
fn empty() -> Result<Vec<Usage>> {
    Ok(vec![])
}
fn keep(_: &Path) -> Result<()> {
    Err("archive_cleanup_recycle")
}
fn no_event(_: ArchiveProgress) {}
fn no_boundary(_: &str, _: &Record) {}

#[test]
fn history_dismissal_retains_recovery_records_and_only_forgets_own_finished_operation() {
    let f = Fixture::new(true);
    let (mut store, record) = begin(&f);
    assert_eq!(
        dismiss(&f.manager, PROFILE, &record.id).unwrap_err(),
        "archive_cleanup_recovery"
    );
    assert_eq!(
        dismiss(&f.manager, "other-profile", &record.id).unwrap_err(),
        "archive_expired"
    );
    assert!(store
        .execute(
            &f.manager,
            record.clone(),
            false,
            &empty,
            &no_event,
            &keep,
            &no_boundary
        )
        .is_err());
    assert_eq!(
        dismiss(&f.manager, PROFILE, &record.id).unwrap_err(),
        "archive_cleanup_recovery"
    );
    f.manager.remove(PROFILE, &record.job_id).unwrap();
    assert_eq!(current(&f.manager, &record).unwrap_err(), "archive_expired");
    let restored = store
        .execute(
            &f.manager,
            store.get(PROFILE, &record.id).unwrap(),
            true,
            &empty,
            &no_event,
            &keep,
            &no_boundary,
        )
        .unwrap();
    assert_eq!(restored.phase, Phase::Restored);
    dismiss(&f.manager, PROFILE, &record.id).unwrap();
    assert!(list(&f.manager, PROFILE).unwrap().is_empty());
    f.assert_originals();
}

#[test]
fn later_file_changes_and_changes_at_the_recycle_boundary_are_kept_for_review() {
    for late in [false, true] {
        let f = Fixture::new(true);
        let (mut store, record) = begin(&f);
        let changed = AtomicBool::new(false);
        let alter = || {
            if !changed.swap(true, Ordering::SeqCst) {
                let path = Path::new(&record.stage).join(&record.files[0].name);
                let mut bytes = fs::read(&path).unwrap();
                bytes[0] ^= 1;
                fs::write(path, bytes).unwrap();
            }
        };
        let event = |p: ArchiveProgress| {
            if !late && p.files == 1 {
                alter();
            }
        };
        let boundary = |name: &str, record: &Record| {
            if name == "recycling" {
                assert!(game_file_use::using(
                    &[Path::new(&record.stage).join("foreign.zip")],
                    false
                )
                .is_err());
                if late {
                    alter();
                }
            }
        };
        assert_eq!(
            store
                .execute(
                    &f.manager,
                    record.clone(),
                    false,
                    &empty,
                    &event,
                    &|_| panic!("changed bytes must not be recycled"),
                    &boundary
                )
                .unwrap_err(),
            "archive_changed"
        );
        assert!(changed.load(Ordering::SeqCst));
        assert!(Path::new(&record.stage).exists());
        output(&f);
    }
}

#[test]
fn tampered_journal_cannot_select_a_file_outside_its_recorded_parent() {
    let f = Fixture::new(false);
    let (mut store, mut record) = begin(&f);
    record.files[0].path = f.root.join("Unrelated.zip").to_string_lossy().into_owned();
    let data = Data {
        version: 1,
        records: vec![record],
    };
    fs::write(
        store.root.join("operations.json"),
        serde_json::to_vec(&data).unwrap(),
    )
    .unwrap();
    assert!(matches!(Store::load(&f.manager), Err("archive_store")));
    f.assert_originals();
    // Keep the original in-memory store out of later test work.
    store.records.clear();
}
fn output(f: &Fixture) {
    assert_eq!(
        fs::read(Path::new(&f.job.destination).join("Game 雨/data.bin")).unwrap(),
        f.payload
    );
    assert_eq!(
        fs::read(f.root.join("Unrelated.zip")).unwrap(),
        b"must remain"
    );
}
fn fake_bin(path: &Path) -> Result<()> {
    archives::publish(path, &path.with_extension("test-bin"))
}

#[test]
fn exact_parts_recycle_once_and_completed_retry_preserves_new_source_files() {
    let f = Fixture::new(true);
    let (mut store, record) = begin(&f);
    let token = "already consumed";
    let done = store
        .execute(
            &f.manager,
            record,
            false,
            &empty,
            &no_event,
            &fake_bin,
            &no_boundary,
        )
        .unwrap();
    assert_eq!(done.phase, Phase::Complete);
    assert!(!f.source.exists());
    for file in &done.files {
        let held = Path::new(&done.stage)
            .with_extension("test-bin")
            .join(&file.name);
        assert_eq!(io::identity(&held).unwrap(), file.identity);
    }
    fs::write(&f.source, b"a new unrelated source at the old path").unwrap();
    let mut loaded = Store::load(&f.manager).unwrap();
    let replay = loaded.begin(&f.manager, PROFILE, token, &done.id).unwrap();
    assert_eq!(
        loaded
            .execute(
                &f.manager,
                replay,
                false,
                &empty,
                &no_event,
                &|_| panic!("must not recycle twice"),
                &no_boundary
            )
            .unwrap()
            .phase,
        Phase::Complete
    );
    assert_eq!(
        fs::read(&f.source).unwrap(),
        b"a new unrelated source at the old path"
    );
    output(&f);
}
#[test]
fn tokens_are_profile_and_store_bound_and_failed_journal_write_moves_nothing() {
    let f = Fixture::new(false);
    let review = f.review().unwrap();
    let token = review.token.unwrap();
    let mut store = Store::load(&f.manager).unwrap();
    assert_eq!(
        store
            .begin(
                &f.manager,
                "foreign",
                &token,
                &uuid::Uuid::new_v4().to_string()
            )
            .unwrap_err(),
        "archive_expired"
    );
    fs::create_dir(store.root.join("operations.json")).unwrap();
    assert_eq!(
        store
            .begin(
                &f.manager,
                PROFILE,
                &token,
                &uuid::Uuid::new_v4().to_string()
            )
            .unwrap_err(),
        "archive_store"
    );
    assert!(plans::get(&f.manager, PROFILE, &token).is_ok());
    plans::discard(PROFILE, &token);
    f.assert_originals();
}
#[test]
fn replacement_after_review_and_a_new_consumer_are_refused_before_moving() {
    let f = Fixture::new(false);
    let (mut store, record) = begin(&f);
    let saved = f.source.with_extension("saved");
    fs::rename(&f.source, &saved).unwrap();
    fs::copy(&saved, &f.source).unwrap();
    assert_eq!(
        store
            .execute(
                &f.manager,
                record.clone(),
                false,
                &empty,
                &no_event,
                &fake_bin,
                &no_boundary
            )
            .unwrap_err(),
        "archive_changed"
    );
    assert!(!Path::new(&record.stage).exists());
    fs::rename(&f.source, f.root.join("replacement.zip")).unwrap();
    fs::rename(saved, &f.source).unwrap();
    let busy = || {
        Ok(vec![Usage {
            path: f.source.to_string_lossy().into_owned(),
            tree: false,
            family: false,
            reason: archive_cleanup::Blocker::Sharing,
        }])
    };
    assert_eq!(
        store
            .execute(
                &f.manager,
                record.clone(),
                false,
                &busy,
                &no_event,
                &fake_bin,
                &no_boundary
            )
            .unwrap_err(),
        "archive_cleanup_in_use"
    );
    assert!(!Path::new(&record.stage).exists());
    f.assert_originals();
}
#[test]
fn recycle_failure_keeps_recoverable_parts_and_restore_preserves_their_current_bytes() {
    let f = Fixture::new(true);
    let (mut store, record) = begin(&f);
    assert_eq!(
        store
            .execute(
                &f.manager,
                record.clone(),
                false,
                &empty,
                &no_event,
                &keep,
                &no_boundary
            )
            .unwrap_err(),
        "archive_cleanup_recycle"
    );
    assert!(!f.source.exists());
    let held = Path::new(&record.stage).join(record.files[0].name.clone());
    fs::write(&held, b"user changed these held bytes").unwrap();
    let mut loaded = Store::load(&f.manager).unwrap();
    let restored = loaded
        .execute(
            &f.manager,
            loaded.get(PROFILE, &record.id).unwrap(),
            true,
            &empty,
            &no_event,
            &|_| panic!("restore cannot recycle"),
            &no_boundary,
        )
        .unwrap();
    assert_eq!(restored.phase, Phase::Restored);
    assert!(!Path::new(&record.stage).exists());
    assert_eq!(
        fs::read(&record.files[0].path).unwrap(),
        b"user changed these held bytes"
    );
    assert!(f.source.exists());
    output(&f);
}
#[test]
fn restore_never_overwrites_a_replacement_and_foreign_staged_files_prevent_recycle() {
    let f = Fixture::new(false);
    let (mut store, record) = begin(&f);
    let inserted = AtomicBool::new(false);
    let event = |_: ArchiveProgress| {
        if !inserted.swap(true, Ordering::SeqCst) {
            fs::write(Path::new(&record.stage).join("not ours.txt"), b"preserve").unwrap();
        }
    };
    assert_eq!(
        store
            .execute(
                &f.manager,
                record.clone(),
                false,
                &empty,
                &event,
                &|_| panic!("foreign data must not reach recycling"),
                &no_boundary
            )
            .unwrap_err(),
        "archive_cleanup_recovery"
    );
    fs::write(&f.source, b"replacement").unwrap();
    let record = store.get(PROFILE, &record.id).unwrap();
    assert_eq!(
        store
            .execute(
                &f.manager,
                record.clone(),
                true,
                &empty,
                &no_event,
                &keep,
                &no_boundary
            )
            .unwrap_err(),
        "archive_exists"
    );
    assert_eq!(fs::read(&f.source).unwrap(), b"replacement");
    assert_eq!(
        fs::read(Path::new(&record.stage).join("not ours.txt")).unwrap(),
        b"preserve"
    );
    output(&f);
}
#[test]
fn cancellation_after_staging_keeps_files_and_an_explicit_resume_can_restore() {
    let f = Fixture::new(true);
    let (mut store, record) = begin(&f);
    let event = |_: ArchiveProgress| archives::cancel(PROFILE.into(), record.id.clone());
    assert_eq!(
        store
            .execute(
                &f.manager,
                record.clone(),
                false,
                &empty,
                &event,
                &|_| panic!("canceled"),
                &no_boundary
            )
            .unwrap_err(),
        "archive_canceled"
    );
    let record = store.get(PROFILE, &record.id).unwrap();
    assert_eq!(
        store
            .execute(
                &f.manager,
                record,
                true,
                &empty,
                &no_event,
                &keep,
                &no_boundary
            )
            .unwrap()
            .phase,
        Phase::Restored
    );
    f.assert_originals();
}
#[test]
fn lease_prevents_new_direct_admission_and_is_released_without_manager_mutation() {
    use super::super::transfers::{NewTransfer, Transfers};
    let f = Fixture::new(false);
    let path = f.root.join("new.zip");
    let lease = game_file_use::cleanup(&[path.clone()]).unwrap();
    let direct = Transfers::load(f.root.join("direct"), |_| {}).unwrap();
    let args:NewTransfer=serde_json::from_value(serde_json::json!({"profile":PROFILE,"name":"new","url":"https://example.org/new.zip","destination":path,"expectedBytes":1})).unwrap();
    assert_eq!(direct.add(args).err(), Some("transfer_destination"));
    assert!(direct.list(PROFILE).unwrap().is_empty());
    assert!(!path.exists());
    drop(lease);
    assert!(game_file_use::using(&[path], false).is_ok());
    f.assert_originals();
}

struct OwnedChild(Child);
impl Drop for OwnedChild {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
#[test]
#[ignore]
fn cleanup_recovery_child() {
    let root = PathBuf::from(std::env::var_os("HARBOR_CLEANUP_ROOT").unwrap());
    let id = std::env::var("HARBOR_CLEANUP_ID").unwrap();
    let point = std::env::var("HARBOR_CLEANUP_POINT").unwrap();
    let restore = std::env::var("HARBOR_CLEANUP_RESTORE").ok().as_deref() == Some("1");
    let archives = Archives::load(root.join("state"), |_| {}).unwrap();
    let mut store = Store::load(&archives).unwrap();
    let record = store.get(PROFILE, &id).unwrap();
    let boundary = |name: &str, record: &Record| {
        if name == point {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(root.join("checkpoint.json"))
                .unwrap();
            file.write_all(&serde_json::to_vec(record).unwrap())
                .unwrap();
            file.sync_all().unwrap();
            loop {
                std::thread::park_timeout(Duration::from_secs(1));
            }
        }
    };
    store
        .execute(
            &archives, record, restore, &empty, &no_event, &fake_bin, &boundary,
        )
        .unwrap();
    panic!("checkpoint not reached");
}
fn kill_at(f: &Fixture, id: &str, point: &str, restore: bool) {
    let mut command = Command::new(std::env::current_exe().unwrap());
    command
        .args([
            "archive_cleanup_store::tests::cleanup_recovery_child",
            "--exact",
            "--ignored",
            "--nocapture",
        ])
        .env("HARBOR_CLEANUP_ROOT", &f.root)
        .env("HARBOR_CLEANUP_ID", id)
        .env("HARBOR_CLEANUP_POINT", point)
        .env("HARBOR_CLEANUP_RESTORE", if restore { "1" } else { "0" })
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    let mut child = OwnedChild(command.spawn().unwrap());
    let start = Instant::now();
    while !f.root.join("checkpoint.json").exists() {
        assert!(
            child.0.try_wait().unwrap().is_none(),
            "child exited before {point}"
        );
        assert!(
            start.elapsed() < Duration::from_secs(25),
            "checkpoint timeout {point}"
        );
        std::thread::sleep(Duration::from_millis(20));
    }
    child.0.kill().unwrap();
    child.0.wait().unwrap();
}
#[test]
fn actual_process_exits_reconcile_staging_and_never_repeat_uncertain_recycling() {
    for point in [
        "holding-folder",
        "part-moved",
        "held",
        "recycling",
        "recycled",
        "complete",
    ] {
        let f = Fixture::new(true);
        let (mut store, record) = begin(&f);
        kill_at(&f, &record.id, point, false);
        let mut loaded = Store::load(&f.manager).unwrap();
        let saved = loaded.get(PROFILE, &record.id).unwrap();
        let done = loaded
            .execute(
                &f.manager,
                saved,
                false,
                &empty,
                &no_event,
                &fake_bin,
                &no_boundary,
            )
            .unwrap();
        assert_eq!(
            done.phase,
            if point == "recycled" {
                Phase::Unconfirmed
            } else {
                Phase::Complete
            },
            "{point}"
        );
        let bin = Path::new(&record.stage).with_extension("test-bin");
        for file in &record.files {
            assert_eq!(io::identity(&bin.join(&file.name)).unwrap(), file.identity);
        }
        fs::write(&f.source, b"replacement after interruption").unwrap();
        let once = store
            .begin(&f.manager, PROFILE, "consumed", &record.id)
            .unwrap();
        // Reload rather than applying a stale in-memory journal from before the child.
        let mut loaded = Store::load(&f.manager).unwrap();
        let actual = loaded.get(PROFILE, &once.id).unwrap();
        loaded
            .execute(
                &f.manager,
                actual,
                false,
                &empty,
                &no_event,
                &|_| panic!("terminal retry recycled again"),
                &no_boundary,
            )
            .unwrap();
        assert_eq!(
            fs::read(&f.source).unwrap(),
            b"replacement after interruption"
        );
        output(&f);
    }
}
#[test]
fn process_exit_during_restore_retains_the_restore_intent() {
    let f = Fixture::new(true);
    let (mut store, record) = begin(&f);
    assert!(store
        .execute(
            &f.manager,
            record.clone(),
            false,
            &empty,
            &no_event,
            &keep,
            &no_boundary
        )
        .is_err());
    kill_at(&f, &record.id, "part-restored", true);
    let mut loaded = Store::load(&f.manager).unwrap();
    let record = loaded.get(PROFILE, &record.id).unwrap();
    assert!(record.restoring);
    let done = loaded
        .execute(
            &f.manager,
            record,
            false,
            &empty,
            &no_event,
            &|_| panic!("must finish restore, not recycle"),
            &no_boundary,
        )
        .unwrap();
    assert_eq!(done.phase, Phase::Restored);
    f.assert_originals();
}
#[cfg(windows)]
#[test]
#[ignore = "Recycles and restores only a new UUID-owned holding folder through the actual Windows Recycle Bin"]
fn actual_windows_recycle_roundtrip_preserves_archive_bytes_and_game_output() {
    let f = Fixture::new(true);
    let (mut store, record) = begin(&f);
    let done = store
        .execute(
            &f.manager,
            record,
            false,
            &empty,
            &no_event,
            &io::recycle,
            &no_boundary,
        )
        .unwrap();
    assert_eq!(done.phase, Phase::Complete);
    assert!(!Path::new(&done.stage).exists());
    let name = Path::new(&done.stage).file_name().unwrap();
    let items: Vec<_> = trash::os_limited::list()
        .unwrap()
        .into_iter()
        .filter(|item| {
            item.name == name
                && item.original_parent.canonicalize().ok().as_deref() == Some(f.root.as_path())
        })
        .collect();
    assert_eq!(
        items.len(),
        1,
        "Only this exact newly generated fixture may be restored"
    );
    trash::os_limited::restore_all(items).unwrap();
    for file in &done.files {
        let held = Path::new(&done.stage).join(&file.name);
        let work = archives::start(PROFILE, &uuid::Uuid::new_v4().to_string()).unwrap();
        let found = archives::cleanup_fingerprint(&held, &work, &no_event).unwrap();
        assert_eq!(found.sha256, file.sha256);
    }
    output(&f);
}
