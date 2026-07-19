import 'dart:convert';

import '../../core/storage/kv_store.dart';

// The offline-downloads data layer, ported from `src/lib/download/downloads-store.ts`
// (`docs/60`). The model + persistence live here; the native download engine and
// the Downloads view consume this store.

/// A download's lifecycle state. `interrupted` is produced only by hydration —
/// a download that was mid-flight when the app closed.
enum DownloadStatus {
  downloading,
  paused,
  done,
  error,
  canceled,
  interrupted;

  static DownloadStatus fromName(String? s) {
    for (final v in DownloadStatus.values) {
      if (v.name == s) return v;
    }
    return DownloadStatus.error;
  }
}

/// The number of in-flight (downloading) items — the top-bar downloads badge
/// count. The one definition shared by the live badge and [DownloadsStore].
int activeDownloadCount(List<DownloadItem> items) =>
    items.where((i) => i.status == DownloadStatus.downloading).length;

/// One queued/finished download. Ports the web `DownloadItem` field-for-field.
class DownloadItem {
  const DownloadItem({
    required this.id,
    required this.metaId,
    required this.title,
    required this.subtitle,
    required this.poster,
    required this.season,
    required this.episode,
    required this.streamLabel,
    required this.url,
    required this.path,
    required this.status,
    required this.receivedBytes,
    required this.totalBytes,
    required this.ratio,
    required this.bytesPerSec,
    required this.error,
    required this.startedAt,
  });

  final String id;
  final String metaId;
  final String title;
  final String? subtitle;
  final String? poster;
  final int? season;
  final int? episode;
  final String? streamLabel;
  final String url;
  final String path;
  final DownloadStatus status;
  final int receivedBytes;
  final int? totalBytes;
  final double ratio;

  /// Live speed sample — never persisted (reset to 0 on write).
  final int bytesPerSec;
  final String? error;
  final int startedAt;

  DownloadItem copyWith({
    DownloadStatus? status,
    int? receivedBytes,
    int? totalBytes,
    double? ratio,
    int? bytesPerSec,
    String? error,
  }) => DownloadItem(
    id: id,
    metaId: metaId,
    title: title,
    subtitle: subtitle,
    poster: poster,
    season: season,
    episode: episode,
    streamLabel: streamLabel,
    url: url,
    path: path,
    status: status ?? this.status,
    receivedBytes: receivedBytes ?? this.receivedBytes,
    totalBytes: totalBytes ?? this.totalBytes,
    ratio: ratio ?? this.ratio,
    bytesPerSec: bytesPerSec ?? this.bytesPerSec,
    error: error ?? this.error,
    startedAt: startedAt,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'metaId': metaId,
    'title': title,
    'subtitle': subtitle,
    'poster': poster,
    'season': season,
    'episode': episode,
    'streamLabel': streamLabel,
    'url': url,
    'path': path,
    'status': status.name,
    'receivedBytes': receivedBytes,
    'totalBytes': totalBytes,
    'ratio': ratio,
    'bytesPerSec': bytesPerSec,
    'error': error,
    'startedAt': startedAt,
  };

  /// Parses a stored item, or null when `id`/`path` is missing or non-string
  /// (the web skips those on hydrate).
  static DownloadItem? fromJson(Map<String, dynamic> j) {
    final id = j['id'];
    final path = j['path'];
    if (id is! String || id.isEmpty || path is! String || path.isEmpty) {
      return null;
    }
    return DownloadItem(
      id: id,
      metaId: (j['metaId'] ?? '').toString(),
      title: (j['title'] ?? 'Download').toString(),
      subtitle: j['subtitle'] as String?,
      poster: j['poster'] as String?,
      season: (j['season'] as num?)?.toInt(),
      episode: (j['episode'] as num?)?.toInt(),
      streamLabel: j['streamLabel'] as String?,
      url: (j['url'] ?? '').toString(),
      path: path,
      status: DownloadStatus.fromName(j['status'] as String?),
      receivedBytes: (j['receivedBytes'] as num?)?.toInt() ?? 0,
      totalBytes: (j['totalBytes'] as num?)?.toInt(),
      ratio: (j['ratio'] as num?)?.toDouble() ?? 0,
      bytesPerSec: 0,
      error: j['error'] as String?,
      startedAt: (j['startedAt'] as num?)?.toInt() ?? 0,
    );
  }
}

/// The persistent downloads store (`harbor.downloads.v1`). Hydrates once —
/// rewriting any `downloading` item to `interrupted` (the process died
/// mid-download) — then persists mutations with live speed zeroed.
class DownloadsStore {
  DownloadsStore(this._kv);

  static const _key = 'harbor.downloads.v1';

  final KvStore _kv;
  List<DownloadItem>? _cache;

  List<DownloadItem> _hydrate() {
    if (_cache != null) return _cache!;
    final raw = _kv.getString(_key);
    final items = <DownloadItem>[];
    if (raw != null && raw.isNotEmpty) {
      try {
        for (final j in (jsonDecode(raw) as List)) {
          final item = DownloadItem.fromJson(
            (j as Map).cast<String, dynamic>(),
          );
          if (item == null) continue;
          items.add(
            item.status == DownloadStatus.downloading
                ? item.copyWith(
                    status: DownloadStatus.interrupted,
                    bytesPerSec: 0,
                  )
                : item.copyWith(bytesPerSec: 0),
          );
        }
      } catch (_) {
        // corrupt blob: start empty
      }
    }
    _cache = items;
    _persist(); // durably record the interrupted rewrite
    return _cache!;
  }

  Future<void> _persist() {
    final all = _cache ?? const [];
    return _kv.setString(
      _key,
      jsonEncode([for (final i in all) i.copyWith(bytesPerSec: 0).toJson()]),
    );
  }

  /// All downloads, newest first (by `startedAt`).
  List<DownloadItem> list() {
    final items = [..._hydrate()]
      ..sort((a, b) => b.startedAt.compareTo(a.startedAt));
    return items;
  }

  /// The item with [id], or null.
  DownloadItem? byId(String id) {
    for (final i in _hydrate()) {
      if (i.id == id) return i;
    }
    return null;
  }

  /// Inserts or replaces [item] and persists.
  Future<void> upsert(DownloadItem item) async {
    final items = _hydrate();
    final idx = items.indexWhere((i) => i.id == item.id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.add(item);
    }
    await _persist();
  }

  /// Removes the item with [id] and persists.
  Future<void> remove(String id) async {
    _hydrate().removeWhere((i) => i.id == id);
    await _persist();
  }

  /// The number of in-flight downloads (for the nav badge).
  int activeCount() => activeDownloadCount(_hydrate());
}
