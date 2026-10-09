import type { Addon, CatalogDef } from "../addons";
import type { Meta } from "../cinemeta";
import type { SportsGame } from "./espn-types";
import { createEventChannelMatcher } from "./event-match";
import { normalizeChannelName } from "@/lib/sports/iptv-match";

export type SportsAddonListing = {
  key: string;
  addon: Addon;
  meta: Meta;
  match: "event" | "channel" | null;
};
export type SportsAddonRequest = {
  addon: Addon;
  catalog: CatalogDef;
  extras: { name: string; value: string }[];
};
const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const sportsWords =
  /sport|iptv|live\s*tv|football|soccer|basketball|baseball|cricket|hockey|rugby|tennis|boxing|combat|ufc|mma|wrestling|motorsport|racing|esports/i;
function catalogSport(name: string): string | undefined {
  const groups: [string, RegExp][] = [
    ["football", /american.?football|\bnfl\b/i],
    ["soccer", /football|soccer/i],
    ["basketball", /basketball|\bnba\b/i],
    ["baseball", /baseball|\bmlb\b/i],
    ["hockey", /hockey/i],
    ["combat", /fight|boxing|ufc|mma|combat/i],
    ["motorsport", /motor.?sport|racing|formula/i],
    ["tennis", /tennis/i],
    ["rugby", /rugby/i],
    ["golf", /golf/i],
    ["cricket", /cricket/i],
    ["aussie", /\bafl\b|australian/i],
    ["esports", /esport/i],
    ["darts", /darts/i],
    ["snooker", /snooker|billiard/i],
  ];
  return groups.find(([, pattern]) => pattern.test(name))?.[0];
}

export function sportsAddonCatalogs(addon: Addon): CatalogDef[] {
  if (addon.manifest.behaviorHints?.adult || addon.manifest.behaviorHints?.configurationRequired)
    return [];
  const sportsAddon = sportsWords.test(`${addon.manifest.id} ${addon.manifest.name}`);
  return (addon.manifest.catalogs ?? []).filter(
    (c) =>
      c.id &&
      c.type &&
      c.type !== "addon_catalog" &&
      (/^(tv|channel|sports?|events?|live)$/i.test(c.type) ||
        sportsAddon ||
        sportsWords.test(`${c.id} ${c.name}`)),
  );
}

export function sportsAddonRequests(
  addons: Addon[],
  game: SportsGame,
  sport?: string,
): SportsAddonRequest[] {
  const group = sport === "boxing" ? "combat" : sport;
  const lists = addons.map((addon) => ({
    addon,
    catalogs: sportsAddonCatalogs(addon).filter(
      (c) => !group || !catalogSport(c.name) || catalogSport(c.name) === group,
    ),
  }));
  const out: SportsAddonRequest[] = [];
  // Round-robin keeps a many-catalog addon from hiding another installed source.
  for (
    let pass = 0;
    pass < Math.max(0, ...lists.map((l) => l.catalogs.length)) && out.length < 32;
    pass++
  ) {
    for (const { addon, catalogs } of lists) {
      const catalog = catalogs[pass];
      if (!catalog) continue;
      const extras: SportsAddonRequest["extras"] = [];
      let usable = true;
      for (const extra of catalog.extra ?? []) {
        if (!extra.isRequired || extra.name === "search") continue;
        const option =
          (group ? extra.options?.find((o) => catalogSport(o) === group) : undefined) ??
          extra.options?.find((o) => /^(all|sports?)$/i.test(o)) ??
          extra.options?.[0];
        if (!option) {
          usable = false;
          break;
        }
        extras.push({ name: extra.name, value: option });
      }
      if (!usable) continue;
      const searchable =
        catalog.extra?.some((e) => e.name === "search") ||
        catalog.extraSupported?.includes("search");
      if (searchable) {
        const queries = [...new Set([game.home.name, game.away.name].filter(Boolean))];
        if (!queries.length && game.context?.name) queries.push(game.context.name);
        for (const value of queries.slice(0, 2)) {
          if (out.length < 32)
            out.push({ addon, catalog, extras: [...extras, { name: "search", value }] });
        }
      } else if (out.length < 32) out.push({ addon, catalog, extras });
    }
  }
  return out;
}

export function sportsAddonCatalogUrl(request: SportsAddonRequest, skip = 0): string {
  const { addon, catalog, extras } = request;
  const base = addon.transportUrl.replace(/\/manifest\.json\/?$/i, "");
  const values = [...extras, ...(skip ? [{ name: "skip", value: String(skip) }] : [])];
  const suffix = values.length
    ? `/${values.map((e) => `${encodeURIComponent(e.name)}=${encodeURIComponent(e.value)}`).join("&")}`
    : "";
  return `${base}/catalog/${encodeURIComponent(catalog.type)}/${encodeURIComponent(catalog.id)}${suffix}.json`;
}

export function sportsAddonListings(
  addon: Addon,
  catalog: CatalogDef,
  raw: unknown,
  game: SportsGame,
): SportsAddonListing[] {
  if (!Array.isArray(raw)) return [];
  const matchEvent = createEventChannelMatcher(game);
  const networks = (game.broadcasts ?? []).map(normalizeChannelName).filter((n) => n.length >= 3);
  const base = addon.transportUrl.replace(/\/manifest\.json\/?$/i, "");
  const out: SportsAddonListing[] = [];
  for (const value of raw.slice(0, 1500)) {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.id !== "string" ||
      typeof value.name !== "string"
    )
      continue;
    const meta: Meta = {
      ...value,
      type: typeof value.type === "string" ? value.type : catalog.type,
      addonOrigin: {
        id: addon.manifest.id,
        name: addon.manifest.name,
        logo: addon.manifest.logo,
        base,
      },
    };
    if (meta.adult || meta.isCollection) continue;
    const evidence = matchEvent(meta.name);
    const released = meta.releaseDate ? Date.parse(meta.releaseDate) : NaN;
    const datedConflict =
      Number.isFinite(released) && Math.abs(released - game.startMs) > 36 * 3600_000;
    const normalizedName = ` ${normalize(meta.name)} `;
    const codes = [game.home.abbr, game.away.abbr].map(normalize);
    const bothCodes =
      codes[0] !== codes[1] &&
      codes.every((code) => code.length >= 3 && normalizedName.includes(` ${code} `));
    const eventTitle = normalize(game.context?.name || "");
    const namedEvent =
      !game.away.name &&
      eventTitle.length >= 12 &&
      eventTitle.split(" ").length >= 3 &&
      normalizedName.includes(` ${eventTitle} `);
    const isEvent =
      !evidence.conflict &&
      !datedConflict &&
      (evidence.both || evidence.numberMatch || bothCodes || namedEvent);
    const channel = networks.includes(normalizeChannelName(meta.name));
    out.push({
      key: JSON.stringify([addon.transportUrl, meta.type, meta.id]),
      addon,
      meta,
      match: isEvent ? "event" : !evidence.conflict && channel ? "channel" : null,
    });
  }
  return out;
}

export function mergeSportsAddonListings(rows: SportsAddonListing[]): SportsAddonListing[] {
  const map = new Map<string, SportsAddonListing>();
  for (const row of rows) if (!map.has(row.key) || row.match === "event") map.set(row.key, row);
  return [...map.values()].sort(
    (a, b) =>
      Number(b.match === "event") - Number(a.match === "event") ||
      Number(!!b.match) - Number(!!a.match),
  );
}
