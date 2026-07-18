import { Star } from "lucide-react";
import type { AiResult } from "@/lib/ai-search";
import { useLocalizedOverview } from "@/lib/use-localized-overview";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { ResultPoster } from "../result-poster";

function AiResultRow({
  result,
  onClose,
  index,
}: {
  result: AiResult;
  onClose: () => void;
  index: number;
}) {
  const { openMeta } = useView();
  const t = useT();
  const { meta, season, episode, episodeTitle } = result;
  const description = useLocalizedOverview(meta);
  const isEpisode = season != null && episode != null;
  return (
    <button
      onClick={() => {
        openMeta(meta, isEpisode ? { episodeHint: { season, episode } } : undefined);
        onClose();
      }}
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
      className="group animate-ai-reveal flex min-w-0 items-center gap-4 rounded-2xl border border-transparent px-3 py-2.5 text-start transition-colors hover:border-edge-soft hover:bg-elevated/50 active:scale-[0.997]"
    >
      <div className="h-[96px] w-[64px] shrink-0 overflow-hidden rounded-xl shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft">
        <ResultPoster id={meta.id} poster={meta.poster} className="block h-full w-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {isEpisode && (
          <span className="w-fit rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-accent ring-1 ring-accent/25">
            {t("S{s} · E{e}", { s: season, e: episode })}
          </span>
        )}
        <span className="truncate text-[16px] font-semibold text-ink">
          {isEpisode && episodeTitle ? episodeTitle : meta.name}
        </span>
        <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          {isEpisode && <span className="truncate">{meta.name}</span>}
          {isEpisode && meta.releaseInfo && (
            <span aria-hidden className="h-1 w-1 rounded-full bg-ink-subtle" />
          )}
          {meta.releaseInfo && <span>{meta.releaseInfo}</span>}
          {meta.imdbRating && (
            <>
              <span aria-hidden className="h-1 w-1 rounded-full bg-ink-subtle" />
              <span className="flex items-center gap-1 text-ink">
                <Star size={11} className="fill-accent text-accent" />
                {meta.imdbRating}
              </span>
            </>
          )}
        </div>
        {!isEpisode && description && (
          <span className="line-clamp-2 text-[12.5px] leading-snug text-ink-subtle">
            {description}
          </span>
        )}
      </div>
    </button>
  );
}

export function AiResultList({ results, onClose }: { results: AiResult[]; onClose: () => void }) {
  if (results.length === 0) return null;
  return (
    <div className="grid min-w-0 gap-1">
      {results.map((r, i) => (
        <AiResultRow
          key={r.season != null ? `${r.meta.id}:${r.season}:${r.episode}` : r.meta.id}
          result={r}
          onClose={onClose}
          index={i}
        />
      ))}
    </div>
  );
}
