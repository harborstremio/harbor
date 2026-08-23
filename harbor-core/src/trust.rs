//! Trust filter. Mirror of `src/lib/streams/trust.ts`.

#![allow(dead_code)]

use crate::types::*;
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};

const KIB: u64 = 1024;
const MIB: u64 = KIB * 1024;
const GIB: u64 = MIB * 1024;

const TINY_STUB_FLOOR: u64 = 5 * MIB;

fn movie_min_size(r: Resolution, in_cinema: bool, older: bool) -> u64 {
    let (cinema, normal, older_floor) = match r {
        Resolution::UHD => (2560 * MIB, 1536 * MIB, 600 * MIB),
        Resolution::P1080 => ((GIB * 6).div_ceil(5), 700 * MIB, 250 * MIB),
        Resolution::P720 => (600 * MIB, 400 * MIB, 120 * MIB),
        Resolution::P480 => (250 * MIB, 150 * MIB, 50 * MIB),
        Resolution::SD => (200 * MIB, 100 * MIB, 25 * MIB),
    };
    if older { older_floor } else if in_cinema { cinema } else { normal }
}

fn episode_min_size(r: Resolution, in_cinema: bool, older: bool) -> u64 {
    let (cinema, normal, older_floor) = match r {
        Resolution::UHD => (1024 * MIB, 600 * MIB, 200 * MIB),
        Resolution::P1080 => (400 * MIB, 250 * MIB, 100 * MIB),
        Resolution::P720 => (200 * MIB, 120 * MIB, 40 * MIB),
        Resolution::P480 => (80 * MIB, 50 * MIB, 12 * MIB),
        Resolution::SD => (50 * MIB, 30 * MIB, 8 * MIB),
    };
    if older { older_floor } else if in_cinema { cinema } else { normal }
}

fn anime_episode_min_size(r: Resolution, in_cinema: bool, older: bool) -> u64 {
    let (cinema, normal, older_floor) = match r {
        Resolution::UHD => (600 * MIB, 400 * MIB, 150 * MIB),
        Resolution::P1080 => (220 * MIB, 150 * MIB, 50 * MIB),
        Resolution::P720 => (100 * MIB, 60 * MIB, 20 * MIB),
        Resolution::P480 => (40 * MIB, 28 * MIB, 8 * MIB),
        Resolution::SD => (25 * MIB, 18 * MIB, 5 * MIB),
    };
    if older { older_floor } else if in_cinema { cinema } else { normal }
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

const FILENAME_BLACKLIST: &[&str] = &[
    ".exe", ".zip", ".rar", ".lnk", ".scr", ".bat", ".iso", ".img",
];

static SHORT_FORMAT_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)\b(short|shorts|mini|mini[\s.\-_]?episode|ova|special|specials|skit|sketch|chibi|micro|webisode|vignette|interlude)\b",
    )
    .unwrap()
});

static PLACEHOLDER_BANNER_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)(?:🚫|⚠️?|❗|ℹ️?)\s*(?:no\s+streams?\s+(?:found|available)|streams?\s+filtered|streams?\s+blocked|filtered)",
    )
    .unwrap()
});

static STATUS_LINE_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)\b(?:expires?\s+in|days?\s+left|premium\s+(?:active|expir(?:ed|ing))|api\s+limit|quota\s+used)\b",
    )
    .unwrap()
});

static VIDEO_EXT_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\.(mkv|mp4|m4v|avi|webm|mov|ts)(\?|$)").unwrap());

static TRAILER_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)(?:^|[^a-z0-9])(?:trailer|teaser|tlr|trl|tra(?:iler)?|sneak[\s.\-_]?peek|preview|behind[\s.\-_]?the[\s.\-_]?scenes|featurette|making[\s.\-_]?of|deleted[\s.\-_]?scene|bloopers?|gag[\s.\-_]?reel|extras?|promo)(?:$|[^a-z0-9])",
    )
    .unwrap()
});

static FAKE_STUDIO_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(?:^|[^a-z0-9])(?:dragon[\s._-]?money|telesynch)(?:$|[^a-z0-9])").unwrap()
});

static SEQUEL_TAIL_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)(?:\s|^)(\d{1,2}|[ivx]+)\s*$").unwrap());

static NUMBER_NAME_TAIL_RX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(?:\bno\.?|\bnr\.?|\bnumber|#|n°|№)\s*(?:\d{1,2}|[ivx]+)\s*$").unwrap()
});

static YEAR_PAREN_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"\(\d{4}\)").unwrap());

static PART_WORD_RX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\b(part|chapter|vol|volume)\b").unwrap());

static WORD_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"[a-z0-9]+").unwrap());

static ANIME_JA_RX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)^(ja|jp|jap|japanese)").unwrap());

static TITLE_STOPWORDS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        "the", "a", "an", "of", "and", "in", "to", "for", "on", "at", "by", "is", "or", "as",
        "from", "with", "into", "movie", "film",
    ]
    .into_iter()
    .collect()
});

fn roman_to_num(s: &str) -> Option<i32> {
    match s {
        "ii" => Some(2),
        "iii" => Some(3),
        "iv" => Some(4),
        "v" => Some(5),
        "vi" => Some(6),
        "vii" => Some(7),
        "viii" => Some(8),
        "ix" => Some(9),
        "x" => Some(10),
        _ => None,
    }
}

pub struct TrustResult {
    pub keep: Vec<ParsedStream>,
    pub rejected: Vec<Rejection>,
}

pub fn apply_trust(streams: Vec<ParsedStream>, opts: &TrustOptions) -> TrustResult {
    if opts.disabled {
        return TrustResult {
            keep: streams,
            rejected: Vec::new(),
        };
    }
    let strict = opts.strict;
    let in_cinema_window = is_in_cinema_window(opts.release_date.as_deref());
    let older_catalog = is_older_catalog(opts.release_date.as_deref(), opts.expected_year);

    let mut keep: Vec<ParsedStream> = Vec::with_capacity(streams.len());
    let mut rejected: Vec<Rejection> = Vec::new();
    for s in streams {
        match check_one(&s, opts, strict, in_cinema_window, older_catalog) {
            Some(reason) => rejected.push(Rejection { stream: s, reason }),
            None => keep.push(s),
        }
    }
    TrustResult { keep, rejected }
}

fn check_one(
    s: &ParsedStream,
    opts: &TrustOptions,
    strict: bool,
    in_cinema_window: bool,
    older_catalog: bool,
) -> Option<String> {
    let has_playable = s.stream.url.is_some()
        || s.stream.info_hash.is_some()
        || s.stream.yt_id.is_some()
        || s.stream.external_url.is_some()
        || s.stream.extra.contains_key("nzbUrl");
    if !has_playable {
        return Some("no-playable-source".to_string());
    }

    let title_name_desc = format!(
        "{} {} {}",
        s.stream.title.as_deref().unwrap_or(""),
        s.stream.name.as_deref().unwrap_or(""),
        s.stream.description.as_deref().unwrap_or("")
    );
    if PLACEHOLDER_BANNER_RX.is_match(&title_name_desc) {
        return Some("addon-placeholder-banner".to_string());
    }
    let url_is_video = s
        .stream
        .url
        .as_deref()
        .map(|u| VIDEO_EXT_RX.is_match(u))
        .unwrap_or(false);
    if s.stream.info_hash.is_none()
        && !url_is_video
        && STATUS_LINE_RX.is_match(&title_name_desc)
    {
        let bh = s.stream.behavior_hints.as_ref();
        let has_video_size = bh
            .and_then(|b| b.get("videoSize"))
            .and_then(|v| v.as_f64())
            .map(|n| n != 0.0)
            .unwrap_or(false);
        let has_filename = bh
            .and_then(|b| b.get("filename"))
            .and_then(|v| v.as_str())
            .map(|f| !f.is_empty())
            .unwrap_or(false);
        if !has_video_size && !has_filename {
            return Some("addon-status-card".to_string());
        }
    }

    let filename = behavior_hint_filename(s).unwrap_or_default().to_lowercase();
    let title_lower = s.stream.title.as_deref().unwrap_or("").to_lowercase();
    let name_lower = s.stream.name.as_deref().unwrap_or("").to_lowercase();
    let haystack = format!("{filename} {title_lower} {name_lower}");

    for ext in FILENAME_BLACKLIST {
        if filename.ends_with(ext) {
            return Some(format!("suspicious-extension:{ext}"));
        }
    }

    if TRAILER_RX.is_match(&haystack) {
        return Some("trailer-or-extra".to_string());
    }

    if is_fake_group(s, &haystack) {
        return Some("known-fake-group".to_string());
    }

    if let Some(sz) = s.size {
        if sz < TINY_STUB_FLOOR {
            return Some("size-stub".to_string());
        }
    }

    let kind_is_movie = opts.kind.as_deref() == Some("movie");
    let kind_is_series = opts.kind.as_deref() == Some("series");

    if kind_is_movie {
        if let Some(sz) = s.size {
            let floor = movie_min_size(s.resolution, in_cinema_window, older_catalog);
            if sz < floor {
                return Some(format!(
                    "movie-stub-too-small-for-{}",
                    resolution_label(s.resolution)
                ));
            }
        }
    }

    if kind_is_movie
        && in_cinema_window
        && !matches!(s.source, Source::CAM | Source::TS | Source::HDTS | Source::TC)
    {
        if let Some(sz) = s.size {
            let size_mb = (sz as f64 / MIB as f64).round() as u64;
            if sz < 250 * MIB {
                return Some(format!("new-release-virus-{size_mb}mb"));
            }
            if sz < 500 * MIB && !is_short_format(s) {
                return Some(format!("new-release-stub-{size_mb}mb"));
            }
        }
    }

    if kind_is_movie && !opts.is_anime
        && (s.season_pack || s.season.is_some() || s.episode.is_some()) {
            return Some("series-result-for-movie".to_string());
        }

    if strict
        && kind_is_movie
        && !opts.is_anime
        && in_cinema_window
        && opts.expected_year.is_some()
        && s.year.is_none()
        && matches!(s.source, Source::Other)
        && matches!(s.resolution, Resolution::SD)
    {
        return Some("cinema-bare-untagged".to_string());
    }

    if strict && kind_is_movie {
        if let Some(expected) = opts.expected_title.as_deref() {
            if !s.parsed_title.is_empty()
                && !title_matches(
                    expected,
                    &s.parsed_title,
                    s.year.map(|y| y as i32),
                    opts.expected_year.map(|y| y as i32),
                )
            {
                return Some("title-mismatch".to_string());
            }
        }
    }

    if strict && kind_is_movie && in_cinema_window {
        if let (Some(sy), Some(ey)) = (s.year, opts.expected_year) {
            if sy != ey {
                return Some(format!("cinema-year-mismatch:{sy}-vs-{ey}"));
            }
        }
    }

    if strict && kind_is_movie {
        if let Some(expected) = opts.expected_title.as_deref() {
            if let Some(expected_seq) = sequel_marker(expected) {
                if expected_seq >= 2 {
                    let title_str = s.stream.title.as_deref().unwrap_or("");
                    let haystack = format!("{filename} {title_str}").to_lowercase();
                    if !haystack_has_sequel_token(&haystack, expected_seq) {
                        return Some("filename-missing-sequel".to_string());
                    }
                }
            }
        }
    }

    if strict && kind_is_movie && in_cinema_window {
        if matches!(s.source, Source::BluRay) || s.remux {
            return Some("fresh-cinema-fake-bluray".to_string());
        }
        if matches!(s.resolution, Resolution::UHD)
            && matches!(
                s.source,
                Source::WebDl | Source::WEBRip | Source::BDRip | Source::HDRip
            )
        {
            return Some("fresh-cinema-fake-4k-web".to_string());
        }
        if matches!(s.resolution, Resolution::P1080 | Resolution::P720)
            && matches!(
                s.source,
                Source::WebDl | Source::WEBRip | Source::BDRip | Source::HDRip
            )
        {
            return Some("fresh-cinema-fake-web".to_string());
        }
        if matches!(s.source, Source::HDTV)
            && matches!(s.resolution, Resolution::UHD | Resolution::P1080)
        {
            return Some("fresh-cinema-fake-hdtv".to_string());
        }
    }

    if kind_is_series {
        if let Some(sz) = s.size {
            if !is_short_format(s) {
                let floor = if opts.is_anime {
                    anime_episode_min_size(s.resolution, in_cinema_window, older_catalog)
                } else {
                    episode_min_size(s.resolution, in_cinema_window, older_catalog)
                };
                if sz < floor {
                    return Some(format!(
                        "episode-stub-too-small-for-{}",
                        resolution_label(s.resolution)
                    ));
                }
            }
        }
    }

    if strict && kind_is_series && !opts.is_anime {
        if let Some(expected) = opts.expected_title.as_deref() {
            if !s.parsed_title.is_empty()
                && !title_matches(
                    expected,
                    &s.parsed_title,
                    s.year.map(|y| y as i32),
                    opts.expected_year.map(|y| y as i32),
                )
            {
                return Some("title-mismatch".to_string());
            }
        }
    }

    if strict
        && kind_is_series
        && opts.is_anime
        && !opts.expected_titles.is_empty()
        && !s.parsed_title.is_empty()
    {
        let ok = opts
            .expected_titles
            .iter()
            .any(|t| title_tokens_present(t, &s.parsed_title));
        if !ok {
            return Some("anime-title-mismatch".to_string());
        }
    }

    let has_file_idx = s.stream.file_idx.is_some();

    if strict && !opts.is_anime && !has_file_idx && !s.season_pack {
        if let (Some(expected_season), Some(season)) = (opts.expected_season, s.season) {
            if season != expected_season {
                return Some(format!(
                    "season-mismatch:{season}-vs-{expected_season}"
                ));
            }
        }
    }

    if strict && !opts.is_anime && !has_file_idx && !s.season_pack {
        if let (Some(expected_episode), Some(episode)) = (opts.expected_episode, s.episode) {
            if episode != expected_episode {
                return Some(format!(
                    "episode-mismatch:{episode}-vs-{expected_episode}"
                ));
            }
        }
    }

    // Continuous anime (One Piece) number absolutely → accept abs episode OR per-season pair.
    // Seasonal anime (SAO) have real seasons → strict season+episode. Fail-open on unparsed names/packs.
    if opts.is_anime && !s.season_pack {
        if let Some(episode) = s.episode {
            if opts.continuous_anime {
                let abs_ok = Some(episode) == opts.expected_episode;
                let rel_ok = Some(episode) == opts.alt_expected_episode
                    && s.season == opts.alt_expected_season;
                if !abs_ok && !rel_ok {
                    let season_part = s
                        .season
                        .map(|v| format!("S{v}"))
                        .unwrap_or_else(|| "S?".to_string());
                    return Some(format!(
                        "episode-mismatch-anime:{season_part}E{episode} vs abs {} / rel S{}E{}",
                        opts.expected_episode.unwrap_or_default(),
                        opts.alt_expected_season.unwrap_or_default(),
                        opts.alt_expected_episode.unwrap_or_default(),
                    ));
                }
            } else if let Some(expected_episode) = opts.expected_episode {
                if episode != expected_episode {
                    return Some(format!(
                        "episode-mismatch-anime:S{}E{episode}-vs-E{expected_episode}",
                        s.season.map(|v| v.to_string()).unwrap_or_else(|| "?".to_string()),
                    ));
                }
                if let (Some(expected_season), Some(season)) = (opts.expected_season, s.season) {
                    if season != expected_season {
                        return Some(format!(
                            "season-mismatch-anime:S{season}-vs-S{expected_season}"
                        ));
                    }
                }
            }
        }
    }

    if s.scam_score >= 5 && !opts.allow_cam && !older_catalog {
        return Some(format!("scam-score-{}", s.scam_score));
    }

    None
}

fn behavior_hint_filename(s: &ParsedStream) -> Option<&str> {
    let bh = s.stream.behavior_hints.as_ref()?;
    bh.get("filename")
        .and_then(|v| v.as_str())
        .or_else(|| bh.get("fileName").and_then(|v| v.as_str()))
}

fn is_fake_group(s: &ParsedStream, haystack: &str) -> bool {
    if let Some(g) = s.release_group_normalized.as_deref() {
        if matches!(
            g,
            "LAMA" | "DJT" | "TELLY" | "RUDE" | "TELESYNC" | "TELESYNCH" | "DRAGONMONEY"
        ) {
            return true;
        }
    }
    FAKE_STUDIO_RX.is_match(haystack)
}

fn is_short_format(s: &ParsedStream) -> bool {
    let filename = behavior_hint_filename(s).unwrap_or_default();
    let haystack = format!(
        "{} {} {}",
        filename,
        s.stream.title.as_deref().unwrap_or(""),
        s.stream.name.as_deref().unwrap_or("")
    );
    SHORT_FORMAT_RX.is_match(&haystack)
}

fn haystack_has_sequel_token(haystack: &str, expected_seq: i32) -> bool {
    let digit = expected_seq.to_string();
    let roman = match expected_seq {
        2 => Some("ii"),
        3 => Some("iii"),
        4 => Some("iv"),
        5 => Some("v"),
        6 => Some("vi"),
        7 => Some("vii"),
        8 => Some("viii"),
        9 => Some("ix"),
        10 => Some("x"),
        _ => None,
    };
    let word = match expected_seq {
        2 => Some("two"),
        3 => Some("three"),
        4 => Some("four"),
        5 => Some("five"),
        6 => Some("six"),
        7 => Some("seven"),
        8 => Some("eight"),
        9 => Some("nine"),
        10 => Some("ten"),
        _ => None,
    };
    for token in WORD_RX.find_iter(haystack) {
        let tok = token.as_str();
        if tok == digit {
            return true;
        }
        if let Some(r) = roman {
            if tok == r {
                return true;
            }
        }
        if let Some(w) = word {
            if tok == w {
                return true;
            }
        }
    }
    false
}

fn sequel_marker(title: &str) -> Option<i32> {
    let no_year = YEAR_PAREN_RX.replace_all(title, "");
    let no_part = PART_WORD_RX.replace_all(&no_year, "");
    let trimmed = no_part.trim();
    if NUMBER_NAME_TAIL_RX.is_match(trimmed) {
        return None;
    }
    let m = SEQUEL_TAIL_RX.captures(trimmed)?;
    let tok = m.get(1)?.as_str().to_lowercase();
    if tok.chars().all(|c| c.is_ascii_digit()) {
        let n: i32 = tok.parse().ok()?;
        if (2..=20).contains(&n) {
            return Some(n);
        }
        return None;
    }
    roman_to_num(&tok)
}

fn year_tolerance_for(expected_year: Option<i32>) -> i32 {
    let Some(ey) = expected_year else { return 1 };
    let age = current_year() - ey;
    if age >= 30 {
        4
    } else if age >= 15 {
        3
    } else if age >= 5 {
        2
    } else {
        1
    }
}

fn title_matches(
    expected: &str,
    parsed: &str,
    parsed_year: Option<i32>,
    expected_year: Option<i32>,
) -> bool {
    let expected_seq = sequel_marker(expected);
    let parsed_seq = sequel_marker(parsed);
    let year_tolerance = year_tolerance_for(expected_year);
    if let (Some(e), Some(p)) = (expected_seq, parsed_seq) {
        if e != p {
            return false;
        }
    }
    if expected_seq.is_some() && parsed_seq.is_none() {
        match (expected_year, parsed_year) {
            (Some(ey), Some(py)) => {
                if (py - ey).abs() > year_tolerance {
                    return false;
                }
            }
            _ => return false,
        }
    }
    if expected_seq.is_none() {
        if let Some(ps) = parsed_seq {
            if ps >= 2 {
                match (expected_year, parsed_year) {
                    (Some(ey), Some(py)) => {
                        if (py - ey).abs() > year_tolerance {
                            return false;
                        }
                    }
                    _ => return false,
                }
            }
        }
    }

    let expected_tokens = tokenize(expected);
    let parsed_tokens = tokenize(parsed);
    if expected_tokens.is_empty() || parsed_tokens.is_empty() {
        return true;
    }
    let expected_set: HashSet<&str> = expected_tokens.iter().map(|s| s.as_str()).collect();
    let parsed_set: HashSet<&str> = parsed_tokens.iter().map(|s| s.as_str()).collect();
    let overlap = count_overlap(&expected_tokens, &parsed_set);
    let reverse_overlap = count_overlap(&parsed_tokens, &expected_set);
    let expected_ratio = overlap as f64 / expected_tokens.len() as f64;
    let parsed_ratio = reverse_overlap as f64 / parsed_tokens.len() as f64;
    if expected_tokens.len() <= 2 && parsed_tokens.len().saturating_sub(overlap) > 2 {
        return false;
    }
    expected_ratio >= 0.5 || parsed_ratio >= 0.5 || overlap >= 2
}

fn title_tokens_present(expected: &str, parsed: &str) -> bool {
    let expected_tokens = tokenize(expected);
    let parsed_tokens = tokenize(parsed);
    if expected_tokens.is_empty() || parsed_tokens.is_empty() {
        return true;
    }
    let expected_set: HashSet<&str> = expected_tokens.iter().map(|s| s.as_str()).collect();
    let parsed_set: HashSet<&str> = parsed_tokens.iter().map(|s| s.as_str()).collect();
    let overlap = count_overlap(&expected_tokens, &parsed_set);
    let reverse_overlap = count_overlap(&parsed_tokens, &expected_set);
    let expected_ratio = overlap as f64 / expected_tokens.len() as f64;
    let parsed_ratio = reverse_overlap as f64 / parsed_tokens.len() as f64;
    expected_ratio >= 0.5 || parsed_ratio >= 0.5 || overlap >= 2
}

fn count_overlap(words: &[String], lookup: &HashSet<&str>) -> usize {
    let mut hits = 0usize;
    for w in words {
        if lookup.contains(w.as_str()) {
            hits += 1;
            continue;
        }
        for l in lookup.iter() {
            if w.len() >= 4
                && l.len() >= 4
                && (w.starts_with(l) || l.starts_with(w.as_str()))
            {
                hits += 1;
                break;
            }
        }
    }
    hits
}

fn tokenize(text: &str) -> Vec<String> {
    use unicode_normalization::UnicodeNormalization;
    let stripped: String = text
        .to_lowercase()
        .nfkd()
        .filter(|c| {
            let cp = *c as u32;
            !(0x0300..=0x036F).contains(&cp)
        })
        .collect();
    WORD_RX
        .find_iter(&stripped)
        .map(|m| m.as_str().to_string())
        .filter(|w| w.len() >= 3 && !TITLE_STOPWORDS.contains(w.as_str()))
        .collect()
}

fn parse_iso_date_to_unix_ms(s: &str) -> Option<i64> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    let date_part = trimmed.split(['T', ' ']).next()?;
    let mut parts = date_part.split('-');
    let y: i64 = parts.next()?.parse().ok()?;
    let m: i64 = parts.next()?.parse().ok()?;
    let d: i64 = parts.next()?.parse().ok()?;
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    Some(days_from_civil(y, m, d) * 86_400_000)
}

fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let yy = if m <= 2 { y - 1 } else { y };
    let era = if yy >= 0 { yy } else { yy - 399 } / 400;
    let yoe = yy - era * 400;
    let mp = if m > 2 { m - 3 } else { m + 9 };
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn now_unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn current_year() -> i32 {
    let ms = now_unix_ms();
    let days = ms / 86_400_000;
    civil_from_days(days).0 as i32
}

fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (if mp < 10 { mp + 3 } else { mp - 9 }) as u32;
    let yr = if m <= 2 { y + 1 } else { y };
    (yr, m, d)
}

fn is_in_cinema_window(release_date: Option<&str>) -> bool {
    let Some(s) = release_date else { return false };
    let Some(ts) = parse_iso_date_to_unix_ms(s) else {
        return false;
    };
    let days = (now_unix_ms() - ts) as f64 / 86_400_000.0;
    days > -90.0 && days < 60.0
}

fn is_older_catalog(release_date: Option<&str>, expected_year: Option<u16>) -> bool {
    if let Some(s) = release_date {
        if let Some(ts) = parse_iso_date_to_unix_ms(s) {
            let days = (now_unix_ms() - ts) as f64 / 86_400_000.0;
            return days > 365.0 * 2.0;
        }
    }
    if let Some(ey) = expected_year {
        return current_year() - (ey as i32) > 2;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn base_stream() -> ParsedStream {
        ParsedStream {
            stream: Stream {
                addon_id: "addon".into(),
                addon_name: "Addon".into(),
                info_hash: Some("a".repeat(40)),
                ..Default::default()
            },
            parsed_title: "Sample Movie".into(),
            episode_title: None,
            resolution: Resolution::P1080,
            hdr_format: None,
            codec: Codec::Hevc,
            source: Source::WebDl,
            audio: AudioInfo::default(),
            audio_languages: Vec::new(),
            size: Some(2 * GIB),
            seeders: Some(50),
            cached: Default::default(),
            in_library: Default::default(),
            container: Some(Container::Mkv),
            release_group: None,
            release_group_normalized: None,
            remux: false,
            edition: None,
            year: Some(2020),
            year_range: None,
            season: None,
            episode: None,
            season_pack: false,
            disc_index: None,
            repack_iteration: 0,
            proper: false,
            hardcoded: false,
            anime_hash: None,
            scam_score: 0,
        }
    }

    fn opts_strict() -> TrustOptions {
        TrustOptions {
            strict: true,
            ..Default::default()
        }
    }

    #[test]
    fn keeps_clean_stream() {
        let s = base_stream();
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.keep.len(), 1);
        assert!(result.rejected.is_empty());
    }

    #[test]
    fn rejects_suspicious_extension() {
        let mut s = base_stream();
        s.stream.behavior_hints = Some(json!({ "filename": "Setup.exe" }));
        let result = apply_trust(vec![s], &opts_strict());
        assert!(result.keep.is_empty());
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "suspicious-extension:.exe");
    }

    #[test]
    fn allows_season_pack_when_flag_set() {
        let mut s = base_stream();
        s.season_pack = true;
        s.season = Some(1);
        s.episode = None;
        let mut opts = opts_strict();
        opts.allow_season_packs = true;
        opts.expected_season = Some(1);
        opts.expected_episode = Some(3);
        let result = apply_trust(vec![s], &opts);
        assert_eq!(result.keep.len(), 1);
        assert!(result.rejected.is_empty());
    }

    #[test]
    fn rejects_trailer_below_ceiling() {
        let mut s = base_stream();
        s.stream.behavior_hints = Some(json!({ "filename": "movie.trailer.mkv" }));
        s.size = Some(50 * MIB);
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "trailer-or-extra");
    }

    #[test]
    fn rejects_no_playable_source() {
        let mut s = base_stream();
        s.stream.info_hash = None;
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "no-playable-source");
    }

    #[test]
    fn keeps_nzb_only_stream() {
        let mut s = base_stream();
        s.stream.info_hash = None;
        s.stream
            .extra
            .insert("nzbUrl".into(), serde_json::Value::String("https://x/nzb".into()));
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.rejected.len(), 0);
    }

    #[test]
    fn rejects_size_stub() {
        let mut s = base_stream();
        s.size = Some(MIB);
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "size-stub");
    }

    #[test]
    fn rejects_scam_score() {
        let mut s = base_stream();
        s.scam_score = 7;
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "scam-score-7");
    }

    #[test]
    fn disabled_short_circuits() {
        let s = base_stream();
        let mut opts = opts_strict();
        opts.disabled = true;
        opts.expected_year = Some(1900);
        let mut bad = base_stream();
        bad.size = Some(500 * GIB);
        let result = apply_trust(vec![s, bad], &opts);
        assert_eq!(result.keep.len(), 2);
        assert!(result.rejected.is_empty());
    }

    #[test]
    fn rejects_series_result_for_movie() {
        let mut s = base_stream();
        s.parsed_title = "Obsession".into();
        s.season = Some(1);
        s.episode = Some(1);
        let mut opts = opts_strict();
        opts.kind = Some("movie".into());
        let result = apply_trust(vec![s], &opts);
        assert!(result.keep.is_empty());
        assert_eq!(result.rejected[0].reason, "series-result-for-movie");
    }

    #[test]
    fn rejects_season_pack_for_movie() {
        let mut s = base_stream();
        s.parsed_title = "Obsession".into();
        s.season_pack = true;
        s.season = Some(1);
        s.episode = None;
        let mut opts = opts_strict();
        opts.kind = Some("movie".into());
        let result = apply_trust(vec![s], &opts);
        assert!(result.keep.is_empty());
        assert_eq!(result.rejected[0].reason, "series-result-for-movie");
    }

    #[test]
    fn rejects_cinema_bare_untagged() {
        let days = now_unix_ms() / 86_400_000 - 7;
        let (y, m, d) = civil_from_days(days);
        let mut s = base_stream();
        s.parsed_title = "Obsession".into();
        s.year = None;
        s.source = Source::Other;
        s.resolution = Resolution::SD;
        let mut opts = opts_strict();
        opts.kind = Some("movie".into());
        opts.expected_year = Some(2025);
        opts.release_date = Some(format!("{y:04}-{m:02}-{d:02}"));
        let result = apply_trust(vec![s], &opts);
        assert!(result.keep.is_empty());
        assert_eq!(result.rejected[0].reason, "cinema-bare-untagged");
    }

    #[test]
    fn keeps_real_movie_in_cinema_window() {
        // Inside the cinema window the only physically-possible legit sources are
        // theater captures (CAM/TS/HDTS/TC); WEB/BluRay at this stage is a fake.
        // This asserts the fake-source filters do not over-reject a legit in-window
        // capture that matches the expected year.
        let days = now_unix_ms() / 86_400_000 - 7;
        let (y, m, d) = civil_from_days(days);
        let mut s = base_stream();
        s.parsed_title = "Obsession".into();
        s.year = Some(2025);
        s.source = Source::CAM;
        s.resolution = Resolution::P1080;
        let mut opts = opts_strict();
        opts.kind = Some("movie".into());
        opts.expected_year = Some(2025);
        opts.release_date = Some(format!("{y:04}-{m:02}-{d:02}"));
        let result = apply_trust(vec![s], &opts);
        assert_eq!(result.keep.len(), 1);
    }

    #[test]
    fn season_pack_with_file_idx_skips_episode_check() {
        let mut s = base_stream();
        s.stream.file_idx = Some(2);
        s.episode = Some(7);
        let mut opts = opts_strict();
        opts.expected_episode = Some(3);
        let result = apply_trust(vec![s], &opts);
        assert_eq!(result.keep.len(), 1);
    }

    #[test]
    fn rejects_placeholder_banner() {
        let mut s = base_stream();
        s.stream.description = Some("🚫 No streams found".into());
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "addon-placeholder-banner");
    }

    #[test]
    fn rejects_status_card() {
        let mut s = base_stream();
        s.stream.info_hash = None;
        s.stream.url = Some("https://example.com/account".into());
        s.stream.description = Some("Premium expires in 3 days".into());
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "addon-status-card");
    }

    #[test]
    fn does_not_hard_reject_uncached_emoji() {
        let mut s = base_stream();
        s.stream.name = Some("⏳ Cloud only".into());
        let result = apply_trust(vec![s], &opts_strict());
        assert!(result.rejected.iter().all(|r| r.reason != "addon-uncached-emoji"));
    }

    #[test]
    fn rejects_underscore_delimited_trailer() {
        let mut s = base_stream();
        s.stream.behavior_hints = Some(json!({ "filename": "Movie_2025_trailer_1080p.mkv" }));
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "trailer-or-extra");
    }

    #[test]
    fn rejects_cinema_year_mismatch() {
        let days = now_unix_ms() / 86_400_000 - 7;
        let (y, m, d) = civil_from_days(days);
        let mut s = base_stream();
        s.parsed_title = "The Strangers".into();
        s.year = Some(2008);
        s.resolution = Resolution::P720;
        s.source = Source::WebDl;
        let mut opts = opts_strict();
        opts.kind = Some("movie".into());
        opts.expected_year = Some(2025);
        opts.release_date = Some(format!("{y:04}-{m:02}-{d:02}"));
        let result = apply_trust(vec![s], &opts);
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "cinema-year-mismatch:2008-vs-2025");
    }

    #[test]
    fn rejects_fresh_cinema_fake_hdtv() {
        let days = now_unix_ms() / 86_400_000 - 7;
        let (y, m, d) = civil_from_days(days);
        let mut s = base_stream();
        s.parsed_title = "New Movie".into();
        s.year = Some(2025);
        s.source = Source::HDTV;
        s.resolution = Resolution::P1080;
        let mut opts = opts_strict();
        opts.kind = Some("movie".into());
        opts.expected_year = Some(2025);
        opts.release_date = Some(format!("{y:04}-{m:02}-{d:02}"));
        let result = apply_trust(vec![s], &opts);
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "fresh-cinema-fake-hdtv");
    }

    #[test]
    fn anime_keeps_small_episode_non_anime_rejects() {
        let mut s = base_stream();
        s.resolution = Resolution::P1080;
        s.size = Some(180 * MIB);
        let mut opts = opts_strict();
        opts.kind = Some("series".into());
        let non_anime = apply_trust(vec![s.clone()], &opts);
        assert_eq!(non_anime.rejected.len(), 1);
        assert_eq!(
            non_anime.rejected[0].reason,
            "episode-stub-too-small-for-1080p"
        );
        opts.is_anime = true;
        let anime = apply_trust(vec![s], &opts);
        assert_eq!(anime.keep.len(), 1);
    }

    #[test]
    fn short_format_exempts_small_episode() {
        let mut s = base_stream();
        s.stream.behavior_hints = Some(json!({ "filename": "Show.OVA.1080p.mkv" }));
        s.resolution = Resolution::P1080;
        s.size = Some(80 * MIB);
        let mut opts = opts_strict();
        opts.kind = Some("series".into());
        let result = apply_trust(vec![s], &opts);
        assert_eq!(result.keep.len(), 1);
    }

    #[test]
    fn title_short_guard_rejects_keyword_in_long_title() {
        let mut s = base_stream();
        s.parsed_title = "DBM Obsession Viva Las Vegas".into();
        s.year = Some(2025);
        let mut opts = opts_strict();
        opts.kind = Some("movie".into());
        opts.expected_title = Some("Obsession".into());
        opts.expected_year = Some(2025);
        let result = apply_trust(vec![s], &opts);
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "title-mismatch");
    }

    #[test]
    fn title_year_tolerance_scales_with_age() {
        assert!(title_matches("Rocky", "Rocky II", Some(1979), Some(1976)));
    }

    #[test]
    fn tokenize_decomposes_precomposed_accents() {
        assert_eq!(tokenize("Amélie"), vec!["amelie".to_string()]);
        assert_eq!(tokenize("Pokémon"), vec!["pokemon".to_string()]);
    }

    #[test]
    fn status_card_camelcase_filename_not_exempted() {
        let mut s = base_stream();
        s.stream.info_hash = None;
        s.stream.url = Some("https://example.com/acct".into());
        s.stream.description = Some("Premium expires in 3 days".into());
        s.stream.behavior_hints = Some(json!({ "fileName": "card.mkv" }));
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "addon-status-card");
    }

    #[test]
    fn trust_options_tolerates_null_expected_titles() {
        // The TS side sends `expectedTitles: null` for every non-anime request
        // (and anime without resolved aliases). That same object is deserialized
        // by the Rust core via Tauri invoke, so a literal JSON null must decode
        // to an empty list, not error out and silently disable the core path.
        let json = r#"{"kind":"movie","expectedTitles":null,"isAnime":false}"#;
        let opts: TrustOptions = serde_json::from_str(json).unwrap();
        assert!(opts.expected_titles.is_empty());
    }

    #[test]
    fn anime_title_gate_rejects_wrong_show_keeps_right() {
        let mut opts = opts_strict();
        opts.kind = Some("series".into());
        opts.is_anime = true;
        opts.expected_titles = vec![
            "Neon Genesis Evangelion".into(),
            "Shin Seiki Evangelion".into(),
        ];

        let mut wrong = base_stream();
        wrong.parsed_title = "Stranger Things".into();
        let rejected = apply_trust(vec![wrong], &opts);
        assert_eq!(rejected.rejected.len(), 1);
        assert_eq!(rejected.rejected[0].reason, "anime-title-mismatch");

        let mut right = base_stream();
        right.parsed_title = "Evangelion".into();
        let kept = apply_trust(vec![right], &opts);
        assert_eq!(kept.keep.len(), 1);
        assert!(kept.rejected.is_empty());
    }

    #[test]
    fn anime_title_gate_noops_when_titles_empty() {
        // Empty alias list must never reject legit anime, whatever the parsed title.
        let mut opts = opts_strict();
        opts.kind = Some("series".into());
        opts.is_anime = true;
        let mut s = base_stream();
        s.parsed_title = "Totally Unrelated Absolute-Numbered Title".into();
        let result = apply_trust(vec![s], &opts);
        assert_eq!(result.keep.len(), 1);
        assert!(result.rejected.is_empty());
    }

    #[test]
    fn rejects_fresh_cinema_fake_web_1080p_and_720p() {
        let days = now_unix_ms() / 86_400_000 - 7;
        let (y, m, d) = civil_from_days(days);
        let mk = |res: Resolution, src: Source| {
            let mut s = base_stream();
            s.parsed_title = "New Movie".into();
            s.year = Some(2025);
            s.source = src;
            s.resolution = res;
            s
        };
        let mut opts = opts_strict();
        opts.kind = Some("movie".into());
        opts.expected_year = Some(2025);
        opts.release_date = Some(format!("{y:04}-{m:02}-{d:02}"));

        let a = apply_trust(vec![mk(Resolution::P1080, Source::WEBRip)], &opts);
        assert_eq!(a.rejected.len(), 1);
        assert_eq!(a.rejected[0].reason, "fresh-cinema-fake-web");

        let b = apply_trust(vec![mk(Resolution::P720, Source::WebDl)], &opts);
        assert_eq!(b.rejected.len(), 1);
        assert_eq!(b.rejected[0].reason, "fresh-cinema-fake-web");
    }

    #[test]
    fn rejects_known_fake_group_by_release_group() {
        let mut s = base_stream();
        s.release_group_normalized = Some("LAMA".into());
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "known-fake-group");
    }

    #[test]
    fn rejects_known_fake_group_ad_studio_haystack() {
        let mut s = base_stream();
        s.stream.behavior_hints =
            Some(json!({ "filename": "The.Odyssey.2025.1080p.WEB-DL.Dragon.Money.mkv" }));
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.rejected.len(), 1);
        assert_eq!(result.rejected[0].reason, "known-fake-group");
    }

    #[test]
    fn keeps_legit_group_not_flagged_fake() {
        let mut s = base_stream();
        s.release_group_normalized = Some("RARBG".into());
        s.stream.behavior_hints =
            Some(json!({ "filename": "Movie.2020.1080p.BluRay.x264-RARBG.mkv" }));
        let result = apply_trust(vec![s], &opts_strict());
        assert_eq!(result.keep.len(), 1);
        assert!(result.rejected.is_empty());
    }

    #[test]
    fn sequel_marker_ignores_number_in_title_name() {
        assert_eq!(sequel_marker("Kaiju No. 8"), None);
        assert_eq!(sequel_marker("Kaiju No.8"), None);
        assert_eq!(sequel_marker("Mob Psycho #2"), None);
        assert_eq!(sequel_marker("Ranking of Kings Number 3"), None);
        assert_eq!(sequel_marker("John Wick 4"), Some(4));
        assert_eq!(sequel_marker("Rocky II"), Some(2));
    }

    #[test]
    fn title_matches_numbered_title_across_name_variants() {
        assert!(title_matches("Kaiju No. 8", "Kaijuu 8 Gou", None, Some(2024)));
        assert!(title_matches("Kaiju No. 8", "Kaiju No 8", None, Some(2024)));
    }

    fn anime_opts() -> TrustOptions {
        TrustOptions {
            strict: true,
            kind: Some("series".into()),
            is_anime: true,
            continuous_anime: true,
            expected_season: Some(1),
            expected_episode: Some(1169),
            alt_expected_season: Some(23),
            alt_expected_episode: Some(14),
            ..Default::default()
        }
    }

    fn seasonal_anime_opts() -> TrustOptions {
        TrustOptions {
            strict: true,
            kind: Some("series".into()),
            is_anime: true,
            expected_season: Some(3),
            expected_episode: Some(5),
            ..Default::default()
        }
    }

    #[test]
    fn anime_episode_check_runs_in_non_strict_mode() {
        let opts = TrustOptions { strict: false, ..anime_opts() };
        let mut wrong = base_stream();
        wrong.season = Some(1);
        wrong.episode = Some(1);
        let r1 = apply_trust(vec![wrong], &opts);
        assert_eq!(r1.keep.len(), 0);
        assert!(r1.rejected[0].reason.starts_with("episode-mismatch-anime"));

        let mut right = base_stream();
        right.season = Some(23);
        right.episode = Some(14);
        let r2 = apply_trust(vec![right], &opts);
        assert_eq!(r2.keep.len(), 1);
    }

    #[test]
    fn anime_keeps_correct_relative_pair() {
        let mut s = base_stream();
        s.season = Some(23);
        s.episode = Some(14);
        let result = apply_trust(vec![s], &anime_opts());
        assert_eq!(result.keep.len(), 1);
        assert!(result.rejected.is_empty());
    }

    #[test]
    fn anime_rejects_wrong_relative_episode() {
        let mut s = base_stream();
        s.season = Some(1);
        s.episode = Some(1);
        let result = apply_trust(vec![s], &anime_opts());
        assert_eq!(result.keep.len(), 0);
        assert!(result.rejected[0].reason.starts_with("episode-mismatch-anime"));
    }

    #[test]
    fn anime_rejects_same_season_wrong_episode() {
        let mut s = base_stream();
        s.season = Some(23);
        s.episode = Some(13);
        let result = apply_trust(vec![s], &anime_opts());
        assert_eq!(result.keep.len(), 0);
        assert!(result.rejected[0].reason.starts_with("episode-mismatch-anime"));
    }

    #[test]
    fn anime_pair_guard_rejects_relative_number_in_wrong_season() {
        let mut s = base_stream();
        s.season = Some(1);
        s.episode = Some(14);
        let result = apply_trust(vec![s], &anime_opts());
        assert_eq!(result.keep.len(), 0);
        assert!(result.rejected[0].reason.starts_with("episode-mismatch-anime"));
    }

    #[test]
    fn anime_keeps_unparsed_absolute_release() {
        let mut s = base_stream();
        s.season = None;
        s.episode = None;
        let result = apply_trust(vec![s], &anime_opts());
        assert_eq!(result.keep.len(), 1);
        assert!(result.rejected.is_empty());
    }

    #[test]
    fn anime_keeps_parsed_absolute_episode() {
        let mut s = base_stream();
        s.season = Some(1);
        s.episode = Some(1169);
        let result = apply_trust(vec![s], &anime_opts());
        assert_eq!(result.keep.len(), 1);
    }

    #[test]
    fn anime_continuous_rejects_wrong_episode_without_alt_pair() {
        let opts = TrustOptions {
            alt_expected_season: None,
            alt_expected_episode: None,
            ..anime_opts()
        };
        let mut s = base_stream();
        s.season = Some(1);
        s.episode = Some(1);
        let result = apply_trust(vec![s], &opts);
        assert_eq!(result.keep.len(), 0);
        assert!(result.rejected[0].reason.starts_with("episode-mismatch-anime"));
    }

    #[test]
    fn anime_seasonal_keeps_correct_season_and_episode() {
        let mut s = base_stream();
        s.season = Some(3);
        s.episode = Some(5);
        let result = apply_trust(vec![s], &seasonal_anime_opts());
        assert_eq!(result.keep.len(), 1);
        assert!(result.rejected.is_empty());
    }

    #[test]
    fn anime_seasonal_rejects_wrong_season() {
        let mut s = base_stream();
        s.season = Some(1);
        s.episode = Some(5);
        let result = apply_trust(vec![s], &seasonal_anime_opts());
        assert_eq!(result.keep.len(), 0);
        assert!(result.rejected[0].reason.starts_with("season-mismatch-anime"));
    }

    #[test]
    fn anime_seasonal_rejects_wrong_episode() {
        let mut s = base_stream();
        s.season = Some(3);
        s.episode = Some(4);
        let result = apply_trust(vec![s], &seasonal_anime_opts());
        assert_eq!(result.keep.len(), 0);
        assert!(result.rejected[0].reason.starts_with("episode-mismatch-anime"));
    }

    #[test]
    fn anime_seasonal_keeps_unparsed_episode() {
        let mut s = base_stream();
        s.season = None;
        s.episode = None;
        let result = apply_trust(vec![s], &seasonal_anime_opts());
        assert_eq!(result.keep.len(), 1);
        assert!(result.rejected.is_empty());
    }

    #[test]
    fn anime_seasonal_pack_and_fileidx_skip_check() {
        let mut packed = base_stream();
        packed.season_pack = true;
        packed.season = Some(1);
        packed.episode = Some(5);
        let r1 = apply_trust(vec![packed], &seasonal_anime_opts());
        assert_eq!(r1.keep.len(), 1);

        let mut indexed = base_stream();
        indexed.stream.file_idx = Some(1);
        indexed.season = Some(1);
        indexed.episode = Some(5);
        let r2 = apply_trust(vec![indexed], &seasonal_anime_opts());
        assert_eq!(r2.keep.len(), 0);
        assert!(r2.rejected[0].reason.starts_with("season-mismatch-anime"));
    }

    #[test]
    fn anime_season_pack_skips_episode_check() {
        let mut packed = base_stream();
        packed.season_pack = true;
        packed.season = Some(5);
        packed.episode = Some(99);
        let r1 = apply_trust(vec![packed], &anime_opts());
        assert_eq!(r1.keep.len(), 1);
    }

    #[test]
    fn anime_checks_fileidx_stream_by_filename() {
        let mut indexed = base_stream();
        indexed.stream.file_idx = Some(0);
        indexed.season = Some(7);
        indexed.episode = Some(42);
        let r1 = apply_trust(vec![indexed], &anime_opts());
        assert_eq!(r1.keep.len(), 0);
        assert!(r1.rejected[0].reason.starts_with("episode-mismatch-anime"));

        let mut correct_indexed = base_stream();
        correct_indexed.stream.file_idx = Some(3);
        correct_indexed.season = Some(23);
        correct_indexed.episode = Some(14);
        let r2 = apply_trust(vec![correct_indexed], &anime_opts());
        assert_eq!(r2.keep.len(), 1);

        let mut absolute_indexed = base_stream();
        absolute_indexed.stream.file_idx = Some(1);
        absolute_indexed.season = None;
        absolute_indexed.episode = Some(1169);
        let r3 = apply_trust(vec![absolute_indexed], &anime_opts());
        assert_eq!(r3.keep.len(), 1);
    }

    #[test]
    fn non_anime_episode_check_ignores_alt_pair() {
        let opts = TrustOptions {
            strict: true,
            kind: Some("series".into()),
            expected_season: Some(2),
            expected_episode: Some(5),
            alt_expected_season: Some(3),
            alt_expected_episode: Some(6),
            ..Default::default()
        };
        let mut wrong_season = base_stream();
        wrong_season.season = Some(3);
        wrong_season.episode = Some(5);
        let r1 = apply_trust(vec![wrong_season], &opts);
        assert_eq!(r1.rejected[0].reason, "season-mismatch:3-vs-2");

        let mut wrong_ep = base_stream();
        wrong_ep.season = Some(2);
        wrong_ep.episode = Some(6);
        let r2 = apply_trust(vec![wrong_ep], &opts);
        assert_eq!(r2.rejected[0].reason, "episode-mismatch:6-vs-5");
    }

    #[test]
    fn anime_title_gate_keeps_numbered_title_variants() {
        let mut opts = opts_strict();
        opts.kind = Some("series".into());
        opts.is_anime = true;
        opts.expected_year = Some(2024);
        opts.expected_titles = vec!["Kaiju No. 8".into(), "Kaijuu 8-gou".into()];

        let mut romaji = base_stream();
        romaji.parsed_title = "Kaijuu 8 Gou".into();
        romaji.year = None;
        let kept = apply_trust(vec![romaji], &opts);
        assert_eq!(kept.keep.len(), 1, "romaji release must survive the anime gate");
        assert!(kept.rejected.is_empty());

        let mut english = base_stream();
        english.parsed_title = "Kaiju No 8".into();
        english.year = None;
        let kept = apply_trust(vec![english], &opts);
        assert_eq!(kept.keep.len(), 1, "english release must survive the anime gate");

        let mut wrong = base_stream();
        wrong.parsed_title = "Stranger Things".into();
        let rejected = apply_trust(vec![wrong], &opts);
        assert_eq!(rejected.rejected.len(), 1);
        assert_eq!(rejected.rejected[0].reason, "anime-title-mismatch");
    }
}
