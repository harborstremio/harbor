import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, Check, Copy, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { openUrl } from "@/lib/window";
import { loadWowSpell } from "@/lib/games/wow-spells";
import { wowSpellUrl, wowTalentPositions, type WowTalent, type WowTalents, type WowTalentGroup, type WowSpellDescription } from "@/lib/games/wow-talents";
import { GameArt } from "./game-art";
import "./game-wow-talents.css";

export function GameWowTalents({ talents, className, spec, active }: { talents: WowTalents | null; className: string; spec: string; active: boolean }) {
  const t = useT(), language = useUiLanguage(), trigger = useRef<HTMLButtonElement | null>(null);
  const [selectedId, setSelected] = useState<number | null>(null);
  const selected = talents && Object.values(talents.groups).flat().find(node => node.nodeId === selectedId);
  useEffect(() => { if (!active) setSelected(null); }, [active]);
  const dismiss = useCallback(() => { setSelected(null); requestAnimationFrame(() => { if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }); }); }, []);
  if (!talents) return <p className="games-wow-status" role="status">{t("games.wow.talents.unavailable")}</p>;
  return <div className="games-wow-talents">
    <header className="games-wow-talents-heading"><div><h4>{t("games.wow.talents.selected")}</h4><p>{t("games.wow.talents.note")}</p></div>{talents.code && <CopyBuild key={talents.code} code={talents.code}/>}</header>
    {talents.partial && <p className="games-wow-status" role="status">{t("games.wow.talents.partial")}</p>}
    <div className="games-wow-talent-trees">{(["class", "hero", "spec"] as WowTalentGroup[]).map(group => {
      const nodes = talents.groups[group], layout = wowTalentPositions(nodes);
      const name = group === "class" ? className : group === "spec" ? spec : talents.hero?.name;
      return <section key={group} className={`games-wow-talent-group games-wow-talent-${group}`} aria-label={name || t(`games.wow.talents.${group}`)}>
        {group === "hero" && talents.hero?.image && <GameArt className="games-wow-hero-emblem" src={talents.hero.image}/>}
        <header><small>{t(`games.wow.talents.${group}`)}</small><h5 dir="auto">{name || "—"}</h5><span>{t("games.wow.talents.count", { count: nodes.length.toLocaleString(language) })}</span></header>
        {group === "hero" && talents.hero?.description && <p className="games-wow-hero-description" dir="auto">{talents.hero.description}</p>}
        {nodes.length ? <div className={`games-wow-talent-board${layout ? "" : " games-wow-talent-list"}`} style={layout ? { height: layout.height } : undefined}>
          {(layout?.points ?? nodes.map(node => ({ node, x: 0, y: 0 }))).map(({ node, x, y }) => <button key={node.nodeId} type="button" className="games-wow-talent-node" data-node-id={node.nodeId} data-choice={node.choice || undefined} title={`${node.name} · ${t("games.wow.talents.rank", { rank: node.rank })}`} aria-label={`${node.name} · ${t("games.wow.talents.rank", { rank: node.rank })}`} aria-haspopup="dialog" style={layout ? { "--node-x": x, top: y } as CSSProperties : undefined} onClick={event => { trigger.current = event.currentTarget; setSelected(node.nodeId); }}>
            <span className="games-wow-talent-icon"><span aria-hidden="true">{node.name.slice(0, 2)}</span><GameArt src={node.image}/></span>
            <span className="games-wow-talent-rank" aria-hidden="true">{node.rank}</span><span className="games-wow-talent-caption" aria-hidden="true">{node.name}</span>
          </button>)}
        </div> : <p className="games-wow-status">{t("games.wow.talents.groupUnavailable")}</p>}
      </section>;
    })}</div>
    {selected && active && <TalentDialog key={`${selected.nodeId}:${language}`} talent={selected} onClose={dismiss}/>}
  </div>;
}
function CopyBuild({ code }: { code: string }) {
  const t = useT(), [state, setState] = useState<"idle" | "busy" | "copied" | "failed">("idle");
  return <div className="games-wow-talent-copy"><button className="games-button" disabled={state === "busy"} onClick={async () => { setState("busy"); try { await navigator.clipboard.writeText(code); setState("copied"); } catch { setState("failed"); } }}>{state === "copied" ? <Check size={16}/> : <Copy size={16}/>} {t(state === "copied" ? "games.wow.runs.copied" : "games.wow.talents.copy")}</button>
    <small role="status">{t(state === "failed" ? "games.wow.runs.copyFailed" : "games.wow.talents.import")}</small>
    {state === "failed" && <textarea readOnly value={code} aria-label={t("games.wow.talents.copy")} onClick={event => event.currentTarget.select()}/>}
  </div>;
}
function TalentDialog({ talent, onClose }: { talent: WowTalent; onClose: () => void }) {
  const t = useT(), language = useUiLanguage(), title = useId(), closeButton = useRef<HTMLButtonElement>(null), { closing, close } = useModalExit(onClose);
  const [description, setDescription] = useState<WowSpellDescription | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useSectionBack(close, true);
  useEffect(() => {
    const controller = new AbortController(); setFailed(false); setDescription(null);
    void loadWowSpell(talent.id, language, controller.signal).then(value => { if (!controller.signal.aborted) setDescription(value.data); }, () => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [talent.id, language, attempt]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => closeButton.current?.focus({ preventScroll: true }));
    const dialog = closeButton.current?.closest<HTMLElement>('[role="dialog"]');
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')].filter(item => item.getClientRects().length);
      if (event.shiftKey && (document.activeElement === controls[0] || !dialog.contains(document.activeElement))) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && (document.activeElement === controls.at(-1) || !dialog.contains(document.activeElement))) { event.preventDefault(); controls[0]?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", trap); };
  }, []);
  return <ModalShell closing={closing} onDismiss={close} width={520} labelledBy={title} backdropClassName="games-wow-talent-backdrop bg-black/50">
    <div className="games-wow-talent-dialog" data-tv-focus-scope>
      <header><GameArt src={talent.image}/><div><small>{t("games.wow.talents.rank", { rank: talent.rank })}</small><h2 id={title} dir="auto">{description?.name || talent.name}</h2></div><button ref={closeButton} className="games-button" onClick={close} aria-label={t("common.close")} data-tv-modal-close><X size={18}/></button></header>
      <div className="games-wow-spell-description" aria-busy={!description && !failed}>
        {description ? description.paragraphs.map((paragraph, index) => <p key={index} dir="auto" lang={description.language}>{paragraph}</p>) : failed ? <p role="status">{t("games.wow.talents.descriptionUnavailable")} <button onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></p> : <div aria-label={t("common.loading")} className="games-wow-spell-loading"><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/></div>}
      </div>
      {!!talent.alternatives.length && <div className="games-wow-talent-alternatives"><h3>{t("games.wow.talents.otherChoice")}</h3>{talent.alternatives.map(spell => <div key={spell.id}><GameArt src={spell.image}/><span dir="auto">{spell.name}</span></div>)}</div>}
      <footer><a href={wowSpellUrl(talent.id)} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); void openUrl(wowSpellUrl(talent.id)); }}>Wowhead <ArrowUpRight size={14}/></a><p>{t("games.wow.talents.reference")}</p></footer>
    </div>
  </ModalShell>;
}
