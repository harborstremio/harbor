pub const DIRECT_HELD_OUT_PROVENANCE: &str = "direct-middle-held-out-v2";
pub const DIRECT_EXPLICIT_HELD_OUT_PROVENANCE: &str = "direct-explicit-held-out-v1";
pub const DIRECT_ANALYSIS_PROVENANCE: &str = "direct-analysis-windows-v2";
pub const TORRENT_HELD_OUT_PROVENANCE: &str = "torrent-middle-held-out-v1";
pub const TORRENT_EXPLICIT_HELD_OUT_PROVENANCE: &str = "torrent-explicit-held-out-v1";

const MIN_DISJOINT_DURATION_SEC: f32 = 300.0;
const MIN_FIT_WINDOW_SEC: f32 = 60.0;
const MAX_FIT_WINDOW_SEC: f32 = 600.0;
const MIN_VALIDATION_WINDOW_SEC: f32 = 30.0;
const MAX_VALIDATION_WINDOW_SEC: f32 = 240.0;
const MAX_EXPLICIT_WINDOWS: usize = 24;
const MIN_EXPLICIT_WINDOW_SEC: f32 = 2.0;

#[derive(Clone, Debug, PartialEq)]
pub struct AnalysisWindow {
    pub id: String,
    pub start_sec: f32,
    pub len_sec: f32,
}

#[derive(Clone, Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestedValidationWindow {
    pub id: String,
    pub from_sec: f32,
    pub to_sec: f32,
}

impl AnalysisWindow {
    pub fn end_sec(&self) -> f32 {
        self.start_sec + self.len_sec
    }

    pub fn overlaps(&self, other: &Self) -> bool {
        self.start_sec < other.end_sec() && other.start_sec < self.end_sec()
    }
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 96
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
}

pub fn fit_windows(duration_sec: f32) -> Vec<AnalysisWindow> {
    if !duration_sec.is_finite() || duration_sec < 60.0 {
        return Vec::new();
    }
    if duration_sec < MIN_DISJOINT_DURATION_SEC {
        let start = (duration_sec * 0.05).max(5.0);
        let end = (duration_sec * 0.95).max(start + 30.0).min(duration_sec);
        return vec![AnalysisWindow {
            id: "fit-whole".to_string(),
            start_sec: start,
            len_sec: (end - start).max(0.0),
        }];
    }

    let margin = (duration_sec * 0.05).clamp(5.0, 270.0);
    let len = (duration_sec * 0.22).clamp(MIN_FIT_WINDOW_SEC, MAX_FIT_WINDOW_SEC);
    vec![
        AnalysisWindow {
            id: "fit-early".to_string(),
            start_sec: margin,
            len_sec: len,
        },
        AnalysisWindow {
            id: "fit-late".to_string(),
            start_sec: (duration_sec - margin - len).max(margin + len),
            len_sec: len,
        },
    ]
}

pub fn default_validation_windows(duration_sec: f32) -> Vec<AnalysisWindow> {
    if !duration_sec.is_finite() || duration_sec < MIN_DISJOINT_DURATION_SEC {
        return Vec::new();
    }
    let len = (duration_sec * 0.1).clamp(MIN_VALIDATION_WINDOW_SEC, MAX_VALIDATION_WINDOW_SEC);
    [0.43f32, 0.57f32]
        .into_iter()
        .enumerate()
        .map(|(index, center)| AnalysisWindow {
            id: format!("validation-middle-{}", if index == 0 { "a" } else { "b" }),
            start_sec: duration_sec * center - len * 0.5,
            len_sec: len,
        })
        .collect()
}

pub fn windows_are_disjoint(windows: &[AnalysisWindow], excluded: &[AnalysisWindow]) -> bool {
    windows.iter().enumerate().all(|(index, window)| {
        windows
            .iter()
            .skip(index + 1)
            .all(|other| !window.overlaps(other))
            && excluded.iter().all(|other| !window.overlaps(other))
    })
}

pub fn validation_windows(
    duration_sec: f32,
    excluded_window_ids: &[String],
) -> Vec<AnalysisWindow> {
    let fit = fit_windows(duration_sec);
    let mut excluded = Vec::new();
    for id in excluded_window_ids {
        let Some(window) = fit.iter().find(|window| &window.id == id) else {
            return Vec::new();
        };
        if !excluded
            .iter()
            .any(|existing: &AnalysisWindow| existing.id == window.id)
        {
            excluded.push(window.clone());
        }
    }
    let candidates = default_validation_windows(duration_sec);
    if candidates.is_empty() || !windows_are_disjoint(&candidates, &excluded) {
        return Vec::new();
    }
    candidates
}

pub fn explicit_validation_windows(
    duration_sec: f32,
    requested: &[RequestedValidationWindow],
    excluded: &[AnalysisWindow],
) -> Vec<AnalysisWindow> {
    if !duration_sec.is_finite() || requested.is_empty() || requested.len() > MAX_EXPLICIT_WINDOWS {
        return Vec::new();
    }
    let mut windows = Vec::with_capacity(requested.len());
    for request in requested {
        if !valid_id(&request.id)
            || !request.from_sec.is_finite()
            || !request.to_sec.is_finite()
            || request.from_sec < 0.0
            || request.to_sec > duration_sec
            || request.to_sec - request.from_sec < MIN_EXPLICIT_WINDOW_SEC
            || windows
                .iter()
                .any(|window: &AnalysisWindow| window.id == request.id)
        {
            return Vec::new();
        }
        windows.push(AnalysisWindow {
            id: request.id.clone(),
            start_sec: request.from_sec,
            len_sec: request.to_sec - request.from_sec,
        });
    }
    if !windows_are_disjoint(&windows, excluded) {
        return Vec::new();
    }
    windows
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(windows: &[AnalysisWindow]) -> Vec<&str> {
        windows.iter().map(|window| window.id.as_str()).collect()
    }

    #[test]
    fn ordinary_episode_has_disjoint_fit_and_validation_windows() {
        let fit = fit_windows(1_200.0);
        let excluded = ids(&fit)
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>();
        let validation = validation_windows(1_200.0, &excluded);
        assert_eq!(ids(&fit), vec!["fit-early", "fit-late"]);
        assert_eq!(
            ids(&validation),
            vec!["validation-middle-a", "validation-middle-b"]
        );
        assert!(windows_are_disjoint(&validation, &fit));
    }

    #[test]
    fn five_minute_boundary_is_feasible_but_short_clips_are_unknown() {
        let fit = fit_windows(300.0);
        let excluded = ids(&fit)
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>();
        assert_eq!(validation_windows(300.0, &excluded).len(), 2);
        assert!(validation_windows(299.9, &["fit-whole".to_string()]).is_empty());
    }

    #[test]
    fn unknown_fit_provenance_refuses_default_validation() {
        assert!(validation_windows(5_400.0, &["fit-unknown".to_string()]).is_empty());
    }

    #[test]
    fn explicit_ranges_preserve_ids_and_reject_overlap_or_invalid_geometry() {
        let requested = vec![
            RequestedValidationWindow {
                id: "pivot-held-out-1".to_string(),
                from_sec: 400.0,
                to_sec: 416.0,
            },
            RequestedValidationWindow {
                id: "pivot-held-out-2".to_string(),
                from_sec: 700.0,
                to_sec: 716.0,
            },
        ];
        assert_eq!(
            ids(&explicit_validation_windows(1_200.0, &requested, &[])),
            vec!["pivot-held-out-1", "pivot-held-out-2"]
        );
        let overlapping = AnalysisWindow {
            id: "fit".to_string(),
            start_sec: 390.0,
            len_sec: 20.0,
        };
        assert!(explicit_validation_windows(1_200.0, &requested, &[overlapping]).is_empty());

        let duplicate = vec![requested[0].clone(), requested[0].clone()];
        assert!(explicit_validation_windows(1_200.0, &duplicate, &[]).is_empty());
    }
}
