use super::super::{plan, scan_inputs, Inputs};
use super::*;
use std::fs;

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root =
            std::env::temp_dir().join(format!("harbor-bnet-classic-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }
    fn file(&self, name: &str) {
        fs::write(self.0.join(name), b"fixture only; never executed").unwrap();
    }
    fn inputs(&self, name: &str) -> Inputs {
        Inputs {
            battle_classic: vec![(name.into(), "Blizzard Entertainment".into(), self.0.clone())],
            ..Inputs::default()
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn diablo_expansion_requires_its_own_data_not_just_the_shared_executable() {
    let root = Fixture::new();
    root.file("Diablo II.exe");
    let scan = scan_inputs(root.inputs("Diablo II"));
    assert_eq!(scan.games.len(), 1);
    assert_eq!(scan.games[0].id, "battlenet:classic:d2");
    assert_eq!(scan.games[0].state, "installed");
    root.file("d2exp.mpq");
    let scan = scan_inputs(root.inputs("Diablo II"));
    assert_eq!(scan.games.len(), 2);
    assert!(scan
        .games
        .iter()
        .any(|game| game.id == "battlenet:classic:d2x"));
    fs::remove_file(root.0.join("d2exp.mpq")).unwrap();
    assert_eq!(
        plan(root.inputs("Diablo II"), "battlenet:classic:d2x"),
        Err("launcher_game_missing")
    );
}

#[test]
fn warcraft_expansion_launches_its_distinct_executable_without_a_client() {
    let root = Fixture::new();
    root.file("Warcraft III.exe");
    assert_eq!(scan_inputs(root.inputs("Warcraft III")).games.len(), 1);
    root.file("Frozen Throne.exe");
    for (id, file) in [
        ("classic:w3", "Warcraft III.exe"),
        ("classic:w3x", "Frozen Throne.exe"),
    ] {
        assert_eq!(
            plan(root.inputs("Warcraft III"), &format!("battlenet:{id}")),
            Ok(LaunchPlan::Process {
                executable: root.0.join(file),
                args: vec![]
            })
        );
    }
    let scan = scan_inputs(root.inputs("Warcraft III"));
    assert!(
        !scan
            .clients
            .iter()
            .find(|client| client.launcher == Launcher::Battlenet)
            .unwrap()
            .installed
    );
    assert!(scan
        .games
        .iter()
        .all(|game| game.launch_mode == "direct" && game.state == "installed"));
}

#[test]
fn direct_diablo_dispatch_rechecks_the_executable() {
    let root = Fixture::new();
    root.file("Diablo II.exe");
    root.file("d2exp.mpq");
    let game = scan_inputs(root.inputs("Diablo II")).games.remove(0);
    assert_eq!(
        launch(&game),
        Ok(LaunchPlan::Process {
            executable: root.0.join("Diablo II.exe"),
            args: vec![]
        })
    );
    fs::remove_file(root.0.join("Diablo II.exe")).unwrap();
    assert_eq!(launch(&game), Err("launcher_game_missing"));
    assert_eq!(
        plan(root.inputs("Diablo II"), &game.id),
        Err("launcher_game_missing")
    );
    assert!(scan_inputs(root.inputs("Diablo II"))
        .games
        .iter()
        .all(|game| game.state == "incomplete"));
}

#[test]
fn stale_registration_is_missing_and_never_playable() {
    let root = Fixture::new();
    let mut inputs = root.inputs("Warcraft III");
    inputs.battle_classic[0].2 = root.0.join("removed");
    let game = scan_inputs(inputs).games.remove(0);
    assert_eq!(game.state, "missing");
    assert_eq!(launch(&game), Err("launcher_game_missing"));
}

#[test]
fn only_exact_blizzard_registrations_import_classics() {
    let root = Fixture::new();
    root.file("Diablo II.exe");
    assert_eq!(
        scan_record("diablo ii", "blizzard entertainment", &root.0).len(),
        1
    );
    for (name, publisher) in [
        ("Diablo II: Resurrected", "Blizzard Entertainment"),
        ("Diablo II", "Other publisher"),
        ("Diablo III", "Blizzard Entertainment"),
        ("Warcraft III Reforged", "Blizzard Entertainment"),
    ] {
        assert!(scan_record(name, publisher, &root.0).is_empty());
    }
    for path in [
        PathBuf::from("relative"),
        PathBuf::from(r"\\server\games"),
        root.0.join("../escape"),
    ] {
        assert!(scan_record("Diablo II", "Blizzard Entertainment", &path).is_empty());
    }
}

#[test]
fn duplicate_live_installs_are_ambiguous_and_moved_installs_resolve() {
    let one = Fixture::new();
    let two = Fixture::new();
    one.file("Diablo II.exe");
    two.file("Diablo II.exe");
    let inputs = || {
        let mut input = one.inputs("Diablo II");
        input
            .battle_classic
            .extend(two.inputs("Diablo II").battle_classic);
        input
    };
    assert_eq!(scan_inputs(inputs()).games[0].state, "ambiguous");
    assert_eq!(
        plan(inputs(), "battlenet:classic:d2"),
        Err("launcher_game_missing")
    );
    fs::remove_file(two.0.join("Diablo II.exe")).unwrap();
    assert_eq!(scan_inputs(inputs()).games[0].state, "installed");
    assert_eq!(
        plan(inputs(), "battlenet:classic:d2"),
        Ok(LaunchPlan::Process {
            executable: one.0.join("Diablo II.exe"),
            args: vec![]
        })
    );
}

#[test]
fn classic_and_remastered_copies_never_merge_or_share_launch_authority() {
    let root = Fixture::new();
    root.file("Warcraft III.exe");
    let mut input = root.inputs("Warcraft III");
    input
        .battle
        .push(("w3".into(), "Warcraft III: Reforged".into(), root.0.clone()));
    let scan = scan_inputs(input);
    assert_eq!(scan.games.len(), 2);
    assert!(scan
        .games
        .iter()
        .any(|game| game.id == "battlenet:w3" && game.launch_mode == "play"));
    assert!(scan
        .games
        .iter()
        .any(|game| game.id == "battlenet:classic:w3" && game.launch_mode == "direct"));
    let input = Inputs {
        battle: vec![("w3".into(), "Warcraft III: Reforged".into(), root.0.clone())],
        ..Inputs::default()
    };
    assert_eq!(plan(input, "battlenet:w3"), Err("launcher_client_missing"));
}

#[test]
fn untrusted_direct_product_or_state_cannot_dispatch() {
    let root = Fixture::new();
    root.file("Diablo II.exe");
    let mut game = scan_inputs(root.inputs("Diablo II")).games.remove(0);
    game.product_id = "classic:other".into();
    assert_eq!(launch(&game), Err("launcher_game_missing"));
    game.product_id = "classic:d2".into();
    game.launch_mode = "client";
    assert_eq!(launch(&game), Err("launcher_game_missing"));
    game.launch_mode = "direct";
    game.state = "ambiguous";
    assert_eq!(launch(&game), Err("launcher_game_missing"));
}
