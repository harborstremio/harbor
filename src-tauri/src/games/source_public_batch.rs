//! Prepare an explicit selection with one catalog read, bounded probes and no queue mutation.
use super::{PublicDownload, PublicFile, PublicFiles};
use futures_util::{stream, FutureExt, StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    future::Future,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tokio_util::sync::CancellationToken;

const LIMIT: usize = 200;
const WAIT: Duration = Duration::from_secs(120);
#[derive(Deserialize)]
pub struct Request {
    pub profile: String,
    pub session: String,
    pub url: String,
    pub files: Vec<String>,
}
#[derive(Debug, Serialize)]
pub struct Error {
    pub code: &'static str,
    pub file: Option<String>,
}
impl From<&'static str> for Error {
    fn from(code: &'static str) -> Self {
        Self { code, file: None }
    }
}
pub type BatchResult = std::result::Result<Vec<PublicDownload>, Error>;
#[derive(Default)]
struct State {
    active: HashMap<(String, String), CancellationToken>,
    canceled: Vec<(String, String, Instant)>,
}
impl State {
    fn reserve(
        &mut self,
        profile: &str,
        session: &str,
        now: Instant,
    ) -> super::Result<CancellationToken> {
        self.canceled.retain(|(_, _, until)| *until > now);
        let key = (profile.into(), session.into());
        if self
            .canceled
            .iter()
            .any(|(p, s, _)| p == profile && s == session)
        {
            return Err("public_batch_canceled");
        }
        if self.active.len() >= 2 || self.active.contains_key(&key) {
            return Err("public_batch_busy");
        }
        let token = CancellationToken::new();
        self.active.insert(key, token.clone());
        Ok(token)
    }
    fn cancel(&mut self, profile: &str, session: &str, now: Instant) {
        self.canceled.retain(|(_, _, until)| *until > now);
        if self.canceled.len() >= 32 {
            self.canceled.remove(0);
        }
        self.canceled
            .push((profile.into(), session.into(), now + WAIT));
        if let Some(token) = self.active.get(&(profile.into(), session.into())) {
            token.cancel();
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
            state.active.remove(&(self.0.clone(), self.1.clone()));
        }
    }
}
pub fn cancel(profile: &str, session: &str) {
    if owner(profile, session) {
        if let Ok(mut state) = state().lock() {
            state.cancel(profile, session, Instant::now());
        }
    }
}
fn validate(files: &[String]) -> super::Result<()> {
    if files.is_empty() || files.len() > LIMIT {
        return Err("public_batch_limit");
    }
    let mut ids = HashSet::new();
    if files.iter().any(|id| {
        id.is_empty() || id.len() > 2048 || id.chars().any(char::is_control) || !ids.insert(id)
    }) {
        return Err("public_metadata");
    }
    Ok(())
}
pub(super) fn members(
    list: PublicFiles,
    ids: &[String],
) -> std::result::Result<Vec<PublicFile>, Error> {
    validate(ids)?;
    let mut files: HashMap<_, _> = list
        .files
        .into_iter()
        .map(|file| (file.id.clone(), file))
        .collect();
    let mut names = HashSet::new();
    ids.iter()
        .map(|id| {
            let file = files.remove(id).ok_or("public_missing")?;
            let code = match file.state.as_str() {
                "available" | "unknown" => None,
                "restricted" => Some("public_restricted"),
                "limited" => Some("public_rate_limit"),
                "missing" => Some("public_missing"),
                _ => Some("public_review"),
            };
            if let Some(code) = code {
                return Err(Error {
                    code,
                    file: Some(file.name),
                });
            }
            // Nested archive items can share a basename. Never silently rename a volume.
            if !names.insert(file.name.rsplit('/').next().unwrap_or("").to_lowercase()) {
                return Err(Error {
                    code: "transfer_batch_names",
                    file: Some(file.name),
                });
            }
            Ok(file)
        })
        .collect()
}
pub(super) async fn collect<'a, F, Fut>(files: &'a [PublicFile], prepare: F) -> BatchResult
where
    F: Fn(&'a PublicFile) -> Fut + Sync,
    Fut: Future<Output = super::Result<PublicDownload>> + Send,
{
    let prepare = &prepare;
    let checks: Vec<_> = files
        .iter()
        .enumerate()
        .map(|(index, file)| {
            async move {
                prepare(file)
                    .await
                    .map(|download| (index, download))
                    .map_err(|code| Error {
                        code,
                        file: Some(file.name.clone()),
                    })
            }
            .boxed()
        })
        .collect();
    let mut downloads: Vec<(usize, PublicDownload)> = stream::iter(checks)
        .buffer_unordered(3)
        .try_collect()
        .await?;
    downloads.sort_by_key(|(index, _)| *index);
    let mut names = HashSet::new();
    for (_, file) in &downloads {
        if !names.insert(file.name.to_lowercase()) {
            return Err(Error {
                code: "transfer_batch_names",
                file: Some(file.name.clone()),
            });
        }
    }
    Ok(downloads.into_iter().map(|(_, file)| file).collect())
}
async fn resolve(request: &Request) -> BatchResult {
    match reqwest::Url::parse(&request.url)
        .ok()
        .and_then(|url| url.host_str().map(String::from))
        .as_deref()
    {
        Some("archive.org" | "www.archive.org") => super::archive::prepare_batch(request).await,
        Some("mediafire.com" | "www.mediafire.com") => {
            if request.files.len() != 1 {
                return Err("public_url".into());
            }
            Ok(vec![
                super::mediafire::prepare(super::Request {
                    url: request.url.clone(),
                    file: request.files[0].clone(),
                })
                .await?,
            ])
        }
        _ => {
            let api = super::Api::new()?;
            let target = super::target(&request.url)?;
            prepare_pixeldrain(&api, &target, &request.files).await
        }
    }
}
async fn prepare_pixeldrain(
    api: &super::Api,
    target: &super::Target,
    ids: &[String],
) -> BatchResult {
    let files = members(api.review(target).await?, ids)?;
    collect(&files, |file| api.prepare_member(&file.id)).await
}
pub async fn prepare(request: Request) -> BatchResult {
    if !owner(&request.profile, &request.session) {
        return Err("public_url".into());
    }
    validate(&request.files)?;
    run(&request.profile, &request.session, resolve(&request)).await
}
async fn run(
    profile: &str,
    session: &str,
    future: impl Future<Output = BatchResult>,
) -> BatchResult {
    let token =
        state()
            .lock()
            .map_err(|_| "public_network")?
            .reserve(profile, session, Instant::now())?;
    let _lease = Lease(profile.into(), session.into());
    tokio::select! {
        biased;
        _ = token.cancelled() => Err("public_batch_canceled".into()),
        result = tokio::time::timeout(WAIT, future) => result.map_err(|_| Error::from("public_network"))?,
    }
}

#[cfg(test)]
#[path = "source_public_batch_tests.rs"]
mod tests;
