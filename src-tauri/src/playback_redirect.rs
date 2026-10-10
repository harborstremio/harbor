use reqwest::{header, Client, StatusCode, Url};
use std::{sync::OnceLock, time::Duration};

const RESOLVE_BUDGET: Duration = Duration::from_millis(2500);
const PLAYER_USER_AGENT: &str = "VLC/3.0.20 LibVLC/3.0.20";

fn candidate(url: &Url) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && matches!(
            url.host_str(),
            Some("addon.debridio.com" | "mediafusion.elfhosted.com")
        )
}

fn client() -> Option<&'static Client> {
    static CLIENT: OnceLock<Option<Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .timeout(RESOLVE_BUDGET)
                .build()
                .ok()
        })
        .as_ref()
}

async fn resolve(client: &Client, url: &str, budget: Duration) -> Option<String> {
    tokio::time::timeout(budget, async {
        // GET matches the actual playback route; HEAD is rejected or handled
        // differently by some add-ons. Read headers only, then drop the body.
        let response = crate::http_redirect::send_get(
            client,
            client
                .get(url)
                .header(header::USER_AGENT, PLAYER_USER_AGENT)
                .header(header::RANGE, "bytes=0-0")
                .header(header::ACCEPT_ENCODING, "identity"),
            url,
        )
        .await
        .ok()?;
        if response.url().as_str() == url
            || response.status() != StatusCode::PARTIAL_CONTENT
            || response.headers().contains_key(header::SET_COOKIE)
        {
            return None;
        }
        let content_range = response
            .headers()
            .get(header::CONTENT_RANGE)?
            .to_str()
            .ok()?;
        let size = content_range
            .strip_prefix("bytes 0-0/")?
            .parse::<u64>()
            .ok()?;
        let content_type = response
            .headers()
            .get(header::CONTENT_TYPE)?
            .to_str()
            .ok()?
            .split(';')
            .next()?
            .trim()
            .to_ascii_lowercase();
        let media = content_type.starts_with("video/")
            || content_type.starts_with("audio/")
            || matches!(
                content_type.as_str(),
                "application/octet-stream"
                    | "application/force-download"
                    | "application/x-matroska"
            );
        (size > 0 && media).then(|| response.url().to_string())
    })
    .await
    .ok()
    .flatten()
}

pub async fn resolve_playback_redirect(url: String) -> Option<String> {
    let parsed = Url::parse(&url).ok()?;
    if !candidate(&parsed) {
        return None;
    }
    resolve(client()?, &url, RESOLVE_BUDGET).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{http::HeaderMap, routing::get, Router};
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    struct Server {
        url: String,
        task: tokio::task::JoinHandle<()>,
    }
    impl Drop for Server {
        fn drop(&mut self) {
            self.task.abort();
        }
    }
    async fn serve(router: Router) -> Server {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let task = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        Server { url, task }
    }
    fn test_client() -> Client {
        Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap()
    }

    #[test]
    fn only_measured_https_addon_origins_are_candidates() {
        for host in ["addon.debridio.com", "mediafusion.elfhosted.com"] {
            assert!(candidate(
                &Url::parse(&format!("https://{host}/fixture/play")).unwrap()
            ));
            for url in [
                format!("http://{host}/play"),
                format!("https://{host}.example.org/play"),
                format!("https://{host}:8443/play"),
                format!("https://user:secret@{host}/play"),
            ] {
                assert!(!candidate(&Url::parse(&url).unwrap()));
            }
        }
        assert!(!candidate(
            &Url::parse("https://cdn.example.org/file.mkv").unwrap()
        ));
    }

    #[tokio::test]
    async fn resolves_one_byte_media_redirect_without_fetching_body() {
        let requests = Arc::new(AtomicUsize::new(0));
        let seen = requests.clone();
        let server = serve(
            Router::new()
                .route(
                    "/play",
                    get(|| async { (StatusCode::FOUND, [("location", "/file")]) }),
                )
                .route(
                    "/file",
                    get(move |headers: HeaderMap| {
                        let seen = seen.clone();
                        async move {
                            seen.fetch_add(1, Ordering::SeqCst);
                            assert_eq!(headers.get("range").unwrap(), "bytes=0-0");
                            assert_eq!(headers.get("user-agent").unwrap(), PLAYER_USER_AGENT);
                            assert_eq!(headers.get("accept-encoding").unwrap(), "identity");
                            // Never finish a body: resolution must depend on headers only.
                            axum::http::Response::builder()
                                .status(206)
                                .header("content-type", "video/x-matroska")
                                .header("content-range", "bytes 0-0/100000000")
                                .body(axum::body::Body::from_stream(futures::stream::pending::<
                                    Result<axum::body::Bytes, std::io::Error>,
                                >(
                                )))
                                .unwrap()
                        }
                    }),
                ),
        )
        .await;
        let result = resolve(
            &test_client(),
            &format!("{}/play", server.url),
            Duration::from_secs(1),
        )
        .await;
        assert_eq!(result, Some(format!("{}/file", server.url)));
        assert_eq!(requests.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn unsuitable_responses_preserve_the_original_playback_path() {
        for (status, mime, range, cookie) in [
            (200, "video/mp4", "bytes 0-0/1000", false),
            (403, "video/mp4", "bytes 0-0/1000", false),
            (206, "text/html", "bytes 0-0/1000", false),
            (206, "video/mp4", "bytes 1-1/1000", false),
            (206, "video/mp4", "bytes 0-0/0", false),
            (206, "video/mp4", "bytes 0-0/1000", true),
        ] {
            let server = serve(
                Router::new()
                    .route(
                        "/play",
                        get(|| async { (StatusCode::FOUND, [("location", "/file")]) }),
                    )
                    .route(
                        "/file",
                        get(move || async move {
                            let mut response = axum::http::Response::builder()
                                .status(status)
                                .header("content-type", mime)
                                .header("content-range", range);
                            if cookie {
                                response = response.header("set-cookie", "fixture=1");
                            }
                            response.body(axum::body::Body::from("x")).unwrap()
                        }),
                    ),
            )
            .await;
            assert_eq!(
                resolve(
                    &test_client(),
                    &format!("{}/play", server.url),
                    Duration::from_secs(1)
                )
                .await,
                None
            );
        }
    }

    #[tokio::test]
    async fn timeout_and_redirect_loops_fall_back() {
        let server = serve(
            Router::new()
                .route(
                    "/slow",
                    get(|| async {
                        std::future::pending::<()>().await;
                        ""
                    }),
                )
                .route(
                    "/loop",
                    get(|| async { (StatusCode::FOUND, [("location", "/loop")]) }),
                ),
        )
        .await;
        for path in ["slow", "loop"] {
            assert_eq!(
                resolve(
                    &test_client(),
                    &format!("{}/{path}", server.url),
                    Duration::from_millis(40)
                )
                .await,
                None
            );
        }
    }

    #[tokio::test]
    async fn direct_media_is_not_substituted_and_unrecognized_origins_are_not_requested() {
        let server = serve(Router::new().route(
            "/file",
            get(|| async {
                (
                    StatusCode::PARTIAL_CONTENT,
                    [
                        ("content-type", "video/mp4"),
                        ("content-range", "bytes 0-0/1000"),
                    ],
                    "x",
                )
            }),
        ))
        .await;
        let url = format!("{}/file", server.url);
        assert_eq!(
            resolve(&test_client(), &url, Duration::from_secs(1)).await,
            None
        );
        assert_eq!(resolve_playback_redirect(url).await, None);
    }
}
