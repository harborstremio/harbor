import type { Addon } from "@/lib/addons";
import { hostOf } from "@/lib/addons-store/reorder";
import type { StreamPriorityEntry } from "@/lib/settings/types";

export type AddonRankFn = (index: number, addon: Addon) => number;

export function addonKey(a: Pick<Addon, "manifest" | "transportUrl">): string {
  const id = (a.manifest?.id ?? "").trim().toLowerCase();
  return id !== "" ? id : `host:${hostOf(a.transportUrl)}`;
}

export function declaresStream(a: Pick<Addon, "manifest">): boolean {
  return (a.manifest?.resources ?? []).some((r) =>
    typeof r === "string" ? r === "stream" : r.name === "stream",
  );
}

export function resolveAddonRanks(
  addons: Addon[],
  prefs: StreamPriorityEntry[],
): AddonRankFn | null {
  if (prefs.length === 0) return null;
  if (addons.filter(declaresStream).length < 2) return null;
  const pos = new Map(prefs.map((p, i) => [p.key, i] as const));
  const base = prefs.length;
  return (index, addon) => pos.get(addonKey(addon)) ?? base + index;
}
