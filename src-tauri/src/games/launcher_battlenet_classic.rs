//! Legacy Blizzard registrations are separate from modern Battle.net product codes.
use super::{local_path, path_key, Game, LaunchPlan, Launcher};
use std::path::{Path, PathBuf};

struct Classic {
    id: &'static str,
    registration: &'static str,
    name: &'static str,
    executable: &'static str,
    expansion: Option<&'static str>,
}

const GAMES: &[Classic] = &[
    Classic {
        id: "classic:d2",
        registration: "Diablo II",
        name: "Diablo II",
        executable: "Diablo II.exe",
        expansion: None,
    },
    Classic {
        id: "classic:d2x",
        registration: "Diablo II",
        name: "Diablo II: Lord of Destruction",
        executable: "Diablo II.exe",
        expansion: Some("d2exp.mpq"),
    },
    Classic {
        id: "classic:w3",
        registration: "Warcraft III",
        name: "Warcraft III: Reign of Chaos",
        executable: "Warcraft III.exe",
        expansion: None,
    },
    Classic {
        id: "classic:w3x",
        registration: "Warcraft III",
        name: "Warcraft III: The Frozen Throne",
        executable: "Frozen Throne.exe",
        expansion: Some("Frozen Throne.exe"),
    },
];

fn local_file(root: &Path, name: &str) -> bool {
    let file = root.join(name);
    file.is_file()
        && std::fs::canonicalize(&file)
            .ok()
            .and_then(|path| path.parent().map(path_key))
            == Some(path_key(root))
}

pub(super) fn scan_record(name: &str, publisher: &str, root: &Path) -> Vec<Game> {
    if !local_path(root)
        || !publisher
            .trim()
            .eq_ignore_ascii_case("Blizzard Entertainment")
    {
        return Vec::new();
    }
    GAMES
        .iter()
        .filter(|game| game.registration.eq_ignore_ascii_case(name.trim()))
        // A base Diablo II registration also exists without Lord of Destruction.
        // Do not infer the expansion merely from their shared executable.
        .filter(|game| game.expansion.is_none_or(|file| local_file(root, file)))
        .map(|game| Game {
            id: format!("battlenet:{}", game.id),
            launcher: Launcher::Battlenet,
            product_id: game.id.into(),
            name: game.name.into(),
            install_path: root.to_string_lossy().into_owned(),
            state: if !root.is_dir() {
                "missing"
            } else if !local_file(root, game.executable) {
                "incomplete"
            } else {
                "installed"
            },
            launch_mode: "direct",
            install_key: None,
            artwork: None,
            catalog_steam_id: None,
        })
        .collect()
}

pub(super) fn launch(game: &Game) -> Result<LaunchPlan, &'static str> {
    let definition = GAMES
        .iter()
        .find(|item| item.id == game.product_id)
        .ok_or("launcher_game_missing")?;
    let root = PathBuf::from(&game.install_path);
    if game.launcher != Launcher::Battlenet
        || game.launch_mode != "direct"
        || game.state != "installed"
        || !local_path(&root)
        || !local_file(&root, definition.executable)
        || definition
            .expansion
            .is_some_and(|file| !local_file(&root, file))
    {
        return Err("launcher_game_missing");
    }
    // The existing dispatcher uses the executable's parent as the working directory.
    Ok(LaunchPlan::Process {
        executable: root.join(definition.executable),
        args: Vec::new(),
    })
}

#[cfg(test)]
#[path = "launcher_battlenet_classic_tests.rs"]
mod tests;
