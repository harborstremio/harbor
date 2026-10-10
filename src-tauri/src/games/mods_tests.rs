use super::mod_files::FileMove;
use super::*;
use std::fs;
fn fixture() -> PathBuf {
    let path = PathBuf::from(std::env::var("HARBOR_GAME_TEST_ROOT").expect("fixture root"))
        .join(uuid::Uuid::new_v4().to_string());
    fs::create_dir_all(&path).unwrap();
    path
}
fn package(project: &str, name: &str, bytes: &[u8]) -> Package {
    Package {
        project: project.into(),
        version: format!("v{project}"),
        name: name.into(),
        number: "1.0".into(),
        filename: format!("{name}.jar"),
        url: format!("https://cdn.modrinth.com/data/{project}/versions/v{project}/{name}.jar"),
        bytes: bytes.len() as u64,
        sha512: format!("{:x}", Sha512::digest(bytes)),
        dependencies: vec![],
        enabled: true,
    }
}
fn install_fixture(
    root: &std::path::Path,
    before: Workspace,
    p: Package,
    bytes: &[u8],
) -> Workspace {
    let mut after = before.clone();
    after.packages.push(p.clone());
    let stage = mod_files::internal("part");
    fs::write(root.join(&stage), bytes).unwrap();
    mod_files::transact(
        root,
        before,
        after,
        vec![FileMove {
            from: stage,
            to: p.filename,
            bytes: p.bytes,
            hash: p.sha512,
            discard: false,
        }],
    )
    .unwrap()
}
#[test]
fn metadata_rejects_paths_foreign_hosts_and_wrong_environment() {
    for name in [
        "../x.jar",
        "x:y.jar",
        "CON.jar",
        "a\\x.jar",
        ".hidden.jar",
        "x.zip",
    ] {
        assert!(!modrinth::filename(name));
    }
    assert!(modrinth::filename("Sodium-0.8.13+1.21.1.jar"));
    let mut p = package("p", "good", b"mod");
    assert!(modrinth::valid_package(&p));
    p.url = "https://evil.example/mod.jar".into();
    assert!(!modrinth::valid_package(&p));
    assert!(
        modrinth::route("search", "sodium", "fabric", "1.21.1", 0, "downloads")
            .unwrap()
            .as_str()
            .contains("facets=")
    );
    assert!(modrinth::route("project", "../user", "", "", 0, "").is_err());
    assert!(modrinth::environment("vanilla", "1.21.1").is_err());
}
#[test]
fn profile_binding_and_install_disable_enable_remove_preserve_unmanaged() {
    let root = fixture();
    fs::write(root.join("unmanaged.jar"), b"leave alone").unwrap();
    let before = mod_files::connect("alpha", root.to_str().unwrap(), "fabric", "1.21.1").unwrap();
    assert!(mod_files::load("beta", &root).is_err());
    let p = package("p", "example", b"mod payload");
    install_fixture(&root, before, p.clone(), b"mod payload");
    let disabled = mod_files::action("alpha", root.to_str().unwrap(), "p", "disable").unwrap();
    assert!(!disabled.packages[0].enabled);
    assert!(!root.join(&p.filename).exists());
    assert!(root
        .join(format!("{}.harbor-disabled", p.filename))
        .exists());
    mod_files::action("alpha", root.to_str().unwrap(), "p", "enable").unwrap();
    assert_eq!(fs::read(root.join(&p.filename)).unwrap(), b"mod payload");
    let removed = mod_files::action("alpha", root.to_str().unwrap(), "p", "remove").unwrap();
    assert!(removed.packages.is_empty());
    assert!(!root.join(&p.filename).exists());
    assert_eq!(
        fs::read(root.join("unmanaged.jar")).unwrap(),
        b"leave alone"
    );
}
#[test]
fn changed_files_and_existing_destinations_are_never_overwritten() {
    let root = fixture();
    let before = mod_files::connect("alpha", root.to_str().unwrap(), "fabric", "1.21.1").unwrap();
    let p = package("p", "example", b"mod payload");
    install_fixture(&root, before, p.clone(), b"mod payload");
    fs::write(root.join(&p.filename), b"user edit").unwrap();
    assert_eq!(
        mod_files::action("alpha", root.to_str().unwrap(), "p", "remove").unwrap_err(),
        "mods_changed"
    );
    assert_eq!(fs::read(root.join(&p.filename)).unwrap(), b"user edit");
    fs::write(root.join(&p.filename), b"mod payload").unwrap();
    fs::write(
        root.join(format!("{}.harbor-disabled", p.filename)),
        b"unrelated",
    )
    .unwrap();
    assert_eq!(
        mod_files::action("alpha", root.to_str().unwrap(), "p", "disable").unwrap_err(),
        "mods_exists"
    );
    assert!(root.join(&p.filename).exists());
}
#[test]
fn required_and_incompatible_dependencies_are_enforced_for_actions() {
    let root = fixture();
    let before = mod_files::connect("alpha", root.to_str().unwrap(), "fabric", "1.21.1").unwrap();
    let dependency = package("base", "base", b"base");
    let before = install_fixture(&root, before, dependency, b"base");
    let mut consumer = package("consumer", "consumer", b"consumer");
    consumer.dependencies.push(modrinth::Dependency {
        project_id: Some("base".into()),
        version_id: None,
        dependency_type: "required".into(),
    });
    install_fixture(&root, before, consumer, b"consumer");
    assert_eq!(
        mod_files::action("alpha", root.to_str().unwrap(), "base", "disable").unwrap_err(),
        "mods_required"
    );
    mod_files::action("alpha", root.to_str().unwrap(), "consumer", "disable").unwrap();
    mod_files::action("alpha", root.to_str().unwrap(), "base", "disable").unwrap();
    assert_eq!(
        mod_files::action("alpha", root.to_str().unwrap(), "consumer", "enable").unwrap_err(),
        "mods_dependency"
    );
    let mut a = package("a", "a", b"a");
    a.dependencies.push(modrinth::Dependency {
        project_id: Some("b".into()),
        version_id: None,
        dependency_type: "incompatible".into(),
    });
    assert_eq!(
        mod_files::compatible(&[a, package("b", "b", b"b")]).unwrap_err(),
        "mods_incompatible"
    );
}
#[test]
fn interrupted_install_rolls_back_only_matching_new_files() {
    let root = fixture();
    let before = mod_files::connect("alpha", root.to_str().unwrap(), "fabric", "1.21.1").unwrap();
    let p = package("p", "example", b"payload");
    let mut after = before.clone();
    after.revision = uuid::Uuid::new_v4().to_string();
    after.packages.push(p.clone());
    let stage = mod_files::internal("part");
    fs::write(root.join(&p.filename), b"payload").unwrap();
    fs::write(root.join(".harbor-mods-transaction.json"),serde_json::to_vec(&serde_json::json!({"before":before,"after":after,"moves":[{"from":stage,"to":p.filename,"bytes":p.bytes,"hash":p.sha512,"discard":false}]})).unwrap()).unwrap();
    let recovered = mod_files::load("alpha", &root).unwrap();
    assert!(recovered.packages.is_empty());
    assert!(!root.join(&p.filename).exists());
    assert!(!root.join(&stage).exists());
    assert!(!root.join(".harbor-mods-transaction.json").exists());
}
#[test]
fn completed_transaction_survives_cleanup_interruption_and_tamper_blocks_recovery() {
    let root = fixture();
    let before = mod_files::connect("alpha", root.to_str().unwrap(), "fabric", "1.21.1").unwrap();
    let p = package("p", "example", b"payload");
    let mut after = before.clone();
    after.revision = uuid::Uuid::new_v4().to_string();
    after.packages.push(p.clone());
    let stage = mod_files::internal("part");
    fs::write(root.join(&p.filename), b"payload").unwrap();
    fs::write(
        root.join(mod_files::MANIFEST),
        serde_json::to_vec(&after).unwrap(),
    )
    .unwrap();
    let journal = serde_json::json!({"before":before,"after":after,"moves":[{"from":stage,"to":p.filename,"bytes":p.bytes,"hash":p.sha512,"discard":false}]});
    fs::write(
        root.join(".harbor-mods-transaction.json"),
        serde_json::to_vec(&journal).unwrap(),
    )
    .unwrap();
    assert_eq!(mod_files::load("alpha", &root).unwrap().packages.len(), 1);
    assert!(root.join(&p.filename).exists());
    fs::write(
        root.join(mod_files::MANIFEST),
        serde_json::to_vec(&before).unwrap(),
    )
    .unwrap();
    fs::write(
        root.join(".harbor-mods-transaction.json"),
        serde_json::to_vec(&journal).unwrap(),
    )
    .unwrap();
    fs::write(root.join(&p.filename), b"changed").unwrap();
    assert!(mod_files::load("alpha", &root).is_err());
    assert_eq!(fs::read(root.join(&p.filename)).unwrap(), b"changed");
}

fn changed_package(old: &Package, bytes: &[u8], same_name: bool) -> Package {
    let mut next = package(
        &old.project,
        if same_name { "example" } else { "example-new" },
        bytes,
    );
    next.version = "version2".into();
    next.number = "2.0".into();
    next.url = format!(
        "https://cdn.modrinth.com/data/{}/versions/{}/{}",
        next.project, next.version, next.filename
    );
    next.enabled = old.enabled;
    next
}
#[test]
fn updates_keep_one_local_version_and_rollback_survives_restart() {
    for enabled in [true, false] {
        let root = fixture();
        let before =
            mod_files::connect("alpha", root.to_str().unwrap(), "fabric", "1.21.1").unwrap();
        let old = package("p", "example", b"first version");
        install_fixture(&root, before, old.clone(), b"first version");
        let before = if enabled {
            mod_files::load("alpha", &root).unwrap()
        } else {
            mod_files::action("alpha", root.to_str().unwrap(), "p", "disable").unwrap()
        };
        let next = changed_package(&before.packages[0], b"second version", true);
        let stage = mod_files::internal("part");
        fs::write(root.join(&stage), b"second version").unwrap();
        let (after, moves) = mod_files::replacement(&before, &[next.clone()], &[stage]).unwrap();
        mod_files::transact(&root, before, after, moves).unwrap();
        let current = mod_files::load("alpha", &root).unwrap();
        assert_eq!(current.packages[0].enabled, enabled);
        assert_eq!(
            fs::read(root.join(mod_files::current_name(&current.packages[0]))).unwrap(),
            b"second version"
        );
        assert_eq!(
            fs::read(root.join(&current.backups[0].file)).unwrap(),
            b"first version"
        );
        let (after, moves, _, _) = mod_files::rollback(&current, "p").unwrap();
        mod_files::transact(&root, current, after, moves).unwrap();
        let restored = mod_files::load("alpha", &root).unwrap();
        assert_eq!(restored.packages[0].version, old.version);
        assert_eq!(restored.packages[0].enabled, enabled);
        assert_eq!(
            fs::read(root.join(mod_files::current_name(&restored.packages[0]))).unwrap(),
            b"first version"
        );
        assert_eq!(
            fs::read(root.join(&restored.backups[0].file)).unwrap(),
            b"second version"
        );
        mod_files::action("alpha", root.to_str().unwrap(), "p", "remove").unwrap();
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
    }
}
#[test]
fn interrupted_replacements_restore_old_files_at_every_move_boundary() {
    for same_name in [true, false] {
        for cut in 0..=2 {
            for progress_written in [true, false] {
                let root = fixture();
                let initial =
                    mod_files::connect("alpha", root.to_str().unwrap(), "fabric", "1.21.1")
                        .unwrap();
                let old = package("p", "example", b"old");
                let before = install_fixture(&root, initial, old.clone(), b"old");
                let next = changed_package(&old, b"new", same_name);
                let stage = mod_files::internal("part");
                fs::write(root.join(&stage), b"new").unwrap();
                let (mut after, moves) =
                    mod_files::replacement(&before, &[next], &[stage.clone()]).unwrap();
                after.revision = uuid::Uuid::new_v4().to_string();
                for m in moves.iter().take(cut) {
                    fs::rename(root.join(&m.from), root.join(&m.to)).unwrap();
                }
                let completed = if progress_written {
                    cut
                } else {
                    cut.saturating_sub(1)
                };
                fs::write(root.join(".harbor-mods-transaction.json"), serde_json::to_vec(&serde_json::json!({"before":before,"after":after,"moves":moves,"completed":completed})).unwrap()).unwrap();
                let recovered = mod_files::load("alpha", &root).unwrap();
                assert_eq!(recovered.packages[0].version, old.version);
                assert_eq!(fs::read(root.join(&old.filename)).unwrap(), b"old");
                assert_eq!(fs::read_dir(&root).unwrap().count(), 2);
            }
        }
    }
}
#[test]
fn recovery_can_restart_after_undo_and_stage_cleanup() {
    for cleanup_done in [true, false] {
        let root = fixture();
        let initial =
            mod_files::connect("alpha", root.to_str().unwrap(), "fabric", "1.21.1").unwrap();
        let old = package("p", "example", b"old");
        let before = install_fixture(&root, initial, old.clone(), b"old");
        let next = changed_package(&old, b"new", true);
        let stage = mod_files::internal("part");
        fs::write(root.join(&stage), b"new").unwrap();
        let (mut after, moves) =
            mod_files::replacement(&before, &[next], &[stage.clone()]).unwrap();
        after.revision = uuid::Uuid::new_v4().to_string();
        if cleanup_done {
            fs::remove_file(root.join(&stage)).unwrap();
        } else {
            fs::rename(root.join(&moves[0].from), root.join(&moves[0].to)).unwrap();
        }
        // Either rollback finished cleanup, or the last move was undone before its progress write.
        fs::write(root.join(".harbor-mods-transaction.json"), serde_json::to_vec(&serde_json::json!({"before":before,"after":after,"moves":moves,"completed":if cleanup_done {0} else {2},"rolling_back":true})).unwrap()).unwrap();
        mod_files::load("alpha", &root).unwrap();
        assert_eq!(fs::read(root.join(&old.filename)).unwrap(), b"old");
        assert_eq!(fs::read_dir(&root).unwrap().count(), 2);
    }
}
#[test]
fn replacing_again_prunes_only_the_obsolete_backup_and_blocks_changed_files() {
    let root = fixture();
    let initial = mod_files::connect("alpha", root.to_str().unwrap(), "fabric", "1.21.1").unwrap();
    let old = package("p", "example", b"old");
    let mut before = install_fixture(&root, initial, old.clone(), b"old");
    for bytes in [b"new".as_slice(), b"third".as_slice()] {
        let next = changed_package(&old, bytes, true);
        let stage = mod_files::internal("part");
        fs::write(root.join(&stage), bytes).unwrap();
        let (after, moves) = mod_files::replacement(&before, &[next], &[stage]).unwrap();
        before = mod_files::transact(&root, before, after, moves).unwrap();
    }
    assert_eq!(before.backups.len(), 1);
    assert_eq!(
        fs::read(root.join(&before.backups[0].file)).unwrap(),
        b"new"
    );
    assert_eq!(fs::read_dir(&root).unwrap().count(), 3);
    fs::write(root.join(&before.backups[0].file), b"edited backup").unwrap();
    let (after, moves, _, _) = mod_files::rollback(&before, "p").unwrap();
    assert_eq!(
        mod_files::transact(&root, before, after, moves).unwrap_err(),
        "mods_changed"
    );
    assert_eq!(fs::read(root.join(&old.filename)).unwrap(), b"third");
}
#[test]
fn replacement_respects_other_mods_exact_version_dependencies() {
    let root = fixture();
    let mut before =
        mod_files::connect("alpha", root.to_str().unwrap(), "fabric", "1.21.1").unwrap();
    let old = package("p", "example", b"old");
    let mut consumer = package("consumer", "consumer", b"consumer");
    consumer.dependencies.push(modrinth::Dependency {
        project_id: Some(old.project.clone()),
        version_id: Some(old.version.clone()),
        dependency_type: "required".into(),
    });
    before.packages = vec![old.clone(), consumer];
    let next = changed_package(&old, b"new", true);
    assert!(matches!(
        mod_files::replacement(&before, &[next], &[mod_files::internal("part")]),
        Err("mods_dependency")
    ));
}

#[tokio::test]
#[ignore = "downloads two real public releases into HARBOR_GAME_TEST_ROOT; never executes a JAR"]
async fn live_modrinth_update_and_local_restore() {
    let root = fixture();
    let path = root.to_str().unwrap().to_string();
    fs::write(root.join("unmanaged.txt"), b"keep this file").unwrap();
    workspace(
        "live-check".into(),
        path.clone(),
        Some("fabric".into()),
        Some("1.21.1".into()),
    )
    .await
    .unwrap();
    let client = modrinth::client().unwrap();
    let releases = modrinth::json(
        &client,
        modrinth::route("versions", "AANobbMI", "fabric", "1.21.1", 0, "").unwrap(),
    )
    .await
    .unwrap();
    let mut stable = releases
        .as_array()
        .unwrap()
        .iter()
        .filter(|v| v["version_type"] == "release")
        .collect::<Vec<_>>();
    stable.sort_by(|a, b| {
        b["date_published"]
            .as_str()
            .cmp(&a["date_published"].as_str())
    });
    assert!(stable.len() >= 2);
    let newer = stable[0]["id"].as_str().unwrap();
    let older = stable[1]["id"].as_str().unwrap();
    let initial = review(
        "live-check".into(),
        path.clone(),
        older.into(),
        uuid::Uuid::new_v4().to_string(),
    )
    .await
    .unwrap();
    let first = install(
        "live-check".into(),
        initial.token,
        uuid::Uuid::new_v4().to_string(),
        |_| {},
    )
    .await
    .unwrap();
    let current = first
        .packages
        .iter()
        .find(|p| p.project == "AANobbMI")
        .unwrap();
    let original = fs::read(root.join(&current.filename)).unwrap();
    let plan = review(
        "live-check".into(),
        path.clone(),
        newer.into(),
        uuid::Uuid::new_v4().to_string(),
    )
    .await
    .unwrap();
    assert_eq!(
        plan.replaced
            .iter()
            .find(|p| p.project == "AANobbMI")
            .unwrap()
            .version,
        older
    );
    assert_eq!(fs::read(root.join(&current.filename)).unwrap(), original);
    let updated = install(
        "live-check".into(),
        plan.token,
        uuid::Uuid::new_v4().to_string(),
        |_| {},
    )
    .await
    .unwrap();
    let new = updated
        .packages
        .iter()
        .find(|p| p.project == "AANobbMI")
        .unwrap();
    assert_eq!(new.version, newer);
    mod_files::matches(&root, new).unwrap();
    assert_eq!(
        fs::read(
            root.join(
                &updated
                    .backups
                    .iter()
                    .find(|b| b.package.project == "AANobbMI")
                    .unwrap()
                    .file
            )
        )
        .unwrap(),
        original
    );
    assert_eq!(
        action(
            "live-check".into(),
            path.clone(),
            "AANobbMI".into(),
            "rollback".into(),
            Some(first.revision)
        )
        .await
        .unwrap_err(),
        "mods_changed"
    );
    let restored = action(
        "live-check".into(),
        path.clone(),
        "AANobbMI".into(),
        "rollback".into(),
        Some(updated.revision),
    )
    .await
    .unwrap();
    let old = restored
        .packages
        .iter()
        .find(|p| p.project == "AANobbMI")
        .unwrap();
    assert_eq!(old.version, older);
    assert_eq!(fs::read(root.join(&old.filename)).unwrap(), original);
    assert_eq!(
        fs::read(root.join("unmanaged.txt")).unwrap(),
        b"keep this file"
    );
    let installed_jar_count = fs::read_dir(&root)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|v| v == "jar"))
        .count();
    assert_eq!(installed_jar_count, restored.packages.len());
    println!(
        "Native live update/rollback passed: {older} -> {newer} -> {older}; fixture {}",
        root.display()
    );
}
