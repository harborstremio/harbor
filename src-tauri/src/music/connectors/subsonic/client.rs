use super::model::{ApiError, AuthLogin, Body, Envelope};
use super::pairing::Pairing;
use serde_json::json;
use std::time::Duration;

const API_VERSION: &str = "1.16.1";
const CLIENT_NAME: &str = "Harbor";
const USER_AGENT: &str = "Harbor/1.0";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const ARTWORK_SIZE: &str = "512";
const NAVIDROME_PORT: &str = "4533";

#[derive(Clone)]
pub struct SubsonicClient {
    http: reqwest::Client,
    pairing: Pairing,
}

impl SubsonicClient {
    pub fn new(http: reqwest::Client, pairing: Pairing) -> Self {
        Self { http, pairing }
    }

    pub fn pairing(&self) -> &Pairing {
        &self.pairing
    }

    pub async fn call(&self, method: &str, extra: &[(&str, String)]) -> Result<Body, String> {
        let mut query: Vec<(&str, String)> = self.auth();
        query.push(("f", "json".to_string()));
        for (key, value) in extra {
            query.push((*key, value.clone()));
        }
        let response = self
            .http
            .get(self.endpoint(method))
            .query(&query)
            .send()
            .await
            .map_err(|error| format!("Music server request failed: {error}"))?;
        let status = response.status();
        let payload = response
            .text()
            .await
            .map_err(|error| format!("Music server request failed: {error}"))?;
        if !status.is_success() {
            return Err(format!("Music server returned HTTP {status}"));
        }
        let body = serde_json::from_str::<Envelope>(&payload)
            .map_err(|_| "Music server sent a response Harbor could not read".to_string())?
            .response;
        if body.status != "ok" {
            return Err(describe(body.error.as_ref()));
        }
        Ok(body)
    }

    pub async fn ping(&self) -> Result<(), String> {
        self.call("ping", &[]).await.map(|_| ())
    }

    pub async fn scrobble(
        &self,
        song_id: &str,
        completed_at_millis: Option<u64>,
    ) -> Result<(), String> {
        let mut extra = vec![("id", song_id.to_string())];
        match completed_at_millis {
            Some(time) => {
                extra.push(("submission", "true".to_string()));
                extra.push(("time", time.to_string()));
            }
            None => extra.push(("submission", "false".to_string())),
        }
        self.call("scrobble", &extra).await.map(|_| ())
    }

    pub fn stream_url(&self, song_id: &str) -> Result<String, String> {
        self.media_url(
            "stream",
            &[("id", song_id.to_string()), ("format", "raw".to_string())],
        )
    }

    pub fn cover_art_url(&self, cover_art: &str) -> String {
        self.media_url(
            "getCoverArt",
            &[
                ("id", cover_art.to_string()),
                ("size", ARTWORK_SIZE.to_string()),
            ],
        )
        .unwrap_or_default()
    }

    fn endpoint(&self, method: &str) -> String {
        format!("{}/rest/{method}", self.pairing.base_url)
    }

    fn auth(&self) -> Vec<(&'static str, String)> {
        vec![
            ("u", self.pairing.username.clone()),
            ("t", self.pairing.token.clone()),
            ("s", self.pairing.salt.clone()),
            ("v", API_VERSION.to_string()),
            ("c", CLIENT_NAME.to_string()),
        ]
    }

    fn media_url(&self, method: &str, extra: &[(&str, String)]) -> Result<String, String> {
        let mut target = url::Url::parse(&self.endpoint(method))
            .map_err(|_| "That music server address is not valid".to_string())?;
        {
            let mut pairs = target.query_pairs_mut();
            for (key, value) in self.auth() {
                pairs.append_pair(key, &value);
            }
            for (key, value) in extra {
                pairs.append_pair(key, value);
            }
        }
        Ok(target.to_string())
    }
}

pub fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

pub async fn pair(
    http: &reqwest::Client,
    base_url: &str,
    username: &str,
    password: &str,
) -> Result<SubsonicClient, String> {
    let pairing = match exchange(http, base_url, username, password).await {
        Some(pairing) => pairing,
        None => salted(base_url, username, password),
    };
    let client = SubsonicClient::new(http.clone(), pairing);
    client.ping().await?;
    Ok(client)
}

async fn exchange(
    http: &reqwest::Client,
    base_url: &str,
    username: &str,
    password: &str,
) -> Option<Pairing> {
    let response = http
        .post(format!("{base_url}/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let login = response.json::<AuthLogin>().await.ok()?;
    let salt = login.salt.filter(|salt| salt.len() >= 6)?;
    let token = login.token.filter(|token| token.len() == 32)?;
    Some(Pairing {
        base_url: base_url.to_string(),
        username: login.username.unwrap_or_else(|| username.to_string()),
        salt,
        token,
    })
}

fn salted(base_url: &str, username: &str, password: &str) -> Pairing {
    let salt = uuid::Uuid::new_v4()
        .simple()
        .to_string()
        .chars()
        .take(16)
        .collect::<String>();
    Pairing {
        token: token(password, &salt),
        base_url: base_url.to_string(),
        username: username.to_string(),
        salt,
    }
}

fn token(password: &str, salt: &str) -> String {
    format!("{:x}", md5::compute(format!("{password}{salt}").as_bytes()))
}

pub fn base_candidates(raw: &str) -> Result<Vec<String>, String> {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Enter the address of your music server".to_string());
    }
    if trimmed.contains("://") {
        return Ok(vec![normalize(trimmed)?]);
    }
    let mut candidates = vec![
        normalize(&format!("https://{trimmed}"))?,
        normalize(&format!("http://{trimmed}"))?,
    ];
    if !trimmed.contains(':') {
        candidates.push(normalize(&format!("http://{trimmed}:{NAVIDROME_PORT}"))?);
    }
    Ok(candidates)
}

fn normalize(raw: &str) -> Result<String, String> {
    let parsed =
        url::Url::parse(raw).map_err(|_| "That music server address is not valid".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("A music server address must start with http or https".to_string());
    }
    if parsed.host_str().unwrap_or_default().is_empty() {
        return Err("That music server address is missing a host".to_string());
    }
    Ok(parsed.as_str().trim_end_matches('/').to_string())
}

fn describe(error: Option<&ApiError>) -> String {
    let Some(error) = error else {
        return "Music server rejected the request".to_string();
    };
    match error.code {
        40 | 41 => "Your music server rejected this sign in. Connect it again.".to_string(),
        _ => error
            .message
            .clone()
            .filter(|message| !message.trim().is_empty())
            .unwrap_or_else(|| format!("Music server error {}", error.code)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn client() -> SubsonicClient {
        SubsonicClient::new(
            reqwest::Client::new(),
            Pairing {
                base_url: "https://music.example.test".to_string(),
                username: "alice".to_string(),
                salt: "c19b2d".to_string(),
                token: token("sesame", "c19b2d"),
            },
        )
    }

    #[test]
    fn tokens_match_the_published_worked_example() {
        assert_eq!(
            token("sesame", "c19b2d"),
            "26719a1196d2a940705a59634eb18eab"
        );
    }

    #[test]
    fn stream_urls_carry_auth_and_ask_for_untranscoded_audio() {
        let url = client().stream_url("mf-1").expect("stream url");
        assert!(url.starts_with("https://music.example.test/rest/stream?"));
        assert!(url.contains("u=alice"));
        assert!(url.contains("s=c19b2d"));
        assert!(url.contains("t=26719a1196d2a940705a59634eb18eab"));
        assert!(url.contains("v=1.16.1"));
        assert!(url.contains("c=Harbor"));
        assert!(url.contains("format=raw"));
        assert!(!url.contains("f=json"));
    }

    #[test]
    fn cover_art_urls_request_a_sized_image() {
        let url = client().cover_art_url("al-1_9f3c");
        assert!(url.contains("id=al-1_9f3c"));
        assert!(url.contains("size=512"));
        assert!(!url.contains("f=json"));
    }

    #[test]
    fn bare_hosts_expand_into_a_probe_ladder() {
        assert_eq!(
            base_candidates("music.example.test").expect("candidates"),
            vec![
                "https://music.example.test".to_string(),
                "http://music.example.test".to_string(),
                "http://music.example.test:4533".to_string(),
            ]
        );
        assert_eq!(
            base_candidates("music.example.test:8080").expect("candidates"),
            vec![
                "https://music.example.test:8080".to_string(),
                "http://music.example.test:8080".to_string(),
            ]
        );
    }

    #[test]
    fn explicit_addresses_keep_their_scheme_subpath_and_lose_the_trailing_slash() {
        assert_eq!(
            base_candidates("http://192.168.1.4:4533/music/").expect("candidates"),
            vec!["http://192.168.1.4:4533/music".to_string()]
        );
        assert!(base_candidates("ftp://music.example.test").is_err());
        assert!(base_candidates("   ").is_err());
    }

    #[test]
    fn stale_pairing_read_as_a_sign_in_prompt_not_a_typo() {
        let stale = ApiError {
            code: 40,
            message: Some("Wrong username or password".to_string()),
        };
        assert!(describe(Some(&stale)).contains("Connect it again"));
        let unknown = ApiError {
            code: 70,
            message: Some("Data not found".to_string()),
        };
        assert_eq!(describe(Some(&unknown)), "Data not found");
        assert_eq!(
            describe(None),
            "Music server rejected the request".to_string()
        );
    }
}
