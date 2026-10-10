import { safeFetchBytes } from "@/lib/safe-fetch";
import { CompanionRequests } from "./companion-request";
import { parseCurseForge, type CurseForgeProject } from "./minecraft-discovery";
import type { SimsMtsProject } from "./sims";

export type SimsCurseForgeGame = 2 | 4;
export function simsCurseForgeUrl(game: SimsCurseForgeGame, query: string, category: string, kind: string, sort: string) {
  const url = new URL(`https://www.curseforge.com/${game === 4 ? "sims4" : "the-sims-2"}/search`);
  url.search = new URLSearchParams({ page: "1", pageSize: "20", sortBy: sort }).toString();
  for (const [key, value] of [["search", query], ["categories", category], ["class", kind]]) if (value.trim()) url.searchParams.set(key, value.trim().slice(0, 200));
  return url.href;
}
const requests = new CompanionRequests(async (url, signal) => {
  // Catalog browsing stays in the background; bounded byte requests never launch the verification window.
  const response = await safeFetchBytes(url, { signal }, 14_000, 5 * 1024 * 1024);
  if (!response.ok) throw Error(response.status === 403 ? "source_blocked" : "source_unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw Error("source_unavailable");
  const decoder = new TextDecoder(); let bytes = 0, html = "";
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 5 * 1024 * 1024) throw Error("source_size");
      html += decoder.decode(chunk.value, { stream: true });
    }
    return html + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}, Date.now, 60_000);
export function loadSimsCurseForge(url: string, signal: AbortSignal, refresh = false) {
  const parsed = new URL(url);
  if (parsed.origin !== "https://www.curseforge.com" || !/^\/(sims4|the-sims-2)\/search$/.test(parsed.pathname)) throw Error("source_url");
  return requests.get(url, refresh ? 0 : 300_000, raw => parseCurseForge(String(raw), url, parsed.pathname.startsWith("/sims4/") ? "sims4" : "the-sims-2"), signal);
}
export function simsCurseForgeCard(project: CurseForgeProject, game: SimsCurseForgeGame): SimsMtsProject {
  const exact = project.downloads.replaceAll(",", "");
  return { id: project.id, title: project.name, creator: project.author, image: project.icon, page: project.url, description: project.description, category: project.categories.join(" › "), updated: project.updated, game,
    metrics: /^\d+$/.test(exact) ? { downloads: Number(exact) } : { rounded: { downloads: project.downloads } } };
}
