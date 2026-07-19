import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A tracker the anime progress-sync writes to.
enum SyncTracker {
  mal('MyAnimeList'),
  anilist('AniList');

  const SyncTracker(this.displayName);

  /// The brand name shown in the sync toast (never translated).
  final String displayName;
}

/// The phase of a sync push, shown in the toast. Ported from the `SyncEvent`
/// kinds in `mal/sync.ts` + `anilist/sync.ts`.
enum SyncKind { syncing, synced, watching, error }

/// A transient anime-sync status, surfaced by the player's [SyncToast].
class SyncEvent {
  const SyncEvent({
    required this.tracker,
    required this.kind,
    required this.title,
    this.episode,
  });

  final SyncTracker tracker;
  final SyncKind kind;
  final String title;
  final int? episode;
}

/// Holds the latest anime-sync event; the anime-sync services emit into it and
/// the player's toast listens. Null when there is nothing to show.
class SyncEventsNotifier extends Notifier<SyncEvent?> {
  @override
  SyncEvent? build() => null;

  void emit(SyncEvent event) => state = event;
}

final syncEventsProvider = NotifierProvider<SyncEventsNotifier, SyncEvent?>(
  SyncEventsNotifier.new,
);
