import { Dices, Flag, Undo2 } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { chooseHeading, endVoyage, metaById, rerollHeadings, undoPick } from "@/lib/voyage/store";
import type { Voyage } from "@/lib/voyage/types";
import { PortCard } from "./port-card";

export function VoyagePicker({ voyage }: { voyage: Voyage }) {
  const t = useT();
  const { settings } = useSettings();
  const tmdbKey = settings.tmdbKey ?? "";
  const headings = voyage.headingIds
    .map((id) => metaById(voyage, id))
    .filter((m): m is Meta => !!m);
  const picked = voyage.routeIds.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-semibold text-ink">
          {picked === 0
            ? t("Choose your starting film")
            : t("Pick film {n} of {total}", { n: picked + 1, total: voyage.targetLength })}
        </span>
        <span className="text-[11px] text-ink-subtle">{t("Choose 1 of 3")}</span>
      </div>

      <div className="grid grid-cols-3 gap-3.5">
        {headings.map((meta, i) => (
          <PortCard
            key={meta.id}
            meta={meta}
            index={i}
            state="heading"
            onClick={() => chooseHeading(meta.id, tmdbKey)}
          />
        ))}
      </div>

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
