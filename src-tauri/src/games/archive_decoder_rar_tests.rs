use super::super::{cancel, discard, extract, inspect, tests::SERIAL};
use super::*;
use std::{fs, path::PathBuf};

fn fixture(name: &str) -> PathBuf {
    PathBuf::from(
        std::env::var_os("HARBOR_RAR_FIXTURES")
            .expect("Set HARBOR_RAR_FIXTURES to the pinned upstream fixture corpus"),
    )
    .join(name)
}
fn review(path: &Path, password: Option<&str>) -> Result<super::super::ArchivePlan> {
    inspect(
        "rar-test".into(),
        path.to_string_lossy().into(),
        uuid::Uuid::new_v4().to_string(),
        password.map(str::to_owned),
        |_| {},
    )
}
fn destination() -> PathBuf {
    let value = fixture(&format!("output-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&value).unwrap();
    value
}
fn unpack(token: String, parent: &Path, name: &str) -> Result<super::super::ArchiveReceipt> {
    extract(
        "rar-test".into(),
        token,
        parent.to_string_lossy().into(),
        name.into(),
        uuid::Uuid::new_v4().to_string(),
        |_| {},
    )
}

#[test]
#[ignore = "requires pinned primary-project binary fixtures"]
fn rar_independent_solid_crc_blake_and_unicode_archives() {
    let _serial = SERIAL.lock().unwrap();
    let parent = destination();
    for name in [
        "rar3-solid.rar",
        "rar5-solid.rar",
        "rar5-crc.rar",
        "rar5-blake.rar",
    ] {
        let path = fixture(name);
        let original = fs::read(&path).unwrap();
        let plan = review(&path, None).unwrap_or_else(|e| panic!("{name}: {e}"));
        assert_eq!(plan.file_count, 2, "{name}");
        let receipt = unpack(plan.token, &parent, name).unwrap_or_else(|e| panic!("{name}: {e}"));
        assert_eq!(receipt.bytes, 4096);
        for entry in ["stest1.txt", "stest2.txt"] {
            let bytes = fs::read(Path::new(&receipt.destination).join(entry)).unwrap();
            assert_eq!(bytes.len(), 2048);
            // Published by the independent rarfile project's fixture manifests.
            assert_eq!(crc32fast::hash(&bytes), 0xc5b7e6a2, "{name}/{entry}");
        }
        assert_eq!(fs::read(path).unwrap(), original);
    }
    for name in [
        "rar5-solid-qo.rar",
        "rar3-subdirs.rar",
        "rar5-subdirs.rar",
        "unicode.rar",
        "unicode2.rar",
    ] {
        let plan = review(&fixture(name), None).unwrap_or_else(|e| panic!("{name}: {e}"));
        let expected = plan.expanded_bytes;
        let receipt = unpack(plan.token, &parent, name).unwrap_or_else(|e| panic!("{name}: {e}"));
        assert_eq!(receipt.bytes, expected);
        assert!(receipt.files > 0);
    }
}

#[test]
#[ignore = "requires pinned primary-project binary fixtures"]
fn rar_password_headers_files_retry_and_corruption() {
    let _serial = SERIAL.lock().unwrap();
    let parent = destination();
    for name in [
        "rar3-comment-hpsw.rar",
        "rar3-comment-psw.rar",
        "rar5-hpsw.rar",
        "rar5-psw.rar",
        "rar5-psw-blake.rar",
    ] {
        let path = fixture(name);
        assert_eq!(
            review(&path, None).err(),
            Some("archive_encrypted"),
            "{name}"
        );
        let wrong = review(&path, Some("wrong password"));
        let failure = match wrong {
            Ok(plan) => unpack(plan.token, &parent, &format!("wrong-{name}")).err(),
            Err(error) => Some(error),
        };
        if name == "rar3-comment-psw.rar" {
            // Both published fixture files are empty (CRC=0). RAR3 has no
            // password verifier here, so an incorrect password is unknowable.
            assert_eq!(failure, None);
        } else {
            assert!(
                matches!(
                    failure,
                    Some("archive_password" | "archive_password_or_checksum")
                ),
                "{name}: {failure:?}"
            );
            assert!(!parent.join(format!("wrong-{name}")).exists());
        }
        let plan = review(&path, Some("password")).unwrap_or_else(|e| panic!("{name}: {e}"));
        let json = serde_json::to_string(&plan).unwrap();
        assert!(!json.contains("password"));
        let receipt = unpack(plan.token, &parent, name).unwrap_or_else(|e| panic!("{name}: {e}"));
        assert!(receipt.files > 0);
    }
    let mut bytes = fs::read(fixture("rar5-crc.rar")).unwrap();
    // This changes stored payload bytes, leaving its original CRC/header intact.
    let offset = bytes.len() - 80;
    bytes[offset] ^= 1;
    let broken = parent.join("broken.rar");
    fs::write(&broken, bytes).unwrap();
    let plan = review(&broken, None).unwrap();
    assert_eq!(
        unpack(plan.token, &parent, "broken-output").err(),
        Some("archive_checksum")
    );
    assert!(!parent.join("broken-output").exists());
}

#[test]
#[ignore = "requires pinned primary-project binary fixtures"]
fn rar_links_and_file_copies_never_publish() {
    let _serial = SERIAL.lock().unwrap();
    for name in [
        "rar3-symlink-unix.rar",
        "rar5-symlink-unix.rar",
        "rar5-symlink-win.rar",
        "rar5-hlink.rar",
        "rar5-evil-symlink-traversal.rar",
    ] {
        let error = review(&fixture(name), None).err();
        assert!(
            matches!(error, Some("archive_links" | "archive_path")),
            "{name}: {error:?}"
        );
    }
    assert_eq!(
        review(&fixture("rar5-dups.rar"), None).err(),
        Some("archive_links"),
        "RAR file-copy records must not be materialized as ordinary files"
    );
    let plan = review(&fixture("rar5-crc.rar"), None).unwrap();
    discard("rar-test".into(), plan.token);
}

#[test]
#[ignore = "requires pinned primary-project binary fixtures"]
fn rar_multipart_modern_and_legacy_sets_extract_from_any_selected_part() {
    let _serial = SERIAL.lock().unwrap();
    let parent = destination();
    for name in [
        "rar3-vols.part1.rar",
        "rar3-vols.part2.rar",
        "rar5-vols.part3.rar",
        "rar3-old.r00",
    ] {
        let plan = review(&fixture(name), None).unwrap_or_else(|e| panic!("{name}: {e}"));
        assert_eq!(plan.parts.len(), 3, "{name}");
        assert_eq!(plan.file_count, 2);
        assert_eq!(
            plan.archive_bytes,
            plan.parts.iter().map(|p| p.bytes).sum::<u64>()
        );
        assert_eq!(plan.expanded_bytes, 207050);
        let parts = plan.parts.clone();
        let digest = plan.sha256.clone();
        let receipt = unpack(plan.token, &parent, name).unwrap_or_else(|e| panic!("{name}: {e}"));
        assert_eq!(receipt.parts, parts);
        assert_eq!(receipt.sha256, digest);
        for (file, size, crc) in [
            ("vols/bigfile.txt", 205000, 0x509ad74c),
            ("vols/smallfile.txt", 2050, 0xd08a1f86),
        ] {
            let bytes = fs::read(Path::new(&receipt.destination).join(file)).unwrap();
            assert_eq!(bytes.len(), size);
            assert_eq!(crc32fast::hash(&bytes), crc);
        }
    }
}

fn copied_volume_set(parent: &Path, prefix: &str, numbers: &[usize]) -> PathBuf {
    let folder = parent.join(prefix);
    fs::create_dir(&folder).unwrap();
    for number in numbers {
        fs::copy(
            fixture(&format!("rar5-vols.part{number}.rar")),
            folder.join(format!("Game 雨.part{number:02}.rar")),
        )
        .unwrap();
    }
    folder
}

#[test]
#[ignore = "requires pinned primary-project binary fixtures"]
fn rar_multipart_missing_parts_duplicates_and_replaced_part_never_publish() {
    let _serial = SERIAL.lock().unwrap();
    let parent = destination();
    for (label, numbers, selected) in [
        ("gap", vec![1, 3], 1),
        ("missing-first", vec![2, 3], 2),
        ("missing-last", vec![1, 2], 1),
    ] {
        let folder = copied_volume_set(&parent, label, &numbers);
        assert_eq!(
            review(&folder.join(format!("Game 雨.part{selected:02}.rar")), None).err(),
            Some("archive_missing_part"),
            "{label}"
        );
    }
    let folder = copied_volume_set(&parent, "duplicate", &[1, 2, 3]);
    fs::copy(
        folder.join("Game 雨.part01.rar"),
        folder.join("Game 雨.part1.rar"),
    )
    .unwrap();
    assert_eq!(
        review(&folder.join("Game 雨.part01.rar"), None).err(),
        Some("archive_collision")
    );
    let folder = copied_volume_set(&parent, "changed", &[1, 2, 3]);
    let plan = review(&folder.join("Game 雨.part02.rar"), None).unwrap();
    let second = folder.join("Game 雨.part02.rar");
    let mut bytes = fs::read(&second).unwrap();
    let offset = bytes.len() - 40;
    bytes[offset] ^= 1;
    fs::write(&second, bytes).unwrap();
    assert_eq!(
        unpack(plan.token, &parent, "changed-output").err(),
        Some("archive_changed")
    );
    assert!(!parent.join("changed-output").exists());
    let folder = copied_volume_set(&parent, "directory-part", &[1, 3]);
    fs::create_dir(folder.join("Game 雨.part02.rar")).unwrap();
    assert_eq!(
        review(&folder.join("Game 雨.part01.rar"), None).err(),
        Some("archive_links")
    );
    let folder = copied_volume_set(&parent, "mixed-format", &[1, 2, 3]);
    fs::copy(
        fixture("rar3-vols.part2.rar"),
        folder.join("Game 雨.part02.rar"),
    )
    .unwrap();
    assert_eq!(
        review(&folder.join("Game 雨.part01.rar"), None).err(),
        Some("archive_parts")
    );
    let folder = copied_volume_set(&parent, "extra-part", &[1, 2, 3]);
    fs::copy(
        fixture("rar5-vols.part3.rar"),
        folder.join("Game 雨.part04.rar"),
    )
    .unwrap();
    assert_eq!(
        review(&folder.join("Game 雨.part01.rar"), None).err(),
        Some("archive_parts")
    );
    let folder = copied_volume_set(&parent, "recovered", &[1, 2, 3]);
    let plan = review(&folder.join("Game 雨.part03.rar"), None).unwrap();
    assert!(unpack(plan.token, &parent, "recovered-output").is_ok());
}

#[test]
#[ignore = "requires pinned primary-project binary fixtures"]
fn rar_multipart_cancel_before_publication_leaves_original_parts_and_next_job_usable() {
    let _serial = SERIAL.lock().unwrap();
    let parent = destination();
    let plan = review(&fixture("rar5-vols.part2.rar"), None).unwrap();
    let original = plan.parts.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let cancel_id = id.clone();
    let result = extract(
        "rar-test".into(),
        plan.token,
        parent.to_string_lossy().into(),
        "canceled-parts".into(),
        id,
        move |event| {
            if event.phase == "extracting" {
                cancel("rar-test".into(), cancel_id.clone());
            }
        },
    );
    assert_eq!(result.err(), Some("archive_canceled"));
    assert!(!parent.join("canceled-parts").exists());
    let plan = review(&fixture("rar5-vols.part1.rar"), None).unwrap();
    assert_eq!(plan.parts, original);
    assert!(unpack(plan.token, &parent, "after-part-cancel").is_ok());
}

#[test]
#[ignore = "requires pinned primary-project binary fixtures"]
fn rar_cancel_and_source_replacement_preserve_destination() {
    let _serial = SERIAL.lock().unwrap();
    let parent = destination();
    let path = fixture("rar5-solid.rar");
    let plan = review(&path, None).unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let cancel_id = id.clone();
    let result = extract(
        "rar-test".into(),
        plan.token,
        parent.to_string_lossy().into(),
        "canceled".into(),
        id,
        move |event| {
            if event.phase == "extracting" {
                cancel("rar-test".into(), cancel_id.clone());
            }
        },
    );
    assert_eq!(result.err(), Some("archive_canceled"));
    assert!(!parent.join("canceled").exists());
    let copy = parent.join("changed.rar");
    fs::copy(path, &copy).unwrap();
    let plan = review(&copy, None).unwrap();
    fs::write(copy, b"Rar!changed").unwrap();
    assert_eq!(
        unpack(plan.token, &parent, "changed-output").err(),
        Some("archive_changed")
    );
    assert!(!parent.join("changed-output").exists());
    let plan = review(&fixture("rar5-crc.rar"), None).unwrap();
    assert!(unpack(plan.token, &parent, "after-cancel").is_ok());
}

#[test]
#[ignore = "requires an explicitly supplied, bounded source download"]
fn rar_actual_source_package() {
    let _serial = SERIAL.lock().unwrap();
    let path = PathBuf::from(std::env::var_os("HARBOR_RAR_SOURCE").expect("HARBOR_RAR_SOURCE"));
    let parent = PathBuf::from(std::env::var_os("HARBOR_RAR_OUTPUT").expect("HARBOR_RAR_OUTPUT"));
    let report = PathBuf::from(std::env::var_os("HARBOR_RAR_REPORT").expect("HARBOR_RAR_REPORT"));
    assert!(path.is_absolute() && parent.is_absolute() && report.is_absolute());
    assert!(fs::metadata(&path).unwrap().len() < 128 * 1024 * 1024);
    let plan = review(&path, None).unwrap();
    assert!(plan.expanded_bytes < 512 * 1024 * 1024);
    let receipt = unpack(plan.token.clone(), &parent, "native-source-unpacked").unwrap();
    fs::write(
        report,
        serde_json::to_vec_pretty(&serde_json::json!({"plan": plan, "receipt": receipt})).unwrap(),
    )
    .unwrap();
}
