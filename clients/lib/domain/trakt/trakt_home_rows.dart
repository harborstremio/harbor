import '../addons/models.dart';
import '../catalog/catalog_row.dart';
import '../catalog/cinemeta.dart';
import '../catalog/tmdb.dart';
import '../addons/addon_client.dart';
import 'trakt_client.dart';
import 'trakt_types.dart';

/// Builds the Trakt Home rails (watchlist, up-next, movie/show recommendations),
/// ported 1:1 from `src/lib/trakt/home-rails.ts` + `hydrate.ts`. Each Trakt item
/// is hydrated to a full [MetaPreview]: a TMDB detail lookup when a `tmdb` id and
/// key are present, else a Cinemeta lookup by IMDb id, and items without a poster
/// are dropped. A rail is emitted only when at least four items survive.
class TraktHomeRowsBuilder {
  TraktHomeRowsBuilder({
    required this.client,
    required this.tmdb,
    required this.addon,
    required this.todayIso,
  });

  final TraktClient client;
  final TmdbClient tmdb;
  final AddonClient addon;

  /// Today as `YYYY-MM-DD` (from `calendarIso`), the start of the up-next window.
  final String todayIso;

  static const _perRail = 24;

  Future<List<CatalogRow>> build() async {
    // Each rail's fetch is isolated (matching the web's per-call `.catch(() =>
    // [])`): a transport-level failure — DNS/timeout/TLS, which surfaces as a
    // TransportException rather than a TraktApiError the fetch methods catch —
    // on one endpoint must blank only its own rail, not all four.
    final results = await Future.wait([
      client.fetchWatchlist().catchError((_) => <TraktWatchItem>[]),
      client.fetchMovieRecommendations().catchError((_) => <TraktWatchItem>[]),
      client.fetchShowRecommendations().catchError((_) => <TraktWatchItem>[]),
      client
          .fetchUpcomingEpisodes(todayIso: todayIso, days: 14)
          .catchError((_) => <TraktUpcomingEpisode>[]),
    ]);
    final watchlist = results[0] as List<TraktWatchItem>;
    final movieRecs = results[1] as List<TraktWatchItem>;
    final showRecs = results[2] as List<TraktWatchItem>;
    final upcoming = results[3] as List<TraktUpcomingEpisode>;

    final upcomingItems = _dedupe([
      for (final ep in upcoming)
        TraktWatchItem(
          type: 'show',
          title: ep.showTitle,
          year: ep.showYear,
          ids: ep.ids,
        ),
    ]);

    final hydrated = await Future.wait([
      _hydrate(watchlist.take(_perRail).toList()),
      _hydrate(upcomingItems.take(_perRail).toList()),
      _hydrate(movieRecs.take(_perRail).toList()),
      _hydrate(showRecs.take(_perRail).toList()),
    ]);
    final watchlistMetas = hydrated[0];
    final upcomingMetas = hydrated[1];
    final recMovieMetas = hydrated[2];
    final recShowMetas = hydrated[3];

    final rows = <CatalogRow>[];
    if (watchlistMetas.length >= 4) {
      rows.add(
        CatalogRow(
          key: 'trakt-watchlist',
          title: 'Your Trakt Watchlist',
          type: watchlist.isNotEmpty && watchlist.first.type == 'show'
              ? 'series'
              : 'movie',
          id: 'trakt-watchlist',
          items: watchlistMetas,
          noDedup: true,
        ),
      );
    }
    if (upcomingMetas.length >= 4) {
      rows.add(
        CatalogRow(
          key: 'trakt-upcoming',
          title: 'Up Next on Trakt',
          type: 'series',
          id: 'trakt-upcoming',
          items: upcomingMetas,
          noDedup: true,
        ),
      );
    }
    if (recMovieMetas.length >= 4) {
      rows.add(
        CatalogRow(
          key: 'trakt-recs-movies',
          title: 'Trakt Recommends: Movies',
          type: 'movie',
          id: 'trakt-recs-movies',
          items: recMovieMetas,
          noDedup: true,
        ),
      );
    }
    if (recShowMetas.length >= 4) {
      rows.add(
        CatalogRow(
          key: 'trakt-recs-shows',
          title: 'Trakt Recommends: Series',
          type: 'series',
          id: 'trakt-recs-shows',
          items: recShowMetas,
          noDedup: true,
        ),
      );
    }
    return rows;
  }

  /// Drops duplicate items by IMDb (or `tmdb:<id>`) key. Ports `dedupeItems`.
  List<TraktWatchItem> _dedupe(List<TraktWatchItem> items) {
    final seen = <String>{};
    final out = <TraktWatchItem>[];
    for (final it in items) {
      final k =
          it.ids.imdb ?? (it.ids.tmdb != null ? 'tmdb:${it.ids.tmdb}' : null);
      if (k == null || seen.contains(k)) continue;
      seen.add(k);
      out.add(it);
    }
    return out;
  }

  /// Hydrates items to metas (20 at a time), keeping only those with a poster.
  /// Ports `hydrateTraktItems` + `mapLimit`.
  Future<List<MetaPreview>> _hydrate(List<TraktWatchItem> items) async {
    final out = <MetaPreview>[];
    for (var i = 0; i < items.length; i += 20) {
      final batch = items.sublist(i, (i + 20).clamp(0, items.length));
      final metas = await Future.wait(batch.map(_hydrateOne));
      for (final m in metas) {
        if (m != null && (m.poster?.isNotEmpty ?? false)) out.add(m);
      }
    }
    return out;
  }

  /// Hydrates a single item, ported from `hydrateOne`: TMDB detail (poster-rich)
  /// when a tmdb id + key exist, else a Cinemeta lookup by IMDb id, else the
  /// bare skeleton (which the caller drops for having no poster).
  /// The Stremio id for a Trakt item, TMDB-first then IMDb — ported from the web
  /// `pickStremioId` (the Trakt rails id titles as `tmdb:…`, matching the TMDB
  /// home rows), which differs from `TraktWatchItem.stremioId` (IMDb-first).
  String? _pickId(TraktWatchItem item) {
    final tmdb = item.ids.tmdb;
    if (tmdb != null) {
      return 'tmdb:${item.type == 'show' ? 'tv' : 'movie'}:$tmdb';
    }
    final imdb = item.ids.imdb;
    if (imdb != null) return imdb;
    return null;
  }

  Future<MetaPreview?> _hydrateOne(TraktWatchItem item) async {
    final id = _pickId(item);
    if (id == null) return null;
    final skeleton = MetaPreview({
      'id': id,
      'type': item.stremioType,
      'name': item.title,
      if (item.year != null) 'releaseInfo': '${item.year}',
    });

    final tmdbId = item.ids.tmdb;
    if (tmdb.hasKey && tmdbId != null) {
      try {
        final raw = await tmdb.get(
          item.type == 'show' ? 'tv/$tmdbId' : 'movie/$tmdbId',
        );
        if (raw != null) {
          // Overlay only poster/background/description/releaseInfo/imdbRating on
          // the trakt skeleton (matching web `tmdbHydrate` + `{...skeleton,
          // ...enriched}`): the trakt-provided title/id/type are kept, and no
          // `originalLanguage` leaks in (which would wrongly language-filter the
          // Trakt rails, unlike the web, whose Trakt metas carry no language).
          final full = item.type == 'show'
              ? tmdb.seriesMeta(raw)
              : tmdb.movieMeta(raw);
          final fj = full.json;
          final poster = fj['poster'];
          if (poster is String && poster.isNotEmpty) {
            return MetaPreview({
              ...skeleton.json,
              'poster': poster,
              if (fj['background'] != null) 'background': fj['background'],
              if (fj['description'] != null) 'description': fj['description'],
              if (fj['releaseInfo'] != null) 'releaseInfo': fj['releaseInfo'],
              if (fj['imdbRating'] != null) 'imdbRating': fj['imdbRating'],
            });
          }
        }
      } catch (_) {
        // Fall through to the Cinemeta lookup / skeleton.
      }
    }

    final imdb = item.ids.imdb;
    if (imdb != null) {
      try {
        final full = await addon.meta(cinemetaBase, item.stremioType, imdb);
        final m = full.valueOrNull;
        if (m != null && (m.poster?.isNotEmpty ?? false)) {
          return MetaPreview(m.json);
        }
      } catch (_) {
        // Fall through to the skeleton.
      }
    }

    return skeleton;
  }
}
