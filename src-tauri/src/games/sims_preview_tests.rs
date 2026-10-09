use super::*;
use base64::Engine;
use image::{DynamicImage, ImageBuffer, Rgba};

fn png(size: u32, color: [u8; 4]) -> Vec<u8> {
    let image = DynamicImage::ImageRgba8(ImageBuffer::from_pixel(size, size, Rgba(color)));
    let mut output = Cursor::new(Vec::new());
    image
        .write_to(&mut output, image::ImageFormat::Png)
        .unwrap();
    output.into_inner()
}
struct Resource {
    kind: u32,
    group: u32,
    instance: u64,
    compression: u16,
    raw: Vec<u8>,
}
fn thumbnail(group: u32, instance: u64, raw: Vec<u8>) -> Resource {
    Resource {
        kind: 0x3c2a8647,
        group,
        instance,
        compression: 0,
        raw,
    }
}
fn package_with(resources: Vec<Resource>) -> Vec<u8> {
    let mut bytes = dbpf(0)[..96].to_vec();
    let mut index = 0u32.to_le_bytes().to_vec();
    bytes[36..40].copy_from_slice(&(resources.len() as u32).to_le_bytes());
    for resource in resources {
        let payload = if resource.compression == 0x5a42 {
            let mut compressor =
                flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
            compressor.write_all(&resource.raw).unwrap();
            compressor.finish().unwrap()
        } else {
            resource.raw.clone()
        };
        for word in [
            resource.kind,
            resource.group,
            (resource.instance >> 32) as u32,
            resource.instance as u32,
            bytes.len() as u32,
            0x8000_0000 | payload.len() as u32,
            resource.raw.len() as u32,
            0x0001_0000 | u32::from(resource.compression),
        ] {
            index.extend_from_slice(&word.to_le_bytes());
        }
        bytes.extend_from_slice(&payload);
    }
    let offset = bytes.len() as u64;
    bytes[64..72].copy_from_slice(&offset.to_le_bytes());
    bytes[44..48].copy_from_slice(&(index.len() as u32).to_le_bytes());
    bytes.extend_from_slice(&index);
    bytes
}
fn image_of(bytes: &[u8]) -> DynamicImage {
    let url = package::inspect(bytes, true).unwrap().thumbnail.unwrap();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(url.split_once(',').unwrap().1)
        .unwrap();
    image::load_from_memory(&bytes).unwrap()
}
#[test]
fn preview_prefers_the_sharp_variant_of_one_item_without_switching_identity_or_frame() {
    let content = package_with(vec![
        thumbnail(0, 0xfeed_0000_0000_0001, png(32, [255, 0, 0, 255])),
        thumbnail(3, 0xfeed_0000_0000_0001, png(512, [0, 255, 0, 255])),
        thumbnail(3, 0xfeed_0000_0000_0002, png(768, [0, 0, 255, 255])),
        thumbnail(0x103, 0xfeed_0000_0000_0001, png(1024, [255, 255, 0, 255])),
    ]);
    let result = image_of(&content).to_rgba8();
    assert_eq!(result.dimensions(), (320, 320));
    assert_eq!(result.get_pixel(100, 100).0, [0, 255, 0, 255]);
    assert!(package::inspect(&content, false)
        .unwrap()
        .thumbnail
        .is_none());
}
#[test]
fn preview_handles_compressed_and_general_thumbnails_and_ignores_texture_resources() {
    let mut generic = thumbnail(0, 42, png(128, [30, 80, 140, 255]));
    generic.kind = 0x5b282d45;
    generic.compression = 0x5a42;
    let mut texture = thumbnail(0, 42, png(256, [255, 0, 0, 255]));
    texture.kind = 0x00b2d882;
    let content = package_with(vec![
        texture,
        thumbnail(0, 42, b"not an image".to_vec()),
        generic,
    ]);
    let result = image_of(&content).to_rgba8();
    assert_eq!(result.dimensions(), (128, 128));
    assert_eq!(result.get_pixel(50, 50).0, [30, 80, 140, 255]);
}
#[test]
fn preview_limits_attempts_and_rejects_oversized_images_without_rejecting_the_mod() {
    let mut resources: Vec<_> = (0..16)
        .map(|n| thumbnail(0, n, b"bad image".to_vec()))
        .collect();
    resources.push(thumbnail(0, 17, png(32, [0, 255, 0, 255])));
    let inspected = package::inspect(&package_with(resources), true).unwrap();
    assert_eq!(inspected.resources, 17);
    assert!(inspected.thumbnail.is_none());
    let oversized = package_with(vec![thumbnail(0, 1, png(2049, [0, 0, 0, 255]))]);
    assert!(package::inspect(&oversized, true)
        .unwrap()
        .thumbnail
        .is_none());
}
#[test]
fn real_creator_clothing_and_decor_remain_valid_without_fabricating_texture_previews() {
    let clothing = include_bytes!("../../../tests/fixtures/games/sims/JacT-shirtF.package");
    let decor = include_bytes!("../../../tests/fixtures/games/sims/JacAudacityOfBacon.package");
    for (bytes, category, resources) in [
        (clothing.as_slice(), "cas", 2),
        (decor.as_slice(), "build", 29),
    ] {
        let inspected = package::inspect(bytes, true).unwrap();
        assert_eq!(inspected.category, category);
        assert_eq!(inspected.resources, resources);
        assert!(inspected.thumbnail.is_none());
    }
}
