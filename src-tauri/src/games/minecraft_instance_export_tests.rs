use super::*;
struct Fixture { base: PathBuf, root: PathBuf, folder: PathBuf, instance: Instance }
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir); fs::create_dir_all(&base).unwrap(); let root = base.join(format!("minecraft-export-{}", uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap();
        let instance = instances::create("export-tests", root.to_str().unwrap(), "My world", "1.21.1").unwrap(); let library = instances::library("export-tests", root.to_str().unwrap()).unwrap(); let folder = library.join(&instance.id);
        for (path, data) in [("config/client.json", "custom config"), ("mods/known.jar", "known mod"), ("mods/local.jar", "local mod"), ("saves/My world/level.dat", "world"), ("saves/My world/session.lock", "lock"), ("options.txt", "settings"), ("servers.dat", "servers"), ("logs/latest.log", "log"), ("session.json", "private"), ("mods/.harbor-backup/private", "private")] { let file = folder.join("game").join(path); fs::create_dir_all(file.parent().unwrap()).unwrap(); fs::write(file, data).unwrap(); }
        let index = pack::Index { format_version:1, game:"minecraft".into(), name:"Original".into(), version_id:"old".into(), summary:String::new(), files:vec![pack::PackFile { path:"mods/known.jar".into(), hashes:BTreeMap::from([("sha1".into(), "a".repeat(40)), ("sha512".into(), format!("{:x}", Sha512::digest(b"known mod")))]), downloads:vec!["https://cdn.modrinth.com/data/test/versions/test/known.jar".into()], file_size:9, env:BTreeMap::new() }], dependencies:BTreeMap::from([("minecraft".into(),"1.21.1".into())]) };
        instances::write(&folder, "pack-index.json", &index).unwrap(); Self { base, root, folder, instance }
    }
    fn plan(&self, worlds:bool, settings:bool) -> Prepared { prepare("export-tests", self.root.to_str().unwrap(), &self.instance.id, "custom-1", worlds, settings, &AtomicBool::new(false), |_,_,_|{}).unwrap() }
}
impl Drop for Fixture { fn drop(&mut self) { let root=self.root.canonicalize().unwrap(); assert!(root.starts_with(self.base.canonicalize().unwrap())); assert!(root.file_name().unwrap().to_string_lossy().starts_with("minecraft-export-")); fs::remove_dir_all(root).unwrap(); } }

#[test]
fn export_roundtrips_real_importer_with_actual_hashes_and_private_files_excluded() {
    assert!(files::local_relative("mods/.harbor-mods.json").is_ok()); assert!(instances::relative("mods/.harbor-mods.json").is_err());
    for path in ["../outside", "/outside", "C:/outside", "mods/../outside", "mods/.harbor-../outside", "mods\\outside", "mods/NUL"] { assert!(files::local_relative(path).is_err(),"{path}"); }
    let f=Fixture::new(); let prepared=f.plan(false,false); assert_eq!(prepared.plan.files.len(),3); assert_eq!(prepared.index.files.len(),1); assert_eq!(prepared.index.files[0].hashes["sha1"],format!("{:x}",sha1::Sha1::digest(b"known mod"))); assert_eq!(prepared.plan.download_bytes,9);
    let output=f.root.join("portable.mrpack"); let result=write_archive(prepared,output.to_str().unwrap(),&AtomicBool::new(false),|_,_,_|{}).unwrap(); assert!(result.bytes>0);
    let parsed=pack::parse(&output,&AtomicBool::new(false)).unwrap(); assert_eq!(parsed.index.name,"My world"); assert_eq!(parsed.index.version_id,"custom-1"); assert_eq!(parsed.index.dependencies["minecraft"],"1.21.1"); assert_eq!(parsed.files.len(),1); assert_eq!(parsed.overrides.len(),2);
    let extracted=f.root.join("extracted"); fs::create_dir(&extracted).unwrap(); pack::extract(&output,&extracted,&parsed.overrides,&AtomicBool::new(false)).unwrap(); assert_eq!(fs::read(extracted.join("config/client.json")).unwrap(),b"custom config"); assert_eq!(fs::read(extracted.join("mods/local.jar")).unwrap(),b"local mod"); assert!(!extracted.join("saves").exists()); assert!(!extracted.join("session.json").exists()); assert!(f.folder.join("game/saves/My world/level.dat").exists());
}
#[test]
fn export_embeds_modified_files_and_only_opted_in_worlds_and_settings() {
    let f=Fixture::new(); fs::write(f.folder.join("game/mods/known.jar"),b"modified bytes").unwrap(); let mut instance=f.instance.clone(); instance.loader="fabric".into(); instance.loader_version="0.16.10".into(); instances::write(&f.folder,instances::RECORD,&instance).unwrap();
    let prepared=f.plan(true,true); assert_eq!(prepared.index.dependencies["fabric-loader"],"0.16.10"); assert!(prepared.index.files.is_empty()); assert_eq!(prepared.plan.files.len(),6); assert!(prepared.plan.files.iter().all(|file|file.embedded)); assert!(!prepared.plan.files.iter().any(|file|file.path.contains("session")||file.path.contains("harbor")||file.path.starts_with("logs")));
    let output=f.root.join("with-worlds.mrpack"); write_archive(prepared,output.to_str().unwrap(),&AtomicBool::new(false),|_,_,_|{}).unwrap(); let parsed=pack::parse(&output,&AtomicBool::new(false)).unwrap(); assert_eq!(parsed.overrides.len(),6);
}
#[test]
fn export_stale_cancel_and_existing_destinations_leave_original_and_outputs_untouched() {
    let f=Fixture::new(); let output=f.root.join("portable.mrpack"); let prepared=f.plan(false,false); fs::write(f.folder.join("game/config/client.json"),b"changed since review").unwrap(); assert_eq!(write_archive(prepared,output.to_str().unwrap(),&AtomicBool::new(false),|_,_,_|{}).err(),Some("instance_changed")); assert!(!output.exists());
    assert_eq!(write_archive(f.plan(false,false),output.to_str().unwrap(),&AtomicBool::new(true),|_,_,_|{}).err(),Some("instance_canceled")); fs::write(&output,b"existing archive").unwrap(); assert_eq!(write_archive(f.plan(false,false),output.to_str().unwrap(),&AtomicBool::new(false),|_,_,_|{}).err(),Some("instance_export_exists")); assert_eq!(fs::read(output).unwrap(),b"existing archive");
    assert_eq!(write_archive(f.plan(false,false),f.folder.join("inside.mrpack").to_str().unwrap(),&AtomicBool::new(false),|_,_,_|{}).err(),Some("instance_export_path")); assert!(!fs::read_dir(&f.root).unwrap().any(|e|e.unwrap().file_name().to_string_lossy().starts_with(".pack-export-")));
}
#[test]
fn export_review_tokens_are_profile_scoped_single_use_and_expire() {
    let f=Fixture::new(); let mut prepared=f.plan(false,false); let token=prepared.plan.token.clone(); plans().lock().unwrap().insert(token.clone(),prepared); assert_eq!(take("other-profile",&token).err(),Some("instance_plan")); assert!(take("export-tests",&token).is_ok()); assert_eq!(take("export-tests",&token).err(),Some("instance_plan")); prepared=f.plan(false,false); prepared.created=Instant::now()-Duration::from_secs(901); let token=prepared.plan.token.clone(); plans().lock().unwrap().insert(token.clone(),prepared); assert_eq!(take("export-tests",&token).err(),Some("instance_plan"));
}

#[test]
fn export_cancellation_during_archive_write_cleans_only_its_temporary_file() {
    let f=Fixture::new(); let output=f.root.join("canceled.mrpack"); let cancel=AtomicBool::new(false);
    assert_eq!(write_archive(f.plan(false,false),output.to_str().unwrap(),&cancel,|_,_,_|cancel.store(true,std::sync::atomic::Ordering::Relaxed)).err(),Some("instance_canceled"));
    assert!(!output.exists()); assert!(!fs::read_dir(&f.root).unwrap().any(|entry|entry.unwrap().file_name().to_string_lossy().starts_with(".pack-export-"))); assert!(f.folder.join("game/mods/local.jar").exists());
}
