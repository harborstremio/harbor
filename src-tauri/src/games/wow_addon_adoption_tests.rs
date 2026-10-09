use super::*;

fn existing(fixture: &Fixture, id: u32, names: &[&str]) -> package::Layout {
    let package = bundle(id, "original", names, "");
    for file in package.files {
        let path = fixture.root.join("Interface/AddOns").join(file.stamp.path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, file.data).unwrap();
    }
    package::Layout {
        release: package.release,
        folders: package.folders,
    }
}

#[test]
fn adoption_preserves_current_bytes_then_update_and_restore_keep_the_original_bundle() {
    let fixture = Fixture::new();
    let store = fixture.store();
    let cancel = CancellationToken::new();
    let layout = existing(&fixture, 1, &["Main", "Companion"]);
    fs::write(
        fixture.live("Companion/Companion.toc"),
        "## Interface: 120100\n## Version: 0.9\n## Dependencies: Main",
    )
    .unwrap();
    external(&fixture, "ThirdPartyPlugin", "Main");
    let prior = tree(
        &store.area(&Area::Live, false).unwrap(),
        &layout.folders,
        &cancel,
    )
    .unwrap();
    let plan = store.adopt(layout, VERSION, &cancel).unwrap();
    assert!(plan.is_adoption());
    assert!(plan.previous.is_none());
    store.preview(&plan, VERSION, &cancel).unwrap();
    assert_eq!(store.load().unwrap().packages.len(), 0);
    let state = store.apply(&plan, VERSION, &cancel).unwrap();
    assert_eq!(state.packages[0].files, prior);
    assert!(state.backups.is_empty());
    assert_eq!(state.packages[0].version, "original");
    assert!(fixture.live("ThirdPartyPlugin").is_dir());
    assert_eq!(
        tree(
            &store.area(&Area::Live, false).unwrap(),
            &state.packages[0].folders,
            &cancel
        )
        .unwrap(),
        prior
    );
    let updated = install(&store, 1, "new", &["Main", "Companion"], "");
    assert_eq!(updated.backups[0].group.files, prior);
    let restore = store.restore(&updated.backups[0].token, VERSION).unwrap();
    let restored = store.apply(&restore, VERSION, &cancel).unwrap();
    assert_eq!(restored.packages[0].files, prior);
    assert_eq!(
        store
            .apply(&store.removal(1).unwrap(), VERSION, &cancel)
            .err(),
        Some("wow_addons_dependency")
    );
    fixture.untouched();
}

#[test]
fn import_needs_a_matching_installed_identity_and_rejects_conflicting_companion_ownership() {
    for case in ["absent", "foreign", "owned"] {
        let fixture = Fixture::new();
        let store = fixture.store();
        let cancel = CancellationToken::new();
        let layout = existing(&fixture, 1, &["Main", "Companion"]);
        match case {
            "absent" => {
                for name in ["Main", "Companion"] {
                    fs::write(
                        fixture.live(&format!("{name}/{name}.toc")),
                        "## Interface: 120100\n## Version: original",
                    )
                    .unwrap();
                }
            }
            "foreign" => {
                fs::write(
                    fixture.live("Companion/Companion.toc"),
                    "## Interface: 120100\n## X-WoWI-ID: 2\n## Version: original",
                )
                .unwrap();
            }
            _ => {
                let owned = store
                    .adopt(existing(&fixture, 2, &["Companion"]), VERSION, &cancel)
                    .unwrap();
                store.apply(&owned, VERSION, &cancel).unwrap();
            }
        }
        assert_eq!(
            store.adopt(layout, VERSION, &cancel).err(),
            Some("wow_addons_identity")
        );
        assert!(fixture.live("Main/main.lua").exists());
        fixture.untouched();
    }
}

#[test]
fn adoption_rejects_incompatible_missing_dependency_or_unknown_installed_version() {
    for (fields, error) in [
        (
            "## Interface: 120099\n## Version: old",
            "wow_addons_incompatible",
        ),
        (
            "## Interface: 120100\n## Dependencies: Missing\n## Version: old",
            "wow_addons_dependency",
        ),
        ("## Interface: 120100", "wow_addons_manifest"),
    ] {
        let fixture = Fixture::new();
        let store = fixture.store();
        let cancel = CancellationToken::new();
        let layout = existing(&fixture, 1, &["Main"]);
        fs::write(
            fixture.live("Main/Main.toc"),
            format!("{fields}\n## X-WoWI-ID: 1"),
        )
        .unwrap();
        let result = store
            .adopt(layout, VERSION, &cancel)
            .and_then(|plan| store.preview(&plan, VERSION, &cancel));
        assert_eq!(result.err(), Some(error));
        assert!(store.load().unwrap().packages.is_empty());
        fixture.untouched();
    }
}

#[test]
fn adoption_cancellation_and_file_changes_never_publish_ownership() {
    for action in ["cancel", "edit", "add", "remove"] {
        let fixture = Fixture::new();
        let store = fixture.store();
        let cancel = CancellationToken::new();
        let plan = store
            .adopt(existing(&fixture, 1, &["Main"]), VERSION, &cancel)
            .unwrap();
        match action {
            "cancel" => cancel.cancel(),
            "edit" => fs::write(fixture.live("Main/main.lua"), b"edited externally").unwrap(),
            "add" => fs::write(fixture.live("Main/extra.lua"), b"new file").unwrap(),
            _ => fs::remove_file(fixture.live("Main/main.lua")).unwrap(),
        }
        assert_eq!(
            store.apply(&plan, VERSION, &cancel).err(),
            Some(if action == "cancel" {
                "wow_addons_cancelled"
            } else {
                "wow_addons_changed"
            })
        );
        assert!(store.load().unwrap().packages.is_empty());
        assert!(!store.records.join("journal.json").exists());
        store.discard(&plan).unwrap();
        assert!(fixture.live("Main").is_dir());
        fixture.untouched();
    }
}

#[test]
fn adoption_recovers_before_and_after_atomic_record_publication_without_moving_files() {
    for committed in [false, true] {
        let fixture = Fixture::new();
        let store = fixture.store();
        let cancel = CancellationToken::new();
        let plan = store
            .adopt(
                existing(&fixture, 1, &["Main", "Companion"]),
                VERSION,
                &cancel,
            )
            .unwrap();
        let before = plan.next.as_ref().unwrap().files.clone();
        let journal = store.prepare(&plan, VERSION, &cancel).unwrap();
        assert!(journal.moves.is_empty());
        save_journal(&store, &journal);
        if committed {
            write_json(&store.records, "state.json", &journal.after).unwrap();
        }
        let state = store.load().unwrap();
        assert_eq!(state.packages.len(), usize::from(committed));
        assert!(!store.records.join("journal.json").exists());
        assert_eq!(
            tree(
                &store.area(&Area::Live, false).unwrap(),
                &plan.next.as_ref().unwrap().folders,
                &cancel
            )
            .unwrap(),
            before
        );
        fixture.untouched();
    }
}

#[test]
fn adoption_never_takes_a_linked_published_folder_or_link_inside_the_existing_bundle() {
    use std::os::windows::process::CommandExt;
    for inside in [false, true] {
        let fixture = Fixture::new();
        let store = fixture.store();
        let cancel = CancellationToken::new();
        let mut layout = existing(&fixture, 1, &["Main"]);
        let path = fixture.live(if inside { "Main/linked" } else { "Companion" });
        if !inside {
            layout.folders.push("Companion".into());
        }
        let result = std::process::Command::new("cmd.exe")
            .args(["/D", "/C", "mklink", "/J"])
            .arg(&path)
            .arg(fixture.root.join("WTF"))
            .creation_flags(0x08000000)
            .output()
            .unwrap();
        assert!(result.status.success());
        assert_eq!(
            store.adopt(layout, VERSION, &cancel).err(),
            Some("wow_addons_linked")
        );
        fs::remove_dir(path).unwrap();
        fixture.untouched();
    }
}
