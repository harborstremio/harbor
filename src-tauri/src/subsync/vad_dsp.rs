use realfft::num_complex::Complex;
use realfft::RealFftPlanner;

use super::{VadConfig, ENV_HZ, HOP, SR, WIN};

struct Frame {
    energy_db: f32,
    flatness: f32,
    harmonicity: f32,
    log_env: f32,
}

fn hann(n: usize) -> Vec<f32> {
    (0..n)
        .map(|i| {
            (std::f32::consts::PI * i as f32 / (n as f32 - 1.0))
                .sin()
                .powi(2)
        })
        .collect()
}

fn clamp01(x: f32) -> f32 {
    x.clamp(0.0, 1.0)
}

fn ramp(x: f32, lo: f32, hi: f32) -> f32 {
    if hi <= lo {
        return if x >= hi { 1.0 } else { 0.0 };
    }
    clamp01((x - lo) / (hi - lo))
}

fn frame_features(
    pcm: &[f32],
    win: &[f32],
    fwd: &std::sync::Arc<dyn realfft::RealToComplex<f32>>,
    inv: &std::sync::Arc<dyn realfft::ComplexToReal<f32>>,
    cfg: &VadConfig,
) -> Vec<Frame> {
    let n = pcm.len();
    if n < WIN {
        return Vec::new();
    }
    let bin_hz = SR as f32 / WIN as f32;
    let k_lo = (cfg.band_lo_hz / bin_hz).round().max(1.0) as usize;
    let k_hi = ((cfg.band_hi_hz / bin_hz).round() as usize).min(WIN / 2);
    let lag_lo = (SR as f32 / cfg.f0_hi_hz).round() as usize;
    let lag_hi = ((SR as f32 / cfg.f0_lo_hz).round() as usize).min(WIN - 1);
    let n_frames = 1 + (n - WIN) / HOP;

    let mut buf = fwd.make_input_vec();
    let mut spec = fwd.make_output_vec();
    let mut power = inv.make_input_vec();
    let mut acf = inv.make_output_vec();

    let mut out = Vec::with_capacity(n_frames);
    for f in 0..n_frames {
        let base = f * HOP;
        let mut e = 0.0f32;
        for i in 0..WIN {
            let s = pcm[base + i];
            e += s * s;
            buf[i] = s * win[i];
        }
        let energy_db = 20.0 * ((e / WIN as f32).sqrt() + 1e-9).log10();
        if fwd.process(&mut buf, &mut spec).is_err() {
            out.push(Frame {
                energy_db,
                flatness: 1.0,
                harmonicity: 0.0,
                log_env: energy_db,
            });
            continue;
        }
        let (mut geo, mut ari, mut cnt) = (0.0f32, 0.0f32, 0.0f32);
        for k in k_lo..=k_hi {
            let p = spec[k].norm_sqr();
            geo += (p + 1e-12).ln();
            ari += p;
            cnt += 1.0;
        }
        let flatness = if cnt > 0.0 && ari > 1e-12 {
            clamp01((geo / cnt).exp() / (ari / cnt))
        } else {
            1.0
        };
        for k in 0..power.len() {
            power[k] = Complex {
                re: spec[k].norm_sqr(),
                im: 0.0,
            };
        }
        let harmonicity = if inv.process(&mut power, &mut acf).is_ok() && acf[0] > 1e-9 {
            let z = acf[0];
            let mut peak = 0.0f32;
            for lag in lag_lo..=lag_hi {
                let v = acf[lag] / z;
                if v > peak {
                    peak = v;
                }
            }
            clamp01(peak)
        } else {
            0.0
        };
        out.push(Frame {
            energy_db,
            flatness,
            harmonicity,
            log_env: energy_db,
        });
    }
    out
}

fn modulation_ratio(env: &[f32], cfg: &VadConfig) -> Vec<f32> {
    let n = env.len();
    let half = ((cfg.mod_win_ms as f32 / 1000.0) * ENV_HZ / 2.0) as usize;
    let lag_lo = (ENV_HZ / 6.0).round() as usize;
    let lag_hi = (ENV_HZ / 3.0).round() as usize;
    let ref_hi = (ENV_HZ / 0.7).round().min(n as f32) as usize;
    let mut out = vec![0.0f32; n];
    for c in 0..n {
        let w = &env[c.saturating_sub(half)..(c + half).min(n)];
        let m = w.iter().sum::<f32>() / w.len().max(1) as f32;
        let var = w.iter().map(|&v| (v - m) * (v - m)).sum::<f32>() / w.len().max(1) as f32;
        if var < 0.1 || w.len() < 4 {
            continue;
        }
        let acf_at = |lag: usize| -> f32 {
            let mut acc = 0.0f32;
            for i in 0..(w.len() - lag) {
                acc += (w[i] - m) * (w[i + lag] - m);
            }
            acc / (w.len() - lag).max(1) as f32 / var
        };
        let mut syll = 0.0f32;
        for lag in lag_lo..=lag_hi.min(w.len() - 1) {
            syll = syll.max(acf_at(lag));
        }
        let mut refb = 1e-6f32;
        for lag in 1..=ref_hi.min(w.len() - 1) {
            refb = refb.max(acf_at(lag).abs());
        }
        out[c] = clamp01(syll / refb);
    }
    out
}

pub fn heuristic_probs(pcm: &[f32], cfg: &VadConfig) -> (Vec<f32>, f32) {
    let mut planner = RealFftPlanner::<f32>::new();
    let fwd = planner.plan_fft_forward(WIN);
    let inv = planner.plan_fft_inverse(WIN);
    let win = hann(WIN);
    let frames = frame_features(pcm, &win, &fwd, &inv, cfg);
    if frames.is_empty() {
        return (Vec::new(), 0.0);
    }
    let env: Vec<f32> = frames.iter().map(|f| f.log_env).collect();
    let modr = modulation_ratio(&env, cfg);

    let mut probs = Vec::with_capacity(frames.len());
    let mut gated = 0usize;
    for (i, fr) in frames.iter().enumerate() {
        if fr.energy_db < cfg.energy_floor_db {
            probs.push(0.0);
            continue;
        }
        let tonal = ramp(
            cfg.flatness_hi - fr.flatness,
            0.0,
            cfg.flatness_hi - cfg.flatness_lo,
        );
        let voiced = ramp(fr.harmonicity, cfg.harmonicity_lo, cfg.harmonicity_hi);
        let base = tonal.max(0.15) * voiced;
        let speechy = ramp(modr[i], cfg.mod_ratio_lo, cfg.mod_ratio_hi);
        let p = base * (cfg.mod_floor + (1.0 - cfg.mod_floor) * speechy);
        if base > 0.4 && p < cfg.speech_threshold {
            gated += 1;
        }
        probs.push(p);
    }
    (probs, gated as f32 / frames.len() as f32)
}

#[cfg(test)]
mod tests {
    use super::super::hysteresis;
    use super::*;

    fn synth(freqs: &[f32], am_hz: f32, secs: f32) -> Vec<f32> {
        let n = (SR as f32 * secs) as usize;
        (0..n)
            .map(|i| {
                let t = i as f32 / SR as f32;
                let am = if am_hz > 0.0 {
                    (0.5 * (1.0 + (2.0 * std::f32::consts::PI * am_hz * t).sin())).max(0.0)
                } else {
                    1.0
                };
                let s: f32 = freqs
                    .iter()
                    .map(|&f| (2.0 * std::f32::consts::PI * f * t).sin())
                    .sum();
                0.2 * am * s / freqs.len() as f32
            })
            .collect()
    }

    #[test]
    fn modulated_voiced_reads_as_speech() {
        let cfg = VadConfig::default();
        let pcm = synth(&[150.0, 300.0, 450.0, 600.0], 4.0, 6.0);
        let (probs, _) = heuristic_probs(&pcm, &cfg);
        let iv = hysteresis(&probs, 10.0, &cfg, 100.0, 106.0);
        let covered: f32 = iv.iter().map(|(a, b)| b - a).sum();
        assert!(covered > 1.0, "expected speech coverage, got {}", covered);
        assert!(iv.iter().all(|(a, _)| *a >= 100.0));
    }

    #[test]
    fn steady_tone_is_gated_as_music() {
        let cfg = VadConfig::default();
        let pcm = synth(&[220.0, 440.0, 660.0, 880.0], 0.0, 6.0);
        let (probs, gated) = heuristic_probs(&pcm, &cfg);
        let iv = hysteresis(&probs, 10.0, &cfg, 0.0, 6.0);
        let covered: f32 = iv.iter().map(|(a, b)| b - a).sum();
        assert!(covered < 0.6, "steady tone leaked as speech: {}", covered);
        assert!(gated > 0.2, "modulation gate inactive: {}", gated);
    }

    #[test]
    fn silence_is_empty() {
        let cfg = VadConfig::default();
        let pcm = vec![0.0f32; SR as usize * 4];
        let (probs, _) = heuristic_probs(&pcm, &cfg);
        let iv = hysteresis(&probs, 10.0, &cfg, 0.0, 4.0);
        assert!(iv.is_empty(), "silence produced intervals: {:?}", iv);
    }
}
