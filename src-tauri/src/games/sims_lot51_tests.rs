use super::*;
fn observed() -> Option<std::path::PathBuf> {
    std::env::var_os("HARBOR_SIMS_LOT51_FIXTURES").map(std::path::PathBuf::from)
}
fn catalog_fixture(root: &std::path::Path) -> Catalog {
    let value: serde_json::Value =
        serde_json::from_slice(&std::fs::read(root.join("lot51-mods-live.json")).unwrap()).unwrap();
    parse_catalog(value["html"].as_str().unwrap()).unwrap()
}
#[test]
fn creator_versions_are_numeric_and_source_metadata_stays_backward_compatible() {
    assert!(store::creator_version("1.43") > store::creator_version("1.9"));
    assert_eq!(
        store::creator_version("1.43"),
        store::creator_version("1.43.0")
    );
    for v in ["", "a", "1.2.3.4.5", "1..2", "1.0-alpha", "9999999"] {
        assert!(store::creator_version(v).is_none());
    }
    let old: store::CreatorSource = serde_json::from_value(serde_json::json!({"provider":"mccc","version":"2026.5.0","gamePatch":"1.128.90.1030","archiveHash":"a".repeat(64)})).unwrap();
    old.validate().unwrap();
    assert!(old.project.is_none());
    let mut source = store::CreatorSource {
        provider: "lot51".into(),
        project: Some("fashion-authority".into()),
        required_core: Some("1.27".into()),
        version: "2.5.1".into(),
        game_patch: String::new(),
        archive_hash: "a".repeat(64),
    };
    source.validate().unwrap();
    source.project = Some("core-library".into());
    assert!(source.validate().is_err());
    source.required_core = None;
    source.validate().unwrap();
    source.game_patch = "1.128.90.1030".into();
    assert!(source.validate().is_err());
}
#[test]
fn catalog_fallback_is_dated_and_does_not_substitute_dlc_badges_for_mod_art() {
    let c = cached_catalog().unwrap();
    assert!(c.cached);
    assert_eq!(c.projects.len(), 21);
    assert!(c.observed_at > 1_790_000_000);
    let bird = c.projects.iter().find(|p| p.slug == "bird-life").unwrap();
    assert!(bird.icon.ends_with("/icon-bird-life.png"));
    let no_art = c
        .projects
        .iter()
        .find(|p| p.slug == "disable-telemetry")
        .unwrap();
    assert!(no_art.icon.is_empty());
    assert!(no_art.image.is_empty());
    assert_eq!(cached_catalog().unwrap().observed_at, c.observed_at);
}
#[test]
fn observed_catalog_and_forms_keep_public_metadata_separate_from_download_tokens() {
    let Some(root) = observed() else {
        return;
    };
    let c = catalog_fixture(&root);
    let native_html = std::fs::read_to_string(root.join("lot51-home-native-agent.html")).unwrap();
    assert_eq!(parse_catalog(&native_html).unwrap().projects.len(), 21);
    assert_eq!(c.projects.len(), 21);
    for (slug, file, version, dependency) in [
        ("core-library", "core", "1.43", None),
        ("fashion-authority", "fashion", "2.5.1", Some("1.27")),
    ] {
        let p = c.projects.iter().find(|p| p.slug == slug).unwrap().clone();
        assert_eq!(p.version, version);
        assert!(p.icon.starts_with("https://lot51.cc/sites/default/files/"));
        let html = std::fs::read_to_string(root.join(format!("lot51-{file}-live.html"))).unwrap();
        let d = parse_detail(p.clone(), &html).unwrap();
        assert_eq!(d.required_core.as_deref(), dependency);
        let serialized = serde_json::to_string(&d).unwrap();
        assert!(!serialized.contains("form_build_id"));
        assert!(!serialized.contains("form-"));
        assert!(!serialized.contains("ajax_form"));
        assert_eq!(d.packs, ["Base Game Compatible"]);
        assert!(parse_detail(p.clone(), &html.replace("ajax_form=1", "ajax_form=2")).is_err());
        assert!(parse_detail(p, &html.replace("form_build_id", "unexpected")).is_err());
    }
    let value: serde_json::Value =
        serde_json::from_slice(&std::fs::read(root.join("lot51-mods-live.json")).unwrap()).unwrap();
    assert!(parse_catalog(&value["html"].as_str().unwrap().replace(
        "https://lot51.cc/mods/core-library",
        "https://bad.test/mods/core-library"
    ))
    .is_err());
}
#[test]
fn archive_redirect_rejects_other_hosts_projects_versions_and_ambiguous_commands() {
    let d = Detail {
        project: Project {
            slug: "core-library".into(),
            title: "Core Library".into(),
            version: "1.43".into(),
            icon: String::new(),
            image: String::new(),
            subtitle: String::new(),
            page: String::new(),
        },
        description: String::new(),
        packs: vec![],
        required_core: None,
        changelog: String::new(),
        form: BTreeMap::new(),
        endpoint: String::new(),
        filename: "lot51_core_v1.43.zip".into(),
    };
    let valid = "https://download.lot51.cc/mods/core-library/lot51_core_v1.43.zip?signature=opaque";
    let command =
        |u: &str| serde_json::to_vec(&serde_json::json!([{"command":"redirect","url":u}])).unwrap();
    assert_eq!(redirect(&command(valid), &d).unwrap(), valid);
    for u in [
        valid.replace("download.lot51.cc", "evil.test"),
        valid.replace("https:", "http:"),
        valid.replace("core-library", "fashion-authority"),
        valid.replace("1.43", "1.42"),
        format!("{valid}#fragment"),
        valid.replace("download.lot51.cc", "download.lot51.cc@evil.test"),
    ] {
        assert!(redirect(&command(&u), &d).is_err());
    }
    assert!(redirect(br#"[{"command":"openDialog","data":"No download"}]"#, &d).is_err());
    assert!(redirect(&serde_json::to_vec(&serde_json::json!([{"command":"redirect","url":valid},{"command":"redirect","url":valid}])).unwrap(), &d).is_err());
    assert!(artwork("https://lot51.cc/elsewhere/image.png").is_err());
}
