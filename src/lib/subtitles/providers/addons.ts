import { addonAccepts, type Addon } from "@/lib/addons";
import { safeFetch } from "@/lib/safe-fetch";
import { dlog } from "@/lib/debug";
import type { SubResult, SubSearchQuery } from "../types";
import { normalizeSubtitleLang } from "../language";
import { withSubtitleTimeout } from "../autoload";

type RawAddonSub = {
  id?: string;
  url?: string;
  lang?: string | null;
  language?: string | null;
  m?: string;
  SubFormat?: string;
};

function transportBase(transportUrl: string): string {
  return transportUrl.replace(/\/manifest\.json$/i, "").replace(/\/$/, "");
}

function contentId(q: SubSearchQuery): string | null {
  const base =
    q.stremioId?.trim() ||
    (q.imdbId ? (q.imdbId.startsWith("tt") ? q.imdbId : `tt${q.imdbId}`) : "");
  if (!base) return null;
  const isEpisode = q.season != null && q.episode != null;
  if (isEpisode && !/:\d+:\d+$/.test(base)) {
    return `${base}:${q.season}:${q.episode}`;
  }
  return base;
}

const PREFIX_PRIORITY = ["kitsu", "mal", "anidb", "anilist", "tt", "tmdb"];

function idPriority(id: string): number {
  for (let i = 0; i < PREFIX_PRIORITY.length; i++) {
    if (id.startsWith(PREFIX_PRIORITY[i])) return i;
  }
  return 999;
}

function declaresSubtitles(addon: Addon): boolean {
  const resources = addon.manifest?.resources ?? [];
  return resources.some((r) =>
    typeof r === "string" ? r === "subtitles" : r.name === "subtitles",
  );
}

function pickAddonId(
  addon: Addon,
  type: string,
  q: SubSearchQuery,
  fallback: string | null,
): string | null {
  const candidates = [...(q.candidateIds ?? [])].sort((a, b) => idPriority(a) - idPriority(b));
  for (const id of candidates) {
    if (addonAccepts(addon, "subtitles", type, id)) return id;
  }
  if (fallback && addonAccepts(addon, "subtitles", type, fallback)) return fallback;
  if (!declaresSubtitles(addon)) return null;
  const best = candidates.find((id) => id.startsWith("tt")) ?? fallback ?? candidates[0] ?? null;
  if (best) {
    dlog(
      `[addons] ${addon.manifest.name} manifest does not advertise ${type}/${best}, asking anyway`,
    );
  }
  return best;
}

function extraSegment(q: SubSearchQuery): string {
  const parts: string[] = [];
  if (q.videoHash) parts.push(`videoHash=${encodeURIComponent(q.videoHash)}`);
  if (q.videoSize != null) parts.push(`videoSize=${q.videoSize}`);
  if (q.filename) parts.push(`filename=${encodeURIComponent(q.filename)}`);
  return parts.length > 0 ? `/${parts.join("&")}` : "";
}

async function fetchAddonSubtitles(url: string, addonName: string): Promise<RawAddonSub[]> {
  dlog(`[addons] Fetching from ${addonName}: ${url}`);
  const res = await safeFetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    dlog(`[addons] ${addonName} returned ${res.status}`);
    return [];
  }
  const data = (await res.json()) as { subtitles?: RawAddonSub[] };
  const subtitles = Array.isArray(data?.subtitles) ? data.subtitles : [];
  dlog(`[addons] ${addonName} returned ${subtitles.length} subtitles`);
  return subtitles;
}

async function callOne(
  addon: Addon,
  type: string,
  id: string,
  extra: string,
  timeoutMs: number,
): Promise<RawAddonSub[]> {
  const base = transportBase(addon.transportUrl);
  const url = `${base}/subtitles/${type}/${id}${extra}.json`;
  const startedAt = Date.now();
  try {
    if (!extra) {
      return await fetchAddonSubtitles(url, addon.manifest.name);
    }

    const enrichedBudget = Math.min(4_000, Math.max(1_500, Math.floor(timeoutMs / 3)));
    const enriched = await withSubtitleTimeout(
      fetchAddonSubtitles(url, addon.manifest.name),
      enrichedBudget,
      [],
    );

    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(1_000, timeoutMs - elapsed);
    const bareUrl = `${base}/subtitles/${type}/${id}.json`;
    dlog(`[addons] ${addon.manifest.name} also checking without stream hints`);
    const bare = await withSubtitleTimeout(
      fetchAddonSubtitles(bareUrl, addon.manifest.name),
      remaining,
      [],
    );

    // Enriched endpoints improve file matching, but a number of translation
    // addons return only a tool/action entry there and publish the actual
    // translated tracks on the standard endpoint. Merge both responses so a
    // non-empty enriched response cannot suppress the real subtitles.
    const merged: RawAddonSub[] = [];
    const seen = new Set<string>();
    for (const subtitle of [...enriched, ...bare]) {
      const key = `${subtitle.id ?? ""}|${subtitle.url ?? ""}|${subtitle.lang ?? subtitle.language ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(subtitle);
    }
    return merged;
  } catch (e) {
    dlog(`[addons] ${addon.manifest.name} error: ${e}`);
    return [];
  }
}

export async function searchAddons(
  addons: Addon[],
  q: SubSearchQuery,
  timeoutMs: number,
): Promise<SubResult[]> {
  dlog(`[addons] searchAddons called with ${addons.length} addons`);

  const fallbackId = contentId(q);
  if (!fallbackId && (q.candidateIds ?? []).length === 0) {
    dlog("[addons] No content ID, returning empty");
    return [];
  }

  const type = q.type ?? (q.season != null && q.episode != null ? "series" : "movie");
  dlog(
    `[addons] Candidate IDs: ${(q.candidateIds ?? []).join(", ") || "(none)"}, fallback: ${fallbackId}, Type: ${type}`,
  );

  const targets = addons
    .map((addon) => ({ addon, id: pickAddonId(addon, type, q, fallbackId) }))
    .filter((t): t is { addon: Addon; id: string } => {
      if (t.id == null) {
        dlog(`[addons] ${t.addon.manifest.name} does NOT accept any id for ${type}`);
      }
      return t.id != null;
    });
  dlog(`[addons] === Filtered subtitle addons: ${targets.length} of ${addons.length} ===`);
  if (targets.length > 0) {
    dlog(
      `[addons] Accepting addons: ${targets.map((t) => `${t.addon.manifest.name}→${t.id}`).join(", ")}`,
    );
  }
  if (targets.length === 0) {
    dlog("[addons] No subtitle addons accept this content");
    return [];
  }

  const extra = extraSegment(q);
  const settled = await Promise.all(
    targets.map(async ({ addon, id }) => {
      const result = await withSubtitleTimeout(
        callOne(addon, type, id, extra, timeoutMs),
        timeoutMs,
        [],
      );
      dlog(`[addons] ${addon.manifest.name}: ${result.length} subtitles`);
      if (result.length > 0) dlog(`[addons] ${addon.manifest.name} raw sample`, result[0]);
      return result;
    }),
  );

  const out: SubResult[] = [];
  settled.forEach((subs, i) => {
    const addonName = targets[i].addon.manifest.name;
    for (let idx = 0; idx < subs.length; idx++) {
      const s = subs[idx];
      if (!s.url || s.url === "about:blank") continue;
      // Include addon name and index to ensure unique IDs across different addons
      const uniqueId = s.id
        ? `${addonName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${s.id}`
        : `${addonName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${idx}`;
      out.push({
        id: uniqueId,
        url: s.url,
        // Stremio's ecosystem contains useful translation addons that do not
        // declare a language. Keep those results visible under "Unknown".
        lang: normalizeSubtitleLang(s.lang ?? s.language),
        title: addonName,
        source: "addon",
        format: (s.SubFormat?.toLowerCase() as SubResult["format"]) || undefined,
        release: s.m || undefined,
      });
    }
  });

  dlog(`[addons] Total addon results: ${out.length}`);
  return out;
}
