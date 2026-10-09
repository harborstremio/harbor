use super::*;
use leveldb_sys::*;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, ffi::CString, fs, ptr};

struct Root(PathBuf);
impl Root {
    fn new() -> Self {
        let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("hydra-review-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }
}
impl Drop for Root {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}
fn hashes(path: &Path) -> BTreeMap<String, String> {
    fs::read_dir(path)
        .unwrap()
        .map(|entry| {
            let entry = entry.unwrap();
            (
                entry.file_name().to_str().unwrap().into(),
                format!("{:x}", Sha256::digest(fs::read(entry.path()).unwrap())),
            )
        })
        .collect()
}
fn fixture(path: &Path) {
    fs::create_dir_all(path).unwrap();
    unsafe {
        let options = leveldb_options_create();
        leveldb_options_set_create_if_missing(options, 1);
        let name = CString::new(path.to_str().unwrap()).unwrap();
        let mut error = ptr::null_mut();
        let database = leveldb_open(options, name.as_ptr(), &mut error);
        assert!(error.is_null());
        let write = leveldb_writeoptions_create();
        let rows = [
            (
                "!games!steam:123",
                json!({"title":"Community 日本", "shop":"steam", "objectId":"123", "isDeleted":false, "executablePath":"D:\\Games\\Café\\Game.exe", "launchOptions":"--name \"A B\"", "playTimeInMilliseconds":123456, "favorite":true, "isPinned":true, "token":"SYNTHETIC-SECRET"}),
            ),
            (
                "!games!custom:offline",
                json!({"title":"Not installed", "shop":"custom", "objectId":"offline", "isDeleted":false}),
            ),
            (
                "!games!custom:removed",
                json!({"title":"Removed", "shop":"custom", "objectId":"removed", "isDeleted":true}),
            ),
            (
                "!games!steam:124",
                json!({"title":"Wrong identity", "shop":"steam", "objectId":"999", "isDeleted":false}),
            ),
            (
                "!downloadSources!one",
                json!({"id":"one", "name":"Catalog", "url":"https://catalog.example/feed.json", "token":"SYNTHETIC-SECRET"}),
            ),
            (
                "!downloadSources!bad",
                json!({"id":"bad", "name":"Bad", "url":"file:///secret"}),
            ),
            ("!auth!account", json!({"token":"SYNTHETIC-SECRET"})),
        ];
        for (key, value) in rows {
            let bytes = serde_json::to_vec(&value).unwrap();
            leveldb_put(
                database,
                write,
                key.as_ptr().cast(),
                key.len(),
                bytes.as_ptr().cast(),
                bytes.len(),
                &mut error,
            );
            assert!(error.is_null());
        }
        leveldb_close(database);
        leveldb_writeoptions_destroy(write);
        leveldb_options_destroy(options);
    }
}
#[test]
fn native_snapshot_worker_returns_allowlisted_metadata_and_preserves_originals() {
    let root = Root::new();
    let source = root.0.join("input");
    fixture(&source);
    let before = hashes(&source);
    let scratch = root.0.join("快照 Café");
    let review = review_sync(
        &source,
        &scratch,
        &CancellationToken::new(),
        Instant::now() + WAIT,
    )
    .unwrap();
    assert_eq!(review.report.games.len(), 2);
    assert_eq!(review.report.sources.len(), 1);
    assert_eq!(review.report.deleted_games, 1);
    assert_eq!(review.report.invalid_games, 1);
    assert_eq!(review.report.invalid_sources, 1);
    let game = review
        .report
        .games
        .iter()
        .find(|g| g.key == "steam:123")
        .unwrap();
    assert_eq!(
        game.executable.as_deref(),
        Some("D:\\Games\\Café\\Game.exe")
    );
    assert_eq!(game.launch_options.as_deref(), Some("--name \"A B\""));
    assert_eq!(game.playtime_ms, Some(123456));
    assert!(game.pinned && game.favorite);
    assert!(review
        .report
        .games
        .iter()
        .find(|g| g.key == "custom:offline")
        .unwrap()
        .executable
        .is_none());
    assert!(!serde_json::to_string(&review)
        .unwrap()
        .contains("SYNTHETIC-SECRET"));
    assert_eq!(before, hashes(&source));
    assert_eq!(fs::read_dir(scratch).unwrap().count(), 0);
}
#[test]
fn cancellation_is_profile_scoped_bounded_and_blocks_dispatch() {
    let mut state = State::default();
    let now = Instant::now();
    let token = state.reserve("one", "active", now).unwrap();
    assert!(matches!(
        state.reserve("two", "next", now),
        Err("hydra_busy")
    ));
    state.cancel("two", "active", now);
    assert!(!token.is_cancelled());
    state.cancel("one", "active", now);
    assert!(token.is_cancelled());
    state.active = None;
    assert!(matches!(
        state.reserve("one", "active", now),
        Err("hydra_canceled")
    ));
    for i in 0..100 {
        state.cancel("one", &i.to_string(), now);
    }
    assert_eq!(state.canceled.len(), 32);
    assert!(state.reserve("one", "active", now + WAIT).is_ok());
    assert!(!owner("", &uuid::Uuid::new_v4().to_string()));
    assert!(!owner("one", "not-a-uuid"));
}
#[test]
fn malformed_optional_fields_are_flagged_without_discarding_the_game() {
    let mut report = model::Report::default();
    report.game(b"!games!custom:one",&serde_json::to_vec(&json!({"title":"Review me","shop":"custom","objectId":"one","executablePath":42,"launchOptions":"\u{0}","playTimeInMilliseconds":-1,"favorite":"yes"})).unwrap());
    assert_eq!(report.games.len(), 1);
    assert_eq!(report.invalid_games, 0);
    assert_eq!(report.games[0].issues.len(), 4);
    report.game(b"!games!custom:empty",&serde_json::to_vec(&json!({"title":"No options","shop":"custom","objectId":"empty","executablePath":"","launchOptions":"","winePrefixPath":null})).unwrap());
    assert!(report.games[1].issues.is_empty());
    assert!(report.games[1].launch_options.is_none());
}
#[test]
fn unsupported_launch_and_collection_settings_remain_visible_for_review() {
    let mut report = model::Report::default();
    report.game(b"!games!launchbox:disc",&serde_json::to_vec(&json!({"title":"Multi-disc","shop":"launchbox","objectId":"disc","trackingExecutablePaths":["D:/game/worker.exe"],"discs":[{"path":"D:/game/disc.cue"}],"collectionIds":["favorites"],"autoRunGamemode":true,"enableHydraPlaytimeTracking":false,"hasManuallyUpdatedPlaytime":true,"playTimeInMilliseconds":60000,"steamPlayTimeInMilliseconds":45000})).unwrap());
    assert_eq!(report.games.len(), 1);
    let game = &report.games[0];
    assert_eq!(game.issues.len(), 5);
    assert!(game.playtime_manually_edited);
    assert_eq!(game.playtime_ms, Some(60000));
    assert_eq!(game.steam_playtime_ms, Some(45000));
}
#[test]
fn active_worker_is_killed_on_cancel_and_deadline() {
    for canceled in [true, false] {
        let root = Root::new();
        let owned = root.0.join(uuid::Uuid::new_v4().to_string());
        fs::create_dir(&owned).unwrap();
        fs::write(owned.join("fixture-hold"), b"").unwrap();
        let token = CancellationToken::new();
        let control = token.clone();
        let path = owned.clone();
        let deadline = Instant::now()
            + if canceled {
                Duration::from_secs(10)
            } else {
                Duration::from_secs(2)
            };
        let thread = std::thread::spawn(move || worker::inspect(&path, &control, deadline));
        let started = Instant::now();
        while !owned.join("fixture-ready").is_file() && started.elapsed() < Duration::from_secs(5) {
            std::thread::sleep(Duration::from_millis(20));
        }
        assert!(
            owned.join("fixture-ready").is_file(),
            "worker never entered its hold"
        );
        if canceled {
            token.cancel();
        }
        let result = thread.join().unwrap();
        assert!(
            matches!(result,Err(code) if code==if canceled {"hydra_canceled"} else {"hydra_timeout"})
        );
        // Removing its cwd/ready file proves the supervised child has closed its handles.
        fs::remove_dir_all(&owned).unwrap();
    }
}
#[test]
#[ignore = "requires independently generated ClassicLevel2 fixture manifest"]
fn classic_level_databases_and_corruption_are_checked_through_production_worker() {
    let manifest = std::env::var("HARBOR_HYDRA_FIXTURES").expect("fixture manifest");
    let value: serde_json::Value = serde_json::from_slice(&fs::read(manifest).unwrap()).unwrap();
    let root = Root::new();
    for item in value["outputs"].as_array().unwrap() {
        for (kind, damaged) in [("folder", false), ("damaged", true)] {
            let source = Path::new(item[kind].as_str().unwrap());
            let before = hashes(source);
            let result = review_sync(
                source,
                &root.0.join("scratch"),
                &CancellationToken::new(),
                Instant::now() + WAIT,
            );
            if damaged {
                assert!(matches!(result, Err("hydra_database")));
            } else {
                let report = result.unwrap().report;
                assert_eq!(report.games.len(), 1999);
                assert_eq!(report.sources.len(), 3);
                assert!(report
                    .games
                    .iter()
                    .any(|g| g.name == "Updated community game"));
            }
            assert_eq!(before, hashes(source));
            assert_eq!(fs::read_dir(root.0.join("scratch")).unwrap().count(), 0);
        }
    }
}
