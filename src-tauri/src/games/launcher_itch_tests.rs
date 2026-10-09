use super::*;
use std::fs;

struct Fixture {
    root: PathBuf,
    db: PathBuf,
    conn: Connection,
}
impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("harbor-itch-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("games/one")).unwrap();
        let db = root.join("butler.db");
        let conn = Connection::open(&db).unwrap();
        conn.execute_batch("CREATE TABLE games(id INTEGER PRIMARY KEY,title TEXT,classification TEXT,cover_url TEXT,still_cover_url TEXT);
          CREATE TABLE install_locations(id TEXT PRIMARY KEY,path TEXT);
          CREATE TABLE caves(id TEXT PRIMARY KEY,game_id INTEGER,upload_id INTEGER,custom_install_folder TEXT,
            install_location_id TEXT,install_folder_name TEXT,installed_at TEXT,morphing INTEGER);
          CREATE TABLE profiles(id INTEGER PRIMARY KEY,api_key TEXT);
          INSERT INTO profiles VALUES(77,'private-account-secret-do-not-export');
          INSERT INTO games VALUES(123,'A real title','game','https://img.itch.zone/aW1n/example.gif','https://img.itch.zone/aW1n/example.png');
          INSERT INTO games VALUES(124,'Creator tool','tool',NULL,NULL);
          INSERT INTO games VALUES(125,'Comic book','comic',NULL,NULL);").unwrap();
        conn.execute(
            "INSERT INTO install_locations VALUES('main',?1)",
            [root.join("games").to_str().unwrap()],
        )
        .unwrap();
        Self { root, db, conn }
    }
    fn add(&self, game: i64, upload: i64) -> String {
        let id = uuid::Uuid::new_v4().to_string();
        self.conn
            .execute(
                "INSERT INTO caves VALUES(?1,?2,?3,'','main','one','2026-10-03T10:00:00Z',0)",
                rusqlite::params![id, game, upload],
            )
            .unwrap();
        id
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        // This UUID directory is created and owned by this test only.
        let conn = std::mem::replace(&mut self.conn, Connection::open_in_memory().unwrap());
        drop(conn);
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[test]
fn discovers_selected_client_version_without_using_paths_from_state() {
    let f = Fixture::new();
    fs::create_dir_all(f.root.join("app-26.1.0")).unwrap();
    fs::write(f.root.join("app-26.1.0/itch.exe"), b"fixture only").unwrap();
    for (version, found) in [
        ("26.1.0", true),
        ("24.0.0", false),
        ("26/../../other", false),
        ("26.1.0 --arg", false),
        ("26.9.0", false),
    ] {
        fs::write(
            f.root.join("state.json"),
            serde_json::json!({"current":version}).to_string(),
        )
        .unwrap();
        assert_eq!(client(&f.root).is_some(), found, "{version}");
    }
}

#[test]
fn reads_games_and_tools_with_original_art_and_separate_cave_identities() {
    let f = Fixture::new();
    let a = f.add(123, 400);
    let b = f.add(123, 401);
    f.add(124, 402);
    f.add(125, 403);
    let (games, warnings) = scan(&f.db);
    assert!(warnings.is_empty());
    assert_eq!(games.len(), 3);
    let first = games
        .iter()
        .find(|g| g.id == format!("itch:123:{a}"))
        .unwrap();
    assert_eq!(first.name, "A real title");
    assert_eq!(first.state, "installed");
    assert_eq!(
        first.artwork.as_ref().unwrap().capsule.as_deref(),
        Some("https://img.itch.zone/aW1n/example.png")
    );
    assert!(games.iter().any(|g| g.id == format!("itch:123:{b}")));
    assert!(!serde_json::to_string(&games)
        .unwrap()
        .contains("private-account-secret"));
}

#[test]
fn missing_incomplete_and_morphing_installs_are_not_launchable() {
    let f = Fixture::new();
    let id = f.add(123, 400);
    for statement in [
        "UPDATE caves SET installed_at=NULL",
        "UPDATE caves SET installed_at='now',morphing=1",
    ] {
        f.conn.execute_batch(statement).unwrap();
        assert_eq!(scan(&f.db).0[0].state, "incomplete");
        assert!(launch(&f.db, Path::new("itch.exe"), &format!("itch:123:{id}")).is_err());
    }
    f.conn
        .execute_batch("UPDATE caves SET morphing=0,install_folder_name='missing'")
        .unwrap();
    assert_eq!(scan(&f.db).0[0].state, "missing");
}

#[test]
fn constructs_exact_upload_handoff_and_rechecks_the_current_install() {
    let f = Fixture::new();
    let id = f.add(123, 400);
    f.add(123, 401);
    let client = f.root.join("itch.exe");
    let expected = LaunchPlan::Process {
        executable: client.clone(),
        args: vec!["itch://install?game_id=123&upload_id=400&launch".into()],
    };
    assert_eq!(
        launch(&f.db, &client, &format!("itch:123:{id}")).unwrap(),
        expected
    );
    f.conn
        .execute("UPDATE caves SET upload_id=777 WHERE id=?1", [&id])
        .unwrap();
    assert_eq!(
        launch(&f.db, &client, &format!("itch:123:{id}")).unwrap(),
        LaunchPlan::Process {
            executable: client.clone(),
            args: vec!["itch://install?game_id=123&upload_id=777&launch".into()]
        }
    );
    f.conn
        .execute("DELETE FROM caves WHERE id=?1", [&id])
        .unwrap();
    assert!(launch(&f.db, &client, &format!("itch:123:{id}")).is_err());
    assert!(launch(&f.db, &client, "itch:123:--bad-argument").is_err());
}

#[test]
fn identical_uploads_require_client_choice_without_merging_caves() {
    let f = Fixture::new();
    let id = f.add(123, 400);
    f.add(123, 400);
    let (games, warnings) = scan(&f.db);
    assert!(warnings.is_empty());
    assert_eq!(games.len(), 2);
    assert!(games.iter().all(|g| g.launch_mode == "client"));
    assert_eq!(
        launch(&f.db, Path::new("itch.exe"), &format!("itch:123:{id}")).unwrap(),
        LaunchPlan::Process {
            executable: PathBuf::from("itch.exe"),
            args: vec!["itch://library/installed".into()]
        }
    );
}

#[test]
fn reads_custom_folders_and_rejects_traversal_and_network_paths() {
    let f = Fixture::new();
    f.add(123, 400);
    f.conn
        .execute(
            "UPDATE caves SET custom_install_folder=?1,install_location_id='absent'",
            [f.root.join("games/one").to_str().unwrap()],
        )
        .unwrap();
    assert_eq!(scan(&f.db).0[0].state, "installed");
    for path in [
        r"\\server\share\game",
        r"C:\Games\..\wrong",
        "relative/game",
    ] {
        f.conn
            .execute("UPDATE caves SET custom_install_folder=?1", [path])
            .unwrap();
        let (games, warnings) = scan(&f.db);
        assert!(games.is_empty());
        assert_eq!(warnings, vec!["itch_library_partial"]);
    }
    f.conn.execute_batch("UPDATE caves SET custom_install_folder='',install_location_id='main',install_folder_name='../outside'").unwrap();
    assert!(scan(&f.db).0.is_empty());
}

#[test]
fn rejects_damaged_rows_without_losing_healthy_games() {
    let f = Fixture::new();
    f.add(123, 400);
    f.add(999, 500);
    let invalid = f.add(124, 501);
    f.conn
        .execute("UPDATE caves SET id='not-a-uuid' WHERE id=?1", [invalid])
        .unwrap();
    let (games, warnings) = scan(&f.db);
    assert_eq!(games.len(), 1);
    assert_eq!(warnings, vec!["itch_library_partial"]);
    f.conn
        .execute(
            "UPDATE caves SET custom_install_folder=?1 WHERE game_id=123",
            ["x".repeat(32_001)],
        )
        .unwrap();
    assert!(
        scan(&f.db).0.is_empty(),
        "oversized custom path must not fall back to another folder"
    );
}

#[test]
fn read_only_scan_sees_committed_wal_data_without_changing_database_or_credentials() {
    let f = Fixture::new();
    f.conn
        .execute_batch("PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;")
        .unwrap();
    f.add(123, 400);
    let db = fs::read(&f.db).unwrap();
    let wal = fs::read(f.db.with_extension("db-wal")).unwrap();
    let readonly = database(&f.db).unwrap();
    assert!(readonly.execute_batch("DELETE FROM profiles").is_err());
    drop(readonly);
    assert_eq!(scan(&f.db).0.len(), 1);
    assert_eq!(fs::read(&f.db).unwrap(), db);
    assert_eq!(fs::read(f.db.with_extension("db-wal")).unwrap(), wal);
    f.add(124, 401);
    assert_eq!(scan(&f.db).0.len(), 2);
    assert_eq!(
        f.conn
            .query_row("SELECT api_key FROM profiles", [], |r| r
                .get::<_, String>(0))
            .unwrap(),
        "private-account-secret-do-not-export"
    );
}

#[test]
fn missing_corrupt_or_unknown_databases_report_errors_without_creating_files() {
    let f = Fixture::new();
    let missing = f.root.join("absent.db");
    assert_eq!(scan(&missing).1, vec!["itch_database_unreadable"]);
    assert!(!missing.exists());
    let corrupt = f.root.join("corrupt.db");
    fs::write(&corrupt, b"not sqlite").unwrap();
    assert!(!scan(&corrupt).1.is_empty());
    f.conn.execute_batch("DROP TABLE games").unwrap();
    assert_eq!(scan(&f.db).1, vec!["itch_database_schema"]);
}

#[test]
fn row_limit_is_reported_and_no_large_cell_is_exported() {
    let mut f = Fixture::new();
    let tx = f.conn.transaction().unwrap();
    for _ in 0..=MAX_ROWS {
        tx.execute(
            "INSERT INTO caves VALUES(?1,123,400,'','main','one','now',0)",
            [uuid::Uuid::new_v4().to_string()],
        )
        .unwrap();
    }
    tx.commit().unwrap();
    let (games, warnings) = scan(&f.db);
    assert_eq!(games.len(), MAX_ROWS);
    assert_eq!(warnings, vec!["itch_library_limit"]);
    f.conn
        .execute("UPDATE games SET title=?1 WHERE id=123", ["x".repeat(2049)])
        .unwrap();
    assert!(scan(&f.db).0.is_empty());
}

#[test]
fn artwork_accepts_only_public_itch_images() {
    assert!(cover("https://img.itch.zone/aW1n/image%23.png").is_some());
    for url in [
        "http://img.itch.zone/a.png",
        "https://img.itch.zone.evil.test/a.png",
        "https://secret@img.itch.zone/a.png",
        "https://img.itch.zone/a.png?token=secret",
        "file:///C:/private.png",
    ] {
        assert!(cover(url).is_none(), "{url}");
    }
}

#[test]
fn main_scan_and_launch_use_the_itch_adapter_and_preserve_other_providers() {
    let f = Fixture::new();
    let id = f.add(123, 400);
    let executable = f.root.join("itch.exe");
    fs::write(&executable, b"fixture only").unwrap();
    let input = || {
        let mut inputs = super::super::Inputs::default();
        inputs.itch_db = Some(f.db.clone());
        inputs.clients.insert(Launcher::Itch, executable.clone());
        inputs
    };
    let scan = super::super::scan_inputs(input());
    assert_eq!(scan.games.len(), 1);
    assert!(scan
        .clients
        .iter()
        .any(|c| c.launcher == Launcher::Itch && c.installed));
    assert!(super::super::plan(input(), &format!("itch:123:{id}")).is_ok());
    fs::remove_file(&executable).unwrap();
    assert_eq!(
        super::super::plan(input(), &format!("itch:123:{id}")),
        Err("launcher_client_missing")
    );
}
