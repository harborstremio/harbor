//! Stream scoring. Mirror of `src/lib/streams/scoring.ts`.

#![allow(dead_code)]

use crate::types::*;
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Default)]
pub struct CorpusStats {
    pub days_since_release: Option<f64>,
    pub trusted_tracked_fraction: f64,
    pub theater_capture_fraction: f64,
    pub webish_fraction: f64,
    pub trusted_tracked_count: usize,
    pub median_size: Option<u64>,
    pub p90_size: Option<u64>,
    pub p10_seeders: Option<u32>,
    pub p90_seeders: Option<u32>,
}

const TRACKING_MIN_SEEDERS: u32 = 30;
const SHORT_FRESH_DAYS: f64 = 30.0;
const THEATER_WINDOW_DAYS: f64 = 150.0;

static TRUSTED_GROUPS: Lazy<&'static [&'static str]> = Lazy::new(|| {
    &[
        "FRDS", "FRAMESTOR", "FORM", "EVO", "RARBG", "ETHEL", "FLUX", "QXR", "MEGUSTA", "ION10",
        "PSA", "AMIABLE", "GALAXYRG", "WEBDV", "RZEROX", "SIC", "TGX", "NTB", "NTG", "TEPES",
        "GECKOS", "SUCCESSFULCRAB", "SUBSPLEASE", "ERAI", "ERAIRAWS", "JUDAS", "ASW", "EMBER",
        "ANE", "CLEO", "BEATRICERAWS", "AKIHITO", "VODES", "NANDESUKA", "SMOL", "TENRAISENSEI",
        "GST", "ANIMEKAIZOKU", "REINFORCE", "RAWS", "OZR", "PURGATORY", "SHK", "KOTUWA", "KIRION",
        "COMMIE", "DAMEDESUYO", "MTBB", "GJM", "SOFCJ",
    ]
});

fn is_trusted_group(normalized: Option<&str>) -> bool {
    match normalized {
        Some(g) => TRUSTED_GROUPS.contains(&g),
        None => false,
    }
}

const LOSSY_TRUSTED_GROUPS: &[&str] = &["YTS", "YIFY", "YTSAG", "YTS-AG"];

static CAM_MARKER_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(?:cam|hdcam|hd[\s._-]?cam|tsrip|telesync|hdts|hd[\s._-]?ts|telecine|hd[\s._-]?tc|hc[\s._-]?hdrip|hc[\s._-]?cam|new[\s._-]?cam|cleancam|hqcam)\b").unwrap()
});

static EASYNEWS_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)easynews").unwrap());

static TRUSTED_ADDON_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)mediafusion|comet|easynews|torrentio").unwrap());
static STRONG_ADDON_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)mediafusion|comet").unwrap());

fn is_theater_source(s: Source) -> bool {
    matches!(s, Source::CAM | Source::TS | Source::HDTS | Source::TC)
}

fn is_webish_source(s: Source) -> bool {
    matches!(s, Source::WebDl | Source::WEBRip | Source::BluRay | Source::BDRip)
}

fn is_cached_on_active(parsed: &ParsedStream, active: &[String]) -> bool {
    active
        .iter()
        .any(|slug| parsed.cached.get(slug).copied().unwrap_or(false))
}

fn parse_iso_date_to_ms(s: &str) -> Option<f64> {
    chrono_parse(s).ok()
}

fn chrono_parse(s: &str) -> Result<f64, ()> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return Err(());
    }
    if let Some((date, time)) = split_date_time(trimmed) {
        let (y, m, d) = parse_ymd(date)?;
        let (hh, mm, ss, frac, off_min) = parse_time_and_zone(time)?;
        let days = days_from_civil(y, m, d);
        let secs_in_day = hh as i64 * 3600 + mm as i64 * 60 + ss as i64;
        let total_secs = days * 86_400 + secs_in_day - off_min as i64 * 60;
        let ms = total_secs as f64 * 1000.0 + frac;
        return Ok(ms);
    }
    let (y, m, d) = parse_ymd(trimmed)?;
    let days = days_from_civil(y, m, d);
    Ok(days as f64 * 86_400_000.0)
}

fn split_date_time(s: &str) -> Option<(&str, &str)> {
    if let Some(idx) = s.find('T') {
        return Some((&s[..idx], &s[idx + 1..]));
    }
    if let Some(idx) = s.find(' ') {
        if s[..idx].len() == 10 {
            return Some((&s[..idx], &s[idx + 1..]));
        }
    }
    None
}

fn parse_ymd(s: &str) -> Result<(i32, u32, u32), ()> {
    let bytes = s.as_bytes();
    if bytes.len() < 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return Err(());
    }
    let y: i32 = s[..4].parse().map_err(|_| ())?;
    let m: u32 = s[5..7].parse().map_err(|_| ())?;
    let d: u32 = s[8..10].parse().map_err(|_| ())?;
    Ok((y, m, d))
}

fn parse_time_and_zone(s: &str) -> Result<(u32, u32, u32, f64, i32), ()> {
    let mut rest = s;
    let mut off_min: i32 = 0;
    if let Some(idx) = rest.find(['Z', '+']) {
        let (left, right) = rest.split_at(idx);
        rest = left;
        if right.starts_with('Z') {
            off_min = 0;
        } else {
            off_min = parse_offset(right)?;
        }
    } else if let Some(idx) = rest.rfind('-') {
        if idx > 0 {
            let (left, right) = rest.split_at(idx);
            rest = left;
            off_min = parse_offset(right)?;
        }
    }
    let (hms, frac) = if let Some(dot) = rest.find('.') {
        (&rest[..dot], parse_frac(&rest[dot..])?)
    } else {
        (rest, 0.0)
    };
    let parts: Vec<&str> = hms.split(':').collect();
    if parts.len() < 2 {
        return Err(());
    }
    let hh: u32 = parts[0].parse().map_err(|_| ())?;
    let mm: u32 = parts[1].parse().map_err(|_| ())?;
    let ss: u32 = if parts.len() >= 3 {
        parts[2].parse().map_err(|_| ())?
    } else {
        0
    };
    Ok((hh, mm, ss, frac, off_min))
}

fn parse_offset(s: &str) -> Result<i32, ()> {
    let sign = if s.starts_with('-') { -1 } else { 1 };
    let rest = &s[1..];
    let parts: Vec<&str> = rest.split(':').collect();
    let h: i32 = parts[0].parse().map_err(|_| ())?;
    let m: i32 = if parts.len() > 1 {
        parts[1].parse().map_err(|_| ())?
    } else {
        0
    };
    Ok(sign * (h * 60 + m))
}

fn parse_frac(s: &str) -> Result<f64, ()> {
    let n: f64 = s.parse().map_err(|_| ())?;
    Ok(n * 1000.0)
}

fn days_from_civil(y: i32, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as i64;
    let m_i = m as i64;
    let d_i = d as i64;
    let doy = (153 * (if m_i > 2 { m_i - 3 } else { m_i + 9 }) + 2) / 5 + d_i - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era as i64 * 146_097 + doe - 719_468
}

fn current_time_ms() -> f64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

fn days_since(release_date: &Option<String>) -> Option<f64> {
    let date = release_date.as_ref()?;
    let t = parse_iso_date_to_ms(date)?;
    Some((current_time_ms() - t) / 86_400_000.0)
}

pub fn compute_corpus_stats(streams: &[ParsedStream], opts: &ScoreOptions) -> CorpusStats {
    let days = days_since(&opts.release_date);

    let is_tracked = |s: &ParsedStream| -> bool {
        opts.active_debrids
            .iter()
            .any(|slug| s.cached.get(slug).copied().unwrap_or(false))
            || s.stream.url.is_some()
            || s.seeders.map(|sd| sd >= TRACKING_MIN_SEEDERS).unwrap_or(false)
    };

    let tracked: Vec<&ParsedStream> = streams.iter().filter(|s| is_tracked(s)).collect();
    let trusted_tracked_count = tracked.len();
    let theater = tracked.iter().filter(|s| is_theater_source(s.source)).count();
    let webish = tracked.iter().filter(|s| is_webish_source(s.source)).count();

    let total = if trusted_tracked_count == 0 {
        1
    } else {
        trusted_tracked_count
    };
    let denom_streams = std::cmp::max(streams.len(), 1) as f64;

    let mut sizes: Vec<u64> = streams.iter().filter_map(|s| s.size).collect();
    sizes.sort_unstable();
    let median_size = percentile_u64(&sizes, 0.5);
    let p90_size = percentile_u64(&sizes, 0.9);

    let mut seeders: Vec<u32> = streams.iter().filter_map(|s| s.seeders).collect();
    seeders.sort_unstable();
    let p10_seeders = percentile_u32(&seeders, 0.1);
    let p90_seeders = percentile_u32(&seeders, 0.9);

    CorpusStats {
        days_since_release: days,
        trusted_tracked_fraction: trusted_tracked_count as f64 / denom_streams,
        theater_capture_fraction: theater as f64 / total as f64,
        webish_fraction: webish as f64 / total as f64,
        trusted_tracked_count,
        median_size,
        p90_size,
        p10_seeders,
        p90_seeders,
    }
}

fn percentile_u64(sorted: &[u64], q: f64) -> Option<u64> {
    if sorted.is_empty() {
        return None;
    }
    let n = sorted.len();
    let idx = ((n as f64 - 1.0) * q).floor() as usize;
    sorted.get(idx).copied()
}

fn percentile_u32(sorted: &[u32], q: f64) -> Option<u32> {
    if sorted.is_empty() {
        return None;
    }
    let n = sorted.len();
    let idx = ((n as f64 - 1.0) * q).floor() as usize;
    sorted.get(idx).copied()
}

fn resolution_label(r: Resolution) -> &'static str {
    match r {
        Resolution::UHD => "4K",
        Resolution::P1080 => "1080p",
        Resolution::P720 => "720p",
        Resolution::P480 => "480p",
        Resolution::SD => "SD",
    }
}

fn hdr_label(h: HdrFormat) -> &'static str {
    match h {
        HdrFormat::Hdr10 => "HDR10",
        HdrFormat::Hdr10Plus => "HDR10+",
        HdrFormat::Dv => "DV",
        HdrFormat::DvHdr10 => "DV+HDR10",
        HdrFormat::Hlg => "HLG",
    }
}

fn resolution_points(s: &ParsedStream) -> ScoreReason {
    match s.resolution {
        Resolution::UHD => ScoreReason {
            signal: "4K".to_string(),
            delta: 25.0,
        },
        Resolution::P1080 => ScoreReason {
            signal: "1080p".to_string(),
            delta: 20.0,
        },
        Resolution::P720 => ScoreReason {
            signal: "720p".to_string(),
            delta: 8.0,
        },
        Resolution::P480 => ScoreReason {
            signal: "480p".to_string(),
            delta: 2.0,
        },
        Resolution::SD => ScoreReason {
            signal: "SD".to_string(),
            delta: 0.0,
        },
    }
}

fn audio_points(s: &ParsedStream) -> ScoreReason {
    match s.audio.codec {
        AudioCodec::Atmos => ScoreReason {
            signal: "Atmos".to_string(),
            delta: 3.0,
        },
        AudioCodec::TrueHd => ScoreReason {
            signal: "TrueHD".to_string(),
            delta: 2.0,
        },
        AudioCodec::DtsHdMa => ScoreReason {
            signal: "DTS-HD MA".to_string(),
            delta: 2.0,
        },
        AudioCodec::DdPlus => ScoreReason {
            signal: "DD+".to_string(),
            delta: 1.0,
        },
        _ => ScoreReason {
            signal: "audio".to_string(),
            delta: 0.0,
        },
    }
}

fn trusted_addon_points(s: &ParsedStream) -> ScoreReason {
    let name = &s.stream.addon_name;
    if STRONG_ADDON_RX.is_match(name) {
        return ScoreReason {
            signal: "strong-addon".to_string(),
            delta: 8.0,
        };
    }
    if TRUSTED_ADDON_RX.is_match(name) {
        return ScoreReason {
            signal: "trusted-addon".to_string(),
            delta: 4.0,
        };
    }
    ScoreReason {
        signal: "addon-neutral".to_string(),
        delta: 0.0,
    }
}

const ADDON_PRIORITY_MAX: f64 = 12.0;
const ADDON_PRIORITY_STEP: f64 = 4.0;

fn addon_priority_points(s: &ParsedStream) -> ScoreReason {
    match s.stream.addon_priority {
        Some(p) => {
            let delta = (ADDON_PRIORITY_MAX - p as f64 * ADDON_PRIORITY_STEP).max(0.0);
            ScoreReason {
                signal: format!("addon-priority-{}", p),
                delta,
            }
        }
        None => ScoreReason {
            signal: "addon-priority-none".to_string(),
            delta: 0.0,
        },
    }
}

fn playability_penalty(s: &ParsedStream) -> f64 {
    let mut penalty = 0.0_f64;
    if matches!(s.audio.codec, AudioCodec::Dts | AudioCodec::DtsHdMa) {
        penalty -= 6.0;
    }
    if matches!(s.audio.codec, AudioCodec::TrueHd) {
        penalty -= 4.0;
    }
    if matches!(s.container, Some(Container::Mkv))
        && matches!(s.audio.codec, AudioCodec::Dts | AudioCodec::TrueHd)
    {
        penalty -= 3.0;
    }
    if matches!(s.container, Some(Container::Avi) | Some(Container::Wmv)) {
        penalty -= 8.0;
    }
    if matches!(s.codec, Codec::Av1) {
        penalty -= 2.0;
    }
    penalty
}

fn tier_of(s: &ParsedStream) -> Tier {
    if matches!(
        s.source,
        Source::CAM | Source::TS | Source::HDTS | Source::TC | Source::SCR
    ) {
        return Tier::Rough;
    }
    if matches!(s.resolution, Resolution::UHD) {
        if matches!(s.hdr_format, Some(HdrFormat::Dv) | Some(HdrFormat::DvHdr10)) {
            return Tier::UhdDv;
        }
        if s.hdr_format.is_some() {
            return Tier::UhdHdr;
        }
        return Tier::Uhd;
    }
    if matches!(s.resolution, Resolution::P1080) {
        if s.hdr_format.is_some() {
            return Tier::P1080Hdr;
        }
        return Tier::P1080;
    }
    if matches!(s.resolution, Resolution::P720) {
        return Tier::P720;
    }
    Tier::SD
}

fn cam_in_filename_penalty(s: &ParsedStream) -> f64 {
    if is_theater_source(s.source) {
        return 0.0;
    }
    if !matches!(s.resolution, Resolution::P1080 | Resolution::UHD) {
        return 0.0;
    }
    let mut parts: Vec<&str> = Vec::new();
    if let Some(n) = &s.stream.name {
        parts.push(n);
    }
    if let Some(t) = &s.stream.title {
        parts.push(t);
    }
    if let Some(bh) = &s.stream.behavior_hints {
        if let Some(v) = bh.get("filename").and_then(|v| v.as_str()) {
            parts.push(v);
        }
        if let Some(v) = bh.get("fileName").and_then(|v| v.as_str()) {
            parts.push(v);
        }
    }
    if let Some(d) = &s.stream.description {
        parts.push(d);
    }
    let haystack = parts.join(" \n ");
    if !CAM_MARKER_RX.is_match(&haystack) {
        return 0.0;
    }
    if matches!(s.resolution, Resolution::UHD) {
        -200.0
    } else {
        -100.0
    }
}

fn expected_min_size_bytes(resolution: Resolution, runtime_min: u32) -> Option<f64> {
    if runtime_min == 0 {
        return None;
    }
    let mb_per_min = match resolution {
        Resolution::UHD => 60.0,
        Resolution::P1080 => 18.0,
        Resolution::P720 => 8.0,
        Resolution::P480 => 3.0,
        Resolution::SD => 2.0,
    };
    Some(mb_per_min * runtime_min as f64 * 1024.0 * 1024.0)
}

fn size_mislabel_penalty(s: &ParsedStream, expected_min: Option<f64>) -> f64 {
    let size = match s.size {
        Some(sz) if sz > 0 => sz as f64,
        _ => return 0.0,
    };
    let expected = match expected_min {
        Some(e) => e,
        None => return 0.0,
    };
    if is_theater_source(s.source) {
        return 0.0;
    }
    if let Some(g) = &s.release_group_normalized {
        if LOSSY_TRUSTED_GROUPS.contains(&g.to_uppercase().as_str()) {
            return 0.0;
        }
    }
    if size >= expected {
        return 0.0;
    }
    let ratio = size / expected;
    if ratio < 0.25 {
        -120.0
    } else if ratio < 0.5 {
        -60.0
    } else if ratio < 0.75 {
        -20.0
    } else {
        0.0
    }
}

fn undersized_new_release_penalty(s: &ParsedStream, opts: &ScoreOptions) -> ScoreReason {
    if opts.media_kind.as_deref() == Some("series") {
        return ScoreReason {
            signal: "undersized-skip-series".to_string(),
            delta: 0.0,
        };
    }
    let date = match &opts.release_date {
        Some(d) => d,
        None => {
            return ScoreReason {
                signal: "undersized-skip-no-data".to_string(),
                delta: 0.0,
            }
        }
    };
    let size = match s.size {
        Some(sz) => sz as f64,
        None => {
            return ScoreReason {
                signal: "undersized-skip-no-data".to_string(),
                delta: 0.0,
            }
        }
    };
    let t = match parse_iso_date_to_ms(date) {
        Some(v) => v,
        None => {
            return ScoreReason {
                signal: "undersized-skip-bad-date".to_string(),
                delta: 0.0,
            }
        }
    };
    let days = (current_time_ms() - t) / 86_400_000.0;
    if days >= 90.0 {
        return ScoreReason {
            signal: "undersized-skip-mature".to_string(),
            delta: 0.0,
        };
    }
    if is_theater_source(s.source) {
        return ScoreReason {
            signal: "undersized-skip-theater".to_string(),
            delta: 0.0,
        };
    }
    let size_gb = size / (1024.0_f64.powi(3));
    if matches!(s.resolution, Resolution::UHD) && size_gb < 6.0 {
        return ScoreReason {
            signal: format!("4k-undersized-{}gb", format_one(size_gb)),
            delta: -250.0,
        };
    }
    if matches!(s.resolution, Resolution::P1080) && size_gb < 1.5 {
        return ScoreReason {
            signal: format!("1080p-undersized-{}gb", format_one(size_gb)),
            delta: -200.0,
        };
    }
    if matches!(s.resolution, Resolution::P720) && size_gb < 0.6 {
        return ScoreReason {
            signal: format!("720p-undersized-{}gb", format_one(size_gb)),
            delta: -80.0,
        };
    }
    ScoreReason {
        signal: "undersized-ok".to_string(),
        delta: 0.0,
    }
}

fn format_one(x: f64) -> String {
    let rounded = (x * 10.0).round() / 10.0;
    format!("{:.1}", rounded)
}

fn bitrate_budget_penalty(s: &ParsedStream, opts: &ScoreOptions, cached: bool) -> ScoreReason {
    let budget = match opts.bandwidth_mbps {
        Some(b) if b > 0.0 => b,
        _ => {
            return ScoreReason {
                signal: "bitrate-ok".to_string(),
                delta: 0.0,
            }
        }
    };
    let headroom = budget * 0.8;
    if let (Some(size), Some(runtime)) = (s.size, opts.runtime_minutes) {
        if size > 0 && runtime > 0 {
            let required = (size as f64 * 8.0) / (runtime as f64 * 60.0) / 1_000_000.0;
            if required > budget * 1.1 {
                let sev = if required > budget * 1.5 { -120.0 } else { -45.0 };
                return ScoreReason {
                    signal: format!(
                        "bitrate-exceeds-budget:{}>{}Mbps",
                        required.round() as i64,
                        budget.round() as i64
                    ),
                    delta: if cached { sev + 10.0 } else { sev },
                };
            }
            if required > headroom {
                return ScoreReason {
                    signal: format!(
                        "bitrate-tight:{}/{}Mbps",
                        required.round() as i64,
                        budget.round() as i64
                    ),
                    delta: -12.0,
                };
            }
        }
    }
    if matches!(s.resolution, Resolution::UHD) && budget < 25.0 {
        return ScoreReason {
            signal: "low-bandwidth-4k".to_string(),
            delta: if cached { -30.0 } else { -60.0 },
        };
    }
    if matches!(s.resolution, Resolution::P1080) && budget < 8.0 {
        return ScoreReason {
            signal: "low-bandwidth-1080p".to_string(),
            delta: if cached { -20.0 } else { -45.0 },
        };
    }
    ScoreReason {
        signal: "bitrate-ok".to_string(),
        delta: 0.0,
    }
}

fn impossibly_small_movie_penalty(s: &ParsedStream, opts: &ScoreOptions) -> ScoreReason {
    if opts.media_kind.as_deref() == Some("series") {
        return ScoreReason {
            signal: "tiny-skip-series".to_string(),
            delta: 0.0,
        };
    }
    let size = match s.size {
        Some(sz) => sz as f64,
        None => {
            return ScoreReason {
                signal: "tiny-skip-no-size".to_string(),
                delta: 0.0,
            }
        }
    };
    let date = match &opts.release_date {
        Some(d) => d,
        None => {
            return ScoreReason {
                signal: "tiny-skip-no-date".to_string(),
                delta: 0.0,
            }
        }
    };
    let t = match parse_iso_date_to_ms(date) {
        Some(v) => v,
        None => {
            return ScoreReason {
                signal: "tiny-skip-bad-date".to_string(),
                delta: 0.0,
            }
        }
    };
    let days = (current_time_ms() - t) / 86_400_000.0;
    if days >= 90.0 {
        return ScoreReason {
            signal: "tiny-skip-mature".to_string(),
            delta: 0.0,
        };
    }
    if is_theater_source(s.source) {
        return ScoreReason {
            signal: "tiny-skip-theater".to_string(),
            delta: 0.0,
        };
    }
    let size_mb = size / (1024.0 * 1024.0);
    if size_mb < 250.0 {
        return ScoreReason {
            signal: format!("new-release-virus-{}mb", size_mb.round() as i64),
            delta: -250.0,
        };
    }
    let runtime_floor = opts.runtime_minutes.map(|r| r as f64 * 5.0).unwrap_or(0.0);
    let floor = 500.0_f64.max(runtime_floor);
    if size_mb < floor {
        return ScoreReason {
            signal: format!("new-release-no-label-{}mb", size_mb.round() as i64),
            delta: -200.0,
        };
    }
    ScoreReason {
        signal: "tiny-ok".to_string(),
        delta: 0.0,
    }
}

fn fresh_theatrical_adjust(
    s: &ParsedStream,
    opts: &ScoreOptions,
    has_valid_size: bool,
    corpus: Option<&CorpusStats>,
) -> ScoreReason {
    if opts.media_kind.as_deref() == Some("series") {
        return ScoreReason {
            signal: "fresh-skip-series".to_string(),
            delta: 0.0,
        };
    }
    let date = match &opts.release_date {
        Some(d) => d,
        None => {
            return ScoreReason {
                signal: "fresh-skip-no-date".to_string(),
                delta: 0.0,
            }
        }
    };
    let t = match parse_iso_date_to_ms(date) {
        Some(v) => v,
        None => {
            return ScoreReason {
                signal: "fresh-skip-bad-date".to_string(),
                delta: 0.0,
            }
        }
    };
    let days = (current_time_ms() - t) / 86_400_000.0;
    if days >= THEATER_WINDOW_DAYS {
        return ScoreReason {
            signal: "fresh-skip-mature".to_string(),
            delta: 0.0,
        };
    }

    let is_theater_capture = is_theater_source(s.source);
    let is_remux_or_bluray = matches!(s.source, Source::BluRay) || s.remux;
    let claims_high_quality = matches!(s.source, Source::WebDl | Source::WEBRip)
        || is_remux_or_bluray
        || matches!(s.resolution, Resolution::P1080 | Resolution::UHD);

    let theater_dominated = corpus
        .map(|c| {
            c.trusted_tracked_count >= 4
                && c.theater_capture_fraction >= 0.4
                && c.theater_capture_fraction > c.webish_fraction
        })
        .unwrap_or(false);

    if !theater_dominated && days >= SHORT_FRESH_DAYS {
        return ScoreReason {
            signal: "fresh-skip-mature".to_string(),
            delta: 0.0,
        };
    }

    if is_theater_capture {
        if theater_dominated {
            let source_offset = match s.source {
                Source::CAM => 95.0,
                Source::TS | Source::HDTS => 75.0,
                _ => 65.0,
            };
            return ScoreReason {
                signal: "fresh-theater-cinema-window".to_string(),
                delta: source_offset,
            };
        }
        if days < 14.0 {
            return ScoreReason {
                signal: "fresh-theater-mild-boost".to_string(),
                delta: 25.0,
            };
        }
        return ScoreReason {
            signal: "fresh-theater-neutral".to_string(),
            delta: 0.0,
        };
    }

    if !claims_high_quality {
        return ScoreReason {
            signal: "fresh-low-quality-noise".to_string(),
            delta: 0.0,
        };
    }

    if theater_dominated {
        if is_remux_or_bluray {
            return ScoreReason {
                signal: "fresh-fake-remux".to_string(),
                delta: -200.0,
            };
        }
        if days < 0.0 {
            return ScoreReason {
                signal: "fresh-fake-prerelease".to_string(),
                delta: -160.0,
            };
        }
        if days < 14.0 {
            return ScoreReason {
                signal: "fresh-fake-prebluray".to_string(),
                delta: -90.0,
            };
        }
        return ScoreReason {
            signal: "fresh-fake-soft".to_string(),
            delta: -45.0,
        };
    }

    if is_remux_or_bluray && days < 14.0 {
        return ScoreReason {
            signal: "fresh-prebluray-suspect".to_string(),
            delta: -55.0,
        };
    }
    if days < 0.0 && !has_valid_size {
        return ScoreReason {
            signal: "fresh-prerelease-soft".to_string(),
            delta: -35.0,
        };
    }
    ScoreReason {
        signal: "fresh-soft-flag".to_string(),
        delta: -10.0,
    }
}

pub fn score_stream(
    parsed: ParsedStream,
    opts: &ScoreOptions,
    corpus: &CorpusStats,
) -> ScoredStream {
    let mut reasons: Vec<ScoreReason> = Vec::new();
    let mut score: f64 = 0.0;

    let cached = is_cached_on_active(&parsed, &opts.active_debrids);
    let direct_playable = parsed.stream.url.is_some();
    let easynews_in_addon = EASYNEWS_RX.is_match(&parsed.stream.addon_name);
    let easynews_in_title = EASYNEWS_RX.is_match(&parsed.parsed_title);
    let is_easynews = easynews_in_addon || easynews_in_title;

    if cached || is_easynews {
        score += 60.0;
        reasons.push(ScoreReason {
            signal: if cached {
                "cached".to_string()
            } else {
                "easynews-direct".to_string()
            },
            delta: 60.0,
        });
    } else if direct_playable {
        score += 25.0;
        reasons.push(ScoreReason {
            signal: "direct url".to_string(),
            delta: 25.0,
        });
    }

    let res_boost = resolution_points(&parsed);
    if res_boost.delta != 0.0 {
        score += res_boost.delta;
        reasons.push(res_boost);
    }

    if let Some(hdr) = parsed.hdr_format {
        let hdr_delta = if matches!(hdr, HdrFormat::DvHdr10 | HdrFormat::Dv) {
            6.0
        } else {
            5.0
        };
        score += hdr_delta;
        reasons.push(ScoreReason {
            signal: hdr_label(hdr).to_string(),
            delta: hdr_delta,
        });
    }

    match parsed.codec {
        Codec::Hevc => {
            score += 1.0;
            reasons.push(ScoreReason {
                signal: "HEVC".to_string(),
                delta: 1.0,
            });
        }
        Codec::Av1 => {
            score += 1.0;
            reasons.push(ScoreReason {
                signal: "AV1".to_string(),
                delta: 1.0,
            });
        }
        _ => {}
    }

    let audio_delta = audio_points(&parsed);
    if audio_delta.delta != 0.0 {
        score += audio_delta.delta;
        reasons.push(audio_delta);
    }

    if parsed.audio.channels >= 6 {
        score += 2.0;
        reasons.push(ScoreReason {
            signal: format!("{}.0 channels", parsed.audio.channels),
            delta: 2.0,
        });
    }

    if !cached {
        if let Some(seeders) = parsed.seeders {
            let seed_delta = std::cmp::min((seeders / 10) as i64, 10);
            if seed_delta > 0 {
                score += seed_delta as f64;
                reasons.push(ScoreReason {
                    signal: format!("seeders={}", seeders),
                    delta: seed_delta as f64,
                });
            } else if parsed.stream.url.is_none()
                && parsed.stream.info_hash.is_some()
                && seeders == 0
            {
                score -= 20.0;
                reasons.push(ScoreReason {
                    signal: "zero-seeders-stale-meta".to_string(),
                    delta: -20.0,
                });
            }
        }
    }

    if parsed.stream.info_hash.is_some() && parsed.seeders == Some(0) && !cached {
        score -= 8.0;
        reasons.push(ScoreReason {
            signal: "zero-seeders-soft".to_string(),
            delta: -8.0,
        });
    }

    let expected_year = opts
        .release_date
        .as_deref()
        .and_then(|d| d.get(0..4))
        .and_then(|y| y.parse::<i32>().ok());
    if let (Some(ey), Some(sy)) = (expected_year, parsed.year) {
        let diff = (sy as i32 - ey).abs();
        if diff != 0 {
            let days_from_release = opts
                .release_date
                .as_deref()
                .and_then(parse_iso_date_to_ms)
                .map(|ms| ((current_time_ms() - ms) / 86_400_000.0).abs())
                .unwrap_or(f64::INFINITY);
            let is_recent = days_from_release < 365.0;
            let suffix = if is_recent { "-recent" } else { "" };
            if diff == 1 {
                let delta = if is_recent { -75.0 } else { -18.0 };
                score += delta;
                reasons.push(ScoreReason {
                    signal: format!("year-off-by-1:{}vs{}{}", sy, ey, suffix),
                    delta,
                });
            } else {
                let delta = if is_recent { -150.0 } else { -70.0 };
                score += delta;
                reasons.push(ScoreReason {
                    signal: format!("year-mismatch:{}vs{}{}", sy, ey, suffix),
                    delta,
                });
            }
        }
    }

    if is_trusted_group(parsed.release_group_normalized.as_deref()) {
        score += 2.0;
        reasons.push(ScoreReason {
            signal: format!(
                "group:{}",
                parsed.release_group_normalized.as_deref().unwrap_or("")
            ),
            delta: 2.0,
        });
    }

    if let (Some(preferred), Some(group)) = (
        opts.preferred_release_group.as_deref(),
        parsed.release_group_normalized.as_deref(),
    ) {
        if group == preferred {
            score += 8.0;
            reasons.push(ScoreReason {
                signal: format!("prev-episode-group:{}", group),
                delta: 8.0,
            });
        }
    }

    if parsed.remux {
        score += 3.0;
        reasons.push(ScoreReason {
            signal: "REMUX".to_string(),
            delta: 3.0,
        });
    }

    match parsed.source {
        Source::CAM => {
            score -= 80.0;
            reasons.push(ScoreReason {
                signal: "CAM penalty".to_string(),
                delta: -80.0,
            });
        }
        Source::TS | Source::HDTS => {
            score -= 60.0;
            reasons.push(ScoreReason {
                signal: "Telesync penalty".to_string(),
                delta: -60.0,
            });
        }
        Source::TC => {
            score -= 50.0;
            reasons.push(ScoreReason {
                signal: "Telecine penalty".to_string(),
                delta: -50.0,
            });
        }
        Source::SCR => {
            score -= 40.0;
            reasons.push(ScoreReason {
                signal: "Screener penalty".to_string(),
                delta: -40.0,
            });
        }
        _ => {}
    }

    if parsed.proper || parsed.repack_iteration > 0 {
        let base = if parsed.repack_iteration == 0 {
            1
        } else {
            parsed.repack_iteration
        };
        let r = std::cmp::min(2, base) as f64;
        score += r;
        let signal = if parsed.proper {
            "PROPER".to_string()
        } else {
            format!("REPACK{}", parsed.repack_iteration)
        };
        reasons.push(ScoreReason { signal, delta: r });
    }

    let preferred = &opts.preferred_languages;
    if !preferred.is_empty() {
        if parsed.audio_languages.is_empty() {
            score -= 3.0;
            reasons.push(ScoreReason {
                signal: "language-unknown".to_string(),
                delta: -3.0,
            });
        } else {
            let is_multi = parsed
                .audio_languages
                .iter()
                .any(|l| l == "Multi");
            let mut matched = false;
            for l in &parsed.audio_languages {
                let ll = l.to_lowercase();
                for p in preferred {
                    let pp = p.to_lowercase();
                    if ll == pp || ll.starts_with(&pp) {
                        matched = true;
                        break;
                    }
                }
                if matched {
                    break;
                }
            }
            if matched {
                score += 12.0;
                reasons.push(ScoreReason {
                    signal: "preferred-language".to_string(),
                    delta: 12.0,
                });
            } else if is_multi {
                if opts.prefer_single_audio_track {
                    score -= 18.0;
                    reasons.push(ScoreReason {
                        signal: "html5-multi-audio-penalty".to_string(),
                        delta: -18.0,
                    });
                } else {
                    score += 4.0;
                    reasons.push(ScoreReason {
                        signal: "multi-language".to_string(),
                        delta: 4.0,
                    });
                }
            } else {
                score -= 14.0;
                reasons.push(ScoreReason {
                    signal: "language-mismatch".to_string(),
                    delta: -14.0,
                });
            }
        }
    } else if opts.prefer_single_audio_track
        && parsed.audio_languages.iter().any(|l| l == "Multi")
    {
        score -= 12.0;
        reasons.push(ScoreReason {
            signal: "html5-multi-audio-penalty".to_string(),
            delta: -12.0,
        });
    }

    if parsed.scam_score > 0 {
        let s = parsed.scam_score as f64;
        score -= s;
        reasons.push(ScoreReason {
            signal: "scam-penalty".to_string(),
            delta: -s,
        });
    }

    if parsed.stream.url.is_some() && !cached {
        score += 4.0;
        reasons.push(ScoreReason {
            signal: "prelinked-url".to_string(),
            delta: 4.0,
        });
    }

    if let Some(pref) = &opts.prefer_addon_id {
        if &parsed.stream.addon_id == pref {
            score += 250.0;
            reasons.push(ScoreReason {
                signal: "origin-addon".to_string(),
                delta: 250.0,
            });
        }
    }

    let trusted_addon_boost = trusted_addon_points(&parsed);
    if trusted_addon_boost.delta > 0.0 {
        score += trusted_addon_boost.delta;
        reasons.push(trusted_addon_boost);
    }

    let addon_priority_boost = addon_priority_points(&parsed);
    if addon_priority_boost.delta > 0.0 {
        score += addon_priority_boost.delta;
        reasons.push(addon_priority_boost);
    }

    let playability_delta = playability_penalty(&parsed);
    if playability_delta < 0.0 {
        score += playability_delta;
        reasons.push(ScoreReason {
            signal: "webview2-unfriendly".to_string(),
            delta: playability_delta,
        });
    }

    let bitrate_penalty = bitrate_budget_penalty(&parsed, opts, cached);
    if bitrate_penalty.delta < 0.0 {
        score += bitrate_penalty.delta;
        reasons.push(bitrate_penalty);
    }

    let expected_min = opts
        .runtime_minutes
        .and_then(|r| expected_min_size_bytes(parsed.resolution, r));
    let has_valid_size = match (parsed.size, expected_min) {
        (Some(sz), Some(min)) => (sz as f64) >= min,
        _ => false,
    };

    let size_penalty = size_mislabel_penalty(&parsed, expected_min);
    if size_penalty < 0.0 {
        score += size_penalty;
        reasons.push(ScoreReason {
            signal: "size-mismatch".to_string(),
            delta: size_penalty,
        });
    }

    let desync_penalty = cam_in_filename_penalty(&parsed);
    if desync_penalty < 0.0 {
        score += desync_penalty;
        reasons.push(ScoreReason {
            signal: "title-says-hires-filename-says-cam".to_string(),
            delta: desync_penalty,
        });
    }

    let undersized_penalty = undersized_new_release_penalty(&parsed, opts);
    if undersized_penalty.delta < 0.0 {
        score += undersized_penalty.delta;
        reasons.push(undersized_penalty);
    }

    let tiny_penalty = impossibly_small_movie_penalty(&parsed, opts);
    if tiny_penalty.delta < 0.0 {
        score += tiny_penalty.delta;
        reasons.push(tiny_penalty);
    }

    let recency = fresh_theatrical_adjust(&parsed, opts, has_valid_size, Some(corpus));
    if recency.delta != 0.0 {
        score += recency.delta;
        reasons.push(recency);
    }

    let tier = tier_of(&parsed);
    ScoredStream {
        parsed,
        score,
        reasons,
        tier,
    }
}

fn tier_key(t: Tier) -> &'static str {
    match t {
        Tier::UhdDv => "4K_DV",
        Tier::UhdHdr => "4K_HDR",
        Tier::Uhd => "4K",
        Tier::P1080Hdr => "1080p_HDR",
        Tier::P1080 => "1080p",
        Tier::P720 => "720p",
        Tier::SD => "SD",
        Tier::Rough => "ROUGH",
    }
}

fn is_cached_scored(s: &ScoredStream, active: &[String]) -> bool {
    s.parsed.stream.url.is_some()
        || active
            .iter()
            .any(|slug| s.parsed.cached.get(slug).copied().unwrap_or(false))
}

pub fn rank_and_pick(
    scored: Vec<ScoredStream>,
    active_debrids: &[String],
    respect_addon_order: bool,
) -> RankedPicker {
    let mut cached_first = scored;
    if respect_addon_order {
        cached_first.sort_by(|a, b| {
            let pa = a.parsed.stream.addon_priority.unwrap_or(u32::MAX);
            let pb = b.parsed.stream.addon_priority.unwrap_or(u32::MAX);
            let ra = a.parsed.stream.addon_return_idx.unwrap_or(u32::MAX);
            let rb = b.parsed.stream.addon_return_idx.unwrap_or(u32::MAX);
            pa.cmp(&pb)
                .then(ra.cmp(&rb))
                .then(b.score.total_cmp(&a.score))
        });
    }
    cached_first.sort_by(|a, b| {
        let ac = if is_cached_scored(a, active_debrids) { 1 } else { 0 };
        let bc = if is_cached_scored(b, active_debrids) { 1 } else { 0 };
        bc.cmp(&ac)
    });

    let mut by_tier_map: BTreeMap<String, ScoredStream> = BTreeMap::new();
    for s in &cached_first {
        let key = tier_key(s.tier).to_string();
        by_tier_map.entry(key).or_insert_with(|| s.clone());
    }

    let cached_non_theater = || {
        cached_first
            .iter()
            .filter(|s| is_cached_scored(s, active_debrids) && !is_theater_source(s.parsed.source))
    };
    let picked = if respect_addon_order {
        cached_non_theater().next()
    } else {
        cached_non_theater().max_by(|a, b| a.score.total_cmp(&b.score))
    };
    let primary = picked
        .or_else(|| cached_first.iter().find(|s| !is_theater_source(s.parsed.source)))
        .or_else(|| cached_first.first())
        .cloned();

    RankedPicker {
        primary,
        by_tier: by_tier_map,
        all: cached_first,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_parsed() -> ParsedStream {
        ParsedStream {
            stream: Stream {
                addon_id: "test".to_string(),
                addon_name: "test-addon".to_string(),
                ..Default::default()
            },
            parsed_title: String::new(),
            episode_title: None,
            resolution: Resolution::P1080,
            hdr_format: None,
            codec: Codec::Other,
            source: Source::WebDl,
            audio: AudioInfo::default(),
            audio_languages: Vec::new(),
            size: None,
            seeders: None,
            cached: Default::default(),
            in_library: Default::default(),
            container: None,
            release_group: None,
            release_group_normalized: None,
            remux: false,
            edition: None,
            year: None,
            year_range: None,
            season: None,
            episode: None,
            episode_end: None,
            season_pack: false,
            disc_index: None,
            repack_iteration: 0,
            proper: false,
            hardcoded: false,
            anime_hash: None,
            scam_score: 0,
        }
    }

    fn empty_corpus() -> CorpusStats {
        CorpusStats::default()
    }

    fn empty_opts() -> ScoreOptions {
        ScoreOptions::default()
    }

    fn civil_from_days(z: i64) -> (i32, u32, u32) {
        let z = z + 719_468;
        let era = (if z >= 0 { z } else { z - 146_096 }) / 146_097;
        let doe = z - era * 146_097;
        let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
        let y = yoe + era * 400;
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp = (5 * doy + 2) / 153;
        let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
        let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
        let y = y + if m <= 2 { 1 } else { 0 };
        (y as i32, m, d)
    }

    fn days_ago_iso(days: f64) -> String {
        let ms = current_time_ms() - days * 86_400_000.0;
        let day_num = (ms / 86_400_000.0).floor() as i64;
        let (y, m, d) = civil_from_days(day_num);
        format!("{:04}-{:02}-{:02}", y, m, d)
    }

    #[test]
    fn fresh_theater_window_protects_dominated_pool_past_30_days() {
        let corpus = CorpusStats {
            days_since_release: Some(50.0),
            theater_capture_fraction: 0.8,
            webish_fraction: 0.1,
            trusted_tracked_count: 10,
            ..Default::default()
        };
        let opts = ScoreOptions {
            media_kind: Some("movie".to_string()),
            release_date: Some(days_ago_iso(50.0)),
            ..Default::default()
        };

        let mut ts = base_parsed();
        ts.source = Source::TS;
        let ts_adj = fresh_theatrical_adjust(&ts, &opts, false, Some(&corpus));
        assert!(
            ts_adj.delta > 0.0,
            "telesync should stay boosted in a dominated window at day 50, got {}",
            ts_adj.delta
        );

        let mut web = base_parsed();
        web.source = Source::WEBRip;
        web.resolution = Resolution::UHD;
        let web_adj = fresh_theatrical_adjust(&web, &opts, false, Some(&corpus));
        assert!(
            web_adj.delta < 0.0,
            "fake webrip should be penalized in a dominated window at day 50, got {}",
            web_adj.delta
        );
    }

    #[test]
    fn fresh_non_dominated_still_skips_after_30_days() {
        let corpus = CorpusStats {
            days_since_release: Some(50.0),
            theater_capture_fraction: 0.1,
            webish_fraction: 0.7,
            trusted_tracked_count: 10,
            ..Default::default()
        };
        let opts = ScoreOptions {
            media_kind: Some("movie".to_string()),
            release_date: Some(days_ago_iso(50.0)),
            ..Default::default()
        };
        let mut web = base_parsed();
        web.source = Source::WEBRip;
        web.resolution = Resolution::UHD;
        let adj = fresh_theatrical_adjust(&web, &opts, false, Some(&corpus));
        assert_eq!(
            adj.delta, 0.0,
            "a non-theater-dominated pool past 30 days must skip the fresh heuristic"
        );
    }

    #[test]
    fn scoring_4k_hdr_with_atmos_and_hevc() {
        let mut p = base_parsed();
        p.resolution = Resolution::UHD;
        p.hdr_format = Some(HdrFormat::Hdr10);
        p.codec = Codec::Hevc;
        p.audio = AudioInfo {
            codec: AudioCodec::Atmos,
            channels: 8,
            bit_depth: None,
        };
        p.source = Source::WebDl;

        let scored = score_stream(p, &empty_opts(), &empty_corpus());
        assert_eq!(scored.score, 36.0);
        assert_eq!(scored.tier, Tier::UhdHdr);

        let signals: Vec<&str> = scored.reasons.iter().map(|r| r.signal.as_str()).collect();
        assert!(signals.contains(&"4K"));
        assert!(signals.contains(&"HDR10"));
        assert!(signals.contains(&"HEVC"));
        assert!(signals.contains(&"Atmos"));
        assert!(signals.contains(&"8.0 channels"));
    }

    #[test]
    fn scoring_4k_dv_uses_dv_tier_and_higher_hdr_delta() {
        let mut p = base_parsed();
        p.resolution = Resolution::UHD;
        p.hdr_format = Some(HdrFormat::DvHdr10);
        let scored = score_stream(p, &empty_opts(), &empty_corpus());
        assert_eq!(scored.score, 31.0);
        assert_eq!(scored.tier, Tier::UhdDv);
        let dv = scored
            .reasons
            .iter()
            .find(|r| r.signal == "DV+HDR10")
            .unwrap();
        assert_eq!(dv.delta, 6.0);
    }

    #[test]
    fn scoring_cached_debrid_and_strong_addon() {
        let mut p = base_parsed();
        p.stream.addon_name = "MediaFusion".to_string();
        p.cached.insert("rd".to_string(), true);
        let opts = ScoreOptions {
            active_debrids: vec!["rd".to_string()],
            ..Default::default()
        };
        let scored = score_stream(p, &opts, &empty_corpus());
        assert_eq!(scored.score, 88.0);
        let signals: Vec<&str> = scored.reasons.iter().map(|r| r.signal.as_str()).collect();
        assert!(signals.contains(&"cached"));
        assert!(signals.contains(&"strong-addon"));
        assert!(!signals.contains(&"easynews-direct"));
    }

    #[test]
    fn scoring_easynews_addon_treated_as_cached_alternative() {
        let mut p = base_parsed();
        p.stream.addon_name = "Easynews+".to_string();
        let scored = score_stream(p, &empty_opts(), &empty_corpus());
        let signals: Vec<&str> = scored.reasons.iter().map(|r| r.signal.as_str()).collect();
        assert!(signals.contains(&"easynews-direct"));
        assert_eq!(scored.score, 84.0);
    }

    #[test]
    fn scoring_cam_source_penalized_and_marked_rough() {
        let mut p = base_parsed();
        p.source = Source::CAM;
        p.resolution = Resolution::P720;
        let scored = score_stream(p, &empty_opts(), &empty_corpus());
        assert_eq!(scored.score, -72.0);
        assert_eq!(scored.tier, Tier::Rough);
    }

    #[test]
    fn scoring_seeders_below_10_no_boost_unless_zero_with_hash() {
        let mut p = base_parsed();
        p.seeders = Some(5);
        p.stream.info_hash = Some("abc".to_string());
        let scored = score_stream(p, &empty_opts(), &empty_corpus());
        assert_eq!(scored.score, 20.0);

        let mut p2 = base_parsed();
        p2.seeders = Some(0);
        p2.stream.info_hash = Some("abc".to_string());
        let scored2 = score_stream(p2, &empty_opts(), &empty_corpus());
        assert_eq!(scored2.score, -8.0);
        let signals: Vec<&str> = scored2.reasons.iter().map(|r| r.signal.as_str()).collect();
        assert!(signals.contains(&"zero-seeders-stale-meta"));
        assert!(signals.contains(&"zero-seeders-soft"));

        let mut p3 = base_parsed();
        p3.seeders = Some(95);
        let scored3 = score_stream(p3, &empty_opts(), &empty_corpus());
        assert_eq!(scored3.score, 29.0);

        let mut p4 = base_parsed();
        p4.seeders = Some(500);
        let scored4 = score_stream(p4, &empty_opts(), &empty_corpus());
        assert_eq!(scored4.score, 30.0);
    }

    #[test]
    fn scoring_preferred_language_match_and_mismatch() {
        let mut p = base_parsed();
        p.audio_languages = vec!["English".to_string()];
        let opts = ScoreOptions {
            preferred_languages: vec!["en".to_string()],
            ..Default::default()
        };
        let scored = score_stream(p, &opts, &empty_corpus());
        assert_eq!(scored.score, 32.0);

        let mut p2 = base_parsed();
        p2.audio_languages = vec!["French".to_string()];
        let scored2 = score_stream(p2, &opts, &empty_corpus());
        assert_eq!(scored2.score, 6.0);

        let mut p3 = base_parsed();
        p3.audio_languages = vec![];
        let scored3 = score_stream(p3, &opts, &empty_corpus());
        assert_eq!(scored3.score, 17.0);

        let mut p4 = base_parsed();
        p4.audio_languages = vec!["Multi".to_string()];
        let scored4 = score_stream(p4, &opts, &empty_corpus());
        assert_eq!(scored4.score, 24.0);
    }

    #[test]
    fn tier_assignment_edge_cases() {
        let mut p = base_parsed();
        p.resolution = Resolution::UHD;
        p.hdr_format = Some(HdrFormat::Dv);
        assert_eq!(tier_of(&p), Tier::UhdDv);

        p.hdr_format = Some(HdrFormat::Hdr10);
        assert_eq!(tier_of(&p), Tier::UhdHdr);

        p.hdr_format = None;
        assert_eq!(tier_of(&p), Tier::Uhd);

        p.resolution = Resolution::P1080;
        assert_eq!(tier_of(&p), Tier::P1080);
        p.hdr_format = Some(HdrFormat::Hlg);
        assert_eq!(tier_of(&p), Tier::P1080Hdr);

        p.resolution = Resolution::P720;
        p.hdr_format = None;
        assert_eq!(tier_of(&p), Tier::P720);

        p.resolution = Resolution::P480;
        assert_eq!(tier_of(&p), Tier::SD);

        p.source = Source::SCR;
        assert_eq!(tier_of(&p), Tier::Rough);

        p.source = Source::CAM;
        p.resolution = Resolution::UHD;
        p.hdr_format = Some(HdrFormat::Dv);
        assert_eq!(tier_of(&p), Tier::Rough);
    }

    #[test]
    fn rank_and_pick_picks_cached_top_tier() {
        let mut p1 = base_parsed();
        p1.resolution = Resolution::P1080;
        let s1 = ScoredStream {
            parsed: p1,
            score: 30.0,
            reasons: vec![],
            tier: Tier::P1080,
        };

        let mut p2 = base_parsed();
        p2.resolution = Resolution::UHD;
        p2.cached.insert("rd".to_string(), true);
        let s2 = ScoredStream {
            parsed: p2,
            score: 90.0,
            reasons: vec![],
            tier: Tier::Uhd,
        };

        let mut p3 = base_parsed();
        p3.resolution = Resolution::P720;
        p3.cached.insert("rd".to_string(), true);
        let s3 = ScoredStream {
            parsed: p3,
            score: 50.0,
            reasons: vec![],
            tier: Tier::P720,
        };

        let active = vec!["rd".to_string()];
        let picker = rank_and_pick(vec![s1, s2, s3], &active, false);
        let primary = picker.primary.as_ref().expect("primary should exist");
        assert_eq!(primary.tier, Tier::Uhd);
        assert_eq!(primary.score, 90.0);

        assert!(picker.by_tier.contains_key("4K"));
        assert!(picker.by_tier.contains_key("1080p"));
        assert!(picker.by_tier.contains_key("720p"));
        assert_eq!(picker.all.len(), 3);
        assert!(is_cached_scored(&picker.all[0], &active));
    }

    #[test]
    fn rank_and_pick_preserves_addon_order_when_no_cached() {
        let mut p1 = base_parsed();
        p1.resolution = Resolution::P1080;
        let s1 = ScoredStream {
            parsed: p1,
            score: 30.0,
            reasons: vec![],
            tier: Tier::P1080,
        };
        let mut p2 = base_parsed();
        p2.resolution = Resolution::UHD;
        let s2 = ScoredStream {
            parsed: p2,
            score: 40.0,
            reasons: vec![],
            tier: Tier::Uhd,
        };
        let active = vec!["rd".to_string()];
        let picker = rank_and_pick(vec![s1, s2], &active, false);
        let primary = picker.primary.as_ref().unwrap();
        assert_eq!(primary.tier, Tier::P1080);
    }

    #[test]
    fn rank_and_pick_addon_order_preserves_return_index_over_score() {
        let mut p1 = base_parsed();
        p1.resolution = Resolution::P1080;
        p1.stream.addon_priority = Some(0);
        p1.stream.addon_return_idx = Some(0);
        p1.stream.url = Some("http://a/1080".to_string());
        let s1 = ScoredStream {
            parsed: p1,
            score: 30.0,
            reasons: vec![],
            tier: Tier::P1080,
        };
        let mut p2 = base_parsed();
        p2.resolution = Resolution::UHD;
        p2.stream.addon_priority = Some(0);
        p2.stream.addon_return_idx = Some(1);
        p2.stream.url = Some("http://a/4k".to_string());
        let s2 = ScoredStream {
            parsed: p2,
            score: 40.0,
            reasons: vec![],
            tier: Tier::Uhd,
        };
        let active = vec!["rd".to_string()];
        let picker = rank_and_pick(vec![s2, s1], &active, true);
        assert_eq!(
            picker.all[0].tier,
            Tier::P1080,
            "same-addon return index 0 must rank first over the higher-scored UHD"
        );
        assert_eq!(picker.primary.as_ref().unwrap().tier, Tier::P1080);
    }

    #[test]
    fn rank_and_pick_skips_theater_sources_for_primary() {
        let mut p1 = base_parsed();
        p1.source = Source::CAM;
        let s1 = ScoredStream {
            parsed: p1,
            score: 0.0,
            reasons: vec![],
            tier: Tier::Rough,
        };
        let mut p2 = base_parsed();
        p2.resolution = Resolution::P1080;
        let s2 = ScoredStream {
            parsed: p2,
            score: 0.0,
            reasons: vec![],
            tier: Tier::P1080,
        };
        let active: Vec<String> = vec![];
        let picker = rank_and_pick(vec![s1, s2], &active, false);
        let primary = picker.primary.as_ref().unwrap();
        assert_eq!(primary.tier, Tier::P1080);
    }

    #[test]
    fn corpus_stats_basic_fractions() {
        let mut a = base_parsed();
        a.source = Source::CAM;
        a.cached.insert("rd".to_string(), true);
        let mut b = base_parsed();
        b.source = Source::WebDl;
        b.seeders = Some(100);
        let mut c = base_parsed();
        c.source = Source::HDTV;
        c.seeders = Some(5);
        let mut d = base_parsed();
        d.source = Source::BluRay;
        d.stream.url = Some("https://example.com/x".to_string());

        let opts = ScoreOptions {
            active_debrids: vec!["rd".to_string()],
            ..Default::default()
        };
        let cs = compute_corpus_stats(&[a, b, c, d], &opts);
        assert_eq!(cs.trusted_tracked_count, 3);
        assert!((cs.trusted_tracked_fraction - 0.75).abs() < 1e-9);
        assert!((cs.theater_capture_fraction - (1.0 / 3.0)).abs() < 1e-9);
        assert!((cs.webish_fraction - (2.0 / 3.0)).abs() < 1e-9);
    }

    #[test]
    fn corpus_stats_empty_avoids_divide_by_zero() {
        let cs = compute_corpus_stats(&[], &ScoreOptions::default());
        assert_eq!(cs.trusted_tracked_count, 0);
        assert_eq!(cs.trusted_tracked_fraction, 0.0);
        assert_eq!(cs.theater_capture_fraction, 0.0);
        assert_eq!(cs.webish_fraction, 0.0);
        assert!(cs.median_size.is_none());
    }

    #[test]
    fn corpus_stats_size_percentiles() {
        let mut streams = Vec::new();
        for sz in [1u64, 5, 10, 50, 100] {
            let mut p = base_parsed();
            p.size = Some(sz);
            streams.push(p);
        }
        let cs = compute_corpus_stats(&streams, &ScoreOptions::default());
        assert_eq!(cs.median_size, Some(10));
        assert_eq!(cs.p90_size, Some(50));
    }

    #[test]
    fn proper_repack_iteration_logic() {
        let mut p = base_parsed();
        p.proper = true;
        let scored = score_stream(p, &empty_opts(), &empty_corpus());
        assert_eq!(scored.score, 21.0);
        let proper = scored.reasons.iter().find(|r| r.signal == "PROPER").unwrap();
        assert_eq!(proper.delta, 1.0);

        let mut p2 = base_parsed();
        p2.repack_iteration = 1;
        let scored2 = score_stream(p2, &empty_opts(), &empty_corpus());
        assert_eq!(scored2.score, 21.0);
        let r = scored2.reasons.iter().find(|r| r.signal == "REPACK1").unwrap();
        assert_eq!(r.delta, 1.0);

        let mut p3 = base_parsed();
        p3.repack_iteration = 5;
        let scored3 = score_stream(p3, &empty_opts(), &empty_corpus());
        assert_eq!(scored3.score, 22.0);
        let r = scored3.reasons.iter().find(|r| r.signal == "REPACK5").unwrap();
        assert_eq!(r.delta, 2.0);
    }

    #[test]
    fn trusted_release_group_and_remux_bonuses() {
        let mut p = base_parsed();
        p.release_group_normalized = Some("FLUX".to_string());
        p.remux = true;
        p.source = Source::BluRay;
        let scored = score_stream(p, &empty_opts(), &empty_corpus());
        assert_eq!(scored.score, 25.0);
    }

    #[test]
    fn cam_in_filename_penalty_for_1080p_word() {
        let mut p = base_parsed();
        p.resolution = Resolution::P1080;
        p.source = Source::WebDl;
        p.stream.title = Some("Some.Movie.1080p.WEB-DL.HDCAM.mkv".to_string());
        let scored = score_stream(p, &empty_opts(), &empty_corpus());
        assert_eq!(scored.score, -80.0);
        let signals: Vec<&str> = scored.reasons.iter().map(|r| r.signal.as_str()).collect();
        assert!(signals.contains(&"title-says-hires-filename-says-cam"));
    }

    #[test]
    fn scoring_addon_priority_bonus_decays_with_position() {
        let mut p0 = base_parsed();
        p0.stream.addon_priority = Some(0);
        assert_eq!(score_stream(p0, &empty_opts(), &empty_corpus()).score, 32.0);

        let mut p2 = base_parsed();
        p2.stream.addon_priority = Some(2);
        assert_eq!(score_stream(p2, &empty_opts(), &empty_corpus()).score, 24.0);

        let mut p5 = base_parsed();
        p5.stream.addon_priority = Some(5);
        assert_eq!(score_stream(p5, &empty_opts(), &empty_corpus()).score, 20.0);

        let none = base_parsed();
        assert_eq!(score_stream(none, &empty_opts(), &empty_corpus()).score, 20.0);
    }

    #[test]
    fn rank_and_pick_prefers_higher_scored_cached_regardless_of_input_order() {
        let mut backup = base_parsed();
        backup.cached.insert("rd".to_string(), true);
        backup.stream.addon_priority = Some(4);
        let s_backup = ScoredStream {
            parsed: backup,
            score: 80.0,
            reasons: vec![],
            tier: Tier::P1080,
        };

        let mut top = base_parsed();
        top.cached.insert("rd".to_string(), true);
        top.stream.addon_priority = Some(0);
        let s_top = ScoredStream {
            parsed: top,
            score: 92.0,
            reasons: vec![],
            tier: Tier::P1080,
        };

        let active = vec!["rd".to_string()];
        let picker = rank_and_pick(vec![s_backup, s_top], &active, false);
        let primary = picker.primary.as_ref().unwrap();
        assert_eq!(primary.score, 92.0);
        assert_eq!(primary.parsed.stream.addon_priority, Some(0));
    }
}
