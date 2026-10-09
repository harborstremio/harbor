//! Bounded, profile/request-scoped ownership of source HTTP futures.
use std::{collections::HashMap, future::Future, sync::Mutex, time::{Duration, Instant}};
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;

pub(super) const DEADLINE: Duration = Duration::from_secs(20);
const HISTORY: Duration = Duration::from_secs(30);
const MAX_PENDING: usize = 32;
const MAX_HISTORY: usize = 256;
type Result<T> = std::result::Result<T, String>;
type Key = (Option<String>, uuid::Uuid);

fn key(profile: Option<&str>, session: &str) -> Result<Key> {
    if profile.is_some_and(|value| value.is_empty() || value.len() > 256 || value.chars().any(char::is_control)) {
        return Err("source_url".into());
    }
    Ok((profile.map(str::to_owned), uuid::Uuid::parse_str(session).map_err(|_| "source_url")?))
}

#[derive(Default)]
struct State {
    active: HashMap<Key, CancellationToken>,
    closed: HashMap<Key, Instant>,
    saturated_until: Option<Instant>,
}

impl State {
    fn prune(&mut self, now: Instant) {
        self.closed.retain(|_, until| *until > now);
        if self.saturated_until.is_some_and(|until| until <= now) { self.saturated_until = None; }
    }
    fn remember(&mut self, key: Key, now: Instant) {
        if self.closed.contains_key(&key) { return; }
        if self.closed.len() >= MAX_HISTORY {
            // Do not forget a pre-dispatch cancel and accidentally admit that request.
            // Saturation temporarily refuses new starts instead of growing memory.
            self.saturated_until = Some(now + HISTORY);
        } else { self.closed.insert(key, now + HISTORY); }
    }
    fn reserve(&mut self, key: &Key, now: Instant) -> Result<CancellationToken> {
        self.prune(now);
        if self.closed.contains_key(key) { return Err("source_canceled".into()); }
        if self.saturated_until.is_some() || self.active.len() >= MAX_PENDING || self.active.contains_key(key) {
            return Err("source_network".into());
        }
        let token = CancellationToken::new();
        self.active.insert(key.clone(), token.clone());
        Ok(token)
    }
}

pub(super) struct Requests { state: Mutex<State>, slot: Semaphore }
impl Default for Requests {
    fn default() -> Self { Self { state: Mutex::default(), slot: Semaphore::new(1) } }
}
struct Lease<'a> { owner: &'a Requests, key: Key }
impl Drop for Lease<'_> {
    fn drop(&mut self) {
        if let Ok(mut state) = self.owner.state.lock() {
            state.active.remove(&self.key);
            // Completed reads must not fill the pre-dispatch cancellation history:
            // a fast refresh of hundreds of catalogs is ordinary successful work.
            state.prune(Instant::now());
        }
    }
}

impl Requests {
    pub(super) fn cancel(&self, profile: Option<&str>, session: &str) {
        let Ok(key) = key(profile, session) else { return; };
        if let Ok(mut state) = self.state.lock() {
            let now = Instant::now(); state.prune(now);
            if let Some(token) = state.active.get(&key) { token.cancel(); }
            state.remember(key, now);
        }
    }
    pub(super) async fn run<T>(&self, profile: Option<&str>, session: &str, deadline: Duration,
        work: impl Future<Output = Result<T>>) -> Result<T> {
        let key = key(profile, session)?;
        let canceled = self.state.lock().map_err(|_| "source_network")?.reserve(&key, Instant::now())?;
        let _lease = Lease { owner: self, key };
        tokio::select! {
            biased;
            _ = canceled.cancelled() => Err("source_canceled".into()),
            result = tokio::time::timeout(deadline, async {
                let _permit = self.slot.acquire().await.map_err(|_| "source_network")?;
                work.await
            }) => result.unwrap_or_else(|_| Err("source_network".into())),
        }
    }
}

#[cfg(test)]
#[path = "source_http_requests_tests.rs"]
mod tests;
