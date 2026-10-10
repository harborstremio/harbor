import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { usePosterChain } from "@/components/poster";
import type { AnimeHit } from "@/lib/search";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import type { Meta } from "@/lib/cinemeta";
import { kitsuToAnilist } from "@/lib/providers/anime-mapping";
import { animeRelations, type AnimeRelation } from "@/lib/anilist/relations";

async function resolveAnilistId(hit: AnimeHit): Promise<number | null> {
  if (hit.anilistId) return hit.anilistId;
  if (hit.kitsuId) return kitsuToAnilist(hit.kitsuId).catch(() => null);
  return null;
}

export function AnimeRelations({ anime, onClose }: { anime: AnimeHit; onClose: () => void }) {
  const t = useT();
  const { openMeta } = useView();
  const { settings } = useSettings();
  const [entries, setEntries] = useState<AnimeRelation[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    void resolveAnilistId(anime)
      .then((id) => (id == null ? null : animeRelations(id)))
      .catch(() => null)
      .then((list) => {
        if (!cancelled) setEntries(list);
      });
    return () => {
      cancelled = true;
    };
  }, [anime]);

  const open = (entry: AnimeRelation) => {
    const meta: Meta = {
      id: `anilist:${entry.id}`,
      type: "anime",
      name: entry.name,
      poster: entry.poster,
      background: entry.poster,
      releaseInfo: entry.year != null ? String(entry.year) : undefined,
    };
    onClose();
    openMeta(meta, { exact: true });
  };

  if (!entries || entries.length === 0) return null;

  const items = [
    ...entries.filter((e) => e.kind === "prequel"),
    ...entries.filter((e) => e.kind === "sequel"),
  ];

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        <Sparkles size={11} strokeWidth={2.2} />
        {t("Sequels & Prequels")}
      </h3>
      <RelationCarousel items={items} rpdbKey={settings.rpdbKey} onOpen={open} />
    </section>
  );
}

function RelationCarousel({
  items,
  rpdbKey,
  onOpen,
}: {
  items: AnimeRelation[];
  rpdbKey: string;
  onOpen: (entry: AnimeRelation) => void;
}) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const measure = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [items.length]);

  const slide = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {canPrev && (
        <button
          type="button"
          aria-label={t("Scroll left")}
          onClick={() => slide(-1)}
          className="absolute start-0 top-[42%] z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-edge-soft bg-elevated/90 text-ink shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] backdrop-blur transition-colors hover:bg-raised"
        >
          <ChevronLeft size={18} strokeWidth={2.2} />
        </button>
      )}
      <div
        ref={trackRef}
        className="flex gap-3 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((entry) => (
          <RelationCard key={entry.id} entry={entry} rpdbKey={rpdbKey} onOpen={onOpen} />
        ))}
      </div>
      {canNext && (
        <button
          type="button"
          aria-label={t("Scroll right")}
          onClick={() => slide(1)}
          className="absolute end-0 top-[42%] z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-edge-soft bg-elevated/90 text-ink shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] backdrop-blur transition-colors hover:bg-raised"
        >
          <ChevronRight size={18} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

function RelationCard({
  entry,
  rpdbKey,
  onOpen,
}: {
  entry: AnimeRelation;
  rpdbKey: string;
  onOpen: (entry: AnimeRelation) => void;
}) {
  const t = useT();
  const poster = usePosterChain(rpdbKey, `anilist:${entry.id}`, entry.poster, "series");
  return (
    <button
      onClick={() => onOpen(entry)}
      className="flex w-[110px] shrink-0 flex-col gap-1.5 text-start transition-transform active:scale-[0.98]"
    >
      <span className="aspect-[2/3] w-full overflow-hidden rounded-xl bg-canvas shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft">
        {poster.src ? (
          <img
            src={poster.src}
            alt=""
            loading="lazy"
            draggable={false}
            onError={poster.onError}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] text-ink-subtle">
            {t("No art")}
          </span>
        )}
      </span>
      <span className="truncate text-[12px] font-semibold leading-tight text-ink">
        {entry.name}
      </span>
      <span className="flex items-center gap-1.5 text-[10px] leading-none text-ink-subtle">
        <span className="font-medium uppercase tracking-[0.08em] text-ink-muted">
          {t(entry.kind === "prequel" ? "Prequel" : "Sequel")}
        </span>
        {entry.year && <span>{entry.year}</span>}
      </span>
    </button>
  );
}
