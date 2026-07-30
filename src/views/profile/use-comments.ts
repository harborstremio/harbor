import { useCallback, useEffect, useRef, useState } from "react";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { deleteComment, fetchComments, postComment, ProfileApiError, setCommentLike } from "./profile-api";
import type { Comment, LoadState } from "./profile-types";
import { extractMentions, stripUrls, validateComment, type ComposeIssue } from "./text-safety";

export type CommentsController = {
  state: LoadState;
  comments: Comment[];
  total: number;
  cursor?: string;
  hasMore: boolean;
  loadMore: () => void;
  submit: (raw: string, replyToId?: string) => Promise<ComposeIssue>;
  remove: (id: string) => void;
  toggleLike: (id: string) => void;
  sending: boolean;
};

export function useComments(handle: string): CommentsController {
  const authKey = useAuthorKey();
  const [state, setState] = useState<LoadState>("loading");
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!handle) return;
    const ac = new AbortController();
    setState("loading");
    setComments([]);
    setCursor(undefined);
    fetchComments(handle, undefined, ac.signal)
      .then((page) => {
        if (ac.signal.aborted) return;
        setComments(page.comments);
        setTotal(page.total ?? page.comments.length);
        setCursor(page.nextCursor);
        setHasMore(!!page.nextCursor);
        setState(page.comments.length ? "ready" : "empty");
      })
      .catch(() => !ac.signal.aborted && setState("error"));
    return () => ac.abort();
  }, [handle, authKey]);

  const loadMore = useCallback(() => {
    if (!cursor) return;
    void fetchComments(handle, cursor).then((page) => {
      setComments((cur) => [...cur, ...page.comments]);
      if (typeof page.total === "number") setTotal(page.total);
      setCursor(page.nextCursor);
      setHasMore(!!page.nextCursor);
    });
  }, [handle, cursor, authKey]);

  const submit = useCallback(
    async (raw: string, replyToId?: string): Promise<ComposeIssue> => {
      const issue = validateComment(raw, lastSentAt.current, Date.now());
      if (issue) return issue;
      if (!authKey) return "spam";
      const clean = stripUrls(raw.trim());
      const mentions = extractMentions(clean);
      setSending(true);
      try {
        const created = await postComment(handle, clean, { replyToId, mentions });
        lastSentAt.current = Date.now();
        setComments((cur) => [created, ...cur]);
        setState("ready");
        return null;
      } catch (e) {
        return e instanceof ProfileApiError && e.status === 429 ? "cooldown" : "spam";
      } finally {
        setSending(false);
      }
    },
    [handle, authKey],
  );

  const remove = useCallback(
    (id: string) => {
      if (!authKey) return;
      const prev = comments;
      setComments((cur) => cur.filter((c) => c.id !== id));
      void deleteComment(handle, id).catch(() => setComments(prev));
    },
    [handle, authKey, comments],
  );

  const toggleLike = useCallback(
    (id: string) => {
      if (!authKey) return;
      const cur = comments.find((c) => c.id === id);
      if (!cur) return;
      const nextLiked = !cur.liked;
      const apply = (liked: boolean, count: number) =>
        setComments((cs) => cs.map((c) => (c.id === id ? { ...c, liked, likeCount: count } : c)));
      apply(nextLiked, Math.max(0, (cur.likeCount ?? 0) + (nextLiked ? 1 : -1)));
      void setCommentLike(handle, id, nextLiked)
        .then((r) => apply(r.liked, r.likeCount))
        .catch(() => apply(!!cur.liked, cur.likeCount ?? 0));
    },
    [handle, authKey, comments],
  );

  return { state, comments, total, cursor, hasMore, loadMore, submit, remove, toggleLike, sending };
}

function useAuthorKey(): string | null {
  const [key, setKey] = useState<string | null>(() => currentAuthor()?.handle ?? null);
  useEffect(() => subscribeAuthor(() => setKey(currentAuthor()?.handle ?? null)), []);
  return key;
}
