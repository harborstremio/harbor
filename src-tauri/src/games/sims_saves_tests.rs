use super::*;
use std::sync::atomic::{AtomicBool, Ordering};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let base = PathBuf::from(
            std::env::var_os("HARBOR_SIMS_PROOF_ROOT")
                .unwrap_or_else(|| std::env::temp_dir().into_os_string()),
        );
        fs::create_dir_all(&base).unwrap();
        let path = base
            .canonicalize()
            .unwrap()
            .join(format!("harbor-sims-saves-proof-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        for name in ["Mods", "saves", "Tray"] {
            fs::create_dir(path.join(name)).unwrap();
        }
        fs::write(path.join("GameVersion.txt"), "1.120.123.1020").unwrap();
        fs::write(
            path.join("Options.ini"),
            "[options]\nmodsdisabled = 0\nscriptmodsenabled = 1\n",
        )
        .unwrap();
        fs::write(path.join("saves/Slot_00000002.save"), b"first household").unwrap();
        fs::write(path.join("Mods/keep.package"), b"leave mods alone").unwrap();
        fs::write(path.join("Tray/keep.trayitem"), b"leave tray alone").unwrap();
        Self(path)
    }
    fn path(&self) -> &str {
        self.0.to_str().unwrap()
    }
    fn args(&self) -> saves::SaveRequest {
        let c = context(self.path()).unwrap();
        saves::SaveRequest {
            profile: "Sims player".into(),
            game_id: GAME.into(),
            game_name: "The Sims 4".into(),
            source: c.source,
            vault: c.vault,
            label: "Before new CC".into(),
            operation_id: uuid::Uuid::new_v4().to_string(),
        }
    }
    fn review(&self, id: &str) -> saves::SaveRestorePlan {
        review(
            self.path(),
            self.args().profile,
            self.args().vault,
            id.into(),
            uuid::Uuid::new_v4().to_string(),
            |_| {},
        )
        .unwrap()
    }
    fn restore(&self, token: String) -> SaveResult<saves::SaveRestoreReceipt> {
        saves::restore(
            self.args().profile,
            token,
            uuid::Uuid::new_v4().to_string(),
            |_| {},
        )
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if self
            .0
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("harbor-sims-saves-proof-")
            && files::directory(&self.0).is_ok()
        {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}

#[test]
fn sims_saves_review_restore_and_undo_preserve_mods_and_tray() {
    let f = Fixture::new();
    let c = context(f.path()).unwrap();
    assert!(list(f.path(), f.args().profile, c.vault.clone())
        .unwrap()
        .is_empty());
    assert!(
        !Path::new(&c.vault).exists(),
        "opening the flow must not create a vault"
    );
    let first = snapshot(f.path(), f.args(), |_| {}).unwrap();
    assert_eq!(first.file_count, 1);
    assert!(list(f.path(), "other profile".into(), c.vault.clone())
        .unwrap()
        .is_empty());
    fs::write(f.0.join("saves/Slot_00000002.save"), b"second household").unwrap();
    fs::write(f.0.join("saves/Slot_00000003.save"), b"another household").unwrap();
    let plan = f.review(&first.id);
    assert_eq!((plan.added, plan.replaced, plan.removed), (0, 1, 1));
    assert!(saves::restore(
        "other profile".into(),
        plan.token.clone(),
        uuid::Uuid::new_v4().to_string(),
        |_| {}
    )
    .is_err());
    let receipt = f.restore(plan.token).unwrap();
    assert_eq!(receipt.status, "restored");
    assert_eq!(
        fs::read(f.0.join("saves/Slot_00000002.save")).unwrap(),
        b"first household"
    );
    assert!(!f.0.join("saves/Slot_00000003.save").exists());
    let undo = f.review(&receipt.recovery_snapshot_id.unwrap());
    assert_eq!(f.restore(undo.token).unwrap().status, "restored");
    assert_eq!(
        fs::read(f.0.join("saves/Slot_00000002.save")).unwrap(),
        b"second household"
    );
    assert_eq!(
        fs::read(f.0.join("saves/Slot_00000003.save")).unwrap(),
        b"another household"
    );
    assert_eq!(
        fs::read(f.0.join("Mods/keep.package")).unwrap(),
        b"leave mods alone"
    );
    assert_eq!(
        fs::read(f.0.join("Tray/keep.trayitem")).unwrap(),
        b"leave tray alone"
    );
}

#[test]
fn sims_saves_reject_wrong_source_nested_vault_and_changed_patch() {
    let f = Fixture::new();
    let mut a = f.args();
    a.source = f.0.join("Tray").to_string_lossy().into_owned();
    assert_eq!(snapshot(f.path(), a, |_| {}).err(), Some("sims_folder"));
    let mut a = f.args();
    a.vault = f.0.join("Mods").to_string_lossy().into_owned();
    assert_eq!(snapshot(f.path(), a, |_| {}).err(), Some("save_nested"));
    let mut a = f.args();
    a.game_id = "steam:1".into();
    assert_eq!(snapshot(f.path(), a, |_| {}).err(), Some("save_record"));
    let first = snapshot(f.path(), f.args(), |_| {}).unwrap();
    fs::write(f.0.join("saves/Slot_00000002.save"), b"second household").unwrap();
    let plan = f.review(&first.id);
    fs::write(f.0.join("GameVersion.txt"), "1.121.123.1020").unwrap();
    assert_eq!(f.restore(plan.token).err(), Some("save_changed"));
    assert_eq!(
        fs::read(f.0.join("saves/Slot_00000002.save")).unwrap(),
        b"second household"
    );
}

#[test]
fn save_guards_are_retained_and_rechecked_after_copy_before_publication() {
    let f = Fixture::new();
    let first = snapshot(f.path(), f.args(), |_| {}).unwrap();
    let blocked = Arc::new(AtomicBool::new(false));
    let flag = blocked.clone();
    let check: saves::SaveGuard = Arc::new(move || {
        if flag.load(Ordering::SeqCst) {
            Err("sims_running")
        } else {
            Ok(())
        }
    });
    let a = f.args();
    let attempt = saves::snapshot_guarded(a, check.clone(), |p| {
        if p.phase == "verifying" {
            blocked.store(true, Ordering::SeqCst);
        }
    });
    assert_eq!(attempt.err(), Some("sims_running"));
    assert_eq!(
        list(f.path(), f.args().profile, f.args().vault)
            .unwrap()
            .len(),
        1
    );
    blocked.store(false, Ordering::SeqCst);
    fs::write(f.0.join("saves/Slot_00000002.save"), b"second household").unwrap();
    let a = f.args();
    let plan = saves::prepare_restore_guarded(
        a.vault,
        a.profile,
        a.game_id,
        first.id,
        a.source,
        a.operation_id,
        check,
        |_| {},
    )
    .unwrap();
    let attempt = saves::restore(
        f.args().profile,
        plan.token,
        uuid::Uuid::new_v4().to_string(),
        |p| {
            if p.phase == "restoring" {
                blocked.store(true, Ordering::SeqCst);
            }
        },
    );
    assert_eq!(attempt.err(), Some("sims_running"));
    assert_eq!(
        fs::read(f.0.join("saves/Slot_00000002.save")).unwrap(),
        b"second household"
    );
    assert!(!fs::read_dir(&f.0).unwrap().any(|e| e
        .unwrap()
        .file_name()
        .to_string_lossy()
        .starts_with(".harbor-save-stage-")));
}
#[test]
#[ignore = "Owned subprocess worker for interruption integration tests"]
fn interruption_worker() {
    let root = std::env::var("HARBOR_SAVE_INTERRUPT_ROOT").expect("owned test fixture");
    let operation = uuid::Uuid::new_v4().to_string();
    if std::env::var("HARBOR_SAVE_INTERRUPT_PHASE").unwrap() == "recoveryMoved" {
        recover(root, "Sims player".into(), operation, |_| {}).unwrap();
    } else {
        let c = context(&root).unwrap();
        let id = std::env::var("HARBOR_SAVE_INTERRUPT_SNAPSHOT").unwrap();
        let plan = review(&root, "Sims player".into(), c.vault, id, operation, |_| {}).unwrap();
        saves::restore(
            "Sims player".into(),
            plan.token,
            uuid::Uuid::new_v4().to_string(),
            |_| {},
        )
        .unwrap();
    }
    panic!("The requested interruption checkpoint was not reached");
}

fn interrupt(f: &Fixture, id: &str, phase: &str) {
    use std::process::{Command, Stdio};
    struct Owned(std::process::Child);
    impl Drop for Owned {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
    let marker = f.0.join("owned-interrupt-marker");
    if marker.exists() {
        fs::remove_file(&marker).unwrap();
    }
    let worker = format!(
        "{}::interruption_worker",
        module_path!().split_once("::").unwrap().1
    );
    let mut command = Command::new(std::env::current_exe().unwrap());
    command
        .args(["--exact", &worker, "--ignored", "--nocapture"])
        .env("HARBOR_SAVE_INTERRUPT_ROOT", f.path())
        .env("HARBOR_SAVE_INTERRUPT_PHASE", phase)
        .env("HARBOR_SAVE_INTERRUPT_MARKER", &marker)
        .env("HARBOR_SAVE_INTERRUPT_SNAPSHOT", id)
        .stdout(Stdio::null())
        .stderr(Stdio::inherit());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = Owned(command.spawn().unwrap());
    let until = std::time::Instant::now() + std::time::Duration::from_secs(15);
    while !marker.exists() {
        assert!(
            child.0.try_wait().unwrap().is_none(),
            "worker exited before {phase}"
        );
        assert!(
            std::time::Instant::now() < until,
            "worker did not reach {phase}"
        );
        std::thread::sleep(std::time::Duration::from_millis(25));
    }
    assert!(child.0.try_wait().unwrap().is_none());
    assert_eq!(
        recover(
            f.path().into(),
            "Sims player".into(),
            uuid::Uuid::new_v4().to_string(),
            |_| {}
        )
        .err(),
        Some("save_busy"),
        "a second process must not recover an active restore"
    );
    child.0.kill().unwrap();
    child.0.wait().unwrap();
}

#[test]
fn killed_restore_process_is_recoverable_at_each_rename_boundary() {
    for phase in ["journal", "oldMoved", "newMoved", "recoveryMoved"] {
        let f = Fixture::new();
        let first = snapshot(f.path(), f.args(), |_| {}).unwrap();
        fs::write(f.0.join("saves/Slot_00000002.save"), b"second household").unwrap();
        interrupt(
            &f,
            &first.id,
            if phase == "recoveryMoved" {
                "oldMoved"
            } else {
                phase
            },
        );
        assert!(super::super::save_restore::pending(&f.0.join("saves")).unwrap());
        assert!(files::inspect_folder(f.path()).unwrap().save_recovery);
        assert!(
            context(f.path()).is_ok(),
            "missing saves must not hide recovery"
        );
        assert_eq!(files::validate(f.path()).err(), Some("sims_save_recovery"));
        if phase == "recoveryMoved" {
            interrupt(&f, &first.id, phase);
        }
        let receipt = recover(
            f.path().into(),
            f.args().profile,
            uuid::Uuid::new_v4().to_string(),
            |_| {},
        )
        .unwrap();
        assert_eq!(
            receipt.status,
            if phase == "newMoved" {
                "restored"
            } else {
                "rolledBack"
            }
        );
        assert_eq!(
            fs::read(f.0.join("saves/Slot_00000002.save")).unwrap(),
            if phase == "newMoved" {
                b"first household".to_vec()
            } else {
                b"second household".to_vec()
            }
        );
        assert!(!super::super::save_restore::pending(&f.0.join("saves")).unwrap());
        assert!(files::validate(f.path()).is_ok());
        assert_eq!(
            fs::read(f.0.join("Mods/keep.package")).unwrap(),
            b"leave mods alone"
        );
        assert_eq!(
            fs::read(f.0.join("Tray/keep.trayitem")).unwrap(),
            b"leave tray alone"
        );
    }
}

#[test]
fn interrupted_restore_does_not_replace_later_saves_and_rejects_wrong_profile() {
    let f = Fixture::new();
    let first = snapshot(f.path(), f.args(), |_| {}).unwrap();
    fs::write(f.0.join("saves/Slot_00000002.save"), b"second household").unwrap();
    interrupt(&f, &first.id, "newMoved");
    assert_eq!(
        recover(
            f.path().into(),
            "another profile".into(),
            uuid::Uuid::new_v4().to_string(),
            |_| {}
        )
        .err(),
        Some("save_recovery_scope")
    );
    fs::write(
        f.0.join("saves/Slot_00000002.save"),
        b"played again after crash",
    )
    .unwrap();
    let result = recover(
        f.path().into(),
        f.args().profile,
        uuid::Uuid::new_v4().to_string(),
        |_| {},
    )
    .unwrap();
    assert_eq!(result.status, "keptCurrent");
    assert_eq!(
        fs::read(f.0.join("saves/Slot_00000002.save")).unwrap(),
        b"played again after crash"
    );
    assert!(result.recovery_folder.is_some());
}

#[test]
fn recovery_record_paths_and_external_changes_are_not_trusted() {
    let f = Fixture::new();
    let first = snapshot(f.path(), f.args(), |_| {}).unwrap();
    fs::write(f.0.join("saves/Slot_00000002.save"), b"second household").unwrap();
    interrupt(&f, &first.id, "oldMoved");
    let journal = super::super::save_restore::journal_path(&f.0.join("saves")).unwrap();
    let bytes = fs::read(&journal).unwrap();
    let original: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    for key in ["target", "stage", "recovery"] {
        let mut forged = original.clone();
        forged[key] = serde_json::json!("../Mods");
        fs::write(&journal, serde_json::to_vec(&forged).unwrap()).unwrap();
        assert_eq!(
            recover(
                f.path().into(),
                f.args().profile,
                uuid::Uuid::new_v4().to_string(),
                |_| {}
            )
            .err(),
            Some("save_record")
        );
        assert!(!f.0.join("saves").exists());
    }
    fs::write(&journal, bytes).unwrap();
    let old =
        f.0.join(original["recovery"].as_str().unwrap())
            .join("Slot_00000002.save");
    fs::write(&old, b"external edit").unwrap();
    assert_eq!(
        recover(
            f.path().into(),
            f.args().profile,
            uuid::Uuid::new_v4().to_string(),
            |_| {}
        )
        .err(),
        Some("save_changed")
    );
    assert_eq!(fs::read(&old).unwrap(), b"external edit");
    assert!(!f.0.join("saves").exists());
    assert_eq!(
        fs::read(f.0.join("Mods/keep.package")).unwrap(),
        b"leave mods alone"
    );
}
