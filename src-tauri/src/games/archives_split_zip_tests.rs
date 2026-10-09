use super::*;

fn volumes(path: &Path, width: usize) -> Vec<PathBuf> {
    fs::read(path)
        .unwrap()
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
fn split_zip_reads_across_tiny_volumes_from_any_selection_and_retains_receipts() {
    let _serial = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let data = vec![71; 4096];
    let source = f.archive(&[("data/世界.bin", &data), ("empty/", b"")]);
    let parts = volumes(&source, 3); // Signature, local headers, directory and footer all cross parts.
    let originals: Vec<_> = parts.iter().map(|p| fs::read(p).unwrap()).collect();
    let plan = review(parts.last().unwrap()).unwrap();
    assert_eq!(plan.parts.len(), parts.len());
    assert_eq!(plan.archive_bytes, fs::metadata(&source).unwrap().len());
    let receipt = run(&f, &plan, "Installed").unwrap();
    assert_eq!(receipt.parts, plan.parts);
    assert_eq!(receipt.files, 1);
    assert_eq!(fs::read(f.0.join("Installed/data/世界.bin")).unwrap(), data);
    assert!(f.0.join("Installed/empty").is_dir());
    for (part, expected) in parts.iter().zip(originals) {
        assert_eq!(fs::read(part).unwrap(), expected);
    }
}

#[test]
fn split_zip_passwords_keep_aes_and_zipcrypto_validation_and_never_store_secrets() {
    let _serial = SERIAL.lock().unwrap();
    for mode in [Some(zip::AesMode::Aes128), Some(zip::AesMode::Aes256), None] {
        let f = Fixture::new();
        let password = "fixture 雨 secret";
        let source = passwords::encrypted(&f, mode, true, password);
        let parts = volumes(&source, 32768);
        let selected = parts.last().unwrap();
        assert_eq!(review(selected).err(), Some("archive_encrypted"));
        assert_eq!(
            passwords::unlock(selected, "incorrect").err(),
            Some("archive_password")
        );
        let plan = passwords::unlock(selected, password).unwrap();
        let receipt = run(&f, &plan, "Installed").unwrap();
        assert_eq!(receipt.parts.len(), parts.len());
        assert!(!serde_json::to_string(&receipt).unwrap().contains(password));
        assert_eq!(
            fs::read(f.0.join("Installed/data/世界.bin")).unwrap(),
            vec![73; 2 * 1024 * 1024]
        );
        assert_eq!(
            fs::read(f.0.join("Installed/readme.txt")).unwrap(),
            b"plain file"
        );
    }
}

#[test]
fn split_zip_missing_duplicate_extra_and_replaced_parts_never_publish() {
    let _serial = SERIAL.lock().unwrap();
    for missing in [0, 1, usize::MAX] {
        let f = Fixture::new();
        let source = f.archive(&[("game.bin", &[77; 4096])]);
        let parts = volumes(&source, 17);
        let index = if missing == usize::MAX {
            parts.len() - 1
        } else {
            missing
        };
        fs::remove_file(&parts[index]).unwrap();
        assert_eq!(
            review(if index == 0 { &parts[1] } else { &parts[0] }).err(),
            Some("archive_missing_part")
        );
    }
    let f = Fixture::new();
    let source = f.archive(&[("game.bin", &[77; 4096])]);
    let parts = volumes(&source, 17);
    let duplicate = source.with_file_name("Game 雨.zip.0001");
    fs::copy(&parts[0], &duplicate).unwrap();
    assert_eq!(review(&parts[0]).err(), Some("archive_collision"));
    fs::remove_file(duplicate).unwrap();
    let extra = source.with_file_name(format!("Game 雨.zip.{:03}", parts.len() + 1));
    fs::write(&extra, b"extra data").unwrap();
    assert_eq!(review(&parts[0]).err(), Some("archive_parts"));
    fs::remove_file(extra).unwrap();
    let plan = review(&parts[0]).unwrap();
    let mut bytes = fs::read(&parts[1]).unwrap();
    bytes[0] ^= 1;
    fs::write(&parts[1], bytes).unwrap();
    assert_eq!(run(&f, &plan, "Changed").err(), Some("archive_changed"));
    assert!(!f.0.join("Changed").exists());
}

#[test]
fn split_zip_rejects_concatenated_archives_unsafe_paths_and_disk_relative_layouts() {
    let _serial = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let source = f.archive(&[("game.bin", b"content")]);
    let bytes = fs::read(&source).unwrap();
    let mut doubled = bytes.clone();
    doubled.extend_from_slice(&bytes);
    fs::write(&source, doubled).unwrap();
    let parts = volumes(&source, 17);
    assert_eq!(review(&parts[0]).err(), Some("archive_parts"));
    let f = Fixture::new();
    let source = f.archive(&[("../outside", b"unsafe")]);
    let parts = volumes(&source, 17);
    assert_eq!(review(&parts[0]).err(), Some("archive_path"));
    assert!(!f.0.join("outside").exists());
    let f = Fixture::new();
    let source = f.archive(&[("game.bin", b"content")]);
    let mut bytes = fs::read(&source).unwrap();
    let footer = bytes.len() - 22;
    bytes[footer + 4..footer + 6].copy_from_slice(&1u16.to_le_bytes());
    fs::write(&source, &bytes).unwrap();
    assert_eq!(review(&source).err(), Some("archive_multipart"));
    let parts = volumes(&source, 17);
    assert_eq!(review(&parts[0]).err(), Some("archive_multipart"));
}

#[test]
fn split_zip_cancel_keeps_source_and_allows_a_new_review() {
    let _serial = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let source = f.archive(&[("game.bin", &[42; 4096])]);
    let parts = volumes(&source, 17);
    let plan = review(&parts[1]).unwrap();
    let operation = id();
    let result = extract(
        "fixture".into(),
        plan.token,
        f.0.to_string_lossy().into(),
        "Canceled".into(),
        operation.clone(),
        |p| {
            if p.phase == "extracting" {
                cancel("fixture".into(), operation.clone());
            }
        },
    );
    assert_eq!(result.err(), Some("archive_canceled"));
    assert!(!f.0.join("Canceled").exists());
    assert!(parts.iter().all(|p| p.is_file()));
    let plan = review(&parts[0]).unwrap();
    assert!(run(&f, &plan, "Retry").is_ok());
}

#[test]
fn split_zip_zip64_and_comments_preserve_directory_boundaries() {
    let _serial = SERIAL.lock().unwrap();
    for sentinels in [false, true] {
        let f = Fixture::new();
        let source = f.0.join("Game 雨.zip");
        let mut zip = zip::ZipWriter::new(File::create(&source).unwrap());
        zip.set_comment("comment PK\u{5}\u{6} with signature");
        zip.set_zip64_comment(Some("extended ZIP64 comment"));
        zip.start_file("game.bin", SimpleFileOptions::default().large_file(true))
            .unwrap();
        zip.write_all(b"ZIP64 payload").unwrap();
        zip.finish().unwrap();
        if sentinels {
            let mut bytes = fs::read(&source).unwrap();
            let end = bytes.windows(4).position(|v| v == b"PK\x05\x06").unwrap();
            bytes[end + 8..end + 12].fill(0xff);
            bytes[end + 12..end + 20].fill(0xff);
            fs::write(&source, bytes).unwrap();
        }
        let parts = volumes(&source, 3);
        let plan = review(parts.last().unwrap()).unwrap();
        run(&f, &plan, "Installed").unwrap();
        assert_eq!(
            fs::read(f.0.join("Installed/game.bin")).unwrap(),
            b"ZIP64 payload"
        );
    }
}

#[test]
fn split_zip_empty_volumes_and_corrupt_payload_never_publish() {
    let _serial = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let source = f.archive(&[("game.bin", b"content")]);
    let parts = volumes(&source, 17);
    fs::write(&parts[1], []).unwrap();
    assert_eq!(review(&parts[0]).err(), Some("archive_missing_part"));
    let f = Fixture::new();
    let source = f.0.join("Game 雨.zip");
    let mut zip = zip::ZipWriter::new(File::create(&source).unwrap());
    zip.start_file(
        "game.bin",
        SimpleFileOptions::default().compression_method(CompressionMethod::Stored),
    )
    .unwrap();
    zip.write_all(b"uncorrupted payload").unwrap();
    zip.finish().unwrap();
    let mut bytes = fs::read(&source).unwrap();
    let payload = bytes
        .windows(19)
        .position(|v| v == b"uncorrupted payload")
        .unwrap();
    bytes[payload] ^= 1;
    fs::write(&source, bytes).unwrap();
    let parts = volumes(&source, 17);
    let plan = review(&parts[0]).unwrap();
    assert_eq!(run(&f, &plan, "Corrupt").err(), Some("archive_checksum"));
    assert!(!f.0.join("Corrupt").exists());
}

#[test]
#[ignore]
fn official_numbered_zip_encoder_interoperability() {
    let _serial = SERIAL.lock().unwrap();
    let tool = std::env::var_os("HARBOR_TEST_7ZIP")
        .expect("Set HARBOR_TEST_7ZIP to the official full 7-Zip console executable");
    for (name, options, password) in [
        ("stored", vec!["-mm=Copy"], None),
        ("deflate", vec!["-mm=Deflate"], None),
        (
            "aes256",
            vec!["-mm=Deflate", "-mem=AES256", "-pfixture-password"],
            Some("fixture-password"),
        ),
        (
            "zipcrypto",
            vec!["-mm=Deflate", "-mem=ZipCrypto", "-pfixture-password"],
            Some("fixture-password"),
        ),
    ] {
        let f = Fixture::new();
        let input = f.0.join("input");
        fs::create_dir_all(input.join("empty")).unwrap();
        let mut state = 8675309u32;
        let bytes: Vec<u8> = (0..262144)
            .map(|_| {
                state ^= state << 13;
                state ^= state >> 17;
                state ^= state << 5;
                state as u8
            })
            .collect();
        fs::write(input.join("game.bin"), &bytes).unwrap();
        fs::write(input.join("世界.txt"), b"official ZIP split fixture").unwrap();
        let path = f.0.join("Game 雨.zip");
        let output = std::process::Command::new(&tool)
            .current_dir(&input)
            .args(["a", "-tzip", "-mmt=2", "-v64k", "-bso0", "-bsp0"])
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
                    .starts_with("Game 雨.zip.")
            })
            .collect();
        parts.sort();
        assert!(parts.len() > 1);
        let plan = if let Some(password) = password {
            assert_eq!(
                review(parts.last().unwrap()).err(),
                Some("archive_encrypted")
            );
            passwords::unlock(parts.last().unwrap(), password).unwrap()
        } else {
            review(parts.last().unwrap()).unwrap()
        };
        let receipt = run(&f, &plan, "Installed").unwrap();
        assert_eq!(fs::read(f.0.join("Installed/game.bin")).unwrap(), bytes);
        assert_eq!(
            fs::read(f.0.join("Installed/世界.txt")).unwrap(),
            b"official ZIP split fixture"
        );
        assert!(f.0.join("Installed/empty").is_dir());
        eprintln!(
            "{name}: {} parts, {} exact bytes",
            receipt.parts.len(),
            receipt.bytes
        );
    }
}
