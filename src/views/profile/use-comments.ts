import { useCallback, useEffect, useRef, useState } from "react";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import {
  deleteComment,
  fetchComments,
  postComment,
  ProfileApiError,
  setCommentLike,
} from "./profile-api";
import type { Comment, LoadState } from "./profile-types";
import { stripUrls, validateComment, type ComposeIssue } from "./text-safety";

export type CommentsController = {
  state: LoadState;
  comments: Comment[];
  total: number;
  cursor?: string;
  hasMore: boolean;
  loadMore: () => void;
  submit: (raw: string, parentId?: string) => Promise<ComposeIssue>;
  remove: (id: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
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
  const pending = useRef(new Set<string>());
  const identity = `${handle}:${authKey}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;

  useEffect(() => {
    setSending(false);
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
    void fetchComments(handle, cursor)
      .then((page) => {
        if (identityRef.current !== identity) return;
        setComments((cur) => [...cur, ...page.comments]);
        if (typeof page.total === "number") setTotal(page.total);
        setCursor(page.nextCursor);
        setHasMore(!!page.nextCursor);
      })
      .catch(() => {
        if (identityRef.current === identity) setState("error");
      });
  }, [handle, cursor, authKey]);

  const submit = useCallback(
    async (raw: string, parentId?: string): Promise<ComposeIssue> => {
      const issue = validateComment(raw, lastSentAt.current, Date.now());
      if (issue) return issue;
      if (!authKey) return "signin";
      const clean = stripUrls(raw.trim());
      setSending(true);
      try {
        const created = await postComment(handle, clean, parentId);
        if (identityRef.current !== identity || currentAuthor()?.handle !== authKey) return null;
        lastSentAt.current = Date.now();
        setComments((cur) => [{ ...created, parentId: created.parentId ?? parentId }, ...cur]);
        setTotal((value) => value + 1);
        setState("ready");
        return null;
      } catch (e) {
        return e instanceof ProfileApiError && e.status === 429 ? "cooldown" : "failed";
      } finally {
        if (identityRef.current === identity) setSending(false);
      }
    },
    [handle, authKey],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!authKey || identityRef.current !== identity || currentAuthor()?.handle !== authKey)
        throw new Error("Sign in to perform this action.");
      if (authKey.toLowerCase() !== handle.toLowerCase())
        throw new Error("You no longer have permission to delete this comment.");
      if (pending.current.has(id)) throw new Error("This comment is being updated.");
      if (!comments.some((comment) => comment.id === id))
        throw new Error("This comment is no longer available.");
      pending.current.add(id);
      try {
        await deleteComment(handle, id);
        if (identityRef.current !== identity) return;
        setComments((cur) => cur.filter((c) => c.id !== id));
        setTotal((value) => Math.max(0, value - 1));
        // The server owns reply deletion/orphaning semantics. Refresh its page
        // rather than making assumptions about the removed comment's children.
        try {
          const page = await fetchComments(handle);
          if (identityRef.current !== identity) return;
          setComments(page.comments);
          setTotal(page.total ?? page.comments.length);
          setCursor(page.nextCursor);
          setHasMore(!!page.nextCursor);
          setState(page.comments.length ? "ready" : "empty");
        } catch {
          throw new Error("The comment was deleted, but replies could not be refreshed.");
        }
      } finally {
        pending.current.delete(id);
      }
    },
    [handle, authKey, comments],
  );

  const toggleLike = useCallback(
    async (id: string) => {
      if (!authKey || identityRef.current !== identity || currentAuthor()?.handle !== authKey)
        throw new Error("Sign in to perform this action.");
      if (pending.current.has(id)) throw new Error("This comment is being updated.");
      const cur = comments.find((c) => c.id === id);
      if (!cur) throw new Error("This comment is no longer available.");
      const nextLiked = !cur.liked;
      pending.current.add(id);
      try {
        const result = await setCommentLike(handle, id, nextLiked);
        if (identityRef.current !== identity) return;
        setComments((cs) =>
          cs.map((c) =>
            c.id === id ? { ...c, liked: result.liked, likeCount: result.likeCount } : c,
          ),
        );
      } finally {
        pending.current.delete(id);
      }
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
