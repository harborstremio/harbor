import { Play } from "@/components/icons/play-filled";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, MapPin, Search } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadPokemonLocation, loadPokemonLocations } from "@/lib/games/pokemon";
import type { GameGuide, GuideVideoCursor } from "@/lib/games/guides-data";
import { loadGuideVideos } from "@/lib/games/guides-fetch";
import { pokeId, pokeLabel } from "@/lib/games/pokemon-data";
import { pokemonArt, pokemonGuideTitle, type PokemonEdition } from "@/lib/games/pokemon-games";
import { GameArt } from "./game-art";
import { usePokemonFeed } from "./use-pokemon-feed";
import { PokemonStatus } from "./game-pokemon-shared";
import { PokemonEncounters } from "./game-pokemon-dex";
import { useHackVideo } from "./game-hack-video";
export function PokemonWalkthrough({ edition }: { edition: PokemonEdition; active: boolean; profile: string }) {
  const t = useT();
  const title = pokemonGuideTitle(edition), url = `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
  return <><div className="pokemon-section-heading"><div><h3>{t("games.pokemon.walkthrough")}</h3></div></div>
    <div className="pokemon-guide-source"><img className="pokemon-source-logo" src="/games/pokemon/bulbapedia.png" alt=""/><div><strong>Pokémon {edition.guide}</strong><span>Bulbapedia</span></div>
      <a href={url} onClick={event => { event.preventDefault(); void openUrl(url); }}>{t("games.pokemon.readGuide")}<ArrowUpRight size={16}/></a>
    </div></>;
}
export function PokemonLocations({ edition, active, choose }: { edition: PokemonEdition; active: boolean; choose: (id: number) => void }) {
  const t = useT(), [query, setQuery] = useState(""), [selected, setSelected] = useState(0), [limit, setLimit] = useState(24);
  const feed = usePokemonFeed(edition.key, active, signal => loadPokemonLocations(edition, signal));
  const locations = (feed.data ?? []).filter(ref => pokeLabel(ref.name).toLowerCase().includes(query.toLowerCase()));
  const initial = feed.data?.find(ref => /-route-\d+$/.test(ref.name)) ?? feed.data?.[0];
  const selectedId = selected || (initial ? pokeId(initial.url) : 0);
  const location = feed.data?.find(ref => pokeId(ref.url) === selectedId);
  const area = usePokemonFeed(`${edition.key}:${selectedId}`, active && !!selectedId, signal => loadPokemonLocation(selectedId, edition.version!, signal));
  return <><div className="pokemon-section-heading"><div><h3>{t("games.pokemon.encounters")}</h3><p>{t("games.pokemon.locationScope")}</p></div>
    <label className="pokemon-search" data-nav-focus-container><Search size={20}/><input value={query} onChange={event => { setQuery(event.target.value); setLimit(24); }} aria-label={t("games.pokemon.searchLocation")} placeholder={t("games.pokemon.searchLocation")}/></label></div>
    <div className="pokemon-location-layout"><nav className="pokemon-locations" aria-label={t("games.pokemon.searchLocation")}><PokemonStatus feed={feed} layout="locations"/>
      {locations.slice(0, limit).map(ref => <button key={ref.name} aria-pressed={selectedId === pokeId(ref.url)} onClick={() => setSelected(pokeId(ref.url))}><MapPin size={20}/><strong>{pokeLabel(ref.name)}</strong></button>)}
      {locations.length > limit && <button onClick={() => setLimit(n => n + 24)}>{t("games.pokemon.loadMore")}</button>}
      {!feed.busy && !feed.failed && !locations.length && <p className="pokemon-note">{t("games.pokemon.noLocations")}</p>}
    </nav><div className="pokemon-location-content"><header><h4>{location && pokeLabel(location.name)}</h4><span>{edition.guide}</span></header>
      <PokemonStatus feed={area} layout="dex"/>
      <div className="pokemon-location-grid">{area.data?.map(row => <section key={row.id} className="pokemon-location-card"><button onClick={() => choose(row.id)}><GameArt src={pokemonArt(row.id)}/><span><small>#{String(row.id).padStart(3, "0")}</small><strong>{pokeLabel(row.name)}</strong></span></button><PokemonEncounters encounters={row.encounters}/></section>)}</div>
      {area.data?.length === 0 && <p className="pokemon-note">{t("games.pokemon.noEncounters")}</p>}
    </div></div></>;
}
export { PokemonMaps } from "./game-pokemon-maps";
export function PokemonVideos({ game, active }: { game: string; active: boolean }) {
  const t = useT(), watch = useHackVideo(), [query, setQuery] = useState(""), [search, setSearch] = useState("walkthrough"), [cursor,setCursor]=useState<GuideVideoCursor>(), [videos,setVideos]=useState<GameGuide[]>([]);
  const feed = usePokemonFeed(`${game}:${search}:${cursor?.token ?? ""}`, active, async signal => {
    let page = await loadGuideVideos(game, search, false, signal, cursor, "relevance", "all");
    for (let attempt = 0; !page.items.length && page.cursor && attempt < 2; attempt++) {
      signal.throwIfAborted(); page = await loadGuideVideos(game, search, false, signal, page.cursor, "relevance", "all");
    }
    return page;
  });
  useEffect(()=>{if(feed.data)setVideos(previous=>[...new Map([...previous,...feed.data!.items].map(item=>[item.id,item])).values()]);},[feed.data]);
  return <><div className="pokemon-section-heading"><h3>{t("games.pokemon.videos")}</h3><form className="pokemon-search" onSubmit={event => { event.preventDefault(); const next=query.trim() || "walkthrough";if(next===search && !cursor){feed.retry();}else{setSearch(next);setCursor(undefined);setVideos([]);} }} data-nav-focus-container><Search size={20}/><input value={query} onChange={event => setQuery(event.target.value)} aria-label={t("games.pokemon.searchVideos")} placeholder={t("games.pokemon.searchVideos")}/><button type="submit" aria-label={t("common.search")}><Search size={20}/></button></form></div><div className="pokemon-video-grid">{videos.map(video => { const id = new URL(video.url).searchParams.get("v"); return id ? <button key={video.id} onClick={() => watch({ id, title: video.title, gameName: game, gameId: 0, creator: video.author })}><div><GameArt src={video.image}/><Play size={30}/></div><strong>{video.title}</strong><span>{video.author} · {video.duration}</span></button> : null; })}</div><PokemonStatus feed={feed} layout="videos"/>{feed.data?.cursor && <button className="pokemon-more" disabled={feed.busy} onClick={()=>setCursor(feed.data?.cursor)}>{t("games.pokemon.loadMore")}<ArrowRight size={20}/></button>}{!feed.busy && !videos.length && <div className="pokemon-video-fallback"><p>{t(feed.failed ? "games.pokemon.videoUnavailable" : "games.pokemon.noVideos")}</p><a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${game.replace(/\s+version\b/gi, "")} ${search}`)}`} onClick={event => { event.preventDefault(); void openUrl(event.currentTarget.href); }}><Play size={19}/>{t("games.pokemon.youtubeSearch")}</a></div>}</>;
}
