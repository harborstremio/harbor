use super::*;
use std::os::windows::process::CommandExt;

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let parent = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        fs::create_dir_all(&parent).unwrap();
        let path = parent.join(format!("setup-resume-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        Self(dunce::canonicalize(path).unwrap())
    }
    fn installer(&self) -> PathBuf {
        let dir = self.0.join("download");
        fs::create_dir(&dir).unwrap();
        let installer = dir.join("setup.exe");
        fs::copy(
            std::env::var_os("HARBOR_SETUP_RESUME_EXE").expect("locally compiled fixture"),
            &installer,
        )
        .unwrap();
        let mut trailer = [0u8; 64];
        let marker = b"Inno Setup Setup Data (5.5.0) (u)\0";
        trailer[..marker.len()].copy_from_slice(marker);
        OpenOptions::new()
            .append(true)
            .open(&installer)
            .unwrap()
            .write_all(&trailer)
            .unwrap();
        installer
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let parent = dunce::canonicalize(
            std::env::var_os("HARBOR_GAME_TEST_ROOT")
                .map(PathBuf::from)
                .unwrap_or_else(std::env::temp_dir),
        )
        .unwrap();
        let path = dunce::canonicalize(&self.0).unwrap();
        assert_eq!(path.parent(), Some(parent.as_path()));
        assert!(path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("setup-resume-"));
        let _ = fs::write(path.join("download/release-root"), b"cleanup");
        let _ = fs::write(path.join("download/release-child"), b"cleanup");
        for _ in 0..20 {
            if fs::remove_dir_all(&path).is_ok() {
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    }
}

fn wait(mut ready: impl FnMut() -> bool) {
    let deadline = Instant::now() + Duration::from_secs(20);
    while !ready() {
        assert!(Instant::now() < deadline, "fixture timed out");
        std::thread::sleep(Duration::from_millis(30));
    }
}

fn crash_worker(fixture: &Fixture, bootstrap: bool) -> SetupJob {
    let installer = fixture.installer();
    if bootstrap {
        fs::write(installer.parent().unwrap().join("bootstrap.flag"), b"child").unwrap();
    }
    let mut worker = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "setup::resume::tests::snapshot_worker",
            "--ignored",
            "--nocapture",
        ])
        .env("HARBOR_SETUP_RESUME_WORKER_ROOT", &fixture.0)
        .env(
            "HARBOR_SETUP_RESUME_BOOTSTRAP",
            if bootstrap { "1" } else { "0" },
        )
        .creation_flags(0x08000000)
        .spawn()
        .unwrap();
    wait(|| worker.try_wait().unwrap().is_some());
    assert!(worker.wait().unwrap().success());
    let saved: Store =
        serde_json::from_slice(&fs::read(fixture.0.join("state/jobs.json")).unwrap()).unwrap();
    assert_eq!(saved.jobs.len(), 1);
    saved.jobs.into_iter().next().unwrap()
}

#[test]
#[ignore = "child of the forced-exit fixture; never run without an isolated root"]
fn snapshot_worker() {
    let root = PathBuf::from(std::env::var_os("HARBOR_SETUP_RESUME_WORKER_ROOT").unwrap());
    let bootstrap = std::env::var("HARBOR_SETUP_RESUME_BOOTSTRAP").unwrap() == "1";
    let manager = Setups::load(root.join("state"), |_| {}).unwrap();
    let installer = root.join("download/setup.exe");
    let plan = manager
        .inspect("one", &installer.to_string_lossy())
        .unwrap();
    let job = manager
        .start(
            "one",
            &plan.token,
            &plan.entries[0].id,
            Some(&root.join("Installed Game").to_string_lossy()),
        )
        .unwrap();
    wait(|| {
        manager.list("one").unwrap()[0]
            .recovery
            .as_ref()
            .is_some_and(|state| !bootstrap || state.processes.len() >= 2)
    });
    if bootstrap {
        fs::write(root.join("download/release-root"), b"exit").unwrap();
        wait(|| {
            manager.list("one").unwrap()[0]
                .recovery
                .as_ref()
                .is_some_and(|state| state.root_exit_code == Some(0))
        });
    }
    assert_eq!(manager.list("one").unwrap()[0].status, SetupStatus::Running);
    fs::write(root.join("worker-ready"), job.id).unwrap();
    // No Rust destructors run: the external installer/child must survive the
    // manager's process, and only the already-synced checkpoint is available.
    std::process::exit(0);
}

#[test]
#[ignore = "requires the locally compiled hidden setup-resume process fixture"]
fn forced_process_exit_reconnects_root_and_surviving_bootstrap_child_without_claiming_success() {
    for bootstrap in [false, true] {
        let fixture = Fixture::new();
        let saved = crash_worker(&fixture, bootstrap);
        assert_eq!(saved.status, SetupStatus::Running);
        assert_eq!(
            saved.recovery.as_ref().unwrap().processes.len(),
            if bootstrap { 2 } else { 1 }
        );
        let manager = Setups::load(fixture.0.join("state"), |_| {}).unwrap();
        assert!(manager.list("other").unwrap().is_empty());
        assert_eq!(manager.list("one").unwrap()[0].status, SetupStatus::Running);
        assert_eq!(manager.monitors.lock().unwrap().len(), 1);
        fs::write(
            fixture.0.join(if bootstrap {
                "download/release-child"
            } else {
                "download/release-root"
            }),
            b"exit",
        )
        .unwrap();
        wait(|| manager.list("one").unwrap()[0].status != SetupStatus::Running);
        let result = manager.list("one").unwrap().remove(0);
        assert_eq!(result.id, saved.id);
        assert_eq!(result.destination, saved.destination);
        assert_eq!(result.status, SetupStatus::External);
        assert_eq!(result.exit_code, Some(0));
        assert_eq!(result.error.as_deref(), Some("setup_review"));
        assert!(result
            .reconnected_at
            .is_some_and(|time| time > saved.updated_at));
        assert_eq!(result.game_candidates.len(), 1);
        assert!(result.game_candidates[0].ends_with("Game.exe"));
        assert!(result.recovery.is_none());
        assert!(manager.monitors.lock().unwrap().is_empty());
        let reloaded = Setups::load(fixture.0.join("state"), |_| {}).unwrap();
        assert_eq!(
            reloaded.list("one").unwrap()[0].status,
            SetupStatus::External
        );
        assert!(reloaded.monitors.lock().unwrap().is_empty());
    }
}

#[test]
#[ignore = "requires the locally compiled hidden setup-resume process fixture"]
fn changed_creation_time_image_or_destination_never_reconnects_a_saved_job() {
    for fault in ["time", "image", "destination"] {
        let fixture = Fixture::new();
        let saved = crash_worker(&fixture, false);
        let store_path = fixture.0.join("state/jobs.json");
        let mut store: Store = serde_json::from_slice(&fs::read(&store_path).unwrap()).unwrap();
        let state = store.jobs[0].recovery.as_mut().unwrap();
        match fault {
            "time" => state.processes[0].created += 1,
            "image" => state.processes[0].image.push_str(".different.exe"),
            _ => state.destination_identity.as_mut().unwrap().1 ^= 1,
        }
        fs::write(&store_path, serde_json::to_vec(&store).unwrap()).unwrap();
        let manager = Setups::load(fixture.0.join("state"), |_| {}).unwrap();
        let job = manager.list("one").unwrap().remove(0);
        assert_eq!(job.id, saved.id);
        assert_eq!(job.status, SetupStatus::Interrupted);
        assert!(manager.monitors.lock().unwrap().is_empty());
        fs::write(fixture.0.join("download/release-root"), b"exit").unwrap();
        wait(|| fixture.0.join("download/root-done").exists());
    }
}

#[test]
fn checkpoints_do_not_resync_identical_state_and_failed_writes_do_not_replace_it() {
    let fixture = Fixture::new();
    let path = fixture.0.join("setup.exe");
    fs::write(&path, b"fixture only; not executable").unwrap();
    let manager = Setups::load(fixture.0.join("state"), |_| {}).unwrap();
    let plan = manager.inspect("one", &path.to_string_lossy()).unwrap();
    let (job, held) = manager
        .reserve("one", &plan.token, &plan.entries[0].id)
        .unwrap();
    drop(held);
    let state = State {
        processes: vec![Identity {
            pid: 1,
            created: 1,
            image: path.to_string_lossy().into_owned(),
        }],
        root_exit_code: None,
        destination_identity: None,
        checker_seen: false,
        verification: None,
    };
    manager.record_recovery(&job.id, state.clone()).unwrap();
    let store = fixture.0.join("state/jobs.json");
    let stamp = fs::metadata(&store).unwrap().modified().unwrap();
    std::thread::sleep(Duration::from_millis(25));
    manager.record_recovery(&job.id, state.clone()).unwrap();
    assert_eq!(fs::metadata(&store).unwrap().modified().unwrap(), stamp);
    fs::rename(&store, fixture.0.join("state/saved.json")).unwrap();
    fs::create_dir(&store).unwrap();
    let mut changed = state.clone();
    changed.checker_seen = true;
    assert!(manager.record_recovery(&job.id, changed).is_err());
    assert_eq!(
        manager.list("one").unwrap()[0].recovery.as_ref(),
        Some(&state)
    );
}

#[test]
#[ignore = "requires the locally compiled hidden setup-resume process fixture"]
fn interrupted_reconnect_checkpoint_is_retried_on_the_next_load() {
    let fixture = Fixture::new();
    crash_worker(&fixture, false);
    let path = fixture.0.join("state/jobs.json");
    let mut store: Store = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
    // This is the persisted boundary before load reconnects any handles. A
    // second app exit here must not strand the surviving exact process.
    store.jobs[0].status = SetupStatus::Interrupted;
    let live_id = store.jobs[0].id.clone();
    let mut jobs = Vec::new();
    for _ in 0..MAX_RUNNING {
        let mut stale = store.jobs[0].clone();
        stale.id = uuid::Uuid::new_v4().to_string();
        stale.recovery.as_mut().unwrap().processes[0].created += 1;
        jobs.push(stale);
    }
    jobs.extend(store.jobs);
    store.jobs = jobs;
    fs::write(&path, serde_json::to_vec(&store).unwrap()).unwrap();
    let manager = Setups::load(fixture.0.join("state"), |_| {}).unwrap();
    let records = manager.list("one").unwrap();
    assert_eq!(records.iter().filter(|job| job.status == SetupStatus::Running).count(), 1);
    assert_eq!(records.iter().find(|job| job.id == live_id).unwrap().status, SetupStatus::Running);
    assert_eq!(manager.monitors.lock().unwrap().len(), 1);
    fs::write(fixture.0.join("download/release-root"), b"exit").unwrap();
    wait(|| manager.list("one").unwrap().iter().all(|job| job.status != SetupStatus::Running));
    assert_eq!(manager.list("one").unwrap().iter().find(|job| job.id == live_id).unwrap().error.as_deref(), Some("setup_review"));
}

#[test]
#[ignore = "requires the locally compiled hidden setup-resume process fixture"]
fn reconnected_checker_failures_survive_process_exit_and_another_reload() {
    for (bad_files, missing_files) in [(1, 0), (0, 1)] {
        let fixture = Fixture::new();
        crash_worker(&fixture, false);
        let path = fixture.0.join("state/jobs.json");
        let mut store: Store = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        let state = store.jobs[0].recovery.as_mut().unwrap();
        state.checker_seen = true;
        state.verification = Some(SetupVerification {
            checked_files: 10,
            total_files: 10,
            bad_files,
            missing_files,
        });
        fs::write(&path, serde_json::to_vec(&store).unwrap()).unwrap();
        let manager = Setups::load(fixture.0.join("state"), |_| {}).unwrap();
        assert_eq!(manager.list("one").unwrap()[0].status, SetupStatus::Running);
        fs::write(fixture.0.join("download/release-root"), b"exit").unwrap();
        wait(|| manager.list("one").unwrap()[0].status != SetupStatus::Running);
        let final_job = manager.list("one").unwrap().remove(0);
        assert_eq!(final_job.status, SetupStatus::Failed);
        assert_eq!(final_job.error.as_deref(), Some("setup_verification"));
        assert!(final_job.game_candidates.is_empty());
        assert!(manager.monitors.lock().unwrap().is_empty());
        let reloaded = Setups::load(fixture.0.join("state"), |_| {}).unwrap();
        let stored_job = reloaded.list("one").unwrap().remove(0);
        assert_eq!(stored_job.status, SetupStatus::Failed);
        assert_eq!(stored_job.error, final_job.error);
        assert!(stored_job.recovery.is_none());
    }
}

#[test]
fn restored_handles_require_exact_identity_and_keep_checker_failure_evidence() {
    let fixture = Fixture::new();
    let executable = std::env::current_exe().unwrap();
    let handle = unsafe { windows::Win32::System::Threading::GetCurrentProcess() };
    let mut monitor = progress::Monitor::new(handle.0 as usize, &executable, &fixture.0).unwrap();
    let saved = monitor.checkpoint(None);
    let restored = progress::Monitor::restore(&saved, &executable, &fixture.0).unwrap();
    assert_eq!(restored.verification_result(), Some("setup_read"));
    let mut altered = saved.clone();
    altered.processes[0].created += 1;
    assert!(progress::Monitor::restore(&altered, &executable, &fixture.0).is_none());
    let mut altered = saved.clone();
    altered.processes[0].image.push_str(".other.exe");
    assert!(progress::Monitor::restore(&altered, &executable, &fixture.0).is_none());
    let mut altered = saved.clone();
    altered.processes.push(saved.processes[0].clone());
    assert!(progress::Monitor::restore(&altered, &executable, &fixture.0).is_none());
    let mut altered = saved.clone();
    altered.processes[0].pid = u32::MAX;
    assert!(progress::Monitor::restore(&altered, &executable, &fixture.0).is_none());
    let mut checker = saved;
    checker.checker_seen = true;
    checker.verification = Some(SetupVerification {
        checked_files: 10,
        total_files: 10,
        bad_files: 1,
        missing_files: 0,
    });
    let mut restored = progress::Monitor::restore(&checker, &executable, &fixture.0).unwrap();
    assert_eq!(restored.verification_result(), Some("setup_verification"));
    assert_eq!(restored.checkpoint(None).verification, checker.verification);
}
