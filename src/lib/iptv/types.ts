export type IptvChannel = {
  id: string;
  tvgId: string | null;
  name: string;
  logo: string | null;
  group: string | null;
  url: string;
  catchupSource: string | null;
  durationSec: number | null;
  attrs: Record<string, string>;
};

export type IptvPlaylist = {
  loading?: boolean;
  id: string;
  name: string;
  url: string;
  epgUrl: string | null;
  channels: IptvChannel[];
  fetchedAt: number;
  groups: string[];
};

export type IptvPlaylistSource = {
  id: string;
  name: string;
  url: string;
  epgUrl?: string;
  kind?: "m3u" | "xtream" | "epg";
  xtream?: {
    server: string;
    username: string;
    password: string;
  };
};

export type EpgProgram = {
  channelTvgId: string;
  title: string;
  description: string | null;
  startMs: number;
  endMs: number;
  category: string | null;
  iconUrl: string | null;
};

export type EpgChannelMeta = {
  displayName: string | null;
  icon: string | null;
};

export type EpgIndex = {
  byChannel: Map<string, EpgProgram[]>;
  channelMeta?: Map<string, EpgChannelMeta>;
  fetchedAt: number;
};

export type XmltvParseResult = {
  programs: EpgProgram[];
  channelMeta: Map<string, EpgChannelMeta>;
};
