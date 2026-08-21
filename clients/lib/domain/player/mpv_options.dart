import '../settings/settings.dart';

/// The per-quality mpv render options, ported 1:1 from QUALITY_LINES in
/// `mpv-tuning.ts`.
const _qualityLines = <String, List<String>>{
  'balanced': [],
  'performance': [
    'scale=bilinear',
    'cscale=bilinear',
    'dscale=bilinear',
    'dither=no',
    'deband=no',
    'vd-lavc-fast=yes',
    'interpolation=no',
    'hdr-compute-peak=no',
  ],
  'quality': [
    'scale=ewa_lanczossharp',
    'cscale=ewa_lanczossharp',
    'dscale=mitchell',
    'deband=yes',
    'deband-iterations=2',
    'dither-depth=auto',
    'correct-downscaling=yes',
    'linear-downscaling=yes',
    'sigmoid-upscaling=yes',
    'hdr-compute-peak=yes',
  ],
};

/// The mpv `key=value` options for the current settings, ported from
/// `compileMpvOptions` in `mpv-tuning.ts`: the quality preset, buffer boost,
/// stereo downmix, a chosen audio device, an OLED HDR-tone-map tweak, and the
/// user's freeform `mpvTweaks`. Hardware decoding is applied separately (it is
/// pinned before load) via the bridge's setHwdec.
Map<String, String> compileMpvOptions(Settings s) {
  final out = <String, String>{};
  void add(String line) {
    final i = line.indexOf('=');
    if (i > 0) out[line.substring(0, i)] = line.substring(i + 1);
  }

  for (final l in _qualityLines[s.getString('mpvQuality')] ?? const []) {
    add(l);
  }
  if (s.getBool('mpvBufferBoost')) {
    out['cache'] = 'yes';
    out['demuxer-max-bytes'] = '150MiB';
    out['demuxer-readahead-secs'] = '20';
  }
  if (s.getBool('mpvDownmixStereo')) out['audio-channels'] = 'stereo';
  final audioDevice = s.getString('audioDevice');
  if (audioDevice.isNotEmpty && audioDevice != 'auto') {
    out['audio-device'] = audioDevice;
  }
  if (s.getString('playerDisplayPanel') == 'oled' &&
      s.getBool('playerHdrToSdr')) {
    out['target-contrast'] = 'inf';
  }
  s.getMap('mpvTweaks').forEach((k, v) {
    final value = v?.toString() ?? '';
    if (value.isNotEmpty) out[k] = value;
  });
  return out;
}
