use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use kothok_edge_tts::{init_tls, list_voices, EdgeTts, Engine, TtsEvent};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
};
use tauri::ipc::Channel;
use tokio_util::sync::CancellationToken;

const MAX_CHAPTER_CHARS: usize = 500_000;
const MAX_CHUNK_BYTES: usize = 3_600;

fn jobs() -> &'static Mutex<HashMap<String, CancellationToken>> {
    static JOBS: OnceLock<Mutex<HashMap<String, CancellationToken>>> = OnceLock::new();
    JOBS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn valid_request_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 96
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EBookTtsProgress {
    completed: usize,
    total: usize,
    percent: u8,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EBookWordBoundary {
    offset_ms: f64,
    duration_ms: f64,
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EBookTtsResult {
    audio_base64: String,
    boundaries: Vec<EBookWordBoundary>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EBookTtsVoice {
    id: String,
    locale: String,
    gender: String,
    name: String,
}

#[tauri::command]
pub async fn ebook_tts_voices() -> Result<Vec<EBookTtsVoice>, String> {
    init_tls();
    let voices = list_voices()
        .await
        .map_err(|error| format!("Could not load Edge TTS voices: {error}"))?;
    Ok(voices
        .into_iter()
        .map(|voice| EBookTtsVoice {
            id: voice.short_name().to_owned(),
            locale: voice.locale().to_owned(),
            gender: voice.gender().to_owned(),
            name: voice.friendly_name().to_owned(),
        })
        .collect())
}

fn valid_voice(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 96
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn valid_locale(value: &str) -> bool {
    (2..=24).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphabetic() || byte == b'-')
}

fn chapter_chunks(text: &str) -> Vec<&str> {
    let mut chunks = Vec::new();
    let mut start = 0;
    while start < text.len() {
        let mut end = (start + MAX_CHUNK_BYTES).min(text.len());
        while end > start && !text.is_char_boundary(end) {
            end -= 1;
        }
        if end < text.len() {
            let window = &text[start..end];
            if let Some(split) = window
                .rmatch_indices(|character: char| {
                    character.is_whitespace() || matches!(character, '.' | '!' | '?' | '؟' | '؛')
                })
                .map(|(index, character)| index + character.len())
                .find(|index| *index >= MAX_CHUNK_BYTES / 2)
            {
                end = start + split;
            }
        }
        let chunk = text[start..end].trim();
        if !chunk.is_empty() {
            chunks.push(chunk);
        }
        start = end;
        while start < text.len() {
            let Some(character) = text[start..].chars().next() else {
                break;
            };
            if !character.is_whitespace() {
                break;
            }
            start += character.len_utf8();
        }
    }
    chunks
}

#[tauri::command]
pub async fn ebook_tts_synthesize(
    request_id: String,
    text: String,
    voice: String,
    locale: String,
    rate: Option<i16>,
    on_progress: Channel<EBookTtsProgress>,
) -> Result<EBookTtsResult, String> {
    if !valid_request_id(&request_id) {
        return Err("Invalid Edge TTS request identifier".into());
    }
    let text = text.trim();
    if text.is_empty() || text.chars().count() > MAX_CHAPTER_CHARS {
        return Err("Chapter text must contain between 1 and 500,000 characters".into());
    }
    if !valid_voice(&voice) {
        return Err("Invalid Edge TTS voice identifier".into());
    }
    if !valid_locale(&locale) {
        return Err("Invalid Edge TTS locale".into());
    }
    let rate = rate.unwrap_or(0).clamp(-50, 100);
    let rate = format!("{rate:+}%");
    let chunks = chapter_chunks(text);
    let total = chunks.len();
    let mut audio = Vec::new();
    let mut boundaries = Vec::new();
    let mut timeline_ticks = 0_u64;

    let cancellation = CancellationToken::new();
    if let Some(previous) = jobs()
        .lock()
        .map_err(|_| "Edge TTS job registry failed")?
        .insert(request_id.clone(), cancellation.clone())
    {
        previous.cancel();
    }
    init_tls();
    let outcome = async {
        for (index, chunk) in chunks.into_iter().enumerate() {
            let events = tokio::select! {
                _ = cancellation.cancelled() => return Err("Edge TTS generation cancelled".into()),
                result = EdgeTts.synthesize(chunk, &voice, &rate, &locale) =>
                    result.map_err(|error| format!("Edge TTS failed: {error}"))?,
            };
            let mut chunk_end = 0_u64;
            for event in events {
                match event {
                    TtsEvent::Audio(bytes) => audio.extend_from_slice(&bytes),
                    TtsEvent::WordBoundary {
                        offset,
                        duration,
                        text,
                    } => {
                        let end = offset.saturating_add(duration);
                        chunk_end = chunk_end.max(end);
                        boundaries.push(EBookWordBoundary {
                            offset_ms: (timeline_ticks + offset) as f64 / 10_000.0,
                            duration_ms: duration as f64 / 10_000.0,
                            text,
                        });
                    }
                    TtsEvent::TurnEnd => {}
                }
            }
            timeline_ticks = timeline_ticks.saturating_add(chunk_end);
            let completed = index + 1;
            let _ = on_progress.send(EBookTtsProgress {
                completed,
                total,
                percent: ((completed * 100) / total.max(1)) as u8,
            });
        }
        if audio.is_empty() {
            return Err("Edge TTS returned no audio".into());
        }
        Ok(EBookTtsResult {
            audio_base64: BASE64.encode(audio),
            boundaries,
        })
    }
    .await;
    jobs()
        .lock()
        .map_err(|_| "Edge TTS job registry failed")?
        .remove(&request_id);
    outcome
}

#[tauri::command]
pub fn ebook_tts_cancel(request_id: String) -> Result<(), String> {
    if !valid_request_id(&request_id) {
        return Err("Invalid Edge TTS request identifier".into());
    }
    if let Some(cancellation) = jobs()
        .lock()
        .map_err(|_| "Edge TTS job registry failed")?
        .remove(&request_id)
    {
        cancellation.cancel();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunks_preserve_unicode_text_and_limit_bytes() {
        let text = format!(
            "{} {}",
            "مرحبا بالعالم. ".repeat(300),
            "hello world ".repeat(300)
        );
        let chunks = chapter_chunks(&text);
        assert!(chunks.len() > 1);
        assert!(chunks.iter().all(|chunk| chunk.len() <= MAX_CHUNK_BYTES));
        assert_eq!(
            chunks.join(" ").split_whitespace().collect::<Vec<_>>(),
            text.split_whitespace().collect::<Vec<_>>()
        );
    }

    #[test]
    fn validates_voice_and_locale_values() {
        assert!(valid_voice("ar-SA-HamedNeural"));
        assert!(!valid_voice("../../voice"));
        assert!(valid_locale("ar-SA"));
        assert!(!valid_locale("ar-SA; rm"));
    }

    #[test]
    fn cancellation_stops_registered_request() {
        assert!(!valid_request_id("../../request"));
        let id = "reader-request-1".to_string();
        let cancellation = CancellationToken::new();
        jobs()
            .lock()
            .unwrap()
            .insert(id.clone(), cancellation.clone());
        ebook_tts_cancel(id).unwrap();
        assert!(cancellation.is_cancelled());
    }

    #[tokio::test]
    #[ignore = "requires the live Microsoft Edge Read Aloud service"]
    async fn synthesizes_live_edge_audio() {
        init_tls();
        let events = EdgeTts
            .synthesize(
                "Harbor Edge text to speech test.",
                "en-US-AvaNeural",
                "+0%",
                "en-US",
            )
            .await
            .expect("live Edge synthesis should succeed");
        assert!(events
            .iter()
            .any(|event| matches!(event, TtsEvent::Audio(bytes) if !bytes.is_empty())));
        assert!(events
            .iter()
            .any(|event| matches!(event, TtsEvent::WordBoundary { .. })));
    }

    #[tokio::test]
    #[ignore = "requires the live Microsoft Edge Read Aloud service"]
    async fn arabic_voice_ids_produce_distinct_audio() {
        init_tls();
        let mut results = Vec::new();
        for (voice, locale) in [
            ("ar-SA-HamedNeural", "ar-SA"),
            ("ar-EG-ShakirNeural", "ar-EG"),
            ("ar-AE-HamdanNeural", "ar-AE"),
        ] {
            let events = EdgeTts
                .synthesize("مرحباً، هذا اختبار لصوت القراءة.", voice, "+0%", locale)
                .await
                .expect("live Arabic voice synthesis should succeed");
            let audio = events
                .into_iter()
                .filter_map(|event| match event {
                    TtsEvent::Audio(bytes) => Some(bytes),
                    _ => None,
                })
                .flatten()
                .collect::<Vec<_>>();
            assert!(!audio.is_empty(), "{voice} returned no audio");
            println!("{voice}: {} audio bytes", audio.len());
            results.push((voice, audio));
        }
        assert_ne!(results[0].1, results[1].1, "Hamed and Shakir returned identical audio");
        assert_ne!(results[0].1, results[2].1, "Hamed and Hamdan returned identical audio");
        assert_ne!(results[1].1, results[2].1, "Shakir and Hamdan returned identical audio");
    }
}
