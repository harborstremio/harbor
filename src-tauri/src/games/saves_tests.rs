use super::*;
fn serial() -> std::sync::MutexGuard<'static, ()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|e| e.into_inner())
}
struct Fixture {
    base: PathBuf,
    source: PathBuf,
    vault: PathBuf,
}
impl Fixture {
    fn new() -> Self {
        let parent = std::env::var_os("HARBOR_GAMES_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        fs::create_dir_all(&parent).unwrap();
        let base = parent.join(format!("harbor-saves-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&base).unwrap();
        let source = base.join("Original saves 雨 & dusk");
        let vault = base.join("Backups");
        fs::create_dir(&source).unwrap();
        fs::create_dir(&vault).unwrap();
        Self {
            base,
            source,
            vault,
        }
    }
    fn write(&self, name: &str, data: &[u8]) {
        let path = self.source.join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, data).unwrap();
    }
    fn args(&self) -> SaveRequest {
        SaveRequest {
            profile: "profile/a".into(),
            game_id: "steam:42".into(),
            game_name: "A game".into(),
            source: self.source.to_string_lossy().into_owned(),
            vault: self.vault.to_string_lossy().into_owned(),
            label: "Before a new run".into(),
            operation_id: uuid::Uuid::new_v4().to_string(),
        }
    }
    fn make(&self) -> SaveSnapshotInfo {
        snapshot(self.args(), |_| {}).unwrap()
    }
    fn plan(&self, id: &str) -> SaveRestorePlan {
        let a = self.args();
        prepare_restore(
            a.vault,
            a.profile,
            a.game_id,
            id.into(),
            a.source,
            a.operation_id,
            |_| {},
        )
        .unwrap()
    }
    fn content(&self, id: &str) -> PathBuf {
        root(&self.args().vault, "profile/a", "steam:42", false)
            .unwrap()
            .unwrap()
            .join(id)
            .join("files")
    }
}

#[test]
fn snapshots_restore_exact_files_and_offer_a_verified_recovery_snapshot() {
    let _serial = serial();
    let fixture = Fixture::new();
    fixture.write("slot.sav", b"first run");
    fixture.write("nested/雨.sav", b"unicode");
    fixture.write("settings.ini", b"same");
    fs::create_dir_all(fixture.source.join("empty/preferences")).unwrap();
    let saved = fixture.make();
    assert!(fixture
        .content(&saved.id)
        .join("empty/preferences")
        .is_dir());
    assert_eq!(saved.file_count, 3);
    assert_eq!(
        fs::read(fixture.content(&saved.id).join("nested/雨.sav")).unwrap(),
        b"unicode"
    );
    fixture.write("slot.sav", b"second run");
    fixture.write("new.sav", b"new slot");
    fs::remove_file(fixture.source.join("nested/雨.sav")).unwrap();
    let plan = fixture.plan(&saved.id);
    assert_eq!(
        (plan.added, plan.replaced, plan.removed, plan.unchanged),
        (1, 1, 1, 1)
    );
    let receipt = restore(
        "profile/a".into(),
        plan.token,
        uuid::Uuid::new_v4().to_string(),
        |_| {},
    )
    .unwrap();
    assert_eq!(receipt.status, "restored");
    assert!(fixture.source.join("empty/preferences").is_dir());
    assert_eq!(
        fs::read(fixture.source.join("slot.sav")).unwrap(),
        b"first run"
    );
    assert!(!fixture.source.join("new.sav").exists());
    assert_eq!(
        fs::read(Path::new(receipt.recovery_folder.as_ref().unwrap()).join("new.sav")).unwrap(),
        b"new slot"
    );
    let recovery = receipt.recovery_snapshot_id.unwrap();
    let plan = fixture.plan(&recovery);
    let receipt = restore(
        "profile/a".into(),
        plan.token,
        uuid::Uuid::new_v4().to_string(),
        |_| {},
    )
    .unwrap();
    assert_eq!(receipt.status, "restored");
    assert_eq!(
        fs::read(fixture.source.join("slot.sav")).unwrap(),
        b"second run"
    );
    assert_eq!(
        fs::read(fixture.source.join("new.sav")).unwrap(),
        b"new slot"
    );
    assert!(!fixture.source.join("nested/雨.sav").exists());
}
#[test]
fn changed_target_or_corrupt_snapshot_never_overwrites_current_saves() {
    let _serial = serial();
    let fixture = Fixture::new();
    fixture.write("slot.sav", b"version one");
    let saved = fixture.make();
    fixture.write("slot.sav", b"version two");
    let plan = fixture.plan(&saved.id);
    fixture.write("slot.sav", b"version three");
    assert!(matches!(
        restore(
            "profile/a".into(),
            plan.token,
            uuid::Uuid::new_v4().to_string(),
            |_| {}
        ),
        Err("save_changed")
    ));
    assert_eq!(
        fs::read(fixture.source.join("slot.sav")).unwrap(),
        b"version three"
    );
    fs::write(fixture.content(&saved.id).join("slot.sav"), b"tampered").unwrap();
    let a = fixture.args();
    assert!(matches!(
        prepare_restore(
            a.vault,
            a.profile,
            a.game_id,
            saved.id,
            a.source,
            a.operation_id,
            |_| {}
        ),
        Err("save_integrity")
    ));
    assert_eq!(
        fs::read(fixture.source.join("slot.sav")).unwrap(),
        b"version three"
    );
}
#[test]
fn snapshot_scope_and_manifest_paths_cannot_cross_profiles_or_games() {
    let _serial = serial();
    let fixture = Fixture::new();
    fixture.write("slot.sav", b"one");
    let saved = fixture.make();
    let vault = fixture.args().vault;
    assert!(list(vault.clone(), "profile/b".into(), "steam:42".into())
        .unwrap()
        .is_empty());
    assert!(list(vault.clone(), "profile/a".into(), "steam:99".into())
        .unwrap()
        .is_empty());
    let manifest = fixture
        .content(&saved.id)
        .parent()
        .unwrap()
        .join("manifest.json");
    let mut value: serde_json::Value =
        serde_json::from_slice(&fs::read(&manifest).unwrap()).unwrap();
    value["files"][0]["path"] = "../outside.sav".into();
    fs::write(&manifest, serde_json::to_vec(&value).unwrap()).unwrap();
    assert!(matches!(
        list(vault, "profile/a".into(), "steam:42".into()),
        Err("save_record")
    ));
    for path in ["../bad", "/bad", "a/../../bad", "C:/bad", "a\\b", ""] {
        assert!(files::relative(path).is_err());
    }
    assert!(files::relative("nested/雨 & dusk.sav").is_ok());
}
#[test]
fn canceled_snapshot_leaves_no_completed_record_and_preserves_original() {
    let _serial = serial();
    let fixture = Fixture::new();
    fixture.write("first.sav", b"one");
    fixture.write("second.sav", b"two");
    let args = fixture.args();
    let profile = args.profile.clone();
    let operation = args.operation_id.clone();
    let result = snapshot(args, |progress| {
        if progress.phase == "copying" && progress.files >= 1 {
            cancel(profile.clone(), operation.clone());
        }
    });
    assert!(matches!(result, Err("save_canceled")));
    assert!(
        list(fixture.args().vault, "profile/a".into(), "steam:42".into())
            .unwrap()
            .is_empty()
    );
    assert_eq!(fs::read(fixture.source.join("second.sav")).unwrap(), b"two");
}
#[test]
fn job_cancellation_and_restore_tokens_are_scoped_and_expire() {
    let _serial = serial();
    let id = uuid::Uuid::new_v4().to_string();
    let work = start("a", &id).unwrap();
    assert!(matches!(
        start("b", &uuid::Uuid::new_v4().to_string()),
        Err("save_busy")
    ));
    cancel("b".into(), id.clone());
    assert!(!work.cancel.load(Ordering::Relaxed));
    cancel("a".into(), id);
    assert!(work.cancel.load(Ordering::Relaxed));
    drop(work);
    let fixture = Fixture::new();
    fixture.write("slot.sav", b"one");
    let saved = fixture.make();
    let plan = fixture.plan(&saved.id);
    assert!(matches!(
        restore(
            "profile/b".into(),
            plan.token.clone(),
            uuid::Uuid::new_v4().to_string(),
            |_| {}
        ),
        Err("save_expired")
    ));
    plans().lock().unwrap().get_mut(&plan.token).unwrap().at =
        Instant::now() - Duration::from_secs(601);
    assert!(matches!(
        restore(
            "profile/a".into(),
            plan.token,
            uuid::Uuid::new_v4().to_string(),
            |_| {}
        ),
        Err("save_expired")
    ));
    assert_eq!(fs::read(fixture.source.join("slot.sav")).unwrap(), b"one");
}
#[test]
fn nested_backup_roots_are_rejected_and_new_destinations_do_not_touch_originals() {
    let _serial = serial();
    let fixture = Fixture::new();
    fixture.write("slot.sav", b"one");
    let mut args = fixture.args();
    args.vault = args.source.clone();
    assert!(matches!(snapshot(args, |_| {}), Err("save_nested")));
    let saved = fixture.make();
    let args = fixture.args();
    let target = fixture.base.join("New save folder");
    let plan = prepare_restore(
        args.vault,
        args.profile,
        args.game_id,
        saved.id,
        target.to_string_lossy().into_owned(),
        args.operation_id,
        |_| {},
    )
    .unwrap();
    let receipt = restore(
        "profile/a".into(),
        plan.token,
        uuid::Uuid::new_v4().to_string(),
        |_| {},
    )
    .unwrap();
    assert_eq!(receipt.status, "restored");
    assert!(receipt.recovery_snapshot_id.is_none());
    assert_eq!(fs::read(target.join("slot.sav")).unwrap(), b"one");
    assert_eq!(fs::read(fixture.source.join("slot.sav")).unwrap(), b"one");
    files::cleanup_owned(&fixture.source, &fixture.base);
    assert!(fixture.source.exists());
}

#[test]
fn publication_never_replaces_a_concurrent_destination_and_original_can_be_recovered() {
    let _serial = serial();
    let fixture = Fixture::new();
    fixture.write("slot.sav", b"original");
    let original = files::plain_dir(&fixture.source).unwrap();
    let parent = original.parent().unwrap();
    let recovery = parent.join("recovery-test");
    move_new(&original, &recovery).unwrap();
    fs::create_dir(&original).unwrap();
    fs::write(original.join("other-process.sav"), b"concurrent writer").unwrap();
    assert!(move_new(&recovery, &original).is_err());
    assert_eq!(fs::read(recovery.join("slot.sav")).unwrap(), b"original");
    assert_eq!(
        fs::read(original.join("other-process.sav")).unwrap(),
        b"concurrent writer"
    );
    // Move the competing directory aside without deleting either version, then recover.
    move_new(&original, &parent.join("competing-test")).unwrap();
    move_new(&recovery, &original).unwrap();
    assert_eq!(fs::read(original.join("slot.sav")).unwrap(), b"original");
}

#[test]
fn unicode_labels_are_readable_and_directory_changes_invalidate_a_review() {
    let _serial = serial();
    let fixture = Fixture::new();
    fixture.write("slot.sav", b"original");
    let mut args = fixture.args();
    args.label = "雨".repeat(240);
    args.game_name = "遊".repeat(500);
    let saved = snapshot(args, |_| {}).unwrap();
    assert_eq!(
        list(fixture.args().vault, "profile/a".into(), "steam:42".into()).unwrap()[0].label,
        saved.label
    );
    let plan = fixture.plan(&saved.id);
    fs::create_dir(fixture.source.join("new-empty-folder")).unwrap();
    assert!(matches!(
        restore(
            "profile/a".into(),
            plan.token,
            uuid::Uuid::new_v4().to_string(),
            |_| {}
        ),
        Err("save_changed")
    ));
    assert!(fixture.source.join("new-empty-folder").is_dir());
    assert_eq!(
        fs::read(fixture.source.join("slot.sav")).unwrap(),
        b"original"
    );
}
// Only compiled into the test binary. The parent owns and terminates this
// child after observing the marker, so Drop cannot hide an interruption bug.
pub(super) fn interruption_checkpoint(phase: &str) {
    if std::env::var("HARBOR_SAVE_INTERRUPT_PHASE").ok().as_deref() != Some(phase) {
        return;
    }
    let Some(marker) = std::env::var_os("HARBOR_SAVE_INTERRUPT_MARKER") else {
        return;
    };
    let marker = PathBuf::from(marker);
    assert_eq!(
        marker.file_name().and_then(|n| n.to_str()),
        Some("owned-interrupt-marker")
    );
    fs::write(marker, phase).unwrap();
    std::thread::sleep(Duration::from_secs(45));
    std::process::exit(98);
}
