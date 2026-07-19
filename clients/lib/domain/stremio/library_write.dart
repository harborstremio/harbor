/// Builds the Stremio library-item map that a continue-watching cloud write
/// puts, porting `writeLibraryItem`/`videoIdFor` from the web
/// `views/player/hooks/use-stremio-sync.ts`. Kept pure (no Flutter, no clock)
/// so the timesWatched/flaggedWatched/credits-reset/removed-temp accounting —
/// the subtle bits — is unit-tested in isolation.
library;

/// A stub-length media (an error page, a trailer) never counts as real
/// playback and must not overwrite a genuine library position.
const cwStubMaxSec = 150;

/// Below this the position is treated as "not started" — no cloud write.
const cwMinPositionSec = 6;

/// Past this ratio a *terminal* write on a movie resets `timeOffset` to 0, so a
/// finished film leaves continue-watching (the credits-roll reset).
const cwCreditsRatio = 0.9;

/// The `video_id` for a write. Ports `videoIdFor`: a movie (or a non-episode
/// series row) is keyed by the canonical id; an episode threads its own video
/// id when it shares the canonical id's namespace, else falls back to the
/// IMDb-numbered or plain `id:season:episode` form.
String cwVideoId({
  required String canonicalId,
  required bool isSeries,
  required bool isEpisode,
  String? threaded,
  int? imdbSeason,
  int? imdbEpisode,
  int? season,
  int? episode,
}) {
  if (!isSeries || !isEpisode) return canonicalId;
  if (threaded != null &&
      threaded.isNotEmpty &&
      threaded.split(':').first == canonicalId.split(':').first) {
    return threaded;
  }
  if (canonicalId.startsWith('tt') &&
      imdbSeason != null &&
      imdbEpisode != null) {
    return '$canonicalId:$imdbSeason:$imdbEpisode';
  }
  return '$canonicalId:$season:$episode';
}

/// The playback facts a continue-watching cloud write needs, decoupled from the
/// player's snapshot/src types.
class CwWriteInput {
  const CwWriteInput({
    required this.canonicalId,
    required this.metaName,
    required this.metaType,
    this.metaPoster,
    required this.positionSec,
    required this.durationSec,
    required this.isTerminal,
    required this.statusError,
    this.isEpisode = false,
    this.season,
    this.episode,
    this.threadedVideoId,
    this.imdbSeason,
    this.imdbEpisode,
  });

  final String canonicalId;
  final String metaName;
  final String metaType;
  final String? metaPoster;
  final double positionSec;
  final double durationSec;

  /// A pause/ended/error/teardown write (vs a mid-play tick) — only these can
  /// trigger the credits reset.
  final bool isTerminal;

  /// Playback ended in the error state — never counts as watched.
  final bool statusError;

  final bool isEpisode;
  final int? season;
  final int? episode;
  final String? threadedVideoId;
  final int? imdbSeason;
  final int? imdbEpisode;

  bool get isSeries => metaType == 'series' || isEpisode;

  String get videoId => cwVideoId(
    canonicalId: canonicalId,
    isSeries: isSeries,
    isEpisode: isEpisode,
    threaded: threadedVideoId,
    imdbSeason: imdbSeason,
    imdbEpisode: imdbEpisode,
    season: season,
    episode: episode,
  );
}

String _pickPosterShape(Object? value) =>
    (value == 'square' || value == 'landscape' || value == 'poster')
    ? value as String
    : 'poster';

double _num(Object? v) => v is num ? v.toDouble() : 0;

String? _nonEmpty(Object? v) => v is String && v.trim().isNotEmpty ? v : null;

/// Builds the library-item map to `datastorePut`, or null when the write should
/// be skipped (a stub-length media, or no resolvable name). [base] is the raw
/// item currently on the account (null when it has never been saved); [nowIso]
/// is the caller's ISO-8601 clock (for `_ctime`/`_mtime`).
Map<String, dynamic>? buildCwLibraryWrite({
  required Map<String, dynamic>? base,
  required CwWriteInput input,
  required String nowIso,
}) {
  if (input.durationSec > 0 && input.durationSec < cwStubMaxSec) return null;

  final baseName = (base?['name'] is String)
      ? (base!['name'] as String).trim()
      : '';
  final metaName = input.metaName.trim();
  final isAnimeWrite =
      RegExp(r'^(kitsu|mal|anilist|anidb):').hasMatch(input.canonicalId) ||
      input.metaType == 'anime';
  final name = isAnimeWrite
      ? (baseName.isNotEmpty ? baseName : metaName)
      : (metaName.isNotEmpty ? metaName : baseName);
  if (name.isEmpty) return null;

  final baseState = base?['state'] is Map
      ? (base!['state'] as Map).cast<String, Object?>()
      : const <String, Object?>{};
  final offsetMs = input.positionSec <= 0
      ? 0
      : (input.positionSec * 1000).floor();
  final durationMs = input.durationSec <= 0
      ? 0
      : (input.durationSec * 1000).floor();
  final watchedRatio =
      input.positionSec / (input.durationSec < 1 ? 1 : input.durationSec);
  final videoId = input.videoId;
  final prevVideoId = baseState['video_id'] is String
      ? baseState['video_id'] as String
      : null;
  final videoChanged = prevVideoId != null && prevVideoId != videoId;
  final prevTimesWatched = _num(baseState['timesWatched']).floor();
  final prevTimeWatched = _num(baseState['timeWatched']).floor();
  final prevOverall = _num(baseState['overallTimeWatched']).floor();
  final prevWatched = _nonEmpty(baseState['watched']);
  final prevLastVidReleased = baseState['lastVidReleased'] is String
      ? baseState['lastVidReleased'] as String
      : null;
  final prevFlagged = _num(baseState['flaggedWatched']).floor();
  final effPrevFlagged = videoChanged ? 0 : prevFlagged;
  final priorDuration = _num(baseState['duration']).floor();
  final durationShrunk =
      !input.isEpisode &&
      priorDuration > 0 &&
      durationMs > 0 &&
      durationMs < priorDuration * 0.7;
  final playedReal = !input.statusError && !durationShrunk;
  final nowFlagged = durationMs > 0 && watchedRatio > 0.7 && playedReal;
  final creditsReset =
      input.isTerminal &&
      watchedRatio > cwCreditsRatio &&
      !input.isEpisode &&
      playedReal;

  final state = <String, dynamic>{
    'lastWatched': nowIso,
    'timeWatched': offsetMs,
    'timeOffset': creditsReset ? 0 : offsetMs,
    'overallTimeWatched': prevOverall + (videoChanged ? prevTimeWatched : 0),
    'timesWatched': nowFlagged && effPrevFlagged == 0
        ? prevTimesWatched + 1
        : prevTimesWatched,
    'flaggedWatched': nowFlagged ? 1 : effPrevFlagged,
    'duration': durationMs,
    'video_id': videoId,
    'watched': prevWatched,
    'lastVidReleased': prevLastVidReleased,
    'noNotif': baseState['noNotif'] == true,
  };

  final baseHints = base?['behaviorHints'] is Map
      ? (base!['behaviorHints'] as Map).cast<String, Object?>()
      : const <String, Object?>{};
  final behaviorHints = <String, dynamic>{
    'defaultVideoId': baseHints['defaultVideoId'],
    'featuredVideoId': baseHints['featuredVideoId'],
    'hasScheduledVideos': baseHints['hasScheduledVideos'] ?? false,
  };

  final ctime = base?['_ctime'] is String ? base!['_ctime'] as String : nowIso;
  final metaPoster = _nonEmpty(input.metaPoster);
  final basePoster = _nonEmpty(base?['poster']);
  final baseType = (base?['type'] == 'series' || base?['type'] == 'movie')
      ? base!['type'] as String
      : null;
  var removed = base != null ? base['removed'] == true : true;
  var temp = base != null ? base['temp'] == true : true;
  if (temp && state['timesWatched'] == 0) removed = true;
  if (removed) temp = true;

  return <String, dynamic>{
    '_id': input.canonicalId,
    'name': name,
    'type': input.isEpisode
        ? 'series'
        : (baseType ?? (input.isSeries ? 'series' : 'movie')),
    'poster': metaPoster ?? basePoster,
    'posterShape': _pickPosterShape(base?['posterShape']),
    'removed': removed,
    'temp': temp,
    '_ctime': ctime,
    '_mtime': nowIso,
    'state': state,
    'behaviorHints': behaviorHints,
  };
}

/// The full library-item state with every field defaulted, porting the web
/// `baseState` — so a patched write always carries the complete state shape.
Map<String, dynamic> _fullBaseState(Map<String, Object?> s, String nowIso) => {
  'lastWatched': s['lastWatched'] is String ? s['lastWatched'] : nowIso,
  'timeWatched': _num(s['timeWatched']).floor(),
  'timeOffset': _num(s['timeOffset']).floor(),
  'overallTimeWatched': _num(s['overallTimeWatched']).floor(),
  'timesWatched': _num(s['timesWatched']).floor(),
  'flaggedWatched': _num(s['flaggedWatched']).floor(),
  'duration': _num(s['duration']).floor(),
  'video_id': s['video_id'] is String ? s['video_id'] : null,
  'watched': _nonEmpty(s['watched']),
  'lastVidReleased': s['lastVidReleased'] is String
      ? s['lastVidReleased']
      : null,
  'noNotif': s['noNotif'] == true,
};

/// Shared item construction for a state-patching write (the mark-watched
/// family), porting `putWithState`: it lands a real (non-removed) bookmark,
/// preserves every prior state field, applies [patch] (which receives the full
/// prior state), and always stamps `lastWatched`. Returns null with no name.
Map<String, dynamic>? _buildStatePatchWrite({
  required Map<String, dynamic>? base,
  required String canonicalId,
  required String metaName,
  String? metaPoster,
  String? metaBackground,
  required String metaType,
  required String nowIso,
  required Map<String, dynamic> Function(Map<String, dynamic> prev) patch,
}) {
  final rawState = base?['state'] is Map
      ? (base!['state'] as Map).cast<String, Object?>()
      : const <String, Object?>{};
  final prev = _fullBaseState(rawState, nowIso);

  final baseName = base?['name'] is String
      ? (base!['name'] as String).trim()
      : '';
  final name = baseName.isNotEmpty ? baseName : metaName.trim();
  if (name.isEmpty) return null;

  final state = <String, dynamic>{
    ...prev,
    ...patch(prev),
    'lastWatched': nowIso,
  };

  final baseHints = base?['behaviorHints'] is Map
      ? (base!['behaviorHints'] as Map).cast<String, Object?>()
      : const <String, Object?>{};
  final baseType = (base?['type'] == 'series' || base?['type'] == 'movie')
      ? base!['type'] as String
      : null;
  final ctime = base?['_ctime'] is String ? base!['_ctime'] as String : nowIso;

  return <String, dynamic>{
    '_id': canonicalId,
    'type': baseType ?? (metaType == 'series' ? 'series' : 'movie'),
    'name': name,
    'poster': _nonEmpty(metaPoster) ?? _nonEmpty(base?['poster']),
    'posterShape': _pickPosterShape(base?['posterShape']),
    'background': _nonEmpty(metaBackground) ?? base?['background'],
    'state': state,
    'behaviorHints': <String, dynamic>{
      'defaultVideoId': baseHints['defaultVideoId'],
      'featuredVideoId': baseHints['featuredVideoId'],
      'hasScheduledVideos': baseHints['hasScheduledVideos'] ?? false,
    },
    'removed': false,
    'temp': false,
    '_ctime': ctime,
    '_mtime': nowIso,
  };
}

/// Builds the library-item map that flags (or unflags) a movie watched on the
/// account, touching only the watched flags. Ports `markMovieWatchedStremio`.
Map<String, dynamic>? buildMovieWatchedWrite({
  required Map<String, dynamic>? base,
  required String canonicalId,
  required String metaName,
  String? metaPoster,
  String? metaBackground,
  required String metaType,
  required bool watched,
  required String nowIso,
}) => _buildStatePatchWrite(
  base: base,
  canonicalId: canonicalId,
  metaName: metaName,
  metaPoster: metaPoster,
  metaBackground: metaBackground,
  metaType: metaType,
  nowIso: nowIso,
  patch: (prev) {
    final prevTimesWatched = prev['timesWatched'] as int;
    return {
      'flaggedWatched': watched ? 1 : 0,
      'timesWatched': watched
          ? (prevTimesWatched < 1 ? 1 : prevTimesWatched)
          : prevTimesWatched,
    };
  },
);

/// Builds the library-item map that stores a series' watched-episode bitmap
/// ([watchedField], the encoded `state.watched`) on the account, leaving the
/// rest of the state intact. Ports `setEpisodesWatchedStremio`.
Map<String, dynamic>? buildEpisodesWatchedWrite({
  required Map<String, dynamic>? base,
  required String canonicalId,
  required String metaName,
  String? metaPoster,
  String? metaBackground,
  required String watchedField,
  required String nowIso,
}) => _buildStatePatchWrite(
  base: base,
  canonicalId: canonicalId,
  metaName: metaName,
  metaPoster: metaPoster,
  metaBackground: metaBackground,
  metaType: 'series',
  nowIso: nowIso,
  patch: (_) => {'watched': watchedField},
);
