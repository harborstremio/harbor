import 'anilist_client.dart';
import 'anilist_watched.dart';

/// The AniList mutation that sets a title's progress (and status). Ported from
/// `SAVE_MUTATION` in `src/lib/anilist/sync.ts`.
const _saveMutation =
    r'mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) '
    r'{ SaveMediaListEntry(mediaId: $mediaId, progress: $progress, '
    r'status: $status) { id progress status } }';

/// The AniList mutation that sets only a title's status. Ported from
/// `SAVE_STATUS_MUTATION`.
const _saveStatusMutation =
    r'mutation ($mediaId: Int, $status: MediaListStatus) '
    r'{ SaveMediaListEntry(mediaId: $mediaId, status: $status) { id status } }';

/// The outcome of a progress push, so callers can surface a sync toast.
enum AnilistSyncOutcome {
  /// The progress was advanced to the played episode.
  synced,

  /// The user's AniList progress already covers this episode.
  upToDate,

  /// AniList did not confirm the new progress.
  failed,
}

/// Pushes [episode] as the progress for [mediaId] when it advances the user's
/// current progress, marking the title `COMPLETED` on its last episode. Ported
/// from `syncAnimeProgress` — the dedup is the fetched current progress.
Future<AnilistSyncOutcome> syncAnilistProgress({
  required AnilistClient client,
  required String accessToken,
  required int mediaId,
  required int episode,
  void Function()? onStart,
}) async {
  if (episode < 1) return AnilistSyncOutcome.upToDate;
  final info = await fetchAnilistListEntry(client, accessToken, mediaId);
  final current = info?.entry?.progress ?? 0;
  if (episode <= current) return AnilistSyncOutcome.upToDate;
  final total = info?.episodes ?? 0;
  final status = total > 0 && episode >= total ? 'COMPLETED' : 'CURRENT';
  onStart?.call();
  final data = await client.request(
    _saveMutation,
    variables: {'mediaId': mediaId, 'progress': episode, 'status': status},
    accessToken: accessToken,
  );
  final saved = data?['SaveMediaListEntry'];
  final savedProgress = saved is Map
      ? (saved['progress'] as num?)?.toInt()
      : null;
  return savedProgress == episode
      ? AnilistSyncOutcome.synced
      : AnilistSyncOutcome.failed;
}

/// Sets the title's status to `CURRENT` when it is unlisted or only planned —
/// ported from `markAnimeWatching`. An already-active status is left untouched
/// so the sync never regresses the user's own state. Returns whether it wrote
/// the `CURRENT` status.
Future<bool> markAnilistWatching({
  required AnilistClient client,
  required String accessToken,
  required int mediaId,
}) async {
  final info = await fetchAnilistListEntry(client, accessToken, mediaId);
  final status = info?.entry?.status;
  if (status != null && status != 'PLANNING') return false;
  await client.request(
    _saveStatusMutation,
    variables: {'mediaId': mediaId, 'status': 'CURRENT'},
    accessToken: accessToken,
  );
  return true;
}
