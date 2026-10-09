#![allow(dead_code)]

use super::asr::{AsrToken, WindowEvidence};

const P_MIN: f32 = 0.35;
const TAU_SEC: f32 = 0.80;
const CUE_PAD_SEC: f32 = 1.5;
const STOP: &[&str] = &[
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "is", "it", "i", "you",
    "he", "she", "we", "they", "for", "so", "my", "me", "be", "do", "no", "yes", "oh", "as", "if",
    "up", "by", "am", "are", "was", "im", "its", "this", "that", "with",
];

pub struct SubTok {
    pub raw_t: f32,
    pub audio_t: f32,
    pub norm: String,
    pub phon: String,
    pub content: bool,
}

fn normalize(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        if c.is_alphanumeric() {
            for lc in c.to_lowercase() {
                out.push(lc);
            }
        }
    }
    out
}

fn fold(c: char) -> char {
    match c {
        'a' | 'e' | 'i' | 'o' | 'u' | 'y' => '0',
        'b' | 'p' => 'b',
        'c' | 'k' | 'q' | 'g' | 'j' => 'k',
        'd' | 't' => 'd',
        'f' | 'v' => 'f',
        's' | 'z' | 'x' => 's',
        'm' | 'n' => 'n',
        _ => c,
    }
}

fn phonetic(n: &str) -> String {
    let canonical = n.replace("ght", "t");
    let mut out = String::new();
    let mut prev = '\u{0}';
    for (i, c) in canonical.chars().enumerate() {
        let f = fold(c);
        if f == '0' && i > 0 {
            continue;
        }
        if f != prev {
            out.push(f);
            prev = f;
        }
    }
    out
}

fn is_content(n: &str) -> bool {
    n.len() >= 2 && !STOP.iter().any(|w| *w == n)
}

fn token_match(an: &str, ap: &str, bn: &str, bp: &str) -> bool {
    if an == bn {
        return true;
    }
    an.len() >= 3 && bn.len() >= 3 && ap == bp
}

pub fn cue_tokens(
    cues: &[(f32, f32, String)],
    win_lo: f32,
    win_hi: f32,
    offset: f32,
    ratio: f32,
) -> Vec<SubTok> {
    let mut out = Vec::new();
    for (s, e, text) in cues {
        let a = offset + ratio * *s;
        let b = offset + ratio * *e;
        if b < win_lo - CUE_PAD_SEC || a > win_hi + CUE_PAD_SEC {
            continue;
        }
        let words: Vec<&str> = text.split_whitespace().collect();
        let m = words.len().max(1) as f32;
        for (k, w) in words.iter().enumerate() {
            let frac = (k as f32 + 0.5) / m;
            let raw_t = *s + (*e - *s) * frac;
            let norm = normalize(w);
            if norm.is_empty() {
                continue;
            }
            let phon = phonetic(&norm);
            let content = is_content(&norm);
            out.push(SubTok {
                raw_t,
                audio_t: offset + ratio * raw_t,
                norm,
                phon,
                content,
            });
        }
    }
    out
}

fn median(v: &mut [f32]) -> Option<f32> {
    if v.is_empty() {
        return None;
    }
    v.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    Some(v[v.len() / 2])
}

pub fn theil_sen(pairs: &[(f32, f32)]) -> (f32, f32) {
    if pairs.len() < 2 {
        let off = pairs.first().map(|p| p.1 - p.0).unwrap_or(0.0);
        return (off, 1.0);
    }
    let mut slopes = Vec::new();
    for i in 0..pairs.len() {
        for j in (i + 1)..pairs.len() {
            let dx = pairs[j].0 - pairs[i].0;
            if dx.abs() > 1e-3 {
                slopes.push((pairs[j].1 - pairs[i].1) / dx);
            }
        }
    }
    let ratio = median(&mut slopes).unwrap_or(1.0).clamp(0.5, 2.0);
    let mut offs: Vec<f32> = pairs.iter().map(|(x, y)| y - ratio * x).collect();
    let offset = median(&mut offs).unwrap_or(0.0);
    (offset, ratio)
}

pub fn score_window(
    tokens: &[AsrToken],
    subs: &[SubTok],
    lang: String,
    start_sec: f32,
    len_sec: f32,
) -> WindowEvidence {
    let mut eligible = 0u32;
    let mut matched = 0u32;
    let mut resid = Vec::new();
    let mut anchors = Vec::new();
    for t in tokens {
        let an = normalize(&t.text);
        if an.is_empty() || t.p < P_MIN || !is_content(&an) {
            continue;
        }
        let ac = t.t0.max(0.0);
        let ap = phonetic(&an);
        eligible += 1;
        let mut best: Option<&SubTok> = None;
        let mut bestd = TAU_SEC;
        for st in subs {
            if !st.content {
                continue;
            }
            let d = (st.audio_t - ac).abs();
            if d <= bestd && token_match(&an, &ap, &st.norm, &st.phon) {
                bestd = d;
                best = Some(st);
            }
        }
        if let Some(st) = best {
            matched += 1;
            resid.push(ac - st.audio_t);
            anchors.push((st.raw_t, ac));
        }
    }
    let (word_offset_sec, word_ratio) = theil_sen(&anchors);
    let mut a: Vec<f32> = resid.iter().map(|r| r.abs()).collect();
    let residual_sec = median(&mut a).unwrap_or(0.0);
    WindowEvidence {
        start_sec,
        len_sec,
        lang,
        speech_tokens: tokens.len() as u32,
        eligible,
        matched,
        residual_sec,
        word_offset_sec,
        word_ratio,
        anchors: anchors.len() as u32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tok(t: &str, at: f32, p: f32) -> AsrToken {
        AsrToken {
            text: t.into(),
            t0: at,
            t1: at + 0.3,
            p,
        }
    }

    #[test]
    fn phonetic_folds_homophones() {
        assert_eq!(phonetic(&normalize("night")), phonetic(&normalize("nite")));
        assert_ne!(phonetic(&normalize("house")), phonetic(&normalize("horse")));
    }

    #[test]
    fn theil_sen_recovers_line() {
        let pairs: Vec<(f32, f32)> = (0..10).map(|k| (k as f32, 3.0 + 1.25 * k as f32)).collect();
        let (off, ratio) = theil_sen(&pairs);
        assert!((off - 3.0).abs() < 0.05 && (ratio - 1.25).abs() < 0.02);
    }

    #[test]
    fn aligned_words_match_wrong_content_does_not() {
        let toks = vec![tok("hello", 10.0, 0.9), tok("world", 11.0, 0.9)];
        let good = cue_tokens(&[(10.0, 11.6, "hello world".into())], 0.0, 30.0, 0.0, 1.0);
        let ev = score_window(&toks, &good, "en".into(), 0.0, 30.0);
        assert_eq!((ev.eligible, ev.matched), (2, 2));

        let bad = cue_tokens(
            &[(10.0, 11.6, "quarterly revenue".into())],
            0.0,
            30.0,
            0.0,
            1.0,
        );
        let ev2 = score_window(&toks, &bad, "en".into(), 0.0, 30.0);
        assert_eq!(ev2.matched, 0);
    }

    #[test]
    fn wrong_offset_breaks_the_time_gate() {
        let toks = vec![tok("hello", 10.0, 0.9), tok("world", 11.0, 0.9)];
        let shifted = cue_tokens(&[(10.0, 11.6, "hello world".into())], 0.0, 60.0, 40.0, 1.0);
        let ev = score_window(&toks, &shifted, "en".into(), 0.0, 60.0);
        assert_eq!(ev.matched, 0);
    }
}
