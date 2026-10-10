export type RockHallClass = { year: number; artists: string[]; pages: Record<string, string> };

export const ROCK_HALL_URL =
  "https://en.wikipedia.org/w/api.php?action=parse&page=List%20of%20Rock%20and%20Roll%20Hall%20of%20Fame%20inductees&prop=wikitext&format=json&origin=*";

const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const SORTNAME = /\{\{\s*sortname\s*\|([^{}]*)\}\}/gi;

function stripNoise(cell: string): string {
  return cell
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/'''?/g, "")
    .trim();
}

/** The performers table names people with {{sortname}}, which a brace-stripping clean would erase. */
function namesIn(cell: string): { artists: string[]; pages: Record<string, string> } {
  const artists: string[] = [];
  const pages: Record<string, string> = {};
  const held = new Set<string>();
  const add = (name: string, page: string) => {
    const label = name.trim();
    const key = label.toLocaleLowerCase();
    if (!label || held.has(key)) return;
    held.add(key);
    artists.push(label);
    pages[label] = (page || label).split("#")[0].trim();
  };
  let rest = cell.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, " ");
  for (const match of rest.matchAll(SORTNAME)) {
    const parts = match[1].split("|").map((part) => part.trim());
    const name = [parts[0], parts[1]].filter(Boolean).join(" ");
    add(name, parts[2] || name);
    rest = rest.replace(match[0], " ");
  }
  for (const match of rest.matchAll(LINK)) add((match[2] ?? match[1]).trim(), match[1]);
  return { artists, pages };
}

/** Rows carry the class year in a rowspan cell, so later rows in a class have no year of their own. */
export function parseRockHall(wikitext: string): RockHallClass[] {
  const heading = wikitext.search(/^==+\s*Performers\s*==+/m);
  const from = heading < 0 ? 0 : heading;
  const start = wikitext.indexOf("{|", from);
  if (start < 0) return [];
  const end = wikitext.indexOf("\n|}", start);
  const table = wikitext.slice(start, end < 0 ? undefined : end);

  const byYear = new Map<number, RockHallClass>();
  let year = 0;
  for (const block of table.split(/\n\|-/)) {
    const cells = block
      .split(/\n[|!]/)
      .slice(1)
      .flatMap((cell) => cell.split("||"))
      .map(stripNoise);
    if (!cells.length) continue;
    let body = cells;
    const lead = cells[0] ?? "";
    // A year cell only appears on the first row of a class; otherwise the rowspan carries it.
    const found = Number(lead.replace(/\{\{[^{}]*\}\}/g, " ").match(/\b(?:19|20)\d{2}\b/)?.[0]);
    if (Number.isSafeInteger(found) && found >= 1986 && !LINK.test(lead)) {
      year = found;
      body = cells.slice(1);
    }
    LINK.lastIndex = 0;
    if (!year) continue;
    // Columns are Year | Image | Name | Inducted members | Prior nominations | Presenter,
    // and rowspans shift them row to row. Only the Name cell holds the inductee: the
    // members column would add every band lineup, the presenter column the speech giver.
    let artists: string[] = [];
    let pages: Record<string, string> = {};
    for (const cell of body) {
      const found = namesIn(cell);
      if (!found.artists.length) continue;
      artists = found.artists;
      pages = found.pages;
      break;
    }
    if (!artists.length) continue;
    const held = byYear.get(year) ?? { year, artists: [], pages: {} };
    for (const name of artists) {
      if (held.artists.includes(name)) continue;
      held.artists.push(name);
      held.pages[name] = pages[name];
    }
    byYear.set(year, held);
  }
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}
