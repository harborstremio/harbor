use super::super::super::sims_reviews;
use super::*;

fn large(value: u8) -> Vec<Payload> {
    let mut data = payload(value);
    data[0].bytes.resize(4 * 1024 * 1024, value);
    data
}
fn prepared(mode: &str) -> (Fixture, Action) {
    let f = Fixture::new();
    let action = match mode {
        "update" | "restore" => {
            let state = Store::connect(f.path())
                .unwrap()
                .apply(
                    plan(
                        f.path(),
                        Action::Install {
                            title: "Original".into(),
                        },
                        large(1),
                        vec![],
                    )
                    .unwrap(),
                )
                .unwrap();
            let action = Action::Update {
                id: state.groups[0].id.clone(),
            };
            if mode == "restore" {
                let state = Store::connect(f.path())
                    .unwrap()
                    .apply(plan(f.path(), action, payload(2), vec![]).unwrap())
                    .unwrap();
                Action::Restore {
                    backup: state.backups[0].id.clone(),
                }
            } else {
                action
            }
        }
        "tray" => {
            let source = f.0.join("download");
            fs::create_dir(&source).unwrap();
            for (name, size) in [
                ("0x00000002!0x123456789abcdef0.trayitem", 32),
                ("0x00000000!0x123456789abcdef0.blueprint", 32),
                ("0x00000003!0x123456789abcdef0.bpi", 4 * 1024 * 1024),
            ] {
                fs::write(source.join(name), vec![1; size]).unwrap();
            }
            Action::TrayImport {
                title: "My creation".into(),
            }
        }
        "adopt" => {
            fs::write(f.0.join("Mods/local.package"), dbpf(1)).unwrap();
            Action::Adopt {
                title: "Existing mod".into(),
            }
        }
        _ => Action::Install {
            title: "New mod".into(),
        },
    };
    (f, action)
}
#[test]
#[ignore = "Owned worker for preparation and recovery crash boundaries"]
fn interruption_worker() {
    let root = std::env::var("HARBOR_PREPARATION_ROOT").unwrap();
    let action = std::env::var("HARBOR_PREPARATION_ACTION").unwrap();
    if action == "recover" {
        Store::connect(&root).unwrap().recover().unwrap();
    } else {
        let action: Action = serde_json::from_str(&action).unwrap();
        let p = match action {
            Action::TrayImport { .. } => {
                let mut sources: Vec<_> = fs::read_dir(Path::new(&root).join("download"))
                    .unwrap()
                    .map(|v| v.unwrap().path().to_string_lossy().into_owned())
                    .collect();
                sources.sort_by_key(|name| !name.ends_with(".bpi"));
                tray::plan(&root, action, sources).unwrap()
            }
            Action::Adopt { .. } => adopt::plan(
                &root,
                action,
                vec![Path::new(&root)
                    .join("Mods/local.package")
                    .to_string_lossy()
                    .into_owned()],
            )
            .unwrap(),
            _ => {
                let incoming = if matches!(action, Action::Restore { .. }) {
                    vec![]
                } else {
                    large(3)
                };
                plan(&root, action, incoming, vec![]).unwrap()
            }
        };
        Store::connect(&root).unwrap().apply(p).unwrap();
    }
    panic!("Requested crash boundary not reached");
}
fn interrupt(f: &Fixture, phase: &str, action: &str) {
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
    let mut cmd = Command::new(std::env::current_exe().unwrap());
    cmd.args(["--exact", &worker, "--ignored", "--nocapture"])
        .env("HARBOR_PREPARATION_ROOT", f.path())
        .env("HARBOR_PREPARATION_ACTION", action)
        .env("HARBOR_SAVE_INTERRUPT_PHASE", phase)
        .env("HARBOR_SAVE_INTERRUPT_MARKER", &marker)
        .stdout(Stdio::null())
        .stderr(Stdio::inherit());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    let mut child = Owned(cmd.spawn().unwrap());
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
    while !marker.exists() {
        assert!(
            child.0.try_wait().unwrap().is_none(),
            "Worker exited before {phase}"
        );
        assert!(std::time::Instant::now() < deadline, "No {phase} marker");
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    assert_eq!(Store::connect(f.path()).err().unwrap(), "sims_busy");
    child.0.kill().unwrap();
    child.0.wait().unwrap();
}
#[test]
fn killed_preparation_recovers_install_update_restore_and_tray_without_touching_live_content() {
    for mode in ["install", "update", "restore", "tray", "adopt"] {
        for phase in if mode == "adopt" {
            vec!["simsPreparation"]
        } else {
            vec!["simsPreparation", "simsPreparationChunk"]
        } {
            let (f, action) = prepared(mode);
            let before = snapshot(f.path()).unwrap().0;
            interrupt(&f, phase, &serde_json::to_string(&action).unwrap());
            assert!(snapshot(f.path()).unwrap().1);
            Store::connect(f.path()).unwrap().recover().unwrap();
            let (after, pending) = snapshot(f.path()).unwrap();
            assert_eq!(before, after);
            assert!(!pending);
            for group in &after.groups {
                unchanged(
                    &area_path(&f.0, &f.0.join(STORE), &location(group)).unwrap(),
                    &group.files,
                )
                .unwrap();
            }
            let kept = sims_reviews::workspace(f.path().into()).unwrap().kept_files;
            if phase == "simsPreparationChunk" {
                assert_eq!(kept.len(), 1);
                let base = Path::new(&kept[0].path).join(if mode == "tray" { "tray" } else { "" });
                let files = files::tree(&base).unwrap();
                assert_eq!(files.len(), 1);
                assert_eq!(files[0].bytes, 1024 * 1024);
            } else {
                assert!(kept.is_empty());
            }
            if mode == "adopt" {
                assert_eq!(fs::read(f.0.join("Mods/local.package")).unwrap(), dbpf(1));
            }
            if mode == "tray" {
                assert!(tray::view(f.path()).unwrap().items.is_empty());
            }
        }
    }
}
#[test]
fn committed_preparation_cleanup_does_not_undo_a_completed_import() {
    for mode in ["install", "tray", "adopt"] {
        let (f, action) = prepared(mode);
        interrupt(
            &f,
            "simsPreparationCommitted",
            &serde_json::to_string(&action).unwrap(),
        );
        let before = snapshot(f.path()).unwrap().0;
        let items = tray::view(f.path()).unwrap().items;
        assert!(snapshot(f.path()).unwrap().1);
        Store::connect(f.path()).unwrap().recover().unwrap();
        assert_eq!(snapshot(f.path()).unwrap().0, before);
        assert_eq!(tray::view(f.path()).unwrap().items, items);
        assert!(!snapshot(f.path()).unwrap().1);
        assert!(preparation::list(&f.0).unwrap().is_empty());
        assert_eq!(
            if mode == "tray" {
                items.len()
            } else {
                before.groups.len()
            },
            1
        );
    }
}
#[test]
fn recovery_itself_can_restart_after_preserving_partial_files() {
    for phase in ["simsPreparationKept", "simsPreparationClean"] {
        let (f, action) = prepared("install");
        interrupt(
            &f,
            "simsPreparationChunk",
            &serde_json::to_string(&action).unwrap(),
        );
        interrupt(&f, phase, "recover");
        assert!(snapshot(f.path()).unwrap().1);
        Store::connect(f.path()).unwrap().recover().unwrap();
        assert!(!snapshot(f.path()).unwrap().1);
        let kept = preparation::list(&f.0).unwrap();
        assert_eq!(kept.len(), 1);
        assert_eq!(
            fs::metadata(Path::new(&kept[0].path).join("test.package"))
                .unwrap()
                .len(),
            1024 * 1024
        );
    }
}
#[test]
fn preparation_preserves_changed_and_unknown_files_and_rejects_forged_paths() {
    let f = Fixture::new();
    let store = Store::connect(f.path()).unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let expected = files::stamp("test.package".into(), &dbpf(1));
    store
        .begin_preparation(
            preparation::Kind::Mods,
            &id,
            "My mod",
            vec![preparation::Entry {
                folder: None,
                file: expected,
            }],
        )
        .unwrap();
    let area = store.base.join("stage").join(&id);
    fs::create_dir(&area).unwrap();
    fs::write(area.join("test.package"), dbpf(2)).unwrap();
    fs::write(area.join("personal-note.txt"), b"keep this").unwrap();
    let record = store.base.join("preparation.json");
    let original = fs::read(&record).unwrap();
    for (field, value) in [
        ("id", "../../Mods"),
        ("root", "C:/wrong"),
        ("kind", "other"),
    ] {
        let mut bad: serde_json::Value = serde_json::from_slice(&original).unwrap();
        bad[field] = value.into();
        fs::write(&record, serde_json::to_vec(&bad).unwrap()).unwrap();
        assert!(store.recover().is_err());
        assert_eq!(fs::read(area.join("test.package")).unwrap(), dbpf(2));
    }
    fs::write(record, original).unwrap();
    store.recover().unwrap();
    let kept = preparation::list(&f.0).unwrap();
    assert_eq!(kept.len(), 1);
    assert_eq!(
        fs::read(Path::new(&kept[0].path).join("personal-note.txt")).unwrap(),
        b"keep this"
    );
    assert_eq!(
        fs::read(Path::new(&kept[0].path).join("test.package")).unwrap(),
        dbpf(2)
    );
    assert_eq!(
        Path::new(&preparation::folder(f.path(), &kept[0].id).unwrap()),
        Path::new(&kept[0].path)
    );
    assert!(preparation::folder(f.path(), "../../Mods").is_err());
}

#[test]
fn preparation_removes_only_verified_copies_and_leaves_unrecorded_stages_alone() {
    let f = Fixture::new();
    let store = Store::connect(f.path()).unwrap();
    let legacy = store
        .base
        .join("stage")
        .join(uuid::Uuid::new_v4().to_string());
    fs::create_dir(&legacy).unwrap();
    fs::write(legacy.join("unknown.package"), b"unrecorded").unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    store
        .begin_preparation(
            preparation::Kind::Mods,
            &id,
            "Verified copy",
            vec![preparation::Entry {
                folder: None,
                file: files::stamp("test.package".into(), &dbpf(1)),
            }],
        )
        .unwrap();
    let stage = store.base.join("stage").join(&id);
    fs::create_dir(&stage).unwrap();
    fs::write(stage.join("test.package"), dbpf(1)).unwrap();
    fs::write(stage.join("added.txt"), b"keep").unwrap();
    let record = store.base.join("preparation.json");
    let original = fs::read(&record).unwrap();
    let mut bad: serde_json::Value = serde_json::from_slice(&original).unwrap();
    bad["files"][0]["folder"] = "../../Mods".into();
    fs::write(&record, serde_json::to_vec(&bad).unwrap()).unwrap();
    assert!(store.recover().is_err());
    assert!(stage.join("test.package").exists());
    fs::write(record, original).unwrap();
    store.recover().unwrap();
    let kept = preparation::list(&f.0).unwrap();
    assert_eq!(kept.len(), 1);
    assert!(!Path::new(&kept[0].path).join("test.package").exists());
    assert_eq!(
        fs::read(Path::new(&kept[0].path).join("added.txt")).unwrap(),
        b"keep"
    );
    assert_eq!(
        fs::read(legacy.join("unknown.package")).unwrap(),
        b"unrecorded"
    );
}
