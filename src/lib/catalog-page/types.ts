import type { Meta } from "@/lib/cinemeta";

/** One rail definition — same shape for movies, shows, kids, anime. */
export type CatalogRowSpec = {
  key: string;
  title: string;
  fetcher: (page: number) => Promise<Meta[]>;
  /** When true, never paginate past page 1. */
  noPaginate?: boolean;
  /** Min page-1 length to treat as “has more”. Default 14. */
  minVisible?: number;
};

/** Loaded rail state shared by all catalog routes. */
export type CatalogPageRow = {
  key: string;
  title: string;
  metas: Meta[];
  page: number;
  hasMore: boolean;
  ready: boolean;
  fetcher?: (page: number) => Promise<Meta[]>;
};

export type CatalogPageId = "movies" | "shows" | "kids" | "anime" | "home" | string;
