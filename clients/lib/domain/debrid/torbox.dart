import '../../core/abort_signal.dart';
import '../streams/episode_file.dart';
import '../streams/parser/stream_enums.dart';
import 'debrid_http.dart';
import 'debrid_types.dart';

/// TorBox provider, ported from `src/lib/debrid/torbox.ts`. Unlike Real-Debrid,
/// TorBox exposes real cache checking (`checkcached`, batched by 25) and a
/// `queueCache` background job. Responses are wrapped in a
/// `{success, detail, data}` envelope.
class Torbox implements DebridStore {
  Torbox(this._apiKey, this._http, {int pollDelayMs = 1000})
    : _pollDelayMs = pollDelayMs;

  static const _base = 'https://api.torbox.app/v1/api';
  static const _pollMaxAttempts = 30;
  static const _cacheBatch = 25;
  static final Map<String, ({int at, List<LibraryEntry> data})> _libraryCache =
      {};

  final String _apiKey;
  final DebridHttp _http;
  final int _pollDelayMs;

  @override
  DebridSlug get slug => DebridSlug.tb;

  @override
  String get name => 'TorBox';

  Map<String, String> _headers([Map<String, String>? extra]) => {
    'Authorization': 'Bearer $_apiKey',
    'Accept': 'application/json',
    ...?extra,
  };

  @override
  Future<DebridResult<Account>> account(AbortSignal signal) async {
    final r = await _get('/user/me');
    if (r is DebridErr) return r.to<Account>();
    final d = _envData(r.dataOrNull);
    final dm = d is Map ? d : null;
    final expiration = dm?['premium_expires_at']?.toString();
    final expiresAt = expiration != null ? DateTime.tryParse(expiration) : null;
    return DebridOk(
      Account(
        slug: DebridSlug.tb,
        username: (dm?['customer'] ?? dm?['email'])?.toString(),
        email: dm?['email']?.toString(),
        premium: ((dm?['plan'] as num?) ?? 0) > 0,
        premiumUntil: expiresAt != null
            ? expiresAt.millisecondsSinceEpoch ~/ 1000
            : null,
      ),
    );
  }

  @override
  Future<DebridResult<CacheMap>> cacheCheck(
    List<String> hashes,
    AbortSignal signal,
  ) async {
    if (hashes.isEmpty) return const DebridOk(<String, bool>{});
    final batches = <List<String>>[];
    for (var i = 0; i < hashes.length; i += _cacheBatch) {
      batches.add(
        hashes.sublist(
          i,
          i + _cacheBatch > hashes.length ? hashes.length : i + _cacheBatch,
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
    final params = [
      for (final h in batch)
        'hash=${Uri.encodeQueryComponent(h.toLowerCase())}',
      'format=object',
      'list_files=false',
    ].join('&');
    final r = await _get('/torrents/checkcached?$params');
    if (r is DebridErr) return const DebridOk(<String, bool>{});
    final data = _envData(r.dataOrNull);
    final out = <String, bool>{};
    final requested = batch.map((h) => h.toLowerCase()).toSet();
    void tag(String? h) {
      if (h == null) return;
      final lh = h.toLowerCase();
      if (requested.contains(lh)) out[lh] = true;
    }

    if (data is Map) {
      for (final key in data.keys) {
        final v = data[key];
        if (v == null || v == false) continue;
        if (v is Map) {
          tag(v['hash']?.toString() ?? key.toString());
        } else {
          tag(key.toString());
        }
      }
    } else if (data is List) {
      for (final item in data) {
        if (item is Map) tag(item['hash']?.toString());
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

    final add = await _postForm('/torrents/createtorrent', {
      'magnet': fullMagnet,
      'allow_zip': 'false',
      'as_queued': 'false',
    });
    if (add is DebridErr) return add.to<DirectLink>();
    final id = _createdId(add.dataOrNull);
    if (id == null) return DebridErr('no-id', raw: add.dataOrNull);

    Map<String, dynamic>? info;
    for (var attempt = 0; attempt < _pollMaxAttempts; attempt++) {
      if (signal.isAborted) return const DebridErr('aborted');
      final r = await _get('/torrents/mylist?id=$id&bypass_cache=true');
      if (r is DebridErr) return r.to<DirectLink>();
      final d = _envData(r.dataOrNull);
      info = d is Map ? d.cast<String, dynamic>() : null;
      if (info == null) {
        await signal.sleep(_pollDelayMs);
        continue;
      }
      if (info['download_finished'] == true ||
          info['download_present'] == true) {
        break;
      }
      final state = info['download_state']?.toString();
      if (state == 'error' || state == 'stalled') {
        return DebridErr(state!, raw: {'hash': hash});
      }
      await signal.sleep(_pollDelayMs);
    }

    if (info == null ||
        (info['download_finished'] != true &&
            info['download_present'] != true)) {
      return DebridErr(
        'still-downloading',
        raw: {'hash': hash, 'progress': info?['progress']},
      );
    }

    final file = _pickTbFile(
      (info['files'] as List?) ?? const [],
      fileIdx,
      hint,
    );
    if (file == null) return const DebridErr('no-video-file');

    final dl = await _get(
      '/torrents/requestdl?token=${Uri.encodeQueryComponent(_apiKey)}'
      '&torrent_id=$id&file_id=${file['id']}&zip_link=false',
    );
    if (dl is DebridErr) return dl.to<DirectLink>();
    final url = _envData(dl.dataOrNull);
    if (url is! String || url.isEmpty) return const DebridErr('no-link');
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
  ) async {
    final fullMagnet = magnetFromHash(magnet);
    final add = await _postForm('/torrents/createtorrent', {
      'magnet': fullMagnet,
      'allow_zip': 'false',
      'as_queued': 'true',
    });
    if (add is DebridErr) return add.to<QueueId>();
    final id = _createdId(add.dataOrNull);
    if (id == null) return DebridErr('no-id', raw: add.dataOrNull);
    _libraryCache.remove(_apiKey);
    return DebridOk(QueueId(id.toString()));
  }

  @override
  Future<DebridResult<List<LibraryEntry>>> listLibrary(
    AbortSignal signal,
  ) async {
    final cached = _libraryCache[_apiKey];
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    if (cached != null && nowMs - cached.at < kLibraryTtlMs) {
      return DebridOk(cached.data);
    }
    final r = await _get('/torrents/mylist?bypass_cache=true');
    if (r is DebridErr) return r.to<List<LibraryEntry>>();
    final list = _envData(r.dataOrNull);
    final entries = (list is List ? list : const [])
        .whereType<Map>()
        .where(
          (t) =>
              t['download_finished'] == true || t['download_present'] == true,
        )
        .map(
          (t) => LibraryEntry(
            slug: DebridSlug.tb,
            id: t['id'].toString(),
            hash: (t['hash'] ?? '').toString().toLowerCase(),
            name: (t['name'] ?? '').toString(),
            size: (t['size'] as num?)?.toInt(),
            files: ((t['files'] as List?) ?? const [])
                .whereType<Map>()
                .map(
                  (f) => LibraryFile(
                    id: f['id'].toString(),
                    name: (f['short_name'] ?? f['name'] ?? '').toString(),
                    size: (f['size'] as num?)?.toInt() ?? 0,
                  ),
                )
                .toList(),
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
    final created = await _postForm('/torrents/createtorrent', {
      'magnet': fullMagnet,
      'allow_zip': 'false',
      'as_queued': 'false',
    });
    if (created is DebridErr) return created.to<List<DebridFile>>();
    final id = _createdId(created.dataOrNull);
    if (id == null) return const DebridErr('no-id');

    for (var attempt = 0; attempt < 60; attempt++) {
      if (signal.isAborted) return const DebridErr('aborted');
      final list = await _get('/torrents/mylist?bypass_cache=true');
      if (list is DebridErr) return list.to<List<DebridFile>>();
      final all = _envData(list.dataOrNull);
      final torrent = (all is List ? all : const [])
          .whereType<Map>()
          .cast<Map<String, dynamic>>()
          .where((t) => t['id'] == id)
          .firstOrNull;
      final state = torrent?['download_state']?.toString();
      if (state == 'error' || state == 'stalled') {
        return DebridErr(state!);
      }
      final files = (torrent?['files'] as List?) ?? const [];
      if (files.isNotEmpty &&
          (torrent?['download_finished'] == true ||
              torrent?['download_present'] == true)) {
        final result = <DebridFile>[];
        for (final f in files.whereType<Map>()) {
          if (signal.isAborted) return const DebridErr('aborted');
          final dl = await _get(
            '/torrents/requestdl?token=${Uri.encodeQueryComponent(_apiKey)}'
            '&torrent_id=$id&file_id=${f['id']}&zip_link=false',
          );
          if (dl is DebridErr) continue;
          final url = _envData(dl.dataOrNull);
          if (url is! String || url.isEmpty) continue;
          result.add(
            DebridFile(
              id: f['id'].toString(),
              name: (f['name'] ?? f['short_name'] ?? '').toString(),
              size: (f['size'] as num?)?.toInt() ?? 0,
              url: url,
            ),
          );
        }
        if (result.isEmpty) continue;
        return DebridOk(result);
      }
      await signal.sleep(1000);
    }
    return const DebridErr('timeout');
  }

  // --- helpers ---------------------------------------------------------------

  dynamic _envData(dynamic body) => body is Map ? body['data'] : null;

  Object? _createdId(dynamic body) {
    final d = _envData(body);
    if (d is! Map) return null;
    return d['torrent_id'] ?? d['queued_id'];
  }

  Map<String, dynamic>? _pickTbFile(
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

  String _fname(dynamic f) => (f['short_name'] ?? f['name'] ?? '').toString();

  Map<String, dynamic>? _asMap(dynamic f) =>
      f is Map ? f.cast<String, dynamic>() : null;

  Future<DebridResult<dynamic>> _get(String path) =>
      _wrap(() => _http.get('$_base$path', headers: _headers()));

  Future<DebridResult<dynamic>> _postForm(
    String path,
    Map<String, String> body,
  ) => _wrap(
    () => _http.postForm(
      '$_base$path',
      body,
      headers: _headers({'Content-Type': 'application/x-www-form-urlencoded'}),
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
    if (s == 401 || s == 403) return DebridErr('unauthorized', status: s);
    if (s == 402) return const DebridErr('not-premium', status: 402);
    if (s == 429) return const DebridErr('rate-limited', status: 429);
    if (!res.ok) {
      final code = (res.map?['detail'] ?? res.map?['error'] ?? 'http-$s')
          .toString();
      return DebridErr(code, status: s, raw: res.body);
    }
    return DebridOk(res.body);
  }
}
