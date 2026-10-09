use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[derive(Default)]
pub enum Resolution {
    #[serde(rename = "4K")]
    UHD,
    #[serde(rename = "1080p")]
    P1080,
    #[serde(rename = "720p")]
    P720,
    #[serde(rename = "480p")]
    P480,
    #[serde(rename = "SD")]
    #[default]
    SD,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HdrFormat {
    #[serde(rename = "HDR10")]
    Hdr10,
    #[serde(rename = "HDR10+")]
    Hdr10Plus,
    #[serde(rename = "DV")]
    Dv,
    #[serde(rename = "DV+HDR10")]
    DvHdr10,
    #[serde(rename = "HLG")]
    Hlg,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[derive(Default)]
pub enum Codec {
    #[serde(rename = "HEVC")]
    Hevc,
    #[serde(rename = "AVC")]
    Avc,
    #[serde(rename = "AV1")]
    Av1,
    #[serde(rename = "VP9")]
    Vp9,
    #[serde(rename = "MPEG2")]
    Mpeg2,
    #[serde(rename = "Other")]
    #[default]
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[derive(Default)]
pub enum AudioCodec {
    #[serde(rename = "Atmos")]
    Atmos,
    #[serde(rename = "TrueHD")]
    TrueHd,
    #[serde(rename = "DTS-HD MA")]
    DtsHdMa,
    #[serde(rename = "DTS")]
    Dts,
    #[serde(rename = "DD+")]
    DdPlus,
    #[serde(rename = "AC3")]
    Ac3,
    #[serde(rename = "AAC")]
    Aac,
    #[serde(rename = "Opus")]
    Opus,
    #[serde(rename = "FLAC")]
    Flac,
    #[serde(rename = "Other")]
    #[default]
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[derive(Default)]
pub enum Source {
    BluRay,
    REMUX,
    #[serde(rename = "WEB-DL")]
    WebDl,
    WEBRip,
    BDRip,
    HDRip,
    DVDRip,
    HDTV,
    CAM,
    TS,
    HDTS,
    TC,
    SCR,
    #[default]
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Tier {
    #[serde(rename = "4K_DV")]
    UhdDv,
    #[serde(rename = "4K_HDR")]
    UhdHdr,
    #[serde(rename = "4K")]
    Uhd,
    #[serde(rename = "1080p_HDR")]
    P1080Hdr,
    #[serde(rename = "1080p")]
    P1080,
    #[serde(rename = "720p")]
    P720,
    #[serde(rename = "SD")]
    SD,
    #[serde(rename = "ROUGH")]
    Rough,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
pub enum DebridSlug {
    #[serde(rename = "rd")]
    Rd,
    #[serde(rename = "tb")]
    Tb,
    #[serde(rename = "ad")]
    Ad,
    #[serde(rename = "pm")]
    Pm,
    #[serde(rename = "dl")]
    Dl,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Container {
    Mkv,
    Mp4,
    M4v,
    Avi,
    Webm,
    Mov,
    Ts,
    Wmv,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioInfo {
    pub codec: AudioCodec,
    pub channels: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bit_depth: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamSubtitle {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub m: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Contributor {
    pub id: String,
    pub name: String,
}

/// Mirror of the TS `Stream` shape. `behaviorHints` and other open fields are
/// preserved as a JSON value so we don't lose addon-specific keys when round-tripping.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stream {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub info_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_idx: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub yt_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub external_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitles: Option<Vec<StreamSubtitle>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub behavior_hints: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub availability: Option<f64>,
    pub addon_id: String,
    pub addon_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub addon_priority: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub addon_return_idx: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contributors: Option<Vec<Contributor>>,
    #[serde(flatten)]
    pub extra: std::collections::BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedStream {
    #[serde(flatten)]
    pub stream: Stream,
    pub parsed_title: String,
    pub episode_title: Option<String>,
    pub resolution: Resolution,
    pub hdr_format: Option<HdrFormat>,
    pub codec: Codec,
    pub source: Source,
    pub audio: AudioInfo,
    pub audio_languages: Vec<String>,
    pub size: Option<u64>,
    pub seeders: Option<u32>,
    #[serde(default)]
    pub cached: std::collections::BTreeMap<String, bool>,
    #[serde(default)]
    pub in_library: std::collections::BTreeMap<String, bool>,
    pub container: Option<Container>,
    pub release_group: Option<String>,
    pub release_group_normalized: Option<String>,
    pub remux: bool,
    pub edition: Option<String>,
    pub year: Option<u16>,
    pub year_range: Option<(u16, u16)>,
    pub season: Option<i32>,
    pub episode: Option<i32>,
    pub episode_end: Option<i32>,
    pub season_pack: bool,
    pub disc_index: Option<i32>,
    pub repack_iteration: i32,
    pub proper: bool,
    pub hardcoded: bool,
    pub anime_hash: Option<String>,
    pub scam_score: i32,
}





impl Default for AudioInfo {
    fn default() -> Self {
        AudioInfo {
            codec: AudioCodec::Other,
            channels: 2,
            bit_depth: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreReason {
    pub signal: String,
    pub delta: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoredStream {
    #[serde(flatten)]
    pub parsed: ParsedStream,
    pub score: f64,
    pub reasons: Vec<ScoreReason>,
    pub tier: Tier,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RankedPicker {
    pub primary: Option<ScoredStream>,
    pub by_tier: std::collections::BTreeMap<String, ScoredStream>,
    pub all: Vec<ScoredStream>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_year: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_season: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_episode: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_date: Option<String>,
    #[serde(default)]
    pub allow_season_packs: bool,
    #[serde(default)]
    pub allow_cam: bool,
    #[serde(default)]
    pub allow_size_outliers: bool,
    #[serde(default = "default_true")]
    pub strict: bool,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub preferred_languages: Vec<String>,
    #[serde(default)]
    pub preferred_audio_langs: Vec<String>,
    #[serde(default)]
    pub require_preferred_language: bool,
    #[serde(default)]
    pub is_anime: bool,
    // The TS side sends `expectedTitles: null` (not just absent) for non-anime
    // requests, so tolerate a literal JSON null and decode it to an empty list.
    // Plain `#[serde(default)]` only covers absent keys, not present-but-null.
    #[serde(default, deserialize_with = "null_default")]
    pub expected_titles: Vec<String>,
}

fn default_true() -> bool {
    true
}

fn null_default<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    T: Default + Deserialize<'de>,
    D: serde::Deserializer<'de>,
{
    Ok(Option::deserialize(deserializer)?.unwrap_or_default())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rejection {
    pub stream: ParsedStream,
    pub reason: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreOptions {
    #[serde(default)]
    pub active_debrids: Vec<String>,
    #[serde(default)]
    pub preferred_languages: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_date: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime_minutes: Option<u32>,
    #[serde(default)]
    pub in_theaters: bool,
    #[serde(default)]
    pub respect_addon_order: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preferred_release_group: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bandwidth_mbps: Option<f64>,
    #[serde(default)]
    pub prefer_single_audio_track: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prefer_addon_id: Option<String>,
}
