import '../../core/http/json_transport.dart';
import '../addons/models.dart';
import '../catalog/catalog_row.dart';
import '../catalog/cinemeta.dart';
import '../catalog/tmdb.dart';
import '../addons/addon_client.dart';
import 'simkl_client.dart';
import 'simkl_trending.dart';
import 'simkl_types.dart';

/// Which Simkl granular rails are enabled (`settings.simklGranularFilters`).
class SimklGranularFilters {
  const SimklGranularFilters({
    this.moviesPlan = true,
    this.showsWatching = true,
    this.showsPlan = true,
    this.animeWatching = true,
    this.animePlan = true,
  });

  final bool moviesPlan;
  final bool showsWatching;
  final bool showsPlan;
  final bool animeWatching;
  final bool animePlan;

  static SimklGranularFilters fromMap(Map<String, dynamic> m) {
    bool flag(String group, String key, bool fallback) {
      final g = m[group];
      if (g is Map && g[key] is bool) return g[key] as bool;
      return fallback;
    }

    return SimklGranularFilters(
      moviesPlan: flag('movies', 'plantowatch', true),
      showsWatching: flag('shows', 'watching', true),
      showsPlan: flag('shows', 'plantowatch', true),
      animeWatching: flag('anime', 'watching', true),
      animePlan: flag('anime', 'plantowatch', true),
    );
  }
}

/// Builds the core Simkl Home rails (watching TV, plan-to-watch movies/shows),
/// ported from `src/lib/simkl/home-rails.ts` + `hydrate.ts`. Each Simkl item is
/// hydrated to a full [MetaPreview] — a TMDB detail overlay when a `tmdb` id +
/// key are present, else a Cinemeta lookup by IMDb id, dropping poster-less
/// items. Builds watching/plan rails for shows, movies AND anime, plus the
/// public "Simkl Trending Today" CDN rail. The up-next (activity cache) rail and
/// the anime FRANCHISE GROUPING (web `groupSimklItemsByFranchise`) are not yet
/// ported — anime here is a flat rail, not franchise-grouped.
class SimklHomeRowsBuilder {
  SimklHomeRowsBuilder({
    required this.client,
    required this.tmdb,
    required this.addon,
    required this.filters,
    required this.transport,
    this.trendingEnabled = false,
  });

  final SimklClient client;
  final TmdbClient tmdb;
  final AddonClient addon;
  final SimklGranularFilters filters;
  final JsonTransport transport;

  /// Whether the "Simkl Trending Today" rail (public CDN) is on
  /// (`simklTrendingRailEnabled`).
  final bool trendingEnabled;

  static const _perRail = 24;

  bool _isAnime(SimklWatchItem it) =>
      it.ids.mal != null || it.ids.anidb != null || it.ids.kitsu != null;

  Future<List<CatalogRow>> build() async {
    final results = await Future.wait([
      client.fetchWatching().catchError((_) => <SimklWatchItem>[]),
      client.fetchWatchlist().catchError((_) => <SimklWatchItem>[]),
      // The trending CDN is public (no auth) — only fetch it when the rail is on.
      trendingEnabled
          ? fetchSimklTrending(transport)
          : Future.value(<SimklWatchItem>[]),
    ]);
    final watching = results[0];
    final plan = results[1];
    final trending = results[2];

    final watchingShows = watching
        .where((it) => it.type == 'show' && !_isAnime(it))
        .toList();
    final watchingAnime = watching.where(_isAnime).toList();
    final planMovies = plan
        .where((it) => it.type == 'movie' && !_isAnime(it))
        .toList();
    final planShows = plan
        .where((it) => it.type == 'show' && !_isAnime(it))
        .toList();
    final planAnime = plan.where(_isAnime).toList();

    final hydrated = await Future.wait([
      _hydrate(watchingShows.take(_perRail).toList()),
      _hydrate(planMovies.take(_perRail).toList()),
      _hydrate(planShows.take(_perRail).toList()),
      _hydrate(trending.take(_perRail).toList()),
      _hydrate(watchingAnime.take(_perRail).toList()),
      _hydrate(planAnime.take(_perRail).toList()),
    ]);
    final watchingShowsMetas = hydrated[0];
    final planMoviesMetas = hydrated[1];
    final planShowsMetas = hydrated[2];
    final trendingMetas = hydrated[3];
    final watchingAnimeMetas = hydrated[4];
    final planAnimeMetas = hydrated[5];

    final rows = <CatalogRow>[];
    if (watchingShowsMetas.isNotEmpty && filters.showsWatching) {
      rows.add(
        _row(
          'simkl-watching-shows',
          'Watching TV Shows on Simkl',
          'series',
          watchingShowsMetas,
        ),
      );
    }
    if (watchingAnimeMetas.isNotEmpty && filters.animeWatching) {
      rows.add(
        _row(
          'simkl-watching-anime',
          'Watching Anime on Simkl',
          'series',
          watchingAnimeMetas,
        ),
      );
    }
    if (planMoviesMetas.length >= 4 && filters.moviesPlan) {
      rows.add(
        _row(
          'simkl-plantowatch-movies',
          'Plan to Watch Movies on Simkl',
          'movie',
          planMoviesMetas,
        ),
      );
    }
    if (planShowsMetas.length >= 4 && filters.showsPlan) {
      rows.add(
        _row(
          'simkl-plantowatch-shows',
          'Plan to Watch TV Shows on Simkl',
          'series',
          planShowsMetas,
        ),
      );
    }
    if (planAnimeMetas.length >= 4 && filters.animePlan) {
      rows.add(
        _row(
          'simkl-plantowatch-anime',
          'Plan to Watch Anime on Simkl',
          'series',
          planAnimeMetas,
        ),
      );
    }
    // "Simkl Trending Today" (public CDN) — appended last, like the web rail.
    if (trendingMetas.length >= 4) {
      rows.add(
        _row(
          'simkl-trending',
          'Simkl Trending Today',
          trendingMetas.first.type == 'movie' ? 'movie' : 'series',
          trendingMetas,
        ),
      );
    }
    return rows;
  }

  CatalogRow _row(
    String key,
    String title,
    String type,
    List<MetaPreview> metas,
  ) => CatalogRow(
    key: key,
    title: title,
    type: type,
    id: key,
    items: metas,
    noDedup: true,
  );

  Future<List<MetaPreview>> _hydrate(List<SimklWatchItem> items) async {
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

  Future<MetaPreview?> _hydrateOne(SimklWatchItem item) async {
    final id = item.stremioId;
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
          // the skeleton (keeping the Simkl title/id/type, no originalLanguage
          // leak that would wrongly language-filter these rails) — matching the
          // web `tmdbHydrate` merge.
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
    if (imdb != null && imdb.isNotEmpty) {
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
