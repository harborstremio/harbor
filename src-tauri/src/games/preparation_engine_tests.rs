//! Actual transfer managers, local HTTP/TCP peers, and the production resolver
//! feed the durable unpack worker. These tests never run a downloaded program.
use super::super::{
    archive_jobs::{Archives, Status as ArchiveStatus},
    download_preparation::{Configure, Engine, Preparations, Target},
    preparation_runtime,
    transfers::{NewBatch, NewTransfer, Status as DirectStatus, Transfers},
};
use super::*;
use sha2::{Digest, Sha256};
use std::{
    io::{Cursor, Write},
    sync::atomic::{AtomicBool, Ordering},
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
#[path = "preparation_intake_tests.rs"]
mod intake;

fn root() -> PathBuf {
    let root = PathBuf::from(
        std::env::var_os("HARBOR_GAME_TEST_ROOT").expect("fixture directory on a data drive"),
    )
    .join(format!("preparation-engines-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&root).unwrap();
    root.canonicalize().unwrap()
}
fn archive() -> (Vec<u8>, Vec<u8>) {
    let original: Vec<_> = (0..1024 * 1024 + 137)
        .map(|i| ((i * 37 + i / 53) % 251) as u8)
        .collect();
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    zip.start_file(
        "Original game/data.bin",
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored),
    )
    .unwrap();
    zip.write_all(&original).unwrap();
    (zip.finish().unwrap().into_inner(), original)
}
async fn extracted(archives: &Archives, id: &str) -> super::super::archive_jobs::ArchiveJob {
    tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            if let Some(job) = archives
                .list("alice")
                .unwrap()
                .into_iter()
                .find(|job| job.id == id && job.status != ArchiveStatus::Running)
            {
                return job;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .expect("extraction reached a terminal state")
}
struct Http {
    url: String,
    release: Arc<AtomicBool>,
    task: JoinHandle<()>,
}
impl Http {
    async fn start(bodies: Vec<Vec<u8>>) -> Self {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let release = Arc::new(AtomicBool::new(false));
        let gate = release.clone();
        let bodies = Arc::new(bodies);
        let task = tokio::spawn(async move {
            let mut clients = tokio::task::JoinSet::new();
            loop {
                let (mut socket, _) = listener.accept().await.unwrap();
                let gate = gate.clone();
                let bodies = bodies.clone();
                clients.spawn(async move{
                let mut request=vec![0u8;8192];let count=socket.read(&mut request).await.unwrap();let path=String::from_utf8_lossy(&request[..count]);
                let index:usize=path.split_whitespace().nth(1).unwrap().trim_start_matches('/').parse().unwrap();
                if index==1{while !gate.load(Ordering::SeqCst){tokio::time::sleep(Duration::from_millis(10)).await;}}
                let body=&bodies[index];
                // The cancellation case deliberately closes this connection.
                if socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: application/octet-stream\r\nETag: \"original\"\r\nConnection: close\r\n\r\n",body.len()).as_bytes()).await.is_err(){return;}
                let _=socket.write_all(body).await;
            });
                while clients.try_join_next().is_some() {}
            }
        });
        Self { url, release, task }
    }
}
impl Drop for Http {
    fn drop(&mut self) {
        self.task.abort();
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn canceling_a_selected_http_part_disables_automatic_unpacking() {
    let root = root();
    let (bytes, _) = archive();
    let server = Http::start(vec![bytes.clone(), bytes.clone()]).await;
    let transfers = Transfers::load(root.join("http"), |_| {}).unwrap();
    let records = transfers.add_batch(serde_json::from_value(serde_json::json!({
        "profile":"alice","directory":root,"files":[
            {"filename":"Game.zip.001","name":"First volume","url":format!("{}/0",server.url)},
            {"filename":"Game.zip.002","name":"Second volume","url":format!("{}/1",server.url)}
        ]
    })).unwrap()).unwrap();
    let archives = Archives::load(root.join("archives"), |_| {}).unwrap();
    let native = transfers.clone();
    let policies = Preparations::load(
        root.join("policies"),
        archives.clone(),
        move |target| preparation_runtime::resolve_direct(&native, target),
        |_| {},
    )
    .unwrap();
    let choice = policies
        .configure(Configure {
            target: Target {
                profile: "alice".into(),
                engine: Engine::Direct,
                download_id: records[0].id.clone(),
                archive: records[0].destination.clone(),
                members: vec![records[1].id.clone()],
            },
            parent: root.to_string_lossy().into(),
            name: "Never unpack".into(),
        })
        .unwrap();
    transfers.action("alice", &records[1].id, "cancel").unwrap();
    policies.tick();
    let saved = policies.list("alice").unwrap().pop().unwrap();
    assert_eq!(saved.id, choice.id);
    assert_eq!(
        saved.status,
        super::super::download_preparation::Status::Disabled
    );
    assert!(saved.error.is_none());
    assert!(archives.list("alice").unwrap().is_empty());
    assert!(!root.join("Never unpack").exists());
    server.release.store(true, Ordering::SeqCst);
    tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let records = transfers.list("alice").unwrap();
            if records.iter().all(|record| {
                matches!(
                    record.status,
                    DirectStatus::Complete | DirectStatus::Canceled
                )
            }) {
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .unwrap();
    policies.tick();
    assert!(archives.list("alice").unwrap().is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn actual_http_multipart_completion_dispatches_once_and_survives_reload() {
    let root = root();
    let (bytes, original) = archive();
    let parts = vec![
        bytes[..bytes.len() / 2].to_vec(),
        bytes[bytes.len() / 2..].to_vec(),
    ];
    let server = Http::start(parts.clone()).await;
    let transfers = Transfers::load(root.join("http"), |_| {}).unwrap();
    let request:NewBatch=serde_json::from_value(serde_json::json!({"profile":"alice","directory":root,"files":parts.iter().enumerate().map(|(index,part)|serde_json::json!({"filename":format!("Game.zip.{:03}",index+1),"name":"Original fixture","url":format!("{}/{}",server.url,index),"expectedBytes":part.len(),"expectedSha256":format!("{:x}",Sha256::digest(part))})).collect::<Vec<_>>()})).unwrap();
    let records = transfers.add_batch_prepared(request, Some(super::super::preparation_intake::Draft {
        archive: "Game.zip.001".into(), parent: root.to_string_lossy().into(), name: "Unpacked".into(), members: vec!["Game.zip.002".into()],
    })).unwrap();
    let target = Target {
        profile: "alice".into(),
        engine: Engine::Direct,
        download_id: records[0].id.clone(),
        archive: records[0].destination.clone(),
        members: vec![records[1].id.clone()],
    };
    let archives = Archives::load(root.join("archives"), |_| {}).unwrap();
    let direct = transfers.clone();
    let policies = Preparations::load(
        root.join("policies"),
        archives.clone(),
        move |target| preparation_runtime::resolve_direct(&direct, target),
        |_| {},
    )
    .unwrap();
    let choice = records[0].preparation.clone().unwrap();
    let intake = transfers.clone();
    policies.set_intake(move |policies| { super::super::preparation_intake::direct_pending(policies, &intake)?; Ok(false) }).unwrap();
    policies.start().unwrap();
    tokio::time::timeout(Duration::from_secs(15), async {
        while transfers
            .preparation_record("alice", &records[0].id)
            .unwrap()
            .status
            != DirectStatus::Complete
        {
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .unwrap();
    policies.tick();
    assert!(
        archives.list("alice").unwrap().is_empty(),
        "the second selected volume has not completed"
    );
    assert!(
        !preparation_runtime::resolve_direct(&transfers, &target)
            .unwrap()
            .ready
    );
    server.release.store(true, Ordering::SeqCst);
    let job = extracted(&archives, &choice.id).await;
    policies.stop();
    assert_eq!(job.status, ArchiveStatus::Complete, "{:?}", job.error);
    assert_eq!(
        fs::read(Path::new(&job.destination).join("Original game/data.bin")).unwrap(),
        original
    );
    assert_eq!(fs::read(&records[0].destination).unwrap(), parts[0]);
    assert_eq!(fs::read(&records[1].destination).unwrap(), parts[1]);
    let completed = Transfers::load(root.join("http"), |_| {}).unwrap();
    assert!(completed.preparation_intents().unwrap().is_empty());
    assert!(
        preparation_runtime::resolve_direct(&completed, &target)
            .unwrap()
            .ready
    );
    archives.remove("alice", &job.id).unwrap();
    drop(policies);
    let policies = Preparations::load(
        root.join("policies"),
        archives.clone(),
        move |target| preparation_runtime::resolve_direct(&completed, target),
        |_| {},
    )
    .unwrap();
    policies.tick();
    assert!(archives.list("alice").unwrap().is_empty());
    assert!(Path::new(&job.destination).is_dir());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn direct_members_are_explicit_profile_bound_and_archive_bound() {
    let root = root();
    let (bytes, _) = archive();
    let server = Http::start(vec![bytes.clone(), bytes.clone()]).await;
    let transfers = Transfers::load(root.join("http"), |_| {}).unwrap();
    let add = |profile: &str, name: &str| {
        serde_json::from_value::<NewTransfer>(serde_json::json!({"profile":profile,"name":name,"url":format!("{}/0",server.url),"destination":root.join(name),"expectedBytes":bytes.len()})).unwrap()
    };
    let first = transfers.add(add("alice", "Game.zip.001")).unwrap();
    let neighbor = transfers.add(add("alice", "Game.zip.002")).unwrap();
    let other = transfers.add(add("alice", "Other.zip.001")).unwrap();
    let foreign = transfers.add(add("bob", "Game.zip.003")).unwrap();
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let all = transfers.list("alice").unwrap();
            if all
                .iter()
                .all(|record| record.status == DirectStatus::Complete)
                && transfers
                    .preparation_record("bob", &foreign.id)
                    .unwrap()
                    .status
                    == DirectStatus::Complete
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .unwrap();
    let mut target = Target {
        profile: "alice".into(),
        engine: Engine::Direct,
        download_id: first.id.clone(),
        archive: first.destination.clone(),
        members: vec![],
    };
    assert_eq!(
        preparation_runtime::resolve_direct(&transfers, &target)
            .unwrap()
            .allowed_parts,
        vec![first.destination]
    );
    target.members = vec![neighbor.id];
    assert_eq!(
        preparation_runtime::resolve_direct(&transfers, &target)
            .unwrap()
            .allowed_parts
            .len(),
        2
    );
    target.members = vec![other.id];
    assert_eq!(
        preparation_runtime::resolve_direct(&transfers, &target).err(),
        Some("archive_parts")
    );
    target.members = vec![foreign.id];
    assert_eq!(
        preparation_runtime::resolve_direct(&transfers, &target).err(),
        Some("transfer_missing")
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn actual_torrent_selection_dispatches_after_verified_tcp_download() {
    let root = root();
    let source = root.join("seed");
    fs::create_dir(&source).unwrap();
    let (bytes, original) = archive();
    fs::write(source.join("Game.zip"), &bytes).unwrap();
    fs::write(source.join("Other.zip"), b"not selected").unwrap();
    let torrent = librqbit::create_torrent(
        &source,
        librqbit::CreateTorrentOptions {
            piece_length: Some(32 * 1024),
            ..Default::default()
        },
    )
    .await
    .unwrap();
    let metadata = torrent.as_bytes().unwrap().to_vec();
    let seed = Session::new_with_opts(
        source.clone(),
        SessionOptions {
            disable_dht: true,
            disable_dht_persistence: true,
            listen_port_range: Some(46000..47000),
            ..Default::default()
        },
    )
    .await
    .unwrap();
    let handle = seed
        .add_torrent(
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
        .unwrap();
    handle.wait_until_initialized().await.unwrap();
    let manager = Torrents::new(root.join("torrent"), Arc::new(|_| {})).unwrap();
    let peer: SocketAddr = format!("127.0.0.1:{}", seed.tcp_listen_port().unwrap())
        .parse()
        .unwrap();
    let plan = manager.prepare("alice", metadata, vec![peer]).unwrap();
    let record = manager
        .start_prepared(StartTorrent {
            profile: "alice".into(),
            token: plan.token,
            parent: root.to_string_lossy().into(),
            name: "Downloaded".into(),
            game: None,
            selected: vec![
                plan.files
                    .iter()
                    .find(|file| file.path == "Game.zip")
                    .unwrap()
                    .index,
            ],
            download_bps: 512 * 1024,
            upload_bps: 128 * 1024,
        }, Some(super::super::preparation_intake::Draft {
            archive: "Game.zip".into(), parent: root.to_string_lossy().into(), name: "Unpacked".into(), members: vec![],
        }))
        .await
        .unwrap();
    let target = Target {
        profile: "alice".into(),
        engine: Engine::Torrent,
        download_id: record.id.clone(),
        archive: "Game.zip".into(),
        members: vec![],
    };
    assert_eq!(manager.preparation_files(&record).unwrap().len(), 1);
    let archives = Archives::load(root.join("archives"), |_| {}).unwrap();
    let native = manager.clone();
    let policies = Preparations::load(
        root.join("policies"),
        archives.clone(),
        move |target| preparation_runtime::resolve_torrent(&native, target),
        |_| {},
    )
    .unwrap();
    let choice = record.preparation.clone().unwrap();
    let intake = manager.clone();
    policies.set_intake(move |policies| { super::super::preparation_intake::torrent_pending(policies, &intake)?; Ok(false) }).unwrap();
    policies.start().unwrap();
    let job = extracted(&archives, &choice.id).await;
    policies.stop();
    assert_eq!(
        manager
            .preparation_record("alice", &record.id)
            .unwrap()
            .status,
        Status::Complete
    );
    assert_eq!(job.status, ArchiveStatus::Complete, "{:?}", job.error);
    assert_eq!(
        fs::read(Path::new(&job.destination).join("Original game/data.bin")).unwrap(),
        original
    );
    assert_eq!(
        fs::read(Path::new(&record.destination).join("Game.zip")).unwrap(),
        bytes
    );
    let mut unselected = target.clone();
    unselected.archive = "Other.zip".into();
    assert_eq!(
        preparation_runtime::resolve_torrent(&manager, &unselected).err(),
        Some("archive_path")
    );
    let reloaded = Torrents::new(root.join("torrent"), Arc::new(|_| {})).unwrap();
    assert!(reloaded.preparation_intents().unwrap().is_empty());
    assert!(
        preparation_runtime::resolve_torrent(&reloaded, &target)
            .unwrap()
            .ready
    );
    seed.stop().await;
}
