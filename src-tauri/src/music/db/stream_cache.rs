use std::time::Duration;

const SOUNDCLOUD_SIGNATURE_TTL: Duration = Duration::from_secs(60);
const YOUTUBE_GOOGLEVIDEO_TTL: Duration = Duration::from_secs(30 * 60);
const SERVER_TOKEN_TTL: Duration = Duration::from_secs(6 * 60 * 60);
const DURABLE_PATH_TTL: Duration = Duration::from_secs(30 * 24 * 60 * 60);

pub(super) fn stream_ttl(connector: &str) -> Duration {
    match connector.trim() {
        "soundcloud" => SOUNDCLOUD_SIGNATURE_TTL,
        "youtube" => YOUTUBE_GOOGLEVIDEO_TTL,
        "local" | "direct" => DURABLE_PATH_TTL,
        _ => SERVER_TOKEN_TTL,
    }
}

pub(super) fn is_fresh(now: i64, resolved_at: i64, ttl: Duration) -> bool {
    let age = now.saturating_sub(resolved_at);
    age >= 0 && age < ttl.as_secs() as i64
}

#[cfg(test)]
mod tests {
    use super::super::{now_seconds, MusicDb};
    use super::{is_fresh, stream_ttl};
    use crate::music::{MusicStream, MusicTrack};
    use rusqlite::params;
    use std::time::Duration;

    fn track(id: &str, connector: &str) -> MusicTrack {
        MusicTrack {
            explicit: None,
            version: None,
            media_kind: None,
            id: id.to_string(),
            connector_id: Some(connector.to_string()),
            source_id: Some(id.to_string()),
            playback_url: None,
            title: "Hysteria".to_string(),
            artist: "Muse".to_string(),
            album: Some("Absolution".to_string()),
            artwork: "https://example.test/art.jpg".to_string(),
            duration_seconds: 227,
            duration_label: "3:47".to_string(),
        }
    }

    fn stream(url: &str) -> MusicStream {
        MusicStream {
            http_headers: Default::default(),
            url: url.to_string(),
            mime_type: "audio/mpeg".to_string(),
            bitrate: 0,
        }
    }

    fn cached(connector: &str, age_seconds: i64) -> Option<MusicStream> {
        let database = MusicDb::in_memory();
        let value = track("track-1", connector);
        database.upsert_track(&value).expect("store track");
        database
            .cache_stream("track-1", &stream("https://example.test/audio"))
            .expect("cache stream");
        let stamp = (now_seconds() - age_seconds).to_string();
        database
            .with_connection(|connection| {
                connection
                    .execute(
                        "UPDATE music_tracks SET resolved_at = ?2 WHERE id = ?1",
                        params!["track-1", stamp],
                    )
                    .map(|_| ())
                    .map_err(|error| error.to_string())
            })
            .expect("age cache");
        database.cached_stream("track-1").expect("read cache")
    }

    #[test]
    fn every_connector_declares_its_own_lifetime() {
        assert_eq!(stream_ttl("soundcloud"), Duration::from_secs(60));
        assert_eq!(stream_ttl("youtube"), Duration::from_secs(1800));
        assert_eq!(stream_ttl("local"), Duration::from_secs(2_592_000));
        assert_eq!(stream_ttl("direct"), Duration::from_secs(2_592_000));
        assert_eq!(stream_ttl("jellyfin"), Duration::from_secs(21_600));
        assert_eq!(stream_ttl("plex"), Duration::from_secs(21_600));
        assert_eq!(stream_ttl("subsonic"), Duration::from_secs(21_600));
        assert_eq!(stream_ttl(" soundcloud "), Duration::from_secs(60));
    }

    #[test]
    fn soundcloud_expires_far_inside_its_signature_window() {
        assert!(stream_ttl("soundcloud") < Duration::from_secs(5 * 60));
        assert!(stream_ttl("youtube") < Duration::from_secs(6 * 60 * 60));
    }

    #[test]
    fn freshness_reads_the_clock_it_is_given() {
        let ttl = Duration::from_secs(60);
        assert!(is_fresh(1_000, 1_000, ttl));
        assert!(is_fresh(1_059, 1_000, ttl));
        assert!(!is_fresh(1_060, 1_000, ttl));
        assert!(!is_fresh(9_999, 1_000, ttl));
    }

    #[test]
    fn a_clock_that_moved_backwards_never_reports_fresh() {
        assert!(!is_fresh(1_000, 1_001, Duration::from_secs(60)));
    }

    #[test]
    fn a_two_minute_old_soundcloud_url_is_already_gone() {
        assert!(cached("soundcloud", 30).is_some());
        assert!(cached("soundcloud", 120).is_none());
    }

    #[test]
    fn youtube_outlives_soundcloud_but_not_a_long_session() {
        assert!(cached("youtube", 120).is_some());
        assert!(cached("youtube", 29 * 60).is_some());
        assert!(cached("youtube", 31 * 60).is_none());
    }

    #[test]
    fn server_connectors_keep_the_six_hour_window() {
        assert!(cached("jellyfin", 5 * 60 * 60).is_some());
        assert!(cached("jellyfin", 7 * 60 * 60).is_none());
    }

    #[test]
    fn invalidating_drops_the_url_and_the_stamp() {
        let database = MusicDb::in_memory();
        database
            .upsert_track(&track("soundcloud:34507776", "soundcloud"))
            .expect("store track");
        database
            .cache_stream(
                "soundcloud:34507776",
                &stream("https://cf-media.sndcdn.com/signed-audio"),
            )
            .expect("cache stream");
        assert!(database
            .cached_stream("soundcloud:34507776")
            .expect("read cache")
            .is_some());

        database
            .invalidate_stream("soundcloud:34507776")
            .expect("invalidate cache");

        assert!(database
            .cached_stream("soundcloud:34507776")
            .expect("read cleared cache")
            .is_none());
        let stored = database
            .get_track("soundcloud:34507776")
            .expect("read track")
            .expect("stored track");
        assert!(stored.playback_url.is_none());
        assert_eq!(stored.title, "Hysteria");
    }

    #[test]
    fn cached_streams_preserve_provider_headers_and_audio_metadata() {
        let database = MusicDb::in_memory();
        database
            .upsert_track(&track("youtube-fixture", "youtube"))
            .expect("store track");
        let mut source = stream("https://example.test/audio");
        source.mime_type = "audio/mp4".into();
        source.bitrate = 128_000;
        source
            .http_headers
            .insert("User-Agent".into(), "provided agent".into());
        database
            .cache_stream("youtube-fixture", &source)
            .expect("cache source");
        let cached = database
            .cached_stream("youtube-fixture")
            .expect("read cache")
            .expect("fresh cache");
        assert_eq!(cached.http_headers, source.http_headers);
        assert_eq!(cached.mime_type, source.mime_type);
        assert_eq!(cached.bitrate, source.bitrate);
        database.with_connection(|connection| connection.execute("UPDATE music_tracks SET resolved_metadata = NULL WHERE id = 'youtube-fixture'", []).map(|_| ()).map_err(|error| error.to_string())).expect("legacy fixture");
        assert!(database
            .cached_stream("youtube-fixture")
            .expect("legacy cache")
            .is_none());
    }

    #[test]
    fn invalidating_an_unknown_track_is_not_an_error() {
        let database = MusicDb::in_memory();
        database.invalidate_stream("missing").expect("invalidate");
    }

    #[test]
    fn a_signed_soundcloud_url_never_returns_as_a_durable_path() {
        let database = MusicDb::in_memory();
        let mut value = track("soundcloud:34507776", "soundcloud");
        value.source_id = Some("https://soundcloud.com/muse/hysteria".to_string());
        database.upsert_track(&value).expect("store track");
        database
            .cache_stream(
                &value.id,
                &stream("https://cf-media.sndcdn.com/signed-audio"),
            )
            .expect("cache stream");
        let stored = database
            .get_track(&value.id)
            .expect("read track")
            .expect("stored track");
        assert!(stored.playback_url.is_none());
    }
}
