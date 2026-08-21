import 'dart:convert';

import '../../core/storage/kv_store.dart';
import 'community_index.dart';

/// A star-count snapshot at a point in time, ported from the web velocity
/// `Snapshot`.
class VelocitySnapshot {
  const VelocitySnapshot({required this.fetchedAt, required this.stars});

  final int fetchedAt;
  final Map<String, num> stars;

  Map<String, dynamic> toJson() => {'fetchedAt': fetchedAt, 'stars': stars};

  factory VelocitySnapshot.fromJson(Map<String, dynamic> j) => VelocitySnapshot(
    fetchedAt: (j['fetchedAt'] as num?)?.toInt() ?? 0,
    stars: {
      for (final e in ((j['stars'] as Map?) ?? const {}).entries)
        e.key.toString(): (e.value is num ? e.value as num : 0),
    },
  );
}

/// A community addon that gained stars over a window, ported from `MoverEntry`.
class MoverEntry {
  const MoverEntry({
    required this.community,
    required this.delta,
    required this.windowDays,
  });

  final SACommunity community;
  final num delta;
  final int windowDays;
}

const _velocityKey = 'harbor.stremio-addons.velocity.v1';
const _maxSnapshots = 14;
const _minDelta = 5;
const _oneDayMs = 24 * 60 * 60 * 1000;
const _halfDayMs = 12 * 60 * 60 * 1000;

/// Tracks community-addon star velocity across daily snapshots to surface the
/// "top movers", ported 1:1 from `stremio-addons-velocity.ts`. Snapshots persist
/// in the key-value store; movers compare the current index against the earliest
/// snapshot.
class AddonsVelocityStore {
  AddonsVelocityStore(
    this._kv,
    this._index, {
    DateTime Function() clock = DateTime.now,
  }) : _clock = clock;

  final KvStore _kv;
  final CommunityIndex _index;
  final DateTime Function() _clock;

  int get _now => _clock().millisecondsSinceEpoch;

  List<VelocitySnapshot> _read() {
    final raw = _kv.getString(_velocityKey);
    if (raw == null || raw.isEmpty) return const [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return const [];
      final snaps = decoded['snapshots'];
      if (snaps is! List) return const [];
      return [
        for (final s in snaps)
          if (s is Map) VelocitySnapshot.fromJson(s.cast<String, dynamic>()),
      ];
    } catch (_) {
      return const [];
    }
  }

  Future<void> _write(List<VelocitySnapshot> snaps) => _kv.setString(
    _velocityKey,
    jsonEncode({
      'snapshots': [for (final s in snaps) s.toJson()],
    }),
  );

  bool _shouldCapture(List<VelocitySnapshot> existing) {
    if (existing.isEmpty) return true;
    return _now - existing.last.fetchedAt > _halfDayMs;
  }

  VelocitySnapshot? _capture() {
    final idx = _index.getIndex();
    if (idx == null) return null;
    return VelocitySnapshot(
      fetchedAt: _now,
      stars: {for (final e in idx.byManifestId.values) e.uuid: e.stars},
    );
  }

  /// Captures a fresh snapshot if enough time has elapsed, ported from
  /// `recordVelocitySnapshot`.
  Future<void> recordSnapshot() async {
    try {
      await _index.ensureIndex();
    } catch (_) {
      // Keep whatever snapshots exist.
    }
    final snaps = _read();
    if (!_shouldCapture(snaps)) return;
    final snap = _capture();
    if (snap == null) return;
    final next = [...snaps, snap];
    await _write(
      next.length > _maxSnapshots
          ? next.sublist(next.length - _maxSnapshots)
          : next,
    );
  }

  /// The top movers by star gain since the earliest snapshot, ported from
  /// `computeMovers`. Empty until at least two snapshots exist.
  List<MoverEntry> computeMovers([int limit = 8]) {
    final idx = _index.getIndex();
    if (idx == null) return const [];
    final snaps = _read();
    if (snaps.length < 2) return const [];
    final earliest = snaps.first;
    final rounded = ((_now - earliest.fetchedAt) / _oneDayMs).round();
    final windowDays = rounded < 1 ? 1 : rounded;

    final out = <MoverEntry>[];
    for (final entry in idx.byManifestId.values) {
      final prior = earliest.stars[entry.uuid];
      if (prior == null) continue;
      final delta = entry.stars - prior;
      if (delta < _minDelta) continue;
      out.add(
        MoverEntry(community: entry, delta: delta, windowDays: windowDays),
      );
    }
    out.sort((a, b) => b.delta.compareTo(a.delta));
    return out.length > limit ? out.sublist(0, limit) : out;
  }
}
