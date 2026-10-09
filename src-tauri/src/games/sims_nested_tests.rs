use super::*;

const DATA: &str = "lot51_fashion_authority_data/slots/Slot_00000001.json";

fn installed() -> (Fixture, Group, PathBuf) {
    let fixture = Fixture::new();
    let group = fixture.install().groups[0].clone();
    let folder = fixture.0.join("Mods").join(format!("Harbor-{}", group.id));
    fs::create_dir_all(folder.join("lot51_fashion_authority_data/slots")).unwrap();
    fs::write(folder.join(DATA), br#"{"outfit":1}"#).unwrap();
    fs::write(
        folder.join("lot51_fashion_authority_data/notes.txt"),
        b"keep my note",
    )
    .unwrap();
    (fixture, group, folder)
}

fn apply(f: &Fixture, action: Action, incoming: Vec<Payload>) -> State {
    let plan = plan(f.path(), action, incoming, vec![]).unwrap();
    Store::connect(f.path()).unwrap().apply(plan).unwrap()
}

#[test]
fn creator_data_folders_survive_update_toggle_version_restore_and_removed_restore() {
    let (f, group, live) = installed();
    let planned = plan(
        f.path(),
        Action::Update {
            id: group.id.clone(),
        },
        payload(2),
        vec![],
    )
    .unwrap();
    assert!(planned.reviewed_files().iter().any(|v| v.name == DATA));
    let state = Store::connect(f.path()).unwrap().apply(planned).unwrap();
    let first_backup = state.backups[0].id.clone();
    assert_eq!(fs::read(live.join(DATA)).unwrap(), br#"{"outfit":1}"#);
    apply(
        &f,
        Action::Disable {
            id: group.id.clone(),
        },
        vec![],
    );
    assert!(!live.exists());
    let disabled = f.0.join(STORE).join("disabled").join(&group.id);
    assert_eq!(fs::read(disabled.join(DATA)).unwrap(), br#"{"outfit":1}"#);
    apply(
        &f,
        Action::Enable {
            id: group.id.clone(),
        },
        vec![],
    );
    fs::write(live.join(DATA), br#"{"outfit":2}"#).unwrap();
    apply(
        &f,
        Action::Restore {
            backup: first_backup,
        },
        vec![],
    );
    assert_eq!(fs::read(live.join("test.package")).unwrap(), dbpf(1));
    assert_eq!(fs::read(live.join(DATA)).unwrap(), br#"{"outfit":2}"#);
    let removed = apply(
        &f,
        Action::Remove {
            id: group.id.clone(),
        },
        vec![],
    );
    assert!(!live.exists());
    let restored = apply(
        &f,
        Action::Restore {
            backup: removed.backups.last().unwrap().id.clone(),
        },
        vec![],
    );
    assert_eq!(restored.groups.len(), 1);
    assert!(restored.groups[0]
        .files
        .iter()
        .all(|v| !v.name.contains('/')));
    assert_eq!(fs::read(live.join(DATA)).unwrap(), br#"{"outfit":2}"#);
    assert_eq!(
        fs::read(live.join("lot51_fashion_authority_data/notes.txt")).unwrap(),
        b"keep my note"
    );
}

#[test]
fn changed_nested_data_or_unreviewed_nested_mods_block_the_old_plan() {
    let (f, group, live) = installed();
    for add in [false, true] {
        let planned = plan(
            f.path(),
            Action::Update {
                id: group.id.clone(),
            },
            payload(2),
            vec![],
        )
        .unwrap();
        if add {
            fs::write(live.join("lot51_fashion_authority_data/new.json"), b"new").unwrap();
        } else {
            fs::write(live.join(DATA), b"changed after review").unwrap();
        }
        assert_eq!(
            Store::connect(f.path())
                .unwrap()
                .apply(planned)
                .unwrap_err(),
            "sims_changed"
        );
        assert_eq!(fs::read(live.join("test.package")).unwrap(), dbpf(1));
        assert!(!snapshot(f.path()).unwrap().1);
    }
    fs::write(
        live.join("lot51_fashion_authority_data/unreviewed.package"),
        dbpf(2),
    )
    .unwrap();
    assert_eq!(
        plan(f.path(), Action::Disable { id: group.id }, vec![], vec![])
            .err()
            .unwrap(),
        "sims_changed"
    );
    assert_eq!(fs::read(live.join(DATA)).unwrap(), b"changed after review");
}

#[test]
fn nested_paths_and_trees_remain_bounded_and_do_not_follow_links() {
    for path in [
        "",
        "/file.json",
        "../file.json",
        "data/../file.json",
        "data//file.json",
        "data\\file.json",
        "C:/file.json",
        "data/file.json:ads",
        "data/CON",
    ] {
        assert!(files::relative_name(path).is_err(), "{path}");
    }
    assert!(files::relative_name(&format!("{}file.json", "a/".repeat(16))).is_err());
    let f = Fixture::new();
    let tree = f.0.join("owned-tree");
    fs::create_dir(&tree).unwrap();
    for i in 0..2001 {
        fs::write(tree.join(format!("{i}.json")), b"{}").unwrap();
    }
    assert_eq!(files::tree(&tree).unwrap_err(), "sims_limit");
    let mut files = vec![
        files::stamp("data".into(), b"a"),
        files::stamp("data/a.json".into(), b"b"),
    ];
    assert!(validate_tree(&files).is_err());
    files[0] = files::stamp("DATA/A.JSON".into(), b"a");
    assert!(validate_tree(&files).is_err());
    #[cfg(windows)]
    {
        let target = f.0.join("outside");
        fs::create_dir(&target).unwrap();
        fs::write(target.join("keep.json"), b"unrelated").unwrap();
        let linked = f.0.join("linked-tree");
        fs::create_dir(&linked).unwrap();
        // Native directory junctions do not require enabling Developer Mode.
        let result = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(linked.join("data"))
            .arg(&target)
            .output()
            .unwrap();
        assert!(result.status.success());
        assert_eq!(files::tree(&linked).unwrap_err(), "sims_link");
        assert!(files::staged_file(&linked, "data/new.json").is_err());
        fs::remove_dir(linked.join("data")).unwrap();
        assert_eq!(fs::read(target.join("keep.json")).unwrap(), b"unrelated");
    }
}

#[test]
#[ignore = "Owned worker for nested creator data recovery"]
fn interruption_worker() {
    let root = std::env::var("HARBOR_NESTED_ROOT").unwrap();
    let group = snapshot(&root).unwrap().0.groups[0].id.clone();
    let planned = plan(&root, Action::Update { id: group }, payload(2), vec![]).unwrap();
    Store::connect(&root).unwrap().apply(planned).unwrap();
    panic!("Requested checkpoint not reached");
}

#[test]
fn interrupted_nested_preparation_and_publication_recover_the_original_data() {
    for phase in [
        "simsPreparationChunk",
        "modsMove1",
        "modsMove2",
        "modsState",
    ] {
        let (f, _, live) = installed();
        let data = vec![42; 2 * 1024 * 1024];
        fs::write(live.join(DATA), &data).unwrap();
        // Make the first copy a partial nested file, not the short notes file.
        fs::remove_file(live.join("lot51_fashion_authority_data/notes.txt")).unwrap();
        let before = snapshot(f.path()).unwrap().0;
        let marker = f.0.join("owned-interrupt-marker");
        let mut cmd = std::process::Command::new(std::env::current_exe().unwrap());
        cmd.args([
            "--exact",
            "sims_store::tests::nested_tests::interruption_worker",
            "--ignored",
            "--nocapture",
        ])
        .env("HARBOR_NESTED_ROOT", f.path())
        .env("HARBOR_SAVE_INTERRUPT_PHASE", phase)
        .env("HARBOR_SAVE_INTERRUPT_MARKER", &marker)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::inherit());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }
        struct Owned(std::process::Child);
        impl Drop for Owned {
            fn drop(&mut self) {
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }
        let mut child = Owned(cmd.spawn().unwrap());
        let end = std::time::Instant::now() + std::time::Duration::from_secs(15);
        while !marker.exists() {
            assert!(child.0.try_wait().unwrap().is_none());
            assert!(
                std::time::Instant::now() < end,
                "Missing {phase} checkpoint"
            );
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        child.0.kill().unwrap();
        child.0.wait().unwrap();
        Store::connect(f.path()).unwrap().recover().unwrap();
        assert_eq!(snapshot(f.path()).unwrap(), (before, false));
        assert_eq!(fs::read(live.join(DATA)).unwrap(), data);
        assert_eq!(fs::read(live.join("test.package")).unwrap(), dbpf(1));
        assert!(fs::read_dir(f.0.join(STORE).join("stage"))
            .unwrap()
            .next()
            .is_none());
        let kept = preparation::list(&f.0).unwrap();
        if phase == "simsPreparationChunk" {
            assert_eq!(kept.len(), 1);
            assert_eq!(
                fs::read(Path::new(&kept[0].path).join(DATA)).unwrap(),
                data[..1024 * 1024]
            );
        } else {
            assert!(kept.is_empty());
        }
    }
}

#[test]
fn cancel_during_nested_copy_keeps_live_data_and_removes_empty_stage_parents() {
    let (f, group, live) = installed();
    let data = vec![7; 20 * 1024 * 1024];
    fs::write(live.join(DATA), &data).unwrap();
    let planned = plan(
        f.path(),
        Action::Update { id: group.id },
        payload(2),
        vec![],
    )
    .unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let emit = |p: progress::Progress| {
        if p.phase == "copying" && p.bytes > 0 {
            assert!(progress::cancel("nested-cancel", &id));
        }
    };
    let mut work = progress::Work::start("nested-cancel", &id, &emit).unwrap();
    assert_eq!(
        Store::connect(f.path())
            .unwrap()
            .apply_controlled(planned, &mut work)
            .unwrap_err(),
        "sims_canceled"
    );
    assert_eq!(fs::read(live.join(DATA)).unwrap(), data);
    assert_eq!(fs::read(live.join("test.package")).unwrap(), dbpf(1));
    assert!(!snapshot(f.path()).unwrap().1);
    assert!(preparation::list(&f.0).unwrap().is_empty());
    assert!(fs::read_dir(f.0.join(STORE).join("stage"))
        .unwrap()
        .next()
        .is_none());
}
