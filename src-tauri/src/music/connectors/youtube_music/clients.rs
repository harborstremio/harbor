use async_trait::async_trait;
use serde_json::{json, Value};

const TERMINAL_REASONS: [&str; 7] = [
    "private video",
    "has been removed",
    "no longer available",
    "terminated",
    "copyright",
    "not available in your country",
    "video unavailable",
];

pub struct PlayerClient {
    name: &'static str,
    version: &'static str,
    device_make: &'static str,
    device_model: &'static str,
    os_name: &'static str,
    os_version: &'static str,
    android_sdk: Option<u64>,
}

static LADDER: [PlayerClient; 2] = [
    PlayerClient {
        name: "ANDROID_VR",
        version: "1.65.10",
        device_make: "Oculus",
        device_model: "Quest 3",
        os_name: "Android",
        os_version: "12L",
        android_sdk: Some(32),
    },
    PlayerClient {
        name: "VISIONOS",
        version: "0.1",
        device_make: "Apple",
        device_model: "RealityDevice14,1",
        os_name: "visionOS",
        os_version: "1.0.21N305",
        android_sdk: None,
    },
];

impl PlayerClient {
    pub fn body(&self, video_id: &str) -> Value {
        let mut client = json!({
            "clientName": self.name,
            "clientVersion": self.version,
            "deviceMake": self.device_make,
            "deviceModel": self.device_model,
            "osName": self.os_name,
            "osVersion": self.os_version,
            "hl": "en",
            "gl": "US",
        });
        if let Some(sdk) = self.android_sdk {
            client["androidSdkVersion"] = json!(sdk);
        }
        json!({
            "videoId": video_id,
            "contentCheckOk": true,
            "racyCheckOk": true,
            "context": { "client": client, "user": {} },
        })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Verdict {
    Usable,
    Rejected,
    Unavailable,
}

#[async_trait]
pub trait Fetch: Sync {
    async fn get(&self, client: &PlayerClient) -> Result<(u16, Value), String>;
}

pub async fn walk(fetch: &dyn Fetch) -> Result<Value, String> {
    let mut fallback: Option<(u16, Value)> = None;
    for (rung, client) in LADDER.iter().enumerate() {
        let (status, value) = fetch.get(client).await?;
        match verdict(status, &value) {
            Verdict::Usable => {
                note(rung, client.name);
                return Ok(value);
            }
            Verdict::Unavailable => return settle(status, value),
            Verdict::Rejected => fallback = Some((status, value)),
        }
    }
    match fallback {
        Some((status, value)) => settle(status, value),
        None => Err("YouTube Music did not return an audio stream".to_string()),
    }
}

fn verdict(status: u16, body: &Value) -> Verdict {
    if status == 401 || status == 403 {
        return Verdict::Rejected;
    }
    if !(200..300).contains(&status) {
        return Verdict::Unavailable;
    }
    let state = body
        .pointer("/playabilityStatus/status")
        .and_then(Value::as_str)
        .unwrap_or("OK");
    if state != "OK" {
        if terminal(state, body) {
            return Verdict::Unavailable;
        }
        return Verdict::Rejected;
    }
    if usable_audio(body) {
        Verdict::Usable
    } else {
        Verdict::Rejected
    }
}

fn terminal(state: &str, body: &Value) -> bool {
    if state == "ERROR" {
        return true;
    }
    let reason = body
        .pointer("/playabilityStatus/reason")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    TERMINAL_REASONS
        .iter()
        .any(|marker| reason.contains(marker))
}

fn usable_audio(body: &Value) -> bool {
    body.pointer("/streamingData/adaptiveFormats")
        .and_then(Value::as_array)
        .is_some_and(|formats| formats.iter().any(unlocked_audio))
}

fn unlocked_audio(format: &Value) -> bool {
    let audio = format
        .get("mimeType")
        .and_then(Value::as_str)
        .is_some_and(|mime| mime.starts_with("audio/"));
    let url = format
        .get("url")
        .and_then(Value::as_str)
        .is_some_and(|url| url.starts_with("https://"));
    audio && url
}

fn settle(status: u16, value: Value) -> Result<Value, String> {
    if (200..300).contains(&status) {
        return Ok(value);
    }
    let message = value
        .pointer("/error/message")
        .and_then(Value::as_str)
        .unwrap_or("YouTube Music rejected the request");
    Err(format!("YouTube Music returned HTTP {status}: {message}"))
}

#[cfg(debug_assertions)]
fn note(rung: usize, client: &str) {
    eprintln!("[harbor::music] youtube player rung {rung} {client}");
}

#[cfg(not(debug_assertions))]
fn note(_rung: usize, _client: &str) {}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;
    use std::sync::Mutex;

    struct Stub {
        queue: Mutex<VecDeque<(u16, Value)>>,
        seen: Mutex<Vec<&'static str>>,
    }

    impl Stub {
        fn new(responses: Vec<(u16, Value)>) -> Self {
            Self {
                queue: Mutex::new(responses.into_iter().collect()),
                seen: Mutex::new(Vec::new()),
            }
        }

        fn seen(&self) -> Vec<&'static str> {
            self.seen.lock().expect("seen").clone()
        }
    }

    #[async_trait]
    impl Fetch for Stub {
        async fn get(&self, client: &PlayerClient) -> Result<(u16, Value), String> {
            self.seen.lock().expect("seen").push(client.name);
            let next = self.queue.lock().expect("queue").pop_front();
            next.ok_or_else(|| "the ladder asked for more rungs than it has".to_string())
        }
    }

    fn playable(itag: u64) -> Value {
        json!({"streamingData": {"adaptiveFormats": [{
            "itag": itag,
            "mimeType": "audio/webm; codecs=\"opus\"",
            "url": format!("https://rr2.googlevideo.com/videoplayback?itag={itag}"),
        }]}})
    }

    fn itag_of(value: &Value) -> Option<u64> {
        value
            .pointer("/streamingData/adaptiveFormats/0/itag")
            .and_then(Value::as_u64)
    }

    #[tokio::test]
    async fn the_first_rung_answers_and_the_ladder_stops_there() {
        let stub = Stub::new(vec![(200, playable(251))]);
        let value = walk(&stub).await.expect("stream");
        assert_eq!(itag_of(&value), Some(251));
        assert_eq!(stub.seen(), vec!["ANDROID_VR"]);
    }

    #[tokio::test]
    async fn a_forbidden_first_rung_hands_over_to_the_second() {
        let stub = Stub::new(vec![(403, Value::Null), (200, playable(140))]);
        let value = walk(&stub).await.expect("stream");
        assert_eq!(itag_of(&value), Some(140));
        assert_eq!(stub.seen(), vec!["ANDROID_VR", "VISIONOS"]);
    }

    #[tokio::test]
    async fn a_rung_carrying_no_adaptive_formats_hands_over_too() {
        let stub = Stub::new(vec![
            (
                200,
                json!({"streamingData": {"serverAbrStreamingUrl": "https://example.test"}}),
            ),
            (200, playable(251)),
        ]);
        let value = walk(&stub).await.expect("stream");
        assert_eq!(itag_of(&value), Some(251));
        assert_eq!(stub.seen(), vec!["ANDROID_VR", "VISIONOS"]);
    }

    #[tokio::test]
    async fn a_bot_challenge_hands_over_rather_than_failing_the_track() {
        let challenge = json!({"playabilityStatus": {
            "status": "LOGIN_REQUIRED",
            "reason": "Sign in to confirm you're not a bot"
        }});
        let stub = Stub::new(vec![(200, challenge), (200, playable(251))]);
        let value = walk(&stub).await.expect("stream");
        assert_eq!(itag_of(&value), Some(251));
        assert_eq!(stub.seen(), vec!["ANDROID_VR", "VISIONOS"]);
    }

    #[tokio::test]
    async fn both_rungs_forbidden_reports_the_last_rejection() {
        let denied = json!({"error": {"message": "The caller does not have permission"}});
        let stub = Stub::new(vec![(403, denied.clone()), (403, denied)]);
        let error = walk(&stub).await.expect_err("rejected");
        assert!(error.contains("HTTP 403"));
        assert!(error.contains("does not have permission"));
        assert_eq!(stub.seen(), vec!["ANDROID_VR", "VISIONOS"]);
    }

    #[tokio::test]
    async fn both_rungs_challenged_returns_the_last_body_for_the_reader_to_name() {
        let challenge = json!({"playabilityStatus": {
            "status": "UNPLAYABLE",
            "reason": "Sign in to confirm you're not a bot"
        }});
        let stub = Stub::new(vec![(200, challenge.clone()), (200, challenge)]);
        let value = walk(&stub).await.expect("body");
        assert_eq!(stub.seen(), vec!["ANDROID_VR", "VISIONOS"]);
        let error = super::super::player::stream_from_player(&value).expect_err("challenge");
        assert!(error.contains("rate limiting"));
    }

    #[tokio::test]
    async fn a_dead_track_stops_on_the_first_rung() {
        let dead = json!({"playabilityStatus": {
            "status": "ERROR",
            "reason": "Video unavailable"
        }});
        let stub = Stub::new(vec![(200, dead)]);
        let value = walk(&stub).await.expect("body");
        assert_eq!(stub.seen(), vec!["ANDROID_VR"]);
        let error = super::super::player::stream_from_player(&value).expect_err("dead");
        assert!(error.contains("Video unavailable"));
    }

    #[tokio::test]
    async fn a_scrambled_rung_hands_over_rather_than_failing_the_track() {
        let locked = json!({"streamingData": {"adaptiveFormats": [{
            "itag": 251,
            "mimeType": "audio/webm; codecs=\"opus\"",
            "signatureCipher": "s=abc&url=https%3A%2F%2Fexample.test",
        }]}});
        let stub = Stub::new(vec![(200, locked), (200, playable(251))]);
        let value = walk(&stub).await.expect("stream");
        assert_eq!(itag_of(&value), Some(251));
        assert_eq!(stub.seen(), vec!["ANDROID_VR", "VISIONOS"]);
    }

    #[tokio::test]
    async fn terminal_answers_stop_on_the_first_rung() {
        let private = json!({"playabilityStatus": {
            "status": "LOGIN_REQUIRED",
            "reason": "This is a private video. Please sign in to verify that you may see it."
        }});
        let stub = Stub::new(vec![(200, private)]);
        walk(&stub).await.expect("body");
        assert_eq!(stub.seen(), vec!["ANDROID_VR"]);

        let bad = json!({"error": {"message": "Request contains an invalid argument"}});
        let stub = Stub::new(vec![(400, bad)]);
        let error = walk(&stub).await.expect_err("bad request");
        assert!(error.contains("HTTP 400"));
        assert_eq!(stub.seen(), vec!["ANDROID_VR"]);
    }

    #[test]
    fn each_rung_describes_the_device_it_claims_to_be() {
        let vr = LADDER[0].body("abc");
        assert_eq!(vr["context"]["client"]["clientName"], "ANDROID_VR");
        assert_eq!(vr["context"]["client"]["androidSdkVersion"], 32);
        assert_eq!(vr["videoId"], "abc");
        let vision = LADDER[1].body("abc");
        assert_eq!(vision["context"]["client"]["clientName"], "VISIONOS");
        assert_eq!(vision["context"]["client"]["osName"], "visionOS");
        assert!(vision["context"]["client"]["androidSdkVersion"].is_null());
    }
}
