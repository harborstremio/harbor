import '../cached.dart';
import '../parsed_stream.dart';
import '../parser/stream_enums.dart';
import '../parser/trusted_groups.dart';
import 'score_components.dart';
import 'scored_stream.dart';

const int _maxSafeInt = 9007199254740991;

/// Scores a single [ParsedStream] against [opts], ported from
/// `src/lib/streams/scoring/scoring-stream.ts`. [corpus] (when provided) enables
/// the theater-capture recency heuristics; [now] is injectable for determinism.
ScoredStream scoreStream(
  ParsedStream s,
  ScoreOptions opts, {
  CorpusStats? corpus,
  DateTime? now,
}) {
  final at = now ?? DateTime.now();
  final reasons = <ScoreReason>[];
  var score = 0;
  void push(ScoreReason r) {
    score += r.delta;
    reasons.add(r);
  }

  final cached = isCachedOnActive(s, opts.activeDebrids);
  final directPlayable = s.url != null;
  final isEasynews =
      _easynews.hasMatch(s.addonName) || _easynews.hasMatch(s.parsedTitle);
  if (cached || isEasynews) {
    push(ScoreReason(cached ? 'cached' : 'easynews-direct', 60));
  } else if (directPlayable) {
    push(const ScoreReason('direct url', 25));
  }

  final resBoost = resolutionPoints(s);
  if (resBoost.delta != 0) push(resBoost);

  if (s.hdrFormat != null) {
    final hdrDelta =
        s.hdrFormat == HdrFormat.dvHdr10 || s.hdrFormat == HdrFormat.dv ? 6 : 5;
    push(ScoreReason(s.hdrFormat!.label, hdrDelta));
  }

  if (s.codec == VideoCodec.hevc) {
    push(const ScoreReason('HEVC', 1));
  } else if (s.codec == VideoCodec.av1) {
    push(const ScoreReason('AV1', 1));
  }

  final audioDelta = audioPoints(s);
  if (audioDelta.delta != 0) push(audioDelta);

  if (s.audio.channels >= 6) {
    push(ScoreReason('${s.audio.channels}.0 channels', 2));
  }

  if (!cached && s.seeders != null) {
    final seedDelta = _min((s.seeders! / 10).floor(), 10);
    if (seedDelta > 0) {
      push(ScoreReason('seeders=${s.seeders}', seedDelta));
    } else if (s.url == null && s.infoHash != null && s.seeders == 0) {
      push(const ScoreReason('zero-seeders-stale-meta', -20));
    }
  }
  if (s.infoHash != null && s.seeders == 0 && !cached) {
    push(const ScoreReason('zero-seeders-soft', -8));
  }

  final expectedYear = _expectedYear(opts.releaseDate);
  if (expectedYear != null && s.year != null) {
    final diff = (s.year! - expectedYear).abs();
    if (diff != 0) {
      final releaseT = DateTime.tryParse(opts.releaseDate!);
      final daysFromRelease = releaseT != null
          ? at.difference(releaseT).inMilliseconds.abs() / 86400000
          : double.infinity;
      final isRecent = daysFromRelease < 365;
      final suffix = isRecent ? '-recent' : '';
      if (diff == 1) {
        push(
          ScoreReason(
            'year-off-by-1:${s.year}vs$expectedYear$suffix',
            isRecent ? -75 : -18,
          ),
        );
      } else {
        push(
          ScoreReason(
            'year-mismatch:${s.year}vs$expectedYear$suffix',
            isRecent ? -150 : -70,
          ),
        );
      }
    }
  }

  if (isTrustedGroup(s.releaseGroupNormalized)) {
    push(ScoreReason('group:${s.releaseGroupNormalized}', 2));
  }
  if (opts.preferredReleaseGroup != null &&
      s.releaseGroupNormalized != null &&
      s.releaseGroupNormalized == opts.preferredReleaseGroup) {
    push(ScoreReason('prev-episode-group:${s.releaseGroupNormalized}', 8));
  }
  if (s.remux) push(const ScoreReason('REMUX', 3));

  switch (s.source) {
    case StreamSource.cam:
      push(const ScoreReason('CAM penalty', -80));
    case StreamSource.ts:
    case StreamSource.hdts:
      push(const ScoreReason('Telesync penalty', -60));
    case StreamSource.tc:
      push(const ScoreReason('Telecine penalty', -50));
    case StreamSource.scr:
      push(const ScoreReason('Screener penalty', -40));
    default:
      break;
  }

  if (s.proper || s.repackIteration > 0) {
    final r = _min(2, s.repackIteration == 0 ? 1 : s.repackIteration);
    push(ScoreReason(s.proper ? 'PROPER' : 'REPACK${s.repackIteration}', r));
  }

  final prefLangs = opts.preferredLanguages;
  if (prefLangs != null && prefLangs.isNotEmpty) {
    if (s.audioLanguages.isEmpty) {
      push(const ScoreReason('language-unknown', -3));
    } else {
      final isMulti = s.audioLanguages.contains('Multi');
      final match = s.audioLanguages.any((l) {
        final ll = l.toLowerCase();
        return prefLangs.any((p) {
          final pl = p.toLowerCase();
          return ll == pl || ll.startsWith(pl);
        });
      });
      if (match) {
        push(const ScoreReason('preferred-language', 12));
      } else if (isMulti) {
        push(
          opts.preferSingleAudioTrack
              ? const ScoreReason('html5-multi-audio-penalty', -18)
              : const ScoreReason('multi-language', 4),
        );
      } else {
        push(const ScoreReason('language-mismatch', -14));
      }
    }
  } else if (opts.preferSingleAudioTrack &&
      s.audioLanguages.contains('Multi')) {
    push(const ScoreReason('html5-multi-audio-penalty', -12));
  }

  if (s.scamScore > 0) push(ScoreReason('scam-penalty', -s.scamScore));
  if (s.url != null && !cached) push(const ScoreReason('prelinked-url', 4));
  if (opts.preferAddonId != null && s.addonId == opts.preferAddonId) {
    push(const ScoreReason('origin-addon', 250));
  }

  final trustedAddonBoost = trustedAddonPoints(s);
  if (trustedAddonBoost.delta > 0) push(trustedAddonBoost);
  final addonPriorityBoost = addonPriorityPoints(s);
  if (addonPriorityBoost.delta > 0) push(addonPriorityBoost);

  final playabilityDelta = playabilityPenalty(s);
  if (playabilityDelta < 0) {
    push(ScoreReason('webview2-unfriendly', playabilityDelta));
  }

  final bitratePenalty = bitrateBudgetPenalty(s, opts, cached);
  if (bitratePenalty.delta < 0) push(bitratePenalty);

  final expectedMin = opts.runtimeMinutes != null
      ? expectedMinSizeBytes(s.resolution, opts.runtimeMinutes!)
      : null;
  final hasValidSize =
      s.size != null && expectedMin != null && s.size! >= expectedMin;

  final sizePenalty = sizeMislabelPenalty(s, expectedMin);
  if (sizePenalty < 0) push(ScoreReason('size-mismatch', sizePenalty));

  final desyncPenalty = camInFilenamePenalty(s);
  if (desyncPenalty < 0) {
    push(ScoreReason('title-says-hires-filename-says-cam', desyncPenalty));
  }

  final undersizedPenalty = undersizedNewReleasePenalty(s, opts, at);
  if (undersizedPenalty.delta < 0) push(undersizedPenalty);

  final tinyPenalty = impossiblySmallMoviePenalty(s, opts, at);
  if (tinyPenalty.delta < 0) push(tinyPenalty);

  final recency = freshTheatricalAdjust(s, opts, hasValidSize, corpus, at);
  if (recency.delta != 0) push(recency);

  return ScoredStream(
    parsed: s,
    score: score,
    reasons: reasons,
    tier: tierOf(s),
  );
}

/// Ranks [scored] and picks the primary + per-tier representatives, ported from
/// `scoring-rank.ts`. A stream is "cached" when it has a direct URL with no
/// uncached marker, or is cached on an active debrid.
RankedPicker rankAndPick(
  List<ScoredStream> scored,
  List<DebridSlug> activeDebrids, {
  bool preferAac = false,
  bool respectAddonOrder = false,
}) {
  bool isCached(ScoredStream s) =>
      (s.url != null &&
          !hasUncachedMarker(
            name: s.parsed.stream.name,
            title: s.parsed.stream.title,
            description: s.parsed.stream.description,
          )) ||
      activeDebrids.any((slug) => s.cached[slug] == true);

  int pri(ScoredStream s) => s.addonPriority ?? _maxSafeInt;
  int ret(ScoredStream s) => s.addonReturnIdx ?? _maxSafeInt;

  final all = _stableSort(scored, (a, b) {
    if (respectAddonOrder) {
      final p = pri(a) - pri(b);
      if (p != 0) return p;
      final r = ret(a) - ret(b);
      if (r != 0) return r;
      return b.score - a.score;
    }
    return b.score - a.score;
  });

  final cachedFirst = _stableSort(
    all,
    (a, b) => (isCached(b) ? 1 : 0) - (isCached(a) ? 1 : 0),
  );

  final byTier = <StreamTier, ScoredStream>{};
  for (final s in cachedFirst) {
    byTier.putIfAbsent(s.tier, () => s);
  }

  ScoredStream? primary = _firstWhereOrNull(all, isCached);
  if (preferAac && primary != null) {
    final aac = _firstWhereOrNull(
      all,
      (s) => isCached(s) && s.audio.codec == AudioCodec.aac,
    );
    if (aac != null) primary = aac;
  }

  return RankedPicker(primary: primary, byTier: byTier, all: all);
}

final RegExp _easynews = RegExp('easynews', caseSensitive: false);

int _min(int a, int b) => a < b ? a : b;

int? _expectedYear(String? releaseDate) {
  if (releaseDate == null) return null;
  final head = releaseDate.length >= 4
      ? releaseDate.substring(0, 4)
      : releaseDate;
  return int.tryParse(head);
}

ScoredStream? _firstWhereOrNull(
  List<ScoredStream> items,
  bool Function(ScoredStream) test,
) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

/// A stable sort (Dart's `List.sort` is not stable): decorate with the original
/// index and break comparator ties by it, matching JS `Array.prototype.sort`.
List<ScoredStream> _stableSort(
  List<ScoredStream> items,
  int Function(ScoredStream, ScoredStream) cmp,
) {
  final indexed = [for (var i = 0; i < items.length; i++) (i, items[i])];
  indexed.sort((a, b) {
    final c = cmp(a.$2, b.$2);
    return c != 0 ? c : a.$1 - b.$1;
  });
  return [for (final e in indexed) e.$2];
}
