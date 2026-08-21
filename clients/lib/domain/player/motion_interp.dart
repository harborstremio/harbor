/// The mpv properties that toggle frame interpolation ("motion smoothing"),
/// ported 1:1 from `applyMotionInterp` in `src/lib/player/motion-interp.ts`.
///
/// When [on], mpv resamples the video clock to the display's refresh rate and
/// synthesises the in-between frames (`tscale=oversample`), so fast pans — the
/// judder anime draws on twos and threes is prone to — glide. When off, each
/// frame is shown once and the clock follows the audio, mpv's normal playback.
///
/// Applied only by the advanced (libmpv) engine; the default engine's
/// `setMpvOptions` is a no-op, so passing these through is harmless there.
Map<String, String> motionInterpProps(bool on) => on
    ? const <String, String>{
        'video-sync': 'display-resample',
        'interpolation': 'yes',
        'tscale': 'oversample',
      }
    : const <String, String>{'interpolation': 'no', 'video-sync': 'audio'};
