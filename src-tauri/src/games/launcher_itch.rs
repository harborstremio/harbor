//! itch installations only. Reads a consistent SQLite transaction without starting
//! butler, migrating its database, or reading account credentials.
use super::{local_path, read_bounded, ubisoft::Artwork, Game, LaunchPlan, Launcher};
use rusqlite::{Connection, OpenFlags};
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Component, Path, PathBuf};
use std::time::Duration;

const MAX_ROWS: usize = 10_000;
const MAX_DATABASE: u64 = 512 * 1024 * 1024;
const SAFE_INTEGER: i64 = 9_007_199_254_740_991;

pub(super) fn client(directory: &Path) -> Option<PathBuf> {
    if !local_path(directory) {
        return None;
    }
    let state: serde_json::Value =
        serde_json::from_slice(&read_bounded(&directory.join("state.json"), 64 * 1024).ok()?)
            .ok()?;
    let version = state.get("current")?.as_str()?;
    // The selected version is a directory component, never an executable path.
    if version.len() > 64
        || !version
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b".-".contains(&b))
        || !version
            .split('.')
            .next()?
            .parse::<u32>()
            .is_ok_and(|n| n >= 25)
    {
        return None;
    }
    let executable = directory.join(format!("app-{version}")).join("itch.exe");
    (local_path(&executable) && executable.is_file()).then_some(executable)
}

fn cave_id(value: &str) -> bool {
    uuid::Uuid::parse_str(value).is_ok_and(|id| id.hyphenated().to_string() == value)
}

fn cover(value: &str) -> Option<String> {
    if value.len() > 8192 || value.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return None;
    }
    let url = url::Url::parse(value).ok()?;
    (url.scheme() == "https"
        && url.host_str() == Some("img.itch.zone")
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && url.query().is_none()
        && url.fragment().is_none()
        && url.path().len() > 1)
        .then(|| value.to_owned())
}

fn folder(custom: &str, root: &str, name: &str) -> Option<PathBuf> {
    let path = if !custom.is_empty() {
        PathBuf::from(custom)
    } else {
        // The client stores a single folder name, not an arbitrary relative path.
        let child = Path::new(name);
        if name.is_empty()
            || name.len() > 1024
            || name.contains(['/', '\\', ':'])
            || child.components().count() != 1
            || !matches!(child.components().next(), Some(Component::Normal(_)))
        {
            return None;
        }
        PathBuf::from(root).join(child)
    };
    local_path(&path).then_some(path)
}

struct Install {
    game: Game,
    upload: i64,
}
struct Records {
    installs: Vec<Install>,
    warnings: Vec<&'static str>,
}

fn database(path: &Path) -> Result<Connection, &'static str> {
    if !local_path(path) {
        return Err("itch_database_invalid");
    }
    let meta = path.metadata().map_err(|_| "itch_database_unreadable")?;
    if !meta.is_file() || meta.len() > MAX_DATABASE {
        return Err("itch_database_invalid");
    }
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|_| "itch_database_unreadable")?;
    conn.busy_timeout(Duration::from_millis(500))
        .map_err(|_| "itch_database_unreadable")?;
    conn.execute_batch("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;")
        .map_err(|_| "itch_database_unreadable")?;
    Ok(conn)
}

fn records(path: &Path) -> Result<Records, &'static str> {
    let mut conn = database(path)?;
    let tx = conn.transaction().map_err(|_| "itch_database_unreadable")?;
    for table in ["caves", "games", "install_locations"] {
        let sql: String = tx
            .query_row(
                "SELECT sql FROM sqlite_schema WHERE type='table' AND name=?1",
                [table],
                |row| row.get(0),
            )
            .map_err(|_| "itch_database_schema")?;
        if sql.to_ascii_uppercase().contains("VIRTUAL TABLE") {
            return Err("itch_database_schema");
        }
    }
    // Select only installation/public title fields. No profiles, API keys, or
    // download credentials are read. CASE bounds cells before Rust allocates them.
    let mut stmt = tx.prepare(
        "SELECT CASE WHEN length(c.id)<=64 THEN c.id END, c.game_id, c.upload_id,
         CASE WHEN length(g.title)<=2048 THEN g.title END,
         CASE WHEN length(g.classification)<=64 THEN g.classification END,
         CASE WHEN length(g.cover_url)<=8192 THEN g.cover_url END,
         CASE WHEN length(g.still_cover_url)<=8192 THEN g.still_cover_url END,
         CASE WHEN c.custom_install_folder IS NULL OR length(c.custom_install_folder)<=32000 THEN c.custom_install_folder ELSE char(0) END,
         CASE WHEN length(l.path)<=32000 THEN l.path END,
         CASE WHEN length(c.install_folder_name)<=1024 THEN c.install_folder_name END,
         c.installed_at IS NOT NULL AND length(c.installed_at)>0, c.morphing
         FROM caves c LEFT JOIN games g ON g.id=c.game_id
         LEFT JOIN install_locations l ON l.id=c.install_location_id
         ORDER BY c.id LIMIT ?1"
    ).map_err(|_| "itch_database_schema")?;
    let mut rows = stmt
        .query([MAX_ROWS as i64 + 1])
        .map_err(|_| "itch_database_unreadable")?;
    let mut out = Records {
        installs: Vec::new(),
        warnings: Vec::new(),
    };
    let mut seen = BTreeSet::new();
    let mut count = 0;
    while let Some(row) = rows.next().map_err(|_| "itch_database_unreadable")? {
        count += 1;
        if count > MAX_ROWS {
            out.warnings.push("itch_library_limit");
            break;
        }
        let parsed = (|| -> Result<Option<Install>, ()> {
            let classification: String = row.get(4).map_err(|_| ())?;
            if !matches!(classification.as_str(), "game" | "tool") {
                return Ok(None);
            }
            let id: String = row.get(0).map_err(|_| ())?;
            let game_id: i64 = row.get(1).map_err(|_| ())?;
            let upload: i64 = row.get(2).map_err(|_| ())?;
            let name: String = row.get(3).map_err(|_| ())?;
            if !cave_id(&id)
                || !(1..=SAFE_INTEGER).contains(&game_id)
                || !(1..=SAFE_INTEGER).contains(&upload)
                || name.trim().is_empty()
                || name.chars().any(char::is_control)
                || !seen.insert(id.clone())
            {
                return Err(());
            }
            let text = |index| {
                row.get::<_, Option<String>>(index)
                    .map(|v| v.unwrap_or_default())
                    .map_err(|_| ())
            };
            let path = folder(&text(7)?, &text(8)?, &text(9)?).ok_or(())?;
            let complete: bool = row.get(10).map_err(|_| ())?;
            let morphing: Option<bool> = row.get(11).map_err(|_| ())?;
            let capsule = cover(&text(6)?).or_else(|| cover(&text(5).ok()?));
            let product_id = format!("{game_id}:{id}");
            Ok(Some(Install {
                upload,
                game: Game {
                    id: format!("itch:{product_id}"),
                    launcher: Launcher::Itch,
                    product_id,
                    name,
                    install_path: path.to_string_lossy().into_owned(),
                    state: if !path.is_dir() {
                        "missing"
                    } else if !complete || morphing.unwrap_or(false) {
                        "incomplete"
                    } else {
                        "installed"
                    },
                    launch_mode: "play",
                    install_key: None,
                    catalog_steam_id: None,
                    artwork: capsule.map(|value| Artwork {
                        capsule: Some(value),
                        ..Artwork::default()
                    }),
                },
            }))
        })();
        match parsed {
            Ok(Some(install)) => out.installs.push(install),
            Ok(None) => {}
            Err(()) => out.warnings.push("itch_library_partial"),
        }
    }
    // An upload may have two caves. The URL can select an upload, not a cave;
    // leave that choice to the official client instead of launching another copy.
    let mut uploads = BTreeMap::new();
    for install in &out.installs {
        let key = (
            install
                .game
                .product_id
                .split(':')
                .next()
                .unwrap_or_default()
                .to_owned(),
            install.upload,
        );
        *uploads.entry(key).or_insert(0) += 1;
    }
    for install in &mut out.installs {
        let key = (
            install
                .game
                .product_id
                .split(':')
                .next()
                .unwrap_or_default()
                .to_owned(),
            install.upload,
        );
        if uploads.get(&key).is_some_and(|count| *count > 1) {
            install.game.launch_mode = "client";
        }
    }
    out.warnings.sort_unstable();
    out.warnings.dedup();
    Ok(out)
}

pub(super) fn scan(path: &Path) -> (Vec<Game>, Vec<&'static str>) {
    match records(path) {
        Ok(records) => (
            records.installs.into_iter().map(|item| item.game).collect(),
            records.warnings,
        ),
        Err(error) => (Vec::new(), vec![error]),
    }
}

pub(super) fn launch(path: &Path, client: &Path, id: &str) -> Result<LaunchPlan, &'static str> {
    let records = records(path)?;
    let install = records
        .installs
        .iter()
        .find(|item| item.game.id == id && item.game.state == "installed")
        .ok_or("launcher_game_missing")?;
    let game_id = install
        .game
        .product_id
        .split(':')
        .next()
        .ok_or("launcher_game_missing")?;
    let url = if install.game.launch_mode == "client" {
        "itch://library/installed".to_owned()
    } else {
        format!(
            "itch://install?game_id={game_id}&upload_id={}&launch",
            install.upload
        )
    };
    Ok(LaunchPlan::Process {
        executable: client.to_path_buf(),
        args: vec![url],
    })
}

#[cfg(test)]
#[path = "launcher_itch_tests.rs"]
mod tests;
