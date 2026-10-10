use super::*;
use sha2::{Digest, Sha256};
use std::{path::Path, sync::atomic::AtomicUsize, time::Instant};
struct Fixture {
    root: PathBuf,
    source: PathBuf,
    archives: Arc<Archives>,
    ready: Arc<AtomicBool>,
    identity: Arc<Mutex<String>>,
}
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!("download-preparation-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let root = root.canonicalize().unwrap();
        let source = root.join("game.zip");
        let mut zip = zip::ZipWriter::new(File::create(&source).unwrap());
        zip.start_file("game/data.bin", zip::write::SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"original fixture payload").unwrap();
        zip.finish().unwrap();
        let archives = Archives::load(root.join("archives"), |_| {}).unwrap();
        Self {
            root,
            source,
            archives,
            ready: Arc::new(AtomicBool::new(false)),
            identity: Arc::new(Mutex::new("a".repeat(64))),
        }
    }
    fn request(&self) -> Configure {
        Configure {
            target: Target {
                profile: "one".into(),
                engine: Engine::Direct,
                download_id: uuid::Uuid::new_v4().to_string(),
                archive: self.source.to_string_lossy().into(),
                members: vec![],
            },
            parent: self.root.to_string_lossy().into(),
            name: "Extracted".into(),
        }
    }
    fn manager(&self) -> Arc<Preparations> {
        let source = self.source.clone();
        let ready = self.ready.clone();
        let identity = self.identity.clone();
        Preparations::load(
            self.root.join("policies"),
            self.archives.clone(),
            move |_| {
                Ok(Snapshot {
                    identity: identity.lock().unwrap().clone(),
                    source: source.to_string_lossy().into(),
                    origin_source: source.to_string_lossy().into(),
                    game: None,
                    ready: ready.load(Ordering::SeqCst),
                    sha256: Some(format!("{:x}", Sha256::digest(fs::read(&source).unwrap()))),
                    allowed_parts: vec![source.to_string_lossy().into()],
                    expected_parts: None,
                })
            },
            |_| {},
        )
        .unwrap()
    }
    fn complete(&self, id: &str) -> ArchiveJob {
        let start = Instant::now();
        loop {
            if let Some(job) = self.archives.list("one").unwrap().into_iter().find(|job| {
                job.id == id && job.status != super::super::archive_jobs::Status::Running
            }) {
                return job;
            }
            assert!(start.elapsed() < Duration::from_secs(15));
            std::thread::sleep(Duration::from_millis(20));
        }
    }
}
use super::super::archive_jobs::ArchiveJob;

#[test]
fn durable_choice_waits_for_completion_then_native_worker_runs_without_a_view() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let choice = manager.configure(fixture.request()).unwrap();
    assert_eq!(choice.status, Status::Waiting);
    manager.tick();
    assert!(fixture.archives.list("one").unwrap().is_empty());
    drop(manager);
    let reloaded = fixture.manager();
    assert_eq!(reloaded.list("one").unwrap()[0].id, choice.id);
    fixture.ready.store(true, Ordering::SeqCst);
    reloaded.start().unwrap();
    let job = fixture.complete(&choice.id);
    reloaded.stop();
    assert_eq!(job.status, super::super::archive_jobs::Status::Complete);
    assert_eq!(
        fs::read(Path::new(&job.destination).join("game/data.bin")).unwrap(),
        b"original fixture payload"
    );
    assert_eq!(reloaded.list("one").unwrap()[0].status, Status::Started);
    fixture.archives.remove("one", &choice.id).unwrap();
    drop(reloaded);
    let reloaded = fixture.manager();
    reloaded.tick();
    assert!(fixture.archives.list("one").unwrap().is_empty());
    assert!(Path::new(&job.destination).exists());
}
#[test]
fn existing_extraction_queues_preparation_without_failed_state() {
    let fixture = Fixture::new();
    fixture.ready.store(true, Ordering::SeqCst);
    let manager = fixture.manager();
    let choice = manager.configure(fixture.request()).unwrap();
    let held = archives::start("manual", &uuid::Uuid::new_v4().to_string()).unwrap();
    manager.tick();
    assert_eq!(manager.list("one").unwrap()[0].status, Status::Queued);
    assert!(fixture.archives.list("one").unwrap().is_empty());
    drop(held);
    manager.tick();
    assert_eq!(
        fixture.complete(&choice.id).status,
        super::super::archive_jobs::Status::Complete
    );
}
#[test]
fn interrupted_dispatch_reconciles_existing_job_before_resolving_source() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let choice = manager.configure(fixture.request()).unwrap();
    manager
        .transition(&choice.id, Status::Dispatching, None)
        .unwrap();
    fixture
        .archives
        .prepare(PrepareArchive {
            id: choice.id.clone(),
            profile: "one".into(),
            source: fixture.source.to_string_lossy().into(),
            parent: choice.parent.clone(),
            name: choice.name.clone(),
            origin_source: None,
            game: None,
            expected_sha256: None,
            allowed_parts: Some(vec![fixture.source.to_string_lossy().into()]),
            expected_parts: None,
        })
        .unwrap();
    fixture.complete(&choice.id);
    drop(manager);
    let calls = Arc::new(AtomicUsize::new(0));
    let count = calls.clone();
    let recovered = Preparations::load(
        fixture.root.join("policies"),
        fixture.archives.clone(),
        move |_| {
            count.fetch_add(1, Ordering::SeqCst);
            Err("archive_read")
        },
        |_| {},
    )
    .unwrap();
    recovered.tick();
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert_eq!(recovered.list("one").unwrap()[0].status, Status::Started);
    assert_eq!(fixture.archives.list("one").unwrap().len(), 1);
}
#[test]
fn disabled_or_replaced_choices_cannot_dispatch_and_profiles_stay_separate() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let request = fixture.request();
    let first = manager.configure(request.clone()).unwrap();
    assert!(manager.disable("other", &first.id).is_err());
    manager.disable("one", &first.id).unwrap();
    fixture.ready.store(true, Ordering::SeqCst);
    manager.tick();
    assert!(fixture.archives.list("one").unwrap().is_empty());
    let second = manager.configure(request).unwrap();
    assert_ne!(first.id, second.id);
    assert_eq!(manager.list("one").unwrap().len(), 1);
    assert!(manager.list("other").unwrap().is_empty());
    manager.tick();
    fixture.complete(&second.id);
    assert_eq!(fixture.archives.list("one").unwrap().len(), 1);
}
#[test]
fn failed_policy_write_and_changed_download_identity_never_extract() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let store = fixture.root.join("policies/choices.json");
    fs::create_dir(&store).unwrap();
    assert!(manager.configure(fixture.request()).is_err());
    assert!(manager.list("one").unwrap().is_empty());
    assert!(fixture.archives.list("one").unwrap().is_empty());
    fs::remove_dir(store).unwrap();
    manager.configure(fixture.request()).unwrap();
    *fixture.identity.lock().unwrap() = "b".repeat(64);
    fixture.ready.store(true, Ordering::SeqCst);
    manager.tick();
    let choice = &manager.list("one").unwrap()[0];
    assert_eq!(choice.status, Status::Failed);
    assert_eq!(choice.error.as_deref(), Some("archive_changed"));
    assert!(fixture.archives.list("one").unwrap().is_empty());
}
#[test]
fn unfinished_or_unselected_neighbor_volume_is_refused_before_extraction() {
    let fixture = Fixture::new();
    let bytes = fs::read(&fixture.source).unwrap();
    let chunks = bytes.chunks((bytes.len() / 3).max(1));
    for (index, chunk) in chunks.enumerate() {
        fs::write(
            fixture.root.join(format!("parts.zip.{:03}", index + 1)),
            chunk,
        )
        .unwrap();
    }
    let selected = fixture.root.join("parts.zip.001");
    let id = uuid::Uuid::new_v4().to_string();
    let job = fixture
        .archives
        .prepare(PrepareArchive {
            id: id.clone(),
            profile: "one".into(),
            source: selected.to_string_lossy().into(),
            parent: fixture.root.to_string_lossy().into(),
            name: "No unpublished parts".into(),
            origin_source: None,
            game: None,
            expected_sha256: None,
            allowed_parts: Some(vec![selected.to_string_lossy().into()]),
            expected_parts: None,
        })
        .unwrap();
    let failed = fixture.complete(&id);
    assert_eq!(failed.error.as_deref(), Some("archive_missing_part"));
    assert!(!Path::new(&job.destination).exists());
    assert_eq!(fs::read(&fixture.source).unwrap(), bytes);
}
#[test]
fn supported_archive_families_do_not_match_installers_or_other_games() {
    assert!(archives::split_archive("Game.zip.001"));
    for name in [
        "Game.zip",
        "Game.zip.002",
        "Game.7z.003",
        "Game.part02.rar",
        "Game.r00",
        "Game.tar.gz",
        "Game.tgz",
        "Game.iso",
    ] {
        assert!(archives::preparation_candidate(name), "{name}");
    }
    for name in ["setup.exe", "game.bin", "part-2.txt", "game.zip.exe"] {
        assert!(!archives::preparation_candidate(name), "{name}");
    }
    assert!(archives::preparation_family(
        "Game.part1.rar",
        "Game.part02.rar"
    ));
    assert!(archives::preparation_family("Game.zip.001", "game.zip.003"));
    assert!(!archives::preparation_family(
        "Game.zip.001",
        "Other.zip.001"
    ));
    assert!(!archives::preparation_family("Game.zip.001", "Game.7z.001"));
}

#[test]
fn full_history_never_replaces_existing_permission_when_only_a_member_is_missing() {
    let fixture = Fixture::new();
    let request = fixture.request();
    let retired = Arc::new(Mutex::new(String::new()));
    let deleted = retired.clone();
    let manager = Preparations::load(
        fixture.root.join("bounded-policies"),
        fixture.archives.clone(),
        move |target| {
            if target.download_id == *deleted.lock().unwrap() || !target.members.is_empty() {
                return Err("transfer_missing");
            }
            Err("archive_read")
        },
        |_| {},
    )
    .unwrap();
    let mut choices = Vec::new();
    for index in 0..MAX_CHOICES {
        let mut target = request.target.clone();
        target.download_id = uuid::Uuid::new_v4().to_string();
        target.members = vec![uuid::Uuid::new_v4().to_string()];
        choices.push(Choice {
            id: uuid::Uuid::new_v4().to_string(),
            target,
            identity: "a".repeat(64),
            parent: request.parent.clone(),
            name: format!("Saved {index}"),
            status: Status::Disabled,
            error: None,
            updated_at: index as u64,
        });
    }
    *manager.choices.lock().unwrap() = choices.clone();
    let incoming = acquisition_choice(
        request.target,
        request.parent,
        "New choice".into(),
        "b".repeat(64),
    )
    .unwrap();
    assert_eq!(manager.adopt(incoming.clone()), Err("archive_history"));
    assert_eq!(manager.list("one").unwrap().len(), MAX_CHOICES);
    assert_eq!(manager.list("one").unwrap()[0].id, choices[0].id);
    *retired.lock().unwrap() = choices[0].target.download_id.clone();
    manager.adopt(incoming.clone()).unwrap();
    let retained = manager.list("one").unwrap();
    assert_eq!(retained.len(), MAX_CHOICES);
    assert!(!retained.iter().any(|choice| choice.id == choices[0].id));
    assert!(retained.iter().any(|choice| choice.id == incoming.id));
    assert!(retained
        .iter()
        .filter(|choice| choice.id != incoming.id)
        .all(|choice| choice.status == Status::Disabled));
}
