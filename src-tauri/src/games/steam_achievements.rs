use super::achievement_protocol::{
    self as protocol, Applied, Change, Request, Response, Result, Snapshot,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    io::{Read, Write},
    process::{Command, Stdio},
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

const ARG: &str = "--harbor-steam-achievements-v1";
const PREFIX: &str = "HARBOR_STEAM_ACHIEVEMENTS_V1:";
const OUTPUT_LIMIT: u64 = 16 * 1024 * 1024;
const INPUT_LIMIT: u64 = 4 * 1024 * 1024;
const PLAN_LIFETIME: Duration = Duration::from_secs(300);
struct Plan {
    profile: String,
    snapshot: Snapshot,
    created: Instant,
}
fn plans() -> &'static Mutex<HashMap<String, Plan>> {
    static PLANS: OnceLock<Mutex<HashMap<String, Plan>>> = OnceLock::new();
    PLANS.get_or_init(|| Mutex::new(HashMap::new()))
}
fn gate() -> &'static Mutex<()> {
    static GATE: Mutex<()> = Mutex::new(());
    &GATE
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub token: String,
    pub snapshot: Snapshot,
    pub expires_in: u32,
}
fn valid_profile(profile: &str) -> bool {
    !profile.trim().is_empty() && profile.len() <= 256 && !profile.chars().any(char::is_control)
}

pub fn read(profile: String, app_id: u32) -> Result<Review> {
    if !valid_profile(&profile) || app_id == 0 {
        return Err("achievement_invalid_game");
    }
    let _gate = gate().try_lock().map_err(|_| "achievement_busy")?;
    let Response::Snapshot(snapshot) = supervise(Request::Read { app_id })? else {
        return Err("achievement_client_data");
    };
    if snapshot.app_id != app_id {
        return Err("achievement_invalid_game");
    }
    let token = uuid::Uuid::new_v4().to_string();
    let mut store = plans().lock().map_err(|_| "achievement_busy")?;
    store.retain(|_, p| p.created.elapsed() < PLAN_LIFETIME && p.profile != profile);
    if store.len() >= 16 {
        return Err("achievement_busy");
    }
    store.insert(
        token.clone(),
        Plan {
            profile,
            snapshot: snapshot.clone(),
            created: Instant::now(),
        },
    );
    Ok(Review {
        token,
        snapshot,
        expires_in: PLAN_LIFETIME.as_secs() as u32,
    })
}
pub fn discard(profile: String, token: String) {
    if let Ok(mut store) = plans().lock() {
        if store.get(&token).is_some_and(|p| p.profile == profile) {
            store.remove(&token);
        }
    }
}
pub fn apply(profile: String, token: String, choices: Vec<Change>) -> Result<Applied> {
    if !valid_profile(&profile) {
        return Err("achievement_plan_expired");
    }
    let _gate = gate().try_lock().map_err(|_| "achievement_busy")?;
    let plan = {
        let mut store = plans().lock().map_err(|_| "achievement_busy")?;
        if !store
            .get(&token)
            .is_some_and(|p| p.profile == profile && p.created.elapsed() < PLAN_LIFETIME)
        {
            return Err("achievement_plan_expired");
        }
        store.remove(&token).ok_or("achievement_plan_expired")?
    };
    let changes = protocol::plan(&plan.snapshot, choices)?;
    match supervise(Request::Apply {
        app_id: plan.snapshot.app_id,
        steam_id: plan.snapshot.steam_id,
        changes,
    })? {
        Response::Applied(result) => Ok(result),
        _ => Err("achievement_client_data"),
    }
}

/// The installed Steam client can crash or stall independently of Harbor's UI process.
fn supervise(request: Request) -> Result<Response> {
    if !cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        return Err("achievement_unsupported_platform");
    }
    let writing = matches!(request, Request::Apply { .. });
    let uncertain = if writing {
        "achievement_apply_uncertain"
    } else {
        "achievement_client_failed"
    };
    let input = serde_json::to_vec(&request).map_err(|_| "achievement_invalid_changes")?;
    let exe = std::env::current_exe().map_err(|_| "achievement_client_failed")?;
    let mut command = Command::new(exe);
    command
        .arg(ARG)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let mut child = command.spawn().map_err(|_| "achievement_client_failed")?;
    let stdout = child.stdout.take().ok_or("achievement_client_failed")?;
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        stdout
            .take(OUTPUT_LIMIT + 1)
            .read_to_end(&mut bytes)
            .map(|_| bytes)
    });
    let send = child
        .stdin
        .take()
        .ok_or("achievement_client_failed")
        .and_then(|mut pipe| {
            pipe.write_all(&input)
                .map_err(|_| "achievement_client_failed")
        });
    if send.is_err() {
        let _ = child.kill();
        let _ = child.wait();
        let _ = reader.join();
        return Err(uncertain);
    }
    let until = Instant::now() + Duration::from_secs(40);
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) if Instant::now() < until => std::thread::sleep(Duration::from_millis(30)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
        }
    };
    let bytes = reader
        .join()
        .map_err(|_| uncertain)?
        .map_err(|_| uncertain)?;
    if !status.is_some_and(|s| s.success()) || bytes.len() as u64 > OUTPUT_LIMIT {
        return Err(uncertain);
    }
    // Valve may emit diagnostic stdout. Only our framed JSON line is a protocol response.
    let output = std::str::from_utf8(&bytes).map_err(|_| uncertain)?;
    let payload = output
        .lines()
        .rev()
        .find_map(|line| line.strip_prefix(PREFIX))
        .ok_or(uncertain)?;
    let response: Response = serde_json::from_str(payload).map_err(|_| uncertain)?;
    if let Response::Error(ref code) = response {
        return Err(error_code(code));
    }
    Ok(response)
}
fn error_code(code: &str) -> &'static str {
    match code {
        "achievement_no_client" => "achievement_no_client",
        "achievement_client_load" => "achievement_client_load",
        "achievement_client_version" => "achievement_client_version",
        "achievement_client_offline" => "achievement_client_offline",
        "achievement_invalid_game" => "achievement_invalid_game",
        "achievement_account_changed" => "achievement_account_changed",
        "achievement_not_owned" => "achievement_not_owned",
        "achievement_stats_timeout" => "achievement_stats_timeout",
        "achievement_stats_unavailable" => "achievement_stats_unavailable",
        "achievement_client_rejected" => "achievement_client_rejected",
        "achievement_apply_uncertain" => "achievement_apply_uncertain",
        "achievement_unsupported_platform" => "achievement_unsupported_platform",
        "achievement_invalid_changes" => "achievement_invalid_changes",
        "achievement_unknown" => "achievement_unknown",
        "achievement_protected" => "achievement_protected",
        "achievement_unchanged" => "achievement_unchanged",
        "achievement_state_changed" => "achievement_state_changed",
        _ => "achievement_client_data",
    }
}
fn read_request(input: impl Read) -> Option<Request> {
    let mut bytes = Vec::new();
    input.take(INPUT_LIMIT + 1).read_to_end(&mut bytes).ok()?;
    if bytes.len() as u64 > INPUT_LIMIT {
        return None;
    }
    serde_json::from_slice(&bytes).ok()
}
pub fn try_run_worker() -> bool {
    let mut args = std::env::args().skip(1);
    if args.next().as_deref() != Some(ARG) {
        return false;
    }
    let response = if args.next().is_some() {
        Response::Error("achievement_invalid_changes".into())
    } else {
        match read_request(std::io::stdin()) {
            Some(request) => execute(request).unwrap_or_else(|e| Response::Error(e.into())),
            None => Response::Error("achievement_invalid_changes".into()),
        }
    };
    if let Ok(json) = serde_json::to_string(&response) {
        let mut out = std::io::stdout().lock();
        let _ = writeln!(out, "{PREFIX}{json}");
        let _ = out.flush();
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn worker_accepts_full_bulk_plan_but_bounds_input_before_deserialization() {
        let request = Request::Apply {
            app_id: 440,
            steam_id: "fixture-account".into(),
            changes: (0..protocol::MAX_CHANGES)
                .map(|index| protocol::ExpectedChange {
                    // Exercise worst-case JSON escaping with the client's 256-byte ID bound.
                    id: format!("{index:06}{}", "\u{1}".repeat(250)),
                    before: false,
                    after: true,
                })
                .collect(),
        };
        let bytes = serde_json::to_vec(&request).unwrap();
        assert!(bytes.len() > 128 * 1024);
        assert!(
            matches!(read_request(bytes.as_slice()), Some(Request::Apply { changes, .. }) if changes.len() == protocol::MAX_CHANGES)
        );
        let mut bounded = b"{\"operation\":\"read\",\"appId\":440}".to_vec();
        bounded.resize(INPUT_LIMIT as usize, b' ');
        assert!(matches!(
            read_request(bounded.as_slice()),
            Some(Request::Read { app_id: 440 })
        ));
        bounded.push(b' ');
        assert!(read_request(bounded.as_slice()).is_none());
        assert!(read_request(b"invalid".as_slice()).is_none());
    }
}
fn execute(request: Request) -> Result<Response> {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        use protocol::Client;
        let app_id = match &request {
            Request::Read { app_id } | Request::Apply { app_id, .. } => *app_id,
        };
        let root = super::steam_paths::find_root().ok_or("achievement_no_client")?;
        let mut client = super::steam_achievement_client::SteamClient::connect(&root, app_id)?;
        match request {
            Request::Read { .. } => client.snapshot().map(Response::Snapshot),
            Request::Apply {
                app_id,
                steam_id,
                changes,
            } => protocol::apply(&mut client, app_id, &steam_id, &changes).map(Response::Applied),
        }
    }
    #[cfg(not(all(target_os = "windows", target_arch = "x86_64")))]
    {
        let _ = request;
        Err("achievement_unsupported_platform")
    }
}
