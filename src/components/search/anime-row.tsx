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
    openMeta(meta, { exact: true });
  };

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        <Sparkles size={11} strokeWidth={2.2} />
        {t("Anime")}
      </h3>
      <div className="grid min-w-0 gap-1">
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
  const poster = usePosterChain(settings.rpdbKey, animeHitMetaId(hit), hit.poster ?? undefined, "series");
  return (
    <button
      onClick={() => onOpen(hit)}
      className="group flex min-w-0 items-center gap-4 rounded-2xl border border-transparent px-3 py-2.5 text-start transition-colors hover:border-edge-soft hover:bg-elevated/50 active:scale-[0.997]"
    >
      <span className="flex h-[96px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft">
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
          <span className="text-[10px] text-ink-subtle">{t("No art")}</span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[16px] font-semibold text-ink">{hit.name}</span>
        <span className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          {hit.year && <span>{hit.year}</span>}
          {hit.year && hit.score > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-ink-subtle" />}
          {hit.score > 0 && (
            <span className="flex items-center gap-1 text-ink">
              <Star size={11} className="fill-accent text-accent" />
              {hit.score.toFixed(1)}
            </span>
          )}
        </span>
        {hit.overview && (
          <span className="line-clamp-2 text-[12.5px] leading-snug text-ink-subtle">
            {hit.overview}
          </span>
        )}
      </span>
    </button>
  );
}
