import { Flag } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { usePosterChain } from "@/components/poster";
import { endVoyage } from "@/lib/voyage/store";
import type { Voyage } from "@/lib/voyage/types";

export function VoyageSailing({
  voyage,
  next,
  onPlay,
}: {
  voyage: Voyage;
  next: Meta;
  onPlay: (meta: Meta) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    next.id,
    next.poster,
    next.type === "series" ? "series" : "movie",
  );
  const position = voyage.routeIds.indexOf(next.id) + 1;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        {t("Up next")}
      </span>

      <div className="flex items-center gap-4 rounded-md border border-edge-soft bg-canvas/30 p-3">
        <span className="block h-[86px] w-[58px] shrink-0 overflow-hidden rounded-[8px] ring-1 ring-edge-soft">
          <img
            src={poster.src}
            onError={poster.onError}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className="text-[10.5px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: voyage.accent }}
          >
            {t("Film {n} of {total}", { n: position, total: voyage.routeIds.length })}
          </span>
          <h3 className="line-clamp-2 font-display text-[19px] font-medium leading-tight tracking-tight text-ink">
            {next.name}
          </h3>
          {(next.releaseInfo || next.runtime) && (
            <span className="flex items-center gap-2 text-[12px] tabular-nums text-ink-subtle">
              {next.releaseInfo && <span>{next.releaseInfo}</span>}
              {next.runtime && <span>{next.runtime}</span>}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onPlay(next)}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97]"
        >
          <Play size={14} strokeWidth={2.4} fill="currentColor" /> {t("Play")}
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={endVoyage}
          className="flex h-8 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:border-danger/40 hover:text-danger"
        >
          <Flag size={13} strokeWidth={2.2} /> {t("End voyage")}
        </button>
        <span className="text-[11.5px] text-ink-subtle">{t("Your queue is saved until you clear it.")}</span>
      </div>
    </div>
  );
}
