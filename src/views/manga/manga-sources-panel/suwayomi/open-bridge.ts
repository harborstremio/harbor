import { setActiveMangaSource } from "@/lib/manga/sources";
import { linkServerSource } from "@/lib/manga/sources/suwayomi/server-link";
import type { SuwayomiServer } from "./types";

export function activateServerSource(server: SuwayomiServer): void {
  const src = linkServerSource(server);
  if (src) setActiveMangaSource(src.id);
}
