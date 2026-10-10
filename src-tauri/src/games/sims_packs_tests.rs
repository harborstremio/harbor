use super::*;
use std::path::PathBuf;

fn scan(profile: &str, path: &str, operation: &str, emit: impl Fn(Progress)) -> Result<Report> {
    super::scan(profile, path, operation, &[], emit)
}

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let parent = std::env::var_os("HARBOR_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = parent.join(format!("harbor-sims-packs-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        Self(root.canonicalize().unwrap())
    }
    fn write(&self, name: &str, bytes: &[u8]) {
        let p = self.0.join(name);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, bytes).unwrap();
    }
    fn base(&self) {
        let mut pe = vec![0; 68];
        pe[..2].copy_from_slice(b"MZ");
        pe[60..64].copy_from_slice(&64u32.to_le_bytes());
        pe[64..68].copy_from_slice(b"PE\0\0");
        self.write("Game/Bin/TS4_x64.exe", &pe);
        self.write("Data/Client/ClientFullBuild0.package", &header());
    }
    fn scan(&self) -> Result<Report> {
        scan(
            "pack-test",
            self.0.to_str().unwrap(),
            &uuid::Uuid::new_v4().to_string(),
            |_| {},
        )
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        // Only remove the unique fixture this test created, never its parent.
        if self
            .0
            .file_name()
            .is_some_and(|v| v.to_string_lossy().starts_with("harbor-sims-packs-"))
            && fs::symlink_metadata(&self.0).is_ok_and(|m| m.is_dir() && !files::linked(&m))
            && self.0.canonicalize().ok().as_ref() == Some(&self.0)
        {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}
fn header() -> Vec<u8> {
    let mut h = vec![0; 100];
    h[..4].copy_from_slice(b"DBPF");
    h[4..8].copy_from_slice(&2u32.to_le_bytes());
    h[8..12].copy_from_slice(&1u32.to_le_bytes());
    h[36..40].copy_from_slice(&1u32.to_le_bytes());
    h[40..44].copy_from_slice(&96u32.to_le_bytes());
    h[44..48].copy_from_slice(&4u32.to_le_bytes());
    h
}
#[test]
fn validates_game_installation_instead_of_accepting_mods_or_empty_named_folders() {
    let f = Fixture::new();
    f.write("Mods/test.package", &header());
    assert_eq!(f.scan().unwrap_err(), "sims_packs_folder");
    f.base();
    assert!(f.scan().unwrap().packs.is_empty());
    f.write("Game/Bin/TS4_x64.exe", b"not an executable");
    assert_eq!(f.scan().unwrap_err(), "sims_packs_folder");
    f.base();
    f.write("Data/Client/ClientFullBuild0.package", b"not a package");
    assert_eq!(f.scan().unwrap_err(), "sims_packs_folder");
}
#[test]
fn reads_only_direct_full_build_content_and_does_not_count_delta_or_language_files() {
    let f = Fixture::new();
    f.base();
    for name in [
        "EP05/ClientFullBuild0.package",
        "EP05/SimulationFullBuild1.package",
        "Delta/EP07/ClientFullBuild0.package",
        "EP08/Strings_ENG_US.package",
        "EP09/ClientDeltaBuild0.package",
        "EP10/nested/ClientFullBuild0.package",
    ] {
        f.write(name, &header());
    }
    let report = f.scan().unwrap();
    assert!(!report.partial);
    assert_eq!(report.packs.len(), 4);
    assert_eq!(report.packs[0].code, "EP05");
    assert_eq!(report.packs[0].status, Status::Found);
    assert_eq!(report.packs[0].files.len(), 2);
    assert!(report
        .packs
        .iter()
        .skip(1)
        .all(|p| p.status == Status::Unchecked));
    assert!(!report.packs.iter().any(|p| p.code == "EP07"));
}
#[test]
fn corrupt_or_unreadable_companion_file_keeps_the_entire_pack_unconfirmed() {
    let f = Fixture::new();
    f.base();
    f.write("GP01/ClientFullBuild0.package", &header());
    let mut invalid = header();
    invalid[64..72].copy_from_slice(&u64::MAX.to_le_bytes());
    invalid[40..44].fill(0);
    f.write("GP01/SimulationFullBuild0.package", &invalid);
    f.write("FP01/ClientFullBuild0.package", &header()[..96]);
    let report = f.scan().unwrap();
    assert!(!report.partial);
    assert_eq!(report.packs.len(), 2);
    assert!(report.packs.iter().all(|p| p.status == Status::Unchecked));
}
#[test]
fn recognizes_pack_codes_without_relying_on_current_catalog_names() {
    let f = Fixture::new();
    f.base();
    for name in [
        "ep99/ClientFullBuild0.package",
        "SP84/SimulationFullBuild0.package",
        "EP100/ClientFullBuild0.package",
        "SPX1/ClientFullBuild0.package",
    ] {
        f.write(name, &header());
    }
    let report = f.scan().unwrap();
    assert_eq!(report.packs.len(), 2);
    assert!(report.packs.iter().all(|p| p.status == Status::Found));
    assert_eq!(report.packs[0].code, "EP99");
}
#[test]
fn directory_limits_are_partial_instead_of_silently_reporting_missing_packs() {
    let f = Fixture::new();
    f.base();
    for i in 0..MAX_ENTRIES {
        f.write(&format!("entry-{i}.txt"), b"");
    }
    assert!(f.scan().unwrap().partial);
    let p = Fixture::new();
    p.base();
    p.write("EP01/ClientFullBuild0.package", &header());
    for i in 0..MAX_PACK_FILES {
        p.write(&format!("EP01/entry-{i}.txt"), b"");
    }
    assert_eq!(p.scan().unwrap().packs[0].status, Status::Unchecked);
}
#[test]
fn registered_scan_cancellation_is_honored_before_any_content_read() {
    let f = Fixture::new();
    f.base();
    let id = uuid::Uuid::new_v4().to_string();
    assert_eq!(
        scan("cancel-packs", f.0.to_str().unwrap(), &id, |p| {
            if p.can_cancel {
                assert!(super::super::sims_store::progress::cancel(
                    "cancel-packs",
                    &id
                ));
            }
        })
        .unwrap_err(),
        "sims_canceled"
    );
    assert!(f.scan().is_ok());
}
#[test]
fn header_read_detects_a_file_changed_during_inspection() {
    let f = Fixture::new();
    f.write("content.package", &header());
    let path = f.0.join("content.package");
    let calls = std::cell::Cell::new(0);
    assert_eq!(
        package_header(&path, &|| {
            calls.set(calls.get() + 1);
            if calls.get() == 2 {
                fs::write(&path, b"replaced").unwrap();
            }
            Ok(())
        }),
        Err("sims_changed")
    );
}
#[cfg(windows)]
#[test]
fn junction_pack_is_not_followed_and_scan_does_not_modify_game_files() {
    let f = Fixture::new();
    let outside = Fixture::new();
    f.base();
    outside.write("ClientFullBuild0.package", &header());
    let link = f.0.join("EP01");
    let status = std::process::Command::new("cmd.exe")
        .args(["/d", "/c", "mklink", "/J"])
        .arg(&link)
        .arg(&outside.0)
        .output()
        .unwrap();
    assert!(
        status.status.success(),
        "{}",
        String::from_utf8_lossy(&status.stderr)
    );
    let before = fs::read(outside.0.join("ClientFullBuild0.package")).unwrap();
    assert_eq!(f.scan().unwrap().packs[0].status, Status::Unchecked);
    assert_eq!(
        before,
        fs::read(outside.0.join("ClientFullBuild0.package")).unwrap()
    );
    fs::remove_dir(&link).unwrap();
}
