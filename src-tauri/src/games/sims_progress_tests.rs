use super::*;
use std::cell::RefCell;

#[test]
fn apply_cancellation_is_scoped_and_closes_atomically_before_publication() {
    let id = uuid::Uuid::new_v4().to_string();
    let events = RefCell::new(vec![]);
    let emit = |p| events.borrow_mut().push(p);
    let mut work = progress::Work::start("progress-proof", &id, &emit).unwrap();
    assert!(progress::Work::start("progress-proof", &id, &emit).is_err());
    assert!(!progress::cancel("other-profile", &id));
    assert!(!progress::cancel(
        "progress-proof",
        &uuid::Uuid::new_v4().to_string()
    ));
    work.publish().unwrap();
    assert!(!progress::cancel("progress-proof", &id));
    work.check().unwrap();
    work.done();
    assert_eq!(
        events.borrow().iter().map(|p| p.phase).collect::<Vec<_>>(),
        ["checking", "publishing", "done"]
    );
    assert!(!events.borrow()[1].can_cancel);
    drop(work);
    assert!(!progress::cancel("progress-proof", &id));
    let mut work = progress::Work::start("progress-proof", &id, &emit).unwrap();
    assert!(progress::cancel("progress-proof", &id));
    assert_eq!(work.publish().err(), Some("sims_canceled"));
}

#[test]
fn cancel_during_a_large_staging_file_removes_only_its_unpublished_bytes() {
    let f = Fixture::new();
    let id = uuid::Uuid::new_v4().to_string();
    let data = vec![7u8; 20 * 1024 * 1024];
    let events = RefCell::new(vec![]);
    let emit = |p: progress::Progress| {
        if p.bytes > 0 {
            assert!(progress::cancel("progress-chunk", &id));
        }
        events.borrow_mut().push(p);
    };
    let mut work = progress::Work::start("progress-chunk", &id, &emit).unwrap();
    work.staging(data.len() as u64).unwrap();
    let destination = f.0.join("unpublished.package");
    assert_eq!(work.write(&destination, &data).err(), Some("sims_canceled"));
    assert!(!destination.exists());
    let amount = events.borrow().last().unwrap().bytes;
    assert!(amount > 0 && amount < data.len() as u64);
    assert!(!snapshot(f.path()).unwrap().1);
}

#[test]
fn canceled_install_update_and_restore_keep_previous_mods_settings_and_records() {
    for action in ["install", "update", "restore"] {
        let f = Fixture::new();
        let plan = if action == "install" {
            plan(
                f.path(),
                Action::Install {
                    title: "New mod".into(),
                },
                payload(1),
                vec![],
            )
            .unwrap()
        } else {
            let first = f.install();
            let id = first.groups[0].id.clone();
            fs::write(
                f.0.join(format!("Mods/Harbor-{id}/creator.cfg")),
                b"keep my settings",
            )
            .unwrap();
            if action == "restore" {
                let update = plan(f.path(), Action::Update { id }, payload(2), vec![]).unwrap();
                let updated = Store::connect(f.path()).unwrap().apply(update).unwrap();
                plan(
                    f.path(),
                    Action::Restore {
                        backup: updated.backups[0].id.clone(),
                    },
                    vec![],
                    vec![],
                )
                .unwrap()
            } else {
                plan(f.path(), Action::Update { id }, payload(2), vec![]).unwrap()
            }
        };
        let before = snapshot(f.path()).unwrap().0;
        let originals: Vec<_> = before
            .groups
            .iter()
            .map(|g| files::tree(&f.0.join(format!("Mods/Harbor-{}", g.id))).unwrap())
            .collect();
        let id = uuid::Uuid::new_v4().to_string();
        let emit = |p: progress::Progress| {
            if p.phase == "copying" && p.bytes > 0 {
                progress::cancel("progress-lifecycle", &id);
            }
        };
        let mut work = progress::Work::start("progress-lifecycle", &id, &emit).unwrap();
        assert_eq!(
            Store::connect(f.path())
                .unwrap()
                .apply_controlled(plan, &mut work)
                .err(),
            Some("sims_canceled")
        );
        assert_eq!(snapshot(f.path()).unwrap().0, before);
        for (g, expected) in before.groups.iter().zip(originals) {
            assert_eq!(
                files::tree(&f.0.join(format!("Mods/Harbor-{}", g.id))).unwrap(),
                expected
            );
        }
        assert!(!snapshot(f.path()).unwrap().1);
        assert_eq!(
            fs::read_dir(f.0.join(STORE).join("stage")).unwrap().count(),
            0
        );
    }
}

#[test]
fn tray_cancel_cleans_partly_prepared_creation_and_keeps_other_library_files() {
    let f = Fixture::new();
    fs::create_dir(f.0.join("Tray")).unwrap();
    fs::write(f.0.join("Tray/existing.trayitem"), b"existing library").unwrap();
    let mut paths = vec![];
    for (i, ext) in ["trayitem", "blueprint", "bpi"].iter().enumerate() {
        let file = f.0.join(format!("0x{i:08x}!0x123456789abcdef0.{ext}"));
        fs::write(&file, [0u8; 32]).unwrap();
        paths.push(file.to_string_lossy().into_owned());
    }
    let cc = f.0.join("bundled.package");
    fs::write(&cc, dbpf(1)).unwrap();
    paths.push(cc.to_string_lossy().into_owned());
    let plan = tray::plan(
        f.path(),
        Action::TrayImport {
            title: "A house".into(),
        },
        paths,
    )
    .unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let emit = |p: progress::Progress| {
        if p.phase == "copying" && p.bytes >= 64 {
            progress::cancel("tray-progress", &id);
        }
    };
    let mut work = progress::Work::start("tray-progress", &id, &emit).unwrap();
    assert_eq!(
        Store::connect(f.path())
            .unwrap()
            .apply_controlled(plan, &mut work)
            .err(),
        Some("sims_canceled")
    );
    assert!(tray::view(f.path()).unwrap().items.is_empty());
    assert!(snapshot(f.path()).unwrap().0.groups.is_empty());
    assert_eq!(fs::read_dir(f.0.join("Tray")).unwrap().count(), 1);
    assert_eq!(
        fs::read(f.0.join("Tray/existing.trayitem")).unwrap(),
        b"existing library"
    );
    assert_eq!(
        fs::read_dir(f.0.join(STORE).join("tray-stage"))
            .unwrap()
            .count(),
        0
    );
}

#[test]
fn update_progress_counts_preserved_settings_and_native_events_end_after_success() {
    use super::super::super::sims_reviews;
    let f = Fixture::new();
    let first = f.install();
    let group = &first.groups[0];
    fs::write(
        f.0.join(format!("Mods/Harbor-{}/creator.cfg", group.id)),
        b"personal settings",
    )
    .unwrap();
    let input = f.0.join("test.package");
    fs::write(&input, dbpf(2)).unwrap();
    let review = sims_reviews::review(
        "progress-update".into(),
        f.path().into(),
        Action::Update {
            id: group.id.clone(),
        },
        vec![input.to_string_lossy().into_owned()],
    )
    .unwrap();
    let events = RefCell::new(vec![]);
    let result = sims_reviews::apply_with_events(
        "progress-update".into(),
        review.token,
        uuid::Uuid::new_v4().to_string(),
        |_| {},
        |p| events.borrow_mut().push(p),
    )
    .unwrap();
    let actual = files::tree(&f.0.join(format!("Mods/Harbor-{}", result.state.groups[0].id)))
        .unwrap()
        .iter()
        .map(|f| f.bytes)
        .sum::<u64>();
    let events = events.borrow();
    let copied = events.iter().rev().find(|p| p.phase == "copying").unwrap();
    assert_eq!((copied.bytes, copied.total_bytes), (actual, actual));
    assert_eq!(events.last().unwrap().phase, "done");
    assert!(events
        .iter()
        .any(|p| p.file.as_deref() == Some("creator.cfg")));
}

#[test]
fn unified_cancel_stops_save_checkpoint_before_mod_set_publication() {
    use super::super::super::sims_reviews;
    let (f, before, set) = set_fixture();
    let vault = Fixture::new();
    let review = sims_reviews::review(
        "sets-proof".into(),
        f.path().into(),
        Action::ApplySet {
            id: set.id,
            backup_folder: Some(vault.path().into()),
        },
        vec![],
    )
    .unwrap();
    let op = uuid::Uuid::new_v4().to_string();
    let result = sims_reviews::apply_with_events(
        "sets-proof".into(),
        review.token,
        op.clone(),
        |_| {
            assert!(sims_reviews::cancel("sets-proof".into(), op.clone()));
        },
        |_| {},
    );
    assert_eq!(result.err(), Some("save_canceled"));
    assert_eq!(snapshot(f.path()).unwrap().0, before);
    assert!(!snapshot(f.path()).unwrap().1);
}
