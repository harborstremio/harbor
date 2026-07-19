import '../../core/http/text_transport.dart';

/// A web result surfaced by the Jina Reader search, ported from
/// `jina-search.ts`.
typedef WebHit = ({String title, String url, String snippet});

/// Jina's free Reader endpoint. `r.jina.ai/<url>` proxies a page through Jina's
/// anti-bot layer and returns clean markdown; it also accepts DuckDuckGo's HTML
/// SERP as a zero-key search source.
const String _reader = 'https://r.jina.ai/';
const int _maxResults = 8;
const int _maxSnippetChars = 800;

/// Resolves a DuckDuckGo redirect (`duckduckgo.com/l/?uddg=<real>`) to the real
/// target URL; other URLs pass through unchanged. Ported from `decodeUrl`.
String decodeJinaUrl(String raw) {
  final u = Uri.tryParse(raw);
  if (u == null) return raw;
  if (u.host == 'duckduckgo.com' && u.path == '/l/') {
    final real = u.queryParameters['uddg'];
    if (real != null && real.isNotEmpty) {
      try {
        return Uri.decodeComponent(real);
      } catch (_) {
        return raw;
      }
    }
  }
  return raw;
}

String? _hostname(String url) {
  final u = Uri.tryParse(url);
  if (u == null || u.host.isEmpty) return null;
  return u.host;
}

final _ddgHost = RegExp(
  r'duckduckgo\.com|external-content\.duckduckgo\.com',
  caseSensitive: false,
);
final _imageLine = RegExp(r'^\s*!\[');
final _anchorLine = RegExp(r'^\s*\{#');
final _headingLink = RegExp(r'^\s*##\s*\[([^\]]+)\]\(([^)]+)\)');
final _plainLink = RegExp(r'^\s*\[([^\]]+)\]\(([^)]+)\)');
final _http = RegExp(r'^https?://');

String _cleanText(String s) =>
    s.replaceAll(RegExp(r'\*+'), '').replaceAll(RegExp(r'\s+'), ' ').trim();

/// Extracts up to eight de-duplicated web hits from a DuckDuckGo SERP rendered
/// to markdown by Jina, substituting the real target for DuckDuckGo redirect
/// links and promoting a nearby richer anchor title. Ported from `parseHits`.
List<WebHit> parseJinaHits(String md) {
  final hits = <WebHit>[];
  final seen = <String>{};
  final lines = md.split(RegExp(r'\r?\n'));

  for (var i = 0; i < lines.length && hits.length < _maxResults; i++) {
    final line = lines[i];
    if (_imageLine.hasMatch(line)) continue;
    if (_anchorLine.hasMatch(line)) continue;
    final m = _headingLink.firstMatch(line);
    if (m == null) continue;

    var url = decodeJinaUrl(m.group(2)!.trim());
    final host = _hostname(url);
    if (host == null || _ddgHost.hasMatch(host)) {
      var substituted = url;
      for (var j = i + 1; j < (i + 12).clamp(0, lines.length); j++) {
        final ln = lines[j];
        if (_imageLine.hasMatch(ln)) continue;
        final pm = _plainLink.firstMatch(ln);
        if (pm == null) continue;
        final candidate = decodeJinaUrl(pm.group(2)!.trim());
        final h = _hostname(candidate);
        if (h != null && !_ddgHost.hasMatch(h)) {
          substituted = candidate;
          break;
        }
      }
      url = substituted;
    }

    final finalHost = _hostname(url);
    if (finalHost == null || _ddgHost.hasMatch(finalHost)) continue;
    if (!_http.hasMatch(url)) continue;
    if (seen.contains(url)) continue;

    var title = _cleanText(m.group(1)!);
    for (var j = i + 1; j < (i + 12).clamp(0, lines.length); j++) {
      final ln = lines[j];
      if (_imageLine.hasMatch(ln)) continue;
      final pm = _plainLink.firstMatch(ln);
      if (pm == null) continue;
      final candidate = _cleanText(pm.group(1)!);
      if (candidate.length > 18 &&
          candidate != title &&
          !candidate.startsWith('![Image')) {
        title = candidate;
        break;
      }
    }
    if (title.length < 6) continue;

    seen.add(url);
    final snippet = title.length > _maxSnippetChars
        ? title.substring(0, _maxSnippetChars)
        : title;
    hits.add((title: title, url: url, snippet: snippet));
  }
  return hits;
}

Future<String> _readerFetch(
  TextTransport transport,
  String url, {
  String? apiKey,
}) async {
  final headers = <String, String>{'Accept': 'text/plain'};
  final k = apiKey?.trim();
  if (k != null && k.isNotEmpty) headers['Authorization'] = 'Bearer $k';
  final res = await transport.getText('$_reader$url', headers: headers);
  if (!res.ok) {
    final body = res.body.length > 120 ? res.body.substring(0, 120) : res.body;
    throw JinaSearchException('Jina error (${res.statusCode}). $body');
  }
  return res.body;
}

/// Thrown when the Jina Reader returns a non-2xx response.
class JinaSearchException implements Exception {
  const JinaSearchException(this.message);
  final String message;
  @override
  String toString() => 'JinaSearchException($message)';
}

/// Searches the web for [query] via DuckDuckGo proxied through Jina. Ported from
/// `webSearch`. Returns [] for a blank query.
Future<List<WebHit>> webSearch(
  TextTransport transport,
  String query, {
  String? apiKey,
}) async {
  final q = query.trim();
  if (q.isEmpty) return const [];
  final upstream =
      'https://html.duckduckgo.com/html/?q=${Uri.encodeComponent(q)}';
  final md = await _readerFetch(transport, upstream, apiKey: apiKey);
  return parseJinaHits(md);
}

/// Reads a single [url] as clean markdown via Jina. Ported from `readUrl`.
Future<String> readUrl(TextTransport transport, String url, {String? apiKey}) =>
    _readerFetch(transport, url, apiKey: apiKey);

/// Formats hits into the numbered context block fed to the model. Ported from
/// `hitsToContext`.
String hitsToContext(List<WebHit> hits) {
  if (hits.isEmpty) return '';
  return hits
      .take(_maxResults)
      .toList()
      .asMap()
      .entries
      .map(
        (e) =>
            '[${e.key + 1}] ${e.value.title} — ${e.value.url}\n'
            '${e.value.snippet}',
      )
      .join('\n\n');
}

final _priority = RegExp(
  r'wikipedia\.org|themoviedb\.org|rottentomatoes\.com|letterboxd\.com|metacritic\.com',
  caseSensitive: false,
);
final _mdImage = RegExp(r'!\[[^\]]*\]\([^)]*\)');
final _mdLink = RegExp(r'\[([^\]]+)\]\(([^)]+)\)');
final _mdHeading = RegExp(r'^#{1,6}\s+', multiLine: true);

/// Searches the web and deep-reads the top few authoritative results, returning
/// both the hits and a context block for the model. Ported from
/// `enrichWithContent`: promotes reference sites (Wikipedia/TMDB/RT/Letterboxd/
/// Metacritic), fetches up to four pages, and replaces each snippet with the
/// cleaned page body. A single page failing to read keeps its original snippet.
Future<({List<WebHit> hits, String context})> enrichWithContent(
  TextTransport transport,
  String query, {
  String? apiKey,
}) async {
  final hits = await webSearch(transport, query, apiKey: apiKey);
  if (hits.isEmpty) return (hits: const <WebHit>[], context: '');

  final promoted = [...hits]
    ..sort((a, b) {
      final pa = _priority.hasMatch(a.url) ? 1 : 0;
      final pb = _priority.hasMatch(b.url) ? 1 : 0;
      return pb - pa;
    });
  final toFetch = <WebHit>[
    ...promoted.take(3),
    ...promoted.skip(3).where((h) => _priority.hasMatch(h.url)).take(1),
  ].take(4).toList();

  final enriched = await Future.wait(
    toFetch.map((h) async {
      try {
        final md = await readUrl(transport, h.url, apiKey: apiKey);
        final body = md.split(RegExp(r'\r?\n')).take(60).join('\n');
        var cleaned = body
            .replaceAll(_mdImage, '')
            .replaceAllMapped(_mdLink, (m) => m.group(1)!)
            .replaceAll(_mdHeading, '');
        cleaned = (cleaned.length > 1200 ? cleaned.substring(0, 1200) : cleaned)
            .trim();
        return (title: h.title, url: h.url, snippet: cleaned);
      } catch (_) {
        return h;
      }
    }),
  );

  final byUrl = {for (final h in enriched) h.url: h};
  final finalHits = [for (final h in hits) byUrl[h.url] ?? h];
  return (hits: finalHits, context: hitsToContext(finalHits));
}
