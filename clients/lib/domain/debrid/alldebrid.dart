import '../../core/abort_signal.dart';
import '../streams/episode_file.dart';
import '../streams/parser/stream_enums.dart';
import 'debrid_http.dart';
import 'debrid_types.dart';

/// AllDebrid provider, ported from `src/lib/debrid/alldebrid.ts`. Every request
/// carries an `agent=Harbor` query param and returns a `{status, data, error}`
/// envelope. Resolution uploads the magnet, polls `magnet/status` (statusCode 4
/// = ready), then unlocks the chosen link (handling delayed unlocks).
class AllDebrid implements DebridStore {
  AllDebrid(this._apiKey, this._http, {int pollDelayMs = 1500})
    : _pollDelayMs = pollDelayMs;

  static const _base = 'https://api.alldebrid.com/v4';
  static const _agent = 'Harbor';
  static const _pollMaxAttempts = 12;
  static const _cacheBatch = 100;
  static const _readyStatus = 4;
  static const Set<int> _terminalFail = {5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15};
  static final Map<String, ({int at, List<LibraryEntry> data})> _libraryCache =
      {};

  final String _apiKey;
  final DebridHttp _http;
  final int _pollDelayMs;

  @override
  DebridSlug get slug => DebridSlug.ad;

  @override
  String get name => 'AllDebrid';

  Map<String, String> _headers([Map<String, String>? extra]) => {
    'Authorization': 'Bearer $_apiKey',
    'Accept': 'application/json',
    ...?extra,
  };

  String _withAgent(String path) {
    final sep = path.contains('?') ? '&' : '?';
    return '$_base$path${sep}agent=$_agent';
  }

  @override
  Future<DebridResult<Account>> account(AbortSignal signal) async {
    final r = await _get('/user');
    if (r is DebridErr) return r.to<Account>();
    final d = r.dataOrNull;
    final u = d is Map ? d['user'] : null;
    if (u is! Map) return const DebridErr('parse-error');
    return DebridOk(
      Account(
        slug: DebridSlug.ad,
        username: u['username']?.toString(),
        email: u['email']?.toString(),
        premium: u['isPremium'] == true,
        premiumUntil: (u['premiumUntil'] as num?)?.toInt(),
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
    final r = await _postForm('/magnet/instant', {'magnets[]': batch});
    if (r is DebridErr) return const DebridOk(<String, bool>{});
    final d = r.dataOrNull;
    final magnets = d is Map ? d['magnets'] : null;
    final out = <String, bool>{};
    if (magnets is List) {
      for (final m in magnets.whereType<Map>()) {
        final hash = m['hash']?.toString();
        if (hash != null && m['instant'] == true) {
          out[hash.toLowerCase()] = true;
        }
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

    final add = await _postForm('/magnet/upload', {'magnets[]': fullMagnet});
    if (add is DebridErr) return add.to<DirectLink>();
    final addData = add.dataOrNull;
    final first = (addData is Map && addData['magnets'] is List)
        ? (addData['magnets'] as List).cast<dynamic>().firstOrNull
        : null;
    if (first is! Map) return DebridErr('no-result', raw: addData);
    if (first['error'] != null) {
      final err = first['error'];
      return DebridErr(
        (err is Map ? err['code']?.toString() : null) ?? 'magnet-error',
        raw: err,
      );
    }
    final id = first['id'];

    Map<String, dynamic>? chosenLink;
    for (var attempt = 0; attempt < _pollMaxAttempts; attempt++) {
      if (signal.isAborted) return const DebridErr('aborted');
      final s = await _get('/magnet/status?id=$id');
      if (s is DebridErr) return s.to<DirectLink>();
      final sd = s.dataOrNull;
      final entry = sd is Map ? sd['magnets'] : null;
      if (entry is! Map) {
        await signal.sleep(_pollDelayMs);
        continue;
      }
      final statusCode = (entry['statusCode'] as num?)?.toInt() ?? -1;
      if (statusCode == _readyStatus) {
        chosenLink = _pickAdLink(
          (entry['links'] as List?) ?? const [],
          fileIdx,
          hint,
        );
        break;
      }
      if (_terminalFail.contains(statusCode)) {
        return DebridErr('status-$statusCode', raw: {'hash': hash});
      }
      if (attempt >= 3) {
        return DebridErr(
          'not-cached',
          raw: {'hash': hash, 'statusCode': statusCode},
        );
      }
      await signal.sleep(_pollDelayMs);
    }

    if (chosenLink == null) return const DebridErr('no-link');

    final u = await _get(
      '/link/unlock?link=${Uri.encodeQueryComponent(chosenLink['link'].toString())}',
    );
    if (u is DebridErr) return u.to<DirectLink>();
    final ud = u.dataOrNull;
    if (ud is! Map) return const DebridErr('parse-error');
    final delayed = (ud['delayed'] as num?)?.toInt() ?? 0;
    if (delayed > 0) {
      final settled = await _pollDelayed(delayed, signal);
      if (settled is! DebridOk<Map<String, dynamic>>) {
        return (settled as DebridErr).to<DirectLink>();
      }
      final sd = settled.data;
      return DebridOk(
        DirectLink(
          url: sd['link'].toString(),
          filename: sd['filename']?.toString(),
          filesize: (sd['filesize'] as num?)?.toInt(),
        ),
      );
    }
    return DebridOk(
      DirectLink(
        url: ud['link'].toString(),
        filename: ud['filename']?.toString(),
        filesize: (ud['filesize'] as num?)?.toInt(),
      ),
    );
  }

  Future<DebridResult<Map<String, dynamic>>> _pollDelayed(
    int delayedId,
    AbortSignal signal,
  ) async {
    for (var attempt = 0; attempt < 18; attempt++) {
      if (signal.isAborted) return const DebridErr('aborted');
      await signal.sleep(2500);
      final r = await _get('/link/delayed?id=$delayedId');
      if (r is DebridErr) return r.to<Map<String, dynamic>>();
      final d = r.dataOrNull;
      final status = d is Map ? (d['status'] as num?)?.toInt() : null;
      if (status == 2) return DebridOk((d as Map).cast<String, dynamic>());
      if (status == 3) return const DebridErr('delayed-error');
    }
    return const DebridErr('timeout');
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
    final r = await _get('/magnet/status');
    if (r is DebridErr) return r.to<List<LibraryEntry>>();
    final d = r.dataOrNull;
    final list = d is Map ? d['magnets'] : null;
    final entries = (list is List ? list : const [])
        .whereType<Map>()
        .where((m) => (m['statusCode'] as num?)?.toInt() == _readyStatus)
        .map(
          (m) => LibraryEntry(
            slug: DebridSlug.ad,
            id: m['id'].toString(),
            hash: (m['hash'] ?? '').toString().toLowerCase(),
            name: (m['filename'] ?? m['filename_original'] ?? '').toString(),
            size: (m['size'] as num?)?.toInt(),
            files: ((m['links'] as List?) ?? const [])
                .whereType<Map>()
                .map(
                  (l) => LibraryFile(
                    id: l['link'].toString(),
                    name: (l['filename'] ?? '').toString(),
                    size: (l['size'] as num?)?.toInt() ?? 0,
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
    final upload = await _postForm('/magnet/upload', {'magnets[]': fullMagnet});
    if (upload is DebridErr) return upload.to<List<DebridFile>>();
    final ud = upload.dataOrNull;
    final magnet = (ud is Map && ud['magnets'] is List)
        ? (ud['magnets'] as List).cast<dynamic>().firstOrNull
        : null;
    if (magnet is! Map || magnet['error'] != null) {
      final err = magnet is Map ? magnet['error'] : null;
      return DebridErr(
        (err is Map ? err['code']?.toString() : null) ?? 'no-magnet',
      );
    }
    final id = magnet['id'];

    for (var attempt = 0; attempt < 12; attempt++) {
      if (signal.isAborted) return const DebridErr('aborted');
      final status = await _get('/magnet/status?id=$id');
      if (status is DebridErr) return status.to<List<DebridFile>>();
      final sd = status.dataOrNull;
      final entry = sd is Map ? sd['magnets'] : null;
      final statusCode = entry is Map
          ? (entry['statusCode'] as num?)?.toInt()
          : null;
      if (statusCode == _readyStatus) {
        final links = (entry as Map)['links'] as List? ?? const [];
        final result = <DebridFile>[];
        for (var i = 0; i < links.length; i++) {
          if (signal.isAborted) return const DebridErr('aborted');
          final link = links[i];
          if (link is! Map) continue;
          final u = await _postForm('/link/unlock', {
            'link': link['link'].toString(),
          });
          if (u is DebridErr) continue;
          final uu = u.dataOrNull;
          if (uu is! Map) continue;
          result.add(
            DebridFile(
              id: i.toString(),
              name: (link['filename'] ?? '').toString(),
              size: (link['size'] as num?)?.toInt() ?? 0,
              url: uu['link']?.toString(),
            ),
          );
        }
        if (result.isEmpty) continue;
        return DebridOk(result);
      }
      if (statusCode != null && statusCode >= 5 && statusCode <= 15) {
        return DebridErr('status-$statusCode');
      }
      await signal.sleep(1500);
    }
    return const DebridErr('timeout');
  }

  // --- helpers ---------------------------------------------------------------

  Map<String, dynamic>? _pickAdLink(
    List<dynamic> links,
    int? fileIdx,
    EpisodeHint? hint,
  ) {
    if (links.isEmpty) return null;
    if (fileIdx != null && fileIdx >= 0 && fileIdx < links.length) {
      return _asMap(links[fileIdx]);
    }
    final videos = links
        .where(
          (l) => kVideoExts.any((ext) => _lname(l).toLowerCase().endsWith(ext)),
        )
        .toList();
    final pool = videos.isEmpty ? links : videos;
    final mi = matchEpisodeFileIndex(pool.map(_lname).toList(), hint);
    if (mi >= 0) return _asMap(pool[mi]);
    final sorted = [...pool]
      ..sort(
        (a, b) =>
            ((b['size'] as num?)?.toInt() ?? 0) -
            ((a['size'] as num?)?.toInt() ?? 0),
      );
    return sorted.isEmpty ? null : _asMap(sorted.first);
  }

  String _lname(dynamic l) => (l['filename'] ?? '').toString();
  Map<String, dynamic>? _asMap(dynamic l) =>
      l is Map ? l.cast<String, dynamic>() : null;

  Future<DebridResult<dynamic>> _get(String path) =>
      _wrap(() => _http.get(_withAgent(path), headers: _headers()));

  Future<DebridResult<dynamic>> _postForm(
    String path,
    Map<String, Object> body,
  ) => _wrap(
    () => _http.postForm(
      _withAgent(path),
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
    if (s == 429) return const DebridErr('rate-limited', status: 429);
    if (!res.ok && s != 200) {
      return DebridErr('http-$s', status: s, raw: res.body);
    }
    final env = res.body;
    if (env is! Map) return DebridErr('parse-error', status: s);
    if (env['status'] != 'success') {
      final err = env['error'];
      return DebridErr(
        (err is Map ? err['code']?.toString() : null) ?? 'ad-error',
        status: s,
        raw: err ?? env,
      );
    }
    return DebridOk(env['data']);
  }
}
