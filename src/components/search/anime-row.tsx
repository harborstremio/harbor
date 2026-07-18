import { Sparkles, Star } from "lucide-react";
import { usePosterChain } from "@/components/poster";
import type { AnimeHit } from "@/lib/search";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import type { Meta } from "@/lib/cinemeta";

function animeHitMetaId(hit: AnimeHit): string {
  if (hit.kitsuId) return `kitsu:${hit.kitsuId}`;
  if (hit.malId) return `mal:${hit.malId}`;
  if (hit.anilistId) return `anilist:${hit.anilistId}`;
  return `mal:${hit.malId}`;
}

export function AnimeRow({ items, onClose }: { items: AnimeHit[]; onClose: () => void }) {
  const { openMeta } = useView();
  const t = useT();
  if (items.length === 0) return null;

  const open = (hit: AnimeHit) => {
    const meta: Meta = {
      id: animeHitMetaId(hit),
      type: "anime",
      name: hit.name,
      poster: hit.poster ?? undefined,
      background: hit.background ?? hit.poster ?? undefined,
      description: hit.overview,
      releaseInfo: hit.year ?? undefined,
      imdbRating: hit.score > 0 ? hit.score.toFixed(1) : undefined,
    } as Meta;
    onClose();
    openMeta(meta);
  };

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        <Sparkles size={11} strokeWidth={2.2} />
        {t("Anime")}
      </h3>
      <div className="flex flex-col gap-2">
        {items.map((hit) => (
          <AnimeRowItem key={animeHitMetaId(hit)} hit={hit} onOpen={open} />
        ))}
      </div>
    </section>
  );
}

function AnimeRowItem({ hit, onOpen }: { hit: AnimeHit; onOpen: (hit: AnimeHit) => void }) {
  const t = useT();
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    animeHitMetaId(hit),
    hit.poster ?? undefined,
    "series",
  );
  return (
    <button
      onClick={() => onOpen(hit)}
      className="group flex items-start gap-3 rounded-xl border border-edge-soft/60 bg-elevated/40 p-2.5 text-start transition-colors hover:border-edge hover:bg-elevated"
    >
      <span className="flex h-[88px] w-[60px] shrink-0 overflow-hidden rounded-md bg-canvas">
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
          <span className="m-auto text-[10px] text-ink-subtle">{t("No art")}</span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[14px] font-semibold text-ink">{hit.name}</span>
        <span className="flex items-center gap-2 text-[11.5px] text-ink-subtle">
          {hit.year && <span>{hit.year}</span>}
          {hit.score > 0 && (
            <span className="flex items-center gap-0.5 text-accent">
              <Star size={10} strokeWidth={0} fill="currentColor" />
              {hit.score.toFixed(1)}
            </span>
          )}
        </span>
        {hit.overview && (
          <span className="line-clamp-2 text-[12px] leading-snug text-ink-muted">
            {hit.overview}
          </span>
        )}
      </span>
    </button>
  );
}
