use super::*;

#[test]
fn process_scope_keeps_custom_profiles_roots_and_unsigned_shortcut_identity_separate() {
    let root = std::env::current_dir().unwrap();
    assert_ne!(scope("a", &root).unwrap(), scope("b", &root).unwrap());
    assert_ne!(
        scope("a", &root).unwrap(),
        scope("a", root.parent().unwrap()).unwrap()
    );
    assert!(scope("", &root).is_err());
    assert!(scope("a\0b", &root).is_err());
    for (account, app) in [(1, 0x8000_0000), (u32::MAX, u32::MAX)] {
        assert_eq!(
            shortcut_id(&engine_id(account, &format!("steam-shortcut:{account}:{app}")).unwrap()),
            Some(format!("steam-shortcut:{account}:{app}"))
        );
    }
    assert_eq!(shortcut_id("ffffffff-ffff-4fff-afff-ffffffffffff"), None);
}

#[test]
fn argument_parsing_preserves_empty_unicode_quotes_and_literal_shell_characters() {
    #[cfg(windows)]
    assert_eq!(
        arguments(r#"--title "雨 & dusk" "" "quoted\"word" "C:\trailing\\" "$(literal);%PATH%""#)
            .unwrap(),
        vec![
            "--title",
            "雨 & dusk",
            "",
            "quoted\"word",
            "C:\\trailing\\",
            "$(literal);%PATH%"
        ]
    );
    assert_eq!(
        posix_arguments(r#"--title '雨 & dusk' "" "a\"b" path\ with\ spaces '$HOME;$(literal)'"#)
            .unwrap(),
        vec![
            "--title",
            "雨 & dusk",
            "",
            "a\"b",
            "path with spaces",
            "$HOME;$(literal)"
        ]
    );
    assert!(posix_arguments("'unfinished").is_err());
    assert!(posix_arguments("trailing\\").is_err());
    assert!(arguments("hello\0there").is_err());
    assert!(arguments("hello\nthere").is_err());
    assert_eq!(arguments("env OPTION=1 %command%"), Err("shortcut_options"));
    assert!(arguments(&"a ".repeat(130)).is_err());
}

struct Fixture(std::path::PathBuf);
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!("shortcut-launch-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("userdata/123/config")).unwrap();
        Self(root)
    }
    fn write(&self, review: &Review) {
        let mut bytes = b"\0shortcuts\0\x000\0\x02appid\0".to_vec();
        bytes.extend_from_slice(&0x87654321u32.to_le_bytes());
        for (name, value) in [
            ("AppName", "Controlled shortcut"),
            ("Exe", review.executable.as_str()),
            ("StartDir", review.start_directory.as_str()),
            ("LaunchOptions", review.launch_options.as_str()),
        ] {
            bytes.push(1);
            bytes.extend_from_slice(name.as_bytes());
            bytes.push(0);
            bytes.extend_from_slice(value.as_bytes());
            bytes.push(0);
        }
        bytes.extend_from_slice(&[8, 8, 8]);
        std::fs::write(self.0.join("userdata/123/config/shortcuts.vdf"), bytes).unwrap();
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if self
            .0
            .file_name()
            .is_some_and(|name| name.to_string_lossy().starts_with("shortcut-launch-"))
        {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
}

#[test]
fn preparation_rechecks_reviewed_values_and_validates_real_executable_and_directory() {
    let fixture = Fixture::new();
    let review = Review {
        executable: format!("\"{}\"", std::env::current_exe().unwrap().display()),
        start_directory: format!("\"{}\"", fixture.0.display()),
        launch_options: "--flag \"two words\"".into(),
    };
    fixture.write(&review);
    let config = prepare(&fixture.0, 123, "steam-shortcut:123:2271560481", &review).unwrap();
    assert_eq!(config.arguments, vec!["--flag", "two words"]);
    assert_eq!(config.mode, "native");
    assert_eq!(
        Path::new(config.working_directory.as_ref().unwrap())
            .canonicalize()
            .unwrap(),
        fixture.0.canonicalize().unwrap()
    );
    for field in [0, 1, 2] {
        let mut changed = review.clone();
        match field {
            0 => changed.executable.push('x'),
            1 => changed.start_directory.push('x'),
            _ => changed.launch_options.push('x'),
        };
        fixture.write(&changed);
        assert_eq!(
            prepare(&fixture.0, 123, "steam-shortcut:123:2271560481", &review).err(),
            Some("shortcut_changed")
        );
    }
    let mut invalid = review.clone();
    invalid.start_directory = "relative folder".into();
    fixture.write(&invalid);
    assert_eq!(
        prepare(&fixture.0, 123, "steam-shortcut:123:2271560481", &invalid).err(),
        Some("launch_directory")
    );
    invalid = review.clone();
    invalid.executable = format!("\"{}\"", fixture.0.join("missing.exe").display());
    fixture.write(&invalid);
    assert!(prepare(&fixture.0, 123, "steam-shortcut:123:2271560481", &invalid).is_err());
    std::fs::remove_file(fixture.0.join("userdata/123/config/shortcuts.vdf")).unwrap();
    assert_eq!(
        prepare(&fixture.0, 123, "steam-shortcut:123:2271560481", &review).err(),
        Some("shortcut_missing")
    );
}

#[cfg(windows)]
#[test]
#[ignore = "requires an explicitly built harmless argv capture executable"]
fn actual_direct_launch_preserves_arguments_working_folder_and_exit_scope() {
    let fixture = Fixture::new();
    let exe = std::env::var("HARBOR_LAUNCH_TEST_EXE").unwrap();
    let output = fixture.0.join("received.json");
    let review = Review {
        executable: format!("\"{exe}\""),
        start_directory: format!("\"{}\"", fixture.0.display()),
        launch_options: format!(
            r#""{}" "" "雨 & two words" "quote\"inside" "$(literal);%PATH%""#,
            output.display()
        ),
    };
    fixture.write(&review);
    let (send, receive) = std::sync::mpsc::channel();
    let started = launch(
        "direct-proof".into(),
        &fixture.0,
        123,
        "steam-shortcut:123:2271560481",
        review,
        move |event| {
            let _ = send.send(event);
        },
    )
    .unwrap();
    let ended = receive
        .recv_timeout(std::time::Duration::from_secs(10))
        .unwrap();
    assert_eq!(started.profile, "direct-proof");
    assert_eq!(started.id, "steam-shortcut:123:2271560481");
    assert_eq!(started.session_id, ended.session_id);
    assert!(running("direct-proof", &fixture.0).unwrap().is_empty());
    assert!(custom_launch::running("direct-proof".into()).is_empty());
    assert!(
        custom_launch::history("direct-proof".into()).is_empty(),
        "shortcut processes never create custom-library sessions"
    );
    let data: serde_json::Value = serde_json::from_slice(&std::fs::read(output).unwrap()).unwrap();
    assert_eq!(
        data["arguments"]
            .as_array()
            .unwrap()
            .iter()
            .skip(1)
            .cloned()
            .collect::<Vec<_>>(),
        serde_json::json!(["", "雨 & two words", "quote\"inside", "$(literal);%PATH%"])
            .as_array()
            .unwrap()
            .clone()
    );
    assert_eq!(
        Path::new(data["directory"].as_str().unwrap())
            .canonicalize()
            .unwrap(),
        fixture.0.canonicalize().unwrap()
    );
}

#[test]
fn local_process_identity_round_trips_without_source_files_or_a_steam_id() {
    for account in [1, 123, u32::MAX] {
        let local = format!("steam-shortcut:{account}:local-0123456789abcdef012345");
        assert_eq!(
            shortcut_id(&engine_id(account, &local).unwrap()),
            Some(local)
        );
    }
    assert!(engine_id(123, "steam-shortcut:124:local-0123456789abcdef012345").is_err());
    assert_eq!(shortcut_id("01000000-0000-0000-0000-000000000000"), None);
}

#[cfg(windows)]
#[test]
#[ignore = "requires an explicitly built harmless argv capture executable"]
fn actual_legacy_launch_tracks_its_local_identity_after_the_shortcut_file_changes() {
    let fixture = Fixture::new();
    let output = fixture.0.join("legacy-received.json");
    let review = Review {
        executable: format!("\"{}\"", std::env::var("HARBOR_LAUNCH_TEST_EXE").unwrap()),
        start_directory: format!("\"{}\"", fixture.0.display()),
        launch_options: format!("\"{}\" --hold-proof", output.display()),
    };
    fixture.write(&review);
    let file = fixture.0.join("userdata/123/config/shortcuts.vdf");
    let mut data = std::fs::read(&file).unwrap();
    data[21..25].fill(0);
    std::fs::write(&file, &data).unwrap();
    let game = steam_shortcuts::read_account(&fixture.0, 123)
        .unwrap()
        .remove(0);
    assert!(game.steam_app_id().is_none());
    let id = game.id();
    let (send, receive) = std::sync::mpsc::channel();
    let started = launch(
        "legacy-proof".into(),
        &fixture.0,
        123,
        &id,
        review.clone(),
        move |event| {
            let _ = send.send(event);
        },
    )
    .unwrap();
    assert_eq!(started.id, id);
    assert!(running("legacy-proof", &fixture.0)
        .unwrap()
        .iter()
        .any(|value| value.id == id && value.session_id == started.session_id));
    assert_eq!(
        launch(
            "legacy-proof".into(),
            &fixture.0,
            123,
            &id,
            review.clone(),
            |_| {}
        )
        .err(),
        Some("launch_running")
    );
    assert!(running("another-profile", &fixture.0).unwrap().is_empty());
    std::fs::write(&file, b"\0shortcuts\0\x08\x08").unwrap();
    assert!(running("legacy-proof", &fixture.0)
        .unwrap()
        .iter()
        .any(|value| value.id == id));
    assert!(prepare(&fixture.0, 123, &id, &review).is_err());
    let ended = receive
        .recv_timeout(std::time::Duration::from_secs(10))
        .unwrap();
    assert_eq!(ended.id, id);
    assert_eq!(ended.session_id, started.session_id);
    assert!(running("legacy-proof", &fixture.0).unwrap().is_empty());
    assert!(custom_launch::history("legacy-proof".into()).is_empty());
    let captured: serde_json::Value =
        serde_json::from_slice(&std::fs::read(output).unwrap()).unwrap();
    assert_eq!(captured["arguments"][1], "--hold-proof");
}
