import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/addons/addon_client.dart' show AddonClient;
import '../domain/catalog/tmdb.dart' show TmdbClient;
import '../domain/library/cw_advance.dart';
import '../domain/library/cw_resurface.dart';
import '../domain/library/cw_watched_sets.dart';
import '../domain/library/history.dart' show parseTs;
import '../domain/library/local_cw.dart';
import '../domain/library/new_episodes.dart';
import '../domain/library/series_episode_catalog.dart';
import '../domain/stremio/library_item.dart';
import 'providers.dart';
import 'simkl_providers.dart';
import 'stremio_auth.dart';
import 'trakt_providers.dart';

/// A Continue-Watching card as the advance engine sees it: the (possibly
/// advanced) entry plus the ephemeral [upNext] flag. Advanced/resurfaced cards
/// are never written back to the CW store — this view-model carries their
/// transient state, mirroring the web `upNext` field on the in-memory item.
class CwRow {
  const CwRow(this.entry, {this.upNext = false});
  final LocalCwEntry entry;
  final bool upNext;
}

/// The episode name for a Continue-Watching card (`S1E2 · <name>`), resolved from
/// the same LRU-cached episode catalog the advance engine uses. Ports the web CW
/// card's `fetchSeasonEpisodes` title lookup. Null for non-`tmdb:tv` series (the
/// catalog only covers TMDB today) or an unknown episode — the card just shows
/// S/E then.
final cwEpisodeTitleProvider =
    FutureProvider.family<String?, ({String id, int season, int episode})>((
      ref,
      k,
    ) async {
      final eps = await fetchSeriesEpisodes(
        id: k.id,
        client: ref.watch(tmdbClientProvider),
        addon: ref.watch(addonClientProvider),
      );
      for (final e in eps) {
        if (e.seasonNumber == k.season && e.episodeNumber == k.episode) {
          final name = e.name.trim();
          return name.isEmpty ? null : name;
        }
      }
      return null;
    });

/// The count of recently-aired episodes released since the viewer last watched a
/// `tt` series Continue-Watching entry — the web CW card's `useHasNewEpisode`
/// "+N" badge. 0 for non-`tt` / non-series ids (cinemeta `videos` carry reliable
/// air dates only for IMDb series) or when nothing new aired in the recent
/// window. Shares the LRU episode catalog the advance engine uses.
final cwNewEpisodeCountProvider =
    FutureProvider.family<int, ({String id, String type, int lastWatchedMs})>((
      ref,
      k,
    ) async {
      if (k.type != 'series' ||
          !k.id.startsWith('tt') ||
          k.lastWatchedMs <= 0) {
        return 0;
      }
      final eps = await fetchSeriesEpisodes(
        id: k.id,
        client: ref.watch(tmdbClientProvider),
        addon: ref.watch(addonClientProvider),
      );
      return newEpisodeCount(eps, k.lastWatchedMs, DateTime.now());
    });

/// Whether the CW advance engine is on (web `cwAdvanceNext`, default true). When
/// off the shelf shows the raw aggregate unchanged.
final cwAdvanceEnabledProvider = Provider<bool>(
  (ref) => ref.watch(settingsProvider).getBool('cwAdvanceNext'),
);

/// The signed-in user's Trakt watched-episode keys (`imdb:<show>:<s>:<e>` /
/// `tmdb:<show>:<s>:<e>`), so a title finished on another device advances here
/// too. Empty when Trakt is disconnected or the fetch fails. Ports the web
/// `traktWatched` set feeding `useCwAdvance`.
final traktWatchedKeySetProvider = FutureProvider<Set<String>>((ref) async {
  if (!ref.watch(traktConnectedProvider)) return const {};
  try {
    return await ref.watch(traktClientProvider).fetchWatchedKeySet();
  } catch (_) {
    return const {};
  }
});

/// The ids the signed-in Simkl account marks `completed` — the "all other
/// episodes watched" whole-series fallback the advance engine folds into
/// [CwWatchedSets.completedSeriesIds]. Simkl's status map is keyed by the exact
/// stremio id forms a CW entry carries (`tt…`, `tmdb:tv:<n>`, `mal:<n>`,
/// `kitsu:<n>`, `anilist:<n>`, `anidb:<n>`), so a completed id matches a CW
/// entry directly. Empty when Simkl is disconnected or the fetch fails. Ports
/// the web `simklStatus` map feeding `useCwAdvance` (`statusForId === 'completed'`).
final simklCompletedIdsProvider = FutureProvider<Set<String>>((ref) async {
  if (!ref.watch(simklConnectedProvider)) return const {};
  try {
    final map = await ref.watch(simklClientProvider).fetchListStatusMap();
    return {
      for (final e in map.entries)
        if (e.value == 'completed') e.key,
    };
  } catch (_) {
    return const {};
  }
});

/// The signed-in Stremio account's full library, so the resurface pass can find
/// recently-finished titles that are no longer in Continue-Watching. Empty when
/// signed out or on failure. (History loads the same list separately; resurface
/// keeps its own read so the two features stay independent.)
final stremioLibraryProvider = FutureProvider<List<LibraryItem>>((ref) async {
  final authKey = ref.watch(stremioSessionProvider).asData?.value?.authKey;
  if (authKey == null || authKey.isEmpty) return const [];
  final res = await ref.watch(stremioApiProvider).library(authKey);
  return res.valueOrNull ?? const [];
});

/// Bounds how many resurface candidates fetch an episode list per rebuild, so a
/// large finished-library never fans out into hundreds of episode requests. The
/// most-recently-watched candidates win; the rest wait for a later rebuild.
const int _resurfaceCap = 24;

/// The watched-set snapshot the engine consults: the per-episode manual-watched
/// store (the player's on-finish signal) fused with the Trakt watched keyset and
/// the Simkl `completed` whole-series fallback. AniList/MAL per-title progress
/// folds in with the anime episode branch (Slice 3b — its keys have no effect
/// until an anime episode list exists to advance through).
final cwWatchedSetsProvider = Provider<CwWatchedSets>((ref) {
  final manual = ref.watch(manualWatchedProvider);
  // Watching manualWatchedProvider rebuilds this whenever a watched toggle
  // happens; re-read the explicit-unwatched set (it shares the store) so an
  // episode the viewer marked unwatched overrides any tracker's "watched".
  final unwatched = ref.watch(manualWatchedStoreProvider).loadUnwatched();
  final trakt = ref.watch(traktWatchedKeySetProvider).value ?? const <String>{};
  final simklCompleted =
      ref.watch(simklCompletedIdsProvider).value ?? const <String>{};
  return CwWatchedSets(
    manualKeys: manual,
    manualUnwatchedKeys: unwatched,
    traktKeys: trakt,
    completedSeriesIds: simklCompleted,
  );
});

/// The advanced Continue-Watching list. Ports the web `useCwAdvance` effect:
/// for each series whose current episode is watched, fetch its episode catalog
/// and either advance the card to the next unwatched aired episode or drop the
/// finished series. Falls back to the raw aggregate while loading / when
/// disabled, so the shelf is never blank.
final cwAdvancedProvider =
    AsyncNotifierProvider<CwAdvanceNotifier, List<CwRow>>(
      CwAdvanceNotifier.new,
    );

class CwAdvanceNotifier extends AsyncNotifier<List<CwRow>> {
  @override
  Future<List<CwRow>> build() async {
    final base = ref.watch(continueWatchingProvider);
    if (!ref.watch(cwAdvanceEnabledProvider)) {
      return [for (final e in base) CwRow(e)];
    }
    final sets = ref.watch(cwWatchedSetsProvider);
    final client = ref.watch(tmdbClientProvider);
    final addon = ref.watch(addonClientProvider);
    // Read the library synchronously here (never `ref.watch` after an await in an
    // AsyncNotifier build) — empty/loading yields no resurface this pass, and the
    // build re-runs when it resolves.
    final library =
        ref.watch(stremioLibraryProvider).value ?? const <LibraryItem>[];
    // Cards the viewer dismissed this session — a resurfaced card whose id is not
    // in the CW store can only be suppressed here (web `isCwDismissed`).
    final dismissed = ref.watch(cwDismissedProvider);
    // `now` cannot be memoized in the provider (it changes every rebuild) but the
    // advance decision only compares air dates coarsely, so this is stable.
    final now = DateTime.now();

    final advanced = <String, LocalCwEntry>{};
    final removed = <String>{};
    for (final e in base) {
      final item = CwAdvanceItem.fromLocal(e);
      if (!isAdvanceTarget(item, sets)) continue;
      final eps = await fetchSeriesEpisodes(
        id: e.id,
        client: client,
        addon: addon,
      );
      final outcome = decideAdvance(
        item: item,
        episodes: eps,
        sets: sets,
        animeMode: AnimeMode.all,
        now: now,
      );
      switch (outcome) {
        case CwAdvance(next: final n):
          advanced[e.id] = _advancedEntry(e, n);
        case CwRemove():
          removed.add(e.id);
        case CwKeep():
          break;
      }
    }

    final rows = <CwRow>[
      for (final e in base)
        if (!removed.contains(e.id))
          CwRow(advanced[e.id] ?? e, upNext: advanced.containsKey(e.id)),
    ];

    // Resurface pass: recently-finished library titles (not already shown) with
    // a newly-aired next episode, surfaced as fresh up-next cards. Ports web
    // `resurfaceCandidates` — appended after the CW rows, deduped by type|name.
    final resurfaced = await _resurface(
      rows,
      library,
      dismissed,
      sets,
      client,
      addon,
      now,
    );
    return resurfaced.isEmpty ? rows : [...rows, ...resurfaced];
  }

  /// Builds the resurfaced up-next cards for the current CW [rows] from the
  /// already-read [library], filtering to candidates and fetching each one's
  /// episode list to find the immediately-next aired unwatched episode.
  Future<List<CwRow>> _resurface(
    List<CwRow> rows,
    List<LibraryItem> library,
    Set<String> dismissed,
    CwWatchedSets sets,
    TmdbClient client,
    AddonClient addon,
    DateTime now,
  ) async {
    if (library.isEmpty) return const [];
    // Exclude ids already on the shelf AND ids dismissed this session (web
    // `inCw || isCwDismissed`).
    final inCw = {for (final r in rows) r.entry.id, ...dismissed};
    final seenNames = {
      for (final r in rows) '${r.entry.type}|${r.entry.name.toLowerCase()}',
    };
    final candidates =
        library
            // Anime resurface needs the anime episode branch (Slice 3b);
            // `fetchSeriesEpisodes` returns `[]` for anime ids today, so anime
            // candidates would only starve the fetch cap — skip them for now.
            .where(
              (i) =>
                  !isResurfaceAnimeId(i.id) &&
                  isResurfaceCandidate(
                    i,
                    inCw: inCw,
                    animeMode: AnimeMode.all,
                    now: now,
                    sets: sets,
                  ),
            )
            .toList()
          ..sort(
            (a, b) => (parseTs(b.state?.lastWatched) ?? 0).compareTo(
              parseTs(a.state?.lastWatched) ?? 0,
            ),
          );
    final out = <CwRow>[];
    for (final i in candidates.take(_resurfaceCap)) {
      final cur = resurfaceCurrentEpisode(i);
      if (cur == null) continue;
      final key = '${i.type}|${i.name.toLowerCase()}';
      if (seenNames.contains(key)) continue;
      final eps = await fetchSeriesEpisodes(
        id: i.id,
        client: client,
        addon: addon,
      );
      final next = resurfaceNext(eps, cur, id: i.id, now: now, sets: sets);
      if (next == null) continue;
      seenNames.add(key);
      out.add(CwRow(_resurfacedEntry(i, next), upNext: true));
    }
    return out;
  }

  /// A synthetic up-next entry for a resurfaced library title — the next episode,
  /// no resume position. Ephemeral (like advanced entries): never persisted.
  static LocalCwEntry _resurfacedEntry(LibraryItem i, EpisodeRef next) =>
      LocalCwEntry(
        id: i.id,
        type: i.type,
        name: i.name,
        poster: i.poster,
        background: i.background,
        season: next.season,
        episode: next.episode,
        videoId: '${i.id}:${next.season}:${next.episode}',
        positionMs: 0,
        durationMs: 0,
        t: parseTs(i.state?.lastWatched) ?? 0,
      );

  /// A card rolled forward to [next]: new season/episode + videoId, progress
  /// reset. Ephemeral — never persisted to the CW store.
  static LocalCwEntry _advancedEntry(LocalCwEntry e, EpisodeRef next) =>
      LocalCwEntry(
        id: e.id,
        type: e.type,
        name: e.name,
        poster: e.poster,
        background: e.background,
        season: next.season,
        episode: next.episode,
        videoId: '${e.id}:${next.season}:${next.episode}',
        positionMs: 0,
        durationMs: e.durationMs,
        t: e.t,
      );
}
