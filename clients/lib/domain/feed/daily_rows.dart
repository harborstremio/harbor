import 'dart:convert';
import 'dart:math' as math;

import '../../core/storage/kv_store.dart';
import '../addons/addon_client.dart';
import '../addons/models.dart';
import '../catalog/show_hero.dart' show mulberry32;
import '../catalog/tmdb.dart' show TmdbClient;
import '../discover/affinity.dart' show Affinity;
import '../library/playback_history.dart' show WatchedSet;
import '../settings/settings.dart';
import 'award_winners.dart';
import 'daily_rows_anchors.dart';
import 'daily_rows_catalog.dart' show catalog;
import 'daily_rows_select.dart' show fetchRowWithFallback;
import 'daily_rows_types.dart';
import 'feed_locale.dart' show LocaleWeights;
import 'feed_seed.dart' show dayIndex, hashStr, mixSeed;
import 'feed_themes.dart' show fallbackShelves;

/// A ready-to-render daily rail — its display text and its paged fetcher. Ported
/// 1:1 from `RailDef` (its `ShelfMeta` is inlined as [title]/[kicker]).
class RailDef {
  const RailDef({
    required this.id,
    required this.title,
    required this.fetch,
    this.kicker,
  });

  final String id;
  final String title;
  final String? kicker;
  final Future<List<MetaPreview>> Function([int page]) fetch;
}

/// The Discover daily-rows engine — expands the eligible catalog into rails,
/// pins the anchor rows, and shuffles the rest daily while avoiding recent
/// repeats. Ported 1:1 from `daily-rows.ts`. The localStorage recency ring
/// becomes a [KvStore] ring under `harbor.discover.rows.v1`.
class DailyRows {
  DailyRows(this._kv, {DateTime Function() clock = DateTime.now})
    : _clock = clock;

  final KvStore _kv;
  final DateTime Function() _clock;

  static const _ringKey = 'harbor.discover.rows.v1';
  static const _recencyWindow = 10;
  static const _anchorSalt = 90001;
  static const _orderSalt = 90007;
  static const _standardAnchors = {
    kAnchorTrending,
    kAnchorTopRated,
    kAnchorAwards,
  };

  /// Builds the day's rails. Without a TMDB key it returns the Cinemeta fallback
  /// shelves; otherwise it expands the catalog and orders it with pinned anchors.
  List<RailDef> select({
    required TmdbClient tmdb,
    required AddonClient addon,
    required AwardWinnersResolver awards,
    required Affinity affinity,
    required Settings settings,
    required LocaleWeights locale,
    required Set<String> blocked,
    required WatchedSet watched,
    Map<int, String> labels = const {},
    int count = 14,
  }) {
    final base = dayIndex(_clock());
    if (!tmdb.hasKey) return _fallbackRows(addon);

    final candidates = _expandCandidates(affinity, base, settings, labels);
    final ordered = _orderRows(candidates, base, count);
    return [
      for (final row in ordered)
        _toRail(
          base,
          row,
          tmdb,
          awards,
          affinity,
          settings,
          locale,
          blocked,
          watched,
        ),
    ];
  }

  List<ExpandedRow> _expandCandidates(
    Affinity affinity,
    int base,
    Settings settings,
    Map<int, String> labels,
  ) {
    final out = <ExpandedRow>[];
    final seen = <String>{};
    for (final entry in catalog(labels: labels, clock: _clock)) {
      if (!entry.eligible(affinity, settings)) continue;
      for (final row in entry.expand(affinity, base, settings)) {
        if (!seen.add(row.key)) continue;
        final standard = _standardAnchors.contains(row.key.split(':').first);
        final pageBase = standard
            ? 1
            : 1 + (mulberry32(mixSeed(base, hashStr(row.key)))() * 3).floor();
        out.add(row.withPageBase(pageBase));
      }
    }
    return out;
  }

  ExpandedRow? _firstWithPrefix(List<ExpandedRow> rows, String prefix) {
    for (final r in rows) {
      if (r.key.startsWith('$prefix:')) return r;
    }
    return null;
  }

  List<ExpandedRow> _orderRows(List<ExpandedRow> rows, int base, int count) {
    final trending = _firstWithPrefix(rows, kAnchorTrending);
    final topRated = _firstWithPrefix(rows, kAnchorTopRated);
    final award = _firstWithPrefix(rows, kAnchorAwards);
    final rotatingId =
        kRotatingAnchors[(mulberry32(mixSeed(base, _anchorSalt))() *
                kRotatingAnchors.length)
            .floor()];
    final closing = _firstWithPrefix(rows, rotatingId);

    final pinned = <String>{
      ?trending?.key,
      ?topRated?.key,
      ?award?.key,
      ?closing?.key,
    };
    final recent = _recentKeys(base);
    final middle = [
      for (final r in rows)
        if (!pinned.contains(r.key)) r,
    ];
    final fresh = [
      for (final r in middle)
        if (!recent.contains(r.key)) r,
    ];
    final stale = [
      for (final r in middle)
        if (recent.contains(r.key)) r,
    ];

    final order = mulberry32(mixSeed(base, _orderSalt));
    List<ExpandedRow> fy(List<ExpandedRow> arr) {
      final a = [...arr];
      for (var i = a.length - 1; i > 0; i--) {
        final j = (order() * (i + 1)).floor();
        final t = a[i];
        a[i] = a[j];
        a[j] = t;
      }
      return a;
    }

    final pinnedCount =
        (trending != null ? 1 : 0) +
        (topRated != null ? 1 : 0) +
        (award != null ? 1 : 0) +
        (closing != null ? 1 : 0);
    final bodyTarget = math.max(0, count - pinnedCount);
    final body = [...fy(fresh), ...fy(stale)].take(bodyTarget + 2).toList();

    return [?trending, ?topRated, ?award, ...body, ?closing];
  }

  RailDef _toRail(
    int base,
    ExpandedRow row,
    TmdbClient tmdb,
    AwardWinnersResolver awards,
    Affinity affinity,
    Settings settings,
    LocaleWeights locale,
    Set<String> blocked,
    WatchedSet watched,
  ) {
    var recorded = false;
    return RailDef(
      id: row.key,
      title: row.title,
      kicker: row.kicker,
      fetch: ([page = 1]) {
        if (page == 1 && !recorded) {
          recorded = true;
          _recordKey(base, row.key);
        }
        return fetchRowWithFallback(
          tmdb: tmdb,
          awards: awards,
          row: row,
          page: page,
          settings: settings,
          affinity: affinity,
          locale: locale,
          blocked: blocked,
          watched: watched,
        );
      },
    );
  }

  List<RailDef> _fallbackRows(AddonClient addon) => [
    for (final s in fallbackShelves(addon, clock: _clock))
      RailDef(
        id: 'fallback_${s.id}',
        title: s.title,
        kicker: s.kicker,
        fetch: ([page = 1]) => s.fetch(page),
      ),
  ];

  List<({int day, List<String> keys})> _readRing() {
    final raw = _kv.getString(_ringKey);
    if (raw == null) return const [];
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! List) return const [];
      final entries = <({int day, List<String> keys})>[
        for (final e in parsed)
          if (e is Map && e['day'] is num)
            (
              day: (e['day'] as num).toInt(),
              keys: [
                for (final k in (e['keys'] as List? ?? const []))
                  if (k is String) k,
              ],
            ),
      ];
      return entries.length > _recencyWindow
          ? entries.sublist(entries.length - _recencyWindow)
          : entries;
    } catch (_) {
      return const [];
    }
  }

  Set<String> _recentKeys(int base) {
    final set = <String>{};
    for (final entry in _readRing()) {
      if (entry.day == base) continue;
      set.addAll(entry.keys);
    }
    return set;
  }

  void _recordKey(int base, String key) {
    final ring = _readRing().toList();
    final idx = ring.indexWhere((e) => e.day == base);
    if (idx == -1) {
      ring.add((day: base, keys: [key]));
    } else if (!ring[idx].keys.contains(key)) {
      ring[idx].keys.add(key);
    }
    final trimmed = ring.length > _recencyWindow
        ? ring.sublist(ring.length - _recencyWindow)
        : ring;
    _kv.setString(
      _ringKey,
      jsonEncode([
        for (final e in trimmed) {'day': e.day, 'keys': e.keys},
      ]),
    );
  }
}
