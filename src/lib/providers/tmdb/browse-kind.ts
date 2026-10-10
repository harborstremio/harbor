export type BrowseKind = "studio" | "network" | "country";
export type BrowseId = number | string;

export function browseDiscoverKey(kind: BrowseKind): string {
  if (kind === "network") return "with_networks";
  if (kind === "country") return "with_origin_country";
  return "with_companies";
}
