import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { Bookmark, Eye, ExternalLink, Heart, Loader2, Star, X } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { safeFetch as fetch } from "@/lib/safe-fetch";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import {
  fetchLetterboxdStreams,
  type LetterboxdStreamInfo,
} from "@/lib/stremboxd/client";
import { letterboxdFilmUrl } from "@/lib/stremboxd/to-meta";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";

const STREMBOXD_BASE = "https://api.stremboxd.com";

class LetterboxdSectionBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* swallow — a Stremboxd hiccup must never crash the detail page */
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

export function LetterboxdPanel({ meta, imdbId }: { meta: Meta; imdbId: string | null }) {
  return (
    <LetterboxdSectionBoundary>
      <LetterboxdPanelInner meta={meta} imdbId={imdbId} />
    </LetterboxdSectionBoundary>
  );
}

function toggleSetParam(url: string, nextSet: boolean): string {
  try {
    const u = new URL(url);
    u.searchParams.set("set", String(nextSet));
    return u.toString();
  } catch {
    return url.replace(/set=[^&]+/, `set=${nextSet}`);
  }
}

function parseRateUrl(rateUrl: string): { userId: string; filmId: string; tok: string; imdb: string } | null {
  try {
    const u = new URL(rateUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    // /action/:userId/rate/:filmId
    if (parts.length < 4 || parts[2] !== "rate") return null;
    return {
      userId: parts[1]!,
      filmId: parts[3]!,
      tok: u.searchParams.get("tok") ?? "",
      imdb: u.searchParams.get("imdb") ?? "",
    };
  } catch {
    return null;
  }
}

function buildRateSubmitUrl(parsed: { userId: string; filmId: string; tok: string; imdb: string }, rating: number | "remove"): string {
  const params = new URLSearchParams();
  if (parsed.imdb) params.set("imdb", parsed.imdb);
  params.set("tok", parsed.tok);
  params.set("rating", rating === "remove" ? "remove" : rating.toFixed(1));
  return `${STREMBOXD_BASE}/action/${parsed.userId}/rate/${parsed.filmId}/submit?${params.toString()}`;
}

const RATING_STARS = 5;

// Half-filled star using clip-path for a crisp 50% cut — no overflow hacks.
// The filled star is clipped to show only its left half over the empty outline.
function HalfStar({ size, className, dim }: { size: number; className?: string; dim?: string }) {
  const isRtl = document.documentElement.dir === "rtl";
  return (
    <span className="relative inline-block" style={{ width: size, height: size, lineHeight: 0 }}>
      <Star
        size={size}
        className={dim ?? "text-edge"}
        fill="none"
        style={{ position: "absolute", inset: 0 }}
      />
      <span
        style={{
          position: "absolute",
          inset: 0,
          clipPath: isRtl ? "inset(0 0 0 50%)" : "inset(0 50% 0 0)",
          display: "inline-flex",
        }}
      >
        <Star size={size} className={className} fill="currentColor" />
      </span>
    </span>
  );
}

function LetterboxdPanelInner({ meta, imdbId }: { meta: Meta; imdbId: string | null }) {
  const t = useT();
  const lb = useLetterboxd();
  const [info, setInfo] = useState<LetterboxdStreamInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [tick] = useState(0);
  const [showRater, setShowRater] = useState(false);
  const [pendingRating, setPendingRating] = useState<number | null>(null);

  const fallbackUrl = letterboxdFilmUrl(meta);

  useEffect(() => {
    if (!lb.isActive || meta.type === "series") return;
    const id = imdbId ?? (meta.id.startsWith("tt") ? meta.id : null);
    if (!id) return;
    if (!lb.isFullConnected || !lb.session) return;

    let cancelled = false;
    setLoading(true);
    setInfo(null);
    setUnavailable(false);

    fetchLetterboxdStreams(lb.session.userId, id)
      .then((result) => {
        if (cancelled) return;
        setInfo(result);
        if (!result) setUnavailable(true);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lb.isActive, lb.isFullConnected, lb.session, imdbId, meta.id, meta.type, tick]);

  if (!lb.isActive || meta.type === "series") return null;
  if (!lb.isFullConnected) return null;

  const filmUrl = info?.letterboxdUrl ?? fallbackUrl;

  if (unavailable) {
    return (
      <section className="flex items-center gap-2 rounded-2xl bg-elevated px-5 py-4 text-[13px] text-ink-subtle">
        <Star size={14} className="text-ink-subtle" />
        {t("Letterboxd unavailable right now.")}
      </section>
    );
  }

  const community = info?.communityRating ?? null;
  const yourRating = info?.userRating ?? null;

  // Optimistic update: immediately reflect the new state in local info
  const optimisticUpdate = (patch: Partial<LetterboxdStreamInfo>) => {
    setInfo((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const performToggle = async (
    key: "watched" | "liked" | "inWatchlist",
    url: string | null,
  ) => {
    if (!url || actionBusy) return;
    // Determine current state to compute the toggle target
    const current = info ? info[key] : false;
    const nextSet = !current;
    const actionUrl = toggleSetParam(url, nextSet);

    setActionBusy(key);
    // Optimistic update — flip immediately
    optimisticUpdate({ [key]: nextSet } as Partial<LetterboxdStreamInfo>);

    try {
      await fetch(actionUrl).catch(() => {});
      // Don't re-fetch immediately — server caches rating data for 5 min
      // and would return stale data. The optimistic update is enough.
    } finally {
      setActionBusy(null);
    }
  };

  const performRate = async (rating: number | "remove") => {
    if (!info?.rateUrl || actionBusy) return;
    const parsed = parseRateUrl(info.rateUrl);
    if (!parsed) return;
    const submitUrl = buildRateSubmitUrl(parsed, rating);

    setActionBusy("rate");
    const newRating = rating === "remove" ? null : rating;
    // Optimistic update
    optimisticUpdate({ userRating: newRating });
    setShowRater(false);
    setPendingRating(null);

    try {
      await fetch(submitUrl).catch(() => {});
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-elevated p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Star size={16} className="text-amber-300" fill="currentColor" />
          <h3 className="text-[15px] font-semibold tracking-tight text-ink">{t("Letterboxd")}</h3>
        </div>
        {filmUrl && (
          <button
            onClick={() => openUrl(filmUrl)}
            className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-white/[0.10] hover:text-ink"
          >
            {t("Open on Letterboxd")}
            <ExternalLink size={11} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[13px] text-ink-subtle">
          <Loader2 size={14} className="animate-spin" />
          {t("Loading Letterboxd…")}
        </div>
      ) : info ? (
        <>
          {/* Rating badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {community != null && (
              <Badge icon={<Star size={13} className="text-amber-300" fill="currentColor" />}>
                {t("Avg ★ {rating}", { rating: community.toFixed(1) })}
              </Badge>
            )}
            {yourRating != null ? (
              <Badge tone="rated" icon={<Star size={13} fill="currentColor" />}>
                {t("You ★ {rating}", { rating: yourRating.toFixed(1) })}
              </Badge>
            ) : (
              <Badge tone="muted" icon={<Star size={13} />}>{t("Not rated")}</Badge>
            )}
          </div>

          {/* Interactive action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              icon={<Star size={14} fill={yourRating != null ? "currentColor" : "none"} />}
              label={yourRating != null ? t("★ {rating} — Change", { rating: yourRating.toFixed(1) }) : t("★ Rate")}
              tone={yourRating != null ? "rated" : "default"}
              busy={actionBusy === "rate"}
              onClick={() => {
                setShowRater((v) => !v);
                setPendingRating(yourRating);
              }}
            />
            <ActionButton
              icon={<Eye size={14} fill={info.watched ? "currentColor" : "none"} />}
              label={info.watched ? t("✓ Watched") : t("○ Mark watched")}
              tone={info.watched ? "active" : "default"}
              busy={actionBusy === "watched"}
              onClick={() => performToggle("watched", info.watchedUrl)}
            />
            <ActionButton
              icon={<Heart size={14} fill={info.liked ? "currentColor" : "none"} />}
              label={info.liked ? t("♥ Liked") : t("♡ Like")}
              tone={info.liked ? "liked" : "default"}
              busy={actionBusy === "liked"}
              onClick={() => performToggle("liked", info.likedUrl)}
            />
            <ActionButton
              icon={<Bookmark size={14} fill={info.inWatchlist ? "currentColor" : "none"} />}
              label={info.inWatchlist ? t("In Watchlist") : t("+ Watchlist")}
              tone={info.inWatchlist ? "active" : "default"}
              busy={actionBusy === "inWatchlist"}
              onClick={() => performToggle("inWatchlist", info.watchlistUrl)}
            />
          </div>

          {/* In-app star rating picker */}
          {showRater && (
            <div className="flex flex-col gap-4 rounded-xl bg-canvas p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink">{t("Rate this film")}</span>
                <button
                  onClick={() => { setShowRater(false); setPendingRating(yourRating); }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-canvas/40 hover:text-ink"
                  aria-label={t("Close")}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Stars — each star is split into left (half) and right (full) zones */}
              <div
                className="flex items-center gap-1.5"
                onMouseLeave={() => setPendingRating(yourRating)}
              >
                {Array.from({ length: RATING_STARS }, (_, i) => i + 1).map((starIndex) => {
                  const effective = pendingRating ?? yourRating ?? 0;
                  const isFull = starIndex <= effective;
                  const isHalf = starIndex - 0.5 === effective;
                  const isDim = starIndex > effective + 0.5;
                  return (
                    <button
                      key={starIndex}
                      onClick={() => {
                        const target = pendingRating ?? starIndex;
                        performRate(target);
                      }}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isRtl = document.documentElement.dir === "rtl";
                        const isFirstHalf = isRtl 
                          ? e.clientX - rect.left > rect.width / 2
                          : e.clientX - rect.left < rect.width / 2;
                        const next = isFirstHalf ? starIndex - 0.5 : starIndex;
                        setPendingRating((prev) => (prev === next ? prev : next));
                      }}
                      className="group/star relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150 hover:scale-110 hover:bg-amber-400/10 active:scale-95"
                      aria-label={`${(starIndex - 0.5).toFixed(1)} to ${starIndex}.0 stars`}
                    >
                      {isFull ? (
                        <Star
                          size={28}
                          className="text-amber-300 transition-transform duration-150 group-hover/star:scale-110"
                          fill="currentColor"
                          strokeWidth={1.5}
                        />
                      ) : isHalf ? (
                        <HalfStar size={28} className="text-amber-300" dim="text-edge" />
                      ) : (
                        <Star
                          size={28}
                          className={isDim ? "text-edge/50" : "text-edge"}
                          fill="none"
                          strokeWidth={1.5}
                          style={{ transition: "color 0.15s" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Live rating display */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-[20px] font-bold text-amber-300 tabular-nums">
                    {pendingRating != null ? pendingRating.toFixed(1) : yourRating != null ? yourRating.toFixed(1) : "—"}
                  </span>
                  <span className="text-[12px] text-ink-subtle">{t("out of 5")}</span>
                </div>
                <div className="flex items-center gap-2">
                  {yourRating != null && (
                    <button
                      onClick={() => performRate("remove")}
                      disabled={!!actionBusy}
                      className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-ink-subtle transition-colors hover:text-red-300 disabled:opacity-50"
                    >
                      {t("Remove rating")}
                    </button>
                  )}
                  <button
                    onClick={() => pendingRating != null && performRate(pendingRating)}
                    disabled={!!actionBusy || pendingRating == null}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-400/90 px-4 py-2 text-[12.5px] font-semibold text-canvas transition-all hover:bg-amber-400 active:scale-95 disabled:opacity-40"
                  >
                    {actionBusy === "rate" ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} fill="currentColor" />}
                    {t("Submit")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function Badge({
  children,
  icon,
  tone = "muted",
}: {
  children: ReactNode;
  icon: ReactNode;
  tone?: "muted" | "active" | "liked" | "rated";
}) {
  const toneClass =
    tone === "active"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "liked"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
        : tone === "rated"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
          : "border-edge-soft bg-canvas/40 text-ink-muted";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium ${toneClass}`}>
      {icon}
      {children}
    </span>
  );
}

function ActionButton({
  icon,
  label,
  tone = "default",
  busy,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  tone?: "default" | "active" | "liked" | "rated";
  busy: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "active"
      ? "border-success/30 bg-success/10 text-success hover:bg-success/20"
      : tone === "liked"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/20"
        : tone === "rated"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"
          : "border-edge-soft bg-canvas/40 text-ink-muted hover:border-edge hover:text-ink";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${toneClass}`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}
