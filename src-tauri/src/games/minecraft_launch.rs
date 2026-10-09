use super::{minecraft_account, minecraft_instances::{self as instances,Result}, minecraft_java, minecraft_java_data, minecraft_launch_data as data, minecraft_launch_process as process, minecraft_pack, minecraft_runtime as runtime};
use serde::Serialize;
use std::{io::Write, path::{Path,PathBuf}, process::Stdio};

#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
pub struct Progress {pub profile:String,pub operation_id:String,pub phase:&'static str,pub checked:usize,pub total:usize}
pub fn state(profile:&str,path:&str,id:&str,logs:bool)->Result<process::State> {
    let root=instances::library(profile,path)?;let(folder,_)=instances::load(&root,profile,id)?;process::state(&folder,logs)
}
pub fn command(java:&minecraft_java_data::Java,arguments:&data::Arguments,game:&Path,workspace:&process::Workspace)->Result<tokio::process::Command> {
    let mut command=tokio::process::Command::new(&java.path);
    // Relative classpaths normally fit a direct command. Older Windows Java
    // launchers cannot open @files below long/Unicode paths, even though the
    // JVM itself correctly supports those paths. Prefer direct arguments.
    let size=arguments.jvm.iter().chain(&arguments.game).map(|v|v.encode_utf16().count()*2+3).sum::<usize>()+java.path.encode_utf16().count()*2;
    if size<=28000 {command.args(&arguments.jvm);}else{
        let path=workspace.path.join("jvm.args");let text=path.to_str().ok_or("launch_arguments")?;
        if java.major<9 || (cfg!(windows)&&(!text.is_ascii()||text.len()>240)) || arguments.game.iter().map(|v|v.encode_utf16().count()*2+3).sum::<usize>()>24000 {return Err("launch_arguments");}
        let body=data::argument_file(&arguments.jvm)?;let mut file=instances::create_file(&workspace.path,"jvm.args")?;
        file.write_all(body.as_bytes()).and_then(|_|file.sync_all()).map_err(|_|"instance_write")?;
        command.arg(format!("@../.runtime/launch/{}/jvm.args",workspace.id));
    }
    command.args(&arguments.game).current_dir(game).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(false);
    for key in ["JAVA_TOOL_OPTIONS","_JAVA_OPTIONS","JDK_JAVA_OPTIONS","CLASSPATH"]{command.env_remove(key);}
    #[cfg(windows)] command.creation_flags(0x08000000);
    Ok(command)
}
pub async fn launch(accounts:PathBuf,profile:String,path:String,id:String,operation:String,progress:impl Fn(Progress)+Send+Sync+'static)->Result<process::State> {
    let work=runtime::start(&profile,&operation)?;let cancel=work.cancellation();
    let root=instances::library(&profile,&path)?;let(folder,instance)=instances::load(&root,&profile,&id)?;process::idle(&folder)?;
    let emit=|phase,checked,total|progress(Progress{profile:profile.clone(),operation_id:operation.clone(),phase,checked,total});
    // Validate account prerequisites before expensive file verification. The
    // actual license/profile and launch credential are refreshed just before spawn.
    let account=minecraft_account::status(&accounts,&profile)?;
    if !account.configured{return Err("minecraft_app_config");}if account.account.is_none(){return Err("minecraft_reconnect");}
    if !runtime::state(&profile,&path,&id)?.installed{return Err("launch_files");}
    emit("metadata",0,0);let target=runtime::directory(&folder,".runtime")?;
    let resolved=runtime::resolve_installed(&instance,&target,&cancel).await?;
    let files=resolved.files.clone();let held=target.clone();let check_cancel=cancel.clone();
    let report_profile=profile.clone();let report_operation=operation.clone();let progress=std::sync::Arc::new(progress);let report=progress.clone();
    tauri::async_runtime::spawn_blocking(move|| {
        let total=files.len();let mut last=std::time::Instant::now()-std::time::Duration::from_secs(1);
        for (i,file) in files.iter().enumerate(){if !runtime::verified(&held,file,&check_cancel)?{return Err("launch_files");}
            if last.elapsed()>=std::time::Duration::from_millis(120)||i+1==total{last=std::time::Instant::now();report(Progress{profile:report_profile.clone(),operation_id:report_operation.clone(),phase:"files",checked:i+1,total});}
        }Ok(())
    }).await.map_err(|_|"instance_read")??;
    let emit=|phase|progress(Progress{profile:profile.clone(),operation_id:operation.clone(),phase,checked:0,total:0});
    emit("java");let config=minecraft_java::state(&profile,&path,&id)?.configured.ok_or("java_invalid")?;
    let java=minecraft_java::probe(Path::new(&config.java.path),config.java.managed,&cancel).await?;minecraft_java_data::compatible(&java,resolved.java)?;
    emit("natives");let workspace=process::Workspace::new(&folder)?;let natives=runtime::directory(&workspace.path,"natives")?;
    let held=resolved.clone();let check_cancel=cancel.clone();
    tauri::async_runtime::spawn_blocking(move||data::native_libraries(&held,&target,&natives,&check_cancel)).await.map_err(|_|"launch_natives")??;
    emit("account");let account=runtime::cancellable(&cancel,minecraft_account::credentials(&accounts,&profile)).await??;
    let game=instances::directory(&folder.join("game"))?;let arguments=data::arguments(&resolved,&game,&workspace.id,config.memory_mib,&account)?;
    let mut command=command(&java,&arguments,&game,&workspace)?;
    emit("starting");minecraft_pack::canceled(&cancel)?;process::idle(&folder)?;
    let child=command.spawn().map_err(|_|"launch_start")?;
    process::track(child,folder,workspace,vec![account.access,account.xuid]).await
}
