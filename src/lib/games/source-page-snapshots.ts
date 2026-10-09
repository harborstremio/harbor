import type { SourcePageData } from "./source-page-data";
import { sourceArtworkTitles } from "./source-display";
import { sourceTitleKey } from "./source-title";

// Public release-page snapshots verified 2026-10-03. These retain published art
// when the origin returns its browser challenge; they confer no catalog identity.
const snapshots: Record<string, SourcePageData & { title: string }> = {
  "https://rutracker.org/forum/viewtopic.php?t=6917421": {
    title: "Hidden Land of Ana: Ghostly Realm",
    portrait: "https://i8.imageban.ru/out/2026/10/03/251fb44b8d4dda689b498f8e2b8f6bcc.jpg",
    description: "Join Ana in the Ghostly Realm, gathering rare ingredients and restoring balance through hidden-object puzzles.",
    screenshots: [],
  },
  "https://rutracker.org/forum/viewtopic.php?t=6914600": {
    title: "Echoes of Polis",
    portrait: "https://i4.imageban.ru/out/2026/09/27/2ceaf3537c2b8a0d3ea9d76f85db492f.png",
    description: "An isometric city-building strategy game by Dwarfveller, inspired by Zeus, Pharaoh and Caesar. Build a city, manage its economy and guide it through the challenges of a growing colony.",
    screenshots: [],
  },
};

export function sourcePageSnapshot(page: string, releaseTitle: string): SourcePageData | undefined {
  const snapshot = snapshots[page];
  return snapshot && sourceArtworkTitles(releaseTitle).some(title => sourceTitleKey(title) === sourceTitleKey(snapshot.title)) ? snapshot : undefined;
}
