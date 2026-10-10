import { CURATED_ADDONS } from "./addons-store/curated";
import { adultContentHidden } from "./addons-store/adult-filter";
import { loadInstalled, isInstalled } from "./addon-store";

export type AddonHit = {
  id: string;
  name: string;
  logo?: string;
  transportUrl?: string;
  blurb?: string;
  installed: boolean;
};

function prettyHost(transportUrl: string): string {
  try {
    const host = new URL(transportUrl).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] ?? host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return "Addon";
  }
}

function score(hit: AddonHit, q: string): number {
  const name = hit.name.toLowerCase();
  let s = name === q ? 5 : name.startsWith(q) ? 4 : name.includes(q) ? 3 : 1;
  if (hit.installed) s += 0.5;
  return s;
}

export function searchAddonIndex(query: string, limit = 6): AddonHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const adultsAllowed = !adultContentHidden();
  const out = new Map<string, AddonHit>();

  for (const a of loadInstalled()) {
    const name = a.manifest?.name ?? prettyHost(a.transportUrl);
    const hay = `${name} ${a.manifest?.description ?? ""} ${a.id} ${a.transportUrl}`.toLowerCase();
    if (!hay.includes(q)) continue;
    out.set(a.id, {
      id: a.id,
      name,
      logo: a.manifest?.logo,
      transportUrl: a.transportUrl,
      blurb: a.manifest?.description,
      installed: true,
    });
  }

  for (const e of CURATED_ADDONS) {
    if (e.nsfw && !adultsAllowed) continue;
    const existing = out.get(e.id);
    if (existing) {
      existing.installed = true;
      continue;
    }
    const name = e.hero?.title ?? prettyHost(e.transportUrl);
    const hay = `${name} ${e.curatorNote ?? ""} ${e.id} ${e.transportUrl}`.toLowerCase();
    if (!hay.includes(q)) continue;
    out.set(e.id, {
      id: e.id,
      name,
      transportUrl: e.transportUrl,
      blurb: e.curatorNote,
      installed: isInstalled(e.id),
    });
  }

  return [...out.values()].sort((a, b) => score(b, q) - score(a, q)).slice(0, limit);
}
