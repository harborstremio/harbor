import { useState } from "react";
import { ArrowDownWideNarrow, ChevronLeft, Filter, RefreshCw, X } from "lucide-react";
import { QUALITY_LABEL, type QualityKey } from "@/components/player/stream-switcher/quality";
import { abbreviateLanguages } from "@/views/play-picker/picker-utils";
import { useBpT } from "./bp-i18n";
import { BP_CHIP_EDGE_MASK, BpChip, BpChipDivider } from "./bp-library-chips";
import { BpStreamMenu, type BpMenuOption } from "./bp-stream-menu";
import type { BpStreamMode } from "./bp-stream-filters";
import type { BpStreams } from "./use-bp-streams";

export type BpSourceKind = "all" | "local" | "media-server" | "online";

const TRACK =
  "flex items-center gap-[clamp(8px,0.75vw,15px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function BpStreamChips({
  s,
  sourceKind,
  onSourceKind,
  onClose,
}: {
  s: BpStreams;
  sourceKind: BpSourceKind;
  onSourceKind: (kind: BpSourceKind) => void;
  onClose: () => void;
}) {
  const t = useBpT();
  const [menu, setMenu] = useState<string | null>(null);

  const qualityLabel = (k: QualityKey) => (k === "all" ? t("All") : QUALITY_LABEL[k]);
  const modeLabel: Record<BpStreamMode, string> = {
    both: t("All sources"),
    addons: t("Direct/debrid only"),
    p2p: t("P2P only"),
  };
  const sourceLabel =
    sourceKind === "local"
      ? t("Local Library")
      : sourceKind === "media-server"
        ? t("Media servers")
        : modeLabel[s.streamMode];
  const sourceMenuOptions: BpMenuOption[] = [
    { id: "all", label: t("All sources") },
    { id: "local", label: t("Local Library"), count: s.localFiles.length },
    { id: "media-server", label: t("Media servers"), count: s.homeServerCopies.length },
    { id: "addons", label: t("Direct/debrid only"), count: s.total },
    { id: "p2p", label: t("P2P only") },
  ];
  const activeFilterName = s.customFilters.find((f) => f.id === s.activeFilterId)?.name.trim();
  const addonName =
    s.addonFilter === "all"
      ? t("Every addon")
      : (s.addonOptions.find((o) => o.id === s.addonFilter)?.name ?? t("Every addon"));

  const menuFacet = s.facets.find((f) => f.key === menu);

  const addonMenuOptions: BpMenuOption[] = [
    { id: "all", label: t("Every addon"), count: s.total },
    ...s.addonOptions.map((o) => ({
      id: o.id,
      label: o.name,
      count: o.count,
      addonId: o.id,
      logo: o.logo,
    })),
  ];
  const filterMenuOptions: BpMenuOption[] = [
    { id: "none", label: t("No filter") },
    ...s.customFilters.map((f) => ({ id: f.id, label: f.name.trim() || t("Filter") })),
  ];
  const facetMenuOptions: BpMenuOption[] = menuFacet
    ? [
        { id: "all", label: t("All"), count: menuFacet.total },
        ...menuFacet.options.map((o) => ({ id: o.key, label: o.key, count: o.count })),
      ]
    : [];

  return (
    <>
      <section
        data-bp-row
        style={{ containIntrinsicSize: "auto 110px" }}
        className="relative shrink-0"
      >
        {/* Twelve or more chips never fit 1140px, so the rail always overflows
            and the last one was bisected by the screen edge with nothing saying
            why. The ramp lands on the gutter, so the row reads as continuing
            rather than as a clipped outline. */}
        <div
          data-bp-scroll-x
          className={TRACK}
          style={{ maskImage: BP_CHIP_EDGE_MASK, WebkitMaskImage: BP_CHIP_EDGE_MASK }}
        >
          <BpChip
            label={t("Back")}
            onSelect={onClose}
            icon={<ChevronLeft size={18} strokeWidth={2.6} />}
          />
          <BpChipDivider />

          {s.qualityChips.map((c) => (
            <BpChip
              key={c.key}
              label={qualityLabel(c.key)}
              count={c.count}
              selected={s.quality === c.key}
              onSelect={() => s.setQuality(c.key)}
            />
          ))}

          {s.debrids.length > 0 && (
            <BpChip
              label={t("Cached")}
              count={s.cachedCount}
              selected={s.cachedOnly}
              onSelect={() => s.setCachedOnly(!s.cachedOnly)}
            />
          )}

          <BpChipDivider />

          <BpChip
            label={addonName}
            selected={s.addonFilter !== "all"}
            onSelect={() => setMenu("addon")}
          />

          {s.facets.map((f) => (
            <BpChip
              key={f.key}
              label={f.value === "all" ? t(f.label) : `${t(f.label)} · ${f.value}`}
              selected={f.value !== "all"}
              onSelect={() => setMenu(f.key)}
            />
          ))}

          {s.preferredLangs.length > 0 && s.langHiddenCount > 0 && (
            <BpChip
              label={abbreviateLanguages(s.preferredLangs)}
              count={s.langHiddenCount}
              selected={s.langFilter}
              onSelect={() => s.setLangFilter(!s.langFilter)}
            />
          )}

          <BpChip
            label={sourceLabel}
            selected={sourceKind !== "all" || s.streamMode !== "both"}
            onSelect={() => setMenu("source-kind")}
          />

          {s.customFilters.length > 0 && (
            <BpChip
              label={activeFilterName || t("Filters")}
              selected={s.activeFilterId != null}
              icon={<Filter size={17} strokeWidth={2.4} />}
              onSelect={() => setMenu("filter")}
            />
          )}

          <BpChipDivider />

          <BpChip
            label={
              s.sortForced
                ? t("Addon order (locked)")
                : s.sort === "addon"
                  ? t("Addon order")
                  : t("Harbor pick")
            }
            selected={s.sort === "addon" || s.sortForced}
            disabled={s.sortForced}
            icon={<ArrowDownWideNarrow size={18} strokeWidth={2.4} />}
            onSelect={() => s.setSort(s.sort === "addon" ? "harbor" : "addon")}
          />

          {s.filtered && (
            <BpChip
              label={t("Clear filters")}
              icon={<X size={17} strokeWidth={2.6} />}
              onSelect={s.clearFilters}
            />
          )}

          <BpChip
            label={t("Refresh")}
            onSelect={s.refresh}
            icon={<RefreshCw size={18} strokeWidth={2.4} />}
          />
        </div>
      </section>

      {menu === "addon" && (
        <BpStreamMenu
          title={t("Sources by addon")}
          options={addonMenuOptions}
          value={s.addonFilter}
          onPick={(id) => {
            s.setAddonFilter(id);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}

      {menu === "filter" && (
        <BpStreamMenu
          title={t("Filters")}
          options={filterMenuOptions}
          value={s.activeFilterId ?? "none"}
          onPick={(id) => {
            s.setActiveFilterId(id === "none" ? null : id);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}

      {menu === "source-kind" && (
        <BpStreamMenu
          title={t("Sources")}
          options={sourceMenuOptions}
          value={
            sourceKind === "online" || (sourceKind === "all" && s.streamMode !== "both")
              ? s.streamMode
              : sourceKind
          }
          onPick={(id) => {
            if (id === "addons" || id === "p2p") {
              s.setStreamMode(id);
              onSourceKind("online");
            } else {
              s.setStreamMode("both");
              onSourceKind(id as BpSourceKind);
            }
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}

      {menuFacet && (
        <BpStreamMenu
          title={t(menuFacet.label)}
          options={facetMenuOptions}
          value={menuFacet.value}
          onPick={(id) => {
            s.setFacet(menuFacet.key, id);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}
