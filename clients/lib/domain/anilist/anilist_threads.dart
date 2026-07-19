import 'anilist_client.dart';
import 'anilist_types.dart';

/// The AniList forum-thread read layer that backs the detail-page "AniList
/// comments" section (gated on the `showAnilistComments` setting). Ported from
/// the read half of the web `anilist/threads.ts`; the write mutations
/// (post/create/like/delete) are intentionally not part of the read-only port.

const _threadsQuery = r'''query ($mediaId: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    threads(mediaCategoryId: $mediaId, sort: [ID_DESC]) {
      id title bodyHtml: body(asHtml: true) replyCount viewCount isLocked isSticky
      createdAt updatedAt siteUrl
      user { id name avatar { medium large } }
    }
    pageInfo { currentPage lastPage hasNextPage }
  }
}''';

/// One page of a media's threads plus whether more pages follow.
typedef AnilistThreadsPage = ({List<AnilistThread> threads, bool hasNextPage});

/// The threads discussing [mediaId] (`fetchThreads`). Public read — an
/// [accessToken] is optional and only affects per-user fields.
Future<AnilistThreadsPage> fetchAnilistThreads(
  AnilistClient client,
  int mediaId, {
  int page = 1,
  int perPage = 20,
  String? accessToken,
}) async {
  final data = await client.request(
    _threadsQuery,
    variables: {'mediaId': mediaId, 'page': page, 'perPage': perPage},
    accessToken: accessToken,
    skipAuth: accessToken == null,
  );
  final pageData = data?['Page'];
  final rawThreads = pageData is Map ? pageData['threads'] : null;
  final threads = rawThreads is List
      ? [for (final r in rawThreads) ?AnilistThread.fromJson(r)]
      : <AnilistThread>[];
  final pageInfo = pageData is Map ? pageData['pageInfo'] : null;
  final hasNextPage = pageInfo is Map && pageInfo['hasNextPage'] == true;
  return (threads: threads, hasNextPage: hasNextPage);
}

const _commentsQuery = r'''query ($threadId: Int) {
  Page {
    threadComments(threadId: $threadId, sort: [ID]) {
      id commentHtml: comment(asHtml: true) likeCount isLiked createdAt siteUrl
      user { id name avatar { medium large } }
    }
  }
}''';

/// The comments in [threadId] (`fetchThreadComments`).
Future<List<AnilistThreadComment>> fetchAnilistThreadComments(
  AnilistClient client,
  int threadId, {
  String? accessToken,
}) async {
  final data = await client.request(
    _commentsQuery,
    variables: {'threadId': threadId},
    accessToken: accessToken,
    skipAuth: accessToken == null,
  );
  final pageData = data?['Page'];
  final raw = pageData is Map ? pageData['threadComments'] : null;
  return raw is List
      ? [for (final r in raw) ?AnilistThreadComment.fromJson(r)]
      : <AnilistThreadComment>[];
}
