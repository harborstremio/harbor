import '../parsed_stream.dart';
import '../parser/stream_enums.dart';

/// Whether the title being scored is a movie or a series episode. Drives the
/// size/recency heuristics (which only apply to movies).
enum MediaKind { movie, series }

/// A single scoring signal and the points it contributed (positive or negative).
class ScoreReason {
  const ScoreReason(this.signal, this.delta);
  final String signal;
  final int delta;
}

/// The knobs that steer stream scoring, mirroring `ScoreOptions` in
/// `src/lib/streams/scoring/scoring-types.ts`.
class ScoreOptions {
  const ScoreOptions({
    this.activeDebrids = const [],
    this.preferredLanguages,
    this.bandwidthMbps,
    this.releaseDate,
    this.mediaKind,
    this.runtimeMinutes,
    this.inTheaters,
    this.preferSingleAudioTrack = false,
    this.preferAddonId,
    this.preferredReleaseGroup,
    this.respectAddonOrder = false,
  });

  final List<DebridSlug> activeDebrids;
  final List<String>? preferredLanguages;
  final double? bandwidthMbps;
  final String? releaseDate;
  final MediaKind? mediaKind;
  final int? runtimeMinutes;
  final bool? inTheaters;
  final bool preferSingleAudioTrack;
  final String? preferAddonId;
  final String? preferredReleaseGroup;
  final bool respectAddonOrder;
}

/// Aggregate stats over the whole result set, used by the recency heuristic to
/// detect a "theater-capture dominated" corpus (a movie still only in cinemas).
class CorpusStats {
  const CorpusStats({
    required this.daysSinceRelease,
    required this.trustedTrackedFraction,
    required this.theaterCaptureFraction,
    required this.webishFraction,
    required this.trustedTrackedCount,
  });

  final double? daysSinceRelease;
  final double trustedTrackedFraction;
  final double theaterCaptureFraction;
  final double webishFraction;
  final int trustedTrackedCount;
}

const int kTrackingMinSeeders = 30;

/// Tier ranking order, best first — matches the [StreamTier] declaration order.
List<StreamTier> get tierOrder => StreamTier.values;

/// A [ParsedStream] with its computed score, contributing reasons, and tier.
class ScoredStream {
  const ScoredStream({
    required this.parsed,
    required this.score,
    required this.reasons,
    required this.tier,
    this.nativeIdx,
  });

  final ParsedStream parsed;
  final int score;
  final List<ScoreReason> reasons;
  final StreamTier tier;
  final int? nativeIdx;

  String? get url => parsed.url;
  Map<DebridSlug, bool> get cached => parsed.cached;
  int? get addonPriority => parsed.addonPriority;
  int? get addonReturnIdx => parsed.addonReturnIdx;
  AudioInfo get audio => parsed.audio;
}

/// The ranked outcome: the best cached pick, one representative per tier, and
/// the full ordered list.
class RankedPicker {
  const RankedPicker({
    required this.primary,
    required this.byTier,
    required this.all,
  });

  final ScoredStream? primary;
  final Map<StreamTier, ScoredStream> byTier;
  final List<ScoredStream> all;
}
