import type { SportsGame, SportsSide } from "./espn-types";
import { normalizeSportsSearch } from "./search-text";

const ORIGIN = "https://queensberry.co.uk";
const clean = (value?: string | null) => (value || "").replace(/\s+/g, " ").trim();

function portraitUrl(value?: string | null): string | undefined {
  if (!value || value.length > 1600) return;
  try {
    const url = new URL(value, ORIGIN);
    if (
      url.origin !== ORIGIN ||
      url.username ||
      url.password ||
      url.hash ||
      !/^\/cdn\/shop\/files\/[^/]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)
    )
      return;
    return url.href;
  } catch {
    return;
  }
}

function fighterName(heading: Element | null): string {
  const label = clean(heading?.querySelector("span")?.textContent);
  const name = clean(heading?.textContent);
  return clean(label && name.startsWith(label) ? name.slice(label.length) : name);
}

/** Read named main-event portraits only; the event poster and undercard are separate artwork. */
export function parseQueensberryDetail(html: string, game: SportsGame): SportsGame {
  if (
    game.source !== "official-boxing" ||
    game.league !== "BOXING" ||
    !/^queensberry:pages\/[a-z0-9-]+$/.test(game.id) ||
    html.length > 1_000_000
  )
    return game;
  const expected = `${ORIGIN}/${game.id.slice("queensberry:".length)}`;
  const template = document.createElement("template");
  // Parsing stays inert: no provider scripts or event handlers enter Harbor's DOM.
  template.innerHTML = html;
  const page = template.content;
  if (page.querySelector('link[rel="canonical"]')?.getAttribute("href") !== expected) return game;
  const banners = Array.from(page.querySelectorAll(".custom-banner-content h2")).slice(0, 3);
  if (banners.length !== 2) return game;
  const announced = banners.map((heading) => {
    const first = clean(heading.querySelector("span")?.textContent).replace(/^-+|-+$/g, "");
    // A rematch number belongs to the event title, never to the fighter's name.
    return normalizeSportsSearch(`${first} ${fighterName(heading)}`).replace(/\s+[2-9]$/, "");
  });
  if (
    announced.some((name) => !name || name.split(" ").length < 2) ||
    announced[0] === announced[1]
  )
    return game;
  const panels = Array.from(
    page.querySelectorAll("#id-fighter-result .fighter-result-info-image-content"),
  ).slice(0, 4);
  const people = panels
    .map((panel) => ({
      name: fighterName(panel.querySelector("h3")),
      image: portraitUrl(panel.querySelector("img")?.getAttribute("src")),
    }))
    .filter((person) => person.name.length <= 120 && person.name.split(" ").length > 1);
  const matched = announced.map((name) =>
    people.filter((person) => normalizeSportsSearch(person.name) === name),
  );
  if (matched.some((matches) => matches.length !== 1)) return game;
  const update = (side: SportsSide, index: number): SportsSide | undefined => {
    const person = matched[index][0];
    if (side.name && normalizeSportsSearch(side.name) !== announced[index]) return;
    const name = person.name;
    const logo = person.image || side.logo;
    return name === side.name && logo === side.logo ? side : { ...side, name, logo };
  };
  const home = update(game.home, 0);
  const away = update(game.away, 1);
  if (!home || !away || (home === game.home && away === game.away)) return game;
  return { ...game, home, away };
}
