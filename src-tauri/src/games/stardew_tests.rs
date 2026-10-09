use super::*;
use serde_json::{json, Value};
use std::{cell::Cell, path::PathBuf};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("HARBOR_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!("harbor-stardew-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("Mods")).unwrap();
        // A marker is sufficient for filesystem tests; no game is executed.
        fs::write(root.join("Stardew Valley.dll"), b"test marker, not a game").unwrap();
        Self(root)
    }
    fn write(&self, relative: &str, bytes: &[u8]) {
        let path = self.0.join(relative);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }
    fn add(&self, folder: &str, value: Value) {
        self.write(
            &format!("Mods/{folder}/manifest.json"),
            &serde_json::to_vec(&value).unwrap(),
        );
        if let Some(dll) = value["EntryDll"].as_str() {
            self.write(&format!("Mods/{folder}/{dll}"), b"not executed");
        }
    }
    fn scan(&self) -> Inventory {
        scan(self.0.to_str().unwrap(), &|| Ok(()), &|_| Ok(())).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}
fn manifest(id: &str) -> Value {
    json!({"Name":id,"Author":"Fixture","UniqueID":id,"Version":"1.0.0","EntryDll":"mod.dll"})
}

#[test]
fn follows_smapi_organizational_folders_and_stops_at_real_mod_assets() {
    let f = Fixture::new();
    f.add("Grouping/Real", manifest("A.Real"));
    f.write("Mods/Grouping/readme.md", b"documentation");
    f.add("Grouping/Real/assets/Fake", manifest("A.Fake"));
    f.add(".Disabled", manifest("A.Disabled"));
    f.add("__MACOSX", manifest("A.MacJunk"));
    f.write("Mods/root-config.json", b"{}");
    let inv = f.scan();
    assert!(!inv.partial);
    assert_eq!(inv.mods.len(), 1);
    assert_eq!(inv.mods[0].manifest.id, "A.Real");
    assert_eq!(inv.mods[0].folder, "Grouping/Real");
    let original = fs::read(f.0.join("Mods/Grouping/Real/manifest.json")).unwrap();
    assert_eq!(inv.fingerprint, f.scan().fingerprint);
    assert_eq!(
        original,
        fs::read(f.0.join("Mods/Grouping/Real/manifest.json")).unwrap()
    );
}

#[test]
fn diagnoses_declared_dependencies_without_claiming_runtime_compatibility() {
    let f = Fixture::new();
    f.add("Framework", manifest("A.Framework"));
    let mut prerelease = manifest("A.Preview");
    prerelease["Version"] = json!("2.0-beta.1");
    f.add("Preview", prerelease);
    f.add("Pack",json!({"Name":"Pack","Author":"A","UniqueID":"A.Pack","Version":"1","ContentPackFor":{"UniqueID":"A.Framework","MinimumVersion":"2"},"Dependencies":[{"UniqueID":"A.Missing"},{"UniqueID":"A.Optional","IsRequired":false},{"UniqueID":"A.Preview","MinimumVersion":"2.0"}],"MinimumApiVersion":"4.5","MinimumGameVersion":"1.6"}));
    let inv = f.scan();
    let pack = inv.mods.iter().find(|m| m.manifest.id == "A.Pack").unwrap();
    assert_eq!(
        pack.requirements
            .iter()
            .map(|r| r.status)
            .collect::<Vec<_>>(),
        [
            "older",
            "missing",
            "optional",
            "unchecked",
            "unchecked",
            "unchecked"
        ]
    );
    assert!(!pack.missing_dll);
    assert!(pack.requirements[0].required);
    f.add("Duplicate", manifest("a.framework"));
    let inv = f.scan();
    assert_eq!(inv.mods.iter().filter(|m| m.duplicate).count(), 2);
    assert_eq!(
        inv.mods
            .iter()
            .find(|m| m.manifest.id == "A.Pack")
            .unwrap()
            .requirements[0]
            .status,
        "duplicate"
    );
}

#[test]
fn incomplete_scans_keep_absent_dependencies_unknown() {
    let f = Fixture::new();
    f.add("Broken", manifest("A.Broken"));
    fs::remove_file(f.0.join("Mods/Broken/mod.dll")).unwrap();
    let mut dependent = manifest("A.Dependent");
    dependent["Dependencies"] = json!([{"UniqueID":"A.Broken"},{"UniqueID":"A.Missing"}]);
    f.add("Dependent", dependent);
    f.write("Mods/Bad/manifest.json", b"{bad json}");
    let inv = f.scan();
    assert!(inv.partial);
    assert_eq!(inv.issues.len(), 1);
    let d = inv
        .mods
        .iter()
        .find(|m| m.manifest.id == "A.Dependent")
        .unwrap();
    assert_eq!(d.requirements[0].status, "unusable");
    assert_eq!(d.requirements[1].status, "unchecked");
    f.write("Mods/Large/manifest.json", &vec![b' '; 256 * 1024 + 1]);
    assert!(f.scan().issues.iter().any(|i| i.reason == "stardew_limit"));
}

#[test]
fn rejects_wrong_roots_and_reports_a_changed_inventory() {
    assert_eq!(
        scan("relative", &|| Ok(()), &|_| Ok(())).unwrap_err(),
        "stardew_folder"
    );
    let f = Fixture::new();
    f.add("One", manifest("A.One"));
    let before = f.scan().fingerprint;
    let mut changed = manifest("A.One");
    changed["Version"] = json!("2.0");
    f.add("One", changed);
    assert_ne!(before, f.scan().fingerprint);
    fs::remove_dir_all(f.0.join("Mods")).unwrap();
    assert_eq!(
        scan(f.0.to_str().unwrap(), &|| Ok(()), &|_| Ok(())).unwrap_err(),
        "stardew_mods_missing"
    );
}

#[test]
fn cancellation_stops_scanning_and_is_profile_scoped() {
    let f = Fixture::new();
    for n in 0..20 {
        f.add(&format!("Mod{n}"), manifest(&format!("A.Mod{n}")))
    }
    let calls = Cell::new(0);
    let check = || {
        calls.set(calls.get() + 1);
        if calls.get() > 10 {
            Err("stardew_canceled")
        } else {
            Ok(())
        }
    };
    assert_eq!(
        scan(f.0.to_str().unwrap(), &check, &|_| Ok(())).unwrap_err(),
        "stardew_canceled"
    );
    let id = uuid::Uuid::new_v4().to_string();
    let emit = |_| {};
    let work = Work::start("profile-a", &id, &emit).unwrap();
    assert!(!super::super::stardew_progress::cancel("profile-b", &id));
    assert!(work.check().is_ok());
    assert!(super::super::stardew_progress::cancel("profile-a", &id));
    assert_eq!(work.check(), Err("stardew_canceled"));
    drop(work);
    assert!(!super::super::stardew_progress::cancel("profile-a", &id));
    assert_eq!(f.scan().mods.len(), 20);
}

#[cfg(windows)]
#[test]
fn windows_reads_the_official_smapi_version_without_loading_it() {
    let Some(path) = std::env::var_os("HARBOR_TEST_SMAPI_DLL") else {
        return;
    };
    assert_eq!(version(Path::new(&path)).as_deref(), Some("4.5.2"));
    let f = Fixture::new();
    fs::copy(path, f.0.join("StardewModdingAPI.dll")).unwrap();
    assert_eq!(f.scan().smapi_version.as_deref(), Some("4.5.2"));
    assert_eq!(f.scan().game_version, None);
}
