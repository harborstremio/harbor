use realfft::num_complex::Complex;
use realfft::RealFftPlanner;

pub const GRID_HZ: f32 = 100.0;
const MAX_LAG_SEC: f32 = 60.0;
const Z_MIN: f32 = 6.0;
const DOMINANCE_MIN: f32 = 1.3;

pub struct SyncResult {
    pub offset_sec: f32,
    pub ratio: f32,
    pub confidence: f32,
}

fn ratios() -> Vec<f32> {
    let base = [1.0f32, 1.25, 0.8, 1.0427, 1.00092, 1.04167];
    let mut v: Vec<f32> = Vec::new();
    for &r in base.iter() {
        if !v.iter().any(|x| (x - r).abs() < 1e-5) {
            v.push(r);
        }
        let inv = 1.0 / r;
        if (inv - 1.0).abs() > 1e-4 && !v.iter().any(|x| (x - inv).abs() < 1e-5) {
            v.push(inv);
        }
    }
    v
}

fn rasterize(intervals: &[(f32, f32)], scale: f32, len: usize) -> Vec<f32> {
    let mut m = vec![0f32; len];
    for &(a, b) in intervals {
        let s = ((a * scale * GRID_HZ).round().max(0.0)) as usize;
        let e = ((b * scale * GRID_HZ).round().max(0.0)) as usize;
        for x in m.iter_mut().take(e.min(len)).skip(s.min(len)) {
            *x = 1.0;
        }
    }
    m
}

fn fft_xcorr(a: &[f32], b: &[f32], max_lag: usize) -> Vec<f32> {
    let n = a.len().max(b.len());
    let m = (n + max_lag + 1).next_power_of_two();
    let mut planner = RealFftPlanner::<f32>::new();
    let fwd = planner.plan_fft_forward(m);
    let inv = planner.plan_fft_inverse(m);
    let mut abuf = fwd.make_input_vec();
    let mut bbuf = fwd.make_input_vec();
    abuf[..a.len()].copy_from_slice(a);
    bbuf[..b.len()].copy_from_slice(b);
    let mut aspec = fwd.make_output_vec();
    let mut bspec = fwd.make_output_vec();
    if fwd.process(&mut abuf, &mut aspec).is_err() || fwd.process(&mut bbuf, &mut bspec).is_err() {
        return vec![0f32; 2 * max_lag + 1];
    }
    let mut prod: Vec<Complex<f32>> = aspec
        .iter()
        .zip(bspec.iter())
        .map(|(&x, &y)| x * y.conj())
        .collect();
    let mut out = inv.make_output_vec();
    if inv.process(&mut prod, &mut out).is_err() {
        return vec![0f32; 2 * max_lag + 1];
    }
    let norm = m as f32;
    let mut res = vec![0f32; 2 * max_lag + 1];
    for l in 0..=max_lag {
        res[max_lag + l] = out[l] / norm;
        if l > 0 {
            res[max_lag - l] = out[m - l] / norm;
        }
    }
    res
}

fn peak_stats(corr: &[f32]) -> (usize, f32, f32) {
    let n = corr.len();
    let mut peak = f32::MIN;
    let mut pidx = 0;
    for (i, &v) in corr.iter().enumerate() {
        if v > peak {
            peak = v;
            pidx = i;
        }
    }
    let mean = corr.iter().sum::<f32>() / n as f32;
    let var = corr.iter().map(|&v| (v - mean).powi(2)).sum::<f32>() / n as f32;
    let std = var.sqrt().max(1e-9);
    let z = (peak - mean) / std;
    let guard = GRID_HZ as usize;
    let mut second = f32::MIN;
    for (i, &v) in corr.iter().enumerate() {
        let far = (i + guard) < pidx || i > (pidx + guard);
        if far && v > second {
            second = v;
        }
    }
    let dominance = if second > 1e-6 {
        peak / second
    } else {
        f32::INFINITY
    };
    (pidx, z, dominance)
}

fn ncc_at(a: &[f32], b: &[f32], lag: isize) -> f32 {
    let (mut sx, mut sy, mut cnt) = (0.0f32, 0.0f32, 0.0f32);
    for (i, &x) in a.iter().enumerate() {
        let j = i as isize - lag;
        if j < 0 || j as usize >= b.len() {
            continue;
        }
        sx += x;
        sy += b[j as usize];
        cnt += 1.0;
    }
    if cnt < 1.0 {
        return 0.0;
    }
    let (mx, my) = (sx / cnt, sy / cnt);
    let (mut xy, mut xx, mut yy) = (0.0f32, 0.0f32, 0.0f32);
    for (i, &x) in a.iter().enumerate() {
        let j = i as isize - lag;
        if j < 0 || j as usize >= b.len() {
            continue;
        }
        let dx = x - mx;
        let dy = b[j as usize] - my;
        xy += dx * dy;
        xx += dx * dx;
        yy += dy * dy;
    }
    let denom = (xx * yy).sqrt();
    if denom < 1e-9 {
        0.0
    } else {
        xy / denom
    }
}

pub fn solve(
    audio: &[(f32, f32)],
    cues: &[(f32, f32)],
    total_sec: f32,
    conf_min: f32,
) -> Option<SyncResult> {
    let len = ((total_sec * GRID_HZ).round() as usize).max(1);
    if cues.is_empty() || audio.is_empty() || len < 2 {
        return None;
    }
    let amask = rasterize(audio, 1.0, len);
    let max_lag = (MAX_LAG_SEC * GRID_HZ) as usize;
    let mut best: Option<(f32, isize, f32, f32, f32)> = None;
    for r in ratios() {
        let bmask = rasterize(cues, r, len);
        let corr = fft_xcorr(&amask, &bmask, max_lag);
        let (pidx, z, dom) = peak_stats(&corr);
        let lag = pidx as isize - max_lag as isize;
        let ncc = ncc_at(&amask, &bmask, lag);
        if best.map(|(_, _, c, _, _)| ncc > c).unwrap_or(true) {
            best = Some((r, lag, ncc, z, dom));
        }
    }
    let (ratio, lag, ncc, z, dom) = best?;
    let offset_sec = lag as f32 / GRID_HZ;
    eprintln!(
        "[subsync] best ratio={:.4} offset={:.2}s ncc={:.3} z={:.1} dom={:.2} (min ncc={:.2} z={:.1} dom={:.1})",
        ratio, offset_sec, ncc, z, dom, conf_min, Z_MIN, DOMINANCE_MIN
    );
    if ncc < conf_min || z < Z_MIN || dom < DOMINANCE_MIN || offset_sec.abs() > MAX_LAG_SEC {
        return None;
    }
    Some(SyncResult {
        offset_sec,
        ratio,
        confidence: ncc,
    })
}

#[derive(serde::Serialize)]
pub struct AlignmentQuality {
    pub ncc: f32,
    pub coverage: f32,
    pub z: f32,
}

fn coverage_at(a: &[f32], b: &[f32], lag: isize) -> f32 {
    let (mut on_cue, mut on_both) = (0.0f32, 0.0f32);
    for (i, &x) in a.iter().enumerate() {
        let j = i as isize - lag;
        if j < 0 || j as usize >= b.len() {
            continue;
        }
        if b[j as usize] > 0.0 {
            on_cue += 1.0;
            if x > 0.0 {
                on_both += 1.0;
            }
        }
    }
    if on_cue > 0.0 {
        on_both / on_cue
    } else {
        0.0
    }
}

fn z_at(a: &[f32], b: &[f32], lag: isize) -> f32 {
    let max_lag = (MAX_LAG_SEC * GRID_HZ) as usize;
    let corr = fft_xcorr(a, b, max_lag);
    let n = corr.len();
    if n == 0 {
        return 0.0;
    }
    let mean = corr.iter().sum::<f32>() / n as f32;
    let var = corr.iter().map(|&v| (v - mean).powi(2)).sum::<f32>() / n as f32;
    let std = var.sqrt().max(1e-9);
    let idx = (max_lag as isize + lag).clamp(0, n as isize - 1) as usize;
    (corr[idx] - mean) / std
}

pub fn score_affine(
    speech: &[(f32, f32)],
    cues: &[(f32, f32)],
    total_sec: f32,
    offset: f32,
    ratio: f32,
) -> AlignmentQuality {
    let len = ((total_sec * GRID_HZ).round() as usize).max(1);
    if speech.is_empty() || cues.is_empty() || len < 2 {
        return AlignmentQuality {
            ncc: 0.0,
            coverage: 0.0,
            z: 0.0,
        };
    }
    let amask = rasterize(speech, 1.0, len);
    let bmask = rasterize(cues, ratio, len);
    let lag = (offset * GRID_HZ).round() as isize;
    let ncc = ncc_at(&amask, &bmask, lag).max(0.0);
    let coverage = coverage_at(&amask, &bmask, lag);
    let z = z_at(&amask, &bmask, lag);
    AlignmentQuality { ncc, coverage, z }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cue_pattern() -> Vec<(f32, f32)> {
        let gaps = [
            4.3f32, 6.1, 3.2, 7.4, 5.0, 3.9, 8.2, 4.7, 6.6, 3.5, 5.8, 7.1,
        ];
        let mut t = 5.0f32;
        let mut cues = Vec::new();
        for k in 0..26 {
            let dur = 1.0 + (k % 4) as f32 * 0.3;
            cues.push((t, t + dur));
            t += dur + gaps[k % gaps.len()];
        }
        cues
    }

    #[test]
    fn recovers_flat_offset() {
        let cues = cue_pattern();
        let audio: Vec<(f32, f32)> = cues.iter().map(|&(a, b)| (a + 7.3, b + 7.3)).collect();
        let r = solve(&audio, &cues, 260.0, 0.55).expect("should sync");
        assert!((r.offset_sec - 7.3).abs() < 0.05, "offset {}", r.offset_sec);
        assert!((r.ratio - 1.0).abs() < 1e-4, "ratio {}", r.ratio);
    }

    #[test]
    fn recovers_fps_drift() {
        let cues = cue_pattern();
        let audio: Vec<(f32, f32)> = cues.iter().map(|&(a, b)| (a * 1.25, b * 1.25)).collect();
        let r = solve(&audio, &cues, 340.0, 0.55).expect("should sync drift");
        assert!((r.ratio - 1.25).abs() < 1e-3, "ratio {}", r.ratio);
    }

    #[test]
    fn declines_on_no_structure() {
        let cues = cue_pattern();
        let audio = vec![(0.0f32, 260.0f32)];
        assert!(solve(&audio, &cues, 260.0, 0.55).is_none());
    }

    #[test]
    fn score_rewards_correct_offset() {
        let cues = cue_pattern();
        let audio: Vec<(f32, f32)> = cues.iter().map(|&(a, b)| (a + 7.3, b + 7.3)).collect();
        let good = score_affine(&audio, &cues, 260.0, 7.3, 1.0);
        let bad = score_affine(&audio, &cues, 260.0, 0.0, 1.0);
        assert!(good.ncc > 0.9, "good ncc {}", good.ncc);
        assert!(good.coverage > 0.8, "coverage {}", good.coverage);
        assert!(
            good.ncc > bad.ncc + 0.2,
            "good {} bad {}",
            good.ncc,
            bad.ncc
        );
    }

    #[test]
    fn score_recovers_ratio_drift() {
        let cues = cue_pattern();
        let audio: Vec<(f32, f32)> = cues.iter().map(|&(a, b)| (a * 1.25, b * 1.25)).collect();
        let good = score_affine(&audio, &cues, 340.0, 0.0, 1.25);
        let flat = score_affine(&audio, &cues, 340.0, 0.0, 1.0);
        assert!(
            good.ncc > flat.ncc + 0.2,
            "drift {} flat {}",
            good.ncc,
            flat.ncc
        );
    }
}
