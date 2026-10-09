use super::*;
use std::{
    cell::Cell,
    io::{Cursor, Read},
};
struct Fixture {
    root: PathBuf,
    id: String,
    slider: Vec<u8>,
}
impl Fixture {
    fn build(name: &str) -> Self {
        let mut f = Self::new();
        let catalog = PathBuf::from(std::env::var("HARBOR_SIMS_CC_FIXTURES").unwrap());
        let archive = catalog.join(match name {
            "starter" => "../base-game-starter.zip",
            "bedroom" => "pixelfro-bedroom.zip",
            "kitchen" => "pixelfro-kitchen.zip",
            _ => panic!("unknown fixture"),
        });
        let imported =
            store::tray::format::unpack_zip_checked(fs::read(archive).unwrap(), &|| Ok(()))
                .unwrap();
        let plan =
            store::tray::plan_import_checked(f.path(), name.into(), imported, &|| Ok(())).unwrap();
        store::Store::connect(f.path())
            .unwrap()
            .apply(plan)
            .unwrap();
        f.id = store::tray::view(f.path())
            .unwrap()
            .items
            .into_iter()
            .find(|i| i.title == name)
            .unwrap()
            .id;
        f
    }
    fn new() -> Self {
        let parent = PathBuf::from(
            std::env::var("HARBOR_SIMS_PROOF_ROOT").expect("Owned proof root is required"),
        );
        fs::create_dir_all(&parent).unwrap();
        let root = parent
            .canonicalize()
            .unwrap()
            .join(format!("harbor-sims-cc-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("Mods")).unwrap();
        fs::create_dir(root.join("saves")).unwrap();
        fs::write(root.join("GameVersion.txt"), "1.120.123.1020").unwrap();
        fs::write(
            root.join("Options.ini"),
            "[options]\nmodsdisabled = 0\nscriptmodsenabled = 1\n",
        )
        .unwrap();
        fs::write(
            root.join("Mods/Resource.cfg"),
            "Priority 500\nPackedFile *.package\nPackedFile */*.package\n",
        )
        .unwrap();
        let catalog = PathBuf::from(
            std::env::var("HARBOR_SIMS_CC_FIXTURES")
                .expect("Original public creator archives required"),
        );
        let imported = store::tray::format::unpack_zip_checked(
            fs::read(catalog.join("../tray-images/echron.zip")).unwrap(),
            &|| Ok(()),
        )
        .unwrap();
        let plan = store::tray::plan_import_checked(
            root.to_str().unwrap(),
            "Family Echron".into(),
            imported,
            &|| Ok(()),
        )
        .unwrap();
        store::Store::connect(root.to_str().unwrap())
            .unwrap()
            .apply(plan)
            .unwrap();
        let id = store::tray::view(root.to_str().unwrap()).unwrap().items[0]
            .id
            .clone();
        let mut zip = zip::ZipArchive::new(Cursor::new(
            fs::read(catalog.join("cc-HFO-shoulder-fixed.zip")).unwrap(),
        ))
        .unwrap();
        let name = zip
            .file_names()
            .find(|n| n.ends_with(".package"))
            .unwrap()
            .to_owned();
        let mut slider = Vec::new();
        zip.by_name(&name)
            .unwrap()
            .read_to_end(&mut slider)
            .unwrap();
        Self { root, id, slider }
    }
    fn path(&self) -> &str {
        self.root.to_str().unwrap()
    }
    fn write(&self, name: &str, bytes: &[u8]) {
        let path = self.root.join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }
    fn scan(&self, selection: Option<&PackSelection>) -> Result<Report> {
        scan(
            "cc-proof",
            self.path(),
            &self.id,
            &uuid::Uuid::new_v4().to_string(),
            selection,
            |_| {},
        )
    }
    fn managed_slider(&self) -> String {
        let plan = store::plan(
            self.path(),
            store::Action::Install {
                title: "Original shoulder slider".into(),
            },
            vec![super::super::sims_package::Payload {
                name: "slider.package".into(),
                bytes: self.slider.clone(),
            }],
            vec![],
        )
        .unwrap();
        let state = store::Store::connect(self.path())
            .unwrap()
            .apply(plan)
            .unwrap();
        state.groups[0].id.clone()
    }
    fn action(&self, action: store::Action) {
        let plan = store::plan(self.path(), action, vec![], vec![]).unwrap();
        store::Store::connect(self.path())
            .unwrap()
            .apply(plan)
            .unwrap();
    }
    fn game(&self) -> PackSelection {
        let mut header = vec![0; 68];
        header[..2].copy_from_slice(b"MZ");
        header[60..64].copy_from_slice(&64u32.to_le_bytes());
        header[64..68].copy_from_slice(b"PE\0\0");
        self.write("Installation/Game/Bin/TS4_x64.exe", &header);
        // The real small package occupies synthetic installation locations. This
        // tests file discovery, not the presence of an actual Sims installation.
        self.write(
            "Installation/Data/Client/ClientFullBuild0.package",
            &self.slider,
        );
        PackSelection {
            path: self.root.join("Installation").to_str().unwrap().into(),
            custom: vec![launch::CustomLaunch {
                executable: self
                    .root
                    .join("Installation/Game/Bin/TS4_x64.exe")
                    .to_str()
                    .unwrap()
                    .into(),
                arguments: vec![],
            }],
        }
    }
}

// Controlled index-only package: payload bytes deliberately aren't game content.
fn build_index(entries: &[(u32, u32, u64, bool)]) -> Vec<u8> {
    let mut data = vec![0; 128];
    data[..4].copy_from_slice(b"DBPF");
    data[4..8].copy_from_slice(&2u32.to_le_bytes());
    data[8..12].copy_from_slice(&1u32.to_le_bytes());
    data[36..40].copy_from_slice(&(entries.len() as u32).to_le_bytes());
    data[40..44].copy_from_slice(&128u32.to_le_bytes());
    let mut index = 0u32.to_le_bytes().to_vec();
    for (kind, group, instance, deleted) in entries {
        for n in [
            *kind,
            *group,
            (instance >> 32) as u32,
            *instance as u32,
            96,
            if *deleted { 0x80000004 } else { 4 },
            4,
        ] {
            index.extend(n.to_le_bytes());
        }
        if *deleted {
            index.extend(0x0001ffe0u32.to_le_bytes());
        }
    }
    data[44..48].copy_from_slice(&(index.len() as u32).to_le_bytes());
    data.extend(index);
    data
}
#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn original_lots_and_room_reach_the_fresh_managed_creation_scan() {
    for (name, objects, references) in [
        ("starter", 138, 101),
        ("bedroom", 218, 185),
        ("kitchen", 236, 193),
    ] {
        let f = Fixture::build(name);
        assert!(
            store::tray::images::preview(f.path(), &f.id)
                .unwrap()
                .is_some(),
            "{name} original cover"
        );
        let result = f.scan(None).unwrap();
        assert_eq!(result.objects, Some(objects), "{name}");
        assert_eq!(result.references, references, "{name}");
        assert_eq!(result.unresolved, references);
        assert!(result.other_data);
        assert!(result.sims.is_empty());
        assert!(result.matches.is_empty());
        assert!(!result.partial);
    }
}
#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn lot_wall_and_floor_references_require_exact_groups_and_remain_incomplete() {
    let f = Fixture::build("bedroom");
    let root = PathBuf::from(std::env::var("HARBOR_SIMS_CC_FIXTURES").unwrap())
        .join("architecture-proof/bedroom");
    let lot = build::read(
        &fs::read(root.join("content.bin")).unwrap(),
        &fs::read(root.join("metadata.bin")).unwrap(),
        0x0e1404d56509006f,
        build::Kind::Lot,
        &|| Ok(()),
    )
    .unwrap();
    let wall = lot
        .declared
        .iter()
        .find(|k| k.kind == 0xd5f0f921 && k.group != 0)
        .unwrap();
    let floor = lot.declared.iter().find(|k| k.kind == 0xb4f762c9).unwrap();
    let wrong = (wall.kind, wall.group ^ 1, wall.instance, false);
    f.write(
        "Mods/Wrong wall group.package",
        &build_index(&[wrong, wrong]),
    );
    assert!(f.scan(None).unwrap().matches.is_empty());
    f.write(
        "Mods/Controlled build materials.package",
        &build_index(&[
            (wall.kind, wall.group, wall.instance, false),
            (floor.kind, floor.group, floor.instance, false),
            wrong,
        ]),
    );
    let result = f.scan(None).unwrap();
    assert_eq!(result.references, 185);
    assert_eq!(result.unresolved, 183);
    assert_eq!(result.matches.len(), 1);
    assert_eq!(result.matches[0].references, 2);
    assert!(!result.matches[0].ambiguous);
    assert!(result.other_data);
    assert_eq!(result.objects, Some(218));
}
#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn room_groups_filter_false_matches_and_overrides_without_losing_deleted_records() {
    let f = Fixture::build("kitchen");
    let fixture = PathBuf::from(std::env::var("HARBOR_SIMS_LOT_FIXTURES").unwrap()).join("kitchen");
    let room = build::read(
        &fs::read(fixture.join("content.bin")).unwrap(),
        &fs::read(fixture.join("metadata.bin")).unwrap(),
        0x032804e024f30051,
        build::Kind::Room,
        &|| Ok(()),
    )
    .unwrap();
    let key = room.declared.iter().find(|k| k.kind == 0x319e4f1d).unwrap();
    let group = key.group;
    let right = (key.kind, group, key.instance, false);
    let wrong = (key.kind, group ^ 1, key.instance, false);
    f.write("Mods/Wrong group.package", &build_index(&[wrong, wrong]));
    f.write(
        "Mods/Matching object.package",
        &build_index(&[right, wrong, wrong]),
    );
    let report = f.scan(None).unwrap();
    assert_eq!(report.references, 193);
    assert_eq!(report.unresolved, 192);
    assert_eq!(report.matches.len(), 1);
    assert_eq!(report.matches[0].references, 1);
    assert!(!report.matches[0].ambiguous);
    f.write("Mods/Override.package", &build_index(&[right]));
    let report = f.scan(None).unwrap();
    assert_eq!(report.matches.len(), 2);
    assert!(report.matches.iter().all(|m| m.ambiguous));
    f.write(
        "Mods/Deleted.package",
        &build_index(&[(key.kind, group, key.instance, true)]),
    );
    let report = f.scan(None).unwrap();
    assert_eq!(report.matches.len(), 3);
    assert!(report.matches.iter().all(|m| m.ambiguous));
    assert_eq!(
        report
            .matches
            .iter()
            .find(|m| m.path == "Deleted.package")
            .unwrap()
            .references,
        0
    );
    assert_eq!(report.unresolved, 192);
}
#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn removed_room_is_readable_and_changed_room_is_rejected() {
    let f = Fixture::build("kitchen");
    let plan = store::tray::plan(
        f.path(),
        store::Action::TrayRemove { id: f.id.clone() },
        vec![],
    )
    .unwrap();
    store::Store::connect(f.path())
        .unwrap()
        .apply(plan)
        .unwrap();
    assert_eq!(f.scan(None).unwrap().objects, Some(236));
    let vault = f.root.join(store::STORE).join("tray-vault").join(&f.id);
    let room = fs::read_dir(vault)
        .unwrap()
        .map(|e| e.unwrap().path())
        .find(|p| p.extension().is_some_and(|v| v == "room"))
        .unwrap();
    fs::write(room, b"changed").unwrap();
    assert_eq!(f.scan(None).unwrap_err(), "sims_changed");
}

#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn actual_creator_household_names_current_mod_files_and_unresolved_game_references() {
    let f = Fixture::new();
    f.write("Mods/My changed filename.package", &f.slider);
    let value = f.scan(None).unwrap();
    assert_eq!(value.sims.len(), 4);
    assert_eq!(value.matches.len(), 1);
    assert_eq!(value.matches[0].area, Area::Mods);
    assert_eq!(value.matches[0].references, 6);
    assert_eq!(value.matches[0].sims.len(), 4);
    assert_eq!(value.checked_files, 1);
    assert_eq!(value.indexed_resources, 20);
    assert!(value.unresolved > 0);
    assert!(value.game.is_none());
    assert!(value.other_data);
    assert_eq!(value.mods_enabled, Some(true));
    assert!(value.resource_ready);
    assert!(!value.partial);
}
#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn disabled_mods_and_removed_household_remain_inspectable_without_changing_them() {
    let f = Fixture::new();
    let id = f.managed_slider();
    f.action(store::Action::Disable { id });
    let plan = store::tray::plan(
        f.path(),
        store::Action::TrayRemove { id: f.id.clone() },
        vec![],
    )
    .unwrap();
    store::Store::connect(f.path())
        .unwrap()
        .apply(plan)
        .unwrap();
    let before = store::snapshot(f.path()).unwrap().0;
    let value = f.scan(None).unwrap();
    assert_eq!(value.matches.len(), 1);
    assert_eq!(value.matches[0].area, Area::Disabled);
    assert_eq!(
        value.matches[0].title.as_deref(),
        Some("Original shoulder slider")
    );
    assert_eq!(store::snapshot(f.path()).unwrap().0, before);
    assert!(!store::tray::view(f.path()).unwrap().items[0].installed);
}
#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn game_and_disabled_pack_evidence_does_not_claim_mods_are_missing() {
    let f = Fixture::new();
    let mut selection = f.game();
    f.write("Installation/EP05/ClientFullBuild0.package", &f.slider);
    f.write(
        "Installation/Delta/EP07/ClientDeltaBuild0.package",
        &f.slider,
    );
    selection.custom[0].arguments = vec!["-disablepacks:EP05".into()];
    let value = f.scan(Some(&selection)).unwrap();
    assert_eq!(value.matches.len(), 3);
    assert_eq!(value.checked_files, 3);
    assert!(value
        .matches
        .iter()
        .all(|m| m.area == Area::Game && m.ambiguous));
    assert_eq!(
        value
            .matches
            .iter()
            .find(|m| m.pack.as_deref() == Some("EP05"))
            .unwrap()
            .pack_available,
        Some(false)
    );
    assert_eq!(
        value
            .matches
            .iter()
            .find(|m| m.pack.as_deref() == Some("EP07"))
            .unwrap()
            .pack_available,
        Some(false)
    );
    assert!(value.unresolved > 0);
    assert!(!value.partial);
}
#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn invalid_selected_game_retains_local_results_and_corrupt_package_is_partial() {
    let f = Fixture::new();
    f.write("Mods/slider.package", &f.slider);
    f.write("Mods/broken.package", b"broken");
    let value = f
        .scan(Some(&PackSelection {
            path: f.path().into(),
            custom: vec![],
        }))
        .unwrap();
    assert_eq!(value.matches.len(), 1);
    assert!(value.partial);
    assert_eq!(value.game_error, Some("sims_packs_folder"));
}
#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn adding_a_package_during_the_scan_invalidates_the_result() {
    let f = Fixture::new();
    f.write("Mods/slider.package", &f.slider);
    let changed = Cell::new(false);
    let result = scan(
        "cc-added",
        f.path(),
        &f.id,
        &uuid::Uuid::new_v4().to_string(),
        None,
        |p| {
            if p.file.is_some() && !changed.replace(true) {
                f.write("Mods/new.package", &f.slider);
            }
        },
    );
    assert_eq!(result.unwrap_err(), "sims_changed");
    assert!(changed.get());
}
#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn editing_household_during_scan_invalidates_all_associations() {
    let f = Fixture::new();
    f.write("Mods/slider.package", &f.slider);
    let changed = Cell::new(false);
    let file = fs::read_dir(f.root.join("Tray"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .find(|p| p.extension().is_some_and(|e| e == "householdbinary"))
        .unwrap();
    let result = scan(
        "cc-edited",
        f.path(),
        &f.id,
        &uuid::Uuid::new_v4().to_string(),
        None,
        |p| {
            if p.file.is_some() && !changed.replace(true) {
                let mut bytes = fs::read(&file).unwrap();
                bytes.push(0);
                fs::write(&file, bytes).unwrap();
            }
        },
    );
    assert_eq!(result.unwrap_err(), "sims_changed");
}
#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn new_game_pack_during_scan_invalidates_old_pack_availability() {
    let f = Fixture::new();
    let selection = f.game();
    let changed = Cell::new(false);
    let result = scan(
        "cc-pack-change",
        f.path(),
        &f.id,
        &uuid::Uuid::new_v4().to_string(),
        Some(&selection),
        |p| {
            if p.file.is_some() && !changed.replace(true) {
                f.write("Installation/EP05/ClientFullBuild0.package", &f.slider);
            }
        },
    );
    assert_eq!(result.unwrap_err(), "sims_changed");
}
#[test]
#[ignore = "requires original creator archives and owned proof folder"]
fn native_cancel_is_scoped_and_no_success_is_emitted_after_cancel() {
    let f = Fixture::new();
    f.write("Mods/slider.package", &f.slider);
    let operation = uuid::Uuid::new_v4().to_string();
    let done = Cell::new(false);
    let result = scan("cc-cancel", f.path(), &f.id, &operation, None, |p| {
        done.set(done.get() || p.phase == "done");
        assert!(!store::progress::cancel("wrong-profile", &operation));
        if p.file.is_some() {
            assert!(store::progress::cancel("cc-cancel", &operation));
        }
    });
    assert_eq!(result.unwrap_err(), "sims_canceled");
    assert!(!done.get());
}
