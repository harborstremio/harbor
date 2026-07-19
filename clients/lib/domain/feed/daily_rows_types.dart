import 'dart:math' as math;

import '../catalog/show_hero.dart' show mulberry32;
import '../discover/affinity.dart' show Affinity;
import '../settings/settings.dart';
import 'feed_seed.dart' show hashStr, mixSeed;

/// The TMDB endpoint a daily row draws from, ported 1:1 from `RowEndpoint`.
enum RowEndpoint { discover, trending, awards }

/// The taste dimension a catalog entry expands from, ported from `CatalogEntry`.
enum RowDimension {
  genre,
  decade,
  person,
  keyword,
  country,
  runtime,
  network,
  anchor,
}

/// A concrete daily row ready to fetch — its display text, media type, endpoint,
/// and the primary and relaxed discover floors. Ported 1:1 from `ExpandedRow`.
class ExpandedRow {
  const ExpandedRow({
    required this.key,
    required this.title,
    required this.mediaType,
    required this.endpoint,
    required this.floorPrimary,
    required this.floorRelaxed,
    this.kicker,
    this.pageBase,
  });

  final String key;
  final String title;
  final String? kicker;

  /// `movie` or `tv`.
  final String mediaType;
  final RowEndpoint endpoint;
  final Map<String, String> floorPrimary;
  final Map<String, String> floorRelaxed;
  final int? pageBase;

  ExpandedRow withPageBase(int pageBase) => ExpandedRow(
    key: key,
    title: title,
    kicker: kicker,
    mediaType: mediaType,
    endpoint: endpoint,
    floorPrimary: floorPrimary,
    floorRelaxed: floorRelaxed,
    pageBase: pageBase,
  );
}

/// A catalog row generator — whether it is eligible for the current taste and
/// settings, and how it expands into concrete rows. Ported 1:1 from
/// `CatalogEntry`.
class CatalogEntry {
  const CatalogEntry({
    required this.id,
    required this.dimension,
    required this.eligible,
    required this.expand,
  });

  final String id;
  final RowDimension dimension;
  final bool Function(Affinity affinity, Settings settings) eligible;
  final List<ExpandedRow> Function(
    Affinity affinity,
    int base,
    Settings settings,
  )
  expand;
}

/// The exponential-decay base for daily-row weighting, ported from `LAMBDA`.
const double lambda = 0.85;

/// A day-seeded PRNG salted by [salt], ported 1:1 from `rng`.
double Function() rng(int base, String salt) =>
    mulberry32(mixSeed(base, hashStr(salt)));

/// Loosens a discover floor — 60% of the vote-count floor (min 20) and 0.4 off
/// the vote-average floor — for the fallback pass. Ported 1:1 from `relax`.
Map<String, String> relax(Map<String, String> floor) {
  final out = {...floor};
  final vc = out['vote_count.gte'];
  if (vc != null) {
    out['vote_count.gte'] = '${math.max(20, (double.parse(vc) * 0.6).round())}';
  }
  final va = out['vote_average.gte'];
  if (va != null) {
    out['vote_average.gte'] = (double.parse(va) - 0.4).toStringAsFixed(1);
  }
  return out;
}

/// A movie-genre floor — the genre plus a 70-minute runtime floor, with [floor]
/// overriding. Ported 1:1 from `movieGenre`.
Map<String, String> movieGenre(int gid, Map<String, String> floor) => {
  'with_genres': '$gid',
  'with_runtime.gte': '70',
  ...floor,
};
