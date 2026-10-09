import type { WowRegion } from "./wow-data";

export const WOW_REALM_TTL = 60_000;
export const WOW_REALM_REGIONS = ["us", "eu", "kr", "tw"] as const;
export type WowRealmRegion = typeof WOW_REALM_REGIONS[number];
export const WOW_REALM_EDITIONS = ["retail", "classic", "classic1x", "classicann"] as const;
export type WowRealmEdition = typeof WOW_REALM_EDITIONS[number];
export type WowClassicEdition = Exclude<WowRealmEdition, "retail">;
export type WowRealm = { name: string; slug: string; online: boolean | null; population: string; type: string; locale: string; timezone: string; category: string; newCharactersLocked: boolean | null; transfersLocked: boolean | null };
export type WowRealmDirectory = { realms: WowRealm[]; editionName: string };
export const wowRealmRegion = (value: WowRegion): value is WowRealmRegion => (WOW_REALM_REGIONS as readonly string[]).includes(value);
export const wowRealmKey = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase("en").replace(/['’]/g, "").replace(/\s+/g, "-");
export const wowRealmStatusUrl = (region: WowRealmRegion, edition: WowRealmEdition = "retail") => `https://worldofwarcraft.blizzard.com/en-us/${edition === "retail" ? "worldsoul" : edition}/${region}/server-status`;

// Blizzard's anonymous realm-status page uses this registered read-only query.
// Source: realm-status.f27d69c10c41a7d4b44a.js, observed 2026-09-30.
export function wowRealmRequest(region: WowRealmRegion, edition: WowRealmEdition = "retail") {
  if (!(WOW_REALM_REGIONS as readonly string[]).includes(region)) throw Error("Unsupported realm region");
  if (!(WOW_REALM_EDITIONS as readonly string[]).includes(edition)) throw Error("Unsupported realm edition");
  return { operationName: "GetInitialRealmStatusData", variables: { input: { compoundRegionGameVersionSlug: edition === "retail" ? region : `${edition}-${region}` } }, extensions: { persistedQuery: { version: 1, sha256Hash: "2417df09c21c29c0fc39a8aff3909c4ca67b712dc55a6cf9481d0d918e404384" } } };
}

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 100) => typeof value === "string" && value.length <= max && !/[\u0000-\u001f]/.test(value) ? value.trim() : "";
const bool = (value: unknown) => typeof value === "boolean" ? value : null;
// Blizzard serializes Classic lock enums as "true"/"false". Online is still a boolean.
const lock = (value: unknown) => value === "true" ? true : value === "false" ? false : bool(value);
const populations = new Set(["LOW", "MEDIUM", "HIGH", "FULL", "RECOMMENDED", "LOCKED"]);
const types = new Set(["NORMAL", "RP", "PVP", "RPPVP"]);
export function parseWowRealms(value: unknown): WowRealm[] {
  const response = row(value), data = row(response.data);
  if (response.errors != null || !Array.isArray(data.Realms) || !data.Realms.length || data.Realms.length > 1000) throw Error("Realm status unavailable");
  const seen = new Set<string>();
  return data.Realms.map(value => {
    const realm = row(value), name = text(realm.name, 80), slug = text(realm.slug, 100);
    if (!name || !slug || !/^[\p{L}\p{M}\p{N}-]+$/u.test(slug) || seen.has(slug)) throw Error("Invalid realm list");
    seen.add(slug);
    const population = text(row(realm.population).enum), type = text(row(realm.type).enum);
    return { name, slug, online: bool(realm.online), population: populations.has(population) ? population : "", type: types.has(type) ? type : "",
      locale: text(realm.locale, 20), timezone: text(realm.timezone, 40), category: text(realm.category, 60), newCharactersLocked: lock(row(realm.realmLockStatus).isLockedForNewCharacters), transfersLocked: lock(row(realm.realmLockStatus).isLockedForPct) };
  });
}
export function parseWowRealmDirectory(value: unknown, edition: WowRealmEdition): WowRealmDirectory {
  const realms = parseWowRealms(value), versions = row(row(value).data).GameVersions;
  const matching = Array.isArray(versions) ? versions.find(version => row(version).key === (edition === "retail" ? "modern" : edition)) : null;
  return { realms, editionName: text(row(matching).name) };
}
export function matchingWowRealm(realms: WowRealm[], value: string) {
  const key = wowRealmKey(value);
  return realms.find(realm => wowRealmKey(realm.slug) === key || wowRealmKey(realm.name) === key) ?? null;
}
export function filterWowRealms(realms: WowRealm[], value: string, language: string) {
  const key = wowRealmKey(value);
  return realms.filter(realm => wowRealmKey(realm.name).includes(key) || wowRealmKey(realm.slug).includes(key))
    .sort((a, b) => Number(wowRealmKey(b.name) === key) - Number(wowRealmKey(a.name) === key) || a.name.localeCompare(b.name, language));
}
