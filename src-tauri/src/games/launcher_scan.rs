//! Read-only launcher discovery. Product identities come from installation records, never titles.
#![cfg_attr(not(target_os = "windows"), allow(dead_code))]
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

#[cfg(target_os = "windows")]
#[path = "launcher_windows.rs"]
mod platform;

#[path = "launcher_adapters.rs"]
mod adapters;

#[path = "launcher_ubisoft.rs"]
mod ubisoft;

#[path = "launcher_itch.rs"]
mod itch;

#[path = "launcher_battlenet_classic.rs"]
mod battle_classic;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Launcher {
    Battlenet,
    Ea,
    Ubisoft,
    Epic,
    Gog,
    Riot,
    Rockstar,
    Rsi,
    Bsg,
    Itch,
}
impl Launcher {
    fn key(self) -> &'static str {
        match self {
            Self::Battlenet => "battlenet",
            Self::Ea => "ea",
            Self::Ubisoft => "ubisoft",
            Self::Epic => "epic",
            Self::Gog => "gog",
            Self::Riot => "riot",
            Self::Rockstar => "rockstar",
            Self::Rsi => "rsi",
            Self::Bsg => "bsg",
            Self::Itch => "itch",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: String,
    pub launcher: Launcher,
    pub product_id: String,
    pub name: String,
    pub install_path: String,
    pub state: &'static str,
    /// Some Battle.net variants support selecting their client page, not direct launch.
    pub launch_mode: &'static str,
    /// Observed Windows uninstall registration, never a launch argument.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artwork: Option<ubisoft::Artwork>,
    /// Exact publisher catalog association; never used for ownership or dispatch.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub catalog_steam_id: Option<u32>,
}
#[derive(Debug, Clone, Serialize)]
pub struct Client {
    pub launcher: Launcher,
    pub installed: bool,
}
#[derive(Debug, Default, Serialize)]
pub struct Scan {
    pub supported: bool,
    pub clients: Vec<Client>,
    pub games: Vec<Game>,
    pub warnings: Vec<&'static str>,
}

#[derive(Default)]
pub(super) struct Inputs {
    clients: BTreeMap<Launcher, PathBuf>,
    battle_db: Option<PathBuf>,
    battle: Vec<(String, String, PathBuf)>,
    battle_classic: Vec<(String, String, PathBuf)>,
    ubisoft: Vec<(String, String, PathBuf)>,
    ubisoft_cache: Option<PathBuf>,
    itch_db: Option<PathBuf>,
    ea: Vec<(String, PathBuf)>,
    ea_keys: Vec<(PathBuf, String)>,
    extra: Vec<adapters::Install>,
    warnings: Vec<&'static str>,
}

pub fn scan() -> Scan {
    #[cfg(target_os = "windows")]
    {
        scan_inputs(platform::discover())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Scan::default()
    }
}

fn identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._:-".contains(&b))
}
fn ea_registration(scope: &str, value: &str) -> Option<String> {
    let bytes = value.as_bytes();
    if !matches!(scope, "machine" | "user")
        || bytes.len() != 38
        || bytes[0] != b'{'
        || bytes[37] != b'}'
    {
        return None;
    }
    for (index, byte) in bytes[1..37].iter().enumerate() {
        if [8, 13, 18, 23].contains(&index) {
            if *byte != b'-' {
                return None;
            }
        } else if !byte.is_ascii_hexdigit() {
            return None;
        }
    }
    Some(format!("{scope}:{}", value[1..37].to_ascii_lowercase()))
}
fn local_path(path: &Path) -> bool {
    let text = path.to_string_lossy();
    path.is_absolute()
        && text.len() <= 32_000
        && !text.chars().any(char::is_control)
        && !text.starts_with("\\\\")
        && !text.starts_with("//")
        && !path
            .components()
            .any(|c| matches!(c, Component::ParentDir | Component::CurDir))
        && path.parent().is_some_and(|parent| parent != path)
        && path.file_name().is_some()
}
fn read_bounded(path: &Path, limit: u64) -> Result<Vec<u8>, &'static str> {
    let file = fs::File::open(path).map_err(|_| "launcher_manifest_unreadable")?;
    let meta = file
        .metadata()
        .map_err(|_| "launcher_manifest_unreadable")?;
    if !meta.is_file() || meta.len() > limit {
        return Err("launcher_manifest_invalid");
    }
    let mut bytes = Vec::new();
    file.take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "launcher_manifest_unreadable")?;
    if bytes.len() as u64 > limit {
        return Err("launcher_manifest_invalid");
    }
    Ok(bytes)
}

enum ProtoValue<'a> {
    Number(u64),
    Bytes(&'a [u8]),
}

// Only bounded installation/product records are read, never account/session caches.
fn protobuf_values(mut bytes: &[u8]) -> Result<Vec<(u32, ProtoValue<'_>)>, &'static str> {
    fn varint(bytes: &mut &[u8]) -> Result<u64, &'static str> {
        let mut value = 0u64;
        for shift in (0..70).step_by(7) {
            let (&byte, rest) = bytes.split_first().ok_or("launcher_manifest_invalid")?;
            *bytes = rest;
            if shift == 63 && byte > 1 {
                return Err("launcher_manifest_invalid");
            }
            value |= u64::from(byte & 127) << shift;
            if byte & 128 == 0 {
                return Ok(value);
            }
        }
        Err("launcher_manifest_invalid")
    }
    let mut fields = Vec::new();
    let mut count = 0;
    while !bytes.is_empty() {
        count += 1;
        if count > 8192 {
            return Err("launcher_manifest_invalid");
        }
        let key = varint(&mut bytes)?;
        if key >> 3 == 0 || key >> 3 > 0x1fff_ffff {
            return Err("launcher_manifest_invalid");
        }
        match key & 7 {
            0 => {
                fields.push(((key >> 3) as u32, ProtoValue::Number(varint(&mut bytes)?)));
            }
            1 | 5 => {
                let size = if key & 7 == 1 { 8 } else { 4 };
                bytes = bytes.get(size..).ok_or("launcher_manifest_invalid")?;
            }
            2 => {
                let size = usize::try_from(varint(&mut bytes)?)
                    .map_err(|_| "launcher_manifest_invalid")?;
                let field = bytes.get(..size).ok_or("launcher_manifest_invalid")?;
                fields.push(((key >> 3) as u32, ProtoValue::Bytes(field)));
                bytes = &bytes[size..];
            }
            _ => return Err("launcher_manifest_invalid"),
        }
    }
    Ok(fields)
}
fn protobuf_fields(bytes: &[u8]) -> Result<Vec<(u32, &[u8])>, &'static str> {
    Ok(protobuf_values(bytes)?
        .into_iter()
        .filter_map(|(id, value)| match value {
            ProtoValue::Bytes(bytes) => Some((id, bytes)),
            ProtoValue::Number(_) => None,
        })
        .collect())
}
fn single<'a>(fields: &[(u32, &'a [u8])], key: u32) -> Result<&'a [u8], &'static str> {
    let mut values = fields.iter().filter(|(id, _)| *id == key);
    let value = values.next().ok_or("launcher_manifest_invalid")?.1;
    if values.next().is_some() {
        return Err("launcher_manifest_invalid");
    }
    Ok(value)
}
fn text(bytes: &[u8]) -> Result<String, &'static str> {
    let value = std::str::from_utf8(bytes).map_err(|_| "launcher_manifest_invalid")?;
    if value.len() > 32_000 || value.chars().any(char::is_control) {
        return Err("launcher_manifest_invalid");
    }
    Ok(value.to_owned())
}
fn battle_installs(bytes: &[u8]) -> Result<Vec<(String, String, PathBuf)>, &'static str> {
    if bytes.len() > 4 * 1024 * 1024 {
        return Err("launcher_manifest_invalid");
    }
    let mut out = Vec::new();
    for (_, item) in protobuf_fields(bytes)?
        .into_iter()
        .filter(|(id, _)| *id == 1)
        .take(1024)
    {
        let fields = protobuf_fields(item)?;
        let uid = text(single(&fields, 1)?)?;
        if matches!(uid.as_str(), "agent" | "battle.net" | "bna") {
            continue;
        }
        let product = text(single(&fields, 2)?)?;
        let data = protobuf_fields(single(&fields, 3)?)?;
        let path = PathBuf::from(text(single(&data, 1)?)?);
        if !identifier(&uid) || !identifier(&product) || !local_path(&path) {
            continue;
        }
        out.push((uid, product, path));
    }
    Ok(out)
}

#[derive(Deserialize)]
struct EaManifest {
    #[serde(rename = "contentIDs")]
    ids: EaIds,
}
#[derive(Deserialize)]
struct EaIds {
    #[serde(rename = "contentID", default)]
    values: Vec<String>,
}
fn ea_content_ids(bytes: &[u8]) -> Result<Vec<String>, &'static str> {
    if bytes.len() > 2 * 1024 * 1024 {
        return Err("launcher_manifest_invalid");
    }
    let source = std::str::from_utf8(bytes).map_err(|_| "launcher_manifest_invalid")?;
    let mut reader = quick_xml::Reader::from_str(source);
    let mut depth: usize = 0;
    loop {
        use quick_xml::events::Event;
        match reader
            .read_event()
            .map_err(|_| "launcher_manifest_invalid")?
        {
            Event::DocType(_) => return Err("launcher_manifest_invalid"),
            Event::Start(_) => {
                depth += 1;
                if depth > 64 {
                    return Err("launcher_manifest_invalid");
                }
            }
            Event::End(_) => {
                depth = depth.checked_sub(1).ok_or("launcher_manifest_invalid")?;
            }
            Event::Eof => break,
            _ => {}
        }
    }
    if depth != 0 {
        return Err("launcher_manifest_invalid");
    }
    let manifest: EaManifest =
        quick_xml::de::from_str(source).map_err(|_| "launcher_manifest_invalid")?;
    let mut ids = manifest.ids.values;
    if ids.is_empty() || ids.len() > 64 || ids.iter().any(|id| !identifier(id)) {
        return Err("launcher_manifest_invalid");
    }
    ids.sort();
    ids.dedup();
    Ok(ids)
}

fn battle_definition(id: &str) -> Option<(&'static str, &'static str)> {
    Some(match id.to_ascii_lowercase().as_str() {
        "wow" => ("World of Warcraft", "WoW"),
        "diablo3" => ("Diablo III", "D3"),
        "s2" => ("StarCraft II", "S2"),
        "s1" => ("StarCraft: Remastered", "S1"),
        "hs_beta" => ("Hearthstone", "WTCG"),
        "heroes" => ("Heroes of the Storm", "Hero"),
        "prometheus" => ("Overwatch 2", "Pro"),
        "viper" => ("Call of Duty: Black Ops 4", "VIPR"),
        "odin" => ("Call of Duty: Modern Warfare", "ODIN"),
        "w3" => ("Warcraft III: Reforged", "W3"),
        "lazarus" => ("Call of Duty: Modern Warfare 2 Campaign Remastered", "LAZR"),
        "zeus" => ("Call of Duty: Black Ops Cold War", "ZEUS"),
        "wlby" => ("Crash Bandicoot 4", "WLBY"),
        "osi" => ("Diablo II: Resurrected", "OSI"),
        "rtro" => ("Blizzard Arcade Collection", "RTRO"),
        "fore" => ("Call of Duty: Vanguard", "FORE"),
        "anbs" => ("Diablo Immortal", "ANBS"),
        "auks" => ("Call of Duty: Modern Warfare II", "AUKS"),
        "fen" => ("Diablo IV", "Fen"),
        "d1" => ("Diablo", "D1"),
        "w1r" => ("Warcraft: Remastered", "W1R"),
        "w2r" => ("Warcraft II: Remastered", "W2R"),
        "gryphon" => ("Warcraft Rumble", "GRY"),
        "aris" => ("DOOM: The Dark Ages", "ARIS"),
        "scorpio" => ("Sea of Thieves", "SCOR"),
        "arkansas" => ("The Outer Worlds 2", "ARK"),
        "libra" => ("Tony Hawk's Pro Skater 3 + 4", "LBRA"),
        "pinta" => ("Call of Duty: Modern Warfare III", "PNTA"),
        "aqua" => ("Avowed", "AQUA"),
        _ => return None,
    })
}
fn battle_name(id: &str) -> Option<&'static str> {
    battle_definition(id).map(|value| value.0).or(match id {
        "wow_classic" => Some("World of Warcraft Classic"),
        "wow_classic_era" => Some("World of Warcraft Classic Era"),
        "wow_classic_anniversary" => Some("World of Warcraft Classic Anniversary"),
        "wowt" => Some("World of Warcraft PTR"),
        _ => None,
    })
}
fn label(name: &str, path: &Path) -> String {
    let value = if name.trim().is_empty() {
        path.file_name().and_then(|v| v.to_str()).unwrap_or("Game")
    } else {
        name.trim()
    };
    value
        .chars()
        .filter(|c| !c.is_control())
        .take(256)
        .collect()
}
fn path_key(path: &Path) -> String {
    let resolved = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let text = resolved
        .to_string_lossy()
        .trim_start_matches(r"\\?\")
        .replace('\\', "/");
    if cfg!(windows) {
        text.trim_end_matches('/').to_lowercase()
    } else {
        text.trim_end_matches('/').to_owned()
    }
}
fn install_state(launcher: Launcher, product: &str, path: &Path) -> &'static str {
    if !path.is_dir() {
        return "missing";
    }
    // WoW editions share a root. Its presence alone cannot prove that the selected edition exists.
    let binary = if launcher == Launcher::Battlenet {
        match product {
            "wow" => Some("_retail_/Wow.exe"),
            "wow_classic" => Some("_classic_/WowClassic.exe"),
            "wow_classic_era" => Some("_classic_era_/WowClassic.exe"),
            "wow_classic_anniversary" => Some("_anniversary_/WowClassic.exe"),
            "wowt" => Some("_ptr_/Wow.exe"),
            _ => None,
        }
    } else {
        None
    };
    if binary.is_some_and(|binary| !path.join(binary).is_file()) {
        "incomplete"
    } else {
        "installed"
    }
}
type InstallRecords = BTreeMap<String, BTreeMap<String, Game>>;

fn record(games: &mut InstallRecords, game: Game) {
    let path = path_key(Path::new(&game.install_path));
    games
        .entry(game.id.clone())
        .or_default()
        .entry(path)
        .and_modify(|existing| {
            // Conflicting manifests at the same location can straddle an update.
            // Never let directory iteration order turn a partial install into Play.
            if existing.state != game.state {
                existing.state = "incomplete";
            }
        })
        .or_insert(game);
}

fn resolve_installs(records: InstallRecords) -> Vec<Game> {
    fn priority(game: &Game) -> u8 {
        match game.state {
            "installed" => 2,
            "incomplete" => 1,
            _ => 0,
        }
    }
    records
        .into_values()
        .filter_map(|paths| {
            let best = paths.values().map(priority).max()?;
            let mut candidates = paths.into_values().filter(|game| priority(game) == best);
            let mut game = candidates.next()?;
            // A moved install can leave stale registry/database paths. Resolve only when
            // one strongest canonical path remains; two live installs still conflict.
            if candidates.next().is_some() {
                game.state = "ambiguous";
            }
            Some(game)
        })
        .collect()
}

fn add(
    games: &mut InstallRecords,
    launcher: Launcher,
    product: &str,
    name: &str,
    path: &Path,
    mode: &'static str,
) {
    if !identifier(product) || !local_path(path) {
        return;
    }
    let id = format!("{}:{product}", launcher.key());
    let state = install_state(launcher, product, path);
    record(
        games,
        Game {
            id,
            launcher,
            product_id: product.to_owned(),
            name: label(name, path),
            install_path: path.to_string_lossy().into_owned(),
            state,
            launch_mode: mode,
            install_key: None,
            artwork: None,
            catalog_steam_id: None,
        },
    );
}
fn scan_inputs(mut inputs: Inputs) -> Scan {
    let mut games = BTreeMap::new();
    for (name, publisher, path) in inputs.battle_classic {
        for game in battle_classic::scan_record(&name, &publisher, &path) {
            record(&mut games, game);
        }
    }
    for install in inputs.extra {
        if let Some(game) = adapters::game(install) {
            record(&mut games, game);
        }
    }
    if let Some(path) = &inputs.battle_db {
        match read_bounded(path, 4 * 1024 * 1024).and_then(|bytes| battle_installs(&bytes)) {
            Ok(records) => {
                for (uid, _, root) in records {
                    // A known launcher product or a matching uninstall record is required to exclude tools.
                    if let Some(name) = battle_name(&uid) {
                        inputs.battle.push((uid, name.to_owned(), root));
                    }
                }
            }
            Err(error) => inputs.warnings.push(error),
        }
    }
    for (id, name, path) in inputs.battle {
        add(
            &mut games,
            Launcher::Battlenet,
            &id.to_ascii_lowercase(),
            &name,
            &path,
            if battle_definition(&id).is_some() {
                "play"
            } else {
                "client"
            },
        );
    }
    for (id, name, path) in inputs.ubisoft {
        if let Ok(id) = id.parse::<u32>() {
            if id > 0 {
                add(
                    &mut games,
                    Launcher::Ubisoft,
                    &id.to_string(),
                    &name,
                    &path,
                    "play",
                );
            }
        }
    }
    let mut ea_keys: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for (path, key) in inputs.ea_keys {
        if local_path(&path) {
            ea_keys.entry(path_key(&path)).or_default().insert(key);
        }
    }
    for (name, path) in inputs.ea {
        if !local_path(&path) {
            continue;
        }
        let manifest = path.join("__Installer/installerdata.xml");
        if !manifest.is_file() {
            continue;
        }
        match read_bounded(&manifest, 2 * 1024 * 1024).and_then(|bytes| ea_content_ids(&bytes)) {
            Ok(ids) => {
                // One install may have several equivalent content IDs. The complete sorted set is
                // stable across manifest order and accepted by EA's offerIds launch parameter.
                let product = ids.join(",");
                let id = format!("ea:{product}");
                let state = if path.is_dir() {
                    "installed"
                } else {
                    "missing"
                };
                record(
                    &mut games,
                    Game {
                        id,
                        launcher: Launcher::Ea,
                        product_id: product,
                        name: label(&name, &path),
                        install_path: path.to_string_lossy().into_owned(),
                        state,
                        launch_mode: "play",
                        install_key: ea_keys
                            .get(&path_key(&path))
                            .filter(|keys| keys.len() == 1)
                            .and_then(|keys| keys.first().cloned()),
                        artwork: None,
                        catalog_steam_id: None,
                    },
                );
            }
            Err(error) => inputs.warnings.push(error),
        }
    }
    let mut games = resolve_installs(games);
    if let Some(path) = &inputs.itch_db {
        let (installed, warnings) = itch::scan(path);
        games.extend(installed);
        inputs.warnings.extend(warnings);
    }
    // The catalog can contain uninstalled products and DLC. It only decorates exact
    // observed products; it cannot create installs or change their launch identity.
    if let Some(path) = inputs
        .ubisoft_cache
        .filter(|_| games.iter().any(|game| game.launcher == Launcher::Ubisoft))
    {
        if let Ok(products) =
            read_bounded(&path, ubisoft::MAX_CACHE_BYTES).and_then(|bytes| ubisoft::catalog(&bytes))
        {
            for game in games
                .iter_mut()
                .filter(|game| game.launcher == Launcher::Ubisoft)
            {
                if let Some(product) = game
                    .product_id
                    .parse::<u32>()
                    .ok()
                    .and_then(|id| products.get(&id))
                {
                    if let Some(name) = &product.name {
                        game.name.clone_from(name);
                    }
                    game.artwork = product.artwork.clone();
                    game.catalog_steam_id = product.catalog_steam_id;
                }
            }
        }
    }
    inputs.warnings.sort_unstable();
    inputs.warnings.dedup();
    Scan {
        supported: true,
        clients: [
            Launcher::Battlenet,
            Launcher::Ea,
            Launcher::Ubisoft,
            Launcher::Epic,
            Launcher::Gog,
            Launcher::Riot,
            Launcher::Rockstar,
            Launcher::Rsi,
            Launcher::Bsg,
            Launcher::Itch,
        ]
        .into_iter()
        .map(|launcher| Client {
            launcher,
            installed: inputs
                .clients
                .get(&launcher)
                .is_some_and(|path| local_path(path) && path.is_file()),
        })
        .collect(),
        games,
        warnings: inputs.warnings,
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum LaunchPlan {
    Process {
        executable: PathBuf,
        args: Vec<String>,
    },
    Protocol(String),
}
#[cfg(test)]
fn plan(inputs: Inputs, id: &str) -> Result<LaunchPlan, &'static str> {
    resolved_plan(inputs, id).map(|(plan, _)| plan)
}
fn resolved_plan(inputs: Inputs, id: &str) -> Result<(LaunchPlan, Game), &'static str> {
    let clients = inputs.clients.clone();
    let itch_db = inputs.itch_db.clone();
    let game = scan_inputs(inputs)
        .games
        .into_iter()
        .find(|game| game.id == id)
        .ok_or("launcher_game_missing")?;
    if game.state != "installed" {
        return Err("launcher_game_missing");
    }
    if game.launch_mode == "direct" {
        return battle_classic::launch(&game).map(|plan| (plan, game));
    }
    let client = clients
        .get(&game.launcher)
        .filter(|path| local_path(path) && path.is_file())
        .ok_or("launcher_client_missing")?;
    let plan = match game.launcher {
        Launcher::Itch => itch::launch(itch_db.as_deref().ok_or("launcher_game_missing")?, client, id),
        Launcher::Battlenet => {
            let args = if let Some((_, code)) = battle_definition(&game.product_id) {
                vec![format!("--exec=launch {code}")]
            } else {
                vec![
                    format!("--game={}", game.product_id),
                    format!("--productcode={}", game.product_id),
                    format!("--gamepath={}", game.install_path),
                ]
            };
            Ok(LaunchPlan::Process {
                executable: client.clone(),
                args,
            })
        }
        Launcher::Ubisoft => Ok(LaunchPlan::Protocol(format!(
            "uplay://launch/{}/0",
            game.product_id
        ))),
        Launcher::Ea => {
            let mut url = url::Url::parse("origin2://game/launch").unwrap();
            url.query_pairs_mut()
                .append_pair("offerIds", &game.product_id)
                .append_pair("autoDownload", "0");
            Ok(LaunchPlan::Protocol(url.into()))
        }
        _ => adapters::launch(&game, client),
    }?;
    Ok((plan, game))
}
pub fn prepare_observed_launch(id: &str) -> Result<(LaunchPlan, Game), &'static str> {
    if id.len() > 9000 { return Err("launcher_game_missing"); }
    #[cfg(target_os = "windows")]
    { resolved_plan(platform::discover(), id) }
    #[cfg(not(target_os = "windows"))]
    { Err("launcher_platform_unsupported") }
}

fn management(inputs: Inputs, id: &str) -> Result<(Game, Option<PathBuf>), &'static str> {
    let clients = inputs.clients.clone();
    let game = scan_inputs(inputs).games.into_iter().find(|game| game.id == id && game.state == "installed").ok_or("launcher_game_missing")?;
    let client = clients.get(&game.launcher).filter(|path| local_path(path) && path.is_file()).cloned();
    Ok((game, client))
}
pub fn prepare_management(id: &str) -> Result<(Game, Option<PathBuf>), &'static str> {
    if id.len() > 9000 { return Err("launcher_game_missing"); }
    #[cfg(windows)]
    { management(platform::discover(), id) }
    #[cfg(not(windows))]
    { Err("launcher_platform_unsupported") }
}
#[cfg(test)]
pub fn prepare_launch(id: &str) -> Result<LaunchPlan, &'static str> {
    if id.len() > 9000 {
        return Err("launcher_game_missing");
    }
    #[cfg(target_os = "windows")]
    {
        plan(platform::discover(), id)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("launcher_platform_unsupported")
    }
}

#[cfg(test)]
#[path = "launcher_scan_tests.rs"]
mod tests;
