import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/anime/anime_detail.dart' show isAnimeId;
import '../domain/trakt/trakt_types.dart';
import '../domain/wrapped/wrapped_aggregate.dart';
import '../domain/wrapped/wrapped_collect.dart';
import '../domain/wrapped/wrapped_enrich.dart';
import '../domain/wrapped/wrapped_types.dart';
import 'anime_providers.dart';
import 'providers.dart';
import 'trakt_providers.dart';

/// The Wrapped year-in-review stats. Collects the viewer's watch events (Trakt
/// history when connected, else the local playback history), then aggregates
/// them for the current year — falling back to all-time when this year is empty
/// but earlier years have plays. Ports the `views/wrapped.tsx` load effect.
final wrappedStatsProvider = FutureProvider.autoDispose<WrappedStats>((
  ref,
) async {
  final traktConnected = ref.watch(traktConnectedProvider);
  List<TraktHistoryItem>? traktHistory;
  if (traktConnected) {
    // fetchWatchedHistory is a non-critical read (returns [] on error); an empty
    // result correctly falls through to the local source in collectWatchEvents.
    traktHistory = await ref
        .read(traktClientProvider)
        .fetchWatchedHistory(limit: 2000);
  }

  final playback = ref.read(playbackHistoryStoreProvider).playbackEvents();
  final detectStore = ref.read(animeDetectStoreProvider);

  final collected = collectWatchEvents(
    traktHistory: traktHistory,
    playback: playback,
    detected: detectStore.isDetected,
  );

  final year = DateTime.now().year;
  final yearStats = aggregateWrapped(collected.events, collected.source, year);
  // If this year has nothing but earlier years do, show the all-time cut.
  if (yearStats.totalPlays == 0 && collected.events.isNotEmpty) {
    return aggregateWrapped(collected.events, collected.source, null);
  }
  return yearStats;
});

/// The Wrapped "Top genres" ranking — the enrichment second phase (web
/// `enrichTopTitles`' genre half). Depends on the base stats, then fetches each
/// tt-id top title's Cinemeta meta and rolls its genres up weighted by play
/// count. The base view renders immediately; this fills the Genres card when it
/// resolves. Posters are NOT re-fetched here — [RpdbPosterImage] already
/// resolves a poster chain from the meta id, so the web `posters` map is
/// redundant on this client.
final wrappedGenresProvider =
    FutureProvider.autoDispose<List<({String genre, int count})>>((ref) async {
      final stats = await ref.watch(wrappedStatsProvider.future);
      if (stats.source == WrappedSource.empty || stats.topTitles.isEmpty) {
        return const [];
      }
      final enriched = <EnrichedTitle>[];
      await Future.wait(
        stats.topTitles.map((tt) async {
          // Only Cinemeta tt-id titles carry genres (web enrich.ts); tmdb/anime
          // ids contribute posters only, which we already resolve natively.
          if (isAnimeId(tt.id) || !tt.id.startsWith('tt')) return;
          try {
            final meta = await ref.read(
              metaProvider((
                type: tt.type == WatchType.movie ? 'movie' : 'series',
                id: tt.id,
              )).future,
            );
            if (meta != null && meta.genres.isNotEmpty) {
              enriched.add((title: tt, genres: meta.genres));
            }
          } catch (_) {
            /* a missing meta just contributes no genres */
          }
        }),
      );
      return accumulateWrappedGenres(enriched);
    });
