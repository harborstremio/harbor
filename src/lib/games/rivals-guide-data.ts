import { rivalsImage } from "./rivals-data";

export type RivalsGuideField = { label: string; value: string };
export type RivalsAbility = { id: string; name: string; kind: "attack" | "skills" | "teamUp"; image: string; description: string; fields: RivalsGuideField[]; form: number | null; effect?: "base" | "enhanced"; partner?: string };
export type RivalsGuideForm = { id: number; name: string; image: string; fields: RivalsGuideField[] };
export type RivalsGuide = { name: string; forms: RivalsGuideForm[]; abilities: RivalsAbility[]; partial: boolean };
const plain = (element: Element | undefined | null, max = 2000) => (element?.textContent ?? "").replace(/[\u0000-\u001f\s]+/g, " ").trim().slice(0, max);
const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const cells = (row: Element) => [...row.children].filter(cell => cell.tagName === "TD");
const rows = (table: Element | null | undefined) => [...table?.querySelectorAll("tr") ?? []].filter(row => row.closest("table") === table);
const image = (element: Element | undefined) => rivalsImage(element?.querySelector("img")?.getAttribute("src") ?? "");
function fields(cell: Element | undefined): RivalsGuideField[] {
  const entries = rows(cell?.querySelector("table"));
  if (entries.length > 64) throw Error("Oversized ability details");
  return entries.flatMap(row => { const [label, value] = cells(row), name = plain(label, 100); return name ? [{label:name,value:plain(value)}] : []; });
}

/** Read only the publisher's inert reference table. Never render or execute its HTML. */
export function parseRivalsGuide(raw: unknown, expectedName: string): RivalsGuide {
  if (typeof raw !== "string" || raw.length > 2_000_000 || !key(expectedName)) throw Error("Invalid hero reference");
  const document = new DOMParser().parseFromString(raw, "text/html");
  document.querySelectorAll("script,style,iframe,object,embed").forEach(node => node.remove());
  const article = document.querySelector(".art-inner-content .artText"), name = plain(article?.querySelector(".p1"), 100);
  if (!name || key(name) !== key(expectedName)) throw Error("Hero reference identity mismatch");
  const records = rows(article?.querySelector("table.table-imgs"));
  if (!records.length || records.length > 256) throw Error("Invalid ability table");
  const forms: RivalsGuideForm[] = [], abilities: RivalsAbility[] = [];
  const partners: string[] = [], effects = new Map<number, number>();
  let partial = false;
  for (const row of records) {
    const td = cells(row), type = plain(td[0], 4), title = plain(td[1], 160);
    if (type === "0") {
      if (!title || forms.length >= 16) throw Error("Invalid hero forms");
      forms.push({id:forms.length,name:title,image:image(td[2]),fields:fields(td[3])});
      continue;
    }
    // Type 3 is historical Team-Up content retained in the CMS but not shown by the current site.
    if (type === "3") continue;
    if (!["1", "2", "4"].includes(type)) { partial = true; continue; }
    if (type === "4" && image(td[2]) && image(td[3]) && !td[4]?.querySelector("table")) {
      partners.push(image(td[2]), image(td[3])); continue;
    }
    const description = plain(td[3]), details = fields(td[4]);
    if (!title || !description || !details.length) { partial = true; continue; }
    const index = plain(td.at(-1), 12), form = index === "" ? null : /^\d{1,2}$/.test(index) ? Number(index) : -1;
    if (form === -1) { partial = true; continue; }
    const ability: RivalsAbility = {id:String(abilities.length),name:title,kind:type === "1" ? "attack" : type === "4" ? "teamUp" : "skills",image:image(td[2]),description,fields:details,form:type === "4" ? null : form};
    if (type === "4") {
      const partner = form ?? 0, tier = effects.get(partner) ?? 0;
      if (tier > 1) { partial = true; continue; }
      effects.set(partner, tier + 1); ability.effect = tier ? "enhanced" : "base"; ability.partner = partners[partner];
    }
    abilities.push(ability);
  }
  const valid = abilities.filter(ability => {
    const present = ability.form === null || ability.form < forms.length;
    if (!present) partial = true;
    return present;
  });
  if (!forms.length || !valid.length) throw Error("Hero abilities unavailable");
  return {name,forms,abilities:valid,partial};
}
