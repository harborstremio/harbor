import '../../core/http/json_transport.dart';
import '../addons/addon_client.dart';
import '../anime/anizip.dart';
import '../catalog/cinemeta.dart';
import '../catalog/tmdb.dart';
import '../catalog/tvmaze.dart';
import '../stremio/library_item.dart';
import '../trakt/trakt_types.dart';
import 'calendar.dart';
import 'tmdb_calendar.dart';

const _seriesLimit = 80;
const _movieLimit = 80;
const _tmdbConcurrency = 6;
const _tvmazeConcurrency = 3;

/// A saved title that may have upcoming releases. Ported from `SavedCandidate`.
class SavedCandidate {
  const SavedCandidate({
    required this.id,
    required this.type, // 'movie' | 'series'
    required this.name,
    this.mtime = 0,
    this.temp = false,
  });

  final String id;
  final String type;
  final String name;
  final int mtime;
  final bool temp;
}

class _ResolvedEpisode {
  const _ResolvedEpisode({
    required this.season,
    required this.number,
    required this.name,
    required this.airDate,
    this.image,
    this.overview = '',
    this.voteAverage = 0,
  });
  final int season;
  final int number;
  final String name;
  final String airDate;
  final String? image;
  final String overview;
  final double voteAverage;
}

class _ResolvedSeries {
  const _ResolvedSeries({
    required this.name,
    this.poster,
    required this.isAnime,
    required this.episodes,
  });
  final String name;
  final String? poster;
  final bool isAnime;
  final List<_ResolvedEpisode> episodes;
}

bool _isAnimationGenre(List<String>? genres) {
  if (genres == null) return false;
  return genres.any((g) {
    final l = g.toLowerCase();
    return l == 'animation' || l == 'anime';
  });
}

String _pad(int n) => n.toString().padLeft(2, '0');

bool _isAnimeId(String id) =>
    id.startsWith('kitsu:') ||
    id.startsWith('mal:') ||
    id.startsWith('anilist:');

int? _animeNumericId(String id) {
  final parts = id.split(':');
  return parts.length > 1 ? int.tryParse(parts[1]) : null;
}

Future<List<R>> _mapLimit<T, R>(
  List<T> items,
  int limit,
  Future<R> Function(T) fn,
) async {
  final out = <R>[];
  for (var i = 0; i < items.length; i += limit) {
    out.addAll(await Future.wait(items.skip(i).take(limit).map(fn)));
  }
  return out;
}

/// A wide resolution window (31 days back to 400 days forward) around [now].
bool Function(String) _wideWindow(DateTime now) {
  final lo = now.subtract(const Duration(days: 31));
  final hi = now.add(const Duration(days: 400));
  return (iso) {
    final t = DateTime.tryParse(iso);
    return t != null && !t.isBefore(lo) && !t.isAfter(hi);
  };
}

Future<_ResolvedSeries?> _animeUpcoming(
  JsonTransport transport,
  String id,
  bool Function(String) inWindow,
) async {
  final numId = _animeNumericId(id);
  if (numId == null) return null;
  final mapping = id.startsWith('kitsu:')
      ? await aniZipByKitsu(transport, numId)
      : id.startsWith('mal:')
      ? await aniZipByMal(transport, numId)
      : await aniZipByAnilist(transport, numId);
  if (mapping == null || mapping.episodes.isEmpty) return null;
  final episodes = <_ResolvedEpisode>[];
  for (final entry in mapping.episodes.entries) {
    final ep = entry.value;
    final date = calendarDate10(ep.airDate ?? ep.airDateUtc);
    if (date.isEmpty || !inWindow(date)) continue;
    episodes.add(
      _ResolvedEpisode(
        season: ep.seasonNumber ?? 1,
        number: ep.episodeNumber ?? (int.tryParse(entry.key) ?? 0),
        name: pickEpisodeTitle(ep) ?? '',
        airDate: date,
        image: ep.image,
        overview: ep.overview,
      ),
    );
  }
  return _ResolvedSeries(
    name: mapping.titles['en'] ?? mapping.titles['x-jat'] ?? '',
    isAnime: true,
    episodes: episodes,
  );
}

Future<_ResolvedSeries?> _cinemetaSeriesUpcoming(
  AddonClient addon,
  String id,
  bool Function(String) inWindow,
) async {
  if (!id.startsWith('tt')) return null;
  final imdb = id.split(':').first;
  final m = (await addon.meta(cinemetaBase, 'series', imdb)).valueOrNull;
  if (m == null || m.videos.isEmpty) return null;
  final episodes = <_ResolvedEpisode>[];
  for (final v in m.videos) {
    final date = calendarDate10(v.released);
    final number = v.episode;
    if (date.isEmpty || !inWindow(date) || number == null) continue;
    episodes.add(
      _ResolvedEpisode(
        season: v.season ?? 0,
        number: number,
        name: v.title ?? '',
        airDate: date,
        image: v.thumbnail,
      ),
    );
  }
  if (episodes.isEmpty) return null;
  return _ResolvedSeries(
    name: m.name,
    poster: m.poster,
    isAnime: _isAnimationGenre(m.genres),
    episodes: episodes,
  );
}

Future<_ResolvedSeries?> _tmdbSeries(
  TmdbClient tmdb,
  String id,
  bool Function(String) inWindow,
) async {
  int? tvId;
  if (id.startsWith('tmdb:tv:')) {
    tvId = int.tryParse(id.split(':')[2]);
  } else if (id.startsWith('tt')) {
    tvId = (await tmdbFindByImdb(tmdb, id.split(':').first)).tvId;
  }
  if (tvId == null) return null;
  final up = await tmdbTvUpcoming(tmdb, tvId, inWindow);
  if (up == null) return null;
  return _ResolvedSeries(
    name: up.name,
    poster: up.poster,
    isAnime: up.isAnime,
    episodes: [
      for (final e in up.episodes)
        _ResolvedEpisode(
          season: e.season,
          number: e.number,
          name: e.name,
          airDate: e.airDate,
          image: e.image,
          overview: e.overview,
          voteAverage: e.voteAverage,
        ),
    ],
  );
}

Future<_ResolvedSeries?> _seriesUpcoming(
  SavedCandidate c,
  bool Function(String) inWindow, {
  required TmdbClient tmdb,
  required AddonClient addon,
  required JsonTransport transport,
}) async {
  if (_isAnimeId(c.id)) return _animeUpcoming(transport, c.id, inWindow);
  if (c.id.startsWith('tt')) {
    final cm = await _cinemetaSeriesUpcoming(addon, c.id, inWindow);
    if (cm != null) return cm;
  }
  if (tmdb.hasKey) {
    final t = await _tmdbSeries(tmdb, c.id, inWindow);
    if (t != null) return t;
  } else if (c.id.startsWith('tt')) {
    final up = await tvmazeUpcoming(transport, c.id.split(':').first, inWindow);
    if (up != null) {
      return _ResolvedSeries(
        name: up.show.name,
        poster: up.show.image,
        isAnime: up.show.isAnime,
        episodes: [
          for (final e in up.episodes)
            _ResolvedEpisode(
              season: e.season,
              number: e.number,
              name: e.name,
              airDate: e.airdate,
              image: e.image,
              overview: e.summary,
            ),
        ],
      );
    }
  }
  return null;
}

Future<CalendarItem?> _movieRelease(
  SavedCandidate c,
  bool Function(String) inWindow, {
  required TmdbClient tmdb,
  required AddonClient addon,
}) async {
  final imdb = c.id.startsWith('tt') ? c.id.split(':').first : null;
  int? movieId;
  if (c.id.startsWith('tmdb:movie:')) {
    movieId = int.tryParse(c.id.split(':')[2]);
  } else if (imdb != null && tmdb.hasKey) {
    movieId = (await tmdbFindByImdb(tmdb, imdb)).movieId;
  }

  if (movieId != null && tmdb.hasKey) {
    final m = await tmdbMovieRelease(tmdb, movieId);
    if (m == null || !inWindow(m.releaseDate)) return null;
    return CalendarItem(
      id: c.id,
      imdbId: imdb,
      type: 'movie',
      name: m.name.isNotEmpty ? m.name : c.name,
      poster: m.poster,
      background: m.background,
      releaseDate: m.releaseDate,
      isAnime: m.isAnime,
      overview: m.overview,
      voteAverage: m.voteAverage,
    );
  }
  if (imdb != null) {
    final m = (await addon.meta(cinemetaBase, 'movie', imdb)).valueOrNull;
    if (m == null) return null;
    final date = calendarDate10(m.json['released']);
    if (!inWindow(date)) return null;
    return CalendarItem(
      id: m.id,
      imdbId: imdb,
      type: 'movie',
      name: m.name,
      poster: m.poster,
      background: m.background,
      releaseDate: date,
      isAnime: _isAnimationGenre(m.genres),
      overview: m.description ?? '',
      voteAverage: (m.imdbRating ?? 0).toDouble(),
    );
  }
  return null;
}

int _curatedFirst(SavedCandidate a, SavedCandidate b) {
  final t = (a.temp ? 1 : 0) - (b.temp ? 1 : 0);
  if (t != 0) return t;
  return b.mtime.compareTo(a.mtime);
}

/// Gathers saved candidates from the Stremio library, the local watchlist and
/// (optionally) the Trakt watchlist, de-duped by id. Ports `gatherCandidates`.
List<SavedCandidate> gatherLibraryCandidates(
  List<LibraryItem> stremio,
  List<SavedCandidate> local,
  List<TraktWatchItem> trakt,
) {
  final byId = <String, SavedCandidate>{};
  void add(SavedCandidate c) {
    final prev = byId[c.id];
    byId[c.id] = prev == null
        ? c
        : SavedCandidate(
            id: c.id,
            type: prev.type,
            name: prev.name.isNotEmpty ? prev.name : c.name,
            mtime: prev.mtime > c.mtime ? prev.mtime : c.mtime,
            temp: prev.temp && c.temp,
          );
  }

  for (final i in stremio) {
    if (i.removed) continue;
    add(
      SavedCandidate(
        id: i.id,
        type: i.type == 'series' ? 'series' : 'movie',
        name: i.name,
        temp: i.temp,
      ),
    );
  }
  for (final c in local) {
    add(c);
  }
  for (final t in trakt) {
    final id = t.stremioId;
    if (id == null) continue;
    add(SavedCandidate(id: id, type: t.stremioType, name: t.title));
  }
  return byId.values.toList();
}

/// Resolves saved [candidates] to their [year]/[month] releases via TMDB,
/// Cinemeta, AniZip and TVmaze, de-duped by normalized name + date and sorted.
/// Ports `resolveSavedCalendar`.
Future<List<CalendarItem>> resolveSavedCalendar(
  List<SavedCandidate> candidates,
  int year,
  int month, {
  required TmdbClient tmdb,
  required AddonClient addon,
  required JsonTransport transport,
  required DateTime now,
}) async {
  bool inMonth(String iso) => calendarInMonth(iso, year, month);
  final wide = _wideWindow(now);

  final series = candidates.where((c) => c.type == 'series').toList()
    ..sort(_curatedFirst);
  final movies = candidates.where((c) => c.type == 'movie').toList()
    ..sort(_curatedFirst);
  final seriesTop = series.take(_seriesLimit).toList();
  final moviesTop = movies.take(_movieLimit).toList();

  final out = <CalendarItem>[];

  final seriesConc = tmdb.hasKey ? _tmdbConcurrency : _tvmazeConcurrency;
  final seriesResults = await _mapLimit(
    seriesTop,
    seriesConc,
    (c) async => (
      c: c,
      r: await _seriesUpcoming(
        c,
        wide,
        tmdb: tmdb,
        addon: addon,
        transport: transport,
      ),
    ),
  );
  for (final result in seriesResults) {
    final r = result.r;
    final c = result.c;
    if (r == null) continue;
    final showName = r.name.isNotEmpty ? r.name : c.name;
    for (final ep in r.episodes) {
      if (ep.season == 0 && ep.number == 0) continue;
      if (!inMonth(ep.airDate)) continue;
      final label = 'S${_pad(ep.season)}E${_pad(ep.number)}';
      out.add(
        CalendarItem(
          id: '${c.id}:${ep.season}:${ep.number}',
          imdbId: c.id.startsWith('tt') ? c.id.split(':').first : null,
          type: 'tv',
          name: ep.name.isNotEmpty
              ? '$showName $label: ${ep.name}'
              : '$showName $label',
          poster: ep.image ?? r.poster,
          releaseDate: ep.airDate,
          isAnime: r.isAnime,
          overview: ep.overview,
          voteAverage: ep.voteAverage,
        ),
      );
    }
  }

  final movieResults = await _mapLimit(
    moviesTop,
    _tmdbConcurrency,
    (c) => _movieRelease(c, wide, tmdb: tmdb, addon: addon),
  );
  for (final mi in movieResults) {
    if (mi != null && inMonth(mi.releaseDate)) out.add(mi);
  }

  final seen = <String>{};
  final deduped = <CalendarItem>[];
  final epRe = RegExp(r'\sS(\d+)E(\d+)', caseSensitive: false);
  for (final item in out) {
    final ep = epRe.firstMatch(item.name);
    final show = ep != null
        ? item.name.substring(0, item.name.indexOf(ep.group(0)!))
        : item.name;
    final norm = show.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '');
    final key = ep != null
        ? 'tv|$norm|s${int.parse(ep.group(1)!)}e${int.parse(ep.group(2)!)}|${item.releaseDate}'
        : 'movie|$norm|${item.releaseDate}';
    if (seen.add(key)) deduped.add(item);
  }
  deduped.sort((a, b) => a.releaseDate.compareTo(b.releaseDate));
  return deduped;
}
