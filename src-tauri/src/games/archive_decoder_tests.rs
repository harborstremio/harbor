use super::super::{cancel, extract, inspect, tests::SERIAL};
use super::*;
use sevenz_rust2::{
    encoder_options::AesEncoderOptions, ArchiveEntry as SevenEntry, ArchiveWriter,
    EncoderConfiguration, EncoderMethod, Password, SourceReader,
};
use std::{fs, io::Cursor, path::PathBuf};

include!("archive_split_tests.rs");

#[test]
#[ignore]
fn worker_entry() {
    std::process::exit(worker::main());
}

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("sevenzip-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }
    fn package(&self, password: Option<&str>, header: bool, solid: bool) -> PathBuf {
        let path = self.0.join("Game 雨.7z");
        let mut writer = ArchiveWriter::create(&path).unwrap();
        let mut methods = vec![EncoderConfiguration::new(EncoderMethod::LZMA2)];
        if let Some(password) = password {
            methods.insert(0, AesEncoderOptions::new(Password::new(password)).into());
        }
        writer.set_content_methods(methods);
        writer.set_encrypt_header(header);
        let entries = vec![
            SevenEntry::new_file("game.bin"),
            SevenEntry::new_file("data/世界.txt"),
        ];
        let data = [vec![73; 2 * 1024 * 1024], b"Unicode data".to_vec()];
        if solid {
            writer
                .push_archive_entries(
                    entries,
                    data.into_iter()
                        .map(|v| SourceReader::new(Cursor::new(v)))
                        .collect(),
                )
                .unwrap();
        } else {
            for (entry, bytes) in entries.into_iter().zip(data) {
                writer
                    .push_archive_entry(entry, Some(Cursor::new(bytes)))
                    .unwrap();
            }
        }
        // 0.20.2's test-only encoder inverts the anti-item bit. Suppress that
        // property so the resulting fixture contains an ordinary directory.
        let mut directory = SevenEntry::new_directory("empty");
        directory.is_anti_item = true;
        writer
            .push_archive_entry(directory, None::<Cursor<Vec<u8>>>)
            .unwrap();
        writer.finish().unwrap();
        path
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}
fn review(path: &Path, password: Option<&str>) -> Result<super::super::ArchivePlan> {
    inspect(
        "seven-test".into(),
        path.to_string_lossy().into(),
        id(),
        password.map(str::to_owned),
        |_| {},
    )
}
fn run(f: &Fixture, token: String, destination: &str) -> Result<super::super::ArchiveReceipt> {
    extract(
        "seven-test".into(),
        token,
        f.0.to_string_lossy().into(),
        destination.into(),
        id(),
        |_| {},
    )
}

#[test]
fn solid_and_separate_sevenzip_round_trip_with_unicode_empty_folders_and_passwords() {
    let _serial = SERIAL.lock().unwrap();
    for solid in [false, true] {
        for (password, header) in [
            (None, false),
            (Some("雨 secret"), false),
            (Some("雨 secret"), true),
        ] {
            let f = Fixture::new();
            let path = f.package(password, header, solid);
            let original = fs::read(&path).unwrap();
            if password.is_some() {
                assert_eq!(review(&path, None).err(), Some("archive_encrypted"));
            }
            let plan = review(&path, password).unwrap_or_else(|error| {
                panic!(
                    "review {error}, solid={solid}, encrypted={}, header={header}",
                    password.is_some()
                )
            });
            assert_eq!(plan.file_count, 2);
            let receipt = run(&f, plan.token, "Installed").unwrap_or_else(|error| {
                panic!(
                    "extract {error}, solid={solid}, encrypted={}, header={header}",
                    password.is_some()
                )
            });
            assert_eq!(receipt.bytes, 2 * 1024 * 1024 + 12);
            assert_eq!(
                fs::read(f.0.join("Installed/game.bin")).unwrap(),
                vec![73; 2 * 1024 * 1024]
            );
            assert_eq!(
                fs::read(f.0.join("Installed/data/世界.txt")).unwrap(),
                b"Unicode data"
            );
            assert!(f.0.join("Installed/empty").is_dir());
            assert_eq!(fs::read(path).unwrap(), original);
        }
    }
}

#[test]
fn wrong_password_corruption_and_cancel_never_publish_output_and_allow_retry() {
    let _serial = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let path = f.package(Some("correct"), true, true);
    let wrong_header = review(&path, Some("wrong")).err();
    assert_eq!(wrong_header, Some("archive_password"));
    let plan = review(&path, Some("correct")).unwrap();
    let operation = id();
    let result = extract(
        "seven-test".into(),
        plan.token,
        f.0.to_string_lossy().into(),
        "Canceled".into(),
        operation.clone(),
        |event| {
            if event.current_file.is_some() {
                cancel("seven-test".into(), operation.clone());
            }
        },
    );
    assert_eq!(result.err(), Some("archive_canceled"));
    assert!(!f.0.join("Canceled").exists());
    let plan = review(&path, Some("correct")).unwrap();
    run(&f, plan.token, "Retry").unwrap();
    let path = f.package(Some("correct"), false, false);
    let plan = review(&path, Some("wrong")).unwrap();
    let wrong_data = run(&f, plan.token, "Wrong").err();
    assert!(
        matches!(
            wrong_data,
            Some("archive_password_or_checksum" | "archive_password")
        ),
        "{wrong_data:?}"
    );
    assert!(!f.0.join("Wrong").exists());
    let path = f.package(None, false, false);
    let mut bytes = fs::read(&path).unwrap();
    bytes[40] ^= 0xff;
    fs::write(&path, &bytes).unwrap();
    let plan = review(&path, None).unwrap();
    assert_eq!(
        run(&f, plan.token, "Corrupt").err(),
        Some("archive_checksum")
    );
    assert!(!f.0.join("Corrupt").exists());
    assert!(!fs::read_dir(&f.0).unwrap().any(|e| e
        .unwrap()
        .file_name()
        .to_string_lossy()
        .starts_with(".harbor-extract-")));
}

#[test]
fn unsafe_paths_collisions_and_links_are_rejected_before_destination_creation() {
    let _serial = SERIAL.lock().unwrap();
    for names in [
        vec!["../escape"],
        vec!["C:/escape"],
        vec!["CON.txt"],
        vec!["A", "a"],
        vec!["a", "a/child"],
    ] {
        let f = Fixture::new();
        let path = f.0.join("unsafe.7z");
        let mut writer = ArchiveWriter::create(&path).unwrap();
        for name in names {
            writer
                .push_archive_entry(SevenEntry::new_file(name), Some(Cursor::new(b"test")))
                .unwrap();
        }
        writer.finish().unwrap();
        assert!(matches!(
            review(&path, None).err(),
            Some("archive_path" | "archive_collision")
        ));
    }
    let f = Fixture::new();
    let path = f.0.join("link.7z");
    let mut writer = ArchiveWriter::create(&path).unwrap();
    let mut entry = SevenEntry::new_file("link");
    entry.has_windows_attributes = true;
    entry.windows_attributes = 0o120777 << 16 | 0x8000;
    writer
        .push_archive_entry(entry, Some(Cursor::new(b"target")))
        .unwrap();
    writer.finish().unwrap();
    assert_eq!(review(&path, None).err(), Some("archive_links"));
}

#[test]
fn hostile_header_allocation_is_contained_and_next_archive_still_works() {
    let _serial = SERIAL.lock().unwrap();
    let f = Fixture::new();
    // Valid signature/checksums, but a files-info count requesting billions of entries.
    // This exercises the decoder's actual header allocation inside its OS memory limit.
    let header = [0x01, 0x05, 0xff, 0xff, 0xff, 0xff, 0x7f, 0, 0, 0, 0, 0, 0];
    let mut start = Vec::new();
    start.extend_from_slice(&0u64.to_le_bytes());
    start.extend_from_slice(&(header.len() as u64).to_le_bytes());
    start.extend_from_slice(&crc32fast::hash(&header).to_le_bytes());
    let mut bytes = b"7z\xbc\xaf\x27\x1c\x00\x04".to_vec();
    bytes.extend_from_slice(&crc32fast::hash(&start).to_le_bytes());
    bytes.extend(start);
    bytes.extend(header);
    let path = f.0.join("hostile.7z");
    fs::write(&path, bytes).unwrap();
    let began = Instant::now();
    assert!(matches!(
        review(&path, None).err(),
        Some("archive_decoder" | "archive_limit")
    ));
    assert!(began.elapsed() < Duration::from_secs(30));
    let source = f.package(None, false, true);
    let plan = review(&source, None).unwrap();
    run(&f, plan.token, "After failure").unwrap();
}

#[test]
fn decoder_protocol_rejects_oversized_and_unknown_frames_before_allocating() {
    for (kind, length) in [
        (protocol::DATA, u32::MAX),
        (protocol::ENTRY, protocol::META as u32 + 1),
        (protocol::DONE, 1),
        (255, 0),
    ] {
        let mut bytes = vec![kind];
        bytes.extend_from_slice(&length.to_le_bytes());
        assert!(protocol::read_frame(&mut Cursor::new(bytes)).is_err());
    }
    assert!(protocol::read_request(&mut Cursor::new(u32::MAX.to_le_bytes())).is_err());
    let request = protocol::Request {
        source: "C:/game.7z".into(),
        parts: vec!["C:/game.7z".into()],
        extract: true,
        password: Some("secret 雨".into()),
    };
    let mut bytes = Vec::new();
    protocol::write_request(&mut bytes, &request).unwrap();
    assert_eq!(
        protocol::read_request(&mut Cursor::new(bytes))
            .unwrap()
            .password
            .as_deref(),
        Some("secret 雨")
    );
}

#[test]
fn additional_standard_compression_methods_preserve_exact_contents() {
    let _serial = SERIAL.lock().unwrap();
    for method in [
        EncoderMethod::COPY,
        EncoderMethod::LZMA,
        EncoderMethod::BZIP2,
        EncoderMethod::PPMD,
        EncoderMethod::DEFLATE,
    ] {
        let f = Fixture::new();
        let path = f.0.join("method.7z");
        let mut writer = ArchiveWriter::create(&path).unwrap();
        writer.set_content_methods(vec![EncoderConfiguration::new(method)]);
        let bytes: Vec<u8> = (0..65536).map(|value| (value % 251) as u8).collect();
        writer
            .push_archive_entry(
                SevenEntry::new_file("contents.bin"),
                Some(Cursor::new(&bytes)),
            )
            .unwrap();
        writer.finish().unwrap();
        let plan = review(&path, None).unwrap();
        run(&f, plan.token, "Installed").unwrap();
        assert_eq!(fs::read(f.0.join("Installed/contents.bin")).unwrap(), bytes);
    }
}

#[test]
fn cancellation_during_worker_wait_reaps_it_without_waiting_for_decode() {
    let _serial = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let path = f.package(Some("correct"), true, true);
    let operation = id();
    let work = super::super::start("seven-test", &operation).unwrap();
    let mut decoder = Decoder::open(&path, std::slice::from_ref(&path), Some("correct"), true).unwrap();
    cancel("seven-test".into(), operation);
    let began = Instant::now();
    assert_eq!(decoder.next(&work).err(), Some("archive_canceled"));
    drop(decoder);
    assert!(began.elapsed() < Duration::from_secs(2));
}

// Independent encoder interoperability proof. Run explicitly with an official
// 7-Zip console executable; the ordinary test suite needs no installed tools.
#[test]
#[ignore]
fn official_sevenzip_encoder_interoperability() {
    let _serial = SERIAL.lock().unwrap();
    let tool = std::env::var_os("HARBOR_TEST_7ZIP")
        .expect("Set HARBOR_TEST_7ZIP to the official console executable");
    let cases: Vec<(&str, Vec<&str>, Option<&str>)> = vec![
        ("copy", vec!["-m0=Copy"], None),
        ("lzma", vec!["-m0=LZMA:d=8m"], None),
        ("solid-lzma2", vec!["-m0=LZMA2:d=8m", "-ms=on"], None),
        ("bcj-lzma2", vec!["-m0=BCJ", "-m1=LZMA2:d=8m"], None),
        (
            "bcj2-lzma2",
            vec![
                "-m0=BCJ2",
                "-m1=LZMA2:d=8m",
                "-m2=LZMA2:d=8m",
                "-m3=LZMA2:d=8m",
                "-mb0:1",
                "-mb0s1:2",
                "-mb0s2:3",
            ],
            None,
        ),
        (
            "encrypted-solid",
            vec!["-m0=LZMA2:d=8m", "-ms=on", "-pfixture-password", "-mhe=on"],
            Some("fixture-password"),
        ),
    ];
    for (name, options, password) in cases {
        let f = Fixture::new();
        let input = f.0.join("input");
        fs::create_dir_all(input.join("empty")).unwrap();
        let bytes: Vec<u8> = (0..262144).map(|value| (value % 251) as u8).collect();
        fs::write(input.join("game.bin"), &bytes).unwrap();
        fs::write(input.join("世界.txt"), b"independent encoder").unwrap();
        let path = f.0.join(format!("{name}.7z"));
        let output = Command::new(&tool)
            .current_dir(&input)
            .args(["a", "-t7z", "-mmt=2", "-bso0", "-bsp0"])
            .args(options)
            .arg(&path)
            .arg(".")
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "7-Zip fixture {name}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        let plan = review(&path, password).unwrap_or_else(|error| panic!("{name} review: {error}"));
        let receipt = run(&f, plan.token, "Installed")
            .unwrap_or_else(|error| panic!("{name} extraction: {error}"));
        assert_eq!(receipt.files, 2);
        assert_eq!(fs::read(f.0.join("Installed/game.bin")).unwrap(), bytes);
        assert_eq!(
            fs::read(f.0.join("Installed/世界.txt")).unwrap(),
            b"independent encoder"
        );
        assert!(f.0.join("Installed/empty").is_dir());
        eprintln!(
            "{name}: {} exact bytes, 2 files and empty directory",
            receipt.bytes
        );
    }
}
