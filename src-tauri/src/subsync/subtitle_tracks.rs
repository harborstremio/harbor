use std::collections::HashMap;
use std::time::Duration;
use tokio::process::Command;
use url::{Host, Url};

use super::audio_tracks::norm_lang;
use super::url_guard;
use crate::stream_proxy::ProxyState;
use crate::transcode::locate_ffprobe;

const PROBE_TIMEOUT_SECS: u64 = 12;

#[derive(Debug, PartialEq, Eq)]
pub(super) enum LoopbackSource {
    Proxy { session_id: String, playlist: bool },
    Torrent { info_hash: String, file_idx: usize },
    Unrecognized,
}

pub(super) fn classify_loopback_source(
    raw_url: &str,
) -> Result<Option<(u16, LoopbackSource)>, String> {
    let Ok(parsed) = Url::parse(raw_url.trim()) else {
        return Ok(None);
    };
    let is_loopback = match parsed.host() {
        Some(Host::Ipv4(ip)) => ip.is_loopback(),
        Some(Host::Ipv6(ip)) => {
            ip.is_loopback()
                || ip
                    .to_ipv4_mapped()
                    .is_some_and(|mapped| mapped.is_loopback())
        }
        _ => false,
    };
    if !is_loopback {
        return Ok(None);
    }
    let port = parsed
        .port_or_known_default()
        .ok_or("loopback port missing")?;
    if parsed.scheme() != "http" {
        return Ok(Some((port, LoopbackSource::Unrecognized)));
    }
    let segments = parsed
        .path_segments()
        .map(|parts| parts.collect::<Vec<_>>())
        .unwrap_or_default();
    let source = match segments.as_slice() {
        ["s", raw_session_id] if !raw_session_id.is_empty() => {
            let session_id = raw_session_id.strip_suffix(".ts").unwrap_or(raw_session_id);
            LoopbackSource::Proxy {
                session_id: session_id.to_string(),
                playlist: false,
            }
        }
        ["p", session_id, _, ..] if !session_id.is_empty() => LoopbackSource::Proxy {
            session_id: (*session_id).to_string(),
            playlist: true,
        },
        ["stream", info_hash, file_idx] if !info_hash.is_empty() => match file_idx.parse() {
            Ok(file_idx) => LoopbackSource::Torrent {
                info_hash: (*info_hash).to_string(),
                file_idx,
            },
            Err(_) => LoopbackSource::Unrecognized,
        },
        _ => LoopbackSource::Unrecognized,
    };
    Ok(Some((port, source)))
}

#[derive(serde::Deserialize)]
struct ProbeRoot {
    #[serde(default)]
    streams: Vec<ProbeStream>,
}

#[derive(serde::Deserialize)]
struct ProbeStream {
    index: u32,
    #[serde(default)]
    codec_name: String,
    #[serde(default)]
    tags: ProbeTags,
    #[serde(default)]
    disposition: ProbeDisposition,
}

#[derive(Default, serde::Deserialize)]
struct ProbeTags {
    language: Option<String>,
    title: Option<String>,
}

#[derive(Default, serde::Deserialize)]
struct ProbeDisposition {
    #[serde(default)]
    default: u8,
    #[serde(default)]
    forced: u8,
    #[serde(default)]
    hearing_impaired: u8,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedSubtitleTrack {
    pub ff_index: u32,
    pub sub_index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub codec: String,
    pub is_default: bool,
    pub is_forced: bool,
    pub is_hearing_impaired: bool,
}

pub(super) fn parse_probe_output(bytes: &[u8]) -> Result<Vec<EmbeddedSubtitleTrack>, String> {
    let root: ProbeRoot =
        serde_json::from_slice(bytes).map_err(|error| format!("parse ffprobe json: {error}"))?;
    Ok(root
        .streams
        .into_iter()
        .enumerate()
        .map(|(sub_index, stream)| EmbeddedSubtitleTrack {
            ff_index: stream.index,
            sub_index: sub_index as u32,
            lang: stream.tags.language.as_deref().and_then(norm_lang),
            title: stream.tags.title,
            codec: stream.codec_name,
            is_default: stream.disposition.default == 1,
            is_forced: stream.disposition.forced == 1,
            is_hearing_impaired: stream.disposition.hearing_impaired == 1,
        })
        .collect())
}

async fn probe_subtitle_streams(
    url: &str,
    headers: &HashMap<String, String>,
) -> Result<Vec<EmbeddedSubtitleTrack>, String> {
    let ffprobe = locate_ffprobe().ok_or("ffprobe not found")?;
    let mut command = Command::new(ffprobe);
    command.arg("-v").arg("error");
    command
        .arg("-user_agent")
        .arg(url_guard::user_agent(headers).unwrap_or_else(|| "Harbor".into()));
    let header_blob = url_guard::safe_header_blob(headers);
    if !header_blob.is_empty() {
        command.arg("-headers").arg(header_blob);
    }
    command
        .arg("-analyzeduration")
        .arg("5M")
        .arg("-probesize")
        .arg("5M")
        .arg("-select_streams")
        .arg("s")
        .arg("-show_entries")
        .arg("stream=index,codec_name:stream_tags=language,title:stream_disposition=default,forced,hearing_impaired")
        .arg("-of")
        .arg("json")
        .arg("-i")
        .arg(url)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);

    let output = tokio::time::timeout(Duration::from_secs(PROBE_TIMEOUT_SECS), command.output())
        .await
        .map_err(|_| "ffprobe timed out".to_string())?
        .map_err(|_| "ffprobe failed".to_string())?;
    if !output.status.success() {
        return Err("ffprobe failed".into());
    }
    parse_probe_output(&output.stdout)
}

#[tauri::command]
pub async fn subtitle_probe_tracks(
    url: String,
    headers: Option<HashMap<String, String>>,
    proxy_state: tauri::State<'_, ProxyState>,
) -> Result<Vec<EmbeddedSubtitleTrack>, String> {
    match classify_loopback_source(&url)? {
        Some((
            port,
            LoopbackSource::Proxy {
                session_id,
                playlist,
            },
        )) if port == proxy_state.port()
            && proxy_state.has_session(&session_id, playlist).await => {}
        Some((
            port,
            LoopbackSource::Torrent {
                info_hash,
                file_idx,
            },
        )) if crate::torrent_engine::owns_stream(port, &info_hash, file_idx) => {}
        Some(_) => return Err("loopback-blocked".into()),
        None => url_guard::validate_media_url(&url, true)?,
    }
    probe_subtitle_streams(&url, &headers.unwrap_or_default()).await
}
