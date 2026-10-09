use super::{minecraft_instances as instances, minecraft_launch_data as data, minecraft_launch_process as process, minecraft_runtime_data::Runtime};
use std::{fs, io::Write, path::PathBuf, process::Stdio, sync::atomic::AtomicBool, time::Duration};

fn account() -> data::Credentials { data::Credentials{name:"HarborTest".into(),uuid:"123456781234123412341234567890ab".into(),access:"native-only-test-token".into(),client:"12345678-1234-1234-1234-1234567890ab".into(),xuid:"1234567890123456".into()} }
fn runtime()->Runtime {Runtime{schema:1,game:"1.21.1".into(),loader:"vanilla".into(),loader_version:String::new(),java:17,version:"1.21.1".into(),version_type:"snapshot".into(),main:"HarborLaunchFixture".into(),asset_index:"17".into(),jvm:vec!["-cp".into(),"${classpath}".into(),"-Dfixture=space and \"quotes\"".into()],args:vec!["${auth_player_name}".into(),"${auth_access_token}".into(),"${version_type}".into(),"${game_directory}".into()],classpath:vec!["fixture".into()],natives:vec![],files:vec![],platform:super::minecraft_runtime_data::platform()}}
struct Fixture {base:PathBuf,root:PathBuf}
impl Fixture {
    fn new()->Self {let base=PathBuf::from(std::env::var_os("HARBOR_GAME_TEST_ROOT").expect("Set HARBOR_GAME_TEST_ROOT to a disposable QA directory"));fs::create_dir_all(&base).unwrap();let root=base.join(format!("launch-qa-{} space-世界",uuid::Uuid::new_v4()));fs::create_dir(&root).unwrap();Self{base,root}}
}
impl Drop for Fixture {fn drop(&mut self){let root=self.root.canonicalize().unwrap();assert!(root.starts_with(self.base.canonicalize().unwrap()));assert!(root.file_name().unwrap().to_string_lossy().starts_with("launch-qa-"));fs::remove_dir_all(root).unwrap();}}

#[test]
fn minecraft_launch_arguments_separate_tokens_and_fail_on_unknown_placeholders() {
    let fixture=Fixture::new();let account=account();let mut runtime=runtime();let id=uuid::Uuid::new_v4().to_string();
    let args=data::arguments(&runtime,&fixture.root,&id,4096,&account).unwrap();let body=data::argument_file(&args.jvm).unwrap();
    assert!(!body.contains(&account.access));assert!(!body.contains(&account.xuid));assert!(body.contains("-Xmx4096M"));assert_eq!(args.game[1],account.access);assert_eq!(args.game[2],"snapshot");assert_eq!(args.game[3],".");
    runtime.args.push("${unknown}".into());assert!(data::arguments(&runtime,&fixture.root,&id,4096,&account).is_err());runtime.args.pop();
    runtime.jvm.push("-Dtoken=${auth_access_token}".into());assert!(data::arguments(&runtime,&fixture.root,&id,4096,&account).is_err());runtime.jvm.pop();
    runtime.classpath.push("../../outside.jar".into());assert!(data::arguments(&runtime,&fixture.root,&id,4096,&account).is_err());
    assert!(data::argument_file(&["line\nbreak".into()]).is_err());assert!(data::argument_file(&["non-ascii-世界".into()]).is_err());
}
#[test]
fn minecraft_launch_logs_redact_split_tokens_and_discard_oversized_lines() {
    let mut logs=data::LogLines::new(vec!["secret-token".into()]);
    assert!(logs.feed(b"hello secret-").is_empty());assert_eq!(logs.feed(b"token\r\n\x1bfinished\n"),["hello [redacted]","finished"]);
    let huge=vec![b'x';70*1024];assert!(logs.feed(&huge).is_empty());assert!(logs.feed(b"secret-token\n").is_empty());
    assert!(logs.feed(b"tail secret-token").is_empty());assert_eq!(logs.finish(),Some("tail [redacted]".into()));
}
#[test]
fn minecraft_launch_native_extraction_rejects_escape_and_preserves_game_files() {
    let fixture=Fixture::new();let output=fixture.root.join("out");fs::create_dir(&output).unwrap();let mut runtime=runtime();runtime.natives=vec!["native.jar".into()];
    let zip=|path:&str| {let mut writer=zip::ZipWriter::new(fs::File::create(fixture.root.join("native.jar")).unwrap());writer.start_file(path,zip::write::SimpleFileOptions::default()).unwrap();writer.write_all(b"native fixture").unwrap();writer.finish().unwrap();};
    zip("../../outside.dll");assert!(data::native_libraries(&runtime,&fixture.root,&output,&AtomicBool::new(false)).is_err());assert!(fs::read_dir(&output).unwrap().next().is_none());
    zip("fixture.dll");assert!(data::native_libraries(&runtime,&fixture.root,&output,&AtomicBool::new(true)).is_err());assert!(fs::read_dir(&output).unwrap().next().is_none());
    data::native_libraries(&runtime,&fixture.root,&output,&AtomicBool::new(false)).unwrap();assert_eq!(fs::read(output.join("fixture.dll")).unwrap(),b"native fixture");
}
#[tokio::test]
#[ignore="Explicit opt-in: compiles/runs a small local Java fixture; no Minecraft authentication or gameplay"]
async fn minecraft_launch_actual_java_process_and_failure_log() {
    let fixture=Fixture::new();let profile="launch-process-qa";let path=fixture.root.to_str().unwrap();let instance=instances::create(profile,path,"Launch fixture","1.21.1").unwrap();
    let root=instances::library(profile,path).unwrap();let(folder,_)=instances::load(&root,profile,&instance.id).unwrap();let game=folder.join("game");fs::write(game.join("world-marker.txt"),b"keep world").unwrap();
    let java=PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_JAVA_PROBE").expect("Set Java executable"));let compiler=java.with_file_name(if cfg!(windows){"javac.exe"}else{"javac"});
    let dir=folder.join(".runtime/fixture");fs::create_dir_all(&dir).unwrap();let source=dir.join("HarborLaunchFixture.java");
    fs::write(&source,r#"public class HarborLaunchFixture { public static void main(String[] args) throws Exception {
      if (!System.getProperty("fixture").equals("space and \"quotes\"")) System.exit(31);
      if (args.length != 4 || !args[0].equals("HarborTest") || !args[2].equals("snapshot") || !new java.io.File(args[3],"world-marker.txt").isFile()) System.exit(32);
      System.out.print("TOKEN "+args[1].substring(0,8));System.out.flush();Thread.sleep(200);
      System.out.println(args[1].substring(8));System.err.println("Fixture diagnostic");Thread.sleep(600);System.exit(7);
    } }"#).unwrap();
    let mut compile=tokio::process::Command::new(compiler);compile.arg("HarborLaunchFixture.java").current_dir(&dir).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::piped());#[cfg(windows)] compile.creation_flags(0x08000000);
    let compiled=compile.output().await.unwrap();assert!(compiled.status.success(),"Fixture compilation {}: {}",compiled.status,String::from_utf8_lossy(&compiled.stderr));
    let workspace=process::Workspace::new(&folder).unwrap();let workspace_path=workspace.path.clone();let account=account();let args=data::arguments(&runtime(),&game,&workspace.id,1024,&account).unwrap();
    let body=data::argument_file(&args.jvm).unwrap();assert!(!body.contains(&account.access));fs::write(workspace.path.join("jvm.args"),body).unwrap();
    let java=super::minecraft_java_data::Java{path:java.to_string_lossy().into_owned(),major:17,version:"17".into(),vendor:"QA".into(),arch:"amd64".into(),managed:false};
    let mut command=super::minecraft_launch::command(&java,&args,&game,&workspace).unwrap();assert!(!command.as_std().get_args().any(|v|v.to_string_lossy().starts_with('@')));
    let child=command.spawn().unwrap();let state=process::track(child,folder.clone(),workspace,vec![account.access.clone()]).await.unwrap();assert!(state.running);assert_eq!(process::idle(&folder).unwrap_err(),"launch_running");
    let state=tokio::time::timeout(Duration::from_secs(20),async {loop{let state=process::state(&folder,true).unwrap();if !state.running{break state;}tokio::time::sleep(Duration::from_millis(50)).await;}}).await.unwrap();
    let log=state.log.unwrap();assert_eq!(state.session.unwrap().exit_code,Some(7),"fixture log: {log}");assert!(log.contains("TOKEN [redacted]"),"fixture log: {log}");assert!(log.contains("Fixture diagnostic"));assert!(!log.contains(&account.access));assert!(!workspace_path.exists());assert!(process::idle(&folder).is_ok());assert_eq!(fs::read(game.join("world-marker.txt")).unwrap(),b"keep world");
    let receipt=fs::read_to_string(folder.join("session.json")).unwrap();assert!(!receipt.contains(&account.access));assert!(super::minecraft_launch::state("other-profile",path,&instance.id,false).is_err());
}
