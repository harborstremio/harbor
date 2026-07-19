import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/anilist/anilist_lists.dart';
import '../domain/anilist/anilist_mutations.dart';
import '../domain/anilist/anilist_types.dart';
import 'anilist_providers.dart';
import 'providers.dart';

/// The load state of the AniList collection tab.
enum AnilistCollectionPhase { loading, ready, error }

/// The AniList library tab's state — the flattened media-list entries, the load
/// phase, and the set of entry ids with a mutation in flight (so their card
/// controls disable). Ported from the web `AnilistTab` local state.
class AnilistCollectionState {
  const AnilistCollectionState({
    required this.phase,
    required this.entries,
    required this.busy,
  });

  final AnilistCollectionPhase phase;
  final List<AnilistMediaEntry> entries;
  final Set<int> busy;

  AnilistCollectionState copyWith({
    AnilistCollectionPhase? phase,
    List<AnilistMediaEntry>? entries,
    Set<int>? busy,
  }) => AnilistCollectionState(
    phase: phase ?? this.phase,
    entries: entries ?? this.entries,
    busy: busy ?? this.busy,
  );
}

/// Loads, caches and mutates the signed-in user's AniList collection for the
/// Library tab. Seeds from the local cache synchronously for an instant paint,
/// then fetches fresh; status/progress/remove edits apply optimistically and
/// reconcile against AniList's response. Ported 1:1 from the web `AnilistTab`.
class AnilistCollectionController extends Notifier<AnilistCollectionState> {
  int _generation = 0;

  @override
  AnilistCollectionState build() {
    final connect = ref.watch(anilistConnectProvider);
    final session = connect is AnilistConnectDone ? connect.session : null;
    final gen = ++_generation;
    if (session == null) {
      return const AnilistCollectionState(
        phase: AnilistCollectionPhase.ready,
        entries: [],
        busy: {},
      );
    }
    _load(session, gen);
    final cached = _cache.read(session.userId);
    return AnilistCollectionState(
      phase: cached != null
          ? AnilistCollectionPhase.ready
          : AnilistCollectionPhase.loading,
      entries: cached != null ? _flatten(cached) : const [],
      busy: const {},
    );
  }

  /// The current session read (not watched) — for use outside [build].
  AnilistSession? _readSession() {
    final connect = ref.read(anilistConnectProvider);
    return connect is AnilistConnectDone ? connect.session : null;
  }

  AnilistCollectionCache get _cache =>
      AnilistCollectionCache(ref.read(kvStoreProvider));

  List<AnilistMediaEntry> _flatten(List<AnilistListGroup> groups) => [
    for (final g in groups) ...g.entries,
  ];

  Future<void> _load(AnilistSession session, int gen) async {
    try {
      final groups = await fetchAnilistMediaListCollection(
        ref.read(anilistClientProvider),
        session.userId,
        accessToken: session.accessToken,
      );
      if (gen != _generation) return;
      await _cache.write(session.userId, groups);
      state = state.copyWith(
        phase: AnilistCollectionPhase.ready,
        entries: _flatten(groups),
      );
    } catch (_) {
      if (gen != _generation) return;
      if (state.entries.isEmpty) {
        state = state.copyWith(phase: AnilistCollectionPhase.error);
      }
    }
  }

  /// Re-fetches the collection from AniList, keeping the current entries visible.
  Future<void> refresh() async {
    final session = _readSession();
    if (session == null) return;
    await _load(session, _generation);
  }

  void _setBusy(int entryId, bool on) {
    final next = {...state.busy};
    if (on) {
      next.add(entryId);
    } else {
      next.remove(entryId);
    }
    state = state.copyWith(busy: next);
  }

  void _patch(int entryId, {String? status, int? progress}) {
    state = state.copyWith(
      entries: [
        for (final e in state.entries)
          if (e.entryId == entryId)
            e.copyWith(status: status, progress: progress)
          else
            e,
      ],
    );
  }

  /// Sets the user's status for [entry], advancing progress to the finale when
  /// the new status is `COMPLETED` and the total is known.
  Future<void> commitStatus(AnilistMediaEntry entry, String next) async {
    final id = entry.entryId;
    final token = _readSession()?.accessToken;
    if (id == null || token == null) return;
    final total = entry.media.episodes;
    final completing = next == 'COMPLETED' && total != null;
    _setBusy(id, true);
    _patch(id, status: next, progress: completing ? total : null);
    try {
      final saved = await saveAnilistListEntry(
        ref.read(anilistClientProvider),
        accessToken: token,
        mediaId: entry.media.id,
        status: next,
        progress: completing ? total : null,
      );
      if (saved != null) {
        _patch(id, status: saved.status, progress: saved.progress);
      }
    } catch (_) {
      _patch(id, status: entry.status, progress: entry.progress);
    } finally {
      _setBusy(id, false);
    }
  }

  /// Sets the watched-episode count for [entry].
  Future<void> commitProgress(AnilistMediaEntry entry, int next) async {
    final id = entry.entryId;
    final token = _readSession()?.accessToken;
    if (id == null || token == null || next < 0) return;
    _setBusy(id, true);
    _patch(id, progress: next);
    try {
      final saved = await saveAnilistListEntry(
        ref.read(anilistClientProvider),
        accessToken: token,
        mediaId: entry.media.id,
        progress: next,
      );
      if (saved != null) {
        _patch(id, status: saved.status, progress: saved.progress);
      }
    } catch (_) {
      _patch(id, progress: entry.progress);
    } finally {
      _setBusy(id, false);
    }
  }

  /// Removes [entry] from the user's AniList, restoring it if the delete fails.
  Future<void> commitRemove(AnilistMediaEntry entry) async {
    final id = entry.entryId;
    final token = _readSession()?.accessToken;
    if (id == null || token == null) return;
    final prev = state.entries;
    _setBusy(id, true);
    state = state.copyWith(
      entries: [
        for (final e in state.entries)
          if (e.entryId != id) e,
      ],
    );
    try {
      await deleteAnilistListEntry(
        ref.read(anilistClientProvider),
        accessToken: token,
        entryId: id,
      );
    } catch (_) {
      state = state.copyWith(entries: prev);
    } finally {
      _setBusy(id, false);
    }
  }
}

/// The signed-in user's AniList collection for the Library tab.
final anilistCollectionProvider =
    NotifierProvider<AnilistCollectionController, AnilistCollectionState>(
      AnilistCollectionController.new,
    );
