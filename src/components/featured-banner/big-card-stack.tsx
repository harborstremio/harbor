import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import { useTmdbImdbId } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { MetaAwardsCorner } from "../meta-awards-corner";
import { ThumbsDock } from "./thumbs-dock";
import { FADE_MS, upsizeTmdb } from "./types";

type LogoMap = Record<string, string | null>;

function seedLogos(tmdbKey: string, items: Meta[]): LogoMap {
  const seed: LogoMap = {};
  for (const m of items) {
    const v = peekCachedLogo(tmdbKey, m);
    if (v !== undefined) seed[m.id] = v;
  }
  return seed;
}

export function BigCardStack({
  items,
  active,
  onPrev,
  onNext,
}: {
  items: Meta[];
  active: number;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { settings } = useSettings();
  const { openMeta } = useView();
  const t = useT();
  const current = items[active] ?? items[0];
  const resolvedImdb = useTmdbImdbId(current.id);
  const [logos, setLogos] = useState<LogoMap>(() => seedLogos(settings.tmdbKey, items));
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; pointerId: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const indices = new Set<number>();
    for (let i = -2; i <= 2; i++) {
      indices.add((((active + i) % items.length) + items.length) % items.length);
    }
    const pending = items.filter((m, i) => indices.has(i) && !(m.id in logos));
    if (pending.length === 0) return;
    Promise.all(
      pending.map(async (m) => {
        const url = await resolveLogo(settings.tmdbKey, m).catch(() => undefined);
        return [m.id, url ?? null] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setLogos((prev) => {
        let changed = false;
        const next: LogoMap = { ...prev };
        for (const [id, val] of entries) {
          if (!(id in next)) {
            next[id] = val;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [items, settings.tmdbKey, logos, active]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (e.target instanceof Element && e.target.closest("button, a, [data-no-drag]")) return;
    dragRef.current = { x: e.clientX, pointerId: e.pointerId, moved: false };
    setDragging(true);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6) d.moved = true;
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const moved = d.moved;
      dragRef.current = null;
      setDragging(false);
      if (moved) {
        if (dx < -40) onNext?.();
        else if (dx > 40) onPrev?.();
      } else if (!moved) {
        openMeta({ ...current, logo: logos[current.id] ?? current.logo });
      }
    },
    [current, onNext, onPrev, openMeta, logos],
  );

  const handlePointerCancel = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);

  const logo = logos[current.id] ?? undefined;

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openMeta({ ...current, logo: logos[current.id] ?? current.logo });
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onPrev?.();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          onNext?.();
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`group relative block h-full min-h-[420px] w-full min-w-0 overflow-hidden rounded-2xl border border-edge-soft bg-canvas text-start transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] hover:-translate-y-1 ${
        dragging ? "cursor-grabbing select-none" : "cursor-pointer"
      }`}
      style={{ isolation: "isolate", touchAction: "pan-y" }}
    >
      {items.map((m, i) => {
        const distance = Math.min(
          Math.abs(i - active),
          Math.abs(i - active + items.length),
          Math.abs(i - active - items.length),
        );
        const shouldMount = distance <= 1;
        const src = upsizeTmdb(m.background ?? m.poster);
        return (
          <div
            key={m.id}
            aria-hidden={i !== active}
            className="absolute inset-[2px] overflow-hidden rounded-[14px]"
            style={{
              opacity: i === active ? 1 : 0,
              transition: `opacity ${FADE_MS}ms cubic-bezier(0.32, 0.72, 0.24, 1)`,
            }}
          >
            {src && shouldMount && (
              <img src={src} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            )}
          </div>
        );
      })}
      <div
        aria-hidden
        className="absolute inset-[2px] rounded-[14px]"
        style={{
          background:
            "linear-gradient(to top, oklch(0.10 0.02 260 / 0.92) 0%, oklch(0.10 0.02 260 / 0.20) 38%, transparent 60%)",
        }}
      />
      <div className="absolute start-7 top-6 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent">
        <span className="rounded-full bg-canvas/55 px-2.5 py-1">{t("Featured")}</span>
      </div>
      <div
        className="absolute inset-x-7 bottom-7 flex flex-col gap-3"
        style={{ transition: `opacity ${FADE_MS}ms ease-out` }}
      >
        <TitlePlate title={current.name} logo={logo} />
        <div className="flex items-center gap-2.5 text-[13px] text-ink/80">
          {current.releaseInfo && <span>{current.releaseInfo}</span>}
        </div>
      </div>
      <div className="pointer-events-none absolute end-7 top-6 z-10">
        <MetaAwardsCorner meta={current} imdbId={resolvedImdb} />
      </div>
      {onPrev && items.length > 1 && (
        <button
          type="button"
          data-no-drag
          aria-label={t("Previous")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas/65 text-ink opacity-0 backdrop-blur-md transition-all duration-200 hover:bg-canvas/85 hover:scale-105 group-hover:opacity-100"
        >
          <ChevronLeft size={22} strokeWidth={2.2} className="dir-icon" />
        </button>
      )}
      {onNext && items.length > 1 && (
        <button
          type="button"
          data-no-drag
          aria-label={t("Next")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          style={{ position: "absolute", insetInlineEnd: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10 }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas/65 text-ink opacity-0 backdrop-blur-md transition-all duration-200 hover:bg-canvas/85 hover:scale-105 group-hover:opacity-100"
        >
          <ChevronRight size={22} strokeWidth={2.2} className="dir-icon" />
        </button>
      )}
      <ThumbsDock meta={current} />
    </div>
  );
}

function TitlePlate({ title, logo }: { title: string; logo?: string }) {
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    setLogoLoaded(false);
    setLogoFailed(false);
  }, [logo]);
  const showLogo = !!logo && !logoFailed;
  return (
    <div className="relative flex min-h-[64px] flex-col justify-end">
      {showLogo ? (
        <img
          src={logo}
          alt={title}
          decoding="async"
          onLoad={() => setLogoLoaded(true)}
          onError={() => setLogoFailed(true)}
          className="max-h-[88px] w-auto max-w-[58%] object-contain object-left rtl:object-right drop-shadow-[0_4px_20px_rgba(0,0,0,0.55)]"
          style={{
            opacity: logoLoaded ? 1 : 0,
            transition: "opacity 420ms cubic-bezier(0.32, 0.72, 0.24, 1)",
          }}
        />
      ) : (
        <h3 className="font-display text-[42px] font-medium leading-[1.0] tracking-tight text-ink drop-shadow-[0_2px_22px_rgba(0,0,0,0.6)]">
          {title}
        </h3>
      )}
    </div>
  );
}
