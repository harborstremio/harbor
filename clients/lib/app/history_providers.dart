import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/catalog/tmdb_details.dart';
import '../domain/library/history.dart';
import '../domain/library/history_episode.dart';
import '../domain/stremio/library_item.dart';
import '../domain/trakt/trakt_types.dart';
import 'providers.dart';
import 'stremio_auth.dart';
import 'trakt_providers.dart';

/// The Library "History" feed — the merged Stremio-library + Trakt watched
/// history. Ported from the local state the web `HistoryTab` assembles.
class HistoryFeedState {
  const HistoryFeedState({
    required this.entries,
    required this.loading,
    required this.traktSyncing,
  });

  final List<HistoryEntry> entries;

  /// The first load pass is still in flight (nothing to show yet).
  final bool loading;

  /// The Trakt history request is in flight (shows a "Syncing Trakt…" hint).
  final bool traktSyncing;

  HistoryFeedState copyWith({
    List<HistoryEntry>? entries,
    bool? loading,
    bool? traktSyncing,
  }) => HistoryFeedState(
    entries: entries ?? this.entries,
    loading: loading ?? this.loading,
    traktSyncing: traktSyncing ?? this.traktSyncing,
  );
}

/// Loads and merges the watched-history feed: the signed-in Stremio library's
/// played items (via [filterHistory]) plus the connected Trakt account's watched
/// history, de-duplicated by [mergeHistory]. Removing a row flags it removed on
/// Stremio and drops it locally. Ported 1:1 from the web `HistoryTab`.
class HistoryFeedController extends Notifier<HistoryFeedState> {
  int _gen = 0;
  List<LibraryItem> _stremio = const [];
  List<TraktHistoryItem> _trakt = const [];

  @override
  HistoryFeedState build() {
    final authKey = ref.watch(stremioSessionProvider).asData?.value?.authKey;
    final traktConnected = ref.watch(traktConnectedProvider);
    final gen = ++_gen;
    _stremio = const [];
    _trakt = const [];
    final hasSource = (authKey != null && authKey.isNotEmpty) || traktConnected;
    _load(authKey, traktConnected, gen);
    return HistoryFeedState(
      entries: const [],
      loading: hasSource,
      traktSyncing: false,
    );
  }

  Future<void> _load(String? authKey, bool traktConnected, int gen) async {
    // Yield so a build()-triggered load never writes state synchronously during
    // build (the Trakt-only branch has no preceding await when signed out of
    // Stremio) — the notifier's state must be initialized first.
    await Future<void>.value();
    if (gen != _gen) return;
    if (authKey != null && authKey.isNotEmpty) {
      final res = await ref.read(stremioApiProvider).library(authKey);
      if (gen != _gen) return;
      _stremio = filterHistory(res.valueOrNull ?? const []);
      _remerge(gen);
    }
    if (traktConnected) {
      if (gen != _gen) return;
      state = state.copyWith(traktSyncing: true);
      final rows = await ref.read(traktClientProvider).fetchWatchedHistory();
      if (gen != _gen) return;
      _trakt = rows;
      state = state.copyWith(traktSyncing: false);
      _remerge(gen);
    }
    if (gen != _gen) return;
    state = state.copyWith(loading: false);
  }

  void _remerge(int gen) {
    if (gen != _gen) return;
    state = state.copyWith(entries: mergeHistory(_stremio, _trakt));
  }

  /// Re-fetches both sources.
  Future<void> refresh() async {
    final authKey = ref.read(stremioSessionProvider).asData?.value?.authKey;
    final traktConnected = ref.read(traktConnectedProvider);
    final gen = ++_gen;
    _stremio = const [];
    _trakt = const [];
    state = state.copyWith(
      entries: const [],
      loading: (authKey != null && authKey.isNotEmpty) || traktConnected,
    );
    await _load(authKey, traktConnected, gen);
  }

  /// Removes a Stremio-sourced row: flag it removed on the account (best-effort,
  /// restoring on failure) and drop it from the feed. Ports the web `handleRemove`.
  Future<void> remove(String stremioId) async {
    final authKey = ref.read(stremioSessionProvider).asData?.value?.authKey;
    if (authKey == null || authKey.isEmpty) return;
    final prev = _stremio;
    _stremio = [
      for (final i in _stremio)
        if (i.id != stremioId) i,
    ];
    _remerge(_gen);
    try {
      await ref
          .read(stremioApiProvider)
          .removeBookmark(
            authKey,
            stremioId,
            nowIso: DateTime.now().toUtc().toIso8601String(),
          );
    } catch (_) {
      _stremio = prev;
      _remerge(_gen);
    }
  }
}

/// The merged watched-history feed for the Library "History" tab.
final historyFeedProvider =
    NotifierProvider<HistoryFeedController, HistoryFeedState>(
      HistoryFeedController.new,
    );

/// The TMDB episodes of one watched series-season, resolved from its IMDb id —
/// this backs the still + episode-title enrichment on History episode cards.
/// Keyed by `(imdbId, season)` so every episode of a season shares one fetch
/// (the family dedupes and caches), matching the web card's per-season lazy load.
final historySeasonEpisodesProvider =
    FutureProvider.family<List<Episode>, ({String imdbId, int season})>((
      ref,
      arg,
    ) {
      return fetchHistorySeasonEpisodes(
        ref.watch(tmdbClientProvider),
        imdbId: arg.imdbId,
        season: arg.season,
      );
    });
