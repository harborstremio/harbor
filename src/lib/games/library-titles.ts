/** Display-only rules. Provider names, edition identities and launch paths stay authoritative. */
export type LibraryTitleRules = {
  ignored: string;
  uppercase: string;
  dashToColon: boolean;
  automatic: boolean;
  existingIds: string[];
  locale: string;
};

export const defaultLibraryTitleRules = (): LibraryTitleRules => ({
  ignored: "", uppercase: "", dashToColon: false, automatic: false, existingIds: [], locale: "en",
});
const CONNECTIVES = new Set("and of an a the but or nor for yet as in on to from into like over with upon".split(" "));
const ROMAN = /^(?=.+$)M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/i;
const MAX_TERMS = 2000;
export function validLibraryTitle(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 500 && !/[\u0000-\u001f\u007f]/.test(value);
}
export function parseLibraryTitleRules(value: unknown, validId: (id: string) => boolean): LibraryTitleRules {
  if (!value || typeof value !== "object") throw Error("library_prefs_read");
  const v = value as Partial<LibraryTitleRules>;
  if (typeof v.ignored !== "string" || typeof v.uppercase !== "string" || v.ignored.length > MAX_TERMS || v.uppercase.length > MAX_TERMS
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v.ignored + v.uppercase)
    || typeof v.dashToColon !== "boolean" || typeof v.automatic !== "boolean"
    || !Array.isArray(v.existingIds) || v.existingIds.length > 5000 || v.existingIds.some(id => typeof id !== "string" || !validId(id))
    || typeof v.locale !== "string" || v.locale.length > 40) throw Error("library_prefs_read");
  try { if (!Intl.getCanonicalLocales(v.locale).length) throw Error(); } catch { throw Error("library_prefs_read"); }
  return { ignored:v.ignored, uppercase:v.uppercase, dashToColon:v.dashToColon, automatic:v.automatic, existingIds:[...new Set(v.existingIds)], locale:v.locale };
}

export function normaliseLibraryTitle(name: string, rules: Pick<LibraryTitleRules, "ignored" | "uppercase" | "dashToColon" | "locale">): string {
  if (!validLibraryTitle(name)) return name;
  const lower = (word: string) => word.toLocaleLowerCase(rules.locale);
  const ignored = new Set(rules.ignored.split(/\s+/u).filter(Boolean).map(lower));
  const uppercase = new Set(["hd", ...rules.uppercase.split(/\s+/u).filter(Boolean).map(lower)]);
  const words = name.trim().split(/\s+/u), output: string[] = [];
  let first = true, afterColon = false;
  for (const word of words) {
    if (rules.dashToColon && word === "-" && output.length && output.at(-1) !== "-") {
      const previous = output.at(-1)!;
      output[output.length - 1] = previous.endsWith(":") ? previous : `${previous}:`;
      afterColon = true;
      continue;
    }
    // Punctuation remains untouched. Compound words are cased individually;
    // apostrophes remain inside a word (Clancy's, Assassin's).
    const parts = [...word.matchAll(/[\p{L}\p{N}\p{M}]+(?:['’][\p{L}\p{N}\p{M}]+)*/gu)];
    let index = 0, formatted = "";
    for (const part of parts) {
      const start = part.index!, raw = part[0], prefix = word.slice(index,start), lowered = lower(raw);
      formatted += prefix;
      if (prefix.includes(":")) afterColon = true;
      const roman = /^[ivxlcdm]+$/i.test(raw) && ROMAN.test(raw);
      if (ignored.has(lowered)) formatted += raw;
      else if (roman) formatted += raw.toUpperCase();
      else if (uppercase.has(lowered)) formatted += raw.toLocaleUpperCase(rules.locale);
      else if (!first && !afterColon && CONNECTIVES.has(lowered)) formatted += lowered;
      else if (/^\p{N}/u.test(raw)) formatted += lowered;
      else { const letters = [...lowered]; formatted += letters[0].toLocaleUpperCase(rules.locale) + letters.slice(1).join(""); }
      first = false; afterColon = false; index = start + raw.length;
    }
    formatted += word.slice(index); output.push(formatted);
    if (word.slice(index).includes(":")) afterColon = true;
  }
  const result = output.join(" ");
  return validLibraryTitle(result) ? result : name;
}

const baselineSets = new WeakMap<string[], Set<string>>();
export function libraryTitle(id: string, original: string, entry: { title?: string | null; metadata?: {name:string} } | undefined, rules?: LibraryTitleRules): string {
  if (entry?.title !== undefined) return entry.title ?? original;
  if (entry?.metadata) return entry.metadata.name;
  if (!rules?.automatic) return original;
  let existing = baselineSets.get(rules.existingIds);
  if (!existing) { existing = new Set(rules.existingIds); baselineSets.set(rules.existingIds,existing); }
  return !existing.has(id) ? normaliseLibraryTitle(original,rules) : original;
}

export function matchesLibraryTitle(query: string, original: string, displayed: string): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  return !normalized || original.toLocaleLowerCase().includes(normalized) || displayed.toLocaleLowerCase().includes(normalized);
}

export type LibraryTitleItem = { id: string; name: string; original: string };
export function reviewLibraryTitles(items: LibraryTitleItem[], rules: LibraryTitleRules, restore = false) {
  const seen = new Set<string>();
  return items.filter(item => !seen.has(item.id) && !!seen.add(item.id)).map(item => {
    const next = restore ? item.original : normaliseLibraryTitle(item.original,rules);
    return { ...item, next, changed:next !== item.name };
  });
}

/** Keep unselected display names stable when saved rules change. */
export function libraryTitleChanges(items: LibraryTitleItem[], rows: ReturnType<typeof reviewLibraryTitles>, entries: Record<string,{title?:string|null}>, rules: LibraryTitleRules, restore: boolean) {
  const reviewed = new Map(rows.map(row=>[row.id,row]));
  return items.flatMap(item=>{
    const row = reviewed.get(item.id), previous = entries[item.id]?.title;
    const title = row ? restore ? null : row.next : item.name;
    const next = row && restore ? item.original : row?.next ?? item.name;
    const withoutChange = libraryTitle(item.id,item.original,entries[item.id],rules);
    // Rules are global, but a selected-title action must not rename other games.
    // Previously automatic titles become explicit before changing their rules.
    if (next === withoutChange && !row?.changed && !(row && restore && previous !== undefined)) return [];
    return [{id:item.id,title,expectedTitle:previous}];
  });
}
