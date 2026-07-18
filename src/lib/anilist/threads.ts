import { anilistRequest } from "./client";
import { getSession } from "./session";

export type AnilistUser = {
  id: number;
  name: string;
  avatar: string | null;
};

export type AnilistThread = {
  id: number;
  title: string;
  bodyHtml: string | null;
  replyCount: number;
  viewCount: number;
  isLocked: boolean;
  isSticky: boolean;
  createdAt: number;
  updatedAt: number;
  siteUrl: string | null;
  user: AnilistUser;
};

export type AnilistThreadComment = {
  id: number;
  commentHtml: string;
  likeCount: number;
  isLiked: boolean;
  createdAt: number;
  siteUrl: string | null;
  user: AnilistUser;
};

type RawUser = {
  id: number;
  name: string;
  avatar: { medium: string | null; large: string | null } | null;
};

type RawThread = {
  id: number;
  title: string;
  bodyHtml: string | null;
  replyCount: number;
  viewCount: number;
  isLocked: boolean;
  isSticky: boolean;
  createdAt: number;
  updatedAt: number;
  siteUrl: string | null;
  user: RawUser | null;
};

type RawThreadComment = {
  id: number;
  commentHtml: string;
  likeCount: number;
  isLiked: boolean;
  createdAt: number;
  siteUrl: string | null;
  user: RawUser | null;
};

function mapUser(raw: RawUser | null): AnilistUser {
  return {
    id: raw?.id ?? 0,
    name: raw?.name ?? "Unknown",
    avatar: raw?.avatar?.medium ?? raw?.avatar?.large ?? null,
  };
}

function mapThread(raw: RawThread): AnilistThread {
  return {
    id: raw.id,
    title: raw.title,
    bodyHtml: raw.bodyHtml,
    replyCount: raw.replyCount,
    viewCount: raw.viewCount,
    isLocked: raw.isLocked,
    isSticky: raw.isSticky,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    siteUrl: raw.siteUrl,
    user: mapUser(raw.user),
  };
}

function mapComment(raw: RawThreadComment): AnilistThreadComment {
  return {
    id: raw.id,
    commentHtml: raw.commentHtml,
    likeCount: raw.likeCount,
    isLiked: raw.isLiked,
    createdAt: raw.createdAt,
    siteUrl: raw.siteUrl,
    user: mapUser(raw.user),
  };
}

const THREADS_QUERY = `query ($mediaId: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    threads(mediaCategoryId: $mediaId, sort: [ID_DESC]) {
      id title bodyHtml: body(asHtml: true) replyCount viewCount isLocked isSticky
      createdAt updatedAt siteUrl
      user { id name avatar { medium large } }
    }
    pageInfo { currentPage lastPage hasNextPage }
  }
}`;

type ThreadsResponse = {
  Page: {
    threads: RawThread[] | null;
    pageInfo: { currentPage: number; lastPage: number; hasNextPage: boolean };
  };
};

export async function fetchThreads(
  mediaId: number,
  page = 1,
  perPage = 20,
): Promise<{ threads: AnilistThread[]; hasNextPage: boolean }> {
  const data = await anilistRequest<ThreadsResponse>(THREADS_QUERY, {
    mediaId,
    page,
    perPage,
  });
  const raw = data?.Page?.threads ?? [];
  return {
    threads: raw.map(mapThread),
    hasNextPage: !!data?.Page?.pageInfo?.hasNextPage,
  };
}

const COMMENTS_QUERY = `query ($threadId: Int) {
  Page {
    threadComments(threadId: $threadId, sort: [ID]) {
      id commentHtml: comment(asHtml: true) likeCount isLiked createdAt siteUrl
      user { id name avatar { medium large } }
    }
  }
}`;

type CommentsResponse = {
  Page: { threadComments: RawThreadComment[] | null };
};

export async function fetchThreadComments(threadId: number): Promise<AnilistThreadComment[]> {
  const data = await anilistRequest<CommentsResponse>(COMMENTS_QUERY, { threadId });
  const raw = data?.Page?.threadComments ?? [];
  return raw.map(mapComment);
}

const SAVE_COMMENT_MUTATION = `mutation ($threadId: Int, $comment: String) {
  SaveThreadComment(threadId: $threadId, comment: $comment) {
    id commentHtml: comment(asHtml: true) likeCount isLiked createdAt siteUrl
    user { id name avatar { medium large } }
  }
}`;

type SaveCommentResponse = { SaveThreadComment: RawThreadComment };

export async function postThreadComment(
  threadId: number,
  comment: string,
): Promise<AnilistThreadComment> {
  const data = await anilistRequest<SaveCommentResponse>(SAVE_COMMENT_MUTATION, {
    threadId,
    comment,
  });
  return mapComment(data.SaveThreadComment);
}

const SAVE_THREAD_MUTATION = `mutation ($title: String, $body: String, $categories: [Int], $mediaCategories: [Int]) {
  SaveThread(title: $title, body: $body, categories: $categories, mediaCategories: $mediaCategories) {
    id title bodyHtml: body(asHtml: true) replyCount viewCount isLocked isSticky
    createdAt updatedAt siteUrl
    user { id name avatar { medium large } }
  }
}`;

type SaveThreadResponse = { SaveThread: RawThread };

export async function createThread(
  title: string,
  body: string,
  mediaId: number,
): Promise<AnilistThread> {
  const data = await anilistRequest<SaveThreadResponse>(SAVE_THREAD_MUTATION, {
    title,
    body: body || null,
    categories: [1],
    mediaCategories: [mediaId],
  });
  return mapThread(data.SaveThread);
}

const TOGGLE_LIKE_MUTATION = `mutation ($id: Int) {
  ToggleLikeV2(id: $id, type: THREAD_COMMENT) {
    ... on ThreadComment { id likeCount isLiked }
  }
}`;

type ToggleLikeResponse = {
  ToggleLikeV2: { id: number; likeCount: number; isLiked: boolean } | null;
};

export async function toggleCommentLike(
  commentId: number,
): Promise<{ likeCount: number; isLiked: boolean } | null> {
  const data = await anilistRequest<ToggleLikeResponse>(TOGGLE_LIKE_MUTATION, {
    id: commentId,
  });
  const r = data?.ToggleLikeV2;
  if (!r) return null;
  return { likeCount: r.likeCount, isLiked: r.isLiked };
}

const DELETE_COMMENT_MUTATION = `mutation ($id: Int) {
  DeleteThreadComment(id: $id) { deleted }
}`;

export async function deleteThreadComment(commentId: number): Promise<void> {
  await anilistRequest<{ DeleteThreadComment: { deleted: boolean } }>(DELETE_COMMENT_MUTATION, {
    id: commentId,
  });
}

export function isAnilistConnected(): boolean {
  const s = getSession();
  if (!s) return false;
  return Date.now() < s.expiresAt;
}
