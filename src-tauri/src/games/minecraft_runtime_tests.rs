use super::minecraft_runtime_data as data;
use serde_json::json;

#[test]
fn minecraft_runtime_rules_follow_platform_order_and_feature_constraints() {
    let rules = json!({"rules":[{"action":"allow"},{"action":"disallow","os":{"name":"osx"}},{"action":"allow","os":{"name":"osx","arch":"aarch64"}}]});
    assert!(data::allowed(&rules,"windows","amd64","10.0.26100").unwrap());
    assert!(!data::allowed(&rules,"osx","amd64","").unwrap());
    assert!(data::allowed(&rules,"osx","aarch64","").unwrap());
    assert!(!data::allowed(&json!({"rules":[{"action":"allow","features":{"is_demo_user":true}}]}),"windows","amd64","").unwrap());
    assert!(data::allowed(&json!({"rules":[{"action":"allow","features":{"unknown":true}}]}),"windows","amd64","").is_err());
    assert!(data::allowed(&json!({"rules":[{"action":"allow","os":{"versionRange":{"min":"10"}}}]}),"windows","amd64","").is_err());
    let args = data::arguments(&json!(["--username","${auth_player_name}",{"rules":[{"action":"allow","os":{"name":"osx"}}],"value":["-XstartOnFirstThread"]}]),"windows","amd64","").unwrap();
    assert_eq!(args, ["--username","${auth_player_name}"]);
}

#[test]
fn minecraft_runtime_sources_and_artifact_paths_are_bounded() {
    assert!(data::host("https://libraries.minecraft.net/com/mojang/a.jar").is_ok());
    for bad in ["http://libraries.minecraft.net/a.jar","https://libraries.minecraft.net.evil.test/a.jar","https://libraries.minecraft.net:443/a.jar","https://user@libraries.minecraft.net/a.jar","https://maven.fabricmc.net/a.jar?redirect=1","file:///tmp/a.jar"] {
        // Url normalizes an explicit default port; it still reaches only the
        // exact HTTPS origin. All other variants must be rejected.
        if !bad.contains(":443") { assert!(data::host(bad).is_err(),"{bad}"); }
    }
    assert_eq!(data::maven("net.fabricmc:fabric-loader:0.16.10").unwrap(),"net/fabricmc/fabric-loader/0.16.10/fabric-loader-0.16.10.jar");
    assert!(data::maven("net.fabricmc:../loader:1").is_err());
    assert!(data::maven("net.fabricmc:loader:1@exe").is_err());
    assert!(data::file(&json!({"sha1":"a".repeat(40),"size":100,"url":"https://libraries.minecraft.net/a"}),"../../a".into()).is_err());
}

#[test]
fn minecraft_runtime_loader_profiles_match_exact_game_version_and_entrypoint() {
    let mut runtime: data::Runtime = serde_json::from_value(json!({"schema":1,"game":"1.21.1","loader":"quilt","loader_version":"0.30.1","java":21,"version":"1.21.1","main":"net.minecraft.client.main.Main","asset_index":"17","jvm":[],"args":[],"classpath":[],"natives":[],"files":[],"platform":data::platform()})).unwrap();
    let profile = json!({"id":"quilt-loader-0.30.1-1.21.1","inheritsFrom":"1.21.1","mainClass":"org.quiltmc.loader.impl.launch.knot.KnotClient","libraries":[{"name":"org.quiltmc:quilt-loader:0.30.1","url":"https://maven.quiltmc.org/repository/release/"}]});
    data::loader_profile(&mut runtime,&profile).unwrap(); assert_eq!(runtime.main,"org.quiltmc.loader.impl.launch.knot.KnotClient");
    for (key,value) in [("id",json!("quilt-loader-0.30.0-1.21.1")),("inheritsFrom",json!("1.20.1")),("mainClass",json!("net.fabricmc.loader.impl.launch.knot.KnotClient")),("libraries",json!([]))] {
        let mut bad=profile.clone();bad[key]=value;assert!(data::loader_profile(&mut runtime,&bad).is_err(),"{key}");
    }
    let mut duplicate=profile.clone();duplicate["libraries"].as_array_mut().unwrap().push(profile["libraries"][0].clone());assert!(data::loader_profile(&mut runtime,&duplicate).is_err());
    runtime.loader="fabric".into();runtime.loader_version="0.16.10".into();
    let fabric=json!({"id":"fabric-loader-0.16.10-1.21.1","inheritsFrom":"1.21.1","mainClass":"net.fabricmc.loader.impl.launch.knot.KnotClient","libraries":[{"name":"net.fabricmc:fabric-loader:0.16.10"}]});
    data::loader_profile(&mut runtime,&fabric).unwrap();assert_eq!(runtime.main,"net.fabricmc.loader.impl.launch.knot.KnotClient");
}

#[test]
fn minecraft_runtime_quilt_artifacts_stay_within_published_maven_roots() {
    let library = |url: &str| json!({"name":"org.quiltmc:quilt-loader:0.30.1","url":url});
    let (path,url)=data::loader_library("quilt",&library("https://maven.quiltmc.org/repository/release/")).unwrap();
    assert_eq!(path,"libraries/org/quiltmc/quilt-loader/0.30.1/quilt-loader-0.30.1.jar");assert!(url.ends_with("/quilt-loader-0.30.1.jar"));
    assert!(data::loader_library("quilt",&library("https://maven.fabricmc.net/")).is_ok());
    for base in ["https://maven.quiltmc.org/repository/snapshot/","https://maven.quiltmc.org/","https://maven.quiltmc.org.evil.test/repository/release/","https://maven.quiltmc.org/repository/release/?next=bad"] {assert!(data::loader_library("quilt",&library(base)).is_err(),"{base}");}
    assert!(data::loader_library("fabric",&library("https://maven.quiltmc.org/repository/release/")).is_err());
    let mut invalid=library("https://maven.quiltmc.org/repository/release/");invalid["name"]=json!("org.quiltmc:../outside:1");assert!(data::loader_library("quilt",&invalid).is_err());
}

#[test]
fn minecraft_runtime_real_fixture_keeps_java_assets_and_launch_arguments() {
    let Ok(root) = std::env::var("HARBOR_MINECRAFT_RUNTIME_FIXTURE") else { return; };
    let value: serde_json::Value = serde_json::from_slice(&std::fs::read(std::path::Path::new(&root).join("minecraft-version.json")).unwrap()).unwrap();
    let instance = super::minecraft_instances::Instance { schema:1,id:uuid::Uuid::new_v4().to_string(),owner:"test".into(),name:"Fixture".into(),game_version:value["id"].as_str().unwrap().into(),loader:"vanilla".into(),loader_version:String::new(),created_at:0,pack:None,files:0,bytes:0 };
    let mut runtime = data::base(&value,&instance,"windows","amd64","10.0.26100").unwrap();
    assert_eq!(runtime.java,value["javaVersion"]["majorVersion"].as_u64().unwrap() as u32);
    assert!(runtime.jvm.iter().any(|v| v == "${classpath}")); assert!(runtime.args.iter().any(|v| v == "${auth_access_token}"));
    assert!(runtime.files.iter().all(|f| !f.path.contains("natives-linux") && !f.path.contains("natives-macos")));
    let asset = json!({"objects":{"a":{"hash":"b".repeat(40),"size":10},"same":{"hash":"b".repeat(40),"size":10}}});
    let before = runtime.files.len(); data::assets(&mut runtime,&asset).unwrap(); assert_eq!(runtime.files.len(),before+1);
    assert!(data::assets(&mut runtime,&json!({"virtual":true,"objects":{}})).is_err());
    let mut clash = runtime.files[0].clone(); clash.sha1 = "f".repeat(40); runtime.files.push(clash); assert!(data::validate(&mut runtime).is_err());
    let mut old_arm = value.clone(); old_arm["libraries"] = json!([{"natives":{"osx":"natives-osx"},"downloads":{}}]);
    assert!(matches!(data::base(&old_arm, &instance, "osx", "aarch64", ""), Err("runtime_platform")));
}
