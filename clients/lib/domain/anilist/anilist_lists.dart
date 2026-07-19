import 'dart:convert';

import '../../core/storage/kv_store.dart';
import 'anilist_client.dart';

/// A title on the user's AniList anime lists, ported from the `media` block of
/// the web `MediaListCollection` query.
class AnilistListMedia {
  const AnilistListMedia({
    required this.id,
    this.idMal,
    required this.title,
    this.coverImage,
    this.bannerImage,
    this.format,
    this.episodes,
    this.averageScore,
    this.seasonYear,
  });

  final int id;
  final int? idMal;
  final String title;
  final String? coverImage;
  final String? bannerImage;
  final String? format;
  final int? episodes;
  final int? averageScore;
  final int? seasonYear;

  Map<String, dynamic> toJson() => {
    'id': id,
    if (idMal != null) 'idMal': idMal,
    'title': title,
    if (coverImage != null) 'coverImage': coverImage,
    if (bannerImage != null) 'bannerImage': bannerImage,
    if (format != null) 'format': format,
    if (episodes != null) 'episodes': episodes,
    if (averageScore != null) 'averageScore': averageScore,
    if (seasonYear != null) 'seasonYear': seasonYear,
  };

  factory AnilistListMedia.fromJson(Map<String, dynamic> j) => AnilistListMedia(
    id: (j['id'] as num?)?.toInt() ?? 0,
    idMal: (j['idMal'] as num?)?.toInt(),
    title: j['title']?.toString() ?? '',
    coverImage: j['coverImage']?.toString(),
    bannerImage: j['bannerImage']?.toString(),
    format: j['format']?.toString(),
    episodes: (j['episodes'] as num?)?.toInt(),
    averageScore: (j['averageScore'] as num?)?.toInt(),
    seasonYear: (j['seasonYear'] as num?)?.toInt(),
  );
}

/// One media-list entry — the user's status/progress on a title.
class AnilistMediaEntry {
  const AnilistMediaEntry({
    this.entryId,
    this.status,
    required this.progress,
    this.score,
    required this.media,
  });

  final int? entryId;

  /// `CURRENT` | `COMPLETED` | `PAUSED` | `DROPPED` | `PLANNING` | `REPEATING`.
  final String? status;
  final int progress;
  final double? score;
  final AnilistListMedia media;

  AnilistMediaEntry copyWith({String? status, int? progress}) =>
      AnilistMediaEntry(
        entryId: entryId,
        status: status ?? this.status,
        progress: progress ?? this.progress,
        score: score,
        media: media,
      );

  Map<String, dynamic> toJson() => {
    if (entryId != null) 'id': entryId,
    if (status != null) 'status': status,
    'progress': progress,
    if (score != null) 'score': score,
    'media': media.toJson(),
  };

  factory AnilistMediaEntry.fromJson(Map<String, dynamic> j) =>
      AnilistMediaEntry(
        entryId: (j['id'] as num?)?.toInt(),
        status: j['status']?.toString(),
        progress: (j['progress'] as num?)?.toInt() ?? 0,
        score: (j['score'] as num?)?.toDouble(),
        media: AnilistListMedia.fromJson(
          (j['media'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
      );
}

/// A status bucket of entries (Watching / Completed / …).
class AnilistListGroup {
  const AnilistListGroup({required this.status, required this.entries});
  final String status;
  final List<AnilistMediaEntry> entries;

  Map<String, dynamic> toJson() => {
    'status': status,
    'entries': [for (final e in entries) e.toJson()],
  };

  factory AnilistListGroup.fromJson(Map<String, dynamic> j) => AnilistListGroup(
    status: j['status']?.toString() ?? '',
    entries: [
      for (final e in (j['entries'] as List? ?? const []))
        if (e is Map) AnilistMediaEntry.fromJson(e.cast<String, dynamic>()),
    ],
  );
}

String _pickTitle(Map<dynamic, dynamic> t) =>
    (t['userPreferred'] ?? t['english'] ?? t['romaji'] ?? t['native'] ?? '')
        .toString();

AnilistMediaEntry _parseEntry(Map<dynamic, dynamic> raw) {
  final m = (raw['media'] as Map?) ?? const {};
  final title = (m['title'] as Map?) ?? const {};
  final cover = (m['coverImage'] as Map?) ?? const {};
  return AnilistMediaEntry(
    entryId: (raw['id'] as num?)?.toInt(),
    status: raw['status']?.toString(),
    progress: (raw['progress'] as num?)?.toInt() ?? 0,
    score: (raw['score'] as num?)?.toDouble(),
    media: AnilistListMedia(
      id: (m['id'] as num?)?.toInt() ?? 0,
      idMal: (m['idMal'] as num?)?.toInt(),
      title: _pickTitle(title),
      coverImage: (cover['extraLarge'] ?? cover['large'] ?? cover['medium'])
          ?.toString(),
      bannerImage: m['bannerImage']?.toString(),
      format: m['format']?.toString(),
      episodes: (m['episodes'] as num?)?.toInt(),
      averageScore: (m['averageScore'] as num?)?.toInt(),
      seasonYear: (m['seasonYear'] as num?)?.toInt(),
    ),
  );
}

/// Buckets the raw `MediaListCollection.lists` by status, skipping custom lists
/// and de-duping a title that appears in more than one list. Preserves the order
/// statuses first appear. Ported 1:1 from the web `buildGroups`.
List<AnilistListGroup> buildAnilistGroups(List<dynamic> lists) {
  final byStatus = <String, List<AnilistMediaEntry>>{};
  final order = <String>[];
  final seen = <int>{};
  for (final g in lists) {
    if (g is! Map) continue;
    if (g['isCustomList'] == true) continue;
    final status = g['status']?.toString();
    if (status == null || status.isEmpty) continue;
    final bucket = byStatus.putIfAbsent(status, () {
      order.add(status);
      return <AnilistMediaEntry>[];
    });
    for (final e in (g['entries'] as List? ?? const [])) {
      if (e is! Map) continue;
      final entry = _parseEntry(e);
      if (seen.contains(entry.media.id)) continue;
      seen.add(entry.media.id);
      bucket.add(entry);
    }
  }
  return [
    for (final s in order) AnilistListGroup(status: s, entries: byStatus[s]!),
  ];
}

const _collectionQuery =
    r'query ($userId: Int) { MediaListCollection(userId: $userId, type: ANIME) '
    r'{ lists { status isCustomList entries { id status progress score '
    r'media { id idMal title { romaji english native userPreferred } '
    r'coverImage { extraLarge large medium } bannerImage format episodes '
    r'averageScore seasonYear } } } } }';

/// Fetches and groups the user's AniList anime lists. Ported from the web
/// `fetchMediaListCollection`; the caller supplies the resolved access token.
Future<List<AnilistListGroup>> fetchAnilistMediaListCollection(
  AnilistClient client,
  int userId, {
  String? accessToken,
}) async {
  final data = await client.request(
    _collectionQuery,
    variables: {'userId': userId},
    accessToken: accessToken,
  );
  final coll = data?['MediaListCollection'];
  final lists = coll is Map ? (coll['lists'] as List? ?? const []) : const [];
  return buildAnilistGroups(lists);
}

/// Local cache of a user's grouped collection (`harbor.anilist.collection.v1.*`),
/// so the AniList tab renders instantly and survives an offline launch. Ported
/// from `readCachedCollection`/`writeCachedCollection`.
class AnilistCollectionCache {
  AnilistCollectionCache(this._kv);
  final KvStore _kv;
  static const _prefix = 'harbor.anilist.collection.v1.';

  String _key(int userId) => '$_prefix$userId';

  List<AnilistListGroup>? read(int userId) {
    final raw = _kv.getString(_key(userId));
    if (raw == null || raw.isEmpty) return null;
    try {
      final parsed = jsonDecode(raw);
      final groups = parsed is Map ? parsed['groups'] : null;
      if (groups is! List) return null;
      return [
        for (final g in groups)
          if (g is Map) AnilistListGroup.fromJson(g.cast<String, dynamic>()),
      ];
    } catch (_) {
      return null;
    }
  }

  Future<void> write(int userId, List<AnilistListGroup> groups) =>
      _kv.setString(
        _key(userId),
        jsonEncode({
          'groups': [for (final g in groups) g.toJson()],
        }),
      );
}
