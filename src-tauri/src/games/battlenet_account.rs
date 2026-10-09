//! Account-library data only. Credentials and classic CD keys stay in Battle.net's webview.
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    path::Path,
    sync::{Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};

pub type Result<T> = std::result::Result<T, &'static str>;
pub const LIMIT: usize = 4096;
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OwnedGame {
    pub id: String,
    pub product_id: String,
    pub name: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Partition {
    pub games: Vec<OwnedGame>,
    pub updated_at: u64,
    pub unresolved: usize,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Snapshot {
    pub identity: String,
    pub modern: Partition,
    pub classic: Partition,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Status {
    pub connection: Option<String>,
    pub import_installed: bool,
    pub import_uninstalled: bool,
    pub snapshot: Option<Snapshot>,
    pub warnings: Vec<String>,
}
impl Default for Status {
    fn default() -> Self {
        Self {
            connection: None,
            import_installed: true,
            import_uninstalled: false,
            snapshot: None,
            warnings: vec![],
        }
    }
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Modern {
    title_id: u64,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Classic {
    name: String,
    icon: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Report {
    pub authenticated: bool,
    pub identity: Option<String>,
    pub modern: Option<Vec<Modern>>,
    pub classic: Option<Vec<Classic>>,
}

pub fn profile_valid(profile: &str) -> bool {
    !profile.is_empty() && profile.len() <= 160 && !profile.chars().any(char::is_control)
}
pub fn uuid_valid(id: &str) -> bool {
    uuid::Uuid::parse_str(id).is_ok_and(|value| value.to_string() == id)
}
fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn clean(value: &str) -> bool {
    value.len() <= 512 && !value.chars().any(char::is_control)
}
fn identity_valid(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

// Exact title IDs in the reviewed Playnite Battle.net 2.24 source. Shared account
// title 1096108883 identifies both MWII and MWIII: it cannot prove either edition.
fn modern_game(id: u64) -> Option<OwnedGame> {
    let (product, name) = match id {
        5730135 => ("wow", "World of Warcraft"),
        17459 => ("diablo3", "Diablo III"),
        21298 => ("s2", "StarCraft II"),
        21297 => ("s1", "StarCraft: Remastered"),
        1465140039 => ("hs_beta", "Hearthstone"),
        1214607983 => ("heroes", "Heroes of the Storm"),
        5272175 => ("prometheus", "Overwatch 2"),
        1447645266 => ("viper", "Call of Duty: Black Ops 4"),
        1329875278 => ("odin", "Call of Duty: Modern Warfare"),
        22323 => ("w3", "Warcraft III: Reforged"),
        1279351378 => (
            "lazarus",
            "Call of Duty: Modern Warfare 2 Campaign Remastered",
        ),
        1514493267 => ("zeus", "Call of Duty: Black Ops Cold War"),
        1464615513 => ("wlby", "Crash Bandicoot 4"),
        5198665 => ("osi", "Diablo II: Resurrected"),
        1381257807 => ("rtro", "Blizzard Arcade Collection"),
        1179603525 => ("fore", "Call of Duty: Vanguard"),
        1095647827 => ("anbs", "Diablo Immortal"),
        4613486 => ("fen", "Diablo IV"),
        1146246220 => ("d1", "Diablo"),
        5714258 => ("w1r", "Warcraft: Remastered"),
        5714514 => ("w2r", "Warcraft II: Remastered"),
        1463898673 => ("w1", "Warcraft: Orcs & Humans"),
        1462911566 => ("w2", "Warcraft II: Battle.net Edition"),
        4674137 => ("gryphon", "Warcraft Rumble"),
        1095911763 => ("aris", "DOOM: The Dark Ages"),
        1396920146 => ("scorpio", "Sea of Thieves"),
        4280907 => ("arkansas", "The Outer Worlds 2"),
        1279414849 => ("libra", "Tony Hawk's Pro Skater 3 + 4"),
        1095849281 => ("aqua", "Avowed"),
        _ => return None,
    };
    Some(OwnedGame {
        id: format!("battlenet:{product}"),
        product_id: product.into(),
        name: name.into(),
    })
}
fn classic_game(item: &Classic) -> Option<OwnedGame> {
    let name = item.name.to_lowercase().replace(['®', '™'], "");
    let icon = item.icon.to_ascii_lowercase();
    let (product, name) = if icon.contains("diablo-ii") && !icon.contains("resurrect") {
        if name.contains("lord of destruction")
            || icon.contains("d2xp")
            || icon.contains("lord-of-destruction")
        {
            ("classic:d2x", "Diablo II: Lord of Destruction")
        } else if name.trim() == "diablo ii" {
            ("classic:d2", "Diablo II")
        } else {
            return None;
        }
    } else if icon.contains("warcraft-iii") && !icon.contains("reforged") {
        if name.contains("frozen throne") || icon.contains("w3xp") || icon.contains("frozen-throne")
        {
            ("classic:w3x", "Warcraft III: The Frozen Throne")
        } else if matches!(name.trim(), "warcraft iii" | "warcraft iii: reign of chaos") {
            ("classic:w3", "Warcraft III: Reign of Chaos")
        } else {
            return None;
        }
    } else {
        return None;
    };
    Some(OwnedGame {
        id: format!("battlenet:{product}"),
        product_id: product.into(),
        name: name.into(),
    })
}
pub fn parse(raw: &str) -> Result<Report> {
    if raw.len() > 512 * 1024 {
        return Err("battlenet_account_data");
    }
    let report: Report = serde_json::from_str(raw).map_err(|_| "battlenet_account_data")?;
    if report.authenticated && !report.identity.as_deref().is_some_and(identity_valid)
        || report
            .modern
            .as_ref()
            .is_some_and(|rows| rows.len() > LIMIT)
        || report.classic.as_ref().is_some_and(|rows| {
            rows.len() > LIMIT
                || rows
                    .iter()
                    .any(|item| !clean(&item.name) || !clean(&item.icon))
        })
    {
        return Err("battlenet_account_data");
    }
    Ok(report)
}
fn partition<T>(items: Vec<T>, map: impl Fn(&T) -> Option<OwnedGame>, now: u64) -> Partition {
    let mut games = BTreeMap::new();
    let mut unresolved = 0;
    for item in &items {
        if let Some(game) = map(item) {
            games.insert(game.id.clone(), game);
        } else {
            unresolved += 1;
        }
    }
    Partition {
        games: games.into_values().collect(),
        updated_at: now,
        unresolved,
    }
}
pub fn merge(previous: &Status, connection: &str, report: Report, now: u64) -> Result<Status> {
    if !report.authenticated {
        return Err("battlenet_account_expired");
    }
    let identity = report.identity.ok_or("battlenet_account_data")?;
    let same = previous.connection.as_deref() == Some(connection);
    if same
        && previous
            .snapshot
            .as_ref()
            .is_some_and(|old| old.identity != identity)
    {
        return Err("battlenet_account_changed");
    }
    // A changed account must finish both endpoints before replacing the previous library.
    if !same && (report.modern.is_none() || report.classic.is_none()) {
        return Err("battlenet_account_refresh");
    }
    if report.modern.is_none() && report.classic.is_none() {
        return Err("battlenet_account_refresh");
    }
    let old = previous.snapshot.as_ref();
    let mut warnings = Vec::new();
    let modern = match report.modern {
        Some(rows) => partition(rows, |row| modern_game(row.title_id), now),
        None => {
            warnings.push("modern".into());
            old.ok_or("battlenet_account_refresh")?.modern.clone()
        }
    };
    let classic = match report.classic {
        Some(rows) => partition(rows, classic_game, now),
        None => {
            warnings.push("classic".into());
            old.ok_or("battlenet_account_refresh")?.classic.clone()
        }
    };
    if modern.unresolved + classic.unresolved > 0 {
        warnings.push("unresolved".into());
    }
    Ok(Status {
        connection: Some(connection.into()),
        snapshot: Some(Snapshot {
            identity,
            modern,
            classic,
        }),
        warnings,
        ..previous.clone()
    })
}

fn database(root: &Path) -> Result<Connection> {
    std::fs::create_dir_all(root).map_err(|_| "battlenet_account_store")?;
    let file = root.join("battlenet.sqlite");
    if std::fs::symlink_metadata(&file)
        .is_ok_and(|meta| !meta.is_file() || meta.file_type().is_symlink())
    {
        return Err("battlenet_account_store");
    }
    let db = Connection::open(file).map_err(|_| "battlenet_account_store")?;
    db.busy_timeout(std::time::Duration::from_secs(3))
        .map_err(|_| "battlenet_account_store")?;
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS accounts(profile TEXT PRIMARY KEY, state TEXT NOT NULL)",
    )
    .map_err(|_| "battlenet_account_store")?;
    Ok(db)
}
fn read(root: &Path, profile: &str) -> Result<Status> {
    if !profile_valid(profile) {
        return Err("battlenet_account_profile");
    }
    let json: Option<String> = database(root)?
        .query_row(
            "SELECT state FROM accounts WHERE profile=?1",
            [profile],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| "battlenet_account_store")?;
    let Some(json) = json else {
        return Ok(Status::default());
    };
    if json.len() > 512 * 1024 {
        return Err("battlenet_account_store");
    }
    let state: Status = serde_json::from_str(&json).map_err(|_| "battlenet_account_store")?;
    if state
        .connection
        .as_deref()
        .is_some_and(|id| !uuid_valid(id))
        || state.connection.is_some() != state.snapshot.is_some()
        || state.snapshot.as_ref().is_some_and(|s| {
            !identity_valid(&s.identity)
                || [&s.modern, &s.classic].iter().any(|p| {
                    p.games.len() > LIMIT
                        || p.games.iter().any(|g| {
                            !g.id.starts_with("battlenet:")
                                || g.id != format!("battlenet:{}", g.product_id)
                                || !clean(&g.name)
                        })
                })
        })
    {
        return Err("battlenet_account_store");
    }
    Ok(state)
}
fn write(root: &Path, profile: &str, value: &Status) -> Result<()> {
    let bytes = serde_json::to_string(value).map_err(|_| "battlenet_account_store")?;
    database(root)?.execute("INSERT INTO accounts(profile,state) VALUES(?1,?2) ON CONFLICT(profile) DO UPDATE SET state=excluded.state", params![profile, bytes]).map_err(|_| "battlenet_account_store")?;
    Ok(())
}
#[derive(Clone)]
pub struct Ticket {
    pub profile: String,
    pub request: String,
    pub connection: String,
    pub fresh: bool,
}
#[derive(Default)]
struct Operations {
    active: BTreeMap<String, String>,
    canceled: BTreeMap<String, u64>,
}
fn operations() -> &'static Mutex<Operations> {
    static VALUE: OnceLock<Mutex<Operations>> = OnceLock::new();
    VALUE.get_or_init(Mutex::default)
}
fn key(root: &Path, profile: &str) -> String {
    format!("{}\0{profile}", root.display())
}
pub fn status(root: &Path, profile: &str) -> Result<Status> {
    let _guard = operations().lock().map_err(|_| "battlenet_account_store")?;
    read(root, profile)
}
pub fn active(root: &Path, ticket: &Ticket) -> bool {
    operations()
        .lock()
        .ok()
        .is_some_and(|all| all.active.get(&key(root, &ticket.profile)) == Some(&ticket.request))
}
pub fn begin(root: &Path, profile: &str, request: &str, fresh: bool) -> Result<Ticket> {
    if !profile_valid(profile) || !uuid_valid(request) {
        return Err("battlenet_account_profile");
    }
    let mut operations = operations().lock().map_err(|_| "battlenet_account_store")?;
    operations
        .canceled
        .retain(|_, at| timestamp().saturating_sub(*at) < 900);
    if operations.canceled.contains_key(request) {
        return Err("battlenet_account_canceled");
    }
    if operations.active.contains_key(&key(root, profile)) || operations.active.len() >= 4 {
        return Err("battlenet_account_busy");
    }
    let previous = read(root, profile)?;
    let connection = if fresh {
        uuid::Uuid::new_v4().to_string()
    } else {
        previous.connection.ok_or("battlenet_account_expired")?
    };
    operations.active.insert(key(root, profile), request.into());
    Ok(Ticket {
        profile: profile.into(),
        request: request.into(),
        connection,
        fresh,
    })
}
pub fn finish(root: &Path, ticket: &Ticket, report: Report) -> Result<Status> {
    let mut operations = operations().lock().map_err(|_| "battlenet_account_store")?;
    let key = key(root, &ticket.profile);
    if operations.active.get(&key) != Some(&ticket.request) {
        return Err("battlenet_account_canceled");
    }
    let result = (|| {
        let previous = read(root, &ticket.profile)?;
        let next = merge(&previous, &ticket.connection, report, timestamp())?;
        write(root, &ticket.profile, &next)?;
        Ok(next)
    })();
    operations.active.remove(&key);
    result
}
pub fn cancel(root: &Path, profile: &str, request: &str) {
    if !profile_valid(profile) || !uuid_valid(request) {
        return;
    }
    if let Ok(mut operations) = operations().lock() {
        if operations
            .active
            .get(&key(root, profile))
            .is_some_and(|id| id == request)
        {
            operations.active.remove(&key(root, profile));
        }
        operations
            .canceled
            .retain(|_, at| timestamp().saturating_sub(*at) < 900);
        if operations.canceled.len() < 1024 {
            operations.canceled.insert(request.into(), timestamp());
        }
    }
}
pub fn preferences(
    root: &Path,
    profile: &str,
    installed: bool,
    uninstalled: bool,
) -> Result<Status> {
    let _guard = operations().lock().map_err(|_| "battlenet_account_store")?;
    let mut status = read(root, profile)?;
    status.import_installed = installed;
    status.import_uninstalled = uninstalled;
    write(root, profile, &status)?;
    Ok(status)
}
pub fn disconnect(root: &Path, profile: &str) -> Result<Option<String>> {
    let mut operations = operations().lock().map_err(|_| "battlenet_account_store")?;
    let old = read(root, profile)?;
    write(
        root,
        profile,
        &Status {
            import_installed: old.import_installed,
            import_uninstalled: old.import_uninstalled,
            ..Status::default()
        },
    )?;
    operations.active.remove(&key(root, profile));
    Ok(old.connection)
}

#[cfg(test)]
#[path = "battlenet_account_tests.rs"]
mod tests;
