use super::*;
use std::time::{SystemTime, UNIX_EPOCH};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!(
                "launcher-test-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }
    fn directory(&self, name: &str) -> PathBuf {
        let path = self.0.join(name);
        fs::create_dir_all(&path).unwrap();
        path
    }
    fn client(&self) -> PathBuf {
        let path = self.0.join("client.exe");
        fs::write(&path, b"test fixture, never executed").unwrap();
        path
    }
    fn ea(&self, name: &str, ids: &str) -> PathBuf {
        let root = self.directory(name);
        fs::create_dir_all(root.join("__Installer")).unwrap();
        fs::write(
            root.join("__Installer/installerdata.xml"),
            format!("<DiPManifest><contentIDs>{ids}</contentIDs></DiPManifest>"),
        )
        .unwrap();
        root
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn varint(mut value: usize) -> Vec<u8> {
    let mut out = Vec::new();
    loop {
        let mut byte = (value & 127) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 128;
        }
        out.push(byte);
        if value == 0 {
            return out;
        }
    }
}
fn field(id: usize, bytes: &[u8]) -> Vec<u8> {
    [varint(id * 8 + 2), varint(bytes.len()), bytes.to_vec()].concat()
}
fn product(uid: &str, code: &str, path: &Path) -> Vec<u8> {
    field(
        1,
        &[
            field(1, uid.as_bytes()),
            field(2, code.as_bytes()),
            field(3, &field(1, path.to_string_lossy().as_bytes())),
        ]
        .concat(),
    )
}

fn ubisoft_product(id: usize, install_id: usize, yaml: &str) -> Vec<u8> {
    field(
        1,
        &[
            vec![8],
            varint(id),
            vec![16],
            varint(install_id),
            field(3, yaml.as_bytes()),
        ]
        .concat(),
    )
}

#[test]
fn ubisoft_artwork_is_joined_only_to_exact_observed_products() {
    let root = Fixture::new();
    let cache = root.0.join("configurations");
    fs::write(&cache, [
        ubisoft_product(57, 26, "root:\n  name: NAME\n  thumb_image: COVER\n  background_image: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg\n  logo_image: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png\n  related:\n    name: Wrong nested title\nlocalizations:\n  default:\n    NAME: 'An assassin''s game'\n    COVER: cccccccccccccccccccccccccccccccc.jpg\n  french:\n    NAME: Not the default title\n"),
        ubisoft_product(420, 420, "root:\n  name: Not installed\n"),
    ].concat()).unwrap();
    let scan = scan_inputs(Inputs {
        ubisoft_cache: Some(cache.clone()),
        ubisoft: vec![
            ("57".into(), "Folder name".into(), root.directory("copy")),
            ("26".into(), "Other edition".into(), root.directory("other")),
        ],
        ..Inputs::default()
    });
    assert_eq!(
        scan.games.len(),
        2,
        "the catalog is not an ownership or installation list"
    );
    let game = scan
        .games
        .iter()
        .find(|game| game.id == "ubisoft:57")
        .unwrap();
    assert_eq!(game.name, "An assassin's game");
    assert_eq!(game.product_id, "57");
    assert_eq!(game.state, "installed");
    assert_eq!(game.artwork.as_ref().unwrap().capsule.as_deref(), Some("https://ubistatic3-a.akamaihd.net/orbit/uplay_launcher_3_0/assets/cccccccccccccccccccccccccccccccc.jpg"));
    let other = scan
        .games
        .iter()
        .find(|game| game.id == "ubisoft:26")
        .unwrap();
    assert_eq!(other.name, "Other edition");
    assert!(
        other.artwork.is_none(),
        "shared install IDs do not join distinct products"
    );
    assert!(scan_inputs(Inputs {
        ubisoft_cache: Some(cache),
        ..Inputs::default()
    })
    .games
    .is_empty());
}

#[test]
fn ubisoft_missing_or_bad_artwork_cannot_disable_a_detected_install() {
    let root = Fixture::new();
    for bytes in [vec![0xff], ubisoft_product(57, 26, "root:\n  name: !remote data\n  thumb_image: https://elsewhere.invalid/image.jpg\n  background_image: ../../outside.jpg\n  logo_image: *alias\n")] {
        let cache = root.0.join("configurations");
        fs::write(&cache, bytes).unwrap();
        let scan = scan_inputs(Inputs { ubisoft_cache: Some(cache), ubisoft: vec![("57".into(), "Known game".into(), root.directory("game"))], ..Inputs::default() });
        assert_eq!(scan.games[0].state, "installed");
        assert_eq!(scan.games[0].name, "Known game");
        assert!(scan.games[0].artwork.is_none());
    }
}

#[test]
fn ubisoft_catalog_rejects_conflicting_ids_and_ambiguous_yaml() {
    let first = ubisoft_product(57, 26, "root:\n  name: First\n");
    let second = ubisoft_product(57, 26, "root:\n  name: Second\n");
    assert!(ubisoft::catalog(&[first.clone(), second.clone()].concat())
        .unwrap()
        .is_empty());
    assert!(ubisoft::catalog(&[second, first.clone()].concat())
        .unwrap()
        .is_empty());
    assert_eq!(
        ubisoft::catalog(&[first.clone(), first].concat())
            .unwrap()
            .len(),
        1
    );
    for yaml in [
        "root:\n  name: First\n  name: Second\n",
        "root:\n  name: First\nroot:\n  name: Second\n",
        "root:\n  name: NAME\nlocalizations:\n  default:\n    NAME: First\n    NAME: Second\n",
        "root:\n  name: GAMENAME\n  logo_image: LOGOIMAGE\n",
    ] {
        assert!(ubisoft::catalog(&ubisoft_product(57, 26, yaml))
            .unwrap()
            .is_empty());
    }
    assert!(ubisoft::catalog(&vec![0; ubisoft::MAX_CACHE_BYTES as usize + 1]).is_err());
    assert!(ubisoft::catalog(&[10, 255, 255, 127]).is_err());
    assert!(
        ubisoft::catalog(&ubisoft_product(0, 26, "root:\n  name: Invalid identity\n"))
            .unwrap()
            .is_empty()
    );
}

#[test]
#[cfg(target_os = "windows")]
#[ignore = "Read-only local product-art observation; prints only public metadata, never launches a game"]
fn local_ubisoft_product_art_observation() {
    let path = platform::discover()
        .ubisoft_cache
        .expect("Ubisoft product configuration cache");
    let products = read_bounded(&path, ubisoft::MAX_CACHE_BYTES)
        .and_then(|bytes| ubisoft::catalog(&bytes))
        .unwrap();
    let rows: Vec<_> = products.iter().map(|(id, product)| serde_json::json!({ "id": id, "name": product.name, "artwork": product.artwork, "catalogSteamId": product.catalog_steam_id })).collect();
    println!("{}", serde_json::to_string(&rows).unwrap());
    assert!(!products.is_empty());
}

#[test]
fn ubisoft_catalog_association_is_exact_and_never_changes_dispatch() {
    let root = Fixture::new();
    let cache = root.0.join("configurations");
    let yaml = "root:\n  name: Example\n  start_game:\n    steam:\n      steam_app_id: 3159330\n";
    fs::write(&cache, ubisoft_product(1081, 999, yaml)).unwrap();
    let client = root.client();
    let folder = root.directory("game");
    let make = || Inputs { ubisoft_cache: Some(cache.clone()), ubisoft: vec![("1081".into(), "Folder".into(), folder.clone()), ("999".into(), "Another edition".into(), folder.clone())], clients: BTreeMap::from([(Launcher::Ubisoft, client.clone())]), ..Inputs::default() };
    let games = scan_inputs(make()).games;
    assert_eq!(games.iter().find(|game| game.id == "ubisoft:1081").unwrap().catalog_steam_id, Some(3159330));
    assert_eq!(games.iter().find(|game| game.id == "ubisoft:999").unwrap().catalog_steam_id, None);
    assert_eq!(plan(make(), "ubisoft:1081").unwrap(), LaunchPlan::Protocol("uplay://launch/1081/0".into()));
    assert!(plan(make(), "steam:3159330").is_err());
}

#[test]
fn ubisoft_ignores_nested_conflicting_or_invalid_catalog_associations() {
    for part in [
        "  related:\n    start_game:\n      steam:\n        steam_app_id: 1\n",
        "  start_game:\n    steam:\n      steam_app_id: 1\n      steam_app_id: 2\n",
        "  start_game:\n    steam:\n      steam_app_id: 1\n    steam: *alias\n",
        "  start_game:\n    steam:\n      steam_app_id: 1\n  start_game: *alias\n",
        "  start_game:\n    steam:\n      steam_app_id: 0\n",
        "  start_game:\n    steam:\n      steam_app_id: 4294967296\n",
        "  start_game:\n    steam:\n      steam_app_id: https://other.test\n",
    ] {
        let rows = ubisoft::catalog(&ubisoft_product(1081, 999, &format!("root:\n  name: Example\n{part}"))).unwrap();
        assert_eq!(rows.get(&1081).unwrap().catalog_steam_id, None, "{part}");
    }
    let one = ubisoft_product(1081, 999, "root:\n  name: Example\n  start_game:\n    steam:\n      steam_app_id: 1\n");
    let two = ubisoft_product(1081, 999, "root:\n  name: Example\n  start_game:\n    steam:\n      steam_app_id: 2\n");
    assert!(ubisoft::catalog(&[one, two].concat()).unwrap().is_empty());
}

#[test]
fn protobuf_ignores_client_components_and_preserves_distinct_wow_variants() {
    let root = Fixture::new();
    let wow = root.directory("World of Warcraft");
    let bytes = [
        product("agent", "agent", &root.0),
        product("battle.net", "bna", &root.0),
        product("wow", "wow", &wow),
        product("wow_classic_anniversary", "wow_anniversary", &wow),
    ]
    .concat();
    let parsed = battle_installs(&bytes).unwrap();
    assert_eq!(parsed.len(), 2);
    assert_ne!(parsed[0].0, parsed[1].0);
    let path = root.0.join("product.db");
    fs::write(&path, &bytes).unwrap();
    let scan = scan_inputs(Inputs {
        battle_db: Some(path.clone()),
        ..Inputs::default()
    });
    assert_eq!(scan.games.len(), 2);
    assert!(scan
        .games
        .iter()
        .any(|g| g.id == "battlenet:wow_classic_anniversary" && g.launch_mode == "client"));
    assert_eq!(
        fs::read(path).unwrap(),
        bytes,
        "Discovery must not write installation records"
    );
}

#[test]
fn malformed_protobuf_is_bounded_and_invalid_identities_are_never_launchable() {
    let root = Fixture::new();
    for bytes in [
        vec![10, 255],
        vec![0],
        vec![255; 12],
        vec![10, 4, 10, 255],
        vec![11],
    ] {
        assert!(battle_installs(&bytes).is_err());
    }
    assert!(battle_installs(&product("wow --exec=bad", "wow", &root.0))
        .unwrap()
        .is_empty());
    let duplicate_uid = field(
        1,
        &[
            field(1, b"wow"),
            field(1, b"fen"),
            field(2, b"wow"),
            field(3, &field(1, root.0.to_string_lossy().as_bytes())),
        ]
        .concat(),
    );
    assert!(battle_installs(&duplicate_uid).is_err());
    assert!(battle_installs(&vec![0; 4 * 1024 * 1024 + 1]).is_err());
}

#[test]
fn ea_uses_manifest_content_ids_not_uninstall_guids_or_titles() {
    let good = br#"<?xml version="1.0"?><DiPManifest><gameTitles><gameTitle>A &amp; B</gameTitle></gameTitles><contentIDs><contentID>OFB-EAST:123</contentID><contentID>123</contentID><contentID>123</contentID></contentIDs></DiPManifest>"#;
    assert_eq!(ea_content_ids(good).unwrap(), vec!["123", "OFB-EAST:123"]);
    for bad in ["<DiPManifest/>", "<DiPManifest><contentIDs><contentID>x&amp;autoDownload=1</contentID></contentIDs></DiPManifest>", "<!DOCTYPE a [<!ENTITY x SYSTEM 'file:///secret'>]><DiPManifest/>", "<DiPManifest><contentIDs><contentID>1</contentID></contentIDs>"] { assert!(ea_content_ids(bad.as_bytes()).is_err()); }
    let deep = format!("{}{}", "<x>".repeat(65), "</x>".repeat(65));
    assert!(ea_content_ids(deep.as_bytes()).is_err());
}

#[test]
fn providers_never_merge_by_name_and_same_provider_conflicts_are_disabled() {
    let root = Fixture::new();
    let one = root.directory("One");
    let two = root.directory("Two");
    let scan = scan_inputs(Inputs {
        battle: vec![
            ("wow".into(), "Same name".into(), one.clone()),
            ("wow".into(), "Same name".into(), two),
        ],
        ubisoft: vec![("001".into(), "Same name".into(), one)],
        ..Inputs::default()
    });
    assert_eq!(scan.games.len(), 2);
    assert_eq!(
        scan.games
            .iter()
            .find(|g| g.launcher == Launcher::Battlenet)
            .unwrap()
            .state,
        "ambiguous"
    );
    assert_eq!(
        scan.games
            .iter()
            .find(|g| g.launcher == Launcher::Ubisoft)
            .unwrap()
            .id,
        "ubisoft:1"
    );
}

#[test]
fn moved_wow_edition_prefers_its_complete_install_in_every_record_order() {
    let root = Fixture::new();
    let missing = root.0.join("Old location");
    let incomplete = root.directory("Old shared root");
    let installed = root.directory("Moved location");
    fs::create_dir_all(installed.join("_anniversary_")).unwrap();
    fs::write(installed.join("_anniversary_/WowClassic.exe"), b"fixture").unwrap();
    let paths = [missing, incomplete, installed.clone()];
    let executable = root.client();
    for order in [
        [0, 1, 2],
        [0, 2, 1],
        [1, 0, 2],
        [1, 2, 0],
        [2, 0, 1],
        [2, 1, 0],
    ] {
        let make = || Inputs {
            clients: BTreeMap::from([(Launcher::Battlenet, executable.clone())]),
            battle: order
                .iter()
                .map(|&index| {
                    (
                        "wow_classic_anniversary".into(),
                        "Anniversary".into(),
                        paths[index].clone(),
                    )
                })
                .collect(),
            ..Inputs::default()
        };
        let scan = scan_inputs(make());
        assert_eq!(scan.games.len(), 1);
        assert_eq!(scan.games[0].state, "installed", "order {order:?}");
        assert_eq!(Path::new(&scan.games[0].install_path), installed);
        let LaunchPlan::Process { args, .. } =
            plan(make(), "battlenet:wow_classic_anniversary").unwrap()
        else {
            panic!("wrong launch kind");
        };
        assert!(args.contains(&format!("--gamepath={}", installed.display())));
    }
}

#[test]
fn moved_ubisoft_install_survives_missing_and_duplicate_records() {
    let root = Fixture::new();
    let installed = root.directory("Current");
    for paths in [
        vec![root.0.join("Old"), installed.clone(), installed.clone()],
        vec![installed.clone(), root.0.join("Old"), installed.clone()],
    ] {
        let inputs = Inputs {
            clients: BTreeMap::from([(Launcher::Ubisoft, root.client())]),
            ubisoft: paths
                .into_iter()
                .map(|path| ("01081".into(), "Game".into(), path))
                .collect(),
            ..Inputs::default()
        };
        assert_eq!(
            plan(inputs, "ubisoft:1081").unwrap(),
            LaunchPlan::Protocol("uplay://launch/1081/0".into())
        );
    }
}

#[test]
fn multiple_installed_paths_remain_ambiguous_despite_stale_or_duplicate_records() {
    let root = Fixture::new();
    let one = root.directory("One");
    let two = root.directory("Two");
    let missing = root.0.join("Missing");
    for paths in [
        vec![missing.clone(), one.clone(), two.clone(), one.clone()],
        vec![two.clone(), one.clone(), missing, two],
    ] {
        let make = || Inputs {
            clients: BTreeMap::from([(Launcher::Ubisoft, root.client())]),
            ubisoft: paths
                .iter()
                .map(|path| ("1081".into(), "Game".into(), path.clone()))
                .collect(),
            ..Inputs::default()
        };
        let games = scan_inputs(make()).games;
        assert_eq!(games.len(), 1);
        assert_eq!(games[0].state, "ambiguous");
        assert_eq!(plan(make(), "ubisoft:1081"), Err("launcher_game_missing"));
    }
}

#[test]
fn surviving_incomplete_edition_is_not_mistaken_for_a_playable_install() {
    let root = Fixture::new();
    let incomplete = root.directory("Shared WoW root");
    let make = || Inputs {
        clients: BTreeMap::from([(Launcher::Battlenet, root.client())]),
        battle: vec![
            ("wow".into(), "WoW".into(), root.0.join("Missing")),
            ("wow".into(), "WoW".into(), incomplete.clone()),
        ],
        ..Inputs::default()
    };
    assert_eq!(scan_inputs(make()).games[0].state, "incomplete");
    assert_eq!(plan(make(), "battlenet:wow"), Err("launcher_game_missing"));
}

#[test]
fn ea_duplicate_alias_sets_at_distinct_installs_cannot_dispatch() {
    let root = Fixture::new();
    let one = root.ea(
        "One",
        "<contentID>123</contentID><contentID>456</contentID>",
    );
    let two = root.ea(
        "Two",
        "<contentID>456</contentID><contentID>123</contentID>",
    );
    let inputs = Inputs {
        clients: BTreeMap::from([(Launcher::Ea, root.client())]),
        ea: vec![("Game".into(), one), ("Game".into(), two)],
        ..Inputs::default()
    };
    assert_eq!(plan(inputs, "ea:123,456"), Err("launcher_game_missing"));
}

#[test]
fn ea_registration_is_only_a_canonical_guid_with_an_explicit_scope() {
    assert_eq!(
        ea_registration("machine", "{12345678-90AB-CDEF-1234-567890ABCDEF}"),
        Some("machine:12345678-90ab-cdef-1234-567890abcdef".into())
    );
    for value in [
        "A title",
        "Origin.Game.123",
        "{1234567890AB-CDEF-1234-567890ABCDEF}",
        "{12345678-90AB-CDEF-1234-567890ABCDEG}",
    ] {
        assert!(ea_registration("machine", value).is_none());
    }
    assert!(ea_registration("untrusted", "{12345678-90AB-CDEF-1234-567890ABCDEF}").is_none());
}

#[test]
fn ea_registration_requires_one_unique_binding_to_the_observed_install() {
    let root = Fixture::new();
    let path = root.ea("Game", "<contentID>123</contentID>");
    let key = "machine:12345678-90ab-cdef-1234-567890abcdef".to_owned();
    let make = |keys| Inputs {
        ea: vec![("Game".into(), path.clone())],
        ea_keys: keys,
        ..Inputs::default()
    };
    let scan = scan_inputs(make(vec![
        (path.clone(), key.clone()),
        (path.clone(), key.clone()),
    ]));
    assert_eq!(scan.games[0].install_key.as_deref(), Some(key.as_str()));
    assert_eq!(scan.games[0].product_id, "123");
    assert!(
        scan_inputs(make(vec![(root.0.join("Other"), key.clone())])).games[0]
            .install_key
            .is_none()
    );
    assert!(scan_inputs(make(vec![
        (path.clone(), key),
        (
            path.clone(),
            "user:12345678-90ab-cdef-1234-567890abcdef".into()
        )
    ]))
    .games[0]
        .install_key
        .is_none());
}

#[test]
fn missing_games_and_uninstalled_clients_cannot_dispatch() {
    let root = Fixture::new();
    let path = root.directory("Installed");
    let make = || Inputs {
        ubisoft: vec![("1081".into(), "Game".into(), path.clone())],
        ..Inputs::default()
    };
    assert_eq!(plan(make(), "ubisoft:1081"), Err("launcher_client_missing"));
    let executable = root.client();
    let mut data = make();
    data.clients.insert(Launcher::Ubisoft, executable.clone());
    assert_eq!(
        plan(data, "ubisoft:1081").unwrap(),
        LaunchPlan::Protocol("uplay://launch/1081/0".into())
    );
    fs::remove_dir(&path).unwrap();
    let mut data = make();
    data.clients.insert(Launcher::Ubisoft, executable);
    assert_eq!(plan(data, "ubisoft:1081"), Err("launcher_game_missing"));
    assert_eq!(scan_inputs(make()).games[0].state, "missing");
}

#[test]
fn management_rechecks_identity_and_opens_only_the_observed_client() {
    let root = Fixture::new();
    let path = root.directory("Installed");
    let executable = root.client();
    let make = || Inputs { ubisoft: vec![("1081".into(), "Game".into(), path.clone())], clients: BTreeMap::from([(Launcher::Ubisoft, executable.clone())]), ..Inputs::default() };
    assert!(management(make(), "ubisoft:999").is_err());
    let (game, client) = management(make(), "ubisoft:1081").unwrap();
    assert_eq!(game.id, "ubisoft:1081");
    assert_eq!(client, Some(executable.clone()));
    fs::remove_file(&executable).unwrap();
    assert!(management(make(), "ubisoft:1081").unwrap().1.is_none());
    fs::remove_dir(&path).unwrap();
    assert!(management(make(), "ubisoft:1081").is_err());
}

#[test]
fn battle_launch_plans_keep_arguments_separate_and_select_classic_explicitly() {
    let root = Fixture::new();
    let path = root.directory("Games with spaces");
    for binary in ["_retail_/Wow.exe", "_anniversary_/WowClassic.exe"] {
        let file = path.join(binary);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(file, b"fixture").unwrap();
    }
    let executable = root.client();
    let make = |id: &str| Inputs {
        clients: BTreeMap::from([(Launcher::Battlenet, executable.clone())]),
        battle: vec![(id.into(), "Game".into(), path.clone())],
        ..Inputs::default()
    };
    assert_eq!(
        plan(make("wow"), "battlenet:wow").unwrap(),
        LaunchPlan::Process {
            executable: executable.clone(),
            args: vec!["--exec=launch WoW".into()]
        }
    );
    assert_eq!(
        plan(
            make("wow_classic_anniversary"),
            "battlenet:wow_classic_anniversary"
        )
        .unwrap(),
        LaunchPlan::Process {
            executable: executable.clone(),
            args: vec![
                "--game=wow_classic_anniversary".into(),
                "--productcode=wow_classic_anniversary".into(),
                format!("--gamepath={}", path.display())
            ]
        }
    );
    assert_eq!(
        plan(make("wow"), "battlenet:wow&bad"),
        Err("launcher_game_missing")
    );
}

#[test]
fn wow_root_does_not_claim_an_absent_edition_is_installed() {
    let root = Fixture::new();
    let path = root.directory("WoW");
    fs::create_dir_all(path.join("_retail_")).unwrap();
    fs::write(path.join("_retail_/Wow.exe"), b"fixture").unwrap();
    let inputs = Inputs {
        battle: vec![
            ("wow".into(), "Retail".into(), path.clone()),
            ("wow_classic_anniversary".into(), "Classic".into(), path),
        ],
        ..Inputs::default()
    };
    let games = scan_inputs(inputs).games;
    assert_eq!(
        games.iter().find(|g| g.product_id == "wow").unwrap().state,
        "installed"
    );
    assert_eq!(
        games
            .iter()
            .find(|g| g.product_id == "wow_classic_anniversary")
            .unwrap()
            .state,
        "incomplete"
    );
}

#[test]
fn ea_multiple_aliases_form_one_install_and_never_request_download() {
    let root = Fixture::new();
    let path = root.ea(
        "Game",
        "<contentID>OFB-EAST:123</contentID><contentID>456</contentID>",
    );
    let inputs = Inputs {
        clients: BTreeMap::from([(Launcher::Ea, root.client())]),
        ea: vec![("Game".into(), path.clone()), ("Game".into(), path)],
        ..Inputs::default()
    };
    let LaunchPlan::Protocol(uri) = plan(inputs, "ea:456,OFB-EAST:123").unwrap() else {
        panic!("wrong launch kind");
    };
    let url = url::Url::parse(&uri).unwrap();
    assert_eq!(url.scheme(), "origin2");
    assert!(url
        .query_pairs()
        .any(|(key, value)| key == "offerIds" && value == "456,OFB-EAST:123"));
    assert!(url
        .query_pairs()
        .any(|(key, value)| key == "autoDownload" && value == "0"));
}

#[test]
fn unsafe_paths_are_rejected_without_inspecting_network_or_device_paths() {
    for path in [
        "relative/game",
        r"\\server\share\game",
        r"\\?\C:\game",
        "//server/game",
        "C:/Games/../Other",
        "C:/",
    ] {
        assert!(!local_path(Path::new(path)), "{path}");
    }
    let root = Fixture::new();
    assert!(local_path(&root.0));
}
