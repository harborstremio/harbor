use super::*;
use serde_json::json;
use std::{fs, path::PathBuf};

struct Fixture { base: PathBuf, root: PathBuf }
impl Fixture {
    fn new() -> Self { let base = std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir); fs::create_dir_all(&base).unwrap(); let root = base.join(format!("minecraft-loader-{}", uuid::Uuid::new_v4())); fs::create_dir(&root).unwrap(); Self { base, root } }
}
impl Drop for Fixture { fn drop(&mut self) { let root = self.root.canonicalize().unwrap(); assert!(root.starts_with(self.base.canonicalize().unwrap())); assert!(root.file_name().unwrap().to_string_lossy().starts_with("minecraft-loader-")); fs::remove_dir_all(root).unwrap(); } }

#[test]
fn minecraft_loader_metadata_preserves_version_identity_and_fixed_provider() {
    let value = json!({"loader":{"version":"0.19.5","stable":true,"maven":"net.fabricmc:fabric-loader:0.19.5"},"intermediary":{"version":"1.21.1"}});
    assert_eq!(release(&value, "1.21.1").unwrap().version, "0.19.5"); assert!(release(&value, "1.20.1").is_err());
    let mut bad = value.clone(); bad["loader"]["maven"] = json!("other:artifact:0.19.5"); assert!(release(&bad, "1.21.1").is_err());
    bad = value; bad["loader"]["stable"] = json!("true"); assert!(release(&bad, "1.21.1").is_err());
    assert!(route("../outside", None).is_err()); assert!(route("1.21.1", Some("https://outside.test")).is_err());
    let encoded = route("1.14 Pre-Release 5", Some("0.4.8+build.155")).unwrap(); assert_eq!(encoded.host_str(), Some("meta.fabricmc.net")); assert!(encoded.as_str().contains("Pre-Release%205"));
}

#[test]
fn minecraft_custom_creation_is_atomic_and_cancellation_preserves_other_instances() {
    let fixture = Fixture::new(); let path = fixture.root.to_str().unwrap(); let cancel = AtomicBool::new(false);
    let vanilla = instances::create_configured("loader-test", path, "Original world", "1.21.1", "vanilla", "", &cancel).unwrap();
    let original = instances::game_folder("loader-test", path, &vanilla.id).unwrap(); fs::write(PathBuf::from(&original).join("world.dat"), b"keep").unwrap();
    assert!(instances::create_configured("loader-test", path, "Bad", "1.21.1", "forge", "0.1", &cancel).is_err());
    assert!(instances::create_configured("loader-test", path, "Bad", "1.21.1", "vanilla", "0.1", &cancel).is_err());
    assert!(instances::create_configured("loader-test", path, "Canceled", "1.21.1", "fabric", "0.19.5", &AtomicBool::new(true)).is_err());
    assert_eq!(instances::list("loader-test", path).unwrap().instances.len(), 1); assert_eq!(fs::read(PathBuf::from(original).join("world.dat")).unwrap(), b"keep");
    assert!(instances::list("other-profile", path).unwrap().instances.is_empty());
}

#[tokio::test]
#[ignore = "uses official Fabric metadata and shared creation lock; run serially"]
async fn minecraft_custom_fabric_is_verified_and_opens_the_existing_mod_manager() {
    let fixture = Fixture::new(); let path = fixture.root.to_str().unwrap().to_owned();
    let releases = versions("1.21.1".into()).await.unwrap(); let loader = &releases.iter().find(|v| v.stable).unwrap().version;
    let instance = create("loader-test".into(), path.clone(), "My custom Fabric".into(), "1.21.1".into(), "fabric".into(), loader.clone(), uuid::Uuid::new_v4().to_string()).await.unwrap();
    assert_eq!(instance.loader_version, *loader); assert!(instance.pack.is_none());
    let content = super::super::minecraft_content::content("loader-test".into(), path.clone(), instance.id).await.unwrap(); assert_eq!(content.workspace.game_version, "1.21.1"); assert!(content.workspace.packages.is_empty());
    assert!(create("loader-test".into(), path.clone(), "Invalid pair".into(), "1.21.1".into(), "fabric".into(), "999.999.999".into(), uuid::Uuid::new_v4().to_string()).await.is_err());
    assert_eq!(instances::list("loader-test", &path).unwrap().instances.len(), 1);
    assert!(versions("1.12.2".into()).await.unwrap().is_empty());
}

#[test]
fn minecraft_quilt_release_identity_and_unordered_semantic_versions() {
    let release = |version: &str| json!({"loader":{"version":version,"maven":format!("org.quiltmc:quilt-loader:{version}")},"hashed":{"version":"1.21.1","maven":"org.quiltmc:hashed:1.21.1"}});
    let mut releases = ["0.20.0-beta.9","0.30.1","0.30.0","0.30.2-beta.2","0.30.2-beta.10"].iter().map(|v| quilt_release(&release(v),"1.21.1").unwrap()).collect::<Vec<_>>();
    releases.sort_by(|a,b| quilt_order(b,a));
    assert_eq!(releases[0].version,"0.30.2-beta.10"); assert_eq!(releases.iter().find(|v|v.stable).unwrap().version,"0.30.1");
    assert!(quilt_release(&release("0.30.1"),"1.20.1").is_err());
    let mut bad = release("0.30.1"); bad["loader"]["maven"] = json!("net.fabricmc:fabric-loader:0.30.1"); assert!(quilt_release(&bad,"1.21.1").is_err());
    assert!(quilt_release(&release("0.30"),"1.21.1").is_err());
    assert_eq!(route_for("quilt","1.21.1",Some("0.30.1")).unwrap().as_str(),"https://meta.quiltmc.org/v3/versions/loader/1.21.1/0.30.1");
    assert!(route_for("other","1.21.1",None).is_err()); assert!(route_for("quilt","../elsewhere",None).is_err());
}

#[tokio::test]
#[ignore = "Uses official Quilt metadata and creates only an isolated fixture; run serially"]
async fn minecraft_custom_quilt_verifies_selection_and_preserves_profile_isolation() {
    let fixture = Fixture::new(); let path = fixture.root.to_str().unwrap().to_owned();
    let releases = versions_for("quilt".into(),"1.21.1".into()).await.unwrap(); let selected = releases.iter().find(|v|v.stable).unwrap();
    let created = create("quilt-qa".into(),path.clone(),"Quilt world".into(),"1.21.1".into(),"quilt".into(),selected.version.clone(),uuid::Uuid::new_v4().to_string()).await.unwrap();
    assert_eq!(created.loader,"quilt"); assert_eq!(created.loader_version,selected.version); assert!(created.pack.is_none());
    assert_eq!(instances::list("quilt-qa",&path).unwrap().instances.len(),1); assert!(instances::list("other-profile",&path).unwrap().instances.is_empty());
    assert!(create("quilt-qa".into(),path.clone(),"Bad".into(),"1.21.1".into(),"quilt".into(),"999.999.999".into(),uuid::Uuid::new_v4().to_string()).await.is_err());
    assert_eq!(instances::list("quilt-qa",&path).unwrap().instances.len(),1);
}
