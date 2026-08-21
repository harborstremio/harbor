import '../addons/models.dart';
import 'tmdb.dart';
import 'tmdb_collection.dart'
    show TmdbCollection, fetchTmdbCollection, tmdbSearchCollectionId;

/// Where a Kids franchise's titles come from. Ported 1:1 from the web
/// `Franchise["source"]` union.
sealed class FranchiseSource {
  const FranchiseSource();
}

/// One or more TMDB collections, looked up by name.
class CollectionSource extends FranchiseSource {
  const CollectionSource(this.queries);
  final List<String> queries;
}

/// A TMDB keyword, discovered across movies and TV.
class KeywordSource extends FranchiseSource {
  const KeywordSource(this.keyword);
  final String keyword;
}

/// A hand-listed title (searched by name/year), for franchises TMDB does not
/// model as a collection (e.g. Pokémon).
class ManualItem {
  const ManualItem({required this.type, required this.query, this.year});

  /// `movie` or `series`.
  final String type;
  final String query;
  final int? year;
}

/// A fixed list of manual titles.
class ManualSource extends FranchiseSource {
  const ManualSource(this.items);
  final List<ManualItem> items;
}

/// A kid-friendly franchise tile. Ported 1:1 from the web `Franchise`.
class Franchise {
  const Franchise({
    required this.key,
    required this.name,
    required this.grad,
    required this.source,
    this.drop,
  });

  final String key;
  final String name;

  /// The Tailwind gradient descriptor the tile renders (e.g.
  /// `from-sky-400 via-sky-300 to-amber-300`), parsed by the view layer. The
  /// tile's character art is `assets/kids/cta/<key>.webp`.
  final String grad;
  final FranchiseSource source;

  /// Optional bottom offset (percent) nudging the character art downward.
  final int? drop;
}

/// The curated Kids franchises, ported 1:1 from `KIDS_FRANCHISES`.
const List<Franchise> kKidsFranchises = [
  Franchise(
    key: 'toy-story',
    name: 'Toy Story',
    grad: 'from-sky-400 via-sky-300 to-amber-300',
    source: CollectionSource(['Toy Story Collection']),
  ),
  Franchise(
    key: 'frozen',
    name: 'Frozen',
    grad: 'from-cyan-300 via-sky-300 to-indigo-400',
    source: CollectionSource(['Frozen Collection']),
  ),
  Franchise(
    key: 'minions',
    name: 'Minions',
    grad: 'from-yellow-300 via-amber-300 to-blue-500',
    source: CollectionSource([
      'Despicable Me Collection',
      'Minions Collection',
    ]),
  ),
  Franchise(
    key: 'shrek',
    name: 'Shrek',
    grad: 'from-lime-500 via-green-600 to-emerald-700',
    source: CollectionSource(['Shrek Collection', 'Puss in Boots Collection']),
  ),
  Franchise(
    key: 'cars',
    name: 'Cars',
    grad: 'from-red-500 via-orange-500 to-amber-400',
    source: CollectionSource(['Cars Collection']),
  ),
  Franchise(
    key: 'httyd',
    name: 'How to Train Your Dragon',
    grad: 'from-teal-500 via-cyan-600 to-violet-600',
    source: CollectionSource(['How to Train Your Dragon Collection']),
  ),
  Franchise(
    key: 'kung-fu-panda',
    name: 'Kung Fu Panda',
    grad: 'from-emerald-500 via-green-600 to-amber-400',
    source: CollectionSource(['Kung Fu Panda Collection']),
  ),
  Franchise(
    key: 'incredibles',
    name: 'The Incredibles',
    grad: 'from-red-600 via-rose-500 to-orange-500',
    source: CollectionSource(['The Incredibles Collection']),
  ),
  Franchise(
    key: 'madagascar',
    name: 'Madagascar',
    grad: 'from-green-500 via-lime-500 to-amber-300',
    source: CollectionSource([
      'Madagascar Collection',
      'Penguins of Madagascar Collection',
    ]),
  ),
  Franchise(
    key: 'ice-age',
    name: 'Ice Age',
    grad: 'from-sky-300 via-cyan-300 to-blue-400',
    source: CollectionSource(['Ice Age Collection']),
  ),
  Franchise(
    key: 'sonic',
    name: 'Sonic',
    grad: 'from-blue-600 via-blue-500 to-sky-400',
    source: CollectionSource(['Sonic the Hedgehog Collection']),
  ),
  Franchise(
    key: 'hotel-t',
    name: 'Hotel Transylvania',
    grad: 'from-purple-700 via-violet-600 to-fuchsia-500',
    source: CollectionSource(['Hotel Transylvania Collection']),
    drop: 18,
  ),
  Franchise(
    key: 'pokemon',
    name: 'Pokemon',
    grad: 'from-red-500 via-rose-500 to-yellow-400',
    source: ManualSource([
      ManualItem(type: 'series', query: 'Pokémon', year: 1997),
      ManualItem(
        type: 'series',
        query: 'Pokémon Horizons: The Series',
        year: 2023,
      ),
      ManualItem(type: 'series', query: 'Pokémon Concierge', year: 2023),
      ManualItem(type: 'movie', query: 'Pokémon Detective Pikachu', year: 2019),
      ManualItem(type: 'movie', query: 'Pokémon: The First Movie', year: 1998),
      ManualItem(type: 'movie', query: 'Pokémon: The Movie 2000', year: 1999),
      ManualItem(type: 'movie', query: 'Pokémon 3: The Movie', year: 2000),
      ManualItem(type: 'movie', query: 'Pokémon 4Ever', year: 2001),
      ManualItem(type: 'movie', query: 'Pokémon Heroes', year: 2002),
      ManualItem(
        type: 'movie',
        query: 'Pokémon: Jirachi Wish Maker',
        year: 2003,
      ),
      ManualItem(type: 'movie', query: 'Pokémon: Destiny Deoxys', year: 2004),
      ManualItem(
        type: 'movie',
        query: 'Pokémon: Lucario and the Mystery of Mew',
        year: 2005,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon: The Rise of Darkrai',
        year: 2007,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon: Giratina and the Sky Warrior',
        year: 2008,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon: Arceus and the Jewel of Life',
        year: 2009,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon the Movie: White - Victini and Zekrom',
        year: 2011,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon the Movie: Kyurem vs. the Sword of Justice',
        year: 2012,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon the Movie: Genesect and the Legend Awakened',
        year: 2013,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon the Movie: Diancie and the Cocoon of Destruction',
        year: 2014,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon the Movie: Hoopa and the Clash of Ages',
        year: 2015,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon the Movie: I Choose You!',
        year: 2017,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon the Movie: The Power of Us',
        year: 2018,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon: Mewtwo Strikes Back - Evolution',
        year: 2019,
      ),
      ManualItem(
        type: 'movie',
        query: 'Pokémon: Secrets of the Jungle',
        year: 2020,
      ),
    ]),
  ),
  Franchise(
    key: 'lego',
    name: 'LEGO',
    grad: 'from-red-500 via-amber-400 to-yellow-400',
    source: KeywordSource('lego'),
  ),
];

/// The kid-safe constraints applied to keyword discovery, ported from
/// `KEYWORD_KID`.
const Map<String, String> _keywordKid = {
  'without_genres': '27,53',
  'include_adult': 'false',
};

/// A paged fetcher of a franchise's titles.
typedef FranchiseFetcher = Future<List<MetaPreview>> Function(int page);

/// Builds the fetcher for [f], ported 1:1 from `franchiseFetcher`:
///
/// - **collection**: resolve each collection name to its id, fetch each, and
///   union their parts release-sorted (only page 1 has results).
/// - **manual**: search each listed title by name/year, union release-sorted
///   (only page 1 has results).
/// - **keyword**: resolve the keyword id, then discover kid-safe movies and TV
///   with that keyword, unioned per page.
FranchiseFetcher franchiseFetcher(TmdbClient client, Franchise f) {
  final source = f.source;
  if (source is CollectionSource) {
    return (page) async {
      if (page > 1) return const [];
      final ids = await Future.wait(
        source.queries.map(
          (q) => tmdbSearchCollectionId(client, q).catchError((_) => null),
        ),
      );
      final cols = await Future.wait(
        ids.map(
          (id) => id == null
              ? Future<TmdbCollection?>.value(null)
              : fetchTmdbCollection(client, id).catchError((_) => null),
        ),
      );
      final seen = <String>{};
      final out = <MetaPreview>[];
      for (final col in cols) {
        for (final m in col?.parts ?? const <MetaPreview>[]) {
          if (seen.add(m.id)) out.add(m);
        }
      }
      out.sort(
        (a, b) => (a.releaseDate ?? 'zzz').compareTo(b.releaseDate ?? 'zzz'),
      );
      return out;
    };
  }
  if (source is ManualSource) {
    return (page) async {
      if (page > 1) return const [];
      final found = await Future.wait(
        source.items.map(
          (it) => client
              .searchTitle(it.type, it.query, year: it.year)
              .catchError((_) => null),
        ),
      );
      final seen = <String>{};
      final out = <MetaPreview>[];
      for (final m in found) {
        if (m != null && seen.add(m.id)) out.add(m);
      }
      out.sort(
        (a, b) => (a.releaseDate ?? 'zzz').compareTo(b.releaseDate ?? 'zzz'),
      );
      return out;
    };
  }
  final keyword = (source as KeywordSource).keyword;
  return (page) async {
    final p = page < 1 ? 1 : page;
    final id = await client.keywordId(keyword);
    if (id == null) return const [];
    final base = {
      'sort_by': 'popularity.desc',
      'vote_count.gte': '1',
      'page': '$p',
      ..._keywordKid,
    };
    final lists = await Future.wait([
      client
          .discover('movie', {'with_keywords': '$id', ...base})
          .catchError((_) => <MetaPreview>[]),
      client
          .discover('tv', {'with_keywords': '$id', ...base})
          .catchError((_) => <MetaPreview>[]),
    ]);
    final seen = <String>{};
    final out = <MetaPreview>[];
    for (final m in [...lists[0], ...lists[1]]) {
      if (seen.add(m.id)) out.add(m);
    }
    return out;
  };
}
