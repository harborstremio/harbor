import { useCallback, useEffect, useId, useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { NavGlyph } from "@/components/icons/nav-glyph";
import { GamesIcon } from "@/components/icons/games-icon";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { sourceDownloadTitle } from "@/lib/games/source-download-context";
import type { RecentSourceRelease } from "@/lib/games/recent-sources";
import type { SourceGameArtwork } from "@/lib/games/source-display";
import type { GameSummary } from "@/lib/games/types";
import type { GameTransfers } from "@/hooks/use-game-transfers";
import { GameArt } from "./game-art";
import { GameSourceIcon } from "./game-source-icon";
import { SourceReleaseRow } from "./game-sources";
import "./game-recent-dialog.css";

export function RecentSourceDialog({ item, art, loading, downloads, close: onClose, open }: { item: RecentSourceRelease; art?: SourceGameArtwork; loading: boolean; downloads: GameTransfers; close: () => void; open: (game: GameSummary) => void }) {
  const game = art?.game, t = useT(), language = useUiLanguage(), title = useId(), root = useRef<HTMLDivElement>(null);
  const destination = useRef<GameSummary | undefined>(undefined), actions = useRef({ onClose, open });
  actions.current = { onClose, open };
  const finish = useCallback(() => { actions.current.onClose(); if (destination.current) actions.current.open(destination.current); }, []);
  const { closing, close } = useModalExit(finish);
  useSectionBack(close, true, true);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, element = root.current;
    element?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== element?.closest('[role="dialog"]')) return;
      const items = [...(element?.querySelectorAll<HTMLElement>('button:not(:disabled),summary,a[href]') ?? [])].filter(node => node.getClientRects().length);
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === items.length - 1) { event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0])?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <ModalShell width={760} labelledBy={title} closing={closing} onDismiss={close} backdropClassName="games-match-backdrop games-recent-backdrop">
    <div className="games-sources-modal games-recent-dialog" ref={root} inert={closing}>
      <header><div className="games-recent-dialog-heading"><NavGlyph name="download" style={{ width: 26, height: 26 }}/><h2 id={title}>{t("games.recent.files")}</h2></div><button className="games-icon-button" aria-label={t("common.close")} onClick={close}><X size={20}/></button></header>
      <div className="games-sources-scroll">
        <div className="games-recent-release-identity">
          <div className="games-recent-release-art" aria-busy={loading}>
            <GamesIcon size={36}/>
            {game && game.adultContent !== true && <GameArt src={game.portrait || game.capsule} fallback={game.capsule} eager/>}
            {game?.adultContent === true && <span className="games-recent-release-adult">18+</span>}
            {loading && <span className="games-recent-placeholder" aria-hidden="true"/>}
          </div>
          <div className="games-recent-release-copy">
            <div className="games-recent-release-source"><GameSourceIcon url={item.source.url} homepage={item.source.homepage || item.release.sourcePage} icon={item.source.icon} name={item.source.name}/><span>{item.source.name}</span></div>
            <h3>{sourceDownloadTitle(item.release.title)}</h3>
            <p className="games-recent-release-build">{item.release.title}</p>
            <div className="games-recent-release-facts">{item.release.size && <span>{item.release.size}</span>}{item.release.date && <time dateTime={item.release.date}>{new Date(item.release.date).toLocaleDateString(language, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</time>}</div>
            <div className="games-recent-view-slot">{game ? <button className="games-recent-view-game" onClick={() => { destination.current = game; close(); }}>{t(art?.match === "base" ? "games.recent.viewBase" : "games.discovery.viewGame")}<ArrowUpRight size={15}/></button> : loading ? <span className="games-recent-view-placeholder" aria-hidden="true"/> : null}</div>
          </div>
        </div>
        <SourceReleaseRow source={item.source} release={item.release} downloads={downloads} presentation="dialog" game={game && art?.match === "exact" ? { id: game.id, name: game.name, artwork: game.adultContent === false ? game.capsule : undefined, sourceName: item.source.name } : undefined}/>
      </div>
    </div>
  </ModalShell>;
}
