import 'dart:typed_data';

import 'sfx_synth.dart';

/// The UI/player sound events, matching the public methods of the web
/// `SoundEffects` class.
enum SfxEvent { volumeChange, click, hover, open, close, navigate }

/// The supported themes (web `soundTheme`). `none` produces no sound.
const List<String> kSfxThemes = ['none', 'glass', 'modern', 'retro', 'cinematic'];

/// Renders + memoizes the SFX buffers. Each `(theme, event, up, soundType)`
/// resolves to a single WAV byte buffer (rendered once, cached). The tables
/// below are a 1:1 transcription of every theme branch in the web
/// `SoundEffects` methods (volumeChange/click/hover/open/close/navigate).
class SfxCatalog {
  final Map<String, Uint8List> _memo = {};

  /// A stable cache id for a resolved buffer, or null when there is no sound
  /// (theme `none`). Two calls that render identical audio share one id.
  String? idFor(
    String theme,
    SfxEvent event, {
    bool up = true,
    String soundType = 'light',
  }) {
    if (theme == 'none') return null;
    final (u, s) = _normalize(theme, event, up, soundType);
    return '$theme:${event.name}:${u ? 'u' : 'd'}:$s';
  }

  /// The WAV bytes for an event under a theme, or null for `none`. Rendered on
  /// first use and cached by [idFor].
  Uint8List? wav(
    String theme,
    SfxEvent event, {
    bool up = true,
    String soundType = 'light',
  }) {
    final id = idFor(theme, event, up: up, soundType: soundType);
    if (id == null) return null;
    return _memo.putIfAbsent(id, () {
      final (u, s) = _normalize(theme, event, up, soundType);
      return SfxSynth.wavBytes(_render(theme, event, u, s));
    });
  }

  /// Collapses `(up, soundType)` to only the values that actually affect the
  /// output for a given theme+event, so equivalent requests share a cache id.
  (bool, String) _normalize(String theme, SfxEvent e, bool up, String soundType) {
    switch (e) {
      case SfxEvent.volumeChange:
        return (up, 'light'); // every theme varies by direction only
      case SfxEvent.navigate:
        if (theme == 'glass') {
          // glass-light ignores direction; glass-movie pitch depends on it
          return (soundType == 'movie' ? up : true, soundType);
        }
        if (theme == 'modern') return (true, soundType); // ignores direction
        return (true, 'light'); // retro/cinematic ignore both
      case SfxEvent.click:
      case SfxEvent.hover:
      case SfxEvent.open:
      case SfxEvent.close:
        return (true, 'light'); // direction/soundType irrelevant
    }
  }

  Float64List _render(String theme, SfxEvent e, bool up, String soundType) {
    switch (theme) {
      case 'glass':
        return _glass(e, up, soundType);
      case 'modern':
        return _modern(e, up, soundType);
      case 'retro':
        return _retro(e, up);
      case 'cinematic':
        return _cinematic(e, up);
      default:
        return Float64List(0);
    }
  }

  // ---- glass (FM synth) --------------------------------------------------
  Float64List _glass(SfxEvent e, bool up, String soundType) {
    switch (e) {
      case SfxEvent.volumeChange:
        return SfxSynth.glass(freq: up ? 1750 : 1250, dur: 0.05, vol: 0.012);
      case SfxEvent.click:
        return SfxSynth.glass(freq: 1500, dur: 0.08, vol: 0.04);
      case SfxEvent.hover:
        return SfxSynth.glass(freq: 2200, dur: 0.05, vol: 0.015);
      case SfxEvent.open:
        return SfxSynth.glass(freq: 720, dur: 0.5, vol: 0.04, modRatio: 3);
      case SfxEvent.close:
        return SfxSynth.glass(freq: 560, dur: 0.3, vol: 0.03);
      case SfxEvent.navigate:
        return soundType == 'light'
            ? SfxSynth.glass(freq: 2000, dur: 0.08, vol: 0.012)
            : SfxSynth.glass(freq: up ? 980 : 1120, dur: 0.22, vol: 0.03);
    }
  }

  // ---- modern (pure sine) ------------------------------------------------
  Float64List _modern(SfxEvent e, bool up, String soundType) {
    Float64List t(double f, double d, double v) =>
        SfxSynth.tone(freq: f, type: SfxWave.sine, dur: d, vol: v);
    switch (e) {
      case SfxEvent.volumeChange:
        return t(up ? 620 : 420, 0.04, 0.02);
      case SfxEvent.click:
        return t(400, 0.05, 0.035);
      case SfxEvent.hover:
        return t(1200, 0.015, 0.01);
      case SfxEvent.open:
        return SfxSynth.combine([
          (samples: t(523.25, 0.3, 0.03), offsetSec: 0),
          (samples: t(659.25, 0.3, 0.025), offsetSec: 0),
          (samples: t(783.99, 0.3, 0.02), offsetSec: 0),
        ]);
      case SfxEvent.close:
        return SfxSynth.combine([
          (samples: t(392.0, 0.22, 0.03), offsetSec: 0),
          (samples: t(329.63, 0.22, 0.02), offsetSec: 0),
        ]);
      case SfxEvent.navigate:
        return soundType == 'light' ? t(420, 0.03, 0.03) : t(310, 0.04, 0.045);
    }
  }

  // ---- retro (square/triangle blips; only volumeChange varies by direction,
  //      navigate/soundType are ignored per the web retro branch) -----------
  Float64List _retro(SfxEvent e, bool up) {
    Float64List sq(double f, double d, double v) =>
        SfxSynth.tone(freq: f, type: SfxWave.square, dur: d, vol: v);
    Float64List tri(double f, double d, double v) =>
        SfxSynth.tone(freq: f, type: SfxWave.triangle, dur: d, vol: v);
    switch (e) {
      case SfxEvent.volumeChange:
        return sq(up ? 780 : 560, 0.04, 0.012);
      case SfxEvent.click:
        return SfxSynth.combine([
          (samples: sq(520, 0.022, 0.007), offsetSec: 0),
          (samples: tri(360, 0.028, 0.005), offsetSec: 0.012),
        ]);
      case SfxEvent.hover:
        return SfxSynth.combine([
          (samples: sq(740, 0.016, 0.0035), offsetSec: 0),
          (samples: tri(880, 0.018, 0.003), offsetSec: 0.010),
        ]);
      case SfxEvent.open:
        return SfxSynth.combine([
          (samples: tri(523, 0.06, 0.012), offsetSec: 0),
          (samples: tri(659, 0.045, 0.01), offsetSec: 0.015),
        ]);
      case SfxEvent.close:
        return SfxSynth.combine([
          (samples: tri(560, 0.05, 0.01), offsetSec: 0),
          (samples: tri(430, 0.06, 0.008), offsetSec: 0.035),
        ]);
      case SfxEvent.navigate:
        return SfxSynth.combine([
          (samples: sq(880, 0.018, 0.004), offsetSec: 0),
          (samples: sq(1046, 0.022, 0.0035), offsetSec: 0.012),
        ]);
    }
  }

  // ---- cinematic (low sines + custom open; navigate ignores args) --------
  Float64List _cinematic(SfxEvent e, bool up) {
    Float64List t(double f, double d, double v) =>
        SfxSynth.tone(freq: f, type: SfxWave.triangle, dur: d, vol: v);
    Float64List s(double f, double d, double v) =>
        SfxSynth.tone(freq: f, type: SfxWave.sine, dur: d, vol: v);
    switch (e) {
      case SfxEvent.volumeChange:
        return t(up ? 220 : 150, 0.07, 0.025);
      case SfxEvent.click:
        return s(180, 0.12, 0.02);
      case SfxEvent.hover:
        return s(350, 0.04, 0.01);
      case SfxEvent.open:
        return SfxSynth.cinematicOpen();
      case SfxEvent.close:
        return s(90, 0.4, 0.05);
      case SfxEvent.navigate:
        return s(200, 0.12, 0.01);
    }
  }
}
