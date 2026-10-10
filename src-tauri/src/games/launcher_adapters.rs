//! Provider installation formats. These records never authorize arbitrary commands.
use super::{label, local_path, read_bounded, Game, LaunchPlan, Launcher};
use serde::Deserialize;
use std::path::{Component, Path, PathBuf};

const MANIFEST_LIMIT: u64 = 1024 * 1024;

#[derive(Clone, Debug)]
pub(super) struct Install {
    pub launcher: Launcher,
    pub product: String,
    pub name: String,
    pub path: PathBuf,
    pub files: Vec<String>,
    pub complete: bool,
}

fn segment(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
}
pub(super) fn decimal(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 20
        && !value.starts_with('0')
        && value.bytes().all(|b| b.is_ascii_digit())
}

pub(super) fn riot_definition(product: &str) -> Option<(&'static str, &'static str)> {
    Some(match product {
        "league_of_legends" => ("League of Legends", "LeagueClient.exe"),
        "valorant" => ("VALORANT", "VALORANT.exe"),
        "bacon" => ("Legends of Runeterra", "LoR.exe"),
        "lion" => ("2XKO", "Lion.exe"),
        _ => return None,
    })
}

pub(super) fn rockstar_definition(product: &str) -> Option<(&'static str, &'static str)> {
    Some(match product {
        "gta5" => ("Grand Theft Auto V", "PlayGTAV.exe"),
        "gta5_gen9" => ("Grand Theft Auto V Enhanced", "GTA5_Enhanced_BE.exe"),
        "gta4" => ("Grand Theft Auto IV", "GTAIV.exe"),
        "rdr" => ("Red Dead Redemption", "RDR.exe"),
        "rdr2" => ("Red Dead Redemption 2", "RDR2.exe"),
        "lanoire" => ("L.A. Noire", "LANoire.exe"),
        "lanoirevr" => ("L.A. Noire: The VR Case Files", "LANoireVR.exe"),
        "mp3" => ("Max Payne 3", "MaxPayne3.exe"),
        "gtasa" => ("Grand Theft Auto: San Andreas", "gta_sa.exe"),
        "gta3" => ("Grand Theft Auto III", "gta3.exe"),
        "gtavc" => ("Grand Theft Auto: Vice City", "gta-vc.exe"),
        "bully" => ("Bully: Scholarship Edition", "Bully.exe"),
        "gta3unreal" => (
            "Grand Theft Auto III: The Definitive Edition",
            "Gameface/Binaries/Win64/LibertyCity.exe",
        ),
        "gtavcunreal" => (
            "Grand Theft Auto: Vice City – The Definitive Edition",
            "Gameface/Binaries/Win64/ViceCity.exe",
        ),
        "gtasaunreal" => (
            "Grand Theft Auto: San Andreas – The Definitive Edition",
            "Gameface/Binaries/Win64/SanAndreas.exe",
        ),
        _ => return None,
    })
}

pub(super) const RSI_CHANNELS: [(&str, &str); 4] = [
    ("LIVE", "live"),
    ("PTU", "ptu"),
    ("EPTU", "eptu"),
    ("TECH-PREVIEW", "tech-preview"),
];

fn valid_product(launcher: Launcher, product: &str) -> bool {
    match launcher {
        Launcher::Epic => {
            let parts: Vec<_> = product.split(':').collect();
            parts.len() == 3 && parts.iter().all(|part| segment(part))
        }
        Launcher::Gog => decimal(product),
        Launcher::Riot => product.split_once(':').is_some_and(|(id, channel)| {
            riot_definition(id).is_some() && matches!(channel, "live" | "pbe")
        }),
        Launcher::Rockstar => rockstar_definition(product).is_some(),
        Launcher::Rsi => product
            .strip_prefix("star-citizen:")
            .is_some_and(|id| RSI_CHANNELS.iter().any(|(_, channel)| id == *channel)),
        Launcher::Bsg => matches!(product, "eft" | "arena"),
        _ => false,
    }
}

fn relative_file(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 4096
        && !value.contains(':')
        && !value.chars().any(char::is_control)
        && !value.starts_with(['/', '\\'])
        && value
            .split(['/', '\\'])
            .all(|part| !matches!(part, "" | "." | ".."))
        && Path::new(value)
            .components()
            .all(|c| matches!(c, Component::Normal(_)))
}

pub(super) fn game(install: Install) -> Option<Game> {
    if !valid_product(install.launcher, &install.product)
        || !local_path(&install.path)
        || install.files.is_empty()
        || install.files.iter().any(|file| !relative_file(file))
    {
        return None;
    }
    let state = if !install.path.is_dir() {
        "missing"
    } else if !install.complete
        || install
            .files
            .iter()
            .any(|file| !install.path.join(file).is_file())
    {
        "incomplete"
    } else {
        "installed"
    };
    let mode = match install.launcher {
        Launcher::Rsi | Launcher::Bsg => "client",
        Launcher::Riot if install.product.ends_with(":pbe") => "client",
        _ => "play",
    };
    Some(Game {
        id: format!("{}:{}", install.launcher.key(), install.product),
        launcher: install.launcher,
        product_id: install.product,
        name: label(&install.name, &install.path),
        install_path: install.path.to_string_lossy().into_owned(),
        state,
        launch_mode: mode,
        install_key: None,
        artwork: None,
        catalog_steam_id: None,
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct EpicManifest {
    app_name: String,
    main_game_app_name: String,
    catalog_namespace: String,
    catalog_item_id: String,
    display_name: String,
    install_location: PathBuf,
    launch_executable: String,
    #[serde(rename = "bIsApplication")]
    application: bool,
    #[serde(rename = "bIsIncompleteInstall")]
    incomplete: bool,
}

pub(super) fn epic_manifest(bytes: &[u8]) -> Result<Option<Install>, &'static str> {
    if bytes.len() > MANIFEST_LIMIT as usize {
        return Err("launcher_manifest_invalid");
    }
    let data: EpicManifest =
        serde_json::from_slice(bytes).map_err(|_| "launcher_manifest_invalid")?;
    // DLC, prerequisites and Unreal Engine are not standalone library games.
    if !data.application
        || data.main_game_app_name != data.app_name
        || data.catalog_namespace == "ue"
    {
        return Ok(None);
    }
    let install = Install {
        launcher: Launcher::Epic,
        product: format!(
            "{}:{}:{}",
            data.catalog_namespace, data.catalog_item_id, data.app_name
        ),
        name: data.display_name,
        path: data.install_location,
        files: vec![data.launch_executable],
        complete: !data.incomplete,
    };
    if !valid_product(install.launcher, &install.product)
        || !local_path(&install.path)
        || !relative_file(&install.files[0])
    {
        return Err("launcher_manifest_invalid");
    }
    Ok(Some(install))
}

pub(super) fn manifest_bytes(path: &Path) -> Result<Vec<u8>, &'static str> {
    if !local_path(path) {
        return Err("launcher_manifest_invalid");
    }
    read_bounded(path, MANIFEST_LIMIT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GogManifest {
    game_id: String,
    #[serde(default)]
    root_game_id: Option<String>,
    #[serde(default)]
    name: String,
    #[serde(default)]
    play_tasks: Vec<GogTask>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GogTask {
    #[serde(default)]
    is_primary: bool,
    #[serde(default)]
    path: String,
}

pub(super) fn gog_install(
    id: &str,
    name: &str,
    path: PathBuf,
) -> Result<Option<Install>, &'static str> {
    if !decimal(id) || !local_path(&path) {
        return Ok(None);
    }
    let manifest_path = path.join(format!("goggame-{id}.info"));
    if !path.is_dir() {
        return Ok(Some(Install {
            launcher: Launcher::Gog,
            product: id.to_owned(),
            name: name.to_owned(),
            path,
            files: vec![format!("goggame-{id}.info")],
            complete: false,
        }));
    }
    let manifest: GogManifest = serde_json::from_slice(&manifest_bytes(&manifest_path)?)
        .map_err(|_| "launcher_manifest_invalid")?;
    if manifest.game_id != id
        || manifest
            .root_game_id
            .as_ref()
            .is_some_and(|root| root != id)
        || manifest.play_tasks.len() > 64
    {
        return Ok(None);
    }
    let Some(task) = manifest
        .play_tasks
        .iter()
        .find(|task| task.is_primary && relative_file(&task.path))
    else {
        return Ok(None);
    };
    Ok(Some(Install {
        launcher: Launcher::Gog,
        product: id.to_owned(),
        name: if manifest.name.is_empty() {
            name.to_owned()
        } else {
            manifest.name
        },
        path,
        files: vec![task.path.clone()],
        complete: true,
    }))
}

/// Riot writes this single top-level YAML scalar; other settings are not interpreted.
pub(super) fn riot_install_path(bytes: &[u8]) -> Option<PathBuf> {
    if bytes.len() > 64 * 1024 {
        return None;
    }
    let source = std::str::from_utf8(bytes).ok()?;
    let mut entries = source
        .lines()
        .filter_map(|line| line.strip_prefix("product_install_full_path:"));
    let raw = entries.next()?.trim();
    if entries.next().is_some() {
        return None;
    }
    let value = if raw.starts_with('"') {
        serde_json::from_str::<String>(raw).ok()?
    } else if raw.starts_with('\'') && raw.ends_with('\'') && raw.len() >= 2 {
        raw[1..raw.len() - 1].replace("''", "'")
    } else {
        raw.to_owned()
    };
    let path = PathBuf::from(value);
    local_path(&path).then_some(path)
}

pub(super) fn riot_install(product: &str, channel: &str, path: PathBuf) -> Option<Install> {
    let (name, executable) = riot_definition(product)?;
    if !matches!(channel, "live" | "pbe") {
        return None;
    }
    Some(Install {
        launcher: Launcher::Riot,
        product: format!("{product}:{channel}"),
        name: if channel == "live" {
            name.to_owned()
        } else {
            format!("{name} (PBE)")
        },
        path,
        files: vec![executable.to_owned()],
        complete: true,
    })
}

pub(super) fn rsi_install(channel: &str, path: PathBuf) -> Option<Install> {
    if !RSI_CHANNELS.iter().any(|(_, value)| *value == channel) {
        return None;
    }
    Some(Install {
        launcher: Launcher::Rsi,
        product: format!("star-citizen:{channel}"),
        name: if channel == "live" {
            "Star Citizen".to_owned()
        } else {
            format!("Star Citizen ({})", channel.to_uppercase())
        },
        path,
        files: vec!["Bin64/StarCitizen.exe".to_owned(), "Data.p4k".to_owned()],
        complete: true,
    })
}

pub(super) fn bsg_install(product: &str, path: PathBuf) -> Option<Install> {
    let (name, executable) = match product {
        "eft" => ("Escape from Tarkov", "EscapeFromTarkov.exe"),
        "arena" => ("Escape from Tarkov: Arena", "EscapeFromTarkovArena.exe"),
        _ => return None,
    };
    Some(Install {
        launcher: Launcher::Bsg,
        product: product.to_owned(),
        name: name.to_owned(),
        path,
        files: vec![executable.to_owned()],
        complete: true,
    })
}

pub(super) fn rockstar_install(product: &str, path: PathBuf) -> Option<Install> {
    let (name, executable) = rockstar_definition(product)?;
    Some(Install {
        launcher: Launcher::Rockstar,
        product: product.to_owned(),
        name: name.to_owned(),
        path,
        files: vec![executable.to_owned()],
        complete: true,
    })
}

pub(super) fn rockstar_product(command: &str) -> Option<&str> {
    let lower = command.to_ascii_lowercase();
    if !lower.contains("launcher.exe") && !lower.contains("uninstall.exe") {
        return None;
    }
    let mut products = command.split_whitespace().filter_map(|part| {
        part.strip_prefix("-uninstall=")
            .or_else(|| part.strip_prefix("/uninstall="))
    });
    let product = products.next()?.trim_matches('"');
    (products.next().is_none() && rockstar_definition(product).is_some()).then_some(product)
}

pub(super) fn launch(game: &Game, client: &Path) -> Result<LaunchPlan, &'static str> {
    if !valid_product(game.launcher, &game.product_id) {
        return Err("launcher_game_missing");
    }
    let args = match game.launcher {
        Launcher::Epic => {
            let identity = game.product_id.split(':').collect::<Vec<_>>().join("%3A");
            return Ok(LaunchPlan::Protocol(format!(
                "com.epicgames.launcher://apps/{identity}?action=launch&silent=true"
            )));
        }
        Launcher::Gog => vec![
            "/launchViaAutostart".to_owned(),
            format!("/gameId={}", game.product_id),
            "/command=runGame".to_owned(),
            format!("/path={}", game.install_path),
        ],
        Launcher::Riot if game.launch_mode == "play" => {
            let (product, channel) = game
                .product_id
                .split_once(':')
                .ok_or("launcher_game_missing")?;
            vec![
                format!("--launch-product={product}"),
                format!("--launch-patchline={channel}"),
            ]
        }
        Launcher::Rockstar => vec!["-launchTitleInFolder".to_owned(), game.install_path.clone()],
        Launcher::Rsi | Launcher::Bsg | Launcher::Riot => Vec::new(),
        _ => return Err("launcher_game_missing"),
    };
    Ok(LaunchPlan::Process {
        executable: client.to_path_buf(),
        args,
    })
}

#[cfg(test)]
#[path = "launcher_adapter_tests.rs"]
mod tests;
