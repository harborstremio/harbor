use super::dsp;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

const MIN_DELAY_MS: f64 = 20.0;
const MAX_DELAY_MS: f64 = 6000.0;
const MIN_BEATS: f64 = 0.0625;
const MAX_BEATS: f64 = 16.0;
const MIN_BPM: f64 = 40.0;
const MAX_BPM: f64 = 220.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MusicFxKind {
    Off,
    Echo,
    Delay,
    Spiral,
    Wide,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct MusicFx {
    pub kind: MusicFxKind,
    pub depth: f64,
    pub beats: f64,
    pub bpm: f64,
}

impl Default for MusicFx {
    fn default() -> Self {
        Self::OFF
    }
}

impl MusicFx {
    pub const OFF: Self = Self {
        kind: MusicFxKind::Off,
        depth: 0.5,
        beats: 0.5,
        bpm: 120.0,
    };

    pub fn normalized(self) -> Self {
        Self {
            kind: self.kind,
            depth: dsp::bounded(self.depth, 0.0, 1.0, 0.5),
            beats: dsp::bounded(self.beats, MIN_BEATS, MAX_BEATS, 0.5),
            bpm: dsp::bounded(self.bpm, MIN_BPM, MAX_BPM, 120.0),
        }
    }

    pub fn delay_ms(self) -> f64 {
        let fx = self.normalized();
        (60_000.0 / fx.bpm * fx.beats).clamp(MIN_DELAY_MS, MAX_DELAY_MS)
    }

    pub fn filters(self) -> Vec<String> {
        let fx = self.normalized();
        let delay = fx.delay_ms();
        match fx.kind {
            MusicFxKind::Off => Vec::new(),
            MusicFxKind::Echo => {
                let decay = 0.28 + fx.depth * 0.47;
                let out = 0.86 - decay * 0.22;
                vec![format!("aecho=1:{out:.3}:{delay:.0}:{decay:.3}")]
            }
            MusicFxKind::Delay => {
                let decay = 0.16 + fx.depth * 0.24;
                vec![format!("aecho=1:0.920:{delay:.0}:{decay:.3}")]
            }
            MusicFxKind::Spiral => {
                let decay = 0.55 + fx.depth * 0.35;
                vec![format!("aecho=1:0.560:{delay:.0}:{decay:.3}")]
            }
            MusicFxKind::Wide => {
                let spread = fx.depth * 0.6;
                let norm = 1.0 / (1.0 + spread * 0.5);
                let direct = (1.0 + spread) * norm;
                let cross = spread * norm;
                vec![
                    "aformat=channel_layouts=stereo".to_string(),
                    format!(
                        "pan=stereo|c0={direct:.3}*c0-{cross:.3}*c1|c1={direct:.3}*c1-{cross:.3}*c0"
                    ),
                ]
            }
        }
    }
}

static ACTIVE: Mutex<MusicFx> = Mutex::new(MusicFx::OFF);

pub fn snapshot() -> MusicFx {
    ACTIVE.lock().map(|fx| *fx).unwrap_or(MusicFx::OFF)
}

pub fn store(next: MusicFx) -> MusicFx {
    let next = next.normalized();
    if let Ok(mut slot) = ACTIVE.lock() {
        *slot = next;
    }
    next
}

pub fn chain() -> Vec<String> {
    snapshot().filters()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn off_adds_nothing_to_the_chain() {
        assert!(MusicFx::OFF.filters().is_empty());
    }

    #[test]
    fn a_division_becomes_a_delay_in_milliseconds() {
        let fx = MusicFx {
            kind: MusicFxKind::Echo,
            depth: 0.5,
            beats: 1.0,
            bpm: 120.0,
        };
        assert_eq!(fx.delay_ms(), 500.0);
        assert_eq!(
            MusicFx {
                beats: 0.25,
                ..fx
            }
            .delay_ms(),
            125.0
        );
    }

    #[test]
    fn nonsense_input_lands_on_a_playable_chain() {
        let fx = MusicFx {
            kind: MusicFxKind::Echo,
            depth: f64::NAN,
            beats: 900.0,
            bpm: 0.0,
        };
        let normalized = fx.normalized();
        assert_eq!(normalized.depth, 0.5);
        assert_eq!(normalized.beats, MAX_BEATS);
        assert_eq!(normalized.bpm, MIN_BPM);
        assert!(fx.delay_ms() <= MAX_DELAY_MS);
        assert!(fx.delay_ms() >= MIN_DELAY_MS);
    }

    #[test]
    fn every_kind_uses_only_confirmed_filters() {
        for kind in [
            MusicFxKind::Echo,
            MusicFxKind::Delay,
            MusicFxKind::Spiral,
            MusicFxKind::Wide,
        ] {
            let fx = MusicFx { kind, ..MusicFx::OFF };
            for filter in fx.filters() {
                let name = filter.split('=').next().unwrap_or_default();
                assert!(
                    ["aecho", "pan", "aformat", "volume", "equalizer"].contains(&name),
                    "unverified filter {name}"
                );
            }
        }
    }

    #[test]
    fn width_never_emits_a_double_sign() {
        let fx = MusicFx {
            kind: MusicFxKind::Wide,
            depth: 1.0,
            ..MusicFx::OFF
        };
        let rendered = fx.filters().join(",");
        assert!(!rendered.contains("+-"));
        assert!(rendered.contains("pan=stereo|c0="));
    }
}
