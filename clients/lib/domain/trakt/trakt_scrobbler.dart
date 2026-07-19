/// The Trakt scrobble state machine for one playback session, ported from the
/// web `useTraktScrobble`. It turns player status transitions and periodic
/// ticks into `start`/`pause`/`stop` scrobbles, tracking the furthest progress
/// so a teardown past [watchedMarkPct] finalizes as a `stop` (watched) rather
/// than a `pause`.
///
/// Pure — the actual network call is the injected [send] sink, position comes
/// from [positionSec], and time from [clock] — so the machine is unit-tested in
/// isolation. Created per playback session (each new title gets a fresh
/// scrobbler), so no cross-episode key handling is needed.
class TraktScrobbler {
  TraktScrobbler({
    required this.send,
    required this.pauseOnPause,
    required this.positionSec,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  /// Performs the scrobble for [action] (`start`/`pause`/`stop`) at [progress].
  final void Function(String action, double progress) send;

  /// The `pauseListStatusOnPause` setting — whether a pause emits a scrobble.
  final bool pauseOnPause;

  /// The live playback position in seconds.
  final double Function() positionSec;

  final DateTime Function() _clock;

  /// Below this runtime a title is a stub (trailer/error) and never scrobbled.
  static const stubMaxSec = 150;

  /// At/above this percent a finalize counts as watched (a `stop`).
  static const watchedMarkPct = 70;

  String? _lastAction; // start | pause | stop | null
  double _progress = 0; // furthest percent reached
  bool _loadResetSeen = true;
  int _seekPosMs = 0;
  int _seekAtMs = 0;
  int _lastResyncMs = 0;

  int get _nowMs => _clock().millisecondsSinceEpoch;

  double _pct(double durationSec) =>
      (positionSec() / durationSec * 100).clamp(0, 100).toDouble();

  /// Drives the machine on a player status change (`playing`/`paused`/`ended`/
  /// `loading`/…). Ports the hook's status effect.
  void onStatus(String status, double durationSec) {
    if (status == 'ended') {
      if (durationSec >= stubMaxSec &&
          (_lastAction == 'start' || _lastAction == 'pause')) {
        send('stop', 100);
        _lastAction = 'stop';
      }
      return;
    }
    if (!_loadResetSeen) {
      if (status == 'loading' || durationSec <= 0) _loadResetSeen = true;
      return;
    }
    if (durationSec <= 0 || durationSec < stubMaxSec) return;
    final progress = _pct(durationSec);
    if (progress > _progress) _progress = progress;
    if (_lastAction == 'stop') return;

    if (status == 'playing' && _lastAction != 'start') {
      send('start', progress);
      _lastAction = 'start';
    } else if (status == 'paused' && _lastAction == 'start') {
      if (pauseOnPause) send('pause', progress);
      _lastAction = 'pause';
    }
  }

  /// A periodic tick (from the player's autosave timer): tracks progress and
  /// re-sends `start` after a detected seek, throttled to 30s. Ports the hook's
  /// seek-resync effect.
  void tick(double durationSec) {
    if (durationSec <= 0 || durationSec < stubMaxSec) return;
    final now = _nowMs;
    final posMs = (positionSec() * 1000).round();
    if (_lastAction != 'start') {
      _seekPosMs = posMs;
      _seekAtMs = now;
      return;
    }
    final pct = positionSec() / durationSec * 100;
    if (pct > _progress) _progress = pct;
    final dPosSec = (posMs - _seekPosMs) / 1000;
    final dT = (now - _seekAtMs) / 1000;
    _seekPosMs = posMs;
    _seekAtMs = now;
    final isSeek =
        dPosSec.abs() > 8 &&
        (dT < 1.5 || (dPosSec / (dT < 0.001 ? 0.001 : dT)).abs() > 4);
    if (!isSeek) return;
    if (now - _lastResyncMs < 30000) return;
    _lastResyncMs = now;
    send('start', _pct(durationSec));
  }

  /// Finalizes at teardown: `stop` (watched) past [watchedMarkPct], else a
  /// `pause` (when enabled). Ports the hook's unmount effect.
  void finalize(double durationSec) {
    if (_lastAction != 'start' && _lastAction != 'pause') return;
    if (durationSec > 0) {
      final live = positionSec() / durationSec * 100;
      final progress = (_progress > live ? _progress : live)
          .clamp(0, 100)
          .toDouble();
      final action = progress >= watchedMarkPct ? 'stop' : 'pause';
      if (action == 'stop' || pauseOnPause) {
        send(action, action == 'stop' ? 100 : progress);
      }
      _lastAction = action;
    } else {
      _lastAction = 'pause';
    }
  }
}
