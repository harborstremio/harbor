//! Actual local application icons, extracted without launching the selected program.
use super::{fingerprint, plain_path, Fingerprint};
use base64::Engine;
use std::{
    collections::VecDeque,
    fs::File,
    io::Read,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};

#[cfg(any(target_os = "linux", test))]
#[path = "setup_icon_appimage.rs"]
mod appimage;

#[path = "setup_icon_decode.rs"]
mod decode;
#[path = "setup_icon_local.rs"]
mod local;
#[cfg(target_os = "macos")]
#[path = "setup_icon_macos.rs"]
mod macos;
#[path = "setup_icon_pe.rs"]
mod pe;
#[cfg(windows)]
#[path = "setup_icon_windows.rs"]
mod windows_api;

const SIDE: u32 = 96;
const MAX_PNG_BYTES: usize = 64 * 1024;
const CACHE_ENTRIES: usize = 64;
type Versions = Vec<(PathBuf, Fingerprint)>;
type Cached = (PathBuf, Fingerprint, Versions, Option<String>);

#[derive(Default)]
struct Cache(VecDeque<Cached>);
impl Cache {
    fn get(
        &mut self,
        path: &Path,
        stamp: &Fingerprint,
        resources: &Versions,
    ) -> Option<Option<String>> {
        let index = self.0.iter().position(|(p, version, assets, _)| {
            p == path && version == stamp && assets == resources
        })?;
        let entry = self.0.remove(index)?;
        let result = entry.3.clone();
        self.0.push_back(entry);
        Some(result)
    }
    fn insert(
        &mut self,
        path: &Path,
        stamp: &Fingerprint,
        resources: Versions,
        image: Option<String>,
    ) {
        self.0.retain(|(p, _, _, _)| p != path);
        while self.0.len() >= CACHE_ENTRIES {
            self.0.pop_front();
        }
        self.0
            .push_back((path.to_path_buf(), stamp.clone(), resources, image));
    }
}

fn data(png: Vec<u8>) -> String {
    format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png)
    )
}

pub(super) fn read_index(path: &Path, stamp: &Fingerprint, index: i32) -> Option<String> {
    if index == 0 {
        return read(path, stamp);
    }
    #[cfg(windows)]
    return windows_api::extract_index(path, index).map(data);
    #[cfg(not(windows))]
    None
}

pub(super) fn read(path: &Path, stamp: &Fingerprint) -> Option<String> {
    static CACHE: OnceLock<Mutex<Cache>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(Cache::default()));
    let is_bundle = path.is_dir()
        && path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("app"));
    let mut header = [0u8; 2];
    let embedded = !is_bundle
        && File::open(path)
            .ok()
            .and_then(|mut file| file.read_exact(&mut header).ok())
            .is_some()
        && header == *b"MZ";
    if embedded {
        let resources = Vec::new();
        if let Some(cached) = cache.lock().ok()?.get(path, stamp, &resources) {
            return cached;
        }
        #[cfg(windows)]
        let png = windows_api::extract(path)
            .or_else(|| pe::extract(&mut File::open(path).ok()?).and_then(decode::encode));
        #[cfg(not(windows))]
        let png = pe::extract(&mut File::open(path).ok()?).and_then(decode::encode);
        let image = png.map(data);
        cache
            .lock()
            .ok()?
            .insert(path, stamp, resources, image.clone());
        return image;
    }
    if path.extension().is_some_and(|extension| {
        ["ico", "png", "jpg", "jpeg", "webp", "icns"]
            .iter()
            .any(|kind| extension.eq_ignore_ascii_case(kind))
    }) {
        if stamp.bytes > decode::MAX_ASSET_BYTES as u64 {
            return None;
        }
        if let Some(cached) = cache.lock().ok()?.get(path, stamp, &Vec::new()) {
            return cached;
        }
        let mut bytes = Vec::new();
        File::open(path)
            .ok()?
            .take(decode::MAX_ASSET_BYTES as u64 + 1)
            .read_to_end(&mut bytes)
            .ok()?;
        let image = decode::asset(&bytes).and_then(decode::encode).map(data);
        cache
            .lock()
            .ok()?
            .insert(path, stamp, Vec::new(), image.clone());
        return image;
    }
    let asset = if is_bundle {
        local::bundle(path)
    } else {
        #[cfg(target_os = "linux")]
        {
            local::linux(path, &local::linux_roots())
        }
        #[cfg(not(target_os = "linux"))]
        {
            None
        }
    };
    let Some(mut asset) = asset else {
        #[cfg(target_os = "linux")]
        if path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("appimage"))
        {
            let resources = Vec::new();
            if let Some(cached) = cache.lock().ok()?.get(path, stamp, &resources) {
                return cached;
            }
            let image = appimage::extract(path).and_then(decode::encode).map(data);
            if image.is_some() {
                cache
                    .lock()
                    .ok()?
                    .insert(path, stamp, resources, image.clone());
            }
            return image;
        }
        return None;
    };
    let resources = asset.key();
    if let Some(cached) = cache.lock().ok()?.get(path, stamp, &resources) {
        return asset.unchanged().then_some(cached).flatten();
    }
    let bytes = asset.bytes()?;
    let image = decode::asset(&bytes);
    #[cfg(target_os = "macos")]
    let image = image.or_else(|| macos::decode(&bytes));
    let image = image.and_then(decode::encode).map(data);
    if !asset.unchanged() {
        return None;
    }
    cache
        .lock()
        .ok()?
        .insert(path, stamp, resources, image.clone());
    image
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cache_is_bounded_and_requires_current_executable_and_asset_versions() {
        let path = Path::new("game.exe");
        let stamp = Fingerprint {
            bytes: 1,
            modified: std::time::UNIX_EPOCH,
            identity: (1, 2),
        };
        let mut cache = Cache::default();
        let resources = Vec::new();
        cache.insert(path, &stamp, resources.clone(), Some("icon".into()));
        assert_eq!(
            cache.get(path, &stamp, &resources),
            Some(Some("icon".into()))
        );
        let mut next = stamp.clone();
        next.identity.1 += 1;
        assert_eq!(cache.get(path, &next, &resources), None);
        next = stamp.clone();
        next.modified += std::time::Duration::from_secs(1);
        assert_eq!(cache.get(path, &next, &resources), None);
        assert_eq!(
            cache.get(
                path,
                &stamp,
                &vec![(PathBuf::from("game.icns"), stamp.clone())]
            ),
            None
        );
        for index in 0..CACHE_ENTRIES {
            cache.insert(
                Path::new(&format!("game{index}.exe")),
                &stamp,
                Vec::new(),
                None,
            );
        }
        assert_eq!(cache.0.len(), CACHE_ENTRIES);
        assert_eq!(cache.get(path, &stamp, &resources), None);
    }
    #[cfg(windows)]
    #[test]
    #[ignore = "requires an explicitly supplied installed executable; reads resources only"]
    fn actual_executable_icon_is_bounded_png() {
        let path = PathBuf::from(std::env::var_os("HARBOR_SETUP_ICON_EXE").unwrap());
        let image = windows_api::extract(&path).expect("embedded icon");
        let decoder = png::Decoder::new(std::io::Cursor::new(&image));
        let reader = decoder.read_info().unwrap();
        assert_eq!((reader.info().width, reader.info().height), (SIDE, SIDE));
        assert!(image.len() <= MAX_PNG_BYTES);
        if let Some(output) = std::env::var_os("HARBOR_SETUP_ICON_PNG") {
            std::fs::write(output, &image).unwrap();
        }
    }
}
