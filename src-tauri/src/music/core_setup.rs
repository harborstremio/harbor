use crate::music::audio::MusicAudioSettings;
use crate::music::MusicStream;
use libmpv2::mpv_node::MpvNode;
use libmpv2::Mpv;

pub(super) fn create_core(label: &str) -> Result<Mpv, String> {
    force_c_numeric_locale();
    Mpv::with_initializer(|init| {
        for (name, value) in [
            ("title", label),
            ("audio-client-name", label),
            ("terminal", "no"),
            ("video", "no"),
            ("vo", "null"),
            ("force-window", "no"),
            ("idle", "yes"),
            ("keep-open", "yes"),
            ("ytdl", "no"),
            ("volume-max", "600"),
        ] {
            init.set_property(name, value)?;
        }
        Ok(())
    })
    .map_err(|error| format!("music mpv init: {error}"))
}

pub(super) fn probe_core() -> Result<Mpv, String> {
    force_c_numeric_locale();
    Mpv::with_initializer(|init| {
        init.set_property("video", "no")?;
        init.set_property("vo", "null")?;
        init.set_property("terminal", "no")?;
        let _ = init.set_property("media-controls", "no");
        Ok(())
    })
    .map_err(|error| format!("Music output detection: {error}"))
}

pub(super) fn apply_network_cache(mpv: &Mpv) {
    let _ = mpv.set_property("cache", "yes");
    let _ = mpv.set_property("cache-secs", "30");
    let _ = mpv.set_property("cache-pause", "yes");
    let _ = mpv.set_property("network-timeout", "30");
}

pub(super) fn read_music_audio_devices(mpv: &Mpv) -> Result<Vec<crate::mpv::AudioDevice>, String> {
    let node = mpv
        .get_property::<MpvNode>("audio-device-list")
        .map_err(|error| format!("Read music outputs: {error}"))?;
    let mut devices = Vec::new();
    if let Some(entries) = node.array() {
        for entry in entries.take(128) {
            let mut name = String::new();
            let mut description = String::new();
            if let Some(fields) = entry.map() {
                for (key, value) in fields {
                    match key.as_str() {
                        "name" => name = value.str().unwrap_or_default().to_string(),
                        "description" => description = value.str().unwrap_or_default().to_string(),
                        _ => {}
                    }
                }
            }
            if !name.is_empty() && name != "auto" {
                devices.push(crate::mpv::AudioDevice { name, description });
            }
        }
    }
    Ok(devices)
}

pub(super) fn apply_stream_headers(mpv: &Mpv, stream: &MusicStream) -> Result<(), String> {
    use libmpv2_sys::{
        mpv_format_MPV_FORMAT_NODE, mpv_format_MPV_FORMAT_NODE_ARRAY, mpv_format_MPV_FORMAT_STRING,
        mpv_node, mpv_node__bindgen_ty_1, mpv_node_list,
    };
    use std::ffi::CString;

    let mut fields = Vec::new();
    for (name, value) in &stream.http_headers {
        if name.eq_ignore_ascii_case("user-agent") {
            mpv.set_property("user-agent", value.as_str())
                .map_err(|_| "Music could not apply the source user agent".to_string())?;
        } else {
            fields.push(
                CString::new(format!("{name}: {value}"))
                    .map_err(|_| "Music source returned invalid request headers".to_string())?,
            );
        }
    }
    // Supply a native string array. The string-list parser treats commas and
    // backslashes differently, so serializing these headers can alter their values.
    let mut values: Vec<mpv_node> = fields
        .iter()
        .map(|field| mpv_node {
            u: mpv_node__bindgen_ty_1 {
                string: field.as_ptr().cast_mut(),
            },
            format: mpv_format_MPV_FORMAT_STRING,
        })
        .collect();
    let mut list = mpv_node_list {
        num: values.len() as i32,
        values: if values.is_empty() {
            std::ptr::null_mut()
        } else {
            values.as_mut_ptr()
        },
        keys: std::ptr::null_mut(),
    };
    let mut node = mpv_node {
        u: mpv_node__bindgen_ty_1 { list: &mut list },
        format: mpv_format_MPV_FORMAT_NODE_ARRAY,
    };
    // SAFETY: The strings, values, list, and node remain alive for this synchronous
    // call. mpv copies the input; it does not take ownership of these Rust buffers.
    let status = unsafe {
        libmpv2_sys::mpv_set_property(
            mpv.ctx.as_ptr(),
            b"http-header-fields\0".as_ptr().cast(),
            mpv_format_MPV_FORMAT_NODE,
            (&mut node as *mut mpv_node).cast(),
        )
    };
    if status < 0 {
        Err("Music could not apply the source request headers".to_string())
    } else {
        Ok(())
    }
}

pub(super) fn apply_music_audio(
    mpv: &Mpv,
    settings: &MusicAudioSettings,
    device: &str,
    meter_enabled: bool,
) -> Result<(), String> {
    let replay_gain = if settings.replay_gain == "off" || settings.dsp_bypass {
        "no"
    } else {
        &settings.replay_gain
    };
    for (name, value) in [
        ("replaygain", replay_gain),
        ("replaygain-clip", "no"),
        ("replaygain-preamp", "0"),
        ("replaygain-fallback", "0"),
    ] {
        mpv.set_property(name, value)
            .map_err(|error| format!("Music ReplayGain: {error}"))?;
    }
    mpv.set_property("volume-max", settings.volume_limit * 100.0)
        .map_err(|error| format!("Music volume ceiling: {error}"))?;
    if mpv
        .set_property(
            "af",
            super::telemetry::audio_filters(&settings.filter(), meter_enabled).as_str(),
        )
        .is_err()
    {
        let mut plain = settings.clone();
        plain.pitch = 0.0;
        mpv.set_property(
            "af",
            super::telemetry::audio_filters(&plain.filter(), meter_enabled).as_str(),
        )
        .map_err(|error| format!("Music equalizer: {error}"))?;
    }
    mpv.set_property(
        "audio-pitch-correction",
        if settings.keep_pitch { "yes" } else { "no" },
    )
    .map_err(|error| format!("Music pitch: {error}"))?;
    mpv.set_property("speed", settings.speed)
        .map_err(|error| format!("Music speed: {error}"))?;
    mpv.set_property(
        "audio-exclusive",
        if settings.exclusive { "yes" } else { "no" },
    )
    .map_err(|error| format!("Music exclusive output: {error}"))?;
    mpv.set_property("audio-samplerate", i64::from(settings.sample_rate))
        .map_err(|error| format!("Music sample rate: {error}"))?;
    mpv.set_property("audio-device", device)
        .map_err(|error| format!("Music output: {error}"))?;
    Ok(())
}

#[cfg(unix)]
pub(super) fn force_c_numeric_locale() {
    unsafe {
        libc::setlocale(libc::LC_NUMERIC, b"C\0".as_ptr() as *const libc::c_char);
    }
}

#[cfg(not(unix))]
pub(super) fn force_c_numeric_locale() {}
