use reqwest::{header::HeaderMap, Client, Method, RequestBuilder, Response, Url};

const MAX_REDIRECTS: usize = 10;

pub(crate) fn same_origin(a: &Url, b: &Url) -> bool {
    a.scheme() == b.scheme()
        && a.host_str() == b.host_str()
        && a.port_or_known_default() == b.port_or_known_default()
}

// Custom headers can contain credentials under any name. Only protocol metadata
// may cross an origin boundary; a denylist of known token names is insufficient.
pub(crate) fn safe_cross_origin_header(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "accept" | "accept-language" | "accept-encoding" | "user-agent" | "range"
    )
}

fn strip_cross_origin_headers(headers: &mut HeaderMap) {
    let remove: Vec<_> = headers
        .keys()
        .filter(|name| !safe_cross_origin_header(name.as_str()))
        .cloned()
        .collect();
    for name in remove {
        headers.remove(name);
    }
}

fn validate_hop(current: &Url, next: &Url) -> Result<(), &'static str> {
    if !matches!(next.scheme(), "http" | "https")
        || !next.username().is_empty()
        || next.password().is_some()
    {
        return Err("invalid redirect target");
    }
    if current.scheme() == "https" && next.scheme() != "https" {
        return Err("HTTPS downgrade is not allowed");
    }
    Ok(())
}

/// The client must have automatic redirects disabled. Keep origin-bound headers
/// on same-origin hops, but never restore them after leaving that origin.
pub(crate) async fn send_get(
    client: &Client,
    builder: RequestBuilder,
    credential_origin: &str,
) -> Result<Response, &'static str> {
    let origin = Url::parse(credential_origin).map_err(|_| "invalid request origin")?;
    let mut request = builder.build().map_err(|_| "invalid upstream request")?;
    if request.method() != Method::GET {
        return Err("redirect helper requires GET");
    }
    validate_hop(&origin, request.url())?;
    if !same_origin(&origin, request.url()) {
        strip_cross_origin_headers(request.headers_mut());
    }
    for redirects in 0..=MAX_REDIRECTS {
        let next_request = request.try_clone().ok_or("request cannot be replayed")?;
        let response = client
            .execute(request)
            .await
            .map_err(|_| "upstream request failed")?;
        let status = response.status().as_u16();
        if !matches!(status, 301 | 302 | 303 | 307 | 308) {
            return Ok(response);
        }
        let Some(location) = response.headers().get(reqwest::header::LOCATION) else {
            return Ok(response);
        };
        if redirects == MAX_REDIRECTS {
            return Err("too many redirects");
        }
        let next = response
            .url()
            .join(location.to_str().map_err(|_| "invalid redirect")?)
            .map_err(|_| "invalid redirect")?;
        validate_hop(response.url(), &next)?;
        request = next_request;
        if !same_origin(response.url(), &next) {
            strip_cross_origin_headers(request.headers_mut());
        }
        *request.url_mut() = next;
    }
    unreachable!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{http::HeaderMap, routing::get, Json, Router};
    use std::collections::HashMap;

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
    fn echo() -> Router {
        Router::new().route(
            "/echo",
            get(|headers: HeaderMap| async move {
                Json(
                    headers
                        .iter()
                        .map(|(k, v)| (k.to_string(), v.to_str().unwrap().to_string()))
                        .collect::<HashMap<_, _>>(),
                )
            }),
        )
    }
    fn redirect(target: String, status: u16) -> Router {
        Router::new().route(
            "/start",
            get(move || {
                let target = target.clone();
                async move {
                    (
                        axum::http::StatusCode::from_u16(status).unwrap(),
                        [("location", target)],
                    )
                }
            }),
        )
    }
    fn client() -> Client {
        Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap()
    }
    fn request(client: &Client, url: &str) -> RequestBuilder {
        client
            .get(url)
            .header("x-test-token", "synthetic-only")
            .header("authorization", "Bearer synthetic-only")
            .header("cookie", "test=synthetic-only")
            .header("referer", "https://example.com/private")
            .header("origin", "https://example.com")
            .header("range", "bytes=0-100")
            .header("accept", "video/*")
    }

    #[tokio::test]
    async fn baseline_default_redirects_forward_custom_tokens() {
        let target = serve(echo()).await;
        let source = serve(redirect(format!("{}/echo", target.url), 302)).await;
        let default_client = Client::builder().no_proxy().build().unwrap();
        let headers: HashMap<String, String> =
            request(&default_client, &format!("{}/start", source.url))
                .send()
                .await
                .unwrap()
                .json()
                .await
                .unwrap();
        assert_eq!(headers.get("x-test-token").unwrap(), "synthetic-only");
    }

    #[tokio::test]
    async fn cross_origin_redirects_drop_all_credentials_and_keep_range() {
        let target = serve(echo()).await;
        for status in [301, 302, 303, 307, 308] {
            let source = serve(redirect(format!("{}/echo", target.url), status)).await;
            let client = client();
            let headers: HashMap<String, String> = send_get(
                &client,
                request(&client, &format!("{}/start", source.url)),
                &source.url,
            )
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
            for key in [
                "x-test-token",
                "authorization",
                "cookie",
                "referer",
                "origin",
            ] {
                assert!(!headers.contains_key(key), "forwarded {key} on {status}");
            }
            assert_eq!(headers["range"], "bytes=0-100");
            assert_eq!(headers["accept"], "video/*");
        }
    }

    #[tokio::test]
    async fn same_origin_relative_redirect_keeps_provider_credentials() {
        let server = serve(echo().merge(redirect("/echo".into(), 307))).await;
        let client = client();
        let headers: HashMap<String, String> = send_get(
            &client,
            request(&client, &format!("{}/start", server.url)),
            &server.url,
        )
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
        assert_eq!(headers["x-test-token"], "synthetic-only");
        assert_eq!(headers["authorization"], "Bearer synthetic-only");
        assert_eq!(headers["cookie"], "test=synthetic-only");
    }

    #[tokio::test]
    async fn cross_origin_playlist_targets_do_not_receive_original_headers() {
        let target = serve(echo()).await;
        let client = client();
        let headers: HashMap<String, String> = send_get(
            &client,
            request(&client, &format!("{}/echo", target.url)),
            "http://example.com/playlist",
        )
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
        assert!(!headers.contains_key("x-test-token"));
    }

    #[tokio::test]
    async fn credentials_are_not_restored_after_returning_to_original_origin() {
        let original = serve(echo()).await;
        let away = serve(redirect(format!("{}/echo", original.url), 302)).await;
        let client = client();
        let headers: HashMap<String, String> = send_get(
            &client,
            request(&client, &format!("{}/start", away.url)),
            &original.url,
        )
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
        assert!(!headers.contains_key("x-test-token"));
    }

    #[tokio::test]
    async fn redirect_loops_are_bounded() {
        let server = serve(redirect("/start".into(), 302)).await;
        let client = client();
        assert_eq!(
            send_get(
                &client,
                client.get(format!("{}/start", server.url)),
                &server.url
            )
            .await
            .unwrap_err(),
            "too many redirects"
        );
    }

    #[test]
    fn security_boundaries_include_port_scheme_and_url_credentials() {
        let https = Url::parse("https://example.com/").unwrap();
        for target in [
            "http://example.com/",
            "https://example.com:444/",
            "https://other.example.com/",
        ] {
            assert!(!same_origin(&https, &Url::parse(target).unwrap()));
        }
        assert!(same_origin(
            &https,
            &Url::parse("https://example.com:443/path").unwrap()
        ));
        for target in [
            "http://example.com/",
            "file:///tmp/test",
            "https://user:pass@example.com/",
        ] {
            assert!(validate_hop(&https, &Url::parse(target).unwrap()).is_err());
        }
        for name in [
            "X-Unknown-Secret",
            "X-Api-Key",
            "If-Range",
            "Origin",
            "Referer",
            "Cookie",
        ] {
            assert!(!safe_cross_origin_header(name));
        }
    }
}
