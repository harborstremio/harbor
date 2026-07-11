import { FeedHero } from "@/components/feed-hero";
import { Poster } from "@/components/poster";
import { extendPool, getPool, type FeedItem } from "@/lib/feed";
import { getDownvotedIds, getUpvotedIds } from "@/lib/feed/preferences";
import { rankByAffinity } from "@/lib/feed/rank";
import { blockQueueItem, filterQueuePool, shuffleQueuePool, snoozeQueueItem } from "@/lib/feed/skipped";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useInWatchlist } from "@/lib/watchlist";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LOW_WATER_MARK = 6;

let savedActiveId: string | null = null;

type LeaveAnim = "skip" | "block" | "back" | null;

export function QueueView() {
  const t = useT();
  const { settings } = useSettings();
  const [pool, setPool] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(() => savedActiveId);
  const [leaveAnim, setLeaveAnim] = useState<LeaveAnim>(null);

  useEffect(() => {
    let cancelled = false;
    getPool(settings.tmdbKey)
      .then((items) => {
        if (cancelled) return;
        const blocked = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
        const filtered = filterQueuePool(items).filter((it) => !blocked.has(it.meta.id));
        const shuffled = shuffleQueuePool(filtered);
        setPool(rankByAffinity(shuffled));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPool([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey]);

  useEffect(() => {
    savedActiveId = activeId;
  }, [activeId]);

  const activeIndex = useMemo(() => {
    if (activeId) {
      const i = pool.findIndex((p) => p.meta.id === activeId);
      if (i >= 0) return i;
    }
    return 0;
  }, [activeId, pool]);

  const item = pool[activeIndex];

  const jump = useCallback(
    (i: number, direction: LeaveAnim = null) => {
      const next = pool[i];
      if (!next || leaveAnim) return;
      if (direction) {
        setLeaveAnim(direction);
        window.setTimeout(() => {
          setActiveId(next.meta.id);
          setLeaveAnim(null);
        }, 200);
      } else {
        setActiveId(next.meta.id);
      }
    },
    [pool, leaveAnim],
  );

  const nextIdAfterRemoval = useCallback(
    () => pool[activeIndex + 1]?.meta.id ?? pool[activeIndex - 1]?.meta.id ?? null,
    [pool, activeIndex],
  );

  const onSkip = useCallback(() => {
    if (!item || leaveAnim) return;
    const id = item.meta.id;
    const nextId = nextIdAfterRemoval();
    snoozeQueueItem(id);
    setLeaveAnim("skip");
    window.setTimeout(() => {
      setPool((p) => p.filter((it) => it.meta.id !== id));
      setActiveId(nextId);
      setLeaveAnim(null);
    }, 200);
  }, [item, leaveAnim, nextIdAfterRemoval]);

  const onNotInterested = useCallback(() => {
    if (!item || leaveAnim) return;
    const id = item.meta.id;
    const nextId = nextIdAfterRemoval();
    blockQueueItem(id);
    setLeaveAnim("block");
    window.setTimeout(() => {
      setPool((p) => p.filter((it) => it.meta.id !== id));
      setActiveId(nextId);
      setLeaveAnim(null);
    }, 240);
  }, [item, leaveAnim, nextIdAfterRemoval]);

  const itemSaved = useInWatchlist(item?.meta.id);
  const savedRef = useRef<{ id: string | null; saved: boolean }>({ id: null, saved: false });
  useEffect(() => {
    const id = item?.meta.id ?? null;
    const prev = savedRef.current;
    if (id && id === prev.id && itemSaved && !prev.saved) {
      const nextId = nextIdAfterRemoval();
      snoozeQueueItem(id);
      window.setTimeout(() => {
        setPool((p) => p.filter((it) => it.meta.id !== id));
        setActiveId(nextId);
      }, 120);
    }
    savedRef.current = { id, saved: itemSaved };
  }, [item, itemSaved, nextIdAfterRemoval]);

  const extensionPageRef = useRef(2);
  const extendingRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (!settings.tmdbKey) return;
    const remaining = pool.length - activeIndex - 1;
    if (remaining > LOW_WATER_MARK) return;
    if (extendingRef.current) return;
    extendingRef.current = true;
    const page = extensionPageRef.current;
    extensionPageRef.current = page + 1;
    let cancelled = false;
    void (async () => {
      try {
        const more = await extendPool(settings.tmdbKey, page);
        if (cancelled) return;
        const existingIds = new Set(pool.map((p) => p.meta.id));
        const fresh = more.filter((m) => !existingIds.has(m.meta.id));
        const filtered = filterQueuePool(fresh);
        if (filtered.length === 0) return;
        setPool((p) => [...p, ...shuffleQueuePool(filtered)]);
      } finally {
        extendingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, settings.tmdbKey, pool, activeIndex]);

  const onPrev = useCallback(() => {
    if (activeIndex > 0) jump(activeIndex - 1, "back");
  }, [activeIndex, jump]);

  const onNext = useCallback(() => {
    if (activeIndex < pool.length - 1) jump(activeIndex + 1, "skip");
  }, [activeIndex, pool.length, jump]);

  const leaveClass =
    leaveAnim === "skip"
      ? "translate-x-8 opacity-0 transition-[transform,opacity] duration-200 ease-out"
      : leaveAnim === "back"
        ? "-translate-x-8 opacity-0 transition-[transform,opacity] duration-200 ease-out"
        : leaveAnim === "block"
          ? "scale-[0.98] opacity-0 blur-sm transition-[transform,opacity,filter] duration-[240ms] ease-out"
          : "transition-[transform,opacity] duration-200 ease-out";

  return (
    <main className="min-w-0 flex-1 overflow-hidden pb-12 pt-20">
      <div className="mx-auto flex h-full min-w-0 max-w-[1180px] flex-col gap-5 px-6 sm:px-12">
        <header className="flex shrink-0 items-baseline gap-3">
          <h1 className="font-display text-[20px] font-medium tracking-tight text-ink">{t("Discovery Queue")}</h1>
          <span className="text-[12px] uppercase tracking-[0.2em] text-ink-subtle">
            {loading
              ? t("Loading…")
              : `${String(Math.min(activeIndex + 1, pool.length)).padStart(2, "0")} / ${String(pool.length).padStart(2, "0")}`}
          </span>
        </header>

        {item ? (
          <div className="relative flex-1 min-h-[280px] max-h-[600px]">
            <div className={`${leaveClass} h-full`}>
              <FeedHero
                item={item}
                position={activeIndex}
                total={pool.length}
                onSkip={onSkip}
                onNotInterested={onNotInterested}
              />
            </div>
            <NavArrow side="left" disabled={activeIndex === 0 || leaveAnim != null} onClick={onPrev} />
            <NavArrow side="right" disabled={activeIndex >= pool.length - 1 || leaveAnim != null} onClick={onNext} />
          </div>
        ) : (
          <div className="flex-1 min-h-[280px] max-h-[600px]">
            <QueueSkeleton loading={loading} hasKey={!!settings.tmdbKey} />
          </div>
        )}

        {pool.length > 0 && (
          <div className="shrink-0">
            <Strip pool={pool} active={activeIndex} onJump={(i) => jump(i)} />
          </div>
        )}
      </div>
    </main>
  );
}

function NavArrow({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? t("Previous") : t("Next")}
      className={`group absolute top-1/2 ${
        side === "left" ? "-start-3" : "-end-3"
      } z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/80 text-ink/75 ring-1 ring-inset ring-ink/12 shadow-[0_10px_28px_-12px_rgba(0,0,0,0.8)] transition-all duration-200 ease-out hover:scale-110 hover:bg-canvas hover:text-ink hover:ring-ink/25 active:scale-95 disabled:pointer-events-none disabled:opacity-25`}
    >
      {side === "left" ? (
        <ChevronLeft
          size={20}
          strokeWidth={2.25}
          className="transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
        />
      ) : (
        <ChevronRight
          size={20}
          strokeWidth={2.25}
          className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
        />
      )}
    </button>
  );
}

function Strip({ pool, active, onJump }: { pool: FeedItem[]; active: number; onJump: (i: number) => void }) {
  const t = useT();
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const child = el.querySelector<HTMLButtonElement>(`[data-active="true"]`);
    if (child) {
      child.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [active]);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-subtle">{t("Queue")}</span>
      <div
        ref={stripRef}
        className="-m-3 flex gap-3 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pool.map((item, i) => {
          const isActive = i === active;
          const isPast = i < active;
          return (
            <button
              key={`${item.meta.id}-${i}`}
              type="button"
              data-active={isActive}
              onClick={() => onJump(i)}
              className={`group relative h-[112px] w-[200px] shrink-0 rounded-[10px] transition-all duration-200 hover:z-10 hover:scale-[1.02] ${
                isPast ? "opacity-50" : ""
              }`}
            >
              <Poster
                src={item.meta.background ?? item.meta.poster}
                seed={item.meta.id}
                ratio="landscape"
                className="absolute inset-0 rounded-[10px]"
              />
              {isActive && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[10px]"
                  style={{
                    background:
                      "linear-gradient(180deg, oklch(0.79 0.13 62 / 0.18) 0%, oklch(0.79 0.13 62 / 0.28) 100%)",
                    mixBlendMode: "overlay",
                  }}
                />
              )}
              {isActive && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[10px] shadow-[inset_0_0_0_2px_var(--color-accent)]"
                />
              )}
              <span className="absolute start-1.5 top-1.5 rounded-md bg-canvas/85 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink">
                {item.tag}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QueueSkeleton({ loading, hasKey }: { loading: boolean; hasKey: boolean }) {
  const t = useT();
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center rounded-[28px] border border-edge-soft bg-elevated/30 px-12 py-16 text-center">
      {loading ? (
        <p className="text-[15px] text-ink-muted">{t("Building tonight's queue…")}</p>
      ) : !hasKey ? (
        <p className="max-w-[60ch] text-[15px] text-ink-muted">
          {t("Add a TMDB key in Settings to unlock the full discovery feed.")}
        </p>
      ) : (
        <p className="text-[15px] text-ink-muted">{t("No picks loaded. TMDB might be unreachable.")}</p>
      )}
    </div>
  );
}
