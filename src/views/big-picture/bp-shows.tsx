import { useEffect, useMemo, useRef } from "react";
import type { Meta } from "@/lib/cinemeta";
import { goBigPictureTab } from "@/lib/big-picture";
import { SFX } from "@/lib/sfx";
import { isAnimeCwItem } from "@/lib/stremio";
import { useMobileCw, useMobileCwReady } from "@/views/mobile/mobile-cw-row";
import { BpPageSkeleton } from "./bp-page-skeleton";
import { BpSpotlight } from "./bp-spotlight";
import { BpCwRow, cwMeta } from "./bp-cw-row";
import { BpRow } from "./bp-row";
import { BP_PAGE_TOP, BpRail, type BpRailEntry } from "./bp-rail";
import { useBpPagePhase } from "./bp-catalog-page";
import { BpRowGrid, useBpRowGrid } from "./bp-row-grid";
import { seedBpMeta, unpinBpMeta } from "./bp-focus-meta";
import { useBpRail } from "./use-bp-rail";
import { bpRailSignature, useBpLayoutReflow } from "./use-bp-row-layout";
import { bpCatalogShape, useBpShows } from "./use-bp-shows";
import { useBpT } from "./bp-i18n";

const CW_POOL = 40;
const CW_LIMIT = 16;
const VISIBLE_ROWS = 60;

export function BpShows({ onSelect }: { onSelect: (m: Meta) => void }) {
  const { rows, hero, runtimeTitleKeys, loading, failed, retry } = useBpShows();
  const cwPool = useMobileCw(CW_POOL);
  const cwReady = useMobileCwReady();
  const t = useBpT();
  const grid = useBpRowGrid();

  // Anime episodes belong to the Anime lane's own CW row. Without this they show
  // up in both tabs.
  const cw = useMemo(
    () =>
      cwReady
        ? cwPool.filter((i) => i.type === "series" && !isAnimeCwItem(i)).slice(0, CW_LIMIT)
        : [],
    [cwReady, cwPool],
  );
  // BOTH conditions, and frozen once. Latching on cwReady alone read the answer
  // while the catalogs were still loading, so a page whose rows land before the
  // Stremio library does stamped data-bp-autofocus on row zero and then moved it
  // to the CW row on the next commit: two autofocus nodes across two renders,
  // with the shell's settle pass dragging the ring after the marker. bp-home's
  // seedRowRef carries the full record of why the answer must be frozen.
  const cwLedRef = useRef<boolean | null>(null);
  if (cwReady && !loading && cwLedRef.current === null) cwLedRef.current = cw.length > 0;
  const cwLeads = cwLedRef.current === true && cw.length > 0;
  const seed = cw[0] ? cwMeta(cw[0]) : (hero[0] ?? rows[0]?.metas[0]);

  const visible = rows.slice(0, VISIBLE_ROWS);
  const signature = bpRailSignature([...visible.map((r) => r.key), String(cw.length)]);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const phase = useBpPagePhase(pageRef);
  const { railRef, activeRow, railShift } = useBpRail(signature);
  useBpLayoutReflow({ railRef, signature, routeKey: "shows" });

  useEffect(() => {
    unpinBpMeta();
    seedBpMeta(seed ?? null);
  }, [seed?.id]);

  if (grid.target) return <BpRowGrid target={grid.target} onSelect={onSelect} />;

  if (loading && rows.length === 0 && cw.length === 0)
    return <BpPageSkeleton topClass={BP_PAGE_TOP} />;

  if (rows.length === 0 && cw.length === 0) {
    return (
      <BpShowsMessage
        title={failed ? t("Couldn't load series") : t("No series to show yet")}
        body={
          failed
            ? t("Harbor couldn't reach the catalog servers.")
            : t("Add a TMDB key in Settings to fill this page with curated series rows.")
        }
        action={failed ? t("Try again") : t("Open settings")}
        onAction={failed ? retry : () => goBigPictureTab("settings")}
      />
    );
  }

  const entries: BpRailEntry[] = [
    {
      key: "cw",
      node: (
        <BpCwRow
          items={cw}
          onSelect={onSelect}
          autofocusFirst={cwLeads}
          lead={{
            rowKey: "cw",
            title: t("Jump back in"),
            action: t("Your library"),
            tab: "library",
          }}
        />
      ),
    },
    // The see-all cannot use `tab` here: a shows row belongs to Shows, which is
    // the page it would be pressed from. It opens the row's own feed as a grid,
    // so Right at the end of a row answers on every catalog page alike.
    ...visible.map((row, i) => {
      const title = runtimeTitleKeys.has(row.key) ? row.name : t(row.name);
      return {
        key: row.key,
        node: (
          <BpRow
            title={title}
            metas={row.metas}
            row={row}
            shape={bpCatalogShape(row)}
            onSelect={onSelect}
            autofocusFirst={!cwLeads && i === 0}
            lead={{
              rowKey: row.key,
              title,
              action: t("See all"),
              open: () => grid.open({ row, title, rowKey: row.key }),
            }}
          />
        ),
      };
    }),
  ];

  return (
    <div ref={pageRef} className="relative flex h-full flex-col">
      <div data-bp-page-hero className={`relative z-20 shrink-0 ${BP_PAGE_TOP}`}>
        <BpSpotlight phase={phase} />
      </div>
      <BpRail railRef={railRef} entries={entries} activeRow={activeRow} railShift={railShift} />
    </div>
  );
}

const ACTION =
  "relative mt-[clamp(4px,0.8vh,12px)] flex min-h-[clamp(48px,6vh,64px)] items-center rounded-full border border-[var(--bp-edge-2)] px-[clamp(26px,2.4vw,46px)] text-[clamp(15px,2vh,21px)] font-bold text-ink transition-[background-color,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] motion-reduce:transition-none";

function BpShowsMessage({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[clamp(12px,1.8vh,22px)] px-[var(--bp-gutter)] text-center">
      <h2 className="font-display text-[clamp(20px,3vh,38px)] font-semibold text-ink">{title}</h2>
      <p className="max-w-[46ch] text-[clamp(13px,1.85vh,21px)] text-ink-muted">{body}</p>
      <button
        type="button"
        data-bp-focusable
        data-bp-chip
        data-bp-autofocus="true"
        onClick={() => {
          SFX.click();
          onAction();
        }}
        className={ACTION}
      >
        {action}
      </button>
    </div>
  );
}
