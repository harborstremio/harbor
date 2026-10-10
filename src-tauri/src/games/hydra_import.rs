//! Read-only launcher migration review. Import decisions stay separate from inspection.
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tokio_util::sync::CancellationToken;
#[path = "hydra_import_cleanup.rs"]
mod cleanup;
#[path = "hydra_import_model.rs"]
mod model;
#[path = "hydra_import_reader.rs"]
mod reader;
#[path = "hydra_import_snapshot.rs"]
mod snapshot;
#[path = "hydra_import_worker.rs"]
mod worker;
// The archive limiter's zero-write wrapper is unused in this module.
#[allow(dead_code)]
#[path = "archive_decoder_limits.rs"]
mod limits;
type Result<T> = std::result::Result<T, &'static str>;
const WAIT: Duration = Duration::from_secs(30);
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub profile: String,
    pub session: String,
    pub directory: String,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Review {
    pub directory: String,
    pub fingerprint: String,
    pub source_bytes: u64,
    pub report: model::Report,
}
#[derive(Default)]
struct State {
    active: Option<(String, String, CancellationToken)>,
    canceled: Vec<(String, String, Instant)>,
}
impl State {
    fn reserve(&mut self, profile: &str, session: &str, now: Instant) -> Result<CancellationToken> {
        self.canceled.retain(|(_, _, until)| *until > now);
        if self
            .canceled
            .iter()
            .any(|(p, s, _)| p == profile && s == session)
        {
            return Err("hydra_canceled");
        }
        if self.active.is_some() {
            return Err("hydra_busy");
        }
        let token = CancellationToken::new();
        self.active = Some((profile.into(), session.into(), token.clone()));
        Ok(token)
    }
    fn cancel(&mut self, profile: &str, session: &str, now: Instant) {
        self.canceled.retain(|(_, _, until)| *until > now);
        if self.canceled.len() >= 32 {
            self.canceled.remove(0);
        }
        self.canceled
            .push((profile.into(), session.into(), now + WAIT));
        if let Some((p, s, token)) = &self.active {
            if p == profile && s == session {
                token.cancel();
            }
        }
    }
}
fn state() -> &'static Mutex<State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE.get_or_init(Mutex::default)
}
fn owner(profile: &str, session: &str) -> bool {
    !profile.is_empty()
        && profile.len() <= 200
        && !profile.chars().any(char::is_control)
        && uuid::Uuid::parse_str(session).is_ok()
}
struct Lease(String, String);
impl Drop for Lease {
    fn drop(&mut self) {
        if let Ok(mut state) = state().lock() {
            if state
                .active
                .as_ref()
                .is_some_and(|(p, s, _)| *p == self.0 && *s == self.1)
            {
                state.active = None;
            }
        }
    }
}
struct CancelOnDrop(CancellationToken);
impl Drop for CancelOnDrop {
    fn drop(&mut self) {
        self.0.cancel();
    }
}
fn check(cancel: &CancellationToken, deadline: Instant) -> Result<()> {
    if cancel.is_cancelled() {
        Err("hydra_canceled")
    } else if Instant::now() >= deadline {
        Err("hydra_timeout")
    } else {
        Ok(())
    }
}
fn review_sync(
    directory: &Path,
    scratch: &Path,
    cancel: &CancellationToken,
    deadline: Instant,
) -> Result<Review> {
    let snapshot = snapshot::prepare(directory, scratch, cancel, deadline)?;
    let report = worker::inspect(&snapshot.path, cancel, deadline)?;
    check(cancel, deadline)?;
    Ok(Review {
        directory: snapshot.original.clone(),
        fingerprint: snapshot.fingerprint.clone(),
        source_bytes: snapshot.bytes,
        report,
    })
}
pub async fn review(scratch: PathBuf, args: Request) -> Result<Review> {
    if !owner(&args.profile, &args.session) {
        return Err("hydra_request");
    }
    let token = state().lock().map_err(|_| "hydra_busy")?.reserve(
        &args.profile,
        &args.session,
        Instant::now(),
    )?;
    let lease = Lease(args.profile, args.session);
    let _cancel = CancelOnDrop(token.clone());
    let deadline = Instant::now() + WAIT;
    tauri::async_runtime::spawn_blocking(move || {
        let _lease = lease;
        review_sync(Path::new(&args.directory), &scratch, &token, deadline)
    })
    .await
    .map_err(|_| "hydra_decoder")?
}
pub fn cancel(profile: &str, session: &str) {
    if owner(profile, session) {
        if let Ok(mut state) = state().lock() {
            state.cancel(profile, session, Instant::now());
        }
    }
}
pub fn try_run_worker() -> bool {
    if std::env::args_os()
        .nth(1)
        .is_some_and(|arg| arg == worker::ARG)
    {
        std::process::exit(worker::main());
    }
    false
}
#[cfg(test)]
#[path = "hydra_import_tests.rs"]
mod tests;
