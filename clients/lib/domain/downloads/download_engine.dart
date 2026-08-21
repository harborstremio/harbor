import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';

import 'download_file.dart';
import 'download_filename.dart';
import 'downloads_store.dart';

// The download engine, ported from the store's `enqueue`/`pause`/`resume`/
// `cancel`/`remove` orchestration in `docs/60`. It drives [downloadToFile] and
// persists progress/status to a [DownloadsStore], exposing the live list via
// [items]. The byte fetch and the downloads directory are injected so the engine
// is platform-agnostic and testable; the app wires a Dio source + a
// path_provider directory.

class _Handle {
  bool canceled = false;
  bool paused = false;
}

/// A request to download a resolved stream.
class DownloadRequest {
  const DownloadRequest({
    required this.metaId,
    required this.title,
    required this.url,
    this.subtitle,
    this.poster,
    this.season,
    this.episode,
    this.streamLabel,
    this.releaseInfo,
    this.headers,
  });

  final String metaId;
  final String title;
  final String url;
  final String? subtitle;
  final String? poster;
  final int? season;
  final int? episode;
  final String? streamLabel;
  final String? releaseInfo;
  final Map<String, String>? headers;
}

class DownloadEngine {
  DownloadEngine({
    required this.store,
    required this.sourceFor,
    required this.downloadsDir,
    int Function()? now,
  }) : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch) {
    items.value = store.list();
  }

  final DownloadsStore store;

  /// Builds a ranged byte source for [url] (the app supplies a Dio-backed one).
  final ByteRangeSource Function(String url, Map<String, String>? headers)
  sourceFor;

  /// Resolves the destination directory (the app uses path_provider).
  final Future<String> Function() downloadsDir;

  final int Function() _now;

  /// The live download list (newest-first), for the Downloads view.
  final ValueNotifier<List<DownloadItem>> items = ValueNotifier(const []);

  final Map<String, _Handle> _handles = {};
  final Map<String, Future<void>> _runs = {};

  void _refresh() => items.value = store.list();

  String _newId() =>
      _now().toRadixString(36) + Random().nextInt(1 << 20).toRadixString(36);

  /// Enqueues [req]: builds the item, persists it as `downloading`, and starts
  /// the download.
  Future<DownloadItem> enqueue(DownloadRequest req) async {
    final dir = await downloadsDir();
    final filename = buildDefaultFilename(
      name: req.title,
      url: req.url,
      releaseInfo: req.releaseInfo,
      season: req.season,
      episode: req.episode,
      streamLabel: req.streamLabel,
    );
    final item = DownloadItem(
      id: _newId(),
      metaId: req.metaId,
      title: req.title.isNotEmpty ? req.title : 'Download',
      subtitle: req.subtitle,
      poster: req.poster,
      season: req.season,
      episode: req.episode,
      streamLabel: req.streamLabel,
      url: req.url,
      path: '$dir/$filename',
      status: DownloadStatus.downloading,
      receivedBytes: 0,
      totalBytes: null,
      ratio: 0,
      bytesPerSec: 0,
      error: null,
      startedAt: _now(),
    );
    await store.upsert(item);
    _refresh();
    _runs[item.id] = _run(item, req.headers);
    return item;
  }

  Future<void> _run(DownloadItem item, Map<String, String>? headers) async {
    final handle = _Handle();
    _handles[item.id] = handle;
    try {
      final outcome = await downloadToFile(
        destPath: item.path,
        source: sourceFor(item.url, headers),
        onProgress: (r, t) {
          if (_handles[item.id] != handle) return;
          final cur = store.byId(item.id);
          if (cur == null) return;
          store.upsert(
            cur.copyWith(
              receivedBytes: r,
              totalBytes: t,
              ratio: (t != null && t > 0) ? r / t : 0,
            ),
          );
          _refresh();
        },
        isCancelled: () => handle.canceled,
      );
      if (_handles[item.id] != handle) return; // superseded by pause/resume
      _handles.remove(item.id);
      final cur = store.byId(item.id);
      if (cur == null) return;
      if (outcome.canceled) {
        if (handle.paused) return; // pause() already set the status
        await store.upsert(cur.copyWith(status: DownloadStatus.canceled));
      } else {
        await store.upsert(
          cur.copyWith(
            status: DownloadStatus.done,
            ratio: 1,
            receivedBytes: outcome.received,
          ),
        );
      }
      _refresh();
    } catch (e) {
      if (_handles[item.id] != handle) return;
      _handles.remove(item.id);
      final cur = store.byId(item.id);
      if (cur == null) return;
      await store.upsert(
        cur.copyWith(
          status: DownloadStatus.error,
          error: e is DownloadException ? e.message : e.toString(),
        ),
      );
      _refresh();
    }
  }

  /// Pauses a live download: aborts the fetch (the `.part` remains) and marks it
  /// paused.
  Future<void> pause(String id) async {
    final h = _handles.remove(id);
    if (h != null) {
      h.paused = true;
      h.canceled = true;
    }
    final cur = store.byId(id);
    if (cur != null && cur.status == DownloadStatus.downloading) {
      await store.upsert(cur.copyWith(status: DownloadStatus.paused));
      _refresh();
    }
  }

  /// Resumes a paused download from its `.part` (a fresh Range request).
  Future<void> resume(String id, [Map<String, String>? headers]) async {
    final cur = store.byId(id);
    if (cur == null || cur.status != DownloadStatus.paused) return;
    final reset = cur.copyWith(
      status: DownloadStatus.downloading,
      receivedBytes: 0,
      ratio: 0,
      bytesPerSec: 0,
    );
    await store.upsert(reset);
    _refresh();
    _runs[id] = _run(reset, headers);
  }

  /// Cancels a download (the `.part` is left on disk).
  Future<void> cancel(String id) async {
    final h = _handles.remove(id);
    if (h != null) h.canceled = true;
    final cur = store.byId(id);
    if (cur != null) {
      await store.upsert(cur.copyWith(status: DownloadStatus.canceled));
      _refresh();
    }
  }

  /// Removes a download and deletes its file and `.part` (best-effort).
  Future<void> remove(String id) async {
    final h = _handles.remove(id);
    if (h != null) h.canceled = true;
    final cur = store.byId(id);
    await store.remove(id);
    _refresh();
    if (cur != null) {
      for (final p in [cur.path, '${cur.path}.part']) {
        try {
          final f = File(p);
          if (await f.exists()) await f.delete();
        } catch (_) {
          // best-effort
        }
      }
    }
  }

  /// The in-flight run for [id] (test hook to await completion).
  @visibleForTesting
  Future<void>? runFuture(String id) => _runs[id];
}
