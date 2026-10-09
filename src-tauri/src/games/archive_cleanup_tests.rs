use super::super::{archive_jobs::PrepareArchive, p2p::Torrents, transfers::Transfers};
use super::*;
use sha2::{Digest, Sha256};
use std::{
    io::{Cursor, Write},
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

pub(crate) const PROFILE: &str = "cleanup-proof";
pub(crate) struct Fixture {
    pub(crate) root: PathBuf,
    pub(crate) source: PathBuf,
    pub(crate) manager: Arc<Archives>,
    pub(crate) job: ArchiveJob,
    pub(crate) payload: Vec<u8>,
}
fn hash(path: &Path) -> String {
    format!("{:x}", Sha256::digest(fs::read(path).unwrap()))
}
impl Fixture {
    pub(crate) fn new(multipart: bool) -> Self {
        let base = PathBuf::from(
            std::env::var_os("HARBOR_GAME_TEST_ROOT").expect("explicit fixture root"),
        );
        let root = base.join(format!("archive-cleanup-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let root = root.canonicalize().unwrap();
        let payload: Vec<u8> = (0..65536).map(|i| ((i * 17 + i / 9) % 251) as u8).collect();
        let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
        zip.start_file(
            "Game 雨/data.bin",
            zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Stored),
        )
        .unwrap();
        zip.write_all(&payload).unwrap();
        let bytes = zip.finish().unwrap().into_inner();
        let source = if multipart {
            let half = bytes.len() / 2;
            fs::write(root.join("Original.zip.001"), &bytes[..half]).unwrap();
            fs::write(root.join("Original.zip.002"), &bytes[half..]).unwrap();
            root.join("Original.zip.002")
        } else {
            let path = root.join("Original 雨.zip");
            fs::write(&path, bytes).unwrap();
            path
        };
        fs::write(root.join("Unrelated.zip"), b"must remain").unwrap();
        let manager = Archives::load(root.join("state"), |_| {}).unwrap();
        let job = manager
            .prepare(PrepareArchive {
                id: uuid::Uuid::new_v4().to_string(),
                profile: PROFILE.into(),
                source: source.to_string_lossy().into_owned(),
                parent: root.to_string_lossy().into_owned(),
                name: "Unpacked".into(),
                origin_source: None,
                game: None,
                expected_sha256: None,
                allowed_parts: None,
                expected_parts: None,
            })
            .unwrap();
        let start = Instant::now();
        let job = loop {
            let job = manager
                .list(PROFILE)
                .unwrap()
                .into_iter()
                .find(|j| j.id == job.id)
                .unwrap();
            if job.status != Status::Running {
                assert_eq!(job.status, Status::Complete, "{:?}", job.error);
                break job;
            }
            assert!(start.elapsed() < Duration::from_secs(20));
            std::thread::sleep(Duration::from_millis(5));
        };
        Self {
            root,
            source,
            manager,
            job,
            payload,
        }
    }
    pub(crate) fn review(&self) -> Result<Review> {
        self.manager.review_cleanup(
            PROFILE,
            &self.job.id,
            &uuid::Uuid::new_v4().to_string(),
            || Ok(vec![]),
            |_| {},
        )
    }
    pub(crate) fn assert_originals(&self) {
        assert!(self.source.is_file());
        assert_eq!(
            fs::read(self.root.join("Unrelated.zip")).unwrap(),
            b"must remain"
        );
        assert_eq!(
            fs::read(Path::new(&self.job.destination).join("Game 雨/data.bin")).unwrap(),
            self.payload
        );
    }
    fn change(&self, edit: impl FnOnce(&mut ArchiveJob)) {
        let mut held = self.manager.jobs.lock().unwrap();
        edit(held.iter_mut().find(|j| j.id == self.job.id).unwrap());
    }
}

#[test]
fn successful_extraction_review_is_read_only_and_survives_store_reload() {
    let f = Fixture::new(false);
    let before = hash(&f.source);
    let store = hash(&f.root.join("state/jobs.json"));
    let review = f.review().unwrap();
    assert!(review.files_verified);
    assert!(review.blockers.is_empty());
    assert_eq!(review.files.len(), 1);
    assert_eq!(review.files[0].sha256, before);
    assert_eq!(review.revision, f.job.updated_at);
    assert_eq!(review.bytes, fs::metadata(&f.source).unwrap().len());
    let loaded = Archives::load(f.root.join("state"), |_| {}).unwrap();
    assert!(
        loaded
            .review_cleanup(
                PROFILE,
                &f.job.id,
                &uuid::Uuid::new_v4().to_string(),
                || Ok(vec![]),
                |_| {}
            )
            .unwrap()
            .files_verified
    );
    assert_eq!(hash(&f.root.join("state/jobs.json")), store);
    assert_eq!(hash(&f.source), before);
    f.assert_originals();
}
#[test]
fn multipart_review_uses_only_receipted_parts_and_rejects_changed_later_volume() {
    let f = Fixture::new(true);
    let review = f.review().unwrap();
    assert_eq!(review.files.len(), 2);
    assert!(review
        .files
        .iter()
        .all(|part| part.name.starts_with("Original.zip.")));
    f.assert_originals();
    let mut bytes = fs::read(&f.source).unwrap();
    bytes[3] ^= 1;
    fs::write(&f.source, &bytes).unwrap();
    assert_eq!(f.review().unwrap_err(), "archive_changed");
    assert_eq!(fs::read(&f.source).unwrap(), bytes);
    f.assert_originals();
}

#[test]
fn an_earlier_volume_changing_while_a_later_one_is_read_invalidates_the_review() {
    let f = Fixture::new(true);
    let first = f.root.join("Original.zip.001");
    let edited = std::sync::atomic::AtomicBool::new(false);
    let result = f.manager.review_cleanup(
        PROFILE,
        &f.job.id,
        &uuid::Uuid::new_v4().to_string(),
        || Ok(vec![]),
        |progress| {
            if progress.files == 1 && !edited.swap(true, Ordering::SeqCst) {
                let mut file = fs::OpenOptions::new().append(true).open(&first).unwrap();
                file.write_all(b"changed during review").unwrap();
            }
        },
    );
    assert!(edited.load(Ordering::SeqCst));
    assert_eq!(result.unwrap_err(), "archive_changed");
    assert!(fs::read(first).unwrap().ends_with(b"changed during review"));
    f.assert_originals();
}
#[test]
fn failed_legacy_malformed_and_output_contained_receipts_are_refused() {
    let f = Fixture::new(false);
    for kind in 0..8 {
        f.change(|job| {
            *job = f.job.clone();
            match kind {
                0 => job.status = Status::Failed,
                1 => job.receipt.as_mut().unwrap().parts.clear(),
                2 => {
                    let part = job.receipt.as_ref().unwrap().parts[0].clone();
                    job.receipt.as_mut().unwrap().parts.push(part);
                }
                3 => job.receipt.as_mut().unwrap().parts[0].name = "../Unrelated.zip".into(),
                4 => job.receipt.as_mut().unwrap().parts[0].name = "Unrelated.zip".into(),
                5 => job.receipt.as_mut().unwrap().destination = f.root.to_string_lossy().into(),
                6 => {
                    job.destination = f.root.to_string_lossy().into();
                    job.receipt.as_mut().unwrap().destination = job.destination.clone();
                }
                _ => job.receipt.as_mut().unwrap().parts[0].sha256 = "bad".into(),
            }
        });
        let error = f.review().unwrap_err();
        assert!(
            matches!(
                error,
                "archive_cleanup_receipt" | "archive_cleanup_incomplete"
            ),
            "{kind}: {error}"
        );
        f.assert_originals();
    }
}
#[test]
fn busy_or_shared_sources_skip_hashing_and_do_not_expose_other_profile_details() {
    let f = Fixture::new(true);
    let reads = AtomicUsize::new(0);
    let review = f
        .manager
        .review_cleanup(
            PROFILE,
            &f.job.id,
            &uuid::Uuid::new_v4().to_string(),
            || {
                Ok(vec![
                    Usage {
                        path: f.source.to_string_lossy().into(),
                        tree: false,
                        family: true,
                        reason: Blocker::PendingPreparation,
                    },
                    Usage {
                        path: f.root.to_string_lossy().into(),
                        tree: true,
                        family: false,
                        reason: Blocker::AnotherProfile,
                    },
                    Usage {
                        path: f.root.to_string_lossy().into(),
                        tree: true,
                        family: false,
                        reason: Blocker::Sharing,
                    },
                ])
            },
            |_| {
                reads.fetch_add(1, Ordering::SeqCst);
            },
        )
        .unwrap();
    assert_eq!(reads.load(Ordering::SeqCst), 0);
    assert!(!review.files_verified);
    assert_eq!(
        review.blockers,
        vec![
            Blocker::PendingPreparation,
            Blocker::AnotherProfile,
            Blocker::Sharing
        ]
    );
    f.assert_originals();
    let unrelated = Usage {
        path: format!("{}-sibling", f.root.display()),
        tree: true,
        family: false,
        reason: Blocker::Sharing,
    };
    assert!(!matches(&unrelated, &f.source));
}
#[test]
fn consumers_are_rechecked_after_hashing_and_another_extraction_protects_its_sources() {
    let f = Fixture::new(false);
    let reads = AtomicUsize::new(0);
    let review = f
        .manager
        .review_cleanup(
            PROFILE,
            &f.job.id,
            &uuid::Uuid::new_v4().to_string(),
            || {
                Ok(if reads.fetch_add(1, Ordering::SeqCst) == 0 {
                    vec![]
                } else {
                    vec![Usage {
                        path: f.source.to_string_lossy().into(),
                        tree: false,
                        family: false,
                        reason: Blocker::ActiveDownload,
                    }]
                })
            },
            |_| {},
        )
        .unwrap();
    assert!(review.files_verified);
    assert_eq!(review.blockers, vec![Blocker::ActiveDownload]);
    let mut other = f.job.clone();
    other.id = uuid::Uuid::new_v4().to_string();
    f.manager.jobs.lock().unwrap().push(other);
    let review = f.review().unwrap();
    assert!(!review.files_verified);
    assert_eq!(review.blockers, vec![Blocker::OtherExtraction]);
    f.assert_originals();
}
#[test]
fn cancellation_profile_isolation_and_removed_job_leave_originals_untouched() {
    let f = Fixture::new(false);
    let operation = uuid::Uuid::new_v4().to_string();
    assert_eq!(
        f.manager
            .review_cleanup("other", &f.job.id, &operation, || Ok(vec![]), |_| {})
            .unwrap_err(),
        "archive_expired"
    );
    assert_eq!(
        f.manager
            .review_cleanup(
                PROFILE,
                &f.job.id,
                &operation,
                || Ok(vec![]),
                |_| archives::cancel(PROFILE.into(), operation.clone())
            )
            .unwrap_err(),
        "archive_canceled"
    );
    assert!(f.review().unwrap().files_verified);
    assert_eq!(
        f.manager
            .review_cleanup(
                PROFILE,
                &f.job.id,
                &uuid::Uuid::new_v4().to_string(),
                || Ok(vec![]),
                |_| {
                    f.manager.remove(PROFILE, &f.job.id).unwrap();
                }
            )
            .unwrap_err(),
        "archive_expired"
    );
    f.assert_originals();
}
#[test]
fn changed_job_revision_and_missing_output_invalidate_review() {
    let f = Fixture::new(false);
    assert_eq!(
        f.manager
            .review_cleanup(
                PROFILE,
                &f.job.id,
                &uuid::Uuid::new_v4().to_string(),
                || Ok(vec![]),
                |_| f.change(|job| job.updated_at += 1)
            )
            .unwrap_err(),
        "archive_changed"
    );
    f.change(|job| *job = f.job.clone());
    let output = Path::new(&f.job.destination);
    let moved = f.root.join("Moved output");
    fs::rename(output, &moved).unwrap();
    assert_eq!(f.review().unwrap_err(), "archive_read");
    fs::rename(&moved, output).unwrap();
    f.assert_originals();
}
#[test]
fn real_download_managers_protect_paused_and_foreign_records() {
    let f = Fixture::new(false);
    let root = f.root.join("direct");
    fs::create_dir(&root).unwrap();
    let make = |profile: &str, status: &str| serde_json::json!({"id":uuid::Uuid::new_v4().to_string(),"profile":profile,"name":"Original","url":"https://example.org/file.zip","destination":f.source,"status":status,"received":1,"total":1,"expectedBytes":null,"expectedSha256":null,"sha256":null,"validator":null,"createdAt":1,"updatedAt":1,"error":null,"queueOrder":1});
    fs::write(root.join("transfers.json"),serde_json::to_vec(&serde_json::json!({"version":1,"records":[make(PROFILE,"complete"),make(PROFILE,"paused"),make("other","complete")]})).unwrap()).unwrap();
    let direct = Transfers::load(root, |_| {}).unwrap();
    let refs = direct.cleanup_usage(PROFILE, &f.job.id).unwrap();
    assert_eq!(refs.len(), 2);
    assert_eq!(refs[0].reason, Blocker::ActiveDownload);
    assert_eq!(refs[1].reason, Blocker::AnotherProfile);
    let root = f.root.join("torrent");
    fs::create_dir(&root).unwrap();
    let record = serde_json::json!({"id":uuid::Uuid::new_v4().to_string(),"profile":PROFILE,"name":"Original","infoHash":"a".repeat(40),"metadataSha":"b".repeat(64),"destination":f.root,"selected":[0],"totalBytes":1,"received":0,"status":"paused","downloadBps":0,"uploadBps":65536,"createdAt":1,"updatedAt":1,"error":null});
    fs::write(
        root.join("transfers.json"),
        serde_json::to_vec(&serde_json::json!({"version":1,"records":[record]})).unwrap(),
    )
    .unwrap();
    let torrents = Torrents::new(root, Arc::new(|_| {})).unwrap();
    let refs = torrents.cleanup_usage(PROFILE, &f.job.id).unwrap();
    assert_eq!(refs.len(), 1);
    assert!(matches(&refs[0], &f.source));
    assert_eq!(refs[0].reason, Blocker::ActiveDownload);
    f.assert_originals();
}

#[test]
fn pending_policy_blocks_its_family_until_explicitly_disabled() {
    use super::super::download_preparation::{
        Choice, Engine, Preparations, Status as PreparationStatus, Target,
    };
    let f = Fixture::new(true);
    let policies = Preparations::load(
        f.root.join("preparation"),
        f.manager.clone(),
        |_| Err("archive_read"),
        |_| {},
    )
    .unwrap();
    let choice = Choice {
        id: uuid::Uuid::new_v4().to_string(),
        target: Target {
            profile: PROFILE.into(),
            engine: Engine::Direct,
            download_id: uuid::Uuid::new_v4().to_string(),
            archive: f.source.to_string_lossy().into_owned(),
            members: vec![],
        },
        identity: "a".repeat(64),
        parent: f.root.to_string_lossy().into_owned(),
        name: "Later extraction".into(),
        status: PreparationStatus::Waiting,
        error: None,
        updated_at: 1,
    };
    policies.adopt(choice.clone()).unwrap();
    let review = f
        .manager
        .review_cleanup(
            PROFILE,
            &f.job.id,
            &uuid::Uuid::new_v4().to_string(),
            || policies.cleanup_usage(&f.job.id),
            |_| {},
        )
        .unwrap();
    assert_eq!(review.blockers, vec![Blocker::PendingPreparation]);
    assert!(!review.files_verified);
    policies.disable(PROFILE, &choice.id).unwrap();
    assert!(policies.cleanup_usage(&f.job.id).unwrap().is_empty());
    f.assert_originals();
}
