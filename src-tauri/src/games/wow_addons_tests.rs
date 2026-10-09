use super::*;

#[test]
fn only_exact_installed_wow_editions_are_accepted() {
    for id in ["battlenet:wow", "battlenet:wow_classic", "battlenet:wow_classic_era", "battlenet:wow_classic_anniversary"] { assert!(edition(id).is_some()); }
    for id in ["battlenet:wowt", "battlenet:../wow", "igdb:123", "wow", "battlenet:WOW"] { assert!(edition(id).is_none()); assert!(scan(id).is_err()); }
}
#[test]
fn toc_is_plain_metadata_and_does_not_execute_or_render_markup() {
    let parsed = manifest("Sample.toc", "\u{feff}## Title: |TInterface\\Icon:16|t |cffffaa00Hello|r |Hurl:bad|hworld|h\n## Version: 1.2\n## Author: José\n## Interface: 120001, 20505, invalid, 0\n## Dependencies: Core, Missing\n## OptionalDeps: Optional\n## X-WoWI-ID: 11190\n## LoadOnDemand: 1\nmalicious.lua\n");
    assert_eq!(parsed.title, "Hello world");assert_eq!(parsed.author,"José");assert_eq!(parsed.interfaces,vec![120001,20505]);assert_eq!(parsed.dependencies,vec!["Core","Missing"]);assert_eq!(parsed.wowi_id,Some(11190));assert!(parsed.load_on_demand);
    assert!(!folder_name("../outside"));assert!(!folder_name("C:\\outside"));assert_eq!(display_text("|n|cnothex|rHi\u{0000}",80),"|cnothexHi");
}
#[test]
fn edition_manifest_wins_over_generic_and_other_flavors_never_win() {
    let choices=vec![manifest("Test.toc","## Version: generic"),manifest("Test_Mainline.toc","## Version: retail"),manifest("Test-TBC.toc","## Version: tbc")];
    assert_eq!(select_manifest("Test",&choices,suffixes("battlenet:wow",Some(12))).unwrap().unwrap().version,"retail");
    assert_eq!(select_manifest("Test",&choices,suffixes("battlenet:wow_classic_anniversary",Some(2))).unwrap().unwrap().version,"tbc");
    assert_eq!(select_manifest("Test",&choices,suffixes("battlenet:wow_classic",Some(5))).unwrap().unwrap().version,"generic");
    assert!(select_manifest("Test",&choices[1..],suffixes("battlenet:wow_classic",None)).unwrap().is_none());
    let mut duplicates=choices.clone();duplicates.push(manifest("Test_TBC.toc","## Version: other"));assert!(select_manifest("Test",&duplicates,&["tbc"]).is_err());
}
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self { let root=std::env::var_os("HARBOR_GAME_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir).join(format!("wow-addons-test-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));fs::create_dir_all(root.join("_retail_/Interface/AddOns")).unwrap();fs::write(root.join("_retail_/Wow.exe"),b"not an executable; never run").unwrap();Self(root) }
    fn addon(&self, name:&str, toc:&str) { let root=self.0.join("_retail_/Interface/AddOns").join(name);fs::create_dir_all(&root).unwrap();fs::write(root.join(format!("{name}.toc")),toc).unwrap(); }
}
impl Drop for Fixture { fn drop(&mut self) { let _=fs::remove_dir_all(&self.0); } }
#[test]
fn inventory_preserves_editions_dependencies_and_does_not_read_nested_libraries_or_account_data() {
    let f=Fixture::new();f.addon("Core","## Title: Core");f.addon("Test","## Title: Test\n## Dependencies: core, Missing, Blizzard_ClientModule\n## OptionalDeps: Optional\n## Version: 1.0");
    fs::create_dir_all(f.0.join("_retail_/WTF/Account")).unwrap();fs::write(f.0.join("_retail_/WTF/Account/secret.lua"),"never read").unwrap();
    fs::create_dir_all(f.0.join("_retail_/Interface/AddOns/Test/libs/Nested")).unwrap();fs::write(f.0.join("_retail_/Interface/AddOns/Test/libs/Nested/Nested.toc"),"## Title: Wrong").unwrap();
    let data=inventory("battlenet:wow",&f.0).unwrap();assert_eq!(data.addons.len(),2);assert!(!data.partial);assert_eq!(data.addons[1].missing_dependencies,vec!["Missing"]);assert_eq!(data.addons[1].manifest.as_ref().unwrap().version,"1.0");assert!(inventory("battlenet:wow_classic_anniversary",&f.0).is_err());
}
#[test]
fn oversized_and_ambiguous_manifests_are_visible_as_unreadable_not_invented_metadata() {
    let f=Fixture::new();f.addon("Huge",&"a".repeat(TOC_LIMIT as usize+1));f.addon("Empty","not metadata");
    let data=inventory("battlenet:wow",&f.0).unwrap();let huge=data.addons.iter().find(|x|x.folder=="Huge").unwrap();assert_eq!(huge.state,"unreadable");assert!(huge.manifest.is_none());
    let outside=f.0.parent().unwrap();assert!(child(&f.0,outside).is_err());
}
#[test]
fn unversioned_classic_client_never_guesses_current_expansion() { assert!(suffixes("battlenet:wow_classic",None).is_empty());assert!(suffixes("battlenet:wow_classic_anniversary",Some(99)).is_empty()); }
#[test]
fn version_strings_preserve_blizzards_human_version_not_packed_pe_numbers() {
    assert_eq!(version_string("2.5.5.66265"),Some("2.5.5.66265".into()));assert_eq!(version_string("12.1.0.69497"),Some("12.1.0.69497".into()));
    for text in ["205.5.6626.5", "1201.0.6949.7", "2.5", "2.5.5.extra", "2.5.5.0.1", ""] { assert!(version_string(text).is_none()); }
}
