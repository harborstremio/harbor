import { AVATAR_CATALOG, avatarUrl } from "@/lib/avatars/catalog";
import { useT } from "@/lib/i18n";
import { ChevronLeft, ChevronRight, Info, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function AvatarCatalogModal({
  current,
  onPick,
  onClose,
}: {
  current?: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [franchise, setFranchise] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canStart, setCanStart] = useState(false);
  const [canEnd, setCanEnd] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const x = Math.abs(el.scrollLeft);
    setCanStart(x > 4);
    setCanEnd(x < max - 4);
  };
  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const nudge = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: dir * 280 * (rtl ? -1 : 1), behavior: "smooth" });
  };

  const franchises = useMemo(() => AVATAR_CATALOG.map((g) => g.group), []);
  const query = q.trim().toLowerCase();
  const items = useMemo(() => {
    let flat = AVATAR_CATALOG.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));
    if (franchise) flat = flat.filter((it) => it.group === franchise);
    if (query)
      flat = flat.filter((it) => it.name.toLowerCase().includes(query) || it.group.toLowerCase().includes(query));
    return flat;
  }, [franchise, query]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
      <div className="absolute inset-0 animate-in fade-in bg-black/70 backdrop-blur-sm duration-200" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[86vh] w-full max-w-[940px] animate-in fade-in zoom-in-95 flex-col overflow-hidden rounded-3xl border border-edge bg-surface shadow-2xl duration-200"
      >
        <div className="flex items-center gap-4 px-6 pt-5 pb-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">{t("Choose an avatar")}</h2>
            <div className="flex items-center gap-1.5">
              <p className="text-[12.5px] text-ink-subtle">
                {t("{n} avatars across film, TV, and anime.", { n: items.length })}
              </p>
              <Disclaimer />
            </div>
          </div>
          <div className="relative hidden sm:block">
            <Search
              size={15}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder={t("Search")}
              className="h-10 w-56 rounded-xl border border-edge bg-canvas ps-9 pe-3 text-[13.5px] text-ink outline-none transition-colors focus:border-ink-subtle"
            />
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label={t("common.close")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>

        <div className="relative border-y border-edge-soft">
          {canStart && <ScrollEdge side="start" onClick={() => nudge(-1)} />}
          <div
            ref={scrollRef}
            onScroll={updateArrows}
            className="flex gap-2 overflow-x-auto px-6 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <FilterChip active={franchise === null} onClick={() => setFranchise(null)}>
              {t("All")}
            </FilterChip>
            {franchises.map((f) => (
              <FilterChip key={f} active={franchise === f} onClick={() => setFranchise(f)}>
                {f}
              </FilterChip>
            ))}
          </div>
          {canEnd && <ScrollEdge side="end" onClick={() => nudge(1)} />}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <p className="py-16 text-center text-[14px] text-ink-subtle">{t("No matches.")}</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-x-3 gap-y-4">
              {items.map((it) => {
                const url = avatarUrl(it.id);
                const selected = current === url;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => onPick(it.id)}
                    title={`${it.name} · ${it.group}`}
                    className="group flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={`relative block aspect-square w-full overflow-hidden rounded-full ring-2 transition-all ${
                        selected ? "ring-accent" : "ring-transparent group-hover:ring-edge"
                      }`}
                    >
                      <img
                        src={url}
                        alt={it.name}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </span>
                    <span
                      className={`w-full truncate text-center text-[11px] leading-tight transition-colors ${
                        selected ? "font-semibold text-ink" : "text-ink-subtle group-hover:text-ink-muted"
                      }`}
                    >
                      {it.name}
                    </span>
                  </button>
                );
              })}
              {franchise === null && !query && (
                <div className="flex flex-col items-center gap-1.5" title={t("More avatars coming soon")}>
                  <span className="flex aspect-square w-full items-center justify-center rounded-full border border-dashed border-edge/70 text-ink-subtle">
                    <Plus size={18} strokeWidth={2} />
                  </span>
                  <span className="w-full truncate text-center text-[11px] leading-tight text-ink-subtle">
                    {t("More soon")}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Disclaimer() {
  const t = useT();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const show = hover || pinned;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setPinned((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={t("Rights and usage")}
        className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
          show ? "bg-elevated text-ink-muted" : "text-ink-subtle hover:bg-elevated hover:text-ink-muted"
        }`}
      >
        <Info size={13} strokeWidth={2.2} />
      </button>
      {show && (
        <div className="animate-popover-in absolute start-0 top-full z-20 mt-1.5 w-[290px] rounded-xl border border-edge-soft bg-elevated/97 px-3.5 py-3 text-start shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] backdrop-blur-md">
          <p className="text-[12px] leading-relaxed text-ink-muted">
            {t(
              "Fan-made avatars for personal use. Harbor claims no rights to these characters; they belong to their creators and studios, shown here under fair use. Every one is optimized down to a tiny WebP.",
            )}
          </p>
        </div>
      )}
    </span>
  );
}

function ScrollEdge({ side, onClick }: { side: "start" | "end"; onClick: () => void }) {
  const t = useT();
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-10 flex items-center from-surface via-surface to-transparent ${
        side === "start" ? "start-0 bg-gradient-to-r ps-3 pe-10" : "end-0 bg-gradient-to-l pe-3 ps-10"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={side === "start" ? t("Scroll left") : t("Scroll right")}
        className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-elevated text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink"
      >
        {side === "start" ? (
          <ChevronLeft size={15} strokeWidth={2.4} className="dir-icon" />
        ) : (
          <ChevronRight size={15} strokeWidth={2.4} className="dir-icon" />
        )}
      </button>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
        active ? "bg-ink text-canvas" : "bg-elevated text-ink-muted hover:bg-raised hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
