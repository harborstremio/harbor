use super::{minecraft_forge_data::{self as forge, Setup}, minecraft_instances::{self as instances,Result}, minecraft_java_data::Java, minecraft_pack, minecraft_runtime as runtime, minecraft_runtime_data::{self as data,File}, save_files};
use serde::{Deserialize,Serialize};
use sha1::{Digest,Sha1};
use std::{collections::HashSet,fs,io::{Read,Write},path::{Path,PathBuf},process::Stdio,sync::{Arc,atomic::AtomicBool},time::Duration};
use tokio::io::AsyncReadExt;

#[derive(Clone,Serialize,Deserialize)]
pub struct Receipt {pub installer:String,pub game:String,pub loader:String,pub version:String,pub files:Vec<File>}
struct Stage{root:PathBuf,path:PathBuf,name:String}
impl Stage{
    fn new(root:&Path)->Result<Self>{let root=instances::directory(root)?;let name=format!(".forge-stage-{}",uuid::Uuid::new_v4());let path=root.join(&name);fs::create_dir(&path).map_err(|_|"instance_write")?;Ok(Self{root,path,name})}
}
impl Drop for Stage{fn drop(&mut self){if self.path.parent()==Some(self.root.as_path())&&self.path.file_name().is_some_and(|v|v==self.name.as_str())&&instances::directory(&self.path).is_ok(){let _=fs::remove_dir_all(&self.path);}}}

fn hash(root:&Path,path:&str,cancel:&AtomicBool)->Result<(String,u64)>{
    let mut file=instances::plain_file(&root.join(instances::relative(path)?),data::MAX_FILE)?;let mut hash=Sha1::new();let mut total=0_u64;let mut buffer=[0_u8;64*1024];
    loop{minecraft_pack::canceled(cancel)?;let read=file.read(&mut buffer).map_err(|_|"instance_read")?;if read==0{break;}total+=read as u64;if total>data::MAX_FILE{return Err("runtime_limit");}hash.update(&buffer[..read]);}
    if total==0{return Err("instance_integrity");}Ok((format!("{:x}",hash.finalize()),total))
}
fn copy_verified(source:&Path,target:&Path,file:&File,cancel:&AtomicBool)->Result<()>{
    if !runtime::verified(source,file,cancel)?{return Err("instance_integrity");}
    let input=instances::plain_file(&source.join(instances::relative(&file.path)?),data::MAX_FILE)?;let mut output=instances::create_file(target,&file.path)?;
    instances::copy_file(input,&mut output,file.size)?;drop(output);if !runtime::verified(target,file,cancel)?{return Err("instance_integrity");}Ok(())
}
fn main_class(root:&Path,path:&str)->Result<String>{
    let mut archive=zip::ZipArchive::new(instances::plain_file(&root.join(instances::relative(path)?),data::MAX_FILE)?).map_err(|_|"runtime_metadata")?;
    let file=archive.by_name("META-INF/MANIFEST.MF").map_err(|_|"runtime_metadata")?;
    if file.size()>64*1024{return Err("runtime_metadata");}let mut text=String::new();file.take(64*1024+1).read_to_string(&mut text).map_err(|_|"runtime_metadata")?;
    let text=text.replace("\r\n ","").replace("\n ","");
    let values=text.lines().filter_map(|line|line.strip_prefix("Main-Class: ")).map(str::trim).collect::<Vec<_>>();
    if values.len()!=1 || values[0].len()>256 || !values[0].bytes().all(|v|v.is_ascii_alphanumeric()||b"._$".contains(&v)){return Err("runtime_metadata");}Ok(values[0].into())
}
async fn drain(mut stream:impl tokio::io::AsyncRead+Unpin)->Result<Vec<u8>>{
    let mut buffer=[0_u8;8192];let mut total=0_usize;let mut tail=Vec::new();
    loop{let size=stream.read(&mut buffer).await.map_err(|_|"runtime_processor")?;if size==0{return Ok(tail);}total+=size;if total>16*1024*1024{return Err("runtime_limit");}tail.extend_from_slice(&buffer[..size]);if tail.len()>8192{tail.drain(..tail.len()-8192);}}
}
async fn execute(root:&Path,java:&Java,setup:&Setup,processor:&forge::Processor,cancel:&AtomicBool)->Result<()>{
    minecraft_pack::canceled(cancel)?;
    let main=main_class(root,&processor.jar)?;
    // Relative paths keep Windows' extended/Unicode working directory out of
    // Java's argument parser while every file stays in the owned stage.
    let classpath=std::env::join_paths(processor.classpath.iter().map(|path|instances::relative(path)).collect::<Result<Vec<_>>>()?).map_err(|_|"runtime_metadata")?;
    let args=processor.args.iter().map(|v|forge::expand(v,&setup.inputs,Path::new("."))).collect::<Result<Vec<_>>>()?;
    for output in &processor.outputs {
        let path=instances::relative(&output.path)?;let mut parent=instances::directory(root)?;
        for component in path.parent().ok_or("runtime_metadata")?.components(){parent=runtime::directory(&parent,component.as_os_str().to_str().ok_or("runtime_metadata")?)?;}
    }
    let mut command=tokio::process::Command::new(&java.path);
    command.args(["-Xmx2G","-Djava.awt.headless=true","-cp"]).arg(classpath).arg(main).args(args).current_dir(root).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true);
    for key in["JAVA_TOOL_OPTIONS","_JAVA_OPTIONS","JDK_JAVA_OPTIONS","CLASSPATH"]{command.env_remove(key);}
    #[cfg(windows)]command.creation_flags(0x08000000);
    let mut child=command.spawn().map_err(|_|"runtime_processor")?;
    let stdout=child.stdout.take().ok_or("runtime_processor")?;let stderr=child.stderr.take().ok_or("runtime_processor")?;
    let run=async{let(_out,_err,status)=tokio::try_join!(drain(stdout),drain(stderr),async{child.wait().await.map_err(|_|"runtime_processor")})?;if status.success(){Ok(())}else{
        #[cfg(test)] eprintln!("Processor {} exited {status}: {} {}",processor.jar,String::from_utf8_lossy(&_out),String::from_utf8_lossy(&_err));
        Err("runtime_processor")}};
    let result=runtime::cancellable(cancel,tokio::time::timeout(Duration::from_secs(600),run)).await;
    match result {Ok(Ok(Ok(())))=>(),other=>{let _=child.kill().await;let _=child.wait().await;return match other{Err(error)=>Err(error),Ok(Err(_))=>Err("runtime_processor_timeout"),Ok(Ok(Err(error)))=>Err(error),_=>Err("runtime_processor")};}}
    for output in &processor.outputs{let(sha1,_)=hash(root,&output.path,cancel)?;if output.sha1.as_ref().is_some_and(|v|v!=&sha1){return Err("instance_integrity");}}
    Ok(())
}
fn publish(source:&Path,target:&Path,file:&File,cancel:&AtomicBool)->Result<()>{
    let path=instances::relative(&file.path)?;let mut parent=instances::directory(target)?;
    for component in path.parent().ok_or("runtime_metadata")?.components(){parent=runtime::directory(&parent,component.as_os_str().to_str().ok_or("runtime_metadata")?)?;}
    let destination=parent.join(path.file_name().ok_or("runtime_metadata")?);
    if let Ok(meta)=fs::symlink_metadata(&destination){if !meta.is_file()||save_files::reparse(&meta){return Err("instance_folder");}}
    let name=format!(".forge-output-{}",uuid::Uuid::new_v4());let partial=parent.join(&name);
    let result=(||{let mut output=instances::create_file(&parent,&name)?;let input=instances::plain_file(&source.join(&path),data::MAX_FILE)?;instances::copy_file(input,&mut output,file.size)?;drop(output);
        let copied=File{path:name.clone(),..file.clone()};if !runtime::verified(&parent,&copied,cancel)?{return Err("instance_integrity");}
        minecraft_pack::canceled(cancel)?;fs::rename(&partial,&destination).map_err(|_|"instance_write")})();
    if result.is_err(){let _=fs::remove_file(partial);}result
}
pub fn matching(receipt:&Receipt,setup:&Setup,game:&str,kind:&str,version:&str)->Result<()>{
    if receipt.installer!=setup.installer.sha1||receipt.game!=game||receipt.loader!=kind||receipt.version!=version||receipt.files.len()!=setup.outputs.len(){return Err("runtime_processor");}
    let mut known=HashSet::new();
    for file in &receipt.files{let expected=setup.outputs.iter().find(|v|v.path==file.path).ok_or("runtime_processor")?;
        if !known.insert(&file.path)||!data::digest(&file.sha1)||file.size==0||file.size>data::MAX_FILE||file.url!=setup.installer.url||expected.sha1.as_ref().is_some_and(|v|v!=&file.sha1){return Err("runtime_processor");}}
    Ok(())
}
pub fn recorded(root:&Path,runtime:&data::Runtime)->Result<()> {
    let receipt=instances::read::<Receipt>(&root.join("forge-receipt.json"))?;
    let installer_path=format!("forge-installers/{}-{}-{}.jar",runtime.loader,runtime.game,runtime.loader_version);
    let installer=runtime.files.iter().find(|file|file.path==installer_path).ok_or("runtime_processor")?;
    if receipt.installer!=installer.sha1||receipt.game!=runtime.game||receipt.loader!=runtime.loader||receipt.version!=runtime.loader_version||receipt.files.is_empty()||receipt.files.len()>2048{return Err("runtime_processor");}
    if receipt.files.len()!=runtime.files.iter().filter(|file|file.path.starts_with("libraries/")&&file.url==installer.url).count(){return Err("runtime_processor");}
    let mut seen=HashSet::new();
    for file in &receipt.files {
        if !file.path.starts_with("libraries/")||!seen.insert(file.path.to_ascii_lowercase())||file.url!=installer.url||!data::digest(&file.sha1)
            || !runtime.files.iter().any(|known|known.path==file.path&&known.sha1==file.sha1&&known.size==file.size&&known.url==file.url){return Err("runtime_processor");}
        let held=instances::plain_file(&root.join(instances::relative(&file.path)?),data::MAX_FILE)?;
        if held.metadata().map_err(|_|"instance_read")?.len()!=file.size{return Err("runtime_processor");}
    }
    Ok(())
}
fn cached(root:&Path,setup:&Setup,game:&str,kind:&str,version:&str,cancel:&AtomicBool)->Result<Option<Receipt>> {
    let Ok(receipt)=instances::read::<Receipt>(&root.join("forge-receipt.json")) else{return Ok(None)};
    if matching(&receipt,setup,game,kind,version).is_err(){return Ok(None);}
    for file in &receipt.files{if !runtime::verified(root,file,cancel)?{return Ok(None);}}
    Ok(Some(receipt))
}
pub async fn install(root:&Path,stage_root:&Path,java:&Java,setup:&Setup,inputs:&[File],game:&str,kind:&str,version:&str,cancel:Arc<AtomicBool>,progress:impl Fn(usize,usize))->Result<Receipt>{
    let root=instances::directory(root)?;let stage=Stage::new(stage_root)?;
    let source=root.clone();let target=stage.path.clone();let files=inputs.to_vec();let check_cancel=cancel.clone();
    tokio::task::spawn_blocking(move||{for file in files{copy_verified(&source,&target,&file,&check_cancel)?;}Ok::<_,&'static str>(())}).await.map_err(|_|"instance_write")??;
    let cached_root=root.clone();let cached_setup=setup.clone();let cached_game=game.to_owned();let cached_kind=kind.to_owned();let cached_version=version.to_owned();let check_cancel=cancel.clone();
    let prior=tokio::task::spawn_blocking(move||cached(&cached_root,&cached_setup,&cached_game,&cached_kind,&cached_version,&check_cancel)).await.map_err(|_|"instance_read")??;
    if let Some(receipt)=prior{progress(setup.processors.len(),setup.processors.len());return Ok(receipt);}
    let installer=fs::read(stage.path.join(instances::relative(&setup.installer.path)?)).map_err(|_|"instance_read")?;
    for file in &setup.embedded{let bytes=forge::embedded_bytes(&installer,file)?;let mut out=instances::create_file(&stage.path,&file.path)?;out.write_all(&bytes).and_then(|_|out.sync_all()).map_err(|_|"instance_write")?;}
    for(index,processor)in setup.processors.iter().enumerate(){progress(index,setup.processors.len());execute(&stage.path,java,setup,processor,&cancel).await?;progress(index+1,setup.processors.len());}
    let mut receipt=Receipt{installer:setup.installer.sha1.clone(),game:game.into(),loader:kind.into(),version:version.into(),files:vec![]};
    for output in &setup.outputs{let(sha1,size)=hash(&stage.path,&output.path,&cancel)?;if output.sha1.as_ref().is_some_and(|v|v!=&sha1){return Err("instance_integrity");}
        receipt.files.push(File{path:output.path.clone(),url:setup.installer.url.clone(),sha1,size});}
    matching(&receipt,setup,game,kind,version)?;
    for file in &receipt.files{publish(&stage.path,&root,file,&cancel)?;}
    instances::write(&root,"forge-receipt.json",&receipt)?;Ok(receipt)
}
