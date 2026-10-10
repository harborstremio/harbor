export type PmdbMediaType = "movie" | "tv";

export type PmdbIdType = "imdb" | "tmdb" | "tvdb" | "mal" | "anilist";

export type PmdbTarget = {
  tmdb_id?: number;
  media_type: PmdbMediaType;
  season?: number;
  episode?: number;
  id_type?: PmdbIdType;
  id_value?: string;
};

export type PmdbResumePoint = {
  id: string;
  tmdb_id: number;
  media_type: PmdbMediaType;
  season?: number | null;
  episode?: number | null;
  position_ms: number;
  runtime_ms: number;
  progress: number;
  created: string;
  updated: string;
  title?: string | null;
  poster?: string | null;
  year?: number | null;
};

export type PmdbResumeResponse = {
  items: PmdbResumePoint[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type PmdbSaveResumeResponse = {
  action: "saved" | "completed" | "ignored";
  reason?: string;
  item?: PmdbResumePoint;
  progress?: number;
};

export type PmdbWatchedItem = {
  id: string;
  tmdb_id: number;
  media_type: PmdbMediaType;
  season?: number | null;
  episode?: number | null;
  watched_at: string | null;
};

export type PmdbWatchedResponse = {
  items: PmdbWatchedItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type PmdbListItem = {
  id: string;
  list_id: string;
  tmdb_id: number;
  media_type: PmdbMediaType;
  title?: string;
  poster?: string;
  year?: number;
  created: string;
};

export type PmdbList = {
  id: string;
  name: string;
  description?: string;
  type: "watchlist" | "custom";
  item_count: number;
  created: string;
  updated: string;
};

export type PmdbListsResponse = {
  items: PmdbList[];
  total: number;
};

export type PmdbListItemsResponse = {
  items: PmdbListItem[];
  total: number;
};

export type PmdbSession = {
  apiKey: string;
  username?: string;
  validatedAt: number;
};
