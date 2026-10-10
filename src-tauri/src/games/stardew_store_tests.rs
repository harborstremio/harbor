use super::*;
use serde_json::json;
use std::{
    cell::Cell,
    io::{Cursor, Write},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("HARBOR_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let path = base.join(format!("harbor-stardew-store-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(path.join("Mods")).unwrap();
        fs::write(path.join("Stardew Valley.dll"), b"fixture only").unwrap();
        fs::write(path.join("Stardew Valley.exe"), b"fixture only").unwrap();
        if let Some(dll) = std::env::var_os("HARBOR_TEST_SMAPI_DLL") {
            fs::copy(dll, path.join("StardewModdingAPI.dll")).unwrap();
        }
        Self(path)
    }
    fn store(&self) -> Store {
        Store::connect(self.0.to_str().unwrap()).unwrap()
    }
    fn value(&self, name: &str) -> String {
        fs::read_to_string(self.0.join(name)).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}
fn archive(version: &str) -> Vec<u8> {
    let manifest = json!({"Name":"Test farm","Author":"Fixture","UniqueID":"Fixture.Farm","Version":version,"EntryDll":"mod.dll"});
    let mut z = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (name, data) in [
        ("manifest.json", serde_json::to_vec(&manifest).unwrap()),
        ("mod.dll", version.as_bytes().to_vec()),
        ("config.json", br#"{"setting":"default"}"#.to_vec()),
        (
            if version == "1.0.0" {
                "old.txt"
            } else {
                "new.txt"
            },
            b"release data".to_vec(),
        ),
    ] {
        z.start_file(
            format!("Farm/{name}"),
            zip::write::SimpleFileOptions::default(),
        )
        .unwrap();
        z.write_all(&data).unwrap();
    }
    z.finish().unwrap().into_inner()
}
fn package(version: &str) -> Package {
    package::unpack(&archive(version), &|| Ok(())).unwrap()
}
fn apply(store: &Store, plan: Plan) -> State {
    store.apply(plan, &|| Ok(()), &|_| Ok(())).unwrap()
}
fn install(store: &Store, version: &str) -> State {
    apply(store, store.prepare(package(version), &|| Ok(())).unwrap())
}

#[test]
fn full_local_lifecycle_preserves_latest_settings_and_generated_data() {
    let f = Fixture::new();
    let store = f.store();
    let initial = install(&store, "1.0.0");
    assert_eq!(initial.groups.len(), 1);
    fs::write(f.0.join("Mods/Farm/config.json"), b"custom setting").unwrap();
    fs::create_dir(f.0.join("Mods/Farm/data")).unwrap();
    fs::write(f.0.join("Mods/Farm/data/farm.json"), b"generated farm data").unwrap();
    let disabled = apply(&store, store.toggle("Fixture.Farm", &|| Ok(())).unwrap());
    assert!(!disabled.groups[0].enabled);
    assert!(!f.0.join("Mods/Farm").exists());
    assert!(
        super::super::stardew::scan(f.0.to_str().unwrap(), &|| Ok(()), &|_| Ok(()))
            .unwrap()
            .mods
            .is_empty()
    );
    let enabled = apply(&store, store.toggle("Fixture.Farm", &|| Ok(())).unwrap());
    assert!(enabled.groups[0].enabled);
    let updated = install(&store, "2.0.0");
    assert_eq!(updated.groups[0].version, "2.0.0");
    assert_eq!(f.value("Mods/Farm/config.json"), "custom setting");
    assert_eq!(f.value("Mods/Farm/data/farm.json"), "generated farm data");
    assert!(!f.0.join("Mods/Farm/old.txt").exists());
    assert!(f.0.join("Mods/Farm/new.txt").exists());
    fs::write(f.0.join("Mods/Farm/config.json"), b"newest setting").unwrap();
    fs::write(f.0.join("Mods/Farm/data/farm.json"), b"newest farm data").unwrap();
    let restored = apply(
        &store,
        store
            .restore(&updated.backups[0].token, &|| Ok(()))
            .unwrap(),
    );
    assert_eq!(restored.groups[0].version, "1.0.0");
    assert_eq!(f.value("Mods/Farm/config.json"), "newest setting");
    assert_eq!(f.value("Mods/Farm/data/farm.json"), "newest farm data");
    let removed = apply(&store, store.removal("Fixture.Farm", &|| Ok(())).unwrap());
    assert!(removed.groups.is_empty());
    assert!(!f.0.join("Mods/Farm").exists());
    let undo = apply(
        &store,
        store
            .restore(&removed.backups.last().unwrap().token, &|| Ok(()))
            .unwrap(),
    );
    assert_eq!(undo.groups[0].version, "1.0.0");
    assert_eq!(f.value("Mods/Farm/config.json"), "newest setting");
    assert_eq!(f.value("Mods/Farm/data/farm.json"), "newest farm data");
    assert!(!store.pending().unwrap());
}

#[test]
fn preview_is_bound_to_files_and_state_and_does_not_overwrite_unmanaged_mods() {
    let f = Fixture::new();
    let store = f.store();
    let plan = store.prepare(package("1.0.0"), &|| Ok(())).unwrap();
    assert!(!f.0.join("Mods/Farm").exists());
    assert!(store.load().unwrap().groups.is_empty());
    let duplicate = store.prepare(package("1.0.0"), &|| Ok(())).unwrap();
    apply(&store, plan);
    assert_eq!(
        store.apply(duplicate, &|| Ok(()), &|_| Ok(())).unwrap_err(),
        "stardew_changed"
    );
    let stale = store.prepare(package("2.0.0"), &|| Ok(())).unwrap();
    fs::write(f.0.join("Mods/Farm/config.json"), b"changed after review").unwrap();
    assert_eq!(
        store.apply(stale, &|| Ok(()), &|_| Ok(())).unwrap_err(),
        "stardew_changed"
    );
    assert_eq!(f.value("Mods/Farm/mod.dll"), "1.0.0");
    fs::write(f.0.join("Mods/Farm/mod.dll"), b"user modified code").unwrap();
    assert_eq!(
        store.prepare(package("2.0.0"), &|| Ok(())).err(),
        Some("stardew_changed")
    );
    assert!(!store.pending().unwrap());
    drop(store);
    let other = Fixture::new();
    let p = package("1.0.0");
    fs::create_dir(other.0.join("Mods/Existing")).unwrap();
    for file in p.files {
        fs::write(
            other.0.join("Mods/Existing").join(file.stamp.name),
            file.bytes,
        )
        .unwrap();
    }
    assert_eq!(
        other.store().prepare(package("2.0.0"), &|| Ok(())).err(),
        Some("stardew_unmanaged")
    );
}

#[test]
fn update_refuses_new_release_files_colliding_with_generated_files() {
    let f = Fixture::new();
    let store = f.store();
    install(&store, "1.0.0");
    fs::write(f.0.join("Mods/Farm/new.txt"), b"user data").unwrap();
    assert_eq!(
        store.prepare(package("2.0.0"), &|| Ok(())).err(),
        Some("stardew_conflict")
    );
    assert_eq!(f.value("Mods/Farm/new.txt"), "user data");
    assert_eq!(f.value("Mods/Farm/mod.dll"), "1.0.0");
}

#[test]
fn failures_before_commit_restore_previous_files_and_keep_prepared_data() {
    for at in ["staging", "moved"] {
        let f = Fixture::new();
        let store = f.store();
        let old = install(&store, "1.0.0");
        let plan = store.prepare(package("2.0.0"), &|| Ok(())).unwrap();
        let fired = Cell::new(false);
        let result = store.apply(plan, &|| Ok(()), &|phase| {
            if phase == at && !fired.replace(true) {
                Err("stardew_write")
            } else {
                Ok(())
            }
        });
        assert_eq!(result.unwrap_err(), "stardew_write");
        assert_eq!(store.load().unwrap(), old);
        assert_eq!(f.value("Mods/Farm/mod.dll"), "1.0.0");
        assert!(!store.pending().unwrap());
        assert!(fs::read_dir(&store.base).unwrap().any(|p| p
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with("kept-")));
    }
    let f = Fixture::new();
    let store = f.store();
    let plan = store.prepare(package("1.0.0"), &|| Ok(())).unwrap();
    let state = store
        .apply(plan, &|| Ok(()), &|phase| {
            if phase == "committed" {
                Err("stardew_write")
            } else {
                Ok(())
            }
        })
        .unwrap();
    assert_eq!(state.groups.len(), 1);
    assert!(!store.pending().unwrap());
}

#[test]
fn cancellation_before_publication_changes_no_live_files() {
    let f = Fixture::new();
    let store = f.store();
    let old = install(&store, "1.0.0");
    let plan = store.prepare(package("2.0.0"), &|| Ok(())).unwrap();
    let cancelled = Cell::new(false);
    assert_eq!(
        store
            .apply(
                plan,
                &|| if cancelled.get() {
                    Err("stardew_canceled")
                } else {
                    Ok(())
                },
                &|phase| {
                    if phase == "staging" {
                        cancelled.set(true)
                    }
                    Ok(())
                }
            )
            .unwrap_err(),
        "stardew_canceled"
    );
    assert_eq!(store.load().unwrap(), old);
    assert_eq!(f.value("Mods/Farm/mod.dll"), "1.0.0");
    assert!(!store.pending().unwrap());
}

#[test]
fn creator_zip_uses_the_same_native_transaction() {
    let Some(path) = std::env::var_os("HARBOR_TEST_STARDEW_ZIP") else {
        return;
    };
    let f = Fixture::new();
    let store = f.store();
    let bytes = fs::read(path).unwrap();
    let package = package::unpack(&bytes, &|| Ok(())).unwrap();
    let state = apply(&store, store.prepare(package, &|| Ok(())).unwrap());
    assert_eq!(state.groups[0].id, "Annosz.UiInfoSuite2");
    assert_eq!(
        files::tree(&f.0.join("Mods/UIInfoSuite2"), &|| Ok(())).unwrap(),
        state.groups[0].files
    );
    let removed = apply(
        &store,
        store.removal("Annosz.UiInfoSuite2", &|| Ok(())).unwrap(),
    );
    assert!(removed.groups.is_empty());
}

#[test]
#[ignore]
fn crash_worker() {
    let root = PathBuf::from(std::env::var_os("HARBOR_STARDEW_CRASH_ROOT").unwrap());
    let at = std::env::var("HARBOR_STARDEW_CRASH_AT").unwrap();
    let store = Store::connect(root.to_str().unwrap()).unwrap();
    let plan = store.prepare(package("2.0.0"), &|| Ok(())).unwrap();
    let moves = Cell::new(0);
    store
        .apply(plan, &|| Ok(()), &|phase| {
            if phase == "moved" {
                moves.set(moves.get() + 1)
            }
            let current = if phase == "moved" {
                format!("moved{}", moves.get())
            } else {
                phase.into()
            };
            if current == at {
                fs::write(root.join("proof-boundary"), at.as_bytes()).unwrap();
                loop {
                    thread::sleep(Duration::from_millis(50));
                }
            }
            Ok(())
        })
        .unwrap();
}

#[test]
fn actual_process_termination_recovers_both_folder_boundaries_and_committed_state() {
    for at in ["staging", "moved1", "moved2", "committed"] {
        let f = Fixture::new();
        {
            let store = f.store();
            install(&store, "1.0.0");
        }
        fs::write(f.0.join("Mods/Farm/config.json"), b"survives process death").unwrap();
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "stardew_store::tests::crash_worker",
                "--ignored",
                "--exact",
                "--nocapture",
            ])
            .env("HARBOR_STARDEW_CRASH_ROOT", &f.0)
            .env("HARBOR_STARDEW_CRASH_AT", at)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(15);
        while !f.0.join("proof-boundary").exists() && Instant::now() < deadline {
            if let Some(status) = child.try_wait().unwrap() {
                panic!("worker exited early: {status}")
            };
            thread::sleep(Duration::from_millis(10));
        }
        if !f.0.join("proof-boundary").exists() {
            let _ = child.kill();
            let _ = child.wait();
            panic!("worker did not reach {at}")
        }
        child.kill().unwrap();
        child.wait().unwrap();
        let store = f.store();
        assert!(store.pending().unwrap());
        let recovered = store.recover().unwrap();
        assert!(!store.pending().unwrap());
        let expected = if at == "committed" { "2.0.0" } else { "1.0.0" };
        assert_eq!(recovered.groups[0].version, expected);
        assert_eq!(f.value("Mods/Farm/mod.dll"), expected);
        assert_eq!(f.value("Mods/Farm/config.json"), "survives process death");
    }
}

#[test]
fn required_framework_cannot_be_disabled_removed_or_downgraded() {
    let f = Fixture::new();
    let store = f.store();
    install(&store, "2.0.0");
    fs::create_dir(f.0.join("Mods/Pack")).unwrap();
    fs::write(f.0.join("Mods/Pack/manifest.json"),serde_json::to_vec(&json!({"Name":"Pack","Author":"Fixture","UniqueID":"Fixture.Pack","Version":"1.0","ContentPackFor":{"UniqueID":"Fixture.Farm","MinimumVersion":"2.0"}})).unwrap()).unwrap();
    let remove = store.removal("Fixture.Farm", &|| Ok(())).unwrap();
    assert_eq!(
        store.apply(remove, &|| Ok(()), &|_| Ok(())).unwrap_err(),
        "stardew_dependents"
    );
    let disable = store.toggle("Fixture.Farm", &|| Ok(())).unwrap();
    assert_eq!(
        store.apply(disable, &|| Ok(()), &|_| Ok(())).unwrap_err(),
        "stardew_dependents"
    );
    let downgrade = store.prepare(package("1.0.0"), &|| Ok(())).unwrap();
    assert_eq!(
        store.apply(downgrade, &|| Ok(()), &|_| Ok(())).unwrap_err(),
        "stardew_dependents"
    );
    assert_eq!(f.value("Mods/Farm/mod.dll"), "2.0.0");
    assert!(!store.pending().unwrap());
}
#[test]
fn interrupted_recovery_does_not_overwrite_later_edits() {
    let f = Fixture::new();
    {
        let store = f.store();
        install(&store, "1.0.0");
    }
    let mut child = Command::new(std::env::current_exe().unwrap())
        .args(["stardew_store::tests::crash_worker", "--ignored", "--exact"])
        .env("HARBOR_STARDEW_CRASH_ROOT", &f.0)
        .env("HARBOR_STARDEW_CRASH_AT", "moved1")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(15);
    while !f.0.join("proof-boundary").exists() && Instant::now() < deadline {
        thread::sleep(Duration::from_millis(10));
    }
    child.kill().unwrap();
    child.wait().unwrap();
    assert!(f.0.join("proof-boundary").exists());
    let store = f.store();
    let j: Journal = files::json(&store.base.join("journal.json")).unwrap();
    let edited = store
        .path(&Area::Vault(j.token.clone()))
        .unwrap()
        .join("config.json");
    fs::write(&edited, b"edited after crash").unwrap();
    assert_eq!(store.recover().unwrap_err(), "stardew_changed");
    assert_eq!(fs::read(&edited).unwrap(), b"edited after crash");
    assert!(store.pending().unwrap());
}
