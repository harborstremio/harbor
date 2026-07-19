/// Builds the Simkl `/scrobble/{action}` body for a title + optional episode,
/// or null when the id can't be scrobbled. Progress is a 0–100 percent. Ports
/// the web `buildBody` — including anime (kitsu/mal/anilist/anidb), which the
/// watchlist fan-out skips but scrobble supports directly by its id namespace.
Map<String, dynamic>? buildSimklScrobbleBody(
  String metaId, {
  int? season,
  int? episode,
  required double progress,
}) {
  final p = progress.clamp(0, 100).toDouble();

  if (metaId.startsWith('tt')) {
    final imdb = metaId.split(':').first;
    if (!RegExp(r'^tt\d+$').hasMatch(imdb)) return null;
    if (episode != null) {
      return {
        'progress': p,
        'show': {
          'ids': {'imdb': imdb},
        },
        'episode': {'season': season ?? 1, 'number': episode},
      };
    }
    return {
      'progress': p,
      'movie': {
        'ids': {'imdb': imdb},
      },
    };
  }

  if (metaId.startsWith('tmdb:movie:')) {
    final id = int.tryParse(metaId.split(':')[2]);
    if (id == null) return null;
    return {
      'progress': p,
      'movie': {
        'ids': {'tmdb': id},
      },
    };
  }

  if (metaId.startsWith('tmdb:tv:')) {
    final id = int.tryParse(metaId.split(':')[2]);
    if (id == null || episode == null) return null;
    return {
      'progress': p,
      'show': {
        'ids': {'tmdb': id},
      },
      'episode': {'season': season ?? 1, 'number': episode},
    };
  }

  const animePrefixes = ['kitsu:', 'mal:', 'anilist:', 'anidb:'];
  for (final prefix in animePrefixes) {
    if (!metaId.startsWith(prefix)) continue;
    if (episode == null) return null;
    final num = int.tryParse(metaId.split(':')[1]);
    if (num == null) return null;
    final idKey = prefix.substring(0, prefix.length - 1);
    return {
      'progress': p,
      'anime': {
        'ids': {idKey: num},
      },
      'episode': {'season': season ?? 1, 'number': episode},
    };
  }

  return null;
}

/// The Simkl scrobble state machine for one playback session, ported from the
/// web `useSimklScrobble`. Like the Trakt scrobbler but with an 80% watched mark
/// and no load-reset gating (Simkl scrobbles as soon as playback is playing).
/// Pure — the network call is the injected [send] sink.
class SimklScrobbler {
  SimklScrobbler({
    required this.send,
    required this.pauseOnPause,
    required this.positionSec,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final void Function(String action, double progress) send;
  final bool pauseOnPause;
  final double Function() positionSec;
  final DateTime Function() _clock;

  static const stubMaxSec = 150;
  static const watchedMarkPct = 80; // SIMKL_WATCHED_RATIO * 100

  String? _lastAction;
  int _seekPosMs = 0;
  int _seekAtMs = 0;
  int _lastResyncMs = 0;

  int get _nowMs => _clock().millisecondsSinceEpoch;

  double _pct(double durationSec) =>
      (positionSec() / durationSec * 100).clamp(0, 100).toDouble();

  void onStatus(String status, double durationSec) {
    if (durationSec < stubMaxSec) return;
    if (status == 'ended') {
      if (_lastAction == 'start' || _lastAction == 'pause') {
        send('stop', 100);
        _lastAction = 'stop';
      }
      return;
    }
    if (_lastAction == 'stop') return;
    final progress = _pct(durationSec);
    if (status == 'playing' && _lastAction != 'start') {
      send('start', progress);
      _lastAction = 'start';
    } else if (status == 'paused' && _lastAction == 'start') {
      if (pauseOnPause) send('pause', progress);
      _lastAction = 'pause';
    }
  }

  void tick(double durationSec) {
    if (durationSec < stubMaxSec) return;
    final now = _nowMs;
    final posMs = (positionSec() * 1000).round();
    if (_lastAction != 'start') {
      _seekPosMs = posMs;
      _seekAtMs = now;
      return;
    }
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

  void finalize(double durationSec) {
    if (_lastAction != 'start' && _lastAction != 'pause') return;
    if (durationSec < stubMaxSec) {
      _lastAction = 'pause';
      return;
    }
    final progress = _pct(durationSec);
    final action = progress >= watchedMarkPct ? 'stop' : 'pause';
    if (action == 'stop' || pauseOnPause) send(action, progress);
    _lastAction = action;
  }
}
