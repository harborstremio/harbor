use super::*;
struct Fixture { base:PathBuf, root:PathBuf, library:PathBuf, folder:PathBuf, instance:Instance }
impl Fixture {
    fn new() -> Self { let base=std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir); fs::create_dir_all(&base).unwrap(); let root=base.join(format!("minecraft-storage-{}",uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap(); let instance=instances::create("storage-tests",root.to_str().unwrap(),"My instance","1.21.1").unwrap(); let library=instances::library("storage-tests",root.to_str().unwrap()).unwrap(); let folder=library.join(&instance.id); fs::create_dir_all(folder.join("game/saves/World")).unwrap(); fs::write(folder.join("game/saves/World/level.dat"),b"current world").unwrap(); Self{base,root,library,folder,instance} }
    fn backup(&self, foreign:bool) -> String { let key=format!(".pack-backup-{}",uuid::Uuid::new_v4()); let folder=self.library.join(".pack-backups").join(&key); fs::create_dir_all(folder.join("game")).unwrap(); let mut instance=self.instance.clone(); if foreign {instance.id=uuid::Uuid::new_v4().to_string();} instances::write(&folder,instances::RECORD,&instance).unwrap(); fs::write(folder.join("game/old.txt"),b"old world").unwrap(); key }
    fn plan(&self, backup:Option<&str>) -> Prepared { prepare("storage-tests",self.root.to_str().unwrap(),&self.instance.id,backup,&AtomicBool::new(false)).unwrap() }
}
impl Drop for Fixture { fn drop(&mut self) { let root=self.root.canonicalize().unwrap(); assert!(root.starts_with(self.base.canonicalize().unwrap())); assert!(root.file_name().unwrap().to_string_lossy().starts_with("minecraft-storage-")); fs::remove_dir_all(root).unwrap(); } }
#[test]
fn storage_lists_owned_copies_with_verified_dates_and_current_restore_point() {
    let f=Fixture::new(); let key=f.backup(false); f.backup(true); let folder=f.library.join(".pack-backups").join(&key); let pointer=transaction::Previous {directory:key.clone(),record:transaction::fingerprint(&folder,"storage-tests",&f.instance.id).unwrap(),created_at:instances::now(),manifest:super::super::minecraft_pack_state::Manifest{schema:1,archive:"a".repeat(128),files:vec![]}}; instances::write(&f.folder,transaction::PREVIOUS,&pointer).unwrap();
    let state=listing("storage-tests",f.root.to_str().unwrap(),&f.instance.id).unwrap(); assert_eq!(state.backups.len(),1); assert!(state.backups[0].latest); assert_eq!(state.backups[0].saved_at,Some(pointer.created_at)); let plan=f.plan(Some(&key)); assert!(plan.plan.backup&&plan.plan.latest); assert_eq!(plan.plan.recovery_copies,0); assert_eq!(plan.plan.files,2);
}
#[test]
fn storage_removal_moves_only_owned_copies_before_the_active_instance() {
    let f=Fixture::new(); let key=f.backup(false); let foreign=f.backup(true); let unreadable=format!(".pack-backup-{}",uuid::Uuid::new_v4()); fs::create_dir_all(f.library.join(".pack-backups").join(&unreadable)).unwrap(); let prepared=f.plan(None); assert_eq!(prepared.plan.worlds,1); assert_eq!(prepared.plan.recovery_copies,1); assert_eq!(prepared.plan.unreadable,1); let trash=f.root.join("test-trash"); fs::create_dir(&trash).unwrap(); let mut moved=vec![];
    let result=remove(prepared,&AtomicBool::new(false),|path|{moved.push(path.file_name().unwrap().to_str().unwrap().to_owned()); fs::rename(path,trash.join(path.file_name().unwrap())).map_err(|_|"instance_trash")}).unwrap(); assert!(result.instance_removed); assert_eq!(moved,vec![key,f.instance.id.clone()]); assert!(!f.folder.exists()); assert!(f.library.join(".pack-backups").join(foreign).exists()); assert!(f.library.join(".pack-backups").join(unreadable).exists()); assert_eq!(fs::read(trash.join(&f.instance.id).join("game/saves/World/level.dat")).unwrap(),b"current world");
}
#[test]
fn storage_changes_cancel_foreign_copies_and_os_failures_preserve_the_active_instance() {
    let f=Fixture::new(); f.backup(false); let foreign=f.backup(true); assert!(prepare("storage-tests",f.root.to_str().unwrap(),&f.instance.id,Some(&foreign),&AtomicBool::new(false)).is_err()); assert!(prepare("storage-tests",f.root.to_str().unwrap(),&f.instance.id,Some("../outside"),&AtomicBool::new(false)).is_err());
    let prepared=f.plan(None); fs::write(f.folder.join("game/saves/World/level.dat"),b"new world progress").unwrap(); assert_eq!(remove(prepared,&AtomicBool::new(false),|_|panic!("must not move stale files")).err(),Some("instance_changed")); assert_eq!(remove(f.plan(None),&AtomicBool::new(true),|_|panic!("must not move canceled files")).err(),Some("instance_canceled")); assert_eq!(remove(f.plan(None),&AtomicBool::new(false),|_|Err("instance_trash")).err(),Some("instance_trash")); assert!(f.folder.exists()); assert_eq!(fs::read(f.folder.join("game/saves/World/level.dat")).unwrap(),b"new world progress");
}
#[test]
fn storage_copy_removal_keeps_active_and_restore_pointer_for_os_undo() {
    let f=Fixture::new(); let key=f.backup(false); let prepared=f.plan(Some(&key)); let trash=f.root.join("copy-in-trash"); assert!(!remove(prepared,&AtomicBool::new(false),|path|fs::rename(path,&trash).map_err(|_|"instance_trash")).unwrap().instance_removed); assert!(f.folder.exists()); assert_eq!(listing("storage-tests",f.root.to_str().unwrap(),&f.instance.id).unwrap().backups.len(),0); fs::rename(&trash,f.library.join(".pack-backups").join(key)).unwrap(); assert_eq!(listing("storage-tests",f.root.to_str().unwrap(),&f.instance.id).unwrap().backups.len(),1);
}

#[cfg(windows)]
#[test]
#[ignore = "Moves only a generated UUID fixture to the Windows Recycle Bin, then restores that exact item"]
fn storage_windows_recycle_bin_roundtrip_for_generated_fixture() {
    let f=Fixture::new(); let result=remove(f.plan(None),&AtomicBool::new(false),super::super::minecraft_recycle::recycle).unwrap(); assert!(result.instance_removed); assert!(!f.folder.exists());
    let items:Vec<_>=trash::os_limited::list().unwrap().into_iter().filter(|item|item.name.to_string_lossy()==f.instance.id && item.original_parent.canonicalize().ok().as_deref()==Some(f.library.as_path())).collect();
    assert_eq!(items.len(),1,"Must find only the freshly generated fixture; never touch unrelated trash"); trash::os_limited::restore_all(items).unwrap(); assert_eq!(fs::read(f.folder.join("game/saves/World/level.dat")).unwrap(),b"current world");
}
