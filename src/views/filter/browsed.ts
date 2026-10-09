import type { BrowseId, BrowseKind } from "@/lib/providers/tmdb/tmdb-brands";
import type { MetaFilter } from "@/lib/view";

export type Browsed = MetaFilter & { kind: BrowseKind; name: string };

export function browsedId(filter: Browsed): BrowseId {
  return filter.kind === "country" ? filter.iso : filter.id;
}

export function isBrowsed(filter: MetaFilter): filter is Browsed {
  return filter.kind === "studio" || filter.kind === "network" || filter.kind === "country";
}
