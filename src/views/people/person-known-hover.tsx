import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { meta as fetchCinemetaMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";

const CARD_W = 300;
const CARD_MAX_H = 300;
const GAP = 10;

type FullMeta = Meta & { cast?: string[]; director?: string[] };

export function useHoverDwell(delayMs = 300) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const onEnter = (el: HTMLElement) => {
    clear();
    timer.current = window.setTimeout(() => {
      setRect(el.getBoundingClientRect());
      setOpen(true);
      timer.current = null;
    }, delayMs);
  };
  const openNow = (el: HTMLElement) => {
    clear();
    setRect(el.getBoundingClientRect());
    setOpen(true);
  };
  const onLeave = () => {
    clear();
    setOpen(false);
  };
  useEffect(() => clear, []);
  return { open, rect, onEnter, onLeave, openNow };
}

function placement(rect: DOMRect): CSSProperties {
  const centerX = rect.left + rect.width / 2;
  const left = Math.max(8, Math.min(centerX - CARD_W / 2, window.innerWidth - CARD_W - 8));
  const above = rect.top >= CARD_MAX_H + GAP + 8;
  return above
    ? { left, bottom: window.innerHeight - rect.top + GAP, width: CARD_W, transformOrigin: "bottom center" }
    : { left, top: rect.bottom + GAP, width: CARD_W, transformOrigin: "top center" };
}

function peopleLine(full: FullMeta | null): string {
  if (!full) return "";
  const parts: string[] = [];
  const director = (full.director ?? []).filter(Boolean).slice(0, 2);
  if (director.length > 0) parts.push(`Dir. ${director.join(", ")}`);
  const cast = (full.cast ?? []).filter(Boolean).slice(0, 3);
  if (cast.length > 0) parts.push(cast.join(", "));
  return parts.join("   ·   ");
}

export function KnownTileHover({ meta, rect }: { meta: Meta; rect: DOMRect }) {
  const [full, setFull] = useState<FullMeta | null>(null);
  const [art, setArt] = useState<string | null>(null);
  const local = meta.background ?? meta.poster ?? null;

  useEffect(() => {
    setFull(null);
    setArt(null);
    let alive = true;

    const settle = (src: string | null) => {
      if (!alive) return;
      if (!src) return;
      const probe = new Image();
      const show = () => {
        if (alive) setArt(src);
      };
      probe.src = src;
      if (typeof probe.decode === "function") {
        probe.decode().then(show, show);
      } else {
        probe.onload = show;
        probe.onerror = show;
      }
    };

    if (!meta.id.startsWith("tt")) {
      settle(local);
      return () => {
        alive = false;
      };
    }

    fetchCinemetaMeta(narrowMediaType(meta.type), meta.id)
      .then((m) => {
        if (!alive) return;
        const resolved = m as FullMeta | null;
        if (resolved) setFull(resolved);
        settle(resolved?.background ?? local);
      })
      .catch(() => settle(local));

    return () => {
      alive = false;
    };
  }, [meta.id, meta.type, local]);

  const backdrop = art;
  const description = (full?.description ?? meta.description ?? "").trim();
  const people = useMemo(() => peopleLine(full), [full]);
  const year = meta.releaseInfo ?? full?.releaseInfo;

  return createPortal(
    <div
      style={placement(rect)}
      className="pointer-events-none fixed z-[150] overflow-hidden rounded-lg border border-edge bg-elevated/95 shadow-[0_24px_64px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-popover-in motion-reduce:animate-none"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-canvas">
        {backdrop ? (
          <img src={backdrop} alt="" decoding="sync" className="h-full w-full object-cover" />
        ) : (
          <span className="block h-full w-full bg-gradient-to-br from-canvas to-elevated" />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-elevated via-elevated/20 to-transparent" />
      </div>
      <div className="flex flex-col gap-1.5 p-3.5">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-tight text-ink">
            {meta.name}
          </span>
          {year && <span className="shrink-0 text-[12px] font-medium text-ink-subtle">{year}</span>}
        </div>
        {description && (
          <p className="text-[12px] leading-relaxed text-ink-muted line-clamp-3">{description}</p>
        )}
        {people && <p className="truncate text-[11.5px] text-ink-subtle">{people}</p>}
      </div>
    </div>,
    document.body,
  );
}
