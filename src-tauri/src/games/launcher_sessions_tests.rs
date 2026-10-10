use super::*;
use processes::{Process, Sample};

fn folder() -> PathBuf {
    let root = std::env::var_os("HARBOR_SESSION_TEST_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join(uuid::Uuid::new_v4().to_string());
    std::fs::create_dir_all(&root).unwrap();
    root
}
fn watch(root: &Path) -> Watch {
    Watch {
        session: Session {
            profile: "one".into(),
            id: "battlenet:classic:d2".into(),
            session_id: uuid::Uuid::new_v4().to_string(),
            state: "waiting".into(),
            requested_at: 1_000,
            started_at: 0,
            updated_at: 1_000,
            elapsed_ms: 0,
            root: processes::path_key(root),
            processes: Vec::new(),
        },
        last_tick: Instant::now(),
        missing_ms: 0,
        waiting_ms: 0,
        restoring: false,
    }
}
fn process(root: &Path, pid: u32, name: &str) -> Process {
    Process {
        pid,
        created: 100 + pid as u64,
        path: format!("{}/{}", processes::path_key(root), name),
    }
}
fn sample(processes: Vec<Process>) -> Sample {
    Sample {
        processes,
        inaccessible: Default::default(),
    }
}

#[test]
fn handoff_wait_does_not_grant_playtime_and_times_out() {
    let root = folder();
    let mut watch = watch(&root);
    watch.observe(
        &sample(vec![
            process(&root, 1, "battle.net.exe"),
            process(&root, 2, "crashreporter.exe"),
        ]),
        2_000,
        10_000,
    );
    assert_eq!(watch.session.state, "waiting");
    assert_eq!(watch.session.started_at, 0);
    watch.observe(&Sample::default(), 120_000, 121_000);
    assert_eq!(watch.session.state, "notStarted");
    store::save(&root, &watch.session).unwrap();
    assert!(store::activity(&root, "one").unwrap().is_empty());
}
#[test]
fn directory_boundaries_helpers_and_wow_editions_do_not_mix() {
    let root = folder();
    let retail = root.join("_retail_");
    let classic = root.join("_classic_");
    std::fs::create_dir_all(&retail).unwrap();
    std::fs::create_dir_all(&classic).unwrap();
    let mut watch = watch(&retail);
    watch.observe(
        &sample(vec![
            process(&classic, 3, "wowclassic.exe"),
            process(&retail, 4, "updater.exe"),
            process(&root.with_extension("sibling"), 5, "wow.exe"),
        ]),
        2_000,
        3_000,
    );
    assert_eq!(watch.session.state, "waiting");
    watch.observe(&sample(vec![process(&retail, 6, "wow.exe")]), 2_000, 5_000);
    assert_eq!(watch.session.state, "running");
    assert!(!overlaps(
        &processes::path_key(&retail),
        &processes::path_key(&classic)
    ));
    assert!(overlaps(
        &processes::path_key(&root),
        &processes::path_key(&root)
    ));
}
#[test]
fn child_transition_counts_only_observed_intervals_without_double_counting() {
    let root = folder();
    let mut watch = watch(&root);
    let parent = process(&root, 7, "diablo ii.exe");
    let child = process(&root, 8, "game.exe");
    watch.observe(&sample(vec![parent.clone()]), 2_000, 3_000);
    watch.observe(&sample(vec![parent, child.clone()]), 2_000, 5_000);
    watch.observe(&sample(vec![child]), 2_000, 7_000);
    assert_eq!(watch.session.elapsed_ms, 4_000);
    watch.observe(&Sample::default(), 2_000, 9_000);
    assert_eq!(watch.session.state, "unconfirmed");
    watch.observe(&Sample::default(), 4_000, 13_000);
    assert_eq!(watch.session.state, "ended");
    assert_eq!(watch.session.elapsed_ms, 4_000);
}
#[test]
fn unreadable_process_and_long_sleep_never_invent_elapsed_time() {
    let root = folder();
    let mut watch = watch(&root);
    let game = process(&root, 9, "game.exe");
    watch.observe(&sample(vec![game.clone()]), 2_000, 3_000);
    watch.observe(
        &Sample {
            processes: vec![],
            inaccessible: [9].into(),
        },
        2_000,
        5_000,
    );
    assert_eq!(watch.session.state, "unconfirmed");
    watch.observe(&sample(vec![game.clone()]), 2_000, 7_000);
    assert_eq!(watch.session.elapsed_ms, 0);
    watch.observe(&sample(vec![game]), 60_000, 67_000);
    assert_eq!(watch.session.elapsed_ms, 0);
}
#[test]
fn restart_uses_creation_identity_and_never_counts_the_offline_gap() {
    let root = folder();
    let mut watch = watch(&root);
    let game = process(&root, 10, "game.exe");
    watch.observe(&sample(vec![game.clone()]), 2_000, 3_000);
    watch.observe(&sample(vec![game.clone()]), 2_000, 5_000);
    store::save(&root, &watch.session).unwrap();
    let saved = store::active(&root).unwrap().remove(0);
    let mut restored = Watch {
        session: saved.clone(),
        last_tick: Instant::now(),
        missing_ms: 0,
        waiting_ms: 0,
        restoring: true,
    };
    restored.observe(&sample(vec![game.clone()]), 0, 500_000);
    assert_eq!(restored.session.elapsed_ms, 2_000);
    assert_eq!(restored.session.state, "running");
    let mut reused = Watch {
        session: saved,
        last_tick: Instant::now(),
        missing_ms: 0,
        waiting_ms: 0,
        restoring: true,
    };
    reused.observe(
        &sample(vec![Process {
            created: game.created + 1,
            ..game
        }]),
        0,
        500_000,
    );
    assert_eq!(reused.session.state, "interrupted");
}
#[test]
fn persisted_totals_are_idempotent_and_profile_isolated() {
    let root = folder();
    let mut watch = watch(&root);
    let game = process(&root, 11, "game.exe");
    watch.observe(&sample(vec![game.clone()]), 2_000, 3_000);
    watch.observe(&sample(vec![game]), 2_000, 5_000);
    store::save(&root, &watch.session).unwrap();
    store::save(&root, &watch.session).unwrap();
    assert_eq!(store::activity(&root, "one").unwrap()[0].seconds, 2);
    assert!(store::activity(&root, "two").unwrap().is_empty());
    watch.session.elapsed_ms = 4_000;
    watch.session.state = "ended".into();
    store::save(&root, &watch.session).unwrap();
    assert_eq!(store::activity(&root, "one").unwrap()[0].seconds, 4);
    assert!(store::active(&root).unwrap().is_empty());
    assert_eq!(store::latest(&root, "one").unwrap()[0].state, "ended");
}
#[test]
fn failed_dispatch_and_non_game_handoff_have_no_playtime() {
    let root = folder();
    let install = root.join("game");
    std::fs::create_dir_all(&install).unwrap();
    let mut game = Game {
        id: "battlenet:classic:d2".into(),
        launcher: Launcher::Battlenet,
        product_id: "classic:d2".into(),
        name: "Diablo II".into(),
        install_path: install.to_string_lossy().into_owned(),
        state: "installed",
        launch_mode: "direct",
        install_key: None,
        artwork: None,
        catalog_steam_id: None,
    };
    assert_eq!(
        launch(&root, "one", &game, || Err("launcher_launch_failed")),
        Err("launcher_launch_failed")
    );
    let state = snapshot(&root, "one").unwrap();
    assert_eq!(state.sessions[0].state, "failed");
    assert!(state.activity.is_empty());
    game.launch_mode = "client";
    assert!(!launch(&root, "one", &game, || Ok(())).unwrap());
    assert_eq!(store::latest(&root, "one").unwrap().len(), 1);
    assert!(launch(&root, "\n", &game, || panic!("invalid profile dispatched")).is_err());
}

#[cfg(windows)]
#[test]
fn windows_sampler_observes_current_process_with_stable_creation_identity() {
    let pid = std::process::id();
    let first = processes::sample()
        .unwrap()
        .processes
        .into_iter()
        .find(|p| p.pid == pid)
        .unwrap();
    let second = processes::sample()
        .unwrap()
        .processes
        .into_iter()
        .find(|p| p.pid == pid)
        .unwrap();
    assert_eq!(first, second);
    assert!(first.created > 0);
    assert_eq!(
        first.path,
        processes::path_key(&std::fs::canonicalize(std::env::current_exe().unwrap()).unwrap())
    );
}

#[test]
fn opening_a_wow_client_page_does_not_pretend_to_launch_or_timeout_a_game() {
    let root = folder();
    let game = Game {
        id: "battlenet:wow_classic".into(),
        launcher: Launcher::Battlenet,
        product_id: "wow_classic".into(),
        name: "WoW Classic".into(),
        install_path: root.to_string_lossy().into_owned(),
        state: "installed",
        launch_mode: "client",
        install_key: None,
        artwork: None,
        catalog_steam_id: None,
    };
    assert!(!launch(&root, "one", &game, || Ok(())).unwrap());
    assert!(snapshot(&root, "one").unwrap().sessions.is_empty());
}
