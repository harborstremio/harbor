import 'anilist_client.dart';

/// The result of a `SaveMediaListEntry` write — the entry id AniList assigned
/// plus the status and progress it settled on. Ported from `SavedEntry` in the
/// web `anilist/mutations.ts`.
class AnilistSavedEntry {
  const AnilistSavedEntry({
    required this.id,
    required this.status,
    required this.progress,
  });

  final int id;
  final String status;
  final int progress;
}

const _toggleCommentLikeMutation =
    r'mutation ($id: Int) { ToggleLikeV2(id: $id, type: THREAD_COMMENT) '
    r'{ ... on ThreadComment { id likeCount isLiked } } }';

/// Toggles the signed-in user's like on an AniList thread comment, returning
/// the fresh (likeCount, isLiked) AniList reports, or null on failure. Ports the
/// web `toggleCommentLike`.
Future<({int likeCount, bool isLiked})?> toggleAnilistCommentLike(
  AnilistClient client,
  String accessToken,
  int commentId,
) async {
  try {
    final data = await client.request(
      _toggleCommentLikeMutation,
      variables: {'id': commentId},
      accessToken: accessToken,
    );
    final r = data?['ToggleLikeV2'];
    if (r is! Map) return null;
    return (
      likeCount: (r['likeCount'] as num?)?.toInt() ?? 0,
      isLiked: r['isLiked'] == true,
    );
  } catch (_) {
    return null;
  }
}

const _saveEntryMutation =
    r'mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int) '
    r'{ SaveMediaListEntry(mediaId: $mediaId, status: $status, '
    r'progress: $progress) { id status progress } }';

const _deleteEntryMutation =
    r'mutation ($id: Int) { DeleteMediaListEntry(id: $id) { deleted } }';

/// Writes the user's status and/or progress for a title on AniList, returning
/// the entry AniList persisted so the caller can reconcile its optimistic state.
/// Ported 1:1 from the web `saveListEntry`; the caller supplies the resolved
/// access token. Returns null when AniList omits the entry from its response.
Future<AnilistSavedEntry?> saveAnilistListEntry(
  AnilistClient client, {
  required String accessToken,
  required int mediaId,
  String? status,
  int? progress,
}) async {
  final data = await client.request(
    _saveEntryMutation,
    variables: {'mediaId': mediaId, 'status': ?status, 'progress': ?progress},
    accessToken: accessToken,
  );
  final saved = data?['SaveMediaListEntry'];
  if (saved is! Map) return null;
  final id = (saved['id'] as num?)?.toInt();
  if (id == null) return null;
  return AnilistSavedEntry(
    id: id,
    status: saved['status']?.toString() ?? '',
    progress: (saved['progress'] as num?)?.toInt() ?? 0,
  );
}

/// Removes a media-list entry from the user's AniList by its entry id, returning
/// whether AniList confirmed the deletion. Ported from the web `deleteListEntry`.
Future<bool> deleteAnilistListEntry(
  AnilistClient client, {
  required String accessToken,
  required int entryId,
}) async {
  final data = await client.request(
    _deleteEntryMutation,
    variables: {'id': entryId},
    accessToken: accessToken,
  );
  final deleted = data?['DeleteMediaListEntry'];
  return deleted is Map && deleted['deleted'] == true;
}
