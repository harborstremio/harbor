import '../../core/abort_signal.dart';
import '../streams/episode_file.dart';
import '../streams/parser/stream_enums.dart';
import 'debrid_http.dart';
import 'debrid_types.dart';

/// Real-Debrid provider, ported from `src/lib/debrid/realdebrid.ts`. Resolution
/// adds the magnet, polls torrent info, selects the video file(s), and
/// unrestricts the resulting link. RD removed instant-availability, so
/// [cacheCheck] is a no-op empty map.
class RealDebrid implements DebridStore {
  RealDebrid(this._apiKey, this._http, {int pollDelayMs = 600})
    : _pollDelayMs = pollDelayMs;

  static const _base = 'https://api.real-debrid.com/rest/1.0';
  static const _pollMaxAttempts = 18;
  static final Map<String, ({int at, List<LibraryEntry> data})> _libraryCache =
      {};

  final String _apiKey;
  final DebridHttp _http;
  final int _pollDelayMs;

  @override
  DebridSlug get slug => DebridSlug.rd;

  @override
  String get name => 'Real-Debrid';

  Map<String, String> _headers([Map<String, String>? extra]) => {
    'Authorization': 'Bearer $_apiKey',
    'Accept': 'application/json',
    ...?extra,
  };

  @override
  Future<DebridResult<Account>> account(AbortSignal signal) async {
    final r = await _get('/user');
    if (r is DebridErr) return r.to<Account>();
    final u = r.dataOrNull;
    if (u is! Map) return const DebridErr('parse-error');
    final expiration = u['expiration']?.toString();
    final expiresAt = expiration != null ? DateTime.tryParse(expiration) : null;
    return DebridOk(
      Account(
        slug: DebridSlug.rd,
        username: u['username']?.toString(),
        email: u['email']?.toString(),
        premium: ((u['premium'] as num?) ?? 0) > 0,
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
  ) async => const DebridOk(<String, bool>{});

  @override
  Future<DebridResult<QueueId>> queueCache(
    String magnet,
    AbortSignal signal,
  ) async => const DebridErr('unsupported');

  @override
  Future<DebridResult<DirectLink>> playableUrl(
    String magnet,
    int? fileIdx,
    AbortSignal signal, {
    EpisodeHint? hint,
  }) async {
    final hash = hashFromMagnet(magnet);
    final fullMagnet = magnetFromHash(magnet);

    final add = await _postForm('/torrents/addMagnet', {'magnet': fullMagnet});
    if (add is DebridErr) return add.to<DirectLink>();
    final addMap = add.dataOrNull;
    if (addMap is! Map || addMap['id'] == null) {
      return const DebridErr('parse-error');
    }
    final id = addMap['id'].toString();

    Map<String, dynamic>? infoData;
    var selected = false;
    int? effIdx = fileIdx;
    int? ensureIdx(List<dynamic> files) {
      if (effIdx == null && hint != null) {
        final mi = matchEpisodeFileIndex(
          files.map((f) => (f['path'] ?? '').toString()).toList(),
          hint,
        );
        if (mi >= 0) effIdx = mi;
      }
      return effIdx;
    }

    for (var attempt = 0; attempt < _pollMaxAttempts; attempt++) {
      if (signal.isAborted) {
        await _delEmpty('/torrents/delete/$id');
        return const DebridErr('aborted');
      }
      final info = await _get('/torrents/info/$id');
      if (info is DebridErr) return info.to<DirectLink>();
      final data = info.dataOrNull;
      if (data is! Map) return const DebridErr('parse-error');
      infoData = data.cast<String, dynamic>();
      final status = infoData['status']?.toString();
      final files = (infoData['files'] as List?) ?? const [];

      if (status == 'magnet_error') {
        await _delEmpty('/torrents/delete/$id');
        return const DebridErr('magnet-error');
      }
      if ((status == 'magnet_conversion' ||
              status == 'waiting_files_selection') &&
          !selected) {
        final fileIds = _pickRdFiles(files, ensureIdx(files));
        if (fileIds.isEmpty) {
          await _delEmpty('/torrents/delete/$id');
          return const DebridErr('no-video-file');
        }
        final sel = await _postForm('/torrents/selectFiles/$id', {
          'files': fileIds.join(','),
        });
        if (sel is DebridErr) return sel.to<DirectLink>();
        selected = true;
        await signal.sleep(_pollDelayMs);
        continue;
      }
      if (status == 'downloaded') break;
      if (status == 'downloading' || status == 'queued') {
        await _delEmpty('/torrents/delete/$id');
        return DebridErr(
          'not-cached',
          raw: {'hash': hash, 'progress': infoData['progress']},
        );
      }
      if (status == 'error' || status == 'virus' || status == 'dead') {
        await _delEmpty('/torrents/delete/$id');
        return DebridErr(status!);
      }
      await signal.sleep(_pollDelayMs);
    }

    if (infoData == null || infoData['status'] != 'downloaded') {
      await _delEmpty('/torrents/delete/$id');
      return const DebridErr('timeout');
    }

    final links = (infoData['links'] as List?) ?? const [];
    if (links.isEmpty) return const DebridErr('no-link');
    final files = (infoData['files'] as List?) ?? const [];
    final linkIdx = _pickLinkIndex(files, ensureIdx(files), links.length);
    final link = links[linkIdx].toString();

    final u = await _postForm('/unrestrict/link', {'link': link});
    if (u is DebridErr) return u.to<DirectLink>();
    final um = u.dataOrNull;
    if (um is! Map || um['download'] == null) {
      return const DebridErr('parse-error');
    }
    return DebridOk(
      DirectLink(
        url: um['download'].toString(),
        filename: um['filename']?.toString(),
        filesize: (um['filesize'] as num?)?.toInt(),
      ),
    );
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
    final all = <Map<String, dynamic>>[];
    for (var page = 1; page <= 5; page++) {
      final r = await _get('/torrents?limit=100&page=$page');
      if (r is DebridErr) break;
      final list = r.dataOrNull;
      if (list is! List || list.isEmpty) break;
      all.addAll(list.whereType<Map>().map((e) => e.cast<String, dynamic>()));
      if (list.length < 100) break;
    }
    final data = all
        .where((t) => t['status'] == 'downloaded')
        .map(
          (t) => LibraryEntry(
            slug: DebridSlug.rd,
            id: t['id'].toString(),
            hash: (t['hash'] ?? '').toString().toLowerCase(),
            name: (t['filename'] ?? '').toString(),
            size: (t['bytes'] as num?)?.toInt(),
          ),
        )
        .toList();
    _libraryCache[_apiKey] = (at: nowMs, data: data);
    return DebridOk(data);
  }

  @override
  Future<DebridResult<List<DebridFile>>> listTorrentFiles(
    String hash,
    AbortSignal signal,
  ) async {
    final fullMagnet = magnetFromHash(hash);
    final add = await _postForm('/torrents/addMagnet', {'magnet': fullMagnet});
    if (add is DebridErr) return add.to<List<DebridFile>>();
    final addMap = add.dataOrNull;
    if (addMap is! Map || addMap['id'] == null) {
      return const DebridErr('parse-error');
    }
    final id = addMap['id'].toString();

    for (var attempt = 0; attempt < _pollMaxAttempts; attempt++) {
      if (signal.isAborted) {
        await _delEmpty('/torrents/delete/$id');
        return const DebridErr('aborted');
      }
      final info = await _get('/torrents/info/$id');
      if (info is DebridErr) return info.to<List<DebridFile>>();
      final data = info.dataOrNull;
      if (data is! Map) return const DebridErr('parse-error');
      final status = data['status']?.toString();
      final files = (data['files'] as List?) ?? const [];

      if (status == 'magnet_error') {
        await _delEmpty('/torrents/delete/$id');
        return const DebridErr('magnet-error');
      }
      if (status == 'magnet_conversion' ||
          status == 'waiting_files_selection') {
        final videoIds = files
            .where(
              (f) => kVideoExts.any(
                (ext) =>
                    (f['path'] ?? '').toString().toLowerCase().endsWith(ext),
              ),
            )
            .map((f) => (f['id'] as num).toInt())
            .toList();
        final sel = await _postForm('/torrents/selectFiles/$id', {
          'files': videoIds.join(','),
        });
        if (sel is DebridErr) return sel.to<List<DebridFile>>();
        continue;
      }
      if (status == 'downloaded') {
        final selectedFiles = files.where((f) => f['selected'] == 1).toList();
        final links = (data['links'] as List?) ?? const [];
        final result = <DebridFile>[];
        for (var i = 0; i < selectedFiles.length; i++) {
          if (signal.isAborted) {
            await _delEmpty('/torrents/delete/$id');
            return const DebridErr('aborted');
          }
          if (i >= links.length) continue;
          final u = await _postForm('/unrestrict/link', {
            'link': links[i].toString(),
          });
          if (u is DebridErr) continue;
          final um = u.dataOrNull;
          if (um is! Map) continue;
          final f = selectedFiles[i];
          final path = (f['path'] ?? '').toString();
          result.add(
            DebridFile(
              id: f['id'].toString(),
              name: path.split('/').isNotEmpty ? path.split('/').last : path,
              size: (f['bytes'] as num?)?.toInt() ?? 0,
              url: um['download']?.toString(),
            ),
          );
        }
        if (result.isEmpty) continue;
        return DebridOk(result);
      }
      if (status == 'downloading' ||
          status == 'compressing' ||
          status == 'uploading') {
        await signal.sleep(_pollDelayMs);
        continue;
      }
      if (status == 'error' || status == 'virus' || status == 'dead') {
        await _delEmpty('/torrents/delete/$id');
        return DebridErr(status!);
      }
      await signal.sleep(_pollDelayMs);
    }
    await _delEmpty('/torrents/delete/$id');
    return const DebridErr('timeout');
  }

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
    if (s == 401 || s == 403) {
      final errMsg = (res.map?['error'] ?? '').toString();
      final code =
          RegExp(r'subscription|premium', caseSensitive: false).hasMatch(errMsg)
          ? 'not-premium'
          : 'unauthorized';
      return DebridErr(code, status: s, raw: res.body);
    }
    if (s == 402) return const DebridErr('not-premium', status: 402);
    if (s == 429) return const DebridErr('rate-limited', status: 429);
    if (s == 503 || s == 504) {
      return DebridErr('upstream-unavailable', status: s);
    }
    if (s == 204) return const DebridOk(null);
    if (!res.ok) {
      final code = (res.map?['error'] ?? 'http-$s').toString();
      return DebridErr(code, status: s, raw: res.body);
    }
    return DebridOk(res.body);
  }

  List<int> _pickRdFiles(List<dynamic> files, int? fileIdx) {
    if (fileIdx != null && fileIdx >= 0 && fileIdx < files.length) {
      return [(files[fileIdx]['id'] as num).toInt()];
    }
    final videos = files
        .where(
          (f) => kVideoExts.any(
            (ext) => (f['path'] ?? '').toString().toLowerCase().endsWith(ext),
          ),
        )
        .toList();
    final pool = videos.isEmpty ? files : videos;
    return pool.map((f) => (f['id'] as num).toInt()).toList();
  }

  int _pickLinkIndex(List<dynamic> files, int? fileIdx, int linkCount) {
    if (fileIdx == null || fileIdx < 0 || fileIdx >= files.length) return 0;
    final selectedFiles = files.where((f) => f['selected'] == 1).toList();
    final target = files[fileIdx];
    final offset = selectedFiles.indexWhere((f) => f['id'] == target['id']);
    if (offset < 0) return 0;
    return offset < linkCount ? offset : linkCount - 1;
  }
}
