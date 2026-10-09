use super::*;
use serde_json::json;
use std::{collections::BTreeMap,fs,path::PathBuf};

#[test]
fn minecraft_forge_version_lists_keep_the_exact_game_and_numeric_order(){
    let list=forge_versions(&json!({"1.20.1":["1.20.1-47.4.9","1.20.1-47.4.23","1.20.1-47.4.23"]}),"1.20.1").unwrap();
    assert_eq!(list.iter().map(|v|v.version.as_str()).collect::<Vec<_>>(),["47.4.23","47.4.9"]);assert!(list.iter().all(|v|v.stable));
    assert!(forge_versions(&json!({"1.20.1":["1.21.1-52.0.1"]}),"1.20.1").is_err());
    assert!(forge_versions(&json!({}),"1.20.1").unwrap().is_empty());
    let xml="<metadata><versioning><versions><version>21.1.9</version><version>21.1.252</version><version>21.1.253-beta</version><version>21.0.167</version></versions></versioning></metadata>";
    let list=neoforge_versions(xml,"1.21.1").unwrap();assert_eq!(list[0].version,"21.1.253-beta");assert!(!list[0].stable);assert_eq!(list[1].version,"21.1.252");
    assert_eq!(neoforge_versions(xml,"1.21").unwrap()[0].version,"21.0.167");assert!(neoforge_versions(xml,"1.20.1").unwrap().is_empty());
    assert!(neoforge_versions("<!DOCTYPE a [<!ENTITY a 'bad'>]><metadata/>","1.21.1").is_err());
}
#[test]
fn minecraft_forge_coordinates_and_processor_variables_are_bounded(){
    assert_eq!(data::coordinate("net.neoforged:neoform:1.21.1-20240808.144430:mappings@txt").unwrap(),"net/neoforged/neoform/1.21.1-20240808.144430/neoform-1.21.1-20240808.144430-mappings.txt");
    for value in ["evil:../outside:1","group:artifact:1@exe","group:artifact:1@jar@zip","group:artifact:1:../../"]{assert!(data::coordinate(value).is_err(),"{value}");}
    let map=BTreeMap::from([("SIDE".into(),data::Input::Text("client".into())),("INPUT".into(),data::Input::Path("libraries/a.jar".into()))]);
    assert_eq!(data::expand("--side={SIDE}",&map,std::path::Path::new("stage")).unwrap(),"--side=client");
    assert!(data::expand("{MISSING}",&map,std::path::Path::new("stage")).is_err());assert!(data::expand("{INPUT",&map,std::path::Path::new("stage")).is_err());
    for value in ["../outside","..",".","1.2.3-","one.2.3"]{assert!(installer_url("forge","1.20.1",value).is_err());}assert!(installer_url("quilt","1.21.1","0.30.1").is_err());
}
fn fixture(kind:&str)->(Vec<u8>,File,String){
    let root=PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_FORGE_FIXTURES").expect("Set the verified installer fixture directory"));
    let record:Value=serde_json::from_slice(&fs::read(root.join(format!("{kind}-receipt.json"))).unwrap()).unwrap();
    let version=record["version"].as_str().unwrap();let version=if kind=="forge"{version.strip_prefix("1.20.1-").unwrap()}else{version};
    let game=if kind=="forge"{"1.20.1"}else{"1.21.1"};
    let file=File{path:format!("forge-installers/{kind}-{game}-{version}.jar"),url:record["url"].as_str().unwrap().into(),sha1:record["sha1"].as_str().unwrap().into(),size:record["size"].as_u64().unwrap()};
    (fs::read(root.join(format!("{kind}-installer.jar"))).unwrap(),file,version.into())
}
#[test]
#[ignore="Explicit opt-in: parses verified official Forge/NeoForge installer fixtures; no execution"]
fn minecraft_forge_actual_installers_keep_identity_processors_dependencies_and_hashes(){
    for(kind,game)in[("forge","1.20.1"),("neoforge","1.21.1")]{
        let(bytes,file,version)=fixture(kind);let setup=data::parse(&bytes,file.clone(),game,kind,&version).unwrap();
        assert_eq!(setup.processors.len(),5);assert!(setup.mappings.as_ref().unwrap().ends_with("-mappings.txt"));assert!(setup.files.len()>30);assert_eq!(setup.embedded.len(),1);assert!(setup.outputs.len()>=6);
        assert!(setup.processors.iter().all(|p|!p.args.iter().any(|a|a=="DOWNLOAD_MOJMAPS")));assert!(setup.processors.iter().all(|p|p.classpath.contains(&p.jar)));
        assert_eq!(data::embedded_bytes(&bytes,&setup.embedded[0]).unwrap().len()as u64,setup.embedded[0].size);
        if kind=="forge"{assert!(setup.outputs.iter().any(|o|o.path.ends_with("-client.jar")&&o.sha1.is_some()));}
        assert!(data::parse(&bytes,file.clone(),"1.19.4",kind,&version).is_err());assert!(data::parse(&bytes,file.clone(),game,kind,"0.0.0").is_err());
        let mut damaged=bytes;damaged[12]^=1;assert_eq!(data::parse(&damaged,file,game,kind,&version).unwrap_err(),"instance_integrity");
    }
}
#[tokio::test]
#[ignore="Explicit opt-in: fetches official loader indexes and two version-pinned installers; no execution"]
async fn minecraft_forge_live_metadata_and_installers_match(){
    let cancel=AtomicBool::new(false);
    for(kind,game,version)in[("forge","1.20.1","47.4.23"),("neoforge","1.21.1","21.1.252")]{
        let releases=versions(kind,game,&cancel).await.unwrap();assert!(releases.iter().any(|v|v.version==version));
        let setup=prepare(kind,game,version,&cancel).await.unwrap();assert_eq!(setup.launch["inheritsFrom"],game);assert!(setup.installer.size>1_000_000);
    }
}

#[tokio::test]
#[ignore="Explicit opt-in: executes official pinned client processors in an isolated fixture directory"]
async fn minecraft_forge_fixture_processors_produce_verified_client_outputs(){
    use super::super::{minecraft_forge_process as process,minecraft_java,minecraft_runtime_data};
    use std::{io::Write,sync::Arc};
    let root=PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_FORGE_FIXTURES").unwrap());
    let kind=std::env::var("HARBOR_MINECRAFT_FORGE_KIND").unwrap_or_else(|_|"forge".into());
    let game=match kind.as_str(){"forge"=>"1.20.1","neoforge"=>"1.21.1",_=>panic!("Unknown fixture")};
    let java_path=PathBuf::from(std::env::var_os("HARBOR_MINECRAFT_FORGE_JAVA").expect("Compatible Java path required"));
    let cancel=Arc::new(AtomicBool::new(false));
    let java=minecraft_java::probe(&java_path,false,&cancel).await.unwrap();
    assert_eq!(java.major,if kind=="forge"{17}else{21});
    let(bytes,file,version)=fixture(&kind);let setup=data::parse(&bytes,file,game,&kind,&version).unwrap();
    let inputs:Vec<File>=serde_json::from_slice(&fs::read(root.join(format!("{kind}-inputs.json"))).unwrap()).unwrap();
    assert!(inputs.iter().any(|f|f.path==setup.installer.path));
    let destination=root.join(format!("processor-{kind}-{}",uuid::Uuid::new_v4()));fs::create_dir(&destination).unwrap();
    let cache=root.join(format!("{kind}-inputs"));
    for file in &inputs{
        assert!(runtime::verified(&cache,file,&cancel).unwrap(),"{}",file.path);
        let bytes=fs::read(cache.join(&file.path)).unwrap();let mut output=instances::create_file(&destination,&file.path).unwrap();output.write_all(&bytes).unwrap();
    }
    let started=std::time::Instant::now();
    let receipt=process::install(&destination,&destination,&java,&setup,&inputs,game,&kind,&version,cancel.clone(),|done,total|eprintln!("{kind}: processor {done}/{total}")).await.unwrap();
    process::matching(&receipt,&setup,game,&kind,&version).unwrap();
    assert_eq!(receipt.files.len(),6);
    for file in &receipt.files{assert!(runtime::verified(&destination,file,&cancel).unwrap());assert!(minecraft_runtime_data::digest(&file.sha1));}
    let mut changed=receipt.clone();changed.files[0].sha1="invalid".into();assert!(process::matching(&changed,&setup,game,&kind,&version).is_err());
    assert!(!fs::read_dir(&destination).unwrap().any(|v|v.unwrap().file_name().to_string_lossy().starts_with(".forge-stage-")));
    eprintln!("{kind} generated {} verified outputs in {:?}; receipt {}",receipt.files.len(),started.elapsed(),destination.display());
}
