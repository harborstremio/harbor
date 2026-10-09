use super::*;
use base64::Engine;
use image::{DynamicImage, ImageBuffer, Rgb};

fn image_bytes(width: u32, color: [u8; 3], format: image::ImageFormat) -> Vec<u8> {
    let image = DynamicImage::ImageRgb8(ImageBuffer::from_pixel(width, 24, Rgb(color)));
    let mut output = Cursor::new(Vec::new());
    image.write_to(&mut output, format).unwrap();
    output.into_inner()
}
fn wrapped(payload: &[u8]) -> Vec<u8> {
    let mut result = (payload.len() as u64).to_le_bytes().to_vec();
    result.extend([
        0x8e, 0xfc, 0x24, 0x48, 0x9b, 0x78, 0x0e, 0x3c, 2, 0, 0, 0, 0, 0, 0, 0,
    ]);
    let mask = [0x41, 0x25, 0xe6, 0xcd, 0x47, 0xba, 0xb2, 0x1a];
    result.extend(payload.iter().enumerate().map(|(i, b)| b ^ mask[i % 8]));
    result
}
fn with_alpha(jpeg: &[u8], png: &[u8]) -> Vec<u8> {
    let mut result = jpeg[..2].to_vec();
    result.extend([0xff, 0xe0]);
    result.extend(((png.len() + 10) as u16).to_be_bytes());
    result.extend(b"ALFA");
    result.extend((png.len() as u32).to_be_bytes());
    result.extend(png);
    result.extend(&jpeg[2..]);
    result
}
#[test]
fn tray_images_decode_recognized_wrappers_and_preserve_alpha() {
    let jpeg = image_bytes(32, [190, 70, 50], image::ImageFormat::Jpeg);
    let alpha = image_bytes(32, [73, 73, 73], image::ImageFormat::Png);
    let raw = with_alpha(&jpeg, &alpha);
    for bytes in [&raw, &wrapped(&raw)] {
        let decoded = tray::images::decode(bytes).unwrap().to_rgba8();
        assert_eq!(decoded.dimensions(), (32, 24));
        assert!(decoded.pixels().all(|p| p[3] == 73));
        assert!(decoded.get_pixel(0, 0)[0].abs_diff(190) < 4);
    }
    assert!(tray::images::decode(&jpeg).is_some());
    assert!(tray::images::decode(&alpha).is_some());
}
#[test]
fn tray_legacy_images_accept_opaque_padding_without_weakening_newer_lengths() {
    let raw = with_alpha(
        &image_bytes(32, [190, 70, 50], image::ImageFormat::Jpeg),
        &image_bytes(32, [73, 73, 73], image::ImageFormat::Png),
    );
    let expected = tray::images::decode(&raw).unwrap().to_rgba8();
    let mut old = wrapped(&raw);
    old[16] = 1;
    for padding in [0u32, 0x00007ff5, u32::MAX] {
        old[4..8].copy_from_slice(&padding.to_le_bytes());
        assert_eq!(tray::images::decode(&old).unwrap().to_rgba8(), expected);
    }
    let mut bad = old.clone();
    bad[0] ^= 1;
    assert!(tray::images::decode(&bad).is_none());
    bad = old.clone();
    bad[16] = 3;
    assert!(tray::images::decode(&bad).is_none());
    bad = old;
    bad[16] = 2;
    assert!(tray::images::decode(&bad).is_none());
}
#[test]
fn tray_images_reject_unknown_wrappers_damage_and_oversized_masks() {
    let jpeg = image_bytes(32, [20, 70, 50], image::ImageFormat::Jpeg);
    let bytes = wrapped(&jpeg);
    for offset in [0, 8, 16, 20] {
        let mut bad = bytes.clone();
        bad[offset] ^= 0x80;
        assert!(tray::images::decode(&bad).is_none());
    }
    for cut in [0, 8, 23, 32] {
        assert!(tray::images::decode(&bytes[..cut]).is_none());
    }
    let mismatch = image_bytes(48, [0, 0, 0], image::ImageFormat::Png);
    assert!(tray::images::decode(&with_alpha(&jpeg, &mismatch)).is_none());
    let oversized = image_bytes(2049, [0, 0, 0], image::ImageFormat::Png);
    assert!(tray::images::decode(&oversized).is_none());
    let mut bad_alpha = with_alpha(&jpeg, &image_bytes(32, [0, 0, 0], image::ImageFormat::Png));
    bad_alpha[13] ^= 1;
    assert!(tray::images::decode(&bad_alpha).is_none());
    assert!(tray::images::decode(&vec![0; 8 * 1024 * 1024 + 1]).is_none());
}
fn preview_image(path: &str, id: &str) -> DynamicImage {
    let url = tray::images::preview(path, id).unwrap().unwrap();
    image::load_from_memory(
        &base64::engine::general_purpose::STANDARD
            .decode(url.split_once(',').unwrap().1)
            .unwrap(),
    )
    .unwrap()
}
#[test]
fn tray_cover_is_owned_sharp_and_stable_through_remove_restore() {
    let f = Fixture::new();
    let sources = f.0.join("source");
    fs::create_dir(&sources).unwrap();
    let mut paths = vec![];
    for (name, bytes) in [
        ("0x00000002!0x123456789abcdef0.trayitem", vec![0; 32]),
        ("0x00000000!0x123456789abcdef0.blueprint", vec![0; 32]),
        (
            "0x00000002!0x123456789abcdef0.bpi",
            image_bytes(24, [0, 0, 255], image::ImageFormat::Png),
        ),
        (
            "0x00000003!0x123456789abcdef0.bpi",
            wrapped(&image_bytes(640, [0, 200, 0], image::ImageFormat::Png)),
        ),
        (
            "0x00000103!0x123456789abcdef0.bpi",
            image_bytes(1600, [255, 0, 0], image::ImageFormat::Png),
        ),
    ] {
        let path = sources.join(name);
        fs::write(&path, bytes).unwrap();
        paths.push(path.to_string_lossy().into_owned());
    }
    let plan = tray::plan(
        f.path(),
        Action::TrayImport {
            title: "Preview fixture".into(),
        },
        paths,
    )
    .unwrap();
    let id = plan.target_id.clone();
    Store::connect(f.path()).unwrap().apply(plan).unwrap();
    for action in [
        None,
        Some(Action::TrayRemove { id: id.clone() }),
        Some(Action::TrayRestore { id: id.clone() }),
    ] {
        if let Some(action) = action {
            let plan = tray::plan(f.path(), action, vec![]).unwrap();
            Store::connect(f.path()).unwrap().apply(plan).unwrap();
        }
        let image = preview_image(f.path(), &id).to_rgba8();
        assert_eq!(image.width(), 320);
        assert_eq!(image.get_pixel(0, 0)[1], 200);
    }
    let target = f.0.join("Tray/0x00000003!0x123456789abcdef0.bpi");
    fs::write(
        &target,
        image_bytes(24, [255, 0, 0], image::ImageFormat::Png),
    )
    .unwrap();
    assert_eq!(tray::images::preview(f.path(), &id), Err("sims_changed"));
    assert_eq!(
        tray::images::preview(f.path(), "../../other"),
        Err("sims_record")
    );
    assert!(tray::images::preview(f.path(), &uuid::Uuid::new_v4().to_string()).is_err());
}
#[test]
fn tray_real_creator_lot_and_household_covers_decode_and_survive_lifecycle() {
    for (env, category, count) in [
        ("HARBOR_SIMS_TRAY_ARCHIVE", "lot", 7),
        ("HARBOR_SIMS_HOUSEHOLD_ARCHIVE", "household", 4),
    ] {
        let Ok(archive) = std::env::var(env) else {
            continue;
        };
        let f = Fixture::new();
        let plan = tray::plan(
            f.path(),
            Action::TrayImport {
                title: category.into(),
            },
            vec![archive],
        )
        .unwrap();
        let item = plan.tray.as_ref().unwrap().item.clone();
        assert_eq!(item.category, category);
        assert_eq!(item.files.len(), count);
        let reviewed = tray::images::payload_preview(&item, &plan.payload)
            .unwrap()
            .unwrap();
        Store::connect(f.path()).unwrap().apply(plan).unwrap();
        let original = tray::images::preview(f.path(), &item.id).unwrap().unwrap();
        assert_eq!(reviewed, original);
        assert_eq!(preview_image(f.path(), &item.id).width(), 320);
        for action in [
            Action::TrayRemove {
                id: item.id.clone(),
            },
            Action::TrayRestore {
                id: item.id.clone(),
            },
        ] {
            let plan = tray::plan(f.path(), action, vec![]).unwrap();
            Store::connect(f.path()).unwrap().apply(plan).unwrap();
            assert_eq!(
                tray::images::preview(f.path(), &item.id).unwrap().unwrap(),
                original
            );
        }
    }
}

#[test]
fn tray_review_picture_matches_applied_bytes_after_download_moves() {
    use super::super::super::sims_reviews;
    let Ok(archive) = std::env::var("HARBOR_SIMS_TRAY_ARCHIVE") else {
        return;
    };
    let f = Fixture::new();
    let selected = f.0.join("selected.zip");
    fs::copy(archive, &selected).unwrap();
    let review = sims_reviews::review(
        "preview-proof".into(),
        f.path().into(),
        Action::TrayImport {
            title: "Reviewed creation".into(),
        },
        vec![selected.to_string_lossy().into_owned()],
    )
    .unwrap();
    assert!(review
        .preview
        .as_ref()
        .is_some_and(|v| v.starts_with("data:image/png;base64,")));
    assert!(!f.0.join("Tray").exists());
    fs::rename(&selected, f.0.join("moved.zip")).unwrap();
    assert_eq!(
        sims_reviews::apply("other-profile".into(), review.token.clone()).err(),
        Some("sims_profile")
    );
    let workspace = sims_reviews::apply("preview-proof".into(), review.token).unwrap();
    assert_eq!(
        tray::images::preview(f.path(), &workspace.tray.items[0].id).unwrap(),
        review.preview
    );
}

fn varint(mut n: u64) -> Vec<u8> {
    let mut result = vec![];
    while n >= 128 {
        result.push((n as u8 & 127) | 128);
        n >>= 7;
    }
    result.push(n as u8);
    result
}
fn number(key: u64, value: u64) -> Vec<u8> {
    [varint(key << 3), varint(value)].concat()
}
fn message(key: u64, value: &[u8]) -> Vec<u8> {
    [
        varint((key << 3) | 2),
        varint(value.len() as u64),
        value.to_vec(),
    ]
    .concat()
}
fn household_metadata(id: u64, sims: &[u64]) -> Vec<u8> {
    let mut household = number(1, sims.len() as u64);
    for id in sims {
        household.extend(message(2, &number(5, *id)));
    }
    let metadata = [
        number(1, id),
        number(2, 1),
        message(10, &message(2, &household)),
    ]
    .concat();
    [
        vec![0; 4],
        (metadata.len() as u32).to_le_bytes().to_vec(),
        metadata,
    ]
    .concat()
}
#[test]
fn tray_household_portraits_must_match_metadata_sim_ids_and_indices() {
    let f = Fixture::new();
    let source = f.0.join("download");
    fs::create_dir(&source).unwrap();
    let item = source.join("0x00000001!0x000000000000002a.trayitem");
    fs::write(&item, household_metadata(42, &[91, 92])).unwrap();
    let mut paths = vec![item.to_string_lossy().into_owned()];
    for name in [
        "0x00000000!0x000000000000002a.householdbinary",
        "0x00000002!0x000000000000002a.hhi",
        "0x00000003!0x000000000000002a.hhi",
        "0x00000013!0x000000000000005b.sgi",
        "0x00000023!0x000000000000005c.sgi",
    ] {
        let path = source.join(name);
        fs::write(&path, [0; 32]).unwrap();
        paths.push(path.to_string_lossy().into_owned());
    }
    let imported = tray::format::read_sources(&paths).unwrap();
    assert_eq!(imported.files.len(), 6);
    assert!(tray::format::read_sources(&paths[..4]).is_ok()); // Portraits may be omitted.
    let wrong = source.join("0x00000023!0x0000000000000999.sgi");
    fs::write(&wrong, [0; 32]).unwrap();
    let mut invalid = paths.clone();
    invalid[5] = wrong.to_string_lossy().into_owned();
    assert_eq!(
        tray::format::read_sources(&invalid).err(),
        Some("sims_tray_set")
    );
    for metadata in [
        household_metadata(43, &[91, 92]),
        household_metadata(42, &[91, 91]),
        household_metadata(42, &[]),
    ] {
        fs::write(&item, metadata).unwrap();
        assert_eq!(
            tray::format::read_sources(&paths).err(),
            Some("sims_tray_set")
        );
    }
    for bytes in [
        vec![0; 8],
        vec![0, 0, 0, 0, 2, 0, 0, 0, 8, 255],
        [vec![0, 0, 0, 0, 11, 0, 0, 0, 8], vec![255; 10]].concat(),
    ] {
        fs::write(&item, bytes).unwrap();
        assert!(tray::format::read_sources(&paths).is_err());
    }
}
