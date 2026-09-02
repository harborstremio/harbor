import { NavChevron } from "@/components/nav-arrow";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FeedHero } from "@/components/feed-hero";
import { Poster } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import { extendPool, getPool, type FeedItem } from "@/lib/feed";
import { rankByAffinity } from "@/lib/feed/rank";
import { blockQueueItem, filterQueuePool, shuffleQueuePool, snoozeQueueItem } from "@/lib/feed/skipped";
import { getDownvotedIds, getUpvotedIds } from "@/lib/feed/preferences";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

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
  const [enterDir, setEnterDir] = useState<"fromRight" | "fromLeft" | "pop">("pop");
  const rootRef = useRef<HTMLElement>(null);

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
        setEnterDir(direction === "back" ? "fromLeft" : "fromRight");
        setLeaveAnim(direction);
        window.setTimeout(() => {
          setActiveId(next.meta.id);
          setLeaveAnim(null);
        }, 200);
      } else {
        setEnterDir(i > activeIndex ? "fromRight" : "fromLeft");
        setActiveId(next.meta.id);
      }
    },
    [pool, leaveAnim, activeIndex],
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
    setEnterDir("fromRight");
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
    setEnterDir("pop");
    setLeaveAnim("block");
    window.setTimeout(() => {
      setPool((p) => p.filter((it) => it.meta.id !== id));
      setActiveId(nextId);
      setLeaveAnim(null);
    }, 240);
  }, [item, leaveAnim, nextIdAfterRemoval]);

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
      ? "-translate-x-8 opacity-0 transition-[transform,opacity] duration-200 ease-out"
      : leaveAnim === "back"
        ? "translate-x-8 opacity-0 transition-[transform,opacity] duration-200 ease-out"
        : leaveAnim === "block"
          ? "scale-[0.98] opacity-0 blur-sm transition-[transform,opacity,filter] duration-[240ms] ease-out"
          : "";
  const enterClass =
    enterDir === "fromRight" ? "queue-in-right" : enterDir === "fromLeft" ? "queue-in-left" : "queue-in-pop";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!rootRef.current || rootRef.current.offsetParent === null) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onPrev]);

  return (
    <main ref={rootRef} className="harbor-queue-page min-w-0 flex-1 overflow-hidden pb-12 pt-20">
      <div className="mx-auto flex h-full min-w-0 max-w-[1180px] flex-col gap-5 px-6 sm:px-12">
        <header className="harbor-queue-head flex shrink-0 items-baseline gap-3">
          <h1 className="font-display text-[20px] font-medium tracking-tight text-ink">
            {t("Discovery Queue")}
          </h1>
          <span className="text-[12px] uppercase tracking-[0.2em] text-ink-subtle">
            {loading
              ? t("Loading…")
              : `${String(Math.min(activeIndex + 1, pool.length)).padStart(2, "0")} / ${String(pool.length).padStart(2, "0")}`}
          </span>
        </header>

        {item ? (
          <div className="relative flex-1 min-h-[280px] max-h-[600px]">
            <div className={`${leaveClass} h-full`}>
              <div key={item.meta.id} className={`h-full ${enterClass}`}>
                <FeedHero
                  item={item}
                  position={activeIndex}
                  total={pool.length}
                  onSkip={onSkip}
                  onNotInterested={onNotInterested}
                />
              </div>
            </div>
            <NavArrow
              side="left"
              disabled={activeIndex === 0 || leaveAnim != null}
              onClick={onPrev}
            />
            <NavArrow
              side="right"
              disabled={activeIndex >= pool.length - 1 || leaveAnim != null}
              onClick={onNext}
            />
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

function NavArrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? t("Previous") : t("Next")}
      className={`harbor-queue-arrow absolute top-1/2 ${
        side === "left" ? "-start-5" : "-end-5"
      } z-20 grid h-20 w-20 -translate-y-1/2 place-items-center text-white/85 drop-shadow-[0_2px_9px_rgba(0,0,0,0.8)] transition-[transform,color,opacity] duration-200 ease-out hover:scale-110 hover:text-white active:scale-95 disabled:pointer-events-none disabled:opacity-20 motion-reduce:transition-none motion-reduce:hover:scale-100`}
    >
      <NavChevron dir={side} size={60} />
    </button>
  );
}

function Strip({
  pool,
  active,
  onJump,
}: {
  pool: FeedItem[];
  active: number;
  onJump: (i: number) => void;
}) {
  const t = useT();
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const child = el.querySelector<HTMLButtonElement>(`[data-active="true"]`);
    if (child) {
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      child.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "nearest", inline: "center" });
    }
  }, [active]);

  return (
    <div className="flex flex-col gap-3">
      <span className="harbor-queue-striplabel text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-subtle">
        {t("Queue")}
      </span>
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
              className={`harbor-queue-tile group relative h-[112px] w-[200px] shrink-0 rounded-md transition-all duration-200 hover:z-10 hover:scale-[1.02] ${
                isPast ? "opacity-50" : ""
              }`}
            >
              <Poster
                src={item.meta.background ?? item.meta.poster}
                seed={item.meta.id}
                ratio="landscape"
                className="absolute inset-0 rounded-md"
              />
              {isActive && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-md"
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
                  className="pointer-events-none absolute inset-0 rounded-md shadow-[inset_0_0_0_2px_var(--color-accent)]"
                />
              )}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 rounded-b-md"
                style={{
                  background:
                    "linear-gradient(to top, color-mix(in oklch, var(--color-canvas), transparent 8%) 0%, color-mix(in oklch, var(--color-canvas), transparent 55%) 46%, transparent 100%)",
                }}
              />
              <QueueCardTitle meta={item.meta} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function useQueueLogo(meta: Meta): string | undefined {
  const { settings } = useSettings();
  const [logo, setLogo] = useState<string | undefined>(() => peekCachedLogo(settings.tmdbKey, meta));
  useEffect(() => {
    let cancelled = false;
    const cached = peekCachedLogo(settings.tmdbKey, meta);
    if (cached) {
      setLogo(cached);
      return;
    }
    setLogo(undefined);
    resolveLogo(settings.tmdbKey, meta)
      .then((url) => {
        if (!cancelled && url) setLogo(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta, settings.tmdbKey]);
  return logo;
}

function QueueCardTitle({ meta }: { meta: Meta }) {
  const logo = useQueueLogo(meta);
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt={meta.name}
        draggable={false}
        onError={() => setFailed(true)}
        className="pointer-events-none absolute bottom-2 start-2.5 end-2.5 max-h-[38px] w-auto max-w-[82%] object-contain object-left-bottom drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
      />
    );
  }
  return (
    <span className="pointer-events-none absolute bottom-2 start-2.5 end-2.5 line-clamp-2 text-start text-[12.5px] font-semibold leading-tight text-ink [text-shadow:0_1px_6px_rgba(0,0,0,0.85)]">
      {meta.name}
    </span>
  );
}

function QueueSkeleton({ loading, hasKey }: { loading: boolean; hasKey: boolean }) {
  const t = useT();
  if (loading) {
    return (
      <div className="harbor-skel relative h-full min-h-[300px] overflow-hidden rounded-2xl border border-edge-soft bg-elevated/25">
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 p-8 sm:p-10">
          <div className="h-6 w-20 rounded-full bg-elevated/60" />
          <div className="h-10 w-2/3 max-w-[420px] rounded-lg bg-elevated/60" />
          <div className="h-3.5 w-1/2 max-w-[320px] rounded bg-elevated/45" />
          <div className="mt-2 flex gap-3">
            <div className="h-12 w-44 rounded-full bg-elevated/60" />
            <div className="h-12 w-28 rounded-full bg-elevated/45" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-edge-soft bg-elevated/30 px-12 py-16 text-center">
      {!hasKey ? (
        <p className="max-w-[60ch] text-[15px] text-ink-muted">
          {t("Add a TMDB key in Settings to unlock the full discovery feed.")}
        </p>
      ) : (
        <p className="text-[15px] text-ink-muted">{t("No picks loaded. TMDB might be unreachable.")}</p>
      )}
    </div>
  );
}
