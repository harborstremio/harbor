use super::api::{MediaSource, PlaybackSession};
use super::config::JellyfinConfig;
use crate::music::MusicTrack;

pub const DIRECT_CONTAINERS: &str =
    "flac,alac,m4a,m4b,aac,mp3,ogg,oga,opus,webma,webm,wav,aiff,wv,mka";
const UNIVERSAL_CONTAINERS: &str =
    "flac,mp3,aac,m4a|aac,alac,m4a|alac,m4b|aac,ogg,oga,opus,webma,webm|webma,wav,aiff,wv,mka";
pub const TRANSCODE_BITRATE: u64 = 320_000;

pub fn source_of(track: &MusicTrack) -> &str {
    match track.source_id.as_deref() {
        Some(source) => source,
        None => track.id.as_str(),
    }
}

pub fn direct_play(source: &MediaSource) -> bool {
    if !source.supports_direct_play && !source.supports_direct_stream {
        return false;
    }
    let Some(container) = source.container.as_deref() else {
        return false;
    };
    let lower = container.to_ascii_lowercase();
    DIRECT_CONTAINERS.split(',').any(|entry| entry == lower)
}

pub fn mime_for(source: &MediaSource, direct: bool) -> &'static str {
    if !direct {
        return "audio/mpeg";
    }
    let container = source.container.as_deref().unwrap_or_default();
    match container.to_ascii_lowercase().as_str() {
        "flac" => "audio/flac",
        "mp3" => "audio/mpeg",
        "ogg" | "oga" | "opus" => "audio/ogg",
        "wav" => "audio/wav",
        "aiff" => "audio/aiff",
        "webma" | "webm" => "audio/webm",
        "mka" => "audio/x-matroska",
        _ => "audio/mp4",
    }
}

pub fn bitrate_for(source: &MediaSource, direct: bool) -> u64 {
    if !direct {
        return TRANSCODE_BITRATE / 1000;
    }
    source.bitrate.unwrap_or(0) / 1000
}

pub fn universal(
    config: &JellyfinConfig,
    item_id: &str,
    session: &PlaybackSession,
) -> Result<String, String> {
    let address = format!("{}/Audio/{item_id}/universal", config.origin);
    let mut url = reqwest::Url::parse(&address)
        .map_err(|error| format!("Jellyfin stream address is unusable: {error}"))?;
    let bitrate = TRANSCODE_BITRATE.to_string();
    url.query_pairs_mut()
        .append_pair("userId", &config.user_id)
        .append_pair("deviceId", &config.device_id)
        .append_pair("container", UNIVERSAL_CONTAINERS)
        .append_pair("transcodingContainer", "mp3")
        .append_pair("transcodingProtocol", "http")
        .append_pair("audioCodec", "mp3")
        .append_pair("maxStreamingBitrate", &bitrate)
        .append_pair("startTimeTicks", "0")
        .append_pair("enableRedirection", "true")
        .append_pair("enableRemoteMedia", "false")
        .append_pair("enableAudioVbrEncoding", "true")
        .append_pair("playSessionId", &session.play_session_id)
        .append_pair("ApiKey", &config.token);
    Ok(url.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::music::duration_label;

    fn config() -> JellyfinConfig {
        JellyfinConfig {
            origin: "https://media.example.test".to_string(),
            user_id: "u1".to_string(),
            user_name: "josiah".to_string(),
            token: "tok".to_string(),
            device_id: "harbor-music-1".to_string(),
            server_name: "Basement".to_string(),
            library_id: None,
        }
    }

    fn source(container: &str, direct: bool) -> MediaSource {
        MediaSource {
            id: Some("m1".to_string()),
            container: Some(container.to_string()),
            bitrate: Some(940_000),
            supports_direct_play: direct,
            supports_direct_stream: direct,
        }
    }

    #[test]
    fn flac_direct_plays_and_an_unknown_container_falls_back_to_transcoding() {
        assert!(direct_play(&source("flac", true)));
        assert!(direct_play(&source("FLAC", true)));
        assert!(!direct_play(&source("dsf", true)));
        assert!(!direct_play(&source("flac", false)));
        assert_eq!(mime_for(&source("flac", true), true), "audio/flac");
        assert_eq!(mime_for(&source("dsf", false), false), "audio/mpeg");
        assert_eq!(bitrate_for(&source("flac", true), true), 940);
        assert_eq!(bitrate_for(&source("dsf", false), false), 320);
    }

    #[test]
    fn the_direct_play_whitelist_and_the_universal_whitelist_agree() {
        for entry in UNIVERSAL_CONTAINERS.split(',') {
            let container = entry.split('|').next().expect("container");
            let known = DIRECT_CONTAINERS.split(',').any(|c| c == container);
            assert!(known, "{container} is missing from the direct play list");
        }
    }

    #[test]
    fn the_stream_url_carries_the_token_as_the_query_param_that_survives() {
        let session = PlaybackSession {
            item_id: "a1".to_string(),
            play_session_id: "ps1".to_string(),
            media_source_id: Some("m1".to_string()),
        };
        let url = universal(&config(), "a1", &session).expect("stream url");
        let parsed = reqwest::Url::parse(&url).expect("parsed url");
        assert_eq!(parsed.path(), "/Audio/a1/universal");
        let query = parsed.query().expect("query");
        assert!(query.contains("ApiKey=tok"));
        assert!(query.contains("playSessionId=ps1"));
        assert!(query.contains("deviceId=harbor-music-1"));
        assert!(query.contains("container=flac"));
        assert!(!query.contains("api_key="));
    }

    #[test]
    fn a_track_resolves_through_its_source_id_before_its_prefixed_id() {
        let track = MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: "jellyfin:a1".to_string(),
            connector_id: Some("jellyfin".to_string()),
            source_id: Some("a1".to_string()),
            playback_url: None,
            title: "Hysteria".to_string(),
            artist: "Muse".to_string(),
            album: None,
            artwork: String::new(),
            duration_seconds: 227,
            duration_label: duration_label(227),
        };
        assert_eq!(source_of(&track), "a1");
        let mut bare = track.clone();
        bare.source_id = None;
        assert_eq!(source_of(&bare), "jellyfin:a1");
        let addressed = super::super::items::safe_item_id(source_of(&bare));
        assert_eq!(addressed.expect("id"), "a1");
    }
}
