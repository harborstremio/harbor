//! Durable process identities for reconnecting to an installer, never relaunching it.
use super::*;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Identity {
    pub pid: u32,
    pub created: u64,
    pub image: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct State {
    pub processes: Vec<Identity>,
    pub root_exit_code: Option<u32>,
    pub destination_identity: Option<(u64, u64)>,
    pub checker_seen: bool,
    pub verification: Option<SetupVerification>,
}

#[cfg(windows)]
impl ManagedDestination {
    fn restore(path: &str, identity: (u64, u64)) -> Result<Self> {
        use std::os::windows::fs::OpenOptionsExt;
        let path = plain_path(Path::new(path)).map_err(|_| "setup_destination")?;
        if path.parent().is_none() {
            return Err("setup_destination");
        }
        let file = OpenOptions::new()
            .read(true)
            .share_mode(1 | 2)
            .custom_flags(0x02000000)
            .open(&path)
            .map_err(|_| "setup_destination")?;
        let value = Self {
            path,
            file,
            identity,
            cleanup_empty: false,
        };
        value.validate()?;
        Ok(value)
    }
}

#[cfg(windows)]
impl Setups {
    pub(super) fn record_recovery(&self, id: &str, snapshot: State) -> Result<()> {
        let mut jobs = self.jobs.lock().map_err(|_| "setup_store")?;
        let index = jobs
            .iter()
            .position(|job| job.id == id)
            .ok_or("setup_store")?;
        if jobs[index].status != SetupStatus::Running
            || jobs[index].recovery.as_ref() == Some(&snapshot)
        {
            return Ok(());
        }
        let mut next = jobs.clone();
        next[index].recovery = Some(snapshot);
        // Sync only identity/checker transitions, never every progress tick.
        self.persist(&next)?;
        *jobs = next;
        Ok(())
    }

    pub(super) fn reconnect(self: &Arc<Self>, id: &str) -> Result<bool> {
        let job = self
            .jobs
            .lock()
            .map_err(|_| "setup_store")?
            .iter()
            .find(|job| job.id == id && job.status == SetupStatus::Interrupted)
            .cloned()
            .ok_or("setup_store")?;
        let Some(saved) = job.recovery.as_ref() else {
            return Ok(false);
        };
        let managed = match (job.destination.as_deref(), saved.destination_identity) {
            (Some(path), Some(identity)) => match ManagedDestination::restore(path, identity) {
                Ok(destination) => Some(destination),
                Err(_) => return Ok(false),
            },
            (None, None) => None,
            _ => return Ok(false),
        };
        let destination = managed
            .as_ref()
            .map(|value| value.path.as_path())
            .unwrap_or_else(|| {
                Path::new(&job.installer)
                    .parent()
                    .unwrap_or(Path::new(&job.source))
            });
        let Some(monitor) =
            progress::Monitor::restore(saved, Path::new(&job.installer), destination)
        else {
            return Ok(false);
        };
        let monitor = Arc::new(Mutex::new(monitor));
        let event = {
            let mut jobs = self.jobs.lock().map_err(|_| "setup_store")?;
            let index = jobs
                .iter()
                .position(|value| value.id == id)
                .ok_or("setup_store")?;
            if jobs[index].status != SetupStatus::Interrupted
                || jobs[index].updated_at != job.updated_at
            {
                return Ok(false);
            }
            let mut next = jobs.clone();
            let current = &mut next[index];
            current.status = SetupStatus::Running;
            current.exit_code = None;
            current.error = None;
            current.updated_at = now().max(current.updated_at.saturating_add(1));
            current.reconnected_at = Some(current.updated_at);
            current.progress = Some(SetupProgress {
                stage: if saved.checker_seen {
                    SetupStage::Checking
                } else {
                    SetupStage::Installing
                },
                verification: saved.verification.clone(),
                observed_at: now(),
                ..Default::default()
            });
            let event = current.clone();
            self.persist(&next)?;
            *jobs = next;
            event
        };
        self.monitors
            .lock()
            .map_err(|_| "setup_store")?
            .insert(id.to_owned(), monitor.clone());
        (self.emit)(event);
        let value = self.clone();
        let owned_id = id.to_owned();
        if std::thread::Builder::new()
            .name("harbor-setup-reconnect".into())
            .spawn(move || {
                let mut last_activity = Instant::now() - FILE_ACTIVITY_INTERVAL;
                loop {
                    let observed = monitor.lock().map(|mut monitor| {
                        let sample = monitor.sample(now());
                        let running = monitor.any_running();
                        let snapshot =
                            monitor.checkpoint(managed.as_ref().map(|value| value.identity));
                        let verification = monitor.verification_result();
                        (sample, running, snapshot, verification)
                    });
                    let Ok((sample, running, snapshot, verification)) = observed else {
                        let _ = value.finish(
                            &owned_id,
                            SetupStatus::Interrupted,
                            None,
                            Some("setup_read"),
                        );
                        break;
                    };
                    let code = snapshot.root_exit_code;
                    let _ = value.record_progress(&owned_id, sample);
                    let _ = value.record_recovery(&owned_id, snapshot);
                    let mut scan_error = None;
                    if let Some(destination) = managed.as_ref() {
                        if !running || last_activity.elapsed() >= FILE_ACTIVITY_INTERVAL {
                            match destination
                                .validate()
                                .and_then(|_| destination_activity(&destination.path))
                            {
                                Ok(activity) => {
                                    let _ = value.record_activity(&owned_id, activity);
                                }
                                Err(error) => scan_error = Some(error),
                            }
                            last_activity = Instant::now();
                        }
                        if !running
                            && scan_error.is_none()
                            && !code.is_some_and(|code| code != 0)
                            && verification != Some("setup_verification")
                        {
                            match installed_candidates(&job.profile, &destination.path) {
                                Ok((paths, truncated)) => {
                                    let (root_paths, complete) = match installed_candidates_in(
                                        &job.profile,
                                        &destination.path,
                                        false,
                                    ) {
                                        Ok((paths, truncated)) => (paths, !truncated),
                                        Err(_) => (Vec::new(), false),
                                    };
                                    let _ = value.record_candidates(
                                        &owned_id, paths, truncated, root_paths, complete,
                                    );
                                }
                                Err(error) => scan_error = Some(error),
                            }
                        }
                    }
                    if !running {
                        let failed = code.is_some_and(|code| code != 0)
                            || verification == Some("setup_verification");
                        // A checker could have run while Harbor was absent. Offer the
                        // recovered files for review; never invent uninterrupted success.
                        let error =
                            scan_error.or(verification.filter(|error| *error != "setup_read"));
                        let _ = value.finish(
                            &owned_id,
                            if failed {
                                SetupStatus::Failed
                            } else {
                                SetupStatus::External
                            },
                            code,
                            if failed {
                                error
                            } else {
                                error.or(Some("setup_review"))
                            },
                        );
                        break;
                    }
                    std::thread::sleep(ACTIVITY_INTERVAL);
                }
            })
            .is_err()
        {
            self.finish(id, SetupStatus::Interrupted, None, Some("setup_read"))?;
            return Ok(false);
        }
        Ok(true)
    }
}

#[cfg(all(test, windows))]
#[path = "setup_resume_tests.rs"]
mod tests;
