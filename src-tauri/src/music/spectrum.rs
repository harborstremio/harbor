//! Bounded, playback-timed frequency measurements from an analysis-only lavfi branch.
use std::collections::VecDeque;

pub const FREQUENCIES: [u32; 8] = [60, 120, 250, 500, 1000, 2000, 4000, 8000];
const CAPACITY: usize = 128;

pub fn filter(meter: &str) -> String {
    let mut graph = format!("[in]asplit=2[main][analysis];[main]{meter}[out];[analysis]aresample=24000,asetnsamples=n=1200:p=0,asplit=8");
    for index in 0..FREQUENCIES.len() {
        graph.push_str(&format!("[b{index}]"));
    }
    for (index, frequency) in FREQUENCIES.iter().enumerate() {
        graph.push_str(&format!(";[b{index}]bandpass=f={frequency}:t=o:w=1,astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=RMS_level,ametadata@harbor_band_{index}=print:key=lavfi.astats.Overall.RMS_level,anullsink"));
    }
    format!("@harbor_meter:lavfi=[{graph}]")
}

#[derive(Default)]
pub struct Spectrum {
    pending: [Option<f64>; 8],
    samples: [VecDeque<(f64, f64)>; 8],
}

impl Spectrum {
    pub fn clear(&mut self) {
        *self = Self::default();
    }

    // Only our named metadata filters are accepted. No unrelated decoder logs
    // or media paths are retained or forwarded to the frontend.
    pub fn ingest(&mut self, text: &str) {
        let Some(rest) = text.strip_prefix("ametadata@harbor_band_") else {
            return;
        };
        let Some((index, value)) = rest.split_once(": ") else {
            return;
        };
        let Some(index) = index.parse::<usize>().ok().filter(|index| *index < 8) else {
            return;
        };
        if let Some((_, time)) = value.split_once("pts_time:") {
            self.pending[index] = time.trim().parse::<f64>().ok().filter(|v| v.is_finite());
        } else if let Some(level) = value.strip_prefix("lavfi.astats.Overall.RMS_level=") {
            let Some(time) = self.pending[index].take() else {
                return;
            };
            let Ok(level) = level.trim().parse::<f64>() else {
                return;
            };
            let level = if level == f64::NEG_INFINITY {
                -120.0
            } else {
                level
            };
            if !level.is_finite() {
                return;
            }
            let samples = &mut self.samples[index];
            if samples.back().is_some_and(|(last, _)| *last > time) {
                samples.clear();
            }
            samples.push_back((time, level.clamp(-120.0, 24.0)));
            while samples.len() > CAPACITY {
                samples.pop_front();
            }
        }
    }

    pub fn at(&self, position: f64) -> Vec<f64> {
        if !position.is_finite() {
            return Vec::new();
        }
        self.samples
            .iter()
            .map(|samples| {
                // Decode-ahead samples wait until they reach the playback clock.
                samples
                    .iter()
                    .rev()
                    .find(|(time, _)| *time <= position + 0.025 && position - time < 0.25)
                    .map_or(-120.0, |(_, level)| *level)
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sample(spectrum: &mut Spectrum, time: f64, db: f64) {
        spectrum.ingest(&format!(
            "ametadata@harbor_band_0: frame:0 pts:0 pts_time:{time}"
        ));
        spectrum.ingest(&format!(
            "ametadata@harbor_band_0: lavfi.astats.Overall.RMS_level={db}"
        ));
    }
    #[test]
    fn playback_clock_does_not_show_future_or_stale_audio() {
        let mut spectrum = Spectrum::default();
        sample(&mut spectrum, 1.0, -12.0);
        sample(&mut spectrum, 1.1, -30.0);
        assert_eq!(spectrum.at(0.8)[0], -120.0);
        assert_eq!(spectrum.at(1.0)[0], -12.0);
        assert_eq!(spectrum.at(1.1)[0], -30.0);
        assert_eq!(spectrum.at(1.5)[0], -120.0);
        spectrum.clear();
        assert_eq!(spectrum.at(1.0)[0], -120.0);
    }
    #[test]
    fn history_is_bounded_and_seeks_discard_old_timeline() {
        let mut spectrum = Spectrum::default();
        for i in 0..1000 {
            sample(&mut spectrum, f64::from(i), -18.0);
        }
        assert_eq!(spectrum.samples[0].len(), CAPACITY);
        sample(&mut spectrum, 0.0, -6.0);
        assert_eq!(spectrum.samples[0].len(), 1);
        assert_eq!(spectrum.at(0.0)[0], -6.0);
    }
}
