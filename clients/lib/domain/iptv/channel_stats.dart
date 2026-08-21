import 'dart:convert';

import '../../core/storage/kv_store.dart';
import 'm3u.dart';

/// The play threshold at which a channel is treated as "most watched". Ports
/// `MOST_WATCHED_MIN`.
const int mostWatchedMinPlays = 3;

const int _maxEntries = 600;

/// A recorded channel play tally. Ports `ChannelStat`.
class ChannelStat {
  const ChannelStat({
    required this.id,
    required this.name,
    this.logo,
    this.group,
    required this.url,
    required this.sourceId,
    required this.count,
    required this.lastAt,
  });

  final String id;
  final String name;
  final String? logo;
  final String? group;
  final String url;
  final String sourceId;
  final int count;
  final int lastAt;
}

/// Tracks per-channel play counts under `harbor.iptv.stats.v1` (LRU-pruned to
/// 600 entries), matching the web app's key/shape so state round-trips. Ports
/// `iptv/channel-stats.ts` (React reactivity is provided by the Riverpod
/// controller that wraps this store).
class ChannelStatsStore {
  ChannelStatsStore(this._kv, {int Function()? clock})
    : _clock = clock ?? (() => DateTime.now().millisecondsSinceEpoch);

  final KvStore _kv;
  final int Function() _clock;
  static const String _key = 'harbor.iptv.stats.v1';
  Map<String, ChannelStat>? _cache;

  Map<String, ChannelStat> _load() {
    final cached = _cache;
    if (cached != null) return cached;
    final map = <String, ChannelStat>{};
    final raw = _kv.getString(_key);
    if (raw != null) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map) {
          for (final e in decoded.entries) {
            final stat = _parseStat(e.value);
            if (stat != null) map[e.key.toString()] = stat;
          }
        }
      } catch (_) {}
    }
    return _cache = map;
  }

  /// Records a play of [ch], bumping its count and timestamp. Ports
  /// `recordChannelPlay`.
  Future<void> record(IptvChannel ch) async {
    if (ch.url.isEmpty) return;
    final map = {..._load()};
    final prev = map[ch.id];
    map[ch.id] = ChannelStat(
      id: ch.id,
      name: ch.name,
      logo: ch.logo,
      group: ch.group,
      url: ch.url,
      sourceId: ch.id.split('::').first,
      count: (prev?.count ?? 0) + 1,
      lastAt: _clock(),
    );
    await _persist(_prune(map));
  }

  /// The play count for a channel id. Ports `channelPlayCount`.
  int playCount(String id) => _load()[id]?.count ?? 0;

  /// The most-played channels (ties broken by recency). Ports `topChannels`.
  List<ChannelStat> topChannels(int limit, {String? sourceId}) {
    final all = _bySource(_load().values, sourceId)
      ..sort((a, b) {
        final byCount = b.count.compareTo(a.count);
        return byCount != 0 ? byCount : b.lastAt.compareTo(a.lastAt);
      });
    return all.take(limit).toList();
  }

  /// The most recently played channels. Ports `recentChannels`.
  List<ChannelStat> recentChannels(int limit, {String? sourceId}) {
    final all = _bySource(_load().values, sourceId)
      ..sort((a, b) => b.lastAt.compareTo(a.lastAt));
    return all.take(limit).toList();
  }

  /// Clears every stat. Ports `clearChannelStats`.
  Future<void> clear() => _persist(const {});

  /// Drops stats for a source's channels. Ports `removeStatsForSource`.
  Future<void> removeForSource(String sourceId) async {
    if (sourceId.isEmpty) return;
    final map = _load();
    final prefix = '$sourceId::';
    var changed = false;
    final next = <String, ChannelStat>{};
    map.forEach((id, stat) {
      if (stat.sourceId == sourceId || id.startsWith(prefix)) {
        changed = true;
      } else {
        next[id] = stat;
      }
    });
    if (changed) await _persist(next);
  }

  List<ChannelStat> _bySource(Iterable<ChannelStat> stats, String? sourceId) {
    final usable = stats.where((s) => s.url.isNotEmpty);
    return (sourceId != null
            ? usable.where((s) => s.sourceId == sourceId)
            : usable)
        .toList();
  }

  Map<String, ChannelStat> _prune(Map<String, ChannelStat> map) {
    if (map.length <= _maxEntries) return map;
    final entries = map.values.toList()
      ..sort((a, b) => b.lastAt.compareTo(a.lastAt));
    return {for (final e in entries.take(_maxEntries)) e.id: e};
  }

  Future<void> _persist(Map<String, ChannelStat> map) async {
    _cache = map;
    await _kv.setString(
      _key,
      jsonEncode({for (final e in map.entries) e.key: _toJson(e.value)}),
    );
  }

  static Map<String, Object?> _toJson(ChannelStat s) => {
    'id': s.id,
    'name': s.name,
    'logo': s.logo,
    'group': s.group,
    'url': s.url,
    'sourceId': s.sourceId,
    'count': s.count,
    'lastAt': s.lastAt,
  };

  static ChannelStat? _parseStat(Object? v) {
    if (v is! Map) return null;
    final id = v['id'];
    final url = v['url'];
    if (id is! String || url is! String) return null;
    return ChannelStat(
      id: id,
      name: (v['name'] ?? '').toString(),
      logo: v['logo'] is String ? v['logo'] as String : null,
      group: v['group'] is String ? v['group'] as String : null,
      url: url,
      sourceId: (v['sourceId'] ?? '').toString(),
      count: (v['count'] as num?)?.toInt() ?? 0,
      lastAt: (v['lastAt'] as num?)?.toInt() ?? 0,
    );
  }
}
