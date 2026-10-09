use super::*;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Cursor, Write},
    path::PathBuf,
};

fn scan(
    profile: &str,
    path: &str,
    operation: &str,
    emit: impl Fn(store::progress::Progress),
) -> Result<Report> {
    super::scan(profile, path, operation, None, emit)
}
fn scan_checked(
    path: &str,
    work: &mut store::progress::Work<'_>,
    budget: u64,
    duration: Duration,
) -> Result<Report> {
    super::scan_checked(path, work, budget, duration, None)
}
fn resolve(
    file: &str,
    manifest: &manifest::Manifest,
    catalog: &Catalog,
    partial: bool,
) -> Vec<Requirement> {
    super::resolve(file, manifest, catalog, partial, None)
}

#[test]
fn pack_conditions_use_three_way_file_and_launch_evidence_without_inventing_availability() {
    let missing = "55".repeat(32);
    let manifest=manifest::from_yaml(&format!("name: Conditional\nrequired_mods:\n- name: With Seasons\n  hashes: [{missing}]\n  ignore_if_pack_unavailable: EP05\n- name: Without Seasons\n  hashes: [{missing}]\n  ignore_if_pack_available: EP05\n"),&||Ok(())).unwrap();
    let mut packs = sims_packs::Report {
        path: "fixture".into(),
        packs: vec![sims_packs::Pack {
            code: "EP05".into(),
            status: sims_packs::Status::Found,
            files: vec!["ClientFullBuild0.package".into()],
        }],
        partial: false,
        checked_at: 1,
        launch: sims_launch_settings::Settings {
            source: Some("custom"),
            state: "checked",
            disabled: BTreeSet::new(),
        },
    };
    let states = |packs: &sims_packs::Report| {
        super::resolve("mod", &manifest, &Catalog::new(), false, Some(packs))
            .into_iter()
            .map(|v| v.status)
            .collect::<Vec<_>>()
    };
    assert_eq!(states(&packs), [Status::Missing, Status::NotRequired]);
    packs.launch.disabled.insert("EP05".into());
    assert_eq!(states(&packs), [Status::NotRequired, Status::Missing]);
    packs.launch.state = "unknown";
    assert_eq!(states(&packs), [Status::Unchecked, Status::Unchecked]);
    packs.packs.clear();
    assert_eq!(states(&packs), [Status::NotRequired, Status::Missing]);
    packs.partial = true;
    assert_eq!(states(&packs), [Status::Unchecked, Status::Unchecked]);
    packs.launch.state = "checked";
    assert_eq!(
        states(&packs),
        [Status::NotRequired, Status::Missing],
        "an explicitly disabled pack is unavailable even with a partial file scan"
    );
}

#[test]
fn pack_conditions_accept_historical_aliases_but_reject_bad_codes_and_conflicting_aliases() {
    let make = |extra: &str| {
        manifest::from_yaml(
            &format!(
                "name: Mod\nrequired_mods:\n- name: Dependency\n  hashes: [{}]\n{extra}",
                "55".repeat(32)
            ),
            &|| Ok(()),
        )
        .unwrap()
    };
    let good = make("  ignore_if_pash_unavailable: ep05\n");
    assert_eq!(
        good.requirements[0]
            .check
            .as_ref()
            .unwrap()
            .pack_unavailable
            .as_deref(),
        Some("EP05")
    );
    for value in [
        "  ignore_if_pack_unavailable: Seasons\n",
        "  ignore_if_pack_available: ''\n",
        "  ignore_if_pack_unavailable: EP05\n  ignore_if_pash_unavailable: EP06\n",
        "  ignore_if_pack_available: [EP05]\n",
    ] {
        assert!(make(value).requirements[0].check.is_none(), "{value}");
    }
    let xml = format!(
        r#"<I i="snippet" m="llamalogic.snippets.modfilemanifest" c="ModFileManifest"><T n="name">Mod</T><L n="required_mods"><U><T n="name">Dependency</T><L n="hashes"><T>{}</T></L><T n="ignore_if_pash_unavailable">EP05</T></U></L></I>"#,
        "55".repeat(32)
    );
    let parsed = manifest::from_xml(&xml, &|| Ok(())).unwrap().unwrap();
    assert_eq!(parsed.requirements[0].check.as_ref().unwrap().pack_unavailable.as_deref(), Some("EP05"));
}

#[test]
fn dependencies_rescan_selected_installation_and_custom_arguments_in_the_real_native_flow() {
    let f = Fixture::new();
    let game = f.0.join("Installation");
    let mut pe = vec![0u8; 68];
    pe[..2].copy_from_slice(b"MZ");
    pe[60..64].copy_from_slice(&64u32.to_le_bytes());
    pe[64..66].copy_from_slice(b"PE");
    let mut dbpf = vec![0u8; 100];
    dbpf[..4].copy_from_slice(b"DBPF");
    for (at, value) in [(4, 2u32), (8, 1), (36, 1), (40, 96), (44, 4)] {
        dbpf[at..at + 4].copy_from_slice(&value.to_le_bytes());
    }
    for (name, bytes) in [
        ("Game/Bin/TS4_x64.exe", pe),
        ("Data/Client/ClientFullBuild0.package", dbpf.clone()),
        ("EP05/ClientFullBuild0.package", dbpf),
    ] {
        let path = game.join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }
    f.put("conditional.ts4script",&script("Seasonal Mod",&format!("required_mods:\n- name: Seasonal Dependency\n  hashes: [{}]\n  ignore_if_pack_unavailable: EP05\n","55".repeat(32))));
    let mut selection = PackSelection {
        path: game.to_string_lossy().into_owned(),
        custom: vec![sims_launch_settings::CustomLaunch {
            executable: game
                .join("Game/Bin/TS4_x64.exe")
                .to_string_lossy()
                .into_owned(),
            arguments: vec!["-disablepacks:EP05".into()],
        }],
    };
    let scan = |selection: &PackSelection| {
        super::scan(
            "proof",
            f.path(),
            &uuid::Uuid::new_v4().to_string(),
            Some(selection),
            |_| {},
        )
        .unwrap()
    };
    let report = scan(&selection);
    assert_eq!(report.requirements[0].status, Status::NotRequired);
    assert_eq!(report.packs.unwrap().launch.state, "checked");
    selection.custom[0].arguments.clear();
    assert_eq!(scan(&selection).requirements[0].status, Status::Missing);
    fs::remove_file(game.join("EP05/ClientFullBuild0.package")).unwrap();
    assert_eq!(
        scan(&selection).requirements[0].status,
        Status::Unchecked,
        "an empty pack directory is incomplete rather than absent"
    );
    fs::remove_dir(game.join("EP05")).unwrap();
    assert_eq!(scan(&selection).requirements[0].status, Status::NotRequired);
    selection.path = f.path().into();
    let failed = scan(&selection);
    assert!(failed.packs.is_none());
    assert_eq!(failed.pack_error, Some("sims_packs_folder"));
    assert_eq!(failed.requirements[0].status, Status::Unchecked);
}

fn script(contents: &str, extra: &str) -> Vec<u8> {
    let code = b"fixture bytecode, never executed";
    let mut code_zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    code_zip
        .start_file("mod.pyc", zip::write::SimpleFileOptions::default())
        .unwrap();
    code_zip.write_all(code).unwrap();
    let raw = code_zip.finish().unwrap().into_inner();
    let mut read = zip::ZipArchive::new(Cursor::new(&raw)).unwrap();
    let crc = read.by_index(0).unwrap().crc32();
    let mut hash = Sha256::new();
    hash.update(b"mod.pyc");
    hash.update(crc.to_le_bytes());
    let hash = format!("{:x}", hash.finalize());
    let yaml = format!("name: {contents}\nhash: {hash}\n{extra}");
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    zip.start_file("mod.pyc", zip::write::SimpleFileOptions::default())
        .unwrap();
    zip.write_all(code).unwrap();
    zip.start_file(
        "llamalogic.modfilemanifest.yml",
        zip::write::SimpleFileOptions::default(),
    )
    .unwrap();
    zip.write_all(yaml.as_bytes()).unwrap();
    zip.finish().unwrap().into_inner()
}
fn real_core() -> Vec<u8> {
    let directory =
        std::env::var("HARBOR_SIMS_LOT51_FIXTURES").expect("Supply actual Lot51 fixture directory");
    let mut archive = zip::ZipArchive::new(Cursor::new(
        fs::read(Path::new(&directory).join("lot51-core-live.zip")).unwrap(),
    ))
    .unwrap();
    let mut file = archive.by_name("lot51_core.ts4script").unwrap();
    let mut bytes = vec![];
    std::io::Read::read_to_end(&mut file, &mut bytes).unwrap();
    bytes
}
const CORE: &str = "16064586554ed25187fcdb293e1df1bbc756523403de1a3ee0f33bf91f341a0d";
const OLD_CORE: &str = "6ff53baf3e380c2e4a290cd8baf30b5bbbca7297b5b962a65737c10870db3ff8";

#[test]
fn dependencies_real_core_content_and_declared_previous_versions_match_without_filename_identity() {
    let core = real_core();
    let (manifests, partial) =
        store::metadata::extract("renamed.ts4script", &core, &|| Ok(())).unwrap();
    assert!(!partial);
    assert_eq!(
        sims_fingerprints::calculate(
            "renamed.ts4script",
            &core,
            manifests[0].identity.as_ref().unwrap(),
            &|| Ok(())
        )
        .unwrap(),
        CORE
    );
    let f = Fixture::new();
    let dependent=script("Needs Core",&format!("required_mods:\n- name: Core Library\n  hashes: [{OLD_CORE}]\n  required_features: [TuningInjector]\n  url: https://lot51.cc/core\n"));
    f.put("dependent.ts4script", &dependent);
    let missing = f.scan();
    assert!(!missing.partial);
    assert_eq!(missing.requirements[0].status, Status::Missing);
    f.put("renamed.ts4script", &core);
    let found = f.scan();
    assert!(!found.partial);
    assert_eq!(found.requirements[0].status, Status::Found);
    assert_eq!(found.requirements[0].matched_files, ["renamed.ts4script"]);
    assert!(!f.0.join("HarborSimsMods").exists());
    assert_eq!(
        fs::read(f.0.join("Mods/dependent.ts4script")).unwrap(),
        dependent
    );
    fs::rename(
        f.0.join("Mods/renamed.ts4script"),
        f.0.join("disabled-core.ts4script"),
    )
    .unwrap();
    assert_eq!(f.scan().requirements[0].status, Status::Missing);
    f.put("too/deep/core.ts4script", &core);
    assert_eq!(f.scan().requirements[0].status, Status::Missing);
}

#[test]
fn dependencies_conditions_alternatives_features_and_unknowns_never_use_names_as_identity() {
    let mut catalog = Catalog::new();
    catalog.insert(
        CORE.into(),
        vec![std::sync::Arc::new(Present {
            file: "Core.ts4script".into(),
            features: BTreeSet::from(["Feature".into()]),
        })],
    );
    let missing = "11".repeat(32);
    let info=manifest::from_yaml(&format!("name: Mod\nrequired_mods:\n- name: Any name\n  hashes: [{CORE}]\n  required_features: [Feature]\n- name: Core Library\n  hashes: [{missing}]\n- name: Conditional\n  hashes: [{missing}]\n  ignore_if_hash_available: {CORE}\n- name: Pack condition\n  hashes: [{missing}]\n  ignore_if_pack_unavailable: EP05\n- name: Alternative A\n  hashes: [{missing}]\n  requirement_identifier: choice\n- name: Alternative B\n  hashes: [{CORE}]\n  requirement_identifier: choice\n- name: Feature removed\n  hashes: [{CORE}]\n  required_features: [MissingFeature]\n- name: No hashes\n"),&||Ok(())).unwrap();
    let states = resolve("a.ts4script", &info, &catalog, false)
        .into_iter()
        .map(|v| v.status)
        .collect::<Vec<_>>();
    assert_eq!(
        states,
        [
            Status::Found,
            Status::Missing,
            Status::NotRequired,
            Status::Unchecked,
            Status::Alternative,
            Status::Found,
            Status::Missing,
            Status::Unchecked
        ]
    );
    assert_eq!(
        resolve("a.ts4script", &info, &catalog, true)[1].status,
        Status::Unchecked
    );
    let bad=manifest::from_yaml(&format!("name: Mod\nrequired_mods:\n- name: Valid\n  hashes: [{missing}]\n  requirement_identifier: choice\n- name: Unknown alternative\n  hashes: [invalid]\n  requirement_identifier: choice\n"),&||Ok(())).unwrap();
    assert!(resolve("a", &bad, &catalog, false)
        .iter()
        .all(|r| r.status == Status::Unchecked));
}

#[test]
fn dependencies_read_bounds_cancel_and_external_changes_preserve_files() {
    let f = Fixture::new();
    let raw = script(
        "Mod",
        &format!("required_mods:\n- name: Core\n  hashes: [{CORE}]\n"),
    );
    f.put("mod.ts4script", &raw);
    let mut work =
        store::progress::Work::start("proof", &uuid::Uuid::new_v4().to_string(), &|_| {}).unwrap();
    let limited = scan_checked(f.path(), &mut work, 0, Duration::from_secs(10)).unwrap();
    assert!(limited.partial);
    assert!(limited.requirements.is_empty());
    drop(work);
    let operation = uuid::Uuid::new_v4().to_string();
    let report = scan("proof", f.path(), &operation, |p| {
        if p.file.is_some() {
            assert!(store::progress::cancel("proof", &operation));
        }
    });
    assert_eq!(report.unwrap_err(), "sims_canceled");
    let operation = uuid::Uuid::new_v4().to_string();
    let report = scan("proof", f.path(), &operation, |p| {
        if p.file.is_some() {
            fs::write(f.0.join("Mods/new.package"), b"external addition").unwrap();
        }
    });
    assert_eq!(report.unwrap_err(), "sims_changed");
    assert_eq!(fs::read(f.0.join("Mods/mod.ts4script")).unwrap(), raw);
}

fn package_fixture(resources: &[((u32, u32, u64), &[u8], bool)]) -> Vec<u8> {
    let mut bytes = vec![0; 96];
    bytes[..4].copy_from_slice(b"DBPF");
    bytes[4..8].copy_from_slice(&2u32.to_le_bytes());
    bytes[8..12].copy_from_slice(&1u32.to_le_bytes());
    let mut entries = vec![];
    for ((kind, group, instance), raw, compress) in resources {
        let packed = if *compress {
            let mut encoder =
                flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
            encoder.write_all(raw).unwrap();
            encoder.finish().unwrap()
        } else {
            raw.to_vec()
        };
        entries.push([
            *kind,
            *group,
            (instance >> 32) as u32,
            *instance as u32,
            bytes.len() as u32,
            packed.len() as u32 | 0x8000_0000,
            raw.len() as u32,
            if *compress { 0x0001_5a42 } else { 0 },
        ]);
        bytes.extend(packed);
    }
    bytes[36..40].copy_from_slice(&(entries.len() as u32).to_le_bytes());
    bytes[44..48].copy_from_slice(&(4 + entries.len() as u32 * 32).to_le_bytes());
    let offset = bytes.len() as u64;
    bytes[64..72].copy_from_slice(&offset.to_le_bytes());
    bytes.extend(0u32.to_le_bytes());
    for entry in entries {
        for word in entry {
            bytes.extend(word.to_le_bytes());
        }
    }
    bytes
}

#[test]
fn dependencies_package_fingerprint_uses_sorted_tgi_uncompressed_bytes_and_rejects_ambiguous_keys()
{
    let keys = [(0x03b33ddf, 5, 0x100000001), (0x03b33ddf, 2, 4)];
    let package = package_fixture(&[(keys[0], b"second", true), (keys[1], b"first", false)]);
    let mut expected = Sha256::new();
    for ((kind, group, instance), raw) in [
        (keys[1], b"first".as_slice()),
        (keys[0], b"second".as_slice()),
    ] {
        expected.update(instance.to_le_bytes());
        expected.update(kind.to_le_bytes());
        expected.update(group.to_le_bytes());
        expected.update(raw);
    }
    let hash = format!("{:x}", expected.finalize());
    let value=manifest::from_yaml(&format!("name: Test\nhash: {hash}\nhash_resource_keys: ['03b33ddf:00000005:0000000100000001','03b33ddf-00000002-0000000000000004']\n"),&||Ok(())).unwrap();
    let identity = value.identity.unwrap();
    assert_eq!(
        sims_fingerprints::calculate("test.package", &package, &identity, &|| Ok(())).unwrap(),
        hash
    );
    assert!(sims_fingerprints::calculate(
        "test.package",
        &package_fixture(&[(keys[0], b"second", false)]),
        &identity,
        &|| Ok(())
    )
    .is_err());
    assert!(sims_fingerprints::calculate(
        "test.package",
        &package_fixture(&[
            (keys[0], b"second", false),
            (keys[0], b"duplicate", false),
            (keys[1], b"first", false)
        ]),
        &identity,
        &|| Ok(())
    )
    .is_err());
    assert_eq!(
        sims_fingerprints::calculate("test.package", &package, &identity, &|| Err(
            "sims_canceled"
        ))
        .unwrap_err(),
        "sims_canceled"
    );
}
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let parent = std::env::var_os("HARBOR_SIMS_PROOF_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = parent.join(format!("harbor-sims-dependencies-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(root.join("Mods")).unwrap();
        fs::create_dir(root.join("saves")).unwrap();
        fs::write(
            root.join("Options.ini"),
            "[options]\nmodsdisabled = 0\nscriptmodsenabled = 1",
        )
        .unwrap();
        fs::write(root.join("GameVersion.txt"), "1.120.123.1020").unwrap();
        Self(root.canonicalize().unwrap())
    }
    fn path(&self) -> &str {
        self.0.to_str().unwrap()
    }
    fn put(&self, name: &str, bytes: &[u8]) {
        let p = self.0.join("Mods").join(name);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, bytes).unwrap();
    }
    fn scan(&self) -> Report {
        scan(
            "proof",
            self.path(),
            &uuid::Uuid::new_v4().to_string(),
            |_| {},
        )
        .unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if self
            .0
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("harbor-sims-dependencies-")
            && files::directory(&self.0).is_ok()
        {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}

#[test]
fn dependencies_changed_or_unverifiable_manifests_cannot_confirm_absence() {
    let f = Fixture::new();
    f.put(
        "dependent.ts4script",
        &script(
            "Dependent",
            &format!("required_mods:\n- name: Core\n  hashes: [{CORE}]\n"),
        ),
    );
    let bytes = script("Changed", "");
    let mut source = zip::ZipArchive::new(Cursor::new(&bytes)).unwrap();
    let mut changed = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for index in 0..source.len() {
        let mut file = source.by_index(index).unwrap();
        changed
            .start_file(file.name(), zip::write::SimpleFileOptions::default())
            .unwrap();
        if file.name() == "mod.pyc" {
            changed
                .write_all(b"Changed bytecode; never executed")
                .unwrap();
        } else {
            std::io::copy(&mut file, &mut changed).unwrap();
        }
    }
    let changed = changed.finish().unwrap().into_inner();
    package::validate_script_checked(&changed, &|| Ok(())).unwrap();
    f.put("changed.ts4script", &changed);
    let report = f.scan();
    assert!(report.partial);
    assert_eq!(report.requirements[0].status, Status::Unchecked);
    f.put("core.ts4script", &real_core());
    assert_eq!(f.scan().requirements[0].status, Status::Found);
}

#[test]
fn dependencies_script_exclusions_and_order_follow_the_manifest_format() {
    let mut archive = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (name, bytes) in [
        ("z.py", b"last".as_slice()),
        ("folder/", b"".as_slice()),
        ("excluded.py", b"ignored".as_slice()),
        ("a.py", b"first".as_slice()),
    ] {
        archive
            .start_file(name, zip::write::SimpleFileOptions::default())
            .unwrap();
        archive.write_all(bytes).unwrap();
    }
    let bytes = archive.finish().unwrap().into_inner();
    let value = manifest::from_yaml(
        &format!("name: Mod\nhash: {CORE}\nexcluded_entries: [excluded.py]\n"),
        &|| Ok(()),
    )
    .unwrap();
    let mut source = zip::ZipArchive::new(Cursor::new(&bytes)).unwrap();
    let mut expected = Sha256::new();
    for name in ["a.py", "folder/", "z.py"] {
        let member = source.by_name(name).unwrap();
        expected.update(name.as_bytes());
        expected.update(member.crc32().to_le_bytes());
    }
    package::validate_script_checked(&bytes, &|| Ok(())).unwrap();
    assert_eq!(
        sims_fingerprints::calculate(
            "mod.ts4script",
            &bytes,
            value.identity.as_ref().unwrap(),
            &|| Ok(())
        )
        .unwrap(),
        format!("{:x}", expected.finalize())
    );
}

#[test]
fn dependencies_merged_package_manifests_resolve_individual_resource_contents() {
    let resource = (0x03b33ddfu32, 1u32, 42u64);
    let content = b"Synthetic library tuning";
    let mut hash = Sha256::new();
    hash.update(resource.2.to_le_bytes());
    hash.update(resource.0.to_le_bytes());
    hash.update(resource.1.to_le_bytes());
    hash.update(content);
    let digest = format!("{:x}", hash.finalize());
    let definition = format!(
        r#"<I c="ModFileManifest" i="snippet" m="llamalogic.snippets.modfilemanifest"><T n="name">Library</T><T n="hash">{digest}</T><L n="hash_resource_keys"><T>03b33ddf:00000001:000000000000002a</T></L><L n="features"><T>TuningService</T></L></I>"#
    );
    let dependent = format!(
        r#"<I c="ModFileManifest" i="snippet" m="llamalogic.snippets.modfilemanifest"><T n="name">Garden</T><T n="hash">{digest}</T><L n="hash_resource_keys"><T>03b33ddf:00000001:000000000000002a</T></L><L n="required_mods"><U><T n="name">Library</T><L n="hashes"><T>{digest}</T></L><L n="required_features"><T>TuningService</T></L></U></L></I>"#
    );
    let f = Fixture::new();
    f.put(
        "merged.package",
        &package_fixture(&[
            (resource, content, true),
            ((0x7df2169c, 1, 1), definition.as_bytes(), true),
            ((0x7df2169c, 1, 2), dependent.as_bytes(), false),
        ]),
    );
    let report = f.scan();
    assert!(!report.partial);
    assert_eq!(report.requirements.len(), 1);
    assert_eq!(report.requirements[0].status, Status::Found);
    assert_eq!(report.requirements[0].matched_files, ["merged.package"]);
    f.put(
        "merged.package",
        &package_fixture(&[
            (resource, b"Changed tuning", true),
            ((0x7df2169c, 1, 1), definition.as_bytes(), true),
            ((0x7df2169c, 1, 2), dependent.as_bytes(), false),
        ]),
    );
    let report = f.scan();
    assert!(report.partial);
    assert_eq!(report.requirements[0].status, Status::Unchecked);
}
