import type { GameGuide, SteamGuidePage } from "./guides-data";
import type { PokemonArticle } from "./pokemon";
import { POKEMON_WIKI } from "./pokemon-source";

export function pokemonGuideLink(item: GameGuide, href: string): GameGuide | null {
  if (item.source !== "bulbapedia") return null;
  try {
    const url = new URL(href);
    if (url.origin !== POKEMON_WIKI || !url.pathname.startsWith("/wiki/") || url.search || url.hash) return null;
    const title = decodeURIComponent(url.pathname.slice(6)).replaceAll("_", " ");
    const base = item.id.replace(/\/Part \d+.*$/, "");
    if (title !== base && !(title.startsWith(`${base}/Part `) && /^\d+$/.test(title.slice(base.length + 6)))) return null;
    return { ...item, id: title, title: title.replace(/^(Walkthrough|Appendix):/, ""), url: url.href, description: "" };
  } catch { return null; }
}

/** Use the provider's chapter index, never invented chapter counts or destinations. */
export function pokemonGuideCatalog(article: PokemonArticle, query: string): SteamGuidePage {
  const root = new DOMParser().parseFromString(article.html, "text/html");
  const description = root.querySelector("p")?.textContent?.trim() ?? "";
  const guide = (id: string, title: string, description: string): GameGuide => ({
    id, title, description, source: "bulbapedia", author: "Bulbapedia", image: "",
    url: `${POKEMON_WIKI}/wiki/${encodeURIComponent(id.replaceAll(" ", "_"))}`,
  });
  const items = [guide(article.title, article.title.replace(/^(Walkthrough|Appendix):/, ""), description),
    ...article.chapters.map(chapter => guide(chapter.title, chapter.label, chapter.description.replace(chapter.label, "").replace(/^\s*[–—:-]\s*/, "")))];
  const terms = query.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matching = items.filter(item => {
    const text = `${item.title} ${item.description}`.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
  return { items: matching, total: matching.length, categories: [], more: false, empty: !matching.length };
}
