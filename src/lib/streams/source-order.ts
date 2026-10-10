import type { DebridSlug } from "./types";

export const PROVIDER_VOD_ADDON_ID = "jl.provider-vod";
export const PROVIDER_VOD_LABEL = "Your provider";

export function isProviderVodStream(s: { addonId?: string }): boolean {
  return s.addonId === PROVIDER_VOD_ADDON_ID;
}

type Ranked = {
  addonId?: string;
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  cached?: Partial<Record<DebridSlug, boolean>>;
  inLibrary?: Partial<Record<DebridSlug, boolean>>;
};

const RD_TAG_RX = /\[(?:rd|real-?debrid)(?:\+|⚡|✅|⬇|⏳|\]|\s)/i;
const TB_TAG_RX = /\[(?:tb|trb|torbox)(?:\+|⚡|✅|⬇|⏳|\]|\s)/i;

/** The debrid service a stream plays through, as far as the stream itself says. */
export function streamDebridService(s: Ranked): "rd" | "tb" | null {
  const text = `${s.name ?? ""} ${s.title ?? ""} ${s.description ?? ""}`;
  const url = (s.url ?? "").toLowerCase();
  if (
    s.addonId === "rd-library" ||
    s.inLibrary?.rd === true ||
    s.cached?.rd === true ||
    RD_TAG_RX.test(text) ||
    url.includes("/realdebrid/") ||
    url.includes("real-debrid.com")
  ) {
    return "rd";
  }
  if (
    s.addonId === "tb-library" ||
    s.addonId === "app.torbox.stremio" ||
    s.inLibrary?.tb === true ||
    s.cached?.tb === true ||
    TB_TAG_RX.test(text) ||
    url.includes("/torbox/") ||
    url.includes("torbox.app")
  ) {
    return "tb";
  }
  return null;
}

/** The order sources are tried in: the viewer's own provider, then Real-Debrid, then TorBox. */
export function sourceOrderRank(s: Ranked): number {
  if (isProviderVodStream(s)) return 0;
  const service = streamDebridService(s);
  if (service === "rd") return 1;
  if (service === "tb") return 2;
  return 3;
}

type SearchAddon = { transportUrl: string; manifest: { id: string; name?: string } };

/** What a search covered, named the way the viewer set it up, in the order it is tried. */
export function searchedSourceLabels(providerNames: string[], addons: SearchAddon[]): string[] {
  const ranked: Array<[number, string]> = [];
  if (providerNames.length > 0) {
    ranked.push([0, `${PROVIDER_VOD_LABEL} (${providerNames.join(", ")})`]);
  }
  for (const a of addons) {
    const name = a.manifest.name?.trim() || a.manifest.id;
    const url = a.transportUrl.toLowerCase();
    if (/torrentio/.test(url) && url.includes("realdebrid=")) {
      ranked.push([1, `Real-Debrid (${name})`]);
    } else if (a.manifest.id === "app.torbox.stremio" || url.includes("stremio.torbox.app")) {
      ranked.push([2, "TorBox"]);
    } else {
      ranked.push([3, name]);
    }
  }
  const seen = new Set<string>();
  return ranked
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry[0] - b.entry[0] || a.index - b.index)
    .map(({ entry }) => entry[1])
    .filter((label) => !seen.has(label) && !!seen.add(label));
}
