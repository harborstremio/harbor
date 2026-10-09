import { Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { Poster } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import {
  entityToMeta,
  fetchTvdbCollection,
  fetchTvdbEntity,
  type TvdbCollection,
  type TvdbCollectionHit,
  type TvdbEntityCard,
} from "@/lib/providers/tvdb-collections";

export function CollectionHitsRow({
  hits,
  onOpen,
}: {
  hits: TvdbCollectionHit[];
  onOpen: (hit: TvdbCollectionHit) => void;
}) {
  const t = useT();
  if (hits.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        {t("Collections")}
      </h3>
      <div className="grid gap-2 lg:grid-cols-2">
        {hits.map((hit) => (
          <button
            key={hit.id}
            type="button"
            onClick={() => onOpen(hit)}
            className="group relative flex h-[88px] items-end overflow-hidden rounded-2xl border border-edge-soft bg-elevated text-start transition-colors hover:border-edge"
          >
            {hit.image && (
              <img
                src={hit.image}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover opacity-50 transition-opacity group-hover:opacity-65"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
            <div className="relative flex w-full items-center gap-2.5 px-4 pb-3">
              <Layers size={14} strokeWidth={2.2} className="shrink-0 text-white/70" />
              <span className="truncate text-[15px] font-semibold text-white">{hit.name}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function EntryCard({
  entry,
  onOpen,
}: {
  entry: { kind: "movie" | "series"; tvdbId: number };
  onOpen: (m: Meta) => void;
}) {
  const [card, setCard] = useState<TvdbEntityCard | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchTvdbEntity(entry.kind, entry.tvdbId)
      .then((c) => {
        if (!cancelled) setCard(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entry.kind, entry.tvdbId]);
  if (!card) {
    return <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-white/[0.06]" />;
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(entityToMeta(card))}
      className="group flex w-full min-w-0 flex-col gap-2 text-start"
    >
      <Poster
        src={card.poster ?? undefined}
        seed={`tvdb:${card.kind}:${card.tvdbId}`}
        ratio="portrait"
        className="rounded-xl ring-1 ring-white/10 transition-transform duration-200 group-hover:-translate-y-1"
      />
      <div className="flex flex-col">
        <span className="line-clamp-1 text-[13px] font-medium text-white/90">{card.name}</span>
        {card.year && <span className="text-[11.5px] text-white/50">{card.year}</span>}
      </div>
    </button>
  );
}

export function CollectionPane({
  id,
  name,
  image,
  onOpenTitle,
  onBackdrop,
}: {
  id: number;
  name: string;
  image: string | null;
  onOpenTitle: (m: Meta) => void;
  onBackdrop: (url: string | null) => void;
}) {
  const t = useT();
  const [coll, setColl] = useState<TvdbCollection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onBackdrop(image);
  }, [image, onBackdrop]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTvdbCollection(id)
      .then((c) => {
        if (cancelled) return;
        setColl(c);
        if (c?.image) onBackdrop(c.image);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, onBackdrop]);

  return (
    <div className="flex flex-col gap-6 px-6 pb-8 pt-1 sm:px-8">
      <div className="flex flex-col gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-white/60">
          {t("Collection")}
        </span>
        <h2 className="text-[30px] font-semibold leading-[1.08] text-white">{coll?.name ?? name}</h2>
        {coll?.overview && (
          <p className="line-clamp-3 max-w-[70ch] text-[14px] leading-relaxed text-white/72">
            {coll.overview}
          </p>
        )}
        {coll && (
          <span className="text-[12.5px] font-medium text-white/55">
            {t("{n} titles", { n: coll.entries.length })}
          </span>
        )}
      </div>
      {loading && !coll ? (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-xl bg-white/[0.06]" />
          ))}
        </div>
      ) : coll && coll.entries.length > 0 ? (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {coll.entries.map((e) => (
            <EntryCard key={`${e.kind}-${e.tvdbId}`} entry={e} onOpen={onOpenTitle} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center text-[13.5px] text-white/55">
          {t("Couldn't load this collection right now.")}
        </p>
      )}
    </div>
  );
}
