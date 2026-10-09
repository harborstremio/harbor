use super::{Result, Session};
use rusqlite::{params, Connection, OptionalExtension};
use std::{path::Path, time::Duration};

fn open(root: &Path) -> Result<Connection> {
    std::fs::create_dir_all(root).map_err(|_| "launcher_session_store")?;
    let connection = Connection::open(root.join("launcher-sessions.sqlite"))
        .map_err(|_| "launcher_session_store")?;
    connection
        .busy_timeout(Duration::from_secs(2))
        .map_err(|_| "launcher_session_store")?;
    connection.execute_batch("CREATE TABLE IF NOT EXISTS launcher_sessions (session_id TEXT PRIMARY KEY, profile TEXT NOT NULL, game_id TEXT NOT NULL, state TEXT NOT NULL, elapsed INTEGER NOT NULL, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS launcher_activity (profile TEXT NOT NULL, game_id TEXT NOT NULL, elapsed INTEGER NOT NULL, last_played INTEGER NOT NULL, PRIMARY KEY(profile,game_id));").map_err(|_|"launcher_session_store")?;
    Ok(connection)
}

pub(super) fn save(root: &Path, session: &Session) -> Result<()> {
    let mut db = open(root)?;
    let tx = db.transaction().map_err(|_| "launcher_session_store")?;
    let previous: u64 = tx
        .query_row(
            "SELECT elapsed FROM launcher_sessions WHERE session_id=?",
            [&session.session_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|_| "launcher_session_store")?
        .unwrap_or(0);
    let delta = session.elapsed_ms.saturating_sub(previous);
    if session.started_at > 0 {
        tx.execute("INSERT INTO launcher_activity(profile,game_id,elapsed,last_played) VALUES(?,?,?,?) ON CONFLICT(profile,game_id) DO UPDATE SET elapsed=elapsed+excluded.elapsed,last_played=MAX(last_played,excluded.last_played)",params![session.profile,session.id,delta,session.started_at]).map_err(|_|"launcher_session_store")?;
    }
    let value = serde_json::to_string(session).map_err(|_| "launcher_session_store")?;
    tx.execute("INSERT INTO launcher_sessions(session_id,profile,game_id,state,elapsed,value) VALUES(?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET state=excluded.state,elapsed=excluded.elapsed,value=excluded.value",params![session.session_id,session.profile,session.id,session.state,session.elapsed_ms,value]).map_err(|_|"launcher_session_store")?;
    // Completed history is bounded; lifetime totals live independently of it.
    tx.execute("DELETE FROM launcher_sessions WHERE session_id IN (SELECT session_id FROM launcher_sessions WHERE state NOT IN ('waiting','running','unconfirmed') ORDER BY rowid DESC LIMIT -1 OFFSET 2048)",[]).map_err(|_|"launcher_session_store")?;
    tx.commit().map_err(|_| "launcher_session_store")
}

pub(super) fn active(root: &Path) -> Result<Vec<Session>> {
    let db = open(root)?;
    let mut query = db.prepare("SELECT value FROM launcher_sessions WHERE state IN ('waiting','running','unconfirmed') LIMIT 17").map_err(|_|"launcher_session_store")?;
    let rows = query
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|_| "launcher_session_store")?;
    let mut values = Vec::new();
    for row in rows {
        let value: Session = serde_json::from_str(&row.map_err(|_| "launcher_session_store")?)
            .map_err(|_| "launcher_session_store")?;
        if !value.valid() {
            return Err("launcher_session_store");
        }
        values.push(value);
    }
    if values.len() > 16 {
        return Err("launcher_session_store");
    }
    Ok(values)
}

pub(super) fn activity(root: &Path, profile: &str) -> Result<Vec<super::Activity>> {
    let db = open(root)?;
    let mut query=db.prepare("SELECT game_id,elapsed,last_played FROM launcher_activity WHERE profile=? ORDER BY game_id LIMIT 10000").map_err(|_|"launcher_session_store")?;
    let values = query
        .query_map([profile], |row| {
            Ok(super::Activity {
                id: row.get(0)?,
                seconds: row.get::<_, u64>(1)? / 1000,
                last_played: row.get(2)?,
            })
        })
        .map_err(|_| "launcher_session_store")?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|_| "launcher_session_store");
    values
}

pub(super) fn latest(root: &Path, profile: &str) -> Result<Vec<Session>> {
    let db = open(root)?;
    let mut query = db
        .prepare("SELECT value FROM launcher_sessions WHERE profile=? ORDER BY rowid DESC LIMIT 64")
        .map_err(|_| "launcher_session_store")?;
    let rows = query
        .query_map([profile], |row| row.get::<_, String>(0))
        .map_err(|_| "launcher_session_store")?;
    rows.map(|row| {
        serde_json::from_str(&row.map_err(|_| "launcher_session_store")?)
            .map_err(|_| "launcher_session_store")
    })
    .collect()
}
