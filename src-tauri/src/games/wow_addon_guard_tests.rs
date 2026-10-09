use super::*;
use std::os::windows::process::CommandExt;

struct Fixture {
    base: PathBuf,
    root: PathBuf,
}
impl Fixture {
    fn new() -> Self {
        let base = PathBuf::from(
            std::env::var("HARBOR_GAME_TEST_ROOT").expect("Use an isolated native test directory"),
        );
        fs::create_dir_all(&base).unwrap();
        let base = p2p_files::plain_dir(&base).unwrap();
        let root = base.join(format!("wow-guard-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        Self { base, root }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let root = p2p_files::plain_dir(&self.root).unwrap();
        assert_eq!(root.parent(), Some(self.base.as_path()));
        assert!(root
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("wow-guard-"));
        fs::remove_dir_all(root).unwrap();
    }
}

#[test]
fn only_recognized_game_processes_and_exact_editions_match() {
    for name in ["WoW.exe", "WOWCLASSIC.EXE", "wow-64.exe", "WowClassicT.exe"] {
        assert!(wow_process(name));
    }
    for name in [
        "Wowhead.exe",
        "Battle.net.exe",
        "NotWoW.exe",
        "Wow.exe.backup",
        "Harbor.exe",
    ] {
        assert!(!wow_process(name));
    }
    assert_eq!(executable_name("battlenet:wow").unwrap(), "Wow.exe");
    assert_eq!(
        executable_name("battlenet:wow_classic_anniversary").unwrap(),
        "WowClassic.exe"
    );
    assert!(executable_name("battlenet:wowt").is_err());
    assert!(Guard::acquire("unknown:game").is_err());
}

#[test]
fn native_snapshot_reports_a_real_result_without_process_mutation() {
    assert!(matches!(idle(), Ok(()) | Err("wow_addons_running")));
}

#[test]
fn exclusive_handle_rejects_reads_writes_and_renames_until_released() {
    let fixture = Fixture::new();
    let path = fixture.root.join("client.exe");
    fs::write(&path, b"fixture version one").unwrap();
    let before = stamp(&fs::symlink_metadata(&path).unwrap()).unwrap();
    let held = hold(&path, &before).unwrap();
    assert!(fs::File::open(&path).is_err());
    assert!(fs::OpenOptions::new().write(true).open(&path).is_err());
    assert!(fs::rename(&path, fixture.root.join("replaced.exe")).is_err());
    drop(held);
    assert_eq!(fs::read(&path).unwrap(), b"fixture version one");
}

#[test]
fn changed_binary_and_review_environment_are_rejected() {
    let fixture = Fixture::new();
    let path = fixture.root.join("client.exe");
    fs::write(&path, b"first").unwrap();
    let before = stamp(&fs::symlink_metadata(&path).unwrap()).unwrap();
    fs::write(&path, b"replacement of a different length").unwrap();
    assert_eq!(hold(&path, &before).err().unwrap(), "wow_addons_changed");
    let file = hold(
        &path,
        &stamp(&fs::symlink_metadata(&path).unwrap()).unwrap(),
    )
    .unwrap();
    let guard = Guard {
        root: fixture.root.clone(),
        version: "12.1.0.1".into(),
        _executable: file,
    };
    assert!(guard.matches(&fixture.root, "12.1.0.1").is_ok());
    assert_eq!(
        guard.matches(&fixture.root, "12.1.1.1").unwrap_err(),
        "wow_addons_changed"
    );
    assert_eq!(
        guard.matches(&fixture.base, "12.1.0.1").unwrap_err(),
        "wow_addons_changed"
    );
}

#[test]
fn exclusive_handle_blocks_starting_a_benign_fixture_executable() {
    let fixture = Fixture::new();
    // Copy a small trusted Windows utility into the isolated fixture; no game
    // binary is copied or started. The child only exits with status zero.
    let source = PathBuf::from(std::env::var_os("SystemRoot").unwrap()).join("System32/cmd.exe");
    let path = fixture.root.join("harbor-guard-fixture.exe");
    fs::copy(source, &path).unwrap();
    let held = hold(
        &path,
        &stamp(&fs::symlink_metadata(&path).unwrap()).unwrap(),
    )
    .unwrap();
    let run = || {
        std::process::Command::new(&path)
            .args(["/D", "/C", "exit", "/B", "0"])
            .creation_flags(0x08000000)
            .status()
    };
    assert!(run().is_err());
    drop(held);
    assert!(run().unwrap().success());
}
