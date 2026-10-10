import { useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronRight } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { WowCharacter } from "@/lib/games/wow-character-data";
import type { WowDungeon, WowRegion, WowSeason } from "@/lib/games/wow-data";
import { orderWowProgress, wowSeasonProgress, type WowProgressOrder } from "@/lib/games/wow-season-progress";
import { GameArt } from "./game-art";
import { GameWowDungeonDialog } from "./game-wow-dungeons";
import "./game-wow-season-progress.css";

export function GameWowSeasonProgress({ character, season, region, active }: { character: WowCharacter; season: WowSeason | null; region: WowRegion; active: boolean }) {
  const t = useT(), language = useUiLanguage(), trigger = useRef<HTMLButtonElement | null>(null);
  const [order, setOrder] = useState<WowProgressOrder>("season"), [selected, setSelected] = useState<WowDungeon | null>(null);
  const progress = season ? wowSeasonProgress(character, season, region) : null;
  const number = (value: number) => value.toLocaleString(language, { maximumFractionDigits: 1 });
  const dismiss = () => { setSelected(null); requestAnimationFrame(() => trigger.current?.isConnected && trigger.current.focus({ preventScroll: true })); };
  if (!progress || !season) return <p className="games-wow-status">{t("games.wow.progress.unavailable")}</p>;
  return <section className="games-wow-season-progress" aria-label={t("games.wow.progress.title")}>
    <div className="games-wow-progress-heading"><div>
      <h4>{progress.timedDungeons === null ? t("games.wow.progress.title") : t("games.wow.progress.summary", { timed: number(progress.timedDungeons), total: number(progress.rows.length) })}</h4>
      <p>{progress.totalRuns === null ? t("games.wow.progress.partial") : t("games.wow.progress.totals", { total: number(progress.totalRuns), timed: number(progress.timedRuns!) })}</p>
    </div><Dropdown ariaLabel={t("games.wow.progress.order")} value={order} onChange={value => setOrder(value as WowProgressOrder)} options={(["season", "score", "untimed"] as const).map(value => ({ value, label: t(`games.wow.progress.${value}`) }))}/></div>
    {progress.partial && progress.totalRuns !== null && <p className="games-wow-progress-note">{t("games.wow.progress.partial")}</p>}
    <div className="games-wow-progress-grid">{orderWowProgress(progress.rows, order).map(({ dungeon, best, count }) => <article key={dungeon.id} data-dungeon-id={dungeon.id}>
      <div className="games-wow-progress-art"><GameArt src={dungeon.image}/><h5>{dungeon.name}</h5></div>
      <div className="games-wow-progress-content">
        <div className="games-wow-progress-best">{best ? <><strong dir="ltr">+{best.level}</strong><span>{t(best.timed ? "games.wow.character.timed" : "games.wow.character.overtime")}{best.score !== null && <small>{t("games.wow.progress.rating", { score: number(best.score) })}</small>}</span></> : <p>{t(count?.total === 0 ? "games.wow.progress.noRuns" : "games.wow.progress.noBest")}</p>}</div>
        <p className="games-wow-progress-count">{count && count.timed > 0 && <Check size={14}/>} {count ? t("games.wow.progress.counts", { timed: number(count.timed), total: number(count.total) }) : t("games.wow.progress.noCounts")}</p>
        {best && <a href={best.url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(best.url); }}>{t("games.wow.progress.best")} · {new Date(best.completedAt).toLocaleDateString(language, { month: "short", day: "numeric" })}<ArrowUpRight size={12}/></a>}
        <button className="games-wow-progress-explore" aria-label={t("games.wow.runs.open", { dungeon: dungeon.name })} onClick={event => { trigger.current = event.currentTarget; setSelected(dungeon); }}>{t("games.wow.progress.explore")}<ChevronRight size={14}/></button>
      </div>
    </article>)}</div>
    {selected && active && <GameWowDungeonDialog dungeon={selected} season={season} region={region} onClose={dismiss}/>}
  </section>;
}
