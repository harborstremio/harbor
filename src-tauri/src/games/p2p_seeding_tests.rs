use super::*;

#[tokio::test(flavor="multi_thread",worker_threads=4)]
async fn cleanup_review_tracks_actual_seed_start_and_explicit_stop(){
    use super::super::super::archive_cleanup::Blocker;
    let (_,manager,row,_,payload)=completed().await;
    let extraction=uuid::Uuid::new_v4().to_string();
    assert!(manager.cleanup_usage("one",&extraction).unwrap().is_empty());
    let cleanup_lease=super::super::super::game_file_use::cleanup(&[Path::new(&row.destination).join("game.bin")]).unwrap();
    assert_eq!(manager.seed("one".into(),row.id.clone(),policy()).await.unwrap_err(),"torrent_busy");
    assert!(manager.list("one").unwrap()[0].sharing.is_none());drop(cleanup_lease);
    manager.seed("one".into(),row.id.clone(),policy()).await.unwrap();
    let usage=manager.cleanup_usage("one",&extraction).unwrap();assert_eq!(usage.len(),1);assert_eq!(usage[0].reason,Blocker::Sharing);
    assert_eq!(manager.cleanup_usage("another profile",&extraction).unwrap()[0].reason,Blocker::AnotherProfile);
    manager.action("one".into(),row.id.clone(),"pause".into()).await.unwrap();
    assert!(manager.cleanup_usage("one",&extraction).unwrap().is_empty());
    assert_eq!(fs::read(Path::new(&row.destination).join("game.bin")).unwrap(),payload);
}

fn root() -> PathBuf {
    let base = std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
    let path = base.join(format!("harbor-seeding-{}", uuid::Uuid::new_v4())); fs::create_dir_all(&path).unwrap(); path
}
fn policy() -> SeedPolicy { SeedPolicy { ratio_milli: 1000, seconds: 60, upload_bps: 64*1024 } }
async fn completed() -> (PathBuf, Arc<Torrents>, TorrentRecord, Vec<u8>, Vec<u8>) {
    let payload: Vec<u8> = (0..256*1024+97).map(|i| ((i*31+i/13)%251) as u8).collect();
    let (root,manager,row,meta)=completed_files(&[("game.bin", &payload)], "game.bin").await;
    (root,manager,row,meta,payload)
}
async fn completed_files(entries: &[(&str, &[u8])], selected_name: &str) -> (PathBuf, Arc<Torrents>, TorrentRecord, Vec<u8>) {
    let root = root(); let source = root.join("original"); fs::create_dir(&source).unwrap();
    for (name,bytes) in entries { fs::write(source.join(name), bytes).unwrap(); }
    let meta = librqbit::create_torrent(&source, librqbit::CreateTorrentOptions { piece_length: Some(32*1024), ..Default::default() }).await.unwrap().as_bytes().unwrap().to_vec();
    let manager = Torrents::new(root.join("state"), Arc::new(|_|{})).unwrap();
    let held = manager.slots.clone().acquire_many_owned(2).await.unwrap();
    let plan = manager.prepare("one", meta.clone(), vec![]).unwrap();
    let selected=plan.files.iter().find(|file| file.path==selected_name).unwrap().index;
    let row = manager.start(StartTorrent { profile: "one".into(), token: plan.token, parent: root.to_string_lossy().into_owned(), name: "download".into(), game: None, selected: vec![selected], download_bps: 0, upload_bps: 64*1024 }).await.unwrap();
    manager.action("one".into(), row.id.clone(), "pause".into()).await.unwrap(); drop(held);
    for (name,bytes) in entries { fs::write(Path::new(&row.destination).join(name), bytes).unwrap(); }
    manager.update(&row.id, true, |r| { r.status=Status::Complete; r.received=r.total_bytes; r.completed_at=Some(now()); }).unwrap();
    let row = manager.list("one").unwrap().remove(0);
    (root, manager, row, meta)
}
async fn settled(manager: &Torrents) -> TorrentRecord {
    tokio::time::timeout(Duration::from_secs(25), async { loop {
        let row = manager.list("one").unwrap().remove(0);
        if row.sharing.as_ref().is_some_and(|seed| !seed.active()) { break row; }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }}).await.unwrap()
}

#[test]
fn seed_limits_validate_and_stop_at_the_first_bound_without_overflow() {
    let mut value = policy(); value.validate().unwrap();
    assert!(!value.reached(1024, 1023, 59)); assert!(value.reached(1024, 1024, 0)); assert!(value.reached(1024, 0, 60));
    assert!(!value.reached(u64::MAX, 1024, 0));
    for bad in [0,999,10001,u32::MAX] { value.ratio_milli=bad; assert!(value.validate().is_err()); }
    value=policy(); value.seconds=0; assert!(value.validate().is_err()); value.seconds=86401; assert!(value.validate().is_err());
    value=policy(); value.upload_bps=32767; assert!(value.validate().is_err());
}

#[tokio::test(flavor="multi_thread", worker_threads=4)]
async fn real_peer_receives_exact_verified_bytes_then_ratio_stops_and_completion_date_stays() {
    let (root, manager, row, meta, payload) = completed().await;
    let completion = row.completed_at;
    manager.seed("one".into(), row.id.clone(), policy()).await.unwrap();
    let port = tokio::time::timeout(Duration::from_secs(20), async { loop {
        if let Some(port) = manager.seed_ports.lock().unwrap().get(&row.id).copied() { break port; }
        let state = manager.list("one").unwrap().remove(0); assert_ne!(state.sharing.unwrap().status, SeedStatus::Failed);
        tokio::time::sleep(Duration::from_millis(50)).await;
    }}).await.unwrap();
    assert_eq!(manager.slots.available_permits(), 2, "seeding cannot hold download slots");
    let destination = root.join("peer"); fs::create_dir(&destination).unwrap();
    let upload_started = Instant::now();
    let peer = Session::new_with_opts(destination.clone(), SessionOptions { disable_dht:true, disable_dht_persistence:true, ..Default::default() }).await.unwrap();
    let handle = peer.add_torrent(AddTorrent::from_bytes(meta), Some(AddTorrentOptions { output_folder:Some(destination.to_string_lossy().into_owned()), initial_peers:Some(vec![format!("127.0.0.1:{port}").parse().unwrap()]), disable_trackers:true, ..Default::default() })).await.unwrap().into_handle().unwrap();
    tokio::time::timeout(Duration::from_secs(25), async { loop { if handle.stats().finished { break; } tokio::time::sleep(Duration::from_millis(100)).await; }}).await.unwrap();
    let finished = settled(&manager).await;
    assert_eq!(finished.status, Status::Complete); assert_eq!(finished.completed_at, completion);
    let sharing=finished.sharing.unwrap(); assert_eq!(sharing.status, SeedStatus::LimitReached); assert!(sharing.uploaded_bytes>=payload.len() as u64);
    assert!(sharing.uploaded_bytes <= (upload_started.elapsed().as_secs_f64()*policy().upload_bps as f64) as u64 + policy().upload_bps as u64 + CHUNK_BYTES as u64, "the seeding upload cap remains effective");
    assert_eq!(fs::read(destination.join("game.bin")).unwrap(), payload); assert_eq!(fs::read(Path::new(&row.destination).join("game.bin")).unwrap(), payload);
    assert!(manager.action("one".into(), row.id.clone(), "resume".into()).await.is_err());
    manager.action("one".into(), row.id, "remove".into()).await.unwrap(); assert!(Path::new(&row.destination).join("game.bin").exists());
    peer.stop().await;
}

#[tokio::test(flavor="multi_thread", worker_threads=4)]
async fn time_stop_pause_resume_and_restart_preserve_consent_and_counters() {
    let (root, manager, row, _, payload)=completed().await;
    let mut limits=policy(); limits.seconds=2;
    manager.seed("one".into(),row.id.clone(),limits).await.unwrap();
    let stopped=settled(&manager).await; assert_eq!(stopped.sharing.unwrap().status,SeedStatus::LimitReached);
    manager.seed("one".into(),row.id.clone(),policy()).await.unwrap();
    tokio::time::sleep(Duration::from_millis(1100)).await;
    manager.action("one".into(),row.id.clone(),"pause".into()).await.unwrap();
    assert_eq!(manager.list("one").unwrap()[0].sharing.as_ref().unwrap().status,SeedStatus::Stopped);
    manager.action("one".into(),row.id.clone(),"resume".into()).await.unwrap();
    manager.action("one".into(),row.id.clone(),"pause".into()).await.unwrap();
    // Persist an interrupted active checkpoint; opening Harbor never resumes sharing.
    manager.update_seed(&row.id,true,|r|r.sharing.as_mut().unwrap().status=SeedStatus::Seeding).unwrap();
    let reloaded=Torrents::new(root.join("state"),Arc::new(|_|{})).unwrap();
    assert!(reloaded.jobs.lock().unwrap().is_empty());
    assert_eq!(reloaded.list("one").unwrap()[0].sharing.as_ref().unwrap().status,SeedStatus::Stopped);
    assert_eq!(fs::read(Path::new(&row.destination).join("game.bin")).unwrap(),payload);
}

#[tokio::test(flavor="multi_thread", worker_threads=4)]
async fn wrong_profile_failed_persistence_and_changed_files_never_start_sharing_or_repair_bytes() {
    let (root, manager, row, _, mut payload)=completed().await;
    assert!(manager.seed("other".into(),row.id.clone(),policy()).await.is_err());
    let stored=root.join("state/transfers.json"); let preserved=root.join("state/saved.json"); fs::rename(&stored,&preserved).unwrap(); fs::create_dir(&stored).unwrap();
    assert!(manager.seed("one".into(),row.id.clone(),policy()).await.is_err());
    assert!(manager.list("one").unwrap()[0].sharing.is_none()); assert!(manager.jobs.lock().unwrap().is_empty());
    fs::remove_dir(&stored).unwrap(); fs::rename(&preserved,&stored).unwrap();
    payload[31]^=42; let path=Path::new(&row.destination).join("game.bin"); fs::write(&path,&payload).unwrap();
    manager.seed("one".into(),row.id.clone(),policy()).await.unwrap();
    let stopped=settled(&manager).await; let sharing=stopped.sharing.unwrap();
    assert_eq!(sharing.status,SeedStatus::Failed); assert_eq!(sharing.error.as_deref(),Some("torrent_seed_files")); assert_eq!(sharing.uploaded_bytes,0);
    assert_eq!(fs::read(&path).unwrap(),payload); assert!(manager.seed_ports.lock().unwrap().is_empty());
    fs::remove_file(&path).unwrap(); manager.seed("one".into(),row.id,policy()).await.unwrap();
    assert_eq!(settled(&manager).await.sharing.unwrap().status,SeedStatus::Failed); assert!(!path.exists());
}

#[tokio::test]
async fn legacy_second_timestamps_migrate_once_and_completion_remains_independent() {
    let (root,manager,mut row,_,_)=completed().await;
    row.created_at=1_700_000_000;row.updated_at=1_700_000_100;row.completed_at=None;
    manager.persist(&[row.clone()]).unwrap();
    let migrated=Torrents::new(root.join("state"),Arc::new(|_|{})).unwrap();
    let result=migrated.list("one").unwrap().remove(0);
    assert_eq!(result.created_at,1_700_000_000_000);assert_eq!(result.updated_at,1_700_000_100_000);assert_eq!(result.completed_at,Some(1_700_000_100_000));
    migrated.persist(&[result]).unwrap();
    let again=Torrents::new(root.join("state"),Arc::new(|_|{})).unwrap();
    assert_eq!(again.list("one").unwrap()[0].completed_at,Some(1_700_000_100_000));
    assert!(now()>1_000_000_000_000);
}

#[tokio::test(flavor="multi_thread", worker_threads=4)]
async fn selected_file_shares_boundary_pieces_but_never_advertises_unselected_pieces() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let first=vec![13;96*1024+37]; let middle=vec![29;37*1024+5]; let last=vec![71;70*1024];
    let entries=[("a.bin",first.as_slice()),("b.bin",middle.as_slice()),("c.bin",last.as_slice())];
    let (root,manager,row,meta)=completed_files(&entries,"b.bin").await;
    let (metadata,items,_)=files::metadata(&meta).unwrap();
    let mut offset=0; let mut wanted=Vec::new();
    for item in &items {
        if row.selected.contains(&item.index) {
            wanted.extend(offset/metadata.info.piece_length as u64..(offset+item.bytes).div_ceil(metadata.info.piece_length as u64));
        }
        offset+=item.bytes;
    }
    assert!(wanted[0]>0, "fixture must have unselected pieces before the boundary");
    let mut limits=policy(); limits.ratio_milli=10000;
    manager.seed("one".into(),row.id.clone(),limits).await.unwrap();
    let port=tokio::time::timeout(Duration::from_secs(20),async { loop {
        if let Some(port)=manager.seed_ports.lock().unwrap().get(&row.id).copied() { break port; }
        assert_ne!(manager.list("one").unwrap()[0].sharing.as_ref().unwrap().status,SeedStatus::Failed);
        tokio::time::sleep(Duration::from_millis(50)).await;
    }}).await.unwrap();
    // Observe the actual wire bitfield, not an internal selection flag.
    let bitfield=tokio::time::timeout(Duration::from_secs(10),async {
        let mut socket=tokio::net::TcpStream::connect((std::net::Ipv4Addr::LOCALHOST,port)).await.unwrap();
        let mut handshake=b"\x13BitTorrent protocol\0\0\0\0\0\0\0\0".to_vec();
        for pair in row.info_hash.as_bytes().chunks_exact(2) { handshake.push(u8::from_str_radix(std::str::from_utf8(pair).unwrap(),16).unwrap()); }
        handshake.extend_from_slice(b"-HBTEST-123456789012");
        socket.write_all(&handshake).await.unwrap();
        let mut reply=[0;68]; socket.read_exact(&mut reply).await.unwrap();
        loop {
            let length=socket.read_u32().await.unwrap(); if length==0 { continue; }
            assert!(length<1024*1024); let mut body=vec![0;length as usize]; socket.read_exact(&mut body).await.unwrap();
            if body[0]==5 { break body[1..].to_vec(); }
        }
    }).await.unwrap();
    for piece in 0..offset.div_ceil(metadata.info.piece_length as u64) {
        assert_eq!(bitfield[piece as usize/8] & (0x80>>(piece%8)) != 0,wanted.contains(&piece),"advertised piece {piece}");
    }
    let destination=root.join("selected-peer");fs::create_dir(&destination).unwrap();
    let peer=Session::new_with_opts(destination.clone(),SessionOptions {disable_dht:true,disable_dht_persistence:true,..Default::default()}).await.unwrap();
    let handle=peer.add_torrent(AddTorrent::from_bytes(meta),Some(AddTorrentOptions {output_folder:Some(destination.to_string_lossy().into_owned()),only_files:Some(row.selected.clone()),initial_peers:Some(vec![format!("127.0.0.1:{port}").parse().unwrap()]),disable_trackers:true,..Default::default()})).await.unwrap().into_handle().unwrap();
    tokio::time::timeout(Duration::from_secs(25),async {loop {if handle.stats().finished {break;} tokio::time::sleep(Duration::from_millis(50)).await;}}).await.unwrap();
    assert_eq!(fs::read(destination.join("b.bin")).unwrap(),middle);
    manager.action("one".into(),row.id.clone(),"pause".into()).await.unwrap();
    let uploaded=manager.list("one").unwrap()[0].sharing.as_ref().unwrap().uploaded_bytes;
    assert!(uploaded>0);
    manager.action("one".into(),row.id.clone(),"resume".into()).await.unwrap();
    manager.action("one".into(),row.id.clone(),"pause".into()).await.unwrap();
    assert!(manager.list("one").unwrap()[0].sharing.as_ref().unwrap().uploaded_bytes>=uploaded);
    for (name,bytes) in entries { assert_eq!(fs::read(Path::new(&row.destination).join(name)).unwrap(),bytes); }
    peer.stop().await;
}
