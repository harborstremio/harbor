import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Settings,
  Trash2,
  Eye,
  Lock,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAnilist } from "@/lib/anilist/provider";
import { resolveAnilistMediaId } from "@/lib/anilist/sync";
import { isAuthenticated, subscribeSession } from "@/lib/anilist/session";
import {
  createThread,
  deleteThreadComment,
  fetchThreadComments,
  fetchThreads,
  postThreadComment,
  toggleCommentLike,
  type AnilistThread,
  type AnilistThreadComment,
} from "@/lib/anilist/threads";
import { AnilistApiError } from "@/lib/anilist/client";
import { useView } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { openUrl } from "@/lib/window";

function extractAnilistError(e: unknown, fallback: string): string {
  if (e instanceof AnilistApiError) {
    try {
      const parsed = JSON.parse(e.body);
      if (parsed.errors && Array.isArray(parsed.errors)) {
        const msgs = parsed.errors.map(
          (err: { message?: string; validation?: Record<string, string[]> }) => {
            if (err.validation) {
              const fields = Object.entries(err.validation).map(
                ([field, rules]) => `${field}: ${Array.isArray(rules) ? rules.join(", ") : rules}`,
              );
              return fields.join("; ");
            }
            return err.message ?? "";
          },
        );
        const msg = msgs.filter(Boolean).join("; ");
        if (msg) return msg;
      }
    } catch {}
    return e.body.slice(0, 160) || `HTTP ${e.status}`;
  }
  return fallback;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp * 1000;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll("script, style, iframe, object, embed, link, meta, form, input, button, svg")
    .forEach((el) => el.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.replace(/\s+/g, "").toLowerCase();
      if (
        name.startsWith("on") ||
        ((name === "href" || name === "src" || name === "xlink:href") &&
          /^(javascript|data|vbscript):/.test(value))
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

function HtmlContent({ html, className }: { html: string; className?: string }) {
  const safe = useMemo(() => sanitizeHtml(html), [html]);
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute("href");
      if (href) openUrl(href);
    }
    if (target.tagName === "IMG") {
      const src = target.getAttribute("src");
      if (src) openUrl(src);
    }
  }, []);

  return (
    <div
      className={className}
      dir="auto"
      dangerouslySetInnerHTML={{ __html: safe }}
      onClick={handleClick}
    />
  );
}

function Avatar({
  src,
  name,
  size = "sm",
}: {
  src: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  const [error, setError] = useState(false);
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const font = size === "sm" ? "text-[12px]" : "text-[14px]";
  const initial = name.charAt(0).toUpperCase();

  if (error || !src) {
    return (
      <div
        className={`flex ${dim} shrink-0 items-center justify-center rounded-full bg-ink-muted/20 ${font} font-semibold text-ink-muted`}
      >
        {initial}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      className={`${dim} shrink-0 rounded-full object-cover`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
}

function CommentRow({
  comment,
  connected,
  ownerId,
  onDelete,
}: {
  comment: AnilistThreadComment;
  connected: boolean;
  ownerId: number | null;
  onDelete: (id: number) => void;
}) {
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [liked, setLiked] = useState(comment.isLiked);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleLike = useCallback(async () => {
    if (liking || !connected) return;
    setLiking(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    try {
      const res = await toggleCommentLike(comment.id);
      if (res) {
        setLiked(res.isLiked);
        setLikeCount(res.likeCount);
      }
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
    }
    setLiking(false);
  }, [liking, connected, liked, comment.id]);

  return (
    <div className="flex gap-3 rounded-xl bg-elevated p-4 ring-1 ring-edge">
      <Avatar src={comment.user.avatar} name={comment.user.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-ink">{comment.user.name}</span>
          <span className="text-[11px] text-ink-muted">{timeAgo(comment.createdAt)}</span>
        </div>
        <HtmlContent
          html={comment.commentHtml}
          className="mt-1.5 text-[13px] leading-relaxed text-ink"
        />
        <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-muted">
          <button
            onClick={handleLike}
            disabled={liking || !connected}
            className={`flex items-center gap-1 transition-colors ${
              liked ? "text-red-400" : "text-ink-muted hover:text-red-400"
            } ${!connected ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {liking ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Heart size={12} fill={liked ? "currentColor" : "none"} />
            )}
            {likeCount}
          </button>
          {comment.user.id === ownerId && (
            <button
              onClick={async () => {
                if (deleting) return;
                setDeleting(true);
                try {
                  await deleteThreadComment(comment.id);
                  onDelete(comment.id);
                } catch {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="flex items-center gap-1 text-ink-muted transition-colors hover:text-red-400 disabled:opacity-50"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  onOpen,
}: {
  thread: AnilistThread;
  onOpen: (thread: AnilistThread) => void;
}) {
  return (
    <button
      onClick={() => onOpen(thread)}
      className="flex w-full items-center gap-3 rounded-xl bg-elevated p-4 text-left ring-1 ring-edge transition-colors hover:bg-raised"
    >
      <Avatar src={thread.user.avatar} name={thread.user.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-ink">{thread.title}</span>
          {thread.isLocked && <Lock size={12} className="shrink-0 text-ink-muted/60" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
          <span>{thread.user.name}</span>
          <span>·</span>
          <span>{timeAgo(thread.createdAt)}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <MessageCircle size={11} /> {thread.replyCount}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Eye size={11} /> {thread.viewCount}
          </span>
        </div>
      </div>
      <ChevronRight size={16} className="dir-icon shrink-0 text-ink-muted" />
    </button>
  );
}

const THREADS_PAGE_SIZE = 20;

export function AnilistComments({ harborId }: { harborId: string | null }) {
  const t = useT();
  const { openSettings } = useView();
  const { settings } = useSettings();
  const { session } = useAnilist();
  const [authed, setAuthed] = useState(() => isAuthenticated());
  const [mediaId, setMediaId] = useState<number | null>(null);
  const [resolving, setResolving] = useState(true);

  const [threads, setThreads] = useState<AnilistThread[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activeThread, setActiveThread] = useState<AnilistThread | null>(null);
  const [comments, setComments] = useState<AnilistThreadComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [showNewThread, setShowNewThread] = useState(false);
  const [threadTitle, setThreadTitle] = useState("");
  const [threadBody, setThreadBody] = useState("");
  const [creatingThread, setCreatingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [blurred, setBlurred] = useState(true);

  const sectionRef = useRef<HTMLElement>(null);
  const scrollYRef = useRef(0);

  useEffect(() => subscribeSession(() => setAuthed(isAuthenticated())), []);

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    setMediaId(null);
    if (!harborId) {
      setResolving(false);
      return;
    }
    resolveAnilistMediaId(harborId)
      .then((id) => {
        if (cancelled) return;
        setMediaId(id);
        setResolving(false);
      })
      .catch(() => {
        if (cancelled) return;
        setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [harborId]);

  const loadThreads = useCallback(
    async (p: number) => {
      if (!mediaId) return;
      const { threads: data, hasNextPage } = await fetchThreads(mediaId, p, THREADS_PAGE_SIZE);
      if (p === 1) {
        setThreads(data);
      } else {
        setThreads((prev) => {
          const ids = new Set(prev.map((x) => x.id));
          return [...prev, ...data.filter((x) => !ids.has(x.id))];
        });
      }
      setHasMore(hasNextPage);
      setPage(p);
    },
    [mediaId],
  );

  useEffect(() => {
    if (!mediaId || !authed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setPage(1);
    let cancelled = false;
    loadThreads(1)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaId, authed, loadThreads]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await loadThreads(page + 1);
    } catch {}
    setLoadingMore(false);
  }, [loadingMore, hasMore, page, loadThreads]);

  const openThread = useCallback((thread: AnilistThread) => {
    scrollYRef.current = window.scrollY;
    setActiveThread(thread);
    setLoadingComments(true);
    setComments([]);
    fetchThreadComments(thread.id)
      .then((data) => setComments(data))
      .catch(() => {})
      .finally(() => setLoadingComments(false));
  }, []);

  const backToThreads = useCallback(() => {
    setActiveThread(null);
    setComments([]);
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollYRef.current);
    });
  }, []);

  useEffect(() => {
    if (!activeThread && scrollYRef.current > 0 && sectionRef.current) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollYRef.current);
      });
    }
  }, [activeThread]);

  const handlePostComment = useCallback(async () => {
    if (!activeThread || !commentText.trim() || posting) return;
    setPostError(null);
    setPosting(true);
    try {
      const created = await postThreadComment(activeThread.id, commentText.trim());
      setComments((prev) => [...prev, created]);
      setCommentText("");
    } catch (e) {
      if (e instanceof AnilistApiError) {
        setPostError(extractAnilistError(e, t("Failed to post comment")));
      } else {
        setPostError(t("Failed to post comment"));
      }
    }
    setPosting(false);
  }, [activeThread, commentText, posting, t]);

  const handleDeleteComment = useCallback((id: number) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleCreateThread = useCallback(async () => {
    if (!mediaId || !threadTitle.trim() || creatingThread) return;
    setThreadError(null);
    setCreatingThread(true);
    try {
      const created = await createThread(threadTitle.trim(), threadBody.trim(), mediaId);
      setThreads((prev) => [created, ...prev]);
      setThreadTitle("");
      setThreadBody("");
      setShowNewThread(false);
    } catch (e) {
      if (e instanceof AnilistApiError) {
        setThreadError(extractAnilistError(e, t("Failed to create thread")));
      } else {
        setThreadError(t("Failed to create thread"));
      }
    }
    setCreatingThread(false);
  }, [mediaId, threadTitle, threadBody, creatingThread, t]);

  if (!harborId || resolving) {
    return null;
  }

  if (!authed) {
    return (
      <section>
        <h2 className="mb-5 text-[20px] font-bold text-ink">{t("AniList Comments")}</h2>
        <div className="rounded-xl border border-edge-soft bg-elevated/60 p-5 text-center">
          <p className="text-[14px] text-ink-muted">
            {t("Connect your AniList account to see forum threads and comments.")}
          </p>
          <p className="mt-3">
            <button
              onClick={() => openSettings("anilist")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02]"
            >
              <Settings size={14} strokeWidth={2.2} />
              {t("Connect AniList")}
            </button>
          </p>
        </div>
      </section>
    );
  }

  if (mediaId === null) {
    return (
      <section>
        <h2 className="mb-5 text-[20px] font-bold text-ink">{t("AniList Comments")}</h2>
        <p className="rounded-xl bg-elevated p-4 text-[13px] text-ink-muted ring-1 ring-edge">
          {t("Could not find this title on AniList.")}
        </p>
      </section>
    );
  }

  return (
    <section ref={sectionRef}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[20px] font-bold text-ink">{t("AniList Comments")}</h2>
        {mediaId && !activeThread && (
          <button
            onClick={() => setShowNewThread(!showNewThread)}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink-muted ring-1 ring-edge transition-colors hover:bg-elevated hover:text-ink"
          >
            <Plus size={12} />
            {t("New thread")}
          </button>
        )}
        {activeThread && (
          <button
            onClick={backToThreads}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink-muted ring-1 ring-edge transition-colors hover:bg-elevated hover:text-ink"
          >
            <ArrowLeft size={12} className="dir-icon" />
            {t("Back to threads")}
          </button>
        )}
      </div>

      <div
        className={`relative rounded-xl ${settings.anilistBlurComments && blurred ? "overflow-hidden" : ""}`}
      >
        {settings.anilistBlurComments && blurred && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center gap-3 pt-16 backdrop-blur-sm"
            style={{
              background:
                "linear-gradient(to bottom, color-mix(in srgb, var(--color-canvas) 5%, transparent) 0%, color-mix(in srgb, var(--color-canvas) 78%, transparent) 40%, color-mix(in srgb, var(--color-canvas) 95%, transparent) 100%)",
            }}
          >
            <button
              onClick={() => setBlurred(false)}
              className="rounded-xl bg-ink px-5 py-2.5 text-[13px] font-semibold text-canvas shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.97]"
            >
              {t("Reveal comments")}
            </button>
            <span className="text-[11px] text-ink-muted/60">{t("Comments are hidden")}</span>
          </div>
        )}
        {showNewThread && !activeThread && (
          <div className="mb-5 rounded-xl bg-elevated p-4 ring-1 ring-edge">
            <input
              value={threadTitle}
              onChange={(e) => setThreadTitle(e.target.value)}
              placeholder={t("Thread title")}
              className="mb-2 w-full rounded-lg bg-raised px-3 py-2 text-[13px] text-ink outline-none ring-1 ring-edge placeholder:text-ink-muted/50 focus:ring-2 focus:ring-ink/20"
            />
            <textarea
              value={threadBody}
              onChange={(e) => setThreadBody(e.target.value)}
              placeholder={t("Thread body (optional)")}
              rows={3}
              className="mb-2 w-full resize-none rounded-lg bg-raised px-3 py-2 text-[13px] text-ink outline-none ring-1 ring-edge placeholder:text-ink-muted/50 focus:ring-2 focus:ring-ink/20"
            />
            {threadError && <p className="mb-2 text-[12px] text-red-400">{threadError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCreateThread}
                disabled={!threadTitle.trim() || creatingThread}
                className={`flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition-all ${
                  !threadTitle.trim() || creatingThread
                    ? "bg-ink-muted/20 text-ink-muted/50 cursor-not-allowed"
                    : "bg-ink text-canvas hover:scale-[1.02]"
                }`}
              >
                {creatingThread ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {t("Create thread")}
              </button>
              <button
                onClick={() => {
                  setShowNewThread(false);
                  setThreadTitle("");
                  setThreadBody("");
                  setThreadError(null);
                }}
                className="rounded-lg px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {t("Cancel")}
              </button>
            </div>
          </div>
        )}

        {activeThread ? (
          <>
            <div className="mb-4 rounded-xl bg-elevated/60 p-4 ring-1 ring-edge">
              <h3 className="text-[16px] font-semibold text-ink">{activeThread.title}</h3>
              {activeThread.bodyHtml && (
                <HtmlContent
                  html={activeThread.bodyHtml}
                  className="mt-1.5 text-[13px] leading-relaxed text-ink-muted"
                />
              )}
              <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-muted">
                <Avatar src={activeThread.user.avatar} name={activeThread.user.name} size="sm" />
                <span>{activeThread.user.name}</span>
                <span>·</span>
                <span>{timeAgo(activeThread.createdAt)}</span>
                {activeThread.siteUrl && (
                  <>
                    <span>·</span>
                    <button
                      onClick={() => openUrl(activeThread.siteUrl!)}
                      className="text-ink-muted underline transition-colors hover:text-ink"
                    >
                      {t("Open on AniList")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {!activeThread.isLocked && (
              <div className="mb-5">
                <div className="flex items-start gap-3">
                  <Avatar src={session?.avatar ?? null} name={session?.userName ?? "?"} size="sm" />
                  <div className="flex flex-1 items-start gap-2">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={t("Write a comment...")}
                      rows={1}
                      className="min-h-[36px] max-h-32 flex-1 resize-none overflow-y-auto rounded-xl bg-elevated px-3.5 py-2 text-[13px] text-ink outline-none ring-1 ring-edge placeholder:text-ink-muted/50 focus:ring-2 focus:ring-ink/20"
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = "auto";
                        el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                      }}
                    />
                    <button
                      onClick={handlePostComment}
                      disabled={!commentText.trim() || posting}
                      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold transition-all ${
                        !commentText.trim() || posting
                          ? "bg-ink-muted/20 text-ink-muted/50 cursor-not-allowed"
                          : "bg-ink text-canvas hover:scale-[1.02]"
                      }`}
                    >
                      {posting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                    </button>
                  </div>
                </div>
                {postError && <p className="mt-2 text-[12px] text-red-400">{postError}</p>}
              </div>
            )}

            {activeThread.isLocked && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-elevated px-3 py-2 text-[12px] text-ink-muted ring-1 ring-edge">
                <Lock size={12} />
                {t("This thread is locked.")}
              </div>
            )}

            {loadingComments && (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 rounded-xl bg-elevated p-4 ring-1 ring-edge">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-ink-muted/20" />
                    <div className="flex-1">
                      <div className="mb-2 h-3 w-24 animate-pulse rounded bg-ink-muted/20" />
                      <div className="mb-1 h-3 w-full animate-pulse rounded bg-ink-muted/20" />
                      <div className="h-3 w-3/4 animate-pulse rounded bg-ink-muted/20" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingComments && comments.length === 0 && (
              <p className="text-[14px] text-ink-muted">{t("No comments yet")}</p>
            )}

            {!loadingComments && (
              <div className="flex flex-col gap-3">
                {comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    connected={!!authed}
                    ownerId={session?.userId ?? null}
                    onDelete={handleDeleteComment}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {loading && (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 rounded-xl bg-elevated p-4 ring-1 ring-edge">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-ink-muted/20" />
                    <div className="flex-1">
                      <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-ink-muted/20" />
                      <div className="mb-1 h-3 w-1/3 animate-pulse rounded bg-ink-muted/20" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && threads.length === 0 && (
              <div className="rounded-xl bg-elevated p-6 text-center ring-1 ring-edge">
                <p className="text-[14px] text-ink-muted">{t("No threads for this title yet.")}</p>
                <p className="mt-1 text-[12px] text-ink-muted/60">
                  {t("Be the first to start a discussion.")}
                </p>
              </div>
            )}

            {!loading && (
              <div className="flex flex-col gap-3">
                {threads.map((th) => (
                  <ThreadRow key={th.id} thread={th} onOpen={openThread} />
                ))}
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="mt-1 flex h-10 items-center justify-center gap-2 rounded-xl border border-edge-soft bg-elevated/40 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:opacity-60"
                  >
                    {loadingMore && <Loader2 size={15} className="animate-spin" />}
                    {loadingMore ? t("Loading more") : t("Load more threads")}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
