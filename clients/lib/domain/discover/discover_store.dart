import 'dart:convert';

import '../../core/storage/kv_store.dart';
import 'affinity.dart';

/// The persistent discover event log and the taste [Affinity] it derives. Ported
/// 1:1 from `store.ts`; persisted to [KvStore] under `harbor.discover.v1`. Only
/// the event log is stored — the affinity is rebuilt from it. Inject [clock] for
/// tests.
class AffinityStore {
  AffinityStore(this._kv, {DateTime Function() clock = DateTime.now})
    : _clock = clock {
    _events = _loadEvents();
  }

  final KvStore _kv;
  final DateTime Function() _clock;

  static const _key = 'harbor.discover.v1';
  static const _maxEvents = 500;
  static const _dupWindowMs = 90000;

  late List<DiscoverEvent> _events;
  Affinity? _affinity;
  bool _dirty = true;

  int get _now => _clock().millisecondsSinceEpoch;

  List<DiscoverEvent> _loadEvents() {
    final raw = _kv.getString(_key);
    if (raw == null) return [];
    try {
      final parsed = jsonDecode(raw);
      final events = parsed is Map ? parsed['events'] : null;
      if (events is! List) return [];
      return [for (final e in events) ?DiscoverEvent.fromJson(e)];
    } catch (_) {
      return [];
    }
  }

  /// The current taste affinity, rebuilt from the event log when stale. Ported
  /// from `getStore` + `flushAffinity`.
  Affinity affinity() {
    if (_dirty || _affinity == null) {
      _affinity = buildAffinity(_events, now: _now);
      _dirty = false;
    }
    return _affinity!;
  }

  /// The recorded events, newest last.
  List<DiscoverEvent> get events => List.unmodifiable(_events);

  /// Records an interaction, ported 1:1 from `trackEvent`: a repeat of the very
  /// last event with the same id and kind inside the 90-second dedup window just
  /// updates its meta; otherwise it appends (evicting the oldest past 500). The
  /// affinity is marked stale and the log is persisted.
  Future<void> trackEvent(
    String id,
    EventKind kind, {
    ProfileSnapshot? meta,
    int? ts,
  }) async {
    if (id.isEmpty) return;
    final now = ts ?? _now;
    final recent = _events.isNotEmpty ? _events.last : null;
    if (recent != null &&
        recent.id == id &&
        recent.kind == kind &&
        now - recent.ts < _dupWindowMs) {
      if (meta != null) {
        _events[_events.length - 1] = DiscoverEvent(
          id: recent.id,
          kind: recent.kind,
          ts: recent.ts,
          meta: meta,
        );
      }
    } else {
      _events.add(DiscoverEvent(id: id, kind: kind, ts: now, meta: meta));
      while (_events.length > _maxEvents) {
        _events.removeAt(0);
      }
    }
    _dirty = true;
    await _persist();
  }

  /// Wipes the log and affinity, ported from `clearStore`.
  Future<void> clear() async {
    _events = [];
    _affinity = freshAffinity();
    _dirty = false;
    await _kv.remove(_key);
  }

  Future<void> _persist() => _kv.setString(
    _key,
    jsonEncode({
      'events': [for (final e in _events) e.toJson()],
    }),
  );
}
