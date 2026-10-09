//! Stream resolution through yt-dlp.
//!
//! Hand-rolled innertube still returns a player response, and the URLs inside it still look
//! ordinary, but YouTube only serves roughly the first megabyte of them before answering 403
//! to everything else. ffmpeg opens every stream with `Range: bytes=0-`, so it is refused on
//! its very first read and mpv reports MPV_ERROR_LOADING_FAILED. yt-dlp carries the PO token
//! and signature work that keeps a URL whole, and it is updated as YouTube tightens.

use super::super::super::{MusicStream, MusicVideoStream};
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(45);
const FORMAT: &str = "bestaudio[acodec=opus]/bestaudio/best";
// Muxed YouTube formats stop at 720p, so the video track is fetched on its own and mpv is
// handed the audio alongside it. `best` is the fallback for anything with no split rendition.
const VIDEO_FORMAT: &str = "bestvideo[height<=1080][vcodec^=avc1][protocol^=https]+bestaudio[acodec^=mp4a][protocol^=https]/bestvideo[height<=1080][protocol^=https]+bestaudio[protocol^=https]/best";
const SEPARATOR: &str = "|||";

pub async fn stream(app: &tauri::AppHandle, video_id: &str) -> Result<MusicStream, String> {
    let args = vec![
        "--no-warnings".to_string(),
        "--no-playlist".to_string(),
        "-f".to_string(),
        FORMAT.to_string(),
        "--print".to_string(),
        format!("%(url)s{SEPARATOR}%(ext)s{SEPARATOR}%(abr)s{SEPARATOR}%(http_headers)j"),
        format!("https://www.youtube.com/watch?v={video_id}"),
    ];
    let output = super::ytdlp_update::run(app, args, TIMEOUT, "music stream").await?;
    parse(&String::from_utf8_lossy(&output.stdout))
}

/// The music video behind a track, for the YouTube Music style video pane.
pub async fn video_stream(
    app: &tauri::AppHandle,
    video_id: &str,
) -> Result<MusicVideoStream, String> {
    let args = vec![
        "--no-warnings".to_string(),
        "--no-playlist".to_string(),
        "-f".to_string(),
        VIDEO_FORMAT.to_string(),
        "--dump-single-json".to_string(),
        format!("https://www.youtube.com/watch?v={video_id}"),
    ];
    let output = super::ytdlp_update::run(app, args, TIMEOUT, "music video").await?;
    parse_video(&String::from_utf8_lossy(&output.stdout))
}

fn parse_video(stdout: &str) -> Result<MusicVideoStream, String> {
    let payload: serde_json::Value = serde_json::from_str(stdout)
        .map_err(|_| "YouTube Music did not return video metadata".to_string())?;
    let formats = payload
        .get("requested_formats")
        .and_then(serde_json::Value::as_array);
    let video = formats
        .and_then(|formats| formats.iter().find(|format| format.get("vcodec").and_then(serde_json::Value::as_str).is_some_and(|codec| codec != "none")))
        .or_else(|| formats.and_then(|formats| formats.first()))
        .unwrap_or(&payload);
    if video.get("vcodec").and_then(serde_json::Value::as_str) == Some("none") {
        return Err("YouTube Music returned audio without a video track".to_string());
    }
    let audio = formats.and_then(|formats| formats.iter().find(|format| !std::ptr::eq(*format, video)));
    let read_url = |format: &serde_json::Value| {
        format
            .get("url")
            .and_then(serde_json::Value::as_str)
            .filter(|url| url.starts_with("https://"))
            .map(str::to_string)
            .ok_or_else(|| "YouTube Music did not return a video stream".to_string())
    };
    let headers =
        |format: &serde_json::Value| -> Result<std::collections::BTreeMap<String, String>, String> {
            serde_json::from_value(
                format
                    .get("http_headers")
                    .or_else(|| payload.get("http_headers"))
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({})),
            )
            .map_err(|_| "YouTube Music returned invalid video request headers".to_string())
        };
    let http_headers = headers(video)?;
    if audio.is_some_and(|audio| headers(audio).ok().as_ref() != Some(&http_headers)) {
        return Err(
            "YouTube Music returned incompatible audio and video request headers".to_string(),
        );
    }
    MusicStream {
        url: String::new(),
        mime_type: String::new(),
        bitrate: 0,
        http_headers: http_headers.clone(),
    }
    .request_headers()?;
    Ok(MusicVideoStream {
        url: read_url(video)?,
        audio_url: audio.map(read_url).transpose()?,
        http_headers,
    })
}

fn parse(stdout: &str) -> Result<MusicStream, String> {
    let line = stdout
        .lines()
        .map(str::trim)
        .find(|line| line.starts_with("https://"))
        .ok_or_else(|| "yt-dlp did not return an audio URL".to_string())?;
    let mut parts = line.split(SEPARATOR);
    let url = parts.next().unwrap_or_default().trim();
    if !url.starts_with("https://") {
        return Err("yt-dlp did not return an audio URL".to_string());
    }
    let extension = parts.next().unwrap_or_default().trim();
    // yt-dlp prints NA for anything it could not determine; neither field is load bearing
    // for playback, so an unusable value degrades to a sensible default rather than failing.
    let bitrate = parts
        .next()
        .and_then(|value| value.trim().parse::<f64>().ok())
        .map(|kbps| (kbps * 1000.0).round() as u64)
        .unwrap_or(0);
    let http_headers = parts
        .next()
        .map(serde_json::from_str)
        .transpose()
        .map_err(|_| "YouTube Music returned invalid request headers".to_string())?
        .unwrap_or_default();
    let stream = MusicStream {
        url: url.to_string(),
        mime_type: mime_of(extension),
        bitrate,
        http_headers,
    };
    stream.request_headers()?;
    Ok(stream)
}

fn mime_of(extension: &str) -> String {
    match extension {
        "webm" | "opus" => "audio/webm",
        "m4a" | "mp4" => "audio/mp4",
        "mp3" => "audio/mpeg",
        _ => "audio/webm",
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn video_resolution_rejects_audio_only_and_accepts_reordered_tracks() {
        assert!(parse_video(r#"{"url":"https://example.com/audio","vcodec":"none"}"#).is_err());
        let stream = parse_video(r#"{"requested_formats":[{"url":"https://example.com/audio","vcodec":"none","acodec":"opus"},{"url":"https://example.com/video","vcodec":"vp9","acodec":"none"}]}"#).unwrap();
        assert_eq!(stream.url, "https://example.com/video");
        assert_eq!(stream.audio_url.as_deref(), Some("https://example.com/audio"));
    }

    #[test]
    fn a_printed_line_becomes_a_stream() {
        let stream = parse("https://rr1---sn-x.googlevideo.com/videoplayback?x=1|||webm|||142.5\n")
            .expect("a printed line resolves");
        assert_eq!(
            stream.url,
            "https://rr1---sn-x.googlevideo.com/videoplayback?x=1"
        );
        assert_eq!(stream.mime_type, "audio/webm");
        assert_eq!(stream.bitrate, 142_500);
    }

    #[test]
    fn warning_lines_ahead_of_the_url_are_skipped() {
        let stream = parse("WARNING: something\nhttps://example.com/a|||m4a|||NA\n")
            .expect("the url line is found past the noise");
        assert_eq!(stream.url, "https://example.com/a");
        assert_eq!(stream.mime_type, "audio/mp4");
        assert_eq!(stream.bitrate, 0, "NA degrades rather than failing");
    }

    #[test]
    fn output_without_a_url_is_an_error() {
        assert!(parse("ERROR: unavailable\n").is_err());
        assert!(parse("").is_err());
    }

    #[test]
    fn resolver_headers_survive_parsing_and_reject_header_injection() {
        let stream = parse(r#"https://example.com/audio|||webm|||128|||{"User-Agent":"provided agent","Accept-Language":"en-US,en;q=0.9"}"#).expect("provider headers");
        assert_eq!(
            stream.http_headers.get("User-Agent").map(String::as_str),
            Some("provided agent")
        );
        assert_eq!(
            stream
                .http_headers
                .get("Accept-Language")
                .map(String::as_str),
            Some("en-US,en;q=0.9")
        );
        assert!(parse(
            r#"https://example.com/audio|||webm|||128|||{"User-Agent":"agent\r\nInjected: yes"}"#
        )
        .is_err());
    }

    #[test]
    fn differing_video_and_audio_headers_are_not_silently_dropped() {
        assert!(parse_video(r#"{"requested_formats":[{"url":"https://example.com/video","http_headers":{"User-Agent":"video"}},{"url":"https://example.com/audio","http_headers":{"User-Agent":"audio"}}]}"#).is_err());
    }

    #[test]
    fn two_printed_urls_are_video_then_audio() {
        let stream = parse_video(r#"{"requested_formats":[{"url":"https://example.com/video","http_headers":{"User-Agent":"resolver"}},{"url":"https://example.com/audio","http_headers":{"User-Agent":"resolver"}}]}"#)
            .expect("a split rendition resolves");
        assert_eq!(stream.url, "https://example.com/video");
        assert_eq!(
            stream.audio_url.as_deref(),
            Some("https://example.com/audio")
        );
        assert_eq!(
            stream.http_headers.get("User-Agent").map(String::as_str),
            Some("resolver")
        );
    }

    #[test]
    fn a_single_url_is_muxed_and_needs_no_audio_track() {
        let stream = parse_video(r#"{"url":"https://example.com/muxed"}"#)
            .expect("a muxed rendition resolves");
        assert_eq!(stream.url, "https://example.com/muxed");
        assert!(
            stream.audio_url.is_none(),
            "mpv must not be handed an audio file that does not exist"
        );
    }

    #[test]
    fn video_output_without_a_url_is_an_error() {
        assert!(parse_video("ERROR: video unavailable\n").is_err());
    }
}


/// Regular YouTube search, not the restricted YouTube Music catalogue.
pub async fn search_interviews(app: &tauri::AppHandle, query: &str, limit: usize) -> Result<Vec<super::super::super::MusicTrack>, String> {
    let args = vec!["--no-warnings".into(), "--flat-playlist".into(), "--dump-single-json".into(), "--skip-download".into(), "--".into(), format!("ytsearch{}:{}", limit.clamp(1, 24), query)];
    let output = super::ytdlp_update::run(app, args, Duration::from_secs(25), "YouTube interviews").await?;
    interview_results(&String::from_utf8_lossy(&output.stdout), limit)
}

fn interview_results(raw: &str, limit: usize) -> Result<Vec<super::super::super::MusicTrack>, String> {
    let value: serde_json::Value = serde_json::from_str(raw).map_err(|_| "YouTube search returned invalid metadata".to_string())?;
    let entries = value.get("entries").and_then(serde_json::Value::as_array).ok_or("YouTube search returned no entries")?;
    let mut seen = std::collections::HashSet::new();
    Ok(entries.iter().filter_map(|entry| {
        let id = entry.get("id")?.as_str()?;
        if id.len() != 11 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') || !seen.insert(id.to_owned()) { return None; }
        let title = entry.get("title")?.as_str()?.trim();
        if title.is_empty() { return None; }
        let channel = entry.get("channel").or_else(|| entry.get("uploader")).and_then(serde_json::Value::as_str).unwrap_or("YouTube");
        let seconds = entry.get("duration").and_then(serde_json::Value::as_f64).filter(|n| n.is_finite() && *n > 0.0).unwrap_or(0.0) as u64;
        let mut track = super::items::track(id, title.to_string(), Some(channel.to_string()), None, format!("https://i.ytimg.com/vi/{id}/hqdefault.jpg"), seconds);
        track.title = title.to_string();
        track.media_kind = Some("video".into());
        if seconds == 0 { track.duration_label.clear(); }
        Some(track)
    }).take(limit).collect())
}

/// Continue regular YouTube results. yt-dlp walks the provider's search continuation;
/// playlist-start skips earlier entries and the extra entry signals whether another page exists.
pub async fn search_video_page(app: &tauri::AppHandle, query: &str, offset: usize, limit: usize) -> Result<(Vec<super::super::super::MusicTrack>, bool), String> {
    let end = offset.checked_add(limit + 1).ok_or("Invalid video search offset")?;
    let args = vec!["--no-warnings".into(), "--flat-playlist".into(), "--dump-single-json".into(), "--skip-download".into(),
        "--playlist-start".into(), (offset + 1).to_string(), "--playlist-end".into(), end.to_string(),
        "--".into(), format!("ytsearch{end}:{query}")];
    let output = super::ytdlp_update::run(app, args, Duration::from_secs(32), "YouTube video search").await?;
    let raw = String::from_utf8_lossy(&output.stdout);
    let value: serde_json::Value = serde_json::from_str(&raw).map_err(|_| "YouTube search returned invalid metadata")?;
    let entries = value.get("entries").and_then(serde_json::Value::as_array).ok_or("YouTube search returned no entries")?;
    // The lookahead is fetched again at the start of the next page, so never expose it here.
    let page = serde_json::json!({"entries": entries.iter().take(limit).collect::<Vec<_>>()});
    Ok((interview_results(&page.to_string(), limit)?, entries.len() > limit))
}

#[cfg(test)]
mod interview_tests {
    use super::*;
    #[test]
    fn regular_search_preserves_channels_titles_and_exact_ids() {
        let raw = r#"{"entries":[{"id":"abcdefghijk","title":"Artist talks about new album","channel":"Interview channel","duration":125.5},{"id":"abcdefghijk","title":"Duplicate"},{"id":"https://bad","title":"Bad identity"}]}"#;
        let tracks = interview_results(raw, 12).unwrap();
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].title, "Artist talks about new album");
        assert_eq!(tracks[0].artist, "Interview channel");
        assert_eq!(tracks[0].source_id.as_deref(), Some("abcdefghijk"));
        assert_eq!(tracks[0].duration_seconds, 125);
    }
}
