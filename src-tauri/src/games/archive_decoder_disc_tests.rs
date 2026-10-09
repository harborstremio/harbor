use super::super::{cancel, extract, inspect, start, tests::SERIAL, ArchivePlan};
use super::*;
use flate2::read::GzDecoder;
use sha2::{Digest, Sha256};
use std::{fs, io::Write};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let path = std::env::var_os("HARBOR_GAME_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("disc-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }
    fn image(&self, data: &[u8]) -> PathBuf {
        let path = self.0.join("Image 雨.iso");
        let mut source = GzDecoder::new(data);
        std::io::copy(&mut source, &mut fs::File::create(&path).unwrap()).unwrap();
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
fn review(path: &Path) -> Result<ArchivePlan> {
    inspect(
        "disc-test".into(),
        path.to_string_lossy().into(),
        id(),
        None,
        |_| {},
    )
}
fn unpack(
    fixture: &Fixture,
    plan: ArchivePlan,
    name: &str,
) -> Result<super::super::ArchiveReceipt> {
    extract(
        "disc-test".into(),
        plan.token,
        fixture.0.to_string_lossy().into(),
        name.into(),
        id(),
        |_| {},
    )
}
macro_rules! image {
    ($name:literal) => {
        include_bytes!(concat!("../../tests/fixtures/disc/", $name, ".iso.gz")).as_slice()
    };
}

#[test]
fn descriptor_like_payload_is_not_mistaken_for_udf() {
    let _guard = SERIAL.lock().unwrap();
    let fixture = Fixture::new();
    let path = fixture.image(image!("descriptor-noise"));
    let plan = review(&path).unwrap();
    assert_eq!(plan.file_count, 1);
    unpack(&fixture, plan, "Installed").unwrap();
    assert_eq!(&fs::read(fixture.0.join("Installed/NOISE.BIN")).unwrap()[..7], b"\x00NSR03\x01");
}

#[test]
fn iso_joliet_rockridge_and_udf_publish_exact_payloads_and_empty_directories() {
    let _guard = SERIAL.lock().unwrap();
    for (image, name, file, empty) in [
        (image!("plain"), "plain", "DATA/PAYLOAD.BIN", "EMPTY"),
        (
            image!("joliet"),
            "joliet",
            "Data files/日本語 payload.bin",
            "Empty folder",
        ),
        (
            image!("rockridge"),
            "rockridge",
            "Data files/日本語 payload.bin",
            "Empty folder",
        ),
        (
            image!("both"),
            "both",
            "Data files/日本語 payload.bin",
            "Empty folder",
        ),
        (
            image!("udf_bridge"),
            "udf",
            "Data files/日本語 payload.bin",
            "Empty folder",
        ),
    ] {
        let f = Fixture::new();
        let path = f.image(image);
        let original = fs::read(&path).unwrap();
        let plan = review(&path).unwrap_or_else(|error| panic!("{name}: {error}"));
        assert_eq!(plan.file_count, 1, "{name}");
        assert_eq!(plan.expanded_bytes, 525600, "{name}");
        let receipt =
            unpack(&f, plan, "Installed").unwrap_or_else(|error| panic!("{name}: {error}"));
        let data = fs::read(f.0.join("Installed").join(file)).unwrap();
        assert_eq!(
            format!("{:x}", Sha256::digest(data)),
            "43ae9df8a6b22e4eb885beb7031ca47edcdd26f2b9b2bead7ad63918a17ec004"
        );
        assert_eq!(receipt.bytes, 525600);
        assert_eq!(receipt.files, 1);
        assert_eq!(receipt.sha256, format!("{:x}", Sha256::digest(&original)));
        assert!(f.0.join("Installed").join(empty).is_dir());
        assert_eq!(fs::read(path).unwrap(), original);
    }
}

#[test]
fn udf_namespace_is_complete_and_corrupt_udf_never_downgrades_to_iso() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    let path = f.image(image!("udf-extra"));
    let plan = review(&path).unwrap();
    assert_eq!(plan.file_count, 2);
    unpack(&f, plan, "Installed").unwrap();
    assert_eq!(
        fs::read(f.0.join("Installed/common.bin")).unwrap(),
        b"common namespace file"
    );
    assert_eq!(
        fs::read(f.0.join("Installed/udf-only.bin")).unwrap(),
        b"file present only in the UDF tree"
    );
    for bad in [
        image!("udf-bad-checksum"),
        image!("udf-bad-identifier"),
        image!("udf-bad-name_length"),
    ] {
        let path = f.image(bad);
        assert_eq!(review(&path).err(), Some("archive_format"));
    }
}

#[test]
fn disc_paths_collisions_links_and_udf_special_types_are_rejected() {
    let _guard = SERIAL.lock().unwrap();
    let f = Fixture::new();
    for (data, expected) in [
        (image!("unsafe"), "archive_path"),
        (image!("reserved"), "archive_path"),
        (image!("collision"), "archive_collision"),
        (image!("symlink"), "archive_links"),
        (image!("udf-special-6"), "archive_format"),
        (image!("udf-special-7"), "archive_format"),
        (image!("udf-special-9"), "archive_format"),
        (image!("udf-special-10"), "archive_format"),
        (image!("udf-special-12"), "archive_format"),
    ] {
        let path = f.image(data);
        assert_eq!(review(&path).err(), Some(expected));
        assert_eq!(fs::read_dir(&f.0).unwrap().count(), 1);
    }
}

#[test]
fn disc_cancel_cleans_stage_and_replaced_source_never_publishes() {
    let _guard = SERIAL.lock().unwrap();
    for data in [image!("plain"), image!("udf_bridge")] {
        let f = Fixture::new();
        let path = f.image(data);
        let original = fs::read(&path).unwrap();
        let plan = review(&path).unwrap();
        let operation = id();
        let result = extract(
            "disc-test".into(),
            plan.token,
            f.0.to_string_lossy().into(),
            "Canceled".into(),
            operation.clone(),
            |progress| {
                if progress.current_file.is_some() {
                    cancel("disc-test".into(), operation.clone());
                }
            },
        );
        assert_eq!(result.err(), Some("archive_canceled"));
        assert!(!f.0.join("Canceled").exists());
        assert_eq!(fs::read_dir(&f.0).unwrap().count(), 1);
        assert_eq!(fs::read(&path).unwrap(), original);
        let plan = review(&path).unwrap();
        fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .unwrap()
            .write_all(b"changed")
            .unwrap();
        assert_eq!(unpack(&f, plan, "Changed").err(), Some("archive_changed"));
        assert!(!f.0.join("Changed").exists());
        fs::write(&path, original).unwrap();
        unpack(&f, review(&path).unwrap(), "Retry").unwrap();
    }
}

#[test]
fn truncated_disc_extents_cannot_publish_partial_output() {
    let _guard = SERIAL.lock().unwrap();
    for data in [image!("plain"), image!("udf_bridge")] {
        let f = Fixture::new();
        let path = f.image(data);
        let bytes = fs::read(&path).unwrap();
        let payload = (0..=255).collect::<Vec<u8>>();
        let offset = bytes
            .windows(payload.len())
            .position(|slice| slice == payload)
            .unwrap();
        fs::OpenOptions::new()
            .write(true)
            .open(&path)
            .unwrap()
            .set_len((offset + 500) as u64)
            .unwrap();
        if let Ok(plan) = review(&path) {
            assert!(unpack(&f, plan, "Truncated").is_err());
        }
        assert!(!f.0.join("Truncated").exists());
        assert_eq!(fs::read_dir(&f.0).unwrap().count(), 1);
    }
}

#[test]
#[ignore = "requires qualified sparse >4 GiB corpus; hashes worker stream without output allocation"]
fn iso_and_udf_above_four_gib_stream_exactly_through_worker() {
    let _guard = SERIAL.lock().unwrap();
    let root = PathBuf::from(
        std::env::var_os("HARBOR_DISC_LARGE_FIXTURES").expect("large disc fixture root"),
    );
    for name in [
        "independently-encoded-large-iso.iso",
        "recorded-multiextent-udf.iso",
    ] {
        let path = root.join(name).canonicalize().unwrap();
        let work = start("disc-test", &id()).unwrap();
        let entries = inventory(&path, std::slice::from_ref(&path), None, &work).unwrap();
        let mut hash = Sha256::new();
        let mut count = 0u64;
        visit(&path, std::slice::from_ref(&path), None, &entries, &work, |entry, reader, _| {
            if !entry.directory {
                let mut buffer = vec![0; 256 * 1024];
                loop {
                    let read = reader.read(&mut buffer).map_err(|_| "archive_read")?;
                    if read == 0 {
                        break;
                    }
                    count += read as u64;
                    hash.update(&buffer[..read]);
                }
            }
            Ok(())
        })
        .unwrap();
        assert_eq!(count, 4_294_971_452, "{name}");
        assert_eq!(
            format!("{:x}", hash.finalize()),
            "b9a25beba083bccdcbcc59150873d2722148a2025e2bd76487d7d5ab25de6c87",
            "{name}"
        );
    }
}
