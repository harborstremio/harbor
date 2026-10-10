import { useEffect, useId } from "react";
import { Dices, Flag, Undo2 } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { chooseHeading, endVoyage, metaById, rerollHeadings, undoPick } from "@/lib/voyage/store";
import type { Voyage } from "@/lib/voyage/types";
import { PortCard } from "./port-card";
import { PortHoverCard, usePortHover } from "./port-hover-card";

export function VoyagePicker({ voyage, inline = false }: { voyage: Voyage; inline?: boolean }) {
  const t = useT();
  const { settings } = useSettings();
  const tmdbKey = settings.tmdbKey ?? "";
  const headings = voyage.headingIds
    .map((id) => metaById(voyage, id))
    .filter((m): m is Meta => !!m);
  const picked = voyage.routeIds.length;
  const hover = usePortHover();
  const hoverId = useId();
  const lineup = voyage.headingIds.join(",");
  useEffect(() => hover.drop(), [lineup]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2" aria-live="polite" aria-atomic="true">
        <span className="text-[13px] font-semibold text-ink">
          {picked === 0
            ? t("Choose your starting film")
            : t("Pick film {n} of {total}", { n: picked + 1, total: voyage.targetLength })}
        </span>
        <span className="text-[11px] text-ink-subtle">{t("Choose 1 of 3")}</span>
      </div>

      <div key={lineup} className={inline ? "voyage-inline-picks" : "grid grid-cols-3 gap-3.5"}>
        {headings.map((meta, i) => (
          <PortCard
            key={meta.id}
            meta={meta}
            index={i}
            state="heading"
            describedBy={hover.meta?.id === meta.id ? hoverId : undefined}
            onHover={(rect) => (rect ? hover.enter(meta, rect) : hover.leave())}
            onClick={() => {
              hover.drop();
              chooseHeading(meta.id, tmdbKey);
            }}
          />
        ))}
      </div>

      {hover.meta && hover.anchor && (
        <PortHoverCard key={hover.meta.id} id={hoverId} meta={hover.meta} anchor={hover.anchor} onEnter={hover.keep} onLeave={hover.leave} />
      )}

      <div className="mt-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={endVoyage}
          className="flex h-8 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:border-danger/40 hover:text-danger"
        >
          <Flag size={13} strokeWidth={2.2} /> {t("Start over")}
        </button>
        <div className="flex items-center gap-2">
          {picked > 0 && (
            <button
              type="button"
              onClick={() => undoPick(tmdbKey)}
              className="flex h-8 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
            >
              <Undo2 size={13} strokeWidth={2.2} /> {t("Undo")}
            </button>
          )}
          <button
            type="button"
            onClick={() => rerollHeadings(tmdbKey)}
            className="flex h-8 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <Dices size={13} strokeWidth={2.2} /> {t("Show me 3 others")}
          </button>
        </div>
      </div>
    </div>
  );
}
