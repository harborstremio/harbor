use super::*;
fn baseline() -> minecraft_pack_state::Manifest { minecraft_pack_state::Manifest { schema: 1, archive: "a".repeat(128), files: vec![] } }

struct Fixture { base: PathBuf, root: PathBuf, library: PathBuf, value: Instance, folder: PathBuf }
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir); fs::create_dir_all(&base).unwrap(); let root = base.join(format!("minecraft-pack-transaction-{}", uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap();
        let value = instances::create("pack-transaction", root.to_str().unwrap(), "Original instance", "1.21.1").unwrap(); let library = instances::library("pack-transaction", root.to_str().unwrap()).unwrap(); let folder = library.join(&value.id);
        fs::create_dir_all(folder.join("game/saves/world")).unwrap(); fs::write(folder.join("game/saves/world/level.dat"), b"world bytes").unwrap(); fs::write(folder.join("game/options.txt"), b"custom controls").unwrap();
        fs::create_dir_all(folder.join("game/mods/.harbor-mods-backups")).unwrap(); fs::write(folder.join("game/mods/.harbor-mods.json"), b"owned mod workspace").unwrap(); fs::write(folder.join("game/mods/.harbor-mods-backups/old.jar"), b"previous mod").unwrap();
        Self { base, root, library, value, folder }
    }
    fn stage(&self) -> (Staging, String, Instance) { let stage = Staging::new(&self.library).unwrap(); let before = fingerprint(&self.folder, "pack-transaction", &self.value.id).unwrap(); let mut value = self.value.clone(); value.name = "Updated instance".into(); (stage, before, value) }
}
impl Drop for Fixture { fn drop(&mut self) { let root = self.root.canonicalize().unwrap(); assert!(root.starts_with(self.base.canonicalize().unwrap())); assert!(root.file_name().unwrap().to_string_lossy().starts_with("minecraft-pack-transaction-")); fs::remove_dir_all(root).unwrap(); } }

#[test]
fn instance_update_copy_commit_retains_identity_and_an_independent_previous_snapshot() {
    let f = Fixture::new(); let cancel = AtomicBool::new(false); let tree = scan(&f.folder, &cancel).unwrap(); let (stage, before, next) = f.stage(); let mut progressed = 0;
    copy(&f.folder, &stage.path, &tree, 0, &cancel, |bytes| progressed = bytes).unwrap(); assert_eq!(progressed, tree.bytes);
    assert_eq!(fs::read(stage.path.join("game/mods/.harbor-mods.json")).unwrap(),b"owned mod workspace"); assert_eq!(fs::read(stage.path.join("game/mods/.harbor-mods-backups/old.jar")).unwrap(),b"previous mod");
    fs::write(stage.path.join("game/new-pack-file.txt"), b"new").unwrap(); commit("pack-transaction", &f.folder, stage, &before, &next, &baseline()).unwrap();
    let active: Instance = instances::read(&f.folder.join(instances::RECORD)).unwrap(); assert_eq!(active.id, f.value.id); assert_eq!(active.name, "Updated instance");
    let (previous, old, _) = previous(&f.library, &f.folder, "pack-transaction", &f.value.id).unwrap().unwrap(); assert_eq!(old.name, f.value.name); assert!(!previous.join("game/new-pack-file.txt").exists());
    fs::write(f.folder.join("game/saves/world/level.dat"), b"later progress").unwrap(); assert_eq!(fs::read(previous.join("game/saves/world/level.dat")).unwrap(), b"world bytes");
    let moved = f.root.join("simulated-trash"); fs::rename(&previous, &moved).unwrap();
    assert!(super::previous(&f.library, &f.folder, "pack-transaction", &f.value.id).unwrap().is_none());
    fs::rename(&moved, &previous).unwrap(); assert!(super::previous(&f.library, &f.folder, "pack-transaction", &f.value.id).unwrap().is_some());
    assert!(!f.library.join(journal_name(&f.value.id)).exists()); assert_eq!(instances::list("pack-transaction", f.root.to_str().unwrap()).unwrap().instances.len(), 1);
}

#[test]
fn interrupted_instance_swap_recovers_original_before_any_instance_is_loaded() {
    let f = Fixture::new(); let (mut stage, before, next) = f.stage(); instances::write(&stage.path, instances::RECORD, &next).unwrap();
    let backup = format!(".pack-backup-{}", uuid::Uuid::new_v4()); let backups = super::super::minecraft_runtime::directory(&f.library, ".pack-backups").unwrap();
    let journal = Journal { schema: 1, owner: instances::owner("pack-transaction").unwrap(), id: f.value.id.clone(), staging: stage.path.file_name().unwrap().to_str().unwrap().into(), backup: backup.clone(), before, after: fingerprint(&stage.path, "pack-transaction", &f.value.id).unwrap() };
    instances::write(&f.library, &journal_name(&f.value.id), &journal).unwrap(); fs::rename(&f.folder, backups.join(&backup)).unwrap(); stage.committed = true;
    recover_all(&f.library, "pack-transaction").unwrap(); assert_eq!(fs::read(f.folder.join("game/saves/world/level.dat")).unwrap(), b"world bytes"); assert!(stage.path.exists()); assert!(!f.library.join(journal_name(&f.value.id)).exists());
    let original: Instance = instances::read(&f.folder.join(instances::RECORD)).unwrap(); assert_eq!(original.name, f.value.name);
}

#[test]
fn unchanged_record_recovers_before_swap_and_commits_with_an_independent_backup() {
    let f = Fixture::new(); let tree = scan(&f.folder, &AtomicBool::new(false)).unwrap(); let (stage, before, _) = f.stage();
    copy(&f.folder, &stage.path, &tree, 0, &AtomicBool::new(false), |_| {}).unwrap();
    let journal = Journal { schema:1, owner:instances::owner("pack-transaction").unwrap(), id:f.value.id.clone(), staging:stage.path.file_name().unwrap().to_str().unwrap().into(), backup:format!(".pack-backup-{}", uuid::Uuid::new_v4()), before:before.clone(), after:before.clone() };
    instances::write(&f.library, &journal_name(&f.value.id), &journal).unwrap();
    recover(&f.library, "pack-transaction", &f.value.id).unwrap(); assert!(!f.library.join(journal_name(&f.value.id)).exists());
    commit("pack-transaction", &f.folder, stage, &before, &f.value, &baseline()).unwrap();
    assert!(previous(&f.library, &f.folder, "pack-transaction", &f.value.id).unwrap().is_some());
    assert_eq!(fs::read(f.folder.join("game/saves/world/level.dat")).unwrap(), b"world bytes");
}

#[test]
fn instance_update_cancel_changed_files_and_forged_recovery_leave_original_untouched() {
    let f = Fixture::new(); let tree = scan(&f.folder, &AtomicBool::new(false)).unwrap(); let (stage, before, next) = f.stage();
    assert_eq!(copy(&f.folder, &stage.path, &tree, 0, &AtomicBool::new(true), |_| {}), Err("instance_canceled"));
    fs::write(f.folder.join("game/options.txt"), b"changed controls with different size").unwrap();
    assert_eq!(copy(&f.folder, &stage.path, &tree, 0, &AtomicBool::new(false), |_| {}), Err("instance_changed"));
    let mut changed = f.value.clone(); changed.name = "Renamed while reviewing".into(); instances::write(&f.folder, instances::RECORD, &changed).unwrap();
    assert_eq!(commit("pack-transaction", &f.folder, stage, &before, &next, &baseline()), Err("instance_changed"));
    let journal = Journal { schema:1, owner:instances::owner("another-profile").unwrap(), id:f.value.id.clone(), staging:"../outside".into(), backup:"../outside".into(), before, after:"b".repeat(128) }; instances::write(&f.library, &journal_name(&f.value.id), &journal).unwrap();
    assert_eq!(recover(&f.library, "pack-transaction", &f.value.id), Err("instance_update_recovery")); assert_eq!(fs::read(f.folder.join("game/saves/world/level.dat")).unwrap(), b"world bytes");
}
