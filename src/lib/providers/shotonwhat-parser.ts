export type ProductionFacts = {
  acquisition: string | null;
  cameras: string[];
  lenses: string[];
  filmStock: string[];
  negativeWidth: string | null;
  aperture: string | null;
  aspectRatio: string | null;
  finish: string | null;
  sourceUrl: string;
};

export type ProductionExpect = {
  imdbId?: string | null;
  titles: string[];
  year?: string;
};

const CAMERA_CAP = 6;
const LENS_CAP = 6;
const STOCK_CAP = 2;

export function productionSlug(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['’:]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function productionSlugs(
  title: string,
  originalTitle: string | undefined,
  year: string | undefined,
): string[] {
  const clean = year?.trim().slice(0, 4);
  if (!clean || !/^\d{4}$/.test(clean)) return [];
  const bases = [title, originalTitle ?? "", title.split(/:|\s+-\s+/)[0] ?? ""]
    .map((value) => productionSlug(value))
    .filter((value) => value.length > 0);
  return [...new Set(bases)].slice(0, 3).map((base) => `${base}-${clean}`);
}

function decode(raw: string): string {
  return raw
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
}

function plain(raw: string): string {
  return decode(raw.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function escapeLabel(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldChunk(html: string, label: string): string | null {
  const re = new RegExp(
    `<div class="tablediv">\\s*${escapeLabel(label)}\\s*</div>\\s*<div class="tablediv_content">([\\s\\S]*?)</div>`,
    "i",
  );
  return re.exec(html)?.[1] ?? null;
}

type FieldValue = { text: string; note: string };

function fieldValues(html: string, label: string): FieldValue[] {
  const chunk = fieldChunk(html, label);
  if (!chunk) return [];
  return chunk
    .split(/<br\s*\/?>/i)
    .map((part) => {
      if (/addinfonow/.test(part)) return { text: "", note: "" };
      const rawNote = plain(/<small>([\s\S]*?)<\/small>/i.exec(part)?.[1] ?? "");
      const inner = /^\((.*)\)$/.exec(rawNote);
      const anchor = /<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(part)?.[1];
      return { text: plain(anchor ?? part), note: inner ? inner[1] : rawNote };
    })
    .filter((value) => value.text.length > 0);
}

function first(html: string, label: string, tail?: RegExp): string | null {
  const value = fieldValues(html, label)[0];
  if (!value) return null;
  const text = tail ? value.text.replace(tail, "").trim() : value.text;
  return text.length > 0 ? text : null;
}

function unitAnchors(html: string): Array<{ unit: string; href: string; text: string }> {
  const out: Array<{ unit: string; href: string; text: string }> = [];
  const groups = /<div class="single_page_group"><div class="tablediv">([^<]*)<\/div>([\s\S]*?)<\/div>/gi;
  let group: RegExpExecArray | null;
  while ((group = groups.exec(html)) !== null) {
    const unit = plain(group[1]);
    const links = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let link: RegExpExecArray | null;
    while ((link = links.exec(group[2])) !== null) {
      if (/addinfonow/.test(link[1])) continue;
      const href = /href="([^"]*)"/i.exec(link[1])?.[1] ?? "";
      const text = plain(link[2]);
      if (text) out.push({ unit, href, text });
    }
  }
  return out;
}

function collect(
  html: string,
  facet: string,
  label: string,
  tail: RegExp,
  cap: number,
): string[] {
  const units = unitAnchors(html)
    .filter((anchor) => anchor.href.includes(`/${facet}/`))
    .sort((a, b) => a.unit.localeCompare(b.unit))
    .map((anchor) => anchor.text);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...units, ...fieldValues(html, label).map((value) => value.text)]) {
    const name = raw.replace(tail, "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= cap) break;
  }
  return out;
}

function stockList(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of fieldValues(html, "Film Negative Stock")) {
    const name = value.text.replace(/\s+Neg\.?\s+Film$/i, "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= STOCK_CAP) break;
  }
  return out;
}

function finishLine(html: string): string | null {
  const value = fieldValues(html, "Finishing Method")[0];
  if (!value) return null;
  const name = value.text.replace(/\s+(?:Finishing\s+)?Process$/i, "").trim();
  if (!name) return null;
  return value.note ? `${name} (${value.note})` : name;
}

function imdbNumber(raw: string): number | null {
  const digits = /^tt0*(\d+)$/i.exec(raw.trim())?.[1];
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function pageImdbNumbers(html: string): number[] {
  const out = new Set<number>();
  for (const re of [/data-id="(tt\d+)"/gi, /imdb\.com\/title\/(tt\d+)/gi]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const value = imdbNumber(match[1]);
      if (value != null) out.add(value);
    }
  }
  return [...out];
}

function pageTitleYear(html: string): { slug: string; year: string } | null {
  const raw = /<meta property="og:title" content="([^"]*)"/i.exec(html)?.[1];
  if (!raw) return null;
  const parts = /^(.*)\((\d{4})\)$/.exec(plain(raw));
  if (!parts) return null;
  const slug = productionSlug(parts[1]);
  return slug ? { slug, year: parts[2] } : null;
}

export function verifyProductionPage(html: string, expect: ProductionExpect): boolean {
  if (html.length < 2000) return false;
  const pageIds = pageImdbNumbers(html);
  // shotonwhat re-pads its IMDb ids to 8 digits in the outbound link and 7 in the widget.
  const want = expect.imdbId ? imdbNumber(expect.imdbId) : null;
  if (want != null && pageIds.length > 0) return pageIds.includes(want);
  const head = pageTitleYear(html);
  if (!head || !expect.year || head.year !== expect.year.trim().slice(0, 4)) return false;
  return expect.titles.some((title) => productionSlug(title) === head.slug);
}

export function parseProductionFacts(
  html: string,
  sourceUrl: string,
  expect: ProductionExpect,
): ProductionFacts | null {
  if (!verifyProductionPage(html, expect)) return null;
  const facts: ProductionFacts = {
    acquisition: first(html, "Acquisition"),
    cameras: collect(html, "cameras", "Cameras", /\s+Camera$/i, CAMERA_CAP),
    lenses: collect(html, "lenses", "Lenses", /\s+Lenses$/i, LENS_CAP),
    filmStock: stockList(html),
    negativeWidth: first(html, "Film Negative Width", /\s+Film\s+Negative\s+Width$/i),
    aperture: first(html, "Camera Aperture", /\s+Camera\s+Aperture$/i),
    aspectRatio: first(html, "Distributed Aspect Ratio"),
    finish: finishLine(html),
    sourceUrl,
  };
  const populated =
    facts.acquisition != null ||
    facts.cameras.length > 0 ||
    facts.lenses.length > 0 ||
    facts.filmStock.length > 0 ||
    facts.negativeWidth != null ||
    facts.aperture != null ||
    facts.aspectRatio != null ||
    facts.finish != null;
  return populated ? facts : null;
}
