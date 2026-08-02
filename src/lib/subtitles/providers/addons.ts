import { addonAccepts, type Addon } from "@/lib/addons";
import { safeFetch } from "@/lib/safe-fetch";
import { dlog } from "@/lib/debug";
import type { SubResult, SubSearchQuery } from "../types";
import { normalizeLang } from "../language";

type RawAddonSub = {
  id?: string;
  url: string;
  lang: string;
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
  return resources.some((r) => (typeof r === "string" ? r === "subtitles" : r.name === "subtitles"));
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
  const best =
    candidates.find((id) => id.startsWith("tt")) ?? fallback ?? candidates[0] ?? null;
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

async function callOne(addon: Addon, type: string, id: string, extra: string): Promise<RawAddonSub[]> {
  const base = transportBase(addon.transportUrl);
  const url = `${base}/subtitles/${type}/${id}${extra}.json`;
  dlog(`[addons] Fetching from ${addon.manifest.name}: ${url}`);
  try {
    const res = await safeFetch(url, { headers: { Accept: "application/json" } });
    let subs: RawAddonSub[] = [];
    if (res.ok) {
      const data = (await res.json()) as { subtitles?: RawAddonSub[] };
      subs = Array.isArray(data?.subtitles) ? data.subtitles : [];
      dlog(`[addons] ${addon.manifest.name} returned ${subs.length} subtitles`);
    } else {
      dlog(`[addons] ${addon.manifest.name} returned ${res.status}`);
    }
    if (subs.length === 0 && extra) {
      const bareRes = await safeFetch(`${base}/subtitles/${type}/${id}.json`, {
        headers: { Accept: "application/json" },
      });
      if (bareRes.ok) {
        const bareData = (await bareRes.json()) as { subtitles?: RawAddonSub[] };
        return Array.isArray(bareData?.subtitles) ? bareData.subtitles : [];
      }
    }
    return subs;
  } catch (e) {
    dlog(`[addons] ${addon.manifest.name} error: ${e}`);
    return [];
  }
}

export async function searchAddons(
  addons: Addon[],
  q: SubSearchQuery,
): Promise<SubResult[]> {
  dlog(`[addons] searchAddons called with ${addons.length} addons`);

  const fallbackId = contentId(q);
  if (!fallbackId && (q.candidateIds ?? []).length === 0) {
    dlog('[addons] No content ID, returning empty');
    return [];
  }

  const type = q.type ?? (q.season != null && q.episode != null ? "series" : "movie");
  dlog(`[addons] Candidate IDs: ${(q.candidateIds ?? []).join(', ') || '(none)'}, fallback: ${fallbackId}, Type: ${type}`);

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
    dlog(`[addons] Accepting addons: ${targets.map(t => `${t.addon.manifest.name}→${t.id}`).join(', ')}`);
  }
  if (targets.length === 0) {
    dlog('[addons] No subtitle addons accept this content');
    return [];
  }

  const extra = extraSegment(q);
  const settled = await Promise.all(
    targets.map(async ({ addon, id }) => {
      const result = await callOne(addon, type, id, extra);
      dlog(`[addons] ${addon.manifest.name}: ${result.length} subtitles`);
      return result;
    }),
  );

  const out: SubResult[] = [];
  settled.forEach((subs, i) => {
    const addonName = targets[i].addon.manifest.name;
    for (let idx = 0; idx < subs.length; idx++) {
      const s = subs[idx];
      if (!s.url) continue;
      // Include addon name and index to ensure unique IDs across different addons
      const uniqueId = s.id
        ? `${addonName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${s.id}`
        : `${addonName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${idx}`;
      out.push({
        id: uniqueId,
        url: s.url,
        lang: normalizeLang(s.lang),
        title: addonName,
        source: "addon",
        format: (s.SubFormat?.toLowerCase() as SubResult["format"]) || undefined,
      });
    }
  });

  dlog(`[addons] Total addon results: ${out.length}`);
  return out;
}

