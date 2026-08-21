import 'mal_client.dart';
import 'mal_watched.dart';

/// The outcome of a progress push, so callers can surface a sync toast.
enum MalSyncOutcome {
  /// The watched count was advanced to the played episode.
  synced,

  /// The user's MyAnimeList progress already covers this episode.
  upToDate,

  /// MyAnimeList did not confirm the new count.
  failed,
}

/// Pushes [episode] as the watched-episode count for [malId] when it advances
/// the user's current progress, marking the title `completed` on its last
/// episode. Ported from `syncMalProgress` in `src/lib/mal/sync.ts` — the dedup
/// is the fetched current count (no persistent sent-map needed).
Future<MalSyncOutcome> syncMalProgress({
  required MalClient client,
  required String accessToken,
  required int malId,
  required int episode,
  void Function()? onStart,
}) async {
  if (episode < 1) return MalSyncOutcome.upToDate;
  final info = await fetchMalListEntry(client, accessToken, malId);
  final current = info?.entry?.numEpisodesWatched ?? 0;
  if (episode <= current) return MalSyncOutcome.upToDate;
  final total = info?.numEpisodes ?? 0;
  final status = total > 0 && episode >= total ? 'completed' : 'watching';
  onStart?.call();
  final saved = await client.patchListStatus(
    malId,
    form: {'num_watched_episodes': '$episode', 'status': status},
    accessToken: accessToken,
  );
  final savedWatched = (saved?['num_episodes_watched'] as num?)?.toInt();
  return savedWatched == episode
      ? MalSyncOutcome.synced
      : MalSyncOutcome.failed;
}

/// Sets the title's status to `watching` when it is unlisted or only planned —
/// ported from `markMalWatching`. An already-active status (watching /
/// completed / on-hold / dropped) is left untouched so the sync never regresses
/// the user's own state. Returns whether it wrote the `watching` status.
Future<bool> markMalWatching({
  required MalClient client,
  required String accessToken,
  required int malId,
}) async {
  final info = await fetchMalListEntry(client, accessToken, malId);
  final status = info?.entry?.status;
  if (status != null && status != 'plan_to_watch') return false;
  await client.patchListStatus(
    malId,
    form: {'status': 'watching'},
    accessToken: accessToken,
  );
  return true;
}
