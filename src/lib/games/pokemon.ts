import { safeFetchBytes } from "@/lib/safe-fetch";
import { createPokemonSource, pokemonWikiUrl as wikiApi, POKEMON_API as API, POKEMON_WIKI as WIKI, POKEMON_ARCHIVE as ARCHIVE } from "./pokemon-source";
import { sanitizeGuideHtml } from "./guides-data";
import { pokeArray, pokeId, pokeLocalized, pokeObject, pokeRef, pokeText, parsePokedex, parsePokeEncounters, parsePokeMoves, parsePokeTypes } from "./pokemon-data";
import type { PokemonEdition } from "./pokemon-games";
import { parsePokemonMoveDetail } from "./pokemon-move-details";
const raw = createPokemonSource(safeFetchBytes);
const endpoint = (path: string) => `${API}/${path}/`;
export async function loadPokemonMove(id: number, edition: PokemonEdition, language: string, signal: AbortSignal) {
  if (!Number.isInteger(id) || id < 1 || !edition.group) throw Error("Invalid move edition");
  const [moveRaw, groupRaw] = await Promise.all([raw(endpoint(`move/${id}`), signal), raw(endpoint(`version-group/${edition.group}`), signal)]);
  const move = pokeObject(moveRaw), group = pokeObject(groupRaw), orders: Record<string, number> = {};
  for (const value of pokeArray(move.past_values).map(pokeObject)) {
    const name = pokeRef(value.version_group).name;
    if (name && !(name in orders)) orders[name] = Number(pokeObject(await raw(endpoint(`version-group/${name}`), signal)).order);
  }
  return parsePokemonMoveDetail(move, edition.group, Number(group.order), edition.generation ?? 9, language, orders);
}
export async function loadPokemonDex(edition: PokemonEdition, signal: AbortSignal) {
  if (!edition.version) return [];
  const version = pokeObject(await raw(endpoint(`version/${edition.version}`), signal));
  const groupRef = pokeRef(version.version_group);
  if (!groupRef.name) throw Error("Pokémon version unavailable");
  const group = pokeObject(await raw(endpoint(`version-group/${groupRef.name}`), signal));
  const dexes = pokeArray(group.pokedexes).map(pokeRef);
  if (!dexes.length) return [];
  // A game's API-declared regional dexes include DLC districts; union by national species ID.
  const entries = [];
  for (const dex of dexes.slice(0, 8)) entries.push(...parsePokedex(await raw(endpoint(`pokedex/${dex.name}`), signal)));
  return [...new Map(entries.map(entry => [entry.id, entry])).values()];
}
export async function loadPokemonSpecies(id: number, edition: PokemonEdition, language: string, signal: AbortSignal) {
  if (!Number.isInteger(id) || id < 1 || id > 10000) throw Error("Invalid Pokémon");
  const [pokemonRaw, speciesRaw, encounterRaw] = await Promise.all([raw(endpoint(`pokemon/${id}`), signal), raw(endpoint(`pokemon-species/${id}`), signal), edition.version ? raw(endpoint(`pokemon/${id}/encounters`), signal) : Promise.resolve([])]);
  const pokemon = pokeObject(pokemonRaw), species = pokeObject(speciesRaw);
  const group = edition.version ? pokeRef(pokeObject(await raw(endpoint(`version/${edition.version}`), signal)).version_group).name : "";
  const flavors = pokeArray(species.flavor_text_entries).map(pokeObject).filter(row => pokeRef(row.version).name === edition.version);
  const flavor = flavors.find(row => pokeRef(row.language).name === language) ?? flavors.find(row => pokeRef(row.language).name === "en");
  const chainId = pokeId(pokeRef(species.evolution_chain).url);
  const chain = chainId ? pokeObject(await raw(endpoint(`evolution-chain/${chainId}`), signal)).chain : null;
  return { id, name: pokeLocalized(species.names, language, pokeText(species.name)), flavor: pokeText(flavor?.flavor_text).replace(/[\n\f]/g, " "), types: parsePokeTypes(pokemon, edition.generation ?? 9), moves: parsePokeMoves(pokemon, group), encounters: parsePokeEncounters(encounterRaw, edition.version ?? ""), stats: pokeArray(pokemon.stats).map(pokeObject), abilities: pokeArray(pokemon.abilities).map(pokeObject), chain };
}
export async function loadPokemonLocations(edition: PokemonEdition, signal: AbortSignal) {
  if (!edition.region || !edition.version) return [];
  const region = pokeObject(await raw(endpoint(`region/${edition.region}`), signal));
  return pokeArray(region.locations).map(pokeRef).filter(ref => pokeId(ref.url) > 0).sort((a, b) => Number(!/-route-\d+$/.test(a.name)) - Number(!/-route-\d+$/.test(b.name)) || a.name.localeCompare(b.name, "en", { numeric: true }));
}
export async function loadPokemonLocation(id: number, version: string, signal: AbortSignal) {
  const location = pokeObject(await raw(endpoint(`location/${id}`), signal)), entries: { id: number; name: string; encounters: ReturnType<typeof parsePokeEncounters> }[] = [];
  const areas = pokeArray(location.areas).map(pokeRef).slice(0, 30);
  for (let start = 0; start < areas.length; start += 4) {
    const batch = await Promise.all(areas.slice(start, start + 4).map(async area => ({ area, data: pokeObject(await raw(endpoint(`location-area/${pokeId(area.url)}`), signal)) })));
    for (const { area, data } of batch) {
      for (const item of pokeArray(data.pokemon_encounters).map(pokeObject)) {
        const pokemon = pokeRef(item.pokemon), encounters = parsePokeEncounters([{ location_area: area, version_details: item.version_details }], version);
        if (encounters.length) {
          const id = pokeId(pokemon.url), existing = entries.find(row => row.id === id);
          if (existing) existing.encounters.push(...encounters);
          else entries.push({ id, name: pokemon.name, encounters });
        }
      }
    }
  }
  return entries;
}
export type PokemonChapter = { title: string; label: string; description: string };
export type PokemonArticle = { title: string; html: string; chapters: PokemonChapter[]; url: string };
export async function loadPokemonArticle(title: string, signal: AbortSignal): Promise<PokemonArticle> {
  if (!/^(Walkthrough:|Appendix:)/.test(title) || title.length > 240) throw Error("Invalid walkthrough");
  const data = pokeObject(await raw(wikiApi(WIKI, { action: "parse", page: title, redirects: "1", prop: "text|links" }), signal)), parsed = pokeObject(data.parse);
  if (!parsed.title) throw Error("Walkthrough unavailable");
  const actual = pokeText(parsed.title), html = pokeTextLong(pokeObject(parsed.text)["*"]);
  const root = new DOMParser().parseFromString(html, "text/html");
  root.querySelectorAll(".infobox,.navbox,.mw-editsection,.printfooter,#toc,.toc,.metadata").forEach(node => node.remove());
  const base = actual.replace(/\/Part \d+.*$/, ""), chapterMap = new Map<string, PokemonChapter>();
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    let target = ""; try { const url = new URL(anchor.getAttribute("href")!, WIKI); if (url.origin !== WIKI || !url.pathname.startsWith("/wiki/")) continue; target = decodeURIComponent(url.pathname.slice(6)).replace(/_/g, " "); } catch { continue; }
    if (target.startsWith(`${base}/Part `) && !chapterMap.has(target)) chapterMap.set(target, { title: target, label: anchor.textContent?.trim() || target.split("/").at(-1)!, description: (anchor.closest("li")?.textContent ?? anchor.closest("tr")?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 250) });
  }
  return { title: actual, html: sanitizeGuideHtml(root.body.innerHTML, `${WIKI}/wiki/${encodeURIComponent(actual)}`), chapters: [...chapterMap.values()].sort((a, b) => a.title.localeCompare(b.title, "en", { numeric: true })), url: `${WIKI}/wiki/${encodeURIComponent(actual)}` };
}
function pokeTextLong(value: unknown) { return typeof value === "string" ? value.slice(0, 700_000) : ""; }
export type PokemonMap = { title: string; image: string; fullImage?: string; url: string; width: number; height: number };
export async function loadPokemonMaps(category: string, signal: AbortSignal, cursor?: string, limit: 24 | 500 = 24) {
  const result = pokeObject(await raw(wikiApi(ARCHIVE, { action: "query", generator: "categorymembers", gcmtitle: `Category:${category}`, gcmtype: "file", gcmlimit: String(limit), prop: "imageinfo", iiprop: "url|size", ...(limit === 24 ? { iiurlwidth: "1000" } : {}), ...(cursor ? { gcmcontinue: cursor } : {}) }), signal));
  const pages = Object.values(pokeObject(pokeObject(result.query).pages)).map(pokeObject);
  const maps: PokemonMap[] = pages.flatMap(page => { const image = pokeObject(pokeArray(page.imageinfo)[0]), url = pokeText(image.thumburl || image.url); return /^https:\/\/archives\.bulbagarden\.net\/media\//.test(url) ? [{ title: pokeText(page.title).replace(/^File:/, "").replace(/\.png$/i, ""), image: url, fullImage: /^https:\/\/archives\.bulbagarden\.net\/media\//.test(pokeText(image.url)) ? pokeText(image.url) : url, url: pokeText(image.descriptionurl), width: Number(image.width), height: Number(image.height) }] : []; });
  maps.sort((a, b) => a.title.localeCompare(b.title, "en", { numeric: true }));
  return { maps, cursor: pokeText(pokeObject(result.continue).gcmcontinue) || undefined };
}
export async function loadPokemonEncounterMaps(edition: PokemonEdition, signal: AbortSignal) {
  if (!edition.maps || edition.hack) return [];
  const maps: PokemonMap[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 4; page++) {
    const result = await loadPokemonMaps(edition.maps, signal, cursor, 500);
    maps.push(...result.maps); cursor = result.cursor;
    if (!cursor) break;
  }
  return maps;
}
