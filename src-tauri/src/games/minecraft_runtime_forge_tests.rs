use super::*;
use std::io::Write;
use super::super::{minecraft_forge_data as forge_data, minecraft_forge_process as process, minecraft_forge_profile, minecraft_java};

fn id() -> String { uuid::Uuid::new_v4().to_string() }
fn fixture_instance() -> instances::Instance {
    instances::Instance { schema:1, id:id(), owner:instances::owner("requirement-qa").unwrap(), name:"Requirement QA".into(), game_version:"1.20.1".into(), loader:"forge".into(), loader_version:"47.4.23".into(), created_at:0, pack:None, files:0, bytes:0 }
}
#[test]
fn minecraft_forge_requirement_is_bound_to_instance_profile_version_and_platform() {
    let instance=fixture_instance();
    let required=Requirement {schema:1,owner:instance.owner.clone(),instance:instance.id.clone(),game:instance.game_version.clone(),loader:instance.loader.clone(),loader_version:instance.loader_version.clone(),java:17,platform:data::platform()};
    assert!(required.matches(&instance));
    for key in ["schema","owner","instance","game","loader","loaderVersion","java","platform"] {
        let mut changed=serde_json::to_value(&required).unwrap();
        // Requirement is an internal snake_case record.
        let key=if key=="loaderVersion" {"loader_version"} else {key};
        changed[key]=if key=="schema" || key=="java" {serde_json::json!(99)} else {serde_json::json!("different")};
        let changed:Requirement=serde_json::from_value(changed).unwrap();assert!(!changed.matches(&instance),"{key}");
    }
}

#[tokio::test]
#[ignore = "Runs official Forge and NeoForge Java processors in isolated fixtures; no account or Minecraft launch"]
async fn minecraft_forge_runtime_install_java_receipt_repair_and_launch_integration() {
    let fixtures=PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_FORGE_FIXTURES").expect("official fixture root"));
    let destination=fixtures.join(format!("runtime-integration-{}",id()));fs::create_dir(&destination).unwrap();
    let profile="forge-runtime-integration";let path=destination.to_str().unwrap();
    for (kind,game,version,java) in [
        ("forge","1.20.1","47.4.23","D:/android/jdk17/bin/java.exe"),
        ("neoforge","1.21.1","21.1.252","W:/AI-Workspace-Codex/minecraft-forge-review/java21/jdk-21.0.12.1+1-jre/bin/java.exe"),
    ] {
        let instance=instances::create_configured(profile,path,kind,game,kind,version,&AtomicBool::new(false)).unwrap();
        let library=instances::library(profile,path).unwrap();let(folder,instance)=instances::load(&library,profile,&instance.id).unwrap();
        fs::write(folder.join("game/world-marker.txt"),b"preserve world").unwrap();
        let record:Value=serde_json::from_slice(&fs::read(fixtures.join(format!("{kind}-receipt.json"))).unwrap()).unwrap();
        let installer=File {path:format!("forge-installers/{kind}-{game}-{version}.jar"),url:record["url"].as_str().unwrap().into(),sha1:record["sha1"].as_str().unwrap().into(),size:record["size"].as_u64().unwrap()};
        let setup=forge_data::parse(&fs::read(fixtures.join(format!("{kind}-installer.jar"))).unwrap(),installer,game,kind,version).unwrap();
        let vanilla:Value=serde_json::from_slice(&fs::read(fixtures.join(format!("{kind}-minecraft-version.json"))).unwrap()).unwrap();
        let(os,arch,os_version)=environment();let mut runtime=data::base(&vanilla,&instance,os,arch,&os_version).unwrap();
        let inputs=minecraft_forge_profile::apply(&mut runtime,&vanilla,&setup,os,arch,&os_version).unwrap();
        // Exercise the real installation transaction using already downloaded,
        // verified processor inputs. The broader asset download path is separate.
        runtime.files=inputs.clone();runtime.classpath.retain(|path|inputs.iter().any(|file|&file.path==path));runtime.natives.clear();data::validate(&mut runtime).unwrap();
        let root=runtime_folder(&folder).unwrap();
        for file in &inputs {let source=fixtures.join(format!("{kind}-inputs"));assert!(verified(&source,file,&AtomicBool::new(false)).unwrap());let mut output=instances::create_file(&root,&file.path).unwrap();output.write_all(&fs::read(source.join(&file.path)).unwrap()).unwrap();}
        instances::write(&root,"requirements.json",&Requirement::new(&instance,&runtime)).unwrap();
        let ready=state(profile,path,&instance.id).unwrap();assert!(!ready.installed);assert_eq!(ready.java,Some(runtime.java));
        let prepare=|| {let plan=Plan {token:id(),instance:instance.id.clone(),game:game.into(),loader:kind.into(),loader_version:version.into(),java:runtime.java,files:runtime.files.len(),bytes:runtime.files.iter().map(|file|file.size).sum(),cached_files:runtime.files.len(),cached_bytes:runtime.files.iter().map(|file|file.size).sum(),processors:setup.processors.len()};plans().lock().unwrap().insert(plan.token.clone(),Prepared {profile:profile.into(),folder:folder.clone(),instance:instance.id.clone(),created:Instant::now(),runtime:runtime.clone(),forge:Some(ForgeWork {setup:setup.clone(),inputs:inputs.clone()}),plan:plan.clone()});plan};
        assert!(matches!(install(profile.into(),prepare().token,id(),|_|{}).await,Err("java_invalid")));
        assert!(!root.join("runtime.json").exists());
        let selected=minecraft_java::select(profile.into(),path.into(),instance.id.clone(),java.into(),4096,id()).await.unwrap();assert!(selected.compatible);
        let plan=prepare();assert!(matches!(install("another-profile".into(),plan.token.clone(),id(),|_|{}).await,Err("instance_plan")));
        let phases=Arc::new(Mutex::new(Vec::new()));let progress=phases.clone();
        let result=install(profile.into(),plan.token.clone(),id(),move|value|progress.lock().unwrap().push((value.phase,value.files,value.total_files))).await.unwrap();
        assert!(result.installed);assert!(state(profile,path,&instance.id).unwrap().installed);
        assert!(phases.lock().unwrap().iter().any(|v|v.0=="processors"&&v.1==v.2));
        assert!(matches!(install(profile.into(),plan.token,id(),|_|{}).await,Err("instance_plan")));
        let receipt=instances::read::<process::Receipt>(&root.join("forge-receipt.json")).unwrap();assert_eq!(receipt.files.len(),setup.outputs.len());
        for file in &receipt.files {assert!(verified(&root,file,&AtomicBool::new(false)).unwrap());}
        let fresh=resolve_installed(&instance,&root,&AtomicBool::new(false)).await.unwrap();
        for file in &receipt.files {assert!(fresh.files.iter().any(|entry|entry.path==file.path&&entry.sha1==file.sha1));}
        let output=&receipt.files[0];let original=fs::read(root.join(&output.path)).unwrap();
        let mut damaged=original.clone();damaged[0]^=1;fs::write(root.join(&output.path),damaged).unwrap();assert!(!verified(&root,output,&AtomicBool::new(false)).unwrap());
        fs::write(root.join(&output.path),&original).unwrap();
        let mut stale=receipt.clone();stale.version="0.0.0".into();instances::write(&root,"forge-receipt.json",&stale).unwrap();assert!(!state(profile,path,&instance.id).unwrap().installed);assert!(matches!(resolve_installed(&instance,&root,&AtomicBool::new(false)).await,Err("launch_files")));
        let mut missing=receipt.clone();missing.files.pop();instances::write(&root,"forge-receipt.json",&missing).unwrap();assert!(!state(profile,path,&instance.id).unwrap().installed);
        instances::write(&root,"forge-receipt.json",&receipt).unwrap();fs::remove_file(root.join(&output.path)).unwrap();assert!(!state(profile,path,&instance.id).unwrap().installed);fs::write(root.join(&output.path),original).unwrap();
        let repair=Arc::new(Mutex::new(Vec::new()));let progress=repair.clone();install(profile.into(),prepare().token,id(),move|value|{if value.phase=="processors"{progress.lock().unwrap().push(value.files);}}).await.unwrap();
        assert_eq!(*repair.lock().unwrap(),vec![setup.processors.len()],"verified outputs skip all Java processors");
        assert_eq!(fs::read(folder.join("game/world-marker.txt")).unwrap(),b"preserve world");
        assert!(!fs::read_dir(folder.parent().unwrap().parent().unwrap()).unwrap().any(|entry|entry.unwrap().file_name().to_string_lossy().starts_with(".forge-stage-")));
        println!("{kind}: Java prerequisite, real processors, profile/token binding, fresh launch identity, stale/missing receipt/output, hash corruption and cached repair passed; {}",root.display());
    }
}
