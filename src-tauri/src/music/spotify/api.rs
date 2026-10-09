use serde_json::Value;

const BASE: &str = "https://api.spotify.com/v1";
const BODY_EXCERPT: usize = 180;

pub const RESTRICTED_CLIENT: &str = "Spotify rejected the request";
pub const SIGN_IN_AGAIN: &str = "Spotify sign in expired";

#[derive(Debug, Clone)]
pub struct ApiError {
    pub status: Option<u16>,
    pub message: String,
}

impl ApiError {
    pub fn missing(&self) -> bool {
        matches!(self.status, Some(403) | Some(404))
    }

    pub fn over_limit(&self) -> bool {
        self.status == Some(400)
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl From<ApiError> for String {
    fn from(error: ApiError) -> Self {
        error.message
    }
}

const RETRY_AFTER_CAP: u64 = 8;

pub async fn get(
    http: &reqwest::Client,
    token: &str,
    path: &str,
    query: &[(&str, String)],
) -> Result<Value, ApiError> {
    let mut waited = false;
    loop {
        let response = http
            .get(format!("{BASE}{path}"))
            .bearer_auth(token)
            .query(query)
            .timeout(std::time::Duration::from_secs(25))
            .send()
            .await
            .map_err(|error| ApiError {
                status: None,
                message: format!("Spotify request failed: {error}"),
            })?;
        let status = response.status().as_u16();
        if response.status().is_success() {
            return response.json::<Value>().await.map_err(|error| ApiError {
                status: Some(status),
                message: format!("Spotify response was invalid: {error}"),
            });
        }
        if status == 429 && !waited {
            let after = response
                .headers()
                .get("retry-after")
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.trim().parse::<u64>().ok())
                .unwrap_or(1)
                .clamp(1, RETRY_AFTER_CAP);
            waited = true;
            tokio::time::sleep(std::time::Duration::from_secs(after)).await;
            continue;
        }
        let body = response.text().await.unwrap_or_default();
        return Err(ApiError {
            status: Some(status),
            message: describe(status, &body),
        });
    }
}

pub async fn me(http: &reqwest::Client, token: &str) -> Result<Value, ApiError> {
    get(http, token, "/me", &[]).await
}

pub async fn devices(http: &reqwest::Client, token: &str) -> Result<Value, ApiError> {
    get(http, token, "/me/player/devices", &[]).await
}

/// Player reads answer 204 with no body whenever nothing at all is loaded on the account.
pub async fn player_state(
    http: &reqwest::Client,
    token: &str,
) -> Result<Option<Value>, ApiError> {
    let response = http
        .get(format!("{BASE}/me/player"))
        .bearer_auth(token)
        .timeout(std::time::Duration::from_secs(25))
        .send()
        .await
        .map_err(|error| ApiError {
            status: None,
            message: format!("Spotify request failed: {error}"),
        })?;
    let status = response.status().as_u16();
    if status == 204 {
        return Ok(None);
    }
    if response.status().is_success() {
        return response
            .json::<Value>()
            .await
            .map(Some)
            .map_err(|error| ApiError {
                status: Some(status),
                message: format!("Spotify response was invalid: {error}"),
            });
    }
    let body = response.text().await.unwrap_or_default();
    Err(ApiError {
        status: Some(status),
        message: describe(status, &body),
    })
}

/// Player writes answer 204 with no body, so nothing is parsed back out of them.
pub async fn player_command(
    http: &reqwest::Client,
    token: &str,
    path: &str,
    query: &[(&str, String)],
    body: Option<Value>,
) -> Result<(), ApiError> {
    let mut request = http
        .put(format!("{BASE}{path}"))
        .bearer_auth(token)
        .query(query)
        .timeout(std::time::Duration::from_secs(25));
    request = match body {
        Some(value) => request.json(&value),
        None => request.header("content-length", "0"),
    };
    let response = request.send().await.map_err(|error| ApiError {
        status: None,
        message: format!("Spotify request failed: {error}"),
    })?;
    if response.status().is_success() {
        return Ok(());
    }
    let status = response.status().as_u16();
    let text = response.text().await.unwrap_or_default();
    Err(ApiError {
        status: Some(status),
        message: describe(status, &text),
    })
}

pub async fn post(
    http: &reqwest::Client,
    token: &str,
    path: &str,
    body: &Value,
) -> Result<Value, ApiError> {
    // Playlist writes are never retried automatically: a lost response may still
    // mean Spotify applied the change.
    let response = http.post(format!("{BASE}{path}"))
        .bearer_auth(token).json(body)
        .timeout(std::time::Duration::from_secs(25))
        .send().await.map_err(|_| ApiError {
            status: None,
            message: "Spotify did not confirm the change. Check the playlist on Spotify before trying again.".to_string(),
        })?;
    let status = response.status().as_u16();
    if response.status().is_success() {
        return response.json::<Value>().await.map_err(|_| ApiError {
            status: Some(status),
            message: "Spotify did not confirm the change. Check the playlist on Spotify before trying again.".to_string(),
        });
    }
    let text = response.text().await.unwrap_or_default();
    Err(ApiError {
        status: Some(status),
        message: describe(status, &text),
    })
}

pub async fn my_playlists(
    http: &reqwest::Client,
    token: &str,
    limit: usize,
) -> Result<Value, ApiError> {
    get(http, token, "/me/playlists", &page(limit)).await
}

pub async fn saved_tracks(
    http: &reqwest::Client,
    token: &str,
    limit: usize,
    market: &str,
) -> Result<Value, ApiError> {
    let mut query = page(limit);
    query.push(("market", market.to_string()));
    get(http, token, "/me/tracks", &query).await
}

pub async fn saved_albums(
    http: &reqwest::Client,
    token: &str,
    limit: usize,
    market: &str,
) -> Result<Value, ApiError> {
    let mut query = page(limit);
    query.push(("market", market.to_string()));
    get(http, token, "/me/albums", &query).await
}

pub async fn top(
    http: &reqwest::Client,
    token: &str,
    kind: &str,
    limit: usize,
) -> Result<Value, ApiError> {
    let mut query = page(limit);
    query.push(("time_range", "medium_term".to_string()));
    get(http, token, &format!("/me/top/{kind}"), &query).await
}

pub async fn recently_played(
    http: &reqwest::Client,
    token: &str,
    limit: usize,
) -> Result<Value, ApiError> {
    get(http, token, "/me/player/recently-played", &page(limit)).await
}

pub async fn search(
    http: &reqwest::Client,
    token: &str,
    query: &str,
    kinds: &str,
    limit: usize,
    market: &str,
) -> Result<Value, ApiError> {
    let request = |limit: usize| {
        vec![
            ("q", query.to_string()),
            ("type", kinds.to_string()),
            ("limit", limit.clamp(1, 50).to_string()),
            ("market", market.to_string()),
        ]
    };
    match get(http, token, "/search", &request(limit)).await {
        Err(error) if error.over_limit() && limit > RESTRICTED_SEARCH_LIMIT => {
            get(http, token, "/search", &request(RESTRICTED_SEARCH_LIMIT)).await
        }
        outcome => outcome,
    }
}

pub async fn album_tracks(
    http: &reqwest::Client,
    token: &str,
    album: &str,
    limit: usize,
    market: &str,
) -> Result<Value, ApiError> {
    let mut query = page(limit);
    query.push(("market", market.to_string()));
    get(http, token, &format!("/albums/{album}/tracks"), &query).await
}

pub async fn artist_top_tracks(
    http: &reqwest::Client,
    token: &str,
    artist: &str,
    market: &str,
) -> Result<Value, ApiError> {
    get(
        http,
        token,
        &format!("/artists/{artist}/top-tracks"),
        &[("market", market.to_string())],
    )
    .await
}

pub async fn playlist_items(
    http: &reqwest::Client,
    token: &str,
    playlist: &str,
    limit: usize,
    offset: usize,
    market: &str,
) -> Result<Value, ApiError> {
    let mut query = page(limit);
    query.push(("offset", offset.to_string()));
    query.push(("market", market.to_string()));
    query.push(("additional_types", "track".to_string()));
    match get(http, token, &format!("/playlists/{playlist}/items"), &query).await {
        Err(error) if error.status == Some(404) => {
            get(
                http,
                token,
                &format!("/playlists/{playlist}/tracks"),
                &query,
            )
            .await
        }
        outcome => outcome,
    }
}

const RESTRICTED_SEARCH_LIMIT: usize = 10;

fn page(limit: usize) -> Vec<(&'static str, String)> {
    vec![("limit", limit.clamp(1, 50).to_string())]
}

fn describe(status: u16, body: &str) -> String {
    match status {
        401 => format!("{SIGN_IN_AGAIN}. Connect Spotify again."),
        403 => "Spotify refused this request for the connected account.".to_string(),
        404 => "Spotify does not have that item.".to_string(),
        429 => "Spotify is rate limiting Harbor. Try again in a moment.".to_string(),
        400 => format!("{RESTRICTED_CLIENT}. {}", excerpt(body)),
        _ => format!("Spotify returned {status}. {}", excerpt(body)),
    }
}

fn excerpt(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    match trimmed.char_indices().nth(BODY_EXCERPT) {
        Some((index, _)) => trimmed[..index].to_string(),
        None => trimmed.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_status_drives_the_fallback_decisions() {
        let restricted = ApiError {
            status: Some(400),
            message: String::new(),
        };
        assert!(restricted.over_limit());
        assert!(!restricted.missing());

        let forbidden = ApiError {
            status: Some(403),
            message: String::new(),
        };
        assert!(forbidden.missing());
        assert!(!forbidden.over_limit());

        let offline = ApiError {
            status: None,
            message: String::new(),
        };
        assert!(!offline.missing());
        assert!(!offline.over_limit());
    }

    #[test]
    fn descriptions_stay_readable_and_never_dump_a_whole_body() {
        assert!(describe(401, "").contains(SIGN_IN_AGAIN));
        assert!(describe(429, "").contains("rate limiting"));
        let long = "x".repeat(500);
        let message = describe(500, &long);
        assert!(message.starts_with("Spotify returned 500"));
        assert!(message.len() < 260);
    }

    #[test]
    fn excerpts_do_not_split_multibyte_characters() {
        let body = "é".repeat(400);
        let trimmed = excerpt(&body);
        assert_eq!(trimmed.chars().count(), BODY_EXCERPT);
    }

    #[test]
    fn paging_clamps_to_the_spotify_maximum() {
        assert_eq!(page(0)[0].1, "1");
        assert_eq!(page(20)[0].1, "20");
        assert_eq!(page(900)[0].1, "50");
    }
}
