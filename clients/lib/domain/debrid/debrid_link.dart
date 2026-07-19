import '../../core/abort_signal.dart';
import '../streams/episode_file.dart';
import '../streams/parser/stream_enums.dart';
import 'debrid_http.dart';
import 'debrid_types.dart';

/// Debrid-Link provider, ported from `src/lib/debrid/debridlink.ts`. Responses
/// use a `{success, value, error}` envelope. Resolution adds a seedbox job and
/// polls `seedbox/list` until it is ready (status 6 or 100% downloaded).
class DebridLink implements DebridStore {
  DebridLink(this._apiKey, this._http, {int pollDelayMs = 800})
    : _pollDelayMs = pollDelayMs;

  static const _base = 'https://debrid-link.com/api/v2';
  static const _pollMaxAttempts = 24;
  static const _cacheBatch = 20;
  static final Map<String, ({int at, List<LibraryEntry> data})> _libraryCache =
      {};

  final String _apiKey;
  final DebridHttp _http;
  final int _pollDelayMs;

  @override
  DebridSlug get slug => DebridSlug.dl;

  @override
  String get name => 'Debrid-Link';

  Map<String, String> _headers([Map<String, String>? extra]) => {
    'Authorization': 'Bearer $_apiKey',
    'Accept': 'application/json',
    ...?extra,
  };

  @override
  Future<DebridResult<Account>> account(AbortSignal signal) async {
    final r = await _get('/account/infos');
    if (r is DebridErr) return r.to<Account>();
    final u = _value(r.dataOrNull);
    if (u is! Map) return const DebridErr('parse-error');
    final premiumLeft = (u['premiumLeft'] as num?)?.toInt();
    final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    return DebridOk(
      Account(
        slug: DebridSlug.dl,
        username: u['username']?.toString(),
        email: u['email']?.toString(),
        premium:
            ((u['accountType'] as num?) ?? 0) > 0 || (premiumLeft ?? 0) > 0,
        premiumUntil: premiumLeft != null ? nowSec + premiumLeft : null,
      ),
    );
  }

  @override
  Future<DebridResult<CacheMap>> cacheCheck(
    List<String> hashes,
    AbortSignal signal,
  ) async {
    if (hashes.isEmpty) return const DebridOk(<String, bool>{});
    final lower = hashes.map((h) => h.toLowerCase()).toList();
    final batches = <List<String>>[];
    for (var i = 0; i < lower.length; i += _cacheBatch) {
      batches.add(
        lower.sublist(
          i,
          i + _cacheBatch > lower.length ? lower.length : i + _cacheBatch,
        ),
      );
    }
    final results = await Future.wait(
      batches.map((b) async {
        try {
          return await _cacheCheckBatch(b);
        } catch (_) {
          return const DebridOk(<String, bool>{});
        }
      }),
    );
    final merged = <String, bool>{};
    for (final r in results) {
      if (r is DebridOk<CacheMap>) merged.addAll(r.data);
    }
    return DebridOk(merged);
  }

  Future<DebridResult<CacheMap>> _cacheCheckBatch(List<String> batch) async {
    final r = await _get(
      '/seedbox/cached?url=${Uri.encodeQueryComponent(batch.join(','))}',
    );
    if (r is DebridErr) return const DebridOk(<String, bool>{});
    final value = _value(r.dataOrNull);
    final out = <String, bool>{};
    if (value is Map) {
      for (final h in batch) {
        final entry = value[h];
        if (entry is Map) out[h] = true;
      }
    }
    return DebridOk(out);
  }

  @override
  Future<DebridResult<DirectLink>> playableUrl(
    String magnet,
    int? fileIdx,
    AbortSignal signal, {
    EpisodeHint? hint,
  }) async {
    final fullMagnet = magnetFromHash(magnet);
    final hash = hashFromMagnet(magnet);

    final add = await _postForm('/seedbox/add', {
      'url': fullMagnet,
      'async': 'true',
    });
    if (add is DebridErr) return add.to<DirectLink>();
    final addValue = _value(add.dataOrNull);
    final id = addValue is Map ? addValue['id']?.toString() : null;
    if (id == null) return DebridErr('no-id', raw: add.dataOrNull);

    Map<String, dynamic>? info = addValue is Map
        ? addValue.cast<String, dynamic>()
        : null;
    for (var attempt = 0; attempt < _pollMaxAttempts; attempt++) {
      if (signal.isAborted) {
        await _delEmpty('/seedbox/$id/remove');
        return const DebridErr('aborted');
      }
      final r = await _get('/seedbox/list?ids=${Uri.encodeQueryComponent(id)}');
      if (r is DebridErr) return r.to<DirectLink>();
      info = _firstSeedbox(_value(r.dataOrNull));
      if (info == null) {
        await signal.sleep(_pollDelayMs);
        continue;
      }
      if (info['status'] == 6 || info['downloadPercent'] == 100) break;
      if (info['status'] == 100) {
        await _delEmpty('/seedbox/$id/remove');
        return DebridErr('error', raw: {'hash': hash});
      }
      await signal.sleep(_pollDelayMs);
    }

    if (info == null ||
        (info['status'] != 6 && info['downloadPercent'] != 100)) {
      await _delEmpty('/seedbox/$id/remove');
      return DebridErr(
        'not-cached',
        raw: {'hash': hash, 'progress': info?['downloadPercent']},
      );
    }

    final file = _pickDlFile(
      (info['files'] as List?) ?? const [],
      fileIdx,
      hint,
    );
    if (file == null) return const DebridErr('no-video-file');
    final url = file['downloadUrl']?.toString();
    if (url == null || url.isEmpty) return const DebridErr('no-link');
    return DebridOk(
      DirectLink(
        url: url,
        filename: file['name']?.toString(),
        filesize: (file['size'] as num?)?.toInt(),
      ),
    );
  }

  @override
  Future<DebridResult<QueueId>> queueCache(
    String magnet,
    AbortSignal signal,
  ) async => const DebridErr('unsupported');

  @override
  Future<DebridResult<List<LibraryEntry>>> listLibrary(
    AbortSignal signal,
  ) async {
    final cached = _libraryCache[_apiKey];
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    if (cached != null && nowMs - cached.at < kLibraryTtlMs) {
      return DebridOk(cached.data);
    }
    final all = <Map<String, dynamic>>[];
    for (var page = 0; page < 5; page++) {
      final r = await _get('/seedbox/list?perPage=50&page=$page');
      if (r is DebridErr) break;
      final items = _value(r.dataOrNull);
      if (items is! List || items.isEmpty) break;
      all.addAll(items.whereType<Map>().map((e) => e.cast<String, dynamic>()));
      if (items.length < 50) break;
    }
    final entries = all
        .where((t) => t['status'] == 6 || t['downloadPercent'] == 100)
        .map(
          (t) => LibraryEntry(
            slug: DebridSlug.dl,
            id: t['id'].toString(),
            hash: (t['hashString'] ?? '').toString().toLowerCase(),
            name: (t['name'] ?? '').toString(),
            size: (t['totalSize'] as num?)?.toInt(),
            files: ((t['files'] as List?) ?? const [])
                .whereType<Map>()
                .map(
                  (f) => LibraryFile(
                    id: f['id'].toString(),
                    name: (f['name'] ?? '').toString(),
                    size: (f['size'] as num?)?.toInt() ?? 0,
                  ),
                )
                .toList(),
          ),
        )
        .where((e) => e.hash.isNotEmpty)
        .toList();
    _libraryCache[_apiKey] = (at: nowMs, data: entries);
    return DebridOk(entries);
  }

  @override
  Future<DebridResult<List<DebridFile>>> listTorrentFiles(
    String hash,
    AbortSignal signal,
  ) async {
    final fullMagnet = magnetFromHash(hash);
    final add = await _postForm('/seedbox/add', {
      'url': fullMagnet,
      'async': 'true',
    });
    if (add is DebridErr) return add.to<List<DebridFile>>();
    final addValue = _value(add.dataOrNull);
    final id = addValue is Map ? addValue['id']?.toString() : null;
    if (id == null) return const DebridErr('no-id');

    for (var attempt = 0; attempt < 24; attempt++) {
      if (signal.isAborted) {
        await _delEmpty('/seedbox/$id/remove');
        return const DebridErr('aborted');
      }
      final list = await _get(
        '/seedbox/list?ids=${Uri.encodeQueryComponent(id)}',
      );
      if (list is DebridErr) return list.to<List<DebridFile>>();
      final seedbox = _firstSeedbox(_value(list.dataOrNull));
      final files = (seedbox?['files'] as List?) ?? const [];
      if (files.isNotEmpty &&
          (seedbox?['status'] == 6 || seedbox?['downloadPercent'] == 100)) {
        final result = <DebridFile>[];
        for (var i = 0; i < files.length; i++) {
          final f = files[i];
          if (f is! Map) continue;
          result.add(
            DebridFile(
              id: i.toString(),
              name: (f['name'] ?? '').toString(),
              size: (f['size'] as num?)?.toInt() ?? 0,
              url: f['downloadUrl']?.toString(),
            ),
          );
        }
        return DebridOk(result);
      }
      await signal.sleep(800);
    }
    await _delEmpty('/seedbox/$id/remove');
    return const DebridErr('timeout');
  }

  // --- helpers ---------------------------------------------------------------

  dynamic _value(dynamic body) => body is Map ? body['value'] : null;

  Map<String, dynamic>? _firstSeedbox(dynamic value) {
    if (value is List) {
      final first = value.whereType<Map>().cast<Map<String, dynamic>>();
      return first.isEmpty ? null : first.first;
    }
    if (value is Map) return value.cast<String, dynamic>();
    return null;
  }

  Map<String, dynamic>? _pickDlFile(
    List<dynamic> files,
    int? fileIdx,
    EpisodeHint? hint,
  ) {
    if (files.isEmpty) return null;
    if (fileIdx != null && fileIdx >= 0 && fileIdx < files.length) {
      return _asMap(files[fileIdx]);
    }
    final videos = files
        .where(
          (f) => kVideoExts.any((ext) => _fname(f).toLowerCase().endsWith(ext)),
        )
        .toList();
    final pool = videos.isEmpty ? files : videos;
    final mi = matchEpisodeFileIndex(pool.map(_fname).toList(), hint);
    if (mi >= 0) return _asMap(pool[mi]);
    final sorted = [...pool]
      ..sort(
        (a, b) =>
            ((b['size'] as num?)?.toInt() ?? 0) -
            ((a['size'] as num?)?.toInt() ?? 0),
      );
    return sorted.isEmpty ? null : _asMap(sorted.first);
  }

  String _fname(dynamic f) => (f['name'] ?? '').toString();
  Map<String, dynamic>? _asMap(dynamic f) =>
      f is Map ? f.cast<String, dynamic>() : null;

  Future<DebridResult<dynamic>> _get(String path) =>
      _wrap(() => _http.get('$_base$path', headers: _headers()));

  Future<DebridResult<dynamic>> _postForm(
    String path,
    Map<String, Object> body,
  ) => _wrap(
    () => _http.postForm(
      '$_base$path',
      body,
      headers: _headers({'Content-Type': 'application/x-www-form-urlencoded'}),
    ),
  );

  Future<void> _delEmpty(String path) async {
    try {
      await _http.delete('$_base$path', headers: _headers());
    } catch (_) {
      // best-effort cleanup
    }
  }

  Future<DebridResult<dynamic>> _wrap(
    Future<DebridResponse> Function() call,
  ) async {
    DebridResponse res;
    try {
      res = await call();
    } on DebridNetworkException catch (e) {
      return DebridErr(e.aborted ? 'aborted' : 'network-error', raw: e.cause);
    }
    final s = res.status;
    final errMsg = (res.map?['error'] ?? res.map?['message'] ?? '').toString();
    final looksPremium = RegExp(
      r'subscription|premium',
      caseSensitive: false,
    ).hasMatch(errMsg);
    if (s == 401 || s == 403) {
      return DebridErr(
        looksPremium ? 'not-premium' : 'unauthorized',
        status: s,
        raw: res.body,
      );
    }
    if (s == 402) return const DebridErr('not-premium', status: 402);
    if (s == 429) return const DebridErr('rate-limited', status: 429);
    if (s == 503 || s == 504) {
      return DebridErr('upstream-unavailable', status: s);
    }
    if (s == 204) return const DebridOk(null);
    if (!res.ok) {
      if (looksPremium) {
        return DebridErr('not-premium', status: s, raw: res.body);
      }
      final code = (res.map?['error'] ?? 'http-$s').toString();
      return DebridErr(code, status: s, raw: res.body);
    }
    return DebridOk(res.body);
  }
}
