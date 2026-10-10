use std::sync::LazyLock;
use std::time::Duration;

const AGENT: &str = concat!(
    "Harbor/",
    env!("CARGO_PKG_VERSION"),
    " ( https://github.com/harborstremio/harbor )"
);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(6);

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent(AGENT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .unwrap_or_default()
});

pub struct Payload {
    pub content_type: String,
    pub text: String,
}

pub async fn get(url: &str, provider: &str) -> Result<Payload, String> {
    let response = CLIENT
        .get(url)
        .send()
        .await
        .map_err(|error| format!("{provider} request failed: {error}"))?;
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let text = response
        .text()
        .await
        .map_err(|error| format!("{provider} response was unreadable: {error}"))?;
    if !status.is_success() {
        return Err(format!("{provider} returned HTTP {}", status.as_u16()));
    }
    Ok(Payload { content_type, text })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_user_agent_identifies_harbor_and_carries_a_contact() {
        assert!(AGENT.starts_with("Harbor/"));
        assert!(AGENT.contains("https://github.com/harborstremio/harbor"));
    }
}
