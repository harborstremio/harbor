import 'resume_store.dart';

/// The resume/continue-watching write-back guards, ported from
/// `use-resume-autosave.ts` (`docs/50` §13). The player drives it: a 4s tick
/// while playing, plus forced saves on transitions and teardown. This holds the
/// decision logic (timing dedup, minimum position, stub-duration guard, iptv
/// skip, finished ratio) so it is testable without a player.
class ResumeAutosave {
  ResumeAutosave(this._store, {required this.id, this.season, this.episode});

  static const int tickMs = 4000;
  static const int dedupMs = 1500;
  static const double minPositionSec = 5;
  static const double stubMaxSec = 150;
  static const double watchedRatio = 0.85;

  final ResumeStore _store;
  final String id;
  final int? season;
  final int? episode;

  int _lastSavedMs = -1000000;

  /// Persists the current position when the guards allow: skips `iptv:` ids,
  /// stub durations (`0 < dur < 150`), positions under 5s, and (unless [force])
  /// positions that moved less than 1500ms since the last save.
  Future<void> maybeSave({
    required double positionSec,
    required double durationSec,
    bool force = false,
  }) async {
    if (id.startsWith('iptv:')) return;
    if (durationSec > 0 && durationSec < stubMaxSec) return;
    if (positionSec < minPositionSec) return;
    final posMs = (positionSec * 1000).round();
    if (!force && (posMs - _lastSavedMs).abs() < dedupMs) return;
    await _store.saveResumeMs(id, posMs, season, episode);
    _lastSavedMs = posMs;
  }

  /// Whether the title counts as finished — position past the 0.85 ratio, or an
  /// explicit ended state.
  bool isFinished({
    required double positionSec,
    required double durationSec,
    bool ended = false,
  }) {
    if (ended) return true;
    if (durationSec <= 0) return false;
    return positionSec / durationSec >= watchedRatio;
  }
}
