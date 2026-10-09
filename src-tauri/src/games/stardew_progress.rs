use super::stardew_manifest::Result;
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::{Duration, Instant},
};
type Tasks = HashMap<(String, String), Arc<AtomicBool>>;
fn tasks() -> &'static Mutex<Tasks> {
    static TASKS: OnceLock<Mutex<Tasks>> = OnceLock::new();
    TASKS.get_or_init(|| Mutex::new(HashMap::new()))
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub profile: String,
    pub operation_id: String,
    pub phase: &'static str,
    pub current: usize,
    pub total: usize,
}
pub struct Work<'a> {
    key: (String, String),
    canceled: Arc<AtomicBool>,
    began: Instant,
    emit: &'a dyn Fn(Progress),
}
impl<'a> Work<'a> {
    pub fn start(profile: &str, operation: &str, emit: &'a dyn Fn(Progress)) -> Result<Self> {
        if profile.is_empty()
            || profile.len() > 120
            || profile.chars().any(char::is_control)
            || uuid::Uuid::parse_str(operation).is_err()
        {
            return Err("stardew_request");
        }
        let mut tasks = tasks().lock().map_err(|_| "stardew_busy")?;
        let key = (profile.into(), operation.into());
        if tasks.len() >= 4 || tasks.contains_key(&key) {
            return Err("stardew_busy");
        }
        let canceled = Arc::new(AtomicBool::new(false));
        tasks.insert(key.clone(), canceled.clone());
        drop(tasks);
        let work = Self {
            key,
            canceled,
            began: Instant::now(),
            emit,
        };
        work.progress("scanning", 0, 0)?;
        Ok(work)
    }
    pub fn check(&self) -> Result<()> {
        if self.canceled.load(Ordering::Relaxed) {
            return Err("stardew_canceled");
        }
        if self.began.elapsed() > Duration::from_secs(90) {
            return Err("stardew_timeout");
        }
        Ok(())
    }
    pub fn progress(&self, phase: &'static str, current: usize, total: usize) -> Result<()> {
        self.check()?;
        (self.emit)(Progress {
            profile: self.key.0.clone(),
            operation_id: self.key.1.clone(),
            phase,
            current,
            total,
        });
        Ok(())
    }
    pub async fn wait<T>(&self, future: impl std::future::Future<Output = T>) -> Result<T> {
        tokio::pin!(future);
        loop {
            self.check()?;
            tokio::select! {v=&mut future=>{self.check()?;return Ok(v)},_=tokio::time::sleep(Duration::from_millis(100))=>{}}
        }
    }
}
impl Drop for Work<'_> {
    fn drop(&mut self) {
        if let Ok(mut tasks) = tasks().lock() {
            tasks.remove(&self.key);
        }
    }
}
pub fn cancel(profile: &str, operation: &str) -> bool {
    tasks()
        .lock()
        .ok()
        .and_then(|t| t.get(&(profile.into(), operation.into())).cloned())
        .is_some_and(|flag| {
            flag.store(true, Ordering::Relaxed);
            true
        })
}
