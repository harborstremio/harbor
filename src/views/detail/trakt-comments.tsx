import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import {
  Heart,
  MessageCircle,
  ChevronDown,
  Settings,
  Loader2,
  Send,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  fetchComments,
  fetchReplies,
  likeComment,
  unlikeComment,
  deleteComment,
  postComment,
  rateContent,
  removeRating,
  type TraktComment,
} from "@/lib/trakt/comments";
import { traktRequest, TraktApiError } from "@/lib/trakt/client";
import type { IdResolution } from "@/lib/trakt/ids";
import { getSession, subscribeSession } from "@/lib/trakt/session";
import { useView } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { openUrl } from "@/lib/window";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function timeAgo(dateStr: string, t: Translate): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("just now");
  if (mins < 60) return t("{n}m ago", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("{n}h ago", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("{n}d ago", { n: days });
  const months = Math.floor(days / 30);
  return t("{n}mo ago", { n: months });
}

function UserAvatar({ username, size = "sm" }: { username?: string | null; size?: "sm" | "md" }) {
  const [error, setError] = useState(false);
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const font = size === "sm" ? "text-[12px]" : "text-[14px]";
  const initial = username ? username.charAt(0).toUpperCase() : "?";

  return (
    <div className={`shrink-0 ${dim}`}>
      {error || !username ? (
        <div
          className={`flex ${dim} items-center justify-center rounded-full bg-ink-muted/20 ${font} font-semibold text-ink-muted`}
        >
          {initial}
        </div>
      ) : (
        <img
          src={`https://walter.trakt.tv/users/${username}/avatars/medium`}
          alt={username}
          className={`${dim} rounded-full object-cover`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}

function StarRow({
  value,
  interactive,
  onRate,
  onHover,
}: {
  value: number;
  interactive: boolean;
  onRate?: (v: number) => void;
  onHover?: (v: number) => void;
}) {
  const [localHover, setLocalHover] = useState(0);
  const display = interactive ? localHover || value : value;
  const starPath =
    "M8 .2a.9.9 0 0 0-.8.6L5.4 5.2.6 5.9a.9.9 0 0 0-.5 1.5l3.5 3.4-1 4.8a.9.9 0 0 0 1.3 1l4.1-2.6 4 2.6a.9.9 0 0 0 1.4-1l-1-4.8 3.4-3.4a.9.9 0 0 0-.5-1.5l-4.8-.7L8.8.8A.9.9 0 0 0 8 .2z";
  const id = useId();

  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((star) => {
        const even = star * 2;
        const odd = star * 2 - 1;
        const clipW = display >= even ? 16 : display >= odd ? 8 : 0;
        const cid = `${id}-${star}`;

        return (
          <span
            key={star}
            className="relative inline-flex items-center justify-center"
            style={{ width: "1.1em", height: "1.1em" }}
          >
            <svg viewBox="0 0 16 16" className="h-full w-full">
              {clipW > 0 && clipW < 16 && (
                <defs>
                  <clipPath id={cid}>
                    <rect x="0" y="0" width={clipW} height="16" />
                  </clipPath>
                </defs>
              )}
              <path d={starPath} fill="#4b5563" opacity="0.3" />
              <path
                d={starPath}
                fill="#facc15"
                clipPath={clipW > 0 && clipW < 16 ? `url(#${cid})` : undefined}
                opacity={clipW > 0 ? 1 : 0}
              />
            </svg>
            {interactive && (
              <span
                className="absolute inset-0 z-10 flex cursor-pointer"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - r.left;
                  onRate?.(x < r.width / 2 ? odd : even);
                }}
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - r.left;
                  const v = x < r.width / 2 ? odd : even;
                  setLocalHover(v);
                  onHover?.(v);
                }}
                onMouseLeave={() => {
                  setLocalHover(0);
                  onHover?.(0);
                }}
              >
                <span className="h-full w-1/2" />
                <span className="h-full w-1/2" />
              </span>
            )}
          </span>
        );
      })}
      {!interactive && value > 0 && (
        <span className="ms-1 text-[12px] font-medium text-ink-muted whitespace-nowrap">
          {value % 2 === 0 ? value / 2 : (value / 2).toFixed(1)}
        </span>
      )}
    </div>
  );
}

function CommentCard({
  comment,
  connected,
  username,
  onDelete,
}: {
  comment: TraktComment;
  connected: boolean;
  username: string | null;
  onDelete: (id: number) => void;
}) {
  const t = useT();
  const [imgError, setImgError] = useState(false);
  const [liking, setLiking] = useState(false);
  const [likes, setLikes] = useState(comment.likes);
  const [revealed, setRevealed] = useState(!comment.spoiler);
  const [replies, setReplies] = useState<TraktComment[] | null>(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const avatar = (() => {
    if (comment.user.avatar) return comment.user.avatar;
    if (comment.user.slug)
      return `https://walter.trakt.tv/users/${comment.user.slug}/avatars/medium`;
    return null;
  })();
  const initial = (comment.user.name ?? comment.user.username).charAt(0).toUpperCase();
  const showImg = avatar && !imgError;

  const handleLike = useCallback(async () => {
    if (liking || !connected) return;
    setLiking(true);
    const wasLiked = likes !== comment.likes;
    if (wasLiked) {
      setLikes((l) => l - 1);
      await unlikeComment(comment.id);
    } else {
      setLikes((l) => l + 1);
      try {
        await likeComment(comment.id);
      } catch {
        setLikes((l) => l - 1);
      }
    }
    setLiking(false);
  }, [liking, connected, likes, comment.id, comment.likes]);

  return (
    <div className="flex gap-3 rounded-xl bg-elevated p-4 ring-1 ring-edge">
      <div className="shrink-0">
        {showImg ? (
          <img
            src={avatar!}
            alt={comment.user.username}
            className="h-9 w-9 rounded-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-muted/20 text-[14px] font-semibold text-ink-muted">
            {initial}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-ink">
            {comment.user.name ?? comment.user.username}
          </span>
          <span className="text-[11px] text-ink-muted">{timeAgo(comment.createdAt, t)}</span>
          {comment.userRating != null && (
            <span className="ms-auto">
              <StarRow value={comment.userRating} interactive={false} />
            </span>
          )}
        </div>
        {!revealed ? (
          <div className="mt-1.5">
            <button
              onClick={() => setRevealed(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-500/10 px-3 py-1.5 text-[12px] font-medium text-yellow-400 transition-colors hover:bg-yellow-500/20"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
                <path d="M8 3C4.5 3 1.7 5.3 0 8c1.7 2.7 4.5 5 8 5s6.3-2.3 8-5c-1.7-2.7-4.5-5-8-5zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
              </svg>
              {t("Spoiler — Click to reveal")}
            </button>
          </div>
        ) : (
          <p
            className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink"
            dir="auto"
          >
            {comment.comment}
          </p>
        )}
        <div className="mt-2 flex items-center gap-3 text-[12px] text-ink-muted">
          <button
            onClick={handleLike}
            disabled={liking || !connected}
            className={`flex items-center gap-1 transition-colors ${
              likes !== comment.likes ? "text-red-400" : "text-ink-muted hover:text-red-400"
            } ${!connected ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {liking ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Heart size={12} fill={likes !== comment.likes ? "currentColor" : "none"} />
            )}
            {likes}
          </button>
          {comment.replies > 0 && (
            <button
              onClick={() => {
                if (replies) {
                  setReplies(null);
                  return;
                }
                setLoadingReplies(true);
                fetchReplies(comment.id).then((r) => {
                  setReplies(r);
                  setLoadingReplies(false);
                });
              }}
              className="flex items-center gap-1 transition-colors hover:text-ink"
            >
              {loadingReplies ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <MessageCircle size={12} />
              )}
              {replies ? `${comment.replies}` : `${comment.replies}`}
            </button>
          )}
          {comment.user.username === username && (
            <button
              onClick={async () => {
                if (deleting) return;
                setDeleting(true);
                try {
                  await deleteComment(comment.id);
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
        {replies && (
          <div className="mt-3 space-y-2 border-s-2 border-edge ps-4">
            {replies.map((r) => (
              <div key={r.id} className="flex gap-2 rounded-lg bg-raised/50 p-3">
                <div className="shrink-0">
                  {r.user.avatar ? (
                    <img
                      src={r.user.avatar}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-muted/20 text-[10px] font-semibold text-ink-muted">
                      {(r.user.name ?? r.user.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-ink">
                      {r.user.name ?? r.user.username}
                    </span>
                    <span className="text-[10px] text-ink-muted">{timeAgo(r.createdAt, t)}</span>
                  </div>
                  {r.spoiler ? (
                    <SpoilerLabel comment={r} />
                  ) : (
                    <p
                      className="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-ink"
                      dir="auto"
                    >
                      {r.comment}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const SORTS = ["likes", "newest", "oldest"] as const;
type Sort = (typeof SORTS)[number];

const SORT_LABEL: Record<Sort, string> = {
  likes: "Likes",
  newest: "Newest",
  oldest: "Oldest",
};

const COMMENTS_PAGE_SIZE = 20;

export function TraktComments({ resolution }: { resolution: IdResolution | null }) {
  const t = useT();
  const [comments, setComments] = useState<TraktComment[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("likes");
  const [showSort, setShowSort] = useState(false);
  const [myComments, setMyComments] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [ratinging, setRatinging] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [blurred, setBlurred] = useState(true);
  const sortRef = useRef<HTMLDivElement>(null);
  const { openSettings } = useView();
  const { settings } = useSettings();
  const [session, setSessionState] = useState(() => getSession());
  const connected = !!session;
  const username = session?.username ?? null;
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const target = resolution?.ok ? resolution.target : null;

  const ratingCacheKey = useMemo(() => {
    if (!target) return null;
    if (target.kind === "episode") {
      const id = target.show.ids.imdb ?? target.show.ids.tmdb;
      return `trakt-rating:episode:${id}:s${target.season}e${target.number}`;
    }
    const id = target.ids.imdb ?? target.ids.tmdb;
    return `trakt-rating:${target.kind}:${id}`;
  }, [target]);

  const commentsCacheKey = useMemo(() => {
    if (!target) return null;
    if (target.kind === "episode") {
      const id = target.show.ids.imdb ?? target.show.ids.tmdb;
      return `trakt-comments:episode:${id}:s${target.season}e${target.number}`;
    }
    const id = target.ids.imdb ?? target.ids.tmdb;
    return `trakt-comments:${target.kind}:${id}`;
  }, [target]);

  useEffect(() => {
    return subscribeSession(() => {
      setSessionState(getSession());
    });
  }, []);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    traktRequest<{ username: string; images?: { avatar?: { full?: string } } }>(
      "/users/me?extended=images",
    )
      .then((data) => {
        if (cancelled) return;
        setUserAvatar(data.images?.avatar?.full ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [connected]);

  // Restore cached rating from localStorage
  useEffect(() => {
    if (!ratingCacheKey) return;
    const cached = localStorage.getItem(ratingCacheKey);
    if (cached) {
      const n = Number(cached);
      if (n > 0) setUserRating(n);
    }
  }, [ratingCacheKey]);

  useEffect(() => {
    if (!target) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setPage(1);
    let cancelled = false;
    fetchComments(target, sort, 1, COMMENTS_PAGE_SIZE).then((data) => {
      if (cancelled) return;
      // Merge API comments with locally posted ones (prepend)
      const local = commentsCacheKey
        ? (JSON.parse(localStorage.getItem(commentsCacheKey) ?? "[]") as TraktComment[])
        : [];
      const localIds = new Set(local.map((c) => c.id));
      const merged = [...local, ...data.filter((c) => !localIds.has(c.id))];
      setComments(merged);
      setHasMore(data.length >= COMMENTS_PAGE_SIZE);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [target, sort, commentsCacheKey]);

  const loadMore = useCallback(async () => {
    if (!target || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    const data = await fetchComments(target, sort, next, COMMENTS_PAGE_SIZE);
    setComments((prev) => {
      const ids = new Set(prev.map((c) => c.id));
      return [...prev, ...data.filter((c) => !ids.has(c.id))];
    });
    setPage(next);
    setHasMore(data.length >= COMMENTS_PAGE_SIZE);
    setLoadingMore(false);
  }, [target, sort, page, hasMore, loadingMore]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSort(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleOpenTrakt = useCallback(() => {
    if (!target) return;
    const ids = target.kind === "episode" ? target.show.ids : target.ids;
    const slug = ids.tmdb ? `tmdb:${ids.tmdb}` : ids.imdb;
    if (!slug) return;
    if (target.kind === "episode") {
      openUrl(
        `https://app.trakt.tv/shows/${slug}/seasons/${target.season}/episodes/${target.number}?mode=media`,
      );
    } else if (target.kind === "movie") {
      openUrl(`https://app.trakt.tv/movies/${slug}?mode=media`);
    } else {
      openUrl(`https://app.trakt.tv/shows/${slug}?mode=media`);
    }
  }, [target]);

  const handlePost = useCallback(async () => {
    if (!target || !text.trim() || posting) return;
    setPostError(null);
    setPosting(true);
    try {
      const created = await postComment(target, text.trim(), spoiler);
      setSpoiler(false);
      setComments((prev) => [created, ...prev]);
      setText("");
      if (commentsCacheKey) {
        const existing = JSON.parse(
          localStorage.getItem(commentsCacheKey) ?? "[]",
        ) as TraktComment[];
        existing.unshift(created);
        localStorage.setItem(commentsCacheKey, JSON.stringify(existing));
      }
    } catch (e) {
      console.error("Post comment error:", e);
      if (e instanceof TraktApiError) {
        try {
          const parsed = JSON.parse(e.body);
          let msg = "";
          if (parsed.errors && typeof parsed.errors === "object") {
            const first = Object.values(parsed.errors)[0];
            if (Array.isArray(first) && first.length > 0) msg = first[0];
          }
          if (!msg) msg = parsed.error_description ?? parsed.error ?? `HTTP ${e.status}`;
          setPostError(msg.replace(/^\w+\s*-\s*/, ""));
        } catch {
          const body = e.body.slice(0, 100) || t("(empty body)");
          setPostError(t("HTTP {status}: {body}", { status: e.status, body }));
        }
      } else {
        setPostError(e instanceof TypeError ? t("Network error") : t("Failed to post comment"));
      }
    }
    setPosting(false);
  }, [target, text, posting, commentsCacheKey, spoiler, t]);

  const handleDelete = useCallback(
    (id: number) => {
      setComments((prev) => prev.filter((c) => c.id !== id));
      if (commentsCacheKey) {
        const existing = JSON.parse(
          localStorage.getItem(commentsCacheKey) ?? "[]",
        ) as TraktComment[];
        localStorage.setItem(commentsCacheKey, JSON.stringify(existing.filter((c) => c.id !== id)));
      }
    },
    [commentsCacheKey],
  );

  const handleRate = useCallback(
    async (rating: number) => {
      if (!target || ratinging) return;
      setRatinging(true);
      try {
        if (rating === userRating) {
          await removeRating(target);
          setUserRating(0);
          if (ratingCacheKey) localStorage.removeItem(ratingCacheKey);
        } else {
          await rateContent(target, rating);
          setUserRating(rating);
          if (ratingCacheKey) localStorage.setItem(ratingCacheKey, String(rating));
        }
      } catch {}
      setRatinging(false);
    },
    [target, ratinging, userRating, ratingCacheKey],
  );

  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[20px] font-bold text-ink">{t("Trakt Comments")}</h2>
        {target && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMyComments(!myComments)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium ring-1 transition-colors ${
                myComments
                  ? "bg-ink text-canvas ring-ink"
                  : "text-ink-muted ring-edge hover:bg-elevated hover:text-ink"
              }`}
            >
              {t("My")}
            </button>
            <div ref={sortRef} className="relative">
              <button
                onClick={() => setShowSort(!showSort)}
                className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-white/[0.10] hover:text-ink"
              >
                {t(SORT_LABEL[sort])}
                <ChevronDown size={12} />
              </button>
              {showSort && (
                <div className="absolute end-0 top-full z-50 mt-1 min-w-[100px] overflow-hidden rounded-xl bg-elevated ring-1 ring-edge shadow-lg">
                  {SORTS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSort(s);
                        setShowSort(false);
                      }}
                      className={`block w-full px-3 py-2 text-start text-[12px] transition-colors hover:bg-raised ${
                        s === sort ? "font-semibold text-ink" : "text-ink-muted"
                      }`}
                    >
                      {t(SORT_LABEL[s])}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleOpenTrakt}
              className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-white/[0.10] hover:text-ink"
            >
              {t("Open on Trakt")}
            </button>
          </div>
        )}
      </div>

      <div
        className={`relative rounded-xl ${settings.blurComments && blurred ? "overflow-hidden" : ""}`}
      >
        {settings.blurComments && blurred && (
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

        {target && connected && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[12px] font-medium text-ink-muted">{t("Rating")}:</span>
            <StarRow
              value={userRating}
              interactive={true}
              onRate={handleRate}
              onHover={setHoverRating}
            />
            {(hoverRating || userRating) > 0 && (
              <span className="text-[12px] font-medium text-ink-muted">
                {((hoverRating || userRating) / 2).toFixed(1).replace(/\.0$/, "")}
              </span>
            )}
            {userRating > 0 && !hoverRating && (
              <button
                onClick={() => handleRate(userRating)}
                disabled={ratinging}
                className="text-[11px] text-ink-muted/50 underline transition-colors hover:text-ink-muted"
              >
                {t("Remove")}
              </button>
            )}
          </div>
        )}

        {resolution && !resolution.ok && (
          <p className="rounded-xl bg-elevated p-4 text-[13px] text-ink-muted ring-1 ring-edge">
            {resolution.reason === "anime"
              ? t("Trakt comments are not available for anime titles.")
              : t("Could not identify this title on Trakt.")}
          </p>
        )}

        {target && !connected && (
          <div className="mb-5 rounded-xl border border-edge-soft bg-elevated/60 p-5 text-center">
            <p className="text-[14px] text-ink-muted">
              {t("Connect your Trakt account to see comments and reviews.")}
            </p>
            <p className="mt-3">
              <button
                onClick={() => openSettings("trakt")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02]"
              >
                <Settings size={14} strokeWidth={2.2} />
                {t("Connect Trakt")}
              </button>
            </p>
          </div>
        )}

        {target && connected && (
          <div className="mb-5">
            <div className="flex items-start gap-3">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={username ?? ""}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserAvatar username={username} size="sm" />
              )}
              <div className="flex flex-1 items-start gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
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
                  onClick={handlePost}
                  disabled={!text.trim() || posting}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold transition-all ${
                    !text.trim() || posting
                      ? "bg-ink-muted/20 text-ink-muted/50 cursor-not-allowed"
                      : "bg-ink text-canvas hover:scale-[1.02]"
                  }`}
                >
                  {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-muted transition-colors hover:text-ink">
                <input
                  type="checkbox"
                  checked={spoiler}
                  onChange={(e) => setSpoiler(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-edge bg-elevated accent-ink"
                />
                {t("Contains spoiler")}
              </label>
              <span className="text-[11px] text-ink-muted/40">
                {t("Comments may take a moment to appear on Trakt")}
              </span>
            </div>
            {postError && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
                <AlertCircle size={12} />
                {postError}
              </div>
            )}
          </div>
        )}

        {target && loading && (
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

        {target && !loading && comments.length === 0 && (
          <p className="text-[14px] text-ink-muted">{t("No comments yet")}</p>
        )}

        {target &&
          !loading &&
          (myComments ? comments.filter((c) => c.user.username === username) : comments).length ===
            0 &&
          myComments && (
            <p className="text-[14px] text-ink-muted">{t("You haven't commented yet")}</p>
          )}

        {target && !loading && (
          <div className="flex flex-col gap-3">
            {(myComments ? comments.filter((c) => c.user.username === username) : comments).map(
              (c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  connected={connected}
                  username={username}
                  onDelete={handleDelete}
                />
              ),
            )}
            {hasMore && !myComments && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="mt-1 flex h-10 items-center justify-center gap-2 rounded-xl bg-white/[0.06] text-[13px] font-semibold text-ink-muted transition-colors hover:bg-white/[0.10] hover:text-ink disabled:opacity-60"
              >
                {loadingMore && <Loader2 size={15} className="animate-spin" />}
                {loadingMore ? t("Loading more") : t("Load more comments")}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function SpoilerLabel({ comment }: { comment: { comment: string } }) {
  const t = useT();
  const [show, setShow] = useState(false);
  if (show) {
    return (
      <p
        className="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-ink"
        dir="auto"
      >
        {comment.comment}
      </p>
    );
  }
  return (
    <button
      onClick={() => setShow(true)}
      className="mt-0.5 inline-flex items-center gap-1 rounded bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400 transition-colors hover:bg-yellow-500/20"
    >
      {t("Spoiler — Click")}
    </button>
  );
}
