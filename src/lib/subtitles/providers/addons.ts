import { addonAccepts, type Addon } from "@/lib/addons";
import { dlog } from "@/lib/debug";
import { safeFetch } from "@/lib/safe-fetch";

import { normalizeLang } from "../language";
import type { SubResult, SubSearchQuery } from "../types";

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
  const base = q.stremioId?.trim() || (q.imdbId ? (q.imdbId.startsWith("tt") ? q.imdbId : `tt${q.imdbId}`) : "");
  if (!base) return null;
  const isEpisode = q.season != null && q.episode != null;
  if (isEpisode && !/:\d+:\d+$/.test(base)) {
    return `${base}:${q.season}:${q.episode}`;
  }
  return base;
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
    if (!res.ok) {
      dlog(`[addons] ${addon.manifest.name} returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { subtitles?: RawAddonSub[] };
    const subs = Array.isArray(data?.subtitles) ? data.subtitles : [];
    dlog(`[addons] ${addon.manifest.name} returned ${subs.length} subtitles`);
    return subs;
  } catch (e) {
    dlog(`[addons] ${addon.manifest.name} error: ${e}`);
    return [];
  }
}

export async function searchAddons(addons: Addon[], q: SubSearchQuery): Promise<SubResult[]> {
  dlog(`[addons] searchAddons called with ${addons.length} addons`);

  const id = contentId(q);
  if (!id) {
    dlog("[addons] No content ID, returning empty");
    return [];
  }

  const type = q.type ?? (q.season != null && q.episode != null ? "series" : "movie");
  dlog(`[addons] Content ID: ${id}, Type: ${type}`);

  const subAddons = addons.filter((a) => {
    const accepts = addonAccepts(a, "subtitles", type, id);
    if (!accepts) {
      dlog(`[addons] ${a.manifest.name} does NOT accept ${type}/${id}`);
    }
    return accepts;
  });
  dlog(`[addons] === Filtered subtitle addons: ${subAddons.length} of ${addons.length} ===`);
  if (subAddons.length > 0) {
    dlog(`[addons] Accepting addons: ${subAddons.map((a) => a.manifest.name).join(", ")}`);
  }
  if (subAddons.length === 0) {
    dlog("[addons] No subtitle addons accept this content");
    return [];
  }

  const extra = extraSegment(q);
  const settled = await Promise.all(
    subAddons.map(async (addon) => {
      const result = await callOne(addon, type, id, extra);
      dlog(`[addons] ${addon.manifest.name}: ${result.length} subtitles`);
      return result;
    }),
  );

  const out: SubResult[] = [];
  settled.forEach((subs, i) => {
    const addonName = subAddons[i].manifest.name;
    for (let idx = 0; idx < subs.length; idx++) {
      const s = subs[idx];
      if (!s.url) continue;
      // Include addon name and index to ensure unique IDs across different addons
      const uniqueId = s.id
        ? `${addonName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${s.id}`
        : `${addonName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${idx}`;
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
