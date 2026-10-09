import { wowEquipmentIcon } from "./wow-equipment";
import { wowTalentCode } from "./wow-dungeon-runs";

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const integer = (value: unknown, min = 1, max = 10_000_000): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const text = (value: unknown, max = 200) => typeof value === "string" && value.trim().length <= max ? value.trim() : "";

export type WowTalentSpell = { id: number; name: string; image: string };
export type WowTalent = WowTalentSpell & { nodeId: number; treeId: number; rank: number; choice: boolean; alternatives: WowTalentSpell[]; x: number | null; y: number | null };
export type WowTalentGroup = "class" | "spec" | "hero";
export type WowTalents = {
  specId: number; code: string | null; partial: boolean;
  groups: Record<WowTalentGroup, WowTalent[]>;
  hero: { name: string; description: string; image: string } | null;
};
function spell(raw: unknown): WowTalentSpell | null {
  const value = row(raw), name = text(value.name);
  return integer(value.id) && name ? { id: value.id, name, image: wowEquipmentIcon(value.icon) } : null;
}
export function parseWowTalents(raw: unknown): WowTalents | null {
  const value = row(raw);
  if (!integer(value.loadout_spec_id, 1, 10_000)) return null;
  let partial = false;
  const seen = new Set<number>(), duplicates = new Set<number>();
  const groups = Object.fromEntries((["class", "spec", "hero"] as const).map(group => {
    const source = value[`${group}_talents`];
    if (!Array.isArray(source) || source.length > 100) { partial = true; return [group, []]; }
    const items = source.flatMap(raw => {
      const selected = row(raw), node = row(selected.node), entries = node.entries;
      if (!integer(node.id) || !integer(node.treeId) || !Array.isArray(entries) || !entries.length || entries.length > 10 || !integer(selected.entryIndex, 0, entries.length - 1) || !integer(selected.rank, 1, 20)) { partial = true; return []; }
      if (seen.has(node.id)) { duplicates.add(node.id); partial = true; return []; }
      seen.add(node.id);
      const chosen = spell(row(entries[selected.entryIndex]).spell);
      if (!chosen) { partial = true; return []; }
      const choice = node.type === 2;
      // Apex nodes can report rank 4 with maxRanks 1 on the selected entry.
      // Preserve the observed node rank; do not invent a points/max denominator.
      return [{ ...chosen, nodeId: node.id, treeId: node.treeId, rank: selected.rank, choice,
        alternatives: choice ? entries.flatMap((entry, index) => { const other = index !== selected.entryIndex ? spell(row(entry).spell) : null; return other ? [other] : []; }) : [],
        x: integer(node.posX, 0, 50_000) ? node.posX : null, y: integer(node.posY, 0, 50_000) ? node.posY : null }];
    });
    return [group, items];
  })) as WowTalents["groups"];
  for (const group of Object.keys(groups) as WowTalentGroup[]) groups[group] = groups[group].filter(item => !duplicates.has(item.nodeId));
  const all = Object.values(groups).flat(), treeIds = new Set(all.map(item => item.treeId));
  if (!all.length || treeIds.size !== 1) return null;
  const rawHero = row(value.active_hero_tree), heroName = text(rawHero.name), heroSlug = text(rawHero.slug, 80);
  const hero = heroName && integer(rawHero.id) && integer(rawHero.traitTreeId) && treeIds.has(rawHero.traitTreeId) ? {
    name: heroName, description: text(rawHero.description, 1200),
    image: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(heroSlug) && rawHero.iconUrl === `https://cdn.raiderio.net/images/site/hero_specs/herospec_${heroSlug}.png` ? String(rawHero.iconUrl) : "",
  } : null;
  return { specId: value.loadout_spec_id, code: wowTalentCode(value.loadout_text), groups, hero, partial };
}

/** Provider positions for selected nodes only. No inferred dependency edges. */
export function wowTalentPositions(nodes: WowTalent[]) {
  if (!nodes.length || nodes.some(node => node.x === null || node.y === null)) return null;
  const xs = nodes.map(node => node.x!), ys = nodes.map(node => node.y!);
  const minX = Math.min(...xs), minY = Math.min(...ys), width = Math.max(...xs) - minX, height = Math.max(...ys) - minY;
  if (width > 4800 || height > 9000) return null;
  // If a changed provider layout overlaps, use the readable icon list instead.
  if (nodes.some((a, i) => nodes.slice(i + 1).some(b => Math.abs(a.x! - b.x!) < 280 && Math.abs(a.y! - b.y!) < 280))) return null;
  return { height: Math.max(56, height / 600 * 58 + 56), points: [...nodes].sort((a, b) => a.y! - b.y! || a.x! - b.x!).map(node => ({ node, x: width ? (node.x! - minX) / width : .5, y: (node.y! - minY) / 600 * 58 })) };
}

export function wowSpellUrl(id: number) {
  if (!integer(id)) throw Error("Invalid spell identity");
  return `https://www.wowhead.com/spell=${id}`;
}
export type WowSpellDescription = { name: string; paragraphs: string[]; language: string };
export function wowSpellLocale(language: string) { return ({ de: 3, es: 6 } as Record<string, number>)[language] ?? 0; }
export function parseWowSpellDescription(raw: unknown, id: number, language: string): WowSpellDescription {
  wowSpellUrl(id);
  const value = row(raw), name = text(value.name);
  if (!name || typeof value.tooltip !== "string" || value.tooltip.length > 80_000) throw Error("Missing spell description");
  const doc = new DOMParser().parseFromString(value.tooltip, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,img,svg").forEach(node => node.remove());
  const link = doc.querySelector("a.whtt-name")?.getAttribute("href");
  if (!link || !new RegExp(`^/(?:[a-z]{2}/)?spell=${id}(?:/|$)`).test(link)) throw Error("Spell identity mismatch");
  const paragraphs = [...doc.querySelectorAll("div.q")].slice(0, 8).map(node => {
    node.querySelectorAll("br").forEach(br => br.replaceWith(doc.createTextNode("\n")));
    return (node.textContent ?? "").replace(/[\t ]+/g, " ").trim();
  }).filter(value => value && value.length <= 6000);
  if (!paragraphs.length) throw Error("Missing spell description");
  return { name, paragraphs, language: wowSpellLocale(language) === 0 ? "en" : language };
}
