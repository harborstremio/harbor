use super::{minecraft_instances::{self as instances, Result}, minecraft_launch_data::LogLines, minecraft_runtime as runtime};
use serde::{Deserialize, Serialize};
use std::{collections::{HashMap, VecDeque}, fs, path::{Path, PathBuf}, sync::{Arc, Mutex, OnceLock}, time::Duration};
use tokio::{io::{AsyncRead, AsyncReadExt}, process::Child};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub schema: u8, pub id: String, pub pid: u32, pub marker: String,
    pub started_at: u64, pub ended_at: Option<u64>, pub exit_code: Option<i32>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct State { pub running: bool, pub session: Option<Session>, pub log: Option<String> }
struct Held { session: Session, lines: VecDeque<String>, bytes: usize }
fn sessions() -> &'static Mutex<HashMap<PathBuf, Arc<Mutex<Held>>>> {
    static VALUE: OnceLock<Mutex<HashMap<PathBuf, Arc<Mutex<Held>>>>> = OnceLock::new(); VALUE.get_or_init(|| Mutex::new(HashMap::new()))
}

// PID alone is not an identity: compare the process creation time on every
// restore so a reused PID never makes an old instance appear to be running.
#[cfg(windows)]
fn marker(pid: u32) -> Result<Option<String>> {
    use std::ffi::c_void;
    #[repr(C)] #[derive(Default)] struct FileTime { low: u32, high: u32 }
    #[link(name="kernel32")] extern "system" {
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut c_void;
        fn GetProcessTimes(handle: *mut c_void, created: *mut FileTime, exited: *mut FileTime, kernel: *mut FileTime, user: *mut FileTime) -> i32;
        fn GetExitCodeProcess(handle: *mut c_void, code: *mut u32) -> i32;
        fn CloseHandle(handle: *mut c_void) -> i32;
    }
    unsafe {
        let handle = OpenProcess(0x1000, 0, pid);
        if handle.is_null() { return match std::io::Error::last_os_error().raw_os_error() { Some(87) => Ok(None), _ => Err("launch_state") }; }
        let (mut created,mut exited,mut kernel,mut user) = (FileTime::default(),FileTime::default(),FileTime::default(),FileTime::default()); let mut code=0;
        let valid = GetProcessTimes(handle,&mut created,&mut exited,&mut kernel,&mut user) != 0 && GetExitCodeProcess(handle,&mut code) != 0; CloseHandle(handle);
        if !valid { return Err("launch_state"); }
        Ok((code == 259 && exited.low == 0 && exited.high == 0).then(|| format!("{}:{}",created.high,created.low)))
    }
}
#[cfg(target_os="linux")]
fn marker(pid: u32) -> Result<Option<String>> {
    let value = match fs::read_to_string(format!("/proc/{pid}/stat")) { Ok(v)=>v, Err(e) if e.kind()==std::io::ErrorKind::NotFound=>return Ok(None), Err(_)=>return Err("launch_state") };
    let fields=value.rsplit_once(')').ok_or("launch_state")?.1.split_whitespace().collect::<Vec<_>>();
    if fields.first().is_some_and(|v| matches!(*v,"Z"|"X")) { return Ok(None); }
    Ok(Some(fields.get(19).filter(|v|v.bytes().all(|b|b.is_ascii_digit())).ok_or("launch_state")?.to_string()))
}
#[cfg(target_os="macos")]
fn marker(pid: u32) -> Result<Option<String>> {
    // proc_pidinfo returns a stable start timestamp without a shell or ps process.
    #[repr(C)] struct BsdInfo { flags:u32,status:u32,xstatus:u32,pid:u32,ppid:u32,uid:u32,gid:u32,ruid:u32,rgid:u32,svuid:u32,svgid:u32,reserved:u32,comm:[u8;16],name:[u8;32],nfiles:u32,pgid:u32,pjobc:u32,e_tdev:u32,e_tpgid:u32,nice:i32,start_sec:u64,start_usec:u64 }
    extern "C" { fn proc_pidinfo(pid:i32,flavor:i32,arg:u64,buffer:*mut std::ffi::c_void,size:i32)->i32; }
    let mut info: BsdInfo=unsafe{std::mem::zeroed()};
    let result=unsafe{proc_pidinfo(pid as i32,3,0,&mut info as *mut _ as *mut _,std::mem::size_of::<BsdInfo>() as i32)};
    if result==0 { return if matches!(std::io::Error::last_os_error().raw_os_error(),Some(3)) { Ok(None) } else { Err("launch_state") }; }
    if result!=std::mem::size_of::<BsdInfo>() as i32 { return Err("launch_state"); }
    Ok((info.status!=5).then(||format!("{}:{}",info.start_sec,info.start_usec)))
}
#[cfg(not(any(windows,target_os="linux",target_os="macos")))]
fn marker(_pid:u32)->Result<Option<String>> { Err("runtime_platform") }

fn valid(session: &Session) -> bool { session.schema==1 && instances::identifier(&session.id) && session.pid>0 && !session.marker.is_empty() && session.marker.len()<=80 && session.marker.bytes().all(|b|b.is_ascii_digit()||b==b':') }
pub fn state(folder: &Path, logs: bool) -> Result<State> {
    let folder=instances::directory(folder)?;
    if let Some(held)=sessions().lock().map_err(|_|"launch_state")?.get(&folder).cloned() {
        let held=held.lock().map_err(|_|"launch_state")?;
        return Ok(State { running:held.session.ended_at.is_none(), session:Some(held.session.clone()), log:logs.then(||held.lines.iter().cloned().collect::<Vec<_>>().join("\n")) });
    }
    let path=folder.join("session.json");
    if !path.exists() { return Ok(State {running:false,session:None,log:None}); }
    let mut session:Session=instances::read(&path).map_err(|_|"launch_state")?; if !valid(&session) { return Err("launch_state"); }
    let running=session.ended_at.is_none() && marker(session.pid)?.as_deref()==Some(&session.marker);
    if !running && session.ended_at.is_none() { session.ended_at=Some(instances::now()); session.exit_code=None; instances::write(&folder,"session.json",&session)?; }
    Ok(State {running,session:Some(session),log:None})
}
pub fn idle(folder:&Path)->Result<()> { if state(folder,false)?.running {Err("launch_running")}else{Ok(())} }

pub struct Workspace { root:PathBuf, pub path:PathBuf, pub id:String }
impl Workspace {
    pub fn new(folder:&Path)->Result<Self> {
        let root=runtime::directory(&runtime::directory(folder,".runtime")?,"launch")?;
        let id=uuid::Uuid::new_v4().to_string();let path=root.join(&id);fs::create_dir(&path).map_err(|_|"instance_write")?;
        Ok(Self{root,path,id})
    }
}
impl Drop for Workspace {
    fn drop(&mut self) {
        if self.path.parent()==Some(self.root.as_path()) && self.path.file_name().is_some_and(|v|v==self.id.as_str()) && instances::directory(&self.path).is_ok() { let _=fs::remove_dir_all(&self.path); }
    }
}
fn append(held:&Arc<Mutex<Held>>,line:String) {
    if let Ok(mut value)=held.lock() {
        value.bytes+=line.len()+1;value.lines.push_back(line);
        while value.bytes>64*1024 || value.lines.len()>600 { if let Some(line)=value.lines.pop_front(){value.bytes=value.bytes.saturating_sub(line.len()+1);}else{break;} }
    }
}
async fn read_log(mut source:impl AsyncRead+Unpin,held:Arc<Mutex<Held>>,secrets:Vec<String>) {
    let mut buffer=[0_u8;4096];let mut lines=LogLines::new(secrets);
    while let Ok(n)=source.read(&mut buffer).await {if n==0{break;}for line in lines.feed(&buffer[..n]){append(&held,line);}}
    if let Some(line)=lines.finish(){append(&held,line);}
}
pub async fn track(mut child:Child,folder:PathBuf,workspace:Workspace,secrets:Vec<String>)->Result<State> {
    let pid=child.id().ok_or("launch_start")?;
    // A failed state write must not leave an untracked game running.
    let registered=(|| {
        let marker=marker(pid)?.ok_or("launch_start")?;
        let session=Session {schema:1,id:workspace.id.clone(),pid,marker,started_at:instances::now(),ended_at:None,exit_code:None};
        let mut all=sessions().lock().map_err(|_|"launch_state")?;
        if all.len()>=32 {all.retain(|_,v|v.lock().map(|v|v.session.ended_at.is_none()).unwrap_or(true));}
        if all.len()>=32{return Err("launch_limit");}
        instances::write(&folder,"session.json",&session)?;
        let held=Arc::new(Mutex::new(Held{session:session.clone(),lines:VecDeque::new(),bytes:0}));all.insert(folder.clone(),held.clone());Ok((session,held))
    })();
    let (session,held)=match registered {Ok(v)=>v,Err(e)=>{let _=child.kill().await;let _=child.wait().await;return Err(e);}};
    let out=child.stdout.take();let err=child.stderr.take();
    tokio::spawn(async move {
        let mut readers=Vec::new();
        if let Some(out)=out {readers.push(tokio::spawn(read_log(out,held.clone(),secrets.clone())));}
        if let Some(err)=err {readers.push(tokio::spawn(read_log(err,held.clone(),secrets)));}
        let exit=child.wait().await.ok();
        for mut reader in readers {if tokio::time::timeout(Duration::from_secs(2),&mut reader).await.is_err(){reader.abort();}}
        if let Ok(mut value)=held.lock() {
            value.session.ended_at=Some(instances::now());value.session.exit_code=exit.and_then(|v|v.code());
            let _=instances::write(&folder,"session.json",&value.session);
        }
        drop(workspace);
    });
    Ok(State{running:true,session:Some(session),log:Some(String::new())})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn minecraft_launch_process_identity_is_stable() { let a=marker(std::process::id()).unwrap().unwrap();assert_eq!(Some(a),marker(std::process::id()).unwrap()); }
    #[test] fn minecraft_launch_restored_session_checks_creation_time() {
        let base=PathBuf::from(std::env::var_os("HARBOR_GAME_TEST_ROOT").expect("QA directory"));fs::create_dir_all(&base).unwrap();let root=base.join(format!("launch-session-qa-{}",uuid::Uuid::new_v4()));fs::create_dir(&root).unwrap();
        let mut saved=Session{schema:1,id:uuid::Uuid::new_v4().to_string(),pid:std::process::id(),marker:marker(std::process::id()).unwrap().unwrap(),started_at:instances::now(),ended_at:None,exit_code:None};
        instances::write(&root,"session.json",&saved).unwrap();assert!(state(&root,true).unwrap().running);assert_eq!(idle(&root).unwrap_err(),"launch_running");assert!(state(&root,true).unwrap().log.is_none());
        saved.marker="0".into();instances::write(&root,"session.json",&saved).unwrap();let restored=state(&root,false).unwrap();assert!(!restored.running);assert!(restored.session.unwrap().ended_at.is_some());
        fs::write(root.join("session.json"),b"broken receipt").unwrap();assert!(state(&root,false).is_err());let checked=root.canonicalize().unwrap();assert!(checked.starts_with(base.canonicalize().unwrap()));assert!(checked.file_name().unwrap().to_string_lossy().starts_with("launch-session-qa-"));fs::remove_dir_all(checked).unwrap();
    }
}
