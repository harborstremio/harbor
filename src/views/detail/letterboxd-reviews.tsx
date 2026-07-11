import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import {
  fetchLetterboxdFriendsReviews,
  fetchLetterboxdReviewsDirect,
  type LetterboxdReview,
} from "@/lib/stremboxd/client";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { openUrl } from "@/lib/window";
import { ExternalLink, Heart, Loader2, MessageCircle, RefreshCw, Users } from "lucide-react";
import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from "react";

class ReviewsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* swallow */
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

type Filter = "all" | "friends";

export function LetterboxdReviews({ meta, imdbId }: { meta: Meta; imdbId: string | null }) {
  return (
    <ReviewsBoundary>
      <LetterboxdReviewsInner meta={meta} imdbId={imdbId} />
    </ReviewsBoundary>
  );
}

function LetterboxdReviewsInner({ meta, imdbId }: { meta: Meta; imdbId: string | null }) {
  const t = useT();
  const lb = useLetterboxd();
  const [reviews, setReviews] = useState<LetterboxdReview[]>([]);
  const [friendsReviews, setFriendsReviews] = useState<LetterboxdReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [filmSlug, setFilmSlug] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [showAll, setShowAll] = useState(false); // "Load more" toggle
  const { settings } = useSettings();
  const [blurred, setBlurred] = useState(true);

  const effectiveImdbId = imdbId ?? (meta.id.startsWith("tt") ? meta.id : null);

  const fetchReviews = useCallback(async () => {
    if (!effectiveImdbId) {
      setTried(true);
      return;
    }
    setLoading(true);
    setReviews([]);
    setShowAll(false);
    try {
      const result = await fetchLetterboxdReviewsDirect(effectiveImdbId);
      setReviews(result.reviews);
      if (result.reviews[0]?.url) {
        const m = result.reviews[0].url.match(/letterboxd\.com\/film\/([^/]+)/);
        if (m) setFilmSlug(m[1]!);
      }
    } catch (e) {
      console.error("[Letterboxd Reviews] fetch error:", e);
    } finally {
      setLoading(false);
      setTried(true);
    }

    // Also fetch friends reviews in parallel (if full mode connected)
    if (lb.isFullConnected && lb.username) {
      setLoadingFriends(true);
      setFriendsReviews([]);
      try {
        const friends = await fetchLetterboxdFriendsReviews(lb.username, effectiveImdbId);
        setFriendsReviews(friends);
      } catch (e) {
        console.error("[Letterboxd Reviews] friends fetch error:", e);
      } finally {
        setLoadingFriends(false);
      }
    }
  }, [effectiveImdbId, lb.isFullConnected, lb.username]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  if (!lb.isActive || meta.type === "series") return null;
  if (!effectiveImdbId) return null;

  // Skeleton while loading
  if (loading && reviews.length === 0) {
    return (
      <section>
        <div className="mb-5 flex items-center gap-2">
          <MessageCircle size={18} className="text-amber-300" />
          <h2 className="text-[20px] font-bold text-ink">{t("Letterboxd Reviews")}</h2>
        </div>
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 rounded-xl bg-elevated p-4 ring-1 ring-edge">
              <div className="h-9 w-9 animate-pulse rounded-full bg-ink-muted/20" />
              <div className="flex-1">
                <div className="mb-2 h-3 w-28 animate-pulse rounded bg-ink-muted/20" />
                <div className="mb-1 h-3 w-full animate-pulse rounded bg-ink-muted/20" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-ink-muted/20" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Fallback if nothing loaded
  if (tried && reviews.length === 0 && !loading) {
    const filmUrl = effectiveImdbId ? `https://letterboxd.com/imdb/${effectiveImdbId}/reviews/` : null;
    return (
      <section>
        <div className="mb-5 flex items-center gap-2">
          <MessageCircle size={18} className="text-amber-300" />
          <h2 className="text-[20px] font-bold text-ink">{t("Letterboxd Reviews")}</h2>
        </div>
        <div className="rounded-xl border border-edge-soft bg-elevated/40 p-5 text-center">
          <p className="text-[14px] text-ink-muted">{t("Reviews couldn't be loaded right now.")}</p>
          {filmUrl && (
            <button
              onClick={() => openUrl(filmUrl)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02]"
            >
              {t("View on Letterboxd")}
              <ExternalLink size={12} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </section>
    );
  }

  // Friends = use friends reviews (from /{username}/friends/film/{slug}/reviews/)
  const filtered = filter === "friends" ? friendsReviews : reviews;

  // Show first 5 by default, "Load more" reveals the rest
  const VISIBLE_COUNT = 5;
  const visible = showAll ? filtered : filtered.slice(0, VISIBLE_COUNT);
  const hiddenCount = filtered.length - visible.length;

  const reviewsUrl = filmSlug ? `https://letterboxd.com/film/${filmSlug}/reviews/` : null;

  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-amber-300" />
          <h2 className="text-[20px] font-bold text-ink">{t("Letterboxd Reviews")}</h2>
          {reviews.length > 0 && <span className="text-[12px] text-ink-subtle">({reviews.length})</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="flex items-center gap-1 rounded-lg bg-elevated/40 p-0.5 ring-1 ring-edge-soft/60">
            <FilterBtn
              active={filter === "all"}
              onClick={() => {
                setFilter("all");
                setShowAll(false);
              }}
              icon={<MessageCircle size={12} />}
              label={t("All")}
              count={reviews.length}
            />
            {lb.isFullConnected && lb.username && (
              <FilterBtn
                active={filter === "friends"}
                onClick={() => {
                  setFilter("friends");
                  setShowAll(false);
                }}
                icon={<Users size={12} />}
                label={t("Friends")}
                count={loadingFriends ? undefined : friendsReviews.length}
              />
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchReviews()}
            disabled={loading}
            title={t("Refresh")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted ring-1 ring-edge transition-colors hover:bg-elevated hover:text-ink disabled:opacity-50"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>

          {reviewsUrl && (
            <button
              onClick={() => openUrl(reviewsUrl)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink-muted ring-1 ring-edge transition-colors hover:bg-elevated hover:text-ink"
            >
              {t("All reviews")}
              <ExternalLink size={11} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 && !loading && (
        <p className="text-[14px] text-ink-muted py-4">
          {filter === "friends"
            ? loadingFriends
              ? t("Loading friends' reviews…")
              : t("No reviews from your friends for this film.")
            : t("No reviews yet.")}
        </p>
      )}

      {visible.length > 0 && (
        <div className={`relative rounded-xl ${settings.blurComments && blurred ? "overflow-hidden" : ""}`}>
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
                {t("Reveal reviews")}
              </button>
              <span className="text-[11px] text-ink-muted/60">{t("Reviews are hidden")}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {visible.map((review, i) => (
              <div key={`${review.author}-${i}`} className="flex gap-3 rounded-xl bg-elevated p-4 ring-1 ring-edge">
                <div className="shrink-0">
                  {review.avatar ? (
                    <img
                      src={review.avatar}
                      alt={review.author}
                      className="h-9 w-9 rounded-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-muted/20 text-[14px] font-semibold text-ink-muted">
                      {review.author.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => review.authorUrl && openUrl(review.authorUrl)}
                      className="text-[13px] font-semibold text-ink transition-colors hover:text-amber-300"
                    >
                      {review.author || t("Anonymous")}
                    </button>
                    {review.rating && <span className="text-[14px] leading-none text-amber-300">{review.rating}</span>}
                    {review.lang && review.lang !== "en" && (
                      <span className="rounded-full bg-edge-soft/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-ink-subtle">
                        {review.lang}
                      </span>
                    )}
                    {review.date && (
                      <span className="ms-auto text-[11px] text-ink-subtle">
                        {new Date(review.date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink-muted"
                    dir="auto"
                  >
                    {review.text}
                  </p>
                </div>
              </div>
            ))}

            {/* Load more button */}
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="mt-1 flex h-10 items-center justify-center gap-2 rounded-xl border border-edge-soft bg-elevated/40 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                <Heart size={14} />
                {t("Show {n} more reviews", { n: hiddenCount })}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function FilterBtn({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        active ? "bg-ink text-canvas" : "text-ink-muted hover:bg-raised hover:text-ink"
      }`}
    >
      {icon}
      {label}
      {count != null && count > 0 && (
        <span className={`rounded-full px-1 text-[9px] ${active ? "bg-canvas/20" : "bg-edge-soft/40"}`}>{count}</span>
      )}
    </button>
  );
}
