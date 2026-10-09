use super::super::db::MusicDb;
use super::super::{MusicState, MusicStream, MusicTrack};
use std::future::Future;
use std::sync::LazyLock;
use std::time::Duration;

const PROBE_TIMEOUT: Duration = Duration::from_secs(4);

static PROBE_CLIENT: LazyLock<Option<reqwest::Client>> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(PROBE_TIMEOUT)
        .build()
        .ok()
});

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StreamHealth {
    Usable,
    Expired,
}

#[tauri::command]
pub async fn music_search(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    query: String,
    limit: Option<usize>,
    connector: Option<String>,
) -> Result<Vec<MusicTrack>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    if query.len() > 200 {
        return Err("Music search is too long".to_string());
    }
    let limit = limit.unwrap_or(24).clamp(1, 100);
    let tracks = state
        .registry
        .search(&app, query, limit, connector.as_deref())
        .await?;
    for track in &tracks {
        state.db.upsert_track(track)?;
    }
    Ok(tracks)
}

fn expiry_status(status: u16) -> bool {
    matches!(status, 401 | 403 | 410)
}

async fn probe_stream(stream: &MusicStream) -> StreamHealth {
    let url = stream.url.trim();
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return StreamHealth::Usable;
    }
    let Some(client) = PROBE_CLIENT.as_ref() else {
        return StreamHealth::Usable;
    };
    let Ok(headers) = stream.request_headers() else {
        return StreamHealth::Expired;
    };
    match client
        .get(url)
        .headers(headers)
        // Match mpv/ffmpeg's opening request: some signed URLs serve one byte but
        // reject the open-ended range needed for playback. Only inspect headers;
        // dropping the response stops the probe without downloading the audio.
        .header(reqwest::header::RANGE, "bytes=0-")
        .send()
        .await
    {
        Ok(response) if expiry_status(response.status().as_u16()) => StreamHealth::Expired,
        _ => StreamHealth::Usable,
    }
}

async fn cached_or_resolved<Probe, Probed, Resolve, Resolved>(
    db: &MusicDb,
    track_id: &str,
    probe: Probe,
    resolve: Resolve,
) -> Result<MusicStream, String>
where
    Probe: FnOnce(MusicStream) -> Probed,
    Probed: Future<Output = (MusicStream, StreamHealth)>,
    Resolve: FnOnce() -> Resolved,
    Resolved: Future<Output = Result<MusicStream, String>>,
{
    if let Some(cached) = db.cached_stream(track_id)? {
        let (cached, health) = probe(cached).await;
        if health == StreamHealth::Usable {
            return Ok(cached);
        }
        db.invalidate_stream(track_id)?;
    }
    let stream = resolve().await?;
    db.cache_stream(track_id, &stream)?;
    Ok(stream)
}

pub(super) async fn resolve_track(
    app: &tauri::AppHandle,
    state: &MusicState,
    track: &MusicTrack,
) -> Result<MusicStream, String> {
    state.db.upsert_track(track)?;
    if let Some(url) = track
        .playback_url
        .as_deref()
        .map(str::trim)
        .filter(|url| !url.is_empty())
    {
        return Ok(MusicStream {
            http_headers: Default::default(),
            url: url.to_string(),
            mime_type: "audio/mpeg".to_string(),
            bitrate: 0,
        });
    }
    let connector_id = track.connector_id.as_deref().unwrap_or("youtube");
    cached_or_resolved(
        &state.db,
        &track.id,
        |cached| async move {
            let health = probe_stream(&cached).await;
            (cached, health)
        },
        move || async move {
            let connector = state
                .registry
                .get(connector_id)
                .ok_or_else(|| format!("Unknown music connector: {connector_id}"))?;
            connector.resolve(app, track).await
        },
    )
    .await
}

#[tauri::command]
pub async fn music_resolve_stream(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    track: MusicTrack,
) -> Result<MusicStream, String> {
    resolve_track(&app, state.inner(), &track).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    const TRACK: &str = "soundcloud:34507776";

    fn stream(url: &str) -> MusicStream {
        MusicStream {
            http_headers: Default::default(),
            url: url.to_string(),
            mime_type: "audio/mpeg".to_string(),
            bitrate: 0,
        }
    }

    fn database_with_cached(url: &str) -> MusicDb {
        let database = MusicDb::in_memory();
        database
            .upsert_track(&MusicTrack {
                explicit: None,
                version: None,
                media_kind: None,
                id: TRACK.to_string(),
                connector_id: Some("soundcloud".to_string()),
                source_id: Some("https://soundcloud.com/muse/hysteria".to_string()),
                playback_url: None,
                title: "Hysteria".to_string(),
                artist: "Muse".to_string(),
                album: Some("Absolution".to_string()),
                artwork: "https://example.test/art.jpg".to_string(),
                duration_seconds: 227,
                duration_label: "3:47".to_string(),
            })
            .expect("store track");
        if !url.is_empty() {
            database
                .cache_stream(TRACK, &stream(url))
                .expect("cache stream");
        }
        database
    }

    #[tokio::test]
    async fn a_live_cached_url_never_reaches_the_connector() {
        let database = database_with_cached("https://cf-media.sndcdn.com/one");
        let calls = AtomicUsize::new(0);
        let counter = &calls;
        let resolved = cached_or_resolved(
            &database,
            TRACK,
            |cached| async move { (cached, StreamHealth::Usable) },
            || async move {
                counter.fetch_add(1, Ordering::SeqCst);
                Ok(stream("https://cf-media.sndcdn.com/two"))
            },
        )
        .await
        .expect("resolved stream");

        assert_eq!(resolved.url, "https://cf-media.sndcdn.com/one");
        assert_eq!(calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn an_expired_cached_url_is_invalidated_and_resolved_exactly_once() {
        let database = database_with_cached("https://cf-media.sndcdn.com/expired");
        let calls = AtomicUsize::new(0);
        let counter = &calls;
        let resolved = cached_or_resolved(
            &database,
            TRACK,
            |cached| async move { (cached, StreamHealth::Expired) },
            || async move {
                counter.fetch_add(1, Ordering::SeqCst);
                Ok(stream("https://cf-media.sndcdn.com/renewed"))
            },
        )
        .await
        .expect("resolved stream");

        assert_eq!(resolved.url, "https://cf-media.sndcdn.com/renewed");
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(
            database
                .cached_stream(TRACK)
                .expect("read cache")
                .expect("renewed stream")
                .url,
            "https://cf-media.sndcdn.com/renewed"
        );
    }

    #[tokio::test]
    async fn a_failed_retry_surfaces_the_error_and_leaves_no_dead_url() {
        let database = database_with_cached("https://cf-media.sndcdn.com/expired");
        let calls = AtomicUsize::new(0);
        let counter = &calls;
        let error = cached_or_resolved(
            &database,
            TRACK,
            |cached| async move { (cached, StreamHealth::Expired) },
            || async move {
                counter.fetch_add(1, Ordering::SeqCst);
                Err("SoundCloud rejected the request".to_string())
            },
        )
        .await
        .expect_err("resolve failure");

        assert_eq!(error, "SoundCloud rejected the request");
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert!(database.cached_stream(TRACK).expect("read cache").is_none());
    }

    #[tokio::test]
    async fn an_empty_cache_resolves_once_and_stores_the_result() {
        let database = database_with_cached("");
        let calls = AtomicUsize::new(0);
        let counter = &calls;
        let resolved = cached_or_resolved(
            &database,
            TRACK,
            |cached| async move { (cached, StreamHealth::Expired) },
            || async move {
                counter.fetch_add(1, Ordering::SeqCst);
                Ok(stream("https://cf-media.sndcdn.com/first"))
            },
        )
        .await
        .expect("resolved stream");

        assert_eq!(resolved.url, "https://cf-media.sndcdn.com/first");
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(
            database
                .cached_stream(TRACK)
                .expect("read cache")
                .expect("stored stream")
                .url,
            "https://cf-media.sndcdn.com/first"
        );
    }

    #[test]
    fn only_auth_and_expiry_statuses_count_as_expired() {
        for status in [401, 403, 410] {
            assert!(expiry_status(status));
        }
        for status in [200, 206, 302, 404, 429, 500, 503] {
            assert!(!expiry_status(status));
        }
    }

    #[tokio::test]
    async fn a_probe_uses_the_player_range_and_does_not_wait_for_the_audio_body() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind probe fixture");
        let address = listener.local_addr().expect("fixture address");
        let (request_tx, request_rx) = tokio::sync::oneshot::channel();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("probe connection");
            let mut request = Vec::new();
            while !request.ends_with(b"\r\n\r\n") {
                let mut byte = [0_u8; 1];
                socket.read_exact(&mut byte).await.expect("request headers");
                request.push(byte[0]);
                assert!(request.len() < 8192, "bounded request headers");
            }
            let request = String::from_utf8(request).expect("HTTP request");
            let range_matches_player = request
                .lines()
                .any(|line| line.eq_ignore_ascii_case("range: bytes=0-"));
            request_tx.send(range_matches_player).expect("report range");
            // Reproduce the provider that allows tiny ranges but refuses playback.
            let status = if range_matches_player {
                "403 Forbidden"
            } else {
                "206 Partial Content"
            };
            socket
                .write_all(
                    format!("HTTP/1.1 {status}\r\nContent-Length: 1000000\r\n\r\n").as_bytes(),
                )
                .await
                .expect("response headers");
            // Send no body; the client must finish from headers and close the socket.
            let mut byte = [0_u8; 1];
            let _ = socket.read(&mut byte).await;
        });
        let result = tokio::time::timeout(
            Duration::from_secs(2),
            probe_stream(&stream(&format!("http://{address}/audio"))),
        )
        .await;
        server.abort();
        assert_eq!(
            result.expect("probe finishes before the body"),
            StreamHealth::Expired
        );
        assert!(request_rx.await.expect("captured probe range"));
    }

    #[tokio::test]
    async fn a_local_path_is_never_probed_over_the_network() {
        assert_eq!(
            probe_stream(&stream("C:/Music/Hysteria.flac")).await,
            StreamHealth::Usable
        );
        assert_eq!(
            probe_stream(&stream("file:///music/hysteria.flac")).await,
            StreamHealth::Usable
        );
    }
}

#[tauri::command]
pub async fn music_prewarm_track(
    app: tauri::AppHandle,
    state: tauri::State<'_, MusicState>,
    track: MusicTrack,
) -> Result<bool, String> {
    Ok(resolve_track(&app, state.inner(), &track).await.is_ok())
}
