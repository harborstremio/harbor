import '../../core/abort_signal.dart';
import '../streams/episode_file.dart';
import '../streams/parser/stream_enums.dart';
import 'debrid_http.dart';
import 'debrid_types.dart';

/// Premiumize provider, ported from `src/lib/debrid/premiumize.ts`. The apikey
/// rides in the query string and responses use a `{status, message}` envelope.
/// Resolution is single-shot: `transfer/directdl` returns the cached content
/// directly (empty content means not cached), so there is no polling.
class Premiumize implements DebridStore {
  Premiumize(this._apiKey, this._http);

  static const _base = 'https://www.premiumize.me/api';
  static const _cacheBatch = 100;
  static final Map<String, ({int at, List<LibraryEntry> data})> _libraryCache =
      {};

  final String _apiKey;
  final DebridHttp _http;

  @override
  DebridSlug get slug => DebridSlug.pm;

  @override
  String get name => 'Premiumize';

  String _withKey(String path) {
    final sep = path.contains('?') ? '&' : '?';
    return '$_base$path${sep}apikey=${Uri.encodeQueryComponent(_apiKey)}';
  }

  @override
  Future<DebridResult<Account>> account(AbortSignal signal) async {
    final r = await _get('/account/info');
    if (r is DebridErr) return r.to<Account>();
    final d = r.dataOrNull;
    if (d is! Map) return const DebridErr('parse-error');
    final until = (d['premium_until'] as num?)?.toInt();
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    return DebridOk(
      Account(
        slug: DebridSlug.pm,
        username: d['customer_id']?.toString(),
        premium: until != null && until * 1000 > nowMs,
        premiumUntil: until,
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
    final params = batch
        .map((h) => 'items[]=${Uri.encodeQueryComponent(h)}')
        .join('&');
    final r = await _get('/cache/check?$params');
    if (r is DebridErr) return const DebridOk(<String, bool>{});
    final d = r.dataOrNull;
    final response = d is Map ? d['response'] : null;
    final out = <String, bool>{};
    if (response is List) {
      for (var i = 0; i < batch.length; i++) {
        if (i < response.length && response[i] == true) out[batch[i]] = true;
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
    final direct = await _postForm('/transfer/directdl', {'src': fullMagnet});
    if (direct is DebridErr) return direct.to<DirectLink>();
    final d = direct.dataOrNull;
    final content = (d is Map ? d['content'] : null);
    if (content is! List || content.isEmpty) {
      return DebridErr('not-cached', raw: {'hash': hashFromMagnet(magnet)});
    }
    final file = _pickPmFile(content, fileIdx, hint);
    if (file == null) return const DebridErr('no-video-file');
    final transcodeFinished =
        file['transcode_status'] == 'finished' && file['stream_link'] != null;
    final url = transcodeFinished
        ? file['stream_link']?.toString()
        : file['link']?.toString();
    if (url == null || url.isEmpty) return const DebridErr('no-link');
    final path = file['path']?.toString();
    return DebridOk(
      DirectLink(
        url: url,
        filename: path != null && path.contains('/')
            ? path.split('/').last
            : path,
        filesize: _asInt(file['size']),
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
    final r = await _get('/transfer/list');
    if (r is DebridErr) return r.to<List<LibraryEntry>>();
    final d = r.dataOrNull;
    final list = d is Map ? d['transfers'] : null;
    final entries = (list is List ? list : const [])
        .whereType<Map>()
        .where((t) => t['status'] == 'finished' || t['status'] == 'seeding')
        .map(
          (t) => LibraryEntry(
            slug: DebridSlug.pm,
            id: t['id'].toString(),
            hash: '',
            name: (t['name'] ?? '').toString(),
          ),
        )
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
    final dl = await _postForm('/transfer/directdl', {'src': fullMagnet});
    if (dl is DebridErr) return dl.to<List<DebridFile>>();
    final d = dl.dataOrNull;
    final content = d is Map ? d['content'] : null;
    if (content is! List || content.isEmpty) {
      return const DebridErr('not-cached');
    }
    final files = <DebridFile>[];
    for (var i = 0; i < content.length; i++) {
      final f = content[i];
      if (f is! Map) continue;
      final path = f['path']?.toString();
      files.add(
        DebridFile(
          id: i.toString(),
          name: path != null && path.contains('/')
              ? path.split('/').last
              : (path ?? 'file-$i'),
          size: _asInt(f['size']) ?? 0,
          url: f['link']?.toString(),
        ),
      );
    }
    return DebridOk(files);
  }

  // --- helpers ---------------------------------------------------------------

  Map<String, dynamic>? _pickPmFile(
    List<dynamic> content,
    int? fileIdx,
    EpisodeHint? hint,
  ) {
    if (content.isEmpty) return null;
    if (fileIdx != null && fileIdx >= 0 && fileIdx < content.length) {
      return _asMap(content[fileIdx]);
    }
    final videos = content
        .where(
          (f) => kVideoExts.any((ext) => _pname(f).toLowerCase().endsWith(ext)),
        )
        .toList();
    final pool = videos.isEmpty ? content : videos;
    final mi = matchEpisodeFileIndex(pool.map(_pname).toList(), hint);
    if (mi >= 0) return _asMap(pool[mi]);
    final sorted = [...pool]
      ..sort((a, b) => (_asInt(b['size']) ?? 0) - (_asInt(a['size']) ?? 0));
    return sorted.isEmpty ? null : _asMap(sorted.first);
  }

  String _pname(dynamic f) => (f['path'] ?? '').toString();
  Map<String, dynamic>? _asMap(dynamic f) =>
      f is Map ? f.cast<String, dynamic>() : null;

  int? _asInt(dynamic v) {
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v);
    return null;
  }

  Future<DebridResult<dynamic>> _get(String path) => _wrap(
    () => _http.get(_withKey(path), headers: {'Accept': 'application/json'}),
  );

  Future<DebridResult<dynamic>> _postForm(
    String path,
    Map<String, Object> body,
  ) => _wrap(
    () => _http.postForm(
      _withKey(path),
      body,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    ),
  );

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
    if (s == 429) return const DebridErr('rate-limited', status: 429);
    if (!res.ok) return DebridErr('http-$s', status: s, raw: res.body);
    final body = res.body;
    if (body is! Map) return DebridErr('parse-error', status: s);
    if (body['status'] == 'error') {
      final msg = (body['message'] ?? '').toString().toLowerCase();
      var code = 'pm-error';
      if (msg.contains('not_logged_in') || msg.contains('invalid api')) {
        code = 'unauthorized';
      } else if (msg.contains('not_premium') || msg.contains('expired')) {
        code = 'not-premium';
      } else if (msg.contains('rate')) {
        code = 'rate-limited';
      }
      return DebridErr(code, status: s, raw: body);
    }
    return DebridOk(body);
  }
}
