import { useState } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { WowCharacter } from "@/lib/games/wow-character-data";
import type { WowRegion, WowSeason } from "@/lib/games/wow-data";
import { wowWeeklyProgress, type WowResetContext } from "@/lib/games/wow-weekly";
import { GameArt } from "./game-art";
import "./game-wow-weekly.css";

export function GameWowWeekly({ character, checkedAt, season, region, reset }: { character: WowCharacter; checkedAt: number; season: WowSeason | null; region: WowRegion; reset: WowResetContext | null }) {
  const t = useT(), language = useUiLanguage();
  const [week, setWeek] = useState<"current" | "previous">("current");
  const progress = wowWeeklyProgress(character, checkedAt, season, region, reset ? { ...reset, now: Date.now() } : null), selected = progress?.[week];
  const date = (value: number) => new Date(value).toLocaleString(language, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const highest = selected?.runs?.[0];
  return <section className="games-wow-weekly" aria-label={t("games.wow.weekly.title")}>
    <div className="games-wow-weekly-heading">
      <div className="games-wow-weekly-switch" role="group" aria-label={t("games.wow.weekly.period")}>{(["current", "previous"] as const).map(value => <button key={value} aria-pressed={week === value} onClick={() => setWeek(value)}>{t(`games.wow.weekly.${value}`)}</button>)}</div>
      {selected && <p>{t(`games.wow.region.${region}`)} · <time dateTime={new Date(selected.start).toISOString()}>{date(selected.start)}</time> – <time dateTime={new Date(selected.end).toISOString()}>{date(selected.end)}</time></p>}
    </div>
    {!progress ? <p className="games-wow-status" role="status">{t("games.wow.weekly.awaiting")}</p> : !selected?.runs ? <p className="games-wow-status" role="status">{t("games.wow.weekly.unavailable")}</p> : <>
      {highest && <div className="games-wow-weekly-summary"><strong dir="ltr">+{highest.level}</strong><span>{t("games.wow.weekly.highest")}<small>{highest.dungeon}</small></span><p>{t("games.wow.weekly.shown", { count: selected.runs.length.toLocaleString(language) })}</p></div>}
      {selected.partial && <p className="games-wow-status" role="status">{t("games.wow.weekly.partial")}</p>}
      {selected.runs.length ? <ol className="games-wow-weekly-runs">{selected.runs.map(run => {
        const dungeon = season?.dungeons.find(value => value.id === run.zoneId);
        return <li key={run.id}><a href={run.url} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(run.url); }}>
          <GameArt src={dungeon?.image || run.image} fallback={run.image}/>
          <div className="games-wow-weekly-run-name"><strong dir="auto">{run.dungeon}</strong><time dateTime={new Date(run.completedAt).toISOString()}>{date(run.completedAt)}</time><span>{run.timed && <Check size={13}/>} {t(run.timed ? "games.wow.character.timed" : "games.wow.character.overtime")} · <bdi>{Math.floor(run.time / 60_000)}:{String(Math.floor(run.time / 1000) % 60).padStart(2, "0")}</bdi></span></div>
          <strong className="games-wow-weekly-level" dir="ltr">+{run.level}</strong><ArrowUpRight size={14} aria-hidden="true"/>
        </a></li>;
      })}</ol> : <p className="games-wow-status">{t("games.wow.weekly.empty")}</p>}
    </>}
    <footer><p>{t("games.wow.weekly.scope")}</p><span>{t("games.wow.checked", { date: date(checkedAt) })}</span></footer>
  </section>;
}
