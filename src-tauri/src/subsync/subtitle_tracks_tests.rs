use super::subtitle_tracks::{classify_loopback_source, parse_probe_output, LoopbackSource};

#[test]
fn classifies_only_exact_harbor_loopback_routes() {
    assert_eq!(
        classify_loopback_source("http://127.0.0.1:4512/s/proxy-id").unwrap(),
        Some((
            4512,
            LoopbackSource::Proxy {
                session_id: "proxy-id".into(),
                playlist: false,
            },
        )),
    );
    assert_eq!(
        classify_loopback_source("http://127.0.0.1:4512/p/playlist-id/video.m3u8").unwrap(),
        Some((
            4512,
            LoopbackSource::Proxy {
                session_id: "playlist-id".into(),
                playlist: true,
            },
        )),
    );
    assert_eq!(
        classify_loopback_source("http://[::1]:5312/stream/hash/7").unwrap(),
        Some((
            5312,
            LoopbackSource::Torrent {
                info_hash: "hash".into(),
                file_idx: 7,
            },
        )),
    );
    assert_eq!(
        classify_loopback_source("http://[::ffff:127.0.0.1]:5312/stream/hash/7").unwrap(),
        Some((
            5312,
            LoopbackSource::Torrent {
                info_hash: "hash".into(),
                file_idx: 7,
            },
        )),
    );
    assert_eq!(
        classify_loopback_source("http://127.0.0.1:9000/admin?next=/stream/hash/7").unwrap(),
        Some((9000, LoopbackSource::Unrecognized)),
    );
    assert_eq!(
        classify_loopback_source("https://cdn.example.test/movie.mkv").unwrap(),
        None,
    );
    assert!(
        super::url_guard::validate_media_url("http://localhost.:9000/stream/hash/7", true).is_err()
    );
}

#[test]
fn parses_embedded_subtitle_metadata_without_conflating_indices() {
    let tracks = parse_probe_output(
        br#"{
          "streams": [
            {
              "index": 2,
              "codec_name": "subrip",
              "tags": { "language": "eng", "title": "English" },
              "disposition": { "default": 1, "forced": 0, "hearing_impaired": 0 }
            },
            {
              "index": 5,
              "codec_name": "ass",
              "tags": { "language": "pt-BR", "title": "Portuguese SDH" },
              "disposition": { "default": 0, "forced": 0, "hearing_impaired": 1 }
            },
            {
              "index": 8,
              "codec_name": "hdmv_pgs_subtitle",
              "tags": { "language": "und" },
              "disposition": { "default": 0, "forced": 1, "hearing_impaired": 0 }
            }
          ]
        }"#,
    )
    .expect("valid ffprobe fixture");

    assert_eq!(tracks.len(), 3);

    assert_eq!(tracks[0].ff_index, 2);
    assert_eq!(tracks[0].sub_index, 0);
    assert_eq!(tracks[0].lang.as_deref(), Some("en"));
    assert_eq!(tracks[0].codec, "subrip");
    assert!(tracks[0].is_default);

    assert_eq!(tracks[1].ff_index, 5);
    assert_eq!(tracks[1].sub_index, 1);
    assert_eq!(tracks[1].lang.as_deref(), Some("pt"));
    assert_eq!(tracks[1].title.as_deref(), Some("Portuguese SDH"));
    assert!(tracks[1].is_hearing_impaired);

    assert_eq!(tracks[2].ff_index, 8);
    assert_eq!(tracks[2].sub_index, 2);
    assert_eq!(tracks[2].lang, None);
    assert!(tracks[2].is_forced);
}

#[test]
fn rejects_invalid_ffprobe_json() {
    assert!(parse_probe_output(b"not-json").is_err());
}
