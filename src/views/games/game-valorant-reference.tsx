import { useEffect, useState } from "react";
import { ChevronDown, Crosshair } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { loadValorantMaps, loadValorantWeapons } from "@/lib/games/valorant";
import type { ValorantMap, ValorantWeapon } from "@/lib/games/valorant-data";
import { GameArt } from "./game-art";

function useReference<T>(active: boolean, language: string, load: (language: string, signal: AbortSignal) => Promise<{ data: T[] }>) {
  const [data, setData] = useState<T[] | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || data) return;
    const controller = new AbortController(); setFailed(false);
    void load(language, controller.signal).then(result => { if (!controller.signal.aborted) setData(result.data); }, () => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [active, language, load, attempt, data]);
  return { data, failed, retry: () => setAttempt(v => v + 1) };
}
function ReferenceState({ failed, retry }: { failed: boolean; retry: () => void }) {
  const t = useT();
  return failed ? <p className="games-valorant-status" role="status">{t("games.valorant.referenceError")} <button onClick={retry}>{t("common.retry")}</button></p> : <div className="games-valorant-reference-loading games-detail-skeleton" aria-busy="true" aria-label={t("common.loading")}/>;
}
export function ValorantMaps({ active, availableMaps, onMeta }: { active: boolean; availableMaps: string[]; onMeta: (map: string) => void }) {
  const t = useT();
  // English map names join OP.GG's published filter identities; never send a
  // translated label to a provider and silently receive the all-map statistics.
  const feed = useReference<ValorantMap>(active, "en", loadValorantMaps), [selected, setSelected] = useState(""), [callout, setCallout] = useState("");
  const map = feed.data?.find(m => m.id === selected) ?? feed.data?.find(m => m.name === "Ascent") ?? feed.data?.[0];
  if (!feed.data) return <ReferenceState failed={feed.failed} retry={feed.retry}/>;
  if (!map) return <p className="games-valorant-status">{t("games.valorant.empty")}</p>;
  return <div className="games-valorant-maps"><div className="games-valorant-map-picker" role="group" aria-label={t("games.valorant.map")}>{feed.data.map(m => <button key={m.id} aria-pressed={m.id === map.id} onClick={() => { setSelected(m.id); setCallout(""); }}><GameArt src={m.thumbnail} fallback={m.image}/><span>{m.name}</span></button>)}</div>
    <div className="games-valorant-map-detail"><div className="games-valorant-map-art"><div className="games-valorant-map-image"><GameArt key={map.minimap} src={map.minimap} alt={map.name} eager/>{map.callouts.filter(c => c.name === callout).map(c => <span key={c.name} className="games-valorant-map-pin" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}><i/>{c.name}</span>)}</div></div><div className="games-valorant-map-copy"><GameArt src={map.image} className="games-valorant-map-scene"/><h3>{map.name}</h3>{map.description && <p>{map.description}</p>}{availableMaps.includes(map.name) && <button className="games-valorant-text-button" onClick={() => onMeta(map.name)}><Crosshair size={17}/>{t("games.valorant.mapMeta")}</button>}<p className="games-valorant-meta-note">{t("games.valorant.mapScope")}</p>{map.callouts.length > 0 && <details><summary>{t("games.valorant.callouts")}<ChevronDown size={16}/></summary><div className="games-valorant-callouts">{map.callouts.map(c => <button key={c.name} aria-pressed={callout === c.name} onClick={() => setCallout(c.name)}>{c.name}</button>)}</div></details>}</div></div>
  </div>;
}
export function ValorantArsenal({ active, language }: { active: boolean; language: string }) {
  const t = useT(), feed = useReference<ValorantWeapon>(active, language, loadValorantWeapons), [left, setLeft] = useState("9c82e19d-4575-0200-1a81-3eacf00cf872"), [right, setRight] = useState("ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a"), [distance, setDistance] = useState(20);
  if (!feed.data) return <ReferenceState failed={feed.failed} retry={feed.retry}/>;
  const a = feed.data.find(w => w.id === left) ?? feed.data[0], b = feed.data.find(w => w.id === right) ?? feed.data[1];
  if (!a || !b) return <p className="games-valorant-status">{t("games.valorant.empty")}</p>;
  const weapons = [a, b], fmt = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  const damage = weapons.map(w => w.damage.find(r => distance >= r.min && distance < r.max) ?? (distance === w.damage.at(-1)?.max ? w.damage.at(-1) : undefined));
  const options = feed.data.map(w => ({ value: w.id, label: `${w.name} · ${fmt.format(w.cost)}` }));
  return <div className="games-valorant-arsenal"><div className="games-valorant-weapon-pair">{weapons.map((w, i) => <div key={i}><Dropdown ariaLabel={t(i ? "games.valorant.compareWeapon" : "games.valorant.weapon")} value={w.id} options={options} onChange={i ? setRight : setLeft}/><GameArt src={w.image} alt={w.name} className="games-valorant-weapon-art"/><h3>{w.name}</h3><span>{w.category}</span></div>)}</div>
    <div className="games-valorant-distance"><label htmlFor="valorant-distance">{t("games.valorant.distance")} <strong>{fmt.format(distance)} m</strong></label><input id="valorant-distance" type="range" min="0" max="50" value={distance} onChange={e => setDistance(Number(e.target.value))}/></div>
    <table className="games-valorant-weapon-table"><caption>{t("games.valorant.damageScope")}</caption><thead><tr><th scope="col">{t("games.valorant.weaponStats")}</th><th scope="col">{a.name}</th><th scope="col">{b.name}</th></tr></thead><tbody>
      {[{ label: "cost", values: weapons.map(w => w.cost) }, { label: "magazine", values: weapons.map(w => w.magazine) }, { label: "fireRate", values: weapons.map(w => w.fireRate) }, { label: "reload", values: weapons.map(w => w.reload) }, { label: "head", values: damage.map(d => d?.head) }, { label: "body", values: damage.map(d => d?.body) }, { label: "legs", values: damage.map(d => d?.legs) }].map(r => <tr key={r.label}><th scope="row">{t(`games.valorant.${r.label}`)}</th>{r.values.map((value, i) => <td key={i}>{value === undefined ? "—" : fmt.format(value)}</td>)}</tr>)}
    </tbody></table>
  </div>;
}
