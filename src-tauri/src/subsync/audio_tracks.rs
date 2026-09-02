use std::collections::HashMap;
use std::time::Duration;
use tokio::process::Command;

use crate::transcode::locate_ffprobe;

#[path = "url_guard.rs"]
mod url_guard;

const PROBE_TIMEOUT_SECS: u64 = 12;

const LANG_ALIAS: &[(&str, &str)] = &[
    ("jpn", "ja"),
    ("eng", "en"),
    ("spa", "es"),
    ("por", "pt"),
    ("rus", "ru"),
    ("ita", "it"),
    ("kor", "ko"),
    ("ara", "ar"),
    ("hin", "hi"),
    ("tur", "tr"),
    ("pol", "pl"),
    ("swe", "sv"),
    ("dan", "da"),
    ("fin", "fi"),
    ("nor", "no"),
    ("nob", "no"),
    ("heb", "he"),
    ("tha", "th"),
    ("vie", "vi"),
    ("ind", "id"),
    ("ukr", "uk"),
    ("nld", "nl"),
    ("dut", "nl"),
    ("deu", "de"),
    ("ger", "de"),
    ("fra", "fr"),
    ("fre", "fr"),
    ("ces", "cs"),
    ("cze", "cs"),
    ("ell", "el"),
    ("gre", "el"),
    ("isl", "is"),
    ("ice", "is"),
    ("ron", "ro"),
    ("rum", "ro"),
    ("slk", "sk"),
    ("slo", "sk"),
    ("zho", "zh"),
    ("chi", "zh"),
    ("fas", "fa"),
    ("per", "fa"),
    ("sqi", "sq"),
    ("alb", "sq"),
    ("hye", "hy"),
    ("arm", "hy"),
    ("eus", "eu"),
    ("baq", "eu"),
    ("mya", "my"),
    ("bur", "my"),
    ("kat", "ka"),
    ("geo", "ka"),
    ("mkd", "mk"),
    ("mac", "mk"),
    ("mri", "mi"),
    ("mao", "mi"),
    ("msa", "ms"),
    ("may", "ms"),
    ("bod", "bo"),
    ("tib", "bo"),
    ("cym", "cy"),
    ("wel", "cy"),
];

pub fn norm_lang(code: &str) -> Option<String> {
    let lowered = code.trim().to_lowercase();
    let base = lowered.split(['-', '_']).next().unwrap_or("");
    if base.is_empty() || base == "und" || base == "mul" || base == "zxx" || base == "mis" {
        return None;
    }
    if base.len() == 2 {
        return Some(base.to_string());
    }
    for (k, v) in LANG_ALIAS {
        if *k == base {
            return Some((*v).to_string());
        }
    }
    Some(base.to_string())
}

#[derive(serde::Deserialize)]
struct ProbeRoot {
    #[serde(default)]
    streams: Vec<ProbeStream>,
}

#[derive(serde::Deserialize)]
struct ProbeStream {
    #[serde(default)]
    index: u32,
    #[serde(default)]
    codec_name: String,
    #[serde(default)]
    channels: u32,
    #[serde(default)]
    tags: ProbeTags,
    #[serde(default)]
    disposition: ProbeDisp,
}

#[derive(serde::Deserialize, Default)]
struct ProbeTags {
    #[serde(default)]
    language: Option<String>,
    #[serde(default)]
    title: Option<String>,
}

#[derive(serde::Deserialize, Default)]
struct ProbeDisp {
    #[serde(default)]
    default: u8,
    #[serde(default)]
    dub: u8,
    #[serde(default)]
    original: u8,
    #[serde(default)]
    comment: u8,
    #[serde(default)]
    visual_impaired: u8,
    #[serde(default)]
    karaoke: u8,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStream {
    pub a_index: u32,
    pub ff_index: u32,
    pub codec: String,
    pub channels: u32,
    pub lang: Option<String>,
    pub title: Option<String>,
    pub is_default: bool,
    pub is_dub: bool,
    pub is_original: bool,
    pub is_commentary: bool,
    pub is_descriptive: bool,
}

fn title_flags(title: &Option<String>) -> (bool, bool) {
    let t = title.as_deref().unwrap_or("").to_lowercase();
    let commentary = t.contains("comment") || t.contains("director");
    let descriptive =
        t.contains("descri") || t.contains("visual impair") || t == "ad" || t.ends_with(" ad");
    (commentary, descriptive)
}

fn build_streams(root: ProbeRoot) -> Vec<AudioStream> {
    root.streams
        .into_iter()
        .enumerate()
        .map(|(i, s)| {
            let (tc, td) = title_flags(&s.tags.title);
            AudioStream {
                a_index: i as u32,
                ff_index: s.index,
                codec: s.codec_name,
                channels: s.channels,
                lang: s.tags.language.as_deref().and_then(norm_lang),
                title: s.tags.title,
                is_default: s.disposition.default == 1,
                is_dub: s.disposition.dub == 1,
                is_original: s.disposition.original == 1,
                is_commentary: s.disposition.comment == 1 || s.disposition.karaoke == 1 || tc,
                is_descriptive: s.disposition.visual_impaired == 1 || td,
            }
        })
        .collect()
}

pub async fn probe_audio_streams(
    url: &str,
    headers: &HashMap<String, String>,
) -> Result<Vec<AudioStream>, String> {
    let ffprobe = locate_ffprobe().ok_or("ffprobe not found")?;
    let mut cmd = Command::new(&ffprobe);
    cmd.arg("-v").arg("error");
    cmd.arg("-user_agent")
        .arg(url_guard::user_agent(headers).unwrap_or_else(|| "Harbor".into()));
    let blob = url_guard::safe_header_blob(headers);
    if !blob.is_empty() {
        cmd.arg("-headers").arg(blob);
    }
    cmd.arg("-analyzeduration")
        .arg("5M")
        .arg("-probesize")
        .arg("5M")
        .arg("-select_streams")
        .arg("a")
        .arg("-show_entries")
        .arg("stream=index,codec_name,channels:stream_tags=language,title:stream_disposition=default,dub,original,comment,visual_impaired,karaoke")
        .arg("-of")
        .arg("json")
        .arg("-i")
        .arg(url);
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);

    let fut = async { cmd.output().await.ok() };
    let out = match tokio::time::timeout(Duration::from_secs(PROBE_TIMEOUT_SECS), fut).await {
        Ok(Some(o)) => o,
        _ => return Err("ffprobe failed or timed out".into()),
    };
    let root: ProbeRoot =
        serde_json::from_slice(&out.stdout).map_err(|e| format!("parse ffprobe json: {}", e))?;
    Ok(build_streams(root))
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackSelection {
    pub a_index: u32,
    pub map_spec: String,
    pub role: String,
    pub audio_lang: Option<String>,
    pub sub_lang: String,
    pub language_match: bool,
    pub mismatch: String,
    pub asr_strategy: String,
    pub confidence: f32,
    pub stream_count: u32,
}

fn score(s: &AudioStream, sub: &Option<String>, any_dub: bool) -> i32 {
    let lang_match = matches!((&s.lang, sub), (Some(a), Some(b)) if a == b);
    let excluded = s.is_commentary || s.is_descriptive;
    (if excluded { -1000 } else { 0 })
        + lang_match as i32 * 500
        + s.is_original as i32 * 200
        + (any_dub && !s.is_dub) as i32 * 120
        + s.is_default as i32 * 40
        + s.lang.is_some() as i32 * 10
        + s.channels.min(8) as i32
}

pub fn select(streams: &[AudioStream], sub_lang: &str) -> Option<TrackSelection> {
    if streams.is_empty() {
        return None;
    }
    let sub = norm_lang(sub_lang);
    let any_dub = streams.iter().any(|s| s.is_dub);
    let mut best = 0usize;
    let mut best_key = (i32::MIN, i32::MIN, i32::MIN);
    for (i, s) in streams.iter().enumerate() {
        let key = (score(s, &sub, any_dub), s.channels as i32, -(i as i32));
        if key > best_key {
            best_key = key;
            best = i;
        }
    }
    let w = &streams[best];
    let language_match = matches!((&w.lang, &sub), (Some(a), Some(b)) if a == b);

    let mismatch = if language_match {
        "none"
    } else if w.lang.is_some() && sub.is_some() {
        "translated-sub"
    } else {
        "unknown-language"
    };

    let role = if language_match {
        "sub-language-match"
    } else if streams.len() == 1 {
        "single-track"
    } else if w.is_original || (any_dub && !w.is_dub) {
        "original-for-translated-sub"
    } else if w.is_default {
        "default-fallback"
    } else {
        "first-fallback"
    };

    let asr_strategy = if language_match {
        "direct"
    } else if mismatch == "unknown-language" {
        "autodetect"
    } else if sub.as_deref() == Some("en") {
        "translate-to-en"
    } else {
        "suppressed"
    };

    let confidence = if language_match {
        0.95
    } else if role == "original-for-translated-sub" {
        0.70
    } else if role == "single-track" {
        0.60
    } else if role == "default-fallback" {
        0.50
    } else {
        0.35
    };

    Some(TrackSelection {
        a_index: w.a_index,
        map_spec: format!("0:a:{}", w.a_index),
        role: role.into(),
        audio_lang: w.lang.clone(),
        sub_lang: sub_lang.to_string(),
        language_match,
        mismatch: mismatch.into(),
        asr_strategy: asr_strategy.into(),
        confidence,
        stream_count: streams.len() as u32,
    })
}

#[tauri::command]
pub async fn audio_probe_tracks(
    url: String,
    headers: Option<HashMap<String, String>>,
    sub_lang: String,
) -> Result<Option<TrackSelection>, String> {
    url_guard::validate_media_url(&url, true)?;
    let hdrs = headers.unwrap_or_default();
    let streams = probe_audio_streams(&url, &hdrs).await?;
    Ok(select(&streams, &sub_lang))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn st(a: u32, lang: Option<&str>, def: bool, dub: bool, orig: bool, ch: u32) -> AudioStream {
        AudioStream {
            a_index: a,
            ff_index: a,
            codec: "aac".into(),
            channels: ch,
            lang: lang.and_then(norm_lang),
            title: None,
            is_default: def,
            is_dub: dub,
            is_original: orig,
            is_commentary: false,
            is_descriptive: false,
        }
    }

    #[test]
    fn norm_folds_bibliographic_and_region() {
        assert_eq!(norm_lang("jpn").as_deref(), Some("ja"));
        assert_eq!(norm_lang("ger").as_deref(), Some("de"));
        assert_eq!(norm_lang("fre").as_deref(), Some("fr"));
        assert_eq!(norm_lang("pt-BR").as_deref(), Some("pt"));
        assert_eq!(norm_lang("EN").as_deref(), Some("en"));
        assert_eq!(norm_lang("und"), None);
        assert_eq!(norm_lang("zxx"), None);
    }

    #[test]
    fn picks_sub_language_over_default() {
        let s = vec![
            st(0, Some("jpn"), true, false, true, 6),
            st(1, Some("eng"), false, true, false, 6),
        ];
        let sel = select(&s, "en").unwrap();
        assert_eq!(sel.a_index, 1);
        assert_eq!(sel.map_spec, "0:a:1");
        assert!(sel.language_match);
        assert_eq!(sel.mismatch, "none");
        assert_eq!(sel.asr_strategy, "direct");
    }

    #[test]
    fn translated_english_sub_picks_original_and_translates() {
        let s = vec![
            st(0, Some("jpn"), true, false, true, 6),
            st(1, Some("spa"), false, true, false, 6),
            st(2, Some("fre"), false, true, false, 2),
        ];
        let sel = select(&s, "en").unwrap();
        assert_eq!(sel.a_index, 0);
        assert_eq!(sel.role, "original-for-translated-sub");
        assert_eq!(sel.mismatch, "translated-sub");
        assert_eq!(sel.asr_strategy, "translate-to-en");
    }

    #[test]
    fn translated_nonenglish_sub_suppresses_asr() {
        let s = vec![
            st(0, Some("jpn"), true, false, true, 6),
            st(1, Some("eng"), false, true, false, 6),
        ];
        let sel = select(&s, "es").unwrap();
        assert_eq!(sel.a_index, 0);
        assert_eq!(sel.mismatch, "translated-sub");
        assert_eq!(sel.asr_strategy, "suppressed");
    }

    #[test]
    fn commentary_track_is_avoided() {
        let mut commentary = st(0, Some("eng"), false, false, false, 6);
        commentary.is_commentary = true;
        let main = st(1, Some("eng"), true, false, false, 2);
        let sel = select(&[commentary, main], "en").unwrap();
        assert_eq!(sel.a_index, 1);
        assert!(sel.language_match);
    }

    #[test]
    fn single_untagged_track_is_autodetect() {
        let sel = select(&[st(0, None, true, false, false, 2)], "en").unwrap();
        assert_eq!(sel.a_index, 0);
        assert_eq!(sel.role, "single-track");
        assert_eq!(sel.mismatch, "unknown-language");
        assert_eq!(sel.asr_strategy, "autodetect");
    }
}
