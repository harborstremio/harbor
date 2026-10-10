import { useEffect, useState, type RefObject } from "react";
import { loadAtlasGame } from "@/lib/games/atlas";
import { launcherCatalogLookup } from "@/lib/games/launcher-catalog";
import type { QuickGame } from "@/lib/games/quick-library";

const artworkKey = (item: QuickGame) => `${item.id}:${item.game?.igdbId ?? ""}:${item.game?.catalogSteamId ?? ""}`;

/** Only visible missing covers need metadata; installed names are never used to guess an edition. */
export function useQuickLibraryArtwork(items: QuickGame[], root: RefObject<HTMLElement | null>, active: boolean) {
  const [covers, setCovers] = useState<Record<string, string>>({});
  const missing = items.filter(item => !item.art && item.game && !item.game.steamId
    && (item.game.igdbId || launcherCatalogLookup(item.game.id, item.game.catalogSteamId)));
  const key = missing.map(artworkKey).join("|");
  useEffect(() => {
    if (!active || !root.current || !key) return;
    const controller = new AbortController(), requested = new Set<string>();
    const byId = new Map(missing.map(item => [item.game!.id, item]));
    let pending = Promise.resolve();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const item = byId.get(entry.target.getAttribute("data-library-game") ?? "");
        if (!item) continue;
        const id = artworkKey(item);
        if (requested.has(id) || covers[id]) continue;
        requested.add(id); observer.unobserve(entry.target);
        pending = pending.then(async () => {
          if (controller.signal.aborted) return;
          try {
            const value = await loadAtlasGame(item.game!, controller.signal);
            const image = value?.portrait || value?.capsule;
            if (image && !controller.signal.aborted) setCovers(previous => ({ ...previous, [id]: image }));
          } catch { /* Artwork failure must not affect the installed game or its controls. */ }
        });
      }
    }, { root: root.current, rootMargin: "100px" });
    for (const element of root.current.querySelectorAll("[data-library-game]")) observer.observe(element);
    return () => { observer.disconnect(); controller.abort(); };
  }, [active, key, root]);
  return (item: QuickGame) => item.art || covers[artworkKey(item)];
}
