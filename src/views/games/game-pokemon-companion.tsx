import { Play } from "@/components/icons/play-filled";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Compass, Map } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { pokemonArt, type PokemonEdition } from "@/lib/games/pokemon-games";
import { GameArt } from "./game-art";
import { HackVideoProvider } from "./game-hack-video";
import { PokemonDex, PokemonSpecies } from "./game-pokemon-dex";
import { PokemonLocations, PokemonMaps, PokemonVideos, PokemonWalkthrough } from "./game-pokemon-world";
import "./game-pokemon-companion.css";
function PokeMark() { return <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.7"/><path d="M4 14h6m8 0h6" stroke="currentColor" strokeWidth="1.7"/><circle cx="14" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.7"/></svg>; }
const tabs = [["walkthrough", BookOpen], ["dex", PokeMark], ["encounters", Compass], ["maps", Map], ["videos", Play]] as const;
export function GamePokemonCompanion({ edition, game, active, profile }: { edition: PokemonEdition; game: string; active: boolean; profile: string }) {
  const t = useT(), root = useRef<HTMLElement>(null), [engaged, setEngaged] = useState(false), [tab, setTab] = useState("walkthrough"), [seen, setSeen] = useState(["walkthrough"]), [species, setSpecies] = useState<number>();
  const restore = useRef<{ element: HTMLElement | null; scroll: HTMLElement | null; top: number }>({ element: null, scroll: null, top: 0 });
  useEffect(() => { if (!active || !root.current) return; const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setEngaged(true); }, { rootMargin: "200px" }); observer.observe(root.current); return () => observer.disconnect(); }, [active]);
  const choose = (id: number) => { const scroll = root.current?.closest<HTMLElement>(".games-view") ?? root.current?.closest("main") ?? null; if (!species) restore.current = { element: document.activeElement as HTMLElement | null, scroll, top: scroll?.scrollTop ?? 0 }; setSpecies(id); requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(".pokemon-back")?.focus({ preventScroll: true })); };
  const back = () => { setSpecies(undefined); requestAnimationFrame(() => { const prior = restore.current; if (prior.scroll) prior.scroll.scrollTop = prior.top; prior.element?.focus({ preventScroll: true }); }); };
  useSectionBack(back, active && !!species);
  const visible = active && engaged && !species;
  return <HackVideoProvider active={active}><section className="pokemon games-inset" ref={root} aria-label={t("games.pokemon.title")}><header className="pokemon-heading"><div><span>{game}</span><h2>{t("games.pokemon.title")}</h2><p>{t("games.pokemon.intro")}</p></div><div className="pokemon-heading-art" aria-hidden="true">{edition.mascots.map(id => <GameArt key={id} src={pokemonArt(id)}/>)}</div></header><div hidden={!!species}><nav className="pokemon-navigation" aria-label={t("games.pokemon.browse")}>{tabs.map(([key, Icon]) => <button key={key} aria-pressed={tab === key} onClick={() => { setTab(key); setSeen(previous => previous.includes(key) ? previous : [...previous, key]); }}><Icon/><strong>{t(`games.pokemon.${key}`)}</strong><span>{t(`games.pokemon.${key}Hint`)}</span></button>)}</nav>
      {seen.includes("walkthrough") && <div className="pokemon-panel" hidden={tab !== "walkthrough"}><PokemonWalkthrough edition={edition} active={visible && tab === "walkthrough"} profile={profile}/></div>}
      {seen.includes("dex") && <div className="pokemon-panel" hidden={tab !== "dex"}><PokemonDex edition={edition} active={visible && tab === "dex"} choose={choose}/></div>}
      {seen.includes("encounters") && <div className="pokemon-panel" hidden={tab !== "encounters"}><PokemonLocations edition={edition} active={visible && tab === "encounters"} choose={choose}/></div>}
      {seen.includes("maps") && <div className="pokemon-panel" hidden={tab !== "maps"}><PokemonMaps edition={edition} active={visible && tab === "maps"}/></div>}
      {seen.includes("videos") && <div className="pokemon-panel" hidden={tab !== "videos"}><PokemonVideos game={game} active={visible && tab === "videos"}/></div>}
    </div>{species && <PokemonSpecies key={species} id={species} edition={edition} active={active} back={back} choose={choose}/>}<footer className="pokemon-provenance">{t("games.pokemon.sources")}</footer></section></HackVideoProvider>;
}
