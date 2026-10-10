use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FilterType {
    Peak,
    LowShelf,
    HighShelf,
    LowPass,
    HighPass,
    Notch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PeqFilter {
    pub r#type: FilterType,
    pub frequency: f64,
    pub gain: f64,
    pub q: f64,
    pub enabled: bool,
}

impl Default for PeqFilter {
    fn default() -> Self {
        Self {
            r#type: FilterType::Peak,
            frequency: 1000.0,
            gain: 0.0,
            q: 0.7071,
            enabled: true,
        }
    }
}

pub fn bounded(value: f64, min: f64, max: f64, fallback: f64) -> f64 {
    if value.is_finite() {
        value.clamp(min, max)
    } else {
        fallback
    }
}

impl PeqFilter {
    pub fn normalize(&mut self) {
        self.frequency = bounded(self.frequency, 20.0, 20000.0, 1000.0);
        self.gain = bounded(self.gain, -18.0, 18.0, 0.0);
        self.q = bounded(self.q, 0.1, 12.0, 0.7071);
    }
    pub fn command(&self, strength: f64) -> String {
        let name = match self.r#type {
            FilterType::Peak => "equalizer",
            FilterType::LowShelf => "bass",
            FilterType::HighShelf => "treble",
            FilterType::LowPass => "lowpass",
            FilterType::HighPass => "highpass",
            FilterType::Notch => "bandreject",
        };
        let gain = if matches!(
            self.r#type,
            FilterType::Peak | FilterType::LowShelf | FilterType::HighShelf
        ) {
            format!(":g={:.4}", self.gain * strength)
        } else {
            String::new()
        };
        format!(
            "{name}=f={:.4}:t=q:w={:.4}{gain}:r=f64",
            self.frequency, self.q
        )
    }
    fn coefficients(&self, rate: f64, strength: f64) -> [f64; 6] {
        let w = 2.0 * std::f64::consts::PI * self.frequency.min(rate * 0.499) / rate;
        let c = w.cos();
        let alpha = w.sin() / (2.0 * self.q);
        let a = 10.0_f64.powf(self.gain * strength / 40.0);
        let root = 2.0 * a.sqrt() * alpha;
        match self.r#type {
            FilterType::LowShelf => [
                a * ((a + 1.0) - (a - 1.0) * c + root),
                2.0 * a * ((a - 1.0) - (a + 1.0) * c),
                a * ((a + 1.0) - (a - 1.0) * c - root),
                (a + 1.0) + (a - 1.0) * c + root,
                -2.0 * ((a - 1.0) + (a + 1.0) * c),
                (a + 1.0) + (a - 1.0) * c - root,
            ],
            FilterType::HighShelf => [
                a * ((a + 1.0) + (a - 1.0) * c + root),
                -2.0 * a * ((a - 1.0) + (a + 1.0) * c),
                a * ((a + 1.0) + (a - 1.0) * c - root),
                (a + 1.0) - (a - 1.0) * c + root,
                2.0 * ((a - 1.0) - (a + 1.0) * c),
                (a + 1.0) - (a - 1.0) * c - root,
            ],
            FilterType::LowPass => [
                (1.0 - c) / 2.0,
                1.0 - c,
                (1.0 - c) / 2.0,
                1.0 + alpha,
                -2.0 * c,
                1.0 - alpha,
            ],
            FilterType::HighPass => [
                (1.0 + c) / 2.0,
                -(1.0 + c),
                (1.0 + c) / 2.0,
                1.0 + alpha,
                -2.0 * c,
                1.0 - alpha,
            ],
            FilterType::Notch => [1.0, -2.0 * c, 1.0, 1.0 + alpha, -2.0 * c, 1.0 - alpha],
            FilterType::Peak => [
                1.0 + alpha * a,
                -2.0 * c,
                1.0 - alpha * a,
                1.0 + alpha / a,
                -2.0 * c,
                1.0 - alpha / a,
            ],
        }
    }
}

fn response(coefficients: &[[f64; 6]], frequency: f64, rate: f64) -> f64 {
    let w = 2.0 * std::f64::consts::PI * frequency / rate;
    let (c1, c2, s1, s2) = (w.cos(), (2.0 * w).cos(), w.sin(), (2.0 * w).sin());
    coefficients
        .iter()
        .map(|[b0, b1, b2, a0, a1, a2]| {
            let n = (b0 + b1 * c1 + b2 * c2).powi(2) + (b1 * s1 + b2 * s2).powi(2);
            let d = (a0 + a1 * c1 + a2 * c2).powi(2) + (a1 * s1 + a2 * s2).powi(2);
            10.0 * (n.max(1e-20) / d.max(1e-20)).log10()
        })
        .sum()
}

/// Aggregate filter response, including resonant cuts, with 0.5 dB reserve.
pub fn headroom(filters: &[PeqFilter], strength: f64) -> f64 {
    if strength == 0.0 {
        return 0.0;
    }
    let mut peak = 0.0_f64;
    for rate in [44100.0, 48000.0, 96000.0, 192000.0] {
        let coefficients: Vec<_> = filters
            .iter()
            .filter(|f| f.enabled)
            .map(|f| f.coefficients(rate, strength))
            .collect();
        for i in 0..=1024 {
            peak = peak.max(response(
                &coefficients,
                20.0 * 1000.0_f64.powf(f64::from(i) / 1024.0),
                rate,
            ));
        }
        for filter in filters {
            peak = peak.max(response(&coefficients, filter.frequency, rate));
        }
    }
    if peak > 0.05 {
        ((peak + 0.5) * 10.0).ceil() / 10.0
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn overlapping_filters_reserve_their_combined_gain() {
        let filter = PeqFilter {
            gain: 6.0,
            ..Default::default()
        };
        let reserve = headroom(&[filter.clone(), filter.clone()], 1.0);
        assert!((reserve - 12.5).abs() < 0.15);
        assert_eq!(headroom(&[filter], 0.0), 0.0);
    }
    #[test]
    fn cut_filter_resonance_is_included() {
        let filter = PeqFilter {
            r#type: FilterType::LowPass,
            q: 6.0,
            ..Default::default()
        };
        assert!(headroom(&[filter], 1.0) > 15.0);
    }
    #[test]
    fn shelf_and_peaking_responses_match_their_gain() {
        let peak = PeqFilter {
            gain: 6.0,
            ..Default::default()
        };
        assert!((response(&[peak.coefficients(48000.0, 1.0)], 1000.0, 48000.0) - 6.0).abs() < 1e-6);
        let low = PeqFilter {
            r#type: FilterType::LowShelf,
            gain: 6.0,
            ..Default::default()
        };
        assert!((response(&[low.coefficients(48000.0, 1.0)], 20.0, 48000.0) - 6.0).abs() < 0.1);
    }
}
