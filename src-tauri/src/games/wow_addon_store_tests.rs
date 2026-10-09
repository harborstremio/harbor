use super::*;
use std::io::Cursor;

#[path = "wow_addon_adoption_tests.rs"]
mod adoption;

const ID: &str = "battlenet:wow";
const VERSION: &str = "12.1.0.69497";

struct Fixture {
    base: PathBuf,
    root: PathBuf,
}
impl Fixture {
    fn new() -> Self {
        let base = PathBuf::from(
            std::env::var("HARBOR_GAME_TEST_ROOT").expect("Use an isolated native test directory"),
        );
        fs::create_dir_all(&base).unwrap();
        let base = directory(&base).unwrap();
        let root = base.join(format!("wow-store-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        fs::create_dir(root.join("WTF")).unwrap();
        fs::write(root.join("WTF/preserved.lua"), b"personal account data").unwrap();
        Self { base, root }
    }
    fn store(&self) -> Store {
        Store::connect(&self.root, ID).unwrap()
    }
    fn live(&self, name: &str) -> PathBuf {
        self.root.join("Interface/AddOns").join(name)
    }
    fn untouched(&self) {
        assert_eq!(
            fs::read(self.root.join("WTF/preserved.lua")).unwrap(),
            b"personal account data"
        );
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        // Only this newly-created fixture is ever removed, never a game directory.
        let root = directory(&self.root).unwrap();
        assert_eq!(root.parent(), Some(self.base.as_path()));
        assert!(root
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("wow-store-"));
        fs::remove_dir_all(root).unwrap();
    }
}
fn bundle(id: u32, version: &str, folders: &[&str], dependencies: &str) -> Package {
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for folder in folders {
        let toc=format!("## Interface: 120100\n## Title: {folder}\n## Version: {version}\n## X-WoWI-ID: {id}\n## Dependencies: {dependencies}\nmain.lua");
        for (name, data) in [
            (format!("{folder}/{folder}.toc"), toc),
            (format!("{folder}/main.lua"), format!("version {version}")),
            (
                format!("{folder}/assets/icon.txt"),
                format!("{folder} {version}"),
            ),
        ] {
            zip.start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            zip.write_all(data.as_bytes()).unwrap();
        }
    }
    let bytes = zip.finish().unwrap().into_inner();
    let release = package::Release {
        id,
        title: "Fixture addon".into(),
        version: version.into(),
        updated_at: 1,
        checksum: format!("{:x}", md5::compute(&bytes)),
        download_url: "https://cdn.wowinterface.com/downloads/getfile.php".into(),
    };
    package::unpack(release, &bytes, ID, VERSION, &CancellationToken::new()).unwrap()
}
fn install(store: &Store, id: u32, version: &str, folders: &[&str], deps: &str) -> State {
    let plan = store
        .stage(
            bundle(id, version, folders, deps),
            &CancellationToken::new(),
        )
        .unwrap();
    store
        .apply(&plan, VERSION, &CancellationToken::new())
        .unwrap()
}
fn external(fixture: &Fixture, name: &str, deps: &str) {
    fs::create_dir_all(fixture.live(name)).unwrap();
    fs::write(
        fixture.live(&format!("{name}/{name}.toc")),
        format!("## Interface: 120100\n## Dependencies: {deps}"),
    )
    .unwrap();
}
fn save_journal(store: &Store, journal: &Journal) {
    for movement in &journal.moves {
        store.area(&movement.to, true).unwrap();
    }
    write_json(&store.records, "journal.json", journal).unwrap();
}

#[test]
fn canceled_and_expired_stages_are_removable_without_changing_live_addons() {
    let fixture = Fixture::new();
    let store = fixture.store();
    let original = install(&store, 7, "1", &["Main"], "");
    let plan = store
        .stage(
            bundle(7, "2", &["Main", "Library"], ""),
            &CancellationToken::new(),
        )
        .unwrap();
    store
        .preview(&plan, VERSION, &CancellationToken::new())
        .unwrap();
    let stage = store.area(plan.source.as_ref().unwrap(), false).unwrap();
    store.discard(&plan).unwrap();
    store.discard(&plan).unwrap();
    assert!(!stage.exists());
    assert_eq!(store.load().unwrap(), original);
    assert_eq!(
        fs::read(fixture.live("Main/main.lua")).unwrap(),
        b"version 1"
    );
    fixture.untouched();
}

#[test]
fn interrupted_staging_recovers_known_partial_payload_and_missing_files() {
    let fixture = Fixture::new();
    let store = fixture.store();
    let plan = store
        .stage(
            bundle(7, "1", &["Main", "Library"], ""),
            &CancellationToken::new(),
        )
        .unwrap();
    let stage = store.area(plan.source.as_ref().unwrap(), false).unwrap();
    fs::remove_file(stage.join("Main/main.lua")).unwrap();
    fs::write(
        stage.join(stages::PARTIAL),
        b"partial bytes from an interrupted write",
    )
    .unwrap();
    drop(store);
    let store = fixture.store();
    assert_eq!(store.cleanup_stages().unwrap(), 1);
    assert!(!stage.exists());
    assert!(store.load().unwrap().packages.is_empty());
    assert!(!fixture.live("Main").exists());
    fixture.untouched();
}

#[test]
fn cleanup_preserves_modified_unknown_or_linked_staging_content() {
    for mode in ["changed", "extra", "directory", "receipt", "link"] {
        let fixture = Fixture::new();
        let store = fixture.store();
        let plan = store
            .stage(bundle(7, "1", &["Main"], ""), &CancellationToken::new())
            .unwrap();
        let stage = store.area(plan.source.as_ref().unwrap(), false).unwrap();
        match mode {
            "changed" => fs::write(stage.join("Main/main.lua"), b"user edit").unwrap(),
            "extra" => fs::write(stage.join("Main/personal.txt"), b"personal").unwrap(),
            "directory" => fs::create_dir(stage.join("Unrelated")).unwrap(),
            "receipt" => fs::write(stage.join(".harbor-stage.json"), b"{}").unwrap(),
            "link" => {
                let status = std::process::Command::new("cmd")
                    .args(["/D", "/C", "mklink", "/J"])
                    .arg(stage.join("Main/linked"))
                    .arg(fixture.root.join("WTF"))
                    .output()
                    .unwrap();
                assert!(status.status.success());
            }
            _ => unreachable!(),
        }
        assert!(store.cleanup_stages().is_err());
        assert!(stage.join("Main/Main.toc").is_file());
        assert!(stage.join("Main/assets/icon.txt").is_file());
        if mode == "link" {
            fs::remove_dir(stage.join("Main/linked")).unwrap();
        }
        fixture.untouched();
    }
}

#[test]
fn snapshot_never_creates_a_store_or_recovers_an_interrupted_operation() {
    let fixture = Fixture::new();
    assert_eq!(Store::snapshot(&fixture.root, ID).unwrap(), (None, false));
    assert!(!fixture.root.join("Interface").exists());
    let store = fixture.store();
    let before = install(&store, 7, "1", &["Main"], "");
    let plan = store
        .stage(bundle(7, "2", &["Main"], ""), &CancellationToken::new())
        .unwrap();
    let journal = store.journal(&plan).unwrap();
    save_journal(&store, &journal);
    store.move_folder(&journal.moves[0], false).unwrap();
    let raw = fs::read(store.records.join("journal.json")).unwrap();
    assert_eq!(
        Store::snapshot(&fixture.root, ID).unwrap(),
        (Some(before), true)
    );
    assert_eq!(fs::read(store.records.join("journal.json")).unwrap(), raw);
    assert!(!fixture.live("Main").exists());
    assert_eq!(store.discard(&plan), Err("wow_addons_recovery"));
    assert_eq!(store.cleanup_stages(), Err("wow_addons_recovery"));
    store.load().unwrap();
    store.cleanup_stages().unwrap();
    fixture.untouched();
}

#[test]
fn cleanup_after_commit_keeps_backup_and_rejects_invalid_stage_identity() {
    let fixture = Fixture::new();
    let store = fixture.store();
    install(&store, 7, "1", &["Main"], "");
    let plan = store
        .stage(bundle(7, "2", &["Main"], ""), &CancellationToken::new())
        .unwrap();
    let after = store
        .apply(&plan, VERSION, &CancellationToken::new())
        .unwrap();
    store.discard(&plan).unwrap();
    assert_eq!(store.load().unwrap(), after);
    assert_eq!(
        fs::read(
            store
                .area(&Area::Vault(plan.token.clone()), false)
                .unwrap()
                .join("Main/main.lua")
        )
        .unwrap(),
        b"version 1"
    );
    assert_eq!(store.cleanup_stages().unwrap(), 1); // The initial install's empty stage receipt.
    let empty = store
        .area(&Area::Stage(uuid::Uuid::new_v4().to_string()), true)
        .unwrap();
    assert_eq!(store.cleanup_stages().unwrap(), 1);
    assert!(!empty.exists());
    let parent = store.records.join("stage");
    fs::create_dir(parent.join("unrelated")).unwrap();
    assert_eq!(store.cleanup_stages(), Err("wow_addons_record"));
    assert!(parent.join("unrelated").exists());
    fixture.untouched();
}

#[test]
fn preview_catches_missing_dependencies_before_any_live_folder_moves() {
    let fixture = Fixture::new();
    let store = fixture.store();
    let plan = store
        .stage(
            bundle(7, "1", &["Main"], "RequiredLibrary"),
            &CancellationToken::new(),
        )
        .unwrap();
    assert_eq!(
        store.preview(&plan, VERSION, &CancellationToken::new()),
        Err("wow_addons_dependency")
    );
    assert!(!fixture.live("Main").exists());
    assert!(!store.records.join("journal.json").exists());
    store.discard(&plan).unwrap();
}

#[test]
fn whole_bundles_install_update_restore_remove_and_restore_without_touching_account_data() {
    let fixture = Fixture::new();
    assert!(!Store::exists(&fixture.root).unwrap());
    let store = fixture.store();
    assert!(Store::exists(&fixture.root).unwrap());
    let initial = install(&store, 7, "1", &["Main", "Library"], "");
    assert_eq!(initial.packages.len(), 1);
    let updated = install(&store, 7, "2", &["Main", "NewLibrary"], "");
    assert!(!fixture.live("Library").exists());
    assert!(fixture.live("NewLibrary").is_dir());
    assert_eq!(
        fs::read(fixture.live("Main/main.lua")).unwrap(),
        b"version 2"
    );
    assert_eq!(updated.backups.len(), 1);
    assert_eq!(updated.backups[0].group, initial.packages[0]);
    let plan = store.restore(&updated.backups[0].token, VERSION).unwrap();
    let restored = store
        .apply(&plan, VERSION, &CancellationToken::new())
        .unwrap();
    assert_eq!(restored.packages, initial.packages);
    assert!(fixture.live("Library").is_dir());
    assert!(!fixture.live("NewLibrary").exists());
    let removal = store.removal(7).unwrap();
    let removed = store
        .apply(&removal, VERSION, &CancellationToken::new())
        .unwrap();
    assert!(removed.packages.is_empty());
    assert!(!fixture.live("Main").exists());
    let back = store.restore(&removal.token, VERSION).unwrap();
    let state = store
        .apply(&back, VERSION, &CancellationToken::new())
        .unwrap();
    assert_eq!(state.packages, initial.packages);
    fixture.untouched();
    drop(store);
    assert_eq!(fixture.store().load().unwrap(), state);
}

#[test]
fn unmanaged_and_other_packages_are_never_overwritten() {
    let fixture = Fixture::new();
    let store = fixture.store();
    external(&fixture, "Main", "");
    assert_eq!(
        store
            .stage(bundle(1, "1", &["Main"], ""), &CancellationToken::new())
            .err(),
        Some("wow_addons_unmanaged")
    );
    install(&store, 2, "1", &["Owned"], "");
    assert_eq!(
        store
            .stage(bundle(3, "1", &["Owned"], ""), &CancellationToken::new())
            .err(),
        Some("wow_addons_collision")
    );
    fixture.untouched();
}

#[test]
fn extra_modified_and_missing_managed_files_block_changes() {
    for kind in ["extra", "modified", "missing"] {
        let fixture = Fixture::new();
        let store = fixture.store();
        let original = install(&store, 1, "1", &["Main"], "");
        match kind {
            "extra" => fs::write(fixture.live("Main/personal.lua"), b"mine").unwrap(),
            "modified" => fs::write(fixture.live("Main/main.lua"), b"modified").unwrap(),
            _ => fs::remove_file(fixture.live("Main/main.lua")).unwrap(),
        }
        assert_eq!(store.removal(1).err(), Some("wow_addons_changed"));
        assert_eq!(store.load().unwrap(), original);
        fixture.untouched();
    }
}

#[test]
fn stale_plans_changed_stages_and_changed_backups_are_rejected() {
    let fixture = Fixture::new();
    let store = fixture.store();
    let plan = store
        .stage(bundle(1, "1", &["First"], ""), &CancellationToken::new())
        .unwrap();
    install(&store, 2, "1", &["Second"], "");
    assert_eq!(
        store.apply(&plan, VERSION, &CancellationToken::new()).err(),
        Some("wow_addons_changed")
    );
    let plan = store
        .stage(bundle(1, "1", &["First"], ""), &CancellationToken::new())
        .unwrap();
    let staged = store.area(plan.source.as_ref().unwrap(), false).unwrap();
    fs::write(staged.join("First/main.lua"), b"changed").unwrap();
    assert_eq!(
        store.apply(&plan, VERSION, &CancellationToken::new()).err(),
        Some("wow_addons_changed")
    );
    let state = install(&store, 2, "2", &["Second"], "");
    let backup = &state.backups[0];
    fs::write(
        store
            .area(&Area::Vault(backup.token.clone()), false)
            .unwrap()
            .join("Second/main.lua"),
        b"changed",
    )
    .unwrap();
    assert_eq!(
        store.restore(&backup.token, VERSION).err(),
        Some("wow_addons_changed")
    );
    assert!(!fixture.live("First").exists());
}

#[test]
fn exact_client_compatibility_is_rechecked_at_apply_and_restore() {
    let fixture = Fixture::new();
    let store = fixture.store();
    let plan = store
        .stage(bundle(1, "1", &["Main"], ""), &CancellationToken::new())
        .unwrap();
    assert_eq!(
        store
            .apply(&plan, "12.1.1.1", &CancellationToken::new())
            .err(),
        Some("wow_addons_incompatible")
    );
    assert!(!fixture.live("Main").exists());
    store
        .apply(&plan, VERSION, &CancellationToken::new())
        .unwrap();
    let state = install(&store, 1, "2", &["Main"], "");
    assert_eq!(
        store.restore(&state.backups[0].token, "12.1.1.1").err(),
        Some("wow_addons_incompatible")
    );
}

#[test]
fn dependencies_require_valid_folders_and_protect_managed_and_unmanaged_dependents() {
    let fixture = Fixture::new();
    let store = fixture.store();
    let plan = store
        .stage(
            bundle(1, "1", &["Main"], "Library"),
            &CancellationToken::new(),
        )
        .unwrap();
    assert_eq!(
        store.apply(&plan, VERSION, &CancellationToken::new()).err(),
        Some("wow_addons_dependency")
    );
    fs::write(fixture.live("Library"), b"not an addon").unwrap();
    assert!(store
        .apply(&plan, VERSION, &CancellationToken::new())
        .is_err());
    fs::remove_file(fixture.live("Library")).unwrap();
    external(&fixture, "Library", "");
    store
        .apply(&plan, VERSION, &CancellationToken::new())
        .unwrap();
    install(&store, 2, "1", &["Shared"], "");
    install(&store, 3, "1", &["Consumer"], "Shared");
    let removal = store.removal(2).unwrap();
    assert_eq!(
        store
            .apply(&removal, VERSION, &CancellationToken::new())
            .err(),
        Some("wow_addons_dependency")
    );
    let removal = store.removal(3).unwrap();
    store
        .apply(&removal, VERSION, &CancellationToken::new())
        .unwrap();
    external(&fixture, "ExternalConsumer", "Shared");
    let removal = store.removal(2).unwrap();
    assert_eq!(
        store
            .apply(&removal, VERSION, &CancellationToken::new())
            .err(),
        Some("wow_addons_dependency")
    );
    assert!(fixture.live("Shared").is_dir());
    fixture.untouched();
}

#[test]
fn cancellation_before_staging_or_commit_has_no_live_effect() {
    let fixture = Fixture::new();
    let store = fixture.store();
    let cancel = CancellationToken::new();
    cancel.cancel();
    assert_eq!(
        store.stage(bundle(1, "1", &["Main"], ""), &cancel).err(),
        Some("wow_addons_cancelled")
    );
    assert!(!store.records.join("stage").exists());
    let plan = store
        .stage(bundle(1, "1", &["Main"], ""), &CancellationToken::new())
        .unwrap();
    assert_eq!(
        store.apply(&plan, VERSION, &cancel).err(),
        Some("wow_addons_cancelled")
    );
    assert!(!fixture.live("Main").exists());
    assert!(!store.records.join("journal.json").exists());
}

#[test]
fn reopened_store_recovers_every_durable_and_inflight_update_boundary() {
    for completed in 0..=4 {
        for inflight in [false, true] {
            if completed == 4 && inflight {
                continue;
            }
            let fixture = Fixture::new();
            let store = fixture.store();
            let before = install(&store, 1, "1", &["Main", "Library"], "");
            let plan = store
                .stage(
                    bundle(1, "2", &["Main", "NewLibrary"], ""),
                    &CancellationToken::new(),
                )
                .unwrap();
            let mut journal = store.journal(&plan).unwrap();
            save_journal(&store, &journal);
            for index in 0..completed {
                store.move_folder(&journal.moves[index], false).unwrap();
                journal.completed += 1;
                write_json(&store.records, "journal.json", &journal).unwrap();
            }
            if inflight {
                store.move_folder(&journal.moves[completed], false).unwrap();
            }
            drop(store);
            let store = fixture.store();
            assert_eq!(store.load().unwrap(), before);
            store.check_owned(&before).unwrap();
            assert!(!fixture.live("NewLibrary").exists());
            assert_eq!(
                fs::read(fixture.live("Main/main.lua")).unwrap(),
                b"version 1"
            );
            assert!(!store.records.join("journal.json").exists());
            fixture.untouched();
        }
    }
}

#[test]
fn reopened_store_recovers_an_interrupted_rollback_at_every_reverse_boundary() {
    for remaining in 0..=4 {
        for inflight in [false, true] {
            if remaining == 0 && inflight {
                continue;
            }
            let fixture = Fixture::new();
            let store = fixture.store();
            let before = install(&store, 1, "1", &["Main", "Library"], "");
            let plan = store
                .stage(
                    bundle(1, "2", &["Main", "NewLibrary"], ""),
                    &CancellationToken::new(),
                )
                .unwrap();
            let mut journal = store.journal(&plan).unwrap();
            save_journal(&store, &journal);
            for movement in &journal.moves {
                store.move_folder(movement, false).unwrap();
            }
            journal.completed = 4;
            journal.reversing = true;
            write_json(&store.records, "journal.json", &journal).unwrap();
            while journal.completed > remaining {
                store
                    .move_folder(&journal.moves[journal.completed - 1], true)
                    .unwrap();
                journal.completed -= 1;
                write_json(&store.records, "journal.json", &journal).unwrap();
            }
            if inflight {
                store
                    .move_folder(&journal.moves[remaining - 1], true)
                    .unwrap();
            }
            drop(store);
            let store = fixture.store();
            assert_eq!(store.load().unwrap(), before);
            store.check_owned(&before).unwrap();
            fixture.untouched();
        }
    }
}

#[test]
fn committed_state_finishes_recovery_without_reverting_the_update() {
    let fixture = Fixture::new();
    let store = fixture.store();
    install(&store, 1, "1", &["Main"], "");
    let plan = store
        .stage(bundle(1, "2", &["Main"], ""), &CancellationToken::new())
        .unwrap();
    let mut journal = store.journal(&plan).unwrap();
    save_journal(&store, &journal);
    for movement in &journal.moves {
        store.move_folder(movement, false).unwrap();
        journal.completed += 1;
        write_json(&store.records, "journal.json", &journal).unwrap();
    }
    write_json(&store.records, "state.json", &journal.after).unwrap();
    drop(store);
    let store = fixture.store();
    assert_eq!(store.load().unwrap(), journal.after);
    assert_eq!(
        fs::read(fixture.live("Main/main.lua")).unwrap(),
        b"version 2"
    );
    assert!(!store.records.join("journal.json").exists());
}

#[test]
fn forged_movement_or_unrelated_state_change_cannot_be_recovered() {
    for changed in ["folder", "area", "content", "state", "plan"] {
        let fixture = Fixture::new();
        let store = fixture.store();
        let before = install(&store, 1, "1", &["Main"], "");
        let plan = store
            .stage(bundle(1, "2", &["Main"], ""), &CancellationToken::new())
            .unwrap();
        let mut journal = store.journal(&plan).unwrap();
        save_journal(&store, &journal);
        match changed {
            "folder" => journal.moves[0].folder = "External".into(),
            "area" => journal.moves[0].to = Area::Stage(plan.token.clone()),
            "content" => journal.moves[0].files[0].sha256 = "a".repeat(64),
            "state" => journal.after.packages[0].title = "Unrelated modification".into(),
            _ => journal.plan.previous = None,
        }
        write_json(&store.records, "journal.json", &journal).unwrap();
        assert_eq!(store.load().err(), Some("wow_addons_record"));
        store.check_owned(&before).unwrap();
        fixture.untouched();
    }
}

#[test]
fn record_paths_cannot_alias_or_escape_and_store_lock_excludes_another_writer() {
    let fixture = Fixture::new();
    let store = fixture.store();
    assert_eq!(
        Store::connect(&fixture.root, ID).err().unwrap(),
        "wow_addons_busy"
    );
    let mut plan = store
        .stage(bundle(1, "1", &["Main"], ""), &CancellationToken::new())
        .unwrap();
    let group = plan.next.as_mut().unwrap();
    group.files[0].path = "Main/../WTF/preserved.lua".into();
    assert!(validate_group(group).is_err());
    assert!(uuid("../../outside").is_err());
    assert!(uuid(&uuid::Uuid::new_v4().simple().to_string()).is_err());
    fixture.untouched();
}

#[test]
fn ambiguous_recovery_preserves_both_copies_and_the_journal_for_review() {
    let fixture = Fixture::new();
    let store = fixture.store();
    let before = install(&store, 1, "1", &["Main"], "");
    let plan = store
        .stage(bundle(1, "2", &["Main"], ""), &CancellationToken::new())
        .unwrap();
    let mut journal = store.journal(&plan).unwrap();
    save_journal(&store, &journal);
    store.move_folder(&journal.moves[0], false).unwrap();
    journal.completed = 1;
    journal.reversing = true;
    write_json(&store.records, "journal.json", &journal).unwrap();
    external(&fixture, "Main", "");
    assert!(store.load().is_err());
    assert!(store.records.join("journal.json").exists());
    matches(
        &store.area(&journal.moves[0].to, false).unwrap(),
        &before.packages[0].folders,
        &before.packages[0].files,
    )
    .unwrap();
    assert!(fixture.live("Main/Main.toc").exists());
    fixture.untouched();
}

#[test]
fn junctions_inside_owned_folders_or_the_installation_are_rejected() {
    use std::os::windows::process::CommandExt;
    fn junction(link: &Path, target: &Path) {
        let output = std::process::Command::new("cmd.exe")
            .args(["/D", "/C", "mklink", "/J"])
            .arg(link)
            .arg(target)
            .creation_flags(0x08000000)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(save_files::reparse(&fs::symlink_metadata(link).unwrap()));
    }
    let fixture = Fixture::new();
    let store = fixture.store();
    install(&store, 1, "1", &["Main"], "");
    let linked = fixture.live("Main/account-link");
    junction(&linked, &fixture.root.join("WTF"));
    assert_eq!(store.removal(1).err(), Some("wow_addons_linked"));
    fixture.untouched();
    fs::remove_dir(&linked).unwrap();
    drop(store);
    let alias = fixture
        .base
        .join(format!("wow-store-alias-{}", uuid::Uuid::new_v4()));
    junction(&alias, &fixture.root);
    assert_eq!(
        Store::connect(&alias, ID).err().unwrap(),
        "wow_addons_linked"
    );
    fs::remove_dir(alias).unwrap();
    fixture.untouched();
}

#[test]
fn initial_install_removal_and_backup_restore_recover_at_every_forward_boundary() {
    for action in ["install", "remove", "restore"] {
        for completed in 0..=4 {
            let fixture = Fixture::new();
            let store = fixture.store();
            let plan = match action {
                "install" => store
                    .stage(
                        bundle(1, "1", &["Main", "Library"], ""),
                        &CancellationToken::new(),
                    )
                    .unwrap(),
                "remove" => {
                    install(&store, 1, "1", &["Main", "Library"], "");
                    store.removal(1).unwrap()
                }
                _ => {
                    install(&store, 1, "1", &["Main", "Library"], "");
                    let state = install(&store, 1, "2", &["Main", "NewLibrary"], "");
                    store.restore(&state.backups[0].token, VERSION).unwrap()
                }
            };
            let mut journal = store.journal(&plan).unwrap();
            if completed > journal.moves.len() {
                continue;
            }
            save_journal(&store, &journal);
            for movement in journal.moves.iter().take(completed) {
                store.move_folder(movement, false).unwrap();
                journal.completed += 1;
                write_json(&store.records, "journal.json", &journal).unwrap();
            }
            drop(store);
            let store = fixture.store();
            assert_eq!(store.load().unwrap(), plan.before);
            store.check_owned(&plan.before).unwrap();
            for backup in &plan.before.backups {
                matches(
                    &store
                        .area(&Area::Vault(backup.token.clone()), false)
                        .unwrap(),
                    &backup.group.folders,
                    &backup.group.files,
                )
                .unwrap();
            }
            if action == "install" {
                assert!(!fixture.live("Main").exists());
                assert!(!fixture.live("Library").exists());
            }
            fixture.untouched();
        }
    }
}
