use super::*;
use std::io::{Cursor, Write};
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let parent = std::env::var_os("HARBOR_SIMS_PROOF_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        fs::create_dir_all(&parent).unwrap();
        let root = parent
            .canonicalize()
            .unwrap()
            .join(format!("harbor-sims-proof-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        for name in ["Mods", "saves"] {
            fs::create_dir(root.join(name)).unwrap();
        }
        fs::write(root.join("GameVersion.txt"), "1.120.123.1020").unwrap();
        fs::write(
            root.join("Options.ini"),
            "[options]\nmodsdisabled = 0\nscriptmodsenabled = 1\n",
        )
        .unwrap();
        Self(root)
    }
    fn path(&self) -> &str {
        self.0.to_str().unwrap()
    }
    fn install(&self) -> State {
        let plan = plan(
            self.path(),
            Action::Install {
                title: "A test mod".into(),
            },
            payload(1),
            vec![],
        )
        .unwrap();
        Store::connect(self.path()).unwrap().apply(plan).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if self
            .0
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("harbor-sims-proof-")
            && files::directory(&self.0).is_ok()
        {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}
fn dbpf(value: u8) -> Vec<u8> {
    let mut bytes = vec![0u8; 96];
    bytes[0..4].copy_from_slice(b"DBPF");
    bytes[4..8].copy_from_slice(&2u32.to_le_bytes());
    bytes[8..12].copy_from_slice(&1u32.to_le_bytes());
    bytes[36..40].copy_from_slice(&1u32.to_le_bytes());
    bytes[44..48].copy_from_slice(&36u32.to_le_bytes());
    bytes[64..72].copy_from_slice(&97u64.to_le_bytes());
    bytes.push(value);
    for v in [0u32, 0x03b33ddf, 0, 0, 1, 96, 0x8000_0001, 1, 0x0001_0000] {
        bytes.extend_from_slice(&v.to_le_bytes());
    }
    bytes
}
fn payload(v: u8) -> Vec<Payload> {
    vec![Payload {
        name: "test.package".into(),
        bytes: dbpf(v),
    }]
}
fn archive(items: &[(&str, Vec<u8>)]) -> Vec<u8> {
    let mut w = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (name, data) in items {
        w.start_file(*name, zip::write::SimpleFileOptions::default())
            .unwrap();
        w.write_all(data).unwrap();
    }
    w.finish().unwrap().into_inner()
}
#[test]
fn packages_validate_real_indexes_and_wrong_game_is_rejected() {
    let bytes = dbpf(1);
    let info = package::inspect(&bytes, true).unwrap();
    assert_eq!(info.category, "gameplay");
    assert_eq!(info.resources, 1);
    assert!(info.thumbnail.is_none());
    for at in [4usize, 8, 36, 64] {
        let mut bad = bytes.clone();
        bad[at..at + 4].copy_from_slice(&0u32.to_le_bytes());
        assert!(package::inspect(&bad, false).is_err());
    }
    assert!(package::inspect(&bytes[..100], false).is_err());
}
#[test]
fn embedded_thumbnails_are_decoded_with_bounded_dimensions() {
    use image::{DynamicImage, ImageBuffer, Rgba};
    let image =
        DynamicImage::ImageRgba8(ImageBuffer::from_pixel(32, 32, Rgba([140, 90, 210, 255])));
    let mut png = Cursor::new(Vec::new());
    image.write_to(&mut png, image::ImageFormat::Png).unwrap();
    let content = png.into_inner();
    let base = dbpf(1);
    let mut bytes = base[..96].to_vec();
    bytes.extend_from_slice(&content);
    let offset = bytes.len();
    bytes.extend_from_slice(&base[97..]);
    bytes[64..72].copy_from_slice(&(offset as u64).to_le_bytes());
    bytes[offset + 4..offset + 8].copy_from_slice(&0x3c1af1f2u32.to_le_bytes());
    bytes[offset + 24..offset + 28]
        .copy_from_slice(&(0x8000_0000 | content.len() as u32).to_le_bytes());
    bytes[offset + 28..offset + 32].copy_from_slice(&(content.len() as u32).to_le_bytes());
    let value = package::inspect(&bytes, true).unwrap();
    assert!(value
        .thumbnail
        .unwrap()
        .starts_with("data:image/png;base64,"));
    assert!(package::inspect(&bytes, false).unwrap().thumbnail.is_none());
}
#[test]
fn scripts_are_kept_as_archives_and_their_members_are_checked() {
    let bytes = archive(&[("mymod/main.pyc", vec![1, 2, 3])]);
    package::validate_script(&bytes).unwrap();
    assert!(package::validate_script(&archive(&[("run.exe", vec![1])])).is_err());
    assert!(package::validate_script(&archive(&[("../escape.py", vec![1])])).is_err());
    assert!(package::validate_script(&archive(&[("a.py", vec![1]), ("A.py", vec![2])])).is_err());
    assert!(package::validate_script(&archive(&[("readme.txt", vec![1])])).is_err());
    let manifest = "lot51_core/llamalogic.modfilemanifest.yml";
    package::validate_script(&archive(&[
        ("lot51_core/test.pyc", vec![1]),
        (manifest, b"version: 1.43".to_vec()),
    ]))
    .unwrap();
    assert!(package::validate_script(&archive(&[(manifest, b"version: 1.43".to_vec())])).is_err());
    assert!(
        package::validate_script(&archive(&[("test.py", vec![1]), ("unknown.yml", vec![1])]))
            .is_err()
    );
    assert!(package::validate_script(&archive(&[
        ("test.py", vec![1]),
        (manifest, vec![0; 1024 * 1024 + 1])
    ]))
    .is_err());
}
#[test]
fn imports_do_not_flatten_mixed_folders_or_install_executables() {
    let v = package::unpack_zip(&archive(&[
        ("Mod/test.package", dbpf(1)),
        ("readme.txt", b"help".to_vec()),
    ]))
    .unwrap();
    assert_eq!(v.files[0].name, "test.package");
    assert_eq!(v.skipped, vec!["readme.txt"]);
    assert!(package::unpack_zip(&archive(&[
        ("A/a.package", dbpf(1)),
        ("B/b.package", dbpf(1))
    ]))
    .is_err());
    assert!(package::unpack_zip(&archive(&[
        ("test.package", dbpf(1)),
        ("setup.exe", vec![1])
    ]))
    .is_err());
    for name in [
        "../test.package",
        "C:/test.package",
        "a\\test.package",
        "CON.package",
    ] {
        assert!(package::unpack_zip(&archive(&[(name, dbpf(1))])).is_err());
    }
}
#[test]
fn options_are_read_only_and_missing_or_ambiguous_flags_stay_unknown() {
    assert_eq!(
        files::options("[options]\nmodsdisabled=1\nscriptmodsenabled=0"),
        (Some(false), Some(false))
    );
    assert_eq!(files::options("[other]\nmodsdisabled=0"), (None, None));
    assert_eq!(
        files::options("[options]\nmodsdisabled=0\nmodsdisabled=1"),
        (None, None)
    );
}
#[test]
fn inventory_does_not_create_a_store_or_parse_every_payload() {
    let fixture = Fixture::new();
    let nested = fixture.0.join("Mods").join("one").join("two");
    fs::create_dir_all(&nested).unwrap();
    fs::write(
        nested.join("test.ts4script"),
        b"not parsed during inventory",
    )
    .unwrap();
    let v = files::inventory(fixture.path()).unwrap();
    assert_eq!(v.files.len(), 1);
    assert!(v.files[0].script_too_deep);
    assert_eq!(v.mods_enabled, Some(true));
    assert!(!fixture.0.join(STORE).exists());
    fs::write(fixture.0.join("GameVersion.txt"), "1.67.2").unwrap();
    assert!(files::validate(fixture.path()).is_err());
}
#[test]
#[cfg(windows)]
fn install_disable_enable_remove_and_restore_use_real_files() {
    let f = Fixture::new();
    fs::write(f.0.join("Mods").join("untouched.package"), dbpf(9)).unwrap();
    let state = f.install();
    let group = &state.groups[0];
    let live = f.0.join("Mods").join(format!("Harbor-{}", group.id));
    assert_eq!(fs::read(live.join("test.package")).unwrap(), dbpf(1));
    fs::write(live.join("creator.cfg"), "custom settings").unwrap();
    for action in [
        Action::Disable {
            id: group.id.clone(),
        },
        Action::Enable {
            id: group.id.clone(),
        },
    ] {
        let p = plan(f.path(), action, vec![], vec![]).unwrap();
        Store::connect(f.path()).unwrap().apply(p).unwrap();
    }
    assert_eq!(
        fs::read_to_string(live.join("creator.cfg")).unwrap(),
        "custom settings"
    );
    let p = plan(
        f.path(),
        Action::Remove {
            id: group.id.clone(),
        },
        vec![],
        vec![],
    )
    .unwrap();
    let removed = Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert!(removed.groups.is_empty());
    assert!(!live.exists());
    let p = plan(
        f.path(),
        Action::Restore {
            backup: removed.backups[0].id.clone(),
        },
        vec![],
        vec![],
    )
    .unwrap();
    let restored = Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert_eq!(restored.groups.len(), 1);
    assert_eq!(
        fs::read_to_string(live.join("creator.cfg")).unwrap(),
        "custom settings"
    );
    assert_eq!(
        fs::read(f.0.join("Mods").join("untouched.package")).unwrap(),
        dbpf(9)
    );
}
#[test]
#[cfg(windows)]
fn update_and_version_rollback_preserve_current_creator_settings() {
    let f = Fixture::new();
    let initial = f.install();
    let group = &initial.groups[0];
    let live = f.0.join("Mods").join(format!("Harbor-{}", group.id));
    fs::write(live.join("creator.cfg"), "my settings").unwrap();
    let mut next = payload(2);
    next.push(Payload {
        name: "creator.cfg".into(),
        bytes: b"defaults".to_vec(),
    });
    let p = plan(
        f.path(),
        Action::Update {
            id: group.id.clone(),
        },
        next,
        vec![],
    )
    .unwrap();
    let updated = Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert_eq!(fs::read(live.join("test.package")).unwrap(), dbpf(2));
    assert_eq!(
        fs::read_to_string(live.join("creator.cfg")).unwrap(),
        "my settings"
    );
    fs::write(live.join("creator.cfg"), "new personal settings").unwrap();
    let p = plan(
        f.path(),
        Action::Restore {
            backup: updated.backups[0].id.clone(),
        },
        vec![],
        vec![],
    )
    .unwrap();
    Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert_eq!(fs::read(live.join("test.package")).unwrap(), dbpf(1));
    assert_eq!(
        fs::read_to_string(live.join("creator.cfg")).unwrap(),
        "new personal settings"
    );
}
#[test]
#[cfg(windows)]
fn external_changes_and_stale_reviews_never_overwrite_files() {
    let f = Fixture::new();
    let state = f.install();
    let id = state.groups[0].id.clone();
    let live = f.0.join("Mods").join(format!("Harbor-{id}"));
    let p = plan(
        f.path(),
        Action::Update { id: id.clone() },
        payload(2),
        vec![],
    )
    .unwrap();
    fs::write(live.join("test.package"), dbpf(3)).unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).unwrap_err(),
        "sims_changed"
    );
    assert_eq!(fs::read(live.join("test.package")).unwrap(), dbpf(3));
    assert!(plan(f.path(), Action::Disable { id: id.clone() }, vec![], vec![]).is_err());
    fs::write(live.join("test.package"), dbpf(1)).unwrap();
    let p = plan(
        f.path(),
        Action::Update { id: id.clone() },
        payload(2),
        vec![],
    )
    .unwrap();
    let toggle = plan(f.path(), Action::Disable { id }, vec![], vec![]).unwrap();
    Store::connect(f.path()).unwrap().apply(toggle).unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).unwrap_err(),
        "sims_changed"
    );
}
#[test]
#[cfg(windows)]
fn recovery_handles_each_interruption_boundary_and_is_repeatable_after_rollback() {
    for boundary in 0..=2 {
        let f = Fixture::new();
        let state = f.install();
        let g = state.groups[0].clone();
        let s = Store::connect(f.path()).unwrap();
        let stage = Area::Stage(uuid::Uuid::new_v4().to_string());
        let staged = s.path(&stage).unwrap();
        fs::create_dir(&staged).unwrap();
        fs::write(staged.join("test.package"), dbpf(2)).unwrap();
        let new_tree = files::tree(&staged).unwrap();
        let old_tree = files::tree(&s.path(&location(&g)).unwrap()).unwrap();
        let backup = uuid::Uuid::new_v4().to_string();
        let vault = Area::Vault(backup.clone());
        let mut after = state.clone();
        after.revision = uuid::Uuid::new_v4().to_string();
        after.groups[0].files = new_tree.clone();
        after.backups.push(Backup {
            id: backup,
            group: g.clone(),
            created_at: files::now(),
        });
        let j = Journal {
            adoption: None,
            before: state.clone(),
            after: after.clone(),
            moves: vec![
                Movement {
                    from: location(&g),
                    to: vault,
                    files: old_tree.clone(),
                },
                Movement {
                    from: stage,
                    to: location(&g),
                    files: new_tree,
                },
            ],
        };
        s.write_journal(&j).unwrap();
        for m in j.moves.iter().take(boundary) {
            s.move_folder(m).unwrap();
        }
        if boundary == 2 {
            s.write_state(&after).unwrap();
        }
        assert!(snapshot(f.path()).unwrap().1);
        assert_eq!(s.recover().unwrap(), state);
        assert_eq!(
            files::tree(&s.path(&location(&g)).unwrap()).unwrap(),
            old_tree
        );
        assert!(!snapshot(f.path()).unwrap().1);
    }
}
#[test]
#[cfg(windows)]
fn invalid_recovery_records_never_move_files() {
    let f = Fixture::new();
    let state = f.install();
    let g = &state.groups[0];
    let s = Store::connect(f.path()).unwrap();
    let original = files::tree(&s.path(&location(g)).unwrap()).unwrap();
    let mut after = state.clone();
    after.revision = uuid::Uuid::new_v4().to_string();
    after.groups[0].enabled = false;
    let mut j = Journal {
        adoption: None,
        before: state.clone(),
        after,
        moves: vec![Movement {
            from: location(g),
            to: Area::Disabled(g.id.clone()),
            files: original.clone(),
        }],
    };
    j.after.groups[0].title = "Unrelated overwrite".into();
    s.write_journal(&j).unwrap();
    assert_eq!(s.recover().unwrap_err(), "sims_record");
    assert_eq!(
        files::tree(&s.path(&location(g)).unwrap()).unwrap(),
        original
    );
    assert_eq!(snapshot(f.path()).unwrap().0, state);
}
#[test]
#[cfg(windows)]
fn duplicate_existing_mod_is_rejected_before_and_after_review() {
    let f = Fixture::new();
    let p = plan(
        f.path(),
        Action::Install {
            title: "New".into(),
        },
        payload(1),
        vec![],
    )
    .unwrap();
    fs::write(f.0.join("Mods").join("test.package"), dbpf(9)).unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).unwrap_err(),
        "sims_duplicate"
    );
    assert!(matches!(
        plan(
            f.path(),
            Action::Install {
                title: "Again".into()
            },
            payload(1),
            vec![]
        ),
        Err("sims_duplicate")
    ));
    assert_eq!(
        fs::read(f.0.join("Mods").join("test.package")).unwrap(),
        dbpf(9)
    );
}
#[test]
#[cfg(windows)]
fn review_tokens_are_profile_bound_and_discarded_without_writes() {
    use super::super::sims_reviews as reviews;
    let f = Fixture::new();
    let source = f.0.join("import.package");
    fs::write(&source, dbpf(1)).unwrap();
    let review = reviews::review(
        "first".into(),
        f.path().into(),
        Action::Install {
            title: "Preview".into(),
        },
        vec![source.to_string_lossy().into_owned()],
    )
    .unwrap();
    assert!(matches!(
        reviews::apply("second".into(), review.token.clone()),
        Err("sims_profile")
    ));
    reviews::discard("second", &review.token);
    assert!(!f.0.join(STORE).exists());
    reviews::discard("first", &review.token);
    assert!(matches!(
        reviews::apply("first".into(), review.token),
        Err("sims_expired")
    ));
    assert!(!f.0.join(STORE).exists());
    assert_eq!(files::space(&f.0, u64::MAX), Err("sims_space"));
}
#[test]
#[cfg(windows)]
fn restore_reviews_actual_backup_and_detects_changed_settings() {
    let f = Fixture::new();
    let first = f.install();
    let id = first.groups[0].id.clone();
    let live = f.0.join("Mods").join(format!("Harbor-{id}"));
    fs::write(live.join("creator.cfg"), "old settings").unwrap();
    let p = plan(
        f.path(),
        Action::Update { id: id.clone() },
        payload(2),
        vec![],
    )
    .unwrap();
    let updated = Store::connect(f.path()).unwrap().apply(p).unwrap();
    fs::write(live.join("creator.cfg"), "current personal settings").unwrap();
    let b = &updated.backups[0];
    let p = plan(
        f.path(),
        Action::Restore {
            backup: b.id.clone(),
        },
        vec![],
        vec![],
    )
    .unwrap();
    assert!(p
        .reviewed_files()
        .contains(&files::stamp("test.package".into(), &dbpf(1))));
    assert!(p.reviewed_files().contains(&files::stamp(
        "creator.cfg".into(),
        b"current personal settings"
    )));
    fs::write(
        f.0.join(STORE)
            .join("vault")
            .join(&b.id)
            .join("creator.cfg"),
        "changed backup",
    )
    .unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).unwrap_err(),
        "sims_changed"
    );
    assert_eq!(fs::read(live.join("test.package")).unwrap(), dbpf(2));
    assert!(fs::read_dir(f.0.join(STORE).join("stage"))
        .unwrap()
        .next()
        .is_none());
}
#[test]
#[cfg(windows)]
fn real_creator_archive_install_update_and_restore() {
    // Opt-in fixture supplied from the creator; no download or execution in tests.
    let Some(source) = std::env::var_os("HARBOR_SIMS_CREATOR_ARCHIVE") else {
        return;
    };
    let imported = package::unpack_zip(&fs::read(&source).unwrap()).unwrap();
    assert!(imported
        .files
        .iter()
        .any(|f| f.name == "mc_cmd_center.package"));
    let expected: Vec<_> = imported
        .files
        .iter()
        .map(|f| files::stamp(f.name.clone(), &f.bytes))
        .collect();
    let f = Fixture::new();
    let p = plan(
        f.path(),
        Action::Install {
            title: "MC Command Center".into(),
        },
        imported.files,
        imported.skipped,
    )
    .unwrap();
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    let id = state.groups[0].id.clone();
    let live = f.0.join("Mods").join(format!("Harbor-{id}"));
    for item in &expected {
        assert_eq!(
            files::stamp(item.name.clone(), &fs::read(live.join(&item.name)).unwrap()),
            *item
        );
    }
    fs::write(live.join("mc_settings.cfg"), "{\"custom\":true}").unwrap();
    let same = package::unpack_zip(&fs::read(source).unwrap()).unwrap();
    let p = plan(
        f.path(),
        Action::Update { id: id.clone() },
        same.files,
        same.skipped,
    )
    .unwrap();
    let updated = Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert_eq!(
        fs::read_to_string(live.join("mc_settings.cfg")).unwrap(),
        "{\"custom\":true}"
    );
    let p = plan(
        f.path(),
        Action::Restore {
            backup: updated.backups[0].id.clone(),
        },
        vec![],
        vec![],
    )
    .unwrap();
    Store::connect(f.path()).unwrap().apply(p).unwrap();
    for action in [
        Action::Disable { id: id.clone() },
        Action::Enable { id: id.clone() },
        Action::Remove { id },
    ] {
        let p = plan(f.path(), action, vec![], vec![]).unwrap();
        Store::connect(f.path()).unwrap().apply(p).unwrap();
    }
    assert!(!live.exists());
}
#[test]
#[cfg(windows)]
fn windows_lock_excludes_another_manager_and_linked_mods_are_never_followed() {
    let f = Fixture::new();
    let s = Store::connect(f.path()).unwrap();
    assert!(Store::connect(f.path()).is_err());
    drop(s);
    let outside = Fixture::new();
    let junction = f.0.join("Mods").join("linked");
    let result = std::process::Command::new("cmd")
        .args([
            "/c",
            "mklink",
            "/J",
            junction.to_str().unwrap(),
            outside.0.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert!(result.status.success());
    let inventory = files::inventory(f.path()).unwrap();
    assert!(inventory.partial);
    assert!(inventory.files.is_empty());
    assert!(files::read(&junction.join("Options.ini"), 1000).is_err());
    fs::remove_dir(junction).unwrap();
}

fn set_fixture() -> (Fixture, State, sets::ModSet) {
    let f = Fixture::new();
    let first = f.install().groups[0].id.clone();
    let disable = plan(
        f.path(),
        Action::Disable { id: first.clone() },
        vec![],
        vec![],
    )
    .unwrap();
    Store::connect(f.path()).unwrap().apply(disable).unwrap();
    let second = plan(
        f.path(),
        Action::Install {
            title: "Alternative mod".into(),
        },
        payload(2),
        vec![],
    )
    .unwrap();
    let state = Store::connect(f.path()).unwrap().apply(second).unwrap();
    fs::write(
        f.0.join(STORE)
            .join("disabled")
            .join(&first)
            .join("creator.cfg"),
        "personal setting",
    )
    .unwrap();
    fs::write(f.0.join("saves/Slot_00000001.save"), "original household").unwrap();
    let set = sets::save(
        "sets-proof",
        f.path(),
        sets::Edit {
            revision: state.revision.clone(),
            previous: None,
            title: "Story play".into(),
            members: state
                .groups
                .iter()
                .map(|g| sets::Selection {
                    id: g.id.clone(),
                    enabled: g.id == first,
                })
                .collect(),
        },
    )
    .unwrap()
    .remove(0);
    (f, state, set)
}
fn switch_action(set: &sets::ModSet) -> Action {
    Action::ApplySet {
        id: set.id.clone(),
        backup_folder: None,
    }
}
#[test]
fn named_sets_persist_per_profile_without_changing_mods_and_reject_stale_edits() {
    let empty = Fixture::new();
    assert!(sets::list("sets-proof", empty.path()).unwrap().is_empty());
    assert!(
        !empty.0.join(STORE).exists(),
        "listing never creates a store"
    );
    let (f, state, set) = set_fixture();
    assert_eq!(snapshot(f.path()).unwrap().0, state);
    assert_eq!(
        sets::list("sets-proof", f.path()).unwrap(),
        vec![set.clone()]
    );
    assert!(sets::list("other-profile", f.path()).unwrap().is_empty());
    assert_eq!(
        sets::remove("other-profile", f.path(), set.clone()).err(),
        Some("sims_changed")
    );
    let make_edit = || sets::Edit {
        revision: state.revision.clone(),
        previous: Some(set.clone()),
        title: "Renamed set".into(),
        members: set
            .members
            .iter()
            .map(|m| sets::Selection {
                id: m.id.clone(),
                enabled: m.enabled,
            })
            .collect(),
    };
    let renamed = sets::save("sets-proof", f.path(), make_edit())
        .unwrap()
        .remove(0);
    assert_eq!(
        sets::save("sets-proof", f.path(), make_edit()).err(),
        Some("sims_changed")
    );
    assert!(sets::remove("sets-proof", f.path(), renamed)
        .unwrap()
        .is_empty());
    assert_eq!(snapshot(f.path()).unwrap().0, state);
    assert!(sets::list("", f.path()).is_err());
}
#[test]
fn named_set_switches_as_one_batch_preserving_settings_and_later_imports() {
    let (f, _, set) = set_fixture();
    let extra = plan(
        f.path(),
        Action::Install {
            title: "Later import".into(),
        },
        vec![Payload {
            name: "later.package".into(),
            bytes: dbpf(3),
        }],
        vec![],
    )
    .unwrap();
    let current = Store::connect(f.path()).unwrap().apply(extra).unwrap();
    let later = current
        .groups
        .iter()
        .find(|g| g.title == "Later import")
        .unwrap()
        .id
        .clone();
    let plan = sets::plan("sets-proof", f.path(), switch_action(&set)).unwrap();
    assert_eq!(plan.set.as_ref().unwrap().changes.len(), 2);
    assert!(!plan.set.as_ref().unwrap().changes[0].enabled);
    let after = Store::connect(f.path()).unwrap().apply(plan).unwrap();
    for member in &set.members {
        assert_eq!(
            after
                .groups
                .iter()
                .find(|g| g.id == member.id)
                .unwrap()
                .enabled,
            member.enabled
        );
    }
    assert!(after.groups.iter().find(|g| g.id == later).unwrap().enabled);
    let active = set.members.iter().find(|m| m.enabled).unwrap();
    assert_eq!(
        fs::read_to_string(
            f.0.join("Mods")
                .join(format!("Harbor-{}", active.id))
                .join("creator.cfg")
        )
        .unwrap(),
        "personal setting"
    );
    assert_eq!(
        fs::read(
            f.0.join("Mods")
                .join(format!("Harbor-{}", active.id))
                .join("test.package")
        )
        .unwrap(),
        dbpf(1)
    );
    assert_eq!(
        sets::plan("sets-proof", f.path(), switch_action(&set))
            .err()
            .unwrap(),
        "sims_set_unchanged"
    );
}
#[test]
fn set_review_rejects_removed_members_duplicates_external_edits_and_changed_selection() {
    let (f, state, set) = set_fixture();
    let action = switch_action(&set);
    let before = sets::plan("sets-proof", f.path(), action.clone()).unwrap();
    let disabled = state.groups.iter().find(|g| !g.enabled).unwrap();
    let settings =
        f.0.join(STORE)
            .join("disabled")
            .join(&disabled.id)
            .join("creator.cfg");
    fs::write(&settings, "changed after review").unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(before).err(),
        Some("sims_changed")
    );
    fs::write(f.0.join("Mods/test.package"), dbpf(4)).unwrap();
    assert_eq!(
        sets::plan("sets-proof", f.path(), action.clone())
            .err()
            .unwrap(),
        "sims_duplicate"
    );
    fs::remove_file(f.0.join("Mods/test.package")).unwrap();
    let before = sets::plan("sets-proof", f.path(), action.clone()).unwrap();
    sets::remove("sets-proof", f.path(), set.clone()).unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(before).err(),
        Some("sims_changed")
    );
    let set = sets::save(
        "sets-proof",
        f.path(),
        sets::Edit {
            revision: state.revision.clone(),
            previous: None,
            title: "All on".into(),
            members: state
                .groups
                .iter()
                .map(|g| sets::Selection {
                    id: g.id.clone(),
                    enabled: true,
                })
                .collect(),
        },
    )
    .unwrap()
    .remove(0);
    assert_eq!(
        sets::plan("sets-proof", f.path(), switch_action(&set))
            .err()
            .unwrap(),
        "sims_duplicate"
    );
    let remove = plan(
        f.path(),
        Action::Remove {
            id: disabled.id.clone(),
        },
        vec![],
        vec![],
    )
    .unwrap();
    let current = Store::connect(f.path()).unwrap().apply(remove).unwrap();
    assert_eq!(
        sets::plan("sets-proof", f.path(), switch_action(&set))
            .err()
            .unwrap(),
        "sims_set_missing"
    );
    let edit = sets::Edit {
        revision: current.revision.clone(),
        previous: Some(set),
        title: "Repaired set".into(),
        members: current
            .groups
            .iter()
            .map(|g| sets::Selection {
                id: g.id.clone(),
                enabled: g.enabled,
            })
            .collect(),
    };
    assert_eq!(
        sets::save("sets-proof", f.path(), edit).unwrap()[0]
            .members
            .len(),
        1
    );
}
#[test]
fn mod_set_checkpoint_copies_exact_saves_and_failure_or_cancel_never_switches_mods() {
    use super::super::{saves, sims_reviews, sims_saves};
    let (f, before, set) = set_fixture();
    let backup = f.0.join("external-backups");
    fs::create_dir(&backup).unwrap();
    // A chosen vault inside game content is rejected before a mod is moved.
    let review = sims_reviews::review(
        "sets-proof".into(),
        f.path().into(),
        Action::ApplySet {
            id: set.id.clone(),
            backup_folder: Some(f.0.join("Mods").to_string_lossy().into_owned()),
        },
        vec![],
    )
    .unwrap();
    assert_eq!(
        sims_reviews::apply("sets-proof".into(), review.token).err(),
        Some("save_nested")
    );
    assert_eq!(snapshot(f.path()).unwrap().0, before);
    // Use a sibling destination rather than another directory inside Sims data.
    let outside =
        f.0.with_file_name(format!("harbor-sims-proof-vault-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&outside).unwrap();
    let review = || {
        let mut action = switch_action(&set);
        if let Action::ApplySet { backup_folder, .. } = &mut action {
            *backup_folder = Some(outside.to_string_lossy().into_owned());
        }
        sims_reviews::review("sets-proof".into(), f.path().into(), action, vec![]).unwrap()
    };
    let op = uuid::Uuid::new_v4().to_string();
    let canceled =
        sims_reviews::apply_with_progress("sets-proof".into(), review().token, op.clone(), |_| {
            saves::cancel("sets-proof".into(), op.clone())
        });
    assert_eq!(canceled.err(), Some("save_canceled"));
    assert_eq!(snapshot(f.path()).unwrap().0, before);
    let result = sims_reviews::apply("sets-proof".into(), review().token).unwrap();
    let copy = result.save_backup.unwrap();
    let snapshots = sims_saves::list(
        f.path(),
        "sets-proof".into(),
        outside.to_string_lossy().into_owned(),
    )
    .unwrap();
    assert_eq!(snapshots.len(), 1);
    assert_eq!(snapshots[0].id, copy.id);
    assert_eq!(copy.label, set.title);
    // Use the actual saved record to verify content through the existing review API.
    let reviewed = sims_saves::review(
        f.path(),
        "sets-proof".into(),
        outside.to_string_lossy().into_owned(),
        copy.id,
        uuid::Uuid::new_v4().to_string(),
        |_| {},
    )
    .unwrap();
    assert_eq!(reviewed.unchanged, 1);
    saves::discard("sets-proof".into(), reviewed.token);
    assert_eq!(
        fs::read_to_string(f.0.join("saves/Slot_00000001.save")).unwrap(),
        "original household"
    );
    assert!(outside
        .file_name()
        .unwrap()
        .to_string_lossy()
        .starts_with("harbor-sims-proof-vault-"));
    fs::remove_dir_all(outside).unwrap();
}
#[test]
#[ignore = "Owned subprocess worker for mod-set interruption tests"]
fn mod_set_interruption_worker() {
    let root = std::env::var("HARBOR_MOD_SET_ROOT").unwrap();
    if std::env::var("HARBOR_MOD_SET_RECOVER").ok().as_deref() == Some("1") {
        Store::connect(&root).unwrap().recover().unwrap();
    } else {
        let id = std::env::var("HARBOR_MOD_SET_ID").unwrap();
        let p = sets::plan(
            "sets-proof",
            &root,
            Action::ApplySet {
                id,
                backup_folder: None,
            },
        )
        .unwrap();
        Store::connect(&root).unwrap().apply(p).unwrap();
    }
    panic!("Owned interruption marker was not reached");
}
fn interrupt_set(f: &Fixture, id: &str, phase: &str, recover: bool) {
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
        "{}::mod_set_interruption_worker",
        module_path!().split_once("::").unwrap().1
    );
    let mut command = Command::new(std::env::current_exe().unwrap());
    command
        .args(["--exact", &worker, "--ignored", "--nocapture"])
        .env("HARBOR_MOD_SET_ROOT", f.path())
        .env("HARBOR_MOD_SET_ID", id)
        .env("HARBOR_MOD_SET_RECOVER", if recover { "1" } else { "0" })
        .env("HARBOR_SAVE_INTERRUPT_PHASE", phase)
        .env("HARBOR_SAVE_INTERRUPT_MARKER", &marker)
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
        assert!(std::time::Instant::now() < until);
        std::thread::sleep(std::time::Duration::from_millis(25));
    }
    assert!(child.0.try_wait().unwrap().is_none());
    assert_eq!(Store::connect(f.path()).err().unwrap(), "sims_busy");
    child.0.kill().unwrap();
    child.0.wait().unwrap();
}
#[test]
fn terminated_mod_set_switch_and_recovery_return_the_exact_previous_setup() {
    for phase in [
        "modsJournal",
        "modsMove1",
        "modsMove2",
        "modsState",
        "modsRollback1",
    ] {
        let (f, before, set) = set_fixture();
        interrupt_set(
            &f,
            &set.id,
            if phase == "modsRollback1" {
                "modsMove2"
            } else {
                phase
            },
            false,
        );
        assert!(snapshot(f.path()).unwrap().1);
        if phase == "modsRollback1" {
            interrupt_set(&f, &set.id, phase, true);
        }
        let store = Store::connect(f.path()).unwrap();
        store.recover().unwrap();
        assert_eq!(snapshot(f.path()).unwrap().0, before);
        assert!(!snapshot(f.path()).unwrap().1);
        for group in &before.groups {
            verify_owned(
                group,
                &files::tree(&store.path(&location(group)).unwrap()).unwrap(),
            )
            .unwrap();
        }
    }
}

#[path = "sims_adopt_tests.rs"]
mod adoption_tests;

#[path = "sims_troubleshoot_tests.rs"]
mod troubleshooting_tests;

#[path = "sims_preview_tests.rs"]
mod preview_tests;
#[path = "sims_progress_tests.rs"]
mod progress_tests;
#[path = "sims_tray_image_tests.rs"]
mod tray_image_tests;
#[path = "sims_tray_tests.rs"]
mod tray_tests;

#[path = "sims_review_cancel_tests.rs"]
mod review_cancel_tests;

#[path = "sims_preparation_tests.rs"]
mod preparation_tests;

#[path = "sims_nested_tests.rs"]
mod nested_tests;

#[path = "sims_creator_store_tests.rs"]
mod creator_tests;

#[test]
fn actual_lot51_core_archive_with_manifest_imports_unchanged_when_fixture_is_supplied() {
    let Some(root) = std::env::var_os("HARBOR_SIMS_LOT51_FIXTURES") else {
        return;
    };
    let bytes = fs::read(PathBuf::from(root).join("lot51-core-live.zip")).unwrap();
    let import = package::unpack_zip_checked(&bytes, &|| Ok(())).unwrap();
    assert_eq!(import.files.len(), 1);
    assert_eq!(import.files[0].name, "lot51_core.ts4script");
    let expected = import.files[0].bytes.clone();
    let f = Fixture::new();
    let p = plan(
        f.path(),
        Action::Install {
            title: "Core Library".into(),
        },
        import.files,
        import.skipped,
    )
    .unwrap();
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert!(state.groups[0].source.is_none());
    assert_eq!(
        fs::read(f.0.join("Mods").join(format!(
            "Harbor-{}/lot51_core.ts4script",
            state.groups[0].id
        )))
        .unwrap(),
        expected
    );
}
