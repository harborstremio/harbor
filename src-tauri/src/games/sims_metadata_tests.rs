use super::*;
use std::{fs, io::Write, path::PathBuf};

const XML: &str = r#"<?xml version="1.0"?><I c="ModFileManifest" i="snippet" m="llamalogic.snippets.modfilemanifest" n="creator.mod" s="42"><T n="name">Garden &amp; Weather</T><T n="version">1.40</T><L n="creators"><T>A creator</T></L><L n="required_packs"><T>EP05</T></L><L n="required_mods"><U><T n="name">Shared library</T><T n="version">2.0</T><T n="url">https://example.com/library</T><L n="required_features"><T>GardenService</T></L><T n="ignore_if_pack_unavailable">EP05</T></U></L></I>"#;
fn package_xml(contents: &[&[u8]]) -> Vec<u8> {
    let mut bytes = vec![0u8; 96];
    bytes[..4].copy_from_slice(b"DBPF");
    bytes[4..8].copy_from_slice(&2u32.to_le_bytes());
    bytes[8..12].copy_from_slice(&1u32.to_le_bytes());
    let mut entries = Vec::new();
    for (index, raw) in contents.iter().enumerate() {
        let mut packed =
            flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
        packed.write_all(raw).unwrap();
        let packed = packed.finish().unwrap();
        entries.push([
            0x7df2169cu32,
            1,
            0,
            index as u32,
            bytes.len() as u32,
            packed.len() as u32 | 0x8000_0000,
            raw.len() as u32,
            0x0001_5a42,
        ]);
        bytes.extend_from_slice(&packed);
    }
    bytes[36..40].copy_from_slice(&(contents.len() as u32).to_le_bytes());
    bytes[44..48].copy_from_slice(&(4 + contents.len() as u32 * 32).to_le_bytes());
    let offset = bytes.len() as u64;
    bytes[64..72].copy_from_slice(&offset.to_le_bytes());
    bytes.extend_from_slice(&0u32.to_le_bytes());
    for entry in entries {
        for word in entry {
            bytes.extend_from_slice(&word.to_le_bytes());
        }
    }
    bytes
}

#[test]
fn yaml_preserves_versions_text_and_conditional_requirements_without_trusting_links() {
    let text = "name: 'A creator: mod'\nversion: 1.40\ndescription: |\n  First line.\n  Second line.\ncreators: [Alice, Bob]\nurl: https://example.com/mod\nrequired_mods:\n- name: Shared library\n  version: 2.0\n  required_features: [Weather]\n  requirement_identifier: alternative\n  url: javascript:alert(1)\n";
    let info = manifest::from_yaml(text, &|| Ok(())).unwrap();
    assert_eq!(info.name, "A creator: mod");
    assert_eq!(info.version.as_deref(), Some("1.40"));
    assert_eq!(info.creators, ["Alice", "Bob"]);
    assert!(info.description.unwrap().contains('\n'));
    assert!(info.requirements[0].conditional);
    assert_eq!(info.requirements[0].features, ["Weather"]);
    assert!(info.requirements[0].url.is_none());
    for url in [
        "https://127.0.0.1/a",
        "https://localhost/a",
        "https://host.local/a",
        "https://name:pass@example.com/",
        "file:///C:/file",
        "https://example.com:9999/a",
    ] {
        assert!(
            manifest::from_yaml(&format!("name: Name\nurl: {url}"), &|| Ok(()))
                .unwrap()
                .url
                .is_none()
        );
    }
    assert!(
        manifest::from_yaml("name: Name\nversion: null\ndescription: ~", &|| Ok(()))
            .unwrap()
            .version
            .is_none()
    );
}

#[test]
fn yaml_rejects_aliases_duplicate_keys_tags_multiple_documents_and_limits() {
    for value in [
        "name: First\nname: Second",
        "name: &x Mod\ndescription: *x",
        "name: !!str Mod",
        "name: One\n---\nname: Two",
        "name: [not, text]",
        "name: null",
    ] {
        assert!(manifest::from_yaml(value, &|| Ok(())).is_err(), "{value}");
    }
    assert!(manifest::from_yaml(
        &format!("name: N\nextra: {}x{}", "[".repeat(13), "]".repeat(13)),
        &|| Ok(())
    )
    .is_err());
    assert!(
        manifest::from_yaml(&format!("name: N\nextra: [{}]", "x,".repeat(5000)), &|| Ok(
            ()
        ))
        .is_err()
    );
    assert!(manifest::from_yaml(&"a".repeat(manifest::MAX_TEXT + 1), &|| Ok(())).is_err());
    assert_eq!(
        manifest::from_yaml("name: N", &|| Err("sims_canceled")).unwrap_err(),
        "sims_canceled"
    );
}

#[test]
fn package_xml_preserves_merged_manifests_entities_and_qualified_requirements() {
    let other = XML.replace("Garden &amp; Weather", "Another mod");
    let bytes = package_xml(&[
        XML.as_bytes(),
        other.as_bytes(),
        b"<I c=\"Unrelated\" n=\"ordinary.snippet\"><T n=\"value\">5</T></I>",
    ]);
    let (found, partial) = extract("example.package", &bytes, &|| Ok(())).unwrap();
    assert!(!partial);
    assert_eq!(found.len(), 2);
    assert_eq!(found[0].name, "Garden & Weather");
    assert_eq!(found[1].name, "Another mod");
    assert_eq!(found[0].required_packs, ["EP05"]);
    assert!(found[0].requirements[0].conditional);
    assert_eq!(found[0].requirements[0].features, ["GardenService"]);
    assert_eq!(package::inspect(&bytes, false).unwrap().resources, 3);
}

#[test]
fn malformed_xml_and_bounded_snippets_do_not_make_valid_packages_unusable() {
    assert!(manifest::from_xml(
        &format!("<!DOCTYPE I [<!ENTITY ext SYSTEM 'file:///secret'>]>{XML}"),
        &|| Ok(())
    )
    .is_err());
    assert!(
        manifest::from_xml(&XML.replace("<T n=\"version\">", "<T n=\"name\">"), &|| Ok(
            ()
        ))
        .is_err()
    );
    let large = vec![b'a'; manifest::MAX_TEXT + 1];
    let data = package_xml(&[&large, XML.as_bytes()]);
    let (found, partial) = extract("example.package", &data, &|| Ok(())).unwrap();
    assert!(partial);
    assert_eq!(found.len(), 1);
    assert!(package::inspect(&data, false).is_ok());
    let chunks = vec![XML.as_bytes(); 65];
    assert!(
        package::snippets_checked(&package_xml(&chunks), &|| Ok(()))
            .unwrap()
            .1
    );
}

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("HARBOR_SIMS_PROOF_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let p = base.join(format!("harbor-sims-metadata-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(p.join("Mods")).unwrap();
        fs::create_dir(p.join("saves")).unwrap();
        fs::write(p.join("GameVersion.txt"), "1.120.123.1020").unwrap();
        fs::write(
            p.join("Options.ini"),
            "[options]\nmodsdisabled=0\nscriptmodsenabled=1",
        )
        .unwrap();
        Self(p.canonicalize().unwrap())
    }
    fn path(&self) -> &str {
        self.0.to_str().unwrap()
    }
    fn read(&self, target: Target) -> Report {
        inspect(
            "proof",
            self.path(),
            target,
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
            .starts_with("harbor-sims-metadata-")
            && files::directory(&self.0).is_ok()
        {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}

#[test]
fn metadata_reads_loose_enabled_and_disabled_files_without_writing_or_claiming_source() {
    let f = Fixture::new();
    let bytes = package_xml(&[XML.as_bytes()]);
    fs::write(f.0.join("Mods/loose.package"), &bytes).unwrap();
    let result = f.read(Target::File {
        file: "loose.package".into(),
    });
    assert_eq!(result.files[0].manifests[0].name, "Garden & Weather");
    assert!(!f.0.join(STORE).exists());
    let plan = super::super::plan(
        f.path(),
        super::super::Action::Install {
            title: "Sample group".into(),
        },
        vec![package::Payload {
            name: "managed.package".into(),
            bytes: bytes.clone(),
        }],
        vec![],
    )
    .unwrap();
    let state = super::super::Store::connect(f.path())
        .unwrap()
        .apply(plan)
        .unwrap();
    let id = state.groups[0].id.clone();
    assert!(state.groups[0].source.is_none());
    assert_eq!(f.read(Target::Group { id: id.clone() }).files.len(), 1);
    let plan = super::super::plan(
        f.path(),
        super::super::Action::Disable { id: id.clone() },
        vec![],
        vec![],
    )
    .unwrap();
    super::super::Store::connect(f.path())
        .unwrap()
        .apply(plan)
        .unwrap();
    assert_eq!(
        f.read(Target::Group { id }).files[0].manifests[0]
            .version
            .as_deref(),
        Some("1.40")
    );
    assert_eq!(fs::read(f.0.join("Mods/loose.package")).unwrap(), bytes);
    assert!(inspect(
        "proof",
        f.path(),
        Target::File {
            file: "../Options.ini".into()
        },
        &uuid::Uuid::new_v4().to_string(),
        |_| {}
    )
    .is_err());
    let op = uuid::Uuid::new_v4().to_string();
    assert_eq!(
        inspect(
            "proof",
            f.path(),
            Target::File {
                file: "loose.package".into()
            },
            &op,
            |p| {
                if p.file.is_some() {
                    progress::cancel("proof", &op);
                }
            }
        )
        .unwrap_err(),
        "sims_canceled"
    );
}

#[test]
fn actual_core_library_manifest_has_original_creator_name_and_version() {
    let Some(base) = std::env::var_os("HARBOR_SIMS_LOT51_FIXTURES") else {
        return;
    };
    let data = fs::read(PathBuf::from(base).join("lot51-core-live.zip")).unwrap();
    let import = package::unpack_zip(&data).unwrap();
    let script = import
        .files
        .iter()
        .find(|f| f.name.ends_with(".ts4script"))
        .unwrap();
    let (found, partial) = extract(&script.name, &script.bytes, &|| Ok(())).unwrap();
    assert!(!partial);
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].name, "Lot 51 Core Library");
    assert_eq!(found[0].version.as_deref(), Some("1.43"));
    assert_eq!(found[0].creators, ["Lot 51"]);
    assert_eq!(found[0].url.as_deref(), Some("https://lot51.cc/core"));
    let f = Fixture::new();
    let source = f.0.join("Core.zip");
    fs::write(&source, &data).unwrap();
    let review = sims_reviews::review(
        "proof".into(),
        f.path().into(),
        super::super::Action::Install {
            title: "My Core Library".into(),
        },
        vec![source.to_str().unwrap().into()],
    )
    .unwrap();
    let info = review.information.as_ref().unwrap();
    assert!(!info.partial);
    assert_eq!(info.files[0].manifests[0].name, "Lot 51 Core Library");
    assert_eq!(info.files[0].manifests[0].version.as_deref(), Some("1.43"));
    assert!(review.source.is_none());
    assert!(snapshot(f.path()).unwrap().0.groups.is_empty());
    sims_reviews::discard("proof", &review.token);
}

#[test]
fn import_metadata_describes_held_bytes_before_apply_and_update_cancel_keeps_installed_files() {
    let f = Fixture::new();
    let source = f.0.join("incoming.package");
    let original = package_xml(&[XML.as_bytes()]);
    fs::write(&source, &original).unwrap();
    let review = sims_reviews::review(
        "proof".into(),
        f.path().into(),
        super::super::Action::Install {
            title: "Chosen title".into(),
        },
        vec![source.to_str().unwrap().into()],
    )
    .unwrap();
    let metadata = review.information.as_ref().unwrap();
    assert_eq!(metadata.files[0].manifests[0].name, "Garden & Weather");
    assert!(metadata.files[0].manifests[0].requirements[0].conditional);
    assert!(snapshot(f.path()).unwrap().0.groups.is_empty());
    assert_eq!(fs::read_dir(f.0.join("Mods")).unwrap().count(), 0);
    let changed = package_xml(&[XML
        .replace("Garden &amp; Weather", "A different incoming version")
        .as_bytes()]);
    fs::write(&source, &changed).unwrap();
    let applied = sims_reviews::apply("proof".into(), review.token).unwrap();
    let group = &applied.state.groups[0];
    assert_eq!(group.title, "Chosen title");
    assert!(group.source.is_none());
    let installed =
        f.0.join(format!("Mods/Harbor-{}/incoming.package", group.id));
    assert_eq!(fs::read(&installed).unwrap(), original);
    let update = sims_reviews::review(
        "proof".into(),
        f.path().into(),
        super::super::Action::Update {
            id: group.id.clone(),
        },
        vec![source.to_str().unwrap().into()],
    )
    .unwrap();
    assert_eq!(
        update.information.as_ref().unwrap().files[0].manifests[0].name,
        "A different incoming version"
    );
    sims_reviews::discard("proof", &update.token);
    assert_eq!(fs::read(installed).unwrap(), original);
}

#[test]
fn invalid_optional_metadata_does_not_block_a_supported_package_review_or_apply() {
    let f = Fixture::new();
    let source = f.0.join("supported.package");
    let bytes = package_xml(&[b"<I c=\"ModFileManifest\" i=\"snippet\" m=\"llamalogic.snippets.modfilemanifest\"><T n=\"name\">Unclosed"]);
    fs::write(&source, &bytes).unwrap();
    let review = sims_reviews::review(
        "proof".into(),
        f.path().into(),
        super::super::Action::Install {
            title: "Optional metadata".into(),
        },
        vec![source.to_str().unwrap().into()],
    )
    .unwrap();
    let report = review.information.as_ref().unwrap();
    assert!(report.partial);
    assert!(report.files.is_empty());
    let state = sims_reviews::apply("proof".into(), review.token)
        .unwrap()
        .state;
    assert_eq!(
        fs::read(f.0.join(format!(
            "Mods/Harbor-{}/supported.package",
            state.groups[0].id
        )))
        .unwrap(),
        bytes
    );
}

#[test]
fn metadata_reports_bound_total_manifests_and_keep_cancellation_effective() {
    let texts: Vec<_> = (0..16).map(|_| XML.as_bytes()).collect();
    let bytes = package_xml(&texts);
    let payload: Vec<_> = (0..3)
        .map(|index| package::Payload {
            name: format!("merged-{index}.package"),
            bytes: bytes.clone(),
        })
        .collect();
    let report = incoming_validated(&payload, &|| Ok(())).unwrap().unwrap();
    assert!(report.partial);
    assert_eq!(
        report
            .files
            .iter()
            .map(|entry| entry.manifests.len())
            .sum::<usize>(),
        32
    );
    assert!(
        !incoming_validated(&payload[..2], &|| Ok(()))
            .unwrap()
            .unwrap()
            .partial
    );
    let calls = std::cell::Cell::new(0);
    let check = || {
        calls.set(calls.get() + 1);
        if calls.get() > 2 {
            Err("sims_canceled")
        } else {
            Ok(())
        }
    };
    assert_eq!(
        incoming_validated(&payload, &check).unwrap_err(),
        "sims_canceled"
    );
    assert!(incoming_validated(
        &[package::Payload {
            name: "creator.json".into(),
            bytes: b"{}".to_vec()
        }],
        &|| Ok(())
    )
    .unwrap()
    .is_none());
    let f = Fixture::new();
    let plan = super::super::plan(
        f.path(),
        super::super::Action::Install {
            title: "Merged files".into(),
        },
        payload,
        vec![],
    )
    .unwrap();
    let state = super::super::Store::connect(f.path())
        .unwrap()
        .apply(plan)
        .unwrap();
    let report = f.read(Target::Group {
        id: state.groups[0].id.clone(),
    });
    assert!(report.partial);
    assert_eq!(
        report
            .files
            .iter()
            .map(|entry| entry.manifests.len())
            .sum::<usize>(),
        32
    );
}
