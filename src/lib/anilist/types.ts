export type AnilistSession = {
  accessToken: string;
  createdAt: number;
  expiresAt: number;
  userId: number;
  userName: string;
  avatar?: string | null;
};

export type AnilistViewer = {
  id: number;
  name: string;
  avatar: string | null;
  siteUrl: string | null;
};

export type MediaListStatus =
  | "CURRENT"
  | "PLANNING"
  | "COMPLETED"
  | "DROPPED"
  | "PAUSED"
  | "REPEATING";

export type AnilistMedia = {
  id: number;
  idMal: number | null;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
    userPreferred: string | null;
  };
  coverImage: { extraLarge: string | null; large: string | null; medium: string | null };
  bannerImage: string | null;
  format: string | null;
  episodes: number | null;
  chapters?: number | null;
  averageScore: number | null;
  seasonYear: number | null;
  countryOfOrigin?: string | null;
  description?: string | null;
  status?: string | null;
};

export type AnilistMediaEntry = {
  id: number;
  status: MediaListStatus;
  progress: number;
  progressVolumes?: number;
  score: number;
  media: AnilistMedia;
};

export type AnilistListGroup = {
  status: MediaListStatus;
  entries: AnilistMediaEntry[];
};
