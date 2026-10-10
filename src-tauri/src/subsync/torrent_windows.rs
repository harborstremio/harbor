pub const HEAD_TAIL_CHUNK: u64 = 65536;
pub const MIN_WINDOW_SEC: f32 = 120.0;
pub const MAX_WINDOW_SEC: f32 = 600.0;
pub const MIN_LEVER_SEC: f32 = 600.0;
const VBR_GUARD_FRAC: f32 = 0.06;
const VBR_GUARD_MIN_SEC: f32 = 20.0;
const NEAR_FUTURE_GUARD_SEC: f32 = 45.0;

#[derive(Clone, Copy)]
pub struct Geometry {
    pub total_pieces: u32,
    pub piece_len: u64,
    pub total_len: u64,
    pub file_offset: u64,
    pub file_len: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Window {
    pub start_sec: f32,
    pub len_sec: f32,
}

pub fn parse_have_bytes(dump: &str) -> Option<Vec<u8>> {
    let inner = dump.trim().strip_prefix('[')?.strip_suffix(']')?;
    if inner.trim().is_empty() {
        return Some(Vec::new());
    }
    let mut out = Vec::new();
    for tok in inner.split(',') {
        out.push(tok.trim().parse::<u8>().ok()?);
    }
    Some(out)
}

pub fn have_piece(bytes: &[u8], piece: u32) -> bool {
    let byte = (piece / 8) as usize;
    byte < bytes.len() && (bytes[byte] & (0x80u8 >> (piece % 8))) != 0
}

fn range_available(bytes: &[u8], geo: &Geometry, lo: u64, hi: u64) -> bool {
    if hi <= lo || geo.piece_len == 0 {
        return false;
    }
    let first = (lo / geo.piece_len) as u32;
    let last = ((hi - 1) / geo.piece_len) as u32;
    let mut p = first;
    while p <= last {
        if p >= geo.total_pieces || !have_piece(bytes, p) {
            return false;
        }
        p += 1;
    }
    true
}

pub fn available_byte_spans(bytes: &[u8], geo: &Geometry) -> Vec<(u64, u64)> {
    if geo.piece_len == 0 || geo.file_len == 0 {
        return Vec::new();
    }
    let file_end = geo.file_offset + geo.file_len;
    let first = (geo.file_offset / geo.piece_len) as u32;
    let last = ((file_end - 1) / geo.piece_len) as u32;
    let mut spans: Vec<(u64, u64)> = Vec::new();
    let mut cur: Option<(u64, u64)> = None;
    let mut p = first;
    while p <= last && p < geo.total_pieces {
        let p_start = p as u64 * geo.piece_len;
        let p_end = ((p as u64 + 1) * geo.piece_len).min(geo.total_len);
        let seg_start = p_start.max(geo.file_offset);
        let seg_end = p_end.min(file_end);
        if have_piece(bytes, p) && seg_end > seg_start {
            cur = match cur {
                Some((s, e)) if seg_start <= e => Some((s, seg_end)),
                Some((s, e)) => {
                    spans.push((s, e));
                    Some((seg_start, seg_end))
                }
                None => Some((seg_start, seg_end)),
            };
        } else if let Some(done) = cur.take() {
            spans.push(done);
        }
        p += 1;
    }
    if let Some(done) = cur.take() {
        spans.push(done);
    }
    spans
        .into_iter()
        .map(|(s, e)| (s - geo.file_offset, e - geo.file_offset))
        .collect()
}

fn safe_intervals(spans: &[(u64, u64)], file_len: u64, duration: f32) -> Vec<(f32, f32)> {
    if file_len == 0 || duration <= 0.0 {
        return Vec::new();
    }
    let rate = file_len as f32 / duration;
    let mut out = Vec::new();
    for &(b0, b1) in spans {
        let t0 = b0 as f32 / rate;
        let t1 = (b1 as f32 / rate).min(duration);
        let guard = (VBR_GUARD_FRAC * (t1 - t0)).max(VBR_GUARD_MIN_SEC);
        let lo = t0 + guard;
        let hi = t1 - guard;
        if hi - lo >= MIN_WINDOW_SEC {
            out.push((lo, hi));
        }
    }
    out
}

fn clamp_window(lo: f32, hi: f32, prefer_end: bool) -> Window {
    let len = (hi - lo).min(MAX_WINDOW_SEC);
    let start = if prefer_end { hi - len } else { lo };
    Window {
        start_sec: start,
        len_sec: len,
    }
}

pub fn center(w: &Window) -> f32 {
    w.start_sec + w.len_sec * 0.5
}

fn near_future(w: &Window, position: f32) -> bool {
    position >= 0.0 && w.start_sec > position && w.start_sec < position + NEAR_FUTURE_GUARD_SEC
}

fn overlaps(a: &Window, b: &Window) -> bool {
    a.start_sec < b.start_sec + b.len_sec && b.start_sec < a.start_sec + a.len_sec
}

pub fn windows_available(
    bytes: &[u8],
    geo: &Geometry,
    duration_sec: f32,
    requested: &[Window],
) -> bool {
    if requested.is_empty() {
        return false;
    }
    let spans = available_byte_spans(bytes, geo);
    let safe = safe_intervals(&spans, geo.file_len, duration_sec.max(1.0));
    requested.iter().all(|window| {
        let end = window.start_sec + window.len_sec;
        window.start_sec >= 0.0
            && window.len_sec > 0.0
            && safe
                .iter()
                .any(|&(start, safe_end)| window.start_sec >= start && end <= safe_end)
    })
}

fn place_windows(safe: &[(f32, f32)], want_late: bool, position: f32) -> Vec<Window> {
    if safe.is_empty() {
        return Vec::new();
    }
    let mut early = None;
    for &(lo, hi) in safe {
        let w = clamp_window(lo, hi, false);
        if !near_future(&w, position) {
            early = Some(w);
            break;
        }
    }
    let early = early.unwrap_or_else(|| clamp_window(safe[0].0, safe[0].1, false));
    let mut out = vec![early];
    if want_late {
        for &(lo, hi) in safe.iter().rev() {
            let w = clamp_window(lo, hi, true);
            if near_future(&w, position) {
                continue;
            }
            if center(&w) - center(&early) >= MIN_LEVER_SEC && !overlaps(&w, &early) {
                out.push(w);
                break;
            }
        }
    }
    out
}

pub fn select_windows(
    bytes: &[u8],
    geo: &Geometry,
    duration_sec: f32,
    want_late: bool,
    position_sec: f32,
) -> Vec<Window> {
    let spans = available_byte_spans(bytes, geo);
    let safe = safe_intervals(&spans, geo.file_len, duration_sec.max(1.0));
    place_windows(&safe, want_late, position_sec)
}

pub fn downloaded_frac(bytes: &[u8], geo: &Geometry) -> f32 {
    if geo.file_len == 0 {
        return 0.0;
    }
    let got: u64 = available_byte_spans(bytes, geo)
        .iter()
        .map(|&(s, e)| e - s)
        .sum();
    got as f32 / geo.file_len as f32
}

pub fn endpoints_ready(bytes: &[u8], geo: &Geometry) -> (bool, bool) {
    let head_hi = (geo.file_offset + HEAD_TAIL_CHUNK).min(geo.file_offset + geo.file_len);
    let head = range_available(bytes, geo, geo.file_offset, head_hi);
    let file_end = geo.file_offset + geo.file_len;
    let tail_start = file_end
        .saturating_sub(HEAD_TAIL_CHUNK)
        .max(geo.file_offset);
    let tail = range_available(bytes, geo, tail_start, file_end);
    (head, tail)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn geo(pieces: u32, plen: u64, foff: u64, flen: u64) -> Geometry {
        Geometry {
            total_pieces: pieces,
            piece_len: plen,
            total_len: foff + flen,
            file_offset: foff,
            file_len: flen,
        }
    }

    #[test]
    fn have_piece_is_msb0() {
        let bytes = [0b1000_0001u8, 0b0100_0000u8];
        assert!(have_piece(&bytes, 0));
        assert!(!have_piece(&bytes, 1));
        assert!(have_piece(&bytes, 7));
        assert!(have_piece(&bytes, 9));
        assert!(!have_piece(&bytes, 8));
    }

    #[test]
    fn parse_have_bytes_reads_debug_slice() {
        assert_eq!(parse_have_bytes("[255, 128, 0]"), Some(vec![255, 128, 0]));
        assert_eq!(parse_have_bytes("[]"), Some(Vec::new()));
        assert_eq!(parse_have_bytes("garbage"), None);
    }

    #[test]
    fn spans_coalesce_contiguous_and_break_on_gap() {
        let g = geo(8, 1000, 0, 8000);
        let have = [0b1110_0111u8];
        assert_eq!(
            available_byte_spans(&have, &g),
            vec![(0, 3000), (5000, 8000)]
        );
    }

    #[test]
    fn spans_are_file_local_with_offset() {
        let g = geo(8, 1000, 2000, 4000);
        let have = [0b0011_1100u8];
        assert_eq!(available_byte_spans(&have, &g), vec![(0, 4000)]);
    }

    #[test]
    fn safe_intervals_shrink_and_drop_short() {
        let g = geo(1, 600_000, 0, 600_000);
        let safe = safe_intervals(&[(0u64, 600_000u64)], g.file_len, 600.0);
        assert_eq!(safe.len(), 1);
        assert!(safe[0].0 >= VBR_GUARD_MIN_SEC - 0.01);
        assert!(safe[0].1 <= 600.0 - VBR_GUARD_MIN_SEC + 0.01);
        assert!(safe_intervals(&[(0u64, 50_000u64)], g.file_len, 600.0).is_empty());
    }

    #[test]
    fn place_windows_gets_lever_from_full_file() {
        let two = place_windows(&[(30.0f32, 6600.0f32)], true, -1.0);
        assert_eq!(two.len(), 2);
        assert!(center(&two[1]) - center(&two[0]) >= MIN_LEVER_SEC);
        assert_eq!(place_windows(&[(30.0f32, 6600.0f32)], false, -1.0).len(), 1);
    }

    #[test]
    fn near_future_window_is_skipped() {
        let safe = vec![(100.0f32, 400.0f32), (900.0f32, 1400.0f32)];
        let out = place_windows(&safe, false, 90.0);
        assert!(out[0].start_sec >= 900.0 - 0.01);
    }

    #[test]
    fn endpoints_ready_needs_head_and_tail_pieces() {
        let g = geo(10, 1_000_000, 0, 10_000_000);
        let mut have = [0u8; 2];
        have[0] |= 0b1000_0000;
        assert_eq!(endpoints_ready(&have, &g), (true, false));
        have[1] |= 0b0100_0000;
        assert_eq!(endpoints_ready(&have, &g), (true, true));
    }

    #[test]
    fn explicit_windows_must_be_fully_inside_downloaded_safe_ranges() {
        let g = geo(10, 100_000, 0, 1_000_000);
        let full = [0xffu8, 0xc0u8];
        assert!(windows_available(
            &full,
            &g,
            1_000.0,
            &[Window {
                start_sec: 400.0,
                len_sec: 60.0,
            }]
        ));
        let head_only = [0xf0u8, 0x00u8];
        assert!(!windows_available(
            &head_only,
            &g,
            1_000.0,
            &[Window {
                start_sec: 700.0,
                len_sec: 60.0,
            }]
        ));
    }
}
