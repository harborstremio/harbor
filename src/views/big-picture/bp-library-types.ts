import type { Meta } from "@/lib/cinemeta";
import type { LibraryItem } from "@/lib/stremio";

export type BpLibTab =
  | "library"
  | "watchlist"
  | "history"
  | "local"
  | "media-servers"
  | "lists"
  | "favorites"
  | "trakt"
  | "anilist"
  | "mal"
  | "simkl"
  | "letterboxd";

export type BpLibStatus = "loading" | "ready" | "error";

export type BpLibGroup = { id: string; label: string };

export type BpLibEntry = {
  key: string;
  meta: Meta;
  date: number | null;
  item?: LibraryItem;
  group?: string;
  /** One deduplicated title may be contributed by several home servers. */
  groups?: string[];
  /** Library memberships are separate from server memberships for home-server filtering. */
  libraries?: string[];
};

export type BpLibFeed = {
  entries: BpLibEntry[];
  status: BpLibStatus;
  groups: BpLibGroup[];
  libraries?: BpLibGroup[];
  hidden?: number;
};

export type BpLibSection = { label: string; items: BpLibEntry[]; total: number };
