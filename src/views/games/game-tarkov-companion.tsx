import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, LoaderCircle, RefreshCw } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadTarkovSeasons, loadTarkovWipes } from "@/lib/games/tarkov";
import { tarkovRemaining, tarkovSeasonAt, TARKOV_SEASONS, TARKOV_WIPES, type TarkovSeason, type TarkovWipe } from "@/lib/games/tarkov-data";
import type { CompanionObservation } from "@/lib/games/companion-request";
import "./game-tarkov-companion.css";

export function GameTarkovCompanion({ active }: { active: boolean }) {
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.tarkov.${key}`), root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false), [now, setNow] = useState(Date.now), [retry, setRetry] = useState(0), [pending, setPending] = useState(true);
  const [seasons, setSeasons] = useState<CompanionObservation<TarkovSeason[]> | null>(null), [wipes, setWipes] = useState<CompanionObservation<TarkovWipe[]> | null>(null);
  const [seasonFailed, setSeasonFailed] = useState(false), [wipesFailed, setWipesFailed] = useState(false);
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setVisible(true); }, { rootMargin: "200px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !visible) return;
    const request = new AbortController(); setPending(true); setSeasonFailed(false); setWipesFailed(false);
    void Promise.allSettled([
      loadTarkovSeasons(request.signal, retry > 0).then(value => { if (!request.signal.aborted) setSeasons(value); }, () => { if (!request.signal.aborted) setSeasonFailed(true); }),
      loadTarkovWipes(request.signal, retry > 0).then(value => { if (!request.signal.aborted) setWipes(value); }, () => { if (!request.signal.aborted) setWipesFailed(true); }),
    ]).finally(() => { if (!request.signal.aborted) setPending(false); });
    return () => request.abort();
  }, [active, visible, retry]);
  useEffect(() => {
    if (!active || !visible) return;
    const tick = () => { if (!document.hidden) setNow(Date.now()); }; tick();
    const timer = setInterval(tick, 1000); document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [active, visible]);
  const season = seasons && tarkovSeasonAt(seasons.data, now), remaining = season && tarkovRemaining(season.target, now), history = wipes?.data.filter(w => w.start <= now) ?? [], latest = history[0];
  const date = (at: number) => new Date(at).toLocaleDateString(language, { dateStyle: "long", timeZone: "UTC" });
  const sourceLink = (url: string, text: string) => <button className="games-tarkov-link" onClick={() => void openUrl(url)}>{text}<ArrowUpRight size={13}/></button>;
  return <section className="games-tarkov" ref={root} aria-label={label("title")}>
    <header><div><p>ESCAPE FROM TARKOV</p><h2>{label("title")}</h2></div><button className="games-icon-button" disabled={pending} aria-label={label("refresh")} title={label("refresh")} onClick={() => setRetry(n => n + 1)}><RefreshCw size={16}/></button></header>
    <div className="games-tarkov-clock">
      <div className="games-tarkov-countdown">
        {seasonFailed && <p role="status">{label(seasons ? "refreshFailed" : "seasonFailed")}</p>}
        {!seasons && !seasonFailed ? <div className="games-tarkov-loading" role="status" aria-label={t("common.loading")}><LoaderCircle size={22}/></div> : season && remaining ? <>
          <p className="games-tarkov-season">{t("games.tarkov.season", { number: season.season.season })}<span>{label("community")}</span></p>
          <h3>{label(season.kind === "active" ? "untilEnd" : "untilStart")}</h3>
          <div className="games-tarkov-digits" role="timer" aria-live="off">{(["days", "hours", "minutes"] as const).map(unit => <div key={unit}><strong>{remaining[unit].toLocaleString(language, { minimumIntegerDigits: unit === "days" ? 1 : 2 })}</strong><span>{label(unit)}</span></div>)}</div>
          <p>{label(season.kind === "active" ? "listedEnd" : "listedStart")} <time dateTime={new Date(season.target).toISOString()}>{date(season.target)}</time> · UTC</p>
        </> : seasons ? <><h3>{label("noSeason")}</h3><p>{label("noSeasonDetail")}</p></> : null}
        <p className="games-tarkov-note">{label("scheduleNote")}</p>
        {sourceLink(TARKOV_SEASONS, label("seasonSource"))}
        {seasons && <small>{t("games.tarkov.checked", { time: new Date(seasons.at).toLocaleString(language, { dateStyle: "short", timeStyle: "short" }) })}</small>}
      </div>
      <aside><h3>{label("fullWipe")}</h3>
        {wipesFailed && <p role="status">{label(wipes ? "refreshFailed" : "historyFailed")}</p>}
        {!wipes && !wipesFailed ? <div className="games-tarkov-loading" role="status" aria-label={t("common.loading")}><LoaderCircle size={20}/></div> : latest ? <><strong>{t("games.tarkov.elapsed", { days: Math.max(0, Math.floor((now - latest.start) / 86400000)).toLocaleString(language) })}</strong><p><time dateTime={new Date(latest.start).toISOString()}>{date(latest.start)}</time> · {latest.name}</p></> : wipes ? <p>{label("noHistory")}</p> : null}
        <p>{label("modeNote")}</p>{sourceLink(TARKOV_WIPES, label("historySource"))}
        {wipes && <small>{t("games.tarkov.checked", { time: new Date(wipes.at).toLocaleString(language, { dateStyle: "short", timeStyle: "short" }) })}</small>}
      </aside>
    </div>
    {!!history.length && <details className="games-tarkov-history"><summary>{label("history")}<ChevronDown size={16}/></summary><div><table><thead><tr><th>{label("patch")}</th><th>{label("date")}</th><th>{label("duration")}</th></tr></thead><tbody>{history.map((wipe, i) => <tr key={wipe.name}><td>{wipe.name}</td><td><time dateTime={new Date(wipe.start).toISOString()}>{date(wipe.start)}</time></td><td>{i === 0 ? "—" : t("games.tarkov.elapsed", { days: Math.floor((history[i - 1].start - wipe.start) / 86400000).toLocaleString(language) })}</td></tr>)}</tbody></table></div></details>}
  </section>;
}
