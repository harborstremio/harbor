export type TraktSession = {
  accessToken: string;
  refreshToken: string;
  createdAt: number;
  expiresIn: number;
  username: string | null;
};

export type DeviceCode = {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  pollIntervalSec: number;
};

export type TraktIds = {
  trakt?: number;
  slug?: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
};

export type TraktTarget =
  | { kind: "movie"; ids: TraktIds }
  | { kind: "episode"; show: { ids: TraktIds }; season: number; number: number; episodeIds?: TraktIds }
  | { kind: "show"; ids: TraktIds };

export type ScrobbleAction = "start" | "pause" | "stop";

export type ScrobbleResponse = {
  id: number | null;
  action: ScrobbleAction;
  progress: number;
  movie?: { ids: TraktIds; title?: string };
  episode?: { ids: TraktIds; season?: number; number?: number };
  show?: { ids: TraktIds; title?: string };
};

export type TraktItem = {
  type: "movie" | "show";
  title: string;
  year: number | null;
  ids: TraktIds;
  contextDate?: string;
};

export type TraktUserMe = {
  username: string;
  private: boolean;
  name?: string;
  vip?: boolean;
};

export type TraktError = {
  status: number;
  body: string;
  message: string;
};
