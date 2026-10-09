//! ImageIO handles legacy/JP2 ICNS representations from bounded local bytes.
use core_foundation::{
    base::{CFRelease, CFType, TCFType},
    boolean::CFBoolean,
    data::{CFData, CFDataCreateMutable, CFDataRef},
    dictionary::CFDictionary,
    number::CFNumber,
    string::{CFString, CFStringRef},
};
use image::RgbaImage;
use std::{ffi::c_void, ptr};

type Object = *const c_void;
#[link(name = "ImageIO", kind = "framework")]
unsafe extern "C" {
    fn CGImageSourceCreateWithData(data: Object, options: Object) -> Object;
    fn CGImageSourceGetCount(source: Object) -> usize;
    fn CGImageSourceCopyPropertiesAtIndex(source: Object, index: usize, options: Object) -> Object;
    fn CGImageSourceCreateThumbnailAtIndex(source: Object, index: usize, options: Object)
        -> Object;
    fn CGImageDestinationCreateWithData(
        data: *mut c_void,
        kind: Object,
        count: usize,
        options: Object,
    ) -> Object;
    fn CGImageDestinationAddImage(destination: Object, image: Object, properties: Object);
    fn CGImageDestinationFinalize(destination: Object) -> bool;
    static kCGImageSourceCreateThumbnailFromImageAlways: CFStringRef;
    static kCGImageSourceThumbnailMaxPixelSize: CFStringRef;
    static kCGImageSourceShouldCache: CFStringRef;
    static kCGImagePropertyPixelWidth: CFStringRef;
    static kCGImagePropertyPixelHeight: CFStringRef;
}
#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGImageRelease(image: Object);
}

struct Owned(Object);
impl Owned {
    fn new(value: Object) -> Option<Self> {
        (!value.is_null()).then_some(Self(value))
    }
}
impl Drop for Owned {
    fn drop(&mut self) {
        unsafe {
            CFRelease(self.0);
        }
    }
}
struct Image(Object);
impl Drop for Image {
    fn drop(&mut self) {
        unsafe {
            CGImageRelease(self.0);
        }
    }
}

pub(super) fn decode(bytes: &[u8]) -> Option<RgbaImage> {
    if !bytes.starts_with(b"icns") || bytes.len() > super::decode::MAX_ASSET_BYTES {
        return None;
    }
    let data = CFData::from_buffer(bytes);
    let cache_key = unsafe { CFString::wrap_under_get_rule(kCGImageSourceShouldCache) };
    let options =
        CFDictionary::from_CFType_pairs(&[(cache_key, CFBoolean::false_value().as_CFType())]);
    let source = Owned::new(unsafe {
        CGImageSourceCreateWithData(data.as_CFTypeRef(), options.as_CFTypeRef())
    })?;
    let count = unsafe { CGImageSourceGetCount(source.0) };
    if count == 0 || count > 64 {
        return None;
    }
    let width_key = unsafe { CFString::wrap_under_get_rule(kCGImagePropertyPixelWidth) };
    let height_key = unsafe { CFString::wrap_under_get_rule(kCGImagePropertyPixelHeight) };
    let mut frames = Vec::new();
    for index in 0..count {
        let properties =
            unsafe { CGImageSourceCopyPropertiesAtIndex(source.0, index, ptr::null()) };
        if properties.is_null() {
            continue;
        }
        let properties: CFDictionary<CFString, CFType> =
            unsafe { CFDictionary::wrap_under_create_rule(properties.cast()) };
        let width = properties
            .find(&width_key)
            .and_then(|value| value.downcast::<CFNumber>())
            .and_then(|value| value.to_i64());
        let height = properties
            .find(&height_key)
            .and_then(|value| value.downcast::<CFNumber>())
            .and_then(|value| value.to_i64());
        if let (Some(width), Some(height)) = (width, height) {
            if !(1..=1024).contains(&width) || !(1..=1024).contains(&height) {
                continue;
            }
            frames.push((
                (
                    width < super::SIDE as i64,
                    width.abs_diff(super::SIDE as i64),
                ),
                index,
            ));
        }
    }
    frames.sort_by_key(|(score, _)| *score);
    let index = frames.first()?.1;
    let always =
        unsafe { CFString::wrap_under_get_rule(kCGImageSourceCreateThumbnailFromImageAlways) };
    let maximum = unsafe { CFString::wrap_under_get_rule(kCGImageSourceThumbnailMaxPixelSize) };
    let options = CFDictionary::from_CFType_pairs(&[
        (always, CFBoolean::true_value().as_CFType()),
        (maximum, CFNumber::from(super::SIDE as i32).as_CFType()),
    ]);
    let image =
        unsafe { CGImageSourceCreateThumbnailAtIndex(source.0, index, options.as_CFTypeRef()) };
    if image.is_null() {
        return None;
    }
    let image = Image(image);
    let buffer = unsafe { CFDataCreateMutable(ptr::null(), 0) };
    if buffer.is_null() {
        return None;
    }
    let output = unsafe { CFData::wrap_under_create_rule(buffer as CFDataRef) };
    let kind = CFString::new("public.png");
    let destination = Owned::new(unsafe {
        CGImageDestinationCreateWithData(buffer.cast(), kind.as_CFTypeRef(), 1, ptr::null())
    })?;
    unsafe {
        CGImageDestinationAddImage(destination.0, image.0, ptr::null());
    }
    if !unsafe { CGImageDestinationFinalize(destination.0) }
        || output.len() as usize > super::MAX_PNG_BYTES
    {
        return None;
    }
    super::decode::asset(output.bytes())
}
