use super::*;
use std::{fs, path::Path};
const ID: &str = "battlenet:wow";
const VERSION: &str = "12.1.0.69497";

struct Fixture {
    base: PathBuf,
    root: PathBuf,
}
impl Fixture {
    fn new() -> Self {
        let base = PathBuf::from(
            std::env::var("HARBOR_GAME_TEST_ROOT").expect("Use an isolated native test directory"),
        );
        fs::create_dir_all(&base).unwrap();
        let base = fs::canonicalize(base).unwrap();
        let root = base.join(format!("wow-review-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        Self { base, root }
    }
    fn review(&self, profile: &str, previous: bool) -> Prepared {
        let store = Store::connect(&self.root, ID).unwrap();
        if previous {
            let plan = store
                .stage(bundle("1", &["Main", "Legacy"]), &CancellationToken::new())
                .unwrap();
            store
                .apply(&plan, VERSION, &CancellationToken::new())
                .unwrap();
            store.discard(&plan).unwrap();
        }
        let plan = store
            .stage(bundle("2", &["Main", "New"]), &CancellationToken::new())
            .unwrap();
        store
            .preview(&plan, VERSION, &CancellationToken::new())
            .unwrap();
        Prepared::new(
            profile.into(),
            ID.into(),
            self.root.clone(),
            VERSION.into(),
            store,
            plan,
            false,
        )
        .unwrap()
    }
    fn stages(&self) -> usize {
        fs::read_dir(self.root.join("Interface/.harbor-wow-addons/stage"))
            .unwrap()
            .count()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let root = fs::canonicalize(&self.root).unwrap();
        assert_eq!(root.parent(), Some(self.base.as_path()));
        assert!(root
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("wow-review-"));
        fs::remove_dir_all(root).unwrap();
    }
}
fn bundle(version: &str, names: &[&str]) -> package::Package {
    let mut files = vec![];
    for name in names {
        let data =
            format!("## Interface: 120100\n## X-WoWI-ID: 7\n## Version: {version}\n").into_bytes();
        files.push(package::File {
            stamp: package::FileStamp {
                path: format!("{name}/{name}.toc"),
                bytes: data.len() as u64,
                sha256: package::digest(&data),
            },
            data,
        });
    }
    files.sort_by(|a, b| a.stamp.path.cmp(&b.stamp.path));
    package::Package {
        release: package::Release {
            id: 7,
            title: "Original addon".into(),
            version: version.into(),
            updated_at: 1,
            checksum: "0".repeat(32),
            download_url: String::new(),
        },
        files,
        folders: names.iter().map(|name| (*name).into()).collect(),
        dependencies: vec![],
    }
}

#[test]
fn pinned_review_describes_each_actual_folder_and_retained_backup() {
    let fixture = Fixture::new();
    let prepared = fixture.review("alice", true);
    assert_eq!(
        prepared.review.folders,
        vec![
            Folder {
                name: "Legacy".into(),
                action: Action::Remove
            },
            Folder {
                name: "Main".into(),
                action: Action::Replace
            },
            Folder {
                name: "New".into(),
                action: Action::Add
            },
        ]
    );
    assert_eq!(prepared.review.from_version.as_deref(), Some("1"));
    assert_eq!(prepared.review.version.as_deref(), Some("2"));
    assert!(prepared.review.backup_bytes > 0);
    assert!(fixture.root.join("Interface/AddOns/Legacy").is_dir());
    assert!(!fixture.root.join("Interface/AddOns/New").exists());
    assert_eq!(prepared.validate("other"), Err("wow_addons_review"));
}

#[test]
fn import_review_reports_keep_actions_and_discard_leaves_existing_bytes_unmanaged() {
    let fixture = Fixture::new();
    let store = Store::connect(&fixture.root, ID).unwrap();
    let package = bundle("installed", &["Main", "Companion"]);
    for file in package.files {
        let path = fixture.root.join("Interface/AddOns").join(file.stamp.path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, file.data).unwrap();
    }
    let plan = store
        .adopt(
            package::Layout {
                release: package.release,
                folders: package.folders,
            },
            VERSION,
            &CancellationToken::new(),
        )
        .unwrap();
    let prepared = Prepared::new(
        "alice".into(),
        ID.into(),
        fixture.root.clone(),
        VERSION.into(),
        store,
        plan,
        false,
    )
    .unwrap();
    assert!(prepared.review.adopt);
    assert!(prepared
        .review
        .folders
        .iter()
        .all(|folder| folder.action == Action::Keep));
    assert_eq!(prepared.review.version.as_deref(), Some("installed"));
    assert_eq!(prepared.review.backup_bytes, 0);
    let token = prepared.review.token.clone();
    let mut book = Book::default();
    book.plans.insert(token.clone(), prepared);
    assert!(book.take("bob", &token).is_err());
    drop(book.take("alice", &token).unwrap());
    let (state, pending) = Store::snapshot(&fixture.root, ID).unwrap();
    assert!(!pending);
    assert!(state.unwrap().packages.is_empty());
    assert!(fixture
        .root
        .join("Interface/AddOns/Main/Main.toc")
        .is_file());
    let workspace = Workspace::from_state(ID.into(), VERSION.into(), None, false);
    assert_eq!(serde_json::to_value(workspace).unwrap()["canAdopt"], true);
}

#[test]
fn foreign_profile_cannot_consume_or_discard_a_review_and_tokens_are_single_use() {
    let fixture = Fixture::new();
    let prepared = fixture.review("alice", false);
    let token = prepared.review.token.clone();
    let mut book = Book::default();
    book.plans.insert(token.clone(), prepared);
    assert!(matches!(book.take("bob", &token), Err("wow_addons_review")));
    assert!(book.plans.contains_key(&token));
    let prepared = book.take("alice", &token).unwrap();
    assert!(matches!(
        book.take("alice", &token),
        Err("wow_addons_review")
    ));
    assert_eq!(fixture.stages(), 1);
    drop(prepared);
    assert_eq!(fixture.stages(), 0);
    assert!(Store::connect(&fixture.root, ID).is_ok());
}

#[test]
fn open_review_keeps_store_exclusive_but_snapshot_is_read_only_and_available() {
    let fixture = Fixture::new();
    let prepared = fixture.review("alice", true);
    assert!(matches!(
        Store::connect(&fixture.root, ID),
        Err("wow_addons_busy")
    ));
    let (snapshot, pending) = Store::snapshot(&fixture.root, ID).unwrap();
    assert!(!pending);
    let snapshot = snapshot.unwrap();
    assert_eq!(snapshot.packages[0].version, "1");
    let workspace = Workspace::from_state(ID.into(), VERSION.into(), Some(snapshot), pending);
    let serialized = serde_json::to_value(workspace).unwrap();
    assert_eq!(serialized["addons"][0]["files"], 2);
    assert!(serialized["addons"][0].get("sha256").is_none());
    drop(prepared);
    assert!(Store::connect(&fixture.root, ID).is_ok());
}

#[test]
fn expiry_releases_stages_and_handles_without_changing_installed_version() {
    let fixture = Fixture::new();
    let mut prepared = fixture.review("alice", true);
    prepared.created = Instant::now() - TTL;
    assert_eq!(prepared.validate("alice"), Err("wow_addons_expired"));
    let mut book = Book::default();
    book.plans.insert(prepared.review.token.clone(), prepared);
    let expired = book.expired();
    assert_eq!(expired.len(), 1);
    assert!(book.plans.is_empty());
    drop(expired);
    assert_eq!(fixture.stages(), 0);
    let store = Store::connect(&fixture.root, ID).unwrap();
    assert_eq!(store.load().unwrap().packages[0].version, "1");
}

#[test]
fn jobs_are_bounded_profile_scoped_and_release_capacity_on_error() {
    let jobs = Arc::new(Mutex::new(Jobs::default()));
    let id = uuid::Uuid::new_v4().to_string();
    let first = Work::start(jobs.clone(), "alice", &id).unwrap();
    assert!(matches!(
        Work::start(jobs.clone(), "alice", &id),
        Err("wow_addons_busy")
    ));
    let second = Work::start(jobs.clone(), "bob", &id).unwrap();
    assert!(matches!(
        Work::start(jobs.clone(), "carol", &id),
        Err("wow_addons_busy")
    ));
    jobs.lock()
        .unwrap()
        .active
        .get(&("bob".into(), id.clone()))
        .unwrap()
        .cancel();
    assert!(second.cancel.is_cancelled());
    assert!(!first.cancel.is_cancelled());
    drop(second);
    assert!(Work::start(jobs.clone(), "carol", &id).is_ok());
    drop(first);
    assert!(jobs.lock().unwrap().active.is_empty());
    assert!(matches!(
        Work::start(jobs.clone(), "", &id),
        Err("wow_addons_profile")
    ));
    assert!(matches!(
        Work::start(jobs, "alice", "../operation"),
        Err("wow_addons_request")
    ));
}

#[test]
fn removed_or_changed_pinned_stage_cannot_be_applied_after_review() {
    let fixture = Fixture::new();
    let prepared = fixture.review("alice", false);
    let stage = fixture
        .root
        .join("Interface/.harbor-wow-addons/stage")
        .join(&prepared.review.token);
    fs::write(stage.join("Main/Main.toc"), b"changed after review").unwrap();
    assert_eq!(
        prepared
            .store
            .preview(&prepared.plan, VERSION, &CancellationToken::new()),
        Err("wow_addons_incompatible")
    );
    drop(prepared);
    assert!(stage.join("Main/Main.toc").exists());
    assert!(!fixture.root.join("Interface/AddOns/Main").exists());
}

#[tokio::test]
async fn invalid_dispatch_inputs_fail_without_resolving_or_writing_a_game() {
    assert!(matches!(
        review(
            None,
            "".into(),
            ID.into(),
            Request::Install { addon_id: 7 },
            uuid::Uuid::new_v4().to_string()
        )
        .await,
        Err("wow_addons_profile")
    ));
    assert!(matches!(
        apply(
            None,
            "alice".into(),
            "missing".into(),
            uuid::Uuid::new_v4().to_string()
        )
        .await,
        Err("wow_addons_review")
    ));
    assert!(matches!(
        discard("alice".into(), "missing".into()).await,
        Err("wow_addons_review")
    ));
    assert!(matches!(
        workspace("unsupported:edition".into()).await,
        Err("wow_addons_edition")
    ));
    cancel("alice", "missing");
    assert!(!Path::new("unsupported:edition").exists());
}

#[tokio::test]
#[ignore = "Explicit read-only verification against actual detected WoW installations"]
async fn actual_workspace_reads_do_not_create_or_recover_game_files() {
    for id in ["battlenet:wow", "battlenet:wow_classic_anniversary"] {
        let (root, version) =
            wow_addons::target(id).expect("This machine must have this edition installed");
        let records = root.join("Interface/.harbor-wow-addons");
        let existed = records.exists();
        let before = ["state.json", "journal.json"].map(|name| fs::read(records.join(name)).ok());
        let result = workspace(id.into()).await.unwrap();
        assert_eq!(result.id, id);
        assert_eq!(result.client_version, version);
        assert_eq!(records.exists(), existed);
        assert_eq!(
            ["state.json", "journal.json"].map(|name| fs::read(records.join(name)).ok()),
            before
        );
        println!(
            "{id}: {} managed addons, {} backups, pending recovery: {}",
            result.addons.len(),
            result.backups.len(),
            result.recovery_pending
        );
    }
}
