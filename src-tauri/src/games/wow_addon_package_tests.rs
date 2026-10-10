use super::*;
use std::io::Write;

fn metadata() -> serde_json::Value {
    serde_json::json!([{"id":11190,"title":"Bartender4","version":"4.18.2","lastUpdate":1790752343000u64,"pendingUpdate":0,"checksum":"3929cea2da98b55c514a1ceb5e553607","fileName":"Bartender4-4.18.2.zip","downloadUri":"https://cdn.wowinterface.com/downloads/getfile.php?id=11190&d=1790752343&minion"}])
}
fn zip(entries: &[(&str, &str)]) -> (Release, Vec<u8>) {
    let mut archive = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (name, data) in entries {
        archive
            .start_file(name.to_string(), zip::write::SimpleFileOptions::default())
            .unwrap();
        archive.write_all(data.as_bytes()).unwrap();
    }
    let bytes = archive.finish().unwrap().into_inner();
    let mut release = release(&metadata(), 11190).unwrap();
    release.checksum = format!("{:x}", md5::compute(&bytes));
    (release, bytes)
}
fn inspect(entries: &[(&str, &str)], id: &str, version: &str) -> Result<Package> {
    let (release, bytes) = zip(entries);
    unpack(release, &bytes, id, version, &CancellationToken::new())
}

#[test]
fn published_metadata_pins_identity_and_download_origin() {
    assert_eq!(release(&metadata(), 11190).unwrap().version, "4.18.2");
    for url in [
        "http://cdn.wowinterface.com/downloads/getfile.php?id=11190",
        "https://cdn.wowinterface.com.evil.test/downloads/getfile.php?id=11190",
        "https://cdn.wowinterface.com/downloads/getfile.php?id=4",
        "https://cdn.wowinterface.com/downloads/getfile.php?id=11190&id=4",
        "https://user@cdn.wowinterface.com/downloads/getfile.php?id=11190",
        "https://cdn.wowinterface.com/other?id=11190",
    ] {
        let mut value = metadata();
        value[0]["downloadUri"] = url.into();
        assert_eq!(release(&value, 11190).unwrap_err(), "wow_addons_provider");
    }
    for key in ["id", "checksum", "fileName", "pendingUpdate"] {
        let mut value = metadata();
        value[0][key] = serde_json::Value::Null;
        assert!(release(&value, 11190).is_err());
    }
}
#[test]
fn retail_and_classic_need_the_actual_installed_interface_and_named_toc() {
    let files=[("Bartender4/Bartender4.toc","## Interface: 120100, 20506\n## X-WoWI-ID: 11190\n## Dependencies: Shared, Blizzard_Bundled\n## Version: 4.18.2"),("Bartender4/core.lua","not executed")];
    let retail = inspect(&files, "battlenet:wow", "12.1.0.69497").unwrap();
    assert_eq!(retail.dependencies, vec!["Shared"]);
    assert_eq!(retail.folders, vec!["Bartender4"]);
    assert!(inspect(&files, "battlenet:wow_classic_anniversary", "2.5.6.12345").is_ok());
    assert_eq!(
        inspect(&files, "battlenet:wow_classic_anniversary", "2.5.5.66265").err(),
        Some("wow_addons_incompatible")
    );
    let wrong = [("Bartender4/Bartender4_Mainline.toc", files[0].1)];
    assert_eq!(
        inspect(&wrong, "battlenet:wow_classic_anniversary", "2.5.6.12345").err(),
        Some("wow_addons_manifest")
    );
    let unknown = [("Other/Other.toc", "## Interface: 120100\n## X-WoWI-ID: 44")];
    assert_eq!(
        inspect(&unknown, "battlenet:wow", "12.1.0.69497").err(),
        Some("wow_addons_identity")
    );
}
#[test]
fn complete_multi_folder_bundles_resolve_internal_required_dependencies() {
    let files=[("Main/Main.toc","## Interface: 120100\n## X-WoWI-ID: 11190\n## Dependencies: core, Separate\n## OptionalDeps: Optional"),("Core/Core.toc","## Interface: 120100\n## Version: 1")];
    let value = inspect(&files, "battlenet:wow", "12.1.0.69497").unwrap();
    assert_eq!(value.dependencies, vec!["Separate"]);
    assert_eq!(value.files.len(), 2);
    assert_eq!(value.files[0].stamp.sha256, digest(&value.files[0].data));
}

#[test]
fn import_layout_cannot_become_an_unchecked_installable_package() {
    let (release, bytes) = zip(&[(
        "Main/Main_TBC.toc",
        "## Interface: 20506\n## X-WoWI-ID: 11190",
    )]);
    let layout = layout(
        release.clone(),
        &bytes,
        "battlenet:wow_classic_anniversary",
        "2.5.5.66265",
        &CancellationToken::new(),
    )
    .unwrap();
    assert_eq!(layout.folders, vec!["Main"]);
    assert_eq!(
        unpack(
            release,
            &bytes,
            "battlenet:wow_classic_anniversary",
            "2.5.5.66265",
            &CancellationToken::new()
        )
        .err(),
        Some("wow_addons_incompatible")
    );
    let (release, bytes) = zip(&[("Main/Main_TBC.toc", "## Interface: 20506\n## X-WoWI-ID: 44")]);
    assert_eq!(
        super::layout(
            release,
            &bytes,
            "battlenet:wow_classic_anniversary",
            "2.5.5.66265",
            &CancellationToken::new()
        )
        .err(),
        Some("wow_addons_identity")
    );
}
#[test]
fn archive_names_cannot_escape_or_collide_on_windows() {
    for name in [
        "../outside",
        "C:/outside",
        "/outside",
        "Main/../outside",
        "Main/file:ads",
        "Main/CON.lua",
        "Main/file.",
        "Main//file",
        "Main/.harbor-owned",
        "Main/./file",
    ] {
        assert!(relative(name).is_err(), "{name}");
    }
    assert_eq!(relative("Main\\libs\\ok.lua").unwrap(), "Main/libs/ok.lua");
    let toc = "## Interface: 120100\n## X-WoWI-ID: 11190";
    for files in [
        vec![("Main/Main.toc", toc), ("main/second.lua", "wrong casing")],
        vec![("Main/Main.toc", toc), ("Main/main.TOC", toc)],
        vec![
            ("Main/Main.toc", toc),
            ("Blizzard_Core/Blizzard_Core.toc", toc),
        ],
        vec![("Main/Main.toc", toc), ("README.txt", "top-level file")],
    ] {
        assert_eq!(
            inspect(&files, "battlenet:wow", "12.1.0.69497").err(),
            Some("wow_addons_archive")
        );
    }
}
#[test]
fn linked_oversized_tampered_or_cancelled_packages_are_rejected() {
    let toc = "## Interface: 120100\n## X-WoWI-ID: 11190";
    let (item, mut bytes) = zip(&[("Main/Main.toc", toc)]);
    bytes.push(0);
    assert_eq!(
        unpack(
            item,
            &bytes,
            "battlenet:wow",
            "12.1.0.1",
            &CancellationToken::new()
        )
        .err(),
        Some("wow_addons_checksum")
    );
    let mut archive = zip::ZipWriter::new(Cursor::new(Vec::new()));
    archive
        .add_symlink(
            "Main/link",
            "../../outside",
            zip::write::SimpleFileOptions::default(),
        )
        .unwrap();
    let bytes = archive.finish().unwrap().into_inner();
    let mut release = release(&metadata(), 11190).unwrap();
    release.checksum = format!("{:x}", md5::compute(&bytes));
    assert_eq!(
        unpack(
            release,
            &bytes,
            "battlenet:wow",
            "12.1.0.1",
            &CancellationToken::new()
        )
        .err(),
        Some("wow_addons_archive")
    );
    let (release, bytes) = zip(&[("Main/Main.toc", toc)]);
    let cancelled = CancellationToken::new();
    cancelled.cancel();
    assert_eq!(
        unpack(release, &bytes, "battlenet:wow", "12.1.0.1", &cancelled).err(),
        Some("wow_addons_cancelled")
    );
    let too_big = "a".repeat(128 * 1024 + 1);
    assert_eq!(
        inspect(&[("Main/Main.toc", &too_big)], "battlenet:wow", "12.1.0.1").err(),
        Some("wow_addons_limit")
    );
}
#[test]
#[ignore = "Explicit network verification of a public author package; no installation"]
fn live_bartender_package_validates_retail_and_rejects_old_anniversary_client() {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let (release, bytes) = runtime
        .block_on(latest(11190, &CancellationToken::new()))
        .unwrap();
    let package = unpack(
        release.clone(),
        &bytes,
        "battlenet:wow",
        "12.1.0.69497",
        &CancellationToken::new(),
    )
    .unwrap();
    assert!(package.files.len() > 100);
    assert_eq!(package.folders, vec!["Bartender4"]);
    assert_eq!(
        unpack(
            release,
            &bytes,
            "battlenet:wow_classic_anniversary",
            "2.5.5.66265",
            &CancellationToken::new()
        )
        .err(),
        Some("wow_addons_incompatible")
    );
}

#[test]
#[ignore = "Explicit public package layout verification; no installation or local addon writes"]
fn live_import_layout_identifies_bartender_and_titan_companions() {
    let runtime = tokio::runtime::Runtime::new().unwrap();
    for id in [11190, 8092] {
        let cancel = CancellationToken::new();
        let (release, bytes) = runtime.block_on(latest(id, &cancel)).unwrap();
        let package = layout(
            release,
            &bytes,
            "battlenet:wow_classic_anniversary",
            "2.5.5.66265",
            &cancel,
        )
        .unwrap();
        assert_eq!(package.release.id, id);
        if id == 11190 {
            assert_eq!(package.folders, vec!["Bartender4"]);
        } else {
            for companion in ["Titan", "TitanBag", "TitanClock", "TitanGold"] {
                assert!(
                    package.folders.iter().any(|name| name == companion),
                    "missing {companion}"
                );
            }
        }
        println!(
            "WoWInterface {id}: {} published folders",
            package.folders.len()
        );
    }
}
