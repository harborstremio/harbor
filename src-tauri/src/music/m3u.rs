use super::db::{upsert_track_in_transaction, MusicDb};
use super::{duration_label, MusicTrack};
use std::path::{Path, PathBuf};

const MAX_M3U_BYTES: u64 = 5 * 1024 * 1024;
const MAX_M3U_TRACKS: usize = 5_000;

#[derive(Default)]
struct EntryMetadata {
    duration_seconds: u64,
    artist: Option<String>,
    title: Option<String>,
}

pub fn import(database: &MusicDb, raw_path: &str) -> Result<Vec<MusicTrack>, String> {
    let path = input_path(raw_path)?;
    let metadata = std::fs::metadata(&path).map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("M3U import path is not a file".to_string());
    }
    if metadata.len() > MAX_M3U_BYTES {
        return Err("M3U file is larger than 5 MB".to_string());
    }
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
    let content = String::from_utf8_lossy(&bytes);
    let tracks = parse(&content, path.parent().unwrap_or_else(|| Path::new(".")))?;
    database.with_connection(|connection| {
        let transaction = connection
            .transaction()
            .map_err(|error| error.to_string())?;
        for track in &tracks {
            upsert_track_in_transaction(&transaction, track)?;
        }
        transaction.commit().map_err(|error| error.to_string())?;
        Ok(tracks)
    })
}

pub fn export(raw_path: &str, tracks: &[(MusicTrack, String)]) -> Result<(), String> {
    let path = output_path(raw_path)?;
    let content = render(tracks)?;
    std::fs::write(path, content.as_bytes()).map_err(|error| error.to_string())
}

fn parse(content: &str, base: &Path) -> Result<Vec<MusicTrack>, String> {
    let mut tracks = Vec::new();
    let mut pending = EntryMetadata::default();
    for raw_line in content.lines() {
        let line = raw_line.trim().trim_start_matches('\u{feff}');
        if line.is_empty() {
            continue;
        }
        if let Some(value) = line.strip_prefix("#EXTINF:") {
            pending = parse_metadata(value);
            continue;
        }
        if line.starts_with('#') {
            continue;
        }
        if tracks.len() >= MAX_M3U_TRACKS {
            return Err("M3U file contains more than 5000 tracks".to_string());
        }
        let location = normalize_location(line, base)?;
        let title = pending
            .title
            .take()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| title_from_location(&location));
        let artist = pending
            .artist
            .take()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "Unknown artist".to_string());
        let duration_seconds = pending.duration_seconds;
        pending = EntryMetadata::default();
        let connector = if location.contains("://") {
            "direct"
        } else {
            "local"
        };
        tracks.push(MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: format!("m3u:{:016x}", stable_hash(&location)),
            connector_id: Some(connector.to_string()),
            source_id: Some(location.clone()),
            playback_url: Some(location),
            title,
            artist,
            album: None,
            artwork: String::new(),
            duration_seconds,
            duration_label: duration_label(duration_seconds),
        });
    }
    Ok(tracks)
}

fn parse_metadata(value: &str) -> EntryMetadata {
    let (duration, label) = value.split_once(',').unwrap_or((value, ""));
    let duration_seconds = duration.trim().parse::<i64>().unwrap_or(0).max(0) as u64;
    let label = label.trim();
    let (artist, title) = label
        .split_once(" - ")
        .map(|(artist, title)| {
            (
                Some(artist.trim().to_string()),
                Some(title.trim().to_string()),
            )
        })
        .unwrap_or((None, (!label.is_empty()).then(|| label.to_string())));
    EntryMetadata {
        duration_seconds,
        artist,
        title,
    }
}

fn normalize_location(location: &str, base: &Path) -> Result<String, String> {
    if location.contains("://") {
        let parsed =
            url::Url::parse(location).map_err(|_| "M3U contains an invalid URL".to_string())?;
        if !matches!(parsed.scheme(), "http" | "https" | "file") {
            return Err(format!(
                "M3U URL scheme is not supported: {}",
                parsed.scheme()
            ));
        }
        return Ok(parsed.to_string());
    }
    let path = PathBuf::from(location);
    let path = if path.is_absolute() {
        path
    } else {
        base.join(path)
    };
    Ok(path.to_string_lossy().to_string())
}

fn title_from_location(location: &str) -> String {
    if let Ok(url) = url::Url::parse(location) {
        if let Some(segment) = url.path_segments().and_then(|segments| segments.last()) {
            let title = segment
                .rsplit_once('.')
                .map(|item| item.0)
                .unwrap_or(segment);
            if !title.is_empty() {
                return title.to_string();
            }
        }
    }
    Path::new(location)
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("Untitled track")
        .to_string()
}

fn render(tracks: &[(MusicTrack, String)]) -> Result<String, String> {
    let mut output = String::from("#EXTM3U\n");
    for (track, url) in tracks {
        let url = url.trim();
        if url.is_empty() || url.contains(['\r', '\n']) {
            return Err(format!("{} has no exportable stream URL", track.title));
        }
        let artist = one_line(&track.artist);
        let title = one_line(&track.title);
        output.push_str(&format!(
            "#EXTINF:{},{} - {}\n{}\n",
            track.duration_seconds, artist, title, url
        ));
    }
    Ok(output)
}

fn one_line(value: &str) -> String {
    value.replace(['\r', '\n'], " ").trim().to_string()
}

fn input_path(raw: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw.trim());
    if raw.trim().is_empty() {
        return Err("M3U import path is empty".to_string());
    }
    Ok(path)
}

fn output_path(raw: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(raw.trim());
    if raw.trim().is_empty() || path.file_name().is_none() {
        return Err("M3U export path is invalid".to_string());
    }
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.is_dir() {
            return Err("M3U export directory does not exist".to_string());
        }
    }
    Ok(path)
}

fn stable_hash(value: &str) -> u64 {
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

    #[test]
    fn parser_preserves_extinf_and_resolves_relative_paths() {
        let tracks = parse(
            "#EXTM3U\n#EXTINF:227,Muse - Hysteria\ntracks/hysteria.flac\n",
            Path::new("C:/Music"),
        )
        .expect("parse m3u");
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].artist, "Muse");
        assert_eq!(tracks[0].title, "Hysteria");
        assert_eq!(tracks[0].duration_seconds, 227);
        let playback = tracks[0].playback_url.as_deref().expect("playback path");
        assert!(playback
            .replace('\\', "/")
            .ends_with("Music/tracks/hysteria.flac"));
    }

    #[test]
    fn renderer_writes_extended_entries_with_stream_urls() {
        let track = MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: "one".to_string(),
            connector_id: Some("youtube".to_string()),
            source_id: Some("one".to_string()),
            playback_url: None,
            title: "Hysteria".to_string(),
            artist: "Muse".to_string(),
            album: None,
            artwork: String::new(),
            duration_seconds: 227,
            duration_label: "3:47".to_string(),
        };
        let rendered =
            render(&[(track, "https://example.test/audio".to_string())]).expect("render m3u");
        assert_eq!(
            rendered,
            "#EXTM3U\n#EXTINF:227,Muse - Hysteria\nhttps://example.test/audio\n"
        );
    }
}
