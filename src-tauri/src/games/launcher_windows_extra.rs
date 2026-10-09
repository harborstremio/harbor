//! Fixed provider registries and installation manifests; no recursive disk or account scan.
use super::super::adapters;
use super::{
    client, local_path, open, subkeys, value, Inputs, Launcher, Path, PathBuf, Program,
    HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE,
};

const EPIC_CLIENTS: [&str; 2] = [
    "Launcher/Portal/Binaries/Win32/EpicGamesLauncher.exe",
    "Launcher/Portal/Binaries/Win64/EpicGamesLauncher.exe",
];

fn push(inputs: &mut Inputs, install: Option<adapters::Install>) {
    if let Some(install) = install {
        inputs.extra.push(install);
    }
}
fn gog(inputs: &mut Inputs, id: &str, name: &str, path: PathBuf) {
    match adapters::gog_install(id, name, path) {
        Ok(install) => push(inputs, install),
        Err(warning) => inputs.warnings.push(warning),
    }
}

fn rsi_root(inputs: &mut Inputs, root: &Path) {
    if !local_path(root) {
        return;
    }
    for (folder, channel) in adapters::RSI_CHANNELS {
        let path = root.join("StarCitizen").join(folder);
        // A configured/default library directory alone is not a game installation.
        if path.join("Data.p4k").is_file() || path.join("Bin64/StarCitizen.exe").is_file() {
            push(inputs, adapters::rsi_install(channel, path));
        }
    }
}

fn programs(inputs: &mut Inputs, entries: &[Program]) {
    for entry in entries {
        let name = entry.name.trim().to_ascii_lowercase();
        match name.as_str() {
            "epic games launcher" => client(inputs, Launcher::Epic, &entry.path, &EPIC_CLIENTS),
            "gog galaxy" => client(inputs, Launcher::Gog, &entry.path, &["GalaxyClient.exe"]),
            "riot client" => client(
                inputs,
                Launcher::Riot,
                &entry.path,
                &["RiotClientServices.exe"],
            ),
            "rockstar games launcher" => {
                client(inputs, Launcher::Rockstar, &entry.path, &["Launcher.exe"])
            }
            _ => {}
        }
        if name == "rsi launcher" || name.starts_with("rsi launcher ") {
            client(inputs, Launcher::Rsi, &entry.path, &["RSI Launcher.exe"]);
            rsi_root(inputs, &entry.path);
            if let Some(parent) = entry.path.parent() {
                rsi_root(inputs, parent);
            }
        }
        if name == "bsglauncher" || name.starts_with("bsglauncher ") || name == "bsg launcher" {
            client(inputs, Launcher::Bsg, &entry.path, &["BsgLauncher.exe"]);
        }
        if entry.publisher.eq_ignore_ascii_case("GOG.com") {
            if let Some(id) = entry
                .key
                .strip_suffix("_is1")
                .filter(|id| adapters::decimal(id))
            {
                gog(inputs, id, &entry.name, entry.path.clone());
            }
        }
        if let Some(product) = entry.key.strip_prefix("Riot Game ") {
            if let Some((product, channel)) = product.split_once('.') {
                push(
                    inputs,
                    adapters::riot_install(
                        product,
                        &channel.to_ascii_lowercase(),
                        entry.path.clone(),
                    ),
                );
            }
        }
        match entry.key.as_str() {
            "EscapeFromTarkov" => push(inputs, adapters::bsg_install("eft", entry.path.clone())),
            "EscapeFromTarkovArena" => {
                push(inputs, adapters::bsg_install("arena", entry.path.clone()))
            }
            _ => {}
        }
        // Rockstar's general game keys also describe Steam copies. Its own uninstall
        // product switch is required before assigning the Rockstar library identity.
        if entry
            .publisher
            .to_ascii_lowercase()
            .starts_with("rockstar games")
        {
            if let Some(product) = super::super::adapters::rockstar_product(&entry.uninstall) {
                push(
                    inputs,
                    adapters::rockstar_install(product, entry.path.clone()),
                );
            }
        }
    }
}

fn registry(inputs: &mut Inputs) {
    for hive in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
        for prefix in [r"SOFTWARE", r"SOFTWARE\WOW6432Node"] {
            if let Some(key) = open(hive, &format!(r"{prefix}\GOG.com\GalaxyClient\paths")) {
                if let Some(path) = value(key.0, "client") {
                    client(
                        inputs,
                        Launcher::Gog,
                        Path::new(&path),
                        &["GalaxyClient.exe"],
                    );
                }
            }
            if let Some(root) = open(hive, &format!(r"{prefix}\GOG.com\Games")) {
                for id in subkeys(root.0, &mut inputs.warnings) {
                    if !adapters::decimal(&id) {
                        continue;
                    }
                    let Some(key) = open(root.0, &id) else {
                        continue;
                    };
                    if let Some(path) = value(key.0, "path") {
                        let name = value(key.0, "gameName").unwrap_or_default();
                        gog(inputs, &id, &name, PathBuf::from(path));
                    }
                }
            }
            if let Some(key) = open(hive, &format!(r"{prefix}\Rockstar Games\Launcher")) {
                if let Some(path) = value(key.0, "InstallFolder") {
                    client(
                        inputs,
                        Launcher::Rockstar,
                        Path::new(&path),
                        &["Launcher.exe"],
                    );
                }
            }
            if let Some(key) = open(hive, &format!(r"{prefix}\EpicGames\Unreal Engine")) {
                if let Some(path) = value(key.0, "INSTALLDIR") {
                    client(inputs, Launcher::Epic, Path::new(&path), &EPIC_CLIENTS);
                }
            }
        }
    }
}

fn epic(inputs: &mut Inputs, root: &Path) {
    let manifest_root = root.join("Epic/EpicGamesLauncher/Data/Manifests");
    if !local_path(&manifest_root) {
        return;
    }
    let Ok(entries) = std::fs::read_dir(&manifest_root) else {
        return;
    };
    for (index, entry) in entries.enumerate() {
        if index >= 2048 {
            inputs.warnings.push("launcher_manifest_limit");
            break;
        }
        let Ok(entry) = entry else {
            inputs.warnings.push("launcher_manifest_unreadable");
            continue;
        };
        if !entry
            .file_type()
            .is_ok_and(|kind| kind.is_file() && !kind.is_symlink())
            || !entry
                .path()
                .extension()
                .is_some_and(|value| value.eq_ignore_ascii_case("item"))
        {
            continue;
        }
        match adapters::manifest_bytes(&entry.path())
            .and_then(|bytes| adapters::epic_manifest(&bytes))
        {
            Ok(install) => push(inputs, install),
            Err(warning) => inputs.warnings.push(warning),
        }
    }
}

#[derive(serde::Deserialize)]
struct RiotClients {
    rc_default: Option<PathBuf>,
    rc_live: Option<PathBuf>,
}
fn riot(inputs: &mut Inputs, root: &Path) {
    let root = root.join("Riot Games");
    let record = root.join("RiotClientInstalls.json");
    if record.is_file() {
        match adapters::manifest_bytes(&record).and_then(|bytes| {
            serde_json::from_slice::<RiotClients>(&bytes).map_err(|_| "launcher_manifest_invalid")
        }) {
            Ok(record) => {
                for path in [record.rc_live, record.rc_default].into_iter().flatten() {
                    if local_path(&path)
                        && path.is_file()
                        && path
                            .file_name()
                            .is_some_and(|name| name.eq_ignore_ascii_case("RiotClientServices.exe"))
                    {
                        inputs.clients.entry(Launcher::Riot).or_insert(path);
                    }
                }
            }
            Err(warning) => inputs.warnings.push(warning),
        }
    }
    for product in ["league_of_legends", "valorant", "bacon", "lion"] {
        for channel in ["live", "pbe"] {
            let key = format!("{product}.{channel}");
            let path = root
                .join("Metadata")
                .join(&key)
                .join(format!("{key}.product_settings.yaml"));
            if !path.is_file() {
                continue;
            }
            match adapters::manifest_bytes(&path) {
                Ok(bytes) => {
                    if let Some(path) = adapters::riot_install_path(&bytes) {
                        push(inputs, adapters::riot_install(product, channel, path));
                    } else {
                        inputs.warnings.push("launcher_manifest_invalid");
                    }
                }
                Err(warning) => inputs.warnings.push(warning),
            }
        }
    }
}

pub(super) fn discover(inputs: &mut Inputs, entries: &[Program]) {
    programs(inputs, entries);
    registry(inputs);
    if let Some(root) = std::env::var_os("ProgramData") {
        let root = PathBuf::from(root);
        if local_path(&root) {
            epic(inputs, &root);
            riot(inputs, &root);
        }
    }
    for variable in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Some(root) = std::env::var_os(variable) {
            let root = PathBuf::from(root);
            client(
                inputs,
                Launcher::Epic,
                &root.join("Epic Games"),
                &EPIC_CLIENTS,
            );
            client(
                inputs,
                Launcher::Gog,
                &root.join("GOG Galaxy"),
                &["GalaxyClient.exe"],
            );
            client(
                inputs,
                Launcher::Rockstar,
                &root.join("Rockstar Games/Launcher"),
                &["Launcher.exe"],
            );
            let rsi = root.join("Roberts Space Industries");
            client(
                inputs,
                Launcher::Rsi,
                &rsi.join("RSI Launcher"),
                &["RSI Launcher.exe"],
            );
            rsi_root(inputs, &rsi);
            client(
                inputs,
                Launcher::Bsg,
                &root.join("BsgLauncher"),
                &["BsgLauncher.exe"],
            );
        }
    }
    if let Some(drive) = std::env::var_os("SystemDrive") {
        let root = PathBuf::from(drive).join(r"\Battlestate Games");
        client(
            inputs,
            Launcher::Bsg,
            &root.join("BsgLauncher"),
            &["BsgLauncher.exe"],
        );
        // Exact default directories, verified by their game executable; no sibling scan.
        for (folder, product) in [
            ("EFT", "eft"),
            ("Escape from Tarkov", "eft"),
            ("Escape from Tarkov Arena", "arena"),
        ] {
            if let Some(install) = adapters::bsg_install(product, root.join(folder)) {
                if install
                    .files
                    .iter()
                    .all(|file| install.path.join(file).is_file())
                {
                    inputs.extra.push(install);
                }
            }
        }
    }
}
