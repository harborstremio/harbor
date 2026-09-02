import { Check } from "lucide-react";
import { useMemo } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { usePosterChain } from "@/components/poster";
import { metaById } from "@/lib/voyage/store";
import { isVoyageWatched, voyageProgress } from "@/lib/voyage/progress";
import type { Voyage } from "@/lib/voyage/types";

export function RouteRail({ voyage, onPlay }: { voyage: Voyage; onPlay?: (meta: Meta) => void }) {
  const t = useT();
  const sailing = voyage.phase === "sailing";
  const { played, progressOf } = useMemo(() => {
    const done = new Set<string>();
    const prog = new Map<string, number>();
    for (const id of voyage.routeIds) {
      const meta = metaById(voyage, id);
      if (isVoyageWatched(id, meta)) done.add(id);
      else prog.set(id, voyageProgress(id, meta));
    }
    return { played: done, progressOf: prog };
  }, [voyage]);
  const current = sailing
    ? voyage.routeIds.findIndex((id) => !played.has(id))
    : voyage.routeIds.length;
  const slots = Math.max(voyage.targetLength, voyage.routeIds.length);
  const counter = sailing
    ? t("{done} of {total} watched", { done: played.size, total: voyage.routeIds.length })
    : t("{done} of {total} picked", { done: voyage.routeIds.length, total: voyage.targetLength });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
          {t("Your queue")}
        </span>
        <span className="text-[12px] font-semibold tabular-nums text-ink-muted">{counter}</span>
      </div>
      <ol className="flex items-center gap-2">
        {Array.from({ length: slots }).map((_, i) => {
          const id = voyage.routeIds[i];
          const meta = id ? metaById(voyage, id) : undefined;
          const done = !!id && played.has(id);
          const progress = !id || done ? 0 : (progressOf.get(id) ?? 0);
          const isCurrent = i === current;
          const canPlay = !!onPlay && !!meta;
          return (
            <li key={i} className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!canPlay}
                title={meta?.name}
                aria-label={meta ? `${t("Play")} ${meta.name}` : undefined}
                onClick={canPlay ? () => onPlay(meta) : undefined}
                className={`relative aspect-[2/3] w-full max-w-[52px] shrink-0 overflow-hidden rounded-[8px] ring-1 transition-transform duration-150 ${
                  meta ? "ring-edge-soft" : "ring-edge-soft/40"
                } ${canPlay ? "hover:-translate-y-0.5 hover:ring-edge active:scale-[0.97]" : ""}`}
                style={isCurrent ? { boxShadow: `0 0 0 1.5px ${voyage.accent}` } : undefined}
              >
                {meta ? (
                  <SlotPoster meta={meta} dim={done} />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-elevated text-[11px] font-semibold tabular-nums text-ink-subtle">
                    {i + 1}
                  </span>
                )}
                {done && (
                  <span className="absolute end-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-canvas/85 text-ink">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
                {progress > 0 && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-[3px] bg-canvas/70"
                  >
                    <span
                      className="block h-full rounded-e-full transition-[width] duration-300"
                      style={{ width: `${Math.round(progress * 100)}%`, background: voyage.accent }}
                    />
                  </span>
                )}
              </button>
              {i < slots - 1 && (
                <span
                  aria-hidden
                  className="h-[2px] flex-1 rounded-full transition-colors duration-500"
                  style={{
                    background: i < current ? voyage.accent : "var(--color-edge-soft)",
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SlotPoster({ meta, dim }: { meta: Meta; dim: boolean }) {
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  return (
    <img
      src={poster.src}
      onError={poster.onError}
      data-voyage-thumb=""
      alt=""
      draggable={false}
      className={`h-full w-full object-cover ${dim ? "brightness-[0.55]" : ""}`}
    />
  );
}
