import { useT, useUiLanguage } from "@/lib/i18n";
import { gameSize } from "@/lib/games/installed";
import { customLaunchHealth, type CustomLaunchHealthMap } from "@/lib/games/custom-launch-health";
import { sidebarStatus, type SidebarStatusIcon } from "@/lib/games/sidebar-status";
import type { QuickGame } from "@/lib/games/quick-library";
import "./game-sidebar-tooltip.css";

/** One small, unboxed glyph per state, using Harbor's 24-unit stroke weight. */
export function GameSidebarStatusIcon({ state }: { state: SidebarStatusIcon }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {state === "play" && <><path d="m5 4 11 8-11 8Z"/><path d="m14 18 2.5 2.5L22 15"/></>}
    {state === "running" && <><path d="M4 9v6m5-10v14m5-11v8m5-12v16"/></>}
    {state === "download" && <><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></>}
    {state === "pause" && <><path d="M8 4v11m8-11v11M4 18v3h16v-3"/></>}
    {state === "verify" && <><path d="M8 3H4v4m12-4h4v4M4 17v4h4m12-4v4h-4m-8-9 3 3 5-6"/></>}
    {state === "repair" && <><path d="m14 5 2 3 4-1a6 6 0 0 1-7 8l-6 6-4-4 6-6a6 6 0 0 1 5-8Z"/></>}
    {state === "external" && <><path d="M14 3h7v7m0-7L10 14M10 5H4v16h16v-6"/></>}
    {state === "saved" && <path d="M6 3h12v18l-6-4-6 4Z"/>}
  </svg>;
}

export function GameSidebarTooltipDetails({ game, source, running, health }: {
  game: QuickGame; source: string; running: boolean; health: CustomLaunchHealthMap;
}) {
  const t = useT(), language = useUiLanguage(), status = sidebarStatus(game, running);
  const observed = game.source === "custom" ? customLaunchHealth(game.custom, health) : undefined;
  const issue = game.source === "custom" && !game.ready && !running
    ? t(observed?.issue ? `games.launchHealth.${observed.issue}` : "games.launchHealth.unchecked") : "";
  const total = game.source === "steam" ? game.install.bytesToDownload ?? 0 : 0;
  const downloaded = game.source === "steam" ? game.install.bytesDownloaded : undefined;
  const bytes = total > 0 && ["download", "pause"].includes(status.icon)
    ? typeof downloaded === "number" && Number.isFinite(downloaded) ? `${downloaded > 0 ? gameSize(downloaded) : "0 MB"} / ${gameSize(total)}` : gameSize(total) : "";
  const lastPlayed = game.lastPlayed > 0 && game.lastPlayed <= Date.now()
    ? new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(game.lastPlayed) : "";
  const detail = issue || (status.icon === "repair" && game.source === "steam" ? t("games.sidebar.manageSteam") : "");
  return <div className="games-sidebar-tip-details">
    <div className="games-sidebar-tip-state" data-tone={status.tone}>
      <GameSidebarStatusIcon state={status.icon}/><span>{t(status.key, { launcher: source })}</span>
      {status.progress !== null && <strong>{new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 0 }).format(status.progress)}</strong>}
    </div>
    {status.progress !== null && <div className="games-sidebar-tip-progress" aria-hidden="true"><i style={{ width: `${status.progress * 100}%` }}/></div>}
    {bytes && <p>{bytes}</p>}
    {detail && <p>{detail}</p>}
    <div className="games-sidebar-tip-meta"><span>{source}</span>{lastPlayed && <span>{t("games.sidebar.played", { date: lastPlayed })}</span>}
      {game.source === "steam" && game.install.sizeBytes > 0 && <span>{t("games.sidebar.disk", { size: gameSize(game.install.sizeBytes) })}</span>}
    </div>
  </div>;
}
