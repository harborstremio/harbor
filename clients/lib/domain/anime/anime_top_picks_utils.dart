import 'dart:convert';

import '../../core/storage/kv_store.dart';
import '../addons/adult_filter.dart' show isAdultAnime;
import '../addons/models.dart';
import '../catalog/show_hero.dart' show mulberry32;
import '../discover/affinity.dart';
import '../discover/profile.dart' show profileFromMeta;
import '../feed/feed_seed.dart';
import '../library/playback_history.dart' show WatchedSet;
import '../stremio/library_item.dart';
import 'jikan.dart' show animeFranchiseKey, stripFranchiseSuffix;

/// The affinity-genre name → Jikan genre id map used to seed anime rows.
const Map<String, int> kAnimeGenreToJikan = {
  'Action': 1,
  'Adventure': 2,
  'Comedy': 4,
  'Drama': 8,
  'Fantasy': 10,
  'Horror': 14,
  'Mystery': 7,
  'Romance': 22,
  'Sci-Fi': 24,
  'Slice of Life': 36,
  'Sports': 30,
  'Supernatural': 37,
  'Thriller': 41,
  'Mecha': 18,
  'Music': 19,
  'Psychological': 40,
};

/// Where a candidate pick came from — the base scores follow.
enum PickSource { sequel, rec, genre, newRelease, airing, top }

const Map<PickSource, double> _sourceBase = {
  PickSource.sequel: 100,
  PickSource.rec: 40,
  PickSource.genre: 20,
  PickSource.newRelease: 5,
  PickSource.airing: 3,
  PickSource.top: 2,
};

/// The recently-shown-picks ring — a short-TTL memory of the franchise keys
/// already surfaced, so the top-picks row rotates. Ported from the module ring
/// in `anime-top-picks-utils.ts`; persisted to [KvStore].
class AnimeShownPicksRing {
  AnimeShownPicksRing(this._kv, {DateTime Function() clock = DateTime.now})
    : _clock = clock;

  final KvStore _kv;
  final DateTime Function() _clock;

  static const _key = 'harbor.anime.toppicks.shown.v1';
  static const _ttlMs = 72 * 60 * 60 * 1000;
  static const _max = 12;

  int get _now => _clock().millisecondsSinceEpoch;

  List<({int at, List<String> keys})> _read() {
    final raw = _kv.getString(_key);
    if (raw == null) return const [];
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! List) return const [];
      final out = <({int at, List<String> keys})>[];
      for (final e in parsed) {
        if (e is! Map) continue;
        final at = (e['t'] as num?)?.toInt();
        final keys = [
          for (final k in (e['keys'] as List? ?? const []))
            if (k is String) k,
        ];
        if (at != null) out.add((at: at, keys: keys));
      }
      return out.length > _max ? out.sublist(out.length - _max) : out;
    } catch (_) {
      return const [];
    }
  }

  /// Records a batch of just-shown franchise [keys].
  void record(List<String> keys) {
    if (keys.isEmpty) return;
    final ring = [..._read(), (at: _now, keys: keys)];
    final trimmed = ring.length > _max
        ? ring.sublist(ring.length - _max)
        : ring;
    _kv.setString(
      _key,
      jsonEncode([
        for (final e in trimmed) {'t': e.at, 'keys': e.keys},
      ]),
    );
  }

  /// The franchise keys shown within the TTL window.
  Set<String> recentlyShown() {
    final now = _now;
    return {
      for (final e in _read())
        if (now - e.at < _ttlMs) ...e.keys,
    };
  }
}

/// The Jikan genre ids to seed anime rows: the user's top affinity genres
/// (mapped from names), topped up with their favorites — up to three. Ported
/// from `animeSeedGenres`.
List<int> animeSeedGenres(List<int> favoriteGenres, Affinity affinity) {
  final seen = <int>{};
  final out = <int>[];
  if (affinity.totalEvents > 0) {
    for (final e in topEntries(affinity.genres, 8)) {
      if (e.value <= 0) continue;
      final gid = kAnimeGenreToJikan[e.key];
      if (gid == null || !seen.add(gid)) continue;
      out.add(gid);
      if (out.length >= 3) break;
    }
  }
  for (final gid in favoriteGenres) {
    if (out.length >= 3) break;
    if (seen.add(gid)) out.add(gid);
  }
  return out;
}

/// Whether a library item is finished — flagged watched, marked watched, or
/// past 90%. Ported from `isFinished`.
bool isFinishedLibItem(LibraryItem item) {
  final s = item.state;
  if (s == null) return false;
  if (s.flaggedWatched == 1) return true;
  if (s.watched) return true;
  return s.duration > 0 && s.timeOffset / s.duration >= 0.9;
}

/// The franchise keys and library seeds of finished Kitsu/MAL titles. Ported
/// from `finishedFranchises`.
({Set<String> franchises, List<LibraryItem> seeds}) finishedFranchises(
  List<LibraryItem> libItems,
) {
  final franchises = <String>{};
  final seeds = <LibraryItem>[];
  for (final item in libItems) {
    if (!item.id.startsWith('kitsu:') && !item.id.startsWith('mal:')) continue;
    if (!isFinishedLibItem(item)) continue;
    franchises.add(animeFranchiseKey(stripFranchiseSuffix(item.name)));
    seeds.add(item);
  }
  return (franchises: franchises, seeds: seeds);
}

/// A predicate that hides a candidate pick.
typedef PickSkip = bool Function(MetaPreview meta);

/// Builds the top-picks exclusion: recently-shown, hero, continue-watching and
/// finished franchises, plus watched, voted and adult titles. Ported from
/// `buildExclusion`; the ambient state is passed in.
PickSkip buildAnimeExclusion({
  required List<MetaPreview> heroMetas,
  required Iterable<String> continueWatchingNames,
  required List<LibraryItem> libItems,
  required Set<String> recentlyShown,
  required WatchedSet watched,
  required Set<String> voted,
  required bool hideAdult,
}) {
  final blocked = <String>{...recentlyShown};
  for (final m in heroMetas) {
    blocked.add(animeFranchiseKey(m.name));
  }
  for (final name in continueWatchingNames) {
    blocked.add(animeFranchiseKey(name));
  }
  blocked.addAll(finishedFranchises(libItems).franchises);
  return (MetaPreview m) =>
      (hideAdult && isAdultAnime(m.genres, m.name)) ||
      blocked.contains(animeFranchiseKey(m.name)) ||
      watched.contains(m.id, m.name) ||
      voted.contains(m.id);
}

/// The Jikan page (1–3) to fetch for a row, rotated by the day seed. Ported from
/// `pageFor`.
int pageFor(String seedKey, int seed) =>
    1 + (mulberry32(mixSeed(seed, hashStr(seedKey)))() * 3).floor();

/// A stable per-franchise tie-break jitter. Ported from `rotationNoise`.
double rotationNoise(String franchiseKey, int seed) =>
    mulberry32(mixSeed(seed, hashStr(franchiseKey)))();

/// Scores a candidate: the source base, a recommendation-rank bonus, a genre-
/// affinity bonus, and the affinity score of its profile. Ported from
/// `scorePick`.
double scorePick(
  MetaPreview m,
  PickSource source,
  Affinity affinity, {
  int recsIndex = 0,
  int recsLen = 0,
}) {
  var base = _sourceBase[source]!;
  if (source == PickSource.rec && recsLen > 0) {
    base += (recsLen - recsIndex).clamp(0, recsLen) * 0.5;
  }
  if (source == PickSource.genre) {
    final weights = [for (final g in m.genres) affinity.genres[g] ?? 0];
    final top = weights.isEmpty
        ? 0.0
        : weights.reduce((a, b) => a > b ? a : b).clamp(0, double.infinity);
    base += (top < 20 ? top : 20);
  }
  return base + score(profileFromMeta(m), affinity);
}

/// One scored candidate. The score accumulates across the sources it appears in.
class PickEntry {
  PickEntry({required this.meta, required this.score});
  final MetaPreview meta;
  double score;
}

/// Ranks the franchise map by score (rotation-jitter tie-break) and takes the
/// top [limit]. Ported from `rankPicks`.
List<MetaPreview> rankPicks(
  Map<String, PickEntry> byFranchise,
  int seed,
  int limit,
) {
  final entries = byFranchise.entries.toList()
    ..sort((a, b) {
      if (b.value.score != a.value.score) {
        return b.value.score.compareTo(a.value.score);
      }
      return rotationNoise(a.key, seed).compareTo(rotationNoise(b.key, seed));
    });
  return [for (final e in entries.take(limit)) e.value.meta];
}
