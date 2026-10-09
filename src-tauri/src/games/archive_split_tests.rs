use std::io::Seek as _;

fn split_fixture(path: &Path, width: usize) -> Vec<PathBuf> {
    let bytes = fs::read(path).unwrap();
    bytes
        .chunks(width)
        .enumerate()
        .map(|(index, bytes)| {
            let part = path.with_file_name(format!(
                "{}.{:03}",
                path.file_name().unwrap().to_string_lossy(),
                index + 1
            ));
            fs::write(&part, bytes).unwrap();
            part
        })
        .collect()
}

#[test]
fn split_sevenzip_restores_any_part_with_solid_blocks_and_both_password_modes() {
    let _serial = SERIAL.lock().unwrap();
    for (password, header, solid) in [
        (None, false, false),
        (None, false, true),
        (Some("雨 secret"), false, true),
        (Some("雨 secret"), true, true),
    ] {
        let f = Fixture::new();
        let path = f.package(password, header, solid);
        let parts = split_fixture(&path, 17); // The 32-byte header spans volumes.
        assert!(parts.len() > 3);
        let selected = parts.last().unwrap();
        if password.is_some() {
            assert_eq!(review(selected, None).err(), Some("archive_encrypted"));
            match review(selected, Some("wrong")) {
                Err(_) => {}
                Ok(plan) => assert!(run(&f, plan.token, "Wrong").is_err()),
            }
            assert!(!f.0.join("Wrong").exists());
        }
        let originals: Vec<_> = parts.iter().map(|p| fs::read(p).unwrap()).collect();
        let plan = review(selected, password).unwrap();
        assert_eq!(plan.parts.len(), parts.len());
        assert_eq!(plan.archive_bytes, fs::metadata(&path).unwrap().len());
        assert_eq!(plan.file_count, 2);
        let receipt = run(&f, plan.token, "Installed").unwrap();
        assert_eq!(receipt.parts.len(), parts.len());
        assert_eq!(
            fs::read(f.0.join("Installed/game.bin")).unwrap(),
            vec![73; 2 * 1024 * 1024]
        );
        assert_eq!(
            fs::read(f.0.join("Installed/data/世界.txt")).unwrap(),
            b"Unicode data"
        );
        assert!(f.0.join("Installed/empty").is_dir());
        for (part, original) in parts.iter().zip(originals) {
            assert_eq!(fs::read(part).unwrap(), original);
        }
    }
}

#[test]
fn split_sevenzip_rejects_missing_duplicate_extra_directory_and_changed_volumes() {
    let _serial = SERIAL.lock().unwrap();
    for missing in [0, 1, usize::MAX] {
        let f = Fixture::new();
        let path = f.package(None, false, true);
        let parts = split_fixture(&path, 17);
        let index = if missing == usize::MAX {
            parts.len() - 1
        } else {
            missing
        };
        fs::remove_file(&parts[index]).unwrap();
        let selected = if index == 0 { &parts[1] } else { &parts[0] };
        assert_eq!(review(selected, None).err(), Some("archive_missing_part"));
    }
    let f = Fixture::new();
    let path = f.package(None, false, true);
    let parts = split_fixture(&path, 17);
    let duplicate = path.with_file_name("Game 雨.7z.0001");
    fs::copy(&parts[0], &duplicate).unwrap();
    assert_eq!(review(&parts[0], None).err(), Some("archive_collision"));
    fs::remove_file(duplicate).unwrap();
    let extra = path.with_file_name(format!("Game 雨.7z.{:03}", parts.len() + 1));
    fs::write(&extra, b"unrelated extra volume").unwrap();
    assert_eq!(review(&parts[1], None).err(), Some("archive_parts"));
    fs::remove_file(extra).unwrap();
    let original = fs::read(&parts[1]).unwrap();
    fs::remove_file(&parts[1]).unwrap();
    fs::create_dir(&parts[1]).unwrap();
    assert!(review(&parts[0], None).is_err());
    fs::remove_dir(&parts[1]).unwrap();
    fs::write(&parts[1], &original).unwrap();
    let plan = review(&parts[1], None).unwrap();
    let mut changed = original;
    changed[0] ^= 1;
    fs::write(&parts[1], changed).unwrap();
    assert_eq!(
        run(&f, plan.token, "Changed").err(),
        Some("archive_changed")
    );
    assert!(!f.0.join("Changed").exists());
}

#[test]
fn split_sevenzip_reader_seeks_across_edges_and_rejects_damaged_start_header() {
    let _serial = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let path = f.package(None, false, true);
    let bytes = fs::read(&path).unwrap();
    let parts = split_fixture(&path, 3); // Even the signature spans volumes.
    let mut input = split::Reader::open(&parts, true).unwrap();
    let mut all = Vec::new();
    input.read_to_end(&mut all).unwrap();
    assert_eq!(all, bytes);
    for start in [0, 1, 2, 3, 31, bytes.len() - 7] {
        input.seek(std::io::SeekFrom::Start(start as u64)).unwrap();
        let mut actual = [0; 7];
        input.read_exact(&mut actual).unwrap();
        assert_eq!(&actual, &bytes[start..start + 7]);
    }
    assert!(input.seek(std::io::SeekFrom::Start(0)).is_ok());
    assert!(input.seek(std::io::SeekFrom::Current(-1)).is_err());
    assert_eq!(
        input.seek(std::io::SeekFrom::End(-1)).unwrap(),
        bytes.len() as u64 - 1
    );
    input.seek(std::io::SeekFrom::End(1)).unwrap();
    assert_eq!(input.read(&mut [0; 1]).unwrap(), 0);
    let plan = review(parts.last().unwrap(), None).unwrap();
    assert!(run(&f, plan.token, "SmallVolumes").is_ok());
    let mut corrupt = fs::read(&parts[4]).unwrap();
    corrupt[0] ^= 1;
    drop(input);
    fs::write(&parts[4], corrupt).unwrap();
    assert_eq!(
        split::Reader::open(&parts, true).err(),
        Some("archive_checksum")
    );
}

#[test]
fn split_sevenzip_cancellation_keeps_parts_and_a_following_job_usable() {
    let _serial = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let path = f.package(None, false, true);
    let parts = split_fixture(&path, 17);
    let plan = review(&parts[2], None).unwrap();
    let operation = id();
    let result = extract(
        "seven-test".into(),
        plan.token,
        f.0.to_string_lossy().into(),
        "Canceled".into(),
        operation.clone(),
        |p| {
            if p.phase == "extracting" {
                cancel("seven-test".into(), operation.clone());
            }
        },
    );
    assert_eq!(result.err(), Some("archive_canceled"));
    assert!(!f.0.join("Canceled").exists());
    assert!(parts.iter().all(|p| p.is_file()));
    let plan = review(&parts[0], None).unwrap();
    assert!(run(&f, plan.token, "Retry").is_ok());
}

#[test]
#[ignore]
fn official_split_sevenzip_encoder_interoperability() {
    let _serial = SERIAL.lock().unwrap();
    let tool = std::env::var_os("HARBOR_TEST_7ZIP")
        .expect("Set HARBOR_TEST_7ZIP to the official console executable");
    for (name, options, password) in [
        ("copy", vec!["-m0=Copy"], None),
        ("solid", vec!["-m0=LZMA2:d=8m", "-ms=on"], None),
        (
            "encrypted",
            vec!["-m0=LZMA2:d=8m", "-ms=on", "-pfixture-password"],
            Some("fixture-password"),
        ),
        (
            "encrypted-headers",
            vec!["-m0=LZMA2:d=8m", "-ms=on", "-pfixture-password", "-mhe=on"],
            Some("fixture-password"),
        ),
    ] {
        let f = Fixture::new();
        let input = f.0.join("input");
        fs::create_dir_all(input.join("empty")).unwrap();
        let mut state = 123456789u32;
        let bytes: Vec<u8> = (0..262144)
            .map(|_| {
                state ^= state << 13;
                state ^= state >> 17;
                state ^= state << 5;
                state as u8
            })
            .collect();
        fs::write(input.join("game.bin"), &bytes).unwrap();
        fs::write(input.join("世界.txt"), b"official split encoder").unwrap();
        let path = f.0.join("Game 雨.7z");
        let output = Command::new(&tool)
            .current_dir(&input)
            .args(["a", "-t7z", "-mmt=2", "-v64k", "-bso0", "-bsp0"])
            .args(options)
            .arg(&path)
            .arg(".")
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{name}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        let mut parts: Vec<_> = fs::read_dir(&f.0)
            .unwrap()
            .map(|p| p.unwrap().path())
            .filter(|p| {
                p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("Game 雨.7z.")
            })
            .collect();
        parts.sort();
        assert!(parts.len() > 1);
        if password.is_some() {
            assert_eq!(
                review(parts.last().unwrap(), None).err(),
                Some("archive_encrypted")
            );
        }
        let plan = review(parts.last().unwrap(), password).unwrap();
        assert_eq!(plan.parts.len(), parts.len());
        let receipt = run(&f, plan.token, "Installed").unwrap();
        assert_eq!(fs::read(f.0.join("Installed/game.bin")).unwrap(), bytes);
        assert_eq!(
            fs::read(f.0.join("Installed/世界.txt")).unwrap(),
            b"official split encoder"
        );
        assert!(f.0.join("Installed/empty").is_dir());
        eprintln!(
            "{name}: {} parts, {} exact bytes",
            receipt.parts.len(),
            receipt.bytes
        );
    }
}
