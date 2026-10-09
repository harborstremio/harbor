use super::super::super::sims_reviews;
use super::*;
fn prepared() -> (Fixture, Vec<String>) {
    let f = Fixture::new();
    fs::create_dir(f.0.join("Mods/My CC")).unwrap();
    fs::write(
        f.0.join("Mods/Resource.cfg"),
        "Priority 500\nPackedFile */*.package",
    )
    .unwrap();
    fs::write(f.0.join("Mods/unrelated.package"), dbpf(8)).unwrap();
    let mut paths = vec![];
    for (name, bytes) in [
        ("test.package", dbpf(1)),
        ("settings.cfg", b"personal settings".to_vec()),
    ] {
        let path = f.0.join("Mods/My CC").join(name);
        fs::write(&path, bytes).unwrap();
        paths.push(path.to_string_lossy().into_owned());
    }
    (f, paths)
}
fn selection(f: &Fixture, sources: Vec<String>) -> Result<Plan> {
    adopt::plan(
        f.path(),
        Action::Adopt {
            title: "My existing CC".into(),
        },
        sources,
    )
}
#[test]
fn adoption_review_cancel_then_full_managed_lifecycle_preserves_settings_and_unrelated_files() {
    let (f, sources) = prepared();
    let review = sims_reviews::review(
        "adopt-proof".into(),
        f.path().into(),
        Action::Adopt {
            title: "My CC".into(),
        },
        sources.clone(),
    )
    .unwrap();
    assert_eq!(review.files.len(), 2);
    assert!(review.source_folder.unwrap().ends_with("My CC"));
    assert!(review.destination_folder.unwrap().contains("Harbor-"));
    assert!(!f.0.join(STORE).exists());
    sims_reviews::discard("adopt-proof", &review.token);
    assert_eq!(
        sims_reviews::apply("adopt-proof".into(), review.token).err(),
        Some("sims_expired")
    );
    assert!(sources.iter().all(|p| Path::new(p).is_file()));
    let plan = selection(&f, sources.clone()).unwrap();
    let before = plan.before.clone();
    let store = Store::connect(f.path()).unwrap();
    let state = store.apply(plan).unwrap();
    let group = &state.groups[0];
    assert_eq!(before.groups.len(), 0);
    assert!(group.enabled);
    assert!(sources.iter().all(|p| !Path::new(p).exists()));
    assert!(f.0.join("Mods/My CC").is_dir());
    let mut current = state.clone();
    for action in [
        Action::Disable {
            id: group.id.clone(),
        },
        Action::Enable {
            id: group.id.clone(),
        },
        Action::Update {
            id: group.id.clone(),
        },
        Action::Remove {
            id: group.id.clone(),
        },
    ] {
        let incoming = if matches!(action, Action::Update { .. }) {
            payload(2)
        } else {
            vec![]
        };
        current = store.apply(plan_for(&f, action, incoming)).unwrap();
        if let Some(g) = current.groups.first() {
            assert_eq!(
                fs::read(store.path(&location(g)).unwrap().join("settings.cfg")).unwrap(),
                b"personal settings"
            );
        }
    }
    let last = current.backups.last().unwrap();
    current = store
        .apply(plan_for(
            &f,
            Action::Restore {
                backup: last.id.clone(),
            },
            vec![],
        ))
        .unwrap();
    assert_eq!(current.groups.len(), 1);
    assert_eq!(
        fs::read(
            store
                .path(&location(&current.groups[0]))
                .unwrap()
                .join("test.package")
        )
        .unwrap(),
        dbpf(2)
    );
    assert_eq!(
        fs::read(f.0.join("Mods/unrelated.package")).unwrap(),
        dbpf(8)
    );
    assert_eq!(
        fs::read_to_string(f.0.join("Mods/Resource.cfg")).unwrap(),
        "Priority 500\nPackedFile */*.package"
    );
}
fn plan_for(f: &Fixture, action: Action, incoming: Vec<Payload>) -> Plan {
    plan(f.path(), action, incoming, vec![]).unwrap()
}
#[test]
fn adoption_rejects_changed_duplicate_outside_mixed_managed_and_root_config_selections() {
    let (f, sources) = prepared();
    let p = selection(&f, sources.clone()).unwrap();
    fs::write(&sources[1], "settings changed during review").unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).err(),
        Some("sims_changed")
    );
    assert!(sources.iter().all(|p| Path::new(p).is_file()));
    fs::create_dir(f.0.join("Mods/Other")).unwrap();
    let duplicate = f.0.join("Mods/Other/test.package");
    fs::write(&duplicate, dbpf(2)).unwrap();
    assert_eq!(
        selection(&f, sources.clone()).err().unwrap(),
        "sims_duplicate"
    );
    fs::remove_file(&duplicate).unwrap();
    let outside = f.0.join("outside.package");
    fs::write(&outside, dbpf(1)).unwrap();
    assert_eq!(
        selection(&f, vec![outside.to_string_lossy().into_owned()])
            .err()
            .unwrap(),
        "sims_adopt_folder"
    );
    let mut mixed = sources.clone();
    mixed.push(
        f.0.join("Mods/unrelated.package")
            .to_string_lossy()
            .into_owned(),
    );
    assert_eq!(selection(&f, mixed).err().unwrap(), "sims_adopt_folder");
    assert_eq!(
        selection(
            &f,
            vec![f.0.join("Mods/Resource.cfg").to_string_lossy().into_owned()]
        )
        .err()
        .unwrap(),
        "sims_adopt_managed"
    );
    assert!(selection(&f, vec![sources[0].clone(), sources[0].clone()]).is_err());
    let old = f.0.join("Mods/Harbor-old");
    fs::create_dir(&old).unwrap();
    fs::write(old.join("other.package"), dbpf(2)).unwrap();
    assert_eq!(
        selection(
            &f,
            vec![old.join("other.package").to_string_lossy().into_owned()]
        )
        .err()
        .unwrap(),
        "sims_adopt_managed"
    );
    assert!(!snapshot(f.path()).unwrap().1);
}
#[test]
#[ignore = "Owned subprocess worker for selected-file adoption interruption"]
fn adoption_interruption_worker() {
    let root = std::env::var("HARBOR_ADOPT_ROOT").unwrap();
    if std::env::var("HARBOR_ADOPT_RECOVER").ok().as_deref() == Some("1") {
        Store::connect(&root).unwrap().recover().unwrap();
    } else {
        let sources = ["settings.cfg", "test.package"]
            .into_iter()
            .map(|n| {
                Path::new(&root)
                    .join("Mods/My CC")
                    .join(n)
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();
        let p = adopt::plan(
            &root,
            Action::Adopt {
                title: "My CC".into(),
            },
            sources,
        )
        .unwrap();
        Store::connect(&root).unwrap().apply(p).unwrap();
    }
    panic!("Interruption marker not reached");
}
fn interrupt(f: &Fixture, phase: &str, recover: bool) {
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
        "{}::adoption_interruption_worker",
        module_path!().split_once("::").unwrap().1
    );
    let mut cmd = Command::new(std::env::current_exe().unwrap());
    cmd.args(["--exact", &worker, "--ignored", "--nocapture"])
        .env("HARBOR_ADOPT_ROOT", f.path())
        .env("HARBOR_ADOPT_RECOVER", if recover { "1" } else { "0" })
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
        std::thread::sleep(std::time::Duration::from_millis(25));
    }
    assert_eq!(Store::connect(f.path()).err().unwrap(), "sims_busy");
    child.0.kill().unwrap();
    child.0.wait().unwrap();
}
#[test]
fn terminated_adoption_and_rollback_restore_every_original_file_without_duplicates() {
    for phase in [
        "adoptJournal",
        "adoptMove1",
        "adoptMove2",
        "adoptPublished",
        "adoptState",
        "adoptRollback1",
    ] {
        let (f, sources) = prepared();
        let before = snapshot(f.path()).unwrap().0;
        interrupt(
            &f,
            if phase == "adoptRollback1" {
                "adoptPublished"
            } else {
                phase
            },
            false,
        );
        assert!(snapshot(f.path()).unwrap().1);
        assert_eq!(
            selection(&f, sources.clone()).err().unwrap(),
            "sims_recovery"
        );
        if phase == "adoptRollback1" {
            interrupt(&f, phase, true);
        }
        let store = Store::connect(f.path()).unwrap();
        store.recover().unwrap();
        assert_eq!(snapshot(f.path()).unwrap(), (before, false));
        assert_eq!(fs::read(&sources[0]).unwrap(), dbpf(1));
        assert_eq!(fs::read(&sources[1]).unwrap(), b"personal settings");
        assert_eq!(fs::read_dir(f.0.join("Mods")).unwrap().count(), 3);
        assert_eq!(
            fs::read_dir(f.0.join(STORE).join("stage")).unwrap().count(),
            0
        );
    }
}
#[test]
fn adoption_recovery_retains_later_external_files_and_rejects_forged_origins() {
    let (f, sources) = prepared();
    interrupt(&f, "adoptPublished", false);
    let store = Store::connect(f.path()).unwrap();
    let journal: Journal = read_json(&store.base.join("journal.json")).unwrap();
    let live = store
        .path(&Area::Live(
            journal.adoption.as_ref().unwrap().group.clone(),
        ))
        .unwrap();
    fs::write(live.join("new-settings.cfg"), "later edit").unwrap();
    assert_eq!(store.recover().err(), Some("sims_changed"));
    assert_eq!(
        fs::read(live.join("new-settings.cfg")).unwrap(),
        b"later edit"
    );
    assert!(sources.iter().all(|p| !Path::new(p).exists()));
    fs::remove_file(live.join("new-settings.cfg")).unwrap();
    let mut bad = journal.clone();
    bad.adoption.as_mut().unwrap().sources[0].relative = "../settings.cfg".into();
    store.write_journal(&bad).unwrap();
    assert!(store.recover().is_err());
    assert!(!Path::new(&sources[0]).exists());
    store.write_journal(&journal).unwrap();
    fs::write(&sources[0], dbpf(9)).unwrap();
    assert_eq!(store.recover().err(), Some("sims_recovery"));
    assert_eq!(fs::read(&sources[0]).unwrap(), dbpf(9));
    fs::remove_file(&sources[0]).unwrap();
    store.recover().unwrap();
    assert_eq!(fs::read(&sources[0]).unwrap(), dbpf(1));
}
