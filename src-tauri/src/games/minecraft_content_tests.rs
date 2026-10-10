use super::*;
use std::path::PathBuf;

struct Fixture { base: PathBuf, root: PathBuf, instance: instances::Instance, folder: PathBuf }
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
        fs::create_dir_all(&base).unwrap(); let root = base.join(format!("minecraft-content-{}", uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap();
        let mut instance = instances::create("content-test", root.to_str().unwrap(), "My Fabric world", "1.21.1").unwrap();
        instance.loader = "fabric".into(); instance.loader_version = "0.16.10".into();
        let library = instances::library("content-test", root.to_str().unwrap()).unwrap(); let folder = library.join(&instance.id);
        instances::write(&folder, instances::RECORD, &instance).unwrap(); Self { base, root, instance, folder }
    }
    async fn connect(&self) -> Content { content("content-test".into(), self.root.to_str().unwrap().into(), self.instance.id.clone()).await.unwrap() }
}
impl Drop for Fixture {
    fn drop(&mut self) { let root = self.root.canonicalize().unwrap(); assert!(root.starts_with(self.base.canonicalize().unwrap())); assert!(root.file_name().unwrap().to_string_lossy().starts_with("minecraft-content-")); fs::remove_dir_all(root).unwrap(); }
}

#[tokio::test]
#[ignore = "uses shared Minecraft work lock; run serially"]
async fn minecraft_content_binds_exact_instance_and_keeps_pack_files_unmanaged() {
    let fixture = Fixture::new(); let first = fixture.connect().await;
    assert_eq!(first.workspace.game_version, "1.21.1"); assert_eq!(first.workspace.loader, "fabric"); assert!(first.workspace.packages.is_empty());
    let root = PathBuf::from(&first.path); fs::write(root.join("pack-original.jar"), b"untouched pack file").unwrap();
    fs::write(fixture.folder.join("game/world.dat"), b"world").unwrap();
    let next = fixture.connect().await; assert!(next.workspace.packages.is_empty()); assert_eq!(next.external.len(), 1); assert_eq!(next.external[0].name, "pack-original.jar");
    assert_eq!(next.workspace.revision, first.workspace.revision);
    assert_eq!(fs::read(root.join("pack-original.jar")).unwrap(), b"untouched pack file");
    assert_eq!(fs::read(fixture.folder.join("game/world.dat")).unwrap(), b"world");
    assert!(content("another-profile".into(), fixture.root.to_str().unwrap().into(), fixture.instance.id.clone()).await.is_err());
    assert!(content("content-test".into(), fixture.root.to_str().unwrap().into(), "../outside".into()).await.is_err());
    assert_eq!(mods::workspace("content-test".into(), first.path.clone(), Some("fabric".into()), Some("1.20.1".into())).await.unwrap_err(), "mods_environment");
    assert_eq!(mods::workspace("another-profile".into(), first.path, None, None).await.unwrap_err(), "mods_record");
}

#[tokio::test]
#[ignore = "uses shared Minecraft work lock; run serially"]
async fn minecraft_content_uses_launch_lock_and_preserves_generic_folder_behavior() {
    let fixture = Fixture::new(); let first = fixture.connect().await; let root = PathBuf::from(&first.path);
    let held = guard("content-test", &root).unwrap().unwrap();
    assert!(minecraft_runtime::start("content-test", &uuid::Uuid::new_v4().to_string()).is_err()); drop(held);
    let work = minecraft_runtime::start("content-test", &uuid::Uuid::new_v4().to_string()).unwrap();
    assert_eq!(mods::workspace("content-test".into(), first.path.clone(), None, None).await.unwrap_err(), "mods_busy"); drop(work);
    let generic = fixture.root.join("external-mods"); fs::create_dir(&generic).unwrap(); assert!(guard("content-test", &generic).unwrap().is_none());
    assert!(mods::workspace("content-test".into(), generic.to_str().unwrap().into(), Some("fabric".into()), Some("1.21.1".into())).await.is_ok());
    instances::write(&fixture.folder, "session.json", &serde_json::json!({"broken":true})).unwrap();
    assert_eq!(mods::workspace("content-test".into(), first.path.clone(), None, None).await.unwrap_err(), "mods_record");
    fs::remove_file(fixture.folder.join("session.json")).unwrap();
    fs::write(fixture.folder.join(instances::RECORD), b"broken").unwrap(); assert!(guard("content-test", &root).is_err());
}

#[tokio::test]
#[ignore = "launches a short-lived fixture process; run serially"]
async fn minecraft_content_blocks_generic_mod_actions_while_instance_process_runs() {
    let fixture = Fixture::new(); let first = fixture.connect().await;
    #[cfg(windows)]
    let mut command = { let mut cmd = tokio::process::Command::new("powershell.exe"); cmd.args(["-NoProfile", "-NonInteractive", "-Command", "Start-Sleep -Milliseconds 1800"]); cmd.creation_flags(0x08000000); cmd };
    #[cfg(not(windows))]
    let mut command = { let mut cmd = tokio::process::Command::new("sleep"); cmd.arg("2"); cmd };
    let child = command.stdin(std::process::Stdio::null()).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped()).spawn().unwrap();
    let workspace = minecraft_launch_process::Workspace::new(&fixture.folder).unwrap();
    assert!(minecraft_launch_process::track(child, fixture.folder.clone(), workspace, vec![]).await.unwrap().running);
    assert_eq!(mods::workspace("content-test".into(), first.path.clone(), None, None).await.unwrap_err(), "mods_instance_running");
    assert_eq!(mods::action("content-test".into(), first.path.clone(), "none".into(), "remove".into(), Some(first.workspace.revision)).await.unwrap_err(), "mods_instance_running");
    assert_eq!(mods::review("content-test".into(), first.path, "none".into(), uuid::Uuid::new_v4().to_string()).await.err(), Some("mods_instance_running"));
    tokio::time::timeout(std::time::Duration::from_secs(10), async { while minecraft_launch_process::state(&fixture.folder, false).unwrap().running { tokio::time::sleep(std::time::Duration::from_millis(100)).await; } }).await.unwrap();
    assert!(fixture.connect().await.workspace.packages.is_empty());
}

#[tokio::test]
#[ignore = "downloads two public Sodium releases; never executes a mod; run serially"]
async fn minecraft_content_live_install_update_and_restore_stay_in_selected_instance() {
    let fixture = Fixture::new(); let bound = fixture.connect().await; let root = PathBuf::from(&bound.path);
    fs::write(fixture.folder.join("game/world.dat"), b"keep world").unwrap();
    fs::create_dir(fixture.folder.join("game/config")).unwrap(); fs::write(fixture.folder.join("game/config/user.txt"), b"keep settings").unwrap();
    let client = super::super::modrinth::client().unwrap();
    let releases = super::super::modrinth::json(&client, super::super::modrinth::route("versions", "AANobbMI", "fabric", "1.21.1", 0, "").unwrap()).await.unwrap();
    let stable = releases.as_array().unwrap().iter().filter(|v| v["version_type"] == "release").collect::<Vec<_>>(); assert!(stable.len() >= 2);
    let older = stable[1]["id"].as_str().unwrap(); let newer = stable[0]["id"].as_str().unwrap();
    let review = mods::review("content-test".into(), bound.path.clone(), older.into(), uuid::Uuid::new_v4().to_string()).await.unwrap();
    assert_eq!(review.game_version, "1.21.1");
    let first = mods::install("content-test".into(), review.token, uuid::Uuid::new_v4().to_string(), |_| {}).await.unwrap();
    let original = first.packages.iter().find(|p| p.project == "AANobbMI").unwrap(); let original_bytes = fs::read(root.join(&original.filename)).unwrap();
    let review = mods::review("content-test".into(), bound.path.clone(), newer.into(), uuid::Uuid::new_v4().to_string()).await.unwrap(); assert_eq!(review.replaced[0].version, older);
    let updated = mods::install("content-test".into(), review.token, uuid::Uuid::new_v4().to_string(), |_| {}).await.unwrap();
    let restored = mods::action("content-test".into(), bound.path, "AANobbMI".into(), "rollback".into(), Some(updated.revision)).await.unwrap();
    let restored = restored.packages.iter().find(|p| p.project == "AANobbMI").unwrap(); assert_eq!(restored.version, older); assert_eq!(fs::read(root.join(&restored.filename)).unwrap(), original_bytes);
    let refreshed = fixture.connect().await; assert_eq!(refreshed.workspace.packages.len(), 1); assert!(refreshed.external.is_empty());
    assert_eq!(fs::read(fixture.folder.join("game/world.dat")).unwrap(), b"keep world"); assert_eq!(fs::read(fixture.folder.join("game/config/user.txt")).unwrap(), b"keep settings");
}
