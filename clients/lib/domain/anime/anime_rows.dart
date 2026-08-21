import '../addons/models.dart';
import 'jikan.dart' show kJikanGenres;
import 'jikan_client.dart';

/// How a row's pool is treated by the view — a plain row, a genre row (folded
/// into the genre picker), or an era row.
enum AnimeRowPool { normal, genre, era }

/// One anime row's identity and its paged Jikan fetcher. Ported from the `Spec`
/// entries in `anime-rows.tsx`.
class AnimeRowSpec {
  const AnimeRowSpec({
    required this.key,
    required this.title,
    required this.fetcher,
    this.rank = false,
    this.pool = AnimeRowPool.normal,
  });

  final String key;
  final String title;
  final Future<List<MetaPreview>> Function(int page) fetcher;

  /// Rendered as a ranked (numbered) row.
  final bool rank;
  final AnimeRowPool pool;
}

/// The rows that seed the anime hero.
const Set<String> kAnimeHeroKeys = {
  'airing',
  'top-airing',
  'upcoming',
  'popular',
};

/// The row whose pool backs the taste-ranked top-picks strip.
const String kAnimeTopPicksKey = 'top-airing';

const int kAnimeRowMinVisible = 12;
const int kAnimeRowMaxPages = 5;

int _genre(String name) => kJikanGenres[name]!;

/// The anime rows, bound to a [jikan] client. Ported 1:1 from `SPECS`.
List<AnimeRowSpec> animeRowSpecs(JikanClient jikan) => [
  AnimeRowSpec(key: 'airing', title: 'Airing Now', fetcher: jikan.airingNow),
  AnimeRowSpec(
    key: 'top-airing',
    title: 'Top Airing on MAL',
    fetcher: jikan.topAiring,
    rank: true,
  ),
  AnimeRowSpec(
    key: 'upcoming',
    title: 'Upcoming Season',
    fetcher: jikan.upcoming,
  ),
  AnimeRowSpec(
    key: 'top-tv',
    title: 'Top Series on MAL',
    fetcher: jikan.topTv,
    rank: true,
  ),
  AnimeRowSpec(
    key: 'top-movies',
    title: 'Top Movies on MAL',
    fetcher: jikan.topMovies,
  ),
  AnimeRowSpec(
    key: 'popular',
    title: 'Most Popular on MAL',
    fetcher: jikan.topPopular,
  ),
  AnimeRowSpec(
    key: 'all-time',
    title: 'Top Rated on MAL',
    fetcher: jikan.topAnime,
  ),
  AnimeRowSpec(
    key: 'gems',
    title: 'Hidden Gems on MAL',
    fetcher: jikan.underratedGems,
  ),
  AnimeRowSpec(
    key: 'era-2020s',
    title: '2020s Hits',
    pool: AnimeRowPool.era,
    fetcher: (p) => jikan.byEra('2020-01-01', '2029-12-31', p),
  ),
  AnimeRowSpec(
    key: 'era-2010s',
    title: '2010s Classics',
    pool: AnimeRowPool.era,
    fetcher: (p) => jikan.byEra('2010-01-01', '2019-12-31', p),
  ),
  AnimeRowSpec(
    key: 'era-2000s',
    title: '2000s Era',
    pool: AnimeRowPool.era,
    fetcher: (p) => jikan.byEra('2000-01-01', '2009-12-31', p),
  ),
  AnimeRowSpec(
    key: 'era-1990s',
    title: 'Foundation Years (90s)',
    pool: AnimeRowPool.era,
    fetcher: (p) => jikan.byEra('1990-01-01', '1999-12-31', p),
  ),
  AnimeRowSpec(
    key: 'genre-action',
    title: 'Action & Adventure',
    pool: AnimeRowPool.genre,
    fetcher: (p) => jikan.byGenre(_genre('Action'), p),
  ),
  AnimeRowSpec(
    key: 'genre-romance',
    title: 'Romance',
    pool: AnimeRowPool.genre,
    fetcher: (p) => jikan.byGenre(_genre('Romance'), p),
  ),
  AnimeRowSpec(
    key: 'genre-slice',
    title: 'Slice of Life',
    pool: AnimeRowPool.genre,
    fetcher: (p) => jikan.byGenre(_genre('SliceOfLife'), p),
  ),
  AnimeRowSpec(
    key: 'genre-mecha',
    title: 'Mecha',
    pool: AnimeRowPool.genre,
    fetcher: (p) => jikan.byGenre(_genre('Mecha'), p),
  ),
  AnimeRowSpec(
    key: 'genre-fantasy',
    title: 'Fantasy',
    pool: AnimeRowPool.genre,
    fetcher: (p) => jikan.byGenre(_genre('Fantasy'), p),
  ),
  AnimeRowSpec(
    key: 'genre-scifi',
    title: 'Sci-Fi',
    pool: AnimeRowPool.genre,
    fetcher: (p) => jikan.byGenre(_genre('SciFi'), p),
  ),
  AnimeRowSpec(
    key: 'genre-psych',
    title: 'Psychological',
    pool: AnimeRowPool.genre,
    fetcher: (p) => jikan.byGenre(_genre('Psychological'), p),
  ),
  AnimeRowSpec(
    key: 'genre-horror',
    title: 'Horror & Supernatural',
    pool: AnimeRowPool.genre,
    fetcher: (p) => jikan.byGenre(_genre('Horror'), p),
  ),
];
