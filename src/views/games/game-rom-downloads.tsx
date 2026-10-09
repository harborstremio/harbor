import { useEffect, useRef, useState } from "react";
import { observeWithin } from "@/lib/visibility";
import { ArrowUpRight, Download } from "lucide-react";
import { NavChevron } from "@/components/nav-arrow";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadRomDownloads, romCommunityGame, ROM_DOWNLOAD_CHART_URL } from "@/lib/games/rom-community";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { GameSourceIcon } from "./game-source-icon";
import { usePagedGameRow, useRowNavigation } from "./use-paged-game-row";
import "./game-row-motion.css";

export function RomDownloads({ active, open }: { active: boolean; open: (game: GameSummary) => void }) {
  const t = useT(), root = useRef<HTMLElement>(null), [near, setNear] = useState(false);
  const language = useUiLanguage();
  const grid = useRef<HTMLDivElement>(null), [slots, setSlots] = useState(6);
  const row = usePagedGameRow({ id: "romhack-plaza-downloads", active: active && near, load: async (offset, signal) => {
    const page = await loadRomDownloads(signal, offset + 1);
    return { games: page.entries.map(item => ({ ...item, id: item.url })), nextOffset: page.nextPage === null ? null : page.nextPage - 1 };
  } });
  const navigation = useRowNavigation(row, slots);
  useEffect(() => {
    const node = root.current; if (!node || !active) return;
    return observeWithin(node, "300px", entry => { if (entry.isIntersecting) setNear(true); });
  }, [active]);
  useEffect(() => {
    const node = grid.current; if (!node) return;
    const observer = new ResizeObserver(() => setSlots(getComputedStyle(node).gridTemplateColumns.split(" ").length * 2));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  return <section ref={root} className="games-section games-rom-downloads" aria-busy={row.busy}>
    <div className="games-section-heading"><div><h2>{t("games.roms.downloadCharts")}</h2><p>{t("games.roms.downloadChartsNote")}</p></div><div className="games-rom-chart-actions">
      <a className="games-text-action games-rom-chart-source" href={ROM_DOWNLOAD_CHART_URL} onClick={event => { event.preventDefault(); void openUrl(ROM_DOWNLOAD_CHART_URL); }}><GameSourceIcon url={ROM_DOWNLOAD_CHART_URL} icon="https://icons.duckduckgo.com/ip3/romhackplaza.org.ico" name="Romhack Plaza"/>Romhack Plaza<ArrowUpRight size={16}/></a>
      <div className="games-page-controls" aria-busy={row.busy}>
        <span dir="ltr" aria-live="polite">{navigation.page + 1}</span>
        <button className="games-icon-button" aria-label={t("common.previous")} disabled={!navigation.page} aria-disabled={!navigation.page || row.busy} onClick={() => void navigation.go(navigation.page - 1)}><NavChevron dir="left" size={18}/></button>
        <button className="games-icon-button" aria-label={t("common.next")} disabled={!row.loaded || !navigation.hasNext} aria-disabled={!row.loaded || !navigation.hasNext || row.busy} onClick={() => void navigation.go(navigation.page + 1)}><NavChevron dir="right" size={18}/></button>
      </div>
    </div></div>
    <div ref={grid} className="games-rom-download-grid" data-loading={row.busy || undefined}>{navigation.visible.map((item, index) => <button className="games-row-motion" data-game={romCommunityGame(item).id} data-direction={navigation.direction} key={item.url} onClick={() => open(romCommunityGame(item, [item.author, t("games.roms.downloadCount", { count: item.downloads.toLocaleString(language) })].filter(Boolean).join(" · ")))}>
      <span className="games-rom-download-image"><GameArt src={item.image}/><b>{navigation.page * slots + index + 1}</b></span>
      <strong>{item.title}</strong><span>{item.platform}</span><small><Download size={13}/>{t("games.roms.downloadCount", { count: item.downloads.toLocaleString(language) })}</small>
    </button>)}{!row.loaded && !row.failed && Array.from({ length: slots }, (_, index) => <div key={index} className="games-rom-download-skeleton" aria-hidden="true"><i/><span/><span/><span/></div>)}</div>
    {row.busy && !row.games.length && <span className="sr-only" role="status">{t("common.loading")}</span>}
    {row.failed && <div className="games-inline-status" role="status"><span>{t("games.roms.chartUnavailable")}</span><button className="games-text-action" onClick={row.retry}>{t("common.retry")}</button></div>}
  </section>;
}
