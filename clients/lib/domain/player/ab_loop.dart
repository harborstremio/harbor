/// The A–B repeat state — loops playback between marks A and B. Ported 1:1 from
/// the web `use-ab-loop` (`views/player/hooks/use-ab-loop.ts`). Pure and
/// testable: the player marks A/B from the current position, pushes the marks to
/// the engine, and ticks [seekBackTarget] on the playback clock to jump back to
/// A when the loop end is reached (the cross-engine fallback for the default
/// engine, which has no native A–B loop).
class AbLoopController {
  double? _a;
  double? _b;

  double? get a => _a;
  double? get b => _b;

  /// A complete, ordered loop (B strictly after A) is set.
  bool get active => _a != null && _b != null && _b! > _a!;

  /// Marks A at [posSec] (clamped to ≥ 0); drops B if it now sits at or behind A.
  void setA(double posSec) {
    _a = posSec < 0 ? 0 : posSec;
    if (_b != null && _b! <= _a!) _b = null;
  }

  /// Marks B at [posSec] — only when A is set and [posSec] is strictly after A.
  void setB(double posSec) {
    final start = _a;
    if (start == null) return;
    final t = posSec < 0 ? 0.0 : posSec;
    if (t <= start) return;
    _b = t;
  }

  void clear() {
    _a = null;
    _b = null;
  }

  /// The position to jump back to (A) once [posSec] reaches the loop end (within
  /// 50 ms, matching the web), or null when there is nothing to loop.
  double? seekBackTarget(double posSec) {
    if (!active) return null;
    return posSec >= _b! - 0.05 ? _a : null;
  }
}
