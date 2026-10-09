import { Plug } from "lucide-react";
import { SFX } from "@/lib/sfx";
import type { SportsAddonListing } from "@/lib/sports/addon-sources-model";
import { useBpT } from "../bp-i18n";
import { BP_DETAIL_HEADING, BP_DETAIL_TRACK } from "../detail/bp-detail-chrome";
import {
  BP_ADDON_LIFT,
  BP_ADDON_SUB,
  BP_ADDON_TITLE,
  BpSportsAddonMark,
} from "./bp-sports-addon-parts";
import type { BpSportsAddonSources } from "./bp-sports-addon-sources";

const SHOWN = 8;

const TILE =
  "flex min-h-[clamp(64px,7vh,92px)] w-[clamp(250px,22vw,420px)] shrink-0 items-center gap-[clamp(11px,0.9vw,18px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] px-[clamp(13px,1.1vw,22px)] py-[clamp(11px,1.2vh,19px)] text-start";

export function BpSportsAddonRow({
  sources,
  onOpen,
}: {
  sources: BpSportsAddonSources;
  onOpen: (row: SportsAddonListing | null) => void;
}) {
  const t = useBpT();
  if (!sources.available) return null;
  const rows = sources.matching.slice(0, SHOWN);

  return (
    <section
      data-bp-row
      data-bp-row-key="sports-addons"
      className="relative"
      style={{ containIntrinsicSize: "auto 240px" }}
    >
      <h2 className={BP_DETAIL_HEADING}>{t("Addon sources")}</h2>
      <div data-bp-scroll-x className={BP_DETAIL_TRACK}>
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            data-bp-focusable
            data-bp-tile="wide"
            data-bp-restore-key={`sports-addon-${row.addon.manifest.id}-${row.meta.id}`}
            style={BP_ADDON_LIFT}
            onClick={() => {
              SFX.click();
              onOpen(row);
            }}
            className={TILE}
          >
            <BpSportsAddonMark src={row.addon.manifest.logo || row.meta.logo || row.meta.poster} />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className={BP_ADDON_TITLE}>{row.meta.name}</span>
              <span className={BP_ADDON_SUB}>
                {row.match === "event"
                  ? `${row.addon.manifest.name} · ${t("Event matchup found")}`
                  : row.match === "channel"
                    ? `${row.addon.manifest.name} · ${t("Possible match · check the broadcast")}`
                    : row.addon.manifest.name}
              </span>
            </span>
          </button>
        ))}
        <button
          type="button"
          data-bp-focusable
          data-bp-tile="wide"
          data-bp-restore-key="sports-addon-browse"
          style={BP_ADDON_LIFT}
          onClick={() => {
            SFX.open();
            onOpen(null);
          }}
          className={TILE}
        >
          <Plug size={26} strokeWidth={2.1} className="shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className={BP_ADDON_TITLE}>{t("Browse addon channels")}</span>
            <span className={BP_ADDON_SUB}>
              {t("{n} listings from your addons", { n: sources.rows.length })}
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
