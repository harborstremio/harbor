use super::super::super::{
    download_preparation::{Choice, Status as ChoiceStatus},
    preparation_intake::{self, Draft},
};
use super::*;
use std::process::{Command, Stdio};

fn draft(root: &Path) -> Draft {
    Draft {
        archive: "Game.zip".into(),
        parent: root.to_string_lossy().into(),
        name: "Unpacked".into(),
        members: vec![],
    }
}
fn request(root: &Path, url: &str, bytes: &[u8]) -> NewTransfer {
    serde_json::from_value(serde_json::json!({"profile":"alice","name":"Original fixture","url":url,"destination":root.join("Game.zip"),"expectedBytes":bytes.len(),"expectedSha256":format!("{:x}",Sha256::digest(bytes))})).unwrap()
}
async fn direct_complete(manager: &Transfers, id: &str) {
    tokio::time::timeout(Duration::from_secs(20), async {
        loop {
            let record = manager.preparation_record("alice", id).unwrap();
            assert_ne!(record.status, DirectStatus::Failed, "{:?}", record.error);
            if record.status == DirectStatus::Complete {
                return;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .unwrap();
}
fn policies(
    root: &Path,
    archives: Arc<Archives>,
    direct: Arc<Transfers>,
    torrent: Arc<Torrents>,
) -> Arc<Preparations> {
    let native_direct = direct.clone();
    let native_torrent = torrent.clone();
    let policies = Preparations::load(
        root.join("policies"),
        archives,
        move |target| match target.engine {
            Engine::Direct => preparation_runtime::resolve_direct(&native_direct, target),
            Engine::Torrent => preparation_runtime::resolve_torrent(&native_torrent, target),
        },
        |_| {},
    )
    .unwrap();
    policies
        .set_intake(move |policies| {
            preparation_intake::direct_pending(policies, &direct)?;
            preparation_intake::torrent_pending(policies, &torrent)?;
            Ok(false)
        })
        .unwrap();
    policies
}

// The parent kills this process at each durable boundary. No RAII cleanup or
// renderer shutdown can accidentally make the recovery proof pass.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn acquisition_exit_child() {
    let Some(root) = std::env::var_os("HARBOR_PREPARATION_EXIT_ROOT") else {
        return;
    };
    let root = PathBuf::from(root);
    let engine = std::env::var("HARBOR_PREPARATION_EXIT_ENGINE").unwrap();
    let phase = std::env::var("HARBOR_PREPARATION_EXIT_PHASE").unwrap();
    let direct = Transfers::load(root.join("http"), |_| {}).unwrap();
    let torrent = Torrents::new(root.join("torrent"), Arc::new(|_| {})).unwrap();
    let (bytes, _) = archive();
    let choice = if engine == "direct" {
        let server = Http::start(vec![bytes.clone()]).await;
        let record = direct
            .add_prepared(
                request(&root, &format!("{}/0", server.url), &bytes),
                Some(draft(&root)),
            )
            .unwrap();
        direct_complete(&direct, &record.id).await;
        record.preparation.unwrap()
    } else {
        let source = root.join("seed");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("Game.zip"), &bytes).unwrap();
        let metadata = librqbit::create_torrent(
            &source,
            librqbit::CreateTorrentOptions {
                piece_length: Some(32 * 1024),
                ..Default::default()
            },
        )
        .await
        .unwrap()
        .as_bytes()
        .unwrap()
        .to_vec();
        let seed = Session::new_with_opts(
            source.clone(),
            SessionOptions {
                disable_dht: true,
                disable_dht_persistence: true,
                listen_port_range: Some(47000..48000),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        seed.add_torrent(
            AddTorrent::from_bytes(metadata.clone()),
            Some(AddTorrentOptions {
                output_folder: Some(source.to_string_lossy().into()),
                overwrite: true,
                disable_trackers: true,
                ..Default::default()
            }),
        )
        .await
        .unwrap()
        .into_handle()
        .unwrap()
        .wait_until_initialized()
        .await
        .unwrap();
        let peer = format!("127.0.0.1:{}", seed.tcp_listen_port().unwrap())
            .parse()
            .unwrap();
        let plan = torrent.prepare("alice", metadata, vec![peer]).unwrap();
        let record = torrent
            .start_prepared(
                StartTorrent {
                    profile: "alice".into(),
                    token: plan.token,
                    parent: root.to_string_lossy().into(),
                    name: "Downloaded".into(),
                    game: None,
                    selected: vec![0],
                    download_bps: 0,
                    upload_bps: 32768,
                },
                Some(draft(&root)),
            )
            .await
            .unwrap();
        tokio::time::timeout(Duration::from_secs(25), async {
            loop {
                let current = torrent.preparation_record("alice", &record.id).unwrap();
                assert_ne!(current.status, Status::Failed, "{:?}", current.error);
                if current.status == Status::Complete {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await
        .unwrap();
        seed.stop().await;
        record.preparation.unwrap()
    };
    if phase != "accepted" {
        let archives = Archives::load(root.join("archives"), |_| {}).unwrap();
        let policies = policies(&root, archives, direct.clone(), torrent.clone());
        policies.adopt(choice.clone()).unwrap();
        if phase == "acknowledged" {
            match choice.target.engine {
                Engine::Direct => direct
                    .ack_preparation("alice", &choice.target.download_id, &choice.id)
                    .unwrap(),
                Engine::Torrent => torrent
                    .ack_preparation("alice", &choice.target.download_id, &choice.id)
                    .unwrap(),
            }
        }
    }
    fs::write(
        root.join("boundary.json"),
        serde_json::to_vec(&choice).unwrap(),
    )
    .unwrap();
    loop {
        std::thread::park();
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn six_real_process_exit_boundaries_recover_one_operation_without_renderer() {
    let (bytes, original) = archive();
    for engine in ["direct", "torrent"] {
        for phase in ["accepted", "adopted", "acknowledged"] {
            let root = root();
            let output = fs::File::create(root.join("child.log")).unwrap();
            let mut child = Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "p2p::preparation_tests::intake::acquisition_exit_child",
                    "--nocapture",
                ])
                .env("HARBOR_PREPARATION_EXIT_ROOT", &root)
                .env("HARBOR_PREPARATION_EXIT_ENGINE", engine)
                .env("HARBOR_PREPARATION_EXIT_PHASE", phase)
                .stdout(Stdio::from(output.try_clone().unwrap()))
                .stderr(Stdio::from(output))
                .spawn()
                .unwrap();
            let reached = tokio::time::timeout(Duration::from_secs(40), async {
                while !root.join("boundary.json").is_file() {
                    if let Some(status) = child.try_wait().unwrap() {
                        panic!(
                            "{engine}/{phase}: {status}: {}",
                            fs::read_to_string(root.join("child.log")).unwrap()
                        );
                    }
                    tokio::time::sleep(Duration::from_millis(25)).await;
                }
            })
            .await;
            child.kill().unwrap();
            child.wait().unwrap();
            reached.expect("child reached its durable boundary");
            let choice: Choice =
                serde_json::from_slice(&fs::read(root.join("boundary.json")).unwrap()).unwrap();
            if phase == "accepted" {
                assert!(!root.join("policies/choices.json").exists());
            }
            let direct = Transfers::load(root.join("http"), |_| {}).unwrap();
            let torrent = Torrents::new(root.join("torrent"), Arc::new(|_| {})).unwrap();
            let pending = direct.preparation_intents().unwrap().len()
                + torrent.preparation_intents().unwrap().len();
            assert_eq!(pending, usize::from(phase != "acknowledged"));
            let archives = Archives::load(root.join("archives"), |_| {}).unwrap();
            let manager = policies(&root, archives.clone(), direct.clone(), torrent.clone());
            manager.tick();
            let job = extracted(&archives, &choice.id).await;
            assert_eq!(
                job.status,
                ArchiveStatus::Complete,
                "{engine}/{phase}: {:?}",
                job.error
            );
            assert_eq!(
                fs::read(Path::new(&job.destination).join("Original game/data.bin")).unwrap(),
                original
            );
            let source = if engine == "direct" {
                root.join("Game.zip")
            } else {
                root.join("Downloaded/Game.zip")
            };
            assert_eq!(fs::read(source).unwrap(), bytes);
            assert!(direct.preparation_intents().unwrap().is_empty());
            assert!(torrent.preparation_intents().unwrap().is_empty());
            archives.remove("alice", &choice.id).unwrap();
            drop(manager);
            let manager = policies(&root, archives.clone(), direct, torrent);
            // A delayed replay must not resurrect a consumed operation.
            manager.adopt(choice.clone()).unwrap();
            manager.tick();
            assert_eq!(manager.list("alice").unwrap()[0].id, choice.id);
            assert!(archives.list("alice").unwrap().is_empty());
            eprintln!("PASS {engine}/{phase}: original bytes retained, one stable operation after process termination");
        }
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn intake_failures_preserve_permission_and_replay_preserves_user_changes() {
    let root = root();
    let (bytes, _) = archive();
    let server = Http::start(vec![bytes.clone()]).await;
    let direct = Transfers::load(root.join("http"), |_| {}).unwrap();
    let record = direct
        .add_prepared(
            request(&root, &format!("{}/0", server.url), &bytes),
            Some(draft(&root)),
        )
        .unwrap();
    direct_complete(&direct, &record.id).await;
    let choice = record.preparation.unwrap();
    let archives = Archives::load(root.join("archives"), |_| {}).unwrap();
    let torrent = Torrents::new(root.join("torrent"), Arc::new(|_| {})).unwrap();
    let manager = policies(&root, archives.clone(), direct.clone(), torrent);
    fs::create_dir(root.join("policies/choices.json")).unwrap();
    manager.tick();
    assert_eq!(direct.preparation_intents().unwrap()[0].id, choice.id);
    assert!(manager.list("alice").unwrap().is_empty());
    assert!(archives.list("alice").unwrap().is_empty());
    fs::remove_dir(root.join("policies/choices.json")).unwrap();
    manager.adopt(choice.clone()).unwrap();
    let replacement = manager
        .configure(Configure {
            target: choice.target.clone(),
            parent: choice.parent.clone(),
            name: "Edited destination".into(),
        })
        .unwrap();
    manager.disable("alice", &replacement.id).unwrap();
    // A failed outbox acknowledgement retains both the old intake and the
    // latest disabled choice; repeated delivery must not overwrite either.
    fs::rename(
        root.join("http/transfers.json"),
        root.join("http/transfers.held"),
    )
    .unwrap();
    fs::create_dir(root.join("http/transfers.json")).unwrap();
    manager.tick();
    assert_eq!(direct.preparation_intents().unwrap()[0].id, choice.id);
    assert_eq!(
        manager.list("alice").unwrap()[0].status,
        ChoiceStatus::Disabled
    );
    fs::remove_dir(root.join("http/transfers.json")).unwrap();
    fs::rename(
        root.join("http/transfers.held"),
        root.join("http/transfers.json"),
    )
    .unwrap();
    direct
        .ack_preparation("bob", &record.id, &choice.id)
        .unwrap();
    direct
        .ack_preparation("alice", &record.id, &replacement.id)
        .unwrap();
    assert_eq!(direct.preparation_intents().unwrap().len(), 1);
    manager.tick();
    let saved = manager.list("alice").unwrap().pop().unwrap();
    assert_eq!(saved.id, replacement.id);
    assert_eq!(saved.name, "Edited destination");
    assert_eq!(saved.status, ChoiceStatus::Disabled);
    assert!(direct.preparation_intents().unwrap().is_empty());
    assert!(archives.list("alice").unwrap().is_empty());
    assert!(!root.join("Edited destination").exists());
    assert!(!root.join("Unpacked").exists());
    let reloaded = Transfers::load(root.join("http"), |_| {}).unwrap();
    assert!(reloaded.preparation_intents().unwrap().is_empty());
}

#[tokio::test]
async fn invalid_opt_in_rejects_the_entire_acquisition_before_files_are_created() {
    let root = root();
    let (bytes, _) = archive();
    let direct = Transfers::load(root.join("http"), |_| {}).unwrap();
    for (archive, members, parent, name) in [
        ("Missing.zip", vec![], root.clone(), "Unpacked"),
        (
            "Game.zip",
            vec!["Neighbor.zip".into()],
            root.clone(),
            "Unpacked",
        ),
        (
            "Game.zip",
            vec!["Game.zip".into()],
            root.clone(),
            "Unpacked",
        ),
        ("Game.zip", vec![], root.join("missing"), "Unpacked"),
        ("Game.zip", vec![], root.clone(), "../escape"),
        ("Game.zip", vec![], root.clone(), "Game.zip"),
    ] {
        let result = direct.add_prepared(
            request(&root, "http://127.0.0.1:9/original", &bytes),
            Some(Draft {
                archive: archive.into(),
                members,
                parent: parent.to_string_lossy().into(),
                name: name.into(),
            }),
        );
        assert!(result.is_err());
        assert!(direct.list("alice").unwrap().is_empty());
        assert!(fs::read_dir(&root)
            .unwrap()
            .all(|entry| entry.unwrap().file_name() == "http"));
    }
    let source = root.join("seed");
    fs::create_dir(&source).unwrap();
    fs::write(source.join("Game.zip"), bytes).unwrap();
    fs::write(source.join("Other.zip"), b"different game").unwrap();
    let torrent = Torrents::new(root.join("torrent"), Arc::new(|_| {})).unwrap();
    let metadata = librqbit::create_torrent(&source, Default::default())
        .await
        .unwrap()
        .as_bytes()
        .unwrap()
        .to_vec();
    let plan = torrent.prepare("alice", metadata, vec![]).unwrap();
    let selected = plan
        .files
        .iter()
        .find(|file| file.path == "Other.zip")
        .unwrap()
        .index;
    let result = torrent
        .start_prepared(
            StartTorrent {
                profile: "alice".into(),
                token: plan.token.clone(),
                parent: root.to_string_lossy().into(),
                name: "Downloaded".into(),
                game: None,
                selected: vec![selected],
                download_bps: 0,
                upload_bps: 32768,
            },
            Some(draft(&root)),
        )
        .await;
    assert_eq!(result.err(), Some("archive_path"));
    let mut collision = draft(&root);
    collision.name = "Downloaded".into();
    let result = torrent.start_prepared(
        StartTorrent {
            profile: "alice".into(), token: plan.token.clone(),
            parent: root.to_string_lossy().into(), name: "Downloaded".into(),
            game: None, selected: plan.files.iter().map(|file| file.index).collect(),
            download_bps: 0, upload_bps: 32768,
        }, Some(collision),
    ).await;
    assert_eq!(result.err(), Some("archive_destination"));
    assert!(torrent.list("alice").unwrap().is_empty());
    assert!(!root.join("Downloaded").exists());
    assert!(
        torrent.plans.lock().unwrap().contains_key(&plan.token),
        "failed admission retains the review"
    );
    assert!(!fs::read_dir(root.join("torrent"))
        .unwrap()
        .any(|entry| entry
            .unwrap()
            .path()
            .extension()
            .is_some_and(|ext| ext == "torrent")));
}

#[tokio::test]
async fn acquisition_store_failure_keeps_the_opt_in_and_queue_all_or_nothing() {
    let root = root();
    let (bytes, _) = archive();
    let direct = Transfers::load(root.join("http"), |_| {}).unwrap();
    fs::rename(
        root.join("http/transfers.json"),
        root.join("http/previous.json"),
    )
    .unwrap();
    fs::create_dir(root.join("http/transfers.json")).unwrap();
    assert_eq!(
        direct
            .add_prepared(
                request(&root, "http://127.0.0.1:9/original", &bytes),
                Some(draft(&root))
            )
            .err(),
        Some("transfer_store")
    );
    assert!(direct.list("alice").unwrap().is_empty());
    assert!(fs::read_dir(&root)
        .unwrap()
        .all(|entry| entry.unwrap().file_name() == "http"));
    let source = root.join("seed");
    fs::create_dir(&source).unwrap();
    fs::write(source.join("Game.zip"), bytes).unwrap();
    let torrent = Torrents::new(root.join("torrent"), Arc::new(|_| {})).unwrap();
    let metadata = librqbit::create_torrent(&source, Default::default())
        .await
        .unwrap()
        .as_bytes()
        .unwrap()
        .to_vec();
    let plan = torrent.prepare("alice", metadata, vec![]).unwrap();
    fs::create_dir(root.join("torrent/transfers.json")).unwrap();
    let result = torrent
        .start_prepared(
            StartTorrent {
                profile: "alice".into(),
                token: plan.token.clone(),
                parent: root.to_string_lossy().into(),
                name: "Downloaded".into(),
                game: None,
                selected: vec![0],
                download_bps: 0,
                upload_bps: 32768,
            },
            Some(draft(&root)),
        )
        .await;
    assert_eq!(result.err(), Some("torrent_store"));
    assert!(torrent.list("alice").unwrap().is_empty());
    assert!(!root.join("Downloaded").exists());
    assert!(torrent.plans.lock().unwrap().contains_key(&plan.token));
    assert!(!fs::read_dir(root.join("torrent"))
        .unwrap()
        .any(|entry| entry
            .unwrap()
            .path()
            .extension()
            .is_some_and(|ext| ext == "torrent")));
}

#[tokio::test]
async fn known_unselected_archive_volumes_are_rejected_before_acquisition() {
    let root = root();
    let direct = Transfers::load(root.join("http"), |_| {}).unwrap();
    let batch: NewBatch = serde_json::from_value(
        serde_json::json!({"profile":"alice","directory":root,"files":[
            {"filename":"Game.zip.001","name":"First","url":"http://127.0.0.1:9/one"},
            {"filename":"Game.zip.002","name":"Second","url":"http://127.0.0.1:9/two"}
        ]}),
    )
    .unwrap();
    let mut choice = draft(&root);
    choice.archive = "Game.zip.001".into();
    assert_eq!(
        direct.add_batch_prepared(batch, Some(choice.clone())).err(),
        Some("archive_missing_part")
    );
    assert!(direct.list("alice").unwrap().is_empty());
    assert!(fs::read_dir(&root)
        .unwrap()
        .all(|entry| entry.unwrap().file_name() == "http"));
    let source = root.join("seed");
    fs::create_dir(&source).unwrap();
    fs::write(source.join("Game.zip.001"), b"first").unwrap();
    fs::write(source.join("Game.zip.002"), b"second").unwrap();
    let torrent = Torrents::new(root.join("torrent"), Arc::new(|_| {})).unwrap();
    let metadata = librqbit::create_torrent(&source, Default::default())
        .await
        .unwrap()
        .as_bytes()
        .unwrap()
        .to_vec();
    let plan = torrent.prepare("alice", metadata, vec![]).unwrap();
    let selected = plan
        .files
        .iter()
        .find(|file| file.path == "Game.zip.001")
        .unwrap()
        .index;
    let result = torrent
        .start_prepared(
            StartTorrent {
                profile: "alice".into(),
                token: plan.token.clone(),
                parent: root.to_string_lossy().into(),
                name: "Downloaded".into(),
                game: None,
                selected: vec![selected],
                download_bps: 0,
                upload_bps: 32768,
            },
            Some(choice),
        )
        .await;
    assert_eq!(result.err(), Some("archive_missing_part"));
    assert!(torrent.list("alice").unwrap().is_empty());
    assert!(!root.join("Downloaded").exists());
    assert!(torrent.plans.lock().unwrap().contains_key(&plan.token));
}
