import type { Addon } from "@/lib/addons";

export type AddonFamily =
  | "aiostreams"
  | "aiostatus"
  | "mediafusion"
  | "torrentio"
  | "comet"
  | "other";

export function detectAddonFamily(addon: Pick<Addon, "manifest" | "transportUrl">): AddonFamily {
  const id = (addon.manifest.id ?? "").toLowerCase();
  const name = (addon.manifest.name ?? "").toLowerCase();
  const url = (addon.transportUrl ?? "").toLowerCase();
  const haystack = `${id} ${name} ${url}`;
  if (/aiostatus|aio[\s-]?status|--status--|stremio[\s-]?status/.test(haystack)) return "aiostatus";
  if (/aiostreams|aio[\s-]?streams/.test(haystack)) return "aiostreams";
  if (/mediafusion/.test(haystack)) return "mediafusion";
  if (/comet/.test(haystack)) return "comet";
  if (/torrentio/.test(haystack)) return "torrentio";
  return "other";
}

export function isAddonRanked(addon: Pick<Addon, "manifest" | "transportUrl">): boolean {
  const fam = detectAddonFamily(addon);
  return fam === "aiostreams";
}

export function isStatusOnlyAddon(addon: Pick<Addon, "manifest" | "transportUrl">): boolean {
  return detectAddonFamily(addon) === "aiostatus";
}
