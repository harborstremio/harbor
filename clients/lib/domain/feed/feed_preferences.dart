import 'dart:convert';

import '../../core/storage/kv_store.dart';

/// An explicit thumbs up/down on a Discover title, ported from `FeedVote`.
enum FeedVote { up, down }

/// The per-title feed votes that steer Discover: a downvote hides the title from
/// the feed, an upvote biases toward it. Ported 1:1 from `preferences.ts`;
/// persisted to [KvStore] under `harbor.feed-prefs.v1`. Inject [clock] for tests.
class FeedPreferencesStore {
  FeedPreferencesStore(this._kv, {DateTime Function() clock = DateTime.now})
    : _clock = clock;

  final KvStore _kv;
  final DateTime Function() _clock;

  static const _key = 'harbor.feed-prefs.v1';

  /// The stored votes, keyed by meta id, or empty when none are readable.
  Map<String, FeedVote> load() {
    final raw = _kv.getString(_key);
    if (raw == null) return {};
    try {
      final parsed = jsonDecode(raw);
      final votes = parsed is Map ? parsed['votes'] : null;
      if (votes is! Map) return {};
      final out = <String, FeedVote>{};
      for (final entry in votes.entries) {
        final key = entry.key;
        final vote = _parseVote(entry.value);
        if (key is String && vote != null) out[key] = vote;
      }
      return out;
    } catch (_) {
      return {};
    }
  }

  /// The current vote for [metaId], or null.
  FeedVote? getVote(String metaId) => load()[metaId];

  /// Sets (or clears, when [vote] is null) the vote for [metaId], persisting the
  /// new state and stamping `updatedAt`.
  Future<void> setVote(String metaId, FeedVote? vote) async {
    final votes = load();
    if (vote == null) {
      votes.remove(metaId);
    } else {
      votes[metaId] = vote;
    }
    await _write(votes);
  }

  /// The ids the user has downvoted — hidden from the feed.
  Set<String> downvotedIds() => {
    for (final entry in load().entries)
      if (entry.value == FeedVote.down) entry.key,
  };

  /// The ids the user has upvoted.
  Set<String> upvotedIds() => {
    for (final entry in load().entries)
      if (entry.value == FeedVote.up) entry.key,
  };

  Future<void> _write(Map<String, FeedVote> votes) => _kv.setString(
    _key,
    jsonEncode({
      'votes': {for (final e in votes.entries) e.key: _voteWire(e.value)},
      'updatedAt': _clock().millisecondsSinceEpoch,
    }),
  );

  static FeedVote? _parseVote(Object? v) => switch (v) {
    'up' => FeedVote.up,
    'down' => FeedVote.down,
    _ => null,
  };

  static String _voteWire(FeedVote v) => v == FeedVote.up ? 'up' : 'down';
}
