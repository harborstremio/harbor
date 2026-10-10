import type { IptvPlaylistSource } from "./types";

const ACTIVE_KEY = "harbor.iptv.active";

export function readActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function writeActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

export function toPlaylistSource(p: IptvPlaylistSource): IptvPlaylistSource {
  return { id: p.id, name: p.name, url: p.url, epgUrl: p.epgUrl, kind: p.kind, xtream: p.xtream };
}

/** The saved active source, or the first channel source when nothing valid is saved. */
export function resolveActiveSource(
  sources: IptvPlaylistSource[],
  activeId: string | null,
): IptvPlaylistSource | null {
  const channelSources = sources.filter((s) => (s.kind ?? "m3u") !== "epg");
  const found = channelSources.find((s) => s.id === activeId) ?? channelSources[0];
  return found ? toPlaylistSource(found) : null;
}
