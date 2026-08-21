import '../anime/anime_mapping.dart';
import 'anilist_client.dart';

const _relationsQuery = r'''query ($id: Int) {
  Media(id: $id, type: ANIME) {
    relations {
      edges {
        relationType(version: 2)
        node {
          id
          format
          episodes
          status
          averageScore
          seasonYear
          title { english romaji userPreferred }
          coverImage { large }
          bannerImage
          startDate { year month day }
        }
      }
    }
  }
}''';

const _franchiseRelations = {'SEQUEL', 'PREQUEL', 'PARENT', 'SIDE_STORY'};
const _maxDepth = 6;
const _maxNodes = 40;

/// One related entry in an anime franchise. Ported from `AnilistFranchiseNode`.
class AnilistFranchiseNode {
  const AnilistFranchiseNode({
    required this.id,
    required this.name,
    required this.type,
    required this.upcoming,
    this.poster,
    this.banner,
    this.episodes,
    this.year,
    this.startDate,
    this.rating,
  });

  final int id;
  final String name;

  /// `movie` or `series`.
  final String type;
  final bool upcoming;
  final String? poster;
  final String? banner;
  final int? episodes;
  final int? year;
  final String? startDate;
  final String? rating;
}

typedef _Edge = ({String? relationType, Map<String, dynamic>? node});

/// Walks the AniList relation graph to assemble an anime's franchise —
/// sequels, prequels, parents and side stories — breadth-first from the title's
/// AniList id, bounded by depth and node count. Ported from `anilistFranchise`.
/// Per-id relation edges are cached for the process lifetime.
class AnilistRelations {
  AnilistRelations(this._client, this._mapper);

  final AnilistClient _client;
  final AnimeMapper _mapper;

  final Map<int, List<_Edge>> _edgeCache = {};

  Future<List<AnilistFranchiseNode>> franchise(int kitsuId) async {
    final root = await _guard(_mapper.kitsuToAnilist(kitsuId));
    if (root == null) return const [];

    final out = <int, AnilistFranchiseNode>{};
    final visited = <int>{root};
    var frontier = <int>[root];
    var depth = 0;
    while (frontier.isNotEmpty && depth < _maxDepth && out.length < _maxNodes) {
      final batches = await Future.wait(frontier.map(_fetchEdges));
      final next = <int>[];
      for (final edges in batches) {
        for (final e in edges) {
          final rt = e.relationType;
          if (rt == null || !_franchiseRelations.contains(rt)) continue;
          final node = e.node;
          final id = (node?['id'] as num?)?.toInt();
          if (node == null || id == null || visited.contains(id)) continue;
          visited.add(id);
          final fn = _toNode(node);
          if (fn.name.isNotEmpty) out[id] = fn;
          next.add(id);
        }
      }
      frontier = next;
      depth++;
    }
    return out.values.toList();
  }

  Future<List<_Edge>> _fetchEdges(int anilistId) async {
    final cached = _edgeCache[anilistId];
    if (cached != null) return cached;
    try {
      final data = await _client.request(
        _relationsQuery,
        variables: {'id': anilistId},
        skipAuth: true,
      );
      final edges = _parseEdges(data);
      _edgeCache[anilistId] = edges;
      return edges;
    } catch (_) {
      _edgeCache[anilistId] = const [];
      return const [];
    }
  }

  static List<_Edge> _parseEdges(Map<String, dynamic>? data) {
    final media = data?['Media'];
    final relations = (media is Map) ? media['relations'] : null;
    final edges = (relations is Map) ? relations['edges'] : null;
    if (edges is! List) return const [];
    return [
      for (final e in edges)
        if (e is Map)
          (
            relationType: e['relationType'] as String?,
            node: e['node'] is Map
                ? (e['node'] as Map).cast<String, dynamic>()
                : null,
          ),
    ];
  }

  static AnilistFranchiseNode _toNode(Map<String, dynamic> n) {
    final title = (n['title'] as Map?) ?? const {};
    final name =
        ((title['english'] as String?) ??
                (title['romaji'] as String?) ??
                (title['userPreferred'] as String?) ??
                '')
            .trim();
    final coverImage = n['coverImage'] as Map?;
    final startDate = n['startDate'] as Map?;
    final averageScore = (n['averageScore'] as num?);
    return AnilistFranchiseNode(
      id: (n['id'] as num?)?.toInt() ?? 0,
      name: name,
      type: n['format'] == 'MOVIE' ? 'movie' : 'series',
      poster: coverImage?['large'] as String?,
      banner: n['bannerImage'] as String?,
      episodes: (n['episodes'] as num?)?.toInt(),
      year:
          (n['seasonYear'] as num?)?.toInt() ??
          (startDate?['year'] as num?)?.toInt(),
      startDate: _fmtDate(startDate),
      rating: (averageScore != null && averageScore > 0)
          ? (averageScore / 10).toStringAsFixed(1)
          : null,
      upcoming: n['status'] == 'NOT_YET_RELEASED',
    );
  }

  static String? _fmtDate(Map? d) {
    final year = (d?['year'] as num?)?.toInt();
    if (year == null || year == 0) return null;
    final mm = ((d?['month'] as num?)?.toInt() ?? 1).toString().padLeft(2, '0');
    final dd = ((d?['day'] as num?)?.toInt() ?? 1).toString().padLeft(2, '0');
    return '$year-$mm-$dd';
  }

  static Future<T?> _guard<T>(Future<T> f) async {
    try {
      return await f;
    } catch (_) {
      return null;
    }
  }
}
