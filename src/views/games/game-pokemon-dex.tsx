import { PokemonMapImage } from "./game-pokemon-map-image";
import { matchPokemonEncounterMap } from "@/lib/games/pokemon-encounter-map";
import { PokemonMapViewer } from "./game-pokemon-map-viewer";
import { PokemonMoves, PokemonTypeBadge } from "./game-pokemon-moves";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { loadPokemonDex, loadPokemonSpecies, loadPokemonEncounterMaps, type PokemonMap } from "@/lib/games/pokemon";
import { groupPokemonEncounters, pokeArray, pokeEvolutionConditions, pokeId, pokeLabel, pokeNumber, pokeObject, pokeRef, type PokeEncounter } from "@/lib/games/pokemon-data";
import { pokemonArt, type PokemonEdition } from "@/lib/games/pokemon-games";
import { GameArt } from "./game-art";
import { usePokemonFeed } from "./use-pokemon-feed";
import { PokemonImageDownload } from "./game-pokemon-download";
import { PokemonStatus } from "./game-pokemon-shared";
export function PokemonEncounters({ encounters, edition, active = true }: { encounters: PokeEncounter[]; edition?: PokemonEdition; active?: boolean }) {
  const t = useT(), [selected, setSelected] = useState<PokemonMap | null>(null);
  const feed = usePokemonFeed(edition?.key ?? "none", active && !!edition?.maps && encounters.length > 0, signal => loadPokemonEncounterMaps(edition!, signal));
  return encounters.length ? <><div className="pokemon-encounters">{groupPokemonEncounters(encounters).map((row, index) => {
    const map = edition && matchPokemonEncounterMap(row.area, edition, feed.data ?? []);
    return <article key={`${row.area}:${index}`}>
      {map && <button className="pokemon-encounter-map" onClick={() => setSelected(map)} aria-label={`${t("games.pokemon.maps")} · ${pokeLabel(row.area)}`}><PokemonMapImage src={map.image}/></button>}
      <div className="pokemon-encounter-place"><strong>{pokeLabel(row.area)}</strong><span>{pokeLabel(row.method)}{row.conditions.length ? ` · ${row.conditions.map(pokeLabel).join(", ")}` : ""}</span></div><div><b>{t("games.pokemon.levelRange", { min: row.min, max: row.max })}</b><span>{row.chance}%</span></div>
    </article>;
  })}</div>{active && selected && <PokemonMapViewer map={selected} close={() => setSelected(null)}/>}</> : <p className="pokemon-note">{t("games.pokemon.noEncounters")}</p>;
}
function Evolution({ raw, choose }: { raw: unknown; choose: (id: number) => void }) {
  const t=useT(), row = pokeObject(raw), ref = pokeRef(row.species), id = pokeId(ref.url);
  if (!id) return null;
  return <div className="pokemon-evolution"><button onClick={() => choose(id)}><GameArt src={pokemonArt(id)}/><strong>{pokeLabel(ref.name)}</strong></button>{pokeArray(row.evolution_details).map((detail,index)=><div className="pokemon-evolution-method" key={index}>{pokeEvolutionConditions(detail).map(condition=><span key={condition.field}>{t(`games.pokemon.evolution.${condition.field}`)}: {condition.value}</span>)}</div>)}{pokeArray(row.evolves_to).map((child, index) => <div key={index}><ArrowRight size={18}/><Evolution raw={child} choose={choose}/></div>)}</div>;
}
export function PokemonSpecies({ id, edition, active, back, choose }: { id: number; edition: PokemonEdition; active: boolean; back: () => void; choose: (id: number) => void }) {
  const t = useT(), language = useUiLanguage(), [tab, setTab] = useState("encounters");
  const feed = usePokemonFeed(`${edition.key}:${id}:${language}`, active, signal => loadPokemonSpecies(id, edition, language, signal)), data = feed.data;
  return <div className="pokemon-species"><button className="pokemon-back" onClick={back}><ArrowLeft size={20}/>{t("games.pokemon.backDex")}</button><PokemonStatus feed={feed} layout="species"/>{data && <>
    <header className="pokemon-species-heading"><div className="pokemon-species-art"><GameArt src={pokemonArt(id)} eager/><PokemonImageDownload id={id} name={data.name}/></div><div><span>#{String(id).padStart(3, "0")}</span><h3 tabIndex={-1} className="pokemon-selection-title">{data.name}</h3><div className="pokemon-types">{data.types.map(type => <PokemonTypeBadge key={type} type={type}/>)}</div><p>{data.flavor}</p></div></header>
    <div className="pokemon-subtabs" role="group" aria-label={t("games.pokemon.pokemonDetails")}>{["encounters", "moves", "evolution", "stats"].map(value => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{t(`games.pokemon.${value}`)}</button>)}</div>
    {tab === "encounters" && <PokemonEncounters encounters={data.encounters} edition={edition} active={active}/>}
    {tab === "moves" && <PokemonMoves key={`${edition.key}:${id}`} moves={data.moves} edition={edition} active={active}/>}
    {tab === "evolution" && <><p className="pokemon-note">{t("games.pokemon.evolutionScope")}</p><Evolution raw={data.chain} choose={choose}/></>}
    {tab === "stats" && <><p className="pokemon-note">{t("games.pokemon.currentStats")}</p><div className="pokemon-stats">{data.stats.map(row => <div key={pokeRef(row.stat).name}><span>{pokeRef(row.stat).name === "hp" ? "HP" : pokeLabel(pokeRef(row.stat).name)}</span><meter min={0} max={255} value={pokeNumber(row.base_stat)}/><b>{pokeNumber(row.base_stat)}</b></div>)}</div><p>{data.abilities.map(row => pokeLabel(pokeRef(row.ability).name)).join(" · ")}</p></>}
  </>}</div>;
}
export function PokemonDex({ edition, active, choose }: { edition: PokemonEdition; active: boolean; choose: (id: number) => void }) {
  const t = useT(), [query, setQuery] = useState(""), [limit, setLimit] = useState(24);
  const feed = usePokemonFeed(edition.key, active, signal => loadPokemonDex(edition, signal));
  const entries = (feed.data ?? []).filter(entry => `${entry.name} ${entry.id}`.toLowerCase().includes(query.toLowerCase()));
  return <><div className="pokemon-section-heading"><div><h3>{t("games.pokemon.dex")}</h3><p>{t("games.pokemon.dexScope")}</p></div><label className="pokemon-search" data-nav-focus-container><Search size={20}/><input aria-label={t("games.pokemon.searchPokemon")} placeholder={t("games.pokemon.searchPokemon")} value={query} onChange={event => { setQuery(event.target.value); setLimit(24); }}/></label></div><PokemonStatus feed={feed}/><div className="pokemon-dex-grid">{entries.slice(0, limit).map(entry => <div className="pokemon-dex-card" key={entry.id}><button data-pokemon-id={entry.id} onClick={() => choose(entry.id)}><small>#{String(entry.id).padStart(3, "0")}</small><GameArt src={pokemonArt(entry.id)}/><strong>{entry.name}</strong></button><PokemonImageDownload id={entry.id} name={entry.name}/></div>)}</div>{entries.length > limit && <button className="pokemon-more" onClick={() => setLimit(n => n + 24)}>{t("games.pokemon.loadMore")}<ArrowRight size={20}/></button>}{!feed.busy && !feed.failed && !entries.length && <p className="pokemon-note">{t(edition.version ? "games.pokemon.noResults" : "games.pokemon.noRetailDex")}</p>}</>;
}
