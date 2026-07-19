import 'dart:async';

import '../../core/http/json_transport.dart';
import '../addons/addon_url.dart';
import '../addons/models.dart';
import 'addon_family.dart';
import 'cached.dart';
import 'magnet.dart';
import 'stream_item.dart';

/// A stream query: a content [type] and the ordered candidate [ids].
class StreamRequest {
  const StreamRequest({required this.type, required this.ids});
  final String type;
  final List<String> ids;
}

const _timeoutFast = Duration(seconds: 8);
const _timeoutSlow = Duration(seconds: 22);
final List<RegExp> _slowAddonPatterns = [
  RegExp('mediafusion', caseSensitive: false),
  RegExp('comet', caseSensitive: false),
  RegExp('torrentio', caseSensitive: false),
  RegExp('knightcrawler', caseSensitive: false),
  RegExp('aiostreams', caseSensitive: false),
  RegExp('jackettio', caseSensitive: false),
  RegExp('torbox', caseSensitive: false),
];

const _streamHeaders = {
  'Accept': 'application/json, text/plain, */*',
  'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

const List<String> _prefixPriority = [
  'kitsu',
  'mal',
  'anidb',
  'anilist',
  'tt',
  'tmdb',
];
const List<String> _animeSchemes = ['kitsu', 'mal', 'anidb', 'anilist'];

/// Fetches streams from installed stream-capable addons, ported from
/// `src/lib/streams/addons.ts`. Queries each accepting addon in parallel with a
/// per-addon timeout, annotates every stream with its origin, recovers missing
/// info-hashes, and de-duplicates the accumulated result.
class AddonStreamFetcher {
  AddonStreamFetcher(
    this._transport, {
    Duration fastTimeout = _timeoutFast,
    Duration slowTimeout = _timeoutSlow,
  }) : _fast = fastTimeout,
       _slow = slowTimeout;

  final JsonTransport _transport;
  final Duration _fast;
  final Duration _slow;

  /// Queries [addons] for [req]. [onPartial] (if given) is invoked with a
  /// growing snapshot as each addon returns, for progressive UI reveal. The
  /// returned list is de-duplicated.
  Future<List<StreamItem>> fetch(
    List<InstalledAddon> addons,
    StreamRequest req, {
    void Function(List<StreamItem> current)? onPartial,
  }) async {
    final accumulated = <StreamItem>[];
    final tasks = <Future<void>>[];

    for (var i = 0; i < addons.length; i++) {
      final addon = addons[i];
      final manifest = addon.manifest;
      if (manifest == null) continue;
      if (isStatusOnlyAddon(
        manifest: manifest,
        transportUrl: addon.transportUrl,
      )) {
        continue;
      }
      final ids = pickIds(manifest, req.type, req.ids);
      if (ids.isEmpty) continue;

      final priority = i;
      for (final id in ids) {
        tasks.add(
          _fetchOne(addon, manifest, req.type, id).then((streams) {
            for (var idx = 0; idx < streams.length; idx++) {
              accumulated.add(
                streams[idx].copyWith(
                  addonPriority: priority,
                  addonReturnIdx: idx,
                ),
              );
            }
            if (onPartial != null) onPartial(List.of(accumulated));
          }),
        );
      }
    }

    await Future.wait(tasks);
    return _dedupe(accumulated);
  }

  /// Whether any installed addon can serve a stream for [req].
  bool anyAccepts(List<InstalledAddon> addons, StreamRequest req) {
    for (final addon in addons) {
      final manifest = addon.manifest;
      if (manifest == null) continue;
      if (isStatusOnlyAddon(
        manifest: manifest,
        transportUrl: addon.transportUrl,
      )) {
        continue;
      }
      if (pickIds(manifest, req.type, req.ids).isNotEmpty) return true;
    }
    return false;
  }

  Future<List<StreamItem>> _fetchOne(
    InstalledAddon addon,
    Manifest manifest,
    String type,
    String id,
  ) async {
    final url = streamUrl(addonBase(addon.transportUrl), type, id);
    final limit = _timeoutFor(addon, manifest);
    final ranked = isAddonRanked(
      manifest: manifest,
      transportUrl: addon.transportUrl,
    );
    try {
      final res = await _transport
          .getJson(url, headers: _streamHeaders)
          .timeout(limit);
      if (!res.ok || res.data is! Map) return const [];
      final data = (res.data as Map).cast<String, dynamic>();
      final list = (data['streams'] as List?) ?? const [];
      return list
          .whereType<Map>()
          .map(
            (m) =>
                _annotate(m.cast<String, dynamic>(), addon, manifest, ranked),
          )
          .toList();
    } on TimeoutException {
      return const [];
    } on TransportException {
      return const [];
    }
  }

  StreamItem _annotate(
    Map<String, dynamic> raw,
    InstalledAddon addon,
    Manifest manifest,
    bool ranked,
  ) {
    var infoHash = (raw['infoHash'] as String?)?.toLowerCase();
    var fileIdx = raw['fileIdx'] is num
        ? (raw['fileIdx'] as num).toInt()
        : null;
    final sources = ((raw['sources'] as List?) ?? const [])
        .map((e) => e.toString())
        .toList();

    if (infoHash == null &&
        hasUncachedMarker(
          name: raw['name']?.toString(),
          title: raw['title']?.toString(),
          description: raw['description']?.toString(),
        )) {
      final fromUrl = raw['url'] is String
          ? infoHashFromUrl(raw['url'] as String)
          : null;
      final hash = fromUrl?.infoHash ?? infoHashFromSources(sources);
      if (hash != null) {
        infoHash = hash;
        if (fileIdx == null && fromUrl?.fileIdx != null) {
          fileIdx = fromUrl!.fileIdx;
        }
      }
    }

    return StreamItem(
      raw: raw,
      infoHash: infoHash,
      fileIdx: fileIdx,
      sources: sources,
      addonId: manifest.id,
      addonName: manifest.name ?? '',
      addonUrl: addon.transportUrl,
      addonRanked: ranked,
    );
  }

  Duration _timeoutFor(InstalledAddon addon, Manifest manifest) {
    final haystack =
        '${manifest.name ?? ''} ${manifest.id} ${addon.transportUrl}';
    final slow = _slowAddonPatterns.any((re) => re.hasMatch(haystack));
    return slow ? _slow : _fast;
  }
}

/// The ids to query [manifest] with, in priority order — an anime-scheme id and
/// an imdb id when both are accepted, otherwise the single best accepted id.
List<String> pickIds(Manifest manifest, String type, List<String> ids) {
  final sorted = [...ids]..sort((a, b) => _idPriority(a) - _idPriority(b));
  final accepted = sorted
      .where((id) => addonAcceptsId(manifest, type, id))
      .toList();
  if (accepted.isEmpty) return const [];
  final animeId = _firstWhereOrNull(
    accepted,
    (id) => _animeSchemes.any(id.startsWith),
  );
  final ttId = _firstWhereOrNull(accepted, (id) => id.startsWith('tt'));
  if (animeId != null && ttId != null) return [animeId, ttId];
  return [accepted.first];
}

String? _firstWhereOrNull(List<String> items, bool Function(String) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}

int _idPriority(String id) {
  for (var i = 0; i < _prefixPriority.length; i++) {
    if (id.startsWith(_prefixPriority[i])) return i;
  }
  return 999;
}

/// Whether [manifest] declares a `stream` resource that accepts (type, id),
/// honoring per-resource then top-level `types`/`idPrefixes`.
bool addonAcceptsId(Manifest manifest, String type, String id) {
  final entries = manifest.resourceEntries;
  final streamObjs = entries
      .where((r) => r.isObject && r.name == 'stream')
      .toList();
  if (streamObjs.isNotEmpty) {
    return streamObjs.any((r) {
      final typeOk = r.types.contains(type);
      final idOk = r.idPrefixes.isEmpty || r.idPrefixes.any(id.startsWith);
      return typeOk && idOk;
    });
  }
  if (!entries.any((r) => !r.isObject && r.name == 'stream')) return false;
  if (!manifest.types.contains(type)) return false;
  final prefixes = manifest.idPrefixes;
  if (prefixes.isNotEmpty && !prefixes.any(id.startsWith)) return false;
  return true;
}

List<StreamItem> _dedupe(List<StreamItem> streams) {
  final seen = <String, StreamItem>{};
  final order = <String>[];
  var noKeyCounter = 0;
  for (final s in streams) {
    final baseKey = s.infoHash != null
        ? 'hash:${s.infoHash}:${s.fileIdx ?? ''}'
        : 'url:${s.url ?? s.title ?? s.name ?? 'x${noKeyCounter++}'}';
    final key = '${s.addonId}:$baseKey';
    final prior = seen[key];
    if (prior == null) {
      seen[key] = s;
      order.add(key);
      continue;
    }
    if (s.sources.isNotEmpty) {
      final merged = <String>{...prior.sources, ...s.sources}.toList();
      seen[key] = prior.copyWith(sources: merged);
    }
  }
  return [for (final k in order) seen[k]!];
}
