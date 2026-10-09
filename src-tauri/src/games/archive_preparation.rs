//! A single durable, cancelable check-to-extraction operation. Acquisition
//! policy supplies a stable job id; repeat handoffs cannot start a second copy.
use super::*;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareArchive {
    pub id: String,
    pub profile: String,
    pub source: String,
    pub parent: String,
    pub name: String,
    pub origin_source: Option<String>,
    pub game: Option<DownloadGame>,
    pub expected_sha256: Option<String>,
    pub allowed_parts: Option<Vec<String>>,
    pub expected_parts: Option<Vec<archives::ArchivePart>>,
}

impl Archives {
    pub fn prepare(self: &Arc<Self>, request: PrepareArchive) -> Result<ArchiveJob> {
        let PrepareArchive { id,profile,source,parent,name,origin_source,game,expected_sha256,allowed_parts,expected_parts }=request;
        if !valid(&profile,160) || uuid::Uuid::parse_str(&id).is_err() { return Err("archive_profile"); }
        if !valid(&source,8192) || !PathBuf::from(&source).is_absolute() { return Err("archive_path"); }
        if expected_sha256.as_ref().is_some_and(|value| value.len()!=64 || !value.bytes().all(|c| c.is_ascii_hexdigit())) { return Err("archive_changed"); }
        let expected_sha256=expected_sha256.map(|value|value.to_ascii_lowercase());
        if expected_parts.as_ref().is_some_and(|parts|!valid_expected_parts(parts)){return Err("archive_changed");}
        let expected_parts=expected_parts.map(|mut parts|{for part in &mut parts{part.sha256.make_ascii_lowercase();}parts.sort_by(|a,b|a.name.cmp(&b.name));parts});
        let allowed_parts=allowed_parts.map(|parts|->Result<Vec<String>>{
            if parts.is_empty()||parts.len()>1024{return Err("archive_limit");}
            let mut paths=Vec::new();for part in parts{
                if part.len()>8192||!PathBuf::from(&part).is_absolute(){return Err("archive_path");}
                paths.push(PathBuf::from(part).canonicalize().map_err(|_|"archive_read")?.to_string_lossy().into_owned());
            }paths.sort();paths.dedup();Ok(paths)
        }).transpose()?;
        let origin=origin_source.unwrap_or_else(||source.clone());
        if !valid(&origin,8192) || !PathBuf::from(&origin).is_absolute() { return Err("archive_path"); }
        let parent=archives::plain_dir(std::path::Path::new(&parent))?.to_string_lossy().into_owned();
        // Return the accepted job even after its destination has been published.
        // A repeated id with changed parameters is never a second authorization.
        {
            let held=self.jobs.lock().map_err(|_|"archive_store")?;
            if let Some(job)=held.iter().find(|job|job.id==id) {
                if job.profile!=profile || job.source!=source || job.origin_source!=origin || job.name!=name ||
                    PathBuf::from(&job.destination).parent()!=Some(std::path::Path::new(&parent)) || job.expected_sha256!=expected_sha256 || job.allowed_parts!=allowed_parts || job.expected_parts!=expected_parts {
                    return Err("archive_changed");
                }
                return Ok(job.clone());
            }
        }
        let destination=archives::planned_destination(&parent,&name)?;
        let parent=destination.parent().ok_or("archive_destination")?.to_string_lossy().into_owned();
        let work=archives::start(&profile,&id)?;
        let stamp=now();
        let job=ArchiveJob { id:id.clone(),profile,source,origin_source:origin,name:name.clone(),game:download_metadata::sanitize(game),
            destination:destination.to_string_lossy().into_owned(),stage:None,status:Status::Running,progress:None,receipt:None,error:None,
            started_at:stamp,updated_at:stamp,expected_sha256,allowed_parts,expected_parts };
        {
            let mut held=self.jobs.lock().map_err(|_|"archive_store")?;
            // Another thread may have accepted this id before engine admission.
            if held.iter().any(|job|job.id==id) { return Err("archive_busy"); }
            if held.len()>=MAX_JOBS { return Err("archive_history"); }
            let mut next=held.clone();next.insert(0,job.clone());self.persist(&next)?;*held=next;
        }
        self.launch(job,work,None,parent,name)
    }

    pub(super) fn launch(self: &Arc<Self>,job:ArchiveJob,work:archives::Work,token:Option<String>,parent:String,name:String)->Result<ArchiveJob> {
        (self.emit)(job.clone());
        let manager=self.clone();let thread_job=job.clone();
        let started=std::thread::Builder::new().name("harbor-extract".into()).spawn(move|| {
            let id=thread_job.id.clone();let profile=thread_job.profile.clone();
            let persisted=Mutex::new(Instant::now());let fault=std::sync::atomic::AtomicBool::new(false);
            let progress=|progress| {
                let durable=persisted.lock().map(|mut time|{if time.elapsed()>=Duration::from_secs(1){*time=Instant::now();true}else{false}}).unwrap_or(true);
                if manager.update(&id,durable,|job|job.progress=Some(progress)).is_err(){
                    fault.store(true,std::sync::atomic::Ordering::Relaxed);archives::cancel(profile.clone(),id.clone());
                }
            };
            let mut inspected_token=None;
            let result=(|| {
                let token=match token {
                    Some(token)=>token,
                    None=>{
                        let plan=archives::inspect_reserved(&work,thread_job.source.clone(),None,false,thread_job.allowed_parts.as_deref(),&progress)?;
                        inspected_token=Some(plan.token.clone());
                        if let Some(expected)=thread_job.expected_parts.as_ref(){
                            if plan.parts.len()!=expected.len()||expected.iter().any(|wanted|!plan.parts.iter().any(|part|
                                (part.name==wanted.name||cfg!(windows)&&part.name.eq_ignore_ascii_case(&wanted.name))&&part.bytes==wanted.bytes&&part.sha256==wanted.sha256)){
                                return Err("archive_changed");
                            }
                        }
                        if let Some(expected)=thread_job.expected_sha256.as_ref(){
                            // A selected multipart volume need not be the first
                            // volume normalized into plan.source.
                            let selected=std::path::Path::new(&thread_job.source).file_name().and_then(|name|name.to_str()).ok_or("archive_changed")?;
                            let actual=plan.parts.iter().find(|part|part.name==selected || cfg!(windows)&&part.name.eq_ignore_ascii_case(selected)).map(|part|part.sha256.as_str()).ok_or("archive_changed")?;
                            if expected!=actual{return Err("archive_changed");}
                        }
                        // Recheck the final multipart receipt budget before file creation.
                        let mut proposed=manager.jobs.lock().map_err(|_|"archive_store")?.clone();
                        let item=proposed.iter_mut().find(|job|job.id==id).ok_or("archive_expired")?;
                        item.receipt=Some(ArchiveReceipt{destination:item.destination.clone(),source:plan.source.clone(),sha256:plan.sha256.clone(),files:plan.file_count,bytes:plan.expanded_bytes,parts:plan.parts.clone()});
                        if serde_json::to_vec(&Store{version:1,jobs:proposed}).map_err(|_|"archive_store")?.len().saturating_add(32*1024)>MAX_STORE{return Err("archive_history");}
                        plan.token
                    }
                };
                archives::extract_reserved(work,profile.clone(),token,parent,name,&progress,super::super::transfer_storage::shared(),|boundary|manager.update(&id,true,|job|match boundary{
                    ExtractionBoundary::Staging(path)=>job.stage=Some(path.to_string_lossy().into()),
                    ExtractionBoundary::Publishing=>{if let Some(progress)=job.progress.as_mut(){progress.phase="publishing".into();}}
                }))
            })();
            if let Some(token)=inspected_token{archives::discard(profile.clone(),token);}
            let result=if fault.load(std::sync::atomic::Ordering::Relaxed){Err("archive_store")}else{result};
            let finished=manager.update(&id,true,|job|match result{
                Ok(receipt)=>{job.status=Status::Complete;job.receipt=Some(receipt);job.stage=None;job.error=None;},
                Err(error)=>{job.status=if error=="archive_canceled"{Status::Canceled}else{Status::Failed};job.error=Some(error.into());
                    if job.stage.as_ref().is_some_and(|path|!PathBuf::from(path).is_dir()){job.stage=None;}}
            });
            if finished.is_err(){let _=manager.update(&id,false,|job|{job.status=Status::Failed;job.error=Some("archive_store".into());});}
        });
        if started.is_err(){self.update(&job.id,true,|job|{job.status=Status::Failed;job.error=Some("archive_start".into());})?;return Err("archive_start");}
        Ok(job)
    }
}

#[cfg(test)]
#[path = "archive_preparation_tests.rs"]
mod tests;
