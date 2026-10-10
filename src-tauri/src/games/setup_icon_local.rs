//! Declared local application artwork. Desktop commands are parsed for identity, never executed.
use super::{fingerprint, plain_path, Fingerprint};
#[cfg(any(target_os = "linux", test))]
use std::fs;
use std::{
    fs::{File, OpenOptions},
    io::{Cursor, Read, Seek, SeekFrom},
    path::{Component, Path, PathBuf},
};

const MAX_METADATA_BYTES: usize = 256 * 1024;
#[cfg(any(target_os = "linux", test))]
const MAX_DESKTOP_BYTES: usize = 32 * 1024;
#[cfg(any(target_os = "linux", test))]
const MAX_DESKTOP_FILES: usize = 64;
#[cfg(any(target_os = "linux", test))]
const MAX_ICON_ROOTS: usize = 8;

struct Resource {
    path: PathBuf,
    stamp: Fingerprint,
    file: File,
}
impl Resource {
    fn open(root: &Path, path: &Path, maximum: usize) -> Option<Self> {
        let root = plain_path(root).ok()?;
        // AppDirs commonly use relative icon symlinks. Resolve only within the verified root.
        let path = dunce::canonicalize(path).ok()?;
        if !path.starts_with(&root) || plain_path(&path).ok()? != path {
            return None;
        }
        let mut options = OpenOptions::new();
        options.read(true);
        #[cfg(windows)]
        {
            use std::os::windows::fs::OpenOptionsExt;
            options.share_mode(1);
        }
        let file = options.open(&path).ok()?;
        let stamp = fingerprint(&file).ok()?;
        if stamp.bytes == 0 || stamp.bytes > maximum as u64 {
            return None;
        }
        Some(Self { path, stamp, file })
    }
    fn bytes(&mut self) -> Option<Vec<u8>> {
        self.file.seek(SeekFrom::Start(0)).ok()?;
        let mut bytes = Vec::new();
        (&mut self.file)
            .take(self.stamp.bytes + 1)
            .read_to_end(&mut bytes)
            .ok()?;
        if bytes.len() as u64 != self.stamp.bytes || !self.unchanged() {
            return None;
        }
        Some(bytes)
    }
    fn unchanged(&self) -> bool {
        fingerprint(&self.file).is_ok_and(|stamp| stamp == self.stamp)
            && plain_path(&self.path).is_ok_and(|path| path == self.path)
            && File::open(&self.path)
                .ok()
                .and_then(|file| fingerprint(&file).ok())
                .is_some_and(|stamp| stamp == self.stamp)
    }
}

pub(super) struct Asset {
    resource: Resource,
    metadata: Vec<Resource>,
}
impl Asset {
    pub(super) fn key(&self) -> Vec<(PathBuf, Fingerprint)> {
        self.metadata
            .iter()
            .chain(std::iter::once(&self.resource))
            .map(|value| (value.path.clone(), value.stamp.clone()))
            .collect()
    }
    pub(super) fn bytes(&mut self) -> Option<Vec<u8>> {
        self.resource.bytes()
    }
    pub(super) fn unchanged(&self) -> bool {
        self.metadata.iter().all(Resource::unchanged) && self.resource.unchanged()
    }
}

fn filename(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 255
        && !value.chars().any(char::is_control)
        && !value.contains(['/', '\\', ':'])
        && matches!(
            Path::new(value).components().next(),
            Some(Component::Normal(_))
        )
}

pub(super) fn bundle(path: &Path) -> Option<Asset> {
    let root = plain_path(path).ok()?;
    let mut info = Resource::open(&root, &root.join("Contents/Info.plist"), MAX_METADATA_BYTES)?;
    let value = plist::Value::from_reader(Cursor::new(info.bytes()?)).ok()?;
    let dictionary = value.as_dictionary()?;
    let mut names = Vec::new();
    if let Some(name) = dictionary
        .get("CFBundleIconFile")
        .and_then(plist::Value::as_string)
    {
        names.push(name);
    }
    if let Some(values) = dictionary
        .get("CFBundleIconFiles")
        .and_then(plist::Value::as_array)
    {
        names.extend(values.iter().take(16).filter_map(plist::Value::as_string));
    }
    for name in names.into_iter().filter(|name| filename(name)) {
        let name = if Path::new(name).extension().is_none() {
            format!("{name}.icns")
        } else {
            name.to_owned()
        };
        if let Some(resource) = Resource::open(
            &root,
            &root.join("Contents/Resources").join(name),
            super::decode::MAX_ASSET_BYTES,
        ) {
            return Some(Asset {
                resource,
                metadata: vec![info],
            });
        }
    }
    None
}

#[derive(Default)]
#[cfg(any(target_os = "linux", test))]
struct Desktop {
    icon: String,
    executable: String,
    appimage: Option<String>,
}
#[cfg(any(target_os = "linux", test))]
fn unescape(value: &str) -> Option<String> {
    let mut output = String::new();
    let mut chars = value.chars();
    while let Some(character) = chars.next() {
        if character == '\\' {
            output.push(match chars.next()? {
                's' => ' ',
                'n' => '\n',
                't' => '\t',
                'r' => '\r',
                '\\' => '\\',
                _ => return None,
            });
        } else {
            output.push(character);
        }
    }
    Some(output)
}
#[cfg(any(target_os = "linux", test))]
fn command_path(value: &str) -> Option<String> {
    let value = value.trim_start();
    if let Some(quoted) = value.strip_prefix('"') {
        let mut output = String::new();
        let mut chars = quoted.chars();
        while let Some(character) = chars.next() {
            match character {
                '"' => {
                    return (!output.is_empty() && !output.contains(['%', '\0'])).then_some(output)
                }
                '\\' => output.push(match chars.next()? {
                    '\\' => '\\',
                    '"' => '"',
                    '$' => '$',
                    '`' => '`',
                    _ => return None,
                }),
                _ => output.push(character),
            }
        }
        None
    } else {
        let program = value.split_whitespace().next()?;
        (!program.contains(['%', '"', '\\', '$', '`', ';', '|', '&', '\0']))
            .then(|| program.to_owned())
    }
}
#[cfg(any(target_os = "linux", test))]
fn desktop(bytes: &[u8]) -> Option<Desktop> {
    let text = std::str::from_utf8(bytes).ok()?;
    let mut active = false;
    let mut found = false;
    let mut kind = None;
    let mut icon = None;
    let mut executable = None;
    let mut appimage = None;
    for line in text.lines().take(2048).map(str::trim) {
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        if line.starts_with('[') {
            active = line == "[Desktop Entry]";
            if active && found {
                return None;
            }
            found |= active;
            continue;
        }
        if !active {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        match key.trim() {
            "Type" => {
                if kind.replace(value.trim()).is_some() {
                    return None;
                }
            }
            "Icon" => {
                if icon.replace(unescape(value.trim())?).is_some() {
                    return None;
                }
            }
            "Exec" => {
                if executable.replace(command_path(value)?).is_some() {
                    return None;
                }
            }
            "X-AppImage-Path" => {
                if appimage.replace(unescape(value.trim())?).is_some() {
                    return None;
                }
            }
            "Hidden" if value.trim() == "true" => return None,
            _ => {}
        }
    }
    if kind != Some("Application") {
        return None;
    }
    Some(Desktop {
        icon: icon?,
        executable: executable?,
        appimage,
    })
}

#[cfg(any(target_os = "linux", test))]
fn same_file(left: &Path, right: &Path) -> bool {
    plain_path(left).is_ok_and(|left| plain_path(right).is_ok_and(|right| left == right))
}
#[cfg(any(target_os = "linux", test))]
fn desktop_matches(value: &Desktop, target: &Path, base: &Path, local: bool) -> bool {
    if value
        .appimage
        .as_deref()
        .is_some_and(|path| same_file(Path::new(path), target))
    {
        return true;
    }
    let executable = Path::new(&value.executable);
    if executable.is_absolute() {
        return same_file(executable, target);
    }
    if local && same_file(&base.join(executable), target) {
        return true;
    }
    if executable.components().count() != 1 {
        return false;
    }
    std::env::var_os("PATH").is_some_and(|paths| {
        std::env::split_paths(&paths)
            .take(32)
            .any(|directory| same_file(&directory.join(executable), target))
    })
}
#[cfg(any(target_os = "linux", test))]
fn icon_asset(value: &str, base: &Path, icon_roots: &[PathBuf]) -> Option<Resource> {
    if value.is_empty() || value.len() > 8192 || value.chars().any(char::is_control) {
        return None;
    }
    let requested = Path::new(value);
    if requested
        .components()
        .any(|part| matches!(part, Component::ParentDir))
    {
        return None;
    }
    if requested.is_absolute() {
        return std::iter::once(base)
            .chain(icon_roots.iter().map(PathBuf::as_path))
            .find_map(|root| Resource::open(root, requested, super::decode::MAX_ASSET_BYTES));
    }
    if !filename(value) {
        return None;
    }
    for extension in ["", ".png", ".ico", ".webp"] {
        let name = format!("{value}{extension}");
        if let Some(resource) =
            Resource::open(base, &base.join(&name), super::decode::MAX_ASSET_BYTES)
        {
            return Some(resource);
        }
        for root in icon_roots.iter().take(MAX_ICON_ROOTS) {
            for directory in [
                "icons/hicolor/96x96/apps",
                "icons/hicolor/128x128/apps",
                "icons/hicolor/256x256/apps",
                "icons/hicolor/64x64/apps",
                "icons/hicolor/48x48/apps",
                "pixmaps",
            ] {
                if let Some(resource) = Resource::open(
                    root,
                    &root.join(directory).join(&name),
                    super::decode::MAX_ASSET_BYTES,
                ) {
                    return Some(resource);
                }
            }
        }
    }
    None
}

#[cfg(any(target_os = "linux", test))]
pub(super) fn linux(selected: &Path, roots: &[PathBuf]) -> Option<Asset> {
    let parent = plain_path(selected.parent()?).ok()?;
    let is_desktop = selected
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("desktop"));
    let mut directories = vec![(parent.clone(), true)];
    if !is_desktop {
        directories.push((parent.join("share/applications"), true));
        if parent.file_name().is_some_and(|name| name == "bin") {
            if let Some(root) = parent.parent() {
                directories.push((root.join("share/applications"), true));
            }
        }
        for root in roots.iter().take(MAX_ICON_ROOTS) {
            directories.push((root.join("applications"), false));
        }
    }
    let mut remaining = 128usize;
    for (directory, local) in directories {
        let mut files = if is_desktop && directory == parent {
            vec![selected.to_path_buf()]
        } else {
            fs::read_dir(&directory)
                .ok()
                .into_iter()
                .flatten()
                .take(MAX_DESKTOP_FILES)
                .filter_map(|value| value.ok().map(|entry| entry.path()))
                .filter(|path| {
                    path.extension()
                        .is_some_and(|extension| extension == "desktop")
                })
                .collect::<Vec<_>>()
        };
        files.sort();
        for path in files {
            if remaining == 0 {
                return None;
            }
            remaining -= 1;
            let Some(mut metadata) = Resource::open(&directory, &path, MAX_DESKTOP_BYTES) else {
                continue;
            };
            let Some(value) = metadata.bytes().and_then(|bytes| desktop(&bytes)) else {
                continue;
            };
            // The outer selected executable, not the desktop filename, is the identity boundary.
            if !is_desktop && !desktop_matches(&value, selected, &parent, local) {
                continue;
            }
            let mut icon_roots = roots.to_vec();
            icon_roots.insert(0, parent.join("usr/share"));
            if let Some(resource) = icon_asset(&value.icon, &parent, &icon_roots) {
                return Some(Asset {
                    resource,
                    metadata: vec![metadata],
                });
            }
        }
    }
    // AppDir's .DirIcon is authoritative only for its AppRun entry point.
    if selected.file_name().is_some_and(|name| name == "AppRun") {
        let resource = Resource::open(
            &parent,
            &parent.join(".DirIcon"),
            super::decode::MAX_ASSET_BYTES,
        )?;
        return Some(Asset {
            resource,
            metadata: Vec::new(),
        });
    }
    None
}

#[cfg(target_os = "linux")]
pub(super) fn linux_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(value) = std::env::var_os("XDG_DATA_HOME") {
        roots.push(PathBuf::from(value));
    } else if let Some(value) = std::env::var_os("HOME") {
        roots.push(PathBuf::from(value).join(".local/share"));
    }
    if let Some(value) = std::env::var_os("XDG_DATA_DIRS") {
        roots.extend(std::env::split_paths(&value).take(MAX_ICON_ROOTS));
    } else {
        roots.extend([
            PathBuf::from("/usr/local/share"),
            PathBuf::from("/usr/share"),
        ]);
    }
    roots.retain(|path| path.is_absolute());
    roots.truncate(MAX_ICON_ROOTS);
    roots
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let base = std::env::var_os("HARBOR_GAME_TEST_ROOT")
                .map(PathBuf::from)
                .unwrap_or_else(std::env::temp_dir);
            let root = base.join(format!("icon-local-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&root).unwrap();
            Self(plain_path(&root).unwrap())
        }
        fn png(&self, path: &str, color: [u8; 4]) -> PathBuf {
            let path = self.0.join(path);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            let bytes = super::super::decode::encode(image::RgbaImage::from_pixel(
                96,
                96,
                image::Rgba(color),
            ))
            .unwrap();
            fs::write(&path, bytes).unwrap();
            path
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            if self
                .0
                .file_name()
                .is_some_and(|name| name.to_string_lossy().starts_with("icon-local-"))
            {
                let _ = fs::remove_dir_all(&self.0);
            }
        }
    }
    #[test]
    fn desktop_icons_require_unambiguous_application_metadata() {
        let value = desktop(b"[Desktop Entry]\nType=Application\nIcon=actual-game\nExec=\"/opt/My Game/bin/game\" %U\n[Desktop Action Other]\nIcon=wrong\n").unwrap();
        assert_eq!(value.icon, "actual-game");
        assert_eq!(value.executable, "/opt/My Game/bin/game");
        assert!(
            desktop(b"[Desktop Entry]\nType=Application\nIcon=a\nIcon=b\nExec=game\n").is_none()
        );
        assert!(desktop(b"[Desktop Entry]\nType=Link\nIcon=a\nExec=game\n").is_none());
        assert!(desktop(b"[Desktop Entry]\nType=Application\nIcon=a\nExec=game;rm\n").is_none());
        assert!(!filename("../private"));
        assert!(!filename("/private"));
    }
    #[test]
    fn bundle_uses_declared_icon_and_versions_resource_changes() {
        let fixture = Fixture::new();
        let image = fixture.png("Game.app/Contents/Resources/Game.png", [80, 90, 100, 255]);
        let root = fixture.0.join("Game.app");
        let mut values = plist::Dictionary::new();
        values.insert(
            "CFBundleIconFile".into(),
            plist::Value::String("Game.png".into()),
        );
        plist::Value::Dictionary(values)
            .to_file_binary(root.join("Contents/Info.plist"))
            .unwrap();
        let mut asset = bundle(&root).unwrap();
        assert_eq!(
            super::super::decode::asset(&asset.bytes().unwrap())
                .unwrap()
                .get_pixel(0, 0)
                .0,
            [80, 90, 100, 255]
        );
        assert!(asset.unchanged());
        let old = asset.key();
        drop(asset);
        fs::remove_file(&image).unwrap();
        fixture.png("Game.app/Contents/Resources/Game.png", [11, 22, 33, 255]);
        assert_ne!(bundle(&root).unwrap().key(), old);
        let mut values = plist::Dictionary::new();
        values.insert(
            "CFBundleIconFile".into(),
            plist::Value::String("../../private.png".into()),
        );
        plist::Value::Dictionary(values)
            .to_file_binary(root.join("Contents/Info.plist"))
            .unwrap();
        assert!(bundle(&root).is_none());
    }
    #[test]
    fn linux_desktop_binds_icon_to_exact_executable_and_keeps_absolute_paths_local() {
        let fixture = Fixture::new();
        fixture.png("game/real.png", [101, 52, 3, 255]);
        let executable = fixture.0.join("game/my-game");
        fs::write(&executable, b"\x7fELFfixture").unwrap();
        let desktop_path = fixture.0.join("game/game.desktop");
        let command = executable.to_string_lossy().replace('\\', "\\\\");
        fs::write(
            &desktop_path,
            "[Desktop Entry]\nType=Application\nIcon=real\nExec=another-program\n",
        )
        .unwrap();
        assert!(linux(&executable, &[]).is_none());
        fs::write(
            &desktop_path,
            format!("[Desktop Entry]\nType=Application\nIcon=real\nExec=\"{command}\" %U\n"),
        )
        .unwrap();
        let mut asset = linux(&executable, &[]).unwrap();
        assert_eq!(
            super::super::decode::asset(&asset.bytes().unwrap())
                .unwrap()
                .get_pixel(0, 0)
                .0,
            [101, 52, 3, 255]
        );
        drop(asset);
        let outside = fixture
            .png("private.png", [255, 0, 0, 255])
            .to_string_lossy()
            .replace('\\', "\\\\");
        fs::write(
            &desktop_path,
            format!("[Desktop Entry]\nType=Application\nIcon={outside}\nExec=\"{command}\"\n"),
        )
        .unwrap();
        assert!(linux(&executable, &[]).is_none());
    }
    #[test]
    fn appdir_icon_belongs_to_apprun_not_unrelated_siblings() {
        let fixture = Fixture::new();
        fixture.png("Game.AppDir/.DirIcon", [12, 23, 34, 255]);
        let run = fixture.0.join("Game.AppDir/AppRun");
        fs::write(&run, b"fixture").unwrap();
        let helper = fixture.0.join("Game.AppDir/helper");
        fs::write(&helper, b"fixture").unwrap();
        assert!(linux(&run, &[]).is_some());
        assert!(linux(&helper, &[]).is_none());
    }
    #[cfg(unix)]
    #[test]
    fn appdir_icon_symlink_stays_inside_the_application() {
        use std::os::unix::fs::symlink;
        let fixture = Fixture::new();
        fixture.png("Game.AppDir/assets/icon.png", [1, 2, 3, 255]);
        let root = fixture.0.join("Game.AppDir");
        let run = root.join("AppRun");
        fs::write(&run, b"fixture").unwrap();
        symlink("assets/icon.png", root.join(".DirIcon")).unwrap();
        assert!(linux(&run, &[]).is_some());
        fs::remove_file(root.join(".DirIcon")).unwrap();
        fixture.png("outside.png", [4, 5, 6, 255]);
        symlink("../outside.png", root.join(".DirIcon")).unwrap();
        assert!(linux(&run, &[]).is_none());
        fs::remove_file(root.join(".DirIcon")).unwrap();
    }
}
