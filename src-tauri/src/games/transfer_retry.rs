use reqwest::header::{HeaderMap, RETRY_AFTER};
use std::time::{Duration, SystemTime};

const DELAYS: [u64; 3] = [2, 5, 15];
const MAX_SERVER_WAIT: Duration = Duration::from_secs(120);

#[derive(Debug)]
pub struct Failure {
    pub code: &'static str,
    retryable: bool,
    retry_after: Option<Duration>,
}

impl From<&'static str> for Failure {
    fn from(code: &'static str) -> Self {
        Self {
            code,
            retryable: matches!(code, "transfer_network" | "transfer_timeout"),
            retry_after: None,
        }
    }
}

impl Failure {
    pub fn from_http(status: u16, headers: &HeaderMap) -> Option<Self> {
        if !matches!(status, 408 | 425 | 429 | 500 | 502 | 503 | 504) {
            return None;
        }
        let retry_after = headers
            .get(RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| {
                value
                    .trim()
                    .parse::<u64>()
                    .ok()
                    .map(Duration::from_secs)
                    .or_else(|| {
                        httpdate::parse_http_date(value)
                            .ok()
                            .map(|date| date.duration_since(SystemTime::now()).unwrap_or_default())
                    })
            });
        Some(Self {
            code: "transfer_http",
            retryable: true,
            retry_after,
        })
    }

    pub fn delay(&self, retries: usize) -> Option<Duration> {
        if !self.retryable
            || self
                .retry_after
                .is_some_and(|delay| delay > MAX_SERVER_WAIT)
        {
            return None;
        }
        let backoff = Duration::from_secs(*DELAYS.get(retries)?);
        Some(backoff.max(self.retry_after.unwrap_or_default()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn retries_only_transient_failures_with_a_finite_budget() {
        for code in ["transfer_network", "transfer_timeout"] {
            let error = Failure::from(code);
            assert_eq!(
                (0..4)
                    .map(|n| error.delay(n).map(|d| d.as_secs()))
                    .collect::<Vec<_>>(),
                vec![Some(2), Some(5), Some(15), None]
            );
        }
        for code in [
            "transfer_stopped",
            "transfer_write",
            "transfer_store",
            "transfer_checksum",
            "transfer_changed",
            "transfer_size_mismatch",
            "transfer_space",
            "transfer_http",
            "transfer_access",
        ] {
            assert_eq!(Failure::from(code).delay(0), None);
        }
        for status in [401, 403, 404, 410, 416, 501, 200, 206] {
            assert!(Failure::from_http(status, &HeaderMap::new()).is_none());
        }
        for status in [408, 425, 429, 500, 502, 503, 504] {
            assert!(Failure::from_http(status, &HeaderMap::new())
                .unwrap()
                .delay(0)
                .is_some());
        }
    }
    #[test]
    fn honors_server_delays_without_retrying_early_or_waiting_unboundedly() {
        let mut headers = HeaderMap::new();
        for (value, expected) in [
            ("17", Some(17)),
            ("0", Some(2)),
            ("999999999", None),
            ("nonsense", Some(2)),
        ] {
            headers.insert(RETRY_AFTER, value.parse().unwrap());
            assert_eq!(
                Failure::from_http(429, &headers)
                    .unwrap()
                    .delay(0)
                    .map(|d| d.as_secs()),
                expected
            );
        }
        headers.insert(
            RETRY_AFTER,
            httpdate::fmt_http_date(SystemTime::now() + Duration::from_secs(45))
                .parse()
                .unwrap(),
        );
        let delay = Failure::from_http(503, &headers).unwrap().delay(0).unwrap();
        assert!(delay >= Duration::from_secs(43) && delay <= Duration::from_secs(45));
    }
}
