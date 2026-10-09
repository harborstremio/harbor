use super::super::super::MusicStream;
use serde_json::Value;

const PREFERRED_ITAGS: [u64; 2] = [251, 140];

pub fn stream_from_player(response: &Value) -> Result<MusicStream, String> {
    playable(response)?;
    let Some(formats) = response
        .pointer("/streamingData/adaptiveFormats")
        .and_then(Value::as_array)
    else {
        if response
            .pointer("/streamingData/serverAbrStreamingUrl")
            .is_some()
        {
            return Err(
                "YouTube Music offered only an adaptive stream Harbor cannot read yet".to_string(),
            );
        }
        return Err("YouTube Music did not return an audio stream".to_string());
    };
    let mut scrambled = false;
    for itag in PREFERRED_ITAGS {
        for format in formats
            .iter()
            .filter(|format| format.get("itag").and_then(Value::as_u64) == Some(itag))
        {
            let url = format
                .get("url")
                .and_then(Value::as_str)
                .filter(|url| url.starts_with("https://"));
            let Some(url) = url else {
                scrambled |= is_scrambled(format);
                continue;
            };
            return Ok(MusicStream {
                http_headers: Default::default(),
                url: url.to_string(),
                mime_type: mime_of(format),
                bitrate: format.get("bitrate").and_then(Value::as_u64).unwrap_or(0),
            });
        }
    }
    if scrambled || formats.iter().any(is_scrambled) {
        return Err(
            "YouTube Music returned a scrambled stream that Harbor cannot unlock".to_string(),
        );
    }
    Err("YouTube Music did not return a supported audio stream".to_string())
}

fn playable(response: &Value) -> Result<(), String> {
    let status = response
        .pointer("/playabilityStatus/status")
        .and_then(Value::as_str)
        .unwrap_or("OK");
    if status == "OK" {
        return Ok(());
    }
    let reason = response
        .pointer("/playabilityStatus/reason")
        .and_then(Value::as_str)
        .unwrap_or(status);
    if reason.contains("not a bot") || status == "LOGIN_REQUIRED" {
        return Err(
            "YouTube Music is rate limiting Harbor, try again in a few minutes".to_string(),
        );
    }
    Err(format!("YouTube Music will not play this track: {reason}"))
}

fn is_scrambled(format: &Value) -> bool {
    format.get("url").is_none()
        && (format.get("signatureCipher").is_some() || format.get("cipher").is_some())
}

fn mime_of(format: &Value) -> String {
    format
        .get("mimeType")
        .and_then(Value::as_str)
        .and_then(|mime| mime.split(';').next())
        .map(str::trim)
        .filter(|mime| mime.starts_with("audio/"))
        .unwrap_or("audio/webm")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn format(itag: u64, mime: &str, bitrate: u64) -> Value {
        json!({
            "itag": itag,
            "url": format!("https://rr2.googlevideo.com/videoplayback?itag={itag}"),
            "mimeType": mime,
            "bitrate": bitrate,
        })
    }

    #[test]
    fn opus_wins_over_aac_when_both_are_offered() {
        let response = json!({"streamingData": {"adaptiveFormats": [
            format(140, "audio/mp4; codecs=\"mp4a.40.2\"", 129_000),
            format(251, "audio/webm; codecs=\"opus\"", 155_407),
        ]}});
        let stream = stream_from_player(&response).expect("stream");
        assert!(stream.url.ends_with("itag=251"));
        assert_eq!(stream.mime_type, "audio/webm");
        assert_eq!(stream.bitrate, 155_407);
    }

    #[test]
    fn aac_is_used_when_opus_is_missing() {
        let response = json!({"streamingData": {"adaptiveFormats": [
            format(140, "audio/mp4; codecs=\"mp4a.40.2\"", 129_000),
            format(137, "video/mp4", 4_000_000),
        ]}});
        let stream = stream_from_player(&response).expect("stream");
        assert_eq!(stream.mime_type, "audio/mp4");
        assert_eq!(stream.bitrate, 129_000);
    }

    #[test]
    fn scrambled_formats_report_rather_than_hand_back_a_broken_url() {
        let response = json!({"streamingData": {"adaptiveFormats": [
            {"itag": 251, "signatureCipher": "s=abc&url=https%3A%2F%2Fexample.test"}
        ]}});
        let error = stream_from_player(&response).expect_err("scrambled");
        assert!(error.contains("scrambled"));
    }

    #[test]
    fn adaptive_only_responses_are_named_for_what_they_are() {
        let response = json!({"streamingData": {"serverAbrStreamingUrl": "https://example.test"}});
        let error = stream_from_player(&response).expect_err("adaptive only");
        assert!(error.contains("adaptive stream"));
    }

    #[test]
    fn bot_challenges_read_as_rate_limiting() {
        let response = json!({"playabilityStatus": {
            "status": "LOGIN_REQUIRED",
            "reason": "Sign in to confirm you're not a bot"
        }});
        let error = stream_from_player(&response).expect_err("challenge");
        assert!(error.contains("rate limiting"));

        let dead = json!({"playabilityStatus": {
            "status": "UNPLAYABLE",
            "reason": "This video is not available"
        }});
        let error = stream_from_player(&dead).expect_err("unplayable");
        assert!(error.contains("This video is not available"));
    }
}
