use crate::music::{duration_label, MusicTrack};
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::{Picture, PictureType};
use lofty::tag::{Accessor, ItemKey, Tag};
use std::path::{Path, PathBuf};

pub const AUDIO_EXTENSIONS: [&str; 8] = ["flac", "mp3", "m4a", "aac", "ogg", "opus", "wav", "wv"];

const SIDECAR_COVERS: [&str; 9] = [
    "cover.jpg",
    "cover.jpeg",
    "cover.png",
    "folder.jpg",
    "folder.jpeg",
    "folder.png",
    "front.jpg",
    "front.jpeg",
    "front.png",
];

pub struct TrackFields {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub track_no: Option<u32>,
    pub disc_no: Option<u32>,
    pub year: Option<u32>,
}

impl TrackFields {
    pub fn album_key(&self) -> Option<String> {
        let album = self.album.as_deref()?;
        Some(stable_key(&format!("{}::{album}", self.credited_artist())))
    }

    pub fn artist_key(&self) -> String {
        stable_key(self.credited_artist())
    }

    pub fn credited_artist(&self) -> &str {
        self.album_artist.as_deref().unwrap_or(&self.artist)
    }
}

pub struct ScannedTrack {
    pub track: MusicTrack,
    pub fields: TrackFields,
}

pub fn is_audio(path: &Path) -> bool {
    extension(path)
        .map(|value| AUDIO_EXTENSIONS.contains(&value.as_str()))
        .unwrap_or(false)
}

pub fn mime_type(path: &Path) -> &'static str {
    match extension(path).as_deref() {
        Some("flac") => "audio/flac",
        Some("mp3") => "audio/mpeg",
        Some("m4a") => "audio/mp4",
        Some("aac") => "audio/aac",
        Some("ogg") => "audio/ogg",
        Some("opus") => "audio/opus",
        Some("wav") => "audio/wav",
        Some("wv") => "audio/wavpack",
        _ => "application/octet-stream",
    }
}

pub fn track_id(location: &str) -> String {
    format!("local:{:016x}", hash(location))
}

pub fn stable_key(value: &str) -> String {
    format!("{:016x}", hash(&value.to_lowercase()))
}

pub fn read(path: &Path, covers: &Path) -> Result<ScannedTrack, String> {
    let tagged = lofty::read_from_path(path).map_err(|error| error.to_string())?;
    let duration_seconds = tagged.properties().duration().as_secs();
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
    let fields = fields(tag, path);
    let location = path.to_string_lossy().to_string();
    let artwork = artwork(tag, path, fields.album_key().as_deref(), covers);
    Ok(ScannedTrack {
        track: MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: track_id(&location),
            connector_id: Some("local".to_string()),
            source_id: Some(location.clone()),
            playback_url: Some(location),
            title: fields.title.clone(),
            artist: fields.artist.clone(),
            album: fields.album.clone(),
            artwork,
            duration_seconds,
            duration_label: duration_label(duration_seconds),
        },
        fields,
    })
}

pub fn fields(tag: Option<&Tag>, path: &Path) -> TrackFields {
    TrackFields {
        title: clean(tag.and_then(|tag| tag.title())).unwrap_or_else(|| file_title(path)),
        artist: clean(tag.and_then(|tag| tag.artist()))
            .unwrap_or_else(|| "Unknown artist".to_string()),
        album: clean(tag.and_then(|tag| tag.album())),
        album_artist: clean(tag.and_then(|tag| tag.get_string(&ItemKey::AlbumArtist))),
        track_no: tag.and_then(|tag| tag.track()),
        disc_no: tag.and_then(|tag| tag.disk()),
        year: tag.and_then(|tag| tag.year()),
    }
}

fn artwork(tag: Option<&Tag>, path: &Path, album_key: Option<&str>, covers: &Path) -> String {
    let key = album_key
        .map(str::to_string)
        .unwrap_or_else(|| stable_key(&path.to_string_lossy()));
    tag.and_then(|tag| cover_picture(tag.pictures()))
        .and_then(|picture| cache_cover(picture, &key, covers))
        .or_else(|| sidecar_cover(path).map(|found| asset_url(&found)))
        .unwrap_or_default()
}

fn cover_picture(pictures: &[Picture]) -> Option<&Picture> {
    pictures
        .iter()
        .find(|picture| picture.pic_type() == PictureType::CoverFront)
        .or_else(|| pictures.first())
}

fn cache_cover(picture: &Picture, key: &str, covers: &Path) -> Option<String> {
    let data = picture.data();
    if data.len() < 8 {
        return None;
    }
    let extension = picture
        .mime_type()
        .and_then(|mime| mime.ext())
        .unwrap_or_else(|| sniff(data));
    let target = covers.join(format!("{key}.{extension}"));
    if !target.is_file() && std::fs::write(&target, data).is_err() {
        return None;
    }
    Some(asset_url(&target))
}

fn sniff(data: &[u8]) -> &'static str {
    if data.starts_with(&[0x89, b'P', b'N', b'G']) {
        "png"
    } else {
        "jpg"
    }
}

fn sidecar_cover(path: &Path) -> Option<PathBuf> {
    let parent = path.parent()?;
    let mut best: Option<(usize, PathBuf)> = None;
    for entry in std::fs::read_dir(parent).ok()?.filter_map(Result::ok) {
        let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
        let Some(rank) = SIDECAR_COVERS
            .iter()
            .position(|candidate| *candidate == name)
        else {
            continue;
        };
        if best.as_ref().map(|(seen, _)| rank < *seen).unwrap_or(true) {
            best = Some((rank, entry.path()));
        }
    }
    best.map(|(_, path)| path)
}

pub fn asset_url(path: &Path) -> String {
    let encoded = encode_component(&path.to_string_lossy());
    if cfg!(windows) {
        format!("http://asset.localhost/{encoded}")
    } else {
        format!("asset://localhost/{encoded}")
    }
}

fn encode_component(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'!'
            | b'~'
            | b'*'
            | b'\''
            | b'('
            | b')' => encoded.push(byte as char),
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

fn clean(value: Option<impl AsRef<str>>) -> Option<String> {
    value
        .map(|value| value.as_ref().trim().to_string())
        .filter(|value| !value.is_empty())
}

fn file_title(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Untitled track")
        .to_string()
}

fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

fn hash(value: &str) -> u64 {
    value
        .as_bytes()
        .iter()
        .fold(0xcbf29ce484222325, |hash, byte| {
            (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use lofty::picture::MimeType;
    use lofty::tag::TagType;

    fn tagged() -> Tag {
        let mut tag = Tag::new(TagType::Id3v2);
        tag.set_title("  Hysteria  ".to_string());
        tag.set_artist("Muse".to_string());
        tag.set_album("Absolution".to_string());
        tag.set_track(3);
        tag.set_disk(1);
        tag.set_year(2003);
        tag.insert_text(ItemKey::AlbumArtist, "Muse ".to_string());
        tag
    }

    #[test]
    fn tag_fields_are_trimmed_and_typed() {
        let tag = tagged();
        let fields = fields(Some(&tag), Path::new("C:/Music/03 Hysteria.flac"));
        assert_eq!(fields.title, "Hysteria");
        assert_eq!(fields.artist, "Muse");
        assert_eq!(fields.album.as_deref(), Some("Absolution"));
        assert_eq!(fields.album_artist.as_deref(), Some("Muse"));
        assert_eq!(fields.track_no, Some(3));
        assert_eq!(fields.disc_no, Some(1));
        assert_eq!(fields.year, Some(2003));
    }

    #[test]
    fn untagged_files_fall_back_to_the_filename() {
        let fields = fields(None, Path::new("C:/Music/Hysteria.flac"));
        assert_eq!(fields.title, "Hysteria");
        assert_eq!(fields.artist, "Unknown artist");
        assert!(fields.album.is_none());
        assert!(fields.album_key().is_none());
    }

    #[test]
    fn blank_tag_values_are_treated_as_missing() {
        let mut tag = Tag::new(TagType::Id3v2);
        tag.set_title("   ".to_string());
        tag.set_album("".to_string());
        let fields = fields(Some(&tag), Path::new("/music/one.mp3"));
        assert_eq!(fields.title, "one");
        assert!(fields.album.is_none());
    }

    #[test]
    fn album_key_groups_by_album_artist_case_insensitively() {
        let tag = tagged();
        let first = fields(Some(&tag), Path::new("/music/a.flac"));
        let mut other = Tag::new(TagType::Id3v2);
        other.set_title("Butterflies and Hurricanes".to_string());
        other.set_artist("MUSE feat. nobody".to_string());
        other.set_album("ABSOLUTION".to_string());
        other.insert_text(ItemKey::AlbumArtist, "muse".to_string());
        let second = fields(Some(&other), Path::new("/music/b.flac"));
        assert_eq!(first.album_key(), second.album_key());
        assert_eq!(first.artist_key(), second.artist_key());
    }

    #[test]
    fn credited_artist_prefers_the_album_artist() {
        let mut tag = Tag::new(TagType::Id3v2);
        tag.set_artist("Nina Simone".to_string());
        tag.insert_text(ItemKey::AlbumArtist, "Various Artists".to_string());
        let fields = fields(Some(&tag), Path::new("/music/c.flac"));
        assert_eq!(fields.artist, "Nina Simone");
        assert_eq!(fields.credited_artist(), "Various Artists");
    }

    #[test]
    fn audio_extensions_are_matched_case_insensitively() {
        assert!(is_audio(Path::new("/music/one.FLAC")));
        assert!(is_audio(Path::new("/music/two.opus")));
        assert!(!is_audio(Path::new("/music/cover.jpg")));
        assert!(!is_audio(Path::new("/music/notes")));
    }

    #[test]
    fn mime_types_cover_every_supported_extension() {
        for (name, expected) in [
            ("one.flac", "audio/flac"),
            ("one.mp3", "audio/mpeg"),
            ("one.m4a", "audio/mp4"),
            ("one.aac", "audio/aac"),
            ("one.ogg", "audio/ogg"),
            ("one.opus", "audio/opus"),
            ("one.wav", "audio/wav"),
            ("one.wv", "audio/wavpack"),
        ] {
            assert_eq!(mime_type(Path::new(name)), expected);
        }
        assert_eq!(mime_type(Path::new("one.txt")), "application/octet-stream");
    }

    #[test]
    fn asset_urls_percent_encode_every_reserved_byte() {
        assert_eq!(
            encode_component("C:/Music/Sigur Rós/01 Svefn-g-englar.flac"),
            "C%3A%2FMusic%2FSigur%20R%C3%B3s%2F01%20Svefn-g-englar.flac"
        );
        let url = asset_url(Path::new("/music/a b.jpg"));
        assert!(url.ends_with("/%2Fmusic%2Fa%20b.jpg"));
        assert!(
            url.starts_with("http://asset.localhost/") || url.starts_with("asset://localhost/")
        );
    }

    #[test]
    fn track_ids_are_stable_and_path_scoped() {
        assert_eq!(track_id("/music/one.flac"), track_id("/music/one.flac"));
        assert_ne!(track_id("/music/one.flac"), track_id("/music/two.flac"));
        assert!(track_id("/music/one.flac").starts_with("local:"));
    }

    #[test]
    fn cover_selection_prefers_the_front_cover() {
        let pictures = vec![
            Picture::new_unchecked(
                PictureType::CoverBack,
                Some(MimeType::Png),
                None,
                b"back-cover".to_vec(),
            ),
            Picture::new_unchecked(
                PictureType::CoverFront,
                Some(MimeType::Jpeg),
                None,
                b"front-cover".to_vec(),
            ),
        ];
        let picked = cover_picture(&pictures).expect("a picture");
        assert_eq!(picked.pic_type(), PictureType::CoverFront);
        assert!(cover_picture(&[]).is_none());
    }

    #[test]
    fn unknown_picture_types_are_sniffed_from_their_signature() {
        assert_eq!(
            sniff(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]),
            "png"
        );
        assert_eq!(sniff(&[0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]), "jpg");
    }
}
