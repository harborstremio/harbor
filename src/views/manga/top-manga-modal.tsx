import { Award } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { RankModalShell } from "@/components/rank-modal-shell";
import { useT } from "@/lib/i18n";
import { MANGA_COLLECTIONS, streamCollection, type MangaCollection } from "@/lib/manga/collections";
import { hasAnyMangaSource } from "@/lib/manga/sources";
import type { MangaSummary } from "@/lib/manga/types";
import { TopMangaRow } from "./top-manga-row";

const MU_FAVICON = "https://www.mangaupdates.com/favicon.ico";
const GHOST_ROWS = 8;

function CollectionSwitch({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const barRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef(new Map<string, HTMLButtonElement>());
  const [line, setLine] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const btn = btnRefs.current.get(active);
    const bar = barRef.current;
    if (!btn || !bar) return;
    const b = bar.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    setLine({ left: r.left - b.left + bar.scrollLeft, width: r.width });
  }, [active]);

  return (
    <div className="relative">
      <div ref={barRef} className="flex gap-1 overflow-x-auto pb-2.5">
        {MANGA_COLLECTIONS.map((c) => {
          const on = c.id === active;
          return (
            <button
              key={c.id}
              ref={(el) => {
                if (el) btnRefs.current.set(c.id, el);
              }}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(c.id)}
              className={`flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none ${
                on ? "text-accent" : "text-ink-muted hover:text-ink"
              }`}
            >
              {c.award && <Award size={14} strokeWidth={2} className="text-ink-subtle" />}
              {t(c.name)}
            </button>
          );
        })}
      </div>
      <span
        aria-hidden
        className="absolute bottom-0 h-0.5 rounded-full bg-accent transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
        style={{ left: line.left, width: line.width }}
      />
    </div>
  );
}

function GhostRow() {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="h-[72px] w-12 shrink-0 rounded-lg bg-elevated/70 animate-pulse motion-reduce:animate-none" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="h-3.5 w-1/2 rounded bg-elevated/70 animate-pulse motion-reduce:animate-none" />
        <div className="h-3 w-2/3 rounded bg-elevated/50 animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}

export function TopMangaModal({
  open,
  onClose,
  onOpenManga,
}: {
  open: boolean;
  onClose: () => void;
  onOpenManga: (id: string) => void;
}) {
  const t = useT();
  const [activeId, setActiveId] = useState<string>(MANGA_COLLECTIONS[0].id);
  const [items, setItems] = useState<MangaSummary[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [iconOk, setIconOk] = useState(true);

  const collection: MangaCollection = useMemo(
    () => MANGA_COLLECTIONS.find((c) => c.id === activeId) ?? MANGA_COLLECTIONS[0],
    [activeId],
  );

  const fallback: MangaSummary[] = useMemo(
    () => collection.titles.map((title, i) => ({ id: `syn:${collection.id}:${i}`, title })),
    [collection],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setItems([]);
    setDone(false);
    setError(false);
    streamCollection(collection, (chunk) => {
      if (cancelled || chunk.length === 0) return;
      setItems((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const fresh = chunk.filter((m) => !ids.has(m.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
    })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, collection, reloadNonce]);

  const hasItems = items.length > 0;
  const noSource = !hasAnyMangaSource();

  const header = (
    <div className="min-w-0">
      <h2 className="font-display text-[24px] font-medium leading-tight tracking-tight text-ink">
        {t("Top Manga")}
      </h2>
      <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
        <span className="truncate">{t(collection.subtitle ?? collection.name)}</span>
        <span className="ms-1 inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas ring-1 ring-edge-soft">
          {iconOk ? (
            <img
              src={MU_FAVICON}
              alt=""
              className="h-3.5 w-3.5 object-contain"
              onError={() => setIconOk(false)}
            />
          ) : (
            <Award size={12} strokeWidth={2} className="text-ink-subtle" />
          )}
        </span>
        MangaUpdates
      </p>
    </div>
  );

  let body: ReactNode;
  if (error && !hasItems) {
    body = (
      <div className="flex h-40 flex-col items-center justify-center gap-3 text-[13.5px] text-ink-muted">
        {t("Couldn't load this collection")}
        <button
          type="button"
          onClick={() => setReloadNonce((n) => n + 1)}
          className="flex min-h-[44px] items-center rounded-lg px-4 text-[13.5px] font-medium text-ink ring-1 ring-edge-soft transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
        >
          {t("Retry")}
        </button>
      </div>
    );
  } else if (hasItems) {
    body = (
      <div className="flex flex-col divide-y divide-edge-soft/60">
        {items.map((item, i) => (
          <TopMangaRow
            key={item.id}
            item={item}
            collection={collection}
            rank={i + 1}
            onOpenManga={onOpenManga}
          />
        ))}
        {!done && Array.from({ length: 3 }).map((_, i) => <GhostRow key={`g${i}`} />)}
      </div>
    );
  } else if (!done) {
    body = (
      <div className="flex flex-col divide-y divide-edge-soft/60">
        {Array.from({ length: GHOST_ROWS }).map((_, i) => (
          <GhostRow key={i} />
        ))}
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-2">
        {noSource && (
          <p className="pb-1 text-[12.5px] text-ink-subtle">
            {t("Add a manga source to open these")}
          </p>
        )}
        <div className="flex flex-col divide-y divide-edge-soft/60">
          {fallback.map((item, i) => (
            <TopMangaRow
              key={item.id}
              item={item}
              collection={collection}
              rank={i + 1}
              onOpenManga={onOpenManga}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <RankModalShell open={open} onClose={onClose} ariaLabel={t("Top Manga")} header={header}>
      <div className="flex flex-col gap-5">
        <CollectionSwitch active={activeId} onSelect={setActiveId} />
        {body}
      </div>
    </RankModalShell>
  );
}
