//! Opt-in signal analysis on the existing decoder; no extra player or sample transfer.
use super::NativeFlag;
use libmpv2::mpv_node::MpvNode;
use libmpv2::Mpv;
use serde::Serialize;

const METER_STATS: &str =
    "astats=metadata=1:reset=1:measure_perchannel=RMS_level+Peak_level:measure_overall=none";

pub(super) fn request_logs(mpv: &Mpv, enabled: bool) {
    unsafe {
        libmpv2_sys::mpv_request_log_messages(
            mpv.ctx.as_ptr(),
            if enabled {
                c"v".as_ptr()
            } else {
                c"no".as_ptr()
            },
        );
    }
}

pub(super) fn audio_filters(processing: &str, meter: bool) -> String {
    match (processing.is_empty(), meter) {
        (_, false) => processing.to_string(),
        (true, true) => super::spectrum::filter(METER_STATS),
        (false, true) => format!("{processing},{}", super::spectrum::filter(METER_STATS)),
    }
}

pub(super) fn set_enabled(mpv: &Mpv, enabled: bool) -> Result<(), String> {
    let filter = super::spectrum::filter(METER_STATS);
    let args = if enabled {
        ["af", "add", filter.as_str()]
    } else {
        ["af", "remove", "@harbor_meter"]
    };
    crate::mpv::mpv_argv_command(mpv, &args)
        .map_err(|_| "Music signal analysis is unavailable".to_string())?;
    request_logs(mpv, enabled);
    Ok(())
}

pub(super) fn ensure_enabled(mpv: &Mpv) -> Result<bool, String> {
    let filters = mpv.get_property::<String>("af").map_err(|error| error.to_string())?;
    if filters.contains("@harbor_meter:") {
        request_logs(mpv, true);
        Ok(false)
    } else {
        set_enabled(mpv, true)?;
        Ok(true)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicMeterChannel {
    pub rms_db: f64,
    pub peak_db: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicMeterSnapshot {
    pub track_id: String,
    pub connector_id: Option<String>,
    pub active: bool,
    pub channels: Vec<MusicMeterChannel>,
    pub spectrum_db: Vec<f64>,
    pub output_sample_rate_hz: Option<u32>,
    pub output_channels: Option<String>,
    pub output_device: Option<String>,
    pub output_backend: Option<String>,
}

fn decibels(value: &str) -> Option<f64> {
    let number = value.parse::<f64>().ok()?;
    if number == f64::NEG_INFINITY {
        return Some(-120.0);
    }
    number.is_finite().then(|| number.clamp(-120.0, 24.0))
}

fn short_property(mpv: &Mpv, name: &str) -> Option<String> {
    mpv.get_property::<String>(name)
        .ok()
        .filter(|value| !value.is_empty() && value.len() <= 512)
}

pub(super) fn snapshot(
    mpv: &Mpv,
    track_id: &str,
    connector_id: Option<&str>,
) -> MusicMeterSnapshot {
    let mut rms = [None; 8];
    let mut peaks = [None; 8];
    if let Ok(node) = mpv.get_property::<MpvNode>("af-metadata/harbor_meter") {
        if let Some(fields) = node.map() {
            for (key, value) in fields.take(32) {
                let Some(key) = key.strip_prefix("lavfi.astats.") else {
                    continue;
                };
                let Some((channel, measurement)) = key.split_once('.') else {
                    continue;
                };
                let Some(index) = channel
                    .parse::<usize>()
                    .ok()
                    .and_then(|n| n.checked_sub(1))
                    .filter(|n| *n < 8)
                else {
                    continue;
                };
                let level = value.str().and_then(decibels);
                match measurement {
                    "RMS_level" => rms[index] = level,
                    "Peak_level" => peaks[index] = level,
                    _ => {}
                }
            }
        }
    }
    let active = ["pause", "paused-for-cache", "eof-reached", "seeking"]
        .iter()
        .all(|name| {
            !mpv.get_property::<NativeFlag>(name)
                .is_ok_and(|value| value.0 != 0)
        });
    let channels = rms
        .into_iter()
        .zip(peaks)
        .map_while(|(rms, peak)| {
            Some(MusicMeterChannel {
                rms_db: rms?,
                peak_db: peak?,
            })
        })
        .collect();
    MusicMeterSnapshot {
        track_id: track_id.to_string(),
        connector_id: connector_id.map(str::to_string),
        active,
        channels,
        spectrum_db: Vec::new(),
        output_sample_rate_hz: mpv
            .get_property::<i64>("audio-out-params/samplerate")
            .ok()
            .and_then(|value| u32::try_from(value).ok())
            .filter(|value| *value > 0 && *value <= 3_072_000),
        output_channels: short_property(mpv, "audio-out-params/channels"),
        output_device: short_property(mpv, "audio-device"),
        output_backend: short_property(mpv, "current-ao"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meter_filter_preserves_existing_processing_and_silence_is_finite() {
        let processing = "lavfi=[volume=-3dB,equalizer=f=1000:t=o:w=1:g=3]";
        assert_eq!(audio_filters(processing, false), processing);
        assert_eq!(
            audio_filters(processing, true),
            format!(
                "{processing},{}",
                super::super::spectrum::filter(METER_STATS)
            )
        );
        assert_eq!(
            audio_filters("", true),
            super::super::spectrum::filter(METER_STATS)
        );
        assert_eq!(decibels("-inf"), Some(-120.0));
        assert_eq!(decibels("NaN"), None);
        assert_eq!(decibels("inf"), None);
        assert_eq!(decibels("-6.02"), Some(-6.02));
    }
}
