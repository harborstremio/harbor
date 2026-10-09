import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Copy, RefreshCw, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { openUrl } from "@/lib/window";
import { loadWowDungeonRuns, loadWowRunEquipment } from "@/lib/games/wow";
import { wowDungeonUrl, type WowDungeon, type WowRegion, type WowSeason } from "@/lib/games/wow-data";
import type { WowDungeonRun, WowRunEquipment, WowRunMember, WowRunPage, WowRunQuery } from "@/lib/games/wow-dungeon-runs";
import { wowSpecPosition, WOW_SPEC_SPRITE_SIZE } from "@/lib/games/wow-run-specs";
import specSprite from "@/assets/games/wow-specs.png";
import { GameArt } from "./game-art";
import { GameWowEquipment } from "./game-wow-equipment";
import "./game-wow-dungeons.css";

const duration = (value: number) => `${Math.floor(value / 60_000)}:${String(Math.floor(value / 1000) % 60).padStart(2, "0")}`;
function External({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(href); }}>{children}<ArrowUpRight size={13}/></a>;
}
function Spec({ member }: { member: WowRunMember }) {
  const position = wowSpecPosition(member.specId, member.classId), size = 32 / 64;
  return <span className="games-wow-run-spec" title={`${member.spec} ${member.className}`} aria-hidden="true" style={position ? { backgroundImage: `url(${specSprite})`, backgroundSize: `${WOW_SPEC_SPRITE_SIZE[0] * size}px ${WOW_SPEC_SPRITE_SIZE[1] * size}px`, backgroundPosition: `${position[0] * size}px ${position[1] * size}px` } : undefined}/>;
}
export function GameWowDungeons({ season, region, active }: { season: WowSeason; region: WowRegion; active: boolean }) {
  const t = useT(), language = useUiLanguage(), trigger = useRef<HTMLButtonElement | null>(null);
  const [selected, setSelected] = useState<WowDungeon | null>(null);
  const dismiss = () => { setSelected(null); requestAnimationFrame(() => { if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }); }); };
  return <>
    <div className="games-wow-dungeons">{season.dungeons.map(dungeon => <button key={dungeon.id} aria-label={t("games.wow.runs.open", { dungeon: dungeon.name })} onClick={event => { trigger.current = event.currentTarget; setSelected(dungeon); }}>
      <GameArt src={dungeon.image}/><span><strong>{dungeon.name}</strong><small><Clock3 size={13}/>{t("games.wow.timer", { minutes: (dungeon.seconds / 60).toLocaleString(language, { maximumFractionDigits: 1 }) })}</small></span><ChevronRight size={17}/>
    </button>)}</div>
    {selected && active && <GameWowDungeonDialog dungeon={selected} region={region} season={season} onClose={dismiss}/>}
  </>;
}
export function GameWowDungeonDialog({ dungeon, region, season, onClose }: { dungeon: WowDungeon; region: WowRegion; season: WowSeason; onClose: () => void }) {
  const t = useT(), title = useId(), closeButton = useRef<HTMLButtonElement>(null), { closing, close } = useModalExit(onClose);
  const [affixes, setAffixes] = useState<"all" | "current">("all");
  useSectionBack(close, true);
  useEffect(() => {
    const frame = requestAnimationFrame(() => closeButton.current?.focus({ preventScroll: true }));
    const dialog = closeButton.current?.closest<HTMLElement>('[role="dialog"]');
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog || event.target instanceof Element && event.target.closest("[data-dropdown-menu]")) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary,[tabindex="0"]')].filter(item => item.getClientRects().length && !item.closest("[inert]"));
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", trap); };
  }, []);
  return <ModalShell closing={closing} onDismiss={close} width={1000} labelledBy={title} backdropClassName="games-wow-run-backdrop bg-black/50">
    <div className="games-wow-run-dialog" data-tv-focus-scope>
      <header className="games-wow-run-hero"><GameArt src={dungeon.image}/><div><p>{season.name} · {t(`games.wow.region.${region}`)}</p><h2 id={title} dir="auto">{dungeon.name}</h2><span><Clock3 size={15}/>{t("games.wow.timer", { minutes: dungeon.seconds / 60 })}</span></div><button ref={closeButton} className="games-button" aria-label={t("common.close")} data-tv-modal-close onClick={close}><X size={19}/></button></header>
      <div className="games-wow-run-filters"><h3>{t("games.wow.runs.title")}</h3><div>{(["all", "current"] as const).map(value => <button key={value} className="games-button" aria-pressed={affixes === value} onClick={() => setAffixes(value)}>{t(`games.wow.runs.${value}`)}</button>)}</div></div>
      <RunResults key={affixes} query={{ season: season.slug, region, dungeon, affixes, page: 0 }}/>
    </div>
  </ModalShell>;
}
function RunResults({ query }: { query: WowRunQuery }) {
  const t = useT(), language = useUiLanguage(), accordion = useId(), heading = useRef<HTMLHeadingElement>(null), body = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0), [attempt, setAttempt] = useState(0), refreshed = useRef(0), moveFocus = useRef(false);
  const [feed, setFeed] = useState<{ data: WowRunPage | null; page: number; at: number; busy: boolean; failed: boolean }>({ data: null, page: 0, at: 0, busy: true, failed: false });
  useEffect(() => {
    const controller = new AbortController(), refresh = attempt !== refreshed.current; refreshed.current = attempt;
    setFeed(value => ({ ...value, busy: true, failed: false }));
    void loadWowDungeonRuns({ ...query, page }, controller.signal, refresh).then(value => {
      if (!controller.signal.aborted) setFeed({ data: value.data, page, at: value.at, busy: false, failed: false });
    }, () => { if (!controller.signal.aborted) setFeed(value => ({ ...value, busy: false, failed: true })); });
    return () => controller.abort();
  }, [page, attempt, query.season, query.region, query.dungeon.id, query.affixes]);
  useEffect(() => {
    if (feed.busy || feed.failed || !moveFocus.current) return;
    moveFocus.current = false;
    const frame = requestAnimationFrame(() => { body.current?.scrollTo({ top: 0 }); heading.current?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [feed]);
  const turnPage = (next: number) => { moveFocus.current = true; if (next === page) setAttempt(value => value + 1); else setPage(next); };
  return <div ref={body} className="games-wow-run-body">
    <div className="games-wow-run-toolbar"><h4 ref={heading} tabIndex={-1}>{t("games.wow.runs.page", { page: feed.page + 1 })}</h4><button className="games-button" aria-label={t("games.wow.runs.refresh")} disabled={feed.busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={15}/></button></div>
    <p className="games-wow-run-note">{t(query.affixes === "current" ? "games.wow.runs.currentNote" : "games.wow.runs.allNote")}</p>
    {feed.failed && <p role="status" className="games-wow-run-note">{t("games.wow.runs.unavailable")} <button className="games-wow-run-retry" onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></p>}
    {feed.data?.partial && <p role="status" className="games-wow-run-note">{t("games.wow.runs.partial")}</p>}
    {!feed.data && !feed.failed && <div className="games-wow-run-loading" aria-busy="true" aria-label={t("common.loading")}>{Array.from({ length: 5 }, (_, i) => <i className="games-detail-skeleton" key={i}/>)}</div>}
    {feed.data && <div aria-busy={feed.busy} className="games-wow-run-list" key={feed.page}>{feed.data.runs.map(run => <Run key={run.id} run={run} query={{ ...query, page: feed.page }} accordion={accordion}/>)}{!feed.data.runs.length && <p className="games-wow-run-note">{t("games.wow.runs.empty")}</p>}</div>}
    {feed.data && <div className="games-wow-run-pagination"><button className="games-button" disabled={feed.busy || feed.page === 0} onClick={() => turnPage(feed.page - 1)}><ChevronLeft size={15}/>{t("games.wow.runs.previous")}</button><button className="games-button" disabled={feed.busy || feed.data.next === null} onClick={() => turnPage(feed.data!.next!)}>{t("games.wow.runs.next")}<ChevronRight size={15}/></button></div>}
    <footer className="games-wow-run-source"><External href={wowDungeonUrl(query.season, query.dungeon.slug, query.region)}>Raider.IO</External>{feed.at > 0 && <span>{t("games.wow.checked", { date: new Date(feed.at).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) })}</span>}</footer>
  </div>;
}
function Run({ run, query, accordion }: { run: WowDungeonRun; query: WowRunQuery; accordion: string }) {
  const t = useT(), language = useUiLanguage(), [open, setOpen] = useState(false);
  return <details className="games-wow-run" name={accordion} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span className="games-wow-run-rank">{run.rank.toLocaleString(language, { minimumIntegerDigits: 2 })}</span><strong>+{run.level}</strong><span className="games-wow-run-time">{duration(run.time)}<small>{t(run.time <= run.timer ? "games.wow.character.timed" : "games.wow.character.overtime")}</small></span><span className="games-wow-run-composition">{run.members.map(member => <Spec key={member.id} member={member}/>)}</span><span className="games-wow-run-score">{run.score?.toLocaleString(language, { maximumFractionDigits: 1 }) ?? "—"}<small>{t("games.wow.runs.score")}</small></span><ChevronDown size={16}/></summary>
    {open && <div className="games-wow-run-details"><p className="games-wow-run-note">{new Date(run.completedAt).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" })} · {t("games.wow.runs.timer", { time: duration(run.timer) })}</p><div className="games-wow-run-affixes">{run.affixes.map(affix => <span key={affix.id}><GameArt src={affix.image}/>{affix.name}</span>)}</div><Party run={run} query={query}/><External href={run.url}>{t("games.wow.runs.source")}</External></div>}
  </details>;
}
function CopyTalents({ code }: { code: string }) {
  const t = useT(), [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return <span className="games-wow-run-copy"><button className="games-button" onClick={async () => { try { await navigator.clipboard.writeText(code); setState("copied"); } catch { setState("failed"); } }}>{state === "copied" ? <Check size={14}/> : <Copy size={14}/>} {t(state === "copied" ? "games.wow.runs.copied" : "games.wow.runs.copy")}</button>{state === "failed" && <small role="status">{t("games.wow.runs.copyFailed")}</small>}</span>;
}
function Party({ run, query }: { run: WowDungeonRun; query: WowRunQuery }) {
  const t = useT(), language = useUiLanguage(), [selected, setSelected] = useState<number | null>(null), [attempt, setAttempt] = useState(0);
  const [feed, setFeed] = useState<{ data: WowRunEquipment[] | null; busy: boolean; failed: boolean }>({ data: null, busy: false, failed: false });
  const equipmentHeading = useRef<HTMLHeadingElement>(null), gearTrigger = useRef<HTMLButtonElement | null>(null), refreshed = useRef(0);
  const engaged = selected !== null;
  useEffect(() => {
    if (!engaged) return;
    const controller = new AbortController(), refresh = attempt !== refreshed.current; refreshed.current = attempt;
    setFeed(value => ({ ...value, busy: true, failed: false }));
    void loadWowRunEquipment(query, run, controller.signal, refresh).then(value => { if (!controller.signal.aborted) setFeed({ data: value.data, busy: false, failed: false }); }, () => { if (!controller.signal.aborted) setFeed(value => ({ ...value, busy: false, failed: true })); });
    return () => controller.abort();
  }, [engaged, attempt, run.id]);
  useEffect(() => { if (!engaged) return; const frame = requestAnimationFrame(() => { equipmentHeading.current?.focus({ preventScroll: true }); equipmentHeading.current?.scrollIntoView({ block: "nearest" }); }); return () => cancelAnimationFrame(frame); }, [selected]);
  const member = run.members.find(member => member.id === selected), gear = feed.data?.find(item => item.id === selected);
  return <div className="games-wow-run-party"><h4>{t("games.wow.runs.party")}</h4><p className="games-wow-run-note">{t("games.wow.runs.snapshots")}</p>{run.partial && <p className="games-wow-run-note">{t("games.wow.runs.partial")}</p>}
    <ul>{run.members.map(member => <li key={member.id}><Spec member={member}/><div className="games-wow-run-member"><External href={member.url}><strong dir="auto">{member.name}</strong></External><small dir="auto">{member.spec} {member.className} · {member.realm}</small>{member.role && <small>{t(`games.wow.runs.${member.role}`)}</small>}</div><div className="games-wow-run-member-actions"><button className="games-button" aria-pressed={selected === member.id} onClick={event => { gearTrigger.current = event.currentTarget; setSelected(member.id); }}>{t("games.wow.runs.gear")}</button>{member.loadout && <CopyTalents code={member.loadout}/>}</div></li>)}</ul>
    {member && <section className="games-wow-run-equipment"><header><div><h4 ref={equipmentHeading} tabIndex={-1} dir="auto">{member.name} · {t("games.wow.runs.gear")}</h4>{gear?.at && <p className="games-wow-run-note">{t("games.wow.runs.snapshotAt", { date: new Date(gear.at).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) })}</p>}</div><button className="games-button" aria-label={t("games.wow.runs.closeGear")} onClick={() => { setSelected(null); requestAnimationFrame(() => gearTrigger.current?.focus({ preventScroll: true })); }}><X size={16}/></button></header>
      {feed.busy && !feed.data && <div className="games-wow-run-loading" aria-busy="true" aria-label={t("common.loading")}><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/></div>}
      {feed.failed && <p className="games-wow-run-note" role="status">{t("games.wow.runs.unavailable")} <button className="games-wow-run-retry" onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></p>}
      {feed.data && <GameWowEquipment equipment={gear?.equipment ?? null}/>}
    </section>}
  </div>;
}
