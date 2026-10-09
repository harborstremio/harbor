use super::*;
use std::{io::{Cursor, Write}, path::PathBuf};
use serde_json::json;

struct Fixture { base: PathBuf, root: PathBuf }
impl Fixture {
    fn new() -> Self { let base = std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir); fs::create_dir_all(&base).unwrap(); let root = base.join(format!("minecraft-pack-state-{}", uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap(); Self { base, root } }
    fn file(&self, path: &str, bytes: &[u8]) { let mut target = instances::create_file(&self.root, path).unwrap(); target.write_all(bytes).unwrap(); }
}
impl Drop for Fixture { fn drop(&mut self) { let root = self.root.canonicalize().unwrap(); assert!(root.starts_with(self.base.canonicalize().unwrap())); assert!(root.file_name().unwrap().to_string_lossy().starts_with("minecraft-pack-state-")); fs::remove_dir_all(root).unwrap(); } }
fn file(path: &str, body: &[u8]) -> File { File { path: path.into(), bytes: body.len() as u64, sha512: format!("{:x}", Sha512::digest(body)) } }
fn state(files: Vec<File>) -> Manifest { Manifest { schema: 1, archive: "a".repeat(128), files } }
fn scan(root: &Path, old: Vec<File>, new: Vec<File>) -> Review { review(root, &state(old), &state(new), &AtomicBool::new(false)).unwrap() }

#[test]
fn pack_update_diff_preserves_worlds_custom_settings_and_unmanaged_files() {
    let f = Fixture::new();
    for (path, bytes) in [("mods/old.jar", &b"old"[..]), ("mods/keep.jar", &b"same"[..]), ("config/custom.json", &b"my choice"[..]), ("config/default.json", &b"default"[..]), ("saves/world/level.dat", &b"my world"[..]), ("options.txt", &b"my controls"[..]), ("mods/my-extra.jar", &b"mine"[..])] { f.file(path, bytes); }
    let before = vec![file("mods/old.jar", b"old"), file("mods/keep.jar", b"same"), file("config/custom.json", b"default"), file("config/default.json", b"default"), file("saves/world/level.dat", b"my world"), file("options.txt", b"my controls")];
    let after = vec![file("mods/new.jar", b"new"), file("mods/keep.jar", b"same"), file("config/custom.json", b"new default"), file("config/default.json", b"new default"), file("saves/world/level.dat", b"template"), file("options.txt", b"new controls")];
    let result = scan(&f.root, before, after); let actions: BTreeMap<_, _> = result.changes.iter().map(|v| (v.path.as_str(), &v.action)).collect();
    assert_eq!(actions["mods/old.jar"], &Action::Remove); assert_eq!(actions["mods/new.jar"], &Action::Add); assert_eq!(actions["mods/keep.jar"], &Action::Unchanged); assert_eq!(actions["config/default.json"], &Action::Replace);
    for path in ["config/custom.json", "saves/world/level.dat", "options.txt"] { assert_eq!(actions[path], &Action::Preserve); }
    assert!(!actions.contains_key("mods/my-extra.jar")); assert_eq!(result.conflicts, 0); assert_eq!(result.preserved, 3); assert_eq!(result.bytes, 14);
    assert_eq!(fs::read(f.root.join("saves/world/level.dat")).unwrap(), b"my world"); assert_eq!(fs::read(f.root.join("config/custom.json")).unwrap(), b"my choice");
}

#[test]
fn pack_update_conflicts_never_claim_modified_or_unmanaged_code() {
    let f = Fixture::new(); f.file("mods/changed.jar", b"custom"); f.file("mods/unmanaged.jar", b"mine"); f.file("scripts/start.js", b"mine"); f.file("assets/mine.png", b"mine");
    let result = scan(&f.root, vec![file("mods/changed.jar", b"original")], vec![file("mods/unmanaged.jar", b"provider"), file("scripts/start.js", b"provider"), file("assets/mine.png", b"provider")]);
    assert_eq!(result.conflicts, 3); assert_eq!(result.preserved, 1); assert_eq!(result.bytes, 0);
    assert!(result.changes.iter().filter(|c| c.path != "assets/mine.png").all(|c| c.action == Action::Conflict));
}

#[test]
fn pack_receipts_reject_traversal_collisions_reserved_metadata_and_changed_hash_input() {
    for paths in [vec!["../escape"], vec!["mods/X.jar", "mods/x.jar"], vec!["mods", "mods/test.jar"], vec!["mods/.harbor-mods.json"], vec![".harbor-test/value"]] { assert!(validate(&state(paths.iter().map(|p| file(p, b"x")).collect())).is_err()); }
    assert!(hash(Cursor::new(b"longer"), 3, &AtomicBool::new(false)).is_err()); assert!(hash(Cursor::new(b"short"), 20, &AtomicBool::new(false)).is_err());
    assert_eq!(hash(Cursor::new(b"x"), 1, &AtomicBool::new(true)), Err("instance_canceled"));
    let f = Fixture::new(); f.file("mods", b"file, not folder"); assert!(observed(&f.root, "mods/new.jar", &AtomicBool::new(false)).is_err());
}

#[test]
fn pack_receipt_records_optional_selection_and_effective_client_overrides() {
    let f = Fixture::new(); let archive = f.root.join("fixture.mrpack");
    let item = |path: &str, client: &str| json!({"path":path,"hashes":{"sha1":"a".repeat(40),"sha512":"b".repeat(128)},"downloads":["https://cdn.modrinth.com/data/test/versions/test/file.jar"],"fileSize":3,"env":{"client":client}});
    let index = json!({"formatVersion":1,"game":"minecraft","versionId":"v1","name":"Fixture","dependencies":{"minecraft":"1.21.1","fabric-loader":"0.19.5"},"files":[item("mods/required.jar","required"),item("mods/optional.jar","optional"),item("mods/server.jar","unsupported"),item("config/client.json","required")]});
    let mut zip = zip::ZipWriter::new(fs::File::create(&archive).unwrap()); let options = zip::write::SimpleFileOptions::default();
    for (name, bytes) in [("modrinth.index.json", serde_json::to_vec(&index).unwrap()), ("overrides/config/client.json", b"common".to_vec()), ("client-overrides/config/client.json", b"client".to_vec())] { zip.start_file(name, options).unwrap(); zip.write_all(&bytes).unwrap(); } zip.finish().unwrap();
    let cancel = AtomicBool::new(false); let parsed = pack::parse(&archive, &cancel).unwrap();
    let receipt = manifest(&parsed, &archive, &HashSet::new(), &cancel).unwrap(); assert_eq!(receipt.files.len(), 2); assert_eq!(receipt.files[0], file("config/client.json", b"client"));
    let selected = HashSet::from(["mods/optional.jar".into()]); assert_eq!(manifest(&parsed, &archive, &selected, &cancel).unwrap().files.len(), 3);
    assert!(manifest(&parsed, &archive, &HashSet::from(["mods/server.jar".into()]), &cancel).is_err());
}
