use crate::song_id::SongResult;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde_json::{json, Value};
use std::time::Duration;

const MODELS: [&str; 3] = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
];

const RETIRED: [&str; 8] = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-pro",
    "gemini-3-pro-preview",
];

const PROMPT: &str = "You identify music like Shazam. The audio is a short capture from a movie or show, so a song may sit under dialogue, effects or crowd noise. Ignore speech and noise and name the music. Give your single best guess for artist and title even if the audio is imperfect. Use an empty string for any field you cannot name, and empty strings for both artist and title only when there is no music at all. Reply with only a JSON object using the keys artist, title and album. No prose, no code fence.";

struct GErr {
    message: String,
    try_next: bool,
    bad_request: bool,
}

impl GErr {
    fn hard(message: String) -> Self {
        GErr {
            message,
            try_next: false,
            bad_request: false,
        }
    }
}

pub fn model_chain(requested: Option<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    if let Some(m) = requested
        .map(|m| m.trim().to_string())
        .filter(|m| !m.is_empty())
    {
        if !RETIRED.contains(&m.as_str()) {
            out.push(m);
        }
    }
    for m in MODELS {
        if !out.iter().any(|x| x == m) {
            out.push(m.to_string());
        }
    }
    out
}

pub async fn recognize(
    wav: Vec<u8>,
    api_key: String,
    model: Option<String>,
) -> Result<Option<SongResult>, String> {
    let audio = B64.encode(&wav);
    let mut last = String::new();
    for m in model_chain(model) {
        match attempt(&audio, &api_key, &m, true).await {
            Ok(v) => return Ok(v),
            Err(e) if e.bad_request => match attempt(&audio, &api_key, &m, false).await {
                Ok(v) => return Ok(v),
                Err(e2) if e2.try_next => last = e2.message,
                Err(e2) => return Err(e2.message),
            },
            Err(e) if e.try_next => last = e.message,
            Err(e) => return Err(e.message),
        }
    }
    Err(if last.is_empty() {
        "Gemini has no usable model for this key".to_string()
    } else {
        last
    })
}

fn build_body(audio: &str, structured: bool) -> Value {
    let mut cfg = json!({ "temperature": 0.0 });
    if structured {
        cfg["responseMimeType"] = json!("application/json");
        cfg["responseSchema"] = json!({
            "type": "OBJECT",
            "properties": {
                "artist": { "type": "STRING" },
                "title": { "type": "STRING" },
                "album": { "type": "STRING" }
            },
            "required": ["artist", "title"]
        });
    }
    json!({
        "contents": [{
            "role": "user",
            "parts": [
                { "text": PROMPT },
                { "inlineData": { "mimeType": "audio/wav", "data": audio } }
            ]
        }],
        "generationConfig": cfg
    })
}

async fn attempt(
    audio: &str,
    api_key: &str,
    model: &str,
    structured: bool,
) -> Result<Option<SongResult>, GErr> {
    let body = build_body(audio, structured);

    let url =
        format!("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent");
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|e| GErr::hard(format!("Could not start the Gemini client: {e}")))?;
    let resp = client
        .post(&url)
        .header("x-goog-api-key", api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| GErr::hard(format!("Could not reach Gemini: {e}")))?;

    let status = resp.status();
    let raw = resp
        .text()
        .await
        .map_err(|e| GErr::hard(format!("Could not read the Gemini reply: {e}")))?;
    let json: Value = serde_json::from_str(&raw).unwrap_or(Value::Null);

    if !status.is_success() {
        let msg = json["error"]["message"]
            .as_str()
            .unwrap_or_else(|| raw.trim())
            .to_string();
        return Err(classify(status.as_u16(), model, msg));
    }

    if let Some(reason) = json["promptFeedback"]["blockReason"].as_str() {
        return Err(GErr::hard(format!("Gemini blocked the clip ({reason})")));
    }

    let text = collect_text(&json);
    let body = text.trim();
    let Some(parsed) = extract_json(body) else {
        let reason = json["candidates"][0]["finishReason"].as_str().unwrap_or("");
        if body.is_empty() {
            if !reason.is_empty() && reason != "STOP" {
                return Err(GErr {
                    message: format!(
                        "Gemini stopped without an answer ({reason}). Try a different scene."
                    ),
                    try_next: true,
                    bad_request: false,
                });
            }
            return Ok(None);
        }
        let mut snip: String = body.chars().take(180).collect();
        if body.chars().count() > 180 {
            snip.push_str("...");
        }
        return Err(GErr {
            message: format!("Gemini replied without JSON: {snip}"),
            try_next: true,
            bad_request: false,
        });
    };
    let title = field(&parsed, "title");
    let artist = field(&parsed, "artist");
    let album = field(&parsed, "album");
    if title.is_empty() && artist.is_empty() {
        return Ok(None);
    }
    Ok(Some(SongResult {
        title,
        artist,
        album,
        artwork: String::new(),
        link: String::new(),
    }))
}

fn classify(status: u16, model: &str, msg: String) -> GErr {
    let low = msg.to_lowercase();
    match status {
        400 if low.contains("api key not valid") || low.contains("api_key_invalid") => GErr::hard(
            "Gemini rejected the API key. Paste a fresh key from aistudio.google.com into Settings."
                .to_string(),
        ),
        400 => GErr { message: format!("Gemini rejected the request: {msg}"), try_next: false, bad_request: true },
        401 | 403 => GErr::hard(format!("Gemini denied this key: {msg}")),
        404 => GErr { message: format!("Gemini model {model} is unavailable: {msg}"), try_next: true, bad_request: false },
        429 => GErr {
            message: format!("Gemini quota or rate limit reached on {model}. Wait a moment and try again."),
            try_next: true,
            bad_request: false,
        },
        500..=599 => GErr {
            message: format!("Gemini server error {status} on {model}. Try again."),
            try_next: true,
            bad_request: false,
        },
        _ => GErr::hard(format!("Gemini error {status}: {msg}")),
    }
}

fn collect_text(json: &Value) -> String {
    let mut out = String::new();
    if let Some(parts) = json["candidates"][0]["content"]["parts"].as_array() {
        for p in parts {
            if p["thought"].as_bool().unwrap_or(false) {
                continue;
            }
            if let Some(t) = p["text"].as_str() {
                out.push_str(t);
            }
        }
    }
    out
}

fn extract_json(text: &str) -> Option<Value> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        if v.is_object() {
            return Some(v);
        }
    }
    let start = trimmed.find('{')?;
    let mut depth = 0usize;
    let mut in_str = false;
    let mut escaped = false;
    for (i, ch) in trimmed[start..].char_indices() {
        if in_str {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_str = false;
            }
            continue;
        }
        match ch {
            '"' => in_str = true,
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return serde_json::from_str(&trimmed[start..start + i + ch.len_utf8()]).ok();
                }
            }
            _ => {}
        }
    }
    None
}

fn field(v: &Value, key: &str) -> String {
    let s = v[key].as_str().unwrap_or("").trim();
    match s.to_lowercase().as_str() {
        "unknown" | "n/a" | "na" | "none" | "null" | "unidentified" => String::new(),
        _ => s.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parts(v: Value) -> Value {
        json!({ "candidates": [{ "content": { "parts": v } }] })
    }

    #[test]
    fn wire_format_matches_documented_contract() {
        let b = build_body("QUJD", true);
        assert_eq!(b["contents"][0]["role"], "user");
        assert_eq!(
            b["contents"][0]["parts"][1]["inlineData"]["mimeType"],
            "audio/wav"
        );
        assert_eq!(b["contents"][0]["parts"][1]["inlineData"]["data"], "QUJD");
        assert!(b["contents"][0]["parts"][0]["text"]
            .as_str()
            .unwrap()
            .contains("JSON"));
        assert_eq!(
            b["generationConfig"]["responseMimeType"],
            "application/json"
        );
        assert_eq!(b["generationConfig"]["responseSchema"]["type"], "OBJECT");
        assert_eq!(
            b["generationConfig"]["responseSchema"]["properties"]["title"]["type"],
            "STRING"
        );
        assert_eq!(
            b["generationConfig"]["responseSchema"]["required"][0],
            "artist"
        );
        assert!(b["contents"][0]["parts"][1]["inline_data"].is_null());
        assert!(b["contents"][0]["parts"][1]["inlineData"]["mime_type"].is_null());
    }

    #[test]
    fn unstructured_body_drops_schema_but_keeps_audio() {
        let b = build_body("QUJD", false);
        assert!(b["generationConfig"]["responseSchema"].is_null());
        assert!(b["generationConfig"]["responseMimeType"].is_null());
        assert_eq!(b["contents"][0]["parts"][1]["inlineData"]["data"], "QUJD");
    }

    #[test]
    fn dead_models_are_never_requested() {
        let chain = model_chain(Some("gemini-2.0-flash".into()));
        assert!(!chain.iter().any(|m| RETIRED.contains(&m.as_str())));
        assert_eq!(chain[0], "gemini-3.6-flash");
        for dead in RETIRED {
            assert!(!model_chain(Some(dead.to_string())).contains(&dead.to_string()));
        }
    }

    #[test]
    fn model_chain_dedupes_and_honours_a_live_custom_model() {
        assert_eq!(
            model_chain(Some("gemini-3.6-flash".into())).len(),
            MODELS.len()
        );
        let c = model_chain(Some("  my-model  ".into()));
        assert_eq!(c[0], "my-model");
        assert_eq!(c.len(), MODELS.len() + 1);
        assert_eq!(model_chain(Some("   ".into()))[0], "gemini-3.6-flash");
        assert_eq!(model_chain(None)[0], "gemini-3.6-flash");
    }

    #[test]
    fn collect_text_joins_parts_and_skips_thoughts() {
        let v = parts(json!([
            { "text": "ignore me", "thought": true },
            { "text": "{\"artist\":\"A\"," },
            { "text": "\"title\":\"B\"}" }
        ]));
        assert_eq!(collect_text(&v), "{\"artist\":\"A\",\"title\":\"B\"}");
    }

    #[test]
    fn collect_text_survives_missing_shapes() {
        assert_eq!(collect_text(&json!({})), "");
        assert_eq!(collect_text(&json!({ "candidates": [] })), "");
        assert_eq!(
            collect_text(&json!({ "candidates": [{ "finishReason": "SAFETY" }] })),
            ""
        );
        assert_eq!(collect_text(&parts(json!("not-an-array"))), "");
    }

    #[test]
    fn extract_json_handles_every_realistic_reply_shape() {
        let want = json!({ "artist": "Debussy", "title": "Clair de Lune" });
        let plain = "{\"artist\":\"Debussy\",\"title\":\"Clair de Lune\"}";
        assert_eq!(extract_json(plain).unwrap(), want);
        assert_eq!(
            extract_json(&format!("```json\n{plain}\n```")).unwrap(),
            want
        );
        assert_eq!(
            extract_json(&format!("Sure! {plain} Hope that helps.")).unwrap(),
            want
        );
        assert_eq!(extract_json(&format!("  \n{plain}\n  ")).unwrap(), want);
    }

    #[test]
    fn extract_json_survives_braces_inside_strings_and_nesting() {
        let tricky = r#"{"artist":"AC {DC}","title":"a \"quoted\" } brace","album":{"n":1}}"#;
        let v = extract_json(tricky).unwrap();
        assert_eq!(v["artist"], "AC {DC}");
        assert_eq!(v["title"], "a \"quoted\" } brace");
    }

    #[test]
    fn extract_json_returns_none_instead_of_panicking() {
        assert!(extract_json("").is_none());
        assert!(extract_json("   ").is_none());
        assert!(extract_json("no json at all").is_none());
        assert!(extract_json("{ unterminated").is_none());
        assert!(extract_json("[1,2,3]").is_none());
        assert!(extract_json("\"just a string\"").is_none());
        assert!(extract_json("héllo { wörld").is_none());
        assert!(extract_json("日本語のテキスト{壊れた").is_none());
    }

    #[test]
    fn field_normalises_placeholder_values() {
        let v = json!({ "a": "Unknown", "b": "  N/A ", "c": "  Real Name  ", "d": 7, "e": "none" });
        assert_eq!(field(&v, "a"), "");
        assert_eq!(field(&v, "b"), "");
        assert_eq!(field(&v, "c"), "Real Name");
        assert_eq!(field(&v, "d"), "");
        assert_eq!(field(&v, "e"), "");
        assert_eq!(field(&v, "missing"), "");
    }

    #[test]
    fn classify_routes_every_status_correctly() {
        assert!(classify(404, "m", "not found".into()).try_next);
        assert!(classify(400, "m", "bad schema".into()).bad_request);
        let key = classify(
            400,
            "m",
            "API key not valid. Please pass a valid API key.".into(),
        );
        assert!(!key.bad_request && !key.try_next);
        assert!(key.message.contains("API key"));
        for s in [401u16, 403] {
            let e = classify(s, "m", "x".into());
            assert!(
                !e.try_next && !e.bad_request,
                "status {s} must be a hard stop"
            );
        }
        for s in [429u16, 500, 503] {
            assert!(
                classify(s, "m", "x".into()).try_next,
                "status {s} must advance the chain"
            );
        }
    }

    #[test]
    fn payload_stays_far_under_the_20mb_inline_cap() {
        let max_pcm = 44100usize * 15 * 2 * 2;
        let b64 = (max_pcm + 44).div_ceil(3) * 4;
        assert!(
            b64 < 20 * 1024 * 1024,
            "worst case {b64} bytes exceeds the inline cap"
        );
    }
}
