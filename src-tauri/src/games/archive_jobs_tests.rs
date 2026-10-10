use super::*;
use flate2::read::GzDecoder;
use sha2::{Digest, Sha256};
use std::{
    io::Read,
    path::Path,
    process::{Child, Command, Stdio},
};

const PROFILE: &str = "disc-recovery";
const PAYLOAD_BYTES: u64 = 2 * 1024 * 1024;

struct Fixture {
    root: PathBuf,
    parent: PathBuf,
}
impl Fixture {
    fn new() -> Self {
        let parent = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        fs::create_dir_all(&parent).unwrap();
        let parent = parent.canonicalize().unwrap();
        let root = parent.join(format!("disc-recovery-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        Self { root, parent }
    }
    fn image(&self, bytes: &[u8]) -> PathBuf {
        let source = self.root.join("Original 雨.iso");
        std::io::copy(
            &mut GzDecoder::new(bytes),
            &mut File::create(&source).unwrap(),
        )
        .unwrap();
        source
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        // Never let fixture cleanup escape the actual test root or follow a link.
        if self.root.parent() == Some(self.parent.as_path())
            && self.root.canonicalize().ok().as_ref() == Some(&self.root)
            && self
                .root
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("disc-recovery-")
        {
            let _ = fs::remove_dir_all(&self.root);
        }
    }
}
struct OwnedChild(Child);
impl Drop for OwnedChild {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
fn hash(path: &Path) -> String {
    let mut file = File::open(path).unwrap();
    let mut sha = Sha256::new();
    let mut buffer = [0; 256 * 1024];
    loop {
        let count = file.read(&mut buffer).unwrap();
        if count == 0 {
            break;
        }
        sha.update(&buffer[..count]);
    }
    format!("{:x}", sha.finalize())
}
fn review(source: &Path) -> archives::ArchivePlan {
    archives::inspect(
        PROFILE.into(),
        source.to_string_lossy().into(),
        uuid::Uuid::new_v4().to_string(),
        None,
        |_| {},
    )
    .unwrap()
}
fn game() -> DownloadGame {
    DownloadGame {
        id: "fixture:disc-recovery".into(),
        name: "Original disc fixture".into(),
        artwork: None,
        logo: None,
        source_name: Some("Original test data".into()),
        content_kind: Some("game".into()),
    }
}

fn record_and_hold(marker: &Path, job: &ArchiveJob) {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(marker)
        .unwrap();
    file.write_all(&serde_json::to_vec(job).unwrap()).unwrap();
    file.sync_all().unwrap();
    // The parent always kills/waits its owned child, including failed assertions.
    loop {
        std::thread::park_timeout(Duration::from_secs(1));
    }
}

fn copying_checkpoint(stage: &Path) {
    let root = PathBuf::from(std::env::var_os("HARBOR_DISC_RECOVERY_ROOT").unwrap());
    assert_eq!(stage.parent(), Some(root.as_path()));
    let store: Store =
        serde_json::from_slice(&fs::read(root.join("state/jobs.json")).unwrap()).unwrap();
    let job = &store.jobs[0];
    assert_eq!(job.status, Status::Running);
    assert_eq!(job.stage.as_deref().map(Path::new), Some(stage));
    let size = fs::metadata(stage.join("Payload 雨.bin")).unwrap().len();
    assert!(size > 0 && size < PAYLOAD_BYTES);
    record_and_hold(&root.join("checkpoint.json"), job);
}

// A real subprocess is externally terminated by the parent. No unwind or test
// replacement for the archive worker, job store, publisher or recovery is used.
#[test]
#[ignore]
fn disc_recovery_child() {
    let root =
        PathBuf::from(std::env::var_os("HARBOR_DISC_RECOVERY_ROOT").expect("parent fixture root"));
    let checkpoint = std::env::var("HARBOR_DISC_RECOVERY_POINT").unwrap();
    if checkpoint == "copying" {
        archives::FIRST_WRITE_CHECKPOINT
            .set(copying_checkpoint)
            .unwrap();
    }
    let marker = root.join("checkpoint.json");
    let manager = Archives::load(root.join("state"), move |job| {
        let progress = job.progress.as_ref();
        let stop = match checkpoint.as_str() {
            "staging" => job
                .stage
                .as_ref()
                .is_some_and(|path| !Path::new(path).exists()),
            "copying" => false, // The actual write boundary handles this case.
            "publishing" => progress.is_some_and(|p| p.phase == "publishing"),
            "published" => {
                job.status == Status::Running && progress.is_some_and(|p| p.phase == "complete")
            }
            _ => panic!("Unknown checkpoint"),
        };
        if stop {
            record_and_hold(&marker, &job);
        }
    })
    .unwrap();
    let source = root.join("Original 雨.iso");
    let plan = review(&source);
    manager
        .start(
            PROFILE.into(),
            plan.token,
            root.to_string_lossy().into(),
            "Installed".into(),
            Some(source.to_string_lossy().into()),
            Some(game()),
        )
        .unwrap();
    loop {
        std::thread::park_timeout(Duration::from_secs(1));
    }
}

#[test]
fn disc_process_termination_retains_ownership_and_never_promotes_unconfirmed_files() {
    for (format, bytes) in [
        (
            "ISO",
            include_bytes!("../../tests/fixtures/disc/recovery-iso.iso.gz").as_slice(),
        ),
        (
            "UDF",
            include_bytes!("../../tests/fixtures/disc/recovery-udf.iso.gz").as_slice(),
        ),
    ] {
        for checkpoint in ["staging", "copying", "publishing", "published"] {
            let fixture = Fixture::new();
            let source = fixture.image(bytes);
            let original = hash(&source);
            let mut command = Command::new(std::env::current_exe().unwrap());
            let module = module_path!().split_once("::").unwrap().1;
            command
                .args([
                    format!("{module}::disc_recovery_child"),
                    "--exact".into(),
                    "--ignored".into(),
                    "--nocapture".into(),
                ])
                .env("HARBOR_DISC_RECOVERY_ROOT", &fixture.root)
                .env("HARBOR_DISC_RECOVERY_POINT", checkpoint)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                command.creation_flags(0x0800_0000);
            }
            let mut child = OwnedChild(command.spawn().unwrap());
            let deadline = Instant::now() + Duration::from_secs(60);
            let observed: ArchiveJob = loop {
                if let Ok(data) = fs::read(fixture.root.join("checkpoint.json")) {
                    if let Ok(job) = serde_json::from_slice(&data) {
                        break job;
                    }
                }
                assert!(
                    child.0.try_wait().unwrap().is_none(),
                    "{format}/{checkpoint}: child exited before boundary"
                );
                assert!(
                    Instant::now() < deadline,
                    "{format}/{checkpoint}: boundary timeout"
                );
                std::thread::sleep(Duration::from_millis(10));
            };
            child.0.kill().unwrap();
            assert!(!child.0.wait().unwrap().success());
            let stage = PathBuf::from(observed.stage.as_ref().unwrap());
            let destination = PathBuf::from(&observed.destination);
            assert_eq!(
                destination.exists(),
                checkpoint == "published",
                "{format}/{checkpoint}"
            );
            assert_eq!(
                stage.exists(),
                matches!(checkpoint, "copying" | "publishing")
            );
            if checkpoint == "copying" {
                let size = fs::metadata(stage.join("Payload 雨.bin")).unwrap().len();
                assert!(
                    size > 0 && size < PAYLOAD_BYTES,
                    "actual partial file: {size}"
                );
            }
            let before = fs::read(fixture.root.join("state/jobs.json")).unwrap();
            let retained_payload = stage.join("Payload 雨.bin");
            let retained_hash = retained_payload.is_file().then(|| hash(&retained_payload));
            let stored: Store = serde_json::from_slice(&before).unwrap();
            assert_eq!(stored.jobs[0].status, Status::Running);
            let manager = Archives::load(fixture.root.join("state"), |_| {}).unwrap();
            let jobs = manager.list(PROFILE).unwrap();
            assert_eq!(jobs.len(), 1);
            let recovered = &jobs[0];
            assert_eq!(recovered.id, observed.id);
            assert_eq!(recovered.status, Status::Interrupted);
            assert_eq!(recovered.error.as_deref(), Some("archive_interrupted"));
            assert!(recovered.receipt.is_none());
            assert_eq!(recovered.stage, observed.stage);
            assert_eq!(recovered.origin_source, source.to_string_lossy());
            assert_eq!(recovered.game, Some(game()));
            assert!(manager.list("another-profile").unwrap().is_empty());
            assert_eq!(hash(&source), original);
            assert_eq!(destination.exists(), checkpoint == "published");
            assert_eq!(
                stage.exists(),
                matches!(checkpoint, "copying" | "publishing")
            );
            let reloaded = Archives::load(fixture.root.join("state"), |_| {}).unwrap();
            if let Some(expected) = &retained_hash {
                assert_eq!(
                    &hash(&retained_payload),
                    expected,
                    "recovery must preserve partial bytes"
                );
            }
            assert_eq!(
                reloaded.list(PROFILE).unwrap()[0].status,
                Status::Interrupted
            );
            assert_eq!(
                reloaded.list(PROFILE).unwrap()[0].updated_at,
                recovered.updated_at
            );

            // A new review may retry, but cannot replace an unconfirmed folder
            // already published before the terminated app recorded completion.
            let plan = review(&source);
            if checkpoint == "published" {
                assert_eq!(
                    manager
                        .start(
                            PROFILE.into(),
                            plan.token.clone(),
                            fixture.root.to_string_lossy().into(),
                            "Installed".into(),
                            None,
                            None
                        )
                        .unwrap_err(),
                    "archive_exists"
                );
            }
            let retry = manager
                .start(
                    PROFILE.into(),
                    plan.token,
                    fixture.root.to_string_lossy().into(),
                    "Retry".into(),
                    Some(source.to_string_lossy().into()),
                    Some(game()),
                )
                .unwrap();
            let deadline = Instant::now() + Duration::from_secs(60);
            let completed = loop {
                let job = manager
                    .list(PROFILE)
                    .unwrap()
                    .into_iter()
                    .find(|job| job.id == retry.id)
                    .unwrap();
                if job.status != Status::Running {
                    break job;
                }
                assert!(Instant::now() < deadline, "retry timeout");
                std::thread::sleep(Duration::from_millis(20));
            };
            assert_eq!(
                completed.status,
                Status::Complete,
                "{format}/{checkpoint}: {:?}",
                completed.error
            );
            let receipt = completed.receipt.unwrap();
            assert_eq!(receipt.bytes, PAYLOAD_BYTES);
            assert_eq!(receipt.sha256, original);
            let expected: serde_json::Value = serde_json::from_str(include_str!(
                "../../tests/fixtures/disc/recovery-manifest.json"
            ))
            .unwrap();
            assert_eq!(
                hash(&PathBuf::from(&receipt.destination).join("Payload 雨.bin")),
                expected["payloadSha256"].as_str().unwrap()
            );
            if checkpoint == "published" {
                assert_eq!(
                    hash(&destination.join("Payload 雨.bin")),
                    expected["payloadSha256"].as_str().unwrap()
                );
            }
            assert_eq!(
                manager
                    .list(PROFILE)
                    .unwrap()
                    .iter()
                    .find(|job| job.id == observed.id)
                    .unwrap()
                    .status,
                Status::Interrupted
            );
            eprintln!("PASS {format}/{checkpoint}: forced exit, persisted interruption, retained files/identity and exact retry");
            if let Some(expected) = &retained_hash {
                assert_eq!(
                    &hash(&retained_payload),
                    expected,
                    "retry must preserve the earlier partial folder"
                );
            }
        }
    }
}
