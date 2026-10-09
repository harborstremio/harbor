import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { BpAnimeHero } from "./bp-anime-hero";
import { animeCardBadges, BpAnimeRailBody } from "./bp-anime-row";
import { BpCatalogPage } from "./bp-catalog-page";
import { useBpT } from "./bp-i18n";
import { BpPageMessage } from "./bp-page-message";
import { BpSkeletonRow } from "./bp-page-skeleton";
import type { BpRailEntry } from "./bp-rail";
import { BpRow } from "./bp-row";
import { BpRowGrid, useBpRowGrid } from "./bp-row-grid";
import { setBpFocus } from "./use-bp-focus";
import { useBpAnime } from "./use-bp-anime";
import { bpRailSignature } from "./use-bp-row-layout";

const SKELETON_MAX_MS = 9000;
const VISIBLE_ROWS = 60;

export function BpAnime({ onSelect }: { onSelect: (m: Meta) => void }) {
  const t = useBpT();
  const { settings } = useSettings();
  const data = useBpAnime();
  const grid = useBpRowGrid();
  // use-bp-anime derives loading as !hasContent && !failed, so a settled-empty
  // anime page leaves it true forever and the skeleton's bp-shimmer runs at rest
  // for as long as the page is open. The data contract is the real bug; this
  // bounds the animation until it is fixed.
  const [skeletonDone, setSkeletonDone] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSkeletonDone(true), SKELETON_MAX_MS);
    return () => window.clearTimeout(id);
  }, []);

  const visible = data.rows.slice(0, VISIBLE_ROWS);

  // animeRows.order and animeRows.hidden are applied in useBpAnime, so a layout
  // pulled from another device arrives here as a reordered data.rows with the
  // rail indices already renumbered under whatever the ring was sitting on.
  const signature = bpRailSignature([
    data.cwRow ? "cw" : "cw:empty",
    "picks",
    ...visible.map((r) => r.id),
  ]);

  // The settings search deep-links into a named anime row. Without this the
  // link resolves to nothing once the surface is Big Picture.
  //
  // Resolved by the row's own key rather than by a rail index. The index used to
  // be computed as a fixed prefix plus the row's position, which is the same
  // arithmetic-over-conditionals that made Discover's ordering drift: every row
  // now stamps data-bp-row-key, so there is nothing left to keep in step.
  useEffect(() => {
    const handler = (e: Event) => {
      const anchor = (e as CustomEvent<{ anchor?: string }>).detail?.anchor ?? "";
      const group = anchor.startsWith("row:") ? anchor.slice(4) : "";
      if (!group) return;
      const rows = data.cwRow ? [data.cwRow, ...data.rows] : data.rows;
      const row = rows.find((r) => r.group === group || r.id === group);
      if (!row) return;
      const section = document.querySelector<HTMLElement>(
        `[data-bp-rail-row] [data-bp-row-key="${CSS.escape(row.id)}"]`,
      );
      const cell = section?.querySelector<HTMLElement>("[data-bp-focusable]");
      if (cell) setBpFocus(cell, { silent: true });
    };
    window.addEventListener("harbor:anime-focus-row", handler as EventListener);
    return () => window.removeEventListener("harbor:anime-focus-row", handler as EventListener);
  }, [data.cwRow, data.rows]);

  if (settings.hideContent.anime) {
    return (
      <BpPageMessage
        title={t("Anime is hidden")}
        body={t("Turn anime back on in Harbor's content settings to browse it here.")}
      />
    );
  }

  if (data.failed) {
    return (
      <BpPageMessage
        title={t("Couldn't load anime")}
        body={t("Harbor couldn't reach MyAnimeList or AniList. Check the connection and reopen Big Picture.")}
      />
    );
  }

  if (grid.target) return <BpRowGrid target={grid.target} onSelect={onSelect} />;

  // Indices come from position in this list, never from arithmetic. Everything
  // is pushed unconditionally so a band with nothing in it keeps its number:
  // BpRow and BpAnimeRailBody both render null when empty, and BpRailRow's
  // empty:hidden collapses the wrapper.
  const entries: BpRailEntry[] = [
    {
      key: "cw",
      node: data.cwRow ? <BpAnimeRailBody row={data.cwRow} onSelect={onSelect} /> : null,
    },
    {
      key: "picks",
      node: (
        <BpRow
          title={t("Top Picks for You")}
          metas={data.topPicks}
          onSelect={onSelect}
          cornerOf={animeCardBadges}
        />
      ),
    },
    ...visible.map((row) => {
      const source = row.source;
      return {
        key: row.id,
        node: (
          <BpAnimeRailBody
            row={row}
            onSelect={onSelect}
            onSeeAll={source ? () => grid.open({ row: source, title: row.title, rowKey: row.id }) : undefined}
          />
        ),
      };
    }),
  ];

  entries.push({
    key: "loading",
    node:
      data.rows.length === 0 && data.loading && !skeletonDone ? (
        <div className="flex flex-col gap-[var(--bp-row-gap)]">
          <BpSkeletonRow />
          <BpSkeletonRow />
        </div>
      ) : null,
  });

  return (
    <BpCatalogPage
      routeKey="anime"
      signature={signature}
      entries={entries}
      hero={({ phase }) => (
        <BpAnimeHero
          phase={phase}
          heroSlide={data.heroSlide}
          slides={data.slides}
          cwItems={data.cwItems}
          topPicks={data.topPicks}
          onSelect={onSelect}
        />
      )}
    />
  );
}
