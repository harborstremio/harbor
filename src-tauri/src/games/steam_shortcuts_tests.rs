use super::*;

fn string(data: &mut Vec<u8>, key: &str, value: &str) {
    data.push(1);
    data.extend(key.bytes());
    data.push(0);
    data.extend(value.bytes());
    data.push(0);
}
fn int(data: &mut Vec<u8>, key: &str, value: u32) {
    data.push(2);
    data.extend(key.bytes());
    data.push(0);
    data.extend(value.to_le_bytes());
}
fn entry(id: u32, executable: &str) -> Vec<u8> {
    let mut data = b"\0shortcuts\0\x000\0".to_vec();
    int(&mut data, "appid", id);
    string(&mut data, "AppName", "遊び — Café");
    string(&mut data, "Exe", executable);
    string(&mut data, "StartDir", "\"D:\\Games\\Example\"");
    string(
        &mut data,
        "LaunchOptions",
        "--keep-original \"two words\" %command%",
    );
    string(&mut data, "icon", "D:\\Games\\Example\\game.exe,0");
    int(&mut data, "LastPlayTime", 1_791_000_000);
    int(&mut data, "IsHidden", 1);
    data.extend(b"\0tags\0");
    string(&mut data, "0", "Favorites");
    string(&mut data, "1", "Multiplayer");
    data.extend([8, 8, 8, 8]);
    data
}

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let parent = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let path = parent.join(format!(
            "harbor-shortcuts-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }
    fn account(&self, account: u32, data: &[u8]) -> PathBuf {
        let config = self.0.join(format!("userdata/{account}/config"));
        fs::create_dir_all(&config).unwrap();
        let file = config.join("shortcuts.vdf");
        fs::write(&file, data).unwrap();
        file
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn preserves_unicode_arguments_tags_and_unsigned_identity() {
    let games = parse(&entry(0xffff_ffff, "\"D:\\Games\\Example\\game.exe\""), 12).unwrap();
    let game = &games[0];
    assert_eq!(game.id(), "steam-shortcut:12:4294967295");
    assert_eq!(game.run_game_id(), Some(18_446_744_069_448_138_752));
    assert_eq!(game.name, "遊び — Café");
    assert_eq!(
        game.launch_options,
        "--keep-original \"two words\" %command%"
    );
    assert_eq!(game.start_directory, "\"D:\\Games\\Example\"");
    assert_eq!(game.tags, ["Favorites", "Multiplayer"]);
    assert!(game.hidden);
    assert_eq!(game.last_played, 1_791_000_000);
}

#[test]
fn accepts_both_observed_root_terminator_forms_and_empty_file() {
    let mut data = entry(0x8123_4567, "example.exe");
    assert_eq!(parse(&data, 1).unwrap().len(), 1);
    data.pop();
    assert_eq!(parse(&data, 1).unwrap().len(), 1);
    assert!(parse(&[], 1).unwrap().is_empty());
    assert!(parse(b"\0shortcuts\0\x08\x08", 1).unwrap().is_empty());
}

#[test]
fn every_truncated_prefix_fails_without_panicking_or_returning_partial_games() {
    let data = entry(0x8123_4567, "example.exe");
    for count in 1..data.len() - 1 {
        assert!(parse(&data[..count], 1).is_err(), "length {count}");
    }
}

#[test]
fn rejects_unknown_types_bad_utf8_trailing_data_and_invalid_root() {
    let valid = entry(0x8123_4567, "example.exe");
    let mut data = valid.clone();
    data[13] = 0xff;
    assert!(parse(&data, 1).is_err());
    let mut data = valid.clone();
    data[11] = 0xff;
    assert!(parse(&data, 1).is_err());
    let mut data = valid.clone();
    data.extend([1, 2]);
    assert_eq!(parse(&data, 1), Err("shortcut_trailing"));
    let mut data = valid;
    data[1] = b'x';
    assert_eq!(parse(&data, 1), Err("shortcut_root"));
}

#[test]
fn skips_known_unused_scalar_types_without_losing_following_fields() {
    let mut data = b"\0shortcuts\0\x000\0".to_vec();
    for (kind, size) in [(3, 4), (4, 4), (6, 4), (7, 8), (10, 8)] {
        data.push(kind);
        data.extend(b"extra\0");
        data.extend(vec![0; size]);
    }
    data.extend(b"\x05wide\0x\0\0\0");
    int(&mut data, "appid", 0x8000_0001);
    string(&mut data, "AppName", "Working");
    string(&mut data, "Exe", "/games/play");
    data.extend([8, 8, 8]);
    assert_eq!(parse(&data, 1).unwrap()[0].name, "Working");
}

#[test]
fn limits_size_depth_strings_and_field_counts() {
    assert_eq!(parse(&vec![0; MAX_FILE + 1], 1), Err("shortcut_size"));
    let mut data = b"\0shortcuts\0".to_vec();
    for _ in 0..18 {
        data.extend(b"\0nested\0");
    }
    assert_eq!(parse(&data, 1), Err("shortcut_depth"));
    let mut data = b"\0shortcuts\0\x01key\0".to_vec();
    data.extend(vec![b'x'; 32_770]);
    data.push(0);
    assert_eq!(parse(&data, 1), Err("shortcut_string"));
    let mut data = b"\0shortcuts\0".to_vec();
    for _ in 0..MAX_FIELDS + 1 {
        int(&mut data, "a", 1);
    }
    assert_eq!(parse(&data, 1), Err("shortcut_fields"));
}

#[test]
fn legacy_ids_are_local_and_ambiguous_fields_are_rejected() {
    for id in [0, 1, 0x7fff_ffff] {
        let parsed = parse_account(&entry(id, "game"), 1).unwrap();
        assert_eq!(parsed.shortcuts.len(), 1);
        assert_eq!(parsed.shortcuts[0].steam_app_id(), None);
        assert_eq!(parsed.shortcuts[0].run_game_id(), None);
        assert!(parsed.shortcuts[0]
            .id()
            .starts_with("steam-shortcut:1:local-"));
        assert_eq!(parsed.skipped, 0);
    }
    let mut data = entry(0x8000_0001, "game");
    data.truncate(data.len() - 4);
    data.push(8);
    int(&mut data, "APPID", 0x8000_0002);
    data.extend([8, 8, 8]);
    assert!(parse(&data, 1).unwrap().is_empty());
    assert_eq!(
        parse(&entry(0x8000_0001, "game"), 0),
        Err("shortcut_account")
    );
}

#[test]
fn duplicate_shortcut_id_is_ambiguous_within_one_account() {
    let entry = entry(0x8000_0001, "game");
    let mut data = entry[..entry.len() - 2].to_vec();
    data.extend(&entry[11..]);
    let parsed = parse_account(&data, 1).unwrap();
    assert!(parsed.shortcuts.is_empty());
    assert_eq!(parsed.skipped, 2);
}

fn records(entries: &[Vec<u8>]) -> Vec<u8> {
    indexed_records(
        &entries
            .iter()
            .enumerate()
            .map(|(index, entry)| (index.to_string(), entry.clone()))
            .collect::<Vec<_>>(),
    )
}

fn indexed_records(entries: &[(String, Vec<u8>)]) -> Vec<u8> {
    let mut data = b"\0shortcuts\0".to_vec();
    for (index, entry) in entries {
        data.push(0);
        data.extend(index.bytes());
        data.push(0);
        data.extend(&entry[14..entry.len() - 2]);
    }
    data.extend([8, 8]);
    data
}

#[test]
fn invalid_rows_keep_other_shortcuts_and_warn_without_changing_the_file() {
    let data = records(&[
        entry(0x8000_0001, "/games/one"),
        entry(0x8000_0002, ""),
        entry(0, "/games/legacy"),
        entry(0x8000_0003, "/games/three"),
    ]);
    let parsed = parse_account(&data, 7).unwrap();
    assert_eq!(parsed.skipped, 1);
    assert_eq!(
        parsed
            .shortcuts
            .iter()
            .map(|game| game.app_id)
            .collect::<Vec<_>>(),
        [0x8000_0001, 0, 0x8000_0003]
    );
    let fixture = Fixture::new();
    let file = fixture.account(7, &data);
    let scanned = scan(&fixture.0);
    assert_eq!(scanned.shortcuts, parsed.shortcuts);
    assert!(scanned.warnings.contains("shortcut_entries"));
    assert_eq!(read_account(&fixture.0, 7).unwrap(), parsed.shortcuts);
    assert_eq!(
        find(&fixture.0, 7, 0x8000_0001).unwrap().executable,
        "/games/one"
    );
    assert_eq!(find(&fixture.0, 7, 0x8000_0002), Err("shortcut_missing"));
    assert_eq!(fs::read(file).unwrap(), data);
}

#[test]
fn ambiguous_ids_and_launch_fields_never_choose_an_arbitrary_record() {
    let mut duplicate_options = entry(0x8000_0003, "/games/three");
    duplicate_options.truncate(duplicate_options.len() - 3);
    string(
        &mut duplicate_options,
        "LAUNCHOPTIONS",
        "different arguments",
    );
    duplicate_options.extend([8, 8, 8]);
    let parsed = parse_account(
        &records(&[
            entry(0x8000_0001, "/games/one"),
            entry(0x8000_0001, ""),
            duplicate_options,
            entry(0x8000_0004, "/games/four"),
        ]),
        7,
    )
    .unwrap();
    assert_eq!(parsed.skipped, 3);
    assert_eq!(parsed.shortcuts.len(), 1);
    assert_eq!(parsed.shortcuts[0].app_id, 0x8000_0004);
}

#[test]
fn wrong_field_types_and_duplicate_numeric_indexes_only_skip_affected_rows() {
    let mut wrong_options = b"\0shortcuts\0\x000\0".to_vec();
    int(&mut wrong_options, "appid", 0x8000_0001);
    string(&mut wrong_options, "AppName", "Wrong options type");
    string(&mut wrong_options, "Exe", "/games/one");
    int(&mut wrong_options, "LaunchOptions", 123);
    wrong_options.extend([8, 8, 8]);
    let data = indexed_records(&[
        ("0".into(), entry(0x8000_0002, "/games/two")),
        ("00".into(), entry(0x8000_0003, "/games/three")),
        ("2".into(), wrong_options),
        ("3".into(), entry(0x8000_0004, "/games/four")),
        ("not-an-index".into(), entry(0x8000_0005, "/games/five")),
    ]);
    let parsed = parse_account(&data, 7).unwrap();
    assert_eq!(parsed.skipped, 4);
    assert_eq!(parsed.shortcuts.len(), 1);
    assert_eq!(parsed.shortcuts[0].app_id, 0x8000_0004);
}

#[test]
fn all_ambiguous_identity_candidates_are_unavailable_for_lookup_and_launch() {
    let fixture = Fixture::new();
    let executable = fixture.0.join("game.exe");
    fs::write(&executable, []).unwrap();
    let exe = executable.to_str().unwrap();
    let mut ambiguous = entry(0x8000_0001, exe);
    ambiguous.truncate(ambiguous.len() - 3);
    int(&mut ambiguous, "APPID", 0x8000_0002);
    ambiguous.extend([8, 8, 8]);
    let data = records(&[ambiguous, entry(0x8000_0002, exe), entry(0x8000_0003, exe)]);
    fixture.account(7, &data);
    for app_id in [0x8000_0001, 0x8000_0002] {
        assert_eq!(find(&fixture.0, 7, app_id), Err("shortcut_missing"));
        assert_eq!(launch_uri(&fixture.0, 7, app_id), Err("shortcut_missing"));
    }
    assert_eq!(
        find(&fixture.0, 7, 0x8000_0003).unwrap().app_id,
        0x8000_0003
    );
    assert_eq!(
        launch_uri(&fixture.0, 7, 0x8000_0003).unwrap(),
        "steam://rungameid/9223372049773232128"
    );
}

#[test]
fn structural_damage_after_a_valid_row_does_not_return_a_partial_file() {
    let data = records(&[
        entry(0x8000_0001, "/games/one"),
        entry(0x8000_0002, "/games/two"),
    ]);
    let first_row_end = entry(0x8000_0001, "/games/one").len() - 2;
    for end in first_row_end..data.len() - 1 {
        assert!(parse(&data[..end], 7).is_err(), "truncated at {end}");
    }
    let mut unknown = data;
    unknown[first_row_end] = 0xff;
    assert_eq!(parse(&unknown, 7), Err("shortcut_type"));
}

#[test]
fn isolates_accounts_and_corrupt_files_without_writing_source_data() {
    let fixture = Fixture::new();
    let data = entry(0x8000_0001, "game");
    let a = fixture.account(10, &data);
    let b = fixture.account(20, &data);
    fixture.account(30, b"broken");
    fs::create_dir_all(fixture.0.join("userdata/not-an-account/config")).unwrap();
    let scan = scan(&fixture.0);
    assert_eq!(scan.accounts_scanned, 3);
    assert_eq!(scan.files_found, 3);
    assert_eq!(scan.shortcuts.len(), 2);
    assert_ne!(scan.shortcuts[0].id(), scan.shortcuts[1].id());
    assert_eq!(
        scan.shortcuts[0].run_game_id(),
        scan.shortcuts[1].run_game_id()
    );
    assert!(!scan.warnings.is_empty());
    assert_eq!(fs::read(a).unwrap(), data);
    assert_eq!(fs::read(b).unwrap(), data);
}

#[test]
fn launch_rechecks_exact_account_and_current_executable_without_running_it() {
    let fixture = Fixture::new();
    let executable = fixture.0.join("a game.exe");
    fs::write(&executable, b"not executable").unwrap();
    let data = entry(0x8000_0001, &format!("\"{}\"", executable.display()));
    let file = fixture.account(7, &data);
    assert_eq!(
        launch_uri(&fixture.0, 7, 0x8000_0001).unwrap(),
        "steam://rungameid/9223372041183297536"
    );
    assert_eq!(
        launch_uri(&fixture.0, 8, 0x8000_0001),
        Err("shortcut_missing")
    );
    fs::remove_file(executable).unwrap();
    assert_eq!(
        launch_uri(&fixture.0, 7, 0x8000_0001),
        Err("shortcut_executable")
    );
    fs::remove_file(file).unwrap();
    assert_eq!(
        launch_uri(&fixture.0, 7, 0x8000_0001),
        Err("shortcut_missing")
    );
}

#[test]
fn never_treats_embedded_arguments_or_urls_as_a_local_executable() {
    for executable in [
        "\"D:\\Game.exe\" --unsafe",
        "steam://run/1",
        "relative.exe",
        "\"unclosed",
        "/game\nfile",
    ] {
        assert!(
            parse(&entry(0x8000_0001, executable), 1).unwrap()[0]
                .executable_path()
                .is_none(),
            "{executable}"
        );
    }
}

#[test]
fn missing_userdata_is_empty_and_unreadable_entries_are_not_installed() {
    let fixture = Fixture::new();
    assert!(scan(&fixture.0).shortcuts.is_empty());
    let data = entry(0x8000_0001, "relative.exe");
    fixture.account(1, &data);
    assert_eq!(
        launch_uri(&fixture.0, 1, 0x8000_0001),
        Err("shortcut_executable")
    );
}

#[test]
fn legacy_identity_survives_reorder_missing_zero_id_and_non_launch_metadata_changes() {
    let zero = entry(0, "/games/legacy");
    let mut missing = zero.clone();
    missing.drain(14..25); // Entire integer appid field, leaving the binary record intact.
    let original = parse(&zero, 123).unwrap().remove(0);
    assert_eq!(parse(&missing, 123).unwrap()[0].id(), original.id());
    assert_eq!(
        parse(&entry(42, "/games/legacy"), 123).unwrap()[0].id(),
        original.id()
    );
    let moved = indexed_records(&[("900".into(), zero.clone())]);
    assert_eq!(parse(&moved, 123).unwrap()[0].id(), original.id());
    let mut changed = original.clone();
    changed.icon = "/new/icon.png".into();
    changed.hidden = false;
    changed.tags = vec!["New tag".into()];
    changed.last_played += 1;
    assert_eq!(changed.id(), original.id());
    changed.account_id = 456;
    assert_ne!(changed.id(), original.id());
    for field in 0..4 {
        let mut changed = original.clone();
        match field {
            0 => changed.name.push('2'),
            1 => changed.executable.push('2'),
            2 => changed.start_directory.push('2'),
            _ => changed.launch_options.push('2'),
        }
        assert_ne!(changed.id(), original.id());
    }
}

#[test]
fn legacy_variants_are_distinct_but_all_exact_duplicate_identities_are_excluded() {
    let first = entry(0, "/games/one");
    let second = entry(0, "/games/two");
    let parsed = parse_account(&records(&[first.clone(), second.clone()]), 123).unwrap();
    assert_eq!(parsed.shortcuts.len(), 2);
    assert_eq!(parsed.skipped, 0);
    assert_ne!(parsed.shortcuts[0].id(), parsed.shortcuts[1].id());
    let parsed = parse_account(&records(&[first.clone(), second, first]), 123).unwrap();
    assert_eq!(parsed.shortcuts.len(), 1);
    assert_eq!(parsed.skipped, 2);
    assert_eq!(parsed.shortcuts[0].executable, "/games/two");
}

#[test]
fn legacy_lookup_preserves_source_and_cannot_create_a_steam_dispatch() {
    let fixture = Fixture::new();
    let data = entry(0, "/games/one");
    let file = fixture.account(123, &data);
    let game = parse(&data, 123).unwrap().remove(0);
    assert_eq!(find_id(&fixture.0, 123, &game.id()).unwrap(), game);
    assert_eq!(find(&fixture.0, 123, 0), Err("shortcut_identity"));
    assert_eq!(launch_uri(&fixture.0, 123, 0), Err("shortcut_identity"));
    assert_eq!(
        find_id(&fixture.0, 456, &game.id()),
        Err("shortcut_identity")
    );
    assert_eq!(fs::read(&file).unwrap(), data);
    fs::write(file, entry(0, "/games/replaced")).unwrap();
    assert_eq!(
        find_id(&fixture.0, 123, &game.id()),
        Err("shortcut_missing")
    );
}

#[test]
fn request_selectors_are_canonical_account_scoped_and_unambiguous() {
    let local = "steam-shortcut:123:local-0123456789abcdef012345";
    assert_eq!(request_id(123, None, Some(local)).unwrap(), local);
    assert_eq!(
        request_id(123, Some(0xffff_ffff), None).unwrap(),
        "steam-shortcut:123:4294967295"
    );
    assert!(request_id(123, Some(0xffff_ffff), Some(local)).is_err());
    assert!(request_id(123, None, None).is_err());
    assert!(request_id(0, Some(0xffff_ffff), None).is_err());
    for value in [
        "steam-shortcut:0123:4294967295",
        "steam-shortcut:123:04294967295",
        "steam-shortcut:123:1",
        "steam-shortcut:124:4294967295",
        "steam-shortcut:123:local-0123456789ABCDEF012345",
        "steam-shortcut:123:local-0123456789abcdef0123450",
        "steam-shortcut:123:local-../../outside",
        "steam:4294967295",
    ] {
        assert!(request_id(123, None, Some(value)).is_err(), "{value}");
    }
    assert!(request_id(
        123,
        Some(0x8000_0000),
        Some("steam-shortcut:123:4294967295")
    )
    .is_err());
}
