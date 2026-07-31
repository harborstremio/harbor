export type AddonCategory =
  | "metadata"
  | "streams"
  | "subtitles"
  | "anime"
  | "sports"
  | "live-tv"
  | "tools"
  | "adult";

export type AddonTag =
  | "official"
  | "free"
  | "debrid-required"
  | "premium"
  | "p2p"
  | "usenet"
  | "torrent"
  | "configurable"
  | "self-host";

export type CuratedHero = {
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
};

export type CuratedEntry = {
  id: string;
  transportUrl: string;
  category: AddonCategory;
  tags: AddonTag[];
  curatorNote?: string;
  warnings?: string[];
  nsfw?: boolean;
  hero?: CuratedHero;
  rails: string[];
  recommended?: number;
};

export type CuratedRail = {
  id: string;
  title: string;
  blurb?: string;
  layout: "feature" | "list" | "tile";
};

export const CURATED_RAILS: CuratedRail[] = [];

export const CURATED_ADDONS: CuratedEntry[] = [];

export function curatedById(id: string): CuratedEntry | undefined {
  return CURATED_ADDONS.find((e) => e.id === id);
}

export function railEntries(railId: string): CuratedEntry[] {
  return CURATED_ADDONS.filter((e) => e.rails.includes(railId)).sort(
    (a, b) => (b.recommended ?? 0) - (a.recommended ?? 0),
  );
}

export function heroEntry(): CuratedEntry | undefined {
  return CURATED_ADDONS.find((e) => e.hero != null);
}
