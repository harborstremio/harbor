use super::core_setup::{apply_music_audio, apply_stream_headers, force_c_numeric_locale};
use super::deck::MusicSession;
use super::deck_events::audio_quality;
use super::*;
use libmpv2::events::{Event, EventContext};
use libmpv2::mpv_node::MpvNode;
use libmpv2::Mpv;
use std::time::{Duration, Instant};

async fn wait_for_native(condition: impl Fn() -> bool) {
    let deadline = Instant::now() + Duration::from_secs(5);
    while !condition() && Instant::now() < deadline {
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    assert!(condition(), "native playback state did not settle");
}

#[tokio::test]
async fn native_meter_reads_real_stereo_preserves_processing_and_disables() {
    force_c_numeric_locale();
    let path = std::env::temp_dir().join(format!("harbor-meter-{}.wav", uuid::Uuid::new_v4()));
    let mut writer = hound::WavWriter::create(
        &path,
        hound::WavSpec {
            channels: 2,
            sample_rate: 48000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        },
    )
    .expect("synthetic stereo fixture");
    for i in 0..48000 * 8 {
        let sine = (2.0 * std::f64::consts::PI * 1000.0 * f64::from(i) / 48000.0).sin();
        writer.write_sample((16384.0 * sine) as i16).unwrap();
        writer.write_sample((8192.0 * sine) as i16).unwrap();
    }
    writer.finalize().unwrap();
    let mpv = Arc::new(
        Mpv::with_initializer(|init| {
            for (key, value) in [
                ("ao", "null"),
                ("vo", "null"),
                ("terminal", "no"),
                ("idle", "yes"),
                ("keep-open", "yes"),
            ] {
                init.set_property(key, value)?;
            }
            Ok(())
        })
        .expect("isolated null-output player"),
    );
    apply_music_audio(&mpv, &MusicAudioSettings::default(), "auto", false).unwrap();
    let mut events = EventContext::new(mpv.ctx);
    crate::mpv::mpv_argv_command(&mpv, &["loadfile", path.to_str().unwrap(), "replace"])
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        if matches!(events.wait_event(0.0), Some(Ok(Event::FileLoaded))) {
            break;
        }
        assert!(Instant::now() < deadline, "meter fixture did not load");
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    let engine = MusicEngine::new();
    let settings_path = path.with_extension("audio.json");
    engine.initialize_audio(settings_path.clone());
    *engine.decks[0].inner.lock().await = Some(MusicSession {
        mpv: mpv.clone(),
        track_id: "meter-fixture".into(),
        connector_id: Some("local".into()),
        spectrum: Arc::new(std::sync::Mutex::new(spectrum::Spectrum::default())),
    });
    assert!(engine.meter_snapshot().await.is_none());
    engine
        .set_meter_enabled(true)
        .await
        .expect("append opt-in analysis");
    wait_for_native(|| {
        telemetry::snapshot(&mpv, "meter-fixture", Some("local"))
            .channels
            .len()
            == 2
    })
    .await;
    let measured = engine.meter_snapshot().await.unwrap();
    assert_eq!(measured.track_id, "meter-fixture");
    assert_eq!(measured.output_sample_rate_hz, Some(48000));
    assert_eq!(measured.output_backend.as_deref(), Some("null"));
    assert!((measured.channels[0].rms_db + 9.03).abs() < 0.3);
    assert!((measured.channels[1].rms_db + 15.05).abs() < 0.3);
    assert!((measured.channels[0].peak_db + 6.02).abs() < 0.1);
    engine.set_volume(0.5).await.unwrap();
    let settings = MusicAudioSettings {
        balance: -1.0,
        replay_gain: "album".into(),
        ..MusicAudioSettings::default()
    };
    engine
        .set_audio_settings(settings)
        .await
        .expect("audio settings retain meter");
    wait_for_native(|| {
        telemetry::snapshot(&mpv, "meter-fixture", Some("local"))
            .channels
            .get(1)
            .is_some_and(|channel| channel.rms_db < -100.0)
    })
    .await;
    assert!((mpv.get_property::<f64>("volume").unwrap() - 50.0).abs() < 0.1);
    assert_eq!(mpv.get_property::<String>("replaygain").unwrap(), "album");
    engine.set_paused(true).await.unwrap();
    assert!(!engine.meter_snapshot().await.unwrap().active);
    engine
        .set_meter_enabled(false)
        .await
        .expect("remove analysis only");
    assert!(engine.meter_snapshot().await.is_none());
    let filters = mpv.get_property::<String>("af").unwrap();
    assert!(filters.contains("pan="));
    assert!(!filters.contains("astats"));
    assert_ne!(mpv.get_property::<NativeFlag>("pause").unwrap().0, 0);
    drop(events);
    drop(mpv);
    engine.stop(false).await.unwrap();
    std::fs::remove_file(path).unwrap();
    std::fs::remove_file(settings_path).unwrap();
}

#[tokio::test]
async fn native_seek_to_end_can_resume_and_paused_seeks_keep_their_position() {
    force_c_numeric_locale();
    let path =
        std::env::temp_dir().join(format!("harbor-seek-resume-{}.wav", uuid::Uuid::new_v4()));
    let mut writer = hound::WavWriter::create(
        &path,
        hound::WavSpec {
            channels: 1,
            sample_rate: 8000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        },
    )
    .expect("silent seek fixture");
    for _ in 0..80000 {
        writer.write_sample(0_i16).expect("silent sample");
    }
    writer.finalize().expect("finish seek fixture");
    let mpv = Arc::new(
        Mpv::with_initializer(|init| {
            for (name, value) in [
                ("ao", "null"),
                ("vo", "null"),
                ("keep-open", "yes"),
                ("pause", "yes"),
                ("idle", "yes"),
            ] {
                init.set_property(name, value)?;
            }
            Ok(())
        })
        .expect("silent native instance"),
    );
    let mut events = EventContext::new(mpv.ctx);
    crate::mpv::mpv_argv_command(
        &mpv,
        &["loadfile", path.to_str().expect("fixture path"), "replace"],
    )
    .expect("load fixture");
    // Duration appears while the file is still opening. The real engine admits
    // seek controls after FileLoaded, so wait for that same readiness boundary.
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        if matches!(events.wait_event(0.0), Some(Ok(Event::FileLoaded))) {
            break;
        }
        assert!(
            Instant::now() < deadline,
            "seek fixture did not finish loading"
        );
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    let engine = MusicEngine::new();
    *engine.decks[0].inner.lock().await = Some(MusicSession {
        mpv: mpv.clone(),
        track_id: "seek-fixture".into(),
        connector_id: Some("local".into()),
        spectrum: Arc::new(std::sync::Mutex::new(spectrum::Spectrum::default())),
    });

    engine.seek(3.0).await.expect("seek while paused");
    wait_for_native(|| mpv.get_property::<f64>("time-pos").unwrap_or(0.0) >= 3.0).await;
    assert_ne!(
        mpv.get_property::<NativeFlag>("pause")
            .expect("pause state")
            .0,
        0
    );
    engine
        .set_paused(false)
        .await
        .expect("resume at chosen position");
    wait_for_native(|| mpv.get_property::<f64>("time-pos").unwrap_or(0.0) > 3.1).await;

    engine.seek(10.0).await.expect("seek to end");
    wait_for_native(|| {
        mpv.get_property::<NativeFlag>("eof-reached")
            .is_ok_and(|value| value.0 != 0)
    })
    .await;
    engine
        .set_paused(false)
        .await
        .expect("Play after seeking to end");
    wait_for_native(|| {
        let position = mpv.get_property::<f64>("time-pos").unwrap_or(10.0);
        position > 0.05 && position < 1.0
    })
    .await;
    assert_eq!(
        mpv.get_property::<NativeFlag>("pause")
            .expect("resumed state")
            .0,
        0
    );
    assert_eq!(
        mpv.get_property::<NativeFlag>("eof-reached")
            .expect("EOF cleared")
            .0,
        0
    );

    engine.seek(10.0).await.expect("seek to end again");
    wait_for_native(|| {
        mpv.get_property::<NativeFlag>("eof-reached")
            .is_ok_and(|value| value.0 != 0)
    })
    .await;
    engine.seek(4.0).await.expect("seek back from end");
    engine
        .set_paused(false)
        .await
        .expect("immediately resume the selected position");
    wait_for_native(|| {
        mpv.get_property::<f64>("time-pos")
            .is_ok_and(|position| position > 4.05 && position < 5.0)
    })
    .await;
    drop(mpv);
    engine.stop(false).await.expect("stop isolated player");
    std::fs::remove_file(path).expect("remove silent fixture");
}

#[test]
fn native_stream_headers_preserve_commas_and_backslashes() {
    force_c_numeric_locale();
    let mpv = Mpv::with_initializer(|init| {
        for (name, value) in [("ao", "null"), ("vo", "null"), ("idle", "yes")] {
            init.set_property(name, value)?;
        }
        Ok(())
    })
    .expect("silent native instance");
    let stream = MusicStream {
        url: String::new(),
        mime_type: String::new(),
        bitrate: 0,
        http_headers: [
            ("User-Agent".into(), "provided agent".into()),
            (
                "Accept".into(),
                "text/html,application/xhtml+xml,*/*;q=0.8".into(),
            ),
            ("X-Fixture".into(), r"one\two,three".into()),
            ("X-Both".into(), r"one\,two".into()),
            ("X-Trailing".into(), "one\\".into()),
        ]
        .into(),
    };
    stream.request_headers().expect("valid headers");
    apply_stream_headers(&mpv, &stream).expect("apply actual helper");
    assert_eq!(
        mpv.get_property::<String>("user-agent")
            .expect("user agent"),
        "provided agent"
    );
    let node = mpv
        .get_property::<MpvNode>("http-header-fields")
        .expect("native header list");
    let fields: Vec<String> = node
        .array()
        .expect("header array")
        .map(|value| value.str().expect("header string").to_string())
        .collect();
    assert_eq!(
        fields,
        vec![
            "Accept: text/html,application/xhtml+xml,*/*;q=0.8",
            r"X-Both: one\,two",
            r"X-Fixture: one\two,three",
            "X-Trailing: one\\"
        ]
    );
    let empty = MusicStream {
        http_headers: Default::default(),
        ..stream
    };
    apply_stream_headers(&mpv, &empty).expect("clear source headers");
    assert_eq!(
        mpv.get_property::<MpvNode>("http-header-fields")
            .expect("empty native header list")
            .array()
            .expect("header array")
            .count(),
        0
    );
}

#[test]
fn native_load_preserves_spaces_in_local_filenames() {
    force_c_numeric_locale();
    let directory =
        std::env::temp_dir().join(format!("harbor music load {}", std::process::id()));
    std::fs::create_dir_all(&directory).unwrap();
    let path = directory.join("01 - First Light.wav");
    // A short original silent PCM fixture; no audio device or remote source needed.
    let mut wav = Vec::new();
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&160036u32.to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&8000u32.to_le_bytes());
    wav.extend_from_slice(&16000u32.to_le_bytes());
    wav.extend_from_slice(&2u16.to_le_bytes());
    wav.extend_from_slice(&16u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&160000u32.to_le_bytes());
    wav.resize(160044, 0);
    std::fs::write(&path, wav).unwrap();
    let mpv = Mpv::with_initializer(|init| {
        for (name, value) in [
            ("keep-open", "yes"),
            ("ao", "null"),
            ("vo", "null"),
            ("pause", "yes"),
            ("idle", "yes"),
        ] {
            init.set_property(name, value)?;
        }
        Ok(())
    })
    .unwrap();
    crate::mpv::mpv_argv_command(&mpv, &["loadfile", path.to_str().unwrap(), "replace"])
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(5);
    while mpv.get_property::<f64>("duration").unwrap_or(0.0) <= 0.0 && Instant::now() < deadline
    {
        std::thread::sleep(Duration::from_millis(20));
    }
    let duration = mpv.get_property::<f64>("duration").unwrap_or(0.0);
    let quality = audio_quality(&mpv, Some(&path));
    assert_eq!(quality.codec.as_deref(), Some("pcm_s16le"));
    assert_eq!(quality.sample_rate_hz, Some(8000));
    assert_eq!(quality.bit_depth, Some(16));
    assert!(quality.bitrate_kbps.is_some());
    let streamed_quality = audio_quality(&mpv, None);
    assert_eq!(
        streamed_quality.bit_depth, None,
        "decoder packing is not source bit depth"
    );
    assert_eq!(
        std::mem::size_of::<NativeFlag>(),
        std::mem::size_of::<std::os::raw::c_int>()
    );
    for paused in [true, false, true, false] {
        mpv.set_property("pause", paused).unwrap();
        assert_eq!(
            mpv.get_property::<NativeFlag>("pause").unwrap().0 != 0,
            paused
        );
    }
    drop(mpv);
    std::fs::remove_file(&path).unwrap();
    std::fs::remove_dir(&directory).unwrap();
    assert!(
        (duration - 10.0).abs() < 0.02,
        "fixture did not decode: {duration}"
    );
}

#[test]
fn volume_is_bounded_for_native_mpv() {
    let settings = MusicAudioSettings::default();
    assert_eq!(settings.clamp_volume(-1.0), 0.0);
    assert_eq!(settings.clamp_volume(2.0), 1.0);
    assert_eq!(settings.clamp_volume(f64::NAN), 0.82);
}

#[test]
fn scrobble_threshold_uses_half_or_four_minutes() {
    assert!(!should_scrobble(149.0, 300.0));
    assert!(should_scrobble(150.0, 300.0));
    assert!(!should_scrobble(239.0, 900.0));
    assert!(should_scrobble(240.0, 900.0));
}

#[test]
fn listened_time_ignores_seek_jumps() {
    assert_eq!(listened_increment(Some(10.0), 10.5), 0.5);
    assert_eq!(listened_increment(Some(10.0), 120.0), 0.0);
    assert_eq!(listened_increment(Some(10.0), 9.0), 0.0);
}
