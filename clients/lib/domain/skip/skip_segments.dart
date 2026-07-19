import '../../core/http/json_transport.dart';
import '../player/player_models.dart';
import 'chapters_to_segments.dart';
import 'skip_segment.dart';

/// Fetches and assembles skip segments, ported from `src/lib/skip-intro`
/// (`docs/50` §15). Merges (priority order) ad segments, TheIntroDB, and
/// chapter-derived segments, then applies the shared filters. The AniSkip anime
/// source layers in with the Simkl mapping cache.
class SkipSegmentsFetcher {
  SkipSegmentsFetcher(this._transport);

  static const _introDbBase = 'https://api.theintrodb.org/v2/media';

  final JsonTransport _transport;

  /// Builds the merged, filtered segment list for a title.
  Future<List<SkipSegment>> fetch({
    required String metaId,
    String? imdbId,
    int? season,
    int? episode,
    required double durationSec,
    List<Chapter> chapters = const [],
    List<SkipSegment> adSegments = const [],
  }) async {
    final introDbId = _introDbId(metaId, imdbId);
    final introDb = introDbId != null
        ? await fetchIntroDb(
            introDbId,
            season: season,
            episode: episode,
            durationSec: durationSec,
          )
        : <SkipSegment>[];
    final fromChapters = chaptersToSegments(chapters, durationSec);
    final merged = mergeSegments([adSegments, introDb, fromChapters]);
    return filterSegments(merged, durationSec);
  }

  static String? _introDbId(String metaId, String? imdbId) {
    if (metaId.startsWith('tt') || metaId.startsWith('tmdb:')) return metaId;
    if (imdbId != null && imdbId.startsWith('tt')) return imdbId;
    return null;
  }

  /// Fetches TheIntroDB spans (intro/recap/credits/preview) for [metaId].
  Future<List<SkipSegment>> fetchIntroDb(
    String metaId, {
    int? season,
    int? episode,
    required double durationSec,
  }) async {
    final ids = _pickId(metaId);
    if (ids == null) return const [];
    final params = <String>[
      if (ids.$1 == 'tmdb') 'tmdb_id=${ids.$2}' else 'imdb_id=${ids.$2}',
      if (season != null && episode != null) 'season=$season',
      if (season != null && episode != null) 'episode=$episode',
    ].join('&');

    Map<String, dynamic> json;
    try {
      final res = await _transport.getJson('$_introDbBase?$params');
      if (!res.ok || res.data is! Map) return const [];
      json = (res.data as Map).cast<String, dynamic>();
    } on TransportException {
      return const [];
    }

    final out = <SkipSegment>[];
    void collect(String field, SkipKind kind) {
      final spans = json[field];
      if (spans is! List) return;
      for (final s in spans.whereType<Map>()) {
        final seg = _spanToSegment(
          s.cast<String, dynamic>(),
          kind,
          durationSec,
        );
        if (seg != null) out.add(seg);
      }
    }

    collect('intro', SkipKind.intro);
    collect('recap', SkipKind.recap);
    collect('credits', SkipKind.outro);
    collect('preview', SkipKind.outro);
    out.sort((a, b) => a.startSec.compareTo(b.startSec));
    return out;
  }

  static (String, String)? _pickId(String metaId) {
    if (metaId.startsWith('tmdb:movie:')) {
      return ('tmdb', metaId.substring('tmdb:movie:'.length));
    }
    if (metaId.startsWith('tmdb:tv:')) {
      return ('tmdb', metaId.substring('tmdb:tv:'.length));
    }
    if (metaId.startsWith('tt')) return ('imdb', metaId);
    return null;
  }

  static SkipSegment? _spanToSegment(
    Map<String, dynamic> span,
    SkipKind kind,
    double durationSec,
  ) {
    final startMs = (span['start_ms'] as num?)?.toDouble() ?? 0;
    final endMs =
        (span['end_ms'] as num?)?.toDouble() ??
        (durationSec > 0 ? (durationSec * 1000).roundToDouble() : null);
    if (endMs == null || endMs <= startMs) return null;
    return SkipSegment(
      kind: kind,
      startSec: startMs / 1000,
      endSec: endMs / 1000,
      source: SkipSource.introdb,
    );
  }
}
