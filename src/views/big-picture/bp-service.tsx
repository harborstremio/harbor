import { useEffect, useRef } from "react";
import type { Meta } from "@/lib/cinemeta";
import { goBigPictureTab } from "@/lib/big-picture";
import { SFX } from "@/lib/sfx";
import { SERVICES } from "@/lib/providers/streaming";
import type { StreamingService } from "@/lib/settings";
import { BpPageSkeleton } from "./bp-page-skeleton";
import { BpSpotlight } from "./bp-spotlight";
import { BpRow } from "./bp-row";
import { BP_PAGE_TOP, BpRail, type BpRailEntry } from "./bp-rail";
import { useBpPagePhase } from "./bp-catalog-page";
import { BpRowGrid, useBpRowGrid } from "./bp-row-grid";
import { seedBpMeta, unpinBpMeta } from "./bp-focus-meta";
import { useBpRail } from "./use-bp-rail";
import { bpRailSignature, useBpLayoutReflow } from "./use-bp-row-layout";
import { bpServiceRowKey, useBpServiceRows } from "./use-bp-service-rows";
import { useBpT } from "./bp-i18n";

const ACTION =
  "relative mt-[clamp(4px,0.8vh,12px)] flex min-h-[clamp(48px,6vh,64px)] items-center rounded-full border border-[var(--bp-edge-2)] px-[clamp(26px,2.4vw,46px)] text-[clamp(15px,2vh,21px)] font-bold text-ink transition-[background-color,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] motion-reduce:transition-none";

export function BpService({
  service,
  onSelect,
}: {
  service: StreamingService;
  onSelect: (m: Meta) => void;
}) {
  const t = useBpT();
  const grid = useBpRowGrid();
  const meta = SERVICES[service];
  const { rows, loading, hasKey } = useBpServiceRows(service);

  const signature = bpRailSignature(rows.map((r) => r.key));
  const pageRef = useRef<HTMLDivElement | null>(null);
  const phase = useBpPagePhase(pageRef);
  const { railRef, activeRow, railShift } = useBpRail(signature);
  useBpLayoutReflow({ railRef, signature, routeKey: `service:${service}` });
  const seed = rows[0]?.metas[0];

  useEffect(() => {
    unpinBpMeta();
    seedBpMeta(seed ?? null);
  }, [seed?.id]);

  const tint = (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `radial-gradient(ellipse 90% 100% at 30% 0%, ${meta.tint}38 0%, transparent 62%)`,
      }}
    />
  );

  if (grid.target) return <BpRowGrid target={grid.target} onSelect={onSelect} />;

  if (loading && rows.length === 0) {
    return (
      <div className="relative h-full">
        {tint}
        <BpPageSkeleton topClass={BP_PAGE_TOP} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-[clamp(12px,1.8vh,22px)] px-[var(--bp-gutter)] text-center">
        {tint}
        <h2 className="font-display text-[clamp(20px,3vh,38px)] font-semibold text-ink">
          {meta.name}
        </h2>
        <p className="max-w-[46ch] text-[clamp(13px,1.85vh,21px)] text-ink-muted">
          {hasKey
            ? t("Nothing matched this filter. Try another category or change your region in Settings.")
            : t("Add a TMDB key in Setup to power this view.")}
        </p>
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          data-bp-autofocus="true"
          onClick={() => {
            SFX.click();
            goBigPictureTab("settings");
          }}
          className={ACTION}
        >
          {t("Open settings")}
        </button>
      </div>
    );
  }

  const allKey = bpServiceRowKey(service, "all");
  // No `tab`: a service row has no tab of its own, so its see-all opens the
  // row's own feed as a grid, the same as Movies and Shows.
  const entries: BpRailEntry[] = rows.map((row, i) => {
    const title = row.key === allKey ? `${t("Popular on")} ${meta.name}` : t(row.name);
    return {
      key: row.key,
      node: (
        <BpRow
          title={title}
          metas={row.metas}
          row={row}
          onSelect={onSelect}
          autofocusFirst={i === 0}
          lead={{
            rowKey: row.key,
            title,
            action: t("See all"),
            open: () => grid.open({ row, title, rowKey: row.key }),
          }}
        />
      ),
    };
  });

  return (
    <div ref={pageRef} className="relative flex h-full flex-col">
      {tint}
      <div data-bp-page-hero className={`relative z-20 shrink-0 ${BP_PAGE_TOP}`}>
        <BpSpotlight phase={phase} />
      </div>
      <BpRail railRef={railRef} entries={entries} activeRow={activeRow} railShift={railShift} />
    </div>
  );
}
