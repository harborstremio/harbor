import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Copy, Gamepad2, LoaderCircle, RefreshCw } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadFortniteActivity, loadFortniteIsland, loadFortniteIslandBasics, loadFortniteRankings } from "@/lib/games/fortnite";
import { FORTNITE_GENRES, fortniteIslandUrl, localizeFortniteIsland, type FortniteActivity, type FortniteIsland, type FortniteRankings } from "@/lib/games/fortnite-data";
import { GameArt } from "./game-art";
import "./game-fortnite-companion.css";

export function GameFortniteCompanion({ active }: { active: boolean }) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null), label = (key: string) => t(`games.fortnite.${key}`);
  const [activated, setActivated] = useState(false), [genre, setGenre] = useState("shooter"), [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<{ cursor: string; before?: boolean; snapshot: string }>();
  const [rankings, setRankings] = useState<FortniteRankings>(), [islands, setIslands] = useState<Record<string, FortniteIsland>>({});
  const [selected, setSelected] = useState<string>(), [busy, setBusy] = useState(false), [mediaBusy, setMediaBusy] = useState(false), [failed, setFailed] = useState(false), [mediaFailed, setMediaFailed] = useState(false);
  const refreshed = useRef(0);
  useEffect(() => {
    if (!active) { setActivated(false); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setActivated(true); }, { rootMargin: "240px" });
    if (root.current) observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    if (!active || !activated) return;
    const controller = new AbortController(); setBusy(true); setMediaBusy(false); setFailed(false); setMediaFailed(false);
    const force = refreshed.current !== attempt; refreshed.current = attempt;
    void loadFortniteRankings(genre, controller.signal, page, force).then(async value => {
      if (controller.signal.aborted) return;
      // Rankings remain browsable while the separate image service catches up.
      setBusy(false); setMediaBusy(true);
      setRankings(value.data); setSelected(previous => value.data.rows.some(row => row.code === previous) ? previous : value.data.rows[0]?.code);
      void Promise.allSettled(value.data.rows.map(async row => {
        const island = await loadFortniteIslandBasics(row.code, controller.signal);
        if (!controller.signal.aborted) setIslands(previous => previous[row.code] ? previous : { ...previous, [row.code]: island.data });
      }));
      const media = await Promise.allSettled(value.data.rows.map(async row => {
        const island = await loadFortniteIsland(row.code, controller.signal, force);
        if (!controller.signal.aborted) setIslands(previous => ({ ...previous, [row.code]: island.data }));
      }));
      if (!controller.signal.aborted) setMediaFailed(media.some(result => result.status === "rejected"));
    }, () => { if (!controller.signal.aborted) setFailed(true); }).finally(() => { if (!controller.signal.aborted) { setBusy(false); setMediaBusy(false); } });
    return () => controller.abort();
  }, [active, activated, genre, page, attempt]);
  const island = selected && islands[selected] ? localizeFortniteIsland(islands[selected]!, language) : undefined;
  const changeGenre = (value: string) => { setGenre(value); setPage(undefined); setRankings(undefined); setSelected(undefined); };
  const changePage = (cursor: string, before = false) => { if (rankings?.snapshot) setPage({ cursor, before, snapshot: rankings.snapshot }); };
  const refresh = () => { setPage(undefined); setAttempt(value => value + 1); };
  const date = (value: string) => new Date(value).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });
  return <section className="games-fortnite games-inset" ref={root} aria-labelledby="fortnite-title">
    <header className="games-fortnite-heading"><div><img src="/games/publisher/fortnite-logo.svg" alt="Fortnite"/><h2 id="fortnite-title">{label("title")}</h2><p>{label("intro")}</p></div><button className="games-button" disabled={busy} onClick={refresh} aria-label={label("refresh")}><RefreshCw size={18}/></button></header>
    <div className="games-fortnite-tools"><Dropdown value={genre} onChange={changeGenre} ariaLabel={label("genre")} options={FORTNITE_GENRES.map(value => ({ value, label: label(`genre.${value}`) }))}/>{rankings?.snapshot && <span>{t("games.fortnite.snapshot", { date: date(rankings.snapshot) })}</span>}</div>
    {failed && <p role="status" className="games-fortnite-status">{label("failed")} <button className="games-button" disabled={busy} onClick={refresh}>{t("common.retry")}</button></p>}
    {mediaFailed && <p className="games-fortnite-status" role="status">{label("mediaFailed")}</p>}
    {!rankings && !failed && <div className="games-fortnite-loading" aria-label={t("common.loading")} aria-busy="true"><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/></div>}
    {rankings && !rankings.available && <p className="games-fortnite-status">{label("gap")}</p>}
    {rankings?.available && !rankings.rows.length && <p className="games-fortnite-status">{label("empty")}</p>}
    {!!rankings?.rows.length && <>
      <div className="games-fortnite-feature" id="fortnite-island" aria-busy={mediaBusy && !island?.image}>
        <IslandImage key={selected} src={island?.image} loading={mediaBusy && !island?.image}/>
        <div className="games-fortnite-copy"><p>{island?.creator || "Fortnite"}</p><h3 dir="auto">{island?.title || selected}</h3>{mediaBusy && !island?.description ? <div className="games-fortnite-copy-loading" aria-label={t("common.loading")}><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/></div> : <p className="games-fortnite-description" dir="auto">{island?.description}</p>}
          {island?.players && <span>{t("games.fortnite.players", { count: island.players })}</span>}
          {selected && <IslandActions key={selected} code={selected}/>}
        </div>
      </div>
      {selected && <IslandActivity key={selected} code={selected} active={active && activated} attempt={attempt}/>}
      <div className="games-fortnite-grid" aria-busy={busy || mediaBusy}>{rankings.rows.map(row => {
        const item = islands[row.code] ? localizeFortniteIsland(islands[row.code]!, language) : undefined;
        return <button key={row.code} className="games-fortnite-card" aria-pressed={selected === row.code} aria-controls="fortnite-island" onClick={() => setSelected(row.code)}><IslandImage src={item?.thumbnail} loading={mediaBusy && !item?.thumbnail}/><span className="games-fortnite-card-copy"><b>{row.rank.toLocaleString(language, { minimumIntegerDigits: 2 })}</b><span><strong dir="auto">{item?.title || row.code}</strong><small dir="auto">{item?.creator || row.code}</small></span></span></button>;
      })}</div>
      <div className="games-fortnite-pagination"><span>{label("rankingSource")}</span><button className="games-button" disabled={busy || !rankings.previous} onClick={() => rankings.previous && changePage(rankings.previous, true)} aria-label={label("previous")}><ChevronLeft size={18}/></button><button className="games-button" disabled={busy || !rankings.next} onClick={() => rankings.next && changePage(rankings.next)} aria-label={label("next")}><ChevronRight size={18}/></button></div>
    </>}
    <footer className="games-fortnite-source"><a href="https://api.fortnite.com/ecosystem/v1/docs/" onClick={event => { event.preventDefault(); void openUrl(event.currentTarget.href); }}>Epic Games</a><span>·</span><a href="https://fn-api.cc" onClick={event => { event.preventDefault(); void openUrl(event.currentTarget.href); }}>{label("mediaSource")}</a></footer>
  </section>;
}
function IslandImage({ src, loading = false }: { src?: string; loading?: boolean }) {
  return <span className="games-fortnite-image" data-pending={loading}><GameArt src={src || ""}/>{(src || loading) && <LoaderCircle className="games-fortnite-spinner" size={22} aria-hidden="true"/>}<Gamepad2 className="games-fortnite-placeholder" size={36} aria-hidden="true"/></span>;
}
function IslandActions({ code }: { code: string }) {
  const t = useT(), [copied, setCopied] = useState(false), [failed, setFailed] = useState(false);
  return <div className="games-fortnite-actions"><button className="games-button" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setFailed(false); } catch { setFailed(true); } }} aria-label={t(copied ? "games.fortnite.copied" : "games.fortnite.copy")} title={t(copied ? "games.fortnite.copied" : "games.fortnite.copy")}>{copied ? <Check size={18}/> : <Copy size={18}/>}<bdi>{code}</bdi></button><button className="games-button games-button-primary" onClick={() => void openUrl(fortniteIslandUrl(code))}>{t("games.fortnite.open")}<ArrowUpRight size={17}/></button>{failed && <span role="status">{t("games.fortnite.copyFailed")}</span>}</div>;
}
function IslandActivity({ code, active, attempt }: { code: string; active: boolean; attempt: number }) {
  const t = useT(), language = useUiLanguage(), [data, setData] = useState<FortniteActivity>(), [failed, setFailed] = useState(false), [busy, setBusy] = useState(false);
  const refreshed = useRef(attempt);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); setBusy(true); setFailed(false);
    const force = refreshed.current !== attempt; refreshed.current = attempt;
    void loadFortniteActivity(code, controller.signal, force).then(value => { if (!controller.signal.aborted) setData(value.data); }, () => { if (!controller.signal.aborted) setFailed(true); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [code, active, attempt]);
  return <div className="games-fortnite-activity" aria-busy={busy}>
    {data ? <><span>{t("games.fortnite.activity", { date: new Date(data.date).toLocaleDateString(language, { dateStyle: "medium", timeZone: "UTC" }) })}</span><span><strong>{data.peak?.toLocaleString(language) ?? "—"}</strong>{t("games.fortnite.peak")}</span><span><strong>{data.players?.toLocaleString(language) ?? "—"}</strong>{t("games.fortnite.unique")}</span></> : <span>{t(busy ? "common.loading" : "games.fortnite.noActivity")}</span>}
    {failed && <span role="status">{t("games.fortnite.activityFailed")}</span>}
  </div>;
}
