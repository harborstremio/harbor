//! Apply progress and cancellation stop before the durable publication boundary.
use super::{files, package, Result};
use serde::Serialize;
use std::{
    collections::HashMap,
    fs::{self, OpenOptions},
    io::Write,
    path::Path,
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, Instant},
};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub profile: String,
    pub operation_id: String,
    pub phase: &'static str,
    pub file: Option<String>,
    pub bytes: u64,
    pub total_bytes: u64,
    pub can_cancel: bool,
}
#[derive(Default)]
struct Gate {
    canceled: bool,
    publishing: bool,
}
type Key = (String, String);
type Jobs = HashMap<Key, Arc<Mutex<Gate>>>;
fn jobs() -> &'static Mutex<Jobs> {
    static JOBS: OnceLock<Mutex<Jobs>> = OnceLock::new();
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}
pub fn cancel(profile: &str, id: &str) -> bool {
    let Ok(jobs) = jobs().lock() else {
        return false;
    };
    let Some(gate) = jobs.get(&(profile.into(), id.into())) else {
        return false;
    };
    let Ok(mut gate) = gate.lock() else {
        return false;
    };
    if gate.publishing {
        return false;
    }
    gate.canceled = true;
    true
}
pub struct Work<'a> {
    gate: Arc<Mutex<Gate>>,
    registered: bool,
    emit: &'a dyn Fn(Progress),
    value: Progress,
    last_emit: Instant,
    last_bytes: u64,
}
impl Drop for Work<'_> {
    fn drop(&mut self) {
        if self.registered {
            if let Ok(mut jobs) = jobs().lock() {
                jobs.remove(&(self.value.profile.clone(), self.value.operation_id.clone()));
            }
        }
    }
}
impl<'a> Work<'a> {
    pub fn start(profile: &str, id: &str, emit: &'a dyn Fn(Progress)) -> Result<Self> {
        if profile.is_empty() || profile.len() > 200 || profile.chars().any(char::is_control) {
            return Err("sims_profile");
        }
        super::uuid(id)?;
        let gate = Arc::new(Mutex::new(Gate::default()));
        {
            let mut jobs = jobs().lock().map_err(|_| "sims_busy")?;
            let key = (profile.into(), id.into());
            if jobs.len() >= 4 || jobs.contains_key(&key) {
                return Err("sims_busy");
            }
            jobs.insert(key, gate.clone());
        }
        let mut work = Self::new(profile, id, gate, emit);
        work.registered = true;
        work.send();
        Ok(work)
    }
    fn new(profile: &str, id: &str, gate: Arc<Mutex<Gate>>, emit: &'a dyn Fn(Progress)) -> Self {
        Self {
            gate,
            registered: false,
            emit,
            value: Progress {
                profile: profile.into(),
                operation_id: id.into(),
                phase: "checking",
                file: None,
                bytes: 0,
                total_bytes: 0,
                can_cancel: true,
            },
            last_emit: Instant::now(),
            last_bytes: 0,
        }
    }
    #[cfg(test)]
    pub fn silent() -> Work<'static> {
        Work::new("", "", Arc::new(Mutex::new(Gate::default())), &|_| {})
    }
    pub fn check(&self) -> Result<()> {
        if self.gate.lock().map_err(|_| "sims_busy")?.canceled {
            Err("sims_canceled")
        } else {
            Ok(())
        }
    }
    pub fn cancellation_check(&self) -> impl Fn() -> Result<()> + 'static {
        let gate = self.gate.clone();
        move || {
            if gate.lock().map_err(|_| "sims_busy")?.canceled {
                Err("sims_canceled")
            } else {
                Ok(())
            }
        }
    }
    fn send(&mut self) {
        (self.emit)(self.value.clone());
        self.last_emit = Instant::now();
        self.last_bytes = self.value.bytes;
    }
    pub fn staging(&mut self, bytes: u64) -> Result<()> {
        self.check()?;
        self.value.phase = "copying";
        self.value.total_bytes = bytes;
        self.value.bytes = 0;
        self.send();
        self.check()
    }
    pub fn reviewing(&mut self) -> Result<()> {
        self.check()?;
        self.value.phase = "reviewing";
        self.value.bytes = 0;
        self.value.total_bytes = 0;
        self.value.file = None;
        self.send();
        self.check()
    }
    pub fn waiting(&mut self) -> Result<()> {
        self.check()?;
        self.value.phase = "waiting";
        self.value.file = None;
        self.value.bytes = 0;
        self.value.total_bytes = 0;
        self.send();
        self.check()
    }
    pub fn downloading(&mut self, name: &str, bytes: u64, total: u64) -> Result<()> {
        self.check()?;
        self.value.phase = "downloading";
        self.value.file = Some(name.into());
        self.value.bytes = bytes;
        self.value.total_bytes = total;
        if bytes == 0 || bytes == total || self.last_emit.elapsed() >= Duration::from_millis(100) {
            self.send();
        }
        self.check()
    }
    pub fn review_file(&mut self, name: &str) -> Result<()> {
        self.check()?;
        package::filename(name)?;
        self.value.file = Some(name.into());
        self.send();
        self.check()
    }
    pub fn write(&mut self, path: &Path, bytes: &[u8]) -> Result<()> {
        self.check()?;
        files::directory(path.parent().ok_or("sims_path")?)?;
        let name = path
            .file_name()
            .and_then(|v| v.to_str())
            .ok_or("sims_path")?;
        package::filename(name)?;
        self.value.file = Some(name.into());
        self.send();
        self.check()?;
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map_err(|_| "sims_write")?;
        let mut written = 0;
        let result = (|| {
            for chunk in bytes.chunks(1024 * 1024) {
                self.check()?;
                file.write_all(chunk).map_err(|_| "sims_write")?;
                written += chunk.len();
                #[cfg(test)]
                super::super::saves::interruption_checkpoint("simsPreparationChunk");
                self.value.bytes += chunk.len() as u64;
                if self.last_emit.elapsed() >= Duration::from_millis(100)
                    || self.value.bytes.saturating_sub(self.last_bytes) >= 8 * 1024 * 1024
                {
                    self.send();
                }
                self.check()?;
            }
            file.sync_all().map_err(|_| "sims_write")?;
            self.send();
            self.check()
        })();
        drop(file);
        // Remove only the exact unpublished bytes this call wrote.
        if result.is_err()
            && files::read(path, package::MAX_FILE).is_ok_and(|data| data == bytes[..written])
        {
            let _ = fs::remove_file(path);
        }
        result
    }
    pub fn publish(&mut self) -> Result<()> {
        {
            let mut gate = self.gate.lock().map_err(|_| "sims_busy")?;
            if gate.canceled {
                return Err("sims_canceled");
            }
            gate.publishing = true;
        }
        self.value.phase = "publishing";
        self.value.can_cancel = false;
        self.value.file = None;
        self.send();
        Ok(())
    }
    pub fn done(&mut self) {
        self.value.phase = "done";
        self.value.can_cancel = false;
        self.value.file = None;
        self.send();
    }
}
