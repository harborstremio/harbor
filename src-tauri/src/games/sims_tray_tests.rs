use super::*;
#[test]
fn creator_archive_uses_tray_destinations_and_preserves_origin_through_remove_restore() {
    let f = Fixture::new();
    let Ok(fixture) = std::env::var("HARBOR_TEST_MTS_HOUSEHOLD") else {
        return;
    };
    let bytes = fs::read(fixture).unwrap();
    assert!(tray::format::contains_tray(&bytes, &|| Ok(())).unwrap());
    let source = CreatorSource {
        provider: "mts".into(),
        project: Some("658404".into()),
        required_core: None,
        version: "2034441.1626508707".into(),
        game_patch: String::new(),
        archive_hash: files::stamp("archive.zip".into(), &bytes).hash,
    };
    let imported = tray::format::unpack_zip_checked(bytes, &|| Ok(())).unwrap();
    let mut plan =
        tray::plan_import_checked(f.path(), "Family Echron".into(), imported, &|| Ok(())).unwrap();
    assert!(plan
        .reviewed_files()
        .iter()
        .all(|file| file.name.starts_with("Tray/")));
    plan.tray.as_mut().unwrap().item.source = Some(source.clone());
    plan.source = Some(source.clone());
    assert!(!f.0.join("Tray").exists());
    Store::connect(f.path()).unwrap().apply(plan).unwrap();
    let item = tray::view(f.path()).unwrap().items.remove(0);
    assert_eq!(item.source, Some(source.clone()));
    assert_eq!(item.category, "household");
    run(
        &f,
        Action::TrayRemove {
            id: item.id.clone(),
        },
    );
    assert_eq!(
        tray::view(f.path()).unwrap().items[0].source,
        Some(source.clone())
    );
    run(&f, Action::TrayRestore { id: item.id });
    assert_eq!(tray::view(f.path()).unwrap().items[0].source, Some(source));
    assert!(snapshot(f.path()).unwrap().0.groups.is_empty());
}
#[test]
fn downloaded_creation_validation_keeps_cancel_and_legacy_records() {
    let (f, paths) = prepared();
    let plan = import(&f, paths.clone());
    let mut old = serde_json::to_value(&plan.tray.as_ref().unwrap().item).unwrap();
    old.as_object_mut().unwrap().remove("source");
    let item: tray::Item = serde_json::from_value(old).unwrap();
    assert!(item.source.is_none());
    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    for path in paths {
        let path = std::path::Path::new(&path);
        zip.start_file(
            path.file_name().unwrap().to_str().unwrap(),
            zip::write::SimpleFileOptions::default(),
        )
        .unwrap();
        zip.write_all(&fs::read(path).unwrap()).unwrap();
    }
    let bytes = zip.finish().unwrap().into_inner();
    assert!(tray::format::contains_tray(&bytes, &|| Err("sims_canceled")).is_err());
    assert!(tray::format::unpack_zip_checked(bytes.clone(), &|| Err("sims_canceled")).is_err());
    let imported = tray::format::unpack_zip_checked(bytes, &|| Ok(())).unwrap();
    let new =
        tray::plan_import_checked(f.path(), "Creator house".into(), imported, &|| Ok(())).unwrap();
    assert_eq!(new.reviewed_files()[..3], plan.reviewed_files()[..3]);
    assert!(new.reviewed_files()[3].name.starts_with("Mods/Harbor-"));
    assert_eq!(new.reviewed_files()[3].hash, plan.reviewed_files()[3].hash);
}
fn prepared() -> (Fixture, Vec<String>) {
    let f = Fixture::new();
    let source = f.0.join("download");
    fs::create_dir(&source).unwrap();
    let mut paths = vec![];
    for (i, ext) in ["trayitem", "blueprint", "bpi"].iter().enumerate() {
        let name = format!("0x{i:08x}!0x123456789abcdef0.{ext}");
        let path = source.join(name);
        fs::write(&path, [0u8; 32]).unwrap();
        paths.push(path.to_string_lossy().into_owned());
    }
    let cc = source.join("furniture.package");
    fs::write(&cc, dbpf(3)).unwrap();
    paths.push(cc.to_string_lossy().into_owned());
    (f, paths)
}
fn import(f: &Fixture, paths: Vec<String>) -> Plan {
    tray::plan(
        f.path(),
        Action::TrayImport {
            title: "My house".into(),
        },
        paths,
    )
    .unwrap()
}
fn run(f: &Fixture, action: Action) {
    let p = tray::plan(f.path(), action, vec![]).unwrap();
    Store::connect(f.path()).unwrap().apply(p).unwrap();
}
#[test]
fn tray_review_import_remove_restore_preserve_bundled_cc_and_unrelated_library_files() {
    let (f, paths) = prepared();
    let p = import(&f, paths.clone());
    assert_eq!(p.reviewed_files().len(), 4);
    assert!(p
        .reviewed_files()
        .iter()
        .all(|s| s.name.starts_with("Tray/") || s.name.starts_with("Mods/Harbor-")));
    assert!(!f.0.join(STORE).exists());
    assert!(!f.0.join("Tray").exists());
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    let cc = state.groups[0].clone();
    let item = tray::view(f.path()).unwrap().items.remove(0);
    assert!(item.installed);
    assert_eq!(item.category, "lot");
    assert_eq!(files::tree(&f.0.join("Tray")).unwrap(), item.files);
    assert_eq!(
        files::tree(&f.0.join(format!("Mods/Harbor-{}", cc.id))).unwrap(),
        cc.files
    );
    let other = f.0.join("Tray/unrelated.trayitem");
    fs::write(&other, b"leave this alone").unwrap();
    run(
        &f,
        Action::TrayRemove {
            id: item.id.clone(),
        },
    );
    assert!(!tray::view(f.path()).unwrap().items[0].installed);
    assert_eq!(fs::read(&other).unwrap(), b"leave this alone");
    assert_eq!(snapshot(f.path()).unwrap().0.groups, vec![cc.clone()]);
    run(&f, Action::TrayRestore { id: item.id });
    assert!(tray::view(f.path()).unwrap().items[0].installed);
    assert!(paths.iter().all(|p| Path::new(p).is_file()));
    assert!(!snapshot(f.path()).unwrap().1);
    assert_eq!(snapshot(f.path()).unwrap().0.groups, vec![cc]);
}
#[test]
fn tray_rejects_incomplete_sets_duplicate_destinations_and_external_edits() {
    let (f, paths) = prepared();
    assert_eq!(
        tray::plan(
            f.path(),
            Action::TrayImport {
                title: "partial".into()
            },
            paths[..2].into()
        )
        .err()
        .unwrap(),
        "sims_tray_set"
    );
    let p = import(&f, paths.clone());
    fs::create_dir(f.0.join("Tray")).unwrap();
    let file = p.tray.as_ref().unwrap().item.files[0].name.clone();
    fs::write(
        f.0.join("Tray").join(file.to_ascii_uppercase()),
        b"pre-existing",
    )
    .unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).err().unwrap(),
        "sims_tray_exists"
    );
    fs::remove_file(f.0.join("Tray").join(file.to_ascii_uppercase())).unwrap();
    Store::connect(f.path())
        .unwrap()
        .apply(import(&f, paths.clone()))
        .unwrap();
    let item = tray::view(f.path()).unwrap().items.remove(0);
    assert_eq!(
        tray::plan(
            f.path(),
            Action::TrayImport {
                title: "duplicate".into()
            },
            paths
        )
        .err()
        .unwrap(),
        "sims_tray_exists"
    );
    let p = tray::plan(
        f.path(),
        Action::TrayRemove {
            id: item.id.clone(),
        },
        vec![],
    )
    .unwrap();
    fs::write(f.0.join("Tray").join(&file), b"edited by another tool").unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).err().unwrap(),
        "sims_changed"
    );
    assert!(tray::view(f.path()).unwrap().items[0].installed);
    assert_eq!(
        fs::read(f.0.join("Tray").join(&file)).unwrap(),
        b"edited by another tool"
    );
}
#[test]
fn tray_creator_zip_groups_all_seven_real_lot_files() {
    let Ok(archive) = std::env::var("HARBOR_SIMS_TRAY_ARCHIVE") else {
        return;
    };
    let f = Fixture::new();
    let p = tray::plan(
        f.path(),
        Action::TrayImport {
            title: "Base Game Starter".into(),
        },
        vec![archive],
    )
    .unwrap();
    assert_eq!(p.payload.len(), 7);
    let item = p.tray.as_ref().unwrap().item.clone();
    assert_eq!(item.category, "lot");
    assert!(item.cc_group.is_none());
    Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert_eq!(files::tree(&f.0.join("Tray")).unwrap(), item.files);
    run(
        &f,
        Action::TrayRemove {
            id: item.id.clone(),
        },
    );
    run(&f, Action::TrayRestore { id: item.id });
}
#[test]
fn tray_set_identification_keeps_rooms_households_and_export_ids_distinct() {
    let names = |exts: &[&str]| {
        exts.iter()
            .enumerate()
            .map(|(i, e)| format!("0x{i:08x}!0x123456789abcdef0.{e}"))
            .collect::<Vec<_>>()
    };
    assert_eq!(
        tray::format::category(&names(&["trayitem", "room", "rmi"])).unwrap(),
        "room"
    );
    assert_eq!(
        tray::format::category(&names(&[
            "trayitem",
            "householdbinary",
            "hhi",
            "hhi",
            "sgi",
            "sgi"
        ]))
        .unwrap(),
        "household"
    );
    assert!(
        tray::format::category(&names(&["trayitem", "householdbinary", "hhi", "sgi"])).is_err()
    );
    let mut mixed = names(&["trayitem", "blueprint", "bpi"]);
    mixed[2] = mixed[2].replace("123456789abcdef0", "9999999999999999");
    assert!(tray::format::category(&mixed).is_err());
    assert!(tray::format::identity("../0x00000000!0x123456789abcdef0.trayitem").is_err());
}
#[test]
#[ignore = "Owned worker for Tray publication/recovery boundaries"]
fn interruption_worker() {
    let root = std::env::var("HARBOR_TRAY_ROOT").unwrap();
    let action = std::env::var("HARBOR_TRAY_ACTION").unwrap();
    if action == "recover" {
        Store::connect(&root).unwrap().recover().unwrap();
    } else {
        let action: Action = serde_json::from_str(&action).unwrap();
        let sources = if matches!(action, Action::TrayImport { .. }) {
            fs::read_dir(Path::new(&root).join("download"))
                .unwrap()
                .map(|e| e.unwrap().path().to_string_lossy().into_owned())
                .collect()
        } else {
            vec![]
        };
        let p = tray::plan(&root, action, sources).unwrap();
        Store::connect(&root).unwrap().apply(p).unwrap();
    }
    panic!("Interruption marker not reached");
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
        .env("HARBOR_TRAY_ROOT", f.path())
        .env("HARBOR_TRAY_ACTION", action)
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
fn killed_tray_import_removal_restore_and_rollback_recover_exact_library_and_cc_states() {
    for mode in ["import", "remove", "restore"] {
        for phase in [
            "trayJournal",
            "trayMove1",
            "trayCc",
            "trayModsState",
            "trayState",
        ] {
            let (f, paths) = prepared();
            let action = if mode == "import" {
                Action::TrayImport {
                    title: "My house".into(),
                }
            } else {
                Store::connect(f.path())
                    .unwrap()
                    .apply(import(&f, paths))
                    .unwrap();
                let id = tray::view(f.path()).unwrap().items[0].id.clone();
                if mode == "restore" {
                    run(&f, Action::TrayRemove { id: id.clone() });
                    Action::TrayRestore { id }
                } else {
                    Action::TrayRemove { id }
                }
            };
            let before = snapshot(f.path()).unwrap().0;
            let items = tray::view(f.path()).unwrap().items;
            interrupt(&f, phase, &serde_json::to_string(&action).unwrap());
            assert!(snapshot(f.path()).unwrap().1);
            if phase == "trayState" {
                interrupt(&f, "trayRollback1", "recover");
                interrupt(&f, "trayRollbackState", "recover");
            }
            Store::connect(f.path()).unwrap().recover().unwrap();
            assert_eq!(snapshot(f.path()).unwrap().0, before);
            assert_eq!(tray::view(f.path()).unwrap().items, items);
            assert!(!snapshot(f.path()).unwrap().1);
            for item in items {
                let dir = if item.installed {
                    f.0.join("Tray")
                } else {
                    f.0.join(STORE).join("tray-vault").join(&item.id)
                };
                assert_eq!(files::tree(&dir).unwrap(), item.files);
            }
            if mode == "import" {
                assert!(files::tree(&f.0.join("Tray")).unwrap().is_empty());
                assert!(fs::read_dir(f.0.join("Mods")).unwrap().next().is_none());
            }
        }
    }
}

#[test]
fn tray_archives_reject_path_escapes_flattened_collisions_and_executable_payloads() {
    let (f, paths) = prepared();
    let valid: Vec<_> = paths
        .iter()
        .map(|path| {
            let path = Path::new(path);
            (
                format!("export/{}", path.file_name().unwrap().to_str().unwrap()),
                fs::read(path).unwrap(),
            )
        })
        .collect();
    let mut executable = vec![0u8; 32];
    executable[..2].copy_from_slice(b"MZ");
    for (name, bytes) in [
        ("../outside.package".into(), dbpf(1)),
        ("C:/outside.package".into(), dbpf(1)),
        ("second/FURNITURE.package".into(), dbpf(1)),
        ("setup.exe".into(), executable.clone()),
        ("0x00000009!0x123456789abcdef0.bpi".into(), executable),
    ] {
        let mut entries = valid.clone();
        entries.push((name, bytes));
        let refs: Vec<_> = entries
            .iter()
            .map(|(name, bytes)| (name.as_str(), bytes.clone()))
            .collect();
        let zip = f.0.join("download/bad.zip");
        fs::write(&zip, archive(&refs)).unwrap();
        assert!(tray::plan(
            f.path(),
            Action::TrayImport {
                title: "Invalid export".into()
            },
            vec![zip.to_string_lossy().into_owned()]
        )
        .is_err());
        assert!(!f.0.join("Tray").exists());
        assert!(!f.0.join(STORE).exists());
    }
}

#[test]
fn tray_recovery_preserves_later_edits_and_rejects_ambiguous_or_forged_journals() {
    for mode in ["external-file", "two-journals", "forged-action"] {
        let (f, _) = prepared();
        let before = snapshot(f.path()).unwrap().0;
        interrupt(
            &f,
            "trayState",
            &serde_json::to_string(&Action::TrayImport {
                title: "My house".into(),
            })
            .unwrap(),
        );
        let journal = f.0.join(STORE).join("tray-journal.json");
        let original = fs::read(&journal).unwrap();
        let item = tray::view(f.path()).unwrap().items.remove(0);
        let target = f.0.join("Tray").join(&item.files[0].name);
        let tray_original = fs::read(&target).unwrap();
        let normal = f.0.join(STORE).join("journal.json");
        match mode {
            "external-file" => fs::write(&target, b"later game or creator edit").unwrap(),
            "two-journals" => fs::write(&normal, b"ambiguous local record").unwrap(),
            _ => {
                let mut forged: serde_json::Value = serde_json::from_slice(&original).unwrap();
                forged["action"]["kind"] = "trayRemove".into();
                forged["action"]["id"] = item.id.clone().into();
                fs::write(&journal, serde_json::to_vec(&forged).unwrap()).unwrap();
            }
        }
        let files_before = files::tree(&f.0.join("Tray")).unwrap();
        let mods_before = snapshot(f.path()).unwrap().0;
        assert!(Store::connect(f.path()).unwrap().recover().is_err());
        assert_eq!(files::tree(&f.0.join("Tray")).unwrap(), files_before);
        assert_eq!(snapshot(f.path()).unwrap().0, mods_before);
        assert_eq!(tray::view(f.path()).unwrap().items, vec![item]);
        assert!(journal.is_file());
        fs::write(&target, tray_original).unwrap();
        fs::write(&journal, original).unwrap();
        if normal.exists() {
            fs::remove_file(normal).unwrap();
        }
        Store::connect(f.path()).unwrap().recover().unwrap();
        assert_eq!(snapshot(f.path()).unwrap().0, before);
        assert!(tray::view(f.path()).unwrap().items.is_empty());
    }
}
