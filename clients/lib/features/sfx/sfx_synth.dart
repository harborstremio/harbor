import 'dart:math' as math;
import 'dart:typed_data';

/// Sample rate for all generated SFX. The web `SoundEffects` uses the device
/// AudioContext default (48 kHz on the reference hardware); we fix 48 kHz so the
/// output is deterministic and testable.
const int kSfxSampleRate = 48000;

/// Oscillator waveforms, matching the Web Audio `OscillatorType`s used by
/// `SoundEffects`. Square/triangle/sawtooth are band-limited (additive Fourier
/// series up to Nyquist), mirroring Web Audio's ideal `PeriodicWave` — not the
/// naive aliased shapes.
enum SfxWave { sine, square, triangle, sawtooth }

/// A dependency-free synthesizer that renders Harbor's SFX to raw PCM and wraps
/// them in a WAV container. Ported 1:1 from the Web-Audio `SoundEffects`
/// primitives (`playTone`, `playGlass`, the cinematic `open` bass+shimmer). The
/// per-sound signal peaks at that sound's own `vol` (<= 0.06); the master
/// volume is applied at PLAYBACK (the AudioPlayer gain), never baked in — so
/// `setVolume` never re-renders, matching the web `masterGain` model.
class SfxSynth {
  const SfxSynth._();

  /// A single oscillator with the web `playTone` envelope: a linear attack over
  /// the first 5% of [dur] to [vol], then an exponential decay to 0.0001.
  static Float64List tone({
    required double freq,
    required SfxWave type,
    required double dur,
    required double vol,
  }) {
    final n = (dur * kSfxSampleRate).round();
    final out = Float64List(n);
    if (n == 0 || vol <= 0) return out;
    final attackEnd = dur * 0.05;
    final decayLen = dur - attackEnd;
    final maxK = (kSfxSampleRate / 2 / freq).floor().clamp(1, 2000);
    for (var i = 0; i < n; i++) {
      final t = i / kSfxSampleRate;
      final phase = 2 * math.pi * freq * t;
      final osc = _osc(type, phase, maxK);
      final double g;
      if (t < attackEnd) {
        g = attackEnd <= 0 ? vol : vol * t / attackEnd;
      } else {
        g = decayLen <= 0
            ? vol
            : vol * math.pow(0.0001 / vol, (t - attackEnd) / decayLen).toDouble();
      }
      out[i] = g * osc;
    }
    return out;
  }

  /// A 2-operator FM "glass" tone through a 4 kHz low-pass biquad, matching the
  /// web `playGlass`: sine carrier frequency-modulated (in Hz) by a sine whose
  /// depth decays exponentially, a fixed 10 ms attack, then exponential decay.
  static Float64List glass({
    required double freq,
    required double dur,
    required double vol,
    double modRatio = 2.76,
    double modDepth = 6,
  }) {
    final n = (dur * kSfxSampleRate).round();
    final out = Float64List(n);
    if (n == 0 || vol <= 0) return out;
    final modDecayEnd = dur * 0.6;

    // RBJ low-pass biquad, f0 = 4000, Q = 1 (Web Audio BiquadFilter default Q).
    final w0 = 2 * math.pi * 4000 / kSfxSampleRate;
    final cosW = math.cos(w0);
    final alpha = math.sin(w0) / 2; // sin(w0)/(2Q), Q=1
    final a0 = 1 + alpha;
    final b0 = (1 - cosW) / 2 / a0;
    final b1 = (1 - cosW) / a0;
    final b2 = (1 - cosW) / 2 / a0;
    final a1 = (-2 * cosW) / a0;
    final a2 = (1 - alpha) / a0;
    var x1 = 0.0, x2 = 0.0, y1 = 0.0, y2 = 0.0;

    var carrierPhase = 0.0;
    for (var i = 0; i < n; i++) {
      final t = i / kSfxSampleRate;
      final d = t < modDecayEnd
          ? modDepth * math.pow(0.01 / modDepth, t / modDecayEnd).toDouble()
          : 0.01;
      final m = math.sin(2 * math.pi * freq * modRatio * t);
      final fc = freq + d * m; // instantaneous carrier frequency (Hz)
      carrierPhase += 2 * math.pi * fc / kSfxSampleRate;
      final x0 = math.sin(carrierPhase);
      final y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
      final double a;
      if (t < 0.01) {
        a = vol * t / 0.01;
      } else {
        a = vol * math.pow(0.0001 / vol, (t - 0.01) / (dur - 0.01)).toDouble();
      }
      out[i] = a * y0;
    }
    return out;
  }

  /// The cinematic `open` sound: a pitch-gliding bass sine (100 → 35 Hz) plus a
  /// fixed 900 Hz shimmer, each with its own exponential gain envelope — a
  /// 1:1 port of the inline oscillator graph in the web `open()`.
  static Float64List cinematicOpen() {
    final n = (1.3 * kSfxSampleRate).round();
    final out = Float64List(n);
    var bassPhase = 0.0;
    for (var i = 0; i < n; i++) {
      final t = i / kSfxSampleRate;
      final bf = t < 0.35 ? 100 * math.pow(35 / 100, t / 0.35).toDouble() : 35.0;
      bassPhase += 2 * math.pi * bf / kSfxSampleRate;
      final double bg;
      if (t < 0.04) {
        bg = 0.0001 * math.pow(0.06 / 0.0001, t / 0.04).toDouble();
      } else if (t < 1.2) {
        bg = 0.06 * math.pow(0.001 / 0.06, (t - 0.04) / (1.2 - 0.04)).toDouble();
      } else {
        bg = 0.001;
      }
      final double sg;
      if (t < 0.05) {
        sg = 0.0001 * math.pow(0.012 / 0.0001, t / 0.05).toDouble();
      } else if (t < 0.5) {
        sg = 0.012 * math.pow(0.0001 / 0.012, (t - 0.05) / (0.5 - 0.05)).toDouble();
      } else {
        sg = 0.0001;
      }
      out[i] = bg * math.sin(bassPhase) + sg * math.sin(2 * math.pi * 900 * t);
    }
    return out;
  }

  /// Sums several rendered parts, each started at its own offset (seconds). Used
  /// for the web's simultaneous triads and the `setTimeout`-sequenced retro
  /// double-beeps — each web tone starts a fresh phase-0 oscillator, so an
  /// offset-sum is exactly equivalent.
  static Float64List combine(List<({Float64List samples, double offsetSec})> parts) {
    var total = 0;
    for (final p in parts) {
      final end = (p.offsetSec * kSfxSampleRate).round() + p.samples.length;
      if (end > total) total = end;
    }
    final out = Float64List(total);
    for (final p in parts) {
      final off = (p.offsetSec * kSfxSampleRate).round();
      for (var i = 0; i < p.samples.length; i++) {
        out[off + i] += p.samples[i];
      }
    }
    return out;
  }

  /// Wraps float samples ([-1, 1]) in a 16-bit mono little-endian WAV container
  /// (44-byte RIFF/WAVE header + PCM) — the byte form `audioplayers`'
  /// `BytesSource` decodes.
  static Uint8List wavBytes(Float64List samples) {
    final n = samples.length;
    final dataLen = n * 2;
    final bytes = Uint8List(44 + dataLen);
    final bd = ByteData.view(bytes.buffer);
    bd.setUint32(0, 0x52494646, Endian.big); // 'RIFF'
    bd.setUint32(4, 36 + dataLen, Endian.little);
    bd.setUint32(8, 0x57415645, Endian.big); // 'WAVE'
    bd.setUint32(12, 0x666d7420, Endian.big); // 'fmt '
    bd.setUint32(16, 16, Endian.little); // subchunk1 size
    bd.setUint16(20, 1, Endian.little); // PCM
    bd.setUint16(22, 1, Endian.little); // mono
    bd.setUint32(24, kSfxSampleRate, Endian.little);
    bd.setUint32(28, kSfxSampleRate * 2, Endian.little); // byteRate
    bd.setUint16(32, 2, Endian.little); // blockAlign
    bd.setUint16(34, 16, Endian.little); // bits per sample
    bd.setUint32(36, 0x64617461, Endian.big); // 'data'
    bd.setUint32(40, dataLen, Endian.little);
    for (var i = 0; i < n; i++) {
      var v = samples[i];
      if (v > 1) v = 1;
      if (v < -1) v = -1;
      bd.setInt16(44 + i * 2, (v * 32767).round(), Endian.little);
    }
    return bytes;
  }

  static double _osc(SfxWave type, double phase, int maxK) {
    switch (type) {
      case SfxWave.sine:
        return math.sin(phase);
      case SfxWave.square:
        var s = 0.0;
        for (var k = 1; k <= maxK; k += 2) {
          s += math.sin(k * phase) / k;
        }
        return 4 / math.pi * s;
      case SfxWave.sawtooth:
        var s = 0.0;
        for (var k = 1; k <= maxK; k++) {
          s += (k.isOdd ? 1 : -1) * math.sin(k * phase) / k; // (-1)^(k+1)
        }
        return 2 / math.pi * s;
      case SfxWave.triangle:
        var s = 0.0;
        var sign = 1.0;
        for (var k = 1; k <= maxK; k += 2) {
          s += sign * math.sin(k * phase) / (k * k);
          sign = -sign;
        }
        return 8 / (math.pi * math.pi) * s;
    }
  }
}
