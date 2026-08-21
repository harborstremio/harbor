import '../../core/http/json_transport.dart';
import '../addons/addon_url.dart';
import '../addons/models.dart';
import '../language/language_names.dart';
import 'models.dart';

/// Which subtitle providers to query (defaults match
/// `settings.subProvidersEnabled`).
class SubProviders {
  const SubProviders({
    this.opensubtitles = true,
    this.addons = true,
    this.wyzie = false,
  });
  final bool opensubtitles;
  final bool addons;
  final bool wyzie;
}

/// Searches subtitle providers and ranks the results, ported from
/// `src/lib/subtitles/search.ts` + `providers/opensubtitles-v3.ts`. Fans out to
/// OpenSubtitles v3 and the user's installed subtitle addons, then dedups and
/// interleaves by source with a preferred-language and stream-match ranking.
class SubtitleSearcher {
  SubtitleSearcher(this._transport);

  final JsonTransport _transport;

  static const _openSubtitlesEndpoints = [
    'https://opensubtitles.stremio.homes',
    'https://opensubtitles-v3.strem.io',
    'https://opensubtitles.strem.io',
  ];

  /// Fans out to the enabled providers, then dedups and ranks.
  Future<List<SubResult>> search(
    SubSearchQuery query, {
    SubProviders providers = const SubProviders(),
    List<InstalledAddon> addons = const [],
    List<String> preferredLangs = const [],
    SubStreamHints? hints,
  }) async {
    final tasks = <Future<List<SubResult>>>[];
    if (providers.opensubtitles) tasks.add(_searchOpenSubtitlesV3(query));
    if (providers.addons && addons.isNotEmpty) {
      tasks.add(_searchAddonSubtitles(addons, query));
    }
    final settled = await Future.wait(
      tasks.map((t) => t.catchError((_) => <SubResult>[])),
    );
    final all = [for (final list in settled) ...list];
    return _dedupAndRank(all, preferredLangs, hints);
  }

  Future<List<SubResult>> _searchOpenSubtitlesV3(SubSearchQuery q) async {
    final id = _openSubtitlesId(q);
    if (id == null) return const [];
    final isEpisode = q.season != null && q.episode != null;
    final type = isEpisode || id.contains(':') ? 'series' : 'movie';

    final results = await Future.wait(
      _openSubtitlesEndpoints.map(
        (base) => _fetchSubs('$base/subtitles/$type/$id.json'),
      ),
    );
    final seen = <String>{};
    final merged = <Map<String, dynamic>>[];
    for (final list in results) {
      for (final s in list) {
        final url = s['url']?.toString();
        if (url == null || url.isEmpty) continue;
        final key = '${s['lang']}|$url';
        if (seen.add(key)) merged.add(s);
      }
    }
    final perLang = <String, int>{};
    return merged.map((s) {
      final lang = normalizeLang(s['lang']?.toString());
      final n = (perLang[lang] ?? 0) + 1;
      perLang[lang] = n;
      final fmt = s['SubFormat']?.toString().toLowerCase();
      return SubResult(
        id: (s['id'] ?? 'os3:${s['url']}').toString(),
        url: s['url'].toString(),
        lang: lang,
        title: 'OpenSubtitles V3 #$n',
        source: SubSource.opensubtitles,
        format: (fmt != null && fmt.isNotEmpty) ? fmt : null,
        encoding: s['encoding']?.toString(),
        fps: s['fps'] as num?,
      );
    }).toList();
  }

  Future<List<SubResult>> _searchAddonSubtitles(
    List<InstalledAddon> addons,
    SubSearchQuery q,
  ) async {
    final id = q.stremioId ?? _openSubtitlesId(q);
    if (id == null) return const [];
    final type = (q.season != null && q.episode != null) || id.contains(':')
        ? 'series'
        : (q.type ?? 'movie');
    final extras = <CatalogExtra>[
      if (q.videoHash != null) CatalogExtra('videoHash', q.videoHash!),
      if (q.videoSize != null) CatalogExtra('videoSize', '${q.videoSize}'),
      if (q.filename != null) CatalogExtra('filename', q.filename!),
    ];

    final lists = await Future.wait(
      addons.where((a) => _acceptsSubtitles(a.manifest, type, id)).map((
        a,
      ) async {
        final url = subtitlesUrl(addonBase(a.transportUrl), type, id, extras);
        final subs = await _fetchSubs(url);
        return subs
            .map((s) {
              final fmt = s['SubFormat']?.toString().toLowerCase();
              return SubResult(
                id: (s['id'] ?? '${a.id}:${s['url']}').toString(),
                url: (s['url'] ?? '').toString(),
                lang: normalizeLang(s['lang']?.toString()),
                title: a.manifest?.name ?? 'Add-on',
                source: SubSource.addon,
                format: (fmt != null && fmt.isNotEmpty) ? fmt : null,
              );
            })
            .where((r) => r.url.isNotEmpty);
      }),
    );
    return [for (final l in lists) ...l];
  }

  Future<List<Map<String, dynamic>>> _fetchSubs(String url) async {
    try {
      final res = await _transport.getJson(
        url,
        headers: {'Accept': 'application/json'},
      );
      if (!res.ok || res.data is! Map) return const [];
      final list = (res.data as Map)['subtitles'];
      if (list is! List) return const [];
      return list
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .toList();
    } on TransportException {
      return const [];
    }
  }

  static String? _openSubtitlesId(SubSearchQuery q) {
    final imdb = q.imdbId;
    if (imdb == null || imdb.isEmpty) return null;
    var id = imdb.startsWith('tt') ? imdb : 'tt$imdb';
    if (q.season != null && q.episode != null && !id.contains(':')) {
      id = '$id:${q.season}:${q.episode}';
    }
    return id;
  }

  static bool _acceptsSubtitles(Manifest? m, String type, String id) {
    if (m == null) return false;
    final entries = m.resourceEntries;
    final objs = entries.where((r) => r.isObject && r.name == 'subtitles');
    if (objs.isNotEmpty) {
      return objs.any((r) {
        final typeOk = r.types.isEmpty || r.types.contains(type);
        final idOk = r.idPrefixes.isEmpty || r.idPrefixes.any(id.startsWith);
        return typeOk && idOk;
      });
    }
    if (!entries.any((r) => !r.isObject && r.name == 'subtitles')) return false;
    if (m.types.isNotEmpty && !m.types.contains(type)) return false;
    final prefixes = m.idPrefixes;
    return prefixes.isEmpty || prefixes.any(id.startsWith);
  }

  // --- dedup + rank ----------------------------------------------------------

  static List<SubResult> _dedupAndRank(
    List<SubResult> results,
    List<String> preferred,
    SubStreamHints? hints,
  ) {
    final seen = <String>{};
    final filtered = <SubResult>[];
    for (final r in results) {
      final key =
          '${normalizeLang(r.lang)}|${r.url}|${r.title ?? ''}|${r.format ?? ''}';
      if (seen.add(key)) filtered.add(r);
    }
    return _interleaveBySource(filtered, preferred, hints);
  }

  static List<SubResult> _interleaveBySource(
    List<SubResult> list,
    List<String> preferred,
    SubStreamHints? hints,
  ) {
    final buckets = <SubSource, List<SubResult>>{};
    for (final r in list) {
      buckets.putIfAbsent(r.source, () => []).add(r);
    }
    for (final arr in buckets.values) {
      arr.sort((a, b) {
        final la = langScore(a.lang, preferred);
        final lb = langScore(b.lang, preferred);
        if (la != lb) return lb - la;
        final sa = _streamMatchScore(a, hints);
        final sb = _streamMatchScore(b, hints);
        if (sa != sb) return sb - sa;
        final da = a.downloads ?? 0;
        final db = b.downloads ?? 0;
        if (da != db) return db - da;
        return (a.title ?? '').compareTo(b.title ?? '');
      });
    }
    final sourceOrder = buckets.keys.toList()
      ..sort((a, b) => b.priority - a.priority);

    final out = <SubResult>[];
    final used = <SubResult>{};
    void drain(bool Function(SubResult) predicate) {
      var depth = 0;
      var more = true;
      while (more) {
        more = false;
        for (final src in sourceOrder) {
          final bucket = buckets[src];
          if (bucket == null || depth >= bucket.length) continue;
          final item = bucket[depth];
          more = true;
          if (!used.contains(item) && predicate(item)) {
            used.add(item);
            out.add(item);
          }
        }
        depth++;
      }
    }

    drain((r) => langScore(r.lang, preferred) > 0);
    drain((_) => true);
    return out;
  }

  static final RegExp _releaseGroupRx = RegExp(
    r'[-.][A-Z0-9]{2,}$|\b(EVO|RARBG|YTS|YIFY|FGT|PSA|TBS|GalaxyRG|GalaxyTV'
    r'|MeGusta|ION10|EZTV|NTb|FLUX|TEPES|KOGi|SMURF|RZeroX|d3g|TGx)\b',
    caseSensitive: false,
  );

  static String? _extractReleaseGroup(String? text) {
    if (text == null || text.isEmpty) return null;
    final matches = _releaseGroupRx.allMatches(text).toList();
    if (matches.isEmpty) return null;
    final last = matches.last
        .group(0)!
        .replaceFirst(RegExp(r'^[-.]'), '')
        .toUpperCase();
    return last.length >= 2 ? last : null;
  }

  static List<String> _sourceTokens(String? source) {
    if (source == null || source.isEmpty) return const [];
    final s = source.toLowerCase();
    if (s.contains('bluray') || s == 'remux' || s.contains('bdrip')) {
      return const ['bluray', 'bdrip', 'remux'];
    }
    if (s.contains('web-dl') || s == 'webdl' || s.contains('webrip')) {
      return const ['web-dl', 'webdl', 'webrip', 'web'];
    }
    if (s.contains('hdtv')) return const ['hdtv'];
    if (s.contains('dvd')) return const ['dvd', 'dvdrip'];
    return [s];
  }

  static int _streamMatchScore(SubResult r, SubStreamHints? hints) {
    if (hints == null) return 0;
    final release = _extractReleaseGroup(hints.release);
    final subText = '${r.release ?? ''} ${r.title ?? ''} ${r.url}'
        .toLowerCase();
    var score = 0;
    if (release != null && subText.contains(release.toLowerCase())) {
      score += 120;
    }
    for (final src in _sourceTokens(hints.source)) {
      if (subText.contains(src)) {
        score += 40;
        break;
      }
    }
    final res = hints.resolution?.toLowerCase();
    if (res != null &&
        (subText.contains(res) || (res == '4k' && subText.contains('2160p')))) {
      score += 8;
    }
    if (r.hearingImpaired && !hints.preferHearingImpaired) score -= 25;
    return score;
  }
}
