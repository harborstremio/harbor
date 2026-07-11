import type { ResolvedAddon } from "@/lib/addons-store/store";
import { t } from "@/lib/i18n";

export function resourceLabels(rs: NonNullable<ResolvedAddon["manifest"]>["resources"] | undefined): string[] {
  if (!rs) return [];
  return rs.map((r) => (typeof r === "string" ? r : r.name));
}

export function subtitleFromManifest(r: ResolvedAddon): string {
  const m = r.manifest;
  if (!m) return t("Loading…");
  if (m.description) return m.description.split(/[.\n]/)[0]?.slice(0, 90) ?? "";
  const labels = resourceLabels(m.resources);
  return labels.join(" · ");
}

export function idOf(r: ResolvedAddon): string {
  return r.manifest?.id ?? r.curated?.id ?? r.transportUrl;
}

export function nameOf(r: ResolvedAddon): string {
  return r.manifest?.name ?? r.curated?.id ?? t("Untitled addon");
}

export function addonKey(r: ResolvedAddon): string {
  return idOf(r) + ":" + r.transportUrl;
}

export async function withMinDuration<T>(promise: Promise<T> | T, minMs: number): Promise<T> {
  const [result] = await Promise.all([Promise.resolve(promise), new Promise<void>((r) => setTimeout(r, minMs))]);
  return result;
}
