use super::{minecraft_instances as instances, minecraft_pack as pack};
use std::{fs, io::Write, path::{Path, PathBuf}, sync::atomic::AtomicBool};
use serde_json::{json, Value};

struct Fixture { base: PathBuf, root: PathBuf }
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
        fs::create_dir_all(&base).unwrap(); let root = base.join(format!("minecraft-instances-{}", uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap(); Self { base, root }
    }
    fn archive(&self, index: &Value, entries: &[(&str, &[u8])]) -> PathBuf {
        let path = self.root.join(format!("{}.mrpack", uuid::Uuid::new_v4()));
        let mut zip = zip::ZipWriter::new(fs::File::create(&path).unwrap()); let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        zip.start_file("modrinth.index.json", options).unwrap(); zip.write_all(&serde_json::to_vec(index).unwrap()).unwrap();
        for (name, bytes) in entries { zip.start_file(*name, options).unwrap(); zip.write_all(bytes).unwrap(); }
        zip.finish().unwrap(); path
    }
}
impl Drop for Fixture { fn drop(&mut self) { let root = self.root.canonicalize().unwrap(); assert!(root.starts_with(self.base.canonicalize().unwrap())); assert!(root.file_name().unwrap().to_string_lossy().starts_with("minecraft-instances-")); fs::remove_dir_all(root).unwrap(); } }
fn file(path: &str, client: &str) -> Value { json!({"path":path,"hashes":{"sha1":"a".repeat(40),"sha512":"b".repeat(128)},"downloads":["https://cdn.modrinth.com/data/test/versions/test/file.jar"],"fileSize":123,"env":{"client":client,"server":"unsupported"}}) }
fn index() -> Value { json!({"formatVersion":1,"game":"minecraft","versionId":"1.0","name":"Fixture pack","summary":"For tests only","dependencies":{"minecraft":"1.21.1","fabric-loader":"0.16.10"},"files":[file("mods/required.jar","required"),file("mods/optional.jar","optional"),file("mods/server.jar","unsupported")]}) }

#[test] fn minecraft_instance_storage_is_profile_isolated_and_staging_is_atomic() {
    let fixture = Fixture::new(); let path = fixture.root.to_str().unwrap();
    let before = instances::list("a", path).unwrap(); assert!(before.instances.is_empty());
    let value = instances::create("a", path, " My world ", "1.21.1").unwrap(); assert_eq!(value.name, "My world");
    assert_eq!(instances::list("a", path).unwrap().instances.len(), 1); assert!(instances::list("b", path).unwrap().instances.is_empty());
    let root = instances::library("a", path).unwrap();
    { let staging = instances::Staging::new(&root).unwrap(); fs::write(staging.path.join("game/unfinished.txt"), b"not installed").unwrap(); assert_eq!(instances::list("a", path).unwrap().instances.len(), 1); }
    assert!(fs::read_dir(&root).unwrap().all(|e| !e.unwrap().file_name().to_string_lossy().starts_with(".install-")));
    let game = instances::game_folder("a", path, &value.id).unwrap(); assert!(Path::new(&game).starts_with(&root)); fs::write(Path::new(&game).join("world.txt"), b"keep").unwrap();
    let renamed = instances::rename("a", path, &value.id, "Renamed").unwrap(); assert_eq!(renamed.id, value.id); assert_eq!(fs::read(Path::new(&game).join("world.txt")).unwrap(), b"keep");
    assert!(instances::name(&"世界".repeat(40))); assert!(instances::rename("a", path, &value.id, &"世界".repeat(40)).is_ok());
    assert!(instances::load(&root, "b", &value.id).is_err()); assert!(instances::load(&root, "a", "../outside").is_err());
    fs::write(root.join(&value.id).join(instances::RECORD), b"broken record").unwrap(); assert_eq!(instances::list("a", path).unwrap().unreadable, 1);
}
#[test] fn minecraft_pack_respects_client_layers_optional_files_and_server_exclusion() {
    let fixture = Fixture::new(); let archive = fixture.archive(&index(), &[("overrides/config/test.json", b"common"), ("client-overrides/config/test.json", b"client"), ("server-overrides/config/server.json", b"server")]);
    let cancel = AtomicBool::new(false); let parsed = pack::parse(&archive, &cancel).unwrap();
    assert_eq!(parsed.loader, "fabric"); assert_eq!(parsed.loader_version, "0.16.10"); assert_eq!(parsed.files.len(), 2); assert_eq!(parsed.skipped, 1); assert_eq!(parsed.overrides.len(), 1);
    assert_eq!(parsed.files[1].env["client"], "optional");
    let target = fixture.root.join("extract"); fs::create_dir(&target).unwrap(); pack::extract(&archive, &target, &parsed.overrides, &cancel).unwrap(); assert_eq!(fs::read(target.join("config/test.json")).unwrap(), b"client"); assert!(!target.join("config/server.json").exists());
    assert!(pack::parse(&archive, &AtomicBool::new(true)).is_err());
}
#[test] fn minecraft_pack_rejects_traversal_collisions_unknown_loaders_and_untrusted_downloads() {
    let fixture = Fixture::new(); let cancel = AtomicBool::new(false);
    for path in ["../outside.jar", "/absolute.jar", "C:/escape.jar", "mods\\file.jar", "mods/CON.jar", "mods/file.jar:ads", ".harbor-secret"] {
        let mut data = index(); data["files"][0]["path"] = json!(path); assert!(pack::parse(&fixture.archive(&data, &[]), &cancel).is_err(), "accepted {path}");
    }
    let mut data = index(); data["files"][1]["path"] = json!("MODS/REQUIRED.jar"); assert!(pack::parse(&fixture.archive(&data, &[]), &cancel).is_err());
    let mut data = index(); data["files"][0]["downloads"] = json!(["http://cdn.modrinth.com/file.jar", "https://localhost/private", "https://cdn.modrinth.com.evil.test/file"]); assert!(pack::parse(&fixture.archive(&data, &[]), &cancel).is_err());
    let mut data = index(); data["dependencies"]["unknown-loader"] = json!("1"); assert!(pack::parse(&fixture.archive(&data, &[]), &cancel).is_err());
    let mut data = index(); data["dependencies"]["forge"] = json!("1"); assert!(pack::parse(&fixture.archive(&data, &[]), &cancel).is_err());
    let mut data = index(); data["files"][0]["hashes"]["sha512"] = json!("invalid"); assert!(pack::parse(&fixture.archive(&data, &[]), &cancel).is_err());
    let mut data = index(); data["files"][0]["fileSize"] = json!(pack::MAX_FILE + 1); assert!(pack::parse(&fixture.archive(&data, &[]), &cancel).is_err());
    for entries in [vec![("overrides/../../escape", b"x" as &[u8])], vec![("overrides/config", b"x" as &[u8]),("client-overrides/config/a", b"y" as &[u8])]] { assert!(pack::parse(&fixture.archive(&index(), &entries), &cancel).is_err()); }
}
#[test] fn minecraft_pack_snapshot_changes_and_real_provider_archive_are_readable() {
    let fixture = Fixture::new(); let cancel = AtomicBool::new(false); let archive = fixture.archive(&index(), &[]); let old = pack::hash(&archive, &cancel).unwrap();
    fs::OpenOptions::new().append(true).open(&archive).unwrap().write_all(b"changed").unwrap(); assert_ne!(old, pack::hash(&archive, &cancel).unwrap());
    // Optional primary-provider fixture is supplied explicitly by the focused local QA run.
    if let Some(path) = std::env::var_os("HARBOR_MINECRAFT_PACK_FIXTURE") { let result = pack::parse(Path::new(&path), &cancel).unwrap(); assert!(!result.index.name.is_empty()); assert!(!result.files.is_empty()); }
}
