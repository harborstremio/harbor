import '../calendar/tmdb_calendar.dart';
import '../catalog/tmdb.dart';
import '../catalog/tmdb_details.dart';

/// The still image + episode title for one watched episode, resolved from TMDB.
/// This is the enrichment behind the Library History episode card — the web
/// `history-episode-card.tsx` lazily fetches the season and pulls the matching
/// episode's `still` and `name`.
class HistoryEpisodeMeta {
  const HistoryEpisodeMeta({this.still, this.title});

  /// The episode still image (a `w500` TMDB URL), or null when TMDB has none.
  final String? still;

  /// The episode name, or null when TMDB has none / it is blank.
  final String? title;

  static const empty = HistoryEpisodeMeta();
}

/// Resolves [imdbId] — a `tt…` id, optionally suffixed `:season:episode` — to
/// its TMDB tv id and fetches [season]'s episodes. Returns the full list so a
/// caller can pick any episode; empty when there is no TMDB key, the id is not
/// an IMDb id, or it does not resolve. Ports the resolution the web
/// `fetchSeasonEpisodes` performs before matching an episode.
Future<List<Episode>> fetchHistorySeasonEpisodes(
  TmdbClient tmdb, {
  required String imdbId,
  required int season,
}) async {
  final ttId = imdbId.split(':').first;
  if (!ttId.startsWith('tt')) return const [];
  final tvId = (await tmdbFindByImdb(tmdb, ttId)).tvId;
  if (tvId == null) return const [];
  return tmdbSeasonEpisodes(tmdb, tvId, season);
}

/// The still URL + title of episode [episode] within [episodes], or
/// [HistoryEpisodeMeta.empty] when it is not present. Mirrors the web
/// `eps.find((e) => e.episode === entry.episode)` pick.
HistoryEpisodeMeta historyEpisodeMeta(List<Episode> episodes, int episode) {
  for (final e in episodes) {
    if (e.episodeNumber == episode) {
      return HistoryEpisodeMeta(
        still: e.stillPath == null ? null : '$tmdbImg/w500${e.stillPath}',
        title: e.name.isEmpty ? null : e.name,
      );
    }
  }
  return HistoryEpisodeMeta.empty;
}
