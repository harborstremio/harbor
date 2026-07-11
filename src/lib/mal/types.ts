export type MalSession = {
  accessToken: string;
  refreshToken: string;
  createdAt: number;
  expiresAt: number;
  userName: string;
};

export type MalListStatus = "watching" | "completed" | "on_hold" | "dropped" | "plan_to_watch";

export type MalAnime = {
  id: number;
  title: string;
  mainPicture: string | null;
  numEpisodes: number | null;
  mean: number | null;
  mediaType?: string;
};

export type MalListEntry = {
  status: MalListStatus;
  score: number;
  numEpisodesWatched: number;
  isRewatching: boolean;
  updatedAt: string;
  anime: MalAnime;
};

export type MalListGroup = {
  status: MalListStatus;
  entries: MalListEntry[];
};
