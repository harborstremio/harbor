use super::*;
use std::collections::BTreeMap;
use std::sync::atomic::Ordering;

struct Fixture { base: PathBuf, root: PathBuf, library: PathBuf, folder: PathBuf, value: Instance }
fn file(path: &str, bytes: &[u8]) -> files::File { files::File { path: path.into(), bytes: bytes.len() as u64, sha512: format!("{:x}", Sha512::digest(bytes)) } }
fn manifest(version: u8) -> Manifest { Manifest { schema: 1, archive: format!("{version:x}").repeat(128), files: vec![file("assets/pack.txt", format!("asset{version}").as_bytes()), file("config/tuning.json", format!("default{version}").as_bytes())] } }
fn index(version: u8) -> pack::Index { pack::Index { format_version: 1, game: "minecraft".into(), version_id: version.to_string(), name: "Fixture pack".into(), summary: String::new(), files: vec![], dependencies: BTreeMap::from([("minecraft".into(), "1.21.1".into())]) } }
fn release(folder: &Path, version: u8) { fs::create_dir_all(folder.join("game/assets")).unwrap(); fs::create_dir_all(folder.join("game/config")).unwrap(); fs::write(folder.join("game/assets/pack.txt"), format!("asset{version}")).unwrap(); fs::write(folder.join("game/config/tuning.json"), format!("default{version}")).unwrap(); instances::write(folder, "pack-index.json", &index(version)).unwrap(); instances::write(folder, files::RECORD, &manifest(version)).unwrap(); }
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir); fs::create_dir_all(&base).unwrap(); let root = base.join(format!("minecraft-pack-update-{}", uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap();
        let mut value = instances::create("pack-update", root.to_str().unwrap(), "My pack", "1.21.1").unwrap(); let library = instances::library("pack-update", root.to_str().unwrap()).unwrap(); let folder = library.join(&value.id);
        value.pack = Some(PackSource { name: "Fixture pack".into(), version: "1".into(), project: None, version_id: None, icon: String::new() }); instances::write(&folder, instances::RECORD, &value).unwrap(); release(&folder, 1);
        fs::create_dir_all(folder.join("game/saves/world")).unwrap(); fs::write(folder.join("game/saves/world/level.dat"), b"world1").unwrap(); fs::write(folder.join("game/options.txt"), b"my controls").unwrap(); Self { base, root, library, folder, value }
    }
    fn update(&self) -> Prepared {
        let target = self.root.join("release2"); release(&target, 2); let mut after = self.value.clone(); after.pack.as_mut().unwrap().version = "2".into();
        analyze("pack-update".into(), self.library.clone(), self.folder.clone(), self.value.clone(), after, transaction::fingerprint(&self.folder, "pack-update", &self.value.id).unwrap(), manifest(1), manifest(2), None, Some(target), vec![], &AtomicBool::new(false)).unwrap()
    }
}
impl Drop for Fixture { fn drop(&mut self) { let root = self.root.canonicalize().unwrap(); assert!(root.starts_with(self.base.canonicalize().unwrap())); assert!(root.file_name().unwrap().to_string_lossy().starts_with("minecraft-pack-update-")); fs::remove_dir_all(root).unwrap(); } }
fn work() -> runtime::Work { runtime::start("pack-update", &uuid::Uuid::new_v4().to_string()).unwrap() }
fn runtime_test() -> std::sync::MutexGuard<'static, ()> {
    // Runtime preparation intentionally permits only one job across profiles.
    static SERIAL: Mutex<()> = Mutex::new(()); SERIAL.lock().unwrap()
}

#[tokio::test]
async fn pack_change_and_restore_preserve_current_worlds_and_custom_settings() {
    let _serial = runtime_test();
    let f = Fixture::new(); fs::write(f.folder.join("game/config/tuning.json"), b"my settings").unwrap();
    let updated = apply_prepared(f.update(), work(), Arc::new(|_, _, _, _| {})).await.unwrap(); assert_eq!(updated.id, f.value.id); assert_eq!(updated.pack.as_ref().unwrap().version, "2"); assert_eq!(fs::read(f.folder.join("game/assets/pack.txt")).unwrap(), b"asset2");
    assert_eq!(fs::read(f.folder.join("game/config/tuning.json")).unwrap(), b"my settings"); fs::write(f.folder.join("game/saves/world/level.dat"), b"later world progress").unwrap(); fs::write(f.folder.join("game/config/tuning.json"), b"later settings").unwrap();
    let (previous, after, target) = transaction::previous(&f.library, &f.folder, "pack-update", &updated.id).unwrap().unwrap();
    let plan = analyze("pack-update".into(), f.library.clone(), f.folder.clone(), updated.clone(), after, transaction::fingerprint(&f.folder, "pack-update", &updated.id).unwrap(), manifest(2), target, None, Some(previous), vec![], &AtomicBool::new(false)).unwrap();
    let restored = apply_prepared(plan, work(), Arc::new(|_, _, _, _| {})).await.unwrap(); assert_eq!(restored.pack.as_ref().unwrap().version, "1");
    assert_eq!(fs::read(f.folder.join("game/assets/pack.txt")).unwrap(), b"asset1"); assert_eq!(fs::read(f.folder.join("game/saves/world/level.dat")).unwrap(), b"later world progress"); assert_eq!(fs::read(f.folder.join("game/config/tuning.json")).unwrap(), b"later settings"); assert_eq!(fs::read(f.folder.join("game/options.txt")).unwrap(), b"my controls");
    assert_eq!(instances::list("pack-update", f.root.to_str().unwrap()).unwrap().instances.len(), 1);
}

#[tokio::test]
async fn pack_change_cancellation_and_stale_review_never_replace_original() {
    let _serial = runtime_test();
    let f = Fixture::new(); let plan = f.update(); fs::write(f.folder.join("game/saves/world/level.dat"), b"changed during review").unwrap();
    assert!(matches!(apply_prepared(plan, work(), Arc::new(|_, _, _, _| {})).await, Err("instance_changed")));
    let plan = f.update(); let job = work(); let cancel = job.cancellation();
    assert!(matches!(apply_prepared(plan, job, Arc::new(move |phase, _, _, _| { if phase == "copy" { cancel.store(true, Ordering::Relaxed); } })).await, Err("instance_canceled")));
    assert_eq!(fs::read(f.folder.join("game/assets/pack.txt")).unwrap(), b"asset1"); assert_eq!(fs::read(f.folder.join("game/saves/world/level.dat")).unwrap(), b"changed during review"); assert!(transaction::previous(&f.library, &f.folder, "pack-update", &f.value.id).unwrap().is_none());
}

#[test]
fn extra_mod_scan_never_silently_ignores_files_beyond_the_limit() {
    let f = Fixture::new(); let mods = f.folder.join("game/mods"); fs::create_dir(&mods).unwrap();
    fs::write(mods.join("extra.jar.disabled"), b"disabled user mod").unwrap();
    assert_eq!(extras(&f.folder, &manifest(1)).unwrap(), vec!["extra.jar.disabled"]);
    for n in 0..2000 { fs::write(mods.join(format!("readme-{n}.txt")), b"").unwrap(); }
    assert_eq!(extras(&f.folder, &manifest(1)), Err("instance_limit"));
}

#[test]
fn pack_update_tokens_are_scoped_to_profile_and_modified_code_blocks_application() {
    let f = Fixture::new(); fs::create_dir_all(f.folder.join("game/mods")).unwrap(); fs::write(f.folder.join("game/mods/extra.jar"), b"user supplied").unwrap();
    let mut prepared = f.update(); prepared.manifest.files.push(file("mods/extra.jar", b"provider supplied"));
    let prepared = analyze(prepared.profile, prepared.root, prepared.folder, prepared.before, prepared.after, prepared.fingerprint, prepared.baseline, prepared.manifest, prepared.package, prepared.backup, vec![], &AtomicBool::new(false)).unwrap(); assert_eq!(prepared.plan.conflicts, 1); assert_eq!(prepared.plan.extra_mods, vec!["extra.jar"]);
    let plan = remember(prepared).unwrap(); assert!(take("different-profile", &plan.token).is_err()); discard("different-profile", &plan.token); assert!(take("pack-update", &plan.token).is_ok()); assert!(take("pack-update", &plan.token).is_err());
}
