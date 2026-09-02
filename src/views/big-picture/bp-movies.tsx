import { useEffect, useRef } from "react";
import type { Meta } from "@/lib/cinemeta";
import { goBigPictureTab } from "@/lib/big-picture";
import { SFX } from "@/lib/sfx";
import { BpPageSkeleton } from "./bp-page-skeleton";
import { BpSpotlight } from "./bp-spotlight";
import { BpRow } from "./bp-row";
import { BP_PAGE_TOP, BpRail, type BpRailEntry } from "./bp-rail";
import { useBpPagePhase } from "./bp-catalog-page";
import { BpRowGrid, useBpRowGrid } from "./bp-row-grid";
import { seedBpMeta, unpinBpMeta } from "./bp-focus-meta";
import { useBpMovies } from "./use-bp-movies";
import { useBpRail } from "./use-bp-rail";
import { bpRailSignature, useBpLayoutReflow } from "./use-bp-row-layout";
import { bpCatalogShape } from "./use-bp-shows";
import { useBpT } from "./bp-i18n";

const VISIBLE_ROWS = 60;

export function BpMovies({ onSelect }: { onSelect: (m: Meta) => void }) {
  const { hero, rows, runtimeTitleKeys, loading, failed, retry } = useBpMovies();
  const t = useBpT();
  const grid = useBpRowGrid();

  const visible = rows.slice(0, VISIBLE_ROWS);
  const signature = bpRailSignature(visible.map((r) => r.key));
  const pageRef = useRef<HTMLDivElement | null>(null);
  const phase = useBpPagePhase(pageRef);
  const { railRef, activeRow, railShift } = useBpRail(signature);
  useBpLayoutReflow({ railRef, signature, routeKey: "movies" });
  const seed = visible[0]?.metas[0] ?? hero[0];

  useEffect(() => {
    unpinBpMeta();
  }, []);

  useEffect(() => {
    unpinBpMeta();
    seedBpMeta(seed ?? null);
  }, [seed?.id]);

  if (grid.target) return <BpRowGrid target={grid.target} onSelect={onSelect} />;

  if (loading && visible.length === 0) return <BpPageSkeleton topClass={BP_PAGE_TOP} />;

  if (visible.length === 0) {
    return (
      <BpMoviesMessage
        title={failed ? t("Couldn't load movies") : t("No movies to show yet")}
        body={
          failed
            ? t("Harbor couldn't reach the catalog servers.")
            : t("Add a TMDB key in Setup to power this view.")
        }
        action={failed ? t("Try again") : t("Open settings")}
        onAction={failed ? retry : () => goBigPictureTab("settings")}
      />
    );
  }

  // Both ends of a row answer, the same as they do on Home. Left at the start
  // reaches the nav, Right at the end reaches this see-all. It cannot use `tab`:
  // the tab a movies row belongs to is Movies, so the press would reload the
  // page it was pressed from. It opens the row's own feed as a grid instead.
  const entries: BpRailEntry[] = visible.map((row, i) => {
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
      <div data-bp-page-hero className={`relative z-20 shrink-0 ${BP_PAGE_TOP}`}>
        <BpSpotlight phase={phase} />
      </div>
      <BpRail railRef={railRef} entries={entries} activeRow={activeRow} railShift={railShift} />
    </div>
  );
}

const ACTION =
  "relative mt-[clamp(4px,0.8vh,12px)] flex min-h-[clamp(48px,6vh,64px)] items-center rounded-full border border-[var(--bp-edge-2)] px-[clamp(26px,2.4vw,46px)] text-[clamp(15px,2vh,21px)] font-bold text-ink transition-[background-color,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] motion-reduce:transition-none";

function BpMoviesMessage({
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
