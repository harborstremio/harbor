/// The individual scoring signals, ported from the `scoring-*.ts` modules in
/// `src/lib/streams/scoring`. Each returns either a [ScoreReason] (a labelled
/// delta) or a raw penalty. Date-dependent heuristics take an explicit [now] so
/// they are deterministic and testable.
library;

import '../parsed_stream.dart';
import '../parser/stream_enums.dart';
import 'scored_stream.dart';

// --- resolution -------------------------------------------------------------

ScoreReason resolutionPoints(ParsedStream s) {
  switch (s.resolution) {
    case StreamResolution.uhd:
      return const ScoreReason('4K', 25);
    case StreamResolution.p1080:
      return const ScoreReason('1080p', 20);
    case StreamResolution.p720:
      return const ScoreReason('720p', 8);
    case StreamResolution.p480:
      return const ScoreReason('480p', 2);
    case StreamResolution.sd:
      return const ScoreReason('SD', 0);
  }
}

bool _isTheaterCapture(StreamSource source) =>
    source == StreamSource.cam ||
    source == StreamSource.ts ||
    source == StreamSource.hdts ||
    source == StreamSource.tc;

StreamTier tierOf(ParsedStream s) {
  if (_isTheaterCapture(s.source) || s.source == StreamSource.scr) {
    return StreamTier.rough;
  }
  if (s.resolution == StreamResolution.uhd) {
    if (s.hdrFormat == HdrFormat.dv || s.hdrFormat == HdrFormat.dvHdr10) {
      return StreamTier.uhdDv;
    }
    if (s.hdrFormat != null) return StreamTier.uhdHdr;
    return StreamTier.uhd;
  }
  if (s.resolution == StreamResolution.p1080) {
    return s.hdrFormat != null ? StreamTier.hdrHdr : StreamTier.p1080;
  }
  if (s.resolution == StreamResolution.p720) return StreamTier.p720;
  return StreamTier.sd;
}

// --- audio ------------------------------------------------------------------

ScoreReason audioPoints(ParsedStream s) {
  switch (s.audio.codec) {
    case AudioCodec.atmos:
      return const ScoreReason('Atmos', 3);
    case AudioCodec.trueHd:
      return const ScoreReason('TrueHD', 2);
    case AudioCodec.dtsHdMa:
      return const ScoreReason('DTS-HD MA', 2);
    case AudioCodec.ddPlus:
      return const ScoreReason('DD+', 1);
    default:
      return const ScoreReason('audio', 0);
  }
}

int playabilityPenalty(ParsedStream s) {
  var penalty = 0;
  if (s.audio.codec == AudioCodec.dts || s.audio.codec == AudioCodec.dtsHdMa) {
    penalty -= 6;
  }
  if (s.audio.codec == AudioCodec.trueHd) penalty -= 4;
  if (s.container == StreamContainer.mkv &&
      (s.audio.codec == AudioCodec.dts || s.audio.codec == AudioCodec.trueHd)) {
    penalty -= 3;
  }
  if (s.container == StreamContainer.avi ||
      s.container == StreamContainer.wmv) {
    penalty -= 8;
  }
  if (s.codec == VideoCodec.av1) penalty -= 2;
  return penalty;
}

// --- debrid -----------------------------------------------------------------

bool isCachedOnActive(ParsedStream s, List<DebridSlug> active) =>
    active.any((slug) => s.cached[slug] == true);

// --- addon trust / priority -------------------------------------------------

final RegExp _trustedAddonRx = RegExp(
  r'mediafusion|comet|easynews|torrentio',
  caseSensitive: false,
);
final RegExp _strongAddonRx = RegExp(
  r'mediafusion|comet',
  caseSensitive: false,
);

ScoreReason trustedAddonPoints(ParsedStream s) {
  final name = s.addonName;
  if (_strongAddonRx.hasMatch(name)) {
    return const ScoreReason('strong-addon', 8);
  }
  if (_trustedAddonRx.hasMatch(name)) {
    return const ScoreReason('trusted-addon', 4);
  }
  return const ScoreReason('addon-neutral', 0);
}

const int _addonPriorityMax = 12;
const int _addonPriorityStep = 4;

ScoreReason addonPriorityPoints(ParsedStream s) {
  final p = s.addonPriority;
  if (p == null) return const ScoreReason('addon-priority-none', 0);
  final delta = (_addonPriorityMax - p * _addonPriorityStep);
  return ScoreReason('addon-priority-$p', delta < 0 ? 0 : delta);
}

// --- bitrate ----------------------------------------------------------------

ScoreReason bitrateBudgetPenalty(
  ParsedStream s,
  ScoreOptions opts,
  bool cached,
) {
  final budget = opts.bandwidthMbps;
  if (budget == null || budget <= 0) return const ScoreReason('bitrate-ok', 0);
  final headroom = budget * 0.8;
  final size = s.size;
  final runtime = opts.runtimeMinutes;
  if (size != null && runtime != null && runtime > 0) {
    final required = (size * 8) / (runtime * 60) / 1000000;
    if (required > budget * 1.1) {
      final sev = required > budget * 1.5 ? -120 : -45;
      return ScoreReason(
        'bitrate-exceeds-budget:${required.toStringAsFixed(0)}>'
        '${budget.toStringAsFixed(0)}Mbps',
        cached ? sev + 10 : sev,
      );
    }
    if (required > headroom) {
      return ScoreReason(
        'bitrate-tight:${required.toStringAsFixed(0)}/'
        '${budget.toStringAsFixed(0)}Mbps',
        -12,
      );
    }
  }
  if (s.resolution == StreamResolution.uhd && budget < 25) {
    return ScoreReason('low-bandwidth-4k', cached ? -30 : -60);
  }
  if (s.resolution == StreamResolution.p1080 && budget < 8) {
    return ScoreReason('low-bandwidth-1080p', cached ? -20 : -45);
  }
  return const ScoreReason('bitrate-ok', 0);
}

const Map<StreamResolution, int> _mbPerMin = {
  StreamResolution.uhd: 60,
  StreamResolution.p1080: 18,
  StreamResolution.p720: 8,
  StreamResolution.p480: 3,
  StreamResolution.sd: 2,
};

int? expectedMinSizeBytes(StreamResolution resolution, int runtimeMin) {
  if (runtimeMin <= 0) return null;
  final rate = _mbPerMin[resolution];
  if (rate == null) return null;
  return rate * runtimeMin * 1024 * 1024;
}

// --- size -------------------------------------------------------------------

final RegExp _camMarkerRx = RegExp(
  r'\b(?:cam|hdcam|hd[\s._-]?cam|tsrip|telesync|hdts|hd[\s._-]?ts|telecine'
  r'|hd[\s._-]?tc|hc[\s._-]?hdrip|hc[\s._-]?cam|new[\s._-]?cam|cleancam|hqcam)\b',
  caseSensitive: false,
);
const Set<String> _lossyTrustedGroups = {'YTS', 'YIFY', 'YTSAG', 'YTS-AG'};

int camInFilenamePenalty(ParsedStream s) {
  if (_isTheaterCapture(s.source)) return 0;
  if (s.resolution != StreamResolution.p1080 &&
      s.resolution != StreamResolution.uhd) {
    return 0;
  }
  final haystack = [
    s.stream.name,
    s.stream.title,
    s.stream.filename,
    s.stream.description,
  ].where((v) => v != null).join(' \n ');
  if (!_camMarkerRx.hasMatch(haystack)) return 0;
  return s.resolution == StreamResolution.uhd ? -200 : -100;
}

int sizeMislabelPenalty(ParsedStream s, int? expectedMin) {
  final size = s.size;
  if (size == null || size <= 0) return 0;
  if (expectedMin == null) return 0;
  if (_isTheaterCapture(s.source)) return 0;
  final grp = s.releaseGroupNormalized;
  if (grp != null && _lossyTrustedGroups.contains(grp.toUpperCase())) return 0;
  if (size >= expectedMin) return 0;
  final ratio = size / expectedMin;
  if (ratio < 0.25) return -120;
  if (ratio < 0.5) return -60;
  if (ratio < 0.75) return -20;
  return 0;
}

ScoreReason impossiblySmallMoviePenalty(
  ParsedStream s,
  ScoreOptions opts,
  DateTime now,
) {
  if (opts.mediaKind == MediaKind.series) {
    return const ScoreReason('tiny-skip-series', 0);
  }
  final size = s.size;
  if (size == null) return const ScoreReason('tiny-skip-no-size', 0);
  final days = _daysSince(opts.releaseDate, now);
  if (days == null) return const ScoreReason('tiny-skip-no-date', 0);
  if (days >= 90) return const ScoreReason('tiny-skip-mature', 0);
  if (_isTheaterCapture(s.source)) {
    return const ScoreReason('tiny-skip-theater', 0);
  }
  final sizeMB = size / (1024 * 1024);
  if (sizeMB < 250) {
    return ScoreReason('new-release-virus-${sizeMB.round()}mb', -250);
  }
  final runtimeFloor = opts.runtimeMinutes != null
      ? opts.runtimeMinutes! * 5
      : 0;
  final floor = runtimeFloor > 500 ? runtimeFloor : 500;
  if (sizeMB < floor) {
    return ScoreReason('new-release-no-label-${sizeMB.round()}mb', -200);
  }
  return const ScoreReason('tiny-ok', 0);
}

ScoreReason undersizedNewReleasePenalty(
  ParsedStream s,
  ScoreOptions opts,
  DateTime now,
) {
  if (opts.mediaKind == MediaKind.series) {
    return const ScoreReason('undersized-skip-series', 0);
  }
  final size = s.size;
  if (size == null) return const ScoreReason('undersized-skip-no-data', 0);
  final days = _daysSince(opts.releaseDate, now);
  if (days == null) return const ScoreReason('undersized-skip-no-data', 0);
  if (days >= 90) return const ScoreReason('undersized-skip-mature', 0);
  if (_isTheaterCapture(s.source)) {
    return const ScoreReason('undersized-skip-theater', 0);
  }
  final sizeGB = size / (1024 * 1024 * 1024);
  if (s.resolution == StreamResolution.uhd && sizeGB < 6) {
    return ScoreReason('4k-undersized-${sizeGB.toStringAsFixed(1)}gb', -250);
  }
  if (s.resolution == StreamResolution.p1080 && sizeGB < 1.5) {
    return ScoreReason('1080p-undersized-${sizeGB.toStringAsFixed(1)}gb', -200);
  }
  if (s.resolution == StreamResolution.p720 && sizeGB < 0.6) {
    return ScoreReason('720p-undersized-${sizeGB.toStringAsFixed(1)}gb', -80);
  }
  return const ScoreReason('undersized-ok', 0);
}

// --- recency ----------------------------------------------------------------

const int _shortFreshDays = 30;
const int _theaterWindowDays = 150;

ScoreReason freshTheatricalAdjust(
  ParsedStream s,
  ScoreOptions opts,
  bool hasValidSize,
  CorpusStats? corpus,
  DateTime now,
) {
  if (opts.mediaKind == MediaKind.series) {
    return const ScoreReason('fresh-skip-series', 0);
  }
  final days = _daysSince(opts.releaseDate, now);
  if (days == null) return const ScoreReason('fresh-skip-no-date', 0);
  if (days >= _theaterWindowDays) {
    return const ScoreReason('fresh-skip-mature', 0);
  }

  final isTheaterCapture = _isTheaterCapture(s.source);
  final isRemuxOrBluray = s.source == StreamSource.bluRay || s.remux;
  final claimsHighQuality =
      s.source == StreamSource.webDl ||
      s.source == StreamSource.webRip ||
      isRemuxOrBluray ||
      s.resolution == StreamResolution.p1080 ||
      s.resolution == StreamResolution.uhd;

  final theaterDominated =
      corpus != null &&
      corpus.trustedTrackedCount >= 4 &&
      corpus.theaterCaptureFraction >= 0.4 &&
      corpus.theaterCaptureFraction > corpus.webishFraction;

  if (!theaterDominated && days >= _shortFreshDays) {
    return const ScoreReason('fresh-skip-mature', 0);
  }

  if (isTheaterCapture) {
    if (theaterDominated) {
      final sourceOffset = s.source == StreamSource.cam
          ? 95
          : (s.source == StreamSource.ts || s.source == StreamSource.hdts)
          ? 75
          : 65;
      return ScoreReason('fresh-theater-cinema-window', sourceOffset);
    }
    if (days < 14) return const ScoreReason('fresh-theater-mild-boost', 25);
    return const ScoreReason('fresh-theater-neutral', 0);
  }

  if (!claimsHighQuality) {
    return const ScoreReason('fresh-low-quality-noise', 0);
  }

  if (theaterDominated) {
    if (isRemuxOrBluray) return const ScoreReason('fresh-fake-remux', -200);
    if (days < 0) return const ScoreReason('fresh-fake-prerelease', -160);
    if (days < 14) return const ScoreReason('fresh-fake-prebluray', -90);
    return const ScoreReason('fresh-fake-soft', -45);
  }

  if (isRemuxOrBluray && days < 14) {
    return const ScoreReason('fresh-prebluray-suspect', -55);
  }
  if (days < 0 && !hasValidSize) {
    return const ScoreReason('fresh-prerelease-soft', -35);
  }
  return const ScoreReason('fresh-soft-flag', -10);
}

// --- corpus -----------------------------------------------------------------

CorpusStats computeCorpusStats(
  List<ParsedStream> streams,
  ScoreOptions opts,
  DateTime now,
) {
  final days = _daysSince(opts.releaseDate, now);

  bool isTracked(ParsedStream s) =>
      opts.activeDebrids.any((slug) => s.cached[slug] == true) ||
      s.url != null ||
      (s.seeders != null && s.seeders! >= kTrackingMinSeeders);
  bool isWebish(ParsedStream s) =>
      s.source == StreamSource.webDl ||
      s.source == StreamSource.webRip ||
      s.source == StreamSource.bluRay ||
      s.source == StreamSource.bdRip;

  final tracked = streams.where(isTracked).toList();
  final trustedTrackedCount = tracked.length;
  final theater = tracked.where((s) => _isTheaterCapture(s.source)).length;
  final webish = tracked.where(isWebish).length;

  final total = trustedTrackedCount == 0 ? 1 : trustedTrackedCount;
  final denomStreams = streams.isEmpty ? 1 : streams.length;
  return CorpusStats(
    daysSinceRelease: days,
    trustedTrackedFraction: trustedTrackedCount / denomStreams,
    theaterCaptureFraction: theater / total,
    webishFraction: webish / total,
    trustedTrackedCount: trustedTrackedCount,
  );
}

double? _daysSince(String? releaseDate, DateTime now) {
  if (releaseDate == null) return null;
  final t = DateTime.tryParse(releaseDate);
  if (t == null) return null;
  return now.difference(t).inMilliseconds / 86400000;
}
