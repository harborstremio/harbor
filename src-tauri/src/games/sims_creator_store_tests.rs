use super::super::super::sims_catalog;
use super::*;
fn source(v: &str) -> CreatorSource {
    CreatorSource {
        provider: "mccc".into(),
        project: None,
        required_core: None,
        version: v.into(),
        game_patch: "1.120.123.1020".into(),
        archive_hash: "a".repeat(64),
    }
}
#[test]
fn creator_identity_follows_version_recovery_and_clears_on_unattributed_file_updates() {
    let f = Fixture::new();
    let mut incoming = plan(
        f.path(),
        Action::Install {
            title: "MC Command Center".into(),
        },
        payload(1),
        vec![],
    )
    .unwrap();
    incoming.source = Some(source("2026.4.0"));
    let state = Store::connect(f.path()).unwrap().apply(incoming).unwrap();
    let id = state.groups[0].id.clone();
    assert_eq!(state.groups[0].source, Some(source("2026.4.0")));
    let mut update = plan(
        f.path(),
        Action::Update { id: id.clone() },
        payload(2),
        vec![],
    )
    .unwrap();
    update.source = Some(source("2026.5.0"));
    let state = Store::connect(f.path()).unwrap().apply(update).unwrap();
    assert_eq!(state.groups[0].source, Some(source("2026.5.0")));
    assert_eq!(state.backups[0].group.source, Some(source("2026.4.0")));
    let restore = plan(
        f.path(),
        Action::Restore {
            backup: state.backups[0].id.clone(),
        },
        vec![],
        vec![],
    )
    .unwrap();
    let state = Store::connect(f.path()).unwrap().apply(restore).unwrap();
    assert_eq!(state.groups[0].source, Some(source("2026.4.0")));
    let local = plan(f.path(), Action::Update { id }, payload(3), vec![]).unwrap();
    let state = Store::connect(f.path()).unwrap().apply(local).unwrap();
    assert_eq!(state.groups[0].source, None);
    assert_eq!(snapshot(f.path()).unwrap().0, state);
}

fn mccc(v: u8) -> Vec<Payload> {
    vec![
        Payload {
            name: "mc_cmd_center.package".into(),
            bytes: dbpf(v),
        },
        Payload {
            name: "mc_cmd_center.ts4script".into(),
            bytes: archive(&[(
                "mc_cmd_center.py",
                b"# test fixture, never executed".to_vec(),
            )]),
        },
    ]
}
#[test]
fn manual_creator_group_is_updated_only_after_explicit_selection_and_restores_unattributed_origin()
{
    let f = Fixture::new();
    let p = plan(
        f.path(),
        Action::Install {
            title: "My existing MCCC".into(),
        },
        mccc(1),
        vec![],
    )
    .unwrap();
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    let group = &state.groups[0];
    let live = f.0.join("Mods").join(format!("Harbor-{}", group.id));
    fs::write(live.join("mc_settings.cfg"), "keep preferences").unwrap();
    let folder = files::inventory(f.path()).unwrap();
    assert_eq!(
        sims_catalog::action(&state, &folder, None).unwrap_err(),
        "sims_creator_existing"
    );
    let selected = sims_catalog::action(&state, &folder, Some(&group.id)).unwrap();
    let mut update = plan(f.path(), selected, mccc(2), vec![]).unwrap();
    sims_catalog::validate_link(&update).unwrap();
    assert!(state.groups[0].source.is_none());
    update.source = Some(source("2026.5.0"));
    let state = Store::connect(f.path()).unwrap().apply(update).unwrap();
    assert_eq!(state.groups.len(), 1);
    assert_eq!(state.groups[0].id, group.id);
    assert_eq!(state.groups[0].source, Some(source("2026.5.0")));
    assert_eq!(
        fs::read(live.join("mc_settings.cfg")).unwrap(),
        b"keep preferences"
    );
    let restore = plan(
        f.path(),
        Action::Restore {
            backup: state.backups[0].id.clone(),
        },
        vec![],
        vec![],
    )
    .unwrap();
    let restored = Store::connect(f.path()).unwrap().apply(restore).unwrap();
    assert!(restored.groups[0].source.is_none());
    assert_eq!(
        fs::read(live.join("mc_settings.cfg")).unwrap(),
        b"keep preferences"
    );
}
#[test]
fn creator_link_rejects_mixed_groups_partial_scans_unknown_targets_and_existing_loose_files() {
    let f = Fixture::new();
    let mut payload = mccc(1);
    payload.push(Payload {
        name: "other.package".into(),
        bytes: dbpf(3),
    });
    let p = plan(
        f.path(),
        Action::Install {
            title: "Mixed mods".into(),
        },
        payload,
        vec![],
    )
    .unwrap();
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    let group = &state.groups[0];
    let mut folder = files::inventory(f.path()).unwrap();
    assert_eq!(
        sims_catalog::action(&state, &folder, Some("missing")).unwrap_err(),
        "sims_creator_target"
    );
    folder.partial = true;
    assert_eq!(
        sims_catalog::action(&state, &folder, Some(&group.id)).unwrap_err(),
        "sims_adopt_scan"
    );
    let update = plan(
        f.path(),
        Action::Update {
            id: group.id.clone(),
        },
        mccc(2),
        vec![],
    )
    .unwrap();
    assert_eq!(
        sims_catalog::validate_link(&update),
        Err("sims_creator_target")
    );
    assert_eq!(snapshot(f.path()).unwrap().0, state);
    let disabled = plan(
        f.path(),
        Action::Disable {
            id: group.id.clone(),
        },
        vec![],
        vec![],
    )
    .unwrap();
    let state = Store::connect(f.path()).unwrap().apply(disabled).unwrap();
    assert_eq!(
        sims_catalog::action(&state, &files::inventory(f.path()).unwrap(), None).unwrap_err(),
        "sims_creator_existing"
    );
    let empty = Fixture::new();
    fs::write(empty.0.join("Mods/mc_cmd_center.package"), dbpf(1)).unwrap();
    assert_eq!(
        sims_catalog::action(
            &snapshot(empty.path()).unwrap().0,
            &files::inventory(empty.path()).unwrap(),
            None
        )
        .unwrap_err(),
        "sims_creator_existing"
    );
}

fn lot_source(project: &str, version: &str, required: Option<&str>) -> CreatorSource {
    CreatorSource {
        provider: "lot51".into(),
        project: Some(project.into()),
        required_core: required.map(String::from),
        version: version.into(),
        game_patch: String::new(),
        archive_hash: "b".repeat(64),
    }
}
fn lot_install(f: &Fixture, name: &str, source: CreatorSource) -> State {
    let mut p = plan(
        f.path(),
        Action::Install { title: name.into() },
        vec![Payload {
            name: format!("{name}.package"),
            bytes: dbpf(1),
        }],
        vec![],
    )
    .unwrap();
    p.source = Some(source);
    Store::connect(f.path()).unwrap().apply(p).unwrap()
}
#[test]
fn required_core_cannot_be_disabled_removed_downgraded_or_silently_modified() {
    let f = Fixture::new();
    let state = lot_install(&f, "core", lot_source("core-library", "1.43", None));
    let core = state.groups[0].id.clone();
    let state = lot_install(
        &f,
        "fashion",
        lot_source("fashion-authority", "2.5.1", Some("1.27")),
    );
    let dependent = state
        .groups
        .iter()
        .find(|g| g.id != core)
        .unwrap()
        .id
        .clone();
    for action in [
        Action::Disable { id: core.clone() },
        Action::Remove { id: core.clone() },
    ] {
        let p = plan(f.path(), action, vec![], vec![]).unwrap();
        assert_eq!(
            Store::connect(f.path()).unwrap().apply(p).unwrap_err(),
            "sims_creator_dependency"
        );
        assert_eq!(snapshot(f.path()).unwrap().0, state);
    }
    let mut p = plan(
        f.path(),
        Action::Update { id: core.clone() },
        vec![Payload {
            name: "core.package".into(),
            bytes: dbpf(2),
        }],
        vec![],
    )
    .unwrap();
    p.source = Some(lot_source("core-library", "1.20", None));
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).unwrap_err(),
        "sims_creator_dependency"
    );
    let mut p = plan(
        f.path(),
        Action::Update {
            id: dependent.clone(),
        },
        vec![Payload {
            name: "fashion.package".into(),
            bytes: dbpf(2),
        }],
        vec![],
    )
    .unwrap();
    p.source = Some(lot_source("fashion-authority", "2.5.2", Some("1.27")));
    let core_file = f.0.join("Mods").join(format!("Harbor-{core}/core.package"));
    fs::write(&core_file, dbpf(3)).unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).unwrap_err(),
        "sims_changed"
    );
    assert_eq!(snapshot(f.path()).unwrap().0, state);
    fs::write(&core_file, dbpf(1)).unwrap();
    let p = plan(f.path(), Action::Disable { id: dependent }, vec![], vec![]).unwrap();
    Store::connect(f.path()).unwrap().apply(p).unwrap();
    let p = plan(f.path(), Action::Disable { id: core }, vec![], vec![]).unwrap();
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert!(state.groups.iter().all(|g| !g.enabled));
}
#[test]
fn creator_dependency_missing_old_disabled_and_cross_provider_targets_are_rejected() {
    let f = Fixture::new();
    let state = lot_install(&f, "core", lot_source("core-library", "1.20", None));
    assert!(core_group(&state, "1.27").unwrap().is_none());
    let folder = files::inventory(f.path()).unwrap();
    assert!(matches!(
        sims_catalog::action(&state, &folder, None).unwrap(),
        Action::Install { .. }
    ));
    assert_eq!(
        sims_catalog::action(&state, &folder, Some(&state.groups[0].id)).unwrap_err(),
        "sims_creator_target"
    );
    let mut p = plan(
        f.path(),
        Action::Install {
            title: "fashion".into(),
        },
        vec![Payload {
            name: "fashion.package".into(),
            bytes: dbpf(1),
        }],
        vec![],
    )
    .unwrap();
    p.source = Some(lot_source("fashion-authority", "2.5.1", Some("1.27")));
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).unwrap_err(),
        "sims_creator_dependency"
    );
    let p = plan(
        f.path(),
        Action::Disable {
            id: state.groups[0].id.clone(),
        },
        vec![],
        vec![],
    )
    .unwrap();
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert!(core_group(&state, "1").unwrap().is_none());
    let legacy = serde_json::to_value(source("2026.5.0")).unwrap();
    assert!(legacy.get("project").is_none());
    assert!(legacy.get("requiredCore").is_none());
}

#[test]
fn dependency_guards_cover_version_restore_sets_and_guided_isolation() {
    let f = Fixture::new();
    let state = lot_install(&f, "core", lot_source("core-library", "1.20", None));
    let core = state.groups[0].id.clone();
    let mut p = plan(
        f.path(),
        Action::Update { id: core.clone() },
        vec![Payload {
            name: "core.package".into(),
            bytes: dbpf(2),
        }],
        vec![],
    )
    .unwrap();
    p.source = Some(lot_source("core-library", "1.43", None));
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    let backup = state.backups[0].id.clone();
    let state = lot_install(
        &f,
        "fashion",
        lot_source("fashion-authority", "2.5.1", Some("1.27")),
    );
    let dependent = state
        .groups
        .iter()
        .find(|g| g.id != core)
        .unwrap()
        .id
        .clone();
    let p = plan(f.path(), Action::Restore { backup }, vec![], vec![]).unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).unwrap_err(),
        "sims_creator_dependency"
    );
    assert_eq!(
        trouble::plan(
            f.path(),
            Action::StartTest {
                groups: vec![core.clone(), dependent.clone()],
                backup_folder: None
            }
        )
        .err(),
        Some("sims_creator_dependency")
    );
    let p = trouble::plan(
        f.path(),
        Action::StartTest {
            groups: vec![dependent.clone()],
            backup_folder: None,
        },
    )
    .unwrap();
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert!(state.groups.iter().find(|g| g.id == core).unwrap().enabled);
    assert!(
        !state
            .groups
            .iter()
            .find(|g| g.id == dependent)
            .unwrap()
            .enabled
    );
    let session = state.troubleshoot.as_ref().unwrap().id.clone();
    let p = trouble::plan(
        f.path(),
        Action::AnswerTest {
            id: session.clone(),
            round: 0,
            present: false,
        },
    )
    .unwrap();
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert!(state.groups.iter().all(|g| g.enabled));
    let p = trouble::plan(f.path(), Action::RestoreTest { id: session }).unwrap();
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    let off = sets::save(
        "lot51-proof",
        f.path(),
        sets::Edit {
            revision: state.revision.clone(),
            previous: None,
            title: "All off".into(),
            members: state
                .groups
                .iter()
                .map(|g| sets::Selection {
                    id: g.id.clone(),
                    enabled: false,
                })
                .collect(),
        },
    )
    .unwrap()
    .remove(0);
    let p = sets::plan(
        "lot51-proof",
        f.path(),
        Action::ApplySet {
            id: off.id,
            backup_folder: None,
        },
    )
    .unwrap();
    let state = Store::connect(f.path()).unwrap().apply(p).unwrap();
    assert!(state.groups.iter().all(|g| !g.enabled));
    let p = plan(f.path(), Action::Enable { id: dependent }, vec![], vec![]).unwrap();
    assert_eq!(
        Store::connect(f.path()).unwrap().apply(p).unwrap_err(),
        "sims_creator_dependency"
    );
}
