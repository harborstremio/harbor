use super::super::super::{MusicStream, MusicTrack};
use super::parse::{playable, ApiTranscoding};
use super::{client, fetch};
use serde_json::Value;

const HLS_MIME: &str = "application/vnd.apple.mpegurl";
const PROGRESSIVE_WEIGHT: i64 = 4000;
const HLS_WEIGHT: i64 = 2000;
const SNIPPED_PENALTY: i64 = 8000;

pub async fn resolve(track: &MusicTrack) -> Result<MusicStream, String> {
    let source = fetch::track_for(track).await?;
    if !playable(&source) {
        return Err("SoundCloud does not allow playback of this track".to_string());
    }
    let transcodings = source
        .media
        .as_ref()
        .map(|media| media.transcodings.as_slice())
        .unwrap_or_default();
    let selected = select_transcoding(transcodings)
        .ok_or_else(|| "SoundCloud did not offer a playable stream".to_string())?;
    if selected.snipped.unwrap_or(false) {
        return Err("SoundCloud only offers a preview of this track".to_string());
    }
    let endpoint = selected
        .url
        .as_deref()
        .ok_or_else(|| "SoundCloud did not offer a playable stream".to_string())?;
    let mut params = Vec::new();
    if let Some(authorization) = source
        .track_authorization
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        params.push(("track_authorization", authorization.to_string()));
    }
    let payload = client::get_url(endpoint, &params).await?;
    let signed = payload
        .get("url")
        .and_then(Value::as_str)
        .ok_or_else(|| "SoundCloud did not return a stream URL".to_string())?;
    Ok(MusicStream {
        http_headers: Default::default(),
        url: client::safe_media_url(signed)?,
        mime_type: stream_mime(selected),
        bitrate: preset_bitrate(selected.preset.as_deref().unwrap_or_default()),
    })
}

pub fn select_transcoding(transcodings: &[ApiTranscoding]) -> Option<&ApiTranscoding> {
    let mut best: Option<(i64, &ApiTranscoding)> = None;
    for transcoding in transcodings {
        let Some(value) = score(transcoding) else {
            continue;
        };
        let better = match best {
            Some((current, _)) => value > current,
            None => true,
        };
        if better {
            best = Some((value, transcoding));
        }
    }
    best.map(|(_, transcoding)| transcoding)
}

fn score(transcoding: &ApiTranscoding) -> Option<i64> {
    if transcoding
        .url
        .as_deref()
        .unwrap_or_default()
        .trim()
        .is_empty()
    {
        return None;
    }
    let format = transcoding.format.as_ref();
    let protocol = format
        .and_then(|format| format.protocol.as_deref())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if protocol.starts_with("ctr-")
        || protocol.starts_with("cbc-")
        || protocol.contains("encrypted")
    {
        return None;
    }
    let preset = transcoding
        .preset
        .as_deref()
        .unwrap_or_default()
        .to_ascii_lowercase();
    if preset.starts_with("abr") {
        return None;
    }
    let mut score = match protocol.as_str() {
        "progressive" => PROGRESSIVE_WEIGHT,
        "hls" => HLS_WEIGHT,
        _ => return None,
    };
    score += (preset_bitrate(&preset) / 1000) as i64;
    if transcoding.snipped.unwrap_or(false) {
        score -= SNIPPED_PENALTY;
    }
    Some(score)
}

pub fn stream_mime(transcoding: &ApiTranscoding) -> String {
    let format = transcoding.format.as_ref();
    let protocol = format
        .and_then(|format| format.protocol.as_deref())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if protocol == "hls" {
        return HLS_MIME.to_string();
    }
    format
        .and_then(|format| format.mime_type.as_deref())
        .map(|mime| mime.split(';').next().unwrap_or(mime).trim().to_string())
        .filter(|mime| !mime.is_empty())
        .unwrap_or_else(|| "audio/mpeg".to_string())
}

pub fn preset_bitrate(preset: &str) -> u64 {
    for segment in preset.split(['_', '-']) {
        let Some(digits) = segment.strip_suffix('k') else {
            continue;
        };
        if digits.is_empty() || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
            continue;
        }
        if let Ok(value) = digits.parse::<u64>() {
            return value * 1000;
        }
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    const MEDIA: &str = r#"[
        { "url": "https://api-v2.soundcloud.com/media/x/1/stream/hls", "preset": "aac_160k", "snipped": false,
          "format": { "protocol": "hls", "mime_type": "audio/mp4; codecs=\"mp4a.40.2\"" } },
        { "url": "https://api-v2.soundcloud.com/media/x/2/stream/hls", "preset": "aac_96k", "snipped": false,
          "format": { "protocol": "hls", "mime_type": "audio/mp4; codecs=\"mp4a.40.2\"" } },
        { "url": "https://api-v2.soundcloud.com/media/x/3/stream/hls", "preset": "abr_sq", "snipped": false,
          "format": { "protocol": "hls", "mime_type": "audio/mpegurl" } },
        { "url": "https://api-v2.soundcloud.com/media/x/4/stream/hls", "preset": "mp3_0_0", "snipped": false,
          "format": { "protocol": "hls", "mime_type": "audio/mpeg" } },
        { "url": "https://api-v2.soundcloud.com/media/x/5/stream/progressive", "preset": "mp3_0_0", "snipped": false,
          "format": { "protocol": "progressive", "mime_type": "audio/mpeg" } }
    ]"#;

    fn media() -> Vec<ApiTranscoding> {
        serde_json::from_str::<Vec<ApiTranscoding>>(MEDIA).expect("transcoding fixture")
    }

    #[test]
    fn progressive_wins_when_soundcloud_still_offers_it() {
        let media = media();
        let selected = select_transcoding(&media).expect("selected transcoding");
        assert_eq!(
            selected.url.as_deref(),
            Some("https://api-v2.soundcloud.com/media/x/5/stream/progressive")
        );
        assert_eq!(stream_mime(selected), "audio/mpeg");
        assert_eq!(preset_bitrate(selected.preset.as_deref().unwrap()), 0);
    }

    #[test]
    fn hls_aac_160k_is_the_fallback_when_progressive_is_gone() {
        let mut media = media();
        media.retain(|transcoding| {
            transcoding
                .format
                .as_ref()
                .and_then(|format| format.protocol.as_deref())
                != Some("progressive")
        });
        let selected = select_transcoding(&media).expect("selected transcoding");
        assert_eq!(selected.preset.as_deref(), Some("aac_160k"));
        assert_eq!(stream_mime(selected), "application/vnd.apple.mpegurl");
        assert_eq!(preset_bitrate(selected.preset.as_deref().unwrap()), 160_000);
    }

    #[test]
    fn encrypted_and_abr_transcodings_are_never_selected() {
        let media = serde_json::from_str::<Vec<ApiTranscoding>>(
            r#"[
                { "url": "https://api-v2.soundcloud.com/media/x/1/stream/hls", "preset": "abr_sq",
                  "format": { "protocol": "hls", "mime_type": "audio/mpegurl" } },
                { "url": "https://api-v2.soundcloud.com/media/x/2/stream/hls", "preset": "aac_256k",
                  "format": { "protocol": "ctr-encrypted-hls", "mime_type": "audio/mp4" } },
                { "url": "https://api-v2.soundcloud.com/media/x/3/stream/hls", "preset": "aac_160k",
                  "format": { "protocol": "cbc-encrypted-hls", "mime_type": "audio/mp4" } },
                { "url": "https://api-v2.soundcloud.com/media/x/4/stream/hls", "preset": "opus_0_0",
                  "format": { "protocol": "hls", "mime_type": "audio/ogg" } }
            ]"#,
        )
        .expect("guarded fixture");
        let selected = select_transcoding(&media).expect("selected transcoding");
        assert_eq!(selected.preset.as_deref(), Some("opus_0_0"));
    }

    #[test]
    fn a_snippet_never_outranks_a_full_stream() {
        let media = serde_json::from_str::<Vec<ApiTranscoding>>(
            r#"[
                { "url": "https://api-v2.soundcloud.com/media/x/1/stream/progressive", "preset": "mp3_0_0", "snipped": true,
                  "format": { "protocol": "progressive", "mime_type": "audio/mpeg" } },
                { "url": "https://api-v2.soundcloud.com/media/x/2/stream/hls", "preset": "aac_96k", "snipped": false,
                  "format": { "protocol": "hls", "mime_type": "audio/mp4" } }
            ]"#,
        )
        .expect("snipped fixture");
        let selected = select_transcoding(&media).expect("selected transcoding");
        assert_eq!(selected.preset.as_deref(), Some("aac_96k"));
    }

    #[test]
    fn nothing_is_selected_when_every_transcoding_is_unusable() {
        let media = serde_json::from_str::<Vec<ApiTranscoding>>(
            r#"[
                { "url": "", "preset": "aac_160k", "format": { "protocol": "hls" } },
                { "url": "https://api-v2.soundcloud.com/media/x/2/stream/dash", "preset": "aac_160k",
                  "format": { "protocol": "dash" } }
            ]"#,
        )
        .expect("unusable fixture");
        assert!(select_transcoding(&media).is_none());
        assert!(select_transcoding(&[]).is_none());
    }

    #[test]
    fn preset_bitrates_come_from_the_preset_name() {
        assert_eq!(preset_bitrate("aac_160k"), 160_000);
        assert_eq!(preset_bitrate("aac_96k"), 96_000);
        assert_eq!(preset_bitrate("mp3_0_0"), 0);
        assert_eq!(preset_bitrate(""), 0);
        assert_eq!(preset_bitrate("aac_xk"), 0);
    }
}
