use super::super::{plan, scan_inputs, Inputs};
use super::*;
use std::{
    collections::BTreeMap,
    fs,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

struct Fixture(PathBuf);
static FIXTURE_SEQUENCE: AtomicU64 = AtomicU64::new(0);
impl Fixture {
    fn new() -> Self {
        let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!(
                "launcher-adapters-{}-{}-{}",
                std::process::id(),
                FIXTURE_SEQUENCE.fetch_add(1, Ordering::Relaxed),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }
    fn file(&self, path: &str) -> PathBuf {
        let path = self.0.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, b"fixture, never executed").unwrap();
        path
    }
    fn ready(&self, install: &Install) {
        for file in &install.files {
            let path = install.path.join(file);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, b"fixture, never executed").unwrap();
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn epic(root: &Path) -> serde_json::Value {
    serde_json::json!({ "AppName":"Fortnite", "MainGameAppName":"Fortnite", "CatalogNamespace":"fn",
        "CatalogItemId":"catalog", "DisplayName":"Fortnite", "InstallLocation":root,
        "LaunchExecutable":"FortniteGame/Binaries/Win64/FortniteLauncher.exe", "bIsApplication":true,
        "bIsIncompleteInstall":false })
}
fn inputs(fixture: &Fixture, install: Install) -> Inputs {
    Inputs {
        clients: BTreeMap::from([(install.launcher, fixture.file("client.exe"))]),
        extra: vec![install],
        ..Inputs::default()
    }
}

#[test]
fn epic_uses_three_part_identity_and_does_not_import_dlc_or_tools() {
    let root = Fixture::new();
    let data = epic(&root.0);
    let install = epic_manifest(&serde_json::to_vec(&data).unwrap())
        .unwrap()
        .unwrap();
    root.ready(&install);
    let game = game(install.clone()).unwrap();
    assert_eq!(game.id, "epic:fn:catalog:Fortnite");
    assert_eq!(
        plan(inputs(&root, install), &game.id).unwrap(),
        LaunchPlan::Protocol(
            "com.epicgames.launcher://apps/fn%3Acatalog%3AFortnite?action=launch&silent=true"
                .into()
        )
    );
    for (key, value) in [
        ("bIsApplication", serde_json::json!(false)),
        ("MainGameAppName", serde_json::json!("Parent")),
        ("CatalogNamespace", serde_json::json!("ue")),
    ] {
        let mut excluded = data.clone();
        excluded[key] = value;
        assert!(epic_manifest(&serde_json::to_vec(&excluded).unwrap())
            .unwrap()
            .is_none());
    }
}

#[test]
fn incomplete_or_removed_epic_install_cannot_launch() {
    let root = Fixture::new();
    let mut data = epic(&root.0);
    data["bIsIncompleteInstall"] = true.into();
    let install = epic_manifest(&serde_json::to_vec(&data).unwrap())
        .unwrap()
        .unwrap();
    root.ready(&install);
    assert_eq!(game(install.clone()).unwrap().state, "incomplete");
    assert_eq!(
        plan(inputs(&root, install), "epic:fn:catalog:Fortnite"),
        Err("launcher_game_missing")
    );
    data["bIsIncompleteInstall"] = false.into();
    let install = epic_manifest(&serde_json::to_vec(&data).unwrap())
        .unwrap()
        .unwrap();
    fs::remove_file(root.0.join(&install.files[0])).unwrap();
    assert_eq!(
        plan(inputs(&root, install), "epic:fn:catalog:Fortnite"),
        Err("launcher_game_missing")
    );
}

#[test]
fn manifest_identity_and_relative_executable_are_untrusted_data() {
    let root = Fixture::new();
    for (key, value) in [
        ("AppName", "X?kill=1"),
        ("CatalogNamespace", "a:b"),
        ("LaunchExecutable", "../outside.exe"),
        ("LaunchExecutable", "C:/outside.exe"),
        ("LaunchExecutable", r"..\outside.exe"),
        ("LaunchExecutable", r"\\server\share\app.exe"),
        ("InstallLocation", "relative/path"),
    ] {
        let mut data = epic(&root.0);
        data[key] = value.into();
        if key == "AppName" {
            data["MainGameAppName"] = value.into();
        }
        assert!(
            epic_manifest(&serde_json::to_vec(&data).unwrap()).is_err(),
            "{key}={value}"
        );
    }
    assert!(epic_manifest(&vec![b' '; MANIFEST_LIMIT as usize + 1]).is_err());
    assert!(epic_manifest(br#"{"AppName":"X"}"#).is_err());
}

#[test]
fn gog_requires_matching_base_game_and_primary_play_task() {
    let root = Fixture::new();
    let manifest = root.0.join("goggame-123.info");
    let data = serde_json::json!({"gameId":"123","rootGameId":"123","name":"A game","playTasks":[
        {"isPrimary":true,"path":"Game.exe"},{"isPrimary":false,"path":"manual.pdf"}]});
    fs::write(&manifest, serde_json::to_vec(&data).unwrap()).unwrap();
    root.file("Game.exe");
    let install = gog_install("123", "", root.0.clone()).unwrap().unwrap();
    assert_eq!(game(install.clone()).unwrap().state, "installed");
    let LaunchPlan::Process { args, .. } = plan(inputs(&root, install), "gog:123").unwrap() else {
        panic!()
    };
    assert!(args.contains(&"/command=runGame".to_owned()));
    assert!(args.contains(&format!("/path={}", root.0.display())));
    for key in ["gameId", "rootGameId"] {
        let mut invalid = data.clone();
        invalid[key] = "456".into();
        fs::write(&manifest, serde_json::to_vec(&invalid).unwrap()).unwrap();
        assert!(gog_install("123", "", root.0.clone()).unwrap().is_none());
    }
    let mut dlc = data;
    dlc["playTasks"] = serde_json::json!([]);
    fs::write(&manifest, serde_json::to_vec(&dlc).unwrap()).unwrap();
    assert!(gog_install("123", "", root.0.clone()).unwrap().is_none());
}

#[test]
fn riot_reads_only_unique_top_level_install_location() {
    let root = Fixture::new();
    let quoted = serde_json::to_string(&root.0.to_string_lossy()).unwrap();
    assert_eq!(
        riot_install_path(
            format!("product_install_full_path: {quoted}\nunknown: ignored").as_bytes()
        ),
        Some(root.0.clone())
    );
    assert!(
        riot_install_path(format!("  product_install_full_path: {quoted}").as_bytes()).is_none()
    );
    assert!(riot_install_path(
        format!("product_install_full_path: {quoted}\nproduct_install_full_path: {quoted}")
            .as_bytes()
    )
    .is_none());
    assert!(riot_install_path(b"product_install_full_path: ../game").is_none());
    let install = riot_install("league_of_legends", "live", root.0.clone()).unwrap();
    root.ready(&install);
    let LaunchPlan::Process { args, .. } =
        plan(inputs(&root, install), "riot:league_of_legends:live").unwrap()
    else {
        panic!()
    };
    assert_eq!(
        args,
        [
            "--launch-product=league_of_legends",
            "--launch-patchline=live"
        ]
    );
    assert!(riot_install("vanguard", "live", root.0.clone()).is_none());
}

#[test]
fn rsi_channels_require_both_game_binary_and_data_and_open_client_only() {
    let root = Fixture::new();
    let mut records = Vec::new();
    for (_, channel) in RSI_CHANNELS {
        let install = rsi_install(channel, root.0.join(channel)).unwrap();
        root.ready(&install);
        let result = game(install.clone()).unwrap();
        assert_eq!(result.launch_mode, "client");
        let LaunchPlan::Process { executable, args } =
            plan(inputs(&root, install.clone()), &result.id).unwrap()
        else {
            panic!()
        };
        assert!(args.is_empty());
        assert_eq!(executable, root.0.join("client.exe"));
        records.push(install);
    }
    assert_eq!(
        scan_inputs(Inputs {
            extra: records.clone(),
            ..Inputs::default()
        })
        .games
        .len(),
        4
    );
    fs::remove_file(root.0.join("live/Data.p4k")).unwrap();
    assert_eq!(game(records.remove(0)).unwrap().state, "incomplete");
}

#[test]
fn tarkov_and_arena_have_separate_binary_proofs_and_do_not_bypass_bsg() {
    let root = Fixture::new();
    let eft = bsg_install("eft", root.0.clone()).unwrap();
    root.ready(&eft);
    let arena = bsg_install("arena", root.0.clone()).unwrap();
    assert_eq!(game(arena.clone()).unwrap().state, "incomplete");
    assert_eq!(game(eft.clone()).unwrap().state, "installed");
    assert_eq!(
        plan(inputs(&root, eft), "bsg:arena"),
        Err("launcher_game_missing")
    );
    root.ready(&arena);
    let LaunchPlan::Process { args, .. } = plan(inputs(&root, arena), "bsg:arena").unwrap() else {
        panic!()
    };
    assert!(args.is_empty());
}

#[test]
fn rockstar_requires_a_known_uninstall_identity_not_a_matching_game_title() {
    assert_eq!(
        rockstar_product(r#""F:\Rockstar\Launcher.exe" -uninstall=gta5"#),
        Some("gta5")
    );
    for command in [
        "steam://uninstall/271590",
        "Launcher.exe -uninstall=unknown",
        "Launcher.exe -uninstall=gta5 -uninstall=rdr2",
    ] {
        assert!(rockstar_product(command).is_none());
    }
    let root = Fixture::new();
    let install = rockstar_install("rdr2", root.0.join("Game with spaces")).unwrap();
    root.ready(&install);
    let LaunchPlan::Process { args, .. } =
        plan(inputs(&root, install.clone()), "rockstar:rdr2").unwrap()
    else {
        panic!()
    };
    assert_eq!(
        args,
        ["-launchTitleInFolder", install.path.to_str().unwrap()]
    );
}

#[test]
fn multiple_live_install_paths_and_missing_clients_fail_closed() {
    let root = Fixture::new();
    let first = bsg_install("eft", root.0.join("first")).unwrap();
    root.ready(&first);
    let second = bsg_install("eft", root.0.join("second")).unwrap();
    root.ready(&second);
    let mut data = inputs(&root, first.clone());
    data.extra.push(second);
    assert_eq!(plan(data, "bsg:eft"), Err("launcher_game_missing"));
    let mut data = inputs(&root, first);
    data.clients.clear();
    assert_eq!(plan(data, "bsg:eft"), Err("launcher_client_missing"));
}

#[test]
fn conflicting_epic_update_records_at_one_path_never_enable_play() {
    let root = Fixture::new();
    let complete = epic_manifest(&serde_json::to_vec(&epic(&root.0)).unwrap())
        .unwrap()
        .unwrap();
    root.ready(&complete);
    let mut partial = complete.clone();
    partial.complete = false;
    for pair in [[complete.clone(), partial.clone()], [partial, complete]] {
        let mut data = inputs(&root, pair[0].clone());
        data.extra.push(pair[1].clone());
        assert_eq!(
            plan(data, "epic:fn:catalog:Fortnite"),
            Err("launcher_game_missing")
        );
    }
}

#[test]
#[cfg(windows)]
#[ignore = "Read-only local-provider smoke check; deliberately never launches a client or game"]
fn local_provider_scan_and_launch_plans() {
    let scan = super::super::scan();
    assert!(scan.supported);
    for client in &scan.clients {
        println!(
            "{} client installed={}",
            client.launcher.key(),
            client.installed
        );
    }
    for game in &scan.games {
        if matches!(
            game.launcher,
            Launcher::Epic
                | Launcher::Gog
                | Launcher::Riot
                | Launcher::Rockstar
                | Launcher::Rsi
                | Launcher::Bsg
        ) {
            println!("{} {} mode={}", game.id, game.state, game.launch_mode);
            if game.state == "installed"
                && scan
                    .clients
                    .iter()
                    .any(|client| client.launcher == game.launcher && client.installed)
            {
                assert!(super::super::prepare_launch(&game.id).is_ok());
            }
        }
    }
}
