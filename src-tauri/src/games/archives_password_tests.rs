use super::*;
use zip::{unstable::write::FileOptionsExt, AesMode};

pub(super) fn encrypted(f: &Fixture, mode: Option<AesMode>, mixed: bool, password: &str) -> PathBuf {
    let path = f.0.join("password.zip");
    let mut zip = zip::ZipWriter::new(File::create(&path).unwrap());
    if mixed {
        zip.start_file("readme.txt", SimpleFileOptions::default()).unwrap();
        zip.write_all(b"plain file").unwrap();
    }
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    let options = match mode {
        Some(mode) => options.with_aes_encryption(mode, password),
        None => options.with_deprecated_encryption(password.as_bytes()),
    };
    zip.start_file("data/世界.bin", options).unwrap();
    zip.write_all(&vec![73; 2 * 1024 * 1024]).unwrap();
    zip.finish().unwrap();
    path
}
pub(super) fn unlock(path: &Path, password: &str) -> Result<ArchivePlan> {
    inspect("fixture".into(), path.to_string_lossy().into(), id(), Some(password.into()), |_| {})
}

#[test]
fn zip_passwords_round_trip_aes_strengths_and_zipcrypto_with_mixed_entries() {
    let _guard = SERIAL.lock().unwrap();
    for mode in [Some(AesMode::Aes128), Some(AesMode::Aes192), Some(AesMode::Aes256), None] {
        let f = Fixture::new();
        let password = "Harbor 雨 🔑";
        let source = encrypted(&f, mode, true, password);
        let original = fs::read(&source).unwrap();
        assert_eq!(review(&source).err(), Some("archive_encrypted"));
        let plan = unlock(&source, password).unwrap();
        assert_eq!(plan.file_count, 2);
        assert!(!serde_json::to_string(&plan).unwrap().contains(password));
        let secret = Arc::downgrade(prepared("fixture", &plan.token).unwrap().password.as_ref().unwrap());
        let receipt = run(&f, &plan, "Game").unwrap();
        assert_eq!(receipt.bytes, 2 * 1024 * 1024 + 10);
        assert_eq!(fs::read(f.0.join("Game/data/世界.bin")).unwrap(), vec![73; 2 * 1024 * 1024]);
        assert_eq!(fs::read(f.0.join("Game/readme.txt")).unwrap(), b"plain file");
        assert_eq!(fs::read(source).unwrap(), original);
        assert!(secret.upgrade().is_none());
    }
}

#[test]
fn missing_or_wrong_password_is_rejected_before_full_archive_hash_and_can_retry() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let source = encrypted(&f, Some(AesMode::Aes256), false, "correct");
    let hashed = AtomicBool::new(false);
    for password in [None, Some("incorrect".into())] {
        let expected = if password.is_none() { "archive_encrypted" } else { "archive_password" };
        let result = inspect("fixture".into(), source.to_string_lossy().into(), id(), password, |_| { hashed.store(true, Ordering::Relaxed); });
        assert_eq!(result.err(), Some(expected));
        assert!(!hashed.load(Ordering::Relaxed));
    }
    let plan = unlock(&source, "correct").unwrap();
    assert!(prepared("other-profile", &plan.token).is_err());
    let secret = Arc::downgrade(prepared("fixture", &plan.token).unwrap().password.as_ref().unwrap());
    discard("fixture".into(), plan.token);
    assert!(secret.upgrade().is_none());
    let plan = unlock(&source, "correct").unwrap();
    run(&f, &plan, "Retry").unwrap();
}

#[test]
fn aes_authentication_failure_never_publishes_partial_output() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let source = encrypted(&f, Some(AesMode::Aes256), false, "correct");
    let mut bytes = fs::read(&source).unwrap();
    let central = bytes.windows(4).position(|value| value == b"PK\x01\x02").unwrap();
    bytes[central - 1] ^= 0xff; // Authentication tag, leaving the password header intact.
    fs::write(&source, &bytes).unwrap();
    let plan = unlock(&source, "correct").unwrap();
    assert_eq!(run(&f, &plan, "Corrupt").err(), Some("archive_checksum"));
    assert!(!f.0.join("Corrupt").exists());
    assert!(!fs::read_dir(&f.0).unwrap().any(|entry| entry.unwrap().file_name().to_string_lossy().starts_with(".harbor-extract-")));
    assert_eq!(fs::read(source).unwrap(), bytes);
}

#[test]
fn encrypted_extraction_cancel_releases_password_and_keeps_original() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let source = encrypted(&f, Some(AesMode::Aes256), false, "correct");
    let original = fs::read(&source).unwrap();
    let plan = unlock(&source, "correct").unwrap();
    let secret = Arc::downgrade(prepared("fixture", &plan.token).unwrap().password.as_ref().unwrap());
    let operation = id();
    let result = extract("fixture".into(), plan.token, f.0.to_string_lossy().into(), "Canceled".into(), operation.clone(), |event| {
        if event.current_file.is_some() { cancel("fixture".into(), operation.clone()); }
    });
    assert_eq!(result.err(), Some("archive_canceled"));
    assert!(!f.0.join("Canceled").exists());
    assert!(secret.upgrade().is_none());
    assert_eq!(fs::read(source).unwrap(), original);
}
