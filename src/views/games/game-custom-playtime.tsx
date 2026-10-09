import { useEffect, useId, useRef, useState } from "react";
import { Check, Pencil, RotateCcw } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { customPlaytime, importedCustomPlaytime, type CustomGame } from "@/lib/games/custom-library";
import type { CustomGameLibrary } from "@/hooks/use-custom-game-library";
import { PLAYTIME_UNITS, parsePlaytimeFields, playtimeFields } from "@/lib/games/playtime-input";
import "./game-custom-playtime.css";

export function CustomPlaytimeLabel({ game }: { game: CustomGame }) {
  const t = useT(), time = customPlaytime(game), language = useUiLanguage();
  if (!time && !game.playtimeCorrection) return null;
  const duration = t("games.playtime.duration", { hours: Math.floor(time / 3600).toLocaleString(language), minutes: Math.floor(time % 3600 / 60).toLocaleString(language) });
  return <small className="games-custom-time-label" title={t(game.playtimeCorrection ? "games.playtime.adjusted" : game.hydra ? "games.hydra.includesTime" : "games.playtime.tracked")}>{t("games.playtime.card", { time: duration })}{game.playtimeCorrection && <Pencil size={11} aria-label={t("games.playtime.adjusted")} />}</small>;
}

export function CustomPlaytimeEditor({ game, library, onBackChange }: { game: CustomGame; library: CustomGameLibrary; onBackChange: (handler: (() => void) | null) => void }) {
  const t = useT(), language = useUiLanguage(), id = useId(), input = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null), live = useRef(true);
  const [editing, setEditing] = useState(false), [fields, setFields] = useState(() => playtimeFields(0)), [notice, setNotice] = useState("");
  const [invalid, setInvalid] = useState(false), [saving, setSaving] = useState(false);
  const running = library.running.some(item => item.id === game.id), busy = saving || library.busy.includes(game.id);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const cancel = () => { if (busy) return; setEditing(false); setInvalid(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); };
  useSectionBack(cancel, editing);
  useEffect(() => { onBackChange(editing ? cancel : null); return () => onBackChange(null); }, [editing, busy, onBackChange]);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const duration = (seconds: number) => t("games.playtime.preciseDuration", { hours: Math.floor(seconds / 3600).toLocaleString(language), minutes: Math.floor(seconds % 3600 / 60).toLocaleString(language), seconds: (seconds % 60).toLocaleString(language) });
  const edit = () => { setFields(playtimeFields(customPlaytime(game))); setInvalid(false); setNotice(""); setEditing(true); };
  const save = async (reset = false) => {
    if (busy || running) return;
    const seconds = parsePlaytimeFields(fields, language);
    if (!reset && seconds === null) { setInvalid(true); input.current?.focus(); return; }
    setSaving(true); setInvalid(false); setNotice("");
    const ok = await library.correctPlaytime(game.id, reset ? null : seconds!);
    if (!live.current) return;
    setSaving(false);
    if (ok) { setEditing(false); setNotice(reset && !game.hydra ? "games.playtime.resetDone" : "games.playtime.saved"); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }
  };
  return <section className="games-custom-playtime" aria-labelledby={`${id}-title`}>
    <div className="games-custom-playtime-heading"><h3 id={`${id}-title`}>{t("games.playtime.title")}</h3><button type="button" className="games-button" ref={trigger} disabled={busy || running} aria-expanded={editing} onClick={editing ? cancel : edit}><Pencil size={14} />{t("games.playtime.edit")}</button></div>
    <dl><div><dt>{t("games.playtime.total")}</dt><dd>{duration(customPlaytime(game))}</dd></div><div><dt>{t("games.playtime.tracked")}</dt><dd>{duration(game.measuredSeconds)}</dd></div>{game.hydra&&<div><dt>{t("games.hydra.importedTime")}</dt><dd>{duration(importedCustomPlaytime(game))}</dd></div>}</dl>
    {game.playtimeCorrection && <p className="games-custom-playtime-provenance">{t("games.playtime.changed", { date: new Date(game.playtimeCorrection.changedAt).toLocaleString(language) })}</p>}
    {running && <p role="status">{t("games.playtime.running")}</p>}
    {editing && <div className="games-custom-playtime-edit"><p id={`${id}-note`}>{t("games.playtime.note")}</p><div className="games-custom-playtime-fields">
      {PLAYTIME_UNITS.map((unit,index)=><label key={unit}><span>{t(`games.playtime.${unit}`)}</span><input ref={index===0?input:undefined} inputMode="decimal" maxLength={24} value={fields[unit]} disabled={busy || running} aria-invalid={invalid} aria-describedby={`${id}-note${invalid ? ` ${id}-error` : ""}`} onChange={event=>setFields(previous=>({...previous,[unit]:event.target.value}))}/></label>)}
    </div><p>{t("games.playtime.decimalHint")}</p>{invalid && <p id={`${id}-error`} role="alert">{t("games.playtime.decimalInvalid")}</p>}<p>{t("games.playtime.localNote")}</p><div className="games-custom-playtime-actions">
      {game.playtimeCorrection && <button type="button" className="games-button" disabled={busy || running} onClick={() => void save(true)}><RotateCcw size={14} />{t(game.hydra?"games.hydra.resetTime":"games.playtime.reset")}</button>}
      <button type="button" className="games-button" disabled={busy} onClick={cancel}>{t("common.cancel")}</button><button type="button" className="games-button games-button-primary" disabled={busy || running} onClick={() => void save()}><Check size={14} />{t("games.playtime.save")}</button>
    </div></div>}
    {notice && <p role="status">{t(notice)}</p>}
  </section>;
}
