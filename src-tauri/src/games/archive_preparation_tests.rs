use super::*;
use sha2::{Digest,Sha256};
use std::{io::Write,path::Path,sync::atomic::{AtomicBool,Ordering}};

struct Fixture { root:PathBuf, source:PathBuf, payload:Vec<u8> }
impl Fixture {
    fn new()->Self{
        let base=std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
        let root=base.join(format!("archive-preparation-{}",uuid::Uuid::new_v4()));fs::create_dir_all(&root).unwrap();
        let root=root.canonicalize().unwrap();let source=root.join("Original 雨.zip");
        let payload:Vec<u8>=(0..262144).map(|i|((i*31+i/11)%251)as u8).collect();
        let mut zip=zip::ZipWriter::new(File::create(&source).unwrap());
        zip.start_file("Game 雨/data.bin",zip::write::SimpleFileOptions::default()).unwrap();zip.write_all(&payload).unwrap();zip.finish().unwrap();
        Self{root,source,payload}
    }
    fn request(&self)->PrepareArchive{
        PrepareArchive{id:uuid::Uuid::new_v4().to_string(),profile:"prepare".into(),source:self.source.to_string_lossy().into(),parent:self.root.to_string_lossy().into(),name:"Unpacked".into(),origin_source:Some(self.source.to_string_lossy().into()),game:None,expected_sha256:Some(hash(&self.source)),allowed_parts:None,expected_parts:None}
    }
    fn manager(&self)->Arc<Archives>{Archives::load(self.root.join("state"),|_|{}).unwrap()}
}
fn hash(path:&Path)->String{format!("{:x}",Sha256::digest(fs::read(path).unwrap()))}
fn settled(manager:&Archives,id:&str)->ArchiveJob{
    let start=Instant::now();loop{
        let job=manager.list("prepare").unwrap().into_iter().find(|job|job.id==id).unwrap();
        if job.status!=Status::Running{return job;}assert!(start.elapsed()<Duration::from_secs(30));std::thread::sleep(Duration::from_millis(10));
    }
}

#[test]
fn one_durable_job_checks_extracts_and_deduplicates_before_and_after_restart(){
    let fixture=Fixture::new();let manager=fixture.manager();let request=fixture.request();
    let original=hash(&fixture.source);
    let first=manager.prepare(request.clone()).unwrap();let duplicate=manager.prepare(request.clone()).unwrap();assert_eq!(first.id,duplicate.id);
    let done=settled(&manager,&first.id);assert_eq!(done.status,Status::Complete);assert!(done.receipt.is_some());
    assert_eq!(fs::read(Path::new(&done.destination).join("Game 雨/data.bin")).unwrap(),fixture.payload);assert_eq!(hash(&fixture.source),original);
    assert_eq!(manager.prepare(request.clone()).unwrap().id,first.id);assert_eq!(manager.list("prepare").unwrap().len(),1);
    let reloaded=fixture.manager();assert_eq!(reloaded.prepare(request.clone()).unwrap().status,Status::Complete);
    let mut foreign=request.clone();foreign.profile="other".into();assert!(reloaded.prepare(foreign).is_err());
    let mut changed=request;changed.name="Different".into();assert!(reloaded.prepare(changed).is_err());
}

#[test]
fn automatic_inspection_preserves_an_open_manual_review(){
    let fixture=Fixture::new();let manager=fixture.manager();
    let reviewed=archives::inspect("prepare".into(),fixture.source.to_string_lossy().into(),uuid::Uuid::new_v4().to_string(),None,|_|{}).unwrap();
    let job=manager.prepare(fixture.request()).unwrap();assert_eq!(settled(&manager,&job.id).status,Status::Complete);
    assert!(archives::extraction_destination("prepare",&reviewed.token,&fixture.root.to_string_lossy(),"Manual copy").is_ok());
    archives::discard("prepare".into(),reviewed.token);
}

#[test]
fn changed_download_digest_fails_without_output_or_source_mutation(){
    let fixture=Fixture::new();let manager=fixture.manager();let mut request=fixture.request();let before=hash(&fixture.source);
    request.expected_sha256=Some("0".repeat(64));let job=manager.prepare(request).unwrap();let failed=settled(&manager,&job.id);
    assert_eq!(failed.status,Status::Failed);assert_eq!(failed.error.as_deref(),Some("archive_changed"));assert!(!Path::new(&failed.destination).exists());assert_eq!(hash(&fixture.source),before);
}

#[test]
fn cancellation_before_inspection_is_owned_by_the_native_job(){
    let fixture=Fixture::new();let request=fixture.request();let canceled=Arc::new(AtomicBool::new(false));let observed=canceled.clone();
    let manager=Archives::load(fixture.root.join("state"),move|job|{
        if job.status==Status::Running&&!observed.swap(true,Ordering::SeqCst){archives::cancel(job.profile,job.id);}
    }).unwrap();let before=hash(&fixture.source);let job=manager.prepare(request).unwrap();
    assert_eq!(settled(&manager,&job.id).status,Status::Canceled);assert!(!Path::new(&job.destination).exists());assert_eq!(hash(&fixture.source),before);
}

#[test]
fn destination_race_never_replaces_existing_files(){
    let fixture=Fixture::new();let installed=Arc::new(AtomicBool::new(false));let raced=installed.clone();
    let manager=Archives::load(fixture.root.join("state"),move|job|{
        if job.status==Status::Running&&!raced.swap(true,Ordering::SeqCst){fs::create_dir(&job.destination).unwrap();fs::write(Path::new(&job.destination).join("keep.txt"),b"existing user file").unwrap();}
    }).unwrap();let job=manager.prepare(fixture.request()).unwrap();let failed=settled(&manager,&job.id);
    assert_eq!(failed.status,Status::Failed);assert_eq!(failed.error.as_deref(),Some("archive_exists"));assert_eq!(fs::read(Path::new(&job.destination).join("keep.txt")).unwrap(),b"existing user file");
}

#[test]
fn store_failure_releases_engine_without_accepting_or_extracting(){
    let fixture=Fixture::new();let manager=fixture.manager();fs::create_dir(fixture.root.join("state/jobs.json")).unwrap();
    let request=fixture.request();assert!(manager.prepare(request.clone()).is_err());assert!(manager.list("prepare").unwrap().is_empty());assert!(!fixture.root.join("Unpacked").exists());
    fs::remove_dir(fixture.root.join("state/jobs.json")).unwrap();let job=manager.prepare(request).unwrap();assert_eq!(settled(&manager,&job.id).status,Status::Complete);
}

#[test]
fn selected_multipart_volume_digest_is_checked_against_that_volume(){
    let fixture=Fixture::new();let manager=fixture.manager();let bytes=fs::read(&fixture.source).unwrap();
    for (index,chunk) in bytes.chunks((bytes.len()/3).max(1)).enumerate(){fs::write(fixture.root.join(format!("package.zip.{:03}",index+1)),chunk).unwrap();}
    let selected=fixture.root.join("package.zip.002");let mut request=fixture.request();request.source=selected.to_string_lossy().into();request.origin_source=Some(request.source.clone());request.expected_sha256=Some(hash(&selected));
    let original=hash(&selected);let job=manager.prepare(request).unwrap();let done=settled(&manager,&job.id);
    assert_eq!(done.status,Status::Complete,"{:?}",done.error);assert!(done.receipt.unwrap().parts.len()>=3);
    assert_eq!(fs::read(Path::new(&done.destination).join("Game 雨/data.bin")).unwrap(),fixture.payload);assert_eq!(hash(&selected),original);
}

#[test]
fn changed_later_volume_is_rejected_even_when_the_selected_part_and_zip_remain_valid(){
    let fixture=Fixture::new();let manager=fixture.manager();
    let mut zip=zip::ZipWriter::new(File::create(&fixture.source).unwrap());zip.set_comment("original comment");
    zip.start_file("data.bin",zip::write::SimpleFileOptions::default()).unwrap();zip.write_all(&fixture.payload).unwrap();zip.finish().unwrap();
    let bytes=fs::read(&fixture.source).unwrap();let first=fixture.root.join("parts.zip.001");let second=fixture.root.join("parts.zip.002");
    fs::write(&first,&bytes[..bytes.len()/2]).unwrap();fs::write(&second,&bytes[bytes.len()/2..]).unwrap();
    let expected:Vec<_>=[&first,&second].into_iter().map(|path|archives::ArchivePart{name:path.file_name().unwrap().to_string_lossy().into(),bytes:fs::metadata(path).unwrap().len(),sha256:hash(path)}).collect();
    let mut changed=fs::read(&second).unwrap();*changed.last_mut().unwrap()=b'!';fs::write(&second,&changed).unwrap();
    let mut still_valid=bytes.clone();*still_valid.last_mut().unwrap()=b'!';assert!(zip::ZipArchive::new(std::io::Cursor::new(still_valid)).is_ok());
    let mut request=fixture.request();request.source=first.to_string_lossy().into();request.expected_sha256=Some(hash(&first));request.expected_parts=Some(expected);request.allowed_parts=Some(vec![first.to_string_lossy().into(),second.to_string_lossy().into()]);
    let job=manager.prepare(request).unwrap();let failed=settled(&manager,&job.id);
    assert_eq!(failed.status,Status::Failed);assert_eq!(failed.error.as_deref(),Some("archive_changed"));assert!(!Path::new(&failed.destination).exists());assert_eq!(fs::read(&second).unwrap(),changed);
}
