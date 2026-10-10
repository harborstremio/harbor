export type XxlFreshmanClass = { year: number; artists: string[]; pages: Record<string, string> };

export const XXL_FRESHMEN_URL =
  "https://en.wikipedia.org/w/api.php?action=parse&page=XXL%20(magazine)&prop=wikitext&section=4&format=json&origin=*";

const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const ROW = /\n\|-\s*/;
const CELL = /\n\|/;

function clean(cell: string): string {
  return cell
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/'''?/g, "")
    .trim();
}

/** Wikipedia keeps the classes in one sortable table, so a new year appears without a release. */
export function parseXxlFreshmen(wikitext: string): XxlFreshmanClass[] {
  const start = wikitext.indexOf("{|");
  if (start < 0) return [];
  const end = wikitext.indexOf("|}", start);
  const table = wikitext.slice(start, end < 0 ? undefined : end);
  const out: XxlFreshmanClass[] = [];
  const seen = new Set<number>();
  for (const block of table.split(ROW)) {
    // A row block already opens with "|", so the year cell has no newline in front of it.
    const cells = ("\n" + block).split(CELL).slice(1);
    if (cells.length < 2) continue;
    const year = Number(clean(cells[0]).match(/\b(?:19|20)\d{2}\b/)?.[0]);
    if (!Number.isSafeInteger(year) || year < 2000 || seen.has(year)) continue;
    const body = clean(cells.slice(1).join(" "));
    const artists: string[] = [];
    const pages: Record<string, string> = {};
    const held = new Set<string>();
    for (const match of body.matchAll(LINK)) {
      const name = (match[2] ?? match[1]).trim();
      const key = name.toLocaleLowerCase();
      if (!name || held.has(key)) continue;
      held.add(key);
      artists.push(name);
      pages[name] = match[1].split("#")[0].trim();
    }
    if (artists.length === 0) continue;
    seen.add(year);
    out.push({ year, artists, pages });
  }
  return out.sort((a, b) => b.year - a.year);
}

/** Match exact linked articles, including MediaWiki's normalized titles/redirects. */
export function xxlPortraits(value: unknown, freshmanClass: XxlFreshmanClass): Record<string, string> {
  type Obj = Record<string, unknown>;
  const obj = (v: unknown): Obj => v && typeof v === "object" ? v as Obj : {};
  const query = obj(obj(value).query);
  const redirects = new Map<string, string>();
  for (const key of ["normalized", "redirects"]) {
    for (const entry of Array.isArray(query[key]) ? query[key] : []) {
      const row = obj(entry);
      if (typeof row.from === "string" && typeof row.to === "string") redirects.set(row.from, row.to);
    }
  }
  const pages = new Map(Object.values(obj(query.pages)).map(value => {
    const page = obj(value); return [page.title, page] as const;
  }));
  const artwork: Record<string, string> = {};
  for (const name of freshmanClass.artists) {
    let title = freshmanClass.pages[name];
    const visited = new Set<string>();
    while (redirects.has(title) && !visited.has(title)) { visited.add(title); title = redirects.get(title)!; }
    const page = pages.get(title);
    if (!page || "missing" in page || "disambiguation" in obj(page.pageprops)) continue;
    const source = obj(page.thumbnail).source;
    if (typeof source === "string" && /^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(source)) artwork[name] = source;
  }
  return artwork;
}
