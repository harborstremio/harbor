import '../addons/models.dart';
import '../anilist/anilist_relations.dart';
import 'kitsu_client.dart';

/// One title in an anime franchise (the current entry plus its related seasons,
/// movies and side stories). Ported from `FranchiseEntry`.
class FranchiseEntry {
  FranchiseEntry({
    required this.meta,
    required this.year,
    required this.isCurrent,
    required this.isUpcoming,
    this.startDate,
    this.episodeCount,
    this.logo,
  });

  final MetaPreview meta;
  final int year;
  final String? startDate;
  final int? episodeCount;
  final bool isCurrent;
  final bool isUpcoming;

  /// The franchise logo, filled in from the detail extras after assembly.
  String? logo;
}

/// A short tag for a franchise entry — a numbered season or a movie. Ported
/// from `FranchiseTag`.
enum FranchiseTagKind { season, movie }

class FranchiseTag {
  const FranchiseTag({
    required this.kind,
    required this.seasonNum,
    required this.short,
  });

  final FranchiseTagKind kind;
  final int seasonNum;
  final String short;
}

/// Tags each franchise entry as a numbered season or a movie (a movie, or a
/// single-episode entry, breaks the season count). Ported 1:1 from
/// `franchiseTags`.
List<FranchiseTag> franchiseTags(List<FranchiseEntry> franchise) {
  var s = 0;
  final out = <FranchiseTag>[];
  for (final f in franchise) {
    if (f.meta.type == 'movie' || (f.episodeCount ?? 0) == 1) {
      out.add(
        const FranchiseTag(
          kind: FranchiseTagKind.movie,
          seasonNum: 0,
          short: 'MOV',
        ),
      );
    } else {
      s += 1;
      out.add(
        FranchiseTag(kind: FranchiseTagKind.season, seasonNum: s, short: 'S$s'),
      );
    }
  }
  return out;
}

const _ordinals = {
  'first': '1',
  'second': '2',
  'third': '3',
  'fourth': '4',
  'fifth': '5',
  'sixth': '6',
  'seventh': '7',
  'eighth': '8',
};
final _seasonNumRe = RegExp(
  r'(\d+)\s*(?:st|nd|rd|th)?\s*season|season\s*(\d+)',
);
final _seasonStripRe = RegExp(r'\d+\s*(?:st|nd|rd|th)?\s*season|season\s*\d+');
final _nonAlnumRe = RegExp('[^a-z0-9]+');

/// Normalises a franchise title into a dedup key, folding ordinal words to
/// digits and separating out the season number so "Show 2nd Season" and
/// "Show Season 2" collide. Ported from the `norm` helper in `buildFranchise`.
String normalizeFranchiseName(String s) {
  var x = s.trim().toLowerCase();
  _ordinals.forEach((word, digit) {
    x = x.replaceAll(RegExp('\\b$word\\b'), digit);
  });
  final m = _seasonNumRe.firstMatch(x);
  final num = m != null ? (m.group(1) ?? m.group(2) ?? '') : '';
  final base = x.replaceAll(_seasonStripRe, ' ').replaceAll(_nonAlnumRe, '');
  return num.isNotEmpty ? '$base#$num' : base;
}

/// Assembles an anime's franchise from Kitsu relations (breadth-first, up to
/// three hops through sequels, prequels and parent stories) merged with AniList
/// franchise relations, then de-duplicated by normalised title (best entry
/// wins) and ordered by start date. Ported from `buildFranchise`.
class AnimeFranchiseBuilder {
  AnimeFranchiseBuilder(
    this._kitsu,
    this._anilist, {
    DateTime Function() clock = DateTime.now,
  }) : _clock = clock;

  final KitsuClient _kitsu;
  final AnilistRelations _anilist;
  final DateTime Function() _clock;

  static const _franchiseRoles = {'sequel', 'prequel', 'parent_story'};
  static const _maxDepth = 3;

  Future<List<FranchiseEntry>> build(
    int rootId,
    KitsuAnimeDetail rootAnime,
  ) async {
    final now = _clock().millisecondsSinceEpoch;
    final anilistFuture = _guardNodes(_anilist.franchise(rootId));

    final items = <int, FranchiseEntry>{
      rootId: FranchiseEntry(
        meta: _makeFranchiseMeta(rootId, rootAnime),
        year: int.tryParse(rootAnime.year ?? '') ?? 0,
        startDate: rootAnime.startDate,
        episodeCount: rootAnime.episodeCount,
        isCurrent: true,
        isUpcoming: _isUpcoming(rootAnime, now),
      ),
    };

    final visited = <int>{rootId};
    var relatedWave = _kitsu
        .kitsuRelated(rootId)
        .then((related) => [(id: rootId, related: related)]);
    var depth = 0;
    while (depth < _maxDepth) {
      final relatedLists = await relatedWave;
      final newIds = <int>[];
      for (final entry in relatedLists) {
        for (final r in entry.related) {
          if (!_franchiseRoles.contains(r.role.toLowerCase())) continue;
          final m = parseKitsuId(r.meta.id);
          if (m == null || items.containsKey(m) || visited.contains(m)) {
            continue;
          }
          if (!newIds.contains(m)) newIds.add(m);
        }
      }
      if (newIds.isEmpty) break;
      visited.addAll(newIds);
      final nextWave = Future.wait(
        newIds.map(
          (id) => _kitsu.kitsuRelated(id).then((r) => (id: id, related: r)),
        ),
      );
      final animes = await Future.wait(newIds.map(_kitsu.kitsuAnime));
      final alive = <int>{};
      for (var i = 0; i < newIds.length; i++) {
        final id = newIds[i];
        final a = animes[i];
        if (a == null) continue;
        items[id] = FranchiseEntry(
          meta: _makeFranchiseMeta(id, a),
          year: int.tryParse(a.year ?? '') ?? 0,
          startDate: a.startDate,
          episodeCount: a.episodeCount,
          isCurrent: false,
          isUpcoming: _isUpcoming(a, now),
        );
        alive.add(id);
      }
      if (alive.isEmpty) break;
      relatedWave = nextWave.then(
        (lists) => [
          for (final l in lists)
            if (alive.contains(l.id)) l,
        ],
      );
      depth++;
    }

    final rootAnilist = await anilistFuture;
    final siblings = [
      for (final e in items.values)
        if (!e.isCurrent) e,
    ]..sort((a, b) => _yearKey(a.year).compareTo(_yearKey(b.year)));
    final siblingIds = <int>[];
    for (final e in siblings) {
      final k = parseKitsuId(e.meta.id);
      if (k != null) siblingIds.add(k);
    }
    final siblingBatches = await Future.wait(
      siblingIds.take(2).map((id) => _guardNodes(_anilist.franchise(id))),
    );

    final anilistById = <int, AnilistFranchiseNode>{};
    for (final n in [rootAnilist, ...siblingBatches].expand((x) => x)) {
      anilistById[n.id] = n;
    }
    final anilistEntries = [
      for (final n in anilistById.values)
        FranchiseEntry(
          meta: MetaPreview({
            'id': 'anilist:${n.id}',
            'type': n.type,
            'name': n.name,
            'poster': ?n.poster,
            'background': ?n.banner,
            'releaseInfo': ?(n.year != null ? '${n.year}' : null),
            'imdbRating': ?n.rating,
          }),
          year: n.year ?? 0,
          startDate: n.startDate,
          episodeCount: n.episodes,
          isCurrent: false,
          isUpcoming: n.upcoming,
        ),
    ];

    final byName = <String, FranchiseEntry>{};
    for (final e in [...items.values, ...anilistEntries]) {
      final key = normalizeFranchiseName(e.meta.name);
      if (key.isEmpty) continue;
      final prev = byName[key];
      if (prev == null || _score(e) > _score(prev)) byName[key] = e;
    }
    return byName.values.toList()..sort(
      (a, b) => (a.startDate ?? '9999').compareTo(b.startDate ?? '9999'),
    );
  }

  static int _yearKey(int year) => year == 0 ? 9999 : year;

  static int _score(FranchiseEntry e) =>
      (e.isCurrent ? 1000 : 0) +
      (e.meta.id.startsWith('kitsu:') ? 4 : 0) +
      ((e.startDate?.isNotEmpty ?? false) ? 2 : 0) +
      ((e.episodeCount ?? 0) > 0 ? 1 : 0);

  static MetaPreview _makeFranchiseMeta(int id, KitsuAnimeDetail anime) =>
      MetaPreview({
        'id': 'kitsu:$id',
        'type': anime.subtype == 'movie' ? 'movie' : 'series',
        'name': anime.title,
        'poster': ?anime.poster,
        'background': ?anime.backdrop,
        'description': anime.synopsis,
        'releaseInfo': ?anime.year,
        'imdbRating': ?anime.rating,
      });

  static bool _isUpcoming(KitsuAnimeDetail? anime, int now) {
    if (anime == null) return false;
    final status = (anime.status ?? '').toLowerCase();
    if (status == 'unreleased' || status == 'upcoming' || status == 'tba') {
      return true;
    }
    final sd = anime.startDate;
    if (sd != null) {
      final t = DateTime.tryParse(sd)?.millisecondsSinceEpoch;
      if (t != null && t > now) return true;
    }
    return false;
  }

  static Future<List<AnilistFranchiseNode>> _guardNodes(
    Future<List<AnilistFranchiseNode>> f,
  ) async {
    try {
      return await f;
    } catch (_) {
      return const [];
    }
  }
}
