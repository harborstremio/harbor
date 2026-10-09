use super::*;
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = PathBuf::from(
            std::env::var_os("HARBOR_TEST_ROOT")
                .unwrap_or_else(|| std::env::temp_dir().into_os_string()),
        )
        .join(format!("sims-launch-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }
    fn put(&self, name: &str, text: &str) {
        let file = self.0.join(name);
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(file, text).unwrap();
    }
    fn game(&self) -> PathBuf {
        self.0.join("steamapps/common/The Sims 4")
    }
    fn setup(&self) {
        self.put(
            "steamapps/common/The Sims 4/Game/Bin/TS4_x64.exe",
            "fixture, never executed",
        );
        self.put(
            "steamapps/appmanifest_1222670.acf",
            r#""AppState" { "appid" "1222670" "installdir" "The Sims 4" }"#,
        );
    }
    fn options(&self, account: u32, options: &str) {
        self.put(&format!("userdata/{account}/config/localconfig.vdf"),&format!(r#""UserLocalConfigStore" {{ "Software" {{ "Valve" {{ "Steam" {{ "apps" {{ "1222670" {{ "LaunchOptions" "{options}" }} }} }} }} }} }}"#));
    }
    fn env(&self) -> Environment {
        Environment {
            steam_root: Some(self.0.clone()),
            steam_account: Some(123),
            ..Environment::default()
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn set(values: &[&str]) -> BTreeSet<String> {
    values.iter().map(|v| v.to_string()).collect()
}

#[test]
fn launch_options_parse_bounded_literal_flags_without_guessing_shell_wrappers_or_broken_tokens() {
    for raw in [
        "-disablepacks:EP05,GP01",
        "-w \"-disablepacks:ep05,gp01\"",
        "%command% -disablepacks:EP05,GP01",
    ] {
        assert_eq!(
            disabled(&words(raw).unwrap()).unwrap(),
            set(&["EP05", "GP01"])
        );
    }
    assert!(disabled(&words("-w -nosound").unwrap()).unwrap().is_empty());
    assert!(disabled(&words("-disablepacks:").unwrap())
        .unwrap()
        .is_empty());
    for raw in [
        "-disablepacks:EP05,",
        "-disablepacks:Season",
        "-disablepacks:EP05 -disablepacks:GP01",
        "-disablepacks EP05",
        "'-disablepacks:EP05'",
        "-DisablePacks:EP05",
        "-disablepacks:EP05;run",
        "foo%command%",
    ] {
        assert!(disabled(&words(raw).unwrap()).is_err(), "{raw}");
    }
    assert!(words("\"unfinished").is_err());
    assert!(words("-w\0secret").is_err());
    assert!(words(&"x".repeat(16385)).is_err());
}
#[test]
fn steam_reads_only_the_active_accounts_exact_sims_settings() {
    let f = Fixture::new();
    f.setup();
    f.options(123, "-disablepacks:EP05");
    f.options(456, "-disablepacks:GP01");
    let value = inspect(&f.game(), &[], &f.env(), &|| Ok(())).unwrap();
    assert_eq!(value.source, Some("steam"));
    assert_eq!(value.state, "checked");
    assert_eq!(value.disabled, set(&["EP05"]));
    let mut env = f.env();
    env.steam_account = None;
    assert_eq!(
        inspect(&f.game(), &[], &env, &|| Ok(())).unwrap().state,
        "unknown"
    );
    f.put(
        "steamapps/appmanifest_1222670.acf",
        r#""AppState" { "appid" "47890" "installdir" "The Sims 4" }"#,
    );
    assert_eq!(
        inspect(&f.game(), &[], &f.env(), &|| Ok(()))
            .unwrap()
            .source,
        None
    );
}
#[test]
fn steam_missing_flags_are_defaults_but_malformed_or_duplicate_records_are_unknown() {
    let f = Fixture::new();
    f.setup();
    f.put("userdata/123/config/localconfig.vdf",r#""UserLocalConfigStore" { "Software" { "Valve" { "Steam" { "apps" { "1222670" {} } } } } }"#);
    assert_eq!(
        inspect(&f.game(), &[], &f.env(), &|| Ok(())).unwrap().state,
        "checked"
    );
    for body in [
        r#""UserLocalConfigStore" { "Software" {} "software" {} }"#,
        r#""UserLocalConfigStore" { "Software" { "Valve" { "Steam" { "apps" { "1222670" { "LaunchOptions" "-disablepacks:EP05" "launchoptions" "" } } } } } }"#,
        "bad}",
    ] {
        f.put("userdata/123/config/localconfig.vdf", body);
        let v = inspect(&f.game(), &[], &f.env(), &|| Ok(())).unwrap();
        assert_eq!(v.state, "unknown");
        assert!(v.disabled.is_empty());
    }
}
#[test]
fn custom_options_require_exact_executable_location_and_preserve_conflicting_copies() {
    let f = Fixture::new();
    f.setup();
    f.options(123, "");
    let launch = CustomLaunch {
        executable: f
            .game()
            .join("Game/Bin/TS4_x64.exe")
            .to_string_lossy()
            .into_owned(),
        arguments: vec!["-disablepacks:EP05".into()],
    };
    let v = inspect(&f.game(), std::slice::from_ref(&launch), &f.env(), &|| {
        Ok(())
    })
    .unwrap();
    assert_eq!(v.source, Some("custom"));
    assert_eq!(v.disabled, set(&["EP05"]));
    let other = CustomLaunch {
        arguments: vec![],
        ..launch.clone()
    };
    let v = inspect(&f.game(), &[launch.clone(), other], &f.env(), &|| Ok(())).unwrap();
    assert_eq!(v.state, "conflicting");
    assert!(v.disabled.is_empty());
    let bad = CustomLaunch {
        executable: f.0.join("unrelated.exe").to_string_lossy().into_owned(),
        ..launch
    };
    let v = inspect(&f.game(), &[bad], &f.env(), &|| Ok(())).unwrap();
    assert_eq!(v.state, "unknown");
}
#[test]
fn ea_uses_exact_observed_offer_ids_and_consensus_across_user_configurations() {
    let f = Fixture::new();
    let game = f.0.join("EA Game");
    fs::create_dir_all(&game).unwrap();
    f.put(
        "EA/Logs/EADesktopVerbose.0.log",
        "offerId=[OFB-EAST:game] slug=[the-sims-4]\nofferId=[wrong] slug=[the-sims-3]\n",
    );
    f.put("EA/user_one.ini","\u{feff}user.gamecommandline.OFB-EAST:game=-disablepacks:EP05\nuser.gamecommandline.wrong=-disablepacks:GP01\n");
    let env = Environment {
        ea_root: Some(game.clone()),
        ea_data: Some(f.0.join("EA")),
        ..Environment::default()
    };
    let v = inspect(&game, &[], &env, &|| Ok(())).unwrap();
    assert_eq!(v.source, Some("ea"));
    assert_eq!(v.state, "checked");
    assert_eq!(v.disabled, set(&["EP05"]));
    f.put(
        "EA/user_two.ini",
        "user.gamecommandline.OFB-EAST:game=-disablepacks:EP05\n",
    );
    assert_eq!(
        inspect(&game, &[], &env, &|| Ok(())).unwrap().state,
        "checked"
    );
    f.put(
        "EA/user_two.ini",
        "user.gamecommandline.OFB-EAST:game=-disablepacks:GP01\n",
    );
    let v = inspect(&game, &[], &env, &|| Ok(())).unwrap();
    assert_eq!(v.state, "conflicting");
    assert!(v.disabled.is_empty());
    f.put(
        "EA/user_two.ini",
        "user.gamecommandline.OFB-EAST:game=-disablepacks:EP05\n",
    );
    f.put(
        "EA/Logs/EADesktopVerbose.0.log",
        "offerId=[OFB-EAST:game] slug=[the-sims-4]\nofferId=[OFB-EAST:other] slug=[the-sims-4]\n",
    );
    assert_eq!(
        inspect(&game, &[], &env, &|| Ok(())).unwrap().state,
        "conflicting",
        "an alias with default arguments cannot inherit another offer's disabled packs"
    );
    f.put(
        "EA/user_two.ini",
        "[General]\nuser.gamecommandline.OFB-EAST:game=-disablepacks:EP05\n",
    );
    assert_eq!(
        inspect(&game, &[], &env, &|| Ok(())).unwrap().state,
        "unknown"
    );
    fs::write(
        f.0.join("EA/Logs/EADesktopVerbose.0.log"),
        "offerId=[wrong] slug=[the-sims-3]\n",
    )
    .unwrap();
    assert_eq!(
        inspect(&game, &[], &env, &|| Ok(())).unwrap().state,
        "unknown"
    );
}
#[test]
fn settings_limits_cancellation_and_windows_links_never_become_empty_verified_options() {
    let f = Fixture::new();
    f.setup();
    f.options(123, "-disablepacks:EP05");
    assert!(matches!(
        inspect(&f.game(), &[], &f.env(), &|| Err("sims_canceled")),
        Err("sims_canceled")
    ));
    f.put(
        "userdata/123/config/localconfig.vdf",
        &"x".repeat(4 * 1024 * 1024 + 1),
    );
    assert_eq!(
        inspect(&f.game(), &[], &f.env(), &|| Ok(())).unwrap().state,
        "unknown"
    );
    #[cfg(windows)]
    {
        let linked = f.0.join("linked");
        use std::os::windows::process::CommandExt;
        let command = format!(
            "New-Item -ItemType Junction -Path '{}' -Target '{}' | Out-Null",
            linked.to_string_lossy().replace('\'', "''"),
            f.0.join("userdata").to_string_lossy().replace('\'', "''")
        );
        assert!(std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-Command", &command])
            .creation_flags(0x08000000)
            .status()
            .unwrap()
            .success());
        assert!(files::directory(&linked).is_err());
        fs::remove_dir(linked).unwrap();
    }
}
