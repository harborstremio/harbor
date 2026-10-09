import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BookOpen, RefreshCw, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { Dropdown } from "@/components/dropdown";
import { useSectionBack } from "@/lib/section-back";
import { useT, useUiLanguage } from "@/lib/i18n";
import { loadRivalsGuide } from "@/lib/games/rivals";
import type { RivalsHero } from "@/lib/games/rivals-data";
import type { RivalsGuideField } from "@/lib/games/rivals-guide-data";
import { GameArt } from "./game-art";
import "./game-rivals-guide.css";

const k = (name: string) => `games.rivals.guide.${name}`;
type Observation = Awaited<ReturnType<typeof loadRivalsGuide>>;

export function GameRivalsGuide({ hero, active }: { hero: RivalsHero; active: boolean }) {
  const t = useT(), trigger = useRef<HTMLButtonElement>(null), [open, setOpen] = useState(false);
  const dismiss = useCallback(() => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus({preventScroll:true})); }, []);
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  if (!hero.guide) return null;
  return <><button ref={trigger} className="games-button games-rivals-guide-open" onClick={() => setOpen(true)}><BookOpen size={17}/>{t(k("open"))}</button>{open && active && <Guide hero={hero} guide={hero.guide} onClose={dismiss}/>}</>;
}

function Guide({ hero, guide, onClose }: { hero: RivalsHero; guide: NonNullable<RivalsHero["guide"]>; onClose: () => void }) {
  const t = useT(), language = useUiLanguage(), title = useId(), {closing, close} = useModalExit(onClose);
  const root = useRef<HTMLDivElement>(null), closeButton = useRef<HTMLButtonElement>(null), content = useRef<HTMLElement>(null);
  const [result, setResult] = useState<Observation | null>(null), [busy, setBusy] = useState(true), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [formId, setFormId] = useState<number | null>(null), [abilityId, setAbilityId] = useState<string | null>(null);
  useSectionBack(close, true, true);
  useEffect(() => {
    if (closing) return;
    const controller = new AbortController(); setBusy(true); setFailed(false);
    void loadRivalsGuide(guide, controller.signal, attempt > 0).then(value => {
      if (!controller.signal.aborted) { setResult(value); setBusy(false); }
    }, () => { if (!controller.signal.aborted) { setBusy(false); setFailed(true); } });
    return () => controller.abort();
  }, [guide.name, guide.url, attempt, closing]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => closeButton.current?.focus({preventScroll:true}));
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || document.querySelector("[data-dropdown-menu]")) return;
      const controls = [...root.current?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],input:not(:disabled)") ?? []].filter(node => node.getClientRects().length);
      if (event.shiftKey && (document.activeElement === controls[0] || !root.current?.contains(document.activeElement))) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    };
    window.addEventListener("keydown", trap);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", trap); };
  }, []);
  const data = result?.data;
  const roleForm = data?.abilities.find(ability => ability.form !== null && ability.name.toLowerCase().includes(`- ${hero.role}`))?.form;
  const form = data?.forms.find(entry => entry.id === (formId ?? roleForm)) ?? data?.forms[0];
  const abilities = data?.abilities.filter(ability => ability.form === null || ability.form === form?.id) ?? [];
  const selected = abilities.find(ability => ability.id === abilityId) ?? abilities[0];
  const formLabel = (id: number) => {
    const entry = data!.forms.find(value => value.id === id)!;
    const attack = data!.abilities.find(ability => ability.form === id && ability.kind === "attack");
    return `${t(k("formNumber"),{number:String(id + 1)})} · ${attack?.name ?? entry.name}`;
  };
  return <ModalShell closing={closing} onDismiss={close} width={920} labelledBy={title} backdropClassName="bg-black/50">
    <div ref={root} className="games-rivals-guide">
      <header><GameArt src={hero.thumbnail}/><div><h2 id={title}>{hero.name}</h2><p>{t(k("reference"))}</p></div><button ref={closeButton} data-modal-back className="games-icon-button" aria-label={t("common.close")} onClick={close}><X size={20}/></button></header>
      <div className="games-rivals-guide-tools">
        {data && data.forms.length > 1 && <Dropdown className="games-rivals-guide-form" ariaLabel={t(k("form"))} value={String(form!.id)} options={data.forms.map(entry => ({value:String(entry.id),label:formLabel(entry.id)}))} onChange={value => {setFormId(Number(value));setAbilityId(null);content.current?.scrollTo({top:0});}}/>}
        {result && <span>{t(k("checked"),{date:new Date(result.at).toLocaleString(language,{dateStyle:"medium",timeStyle:"short"})})}</span>}
        <button className="games-icon-button" aria-label={t("games.rivals.refresh")} disabled={busy} onClick={() => setAttempt(value => value+1)}><RefreshCw size={17}/></button>
      </div>
      {failed && <div className="games-rivals-guide-status" role="status"><span>{t(k("failed"))}</span><button className="games-button" disabled={busy} onClick={() => setAttempt(value => value+1)}>{t("common.retry")}</button></div>}
      {data?.partial && <p className="games-rivals-guide-status" role="status">{t(k("partial"))}</p>}
      {busy && !data ? <div className="games-rivals-guide-loading" aria-busy="true" aria-label={t("common.loading")}><i className="games-detail-skeleton"/><i className="games-detail-skeleton"/></div> : data && form && selected && <div className="games-rivals-guide-body">
        <nav aria-label={t(k("open"))}>{(["attack","skills","teamUp"] as const).map(kind => {
          const group = abilities.filter(ability => ability.kind === kind);
          return group.length > 0 && <div key={kind}><h3>{t(k(kind))}</h3>{group.map(ability => <button key={ability.id} aria-pressed={selected.id === ability.id} onClick={() => {setAbilityId(ability.id);content.current?.scrollTo({top:0});}}><AbilityIcon src={ability.image}/><span>{ability.name}{ability.effect && <small>{t(k(ability.effect))}</small>}</span></button>)}</div>;
        })}</nav>
        <article ref={content} aria-live="polite">
          <section className="games-rivals-guide-base"><h3>{t(k("baseStats"))}</h3><Fields values={form.fields}/></section>
          <div className="games-rivals-guide-ability"><AbilityIcon src={selected.image}/><div>{selected.effect && <span>{t(k(selected.effect))}</span>}<h3>{selected.name}</h3></div>{selected.partner && <GameArt className="games-rivals-guide-partner" src={selected.partner}/>}</div>
          <p dir="auto">{selected.description}</p><Fields values={selected.fields}/>
        </article>
      </div>}
    </div>
  </ModalShell>;
}

function AbilityIcon({src}:{src:string}) {
  return <span className="games-rivals-ability-icon" aria-hidden="true" style={src ? {maskImage:`url("${src}")`} : {background:"none"}}/>;
}

function Fields({values}:{values:RivalsGuideField[]}) {
  return <dl className="games-rivals-guide-fields">{values.map((field,index) => <div key={index} className={!field.value ? "is-heading" : undefined}><dt dir="auto">{field.label}</dt>{field.value && <dd dir="auto">{field.value}</dd>}</div>)}</dl>;
}
