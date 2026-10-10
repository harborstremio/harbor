use super::*;
fn page() -> String {
    r#"<meta property="og:url" content="https://modthesims.info/d/12345/example.html">
    <meta content="Jo &amp; Co" property="og:author">
    <meta property="og:image" content="https://thumbs.modthesims2.com/img/1/art.jpg">
    <meta property="og:description" content="Creator description">
    <h1><img src="//static.modthesims2.com/images/sims4logo_60px.jpg">A dress &amp; hat</h1>
    <a href="https://chii.modthesims.info/getfile.php?file=45678&amp;v=1790788660" class="downloadlink">dress.zip</a>
    <a class="downloadlink btn" href="https://chii.modthesims.info/getfile.php?file=45678&amp;v=1790788660">Download</a>
    <a class='downloadlink' href='https://chii.modthesims.info/getfile.php?file=45679&amp;v=1790788661'>hat.rar</a>
    <div id="epiconsmodal"><div><img src="//static.modthesims2.com//games/41.gif" alt="Sims 4"><img src="//static.modthesims2.com//games/114.gif" alt="For Rent"></div></div>
    <img src="//static.modthesims2.com//games/42.gif" alt="Unrelated recommendation">
    "#.into()
}
#[test]
fn public_page_urls_accept_only_project_identity() {
    for value in [
        "https://modthesims.info/d/12345/",
        "https://modthesims.info/d/12345/title.html#files",
        "https://modthesims.info/download.php?t=12345",
        "https://www.modthesims.info/d/12345",
    ] {
        assert_eq!(project(value).unwrap(), "12345");
    }
    for value in [
        "http://modthesims.info/d/12345/",
        "https://modthesims.info.evil.test/d/12345/",
        "https://u:p@modthesims.info/d/12345/",
        "https://modthesims.info/d/12345/a/b",
        "https://modthesims.info/download.php?t=12345&t=2",
        "https://modthesims.info/download.php?t=12345&next=abc",
        "https://modthesims.info/d/0/",
        "https://modthesims.info/d/../secret",
        "https://127.0.0.1/d/12345/",
        "https://modthesims.info:444/d/12345/",
    ] {
        assert!(project(value).is_err(), "{value}");
    }
}
#[test]
fn page_choices_keep_identity_art_and_pack_scope() {
    let detail = parse(&page(), "12345").unwrap();
    assert_eq!(detail.title, "A dress & hat");
    assert_eq!(detail.creator, "Jo & Co");
    assert_eq!(detail.files.len(), 2);
    assert_eq!(detail.files[0].version, "45678.1790788660");
    assert!(detail.files[0].supported);
    assert!(!detail.files[1].supported);
    assert_eq!(detail.packs, ["For Rent"]);
    assert!(!serde_json::to_string(&detail)
        .unwrap()
        .contains("getfile.php"));
    assert!(parse(&page().replace("sims4logo", "sims3logo"), "12345").is_err());
    assert!(parse(&page(), "12346").is_err());
    assert!(parse(&"x".repeat(PAGE_LIMIT + 1), "12345").is_err());
    assert!(parse(
        &page().replace("chii.modthesims.info", "evil.test"),
        "12345"
    )
    .is_err());
    assert!(parse(&page().replace("v=1790788660", "v=1&v=2"), "12345").is_err());
    assert!(parse(&page().replace("dress.zip", "../dress.zip"), "12345").is_err());
    assert!(parse(
        &page().replace("thumbs.modthesims2.com", "evil.test"),
        "12345"
    )
    .unwrap()
    .image
    .is_empty());
    assert!(parse(&(page() + r#"<a class="downloadlink" href="https://chii.modthesims.info/getfile.php?file=45678&v=1790788660">other.zip</a>"#), "12345").is_err());
}
#[test]
#[ignore = "Requires original provider HTML via HARBOR_SIMS_GAME_FIXTURES"]
fn older_sims_projects_are_browsable_but_never_installed_in_sims4() {
    let root = std::path::PathBuf::from(std::env::var("HARBOR_SIMS_GAME_FIXTURES").unwrap());
    for (game, id, name) in [
        (2, "679760", "Plantable Orchard Trees"),
        (3, "696922", "3D Sim Teeth Overhaul"),
    ] {
        let html =
            std::fs::read_to_string(root.join(format!("mts-sims{game}-detail.html"))).unwrap();
        let detail = parse(&html, id).unwrap();
        assert_eq!(detail.game, game);
        assert_eq!(detail.title, name);
        assert!(!detail.files.is_empty());
        assert!(detail.files.iter().all(|f| !f.supported));
        assert!(!detail.gallery.is_empty());
        assert!(detail.body.len() > 200);
        let relative = html.replace(
            "https://thumbs.modthesims2.com/",
            "//thumbs.modthesims2.com/",
        );
        assert_eq!(parse(&relative, id).unwrap().gallery, detail.gallery);
        let state = store::State {
            schema: 1,
            root: String::new(),
            revision: String::new(),
            groups: vec![],
            backups: vec![],
            troubleshoot: None,
        };
        assert!(action(&state, &detail, &detail.files[0], None).is_err());
    }
}
#[test]
fn mts_source_records_cannot_claim_patch_or_another_providers_dependency() {
    let mut source = store::CreatorSource {
        provider: "mts".into(),
        project: Some("12345".into()),
        version: "45678.1790788660".into(),
        required_core: None,
        game_patch: String::new(),
        archive_hash: "a".repeat(64),
    };
    source.validate().unwrap();
    source.required_core = Some("1.43".into());
    assert!(source.validate().is_err());
    source.required_core = None;
    source.game_patch = "1.128.0.0".into();
    assert!(source.validate().is_err());
    source.game_patch.clear();
    source.version = "45678.1790788660.1".into();
    assert!(source.validate().is_err());
    source.version = "45678.1790788660".into();
    source.project = Some("../project".into());
    assert!(source.validate().is_err());
}
#[test]
fn installs_and_updates_use_exact_project_receipts() {
    let mut detail = parse(&page(), "12345").unwrap();
    let selected = detail.files[0].clone();
    let mut state = store::State {
        schema: 1,
        root: String::new(),
        revision: "initial".into(),
        groups: vec![],
        backups: vec![],
        troubleshoot: None,
    };
    detail.title = "服".repeat(200);
    let store::Action::Install { title } = action(&state, &detail, &selected, None).unwrap() else {
        panic!("install");
    };
    assert!(title.len() <= 200);
    assert!(action(&state, &detail, &selected, Some("missing")).is_err());
    let source = store::CreatorSource {
        provider: "mts".into(),
        project: Some("12345".into()),
        version: selected.version.clone(),
        required_core: None,
        game_patch: String::new(),
        archive_hash: "a".repeat(64),
    };
    state.groups.push(store::Group {
        source: Some(source),
        id: "owned".into(),
        title: "Previous dress".into(),
        enabled: false,
        files: vec![],
        installed_at: 1,
        game_version: "1.128.0.0".into(),
    });
    assert!(action(&state, &detail, &selected, None).is_err());
    assert!(matches!(
        action(&state, &detail, &selected, Some("owned")),
        Ok(store::Action::Update { .. })
    ));
    assert!(action(&state, &detail, &detail.files[1], None).is_ok());
    state.groups[0].source.as_mut().unwrap().project = Some("99999".into());
    assert!(action(&state, &detail, &selected, Some("owned")).is_err());
    state.groups[0].source = None;
    assert!(action(&state, &detail, &selected, Some("owned")).is_err());
}
#[test]
fn observed_public_page_and_archive_are_real_sims4_content() {
    let Some(root) = std::env::var_os("HARBOR_SIMS_LOT51_FIXTURES").map(std::path::PathBuf::from)
    else {
        return;
    };
    let detail = parse(
        &std::fs::read_to_string(root.join("mts-example.html")).unwrap(),
        "701006",
    )
    .unwrap();
    assert_eq!(detail.creator, "Menaceman44");
    assert_eq!(detail.packs, ["For Rent"]);
    assert_eq!(detail.files.len(), 1);
    assert_eq!(detail.files[0].name, "MMCringeIconOverride.zip");
    let bytes = std::fs::read(root.join("mts-cringe-icon.zip")).unwrap();
    let unpacked = package::unpack_zip_checked(&bytes, &|| Ok(())).unwrap();
    assert_eq!(unpacked.files.len(), 1);
    assert_eq!(unpacked.files[0].name, "MMCringeIconOverride.package");
    assert!(package::unpack_zip_checked(b"<html>login required</html>", &|| Ok(())).is_err());
    assert!(package::unpack_zip_checked(&bytes, &|| Err("sims_canceled")).is_err());
}
